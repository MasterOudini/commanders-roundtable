// Card text → typed rules facts. Runs ONCE per printing, at ingest.
//
// ⚠️ This file is the entire Tier-2 boundary. If a fact is not produced here it
// is not enforced anywhere, and the player uses a Tier-3 tool instead. That is
// a feature: the alternative — a regex reached for at a decision site — is an
// undocumented, unmeasurable rules claim that nobody can audit. Every parser
// below reports what it could not understand, and `ingestWarnings` counts those
// by category; that number is the honest measure of coverage and is recorded in
// DECISIONS.md.
//
// ⚠️ Keywords come from Scryfall's `keywords[]`, never from a text match.
// Wizards' own tagging is complete and survives rewordings; a regex for
// "flying" hits "Whenever a creature with flying attacks…" and grants it to the
// wrong card. The two exceptions are landwalk and protection, which Scryfall
// reports as bare `"Landwalk"` / `"Protection"` without saying *which* — and the
// which is the whole rule.

import type { CardData, CardFace, ColorLetter } from './cardTypes';
import { scrub } from './targetParse';
import type { HybridOption, HybridSymbol, ManaCost, ManaPool } from '../engine/types/mana';
import { EMPTY_POOL } from '../engine/types/mana';
import type {
  Keyword,
  ManaOutput,
  ManaProduction,
  OracleFace,
  ParsedTypeLine,
  Protection,
} from '../engine/types/oracle';
import { NO_PROTECTION } from '../engine/types/oracle';
import { canonicalKeyword, parseLandwalk, parseToxic } from '../engine/keywords';
import { parseCostReductions } from './costParse';
import { parseSpellTargets } from './targetParse';
import { parseActivatedAbilities } from './activatedParse';
import { parseEffects } from './effectParse';
import { parseEntersTapped, parseChoosesColorOnEntry } from './replacementParse';

/** Every warning a parse produced, as `category` strings for tallying. */
export type Warn = (category: string) => void;

const NOOP_WARN: Warn = () => undefined;

// ── mana costs ───────────────────────────────────────────────────────────────

const COLOR_LETTERS: ReadonlySet<string> = new Set(['W', 'U', 'B', 'R', 'G']);

/**
 * Parse a Scryfall cost string such as `{2}{W}{W/U}{X}`.
 *
 * Returns `null` for a card with genuinely no cost (a land, the back face of a
 * transform card) — which is NOT the same as a cost of zero. `{0}` is castable
 * for free; no cost at all means the object is not castable from hand at all,
 * and conflating the two makes every land look like a free spell to
 * `legalActions`.
 */
export function parseManaCost(raw: string, warn: Warn = NOOP_WARN): ManaCost | null {
  const text = (raw ?? '').trim();
  if (text === '') return null;

  let generic = 0;
  let xCount = 0;
  let colorless = 0;
  let snow = 0;
  const colored: Record<ColorLetter, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const hybrids: HybridSymbol[] = [];
  let manaValue = 0;

  const tokens = text.match(/\{[^}]*\}/g);
  if (!tokens) {
    warn('manaCost:unparseable');
    return null;
  }
  // A stray character outside any {} means we did not understand the string.
  if (tokens.join('') !== text.replace(/\s+/g, '')) warn('manaCost:strayCharacters');

  for (const token of tokens) {
    const sym = token.slice(1, -1).toUpperCase();

    if (/^\d+$/.test(sym)) {
      const n = Number(sym);
      generic += n;
      manaValue += n;
      continue;
    }
    if (sym === 'X' || sym === 'Y' || sym === 'Z') {
      xCount++;
      continue; // X counts as 0 on the stack-less side; CR 202.3b
    }
    if (COLOR_LETTERS.has(sym)) {
      colored[sym as ColorLetter]++;
      manaValue += 1;
      continue;
    }
    if (sym === 'C') {
      colorless++;
      manaValue += 1;
      continue;
    }
    if (sym === 'S') {
      snow++;
      manaValue += 1;
      continue;
    }
    if (sym.includes('/')) {
      const parsed = parseHybrid(sym, token, warn);
      if (parsed) {
        hybrids.push(parsed.symbol);
        manaValue += parsed.manaValue;
      }
      continue;
    }
    if (sym === '∞') {
      // Un-set. Not playable in Commander; recorded rather than crashed on.
      warn('manaCost:infinity');
      continue;
    }
    if (/^H[WUBRG]$/.test(sym)) {
      // Half mana, Un-sets only. Rounded up to a whole coloured pip.
      warn('manaCost:halfMana');
      colored[sym[1] as ColorLetter]++;
      manaValue += 1;
      continue;
    }
    warn(`manaCost:unknownSymbol`);
  }

  return {
    generic,
    xCount,
    colored,
    colorless,
    snow,
    hybrids,
    manaValue,
    raw: text,
  };
}

/**
 * `{W/U}`, `{2/W}`, `{W/P}`, `{G/U/P}`.
 *
 * ⚠️ Phyrexian becomes a hybrid whose extra option is `life`, rather than its
 * own field. `{W/P}` and `{W/U}` are the same decision shape — "satisfy this one
 * of these ways" — so the solver, the payment UI and the validator each get ONE
 * code path. See DECISIONS D33.
 */
function parseHybrid(sym: string, raw: string, warn: Warn): { symbol: HybridSymbol; manaValue: number } | null {
  const parts = sym.split('/');
  const options: HybridOption[] = [];
  let manaValue = 1;
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const amount = Number(part);
      options.push({ kind: 'generic', amount });
      // CR 202.3f: a monocolour hybrid's mana value is the higher of its halves.
      manaValue = Math.max(manaValue, amount);
      continue;
    }
    if (COLOR_LETTERS.has(part)) {
      options.push({ kind: 'color', color: part as ColorLetter });
      continue;
    }
    if (part === 'C') {
      options.push({ kind: 'colorless' });
      continue;
    }
    if (part === 'S') {
      options.push({ kind: 'snow' });
      continue;
    }
    if (part === 'P') {
      options.push({ kind: 'life', amount: 2 });
      continue;
    }
    warn('manaCost:unknownHybridHalf');
    return null;
  }
  if (options.length < 2) {
    warn('manaCost:degenerateHybrid');
    return null;
  }
  return { symbol: { options, raw }, manaValue };
}

// ── type lines ───────────────────────────────────────────────────────────────

const SUPERTYPES: ReadonlySet<string> = new Set([
  'Basic',
  'Legendary',
  'Ongoing',
  'Snow',
  'World',
  'Host',
  'Elite',
]);

const CARD_TYPES: ReadonlySet<string> = new Set([
  'Artifact',
  'Battle',
  'Conspiracy',
  'Creature',
  'Dungeon',
  'Emblem',
  'Enchantment',
  'Hero',
  'Instant',
  'Kindred',
  'Land',
  'Phenomenon',
  'Plane',
  'Planeswalker',
  'Scheme',
  'Sorcery',
  'Sticker',
  // ⚠️ PLURAL, and it is the real printed type line of an Unfinity sticker
  // sheet — not a typo for the singular above. Measured: it was the only
  // unknown type word on a card Scryfall reports as Commander-LEGAL, and there
  // were 54 of them. Everything else in that warning bucket is `Card`, `Summon`,
  // `Event` or `Boss` on cards that are Commander-illegal and can never reach a
  // deck, which is why the assertion worth making is "no LEGAL card has an
  // unknown type" rather than "the count is zero".
  'Stickers',
  'Token',
  'Tribal',
  'Vanguard',
  'Attraction',
  'Contraption',
  'Spacecraft',
]);

const DASH = /\s+[—–-]\s+/;

/**
 * `Legendary Artifact Creature — Human Wizard` → supertypes/types/subtypes.
 *
 * An unrecognised word on the left goes to `types` and warns. Silently dropping
 * it would make a new card type (Battle, Spacecraft — both added since 2023)
 * invisible to `isPermanent`, and the card would be castable but never land.
 */
export function parseTypeLine(raw: string, warn: Warn = NOOP_WARN): ParsedTypeLine {
  const text = (raw ?? '').trim();
  const [left = '', right = ''] = text.split(DASH);
  const supertypes: string[] = [];
  const types: string[] = [];
  for (const word of left.split(/\s+/).filter(Boolean)) {
    if (SUPERTYPES.has(word)) supertypes.push(word);
    else if (CARD_TYPES.has(word)) types.push(word);
    else {
      types.push(word);
      warn('typeLine:unknownType');
    }
  }
  const subtypes = right.split(/\s+/).filter(Boolean);
  return { supertypes, types, subtypes, raw: text };
}

export const PERMANENT_TYPES: ReadonlySet<string> = new Set([
  'Artifact',
  'Battle',
  'Creature',
  'Enchantment',
  'Land',
  'Planeswalker',
  'Spacecraft',
]);

export function isPermanentType(t: ParsedTypeLine): boolean {
  return t.types.some((x) => PERMANENT_TYPES.has(x));
}

// ── keywords ─────────────────────────────────────────────────────────────────

/**
 * Scryfall reports one keyword array for the whole CARD, so on a two-faced card
 * the back face's keywords would otherwise be granted to the front.
 *
 * The filter: a keyword counts for a face only if that face's oracle text
 * mentions it. Keyword abilities are always printed on the face that has them,
 * so this is exact for single-faced cards (where it is also a no-op) and
 * correct in every double-faced case checked against the bulk data.
 */
export function parseKeywords(card: CardData, faceIndex: number, warn: Warn = NOOP_WARN): Keyword[] {
  const face = card.faces[faceIndex];
  const multiFace = card.faces.length > 1;
  const text = (face?.oracleText ?? '').toLowerCase();
  const out: Keyword[] = [];
  for (const raw of card.keywords) {
    const kw = canonicalKeyword(raw);
    if (!kw) continue;
    if (multiFace) {
      const printed = raw.toLowerCase();
      if (!text.includes(printed)) continue;
    }
    if (!out.includes(kw)) out.push(kw);
  }
  // D310 - the characteristic-defining keywords are read off the printed line
  // too: Scryfall's keywords[] omits Devoid on some printings (Eldrazi
  // Devastator lists only Trample), exactly as it omits which landwalk.
  for (const [kw, re] of [['devoid', /^devoid\b/m], ['changeling', /^changeling\b/m]] as const) {
    if (re.test(text) && !out.includes(kw)) out.push(kw);
  }
  // ⚠️ The `keywords:noneTier2` warning is NOT raised here — see `parseFace`.
  // Raising it from this function was a measurement bug, and a large one: it
  // fires on "no keyword STRING canonicalised", but landwalk, protection and
  // ward are Tier-2 facts that deliberately do NOT come from the keyword array
  // (Scryfall reports them as bare `"Landwalk"` / `"Protection"` / `"Ward"`
  // without saying which, so they are parsed from text into their own fields).
  // A Swampwalk creature was therefore counted as "we automate nothing about
  // this card" while the engine was in fact enforcing its evasion. Only
  // `parseFace` can see every field, so only `parseFace` can tell whether the
  // face really produced no Tier-2 fact at all.
  void warn;
  return out;
}

// ── protection ───────────────────────────────────────────────────────────────

const COLOR_WORDS: Readonly<Record<string, ColorLetter>> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
};

/**
 * `protection from red`, `protection from black and from blue`, `protection
 * from everything`, `protection from all colors`.
 *
 * Anything else — `protection from creatures`, `protection from Dragons` — is
 * recorded verbatim in `other` and NOT enforced. Half-enforcing it would be
 * worse than not enforcing it, because players would stop checking.
 */
export function parseProtection(oracleText: string, warn: Warn = NOOP_WARN): Protection {
  const text = oracleText ?? '';
  if (!/protection from/i.test(text)) return NO_PROTECTION;
  const colors: ColorLetter[] = [];
  const other: string[] = [];
  let fromEverything = false;

  for (const m of text.matchAll(/protection from ([^.;\n(]+)/gi)) {
    const clause = (m[1] ?? '').trim();
    for (const part of clause.split(/\s*(?:,|\band from\b|\band\b)\s*/i)) {
      const word = part.trim().toLowerCase().replace(/\.$/, '');
      if (word === '') continue;
      if (word === 'everything') {
        fromEverything = true;
        continue;
      }
      if (word === 'all colors' || word === 'all colours') {
        colors.push('W', 'U', 'B', 'R', 'G');
        continue;
      }
      const color = COLOR_WORDS[word];
      if (color) {
        if (!colors.includes(color)) colors.push(color);
        continue;
      }
      other.push(word);
      warn('protection:unenforced');
    }
  }
  return { colors, fromEverything, other };
}

/**
 * True when the match at `index` sits inside a pair of double quotes.
 *
 * ⚠️ Quoted text is an ability a card GRANTS TO SOMETHING ELSE, not one it has.
 * Measured: `Teferi, Akosa of Zhalfir` reads `You get an emblem with "Knights
 * you control get +1/+0 and have ward {2}"`, and without this guard Teferi
 * himself was treated as warded — so targeting him would have cost an extra
 * {2} that no card anywhere says he has. Two faces in the whole database, and
 * both of them wrong in the direction a player would notice and could not
 * explain.
 */
function insideQuotes(text: string, index: number): boolean {
  let quotes = 0;
  for (let i = 0; i < index; i++) {
    const ch = text[i];
    if (ch === '"' || ch === '“' || ch === '”') quotes++;
  }
  return quotes % 2 === 1;
}

/** `ward {2}`. Enforced as a cast-time mana tax. */
export function parseWard(oracleText: string, warn: Warn = NOOP_WARN): ManaCost | null {
  const text = oracleText ?? '';
  const m = text.match(/\bward\s*((?:\{[^}]+\})+)/i);
  if (m?.[1] && !insideQuotes(text, m.index ?? 0)) return parseManaCost(m[1], warn);
  // A non-mana ward is warned about by `parseWardLife` below, which is the only
  // caller that can tell "we understood it as life" from "we did not understand
  // it at all". Warning here too would double-count every life ward.
  return null;
}

/**
 * `ward—Pay 3 life` → 3. Enforced as a cast-time LIFE tax.
 *
 * ⚠️ M5 promotion (D68). Measured across the whole database, the 208
 * `ward:nonManaCost` cards break down into a large, uniform "pay N life" group
 * and a long tail of real decisions — `ward—Discard a card`, `ward—Sacrifice a
 * creature`, `ward—Collect evidence 4`. Only the first is a tax: it has a fixed
 * price, no choice, and no target, so the engine can charge it exactly the way
 * it charges a mana ward. The rest stay Tier 3 and are still warned about,
 * because "pay two life" and "sacrifice a creature" are not the same promise and
 * half-enforcing the second would be worse than not enforcing it.
 *
 * ⚠️ `pay life equal to this creature's power` is deliberately NOT matched. It
 * is a variable the engine would have to re-read at cast time, and a ward whose
 * price is wrong is precisely the "confidently wrong" failure the Tier-2/Tier-3
 * line exists to prevent.
 */
/**
 * D307 - "Flashback {N}" on its own line (reminder text aside), read as a mana
 * cost. A dash cost ("Flashback-Pay 3 life.") is null: the engine cannot pay it.
 */
export function parseFlashback(oracleText: string, warn: Warn = NOOP_WARN): ManaCost | null {
  for (const raw of (oracleText ?? '').split('\n')) {
    const line = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const m = /^Flashback ((?:\{[^}]+\})+)$/.exec(line);
    if (m) return parseManaCost(m[1] ?? '', warn);
  }
  return null;
}

/**
 * D309 - "Morph {N}" / "Megamorph {N}" on its own line (reminder text aside),
 * as a mana cost; a dash cost ("Morph—Discard a card.") is null.
 */
export function parseMorph(oracleText: string, warn: Warn = NOOP_WARN): { cost: ManaCost; mega: boolean; text: string } | null {
  for (const raw of (oracleText ?? '').split('\n')) {
    const line = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const m = /^(Morph|Megamorph) ((?:\{[^}]+\})+)$/.exec(line);
    if (m) {
      const cost = parseManaCost(m[2] ?? '', warn);
      return cost ? { cost, mega: m[1] === 'Megamorph', text: m[2] ?? '' } : null;
    }
  }
  return null;
}

export function parseWardLife(oracleText: string, warn: Warn = NOOP_WARN): number {
  const text = oracleText ?? '';
  if (!/\bward\b/i.test(text)) return 0;
  // Already handled as mana; `parseWard` owns that case.
  if (/\bward\s*(?:\{[^}]+\})/i.test(text)) return 0;
  const m = text.match(/\bward\s*[—–-]\s*pay\s+(\d+)\s+life\b/i);
  if (m?.[1] && !insideQuotes(text, m.index ?? 0)) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n > 0) return n;
  }
  warn('ward:nonManaCost');
  return 0;
}

// ── mana production ──────────────────────────────────────────────────────────

const BASIC_TYPE_MANA: Readonly<Record<string, keyof ManaPool>> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
  Wastes: 'C',
};

function pool(entries: Partial<Record<keyof ManaPool, number>>): ManaPool {
  return { ...EMPTY_POOL, ...entries };
}

function poolKey(p: ManaPool): string {
  return `${p.W}/${p.U}/${p.B}/${p.R}/${p.G}/${p.C}`;
}

function outputKey(o: ManaProduction): string {
  return `${o.requiresTap}|${o.conditional}|${o.anyColor ? `${o.anyColor.scope}:${o.anyColor.amount}` : '-'}|${o.outputs.map((x) => poolKey(x.mana)).join(',')}`;
}

/** Text that makes the amount or usability of the mana unknowable to the engine. */
const CONDITIONAL_RE =
  /\b(if\b|unless\b|only\b|for each\b|equal to\b|that much\b|X\b|Activate only\b|as long as\b|instead\b|choose\b|reveal\b|whenever\b|when\b|at the beginning\b)/i;

/**
 * Every mana ability a face has, from both its printed text and its land types.
 *
 * ⚠️ THE LAND TYPES ARE NOT OPTIONAL. CR 305.6 gives a land with a basic land
 * type its mana ability intrinsically, and Scryfall's oracle text for the
 * original dual lands (Tundra, Bayou…) is literally the empty string. A parser
 * that only read text would report that Tundra taps for nothing, and the
 * affordability filter would grey out half a player's hand with no visible
 * cause.
 */
export function parseManaProduction(
  face: CardFace,
  typeLine: ParsedTypeLine,
  warn: Warn = NOOP_WARN,
): ManaProduction[] {
  const out: ManaProduction[] = [];
  const seen = new Set<string>();

  const push = (p: Omit<ManaProduction, 'abilityIndex'>): void => {
    const withIndex: ManaProduction = { ...p, abilityIndex: out.length };
    const key = outputKey(withIndex);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(withIndex);
  };

  // 1. Intrinsic, from basic land types.
  if (typeLine.types.includes('Land')) {
    for (const sub of typeLine.subtypes) {
      const sym = BASIC_TYPE_MANA[sub];
      if (!sym) continue;
      push({
        outputs: [{ mana: pool({ [sym]: 1 }), amount: 1 }],
        anyColor: null,
        requiresTap: true,
        conditional: false,
        text: `{T}: Add {${sym}}. (${sub})`,
        // Intrinsic — it belongs to no line of text. Tundra's oracle text is
        // literally the empty string.
        line: null,
      });
    }
  }

  // 2. Printed abilities, one per line.
  //
  // ⚠️ A line entirely inside parentheses is REMINDER text and is skipped.
  // Measured against the real data: Tundra reads `({T}: Add {W} or {U}.)` and
  // basic Forest reads `({T}: Add {G}.)`, so parsing reminder text would give
  // Tundra a third, spurious "tap for W or U" ability alongside the two real
  // intrinsic ones — one physical land offering three tap options in the
  // payment UI. The intrinsic land-type pass above already has these covered.
  for (const [lineIndex, raw] of (face.oracleText ?? '').split('\n').entries()) {
    const printed = raw.trim();
    if (printed.startsWith('(') && printed.endsWith(')')) continue;
    // ⚠️⚠️ **SCRUBBED, AND EVERYTHING BELOW READS THE SCRUBBED COPY.** Reminder
    // text and quoted text are somebody ELSE'S mana ability, not this card's:
    //   · `Noggle Robber` creates a Treasure, and the Treasure's reminder text
    //     spells out "{T}, Sacrifice this token: Add one mana of any color." —
    //     inside the Noggle's own line, so the whole-line check above never saw
    //     it and the Noggle was recorded as a mana source.
    //   · A card that GRANTS "{T}: Add {G}" to something else was likewise read
    //     as having the ability itself. This is the Teferi bug `parseWard`
    //     already documents, one parser along.
    // Measured at **310 cards** when D124 found it and left it as a reportable.
    // ⚠️ `scrub` blanks with SPACES OF THE SAME LENGTH, so every index below
    // still lines up with what is printed — including the colon, which is the
    // point: a colon inside a quoted granted ability is not this card's
    // activation colon, and blanking it is the correct answer rather than a
    // side effect.
    const line = scrub(printed);
    if (!/\badd\b/i.test(line)) continue;
    const colon = line.indexOf(':');
    // ⚠️⚠️ **AN ACTIVATED LINE, OR IT IS NOT A MANA ABILITY (CR 605.1a).** A mana
    // ability is an activated ability — a cost, a colon, an effect — and this
    // loop used to accept a colon-less line with `cost = ''`, so any sentence
    // containing the word "add" became one.
    //
    // ⚠️ Found by the scrub above rather than reasoned out, which is worth
    // recording: `Braid of Fire` reads "Cumulative upkeep—Add {R}." and its
    // REMINDER text says "unless you pay its upkeep cost". That "unless" was
    // what `CONDITIONAL_RE` had been matching, so the card was marked
    // conditional for a reason that had nothing to do with the card — and the
    // moment reminder text stopped being read, a cumulative upkeep the engine
    // does not implement started looking like a plain, fully-run mana ability.
    // The disclosure would have gone silent on it (D122's failure, exactly).
    // D124 already stated this rule for the tier-3 NOTE; the production itself
    // had never checked it.
    if (colon < 0) continue;
    const cost = line.slice(0, colon);
    const effect = line.slice(colon + 1);
    if (!/\badd\b/i.test(effect)) continue;

    const requiresTap = /\{T\}/.test(cost);
    // ⚠️ Any activation cost beyond {T} makes the source unusable for auto-tap:
    // the solver would have to model paying mana to make mana, and a sacrifice
    // or a life payment is a decision the player must make. Marked conditional,
    // so it stays MANUALLY tappable. This is the Tier-2/Tier-3 line, stated.
    const extraCost = cost.replace(/\{T\}/g, '').replace(/[,\s]/g, '') !== '';
    const conditional = extraCost || CONDITIONAL_RE.test(effect) || /\bonly\b/i.test(line);

    // "Add one mana of any color", "Add two mana of any one color".
    // ⚠️ "any TYPE" as well as "any color". Reflecting Pool, Horizon of Progress
    // and Plaza of Harmony all read "one mana of any TYPE that a land you
    // control could produce", so a pattern that only knew "color" did not match
    // them at all — `producesMana` came out EMPTY and the most-played
    // colour-fixing land in the format produced nothing.
    // ⚠️ **"THE CHOSEN COLOR" — the consumer that makes D136's `chosen` field
    // pay for itself** (D147). 17 cards read it, and 9 of them also print "As
    // this ~ enters, choose a color", so the engine can answer the question and
    // then honour the answer with no card script at all — `Sol Grail` is the
    // whole card in those two lines.
    //
    // ⚠️ It is a SCOPE beside `identity` and `landsYou`, not a new mechanism:
    // "one mana of X" where X is a set the engine can resolve is exactly what
    // `anyColor` already models. The set here has one member and lives on the
    // permanent rather than on the board.
    if (/\badd one mana of the chosen colou?r\b/i.test(effect)) {
      push({
        outputs: [],
        anyColor: { scope: 'chosen', amount: 1 },
        requiresTap,
        // NOT conditional: the engine knows the chosen colour exactly, the same
        // way it knows a commander's identity. Before the choice is answered it
        // resolves to the empty set and the source simply offers nothing.
        conditional: extraCost,
        text: printed,
        line: lineIndex,
      });
      continue;
    }

    const anyMatch = effect.match(
      /add\s+(one|two|three|a|an|X)\s+mana\s+of\s+any\s+(?:one\s+)?(color|colour|type)([^.]*)/i,
    );
    if (anyMatch) {
      const amount = wordToNumber(anyMatch[1] ?? 'one');
      if (amount === null) {
        warn('mana:variableAmount');
        continue;
      }
      const tail = (anyMatch[3] ?? '').toLowerCase();
      const identityScoped = tail.includes("commander's color identity") || tail.includes('commander’s color identity');
      // ⚠️ EXACTLY these two phrasings, and nothing looser. "a Gate you control
      // could produce" is the same SHAPE and a different SET, and answering it
      // with every colour your lands make would offer mana the card cannot
      // produce — the never-half-execute rule (D90) applied to a land. Anything
      // else keeps falling through to the warning below.
      const boardScope = /\ba land you control could produce\b/.test(tail)
        ? ('landsYou' as const)
        : /\ba land an opponent controls could produce\b/.test(tail)
          ? ('landsOpponents' as const)
          : null;
      if (!identityScoped && !boardScope && /\bcould produce\b/.test(tail)) {
        // Same shape, a set we cannot resolve. Counted, not guessed at.
        warn('mana:anyScopeUnread');
        continue;
      }
      if (tail.includes('combination')) warn('mana:anyCombination');
      const scope = identityScoped ? ('identity' as const) : (boardScope ?? ('all' as const));
      push({
        outputs: [],
        anyColor: { scope, amount },
        requiresTap,
        // An identity-scoped land (Command Tower) is NOT conditional: the engine
        // knows the controller's commander identity exactly. Nor is a
        // board-scoped one — it knows what is on the battlefield exactly too.
        conditional: scope === 'all' ? conditional : extraCost,
        text: printed,
        line: lineIndex,
      });
      continue;
    }

    // "Add {G}", "Add {C}{C}", "Add {W} or {U}", "Add {B}{B} or {U}{U}".
    const addClause = effect.slice(effect.search(/\badd\b/i) + 3);
    const stopAt = addClause.search(/[.;]/);
    const symbolsPart = stopAt >= 0 ? addClause.slice(0, stopAt) : addClause;
    if (!/\{/.test(symbolsPart)) {
      warn('mana:noSymbols');
      continue;
    }
    const alternatives = symbolsPart.split(/\bor\b|,/i);
    const outputs: ManaOutput[] = [];
    let bad = false;
    for (const alt of alternatives) {
      const tokens = alt.match(/\{[^}]+\}/g);
      if (!tokens) continue;
      const acc: Record<string, number> = {};
      let amount = 0;
      for (const token of tokens) {
        const sym = token.slice(1, -1).toUpperCase();
        if (sym === 'S') {
          // Snow mana: treated as colourless in the pool, since restricted mana
          // is out of scope for v1 (spec Q8).
          acc['C'] = (acc['C'] ?? 0) + 1;
          amount++;
          continue;
        }
        if (COLOR_LETTERS.has(sym) || sym === 'C') {
          acc[sym] = (acc[sym] ?? 0) + 1;
          amount++;
          continue;
        }
        bad = true;
      }
      if (amount > 0) outputs.push({ mana: pool(acc as Partial<Record<keyof ManaPool, number>>), amount });
    }
    if (bad) warn('mana:unknownSymbolInAbility');
    if (outputs.length === 0) {
      warn('mana:noUsableOutput');
      continue;
    }
    push({ outputs, anyColor: null, requiresTap, conditional, text: printed, line: lineIndex });
  }

  return out;
}

function wordToNumber(word: string): number | null {
  switch (word.toLowerCase()) {
    case 'a':
    case 'an':
    case 'one':
      return 1;
    case 'two':
      return 2;
    case 'three':
      return 3;
    default:
      return null;
  }
}

// ── the whole face ───────────────────────────────────────────────────────────

/** `*`, `1+*`, `X` and `?` are not numbers — a script would set them (none in v1). */
function baseNumber(printed: string | null): number | null {
  if (printed === null || printed === undefined) return null;
  const trimmed = printed.trim();
  if (trimmed === '') return null;
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function parseFace(card: CardData, faceIndex: number, warn: Warn = NOOP_WARN): OracleFace {
  const face = card.faces[faceIndex] ?? card.faces[0];
  if (!face) throw new Error(`card ${card.scryfallId} has no faces`);
  const typeLine = parseTypeLine(face.typeLine, warn);
  const manaCost = parseManaCost(face.manaCost, warn);
  const keywords = parseKeywords(card, faceIndex, warn);
  const isCreature = typeLine.types.includes('Creature');
  const isLand = typeLine.types.includes('Land');
  const isPermanent = isPermanentType(typeLine);
  const protection = parseProtection(face.oracleText, warn);
  const landwalk = parseLandwalk(face.oracleText);
  const wardCost = parseWard(face.oracleText, warn);
  const wardLife = parseWardLife(face.oracleText, warn);
  const flashbackCost = isPermanent ? null : parseFlashback(face.oracleText, warn);
  const morph = isPermanent ? parseMorph(face.oracleText, warn) : null;
  const costReductions = parseCostReductions(face.oracleText);
  const toxicAmount = keywords.includes('toxic') ? parseToxic(face.oracleText) : 0;
  const producesMana = parseManaProduction(face, typeLine, warn);
  // ⚠️ Abilities are parsed BEFORE spell targets and are handed `producesMana`,
  // so "is this line a mana ability?" is answered by matching line index against
  // the parser that already decided it — never by a second heuristic here.
  const activated = parseActivatedAbilities(
    { oracleText: face.oracleText, isPermanent, producesMana, parseCost: parseManaCost },
    warn,
  );
  const targets = parseSpellTargets(face.oracleText, isPermanent, warn);
  const isInstantOrSorcery =
    typeLine.types.includes('Instant') || typeLine.types.includes('Sorcery');
  const parsedEffects = parseEffects(face.oracleText, face.name, isInstantOrSorcery, warn);

  // ⚠️ THE COVERAGE MEASUREMENT, and it belongs here rather than in
  // `parseKeywords` because only this function can see every Tier-2 field.
  // "This card has keywords and we automate none of them" is only true if the
  // face also produced no landwalk, no protection and no ward — all three of
  // which are Tier-2 facts carried outside the keyword array by design.
  //
  // Counting them as misses inflated the headline number by thousands of cards
  // and, worse, pointed the next milestone at work that was already done.
  const producedTier2 =
    keywords.length > 0 ||
    landwalk.length > 0 ||
    protection.colors.length > 0 ||
    protection.fromEverything ||
    wardCost !== null ||
    wardLife > 0;
  if (card.keywords.length > 0 && !producedTier2 && card.faces.length === 1) {
    warn('keywords:noneTier2');
  }

  return {
    name: face.name,
    typeLine,
    oracleText: face.oracleText,
    manaCost,
    colors: face.colors,
    printedPower: face.power,
    printedToughness: face.toughness,
    printedLoyalty: face.loyalty,
    printedDefense: face.defense,
    basePower: baseNumber(face.power),
    baseToughness: baseNumber(face.toughness),
    baseLoyalty: baseNumber(face.loyalty),
    baseDefense: baseNumber(face.defense),
    keywords,
    protection,
    landwalk,
    producesMana,
    isPermanent,
    isCreature,
    isLand,
    instantSpeed: typeLine.types.includes('Instant') || keywords.includes('flash'),
    wardCost,
    flashbackCost,
    morphCost: morph?.cost ?? null,
    morphCostText: morph?.text ?? null,
    megamorph: morph?.mega ?? false,
    costReductions,
    wardLife,
    toxicAmount,
    targets,
    activated,
    effects: parsedEffects.effects,
    effectMode: parsedEffects.mode,
    // ⚠️ Only a PERMANENT can enter the battlefield, so an instant whose text
    // somehow matched would be claiming a rule it can never reach.
    entersTapped: isPermanent ? parseEntersTapped(face.oracleText, face.name) : null,
    choosesColorOnEntry: isPermanent && parseChoosesColorOnEntry(face.oracleText),
  };
}
