// D405 - CONVOKE (CR 702.51), IMPROVISE (CR 702.126) and DELVE (CR 702.66): the cast-time
// alternatives that pay PART of a spell's cost with something other than mana. A creature the
// caster taps pays {1} or one mana of its colour; an artifact the caster taps pays {1}; a card
// the caster exiles from their graveyard pays {1}. The CAST names the permanents and cards
// (`CastSpell.convoke` / `improvise` / `delve`), the host validates them, and ONE assignment -
// this module's - decides which symbols they pay, for the host's charge and the client's preview
// alike (D53: one payment previewed, the same one charged).
//
// ⚠️ The assignment is GREEDY IN THE ORDER GIVEN: a creature pays a coloured symbol of its colour
// while one is unpaid, else generic; an artifact or a card pays generic. A choice that pays for
// NOTHING is refused by name rather than tapped for free (CR 601.2h: a cost is paid, not
// gestured at). Hybrid symbols are not paid this way yet (a reportable): they stay for the mana.

import type { InstanceId } from './types/ids';
import { COLORS, type Color, type PaymentProblem } from './types/mana';

/** What the cast chose to tap or exile, by keyword. Empty lists are the plain cast. */
export interface AltChoice {
  readonly convoke: readonly InstanceId[];
  readonly improvise: readonly InstanceId[];
  readonly delve: readonly InstanceId[];
}

export const NO_ALT: AltChoice = { convoke: [], improvise: [], delve: [] };

export const altCount = (alt: AltChoice): number => alt.convoke.length + alt.improvise.length + alt.delve.length;

/** The symbols the alternatives pay: so many of each colour, so much generic. */
export interface AltPaid {
  readonly colored: Readonly<Record<Color, number>>;
  readonly generic: number;
}

/** A convoking creature, by its colours (derived on the host, printed on the client). */
export interface ConvokeCandidate {
  readonly id: InstanceId;
  readonly colors: readonly Color[];
}

/**
 * Assign the chosen alternatives to the problem's symbols. `failed` names the first choice that
 * pays for nothing (the caller refuses it by name); otherwise `paid` is what comes off the cost.
 */
export function assignAlternativePayment(
  problem: PaymentProblem,
  convoke: readonly ConvokeCandidate[],
  improvise: number,
  delve: number,
): { readonly paid: AltPaid; readonly failed: { readonly kind: 'convoke' | 'improvise' | 'delve'; readonly index: number } | null } {
  const colored: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let generic = 0;
  const genericLeft = (): number => problem.generic - generic;
  for (let i = 0; i < convoke.length; i++) {
    const c = convoke[i] as ConvokeCandidate;
    const colour = c.colors.find((k) => problem.colored[k] - colored[k] > 0);
    if (colour !== undefined) colored[colour] += 1;
    else if (genericLeft() > 0) generic += 1;
    else return { paid: { colored, generic }, failed: { kind: 'convoke', index: i } };
  }
  for (let i = 0; i < improvise; i++) {
    if (genericLeft() > 0) generic += 1;
    else return { paid: { colored, generic }, failed: { kind: 'improvise', index: i } };
  }
  for (let i = 0; i < delve; i++) {
    if (genericLeft() > 0) generic += 1;
    else return { paid: { colored, generic }, failed: { kind: 'delve', index: i } };
  }
  return { paid: { colored, generic }, failed: null };
}

/** The problem with the paid symbols taken off it (never below zero), the total recounted. */
export function applyAlternativePayment(problem: PaymentProblem, paid: AltPaid): PaymentProblem {
  const colored: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const c of COLORS) colored[c] = Math.max(0, problem.colored[c] - paid.colored[c]);
  const generic = Math.max(0, problem.generic - paid.generic);
  let totalMana = problem.colorless + generic;
  for (const c of COLORS) totalMana += colored[c];
  // The hybrids' share of the total is what the base problem counted for them.
  let hybridShare = problem.totalMana - problem.colorless - problem.generic;
  for (const c of COLORS) hybridShare -= problem.colored[c];
  totalMana += Math.max(0, hybridShare);
  return { ...problem, colored, generic, totalMana };
}

/**
 * The chooser the client, the bot and the fuzz driver share: as many of the candidates as the
 * cost can absorb, coloured symbols first (a creature of a matching colour), then generic in
 * the order given. Every choice it returns pays for something, so the host accepts it.
 */
export function chooseAlternatives(
  problem: PaymentProblem,
  convoke: readonly ConvokeCandidate[],
  improvise: readonly InstanceId[],
  delve: readonly InstanceId[],
): AltChoice {
  const colored: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let generic = 0;
  const chosenConvoke: InstanceId[] = [];
  const used = new Set<InstanceId>();
  // Coloured symbols first: a creature pays the first unpaid colour it has.
  for (const c of convoke) {
    const colour = c.colors.find((k) => problem.colored[k] - colored[k] > 0);
    if (colour === undefined) continue;
    colored[colour] += 1;
    chosenConvoke.push(c.id);
    used.add(c.id);
  }
  // Then generic, creatures before artifacts before graveyard cards.
  for (const c of convoke) {
    if (used.has(c.id) || generic >= problem.generic) continue;
    generic += 1;
    chosenConvoke.push(c.id);
    used.add(c.id);
  }
  const chosenImprovise: InstanceId[] = [];
  for (const id of improvise) {
    if (used.has(id) || generic >= problem.generic) continue;
    generic += 1;
    chosenImprovise.push(id);
    used.add(id);
  }
  const chosenDelve: InstanceId[] = [];
  for (const id of delve) {
    if (used.has(id) || generic >= problem.generic) continue;
    generic += 1;
    chosenDelve.push(id);
    used.add(id);
  }
  return { convoke: chosenConvoke, improvise: chosenImprovise, delve: chosenDelve };
}
