// Scryfall mana-cost strings → mana-font class names.
//
// Scryfall writes costs as brace-delimited symbols: '{2}{W/U}{X}{P/R}{S}'.
// mana-font names them '.ms-2', '.ms-wu', '.ms-x', '.ms-r.ms-p', '.ms-s'.
// The mapping is mostly mechanical, with a handful of shapes that are not:
// hybrid, twobrid, phyrexian, and the half/infinity oddities.

export interface ManaSymbol {
  /** mana-font class, e.g. 'ms-wu'. */
  className: string;
  /** The raw inner text, for tests and labels. */
  raw: string;
}

/** Named symbols whose class name is not simply the lowercased inner text. */
const SPECIAL: Record<string, string> = {
  'C/W': 'ms-cw',
  'C/U': 'ms-cu',
  'C/B': 'ms-cb',
  'C/R': 'ms-cr',
  'C/G': 'ms-cg',
  '1/2': 'ms-1-2', // half a generic mana (Unglued)
  INFINITY: 'ms-infinity',
  HW: 'ms-hw', // half white
  HR: 'ms-hr', // half red
  T: 'ms-tap',
  Q: 'ms-untap',
  E: 'ms-e', // energy
  A: 'ms-acorn',
  TK: 'ms-ticket',
  PW: 'ms-planeswalker',
  CHAOS: 'ms-chaos',
};

/**
 * Parse a cost string into renderable symbols.
 *
 * Unknown symbols fall back to `ms-{n}`-style generic rather than being dropped:
 * a card whose cost we cannot fully parse must still show *something*, because a
 * silently missing pip reads as "this spell is cheaper than it is".
 */
export function parseManaSymbols(cost: string): ManaSymbol[] {
  if (!cost) return [];
  const matches = cost.match(/\{[^}]+\}/g);
  if (!matches) return [];

  return matches.map((token) => {
    const raw = token.slice(1, -1);
    return { className: symbolClass(raw), raw };
  });
}

function symbolClass(raw: string): string {
  const upper = raw.toUpperCase();

  const special = SPECIAL[upper];
  if (special) return special;

  // Plain numbers: {0}…{20}, plus {100} and {1000000}.
  if (/^\d+$/.test(upper)) return `ms-${upper}`;

  // Single letters: colours, {C}, {S}, {X}/{Y}/{Z}.
  if (/^[WUBRGCSXYZ]$/.test(upper)) return `ms-${upper.toLowerCase()}`;

  if (upper.includes('/')) {
    const parts = upper.split('/');

    // Phyrexian: {W/P} — and the newer hybrid phyrexian {B/G/P}.
    if (parts[parts.length - 1] === 'P') {
      const colors = parts.slice(0, -1).join('').toLowerCase();
      return `ms-${colors} ms-p`;
    }

    // Twobrid: {2/W} — pay two generic or one coloured.
    if (parts[0] === '2') return `ms-2${parts[1]!.toLowerCase()}`;

    // Ordinary hybrid: {W/U} → ms-wu. mana-font defines one class per pair, in
    // the colour-wheel order Scryfall already uses, so joining is enough.
    return `ms-${parts.join('').toLowerCase()}`;
  }

  // Unrecognised — render as generic rather than vanishing.
  return 'ms-cost';
}
