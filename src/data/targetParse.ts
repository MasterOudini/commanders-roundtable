// What a card can be pointed at — the target clauses, parsed once at ingest.
//
// ⚠️ THE GOVERNING ASYMMETRY, and every judgement call below follows from it:
// an unread restriction may only ever ALLOW an illegal choice, never BLOCK a
// legal one. Narrowing `target nonblack creature` to `creature` lets a player
// point at something the card forbids — annoying, and their own read of the card
// catches it. Getting the KIND wrong, or inventing a requirement that is not
// there, makes a legal play impossible and the app simply looks broken. So every
// ambiguity resolves to `FREE_TARGET`: aim at anything, `min: 0`, and say on the
// card that the app is not checking.
//
// ⚠️ This is a Tier-2 boundary file in the same sense `oracleParse.ts` is: a
// clause it does not read is a clause the engine does not enforce, and
// `tier3.ts` asks THIS module what it understood rather than running a second
// regex of its own. See the Command Tower note in `tier3.ts` for why a second
// heuristic beside the first is how a disclosure starts lying.
//
// The measured shape of the problem, over the real 113,559-card database:
// `target creature` dwarfs everything (14,666), then `target player` (3,113),
// `any target` (3,009), `target opponent` (2,066). Roughly thirty templates plus
// a count prefix and a controller suffix covers the overwhelming majority, and
// the tail is long, flat and not worth guessing at.

import type {
  NumericRestriction,
  TargetAlternative,
  TargetController,
  TargetKind,
  TargetSpec,
  TargetZone,
} from '../engine/types/oracle';
import { FREE_TARGET, KEYWORD_SET } from '../engine/types/oracle';
import type { CombatRole, Keyword, KeywordRestriction, TargetRestrictions } from '../engine/types/oracle';
/** The colour letter type, derived — `types/oracle` keeps it local (as D283 found). */
type ColorLetter = NonNullable<TargetRestrictions['colorsAny']>[number];
// ⚠️ Type-only, and deliberately so: `oracleParse` imports THIS module, so a
// value import would close a runtime cycle. Types are erased, so this is not one.
import type { Warn } from './oracleParse';

const NOOP_WARN: Warn = () => undefined;

// ── scrubbing ────────────────────────────────────────────────────────────────

/**
 * Blank out reminder text and quoted text, KEEPING EVERY INDEX.
 *
 * ⚠️ Same-length spaces rather than deletion, so an index into the scrubbed
 * string still indexes the original. That is what lets `TargetSpec.text` be a
 * verbatim slice of what is actually printed while all the matching runs on the
 * clean copy.
 *
 * ⚠️ Both exclusions have a measured card behind them.
 * REMINDER TEXT: `Lightning Greaves` reads `(It can't be the target of spells or
 * abilities.)` and Equip/Cycling spell out a whole `{0}: Attach to target
 * creature you control.` inside parentheses — 790 + 495 occurrences of that shape
 * alone. Parsing it invents a target requirement on a card that has none.
 * QUOTED TEXT: it is an ability the card GRANTS TO SOMETHING ELSE, not one it
 * has. This is the Teferi bug `parseWard` already documents — `You get an emblem
 * with "…"` made the card itself look warded.
 */
export function scrub(text: string): string {
  const blanked = (m: string): string => ' '.repeat(m.length);
  return text.replace(/\([^)]*\)/g, blanked).replace(/[“"][^”"]*[”"]/g, blanked);
}

// ── lines ────────────────────────────────────────────────────────────────────

export type AbilityLineKind = 'spell' | 'activated' | 'triggered' | 'static' | 'reminder';

export interface AbilityLine {
  /** Verbatim, un-scrubbed. */
  readonly text: string;
  readonly kind: AbilityLineKind;
  /** Left of the colon, for an activated line. Empty otherwise. */
  readonly costText: string;
  /** Right of the colon, for an activated line. The whole line otherwise. */
  readonly effectText: string;
  /** Index into `oracleText.split('\n')`, so mana abilities can be matched by line. */
  readonly index: number;
}

const TRIGGER_RE = /^(When|Whenever|At the beginning|At end of)\b/i;
/** A plausible activation cost is short and sits before any sentence break. */
const MAX_COST_LEN = 60;

/**
 * Split a face's text into lines and say what each one is.
 *
 * ⚠️ This is what makes multi-`target` cards tractable. 5,789 faces contain two
 * or more occurrences of the word, and most of them are one spell clause plus one
 * ability clause on a DIFFERENT line: `Prodigal Sorcerer` has one clause and it
 * belongs to its ability, not to casting it. Parsing a face as one blob would ask
 * a player to aim a creature spell.
 */
export function splitAbilityLines(text: string, isPermanentSpell = false): AbilityLine[] {
  const out: AbilityLine[] = [];
  for (const [index, raw] of (text ?? '').split('\n').entries()) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('(') && line.endsWith(')')) {
      out.push({ text: line, kind: 'reminder', costText: '', effectText: line, index });
      continue;
    }
    if (TRIGGER_RE.test(line)) {
      out.push({ text: line, kind: 'triggered', costText: '', effectText: line, index });
      continue;
    }
    // An activated ability is `cost: effect`, and the colon has to come before
    // any sentence break or "Choose one — - Destroy target..." reads as a cost.
    // ⚠️ The length cap exists for PROSE colons, and prose never opens with a
    // brace — so a line that STARTS with a mana/tap symbol is a cost line at
    // any length (D159). War Room's cost is 82 characters: `{3}, {T}, Pay life
    // equal to the number of colors in your commanders' color identity`.
    const colon = line.indexOf(':');
    const stop = line.search(/[.;]/);
    const costLike = colon <= MAX_COST_LEN || line.startsWith('{');
    if (colon > 0 && costLike && (stop < 0 || colon < stop)) {
      out.push({
        text: line,
        kind: 'activated',
        costText: line.slice(0, colon).trim(),
        effectText: line.slice(colon + 1).trim(),
        index,
      });
      continue;
    }
    out.push({
      text: line,
      kind: isPermanentSpell ? 'static' : 'spell',
      costText: '',
      effectText: line,
      index,
    });
  }
  return out;
}

// ── false positives ──────────────────────────────────────────────────────────

/**
 * Uses of the word that are NOT a target requirement.
 *
 * Measured over the whole database: `target of` 1,242 · `targets for` 806 ·
 * `targets a` 184 · `targets of` 123 · `targets this` 97 · `targets only` 84.
 * These are "becomes the target of", "can't be the target of", "this spell
 * targets only…", "whenever a player targets a creature you control".
 *
 * ⚠️ Tested PER OCCURRENCE, never per sentence. `Change the target of target
 * spell` contains a false positive and a real clause in the same breath.
 */
const FP_AFTER = /^(?:s?\s+(?:of|for)\b|s\s+(?:a|an|only|the|this|it|they|any|exactly|another)\b)/i;
const FP_BEFORE = /\b(?:the|a|an|another|new|same|each|any|no|its|their)\s+$/i;
const FP_CANT_BE = /\bcan(?:'|’)?t\s+be\s+(?:the\s+)?$/i;

// ── counts ───────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function wordCount(word: string): number | null {
  const key = word.toLowerCase();
  if (key in NUMBER_WORDS) return NUMBER_WORDS[key] ?? null;
  if (/^\d+$/.test(key)) return Number(key);
  return null;
}

interface CountResult {
  readonly min: number;
  readonly max: number;
  /** Where the printed clause starts, so `text` can include "up to two". */
  readonly start: number;
  readonly confident: boolean;
  readonly unenforced: readonly string[];
  readonly warn: string | null;
}

const COUNT_WINDOW = 32;

/**
 * Read the count that precedes a `target` occurrence, scanning BACKWARDS.
 *
 * `up to two target creatures` → 0..2 · `two target creatures` → 2..2 ·
 * bare → 1..1 (about four clauses in five) · `X target creatures` → free on
 * count, because X is not known at parse time and there is no way to feed
 * `pendingCast.xValue` back into a spec.
 */
function readCount(before: string, at: number): CountResult {
  const window = before.slice(Math.max(0, at - COUNT_WINDOW), at);

  // ⚠️ "up to one OTHER target creature" (D288): the word between the count
  // and "target" is admitted so the count reads 0..N. "other" is NOT an
  // unenforced word: `validateTargets` refuses the same choice twice across
  // the whole declaration, every clause included, so the second pick can
  // never be the first — the restriction holds by construction. That is
  // exact for a spell, where "other" can only point at an earlier target of
  // the same spell; on a permanent's ability it can mean "not this
  // permanent", which a script claiming that line keeps out itself (the
  // "another" branch below says the same of its word).
  const upTo = window.match(/\bup\s+to\s+(\w+)\s+(?:other\s+)?$/i);
  if (upTo) {
    const raw = upTo[1] ?? '';
    const n = wordCount(raw);
    const start = at - (upTo[0]?.length ?? 0);
    if (n === null) {
      // `up to X target creatures` — a real count we cannot know yet.
      return { min: 0, max: 99, start, confident: false, unenforced: [], warn: 'target:unparsedCount' };
    }
    return { min: 0, max: n, start, confident: true, unenforced: [], warn: null };
  }

  const anyNumber = window.match(/\bany\s+number\s+of\s+$/i);
  if (anyNumber) {
    return {
      min: 0,
      max: 99,
      start: at - (anyNumber[0]?.length ?? 0),
      confident: true,
      unenforced: [],
      warn: null,
    };
  }

  // `each of up to two target creatures` is handled by the `up to` branch above;
  // a bare `each target` is a distribution the engine does not model.
  const each = window.match(/\beach\s+$/i);
  if (each) {
    return {
      min: 0,
      max: 99,
      start: at - (each[0]?.length ?? 0),
      confident: false,
      unenforced: [],
      warn: 'target:unparsedCount',
    };
  }

  const plain = window.match(/\b(\w+)\s+$/i);
  if (plain) {
    const raw = plain[1] ?? '';
    const n = wordCount(raw);
    if (n !== null) {
      return { min: n, max: n, start: at - (plain[0]?.length ?? 0), confident: true, unenforced: [], warn: null };
    }
    if (/^x$/i.test(raw)) {
      return {
        min: 0,
        max: 99,
        start: at - (plain[0]?.length ?? 0),
        confident: false,
        unenforced: [],
        warn: 'target:unparsedCount',
      };
    }
    if (/^another$/i.test(raw)) {
      // The engine cannot exclude the source from the candidate list, so the
      // count is right and the "another" is not enforced.
      return {
        min: 1,
        max: 1,
        start: at - (plain[0]?.length ?? 0),
        confident: true,
        unenforced: ['another'],
        warn: null,
      };
    }
  }

  return { min: 1, max: 1, start: at, confident: true, unenforced: [], warn: null };
}

// ── the noun table ───────────────────────────────────────────────────────────

// ── the adjectives the engine ENFORCES (D294) ──────────────────────────

interface MutableRestrict {
  colorsAny: ColorLetter[];
  colorsNone: ColorLetter[];
  colorCount: 'zero' | 'one' | 'many' | null;
  typesNone: string[];
  supertypesAny: string[];
  supertypesNone: string[];
  tapped: boolean | null;
  token: boolean | null;
  subtypesAll: string[];
  subtypesNone: string[];
}

const COLOR_WORD: Readonly<Record<string, ColorLetter>> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
const TYPE_WORD: Readonly<Record<string, string>> = { artifact: 'Artifact', creature: 'Creature', enchantment: 'Enchantment', land: 'Land', planeswalker: 'Planeswalker', battle: 'Battle' };

function emptyRestrict(): MutableRestrict {
  return { colorsAny: [], colorsNone: [], colorCount: null, typesNone: [], supertypesAny: [], supertypesNone: [], tapped: null, token: null, subtypesAll: [], subtypesNone: [] };
}

/**
 * Absorb one printed adjective into the restriction the engine will check.
 * Returns false for a word the engine cannot check yet ("modified", "historic",
 * "enchanted", "other" ...), which stays in `unenforced` exactly as before.
 */
function absorbAdjective(r: MutableRestrict, raw: string): boolean {
  const w = raw.toLowerCase().replace('colourless', 'colorless').replace('multicoloured', 'multicolored');
  if (COLOR_WORD[w]) {
    r.colorsAny.push(COLOR_WORD[w] as ColorLetter);
    return true;
  }
  if (w === 'colorless') {
    r.colorCount = 'zero';
    return true;
  }
  if (w === 'multicolored') {
    r.colorCount = 'many';
    return true;
  }
  if (w === 'monocolored') {
    r.colorCount = 'one';
    return true;
  }
  if (w === 'tapped' || w === 'untapped') {
    r.tapped = w === 'tapped';
    return true;
  }
  if (w === 'token' || w === 'nontoken') {
    r.token = w === 'token';
    return true;
  }
  if (w === 'legendary' || w === 'basic' || w === 'snow') {
    r.supertypesAny.push(w.charAt(0).toUpperCase() + w.slice(1));
    return true;
  }
  // D297: the HYPHENATED negation is always a subtype in print ("non-Elf",
  // "non-Human", "non-Aura"; types and colours print unhyphenated), and the
  // candidate carries its derived subtypes - enforced, capitalised as printed.
  const hy = raw.match(/^non-([A-Za-z]+)$/);
  if (hy) {
    const base = (hy[1] ?? '').toLowerCase();
    // "outlaw" (and "party") are BATCH words for several subtypes, not a subtype
    // - as a subtype exclusion they would enforce nothing; they stay recorded.
    const batchWord = base === 'outlaw' || base === 'outlaws' || base === 'party';
    if (!batchWord && !COLOR_WORD[base] && !TYPE_WORD[base] && base !== 'legendary' && base !== 'basic' && base !== 'snow' && base !== 'token') {
      const sub = hy[1] ?? '';
      r.subtypesNone.push(sub.charAt(0).toUpperCase() + sub.slice(1));
      return true;
    }
  }
  const neg = w.match(/^non-?(\w+)$/);
  if (neg) {
    const base = neg[1] ?? '';
    if (COLOR_WORD[base]) {
      r.colorsNone.push(COLOR_WORD[base] as ColorLetter);
      return true;
    }
    if (TYPE_WORD[base]) {
      r.typesNone.push(TYPE_WORD[base] as string);
      return true;
    }
    if (base === 'legendary' || base === 'basic' || base === 'snow') {
      r.supertypesNone.push(base.charAt(0).toUpperCase() + base.slice(1));
      return true;
    }
  }
  return false;
}

/** The immutable restriction, merged with a noun entry's own, or null when nothing was absorbed. */
function finishRestrict(r: MutableRestrict, entry: TargetRestrictions | undefined): TargetRestrictions | null {
  const out: {
    colorsAny?: readonly ColorLetter[];
    colorsNone?: readonly ColorLetter[];
    colorCount?: 'zero' | 'one' | 'many';
    typesNone?: readonly string[];
    supertypesAny?: readonly string[];
    supertypesNone?: readonly string[];
    tapped?: boolean;
    token?: boolean;
    subtypesAll?: readonly string[];
    subtypesNone?: readonly string[];
  } = { ...(entry ?? {}) };
  if (r.colorsAny.length > 0) out.colorsAny = [...(out.colorsAny ?? []), ...r.colorsAny];
  if (r.colorsNone.length > 0) out.colorsNone = [...(out.colorsNone ?? []), ...r.colorsNone];
  if (r.colorCount !== null) out.colorCount = r.colorCount;
  if (r.typesNone.length > 0) out.typesNone = [...(out.typesNone ?? []), ...r.typesNone];
  if (r.supertypesAny.length > 0) out.supertypesAny = [...(out.supertypesAny ?? []), ...r.supertypesAny];
  if (r.supertypesNone.length > 0) out.supertypesNone = [...(out.supertypesNone ?? []), ...r.supertypesNone];
  if (r.tapped !== null) out.tapped = r.tapped;
  if (r.token !== null) out.token = r.token;
  if (r.subtypesAll.length > 0) out.subtypesAll = [...(out.subtypesAll ?? []), ...r.subtypesAll];
  if (r.subtypesNone.length > 0) out.subtypesNone = [...(out.subtypesNone ?? []), ...r.subtypesNone];
  return Object.keys(out).length > 0 ? out : null;
}

interface NounEntry {
  /** Regex source, anchored at the start of the post-`target ` remainder. */
  readonly re: RegExp;
  readonly kinds: readonly TargetKind[];
  readonly controller?: TargetController;
  readonly zones?: readonly TargetZone[];
  /**
   * CARD TYPES this noun requires (D138). `['Creature']` for `creature card`.
   *
   * WARNING: a type named here must NOT also appear in `unenforced` — that field
   * is what `tier3.ts` prints as 'the app will not check this', and saying so
   * about something now enforced is the disclosure lying in the safe direction,
   * which is still lying.
   */
  readonly cardTypes?: readonly string[];
  /** Printed words this entry knowingly does not enforce. */
  readonly unenforced?: readonly string[];
  /** D298: the noun is "<Subtype> card"; the subtype is read off the match into `restrict.subtypesAll`. */
  readonly subtypeCard?: boolean;
  /** The combat role the noun requires (D291) — enforced, so never also in `unenforced`. */
  readonly combatRole?: CombatRole;
  /** Restrictions the noun itself carries (D294) — "noncreature spell" is a spell that is not a creature. */
  readonly restrict?: TargetRestrictions;
}

/** Optional plural, so `target creatures` matches `creature`. */
const s = '(?:s)?';

/**
 * ⚠️ LONGEST MATCH FIRST. The frequency table I measured counts SUBSTRINGS —
 * `target creature` (14,666) includes every `target creature you control` — so an
 * order that put the bare noun first would swallow the compound forms and report
 * coverage it does not have.
 */
const NOUNS: readonly NounEntry[] = [
  // ⚠️ TYPED SPELLS FIRST, or the permanent compounds below eat the type list
  // and silently DROP the word "spell" — measured (D198): "target artifact or
  // enchantment spell" parsed confident to battlefield kinds
  // ['artifact','enchantment'], so Annul's aim veil offered PERMANENTS for a
  // counterspell. The type is ENFORCED: stack candidates carry the cast face's
  // card types (both adapters), and `targetAllowed` checks `cardTypes` the same
  // way it does for graveyard nouns (D138).
  { re: new RegExp(`^artifact\\s+or\\s+enchantment\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Artifact', 'Enchantment'] },
  { re: new RegExp(`^artifact\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Artifact'] },
  { re: new RegExp(`^enchantment\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Enchantment'] },

  // compound kinds
  { re: new RegExp(`^creature${s}\\s+or\\s+planeswalker${s}\\b`, 'i'), kinds: ['creature', 'planeswalker'] },
  // D293: "target spell or creature" — a spell on the stack or a creature permanent.
  { re: new RegExp(`^spell${s}\\s+or\\s+creature${s}\\b`, 'i'), kinds: ['spell', 'creature'] },
  { re: new RegExp(`^creature${s}\\s+or\\s+player${s}\\b`, 'i'), kinds: ['creature', 'player'] },
  { re: new RegExp(`^player${s}\\s+or\\s+planeswalker${s}\\b`, 'i'), kinds: ['player', 'planeswalker'] },
  { re: new RegExp(`^opponent${s}\\s+or\\s+planeswalker${s}\\b`, 'i'), kinds: ['player', 'planeswalker'], controller: 'opponent' },
  { re: new RegExp(`^permanent${s}\\s+or\\s+player${s}\\b`, 'i'), kinds: ['permanent', 'player'] },
  { re: new RegExp(`^artifact${s}\\s+or\\s+enchantment${s}\\b`, 'i'), kinds: ['artifact', 'enchantment'] },
  { re: new RegExp(`^artifact${s}\\s+or\\s+creature${s}\\b`, 'i'), kinds: ['artifact', 'creature'] },
  { re: new RegExp(`^creature${s}\\s+or\\s+enchantment${s}\\b`, 'i'), kinds: ['creature', 'enchantment'] },
  { re: new RegExp(`^creature${s}\\s+or\\s+artifact${s}\\b`, 'i'), kinds: ['creature', 'artifact'] },
  { re: new RegExp(`^enchantment${s}\\s+or\\s+land${s}\\b`, 'i'), kinds: ['enchantment', 'land'] },
  // D207: `Demolish`'s own test caught this one MISSING — the bare
  // `artifact` entry matched the prefix and the ` or land` fell off a spec
  // still claiming confidence, so the aim veil refused a LAND for a spell
  // whose whole point is hitting lands. The compound sits with its family.
  { re: new RegExp(`^artifact${s}\\s+or\\s+land${s}\\b`, 'i'), kinds: ['artifact', 'land'] },
  // D213: `Fissure`'s test caught the CREATURE twin of D207's hole — the
  // same silent halving one noun over.
  { re: new RegExp(`^creature${s}\\s+or\\s+land${s}\\b`, 'i'), kinds: ['creature', 'land'] },
  // `Icy Manipulator`: a comma-or list.
  { re: new RegExp(`^artifact,\\s*creature,\\s*or\\s+land${s}\\b`, 'i'), kinds: ['artifact', 'creature', 'land'] },
  { re: new RegExp(`^artifact,\\s*enchantment,\\s*or\\s+land${s}\\b`, 'i'), kinds: ['artifact', 'enchantment', 'land'] },
  // D199: two more of Icy's shape — `Bedevil` (ledgered since D192 as the
  // noun-list class) and `Banishment Decree` print them whole.
  // ⚠️ D293: the lists the format prints and the table did not read (measured by
  // the D292 probe: 11 + 5 + 3 + 1 spells). Longest first; a list whose
  // alternatives carry a subtype or an unenforced adjective is NOT here.
  { re: new RegExp(`^artifact,\\s*enchantment,\\s*or\\s+creature${s}\\b`, 'i'), kinds: ['artifact', 'enchantment', 'creature'] },
  { re: new RegExp(`^artifact,\\s*creature,\\s*or\\s+land${s}\\b`, 'i'), kinds: ['artifact', 'creature', 'land'] },
  { re: new RegExp(`^creature,\\s*planeswalker,\\s*or\\s+battle${s}\\b`, 'i'), kinds: ['creature', 'planeswalker', 'battle'] },
  { re: new RegExp(`^creature,\\s*planeswalker,\\s*or\\s+player${s}\\b`, 'i'), kinds: ['creature', 'planeswalker', 'player'] },
  { re: new RegExp(`^creature,\\s*enchantment,\\s*or\\s+planeswalker${s}\\b`, 'i'), kinds: ['creature', 'enchantment', 'planeswalker'] },
  { re: new RegExp(`^artifact,\\s*creature,\\s*or\\s+planeswalker${s}\\b`, 'i'), kinds: ['artifact', 'creature', 'planeswalker'] },
  { re: new RegExp(`^artifact,\\s*creature,\\s*or\\s+enchantment${s}\\b`, 'i'), kinds: ['artifact', 'creature', 'enchantment'] },
  // D214: `Fracture` prints the fourth Icy list — probed missing, the same
  // silent halving as the pair compounds.
  { re: new RegExp(`^artifact,\\s*enchantment,\\s*or\\s+planeswalker${s}\\b`, 'i'), kinds: ['artifact', 'enchantment', 'planeswalker'] },

  // stack objects
  // ⚠️ `cardTypes` on a spell noun is enforced against the CAST FACE's types
  // (D198): an activated or triggered ability on the stack carries none, so a
  // typed-spell clause refuses it — which is also the correct CR answer.
  { re: new RegExp(`^creature\\s+or\\s+sorcery\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Creature', 'Sorcery'] },
  { re: new RegExp(`^instant\\s+or\\s+sorcery\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Instant', 'Sorcery'] },
  { re: new RegExp(`^instant\\s+or\\s+sorcery\\s+card${s}\\b`, 'i'), kinds: ['card'], zones: ['graveyard'], cardTypes: ['Instant', 'Sorcery'] },
  { re: new RegExp(`^activated\\s+or\\s+triggered\\s+abilit(?:y|ies)\\b`, 'i'), kinds: ['spell'] },
  { re: new RegExp(`^spell${s}\\s+or\\s+abilit(?:y|ies)\\b`, 'i'), kinds: ['spell'] },
  { re: new RegExp(`^spell${s}\\s+or\\s+permanent${s}\\b`, 'i'), kinds: ['spell', 'permanent'] },
  // Enforced since D198 the way "creature card" has been since D138 — same
  // field, same predicate, one zone over. "noncreature" is ENFORCED since D294
  // (`restrict.typesNone` against the cast face's types):
  // a NEGATED type has no TargetSpec field (the D185 ledger class).
  { re: new RegExp(`^creature\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Creature'] },
  { re: new RegExp(`^noncreature\\s+spell${s}\\b`, 'i'), kinds: ['spell'], restrict: { typesNone: ['Creature'] } },
  { re: new RegExp(`^spell${s}\\b`, 'i'), kinds: ['spell'] },
  { re: new RegExp(`^abilit(?:y|ies)\\b`, 'i'), kinds: ['spell'] },

  // combat states — the kind is enforced, the state is not
  // ⚠️ ENFORCED since D291 (`TargetSpec.combatRole`, checked by `targetAllowed`
  // against the live combat), so the words leave `unenforced` — a thing now
  // checked must not stay disclosed as unchecked (the D138 rule).
  { re: new RegExp(`^attacking\\s+or\\s+blocking\\s+creature${s}\\b`, 'i'), kinds: ['creature'], combatRole: 'attackingOrBlocking' },
  { re: new RegExp(`^attacking\\s+creature${s}\\b`, 'i'), kinds: ['creature'], combatRole: 'attacking' },
  { re: new RegExp(`^blocking\\s+creature${s}\\b`, 'i'), kinds: ['creature'], combatRole: 'blocking' },

  // cards in known zones
  { re: new RegExp(`^creature\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Creature'] },
  // D298: the other typed card nouns, enforced exactly like "creature card"
  // (the type against the card in its zone). "instant or sorcery card" sits
  // above with its pair.
  { re: new RegExp(`^artifact\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Artifact'] },
  { re: new RegExp(`^enchantment\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Enchantment'] },
  { re: new RegExp(`^land\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Land'] },
  { re: new RegExp(`^planeswalker\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Planeswalker'] },
  { re: new RegExp(`^battle\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Battle'] },
  { re: new RegExp(`^instant\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Instant'] },
  { re: new RegExp(`^sorcery\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Sorcery'] },
  // ⚠️ "Permanent card" is a card of any PERMANENT type (CR 110.4a), and
  // `cardTypes` is ANY-of — so the six types ARE the restriction, exactly.
  // Until D147 this sat in `unenforced`, which is `tier3.ts`'s way of printing
  // "the app will not check this" on the card: `Zombify`-shaped reanimation
  // would accept an instant or a sorcery out of a graveyard. D138 closed the
  // same hole for "creature card" and left this as its own reportable, because
  // one type is a list of one and six is a list of six.
  {
    re: new RegExp(`^permanent\\s+card${s}\\b`, 'i'),
    kinds: ['card'],
    cardTypes: ['Artifact', 'Battle', 'Creature', 'Enchantment', 'Land', 'Planeswalker'],
  },
  // D298: a SUBTYPE card noun - capitalised in print ("Zombie card", "Goblin
  // card"; a type or an adjective never is mid-sentence) - enforced through
  // `restrict.subtypesAll` against the card's derived subtypes (D297).
  { re: new RegExp(`^[A-Z][a-z]+\\s+card${s}\\b`), kinds: ['card'], subtypeCard: true },
  { re: new RegExp(`^card${s}\\b`, 'i'), kinds: ['card'] },

  // plain kinds
  { re: new RegExp(`^creature${s}\\b`, 'i'), kinds: ['creature'] },
  { re: new RegExp(`^planeswalker${s}\\b`, 'i'), kinds: ['planeswalker'] },
  { re: new RegExp(`^battle${s}\\b`, 'i'), kinds: ['battle'] },
  // D297: "artifact creature" is a CREATURE that is an artifact - both enforced
  // (`cardTypes` of one is all-of); the bare `artifact` entry below used to read
  // only its first word.
  { re: new RegExp(`^artifact\\s+creature${s}\\b`, 'i'), kinds: ['creature'], cardTypes: ['Artifact'] },
  { re: new RegExp(`^artifact${s}\\b`, 'i'), kinds: ['artifact'] },
  { re: new RegExp(`^enchantment${s}\\b`, 'i'), kinds: ['enchantment'] },
  { re: new RegExp(`^land${s}\\b`, 'i'), kinds: ['land'] },
  { re: new RegExp(`^permanent${s}\\b`, 'i'), kinds: ['permanent'] },
  { re: new RegExp(`^opponent${s}\\b`, 'i'), kinds: ['player'], controller: 'opponent' },
  { re: new RegExp(`^player${s}\\b`, 'i'), kinds: ['player'] },

  // Common subtypes that ARE a card type underneath. Both are ENFORCED since
  // D297: the type through `kinds`, the subtype through `restrict.subtypesAll`
  // against the candidate's derived subtypes (before D297 the subtype sat in
  // `unenforced`, the same trade the adjective stripper used to make).
  //
  // ⚠️ The basic land types are here because of Auras, not spells: `Enchant
  // Forest` (Utopia Sprawl), `Enchant Mountain` (the Genju cycle) and `Enchant
  // Wall` (Animate Wall) are real Commander cards whose whole target clause is a
  // subtype. Without these they fell to free aim and, worse, tripped the
  // "a free spec never demands a target" invariant, since an Aura genuinely does.
  { re: new RegExp(`^equipment${s}\\b`, 'i'), kinds: ['artifact'], restrict: { subtypesAll: ['Equipment'] } },
  { re: new RegExp(`^vehicle${s}\\b`, 'i'), kinds: ['artifact'], restrict: { subtypesAll: ['Vehicle'] } },
  { re: new RegExp(`^aura${s}\\b`, 'i'), kinds: ['enchantment'], restrict: { subtypesAll: ['Aura'] } },
  { re: new RegExp(`^wall${s}\\b`, 'i'), kinds: ['creature'], restrict: { subtypesAll: ['Wall'] } },
  { re: new RegExp(`^plains\\b`, 'i'), kinds: ['land'], restrict: { subtypesAll: ['Plains'] } },
  { re: new RegExp(`^island${s}\\b`, 'i'), kinds: ['land'], restrict: { subtypesAll: ['Island'] } },
  { re: new RegExp(`^swamp${s}\\b`, 'i'), kinds: ['land'], restrict: { subtypesAll: ['Swamp'] } },
  { re: new RegExp(`^mountain${s}\\b`, 'i'), kinds: ['land'], restrict: { subtypesAll: ['Mountain'] } },
  { re: new RegExp(`^forest${s}\\b`, 'i'), kinds: ['land'], restrict: { subtypesAll: ['Forest'] } },
];

/**
 * Adjectives the parser can SEE and cannot CHECK. Stripped so the head noun is
 * reachable, and recorded verbatim so `tier3.ts` can say what is not enforced.
 *
 * ⚠️ NOT `attacking` or `blocking` (D291): those are the combat-role nouns'
 * first words. Listed here they were stripped BEFORE the noun table ran, so
 * the "attacking creature" entries were dead code and "attacking or blocking
 * creature" lost its first word and fell to free aim. They are enforced now
 * (`TargetSpec.combatRole`); `blocked` and `unblocked` stay unenforced.
 */
const ADJECTIVE_RE =
  // D298: a comma between two adjectives ("noncreature, nonland card") is print.
  /^(non-?\w+|tapped|untapped|legendary|basic|nonbasic|white|blue|black|red|green|colorless|colourless|multicolored|multicoloured|monocolored|face-up|face-down|token|other|snow|historic|modified|enchanted|equipped|kicked|blocked|unblocked),?\s+/i;

const CONTROLLER_WINDOW = 40;

/**
 * The DERIVED keyword a printed qualifier names, or null when it names one the
 * engine does not track (D289). "first strike" and "double strike" are the two
 * whose derived spelling differs from print; everything else is the word itself.
 */
function keywordMember(raw: string): Keyword | null {
  const w = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const member = w === 'first strike' ? 'firstStrike' : w === 'double strike' ? 'doubleStrike' : w;
  return KEYWORD_SET.has(member) ? (member as Keyword) : null;
}

interface ControllerResult {
  readonly controller: TargetController | null;
  /** The zone the clause names, when it names one (D138). */
  readonly zones: readonly TargetZone[] | null;
  /** The numeric restriction the clause names, when it names one (D139). */
  readonly numeric: NumericRestriction | null;
  /** The keyword restriction the clause names, when it names one (D289). */
  readonly keyword: KeywordRestriction | null;
  /** Where the printed clause ends. */
  readonly end: number;
}

/**
 * ⚠️ `you don't control` maps to `'opponent'` and that is EXACT in Commander:
 * there are no teammates, so "not mine" and "an opponent's" are the same set.
 */
/**
 * A controller phrase, then WHATEVER FOLLOWS IT (D290). The four controller
 * branches used to return without recursing, so "target creature you control
 * without flying" kept the controller and DROPPED the keyword — silently, the
 * D139 failure in the one ordering D289 did not cover (its keyword branch
 * recursed into a controller, not the reverse). Three D290 trigger cards hit
 * it and their refusal tests caught it. The rest of the clause is read by the
 * same reader; a second controller phrase after the first is nonsense no card
 * prints, so the first wins.
 */
function withController(controller: TargetController, rest: ControllerResult): ControllerResult {
  return { controller, zones: rest.zones, numeric: rest.numeric, keyword: rest.keyword, end: rest.end };
}

function readController(after: string, from: number): ControllerResult {
  const window = after.slice(from, from + CONTROLLER_WINDOW);
  const stop = window.search(/[.;\n]/);
  const searchable = stop >= 0 ? window.slice(0, stop) : window;

  /**
   * ⚠️ **THE ZONE PHRASE IS READ HERE, AND IT CARRIES A CONTROLLER TOO.**
   * "Return target creature card from your graveyard to your hand" names both:
   * WHICH zone (a graveyard, not exile) and WHOSE (yours, not an opponent's).
   * Before D138 neither was read, so `Raise Dead` admitted any card in ANY
   * graveyard or exile — and the type restriction sat in `unenforced` on top of
   * that, so it admitted lands as well.
   *
   * ⚠️ Checked BEFORE "you control", because a graveyard clause never says
   * "control": the plain reader would return null, consume nothing, and leave
   * the phrase to be swallowed as part of the next clause's text.
   *
   * ⚠️ "a graveyard" (Naya Charm, Pulse of Murasa) means ANY graveyard, so the
   * controller stays null rather than being narrowed to the caster. Reading it
   * as "yours" would block a legal choice, which is the one direction
   * `targetParse` is never allowed to be wrong in.
   */
  /**
   * ⚠️ **THE KEYWORD QUALIFIER (D289).** "target creature with flying" used to
   * match NOTHING in this reader: the spec ended at the noun, `text` read
   * "target creature" and `unenforced` stayed EMPTY — the D139 failure one
   * qualifier over, "not merely unenforced, dropped silently", witnessed five
   * times in the ledger (Topple, Trip Wire, Vertigo, Wing Snare, Wing
   * Puncture). Read here it becomes a structured restriction `targetAllowed`
   * checks against the candidate's DERIVED keywords, and `text` quotes the
   * card. Only a keyword the engine derives is admitted (`KEYWORD_SET`); "with
   * power 4 or greater" and "with a +1/+1 counter on it" fall through to the
   * readers below unchanged, and "with flying or reach" is left alone too — a
   * list read as its first word would REFUSE a legal reach creature, the one
   * direction this file may never be wrong in. Recurses like the others, so
   * "with flying you control" keeps both.
   */
  const kw = searchable.match(/^\s+(with|without)\s+(first strike|double strike|[a-z]+)\b(?!\s+or\b)/i);
  if (kw) {
    const word = keywordMember(kw[2] ?? '');
    if (word !== null) {
      const rest = readController(after, from + (kw[0]?.length ?? 0));
      return {
        controller: rest.controller,
        zones: rest.zones,
        numeric: rest.numeric,
        keyword: { word, present: (kw[1] ?? '').toLowerCase() === 'with' },
        end: rest.end,
      };
    }
  }

  /**
   * ⚠️ **THE NUMERIC QUALIFIER IS READ FIRST, because it comes first in print.**
   * "target creature with power 4 or greater you control" puts it between the
   * noun and the controller phrase, so a reader that looked for "you control"
   * immediately after the noun would find nothing and drop BOTH. Reading it here
   * and recursing means each qualifier consumes its own words and the rest still
   * gets its turn.
   *
   * ⚠️ It also fixes `text`. The clause's printed span runs to `end`, so before
   * this the prompt bar showed "target creature" for a card that says "target
   * creature with power 4 or greater" — the app quoting a rule the card does not
   * have.
   */
  const num = searchable.match(
    /^\s+with\s+(mana value|converted mana cost|power|toughness)\s+(\d+)\s+or\s+(less|greater|more)\b/i,
  );
  if (num) {
    const rawAttr = (num[1] ?? '').toLowerCase();
    const attr = rawAttr === 'power' || rawAttr === 'toughness' ? rawAttr : 'manaValue';
    const value = Number(num[2]);
    const cmp = (num[3] ?? '').toLowerCase() === 'less' ? 'atMost' : 'atLeast';
    const consumed = from + (num[0]?.length ?? 0);
    // Recurse, so "…with power 4 or greater YOU CONTROL" keeps both.
    const rest = readController(after, consumed);
    return {
      controller: rest.controller,
      zones: rest.zones,
      numeric: Number.isFinite(value) ? { attr, cmp, value } : null,
      keyword: rest.keyword,
      end: rest.end,
    };
  }

  const gy = searchable.match(/^\s+(?:from|in)\s+(your|a|an opponent's)\s+graveyards?\b/i);
  if (gy) {
    const whose = (gy[1] ?? '').toLowerCase();
    /**
     * ⚠️ **RECURSES, FOR THE SAME REASON THE NUMERIC BRANCH ABOVE DOES** (D140).
     * Qualifiers come in either order, and a branch that returns instead of
     * recursing silently drops whatever follows it. "target creature card IN
     * YOUR GRAVEYARD with mana value 4 or less" read the zone and threw the
     * number away — `numeric: null`, `text` truncated at "…in your graveyard" —
     * which is precisely the silent widening D139 closed for the other ordering,
     * surviving in the branch that was written first.
     *
     * ⚠️ **ONE PRINTED CARD NEEDS IT TODAY** (`Too Evil to Stay Dead`), and the
     * asymmetry is the reason to fix it rather than the card: two qualifier
     * readers that behave differently is a bug waiting for the third one.
     */
    const rest = readController(after, from + (gy[0]?.length ?? 0));
    return {
      controller: whose === 'your' ? 'you' : whose === 'a' ? null : 'opponent',
      zones: ['graveyard'],
      numeric: rest.numeric,
      keyword: rest.keyword,
      end: rest.end,
    };
  }

  const you = searchable.match(/^\s+you\s+control\b/i);
  if (you) return withController('you', readController(after, from + (you[0]?.length ?? 0)));

  const opp = searchable.match(/^\s+an\s+opponent\s+controls\b/i);
  if (opp) return withController('opponent', readController(after, from + (opp[0]?.length ?? 0)));

  const notYou = searchable.match(/^\s+you\s+don(?:'|’)?t\s+control\b/i);
  if (notYou) return withController('opponent', readController(after, from + (notYou[0]?.length ?? 0)));

  const other = searchable.match(/^\s+another\s+player\s+controls\b/i);
  if (other) return withController('opponent', readController(after, from + (other[0]?.length ?? 0)));

  return { controller: null, zones: null, numeric: null, keyword: null, end: from };
}

// ── the clause parser ────────────────────────────────────────────────────────

const TARGET_RE = /\btargets?\b/gi;

/**
 * Every target clause in a stretch of oracle text, in printed order.
 *
 * Pass ONE line at a time (see `splitAbilityLines`), not a whole face.
 */
// ── D297: a printed list whose alternatives differ ─────────────────────────

/** The subtype nouns a list piece may name; each IS a card type underneath. */
const PIECE_SUBTYPES: Readonly<Record<string, { readonly kind: TargetKind; readonly subtype: string }>> = {
  equipment: { kind: 'artifact', subtype: 'Equipment' },
  vehicle: { kind: 'artifact', subtype: 'Vehicle' },
  spacecraft: { kind: 'artifact', subtype: 'Spacecraft' },
  aura: { kind: 'enchantment', subtype: 'Aura' },
  wall: { kind: 'creature', subtype: 'Wall' },
  plains: { kind: 'land', subtype: 'Plains' },
  island: { kind: 'land', subtype: 'Island' },
  swamp: { kind: 'land', subtype: 'Swamp' },
  mountain: { kind: 'land', subtype: 'Mountain' },
  forest: { kind: 'land', subtype: 'Forest' },
};
const PIECE_KINDS: ReadonlySet<string> = new Set(['creature', 'artifact', 'enchantment', 'land', 'planeswalker', 'battle', 'permanent', 'player']);
const PIECE_SPELL_TYPES: ReadonlySet<string> = new Set(['creature', 'artifact', 'enchantment', 'instant', 'sorcery']);

interface PieceRead {
  readonly alternative: TargetAlternative;
  /** Where the piece's noun ends, relative to the piece's own start. */
  readonly nounEnd: number;
}

/**
 * One piece of a list: leading adjectives (into the piece's own restriction,
 * or recorded as unenforced exactly as a clause would), then ONE head noun -
 * a plain kind, "artifact creature", a subtype noun, a typed spell, "spell".
 * Anything else (a second noun, a combat role, a controller phrase inside a
 * non-final piece) makes the whole list fall back to the table.
 */
function readPiece(piece: string, restrict: MutableRestrict, unenforced: string[], last: boolean): PieceRead | null {
  let rest = piece;
  let consumed = 0;
  for (;;) {
    const adj = rest.match(ADJECTIVE_RE);
    if (!adj) break;
    const word = (adj[1] ?? '').trim();
    if (!absorbAdjective(restrict, word)) unenforced.push(word);
    rest = rest.slice(adj[0].length);
    consumed += adj[0].length;
  }
  const own = finishRestrict(restrict, undefined);
  let m: RegExpMatchArray | null;
  let alternative: TargetAlternative | null = null;
  if ((m = rest.match(/^artifact\s+creatures?\b/i))) {
    alternative = { kinds: ['creature'], cardTypes: ['Artifact'], subtypes: [], restrict: own, keyword: null, numeric: null };
  } else if ((m = rest.match(/^(creature|artifact|enchantment|instant|sorcery|aura)\s+spells?\b/i))) {
    const w = (m[1] ?? '').toLowerCase();
    alternative = w === 'aura'
      ? { kinds: ['spell'], cardTypes: [], subtypes: ['Aura'], restrict: own, keyword: null, numeric: null }
      : { kinds: ['spell'], cardTypes: [w.charAt(0).toUpperCase() + w.slice(1)], subtypes: [], restrict: own, keyword: null, numeric: null };
  } else if ((m = rest.match(/^(creature|artifact|enchantment|land|planeswalker|instant|sorcery)\s+cards?\b/i))) {
    // D298: a typed CARD piece ("artifact or enchantment card" - "card" distributes, below).
    const w = (m[1] ?? '').toLowerCase();
    alternative = { kinds: ['card'], cardTypes: [w.charAt(0).toUpperCase() + w.slice(1)], subtypes: [], restrict: own, keyword: null, numeric: null };
  } else if ((m = rest.match(/^spells?\b/i))) {
    alternative = { kinds: ['spell'], cardTypes: [], subtypes: [], restrict: own, keyword: null, numeric: null };
  } else if ((m = rest.match(/^(equipment|vehicle|spacecraft|aura|wall|plains|island|swamp|mountain|forest)s?\b/i))) {
    const sub = PIECE_SUBTYPES[(m[1] ?? '').toLowerCase()];
    if (!sub) return null;
    alternative = { kinds: [sub.kind], cardTypes: [], subtypes: [sub.subtype], restrict: own, keyword: null, numeric: null };
  } else if ((m = rest.match(/^(creature|artifact|enchantment|land|planeswalker|battle|permanent|player)s?\b/i))) {
    const w = (m[1] ?? '').toLowerCase();
    if (!PIECE_KINDS.has(w)) return null;
    alternative = { kinds: [w as TargetKind], cardTypes: [], subtypes: [], restrict: own, keyword: null, numeric: null };
  }
  if (!alternative || !m) return null;
  const nounEnd = consumed + m[0].length;
  // A non-final piece must end at its noun: "creature with flying or artifact" is not read here.
  if (!last && rest.slice(m[0].length).trim().length > 0) return null;
  void PIECE_SPELL_TYPES;
  return { alternative, nounEnd };
}

interface ListRead {
  readonly alternatives: readonly TargetAlternative[];
  readonly kinds: readonly TargetKind[];
  readonly ctl: ControllerResult;
  readonly unenforced: readonly string[];
}

/**
 * D297. The remainder after `target` (its leading adjectives already absorbed
 * into `firstRestrict`) read as a LIST: pieces split on ", " / " or " / " and/or "
 * up to the sentence end, two or more of them, none containing another
 * `target`; each piece through `readPiece`; the trailing qualifier (keyword /
 * numeric, and the clause-wide controller and zone) read off the LAST piece by
 * `readController`, exactly as a single noun's is. Null = not a list this
 * reader can say; the caller falls back to the table, so nothing regresses.
 */
function readList(clean: string, cursor: number, firstRestrict: MutableRestrict, unenforcedSoFar: readonly string[]): ListRead | null {
  const tail = clean.slice(cursor);
  const stop = tail.search(/[.;\n]/);
  const sentence = stop >= 0 ? tail.slice(0, stop) : tail;
  // A qualifier's own " or " ("power 4 or greater", "mana value 3 or less") is
  // not a list delimiter: the list region ends where the trailing qualifier
  // begins, and that qualifier is read off the last piece below.
  const qualAt = sentence.search(/\s+(?:with|without|you\s+control|you\s+don't\s+control|you\s+don\u2019t\s+control|an\s+opponent\s+controls|that)\b/i);
  const region = qualAt >= 0 ? sentence.slice(0, qualAt) : sentence;
  const parts = region.split(/,\s*(?:or\s+|and\/or\s+)?|\s+(?:or|and\/or)\s+/i);
  if (parts.length < 2) return null;
  if (parts.some((p) => /\btarget\b/i.test(p) || p.trim().length === 0)) return null;
  const alternatives: TargetAlternative[] = [];
  const unenforced = [...unenforcedSoFar];
  let pos = cursor;
  let ctl: ControllerResult | null = null;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    const last = i === parts.length - 1;
    const start = clean.indexOf(part, pos);
    if (start < 0) return null;
    const piece = readPiece(part, i === 0 ? firstRestrict : emptyRestrict(), unenforced, last);
    if (!piece) return null;
    if (last) {
      ctl = readController(clean, start + piece.nounEnd);
      alternatives.push({ ...piece.alternative, keyword: ctl.keyword, numeric: ctl.numeric });
    } else {
      alternatives.push(piece.alternative);
    }
    pos = start + part.length;
  }
  if (!ctl) return null;
  // "creature or Aura spell": the noun "spell" distributes over the list, so an
  // earlier bare type word is a SPELL of that type, not a permanent.
  const lastAlt = alternatives[alternatives.length - 1];
  // D298: "artifact or enchantment card" - "card" distributes exactly as "spell" does.
  if (lastAlt && lastAlt.kinds.length === 1 && lastAlt.kinds[0] === 'card') {
    for (let i = 0; i < alternatives.length - 1; i++) {
      const a = alternatives[i];
      if (!a || a.kinds.length !== 1 || a.kinds[0] === 'card' || a.kinds[0] === 'spell' || a.kinds[0] === 'player') return null;
      const k = a.kinds[0];
      const type = k === 'creature' ? 'Creature' : k === 'artifact' ? 'Artifact' : k === 'enchantment' ? 'Enchantment' : k === 'land' ? 'Land' : k === 'planeswalker' ? 'Planeswalker' : null;
      if (!type) return null;
      alternatives[i] = { ...a, kinds: ['card'], cardTypes: a.cardTypes.includes(type) ? a.cardTypes : [...a.cardTypes, type] };
    }
  }
  if (lastAlt && lastAlt.kinds.length === 1 && lastAlt.kinds[0] === 'spell') {
    for (let i = 0; i < alternatives.length - 1; i++) {
      const a = alternatives[i];
      if (!a || a.kinds.length !== 1 || a.kinds[0] === 'spell') return null;
      const k = a.kinds[0];
      const type = k === 'creature' ? 'Creature' : k === 'artifact' ? 'Artifact' : k === 'enchantment' ? 'Enchantment' : k === 'land' ? 'Land' : k === 'planeswalker' ? 'Planeswalker' : null;
      if (!type) return null;
      alternatives[i] = { ...a, kinds: ['spell'], cardTypes: a.cardTypes.includes(type) ? a.cardTypes : [...a.cardTypes, type] };
    }
  }
  const kinds: TargetKind[] = [];
  for (const a of alternatives) for (const k of a.kinds) if (!kinds.includes(k)) kinds.push(k);
  return { alternatives, kinds, ctl, unenforced };
}

export function parseTargetClauses(text: string, warn: Warn = NOOP_WARN): TargetSpec[] {
  if (!text) return [];
  const clean = scrub(text);
  const out: TargetSpec[] = [];

  TARGET_RE.lastIndex = 0;
  for (let m = TARGET_RE.exec(clean); m !== null; m = TARGET_RE.exec(clean)) {
    const at = m.index;
    const word = m[0];
    const after = clean.slice(at + word.length);
    const before = clean.slice(0, at);

    // ── false positives, per occurrence
    if (FP_AFTER.test(after)) continue;
    if (FP_CANT_BE.test(before)) continue;
    // `any target` is a real clause whose determiner LOOKS like a false
    // positive, so it has to be checked before the generic determiner rule.
    const isAnyTarget = /\bany\s+$/i.test(before);
    if (!isAnyTarget && FP_BEFORE.test(before)) continue;

    // ── `any target` — CR 115.4
    if (isAnyTarget) {
      const start = before.search(/\bany\s+$/i);
      out.push({
        min: 1,
        max: 1,
        kinds: ['creature', 'player', 'planeswalker', 'battle'],
        controller: 'any',
        zones: [],
        cardTypes: [],
        numeric: null,
        keyword: null,
        combatRole: null,
        restrict: null,
        alternatives: null,
        text: text.slice(start >= 0 ? start : at, at + word.length),
        confident: true,
        unenforced: [],
      });
      continue;
    }

    // ── count
    const count = readCount(clean, at);
    if (count.warn) warn(count.warn);

    // ── adjectives, then the head noun
    let rest = after.replace(/^\s+/, '');
    const consumed = after.length - rest.length;
    let cursor = at + word.length + consumed;
    const unenforced: string[] = [...count.unenforced];
    // ⚠️ D294: an adjective the engine can check becomes a RESTRICTION; the
    // rest stay recorded as unenforced, exactly as before.
    const restrict = emptyRestrict();
    for (;;) {
      const adj = rest.match(ADJECTIVE_RE);
      if (!adj) break;
      const word = (adj[1] ?? '').trim();
      if (!absorbAdjective(restrict, word)) unenforced.push(word);
      rest = rest.slice(adj[0].length);
      cursor += adj[0].length;
    }

    // D297: a list the table cannot say (no entry, or a qualifier bound to one
    // alternative) is read piece by piece into `alternatives` - tried only
    // where the table would otherwise leave the clause free aim.
    const asList = (): TargetSpec | null => {
      const list = readList(clean, cursor, restrict, unenforced);
      if (!list) return null;
      return {
        min: count.min,
        max: count.max,
        kinds: list.kinds,
        controller: list.ctl.controller ?? 'any',
        zones: list.ctl.zones ?? [],
        cardTypes: [],
        numeric: null,
        keyword: null,
        combatRole: null,
        restrict: null,
        alternatives: list.alternatives,
        text: text.slice(count.start, list.ctl.end).trim(),
        confident: count.confident,
        unenforced: list.unenforced,
      };
    };

    const entry = NOUNS.find((n) => n.re.test(rest));
    if (!entry) {
      const listSpec = asList();
      if (listSpec) {
        out.push(listSpec);
        if (!count.confident) warn('target:unparsedCount');
        continue;
      }
      warn('target:unparsedClause');
      out.push({ ...FREE_TARGET, text: text.slice(count.start, Math.min(text.length, at + 40)).trim() });
      continue;
    }
    const nounMatch = rest.match(entry.re);
    const nounLen = nounMatch?.[0].length ?? 0;
    if (entry.unenforced) unenforced.push(...entry.unenforced);
    // D295: the combat role printed as a SUFFIX - "creature that's attacking
    // or blocking" (Gideon's Defeat). Read and enforced exactly like D291's
    // adjective form; until now it was dropped silently and a creature that
    // stayed home was accepted.
    const suffix = rest.slice(nounLen).match(/^\s+that(?:'s|\s+is)\s+(attacking or blocking|attacking|blocking)\b/i);
    const suffixLen = suffix?.[0].length ?? 0;
    const suffixWord = suffix?.[1]?.toLowerCase() ?? null;
    const suffixRole =
      suffixWord === 'attacking or blocking'
        ? ('attackingOrBlocking' as const)
        : suffixWord === 'attacking'
          ? ('attacking' as const)
          : suffixWord === 'blocking'
            ? ('blocking' as const)
            : null;

    // ── controller
    const ctl = readController(clean, cursor + nounLen + suffixLen);
    // ⚠️ D293: a qualifier after a noun LIST binds its LAST alternative only in
    // print ("artifact, enchantment, or creature with flying"), which the spec
    // cannot say — read as one restriction over the union it would refuse an
    // artifact for not flying, the one direction this file may never be wrong
    // in. Such a clause stays free aim (and so refused by `engineComplete`);
    // mana value is the exception, being a property of every alternative.
    if (entry.kinds.length > 1 && (ctl.keyword !== null || (ctl.numeric !== null && ctl.numeric.attr !== 'manaValue'))) {
      // D297: the qualifier binds the LAST alternative - said exactly by a list spec.
      const listSpec = asList();
      if (listSpec) {
        out.push(listSpec);
        if (!count.confident) warn('target:unparsedCount');
        continue;
      }
      warn('target:unparsedClause');
      out.push({ ...FREE_TARGET, text: text.slice(count.start, Math.min(text.length, at + 40)).trim() });
      continue;
    }
    // D297: the table read a PREFIX of a printed list ("creature" of "creature
    // or Vehicle") and the rest would be dropped silently - the D207/D213 hole
    // one shape over. A dangling alternative is read as a list; a dangling
    // " or " the reader cannot place is REFUSED rather than dropped (free aim
    // only ever allows, never blocks); a dangling comma falls through, since
    // "Exile target creature, then return it" is not a list.
    const tailAfter = clean.slice(ctl.end);
    // D297: a "with ..." qualifier the reader could NOT read is recorded as
    // unenforced (D138) - it used to be dropped silently, which admitted any
    // creature to "target creature with a +1/+1 counter on it".
    if (ctl.keyword === null && ctl.numeric === null) {
      const unread = tailAfter.match(/^\s+(with(?:out)?\s+[^.;\n]*?)(?=\s+(?:or|and)\s+target\b|[.;\n]|$)/i);
      if (unread) unenforced.push((unread[1] ?? '').trim());
    }
    const danglingOr = /^\s+(?:or|and\/or)\s+/i.test(tailAfter);
    const danglingComma = /^\s*,\s*/.test(tailAfter);
    // D298: "artifact or enchantment CARD" - the table read the type list as
    // permanents and dropped "card"; the list reader distributes "card".
    const danglingCard = !entry.kinds.includes('card') && /^\s+cards?\b/i.test(tailAfter);
    if (danglingOr || danglingComma || danglingCard) {
      const listSpec = asList();
      if (listSpec) {
        out.push(listSpec);
        if (!count.confident) warn('target:unparsedCount');
        continue;
      }
      if (danglingOr || danglingCard) {
        warn('target:unparsedClause');
        out.push({ ...FREE_TARGET, text: text.slice(count.start, Math.min(text.length, at + 40)).trim() });
        continue;
      }
    }
    const controller: TargetController = ctl.controller ?? entry.controller ?? 'any';

    out.push({
      min: count.min,
      max: count.max,
      kinds: entry.kinds,
      controller,
      zones: ctl.zones ?? entry.zones ?? [],
      cardTypes: entry.cardTypes ?? [],
      numeric: ctl.numeric,
      keyword: ctl.keyword,
      combatRole: entry.combatRole ?? suffixRole,
      restrict: finishRestrict(restrict, entry.subtypeCard ? { subtypesAll: [(nounMatch?.[0] ?? '').split(/\s+/)[0] ?? ''] } : entry.restrict),
      alternatives: null,
      text: text.slice(count.start, ctl.end).trim(),
      confident: count.confident,
      unenforced,
    });
    if (!count.confident) warn('target:unparsedCount');
  }

  return out;
}

// ── Auras ────────────────────────────────────────────────────────────────────

const ENCHANT_RE = /^Enchant\s+([^\n.]+)/im;

/**
 * `Enchant creature` is a target requirement (CR 303.4c/601.2c) that never says
 * the word "target".
 *
 * ⚠️ Measured: 3,536 faces carry an `Enchant` line, 3,463 of them Commander-legal
 * — `Enchant creature` 2,477 · `land` 318 · `player` 141 · `creature you control`
 * 124. Skipping them would make Auras, the most-cast permanent class in
 * Commander after creatures, the one class that never asks you to aim.
 */
export function parseEnchant(text: string, warn: Warn = NOOP_WARN): TargetSpec | null {
  if (!text) return null;
  const m = scrub(text).match(ENCHANT_RE);
  if (!m) return null;

  let rest = (m[1] ?? '').replace(/^\s+/, '');
  const unenforced: string[] = [];
  const restrict = emptyRestrict();
  for (;;) {
    const adj = rest.match(ADJECTIVE_RE);
    if (!adj) break;
    const word = (adj[1] ?? '').trim();
    if (!absorbAdjective(restrict, word)) unenforced.push(word);
    rest = rest.slice(adj[0].length);
  }

  const entry = NOUNS.find((n) => n.re.test(rest));
  if (!entry) {
    warn('target:unparsedEnchant');
    return { ...FREE_TARGET, min: 1, max: 1, text: (m[0] ?? '').trim() };
  }
  const nounLen = rest.match(entry.re)?.[0].length ?? 0;
  const ctl = readController(rest, nounLen);
  if (entry.unenforced) unenforced.push(...entry.unenforced);

  return {
    min: 1,
    max: 1,
    kinds: entry.kinds,
    controller: ctl.controller ?? entry.controller ?? 'any',
    zones: ctl.zones ?? entry.zones ?? [],
    cardTypes: entry.cardTypes ?? [],
    numeric: ctl.numeric,
    keyword: ctl.keyword,
    combatRole: entry.combatRole ?? null,
    restrict: finishRestrict(restrict, entry.restrict),
    alternatives: null,
    text: (m[0] ?? '').trim(),
    confident: true,
    unenforced,
  };
}

// ── the face-level entry point ───────────────────────────────────────────────

const MODAL_RE = /\bchoose\s+(one|two|three|up to)\b/i;

/**
 * The target clauses a player chooses when CASTING this face.
 *
 * ⚠️ Activated-ability lines are excluded — those belong to `activated[i]`.
 * Triggered-ability lines are excluded too, and that is a deliberate v1 call: no
 * trigger reaches the stack with targets without a card script, and
 * `SHIPPED_REGISTRY` ships. Asking a player to aim an ETB the app will never
 * execute is theatre.
 *
 * ⚠️ Modal spells emit ONE free spec for the whole face. The clauses belong to
 * modes, `PendingCast.modes` exists and nothing sets it, so taking the union
 * would demand four targets for a card that needs one.
 */
export function parseSpellTargets(
  text: string,
  isPermanent: boolean,
  warn: Warn = NOOP_WARN,
): TargetSpec[] {
  if (!text) return [];

  const enchant = parseEnchant(text, warn);
  if (enchant) return [enchant];

  if (MODAL_RE.test(scrub(text))) {
    warn('target:modalUnion');
    return [{ ...FREE_TARGET, text: 'Choose a mode, then its target' }];
  }

  const out: TargetSpec[] = [];
  for (const line of splitAbilityLines(text, isPermanent)) {
    if (line.kind !== 'spell') continue;
    out.push(...parseTargetClauses(line.text, warn));
  }
  return out;
}
