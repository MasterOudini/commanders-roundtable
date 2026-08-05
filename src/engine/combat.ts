// Combat legality and damage assignment. Pure functions over state — the
// handlers turn their answers into events.

import { derive, makeScriptCtx, type DeriveCache } from './derive';
import type { ScriptRegistry } from './scripts/registry';
import type { CombatDef, ScriptCtx } from './scripts/api';
import type { ResolvedDamage } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { DerivedCharacteristics, OracleDb } from './types/oracle';
import type { AttackerDecl, DefenderRef, GameState } from './types/state';

export interface CombatDeps {
  readonly state: GameState;
  readonly oracle: OracleDb;
  readonly scripts: ScriptRegistry;
  readonly cache?: DeriveCache;
}

function d(deps: CombatDeps, id: InstanceId): DerivedCharacteristics {
  return derive(deps.state, deps.oracle, deps.scripts, id, deps.cache);
}

// ── declaring attackers (CR 508) ─────────────────────────────────────────────

export function canAttack(deps: CombatDeps, id: InstanceId): boolean {
  const { state } = deps;
  const card = state.cards[id];
  if (!card) return false;
  if (card.zone.kind !== 'battlefield') return false;
  if (card.controller !== state.turn.activePlayer) return false;
  if (card.phasedOut) return false;
  if (card.tapped) return false;
  const chars = d(deps, id);
  if (!chars.isCreature) return false;
  if (chars.keywords.has('defender')) return false;
  // Summoning sickness. CR 302.6 — the check is "has been controlled since the
  // start of your most recent turn", which `summonedOnTurn < turnNumber`
  // expresses exactly, because the turn number only advances on an untap step.
  if (!chars.keywords.has('haste') && card.summonedOnTurn !== null && card.summonedOnTurn >= state.turn.turnNumber) {
    return false;
  }
  // ⚠️ **CR 508.1c — CONTINUOUS RESTRICTIONS, and this is a SEAM THAT DID NOT
  // EXIST** until D147. D129 filed 227 cards under the layer-6 bucket because
  // their text looks like a static ability, and then found that `canAttack` and
  // `canBlock` consulted no static at all — so the engine could not express
  // "this creature can't attack" however the script was written.
  //
  // ⚠️ It is asked LAST, after the built-in rules, so a script can only ever
  // narrow what is legal. A def that returned `true` cannot make a tapped or
  // summoning-sick creature attack, which is the direction that would be a
  // rules bug rather than a card.
  return !restrictedBy(deps, (def, ctx, self) => def.canAttack?.(ctx, self, id) === false);
}

/**
 * Does any live `CombatDef` say no?
 *
 * ⚠️ The context is built ON FIRST CANDIDATE, so a board with no combat scripts
 * — every board the shipped app has, since `SHIPPED_REGISTRY` ships — allocates
 * nothing and the whole check is one array-length test.
 */
function restrictedBy(
  deps: CombatDeps,
  ask: (def: CombatDef, ctx: ScriptCtx, self: InstanceId) => boolean,
): boolean {
  const defs = deps.scripts.combat();
  if (defs.length === 0) return false;
  const { state } = deps;
  let ctx: ScriptCtx | null = null;
  for (const sourceId of state.zones.battlefield) {
    const source = state.cards[sourceId];
    if (!source) continue;
    for (const { script, def } of defs) {
      if (source.oracleId !== script.oracleId) continue;
      if (!def.activeZones.includes(source.zone.kind)) continue;
      // CR 613 layer 6 — a silenced permanent restricts nothing.
      if (!d(deps, sourceId).hasAbilities) continue;
      ctx ??= makeScriptCtx(state, deps.oracle, deps.scripts);
      if (ask(def, ctx, sourceId)) return true;
    }
  }
  return false;
}

/** Opponents still in the game, plus the planeswalkers and battles they control. */
export function legalDefenders(deps: CombatDeps, attackingPlayer: PlayerId): DefenderRef[] {
  const { state } = deps;
  const out: DefenderRef[] = [];
  for (const id of state.seating) {
    if (id === attackingPlayer) continue;
    if (state.players[id]?.hasLost) continue;
    out.push({ kind: 'player', id });
  }
  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card || card.controller === attackingPlayer) continue;
    if (state.players[card.controller]?.hasLost) continue;
    const chars = d(deps, id);
    if (chars.typeLine.types.includes('Planeswalker') || chars.typeLine.types.includes('Battle')) {
      out.push({ kind: 'permanent', id });
    }
  }
  return out;
}

// ── declaring blockers (CR 509) ──────────────────────────────────────────────

export type BlockRejection =
  | 'notACreature'
  | 'tapped'
  | 'notYours'
  | 'notAttacking'
  | 'flying'
  | 'protection'
  | 'fear'
  | 'intimidate'
  | 'shadow'
  | 'skulk'
  | 'horsemanship'
  | 'landwalk'
  // ⚠️ A continuous restriction from a card script (CR 509.1b) — deliberately
  // not the name of a keyword, because it is not one. Every other member here
  // names the printed evasion that stopped the block.
  | 'restricted';

/**
 * Per-pair blocking legality. The whole Tier-2 evasion surface, in one place.
 *
 * ⚠️ This is exactly the surface that regresses silently — nothing on screen
 * looks wrong when a flier gets blocked by a ground creature, and the player who
 * loses the game to it will not know why. The 16-case matrix in `combat.test.ts`
 * exists for this function.
 */
export function canBlock(
  deps: CombatDeps,
  blocker: InstanceId,
  attacker: InstanceId,
): BlockRejection | null {
  const { state } = deps;
  const b = state.cards[blocker];
  const a = state.cards[attacker];
  if (!b || !a) return 'notACreature';
  if (b.zone.kind !== 'battlefield' || b.phasedOut) return 'notACreature';
  if (b.tapped) return 'tapped';
  const bc = d(deps, blocker);
  const ac = d(deps, attacker);
  if (!bc.isCreature) return 'notACreature';

  const decl = state.combat?.attackers.find((x) => x.card === attacker);
  if (!decl) return 'notAttacking';
  const defendingPlayer =
    decl.defender.kind === 'player' ? decl.defender.id : state.cards[decl.defender.id]?.controller;
  if (!defendingPlayer || b.controller !== defendingPlayer) return 'notYours';

  if (ac.keywords.has('flying') && !bc.keywords.has('flying') && !bc.keywords.has('reach')) {
    return 'flying';
  }
  // CR 702.16e: protection from a colour means "can't be blocked by" creatures
  // of that colour — a different clause from the damage prevention below.
  if (ac.protection.fromEverything) return 'protection';
  if (ac.protection.colors.some((c) => bc.colors.includes(c))) return 'protection';
  if (ac.keywords.has('fear') && !bc.typeLine.types.includes('Artifact') && !bc.colors.includes('B')) {
    return 'fear';
  }
  if (
    ac.keywords.has('intimidate') &&
    !bc.typeLine.types.includes('Artifact') &&
    !ac.colors.some((c) => bc.colors.includes(c))
  ) {
    return 'intimidate';
  }
  // Shadow cuts BOTH ways: a shadow creature can only be blocked by shadow, and
  // a shadow creature can only block shadow.
  if (ac.keywords.has('shadow') !== bc.keywords.has('shadow')) return 'shadow';
  if (ac.keywords.has('skulk') && (bc.power ?? 0) > (ac.power ?? 0)) return 'skulk';
  if (ac.keywords.has('horsemanship') && !bc.keywords.has('horsemanship')) return 'horsemanship';
  if (ac.landwalk.length > 0 && defenderControlsLandType(deps, defendingPlayer, ac.landwalk)) {
    return 'landwalk';
  }
  // ⚠️ CR 509.1b — the same seam as `canAttack`, and LAST for the same reason: a
  // script may only ever narrow. It reports `restricted`, a rejection of its
  // own, because every other value above names the printed keyword that stopped
  // the block and this one is not a keyword.
  if (restrictedBy(deps, (def, ctx, self) => def.canBlock?.(ctx, self, blocker, attacker) === false)) {
    return 'restricted';
  }
  return null;
}

function defenderControlsLandType(
  deps: CombatDeps,
  player: PlayerId,
  types: readonly string[],
): boolean {
  for (const id of deps.state.zones.battlefield) {
    const card = deps.state.cards[id];
    if (!card || card.controller !== player) continue;
    const chars = d(deps, id);
    if (!chars.isLand) continue;
    for (const t of types) {
      if (t === 'Legendary' ? chars.isLegendary : chars.typeLine.subtypes.includes(t)) return true;
    }
  }
  return false;
}

/**
 * Whole-declaration legality. `menace` lives here rather than in `canBlock`
 * because "blocked by 0 or ≥2 creatures" is a property of the complete
 * declaration — which is why blocker declaration has to be one atomic intent.
 */
export function validateBlockDeclaration(
  deps: CombatDeps,
  blocks: readonly { blocker: InstanceId; attacker: InstanceId }[],
): { ok: true } | { ok: false; reason: 'illegalBlock' | 'menaceRequiresTwo'; detail: string } {
  const seen = new Set<string>();
  const perAttacker = new Map<InstanceId, InstanceId[]>();
  for (const b of blocks) {
    const key = `${b.blocker}>${b.attacker}`;
    if (seen.has(key)) return { ok: false, reason: 'illegalBlock', detail: 'the same block was declared twice' };
    seen.add(key);
    const why = canBlock(deps, b.blocker, b.attacker);
    if (why) {
      return { ok: false, reason: 'illegalBlock', detail: blockRejectionText(deps, b, why) };
    }
    perAttacker.set(b.attacker, [...(perAttacker.get(b.attacker) ?? []), b.blocker]);
  }
  for (const [attacker, blockers] of perAttacker) {
    const ac = d(deps, attacker);
    if (ac.keywords.has('menace') && blockers.length === 1) {
      return {
        ok: false,
        reason: 'menaceRequiresTwo',
        detail: `${ac.name} has menace — block it with two creatures or none.`,
      };
    }
  }
  return { ok: true };
}

function blockRejectionText(
  deps: CombatDeps,
  b: { blocker: InstanceId; attacker: InstanceId },
  why: BlockRejection,
): string {
  const bn = d(deps, b.blocker).name || 'That creature';
  const an = d(deps, b.attacker).name || 'the attacker';
  switch (why) {
    case 'flying':
      return `${bn} needs flying or reach to block ${an}.`;
    case 'protection':
      return `${an} has protection — ${bn} cannot block it.`;
    case 'fear':
      return `${an} has fear — only an artifact or black creature can block it.`;
    case 'intimidate':
      return `${an} has intimidate — only an artifact creature or one sharing a colour can block it.`;
    case 'shadow':
      return `${an} and ${bn} do not share shadow.`;
    case 'skulk':
      return `${an} has skulk — ${bn} has too much power to block it.`;
    case 'horsemanship':
      return `${an} has horsemanship — only a creature with horsemanship can block it.`;
    case 'landwalk':
      return `${an} has landwalk and you control a matching land — it cannot be blocked.`;
    case 'tapped':
      return `${bn} is tapped and cannot block.`;
    case 'notYours':
      return `${bn} is not defending against ${an}.`;
    case 'notAttacking':
      return `${an} is not attacking.`;
    case 'notACreature':
      return `${bn} cannot block.`;
    // ⚠️ It cannot name the card that stopped it, and that is honest rather
    // than lazy: `canBlock` returns a reason, not a source, and inventing one
    // here would mean re-running every def to find out which said no. The
    // player can see the board; what they need to know is that a rule and not
    // a bug refused the block.
    case 'restricted':
      return `Something on the battlefield stops ${bn} blocking ${an}.`;
  }
}

// ── damage (CR 510) ──────────────────────────────────────────────────────────

export function needsFirstStrikeSubstep(deps: CombatDeps): boolean {
  const combat = deps.state.combat;
  if (!combat) return false;
  const ids = [...combat.attackers.map((a) => a.card), ...combat.blockers.map((b) => b.card)];
  return ids.some((id) => {
    const chars = d(deps, id);
    return chars.keywords.has('firstStrike') || chars.keywords.has('doubleStrike');
  });
}

function dealsDamageIn(
  deps: CombatDeps,
  id: InstanceId,
  substep: 'firstStrike' | 'regular',
  alreadyDealtFirstStrike: boolean,
): boolean {
  const chars = d(deps, id);
  const first = chars.keywords.has('firstStrike');
  const double = chars.keywords.has('doubleStrike');
  if (substep === 'firstStrike') return first || double;
  // CR 510.5: a creature that already dealt first-strike damage deals again in
  // the regular step only if it has double strike.
  if (alreadyDealtFirstStrike) return double;
  return !first;
}

function isAlive(deps: CombatDeps, id: InstanceId): boolean {
  const card = deps.state.cards[id];
  return !!card && card.zone.kind === 'battlefield' && !card.phasedOut && d(deps, id).isCreature;
}

/**
 * How much damage it takes to be lethal to this blocker RIGHT NOW.
 *
 * ⚠️ The deathtouch line is the entire implementation of "trample + deathtouch
 * assigns 1 per blocker and tramples the rest". Getting it as a special case
 * instead would need a second code path that agrees with this one.
 */
function lethalFor(deps: CombatDeps, target: InstanceId, alreadyAssigned: number, deathtouch: boolean): number {
  if (deathtouch) return Math.max(0, 1 - alreadyAssigned);
  const card = deps.state.cards[target];
  const chars = d(deps, target);
  if (!card || chars.toughness === null) return 0;
  return Math.max(0, chars.toughness - card.damage - alreadyAssigned);
}

export interface AssignmentPlan {
  readonly assignments: readonly { readonly to: InstanceId | PlayerId; readonly kind: 'card' | 'player'; readonly amount: number; readonly viaTrample: number }[];
}

export function assignAttackerDamage(deps: CombatDeps, decl: AttackerDecl): AssignmentPlan {
  const chars = d(deps, decl.card);
  const power = chars.power ?? 0;
  if (power <= 0) return { assignments: [] };
  const deathtouch = chars.keywords.has('deathtouch');
  const trample = chars.keywords.has('trample');

  const order = decl.blockerOrder.filter((id) => isAlive(deps, id));
  if (order.length === 0) {
    // CR 509.1h — an attacker that BECAME blocked deals no damage even if every
    // blocker has since left combat. `becameBlocked` is sticky for this.
    if (decl.becameBlocked) return { assignments: [] };
    const defender = decl.defender;
    return {
      assignments: [
        defender.kind === 'player'
          ? { to: defender.id, kind: 'player', amount: power, viaTrample: 0 }
          : { to: defender.id, kind: 'card', amount: power, viaTrample: 0 },
      ],
    };
  }

  let remaining = power;
  const assigned = new Map<InstanceId, number>();
  let last: InstanceId | null = null;
  for (const blocker of order) {
    last = blocker;
    const need = lethalFor(deps, blocker, assigned.get(blocker) ?? 0, deathtouch);
    const give = Math.min(remaining, need);
    assigned.set(blocker, (assigned.get(blocker) ?? 0) + give);
    remaining -= give;
    if (remaining === 0) break;
  }

  const toBlockers = (): AssignmentPlan['assignments'] =>
    [...assigned.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([to, amount]) => ({ to, kind: 'card' as const, amount, viaTrample: 0 }));

  if (remaining > 0) {
    // Trample only spills over once EVERY blocker in the order has lethal
    // damage assigned to it. CR 702.19b — and with deathtouch "lethal" is 1,
    // which is the whole implementation of trample+deathtouch.
    const allCovered = order.every((b) => lethalFor(deps, b, assigned.get(b) ?? 0, deathtouch) === 0);
    if (trample && allCovered) {
      const defender = decl.defender;
      return {
        assignments: [
          ...toBlockers(),
          defender.kind === 'player'
            ? { to: defender.id, kind: 'player' as const, amount: remaining, viaTrample: remaining }
            : { to: defender.id, kind: 'card' as const, amount: remaining, viaTrample: remaining },
        ],
      };
    }
    // CR 510.1c — all combat damage must be assigned. Without trample the
    // excess piles onto the last blocker considered rather than vanishing.
    if (last) assigned.set(last, (assigned.get(last) ?? 0) + remaining);
  }
  return { assignments: toBlockers() };
}

/** A blocker divides its power over the attackers it is blocking, in order. */
export function assignBlockerDamage(
  deps: CombatDeps,
  blocker: InstanceId,
  attackerOrder: readonly InstanceId[],
): AssignmentPlan {
  const chars = d(deps, blocker);
  const power = chars.power ?? 0;
  if (power <= 0) return { assignments: [] };
  const deathtouch = chars.keywords.has('deathtouch');
  const order = attackerOrder.filter((id) => isAlive(deps, id));
  if (order.length === 0) return { assignments: [] };

  let remaining = power;
  const assigned = new Map<InstanceId, number>();
  let last: InstanceId | null = null;
  for (const attacker of order) {
    last = attacker;
    const need = lethalFor(deps, attacker, assigned.get(attacker) ?? 0, deathtouch);
    const give = Math.min(remaining, need);
    assigned.set(attacker, (assigned.get(attacker) ?? 0) + give);
    remaining -= give;
    if (remaining === 0) break;
  }
  if (remaining > 0 && last) assigned.set(last, (assigned.get(last) ?? 0) + remaining);
  return {
    assignments: [...assigned.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([to, amount]) => ({ to, kind: 'card' as const, amount, viaTrample: 0 })),
  };
}

/**
 * The whole sub-step's damage, computed before any of it is applied.
 *
 * ⚠️ SIMULTANEITY IS STRUCTURAL. One event carries the entire assignment map
 * and `apply` folds all of it atomically, which is why deathtouch + lifelink
 * gains life even though the source dies in the same SBA pass, and why first
 * strike kills a blocker before it can strike back — the SBA closure runs
 * BETWEEN the two events, not inside one.
 */
export function resolveCombatDamage(
  deps: CombatDeps,
  substep: 'firstStrike' | 'regular',
): ResolvedDamage[] {
  const combat = deps.state.combat;
  if (!combat) return [];
  const out: ResolvedDamage[] = [];

  for (const decl of combat.attackers) {
    if (!isAlive(deps, decl.card)) continue;
    if (!dealsDamageIn(deps, decl.card, substep, decl.dealtFirstStrikeDamage)) continue;
    const chars = d(deps, decl.card);
    const source = deps.state.cards[decl.card];
    if (!source) continue;
    for (const a of assignAttackerDamage(deps, decl).assignments) {
      const amount = preventedAmount(deps, decl.card, a.to, a.kind, a.amount);
      if (amount <= 0) continue;
      out.push({
        source: decl.card,
        target: a.kind === 'player' ? { kind: 'player', id: a.to } : { kind: 'card', id: a.to },
        amount,
        deathtouch: chars.keywords.has('deathtouch'),
        lifelinkTo: chars.keywords.has('lifelink') ? source.controller : null,
        // CR 903.10a: commander damage is COMBAT damage to a PLAYER only. A
        // commander burning someone for 7 does not count, and neither does
        // combat damage to a planeswalker.
        //
        // ⚠️ An INFECT commander still deals commander damage. CR 903.10a keys
        // off combat damage dealt to a player by a commander, and infect changes
        // how that damage is applied, not whether it happened — so an infect
        // commander is on two clocks at once (21 commander damage and 10
        // poison), which is exactly how the real card plays.
        isCommanderDamage: source.isCommander && a.kind === 'player',
        viaTrample: a.viaTrample,
        applyAs: applyModeFor(chars, a.kind),
        toxic: a.kind === 'player' ? chars.toxicAmount : 0,
      });
    }
  }

  for (const decl of combat.blockers) {
    if (!isAlive(deps, decl.card)) continue;
    if (!dealsDamageIn(deps, decl.card, substep, decl.dealtFirstStrikeDamage)) continue;
    const chars = d(deps, decl.card);
    const source = deps.state.cards[decl.card];
    if (!source) continue;
    for (const a of assignBlockerDamage(deps, decl.card, decl.attackerOrder).assignments) {
      const amount = preventedAmount(deps, decl.card, a.to, a.kind, a.amount);
      if (amount <= 0) continue;
      out.push({
        source: decl.card,
        target: { kind: 'card', id: a.to },
        amount,
        deathtouch: chars.keywords.has('deathtouch'),
        lifelinkTo: chars.keywords.has('lifelink') ? source.controller : null,
        isCommanderDamage: false,
        viaTrample: 0,
        applyAs: applyModeFor(chars, 'card'),
        // A blocker only ever damages creatures, so toxic never applies here.
        toxic: 0,
      });
    }
  }

  return out;
}

/**
 * How this source's combat damage is applied. CR 702.90a / 702.79a.
 *
 * ⚠️ Infect is the only keyword that behaves differently against a player than
 * against a creature — poison counters one way, −1/−1 counters the other — which
 * is why the target kind is a parameter rather than something the caller applies
 * afterwards. Wither only ever affects creatures; against a player it is plain
 * damage, and a wither creature attacking a player is completely ordinary.
 */
function applyModeFor(
  chars: DerivedCharacteristics,
  targetKind: 'card' | 'player',
): 'normal' | 'poison' | 'wither' {
  if (chars.keywords.has('infect')) return targetKind === 'player' ? 'poison' : 'wither';
  if (chars.keywords.has('wither') && targetKind === 'card') return 'wither';
  return 'normal';
}

/** Protection prevents the damage; the assignment still happened. CR 702.16c. */
function preventedAmount(
  deps: CombatDeps,
  source: InstanceId,
  target: InstanceId | PlayerId,
  kind: 'card' | 'player',
  amount: number,
): number {
  if (kind !== 'card') return amount;
  const targetCard = deps.state.cards[target];
  if (!targetCard) return 0;
  const tc = d(deps, target);
  const sc = d(deps, source);
  if (tc.protection.fromEverything) return 0;
  if (tc.protection.colors.some((c) => sc.colors.includes(c))) return 0;
  return amount;
}

/** Every creature currently in combat, for `RemovedFromCombat` at end of combat. */
export function creaturesInCombat(state: GameState): InstanceId[] {
  if (!state.combat) return [];
  return [...state.combat.attackers.map((a) => a.card), ...state.combat.blockers.map((b) => b.card)];
}
