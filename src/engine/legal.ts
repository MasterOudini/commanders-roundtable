// `legalActions` — one primitive, three jobs.
//
// ⚠️ The SAME function drives (a) which cards the table highlights, (b) the "you
// have no plays" auto-pass, and (c) the "are you sure? you still have mana up"
// confirmation. Getting one function right instead of three is the whole reason
// it lives in its own module: three implementations of "can I cast this" drift,
// and the drift shows up as a card that lights up but cannot be cast.

import { faceOf } from './oracle';
import { derive, makeDeriveCache, type DeriveCache } from './derive';
import { buildPaymentProblem, manaSourcesOf } from './mana';
import { affordable, solveInputFor, type SolveInput } from './payment';
import { isMainPhase } from './turn';
import type { ScriptRegistry } from './scripts/registry';
import type { InstanceId, PlayerId, ZoneRef } from './types/ids';
import type { OracleCard, OracleDb } from './types/oracle';
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
      readonly outputs: number;
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
    }
  | { readonly t: 'PassPriority' };

/** Which faces of a card can be cast or played independently. */
function castableFaces(card: OracleCard): number[] {
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
      outputs: source.outputs.length,
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
    for (const ability of face.activated) {
      if (ability.isManaAbility || ability.isLoyalty || !ability.payable) continue;
      if (ability.requiresTap && inst.tapped) continue;
      if (ability.requiresUntap && !inst.tapped) continue;
      if (ability.requiresTap && !readyToTap(state, d, inst)) continue;
      if (ability.sorceryOnly && !sorcerySpeed) continue;
      const problem = buildPaymentProblem(ability.manaCost, 0, [], 0, ability.lifeCost);
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
 */
export function meaningfulActions(
  state: GameState,
  oracle: OracleDb,
  scripts: ScriptRegistry,
  player: PlayerId,
  ctx?: LegalContext,
): LegalAction[] {
  return legalActions(state, oracle, scripts, player, ctx).filter(
    (a) => a.t === 'PlayLand' || (a.t === 'CastSpell' && a.affordable),
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
  // ⚠️ Never auto-pass out of your own main phase with a land drop available.
  // Playing a land is the one action people genuinely forget, and skipping it
  // costs a whole turn of development that cannot be recovered.
  const ctx = legalContext(state, oracle, scripts, player);
  const meaningful = meaningfulActions(state, oracle, scripts, player, ctx);
  if (meaningful.some((a) => a.t === 'PlayLand')) return false;
  if (!stops.stopWhenIHaveInstantSpeedPlay) return true;
  return meaningful.length === 0;
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
