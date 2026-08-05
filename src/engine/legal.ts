// `legalActions` — one primitive, three jobs.
//
// ⚠️ The SAME function drives (a) which cards the table highlights, (b) the "you
// have no plays" auto-pass, and (c) the "are you sure? you still have mana up"
// confirmation. Getting one function right instead of three is the whole reason
// it lives in its own module: three implementations of "can I cast this" drift,
// and the drift shows up as a card that lights up but cannot be cast.

import { faceOf } from './oracle';
import { derive, makeDeriveCache, type DeriveCache } from './derive';
import { buildPaymentProblem, costStringOf, manaSourcesOf } from './mana';
import { affordable, solveInputFor, type SolveInput } from './payment';
import { isMainPhase } from './turn';
import type { ScriptRegistry } from './scripts/registry';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
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
    }
  | { readonly t: 'PassPriority' };

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
      if (face.isLand) {
        if (canLand) out.push({ t: 'PlayLand', card: id, faceIndex, label: face.name });
        continue;
      }
      const action = castAction(state, oracle, id, faceIndex, { kind: 'hand', player }, context, sorcerySpeed);
      if (action) out.push(action);
    }
  }

  // The command zone. A commander is castable from here at sorcery speed (or
  // any time with flash), with the tax folded into the cost.
  for (const id of state.zones.command[player] ?? []) {
    const card = cardFor(state, oracle, id);
    if (!card) continue;
    for (const faceIndex of castableFaces(card)) {
      const action = castAction(state, oracle, id, faceIndex, { kind: 'command', player }, context, sorcerySpeed);
      if (action) out.push(action);
    }
  }

  // Mana abilities. Available whenever you hold priority; conditional ones are
  // listed too, because the player may know something the engine cannot.
  for (const source of manaSourcesOf(state, oracle, scripts, player, {
    includeConditional: true,
    cache: context.cache,
  })) {
    const d = derive(state, oracle, scripts, source.card, context.cache);
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
    for (const ability of face.activated) {
      if (ability.isManaAbility || ability.isLoyalty || !ability.payable) continue;
      // ⚠️ A DESTRUCTIVE COST IS OFFERED ONLY WHEN A SCRIPT WILL RUN THE EFFECT
      // (D159). Charging mana for nothing is D122's disclosed status quo;
      // eating the permanent for nothing is not. Asked of the GAME'S registry,
      // never the shipped list, so a test registry carrying the def is offered
      // it — and `tier3.ts` words the note for the undef'd case from this same
      // rule.
      if (ability.sacrificesSelf && !activatedDefRegistered(scripts, card.oracleId, ability.index)) {
        continue;
      }
      // ⚠️ The CHOOSER cost (D168): same def gate as the self-sacrifice —
      // eating a permanent for nothing is not disclosed status quo — plus
      // "a cost you cannot pay is not offered": no candidate, no offer.
      let sacCandidates: readonly InstanceId[] | null = null;
      if (ability.sacrificeCost) {
        if (!activatedDefRegistered(scripts, card.oracleId, ability.index)) continue;
        sacCandidates = sacrificeCandidatesFor(
          state,
          (cid) => derive(state, oracle, scripts, cid, context.cache),
          player,
          id,
          ability.sacrificeCost,
        );
        if (sacCandidates.length === 0) continue;
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
        // ⚠️ The CHEAP feasibility check, the same one castAction uses. Building
        // a full payment PLAN per ability took the 40-source solver benchmark
        // from under 1 ms to 1.3 ms, and legalActions runs on every priority
        // grant — the plan is only ever needed once, when the player commits.
        affordable: affordable(context.solve, problem),
        requiresTap: ability.requiresTap,
        costText: ability.costText,
        effectText: ability.effectText,
        label: d.name,
        ...(sacCandidates ? { sacrificeCandidates: sacCandidates } : {}),
      });
    }
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
        p.colors.every((c) => chars.colors.includes(c)),
    );
    if (hit) out.push(id);
  }
  return out;
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

  const tax = from.kind === 'command' && inst.isCommander ? 2 * inst.commanderCastCount : 0;
  const hasX = face.manaCost.xCount > 0;
  // X is priced at 0 for the affordability flag: a card with X is castable for
  // X=0, and greying it out because X=5 is unaffordable would be a lie.
  const problem = buildPaymentProblem(face.manaCost, 0, [], tax);
  return {
    t: 'CastSpell',
    card: id,
    faceIndex,
    from,
    affordable: affordable(ctx.solve, problem),
    isCommanderCast: from.kind === 'command' && inst.isCommander,
    tax,
    hasX,
    label: face.name,
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
