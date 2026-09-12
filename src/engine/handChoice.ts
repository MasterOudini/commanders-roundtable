// D416 - THE HAND REVEAL'S ADMISSION (Thoughtseize's family): one reader for the executor (does the
// revealed hand hold a choice at all?), the answer handler (is the pick one?), the bot, the fuzz driver
// and the harness. The card is read as printed - a card in a hand has no derived characteristics - and
// the noun is asked three ways: the types it must LACK (`nonland`, `noncreature` - a negation the
// permanent predicate cannot express), the look's predicates for what it must be, and the search's
// qualifier for a mana-value bound.
import { faceOf } from './oracle';
import { predicateAdmits } from '../data/replacementParse';
import type { InstanceId } from './types/ids';
import type { GameState } from './types/state';
import type { LookFilter, OracleDb, SearchQualifier } from './types/oracle';

export interface HandChoiceBound {
  readonly none: readonly string[];
  readonly filter: LookFilter | null;
  readonly qualifier: SearchQualifier | null;
}

export function handChoiceAdmits(state: GameState, oracle: OracleDb, card: InstanceId, bound: HandChoiceBound): boolean {
  const inst = state.cards[card];
  if (!inst) return false;
  const printing = oracle.byPrinting(inst.printingId);
  if (!printing) return false;
  const face = faceOf(printing, 0);
  if (bound.none.some((t) => face.typeLine.types.includes(t))) return false;
  const mv = bound.qualifier?.manaValue ?? null;
  if (mv) {
    const value = printing.manaValue;
    if (mv.op === 'lte' && !(value <= mv.n)) return false;
    if (mv.op === 'gte' && !(value >= mv.n)) return false;
    if (mv.op === 'eq' && value !== mv.n) return false;
  }
  return bound.filter === null || predicateAdmits(face, bound.filter.predicates);
}

/** The cards of `owner`'s hand the bound admits, in hand order. */
export function handChoiceCandidates(state: GameState, oracle: OracleDb, owner: string, bound: HandChoiceBound): readonly InstanceId[] {
  return (state.zones.hand[owner] ?? []).filter((id) => handChoiceAdmits(state, oracle, id, bound));
}
