// A printed token description, and the PRINTING it names.
//
// ⚠️ THE PROBLEM THIS EXISTS FOR (D131): `CountersChanged` takes a free-string
// `kind`, so anything could always emit one. `TokenCreated` requires an
// `oracleId` AND a `printingId` — so creating a token means naming one of 3,290
// token printings, and until now nothing mapped "a 1/1 white Soldier creature
// token" to one. The only token resolution in the app was `TOKEN_NAMES` in
// `buildGame.ts`: twelve names, hand-written, for the Tier-3 tool.
//
// ⚠️ THE ABILITIES ARE IDENTITY, NOT DECORATION, and that is the whole reason
// this is a matcher rather than a name lookup. The database holds
// `Angel 4/4 W "Flying"` and `Angel 4/4 W "Flying, vigilance"` — same power,
// toughness, colour and subtype, distinguished by nothing but their text. It
// also holds `Token Creature — Soldier 1/1 W`, `Token Enchantment Creature —
// Soldier 1/1 W` and `Token Artifact Creature — Soldier 1/1` (colourless). A
// resolver that matched on power and type alone would not be approximate; it
// would put the WRONG permanent on the battlefield, silently, on a card that
// reads correctly. That is D90's failure with a body on it.
//
// ⚠️ So: EXACT on every field, ambiguity REPORTED rather than broken by
// preference, and a miss returns null. The caller decides, and `effectParse`'s
// answer is that a card whose token cannot be named is not understood.

import type { CardData, ColorLetter } from './cardTypes';
import { scrub } from './targetParse';
import { TOKEN_TABLE } from './tokenTable';

/** What a card asks to be created. Everything is as PRINTED, so `*` survives. */
export interface TokenSpec {
  readonly count: number;
  /** The token's own name — which is its subtype line (`Soldier`, `Elf Warrior`). */
  readonly name: string;
  readonly power: string | null;
  readonly toughness: string | null;
  readonly colors: readonly ColorLetter[];
  /** Card types WITHOUT the `Token` supertype: `['Creature']`, `['Artifact','Creature']`. */
  readonly types: readonly string[];
  /** Normalised, `''` when the token has no rules text. */
  readonly abilities: string;
}

const COLOUR_WORDS: Readonly<Record<string, ColorLetter | ''>> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
  colorless: '',
};

const TYPE_WORDS = new Set(['artifact', 'creature', 'enchantment', 'land', 'legendary', 'snow']);

const COUNT_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * `creates? <count> <descriptor> token[s][ with <abilities>]`
 *
 * ⚠️ Deliberately NOT anchored at the start — a token clause is routinely the
 * tail of a longer sentence ("Destroy target creature. Its controller creates a
 * 3/3 …"). It IS anchored at the end of the clause, because everything after
 * `token` that is not a `with` is text this module has not read, and a
 * descriptor that ran past its own noun is how a parser starts inventing cards.
 */
const CLAUSE =
  /\bcreates? (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+) (.+?) tokens?(?: with ([^.]+))?[.,]?$/i;

const PT = /^([\dX*]+)\/([\dX*+-]+)$/;

/**
 * Lowercase, no reminder text, no trailing period, whitespace collapsed.
 *
 * ⚠️ `scrub` FIRST, and it is not cosmetic. A token printing states its keywords
 * with reminder text — `Lifelink (Damage dealt by this creature also causes you
 * to gain that much life.)` — while the card that makes it just says "with
 * lifelink". Without this the two never compare equal and the resolver misses
 * every keyword token in the format, which is exactly what the first
 * measurement showed.
 */
function normaliseAbilities(raw: string): string {
  return scrub(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')
    .toLowerCase();
}

/**
 * A `with …` clause this module is willing to read: a list of KEYWORDS.
 *
 * ⚠️ CLOSED, for D90's reason and with a card that proves it. `Domain — Create a
 * 1/1 blue Bird creature token with flying FOR EACH BASIC LAND TYPE among lands
 * you control` — the "for each" belongs to the COUNT, not to the abilities, and
 * an open capture read the whole tail as an ability and then failed to find a
 * Bird that had it. Refusing is right: this module has not understood how many
 * Birds to make.
 */
const KEYWORD = /^[a-z][a-z-]*(?: [a-z0-9-]+){0,2}$/;

/**
 * Words that mean the clause has stopped describing the token.
 *
 * ⚠️ Two real cards forced this list, and both were reported as "the database
 * has no such token" until it existed — which was a lie about the database.
 * `Create a 1/1 blue Bird creature token WITH FLYING FOR EACH basic land type…`
 * (the tail is the COUNT) and `…with flying, THEN populate` (the tail is a
 * second effect). Both parsed, neither matched, and the miss pointed at
 * Scryfall instead of at this file.
 */
const NOT_A_KEYWORD = /\b(?:then|for|among|that|this|which|when|whenever|if|unless|each|target)\b/;

function isKeywordList(abilities: string): boolean {
  const parts = abilities.split(/,| and /).map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length === 0) return false;
  return parts.every((p) => KEYWORD.test(p) && !NOT_A_KEYWORD.test(p));
}

/**
 * The comma/and-separated parts of an ability line, as a SET.
 *
 * ⚠️ `Flying, vigilance` and `vigilance, flying` are the same token; the printed
 * order is typography. Anything that is not a keyword list — a whole sentence
 * with its own commas — is compared as a string instead, by the caller falling
 * back when the set comparison fails.
 */
function abilitySet(text: string): string {
  return text
    .split(/,| and /)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .sort()
    .join('|');
}

/**
 * Read a printed token description.
 *
 * Returns `null` for anything this module does not understand completely — a
 * copy clause, an `X`-sized token, a descriptor with a word left over. The
 * residue is the point: `effectParse` treats an unreadable token as an
 * unreadable sentence, which is what stops the app creating something the card
 * did not ask for.
 */
export function parseTokenClause(sentence: string): TokenSpec | null {
  // A copy is CR 707 and a different problem entirely (M6.4-LIBRARY-SPEC §4.4).
  if (/\bcopy\b/i.test(sentence)) return null;
  // ⚠️ **A RUN OF SPACES IS SCRUBBING'S FOOTPRINT, AND IT IS A REFUSAL.**
  // `scrub` blanks quoted and parenthesised text by replacing it with spaces of
  // the same length, and callers hand this module text that has already been
  // through it — so a token with a quoted granted ability arrives looking like a
  // token with none. `…with flying \"When this dies, draw a card\"` becomes
  // `…with flying` and would have matched a plain flier: the wrong permanent, on
  // a card that reads correctly, which is D90's failure with a body on it. The
  // gap cannot be seen in the words, only in the spaces they left.
  if (/\s{2,}/.test(sentence)) return null;
  const m = CLAUSE.exec(sentence.trim());
  if (!m) return null;

  const count = COUNT_WORDS[(m[1] ?? '').toLowerCase()] ?? Number(m[1]);
  if (!Number.isInteger(count) || count < 1) return null;

  const words = (m[2] ?? '').split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return null;

  let i = 0;
  let power: string | null = null;
  let toughness: string | null = null;
  const pt = PT.exec(words[0] ?? '');
  if (pt) {
    // ⚠️ `X` and `*` are refused rather than guessed. `*` is a
    // characteristic-defining ability the engine does not compute (layer 7a
    // ships no scripts), and `X` is not known at parse time — the same rule
    // `effectParse`'s `num()` applies to damage.
    if (/[X*]/i.test(words[0] ?? '')) return null;
    power = pt[1] ?? null;
    toughness = pt[2] ?? null;
    i++;
  }

  const colors: ColorLetter[] = [];
  let sawColourWord = false;
  while (i < words.length) {
    const w = (words[i] ?? '').replace(/,$/, '').toLowerCase();
    if (w === 'and') {
      i++;
      continue;
    }
    if (!(w in COLOUR_WORDS)) break;
    sawColourWord = true;
    const letter = COLOUR_WORDS[w];
    if (letter) colors.push(letter);
    i++;
  }

  // Subtypes are Capitalised and come before the lowercase type words.
  const subtypes: string[] = [];
  while (i < words.length && /^[A-Z]/.test(words[i] ?? '')) {
    subtypes.push(words[i] as string);
    i++;
  }

  const types: string[] = [];
  while (i < words.length) {
    const w = (words[i] ?? '').toLowerCase();
    if (!TYPE_WORDS.has(w)) return null; // a word this module cannot account for
    types.push(w.charAt(0).toUpperCase() + w.slice(1));
    i++;
  }

  if (subtypes.length === 0) return null;
  // A creature token must have said its size; a Treasure must not have.
  const isCreature = types.includes('Creature');
  if (isCreature && (power === null || toughness === null)) return null;
  if (!isCreature && power !== null) return null;
  // ⚠️ A predefined artifact token (Treasure, Food, Clue) prints no colour word
  // and no type word — "create a Treasure token". Everything else must have
  // said what it is.
  if (types.length === 0) {
    if (sawColourWord || power !== null) return null;
    types.push('Artifact');
  }

  const rawAbilities = m[3] ?? '';
  // A token whose NAME differs from its subtypes ("…with flying named Wasp") is
  // a different printing and this module cannot find it by subtype.
  if (/\bnamed\b/i.test(rawAbilities)) return null;
  const abilities = normaliseAbilities(rawAbilities);
  // ⚠️ A LIST MAY NOT END IN A CONJUNCTION. `Dragon Egg` reads "…create a 2/2
  // red Dragon creature token with flying and \"{R}: This token gets +1/+0
  // until end of turn.\"" — and by the time this module sees the line the
  // quotes have been blanked (below), leaving the ability list `flying and`,
  // which looks perfectly well-formed and names a token that does not exist.
  if (/(?:,|\band)$/.test(abilities)) return null;
  if (abilities !== '' && !isKeywordList(abilities)) return null;

  return { count, name: subtypes.join(' '), power, toughness, colors, types, abilities };
}

/**
 * A predefined artifact token — Treasure, Food, Clue, Blood, Map.
 *
 * ⚠️ Its ability is INTRINSIC TO THE TOKEN and the card never states it: the
 * card says "create a Treasure token", and the printing says "{T}, Sacrifice
 * this token: Add one mana of any color." Comparing abilities for these would
 * miss every one of them, which is what the first measurement showed. The NAME
 * is the whole identity, and that is the point of the token having one.
 */
function isPredefined(spec: TokenSpec): boolean {
  return spec.power === null && spec.types.length === 1 && spec.types[0] === 'Artifact';
}

/**
 * A description's identity, as one string.
 *
 * ⚠️ THE KEY THE BAKED TABLE IS BUILT ON (D133), which is why it lives beside
 * the parser rather than in the generator: the generator and `effectParse` must
 * agree about what "the same token description" means, and two copies of that
 * rule would resolve `Angel 4/4 W flying` to a token in one and to nothing in
 * the other. Ordered fields, sorted sets, so it is stable across runs.
 *
 * ⚠️ `count` is deliberately NOT in it. "Create a Soldier" and "create three
 * Soldiers" name the same token; how many is the effect's business.
 */
export function specKey(spec: TokenSpec): string {
  return [
    spec.name,
    `${spec.power ?? ''}/${spec.toughness ?? ''}`,
    [...spec.colors].sort().join(''),
    [...spec.types].sort().join(' '),
    abilitySet(spec.abilities),
  ].join('|');
}

/** The card types of a token printing, with the `Token` supertype dropped. */
function typesOf(typeLine: string): string[] {
  const before = (typeLine.split('—')[0] ?? '').trim();
  return before
    .split(/\s+/)
    .filter((w) => w !== '' && w !== 'Token')
    .map((w) => w);
}

function subtypesOf(typeLine: string): string {
  return (typeLine.split('—')[1] ?? '').trim();
}

/**
 * Every token printing that matches this description EXACTLY.
 *
 * ⚠️ Returns a LIST, and the caller must decide what more than one means. A
 * resolver that quietly took the first would be choosing between two real cards
 * on the strength of the order Scryfall happens to stream them in.
 */
export function matchToken(spec: TokenSpec, candidates: readonly CardData[]): CardData[] {
  const wantColors = [...spec.colors].sort().join('');
  const wantTypes = [...spec.types].sort().join(' ');
  const wantSet = abilitySet(spec.abilities);
  const predefined = isPredefined(spec);
  const out: CardData[] = [];
  for (const card of candidates) {
    if (card.layout !== 'token') continue;
    const face = card.faces[0];
    if (!face) continue;
    if (subtypesOf(face.typeLine) !== spec.name) continue;
    if (typesOf(face.typeLine).sort().join(' ') !== wantTypes) continue;
    if ((face.power ?? null) !== spec.power) continue;
    if ((face.toughness ?? null) !== spec.toughness) continue;
    if (!predefined) {
      if ([...(face.colors ?? [])].sort().join('') !== wantColors) continue;
      const printed = normaliseAbilities(face.oracleText ?? '');
      // ⚠️ Two comparisons, and the SET one is not a loosening: it exists
      // because "Flying, vigilance" and "vigilance and flying" are the same
      // token printed two ways. A whole sentence with its own commas fails the
      // set test and is caught by the string one.
      if (printed !== spec.abilities && abilitySet(printed) !== wantSet) continue;
    }
    out.push(card);
  }
  return out;
}

/**
 * The token this description names, or null when it does not name exactly one.
 *
 * ⚠️ **AMBIGUITY IS COUNTED BY `oracleId`, NOT BY PRINTING**, and getting that
 * wrong is what the first measurement of this module got wrong: the plain 1/1
 * white Soldier has **66 printings and ONE oracle id**, so a printing count
 * reported 328 "ambiguous" descriptions that were nothing of the kind. Two
 * printings of one token are the same token; two ORACLE IDS mean the
 * description does not identify a card, and creating either would be the app
 * deciding something the rules did not.
 *
 * ⚠️ Which printing is returned among reprints does not matter to the rules —
 * they are the same object — but it must be DETERMINISTIC or two players would
 * disagree about a `printingId` on the wire. Lowest scryfall id wins.
 */
export function resolveToken(spec: TokenSpec, candidates: readonly CardData[]): CardData | null {
  const hits = matchToken(spec, candidates);
  if (hits.length === 0) return null;
  const ids = new Set(hits.map((c) => c.oracleId));
  if (ids.size !== 1) return null;
  return [...hits].sort((a, b) => a.scryfallId.localeCompare(b.scryfallId))[0] as CardData;
}

/**
 * Every token NAME a card's text asks for, so a game can load the printings
 * before it starts.
 *
 * ⚠️ The name is the SUBTYPE LINE, which is how Scryfall names a token —
 * `Soldier`, `Elf Warrior`, `Zombie Army`. That is what makes the runtime
 * lookup possible at all: a game resolves candidate printings by name through
 * the existing `printingsOf`, then matches exactly among them.
 */
/**
 * Every token PRINTING a set of cards can create, from the baked table.
 *
 * ⚠️ **A GAME MUST CARRY THE TOKENS ITS DECKS CAN MAKE, OR A CREATED TOKEN IS A
 * BLANK.** `TokenCreated` names a `printingId` and `derive` looks it up in the
 * oracle DB, which is built from the game's POOL — a printing the pool does not
 * hold derives to the inert "unknown printing" object: no name, no types, a 0/0
 * the state-based action bins on the next pass. The card would have resolved
 * correctly and produced nothing visible, which is D90's half-execution arriving
 * by the back door.
 *
 * ⚠️ Exact PRINTING ids, never names: the table already decided which printing a
 * description names, and deciding it again here would be the second copy of that
 * rule that eventually disagrees.
 */
export function tokenPrintingIdsIn(cards: readonly CardData[]): string[] {
  const out = new Set<string>();
  for (const card of cards) {
    for (const face of card.faces) {
      for (const line of (face.oracleText ?? '').split(/\n|(?<=\.)\s+/)) {
        const spec = parseTokenClause(line.trim());
        if (!spec) continue;
        const ref = TOKEN_TABLE[specKey(spec)];
        if (ref) out.add(ref.printingId);
      }
    }
  }
  return [...out].sort();
}

export function tokenNamesIn(oracleText: string): string[] {
  const out = new Set<string>();
  for (const line of oracleText.split(/\n|(?<=\.)\s+/)) {
    const spec = parseTokenClause(line.trim());
    if (spec) out.add(spec.name);
  }
  return [...out];
}
