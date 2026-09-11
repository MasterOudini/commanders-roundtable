// `legalActions` — one primitive, three jobs.
//
// ⚠️ The SAME function drives (a) which cards the table highlights, (b) the "you
// have no plays" auto-pass, and (c) the "are you sure? you still have mana up"
// confirmation. Getting one function right instead of three is the whole reason
// it lives in its own module: three implementations of "can I cast this" drift,
// and the drift shows up as a card that lights up but cannot be cast.

import { faceOf } from './oracle';
import { parseManaCost } from '../data/oracleParse';
import { castReduction } from './costs';
import { derive, makeDeriveCache, type DeriveCache } from './derive';
import { buildPaymentProblem, costStringOf, extraCostSpend, manaSourcesOf } from './mana';
import { affordable, solveInputFor, type SolveInput } from './payment';
import { OTHER_PURPOSE, abilityPurpose, faceColors, spellPurpose } from './spend';
import { isMainPhase } from './turn';
import { activationConditionsHold } from './activationConditions';
import { legalModes } from './modes';
import { candidatesFromState } from './targets';
import type { ScriptRegistry } from './scripts/registry';
import type { AbilityRef, InstanceId, PlayerId, ZoneRef } from './types/ids';
import type { ActivatedAbility, OracleCard, OracleDb } from './types/oracle';
import type { GameState } from './types/state';

export type LegalAction =
  | {
      readonly t: 'PlayLand';
      readonly card: InstanceId;
      readonly faceIndex: number;
      readonly label: string;
    }
  | {
      readonly t: 'CastSpell';
      readonly card: InstanceId;
      readonly faceIndex: number;
      readonly from: ZoneRef;
      readonly affordable: boolean;
      readonly isCommanderCast: boolean;
      readonly tax: number;
      readonly hasX: boolean;
      readonly label: string;
      /** D309 - the face-down (morph) cast: a 2/2 for {3}. */
      readonly faceDown?: true;
      /** D403 - the face has a kicker the cast may announce (`CastSpell.kicked`), or a multikicker. */
      readonly kicker?: 'once' | 'many';
    }
  | {
      readonly t: 'TapForMana';
      readonly card: InstanceId;
      readonly abilityIndex: number;
      /**
       * What each of this ability's outputs adds, as a Scryfall cost string —
       * `['{G}']` for a Forest, `['{W}','{U}','{B}','{R}','{G}']` for a Command
       * Tower in a five-colour deck, `['{C}{C}']` for Ancient Tomb. The INDEX is
       * the `outputChoice` a `TapForMana` intent names, so a UI can offer the
       * choices without a second idea of what this ability produces.
       *
       * ⚠️ It used to be a COUNT, which is the one thing a chooser cannot use:
       * "this land has 2 outputs" cannot be drawn. And a dual land is two
       * abilities of one output each rather than one ability of two, so the
       * count could not even be read as "how many colours" — only the strings,
       * gathered across every ability of the card, answer that.
       */
      readonly outputs: readonly string[];
      readonly conditional: boolean;
      readonly label: string;
    }
  /**
   * A non-mana activated ability of a permanent you control.
   *
   * ⚠️ Offered ONLY when the engine can charge the whole cost — mana and
   * `{T}`/`{Q}`. `Sacrifice this creature`, `Discard a card` and the rest are
   * decisions rather than prices, exactly the distinction D68 drew for ward, so
   * they stay Tier 3 and `tier3.ts` names them on the card. Mana abilities go
   * through `TapForMana` and never touch the stack (CR 605).
   */
  | {
      readonly t: 'ActivateAbility';
      readonly card: InstanceId;
      readonly abilityIndex: number;
      readonly affordable: boolean;
      readonly requiresTap: boolean;
      readonly costText: string;
      readonly effectText: string;
      readonly label: string;
      /**
       * Present when the cost sacrifices a CHOSEN permanent (D168): the
       * activator's legal choices, battlefield order. The intent must name
       * one in `sacrifice`.
       */
      readonly sacrificeCandidates?: readonly InstanceId[];
      /** A "Discard N" cost (D286): the hand cards that may pay it, and N. */
      readonly discardCandidates?: readonly InstanceId[];
      readonly discardCount?: number;
      /** A "Tap N untapped …" cost (D286): the permanents that may pay it, and N. */
      readonly tapCandidates?: readonly InstanceId[];
      readonly tapCount?: number;
      /** D311 - crew: the total POWER the chosen taps must reach (tapCount is 0 then). */
      readonly tapPower?: number;
      /** D329 - an "Exile N ... from your graveyard" cost: the graveyard cards that may pay it, and N. */
      readonly exileFromGraveyardCandidates?: readonly InstanceId[];
      readonly exileFromGraveyardCount?: number;
      /** D352 - a "Return N ... to its owner's hand" cost: the permanents that may pay it, and N. */
      readonly returnCandidates?: readonly InstanceId[];
      readonly returnCount?: number;
      /**
       * D363 - a "Remove N <kind> counters from a <predicate> you control" cost: the
       * permanents carrying that counter, how many must come off, and which kind.
       * ⚠️ The picks are a MULTISET - two counters may come off one permanent.
       */
      readonly removeCounterCandidates?: readonly InstanceId[];
      readonly removeCounterCount?: number;
      readonly removeCounterKind?: string;
      /** D353 - how many permanents a "Sacrifice N <predicate>" cost eats. */
      readonly sacrificeCount?: number;
      /**
       * D367 - present when this ability was GRANTED to the permanent by another
       * permanent's static (`<providerOracleId>#g<n>`). The intent must carry it
       * back (`ActivateAbility.grantRef`); a client reads the ability's aim
       * specs off the provider's def by this ref, since the recipient's own
       * face does not print it.
       */
      readonly grantRef?: AbilityRef;
    }
  | {
      /** D309 - turn a face-down permanent face up for its morph cost (a special action). */
      readonly t: 'TurnFaceUp';
      readonly card: InstanceId;
      readonly affordable: boolean;
      readonly costText: string;
      readonly label: string;
    }
  | { readonly t: 'PassPriority' };

/** D309 - the cost of casting any card face down (CR 702.37a). */
const MORPH_CAST_COST = parseManaCost('{3}');

/**
 * Which faces of a card can be cast or played independently.
 *
 * ⚠️ EXPORTED SO THE HANDLERS CAN VALIDATE AGAINST IT (D155). This list is what
 * `legalActions` OFFERS, and until D155 `castSpell` and `playLand` ignored the
 * offer and hardcoded face 0 — so a modal DFC's back face was listed, clickable
 * and unplayable. The host decides legality (D139), which means the handler has
 * to ask the same question the offer did, from the same function.
 */
export function castableFaces(card: OracleCard): number[] {
  if (card.layout === 'split' || card.layout === 'modal_dfc' || card.layout === 'adventure') {
    return card.faces.map((_, i) => i);
  }
  return [0];
}

export interface LegalContext {
  readonly solve: SolveInput;
  readonly cache: DeriveCache;
}

export function legalContext(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
): LegalContext {
  const cache = makeDeriveCache(state);
  return { solve: solveInputFor(state, oracle, scripts, player, cache), cache };
}

export function legalActions(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  ctx?: LegalContext,
): LegalAction[] {
  const out: LegalAction[] = [];
  if (state.gamePhase !== 'playing') return out;
  const p = state.players[player];
  if (!p || p.hasLost) return out;
  if (state.priority.player !== player) return out;

  const context = ctx ?? legalContext(state, oracle, scripts, player);
  const sorcerySpeed = canActAtSorcerySpeed(state, player);

  // Lands: a special action, not a spell — it uses no stack and cannot be
  // responded to, which is why it is not folded into CastSpell.
  const canLand = sorcerySpeed && p.landsPlayedThisTurn < p.maxLandsPerTurn;
  for (const id of state.zones.hand[player] ?? []) {
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    for (const faceIndex of castableFaces(card)) {
      const face = faceOf(card, faceIndex);
      // D309 - THE MORPH SEAM: a card with a morph cost the engine can charge is
      // also castable FACE DOWN as a 2/2 for {3} (CR 702.37a) - a creature
      // spell, so sorcery speed, no targets, whatever the card is (Zoetic
      // Cavern is a land). Offered before the land check for that reason.
      if (faceIndex === 0 && face.morphCost !== null && sorcerySpeed) {
        out.push({
          t: 'CastSpell',
          card: id,
          faceIndex,
          from: { kind: 'hand', player },
          affordable: affordable(context.solve, buildPaymentProblem(MORPH_CAST_COST, 0, [], 0), spellPurpose(face, true)),
          isCommanderCast: false,
          tax: 0,
          hasX: false,
          label: `${face.name} (face down)`,
          faceDown: true,
        });
      }
      if (face.isLand) {
        if (canLand) out.push({ t: 'PlayLand', card: id, faceIndex, label: face.name });
        continue;
      }
      const action = castAction(state, oracle, scripts, id, faceIndex, { kind: 'hand', player }, context, sorcerySpeed);
      if (action) out.push(action);
    }
  }

  // ⚠️ D307 - FLASHBACK: a card in your graveyard with a flashback cost is
  // castable from there for that cost (CR 702.34a), at its own speed.
  for (const id of state.zones.graveyard[player] ?? []) {
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    for (const faceIndex of castableFaces(card)) {
      if (faceOf(card, faceIndex).flashbackCost === null) continue;
      const action = castAction(state, oracle, scripts, id, faceIndex, { kind: 'graveyard', player }, context, sorcerySpeed);
      if (action) out.push(action);
    }
  }

  // The command zone. A commander is castable from here at sorcery speed (or
  // any time with flash), with the tax folded into the cost.
  for (const id of state.zones.command[player] ?? []) {
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    for (const faceIndex of castableFaces(card)) {
      const action = castAction(state, oracle, scripts, id, faceIndex, { kind: 'command', player }, context, sorcerySpeed);
      if (action) out.push(action);
    }
  }

  // Mana abilities. Available whenever you hold priority; conditional ones are
  // listed too, because the player may know something the engine cannot.
  for (const source of manaSourcesOf(state, oracle, scripts, player, {
    includeConditional: true,
    includeCostly: true,
    cache: context.cache,
  })) {
    // D325 - a source with a cost beside the {T} is offered only while that cost can be
    // paid now (the pool covers the mana, the life is there): the tap charges it, so an
    // unpayable one is not on the menu.
    const d = derive(state, oracle, scripts, source.card, context.cache);
    // D397 - the price beside the {T} is an ability of THIS source; restricted mana that fits pays it.
    if (source.extraCost && !extraCostSpend(state, player, source.extraCost, abilityPurpose(d.typeLine, d.colors))) continue;
    out.push({
      t: 'TapForMana',
      card: source.card,
      abilityIndex: source.abilityIndex,
      outputs: source.outputs.map((o) => costStringOf(o.mana)),
      conditional: source.conditional,
      label: d.name,
    });
  }

  // Activated abilities of permanents you control.
  //
  // ⚠️ Summoning sickness applies to any ability with `{T}` in its cost, not
  // only to attacking (CR 302.6). The expression comes from `combat.canAttack`
  // rather than being re-derived, for the reason `tier3.ts` states about second
  // heuristics: two copies of "is this creature ready" would eventually disagree.
  // ⚠️ D306 - CYCLING is activated from the HAND, at instant speed (CR
  // 702.29a): every card in hand with a synthesized cycling ability whose mana
  // the engine can charge is offered here, exactly like a battlefield ability.
  for (const id of state.zones.hand[player] ?? []) {
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    const inst = state.cards[id];
    if (!inst) continue;
    const face = faceOf(card, inst.faceIndex);
    for (const ability of face.activated) {
      if (ability.cycling === undefined || !ability.payable) continue;
      const problem = buildPaymentProblem(ability.manaCost, 0, [], 0, 0);
      out.push({
        t: 'ActivateAbility',
        card: id,
        abilityIndex: ability.index,
        affordable: affordable(context.solve, problem, abilityPurpose(face.typeLine, faceColors(face))),
        requiresTap: false,
        costText: ability.costText,
        effectText: ability.effectText,
        label: face.name,
      });
    }
  }
  // D329 - ABILITIES ACTIVATED FROM THE GRAVEYARD (CR 113.6): "Exile this card
  // from your graveyard: ..." - every card in the graveyard whose ability says
  // so, when a script will run the effect (D159: the card is the price). The
  // exile is charged in `finishAbility`; nothing else of the cost is looked at
  // here because none of these abilities taps, sacrifices or chooses.
  for (const id of state.zones.graveyard[player] ?? []) {
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    const inst = state.cards[id];
    if (!inst) continue;
    const face = faceOf(card, inst.faceIndex);
    for (const ability of face.activated) {
      if (!(ability.exileSelfFromGraveyard || ability.activatesFromGraveyard) || !ability.payable || ability.isManaAbility || ability.isLoyalty) continue;
      if (ability.requiresTap || ability.requiresUntap || ability.sacrificeCost || ability.discardCost || ability.tapCost) continue;
      // D352 - a return cost names permanents on the BATTLEFIELD; nothing activated from a
      // graveyard is charged one here.
      if (ability.returnCost || ability.returnsSelf) continue;
      if (!activatedDefRegistered(scripts, card.oracleId, ability.index)) continue;
      if (ability.sorceryOnly && !sorcerySpeed) continue;
      if (ability.oncePerTurn && (state.turn.activations[`${id}|${card.oracleId}#a${ability.index}`] ?? 0) >= 1) continue;
      // D342 - "Activate only <condition>": offered only while every read condition holds.
      if (ability.activateOnly.length > 0 && !activationConditionsHold(state, oracle, scripts, player, id, ability.activateOnly, context.cache)) continue;
      // D334 - the exile-from-graveyard chooser on a graveyard-activated ability (the card itself never a candidate).
      let gyChooser: readonly InstanceId[] | null = null;
      if (ability.exileFromGraveyardCost) {
        gyChooser = exileFromGraveyardCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.exileFromGraveyardCost,
        );
        if (gyChooser.length < ability.exileFromGraveyardCost.count) continue;
      }
      const problem = buildPaymentProblem(ability.manaCost, 0, [], 0, ability.lifeCost);
      out.push({
        t: 'ActivateAbility',
        card: id,
        abilityIndex: ability.index,
        affordable: affordable(context.solve, problem, abilityPurpose(face.typeLine, faceColors(face))),
        requiresTap: false,
        costText: ability.costText,
        effectText: ability.effectText,
        label: face.name,
        ...(gyChooser && ability.exileFromGraveyardCost
          ? { exileFromGraveyardCandidates: gyChooser, exileFromGraveyardCount: ability.exileFromGraveyardCost.count }
          : {}),
      });
    }
  }
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player || inst.phasedOut) continue;
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    const d = derive(state, oracle, scripts, id, context.cache);
    const face = faceOf(card, inst.faceIndex);
    // ⚠️ CR 613 layer 6 — the fifth and last reader of `hasAbilities`. The
    // activated list comes from the ORACLE, not from the derived object, so a
    // silenced permanent would otherwise still offer every ability it prints.
    if (!d.hasAbilities) continue;
    // D367 - THE GRANTED ABILITY. The permanent's own printed abilities and the
    // ones OTHER permanents' statics installed on it are offered by ONE loop, so
    // every cost rule below applies to both. A printed ability needs a def
    // registered before a destructive cost is offered (D159); a granted one
    // EXISTS only because a def installed it, so its gate is met by construction.
    const offerable: { ability: ActivatedAbility; grantRef: AbilityRef | null; defReady: boolean }[] = face.activated.map((ability) => ({
      ability,
      grantRef: null,
      defReady: activatedDefRegistered(scripts, card.oracleId, ability.index),
    }));
    for (const g of d.grantedActivated) offerable.push({ ability: g.ability, grantRef: g.ref, defReady: true });
    for (const { ability, grantRef, defReady } of offerable) {
      if (ability.isManaAbility || ability.isLoyalty || !ability.payable) continue;
      const ref: AbilityRef = grantRef ?? `${card.oracleId}#a${ability.index}`;
      // D329 - priced by exiling the card from the graveyard: offered from there, not here.
      if (ability.exileSelfFromGraveyard || ability.activatesFromGraveyard) continue;
      // D328 - CR 602.5b: activated this turn already, not offered again.
      if (ability.oncePerTurn && (state.turn.activations[`${id}|${ref}`] ?? 0) >= 1) continue;
      // D342 - "Activate only <condition>": offered only while every read condition holds.
      if (ability.activateOnly.length > 0 && !activationConditionsHold(state, oracle, scripts, player, id, ability.activateOnly, context.cache)) continue;
      // ⚠️ A DESTRUCTIVE COST IS OFFERED ONLY WHEN A SCRIPT WILL RUN THE EFFECT
      // (D159). Charging mana for nothing is D122's disclosed status quo;
      // eating the permanent for nothing is not. Asked of the GAME'S registry,
      // never the shipped list, so a test registry carrying the def is offered
      // it — and `tier3.ts` words the note for the undef'd case from this same
      // rule.
      if (ability.sacrificesSelf && !defReady) {
        continue;
      }
      // D353 - the SELF COUNTER, beside the self-sacrifice: a deterministic price, and the
      // same def gate. It is offered whenever the permanent is there - it is a PUT, not a
      // remove, so nothing can make it unpayable.
      if (ability.putCounterCost && !defReady) continue;
      // ⚠️ The CHOOSER cost (D168): same def gate as the self-sacrifice —
      // eating a permanent for nothing is not disclosed status quo — plus
      // "a cost you cannot pay is not offered": no candidate, no offer.
      let sacCandidates: readonly InstanceId[] | null = null;
      if (ability.sacrificeCost) {
        if (!defReady) continue;
        sacCandidates = sacrificeCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.sacrificeCost,
        );
        if (sacCandidates.length < ability.sacrificeCost.count) continue;
      }
      // ⚠️ The DISCARD and TAP choosers (D286): the same def gate, and "a cost
      // you cannot pay is not offered" — fewer candidates than the count, no
      // offer.
      let discardCandidates: readonly InstanceId[] | null = null;
      if (ability.discardCost) {
        if (!defReady) continue;
        discardCandidates = discardCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          ability.discardCost,
        );
        if (discardCandidates.length < ability.discardCost.count) continue;
      }
      // D329 - the exile-from-graveyard chooser: the same gate, over the graveyard.
      let exileGyCandidates: readonly InstanceId[] | null = null;
      if (ability.exileFromGraveyardCost) {
        if (!defReady) continue;
        exileGyCandidates = exileFromGraveyardCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.exileFromGraveyardCost,
        );
        if (exileGyCandidates.length < ability.exileFromGraveyardCost.count) continue;
      }
      let tapCandidates: readonly InstanceId[] | null = null;
      if (ability.tapCost) {
        // D311 - crew's effect is the engine's own: no def to wait for.
        if (ability.crew === undefined && !defReady) continue;
        tapCandidates = tapCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.tapCost,
        );
        if (tapCandidates.length < ability.tapCost.count) continue;
        // D311 - crew: the candidates must be able to reach the power together.
        if (ability.tapCost.powerAtLeast !== undefined) {
          const reach = tapCandidates.reduce((sum, cid) => sum + (derive(state, oracle, scripts, cid, context.cache).power ?? 0), 0);
          if (reach < ability.tapCost.powerAtLeast) continue;
        }
      }
      // D352 - THE RETURN chooser and the SELF return: the same def gate (moving your
      // own permanent off the battlefield for nothing is not disclosed status quo) and the
      // same "a cost you cannot pay is not offered" rule.
      let returnCandidates: readonly InstanceId[] | null = null;
      let removeCounterCandidates: readonly InstanceId[] | null = null;
      if (ability.returnsSelf && !defReady) continue;
      if (ability.returnCost) {
        if (!defReady) continue;
        returnCandidates = returnCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.returnCost,
        );
        if (returnCandidates.length < ability.returnCost.count) continue;
      }
      // ⚠️ The REMOVE-A-COUNTER cost (D319): the same def gate, and "a cost you
      // cannot pay is not offered" - fewer counters than the count, no offer.
      // D363 - and when the cost NAMES a predicate it is a chooser: the offer
      // carries the candidates, and "a cost you cannot pay is not offered" is
      // measured over the COUNTERS those candidates carry rather than over their
      // number, because two counters may come off one creature.
      if (ability.removeCounterCost) {
        if (!defReady) continue;
        removeCounterCandidates = removeCounterCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.removeCounterCost,
        );
        if (removeCounterSupply(state, removeCounterCandidates, ability.removeCounterCost.kind) < ability.removeCounterCost.count) continue;
      }
      if (ability.requiresTap && inst.tapped) continue;
      if (ability.requiresUntap && !inst.tapped) continue;
      if (ability.requiresTap && !readyToTap(state, d, inst)) continue;
      if (ability.sorceryOnly && !sorcerySpeed) continue;
      const problem = buildPaymentProblem(
        ability.manaCost,
        0,
        [],
        0,
        // War Room's computed cost — the RULE parsed, the NUMBER read off the
        // player at offer time (CR 601.2f's analog for abilities; D159).
        ability.lifeCost +
          (ability.lifeCostCommanderColors ? (state.players[player]?.identity.length ?? 0) : 0),
      );
      out.push({
        t: 'ActivateAbility',
        card: id,
        abilityIndex: ability.index,
        ...(grantRef ? { grantRef } : {}),
        // ⚠️ The CHEAP feasibility check, the same one castAction uses. Building
        // a full payment PLAN per ability took the 40-source solver benchmark
        // from under 1 ms to 1.3 ms, and legalActions runs on every priority
        // grant — the plan is only ever needed once, when the player commits.
        affordable: affordable(context.solve, problem, abilityPurpose(d.typeLine, d.colors)),
        requiresTap: ability.requiresTap,
        costText: ability.costText,
        effectText: ability.effectText,
        label: d.name,
        ...(sacCandidates && ability.sacrificeCost
          ? { sacrificeCandidates: sacCandidates, sacrificeCount: ability.sacrificeCost.count }
          : {}),
        ...(discardCandidates && ability.discardCost
          ? { discardCandidates, discardCount: ability.discardCost.count }
          : {}),
        ...(exileGyCandidates && ability.exileFromGraveyardCost
          ? { exileFromGraveyardCandidates: exileGyCandidates, exileFromGraveyardCount: ability.exileFromGraveyardCost.count }
          : {}),
        ...(tapCandidates && ability.tapCost
          ? { tapCandidates, tapCount: ability.tapCost.count, ...(ability.tapCost.powerAtLeast !== undefined ? { tapPower: ability.tapCost.powerAtLeast } : {}) }
          : {}),
        ...(returnCandidates && ability.returnCost
          ? { returnCandidates, returnCount: ability.returnCost.count }
          : {}),
        ...(removeCounterCandidates && ability.removeCounterCost?.from
          ? {
              removeCounterCandidates,
              removeCounterCount: ability.removeCounterCost.count,
              removeCounterKind: ability.removeCounterCost.kind,
            }
          : {}),
      });
    }
  }

  // D309 - THE MORPH SEAM: a face-down permanent you control whose card prints
  // a morph cost the engine can charge may be turned face up any time you have
  // priority (CR 702.37c) - a special action, no stack.
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || !inst.faceDown || inst.controller !== player || inst.phasedOut) continue;
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    const face = faceOf(card, inst.faceIndex);
    if (face.morphCost === null) continue;
    out.push({
      t: 'TurnFaceUp',
      card: id,
      // D397 - a special action, neither a spell nor an ability: restricted mana never pays it.
      affordable: affordable(context.solve, buildPaymentProblem(face.morphCost, 0, [], 0), OTHER_PURPOSE),
      costText: face.morphCostText ?? '',
      label: `Turn ${face.name} face up`,
    });
  }
  out.push({ t: 'PassPriority' });
  return out;
}

/**
 * CR 302.6 — a creature's `{T}` ability needs it to have been under your control
 * since your most recent turn began.
 *
 * ⚠️ The same expression `combat.canAttack` uses, deliberately copied rather than
 * re-derived from "summoning sick": `summonedOnTurn >= turnNumber` says it
 * exactly, because the turn number only advances on an untap step. Two spellings
 * of this rule would eventually disagree about a hasty creature.
 */
/**
 * Does the game's registry carry an `ActivatedDef` for this exact ability?
 * The join is the `ref` — `${oracleId}#a${index}`, the same string
 * `handlers.activateAbility` writes onto the stack object — so the gate above
 * and the resolution in `loop.ts` cannot disagree about which ability a def
 * runs (D159).
 */
export function activatedDefRegistered(
  scripts: ScriptRegistry,
  oracleId: string,
  index: number,
): boolean {
  const ref = `${oracleId}#a${index}`;
  return scripts.get(oracleId)?.activated?.some((d) => d.ref === ref) ?? false;
}

/**
 * Which of the activator's permanents can pay a "Sacrifice a <predicate>"
 * cost (D168). DERIVED characteristics, never the printed line — an animated
 * land really can feed "Sacrifice a creature" — with the predicate match in
 * `conditionHolds`'s exact shape so the two graders cannot drift. `another`
 * excludes the ability's own source. Battlefield order, so the candidate
 * list is stable and replayable.
 *
 * ⚠️ Exported because `handlers.activateAbility` re-checks the CHOSEN
 * permanent with the same function — a client's word is not a rule (D139).
 */
export function sacrificeCandidatesFor(
  state: GameState,
  deriveOf: (id: InstanceId) => { readonly typeLine: { readonly supertypes: readonly string[]; readonly types: readonly string[]; readonly subtypes: readonly string[] }; readonly colors: readonly string[] },
  player: PlayerId,
  selfId: InstanceId,
  cost: NonNullable<ActivatedAbility['sacrificeCost']>,
): readonly InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    if (state.cards[id]?.controller !== player) continue;
    if (cost.another && id === selfId) continue;
    const chars = deriveOf(id);
    const hit = cost.any.some(
      (p) =>
        p.supertypes.every((t) => chars.typeLine.supertypes.includes(t)) &&
        p.types.every((t) => chars.typeLine.types.includes(t)) &&
        p.subtypes.every((t) => chars.typeLine.subtypes.includes(t)) &&
        p.colors.every((c) => chars.colors.includes(c)) &&
        // D328 - "Sacrifice a token": the instance, not its characteristics.
        (p.token !== true || state.cards[id]?.isToken === true),
    );
    if (hit) out.push(id);
  }
  return out;
}

type PredicateChars = {
  readonly typeLine: { readonly supertypes: readonly string[]; readonly types: readonly string[]; readonly subtypes: readonly string[] };
  readonly colors: readonly string[];
};

function predicateHit(
  any: readonly NonNullable<ActivatedAbility['sacrificeCost']>['any'][number][],
  chars: PredicateChars,
): boolean {
  return any.some(
    (p) =>
      p.supertypes.every((t) => chars.typeLine.supertypes.includes(t)) &&
      p.types.every((t) => chars.typeLine.types.includes(t)) &&
      p.subtypes.every((t) => chars.typeLine.subtypes.includes(t)) &&
      p.colors.every((c) => chars.colors.includes(c)) &&
      // D328 - a token predicate is priced by the sacrifice chooser alone.
      p.token !== true,
  );
}

/**
 * The hand cards that may pay a "Discard N …" cost (D286): every card for
 * "a card", the predicate's matches for a typed card. Offered and
 * re-validated from this one list.
 */
export function discardCandidatesFor(
  state: GameState,
  deriveOf: (id: InstanceId) => PredicateChars,
  player: PlayerId,
  cost: NonNullable<ActivatedAbility['discardCost']>,
): readonly InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of state.zones.hand[player] ?? []) {
    if (cost.any === null || predicateHit(cost.any, deriveOf(id))) out.push(id);
  }
  return out;
}

/**
 * D329 - the graveyard cards that may pay an "Exile N <predicate> cards from
 * your graveyard" cost: every card for "card(s)", the predicate's matches for
 * a typed card. Offered and re-validated by the same function (D139).
 */
export function exileFromGraveyardCandidatesFor(
  state: GameState,
  deriveOf: (id: InstanceId) => PredicateChars,
  player: PlayerId,
  selfId: InstanceId,
  cost: NonNullable<ActivatedAbility['exileFromGraveyardCost']>,
): readonly InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of state.zones.graveyard[player] ?? []) {
    // D334 - "another": the activating card is never its own price.
    if (cost.another && id === selfId) continue;
    if (cost.any === null || predicateHit(cost.any, deriveOf(id))) out.push(id);
  }
  return out;
}

/**
 * The permanents that may pay a "Tap N untapped <predicate> you control"
 * cost (D286): controlled, untapped, matching; `another` drops the source.
 * ⚠️ No summoning-sickness check — CR 302.6 restricts only a creature's OWN
 * {T}, and this cost taps OTHER permanents (Springleaf Drum's rule).
 */
export function tapCandidatesFor(
  state: GameState,
  deriveOf: (id: InstanceId) => PredicateChars,
  player: PlayerId,
  selfId: InstanceId,
  cost: NonNullable<ActivatedAbility['tapCost']>,
): readonly InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player || inst.tapped) continue;
    if (cost.another && id === selfId) continue;
    if (predicateHit(cost.any, deriveOf(id))) out.push(id);
  }
  return out;
}

/**
 * D352 - the permanents that may pay a "Return N <predicate> you control to its
 * owner's hand" cost: controlled and matching; `another` drops the source.
 * ⚠️ No tapped/untapped test and no summoning-sickness test — the wording asks
 * for neither, and Quirion Ranger untapping the Forest it just returned is the
 * whole point of the card.
 */
export function returnCandidatesFor(
  state: GameState,
  deriveOf: (id: InstanceId) => PredicateChars,
  player: PlayerId,
  selfId: InstanceId,
  cost: NonNullable<ActivatedAbility['returnCost']>,
): readonly InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player) continue;
    if (cost.another && id === selfId) continue;
    if (predicateHit(cost.any, deriveOf(id))) out.push(id);
  }
  return out;
}

/**
 * D363 - the permanents a "Remove N <kind> counters from a <predicate> you
 * control" cost may take its counters from: yours, matching the predicate, and
 * CARRYING at least one counter of that kind. The offer and the host both ask
 * this one function, so a client's word is never the rule (D168's shape).
 *
 * ⚠️ The COUNTERS, not the permanents, are what the count is over: a board with
 * one creature carrying two counters can pay a count of two, which is why the
 * caller compares the count against the TOTAL rather than the list length.
 */
export function removeCounterCandidatesFor(
  state: GameState,
  deriveOf: (id: InstanceId) => PredicateChars,
  player: PlayerId,
  selfId: InstanceId,
  cost: NonNullable<ActivatedAbility['removeCounterCost']>,
): readonly InstanceId[] {
  if (cost.from === null) {
    const self = state.cards[selfId];
    return self && (self.counters[cost.kind] ?? 0) >= cost.count ? [selfId] : [];
  }
  const out: InstanceId[] = [];
  for (const id of state.zones.battlefield) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player) continue;
    if ((inst.counters[cost.kind] ?? 0) <= 0) continue;
    if (predicateHit(cost.from, deriveOf(id))) out.push(id);
  }
  return out;
}

/** D363 - how many counters of that kind the candidates carry between them. */
export function removeCounterSupply(state: GameState, candidates: readonly InstanceId[], kind: string): number {
  let n = 0;
  for (const id of candidates) n += state.cards[id]?.counters[kind] ?? 0;
  return n;
}

function readyToTap(
  state: GameState,
  chars: ReturnType<typeof derive>,
  inst: NonNullable<GameState['cards'][InstanceId]>,
): boolean {
  if (!chars.isCreature) return true;
  if (chars.keywords.has('haste')) return true;
  return !(inst.summonedOnTurn !== null && inst.summonedOnTurn >= state.turn.turnNumber);
}

function cardFor(state: GameState, oracle: OracleDb, id: InstanceId): OracleCard | null {
  const inst = state.cards[id];
  if (!inst) return null;
  return oracle.byPrinting(inst.printingId) ?? null;
}

function castAction(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  id: InstanceId,
  faceIndex: number,
  from: ZoneRef,
  ctx: LegalContext,
  sorcerySpeed: boolean,
): LegalAction | null {
  const inst = state.cards[id];
  const card = cardFor(state, oracle, id);
  if (!inst || !card) return null;
  const face = faceOf(card, faceIndex);
  if (face.isLand) return null;
  if (face.manaCost === null) return null;
  if (from.kind === 'command' && !inst.isCommander) return null;
  if (!face.instantSpeed && !sorcerySpeed) return null;
  // D343 - a MODAL spell is offered only while enough of its modes can be
  // chosen against this board (CR 601.2c): a cast whose only legal answer is
  // its own cancel is not a play, and offering it is D102's livelock. The
  // host refuses such a cast by the same helper.
  if (face.modal) {
    const caster = from.player ?? inst.controller;
    const offered = legalModes(
      face.modal.modes,
      { controller: caster, colors: face.colors, power: null, toughness: null },
      candidatesFromState(state, { oracle, scripts }, ctx.cache),
    );
    if (offered.length < face.modal.min) return null;
  }

  // D312 - the generic reductions the board grants this cast are folded into
  // the same adjustment the commander tax rides on: the offer's `tax` is what
  // the client's preview prices, so the two agree by construction (D53).
  const tax =
    (from.kind === 'command' && inst.isCommander ? 2 * inst.commanderCastCount : 0) -
    castReduction(state, oracle, scripts, from.player ?? inst.controller, face, ctx.cache);
  const hasX = face.manaCost.xCount > 0;
  // D307 - from the graveyard the cost is the FLASHBACK cost (CR 702.34a).
  const cost = from.kind === 'graveyard' ? face.flashbackCost : face.manaCost;
  if (cost === null) return null;
  // X is priced at 0 for the affordability flag: a card with X is castable for
  // X=0, and greying it out because X=5 is unaffordable would be a lie.
  const problem = buildPaymentProblem(cost, 0, [], tax);
  return {
    t: 'CastSpell',
    card: id,
    faceIndex,
    from,
    affordable: affordable(ctx.solve, problem, spellPurpose(face, false)),
    isCommanderCast: from.kind === 'command' && inst.isCommander,
    tax,
    hasX,
    label: face.name,
    // D403 - a kick is offered, not priced: the preview prices the count the player announces.
    ...(face.multikickerCost !== null ? { kicker: 'many' as const } : face.kickerCost !== null ? { kicker: 'once' as const } : {}),
  };
}

/** CR 307.1 — your turn, a main phase, an empty stack, and you hold priority. */
export function canActAtSorcerySpeed(state: GameState, player: PlayerId): boolean {
  return (
    state.turn.activePlayer === player &&
    isMainPhase(state.turn.step) &&
    state.stack.length === 0 &&
    state.priority.player === player &&
    state.priority.awaiting === null
  );
}

/**
 * The actions that mean a player has something worth stopping for.
 *
 * ⚠️ `TapForMana` is deliberately EXCLUDED. Including it would mean a player
 * with one untapped land never auto-passes — which would destroy the entire
 * feature, because there is essentially always a land untapped somewhere.
 *
 * ⚠️ An affordable `ActivateAbility` IS included, and has to be now that
 * `shouldAutoPass` asks this question FIRST: this list is the whole answer to
 * "could this player do anything at all", so anything missing from it is a play
 * the game will never stop to offer. A firebreathing blocker's pump is exactly
 * the case `stopBeforeCombatDamage` exists for, and while abilities were absent
 * here that stop could not have fired for a player whose hand was empty.
 * Unaffordable ones stay out for the same reason an unaffordable spell does.
 */
export function meaningfulActions(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  ctx?: LegalContext,
): LegalAction[] {
  return legalActions(state, oracle, scripts, player, ctx).filter(
    (a) =>
      a.t === 'PlayLand' ||
      (a.t === 'CastSpell' && a.affordable) ||
      (a.t === 'ActivateAbility' && a.affordable),
  );
}

/**
 * Should the engine pass for this player without asking?
 *
 * This is the single thing that makes the app feel like Arena rather than like
 * a rules simulator. Every clause below is a reason a human would want to be
 * asked; if none of them holds, being asked is just a click.
 */
export function shouldAutoPass(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
): boolean {
  const p = state.players[player];
  if (!p) return true;
  if (p.hasLost) return true;
  const stops = p.stops;
  if (stops.mode !== 'auto' || stops.fullControlThisTurn) return false;

  // ⚠️ "COULD THIS PLAYER DO ANYTHING?" IS THE FIRST QUESTION, NOT THE LAST.
  // Every clause below is a refinement of it, never an override: a player
  // holding no instant, no flash card and no ability they can pay for cannot
  // use priority for anything except passing it, so asking them is a click with
  // no decision inside it.
  //
  // ⚠️ It used to be the LAST clause, and that is a different policy — it meant
  // `alwaysStop`, `stopWhenAnyoneCasts` and `stopBeforeCombatDamage` each
  // stopped a player with an empty hand and no untapped land. On the default
  // stops that is two forced clicks per opponent's turn per player, plus one
  // every time anybody casts anything, all of them offering nothing to do.
  // `mode: 'fullControl'` is the one thing that still stops everywhere, which
  // is exactly what its label promises.
  const ctx = legalContext(state, oracle, scripts, player);
  const meaningful = meaningfulActions(state, oracle, scripts, player, ctx);
  if (meaningful.length === 0) return true;

  // ⚠️ Never auto-pass out of your own main phase with a land drop available.
  // Playing a land is the one action people genuinely forget, and skipping it
  // costs a whole turn of development that cannot be recovered.
  if (meaningful.some((a) => a.t === 'PlayLand')) return false;

  if (stops.alwaysStop[state.turn.step] === true) return false;
  if (stops.stopOnMyUpkeep && state.turn.step === 'upkeep' && state.turn.activePlayer === player) {
    return false;
  }
  // Something has gone on the stack that this player has not yet declined to
  // respond to. `stackAdds` is monotone, so this stays true across "a spell
  // resolved and another was cast" — which a stack SIZE cannot express.
  if (stops.stopWhenAnyoneCasts && state.priority.stackAdds > (state.priority.seenStackAdds[player] ?? 0)) {
    return false;
  }
  if (
    stops.stopBeforeCombatDamage &&
    state.turn.step === 'declareBlockers' &&
    hasCreatureInCombat(state, player)
  ) {
    return false;
  }
  if (!stops.stopWhenIHaveInstantSpeedPlay) return true;
  return !isStopWindow(state, player);
}

/**
 * Holding a playable card is a reason to be asked SOMEWHERE, not everywhere.
 *
 * ⚠️ Without this, `stopWhenIHaveInstantSpeedPlay` reads as "stop at every step
 * of every turn", because "I hold a castable instant" stays true for a whole
 * turn cycle. Measured in a real game: one Mountain and one {R} instant stopped
 * that player in main 1, begin combat, end of combat, main 2 and the end step of
 * the opponent's turn — five prompts inside one turn they were not taking. In a
 * hotseat it is worse than clicks, because the table follows whoever holds
 * priority (D42), so the board changes seats five times mid-turn.
 *
 * The windows are the ones a player would name if asked when they want to be
 * interrupted: **your own main phases**, because that is where a turn is spent,
 * and **somebody else's end step**, because "at the end of your turn" is where
 * held-up mana goes. Everything else that genuinely matters is already its own
 * clause above — attackers and blockers (`alwaysStop`), a spell going on the
 * stack (`stopWhenAnyoneCasts`), damage about to be dealt
 * (`stopBeforeCombatDamage`) — and any individual step can still be pinned in
 * the stops panel.
 */
function isStopWindow(state: GameState, player: PlayerId): boolean {
  if (state.turn.activePlayer === player) return isMainPhase(state.turn.step);
  return state.turn.step === 'end';
}

function hasCreatureInCombat(state: GameState, player: PlayerId): boolean {
  if (!state.combat) return false;
  for (const a of state.combat.attackers) {
    if (state.cards[a.card]?.controller === player) return true;
    if (a.defender.kind === 'player' && a.defender.id === player) return true;
  }
  for (const b of state.combat.blockers) {
    if (state.cards[b.card]?.controller === player) return true;
  }
  return false;
}
