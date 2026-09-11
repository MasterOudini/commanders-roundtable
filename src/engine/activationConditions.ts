/**
 * D342 — THE ACTIVATION CONDITIONS.
 *
 * "Activate only during your upkeep." · "Activate only during your turn, before
 * attackers are declared." · "Activate only if you control a Swamp." · "Activate
 * only if this creature's power is 4 or greater." — CR 602.5b–d: an activated
 * ability with a printed condition may be activated only while the condition is
 * true, checked as the ability is activated and never again. The parser
 * (`activatedParse.parseActivationConditions`) reads the closed vocabulary of
 * `ActivationCondition` into `ActivatedAbility.activateOnly`; `legal.ts` offers
 * such an ability only while EVERY condition holds, and `handlers.ts` refuses it
 * by name otherwise — the same two sites that charge D328's "once each turn".
 *
 * ⚠️ A condition the vocabulary cannot read is never dropped: the parser records
 * it as an UNPAID cost, so the ability is not payable, not offered, not claimable
 * by a def, and the card stays incomplete (D90 — an unread restriction run as no
 * restriction is half-execution with a confident face). Before this decision the
 * parser read "once each turn" and "as a sorcery" and IGNORED every other tail,
 * harmless only because no shipped def sat on such a line.
 *
 * ⚠️ Every condition is answered from state the engine already holds: the turn
 * (active player, phase, step), the board through DERIVED characteristics (a
 * granted type counts, a silenced one does not), the hand and graveyard counts.
 * Nothing here reads the log or a memory the turn does not keep, which is why
 * "if a creature died this turn" stays unread until the turn remembers it.
 */
import { derive, makeDeriveCache, type DeriveCache } from './derive';
import { STEP_ORDER } from './turn';
import { conditionHolds } from './triggers';
import type { PermanentPredicate } from '../data/replacementParse';
import type { ScriptRegistry } from './scripts/registryCore';
import type { InstanceId, PlayerId } from './types/ids';
import type { ActivationCondition, DerivedCharacteristics, OracleDb } from './types/oracle';
import type { GameState, Step } from './types/state';

function stepAt(step: Step): number {
  return STEP_ORDER.findIndex((s) => s.step === step);
}

/** The predicate check `conditionHolds` makes for "you control a <predicate>", over one object. */
function matchesAny(chars: DerivedCharacteristics, any: readonly PermanentPredicate[]): boolean {
  return any.some(
    (p) =>
      p.supertypes.every((t) => chars.typeLine.supertypes.includes(t)) &&
      p.types.every((t) => chars.typeLine.types.includes(t)) &&
      p.subtypes.every((t) => chars.typeLine.subtypes.includes(t)) &&
      p.colors.every((c) => chars.colors.includes(c)),
  );
}

/**
 * Do ALL of `conditions` hold for `player` activating `source`'s ability now?
 *
 * Pure in the state: the same board and turn always answer the same way, which
 * is what lets `legal.ts` (the offer) and `handlers.ts` (the refusal) ask the one
 * question and never disagree.
 */
export function activationConditionsHold(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  source: InstanceId,
  conditions: readonly ActivationCondition[],
  cache?: DeriveCache,
): boolean {
  const c = cache ?? makeDeriveCache(state);
  const d = (id: InstanceId): DerivedCharacteristics => derive(state, oracle, scripts, id, c);
  const mine = (): readonly InstanceId[] => state.zones.battlefield.filter((id) => state.cards[id]?.controller === player);
  for (const cond of conditions) {
    switch (cond.kind) {
      case 'duringYourTurn':
        if (state.turn.activePlayer !== player) return false;
        break;
      case 'duringOpponentsTurn':
        if (state.turn.activePlayer === player) return false;
        break;
      case 'duringStep':
        if (state.turn.step !== cond.step) return false;
        if (cond.whose === 'yours' && state.turn.activePlayer !== player) return false;
        break;
      case 'duringCombat':
        if (state.turn.phase !== 'combat') return false;
        break;
      case 'beforeAttackersDeclared':
        // This turn's declare-attackers step has not begun: every step before it in
        // the turn's order. Once the turn is in or past that step, it is too late.
        if (stepAt(state.turn.step) >= stepAt('declareAttackers')) return false;
        break;
      case 'board':
        if (!conditionHolds(state, oracle, scripts, cond.condition, player)) return false;
        break;
      case 'controlCount':
        if (mine().filter((id) => matchesAny(d(id), cond.any)).length < cond.count) return false;
        break;
      case 'selfPowerAtLeast': {
        // A non-creature has no power (`null`), and no power is never "4 or greater".
        const power = d(source).power;
        if (power === null || power < cond.power) return false;
        break;
      }
      case 'handSize': {
        const n = (state.zones.hand[player] ?? []).length;
        if (cond.cmp === 'atMost' ? n > cond.count : cond.cmp === 'exactly' ? n !== cond.count : n < cond.count) return false;
        break;
      }
      case 'graveyardCards': {
        const n = (state.zones.graveyard[player] ?? []).filter((id) => {
          const types = d(id).typeLine.types;
          return cond.types.every((t) => types.includes(t));
        }).length;
        if (n < cond.count) return false;
        break;
      }
      case 'selfIsCreature':
        if (!d(source).isCreature) return false;
        break;
      case 'turnMemory': {
        // ⚠️ The record holds IDS (the reducer has no oracle): the types are asked HERE,
        // off each recorded card, which is why this case derives and the reducer does not.
        const memory = state.turn.memory;
        const whose = (id: PlayerId): boolean =>
          cond.who === 'any' ? true : cond.who === 'you' ? id === player : id !== player;
        const fits = (id: InstanceId): boolean => {
          // D398 - the source itself may be REQUIRED ("this land entered this turn") or
          // EXCLUDED ("another spell", "another creature died") before any predicate is asked.
          if (cond.self && id !== source) return false;
          if (cond.excludeSelf && id === source) return false;
          if (!cond.any && !cond.none) return true;
          const chars = d(id);
          if (cond.any && !cond.any.some((p) => matchesAny(chars, [p]))) return false;
          if (cond.none && cond.none.some((p) => matchesAny(chars, [p]))) return false;
          return true;
        };
        let seen = 0;
        if (cond.what === 'died' || cond.what === 'left') {
          seen = memory[cond.what].filter((e) => whose(e.controller) && fits(e.card)).length;
        } else if (cond.what === 'cast' || cond.what === 'entered' || cond.what === 'toGraveyard') {
          const per = memory[cond.what];
          for (const [id, cards] of Object.entries(per)) if (whose(id)) seen += cards.filter(fits).length;
        } else if (cond.what === 'lostLife' || cond.what === 'gainedLife') {
          const per = memory[cond.what];
          for (const [id, did] of Object.entries(per)) if (did && whose(id)) seen += 1;
        } else if (cond.what === 'attackers') {
          // D398 - only the active player declares attackers: "you attacked this turn"
          // asked by anyone else is no, however many creatures the active player sent.
          seen = cond.who === 'you' && state.turn.activePlayer !== player ? 0 : memory.attackers;
        } else if (cond.what === 'drawn') {
          for (const [id, n] of Object.entries(state.turn.cardsDrawn)) if (whose(id)) seen += n;
        } else {
          const per = memory[cond.what];
          for (const [id, n] of Object.entries(per)) if (whose(id)) seen += n;
        }
        if (seen < cond.count) return false;
        break;
      }
    }
  }
  return true;
}

/** The conditions in the card's own words, for a refusal the player reads. */
export function describeActivationConditions(conditions: readonly ActivationCondition[]): string {
  return conditions
    .map((cond) => {
      switch (cond.kind) {
        case 'turnMemory':
          return 'if this turn has seen it';
        case 'duringYourTurn':
          return 'during your turn';
        case 'duringOpponentsTurn':
          return "during an opponent's turn";
        case 'duringStep':
          return cond.whose === 'yours'
            ? `during your ${cond.step === 'upkeep' ? 'upkeep' : cond.step} step`
            : `during ${cond.step === 'upkeep' ? 'an upkeep' : 'the ' + cond.step} step`;
        case 'duringCombat':
          return 'during combat';
        case 'beforeAttackersDeclared':
          return 'before attackers are declared';
        case 'board':
          return 'if the printed board condition holds';
        case 'controlCount':
          return `if you control ${cond.count} or more of the named permanents`;
        case 'selfPowerAtLeast':
          return `if its power is ${cond.power} or greater`;
        case 'handSize':
          return cond.cmp === 'atMost'
            ? `if you have ${cond.count} or fewer cards in hand`
            : cond.cmp === 'exactly'
              ? `if you have exactly ${cond.count} cards in hand`
              : `if you have ${cond.count} or more cards in hand`;
        case 'graveyardCards':
          return `if there are ${cond.count} or more ${cond.types.length ? cond.types.join(' ').toLowerCase() + ' ' : ''}cards in your graveyard`;
        case 'selfIsCreature':
          return 'if it is a creature';
      }
    })
    .join(' and only ');
}
