// D356 — ONE PREDICATE FOR PROTECTION, consulted everywhere the rule applies.
//
// CR 702.16b: protection from a quality means the object can't be Damaged, Enchanted or Equipped,
// Blocked, or Targeted by anything with that quality — DEBT, the four letters players learn it by.
// The engine checks three of those four (block, damage, target) plus the Aura fall-off, and until
// this file each site spelled the test itself:
//
//     if (c.protection.fromEverything) return true;
//     if (c.protection.colors.some((col) => src.colors.includes(col))) return true;
//
// Five copies, all colour-only. Adding a card type to one of them and not the others would be a
// rule that applies when a creature blocks and not when it is targeted — which is not a rule at all.
// So the test lives here once and the sites ask it.
import type { ColorLetter } from '../data/cardTypes';
import type { ParsedTypeLine, Protection } from './types/oracle';

/**
 * What a protection clause is asked ABOUT: the source's colours, and its type line where the caller
 * has one.
 *
 * ⚠️ `typeLine` is OPTIONAL and its absence is not "no types" — it is "this caller cannot say". A
 * caller without one gets the colour and category answers and no type or subtype answer, which is
 * the same coverage the engine had before this file. Filling it in is how a site is upgraded.
 */
export interface ProtectionSource {
  readonly colors: readonly ColorLetter[];
  readonly typeLine?: ParsedTypeLine | undefined;
}

/**
 * D356 — a printed plural against a stored singular.
 *
 * ⚠️ MATCHED, NOT DERIVED. A card prints `protection from Werewolves` and the engine stores the
 * subtype `Werewolf`; `protection from Elves` stores `Elf`. A rule that appended an `s` would miss
 * both, enforce nothing, and — worse — report itself as enforced, which is the one failure mode
 * `Protection.other` exists to prevent. The forms below are the closed set English actually uses for
 * creature types, and `protection.test.ts` pins every subtype the cards in this batch name.
 */
function pluralMatches(printed: string, stored: string): boolean {
  const p = printed.toLowerCase();
  const s = stored.toLowerCase();
  if (p === s) return true;
  if (p === s + 's') return true;
  if (p === s + 'es') return true;
  if (s.endsWith('y') && p === s.slice(0, -1) + 'ies') return true;
  if (s.endsWith('f') && p === s.slice(0, -1) + 'ves') return true;
  if (s.endsWith('fe') && p === s.slice(0, -2) + 'ves') return true;
  return false;
}

/** Does `p` protect its bearer from `src`? */
export function protectedFrom(p: Protection, src: ProtectionSource): boolean {
  if (p.fromEverything) return true;
  if (p.colors.some((c) => src.colors.includes(c))) return true;

  for (const category of p.categories ?? []) {
    const n = src.colors.length;
    if (category === 'multicolored' && n > 1) return true;
    if (category === 'monocolored' && n === 1) return true;
    if (category === 'colorless' && n === 0) return true;
  }

  const tl = src.typeLine;
  if (!tl) return false;
  if ((p.types ?? []).some((t) => tl.types.includes(t))) return true;
  // ⚠️ Subtypes are compared against the printed plural, and against the SUPERTYPES too: a card may
  // print `protection from legendary creatures`, and Legendary is stored where subtypes are not.
  if ((p.subtypes ?? []).some((printed) => tl.subtypes.some((st) => pluralMatches(printed, st)) || tl.supertypes.some((st) => pluralMatches(printed, st)))) {
    return true;
  }
  return false;
}

/** True when this protection is entirely enforceable — nothing left in `other`. */
export function protectionFullyRead(p: Protection): boolean {
  return (
    p.other.length === 0 &&
    (p.fromEverything ||
      p.colors.length > 0 ||
      (p.types ?? []).length > 0 ||
      (p.subtypes ?? []).length > 0 ||
      (p.categories ?? []).length > 0)
  );
}
