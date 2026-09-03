import type { LegalAction } from '../../engine/legal';

// Which activated ability of a battlefield permanent you meant — the rows the
// card's click panel draws under its mana options.
//
// ⚠️ PURE, in its own module, for `manaOptions.ts`'s and `faceOptions.ts`'s
// reasons exactly: it is a policy decision about how to PRESENT the engine's
// legal actions, so it is a function of them and testable without a running app.
//
// ⚠️⚠️ **THE GAP THIS CLOSES IS EVERY SHIPPED `ActivatedDef`.** `legalActions`
// has offered `ActivateAbility` since the targeting work, and D159 made the
// offer def-gated and real — but no click path ever consumed one, so every
// activated ability landed since (Arcane Encyclopedia's draw, War Room, the
// Locket cycle, ~40 defs) was answerable by the bot, the fuzzer and the
// batteries and by NOBODY at the table. D143's lesson — a prompt's answerers
// and its control are separate work — in its largest instance yet (D168).

/** One activated ability the engine will charge and run, and what it needs. */
export interface AbilityOption {
  readonly abilityIndex: number;
  /** The printed cost — "{3}, {T}" — drawn as the row's leading glyphs. */
  readonly cost: string;
  /** The printed effect — "Draw a card." */
  readonly effect: string;
  /** The permanent's own name, for the aim prompt. */
  readonly name: string;
  /** `false` when the mana half of the cost cannot be met right now. */
  readonly affordable: boolean;
  /**
   * The cost sacrifices a CHOSEN permanent (D168), so activating goes through
   * the veil pick first. The candidates themselves are re-read off the CURRENT
   * legal action at pick time (`GameLayer`); this flag only routes the click.
   */
  readonly needsSacrifice: boolean;
  /** A "Discard N" cost (D286): N, or 0 when the ability has none. */
  readonly needsDiscard: number;
  /** A "Tap N untapped …" cost (D286): N, or 0 when the ability has none. */
  readonly needsTap: number;
}

/**
 * Every non-mana activated ability of this permanent the engine offers right
 * now.
 *
 * ⚠️ Mana abilities never appear here — they go through `TapForMana` and the
 * mana rows above these (CR 605), and `legalActions` keeps the two apart.
 *
 * ⚠️ An UNAFFORDABLE ability IS included, marked — `legalActions` offers it
 * with `affordable: false` exactly as it does a cast, and the mana panel (D110)
 * and face panel (D155) both settled that hiding a half the player cannot pay
 * for right now is how a card looks broken.
 */
export function abilityOptionsFor(legal: readonly LegalAction[], card: string): AbilityOption[] {
  const out: AbilityOption[] = [];
  for (const a of legal) {
    if (a.t !== 'ActivateAbility' || a.card !== card) continue;
    out.push({
      abilityIndex: a.abilityIndex,
      cost: a.costText,
      effect: a.effectText,
      name: a.label,
      affordable: a.affordable,
      needsSacrifice: (a.sacrificeCandidates?.length ?? 0) > 0,
      needsDiscard: a.discardCandidates && a.discardCount ? a.discardCount : 0,
      needsTap: a.tapCandidates && a.tapCount ? a.tapCount : 0,
    });
  }
  return out.sort((x, y) => x.abilityIndex - y.abilityIndex);
}

/**
 * The words of a cost that are not mana symbols — "Pay 2 life", "Sacrifice a
 * creature" — so a row can draw the `{...}` half as glyphs (`ManaCost` keeps
 * only brace symbols) and still say the rest out loud rather than dropping it.
 */
export function costWords(cost: string): string {
  return cost
    .replace(/\{[^}]+\}/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
}
