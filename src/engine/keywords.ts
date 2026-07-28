// Scryfall's `keywords[]` → our Tier-2 keyword union.
//
// ⚠️ Scryfall's array is the source, NOT the oracle text. Wizards' own keyword
// tagging is complete and stable across rewordings, whereas a regex over oracle
// text finds "flying" inside "Whenever a creature with flying attacks…" and
// grants it to the wrong card. The one place we do read text is landwalk and
// protection, because Scryfall lists those as bare `"Landwalk"` /
// `"Protection"` without saying *which* — and the which is the entire rule.

import type { Keyword } from './types/oracle';

/** Scryfall spelling → ours. Absent means "not a Tier-2 keyword". */
const CANON: Readonly<Record<string, Keyword>> = {
  flying: 'flying',
  reach: 'reach',
  trample: 'trample',
  vigilance: 'vigilance',
  haste: 'haste',
  lifelink: 'lifelink',
  deathtouch: 'deathtouch',
  'first strike': 'firstStrike',
  'double strike': 'doubleStrike',
  menace: 'menace',
  defender: 'defender',
  indestructible: 'indestructible',
  flash: 'flash',
  fear: 'fear',
  intimidate: 'intimidate',
  skulk: 'skulk',
  shadow: 'shadow',
  horsemanship: 'horsemanship',
  hexproof: 'hexproof',
  shroud: 'shroud',
  // ⚠️ M5 (D68). All three change what combat damage DOES rather than who may be
  // blocked by whom, which is why they land here rather than in COMBAT_KEYWORDS
  // below — that set is the derive cache's "only matters on the battlefield"
  // filter, and these matter at the moment damage is dealt.
  infect: 'infect',
  wither: 'wither',
  toxic: 'toxic',
};

export function canonicalKeyword(raw: string): Keyword | null {
  return CANON[raw.trim().toLowerCase()] ?? null;
}

/**
 * `Toxic N` → N.
 *
 * ⚠️ Scryfall reports a bare `"Toxic"` with no amount, exactly as it does for
 * Landwalk and Protection, so the number comes from the text. Returns 0 when the
 * card has no toxic — and 0 is also the honest answer for a card whose toxic
 * amount we could not read, because a toxic of 0 adds no counters and therefore
 * enforces nothing rather than enforcing something wrong.
 */
export function parseToxic(oracleText: string): number {
  const m = /\btoxic\s+(\d+)\b/i.exec(oracleText ?? '');
  if (!m?.[1]) return 0;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * The land types a creature has landwalk for.
 *
 * Scryfall reports the keyword as `"Landwalk"` with no type, so the types have
 * to come from the text. `plainswalk` → `Plains`, and the non-basic forms
 * (`Legendary landwalk`, `Desertwalk`, `Snow landwalk`) are matched too because
 * they are the same rule with a different predicate.
 */
const LANDWALK_TYPES: readonly [RegExp, string][] = [
  [/\bplainswalk\b/i, 'Plains'],
  [/\bislandwalk\b/i, 'Island'],
  [/\bswampwalk\b/i, 'Swamp'],
  [/\bmountainwalk\b/i, 'Mountain'],
  [/\bforestwalk\b/i, 'Forest'],
  [/\bdesertwalk\b/i, 'Desert'],
  [/\blegendary landwalk\b/i, 'Legendary'],
  [/\bsnow landwalk\b/i, 'Snow'],
];

export function parseLandwalk(oracleText: string): string[] {
  const out: string[] = [];
  for (const [re, type] of LANDWALK_TYPES) if (re.test(oracleText)) out.push(type);
  return out;
}

/** Keywords that only matter on the battlefield, for the derive cache. */
export const COMBAT_KEYWORDS: ReadonlySet<Keyword> = new Set<Keyword>([
  'flying',
  'reach',
  'trample',
  'vigilance',
  'menace',
  'defender',
  'fear',
  'intimidate',
  'skulk',
  'shadow',
  'horsemanship',
]);
