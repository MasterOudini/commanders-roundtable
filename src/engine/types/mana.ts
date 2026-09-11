// Mana: the pool, costs, and the payment problem a cost turns into.

import type { ColorLetter } from '../../data/cardTypes';

export type Color = ColorLetter;
export const COLORS: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

/** The six pool slots. Identical shape to the view's `Record<ManaSymbol, number>`. */
export interface ManaPool {
  readonly W: number;
  readonly U: number;
  readonly B: number;
  readonly R: number;
  readonly G: number;
  readonly C: number;
}

export type ManaSymbolKey = keyof ManaPool;
export const MANA_KEYS: readonly ManaSymbolKey[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const EMPTY_POOL: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

/**
 * D397 - SPEND-RESTRICTED MANA. "Spend this mana only to cast creature spells" (Ancient
 * Ziggurat), "... only to cast artifact spells or activate abilities of artifacts"
 * (Vedalken Engineer), "... only to activate abilities" (Omen Hawker).
 *
 * A restriction is read off the mana line as a list of ALTERNATIVES, each a CONJUNCTION
 * of type-line terms the thing being paid for must satisfy: `colorless Eldrazi spells`
 * is one alternative of two terms, `a Knight or Equipment spell` two alternatives of one
 * term each, `spells` one EMPTY conjunction (any spell). `spells: null` means the mana
 * pays for no spell at all, `abilities: null` for no ability; an empty conjunction in
 * `abilities` is "activate an ability" of anything. What it can never pay for is
 * anything else - a ward tax, a "pay {2} or sacrifice" prompt, a morph turned face up -
 * and the payment path says so by asking with a purpose of kind `other`.
 *
 * ⚠️ Read by ONE reader (`parseSpendRestriction` in `oracleParse.ts`) and enforced at
 * ONE seam (`fitFor` in `payment.ts`): a purpose a restriction does not fit sees neither
 * the source nor the mana it already made. A sentence the reader cannot express leaves
 * the line `conditional`, exactly as before - tapped by hand, the restriction the
 * player's - never widened to something the card does not say (D90).
 */
export type SpendTerm =
  | { readonly kind: 'type'; readonly value: string }
  | { readonly kind: 'subtype'; readonly value: string }
  | { readonly kind: 'supertype'; readonly value: string }
  | { readonly kind: 'colorless' }
  | { readonly kind: 'multicolored' }
  | { readonly kind: 'monocolored' };

/** Every term must hold of the spell, or of the ability's source. */
export type SpendConjunction = readonly SpendTerm[];

export interface SpendRestriction {
  /** The spells this mana may be spent to cast (any alternative), or null for none. */
  readonly spells: readonly SpendConjunction[] | null;
  /** The sources whose abilities this mana may be spent to activate, or null for none. */
  readonly abilities: readonly SpendConjunction[] | null;
  /** The printed sentence, which is also the bucket's identity in the pool. */
  readonly text: string;
}

/** D397 - a sub-pool of `PlayerState.pool`: mana held under one restriction. */
export interface RestrictedMana {
  readonly restriction: SpendRestriction;
  readonly mana: ManaPool;
}

/**
 * One branch of a hybrid symbol.
 *
 * ⚠️ Phyrexian is modelled as a hybrid whose second option is `life`, rather
 * than as its own field on `ManaCost`. `{W/P}` and `{W/U}` are the same shape of
 * decision — "satisfy this symbol one of these ways" — so unifying them means
 * the solver, the payment UI and the validator each have ONE code path instead
 * of two that must be kept in agreement. The spec sketched a separate
 * `phyrexian: Color[]`; see DECISIONS D33.
 */
export type HybridOption =
  | { readonly kind: 'color'; readonly color: Color }
  | { readonly kind: 'colorless' }
  | { readonly kind: 'snow' }
  | { readonly kind: 'generic'; readonly amount: number }
  | { readonly kind: 'life'; readonly amount: number };

export interface HybridSymbol {
  readonly options: readonly HybridOption[];
  readonly raw: string;
}

/** A parsed `{2}{W}{W/U}{X}` cost. `null` for a card with no mana cost. */
export interface ManaCost {
  readonly generic: number;
  /** How many `{X}` symbols appear. Commander cards effectively never exceed 1. */
  readonly xCount: number;
  readonly colored: Readonly<Record<Color, number>>;
  readonly colorless: number;
  readonly snow: number;
  readonly hybrids: readonly HybridSymbol[];
  /** Mana value ignoring X, matching Scryfall's `cmc` for a non-X card. */
  readonly manaValue: number;
  readonly raw: string;
}

export const FREE_COST: ManaCost = {
  generic: 0,
  xCount: 0,
  colored: { W: 0, U: 0, B: 0, R: 0, G: 0 },
  colorless: 0,
  snow: 0,
  hybrids: [],
  manaValue: 0,
  raw: '',
};

/** One hybrid symbol in a payment problem, with its index for the chosen option. */
export interface HybridRequirement {
  readonly index: number;
  readonly options: readonly HybridOption[];
}

/**
 * What actually has to be paid, after X, commander tax and additional costs.
 * This — not `ManaCost` — is what the solver consumes.
 */
export interface PaymentProblem {
  readonly colored: Readonly<Record<Color, number>>;
  readonly colorless: number;
  readonly generic: number;
  readonly snow: number;
  readonly hybrids: readonly HybridRequirement[];
  /** Life from additional costs, separate from a hybrid's `life` option. */
  readonly additionalLife: number;
  /** Lower bound on mana needed, hybrids counted as one each. */
  readonly totalMana: number;
}

/** One source's contribution in a payment plan. */
export interface PlannedTap {
  readonly source: string;
  readonly abilityIndex: number;
  /** Which of that ability's outputs was chosen (an "any colour" land has 5). */
  readonly outputChoice: number;
}

export interface PaymentPlan {
  readonly taps: readonly PlannedTap[];
  readonly spendFromPool: ManaPool;
  readonly hybridChoices: readonly { readonly index: number; readonly option: number }[];
  /** Hybrid symbols satisfied by paying life (phyrexian). */
  readonly lifePaid: number;
  /**
   * Staleness guard. The plan is computed client-side from a `PlayerView`; the
   * host re-validates against real state and rejects a plan built against a
   * board that has since changed.
   */
  readonly forEventCount: number;
}

export function poolTotal(p: ManaPool): number {
  return p.W + p.U + p.B + p.R + p.G + p.C;
}

export function addPool(a: ManaPool, b: ManaPool): ManaPool {
  return { W: a.W + b.W, U: a.U + b.U, B: a.B + b.B, R: a.R + b.R, G: a.G + b.G, C: a.C + b.C };
}

export function subPool(a: ManaPool, b: ManaPool): ManaPool {
  return { W: a.W - b.W, U: a.U - b.U, B: a.B - b.B, R: a.R - b.R, G: a.G - b.G, C: a.C - b.C };
}

export function poolIsEmpty(p: ManaPool): boolean {
  return poolTotal(p) === 0;
}

export function poolCoversPool(have: ManaPool, want: ManaPool): boolean {
  return (
    have.W >= want.W &&
    have.U >= want.U &&
    have.B >= want.B &&
    have.R >= want.R &&
    have.G >= want.G &&
    have.C >= want.C
  );
}

export function poolFrom(entries: Partial<Record<ManaSymbolKey, number>>): ManaPool {
  return {
    W: entries.W ?? 0,
    U: entries.U ?? 0,
    B: entries.B ?? 0,
    R: entries.R ?? 0,
    G: entries.G ?? 0,
    C: entries.C ?? 0,
  };
}
