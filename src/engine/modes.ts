/**
 * D343 — THE MODAL SEAM, the pure half.
 *
 * "Choose one —" and its "• mode" lines (CR 700.2): a modal spell announces
 * its modes as it is cast (CR 601.2b, BEFORE X and before targets), a modal
 * activated ability as it is activated (602.2b), a modal triggered ability as
 * it is put on the stack (603.3c) — and only the chosen modes' target clauses
 * are then aimed, only the chosen modes' text then resolves. The prompt is
 * `chooseModes` (state.ts); the choice rides `PendingCast.modes` and
 * `StackObject.modes`, both of which had existed since M3 with nothing setting
 * them. These helpers are the arithmetic every site shares, so the cast, the
 * activation, the trigger and the resolution cannot count the modes' clauses
 * differently.
 *
 * ⚠️ A mode is OFFERED only while its targets can be filled (CR 601.2c, 603.3d):
 * the prompt carries `legal`, and an answer naming an unoffered mode is refused
 * by the handler — the prompt vouches for nothing, exactly as `chooseTargets`.
 */
import type { EffectSpec, ModalFace, ModeDecl, TargetSpec } from './types/oracle';
import { minimumLegalTargets, type TargetCandidate, type TargetingSource } from './targets';

/**
 * The modes a player may choose against this board (CR 601.2c, 603.3d): a mode
 * with no target clause is always offered; one with clauses only while every
 * clause can be filled — asked with the same helper the trigger stacking asks
 * of a targeted trigger. Shared by the cast offer (`legal.ts`), the host's
 * stages (`loop.ts`, `handlers.ts`) and nothing else, so the offer and the
 * refusal cannot disagree about which modes are legal.
 */
export function legalModes(
  modes: readonly ModeDecl[],
  src: TargetingSource,
  candidates: readonly TargetCandidate[],
): number[] {
  const out: number[] = [];
  modes.forEach((mode, i) => {
    const specs = mode.targets ?? [];
    if (specs.length === 0 || minimumLegalTargets(specs, src, candidates) !== null) out.push(i);
  });
  return out;
}

/** The chosen mode indices in PRINTED order, each at most once. */
export function modesInOrder(chosen: readonly number[]): number[] {
  return [...new Set(chosen)].sort((a, b) => a - b);
}

/**
 * The target clauses of the chosen modes, in printed order — the specs a cast,
 * an activation or a stacked trigger aims with once its modes are known.
 */
export function modeSpecs(modes: readonly ModeDecl[], chosen: readonly number[]): TargetSpec[] {
  return modesInOrder(chosen).flatMap((i) => modes[i]?.targets ?? []);
}

/**
 * Why a choice is not a legal answer to the prompt, or null when it is: each
 * mode at most once, every index one of the modes, the count within
 * [min, max], every chosen mode among the ones offered as legal.
 */
export function modeChoiceProblem(
  count: number,
  min: number,
  max: number,
  legal: readonly number[],
  chosen: readonly number[],
): string | null {
  const distinct = modesInOrder(chosen);
  if (distinct.length !== chosen.length) return 'Choose each mode at most once.';
  if (distinct.some((i) => !Number.isInteger(i) || i < 0 || i >= count)) return 'That is not one of the modes.';
  if (distinct.length < min) return `Choose at least ${min} mode${min === 1 ? '' : 's'}.`;
  if (distinct.length > max) return `Choose at most ${max} mode${max === 1 ? '' : 's'}.`;
  const unoffered = distinct.find((i) => !legal.includes(i));
  if (unoffered !== undefined) return 'That mode has no legal target right now.';
  return null;
}

/**
 * A modal spell's effects for the chosen modes. Each mode's effects were parsed
 * with target indices relative to ITS OWN clauses, while the cast declared its
 * targets over the chosen modes' clauses concatenated in printed order
 * (`modeSpecs`) — so a mode's indices shift by the clauses of the chosen modes
 * printed before it. A `self` clause and an unaimed one (`targetIndex === -1`)
 * pass through untouched.
 */
export function modalEffects(modal: ModalFace, chosen: readonly number[]): EffectSpec[] {
  const out: EffectSpec[] = [];
  let base = 0;
  for (const i of modesInOrder(chosen)) {
    const mode = modal.modes[i];
    if (!mode) continue;
    for (const e of mode.effects) out.push(e.self || e.targetIndex === -1 ? e : { ...e, targetIndex: e.targetIndex + base });
    base += mode.targets.length;
  }
  return out;
}

/**
 * The count a "Choose <word> —" head allows: "one" 1..1 · "two" 2..2 · "three"
 * 3..3 · "one or both" 1..2 · "one or more" 1..n · "any number" 0..n. Null for
 * a word outside that list, or a count the word cannot be satisfied by.
 */
export function modeChoiceOf(word: string, count: number): { min: number; max: number } | null {
  const w = word.trim().toLowerCase();
  const choice =
    w === 'one' ? { min: 1, max: 1 }
    : w === 'two' ? { min: 2, max: 2 }
    : w === 'three' ? { min: 3, max: 3 }
    : w === 'one or both' ? { min: 1, max: 2 }
    : w === 'one or more' ? { min: 1, max: count }
    : w === 'any number' ? { min: 0, max: count }
    : null;
  if (!choice || count < 1 || choice.max > count || choice.min > count) return null;
  if (w === 'one or both' && count !== 2) return null;
  return choice;
}
