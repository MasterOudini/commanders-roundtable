// The card shapes the UI renders from. Populated by the card database (M1.6);
// deliberately a small projection of Scryfall's schema rather than a pass-through,
// so a Scryfall field rename can't ripple into 20 components.

export type ColorLetter = 'W' | 'U' | 'B' | 'R' | 'G';

/** Scryfall `layout`, narrowed to the ones that change how we render. */
export type CardLayout =
  | 'normal'
  | 'transform' // two faces, separate images, flips on the battlefield
  | 'modal_dfc' // two faces, separate images, choose on cast
  | 'meld'
  | 'split' // both halves on ONE image, rotated name
  | 'flip' // one image, upside-down second half
  | 'adventure' // one image, creature + spell
  | 'leveler'
  | 'saga'
  | 'class'
  | 'battle'
  | 'prototype'
  | 'token'
  | 'mutate'
  | 'case'
  | 'prepare'
  | 'reversible_card'
  /**
   * Planes, schemes, Vanguard avatars, emblems, Un-set host/augment halves and
   * token backs. Indexed and searchable, but not expected to render like a spell.
   */
  | 'other';

export interface CardFace {
  name: string;
  /** Scryfall mana-cost string, e.g. '{2}{U}{U}'. Empty when the face has none. */
  manaCost: string;
  typeLine: string;
  oracleText: string;
  flavorText: string | null;
  /** Printed values — strings because of '*', '1+*', 'X'. */
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  colors: ColorLetter[];
  artist: string | null;
  /**
   * Image id for the cardimg:// scheme: '<scryfallId>' for a single-image card,
   * '<scryfallId>-<faceIndex>' for one with per-face images.
   */
  imageId: string;
}

export interface CardData {
  scryfallId: string;
  oracleId: string;
  /** Full printed name, including ' // ' for multi-face cards. */
  name: string;
  layout: CardLayout;
  /** Always at least one entry. */
  faces: CardFace[];
  /** CR 903.4 colour identity, straight from Scryfall — never hand-computed. */
  colorIdentity: ColorLetter[];
  cmc: number;
  keywords: string[];
  setCode: string;
  collectorNumber: string;
  /** Scryfall `legalities.commander`: 'legal' | 'not_legal' | 'banned' | … */
  commanderLegality: string;
  /**
   * True when every face shares ONE printed image (split, flip, adventure).
   * False for transform/modal_dfc, which have an image per face. This is the
   * distinction that decides whether the flip button swaps an image or rotates.
   */
  singleImage: boolean;
}

/** How much of a card we can usefully draw at the current size. */
export type CardRenderMode = 'full' | 'chit' | 'back' | 'pile';

/** Height thresholds, in CSS px, that select the mode. */
export const CARD_MODE_MIN_HEIGHT = {
  /** Below this the full frame is mostly border — the art crop shows more. */
  full: 120,
  /**
   * Below this a card stops being a card and becomes a `pile` — no name, no
   * cost, no P/T.
   *
   * ⚠️ THIS USED TO BE 96, THE SAME NUMBER AS `MIN_BAND_CARD_H`, and the two
   * being equal is what left the row packer's shrink rung with nowhere to go:
   * the table solves every band card down to 96, the packer may not squeeze
   * below 96, so a row under local pressure had no rung between "fits" and
   * "scrolls". Measured on a played 4-seat board — 2 upright and 3 turned slots
   * needing 426 px of a 421 px band — the row could not fit even with every gap
   * removed. See D105.
   *
   * 88 is the headroom that fixes it: a pressured row squeezes to ~91 px and is
   * still drawn as a chit, with its name, cost and P/T intact. Nothing renders
   * at 88–95 px unless a row is genuinely over-full, and it goes back the moment
   * those permanents untap.
   */
  chit: 88,
} as const;

/** Printed card aspect ratio (63×88 mm ≈ Scryfall's 745×1040). */
export const CARD_ASPECT = 745 / 1040;

/**
 * Above this height the printed name on the real image is legible, so our
 * name-strip chrome cross-fades out and stops covering the art.
 */
export const PRINTED_NAME_LEGIBLE_HEIGHT = 190;

export function modeForHeight(heightPx: number, faceDown = false): CardRenderMode {
  if (faceDown) return 'back';
  if (heightPx >= CARD_MODE_MIN_HEIGHT.full) return 'full';
  if (heightPx >= CARD_MODE_MIN_HEIGHT.chit) return 'chit';
  return 'pile';
}

/** The single colour that best represents a card, for glows and edge bars. */
export function identityToken(identity: ColorLetter[]): string {
  if (identity.length === 0) return 'var(--color-mtg-c)';
  if (identity.length > 1) return 'var(--color-mtg-m)';
  return `var(--color-mtg-${identity[0]!.toLowerCase()})`;
}

/**
 * The same identity as a paintable GRADIENT rather than one flat token.
 *
 * ⚠️ Use this, not `identityToken`, whenever the identity belongs to a PLAYER.
 * `identityToken` collapses every multicolour identity to one gold, which is
 * right for a card (a gold pip is a real thing) and wrong for a seat: at a table
 * with a Jeskai deck and an Esper deck, both seats would be the same gold and
 * the colour would identify nobody. Each seat keeps its own stops here.
 */
export function identityGradient(identity: readonly ColorLetter[], deg = 180): string {
  if (identity.length === 0) return 'var(--color-mtg-c)';
  if (identity.length === 1) return `var(--color-mtg-${identity[0]!.toLowerCase()})`;
  const stops = identity.map((c) => `var(--color-mtg-${c.toLowerCase()})`);
  return `linear-gradient(${deg}deg, ${stops.join(', ')})`;
}
