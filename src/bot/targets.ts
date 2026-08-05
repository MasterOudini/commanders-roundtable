// Choosing what a spell or ability points at.
//
// ⚠️ MOVED HERE FROM `src/net/testing/script.ts`, which now imports it. One copy,
// because the rule it encodes is D102's and two copies of a rule that subtle
// will drift: targets are matched to clauses ONE FOR ONE by `assignTargets`, so
// "the first N legal choices" is rejected whenever two picks answer the same
// clause and leave another empty.

import type { InstanceId } from '../engine/types/ids';
import type { TargetChoice } from '../engine/types/state';
import type { TargetSpec } from '../engine/types/oracle';
import type { PlayerView } from '../view/types';

/** Just enough of a port to plan targets, so the test driver can pass a session. */
export interface TargetSource {
  legalTargetsFor(specs: readonly TargetSpec[], sourceCard: InstanceId): TargetChoice[];
}

/**
 * Prefer what belongs to somebody else.
 *
 * ⚠️ The ONE behavioural addition over the copy this replaces, and it is an
 * ORDERING, never a filter — the legal set is untouched, so the "skip a spell
 * whose targets cannot be planned" livelock guard below is unaffected. Without
 * it a bot holding Lightning Bolt and one Grizzly Bears shoots its own creature,
 * which reads as a broken bot rather than as a missing preference.
 */
function preference(choice: TargetChoice, view: PlayerView | null, me: string): number {
  if (!view) return 0;
  if (choice.kind === 'player') return choice.id === me ? 3 : 0;
  if (choice.kind === 'stack') {
    const item = view.stack.find((s) => s.stackItemId === choice.id);
    return item && item.controller === me ? 3 : 0;
  }
  const card = view.cards[choice.id];
  if (!card) return 1;
  return card.controller === me ? 3 : 0;
}

/**
 * Fill every clause of a spell from its own legal set.
 *
 * ⚠️ PER CLAUSE, not "the first N legal choices". `validateTargets` runs
 * `assignTargets`, a one-for-one matching, and rejects a flat list that leaves
 * any clause unfilled. `taken` stops one object answering twice, which
 * `validateTargets` refuses outright.
 *
 * `spec.min` is what a clause REQUIRES; an optional clause has min 0 and is left
 * empty, which is the minimal legal answer.
 *
 * Returns null when a required clause has no legal object left. The caller must
 * then not cast at all, or abandon a cast already staged — see the two halves of
 * D102 in `policy.ts` and `awaiting.ts`.
 */
export function planTargets(
  source: TargetSource,
  card: InstanceId,
  specs: readonly TargetSpec[],
  view: PlayerView | null = null,
  me = '',
): TargetChoice[] | null {
  const taken = new Set<string>();
  const targets: TargetChoice[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.min; i++) {
      const legal = source.legalTargetsFor([spec], card).filter((c) => !taken.has(`${c.kind}:${c.id}`));
      // ⚠️ WITH NO VIEW, THE ORDER IS LEFT ALONE — first legal, exactly as the
      // copy this replaces behaved. `src/net/testing/script.ts` drives 15 call
      // sites across the net suite and the two-instance sign-off, and quietly
      // changing which object those games aim at would be a change to what they
      // prove, dressed as a refactor.
      const pick = view
        ? // A TOTAL ORDER — preference, then kind, then id. The id is a string
          // from the log, so the same board always aims the same way and a bot
          // game replays to the same state hash.
          [...legal].sort((a, b) => {
            const d = preference(a, view, me) - preference(b, view, me);
            if (d !== 0) return d;
            return a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind);
          })[0]
        : legal[0];
      if (!pick) return null;
      taken.add(`${pick.kind}:${pick.id}`);
      targets.push(pick);
    }
  }
  return targets;
}
