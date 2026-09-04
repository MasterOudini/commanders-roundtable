// D312 - THE COST-REDUCTION SEAM: what a face's parsed reductions are worth on
// this board, for this player, right now (CR 601.2f). One number, folded into
// the generic part of the cast's payment problem by every builder of one
// (the offer, the cast, the client's preview through the offer's tax).
//
// ⚠️ NEVER a decision: every reduction here is a count the board answers
// (permanents you control that match, cards of a type in your graveyard,
// whether you control one). A reduction that would need a choice, a target or
// a memory of the turn does not parse and is not here.

import type { GameState } from './types/state';
import type { OracleDb, OracleFace } from './types/oracle';
import type { InstanceId, PlayerId } from './types/ids';
import type { ScriptRegistry } from './scripts/registry';
import type { PermanentPredicate } from '../data/replacementParse';
import { derive, type DeriveCache } from './derive';
import { faceOf } from './oracle';

function matches(any: readonly PermanentPredicate[], chars: ReturnType<typeof derive>): boolean {
  return any.some(
    (p) =>
      p.supertypes.every((t) => chars.typeLine.supertypes.includes(t)) &&
      p.types.every((t) => chars.typeLine.types.includes(t)) &&
      p.subtypes.every((t) => chars.typeLine.subtypes.includes(t)) &&
      p.colors.every((c) => chars.colors.includes(c)),
  );
}

/** The generic mana a cast of `face` by `player` costs less, from the board alone. */
export function castReduction(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  face: OracleFace,
  cache?: DeriveCache,
): number {
  if (face.costReductions.length === 0) return 0;
  let mine: InstanceId[] | null = null;
  const controlled = (): InstanceId[] => {
    if (mine === null) {
      mine = state.zones.battlefield.filter((id) => {
        const inst = state.cards[id];
        return inst !== undefined && inst.controller === player && !inst.phasedOut;
      });
    }
    return mine;
  };
  const countControlled = (any: readonly PermanentPredicate[]): number =>
    controlled().filter((id) => matches(any, derive(state, oracle, scripts, id, cache))).length;
  let total = 0;
  for (const r of face.costReductions) {
    if (r.kind === 'affinity') total += countControlled(r.per);
    else if (r.kind === 'perControl') total += r.amount * countControlled(r.per);
    else if (r.kind === 'ifControl') total += countControlled(r.any) > 0 ? r.amount : 0;
    else {
      let n = 0;
      for (const id of state.zones.graveyard[player] ?? []) {
        const inst = state.cards[id];
        const card = inst ? oracle.byPrinting(inst.printingId) : undefined;
        if (!card) continue;
        const f = faceOf(card, 0);
        if (r.types.some((t) => f.typeLine.types.includes(t))) n += 1;
      }
      total += r.amount * n;
    }
  }
  return total;
}
