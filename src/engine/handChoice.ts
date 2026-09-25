// D416 - THE HAND REVEAL'S ADMISSION (Thoughtseize's family): one reader for the executor (does the
// revealed hand hold a choice at all?), the answer handler (is the pick one?), the bot, the fuzz driver
// and the harness. The card is read as printed - a card in a hand has no derived characteristics - and
// the noun is asked three ways: the types it must LACK (`nonland`, `noncreature` - a negation the
// permanent predicate cannot express), the look's predicates for what it must be, and the search's
// qualifier for a mana-value bound.
import { faceOf } from './oracle';
import { predicateAdmits } from '../data/replacementParse';
import { candidatesFromState, minimumLegalTargets } from './targets';
import { castReduction } from './costs';
import { buildPaymentProblem } from './mana';
import { affordable, solveInputFor } from './payment';
import { spellPurpose } from './spend';
import type { EngineDeps } from './loop';
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

/**
 * D491 - THE FROM-HAND FREE CAST's admission (`You may cast a spell ... from your hand without paying its mana
 * cost`): the bound above on the card as printed, and CASTABILITY under the grant - a nonland front face with a
 * mana cost (a land is played, never cast; a face with no cost cannot be cast at all, CR 601.2), no chooser-verb
 * additional cost (the pick carries no picks - a life payment or an `or pay {M}` still rides the problem), and a
 * legal set of targets on the board now for every one of its clauses (CR 601.2c - a cast that could not be
 * announced is not offered, the way the cast offer is not). One reader for the executor (is there a choice at
 * all?), the answer handler, the fuzz driver and the harness.
 */
export function freeCastAdmits(state: GameState, deps: EngineDeps, card: InstanceId, bound: HandChoiceBound): boolean {
  if (!handChoiceAdmits(state, deps.oracle, card, bound)) return false;
  const inst = state.cards[card];
  const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
  if (!inst || !printing) return false;
  const face = faceOf(printing, 0);
  if (face.manaCost === null || face.isLand) return false;
  const add = face.additionalCost;
  if (add !== null && (add.sacrificeCost !== null || add.discardCost !== null || add.tapCost !== null || add.exileFromGraveyardCost !== null || add.returnCost !== null)) return false;
  if (face.modal !== null || face.targets.length === 0) return true;
  return minimumLegalTargets(face.targets, { controller: inst.zone.player ?? inst.owner, colors: face.colors }, candidatesFromState(state, deps)) !== null;
}

/**
 * D541 - a MADNESS cast (CR 702.35a): the free cast's reader over the exiled card (castable, its targets there) and its
 * madness cost payable now - the solver's plan over the owner's sources, the board's reductions taken off (the cast
 * prices the same). One read for the prompt's `payable`, the fuzz driver and the proofs.
 */
export function madnessCastAdmits(state: GameState, deps: EngineDeps, card: InstanceId): boolean {
  if (!freeCastAdmits(state, deps, card, { none: [], filter: null, qualifier: null })) return false;
  const inst = state.cards[card];
  const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
  if (!inst || !printing) return false;
  const face = faceOf(printing, 0);
  if (face.madnessCost === null) return false;
  const problem = buildPaymentProblem(face.madnessCost, 0, [], -castReduction(state, deps.oracle, deps.scripts, inst.owner, face));
  return affordable(solveInputFor(state, deps.oracle, deps.scripts, inst.owner), problem, spellPurpose(face, false));
}

/** The cards of `player`'s own hand the grant admits, in hand order - or of the prompt's POOL (D525, cascade's candidate). */
export function freeCastCandidates(state: GameState, deps: EngineDeps, player: string, bound: HandChoiceBound, pool?: readonly InstanceId[]): readonly InstanceId[] {
  return (pool ?? state.zones.hand[player] ?? []).filter((id) => freeCastAdmits(state, deps, id, bound));
}
