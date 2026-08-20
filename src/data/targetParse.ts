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
  TargetController,
  TargetKind,
  TargetSpec,
  TargetZone,
} from '../engine/types/oracle';
import { FREE_TARGET } from '../engine/types/oracle';
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

  const upTo = window.match(/\bup\s+to\s+(\w+)\s+$/i);
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
  { re: new RegExp(`^creature${s}\\s+or\\s+player${s}\\b`, 'i'), kinds: ['creature', 'player'] },
  { re: new RegExp(`^player${s}\\s+or\\s+planeswalker${s}\\b`, 'i'), kinds: ['player', 'planeswalker'] },
  { re: new RegExp(`^opponent${s}\\s+or\\s+planeswalker${s}\\b`, 'i'), kinds: ['player', 'planeswalker'], controller: 'opponent' },
  { re: new RegExp(`^permanent${s}\\s+or\\s+player${s}\\b`, 'i'), kinds: ['permanent', 'player'] },
  { re: new RegExp(`^artifact${s}\\s+or\\s+enchantment${s}\\b`, 'i'), kinds: ['artifact', 'enchantment'] },
  { re: new RegExp(`^artifact${s}\\s+or\\s+creature${s}\\b`, 'i'), kinds: ['artifact', 'creature'] },
  { re: new RegExp(`^creature${s}\\s+or\\s+enchantment${s}\\b`, 'i'), kinds: ['creature', 'enchantment'] },
  { re: new RegExp(`^creature${s}\\s+or\\s+artifact${s}\\b`, 'i'), kinds: ['creature', 'artifact'] },
  { re: new RegExp(`^enchantment${s}\\s+or\\s+land${s}\\b`, 'i'), kinds: ['enchantment', 'land'] },
  // `Icy Manipulator`: a comma-or list.
  { re: new RegExp(`^artifact,\\s*creature,\\s*or\\s+land${s}\\b`, 'i'), kinds: ['artifact', 'creature', 'land'] },
  { re: new RegExp(`^artifact,\\s*enchantment,\\s*or\\s+land${s}\\b`, 'i'), kinds: ['artifact', 'enchantment', 'land'] },

  // stack objects
  // ⚠️ `cardTypes` on a spell noun is enforced against the CAST FACE's types
  // (D198): an activated or triggered ability on the stack carries none, so a
  // typed-spell clause refuses it — which is also the correct CR answer.
  { re: new RegExp(`^instant\\s+or\\s+sorcery\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Instant', 'Sorcery'] },
  { re: new RegExp(`^instant\\s+or\\s+sorcery\\s+card${s}\\b`, 'i'), kinds: ['card'], zones: ['graveyard'], cardTypes: ['Instant', 'Sorcery'] },
  { re: new RegExp(`^activated\\s+or\\s+triggered\\s+abilit(?:y|ies)\\b`, 'i'), kinds: ['spell'] },
  { re: new RegExp(`^spell${s}\\s+or\\s+abilit(?:y|ies)\\b`, 'i'), kinds: ['spell'] },
  { re: new RegExp(`^spell${s}\\s+or\\s+permanent${s}\\b`, 'i'), kinds: ['spell', 'permanent'] },
  // Enforced since D198 the way "creature card" has been since D138 — same
  // field, same predicate, one zone over. "noncreature" stays unenforced:
  // a NEGATED type has no TargetSpec field (the D185 ledger class).
  { re: new RegExp(`^creature\\s+spell${s}\\b`, 'i'), kinds: ['spell'], cardTypes: ['Creature'] },
  { re: new RegExp(`^noncreature\\s+spell${s}\\b`, 'i'), kinds: ['spell'], unenforced: ['noncreature spell'] },
  { re: new RegExp(`^spell${s}\\b`, 'i'), kinds: ['spell'] },
  { re: new RegExp(`^abilit(?:y|ies)\\b`, 'i'), kinds: ['spell'] },

  // combat states — the kind is enforced, the state is not
  { re: new RegExp(`^attacking\\s+or\\s+blocking\\s+creature${s}\\b`, 'i'), kinds: ['creature'], unenforced: ['attacking or blocking'] },
  { re: new RegExp(`^attacking\\s+creature${s}\\b`, 'i'), kinds: ['creature'], unenforced: ['attacking'] },
  { re: new RegExp(`^blocking\\s+creature${s}\\b`, 'i'), kinds: ['creature'], unenforced: ['blocking'] },

  // cards in known zones
  { re: new RegExp(`^creature\\s+card${s}\\b`, 'i'), kinds: ['card'], cardTypes: ['Creature'] },
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
  { re: new RegExp(`^card${s}\\b`, 'i'), kinds: ['card'] },

  // plain kinds
  { re: new RegExp(`^creature${s}\\b`, 'i'), kinds: ['creature'] },
  { re: new RegExp(`^planeswalker${s}\\b`, 'i'), kinds: ['planeswalker'] },
  { re: new RegExp(`^battle${s}\\b`, 'i'), kinds: ['battle'] },
  { re: new RegExp(`^artifact${s}\\b`, 'i'), kinds: ['artifact'] },
  { re: new RegExp(`^enchantment${s}\\b`, 'i'), kinds: ['enchantment'] },
  { re: new RegExp(`^land${s}\\b`, 'i'), kinds: ['land'] },
  { re: new RegExp(`^permanent${s}\\b`, 'i'), kinds: ['permanent'] },
  { re: new RegExp(`^opponent${s}\\b`, 'i'), kinds: ['player'], controller: 'opponent' },
  { re: new RegExp(`^player${s}\\b`, 'i'), kinds: ['player'] },

  // Common subtypes that ARE a card type underneath. The TYPE is enforced and
  // the subtype is not, which is the same trade the adjective stripper makes.
  //
  // ⚠️ The basic land types are here because of Auras, not spells: `Enchant
  // Forest` (Utopia Sprawl), `Enchant Mountain` (the Genju cycle) and `Enchant
  // Wall` (Animate Wall) are real Commander cards whose whole target clause is a
  // subtype. Without these they fell to free aim and, worse, tripped the
  // "a free spec never demands a target" invariant, since an Aura genuinely does.
  { re: new RegExp(`^equipment${s}\\b`, 'i'), kinds: ['artifact'], unenforced: ['Equipment'] },
  { re: new RegExp(`^vehicle${s}\\b`, 'i'), kinds: ['artifact'], unenforced: ['Vehicle'] },
  { re: new RegExp(`^aura${s}\\b`, 'i'), kinds: ['enchantment'], unenforced: ['Aura'] },
  { re: new RegExp(`^wall${s}\\b`, 'i'), kinds: ['creature'], unenforced: ['Wall'] },
  { re: new RegExp(`^plains\\b`, 'i'), kinds: ['land'], unenforced: ['Plains'] },
  { re: new RegExp(`^island${s}\\b`, 'i'), kinds: ['land'], unenforced: ['Island'] },
  { re: new RegExp(`^swamp${s}\\b`, 'i'), kinds: ['land'], unenforced: ['Swamp'] },
  { re: new RegExp(`^mountain${s}\\b`, 'i'), kinds: ['land'], unenforced: ['Mountain'] },
  { re: new RegExp(`^forest${s}\\b`, 'i'), kinds: ['land'], unenforced: ['Forest'] },
];

/**
 * Adjectives the parser can SEE and cannot CHECK. Stripped so the head noun is
 * reachable, and recorded verbatim so `tier3.ts` can say what is not enforced.
 */
const ADJECTIVE_RE =
  /^(non-?\w+|tapped|untapped|legendary|basic|nonbasic|white|blue|black|red|green|colorless|colourless|multicolored|multicoloured|monocolored|face-up|face-down|token|other|snow|historic|modified|enchanted|equipped|kicked|attacking|blocking|blocked|unblocked)\s+/i;

const CONTROLLER_WINDOW = 40;

interface ControllerResult {
  readonly controller: TargetController | null;
  /** The zone the clause names, when it names one (D138). */
  readonly zones: readonly TargetZone[] | null;
  /** The numeric restriction the clause names, when it names one (D139). */
  readonly numeric: NumericRestriction | null;
  /** Where the printed clause ends. */
  readonly end: number;
}

/**
 * ⚠️ `you don't control` maps to `'opponent'` and that is EXACT in Commander:
 * there are no teammates, so "not mine" and "an opponent's" are the same set.
 */
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
      end: rest.end,
    };
  }

  const you = searchable.match(/^\s+you\s+control\b/i);
  if (you) return { controller: 'you', zones: null, numeric: null, end: from + (you[0]?.length ?? 0) };

  const opp = searchable.match(/^\s+an\s+opponent\s+controls\b/i);
  if (opp) return { controller: 'opponent', zones: null, numeric: null, end: from + (opp[0]?.length ?? 0) };

  const notYou = searchable.match(/^\s+you\s+don(?:'|’)?t\s+control\b/i);
  if (notYou) return { controller: 'opponent', zones: null, numeric: null, end: from + (notYou[0]?.length ?? 0) };

  const other = searchable.match(/^\s+another\s+player\s+controls\b/i);
  if (other) return { controller: 'opponent', zones: null, numeric: null, end: from + (other[0]?.length ?? 0) };

  return { controller: null, zones: null, numeric: null, end: from };
}

// ── the clause parser ────────────────────────────────────────────────────────

const TARGET_RE = /\btargets?\b/gi;

/**
 * Every target clause in a stretch of oracle text, in printed order.
 *
 * Pass ONE line at a time (see `splitAbilityLines`), not a whole face.
 */
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
    for (;;) {
      const adj = rest.match(ADJECTIVE_RE);
      if (!adj) break;
      unenforced.push((adj[1] ?? '').trim());
      rest = rest.slice(adj[0].length);
      cursor += adj[0].length;
    }

    const entry = NOUNS.find((n) => n.re.test(rest));
    if (!entry) {
      warn('target:unparsedClause');
      out.push({ ...FREE_TARGET, text: text.slice(count.start, Math.min(text.length, at + 40)).trim() });
      continue;
    }
    const nounMatch = rest.match(entry.re);
    const nounLen = nounMatch?.[0].length ?? 0;
    if (entry.unenforced) unenforced.push(...entry.unenforced);

    // ── controller
    const ctl = readController(clean, cursor + nounLen);
    const controller: TargetController = ctl.controller ?? entry.controller ?? 'any';

    out.push({
      min: count.min,
      max: count.max,
      kinds: entry.kinds,
      controller,
      zones: ctl.zones ?? entry.zones ?? [],
      cardTypes: entry.cardTypes ?? [],
      numeric: ctl.numeric,
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
  for (;;) {
    const adj = rest.match(ADJECTIVE_RE);
    if (!adj) break;
    unenforced.push((adj[1] ?? '').trim());
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
