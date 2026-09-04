// D312 - THE COST-REDUCTION SEAM (generic reductions). The printed lines the
// engine can price at cast time from the board alone, with no decision from
// anybody: "Affinity for <permanents>" (CR 702.41a), "This spell costs {N}
// less to cast for each <permanent> you control", "... for each <type> card
// in your graveyard", "... if you control a <permanent>". Each parses to a
// `CostReduction` the engine folds into the cast's generic part (CR 601.2f);
// anything else (a colour, a memory of this turn, a target) stays unparsed and
// Tier 3 by name. `line` is the reminder-stripped printed line the accounting
// matches.

import type { PermanentPredicate } from './replacementParse';
import { predicatesOf } from './replacementParse';

export type CostReduction =
  | { readonly kind: 'affinity'; readonly line: string; readonly per: readonly PermanentPredicate[] }
  | { readonly kind: 'perControl'; readonly line: string; readonly amount: number; readonly per: readonly PermanentPredicate[] }
  | { readonly kind: 'perGraveyard'; readonly line: string; readonly amount: number; readonly types: readonly string[] }
  | { readonly kind: 'ifControl'; readonly line: string; readonly amount: number; readonly any: readonly PermanentPredicate[] };

/** Plural nouns whose singular is not "drop the s". Lower-case keys. */
const PLURALS: Readonly<Record<string, string>> = {
  equipment: 'Equipment',
  allies: 'Ally',
  elves: 'Elf',
  dwarves: 'Dwarf',
  wolves: 'Wolf',
  thopters: 'Thopter',
};

function singular(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  const last = words[words.length - 1] ?? '';
  const lower = last.toLowerCase();
  const one = PLURALS[lower] ?? (lower.endsWith('ies') ? last.slice(0, -3) + 'y' : lower.endsWith('s') && !lower.endsWith('ss') ? last.slice(0, -1) : last);
  words[words.length - 1] = one;
  return words.join(' ');
}

const GRAVEYARD_TYPES: Readonly<Record<string, readonly string[]>> = {
  creature: ['Creature'],
  instant: ['Instant'],
  sorcery: ['Sorcery'],
  'instant and sorcery': ['Instant', 'Sorcery'],
  'instant or sorcery': ['Instant', 'Sorcery'],
  land: ['Land'],
  artifact: ['Artifact'],
  enchantment: ['Enchantment'],
  planeswalker: ['Planeswalker'],
};

/** One printed line as a reduction the engine prices, or null. */
export function parseCostReductionLine(raw: string): CostReduction | null {
  const line = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const aff = /^Affinity for (.+)$/.exec(line);
  if (aff) {
    const per = predicatesOf(singular(aff[1] ?? ''));
    return per ? { kind: 'affinity', line, per } : null;
  }
  const m = /^This spell costs \{(\d+)\} less to cast (.+)\.$/.exec(line);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  const tail = (m[2] ?? '').trim();
  const each = /^for each (.+) you control$/.exec(tail);
  if (each) {
    const per = predicatesOf(each[1] ?? '');
    return per ? { kind: 'perControl', line, amount, per } : null;
  }
  const grave = /^for each (.+) card in your graveyard$/.exec(tail);
  if (grave) {
    const types = GRAVEYARD_TYPES[(grave[1] ?? '').toLowerCase()];
    return types ? { kind: 'perGraveyard', line, amount, types } : null;
  }
  const control = /^if you control an? (.+)$/.exec(tail);
  if (control) {
    const any = predicatesOf(control[1] ?? '');
    return any ? { kind: 'ifControl', line, amount, any } : null;
  }
  return null;
}

/** Every reduction line of a face's text, in print order. */
export function parseCostReductions(oracleText: string): readonly CostReduction[] {
  const out: CostReduction[] = [];
  for (const raw of (oracleText ?? '').split('\n')) {
    const r = parseCostReductionLine(raw);
    if (r) out.push(r);
  }
  return out;
}
