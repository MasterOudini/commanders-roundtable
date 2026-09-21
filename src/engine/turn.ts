// Phase and step structure.

import type { ExtraPhaseKind, ExtraPhases, GameState, Phase, Step } from './types/state';
import type { InstanceId, PlayerId } from './types/ids';
import type { OracleDb } from './types/oracle';
import type { ScriptRegistry } from './scripts/registry';
import { derive } from './derive';
import { faceOf } from './oracle';

/** In turn order. `firstStrikeDamage` is skipped unless combat needs it. */
export const STEP_ORDER: readonly { readonly phase: Phase; readonly step: Step }[] = [
  { phase: 'beginning', step: 'untap' },
  { phase: 'beginning', step: 'upkeep' },
  { phase: 'beginning', step: 'draw' },
  { phase: 'precombatMain', step: 'precombatMain' },
  { phase: 'combat', step: 'beginCombat' },
  { phase: 'combat', step: 'declareAttackers' },
  { phase: 'combat', step: 'declareBlockers' },
  { phase: 'combat', step: 'firstStrikeDamage' },
  { phase: 'combat', step: 'combatDamage' },
  { phase: 'combat', step: 'endCombat' },
  { phase: 'postcombatMain', step: 'postcombatMain' },
  { phase: 'ending', step: 'end' },
  { phase: 'ending', step: 'cleanup' },
];

const INDEX = new Map<Step, number>(STEP_ORDER.map((s, i) => [s.step, i]));

export function phaseOf(step: Step): Phase {
  return STEP_ORDER[INDEX.get(step) ?? 0]?.phase ?? 'beginning';
}

/**
 * The step after this one, or null when the turn is over.
 *
 * ⚠️ `firstStrikeDamage` exists in the array but is SKIPPED unless
 * `combat.hasFirstStrikeSubstep` is set — CR 510.4 inserts the extra step only
 * when a creature in combat has first or double strike. Modelling it as a
 * normally-present step that is skipped (rather than one spliced in) means the
 * ordering is declared once, in a list you can read, instead of being computed
 * in two places that can disagree.
 */
export function nextStep(state: GameState): { phase: Phase; step: Step; queue?: PhaseQueue } | null {
  // D512 - CR 500.8: at a phase end, the phases added after this kind of phase are inserted (the most recently
  // created first), an insertion in progress continues, and once it is spent the regular sequence resumes.
  const extra = extraPhaseStep(state);
  if (extra) return extra;
  let i = (INDEX.get(state.turn.step) ?? 0) + 1;
  while (i < STEP_ORDER.length) {
    const candidate = STEP_ORDER[i];
    if (!candidate) break;
    if (candidate.step === 'firstStrikeDamage' && !state.combat?.hasFirstStrikeSubstep) {
      i++;
      continue;
    }
    // With no attackers there is nothing for the blocker and damage steps to
    // do. CR 508.1d/509 still run them, but skipping them is invisible to the
    // rules and removes three pointless priority rounds per turn — which on a
    // 4-player table is twelve clicks nobody wants.
    if (
      state.combat !== null &&
      state.combat.attackers.length === 0 &&
      (candidate.step === 'declareBlockers' ||
        candidate.step === 'firstStrikeDamage' ||
        candidate.step === 'combatDamage')
    ) {
      i++;
      continue;
    }
    return candidate;
  }
  return null;
}

/** D512 - the phase queue as a phase end leaves it (`ExtraPhasesConsumed`). */
export interface PhaseQueue {
  readonly pending: readonly ExtraPhases[];
  readonly inserted: readonly ExtraPhaseKind[];
  readonly resume: Step | null;
}

/** D512 - the kind of phase a step ends, for the phases added after it: a main step ends a main phase, `endCombat` a combat. */
function phaseEnding(step: Step): 'main' | 'combat' | null {
  return step === 'precombatMain' || step === 'postcombatMain' ? 'main' : step === 'endCombat' ? 'combat' : null;
}

/**
 * D512 - THE ADDITIONAL PHASES (CR 500.8). At the end of a main phase or a combat phase: every pending entry added
 * after this kind of phase is prepended to the inserted queue in creation order (so the most recently created runs
 * first); the queue's head begins - a combat at `beginCombat`, a main phase as a postcombat main (CR 505.1a) - and
 * the regular step that would have followed is remembered once, at the first insertion; an inserted phase whose
 * end finds the queue empty hands the turn back to that step. Null when nothing is pending or inserted here.
 */
function extraPhaseStep(state: GameState): { phase: Phase; step: Step; queue: PhaseQueue } | null {
  const ending = phaseEnding(state.turn.step);
  if (ending === null) return null;
  const matching = state.turn.extraPhases.filter((p) => p.after === ending);
  let inserted: readonly ExtraPhaseKind[] = state.turn.insertedPhases;
  for (const p of matching) inserted = [...p.phases, ...inserted];
  const pending = matching.length > 0 ? state.turn.extraPhases.filter((p) => p.after !== ending) : state.turn.extraPhases;
  if (inserted.length > 0) {
    const head = inserted[0] as ExtraPhaseKind;
    const regular = STEP_ORDER[(INDEX.get(state.turn.step) ?? 0) + 1];
    const resume = state.turn.resumeStep ?? (regular ? regular.step : null);
    const queue = { pending, inserted: inserted.slice(1), resume };
    return head === 'combat' ? { phase: 'combat', step: 'beginCombat', queue } : { phase: 'postcombatMain', step: 'postcombatMain', queue };
  }
  if (state.turn.resumeStep !== null) {
    const step = state.turn.resumeStep;
    return { phase: phaseOf(step), step, queue: { pending, inserted: [], resume: null } };
  }
  return null;
}

/**
 * CR 502.3 — no player receives priority during the untap step.
 *
 * Cleanup is conditional: normally no priority, but if a state-based action or
 * a trigger happened, players get priority and another cleanup follows
 * (CR 514.3a). `turn.cleanupNeedsRepeat` carries that.
 */
export function grantsPriority(state: GameState): boolean {
  if (state.turn.step === 'untap') return false;
  if (state.turn.step === 'cleanup') return state.turn.cleanupNeedsRepeat;
  return true;
}

/**
 * D442 - CR 402.2: a player's maximum hand size, normally seven (`GameOptions.maxHandSize`). Read off every battlefield permanent
 * that still has abilities (`hasAbilities` - a face-down or Humility-blanked one prints nothing) whose
 * face carries a hand-size line (`OracleFace.handSize`) and names this player: `you` is the
 * controller's own, `each` everyone's, `opponents` everyone but the controller's.
 *
 * `none` wins outright - a player with no maximum hand size is not modified by a reduction or an
 * increase (Spellbook's printed ruling). Otherwise the LAST `set` in battlefield order (the entry
 * order, so the newest timestamp) replaces the seven, then every `delta` adds to it, floored at zero.
 * `Infinity` is the unlimited answer, so `hand.length > max` reads the same either way.
 */
export function maxHandSize(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, player: PlayerId): number {
  let unlimited = state.options.maxHandSize === null;
  let base = state.options.maxHandSize ?? 7;
  let delta = 0;
  for (const id of state.zones.battlefield as readonly InstanceId[]) {
    const card = state.cards[id];
    if (!card) continue;
    const printing = oracle.byPrinting(card.printingId);
    if (!printing) continue;
    const mod = faceOf(printing, card.faceIndex).handSize;
    if (mod === null) continue;
    const applies = mod.who === 'each' || (mod.who === 'you' ? card.controller === player : card.controller !== player);
    if (!applies) continue;
    if (!derive(state, oracle, scripts, id).hasAbilities) continue;
    if (mod.kind === 'none') unlimited = true;
    else if (mod.kind === 'set') base = mod.n;
    else delta += mod.n;
  }
  if (unlimited) return Infinity;
  return Math.max(0, base + delta);
}

export function isMainPhase(step: Step): boolean {
  return step === 'precombatMain' || step === 'postcombatMain';
}

export function isCombatStep(step: Step): boolean {
  return phaseOf(step) === 'combat';
}

/**
 * CR 103.7a/b — encoded as written.
 *
 * In a TWO-player game the starting player skips their first draw step. In a
 * game with three or more players NOBODY skips it. Getting this backwards is a
 * classic, and it is invisible for the first four turns of a four-player game,
 * so the first turn's log line says which rule applied.
 */
export function skipsFirstDraw(state: GameState): boolean {
  return state.seating.length === 2 && state.turn.turnNumber === 1;
}
