// D397 - SPEND-RESTRICTED MANA: what a restriction lets the mana pay for, decided here
// and nowhere else.
//
// "Spend this mana only to cast creature spells" (Ancient Ziggurat), "... only to cast
// artifact spells or activate abilities of artifacts" (Vedalken Engineer), "... only to
// activate abilities" (Omen Hawker), "... only to cast colorless Eldrazi spells or
// activate abilities of colorless Eldrazi" (Eldrazi Temple). Before D397 every such line
// was `conditional`: excluded from auto-tap, tapped by hand, the restriction the player's
// - and the accounting refused the card, because a bot would spend the mana on anything.
//
// The payment path now asks with a PURPOSE - the spell being cast, the source whose
// ability is being activated, or `other` - and `fitFor` (`payment.ts`) subtracts every
// pool bucket and drops every source whose restriction the purpose does not fit BEFORE
// the solver runs. The three tiers and the min-cost max-flow are untouched, exactly as
// D364's snow reservation left them.
//
// ⚠️ A purpose is CHARACTERISTICS, not a card: the client previews a payment from a
// `PlayerView` (D53 - the same solver on the same input, so a player never approves one
// payment and is charged another), and a face in the hand has no derived permanent. A
// spell's characteristics are its face's - devoid making it colourless (CR 702.116a) -
// and a face-down spell's are a colourless creature's with no name and no subtypes
// (CR 708.2). An ability's are its SOURCE'S, derived when it stands on the battlefield.
//
// ⚠️ `other` fits NO restriction: a ward tax, a "pay {2} or sacrifice" prompt, a morph
// turned face up, a cumulative upkeep. Restricted mana never pays for those, which is
// what the card says, and the default any caller that does not think about it gets.
import type { ColorLetter } from '../data/cardTypes';
import { subPool, type ManaPool, type RestrictedMana, type SpendConjunction, type SpendRestriction, type SpendTerm } from './types/mana';
import type { OracleFace, ParsedTypeLine } from './types/oracle';

export interface SpendPurpose {
  readonly kind: 'spell' | 'ability' | 'other';
  readonly types: readonly string[];
  readonly subtypes: readonly string[];
  readonly supertypes: readonly string[];
  readonly colors: readonly ColorLetter[];
}

const NONE: readonly never[] = [];

/** A payment that is neither a spell nor an ability's activation: no restricted mana fits it. */
export const OTHER_PURPOSE: SpendPurpose = { kind: 'other', types: NONE, subtypes: NONE, supertypes: NONE, colors: NONE };

/** A face's colours as a spell has them: devoid is colourless (CR 702.116a). */
export function faceColors(face: OracleFace): readonly ColorLetter[] {
  return face.keywords.includes('devoid') ? NONE : face.colors;
}

/** The spell a face is cast as - or, face down, a colourless creature with no subtypes (CR 708.2). */
export function spellPurpose(face: OracleFace, faceDown: boolean): SpendPurpose {
  if (faceDown) return { kind: 'spell', types: ['Creature'], subtypes: NONE, supertypes: NONE, colors: NONE };
  return { kind: 'spell', types: face.typeLine.types, subtypes: face.typeLine.subtypes, supertypes: face.typeLine.supertypes, colors: faceColors(face) };
}

/** An ability of a source with these characteristics - a derived permanent's, or a face's in hand. */
export function abilityPurpose(typeLine: ParsedTypeLine, colors: readonly ColorLetter[]): SpendPurpose {
  return { kind: 'ability', types: typeLine.types, subtypes: typeLine.subtypes, supertypes: typeLine.supertypes, colors };
}

function termHolds(term: SpendTerm, p: SpendPurpose): boolean {
  switch (term.kind) {
    case 'type':
      return p.types.includes(term.value);
    case 'subtype':
      return p.subtypes.includes(term.value);
    case 'supertype':
      return p.supertypes.includes(term.value);
    case 'colorless':
      return p.colors.length === 0;
    case 'multicolored':
      return p.colors.length >= 2;
    case 'monocolored':
      return p.colors.length === 1;
  }
}

function anyAlternative(alts: readonly SpendConjunction[] | null, p: SpendPurpose): boolean {
  if (alts === null) return false;
  return alts.some((conj) => conj.every((term) => termHolds(term, p)));
}

/** May mana under this restriction be spent on this purpose? */
export function restrictionAllows(r: SpendRestriction, p: SpendPurpose): boolean {
  if (p.kind === 'spell') return anyAlternative(r.spells, p);
  if (p.kind === 'ability') return anyAlternative(r.abilities, p);
  return false;
}

/** The buckets whose restriction this purpose fits, in pool order. */
export function bucketsFitting(buckets: readonly RestrictedMana[], p: SpendPurpose): readonly RestrictedMana[] {
  return buckets.filter((b) => restrictionAllows(b.restriction, p));
}

/** The pool MINUS every bucket this purpose does not fit: what a payment for it may draw on. */
export function fitPool(pool: ManaPool, buckets: readonly RestrictedMana[], p: SpendPurpose): ManaPool {
  let out = pool;
  for (const b of buckets) if (!restrictionAllows(b.restriction, p)) out = subPool(out, b.mana);
  return out;
}

/**
 * Of a spend, what came out of the FITTING buckets - restricted mana first, in bucket
 * order, the rest of the spend from the unrestricted pool. Restricted mana is the least
 * flexible mana a player holds, so a spend that can use it does, and the general mana
 * stays for whatever comes next. Buckets a spend does not touch are not listed.
 */
export function restrictedOfSpend(spend: ManaPool, fitting: readonly RestrictedMana[]): readonly RestrictedMana[] {
  const out: RestrictedMana[] = [];
  const left: Record<keyof ManaPool, number> = { ...spend };
  for (const b of fitting) {
    const take: Record<keyof ManaPool, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    let any = 0;
    for (const k of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
      take[k] = Math.min(left[k], b.mana[k]);
      left[k] -= take[k];
      any += take[k];
    }
    if (any > 0) out.push({ restriction: b.restriction, mana: take });
  }
  return out;
}
