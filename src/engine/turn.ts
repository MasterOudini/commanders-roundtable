// Phase and step structure.

import type { GameState, Phase, Step } from './types/state';

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
export function nextStep(state: GameState): { phase: Phase; step: Step } | null {
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
