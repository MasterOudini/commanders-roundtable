import type { ClientSession } from '../client';
import type { Intent } from '../../engine/types/intents';
import type { TargetSpec } from '../../engine/types/oracle';
import type { InstanceId } from '../../engine/types/ids';
import type { TargetChoice } from '../../engine/types/state';
import type { TestTable } from './table';

// Extracted so a measurement harness can reuse the same script the tests use.

/**
 * Pick the targets a spell or ability requires, from the acting client's own view.
 *
 * ⚠️ PER CLAUSE, not "the first N legal choices". `validateTargets` does not just
 * check that every choice is legal *somewhere* — it runs `assignTargets`, which
 * has to match the choices to the clauses one-for-one. A flat "first N of the
 * union" list satisfies neither: two picks that both only answer clause A leave
 * clause B unfilled, and the host rejects the whole thing. So each clause is
 * filled from its OWN legal set, and `taken` stops one object answering twice
 * (`validateTargets` refuses a duplicate outright).
 *
 * `spec.min` is what a clause REQUIRES; an optional clause ("up to one target")
 * has min 0 and is simply left empty, which is the minimal legal answer.
 *
 * Returns null when a required clause has no legal object left — the caller must
 * then not cast at all, or abandon the cast if it is already staged.
 */
function planTargets(
  session: ClientSession,
  source: InstanceId,
  specs: readonly TargetSpec[],
): TargetChoice[] | null {
  const taken = new Set<string>();
  const targets: TargetChoice[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.min; i++) {
      const pick = session
        .legalTargetsFor([spec], source)
        .find((c) => !taken.has(`${c.kind}:${c.id}`));
      if (!pick) return null;
      taken.add(`${pick.kind}:${pick.id}`);
      targets.push(pick);
    }
  }
  return targets;
}

/**
 * Answer whatever the game is waiting for, from the acting client's own view.
 *
 * ⚠️ It ATTACKS and it CASTS. A script that only passed priority and played
 * lands never produced combat state, damage, a stack, a death or commander
 * damage — so it exercised about a third of the projection and none of the parts
 * where a patch is most likely to be wrong.
 */
export function simplestIntent(
  session: ClientSession,
  snapshot: ReturnType<ClientSession['snapshot']>,
): Intent | null {
  const awaiting = snapshot.awaiting;
  if (awaiting) {
    switch (awaiting.kind) {
      case 'mulligan': {
        const p = awaiting.players[0];
        return p === snapshot.you ? { t: 'MulliganDecision', player: p, keep: true } : null;
      }
      case 'declareAttackers': {
        if (awaiting.player !== snapshot.you) return null;
        const view = session.currentView();
        const mine = view.zones[`bf:${snapshot.you}`] ?? [];
        const defender = view.seatOrder.find((p) => p !== snapshot.you && !view.seats[p]?.lost);
        const attackers = defender
          ? mine
              .filter((id) => {
                const card = view.cards[id];
                return card && card.power !== null && !card.tapped && !card.summoningSick;
              })
              .map((id) => ({ card: id, defender: { kind: 'player' as const, id: defender } }))
          : [];
        return { t: 'DeclareAttackers', player: awaiting.player, attackers };
      }
      case 'declareBlockers': {
        const p = awaiting.players.find((x) => !awaiting.submitted.includes(x));
        return p === snapshot.you ? { t: 'DeclareBlockers', player: p, blocks: [] } : null;
      }
      case 'chooseLegendKeep': {
        const keep = awaiting.candidates[0];
        return awaiting.player === snapshot.you && keep
          ? { t: 'ChooseLegendKeep', player: awaiting.player, keep }
          : null;
      }
      case 'commanderZoneChoice':
        return awaiting.player === snapshot.you
          ? { t: 'CommanderZoneChoice', player: awaiting.player, toCommandZone: true, always: true }
          : null;
      case 'orderTriggers':
        return awaiting.player === snapshot.you
          ? { t: 'OrderTriggers', player: awaiting.player, order: [...awaiting.triggers] }
          : null;
      /**
       * ⚠️ Without this the script WEDGES, and it looks like a desync rather than
       * a gap. The targeting work added this prompt; `simplestIntent` casts
       * spells, so the first targeted spell it cast fell to `default: return
       * null` and nothing was ever submitted again. `two-instance.cjs` then
       * failed three checks whose output reads `host t?` — that `?` was this
       * function having no answer, not the two apps disagreeing.
       */
      case 'chooseTargets': {
        if (awaiting.player !== snapshot.you) return null;
        const targets = planTargets(session, awaiting.source, awaiting.specs);
        // The board can change between choosing to cast and being asked (another
        // player responds, something dies). Abandoning is the terminating answer;
        // returning null here would be the wedge this case exists to remove.
        return targets
          ? { t: 'ChooseTargets', player: awaiting.player, targets }
          : { t: 'CancelPendingCast', player: awaiting.player };
      }
      default:
        return null;
    }
  }
  if (snapshot.priority !== snapshot.you) return null;
  const land = snapshot.legal.find((a) => a.t === 'PlayLand');
  if (land?.t === 'PlayLand') return { t: 'PlayLand', player: snapshot.you, card: land.card };
  /**
   * ⚠️ Skipping an untargetable spell is what stops the `CancelPendingCast` above
   * becoming a LIVELOCK. `legalActions` does not check targets at all — it offers
   * Swords to Plowshares with an empty board — so without this the script would
   * cast, be asked, cancel, and cast the same card again forever. That burns the
   * loop's budget without advancing a turn, which fails exactly the same three
   * checks as the wedge it replaced.
   *
   * Deliberately the same shape as the `!a.hasX` filter beside it: the script
   * declines what it has no simple answer for rather than guessing badly.
   */
  const cast = snapshot.legal.find(
    (a) =>
      a.t === 'CastSpell' &&
      a.affordable &&
      !a.hasX &&
      planTargets(session, a.card, session.targetSpecsFor(a.card)) !== null,
  );
  if (cast?.t === 'CastSpell') {
    // ⚠️ Through `previewCast`, not a bare `CastSpell`. That is the path a real
    // player takes, and it is the one that proves the client's solver and the
    // host's validator agree about a plan built from a `SolveInput` off the wire.
    const preview = session.previewCast(cast.card, 0);
    if (preview?.plan) {
      return { t: 'CastSpell', player: snapshot.you, card: cast.card, plan: preview.plan };
    }
  }
  return { t: 'PassPriority', player: snapshot.you };
}

/**
 * Play the game forward using ONLY what each client can see.
 *
 * ⚠️ Every intent comes from the client whose seat it names, chosen from that
 * client's own `legalActions`. A script that drove the game from the host's
 * state would prove the engine works and nothing at all about the wire.
 */
export function playFrom(table: TestTable, steps: number): number {
  let acted = 0;
  for (let i = 0; i < steps; i++) {
    let moved = false;
    for (const client of table.clients) {
      const snapshot = client.session.snapshot();
      if (snapshot.finished) return acted;
      const intent = simplestIntent(client.session, snapshot);
      if (!intent) continue;
      client.session.submit(intent);
      acted++;
      moved = true;
      break;
    }
    if (!moved) break;
  }
  return acted;
}

