// Replacement effects the engine can run, read from printed text.
//
// ⚠️ ONE CLAUSE SO FAR, and it is the one worth having: "this land enters
// tapped". D134 measured the `replacement` bucket and found 661 blocked cards
// carrying that line — 517 of them lands. It is CR 614.1c, a SELF-replacement
// with no ordering and no interaction with anything else: a property of the
// card, readable from its text, and therefore a built-in rule rather than a card
// script. Exactly the shape D107 used for "enters with loyalty counters".
//
// ⚠️ D135 ADDED THE CONDITION. 112 more cards say "enters tapped UNLESS …", and
// the measurement is what shaped the vocabulary below: 40 distinct wordings, of
// which seven QUERIES cover 104. The rest are refused.
//
// ⚠️ D136 ADDED THE EIGHTH, AND IT IS A QUESTION. "As this land enters, you may
// pay 2 life. If you don't, it enters tapped." was D135's named refusal — right
// then, because an engine that silently declined to pay would be making the
// player's decision for them, and there was nowhere to ask. There is now
// (`Awaiting.entersChoice`), so it is a `payLife` CONDITION rather than a
// refusal: the same normalising-at-parse-time that turned the inverted wording
// into one evaluator, applied to a sentence that means the same thing.
//
// ⚠️ THE REST OF THE BUCKET IS NOT THIS. "If a creature would die, exile it
// instead" (108 cards) and the other `instead` clauses (133) need the general
// CR 614 machinery, which is live since D134, plus CR 616's ordering CHOICE,
// which is a prompt and is not built. Nothing here pretends to read them.

import type { ColorLetter } from './cardTypes';
import { selfRef } from './effectParse';
import { scrub } from './targetParse';

/** A permanent this condition is looking for. Every named field must match. */
export interface PermanentPredicate {
  readonly supertypes: readonly string[];
  readonly types: readonly string[];
  readonly subtypes: readonly string[];
  readonly colors: readonly ColorLetter[];
}

/**
 * A board query the engine can answer with no input from anybody.
 *
 * ⚠️ CLOSED, and every member is here because the database has cards for it.
 * Nothing is modelled speculatively: a shape the pool does not print is a shape
 * that cannot be tested against a real card.
 */
export type EntersTappedCondition =
  /**
   * `you may pay 2 life` — THE ONLY MEMBER THAT IS A QUESTION RATHER THAN A
   * QUERY, and the reason it is in this union at all.
   *
   * ⚠️ **D135 REFUSED THIS, and the refusal was right at the time.** "As this
   * land enters, you may pay 2 life. If you don't, it enters tapped." reads as a
   * board query only if the engine answers it, which means declining every time,
   * silently — the player never offered the choice the card gives them. It is a
   * condition now because there is somewhere to ASK: `Awaiting.entersChoice`.
   *
   * ⚠️ **It is the same SEMANTICS in a different sentence**, which is why it
   * lives here rather than in a second field. "You may pay 2 life, and if you
   * don't it enters tapped" IS "it enters tapped unless you pay 2 life" — the
   * same normalise-at-parse-time rule D135 used for the inverted wording, so
   * `withEntersTapped` has one shape to read and `engineComplete` one question
   * to ask.
   *
   * ⚠️ Every OTHER member can be evaluated with `conditionHolds`; this one
   * cannot, and a caller that forgets is asking a synchronous function a
   * question only a player can answer. `isAskedCondition` is that guard, and
   * `conditionHolds` refuses this kind rather than inventing an answer.
   */
  | { readonly kind: 'payLife'; readonly life: number }
  /** `you control two or more other lands` · `two or fewer other lands` */
  | { readonly kind: 'otherLands'; readonly at: 'least' | 'most'; readonly count: number }
  /** `you control two or more basic lands` */
  | { readonly kind: 'basicLands'; readonly count: number }
  /** `you control three or more other Islands` */
  | { readonly kind: 'otherLandsOfType'; readonly subtype: string; readonly count: number }
  /** `you have two or more opponents` */
  | { readonly kind: 'opponents'; readonly count: number }
  /** `a player has 13 or less life` — ANY player, including you */
  | { readonly kind: 'anyPlayerLifeAtMost'; readonly life: number }
  /** `your opponents control eight or more lands` */
  | { readonly kind: 'opponentsLands'; readonly count: number }
  /** `you control a Forest or a Plains` · `a basic land` · `a legendary creature` */
  | { readonly kind: 'controlPermanent'; readonly any: readonly PermanentPredicate[] };

/** `unless: null` means unconditionally tapped. */
export interface EntersTapped {
  readonly unless: EntersTappedCondition | null;
}

/**
 * Is this condition answered by a PLAYER rather than by the board?
 *
 * ⚠️ The one place that decides, so `triggers.ts` and `engineComplete.ts` cannot
 * disagree about which conditions need a prompt. A condition added to the union
 * and forgotten here would be handed to `conditionHolds`, which refuses it — the
 * land comes in tapped and the player is never asked, which is the exact
 * half-execution this member exists to prevent.
 */
export function isAskedCondition(
  c: EntersTappedCondition,
): c is Extract<EntersTappedCondition, { kind: 'payLife' }> {
  return c.kind === 'payLife';
}

const NUMBERS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
};

function count(raw: string | undefined): number | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key in NUMBERS) return NUMBERS[key] ?? null;
  if (/^\d+$/.test(key)) return Number(key);
  return null;
}

const N = '(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|\\d+)';

const CARD_TYPES = new Set([
  'Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle', 'Instant', 'Sorcery',
]);
const SUPERTYPES = new Set(['Basic', 'Legendary', 'Snow', 'World']);
const COLOURS: Readonly<Record<string, ColorLetter>> = {
  white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G',
};

/**
 * `a legendary green creature` · `a basic land` · `a Forest` · `a Mount`
 *
 * ⚠️ Returns null for anything with a word it cannot place. The alternative is a
 * predicate that quietly ignores an adjective — and "you control a legendary
 * creature" evaluated as "you control a creature" is a land that comes in
 * untapped when it should not, on a card that reads correctly.
 */
function predicateOf(phrase: string): PermanentPredicate | null {
  const words = phrase.trim().replace(/^(?:a|an)\s+/i, '').split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return null;
  const supertypes: string[] = [];
  const types: string[] = [];
  const subtypes: string[] = [];
  const colors: ColorLetter[] = [];
  for (const raw of words) {
    const word = raw.replace(/[.,]$/, '');
    const cap = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    if (word.toLowerCase() in COLOURS) {
      colors.push(COLOURS[word.toLowerCase()] as ColorLetter);
      continue;
    }
    if (SUPERTYPES.has(cap)) {
      supertypes.push(cap);
      continue;
    }
    if (CARD_TYPES.has(cap)) {
      types.push(cap);
      continue;
    }
    // A capitalised word that is not a card type is a SUBTYPE — `Forest`,
    // `Mount`, `Vehicle`, `Dragon`. Lowercase words that reach here are
    // unplaceable and the whole predicate is refused.
    if (/^[A-Z]/.test(word)) {
      subtypes.push(word);
      continue;
    }
    return null;
  }
  if (supertypes.length + types.length + subtypes.length + colors.length === 0) return null;
  return { supertypes, types, subtypes, colors };
}

/** `a Forest or a Plains` · `a Mount or Vehicle` → one predicate per alternative. */
function predicatesOf(phrase: string): readonly PermanentPredicate[] | null {
  const parts = phrase.split(/\bor\b/).map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length === 0) return null;
  const out: PermanentPredicate[] = [];
  for (const part of parts) {
    const p = predicateOf(part);
    if (!p) return null;
    out.push(p);
  }
  return out;
}

/**
 * The seven board queries, tried in order.
 *
 * ⚠️ EVERY PATTERN IS ANCHORED AT BOTH ENDS, the same rule `effectParse`'s
 * vocabulary follows. A condition with a word left over is a condition this
 * module has not read, and reading three quarters of one is how a land comes in
 * untapped on a board where it should not.
 */
const CONDITIONS: readonly (readonly [RegExp, (m: RegExpMatchArray) => EntersTappedCondition | null])[] = [
  [
    new RegExp(`^you control (${N}) or (more|fewer) other lands$`, 'i'),
    (m) => {
      const n = count(m[1]);
      return n === null ? null : { kind: 'otherLands', at: m[2]?.toLowerCase() === 'more' ? 'least' : 'most', count: n };
    },
  ],
  [
    new RegExp(`^you control (${N}) or more basic lands$`, 'i'),
    (m) => {
      const n = count(m[1]);
      return n === null ? null : { kind: 'basicLands', count: n };
    },
  ],
  [
    new RegExp(`^you control (${N}) or more other ([A-Z][a-z]+)s$`, ''),
    (m) => {
      const n = count(m[1]);
      const subtype = m[2];
      return n === null || !subtype ? null : { kind: 'otherLandsOfType', subtype, count: n };
    },
  ],
  [
    new RegExp(`^you have (${N}) or more opponents$`, 'i'),
    (m) => {
      const n = count(m[1]);
      return n === null ? null : { kind: 'opponents', count: n };
    },
  ],
  [
    new RegExp(`^a player has (${N}) or less life$`, 'i'),
    (m) => {
      const n = count(m[1]);
      return n === null ? null : { kind: 'anyPlayerLifeAtMost', life: n };
    },
  ],
  [
    new RegExp(`^your opponents control (${N}) or more lands$`, 'i'),
    (m) => {
      const n = count(m[1]);
      return n === null ? null : { kind: 'opponentsLands', count: n };
    },
  ],
  [
    /^you control (.+)$/i,
    (m) => {
      const any = predicatesOf(m[1] ?? '');
      return any === null ? null : { kind: 'controlPermanent', any };
    },
  ],
];

function conditionOf(phrase: string): EntersTappedCondition | null {
  const s = phrase.trim().replace(/\.$/, '').trim();
  for (const [re, build] of CONDITIONS) {
    const m = re.exec(s);
    if (m) return build(m);
  }
  return null;
}

/**
 * The card's own name and every way it refers to itself, as `~`.
 *
 * ⚠️ `selfRef` ALONE IS NOT ENOUGH, and the card that proves it is `Lair of the
 * Hydra`: "If you control two or more other lands, THIS LAND enters tapped."
 * `selfRef` matches `This land` with a capital T, because every clause it was
 * written for starts a sentence — and the inverted wording says it mid-sentence,
 * in lower case. The clause parsed as nothing, so the land came in untapped on
 * every board, which is the failure that looks like the feature working.
 */
const SELF = /\bthis (?:spell|creature|permanent|artifact|enchantment|land|token)\b/gi;

function normalise(line: string, cardName: string): string {
  return scrub(selfRef(line.trim(), cardName)).replace(SELF, '~').trim();
}

const UNCONDITIONAL = /^~ enters(?: the battlefield)? tapped\.$/i;
const UNLESS = /^~ enters(?: the battlefield)? tapped unless (.+)\.$/i;
/** `If you control two or more other lands, this land enters tapped.` */
const IF_TAPPED = /^if (.+), ~ enters(?: the battlefield)? tapped\.$/i;
/**
 * `As this land enters, you may pay 2 life. If you don't, it enters tapped.`
 *
 * ⚠️ **ANCHORED AT BOTH ENDS LIKE EVERY OTHER CLAUSE HERE, and this one has the
 * most to refuse.** The database prints eight other "you may pay … if you don't"
 * sentences (D136) and every one of them is a different rule: `Knight of the
 * Mists` destroys a Knight, `Chaos Spewer` blights, `Rogue Skycaptain` removes
 * wage counters, `Multiversal Passage` chooses a basic land type FIRST. All of
 * them contain a clause that looks like this one, and a prefix match would take
 * 2 life from a player and drop the sentence that mattered.
 *
 * ⚠️ The COST IS DIGITS ONLY. The shape is printed with `2` and `3` and nothing
 * else, and a word-number here would be a member of the vocabulary no card can
 * test — the rule this file has followed since D135.
 */
const PAY_TO_UNTAP = /^as ~ enters, you may pay (\d+) life\. if you don'?t, (?:it|~) enters(?: the battlefield)? tapped\.$/i;

/**
 * ⚠️ The INVERTED wording is the same query with its polarity flipped, and
 * normalising it here rather than in the engine is what keeps ONE evaluator.
 * "enters tapped IF you control ≥2 other lands" is exactly "enters tapped UNLESS
 * you control ≤1 other lands". Only `otherLands` prints this way (5 cards), and
 * inverting anything else would be a guess — so anything else is refused.
 */
function invert(condition: EntersTappedCondition): EntersTappedCondition | null {
  if (condition.kind !== 'otherLands') return null;
  return condition.at === 'least'
    ? { kind: 'otherLands', at: 'most', count: condition.count - 1 }
    : { kind: 'otherLands', at: 'least', count: condition.count + 1 };
}

/**
 * Read ONE line as an enters-tapped clause.
 *
 * ⚠️ **ANCHORED AT BOTH ENDS, AND THE ANCHOR IS THE WHOLE SAFETY PROPERTY.** The
 * text this has to refuse is everywhere in the format:
 *
 *   · `As this land enters, you may pay 3 life. If you don't, it enters tapped.`
 *   · `This land enters tapped WITH two charge counters on it.`
 *   · `Grimgrin enters tapped AND doesn't untap during your untap step.`
 *
 * The first is a PROMPT — 37 cards — and an engine that silently declined to pay
 * would be making the player's decision for them. The others carry a second rule
 * the engine does not run. Every one of them CONTAINS a clause this module reads,
 * and a prefix match would execute the part it recognised and drop the rest,
 * which is D90's failure.
 */
export function parseEntersTappedLine(line: string, cardName: string): EntersTapped | null {
  const s = normalise(line, cardName);
  if (UNCONDITIONAL.test(s)) return { unless: null };
  const pay = PAY_TO_UNTAP.exec(s);
  if (pay) {
    const life = Number(pay[1]);
    // A cost of 0 would be a prompt whose two answers are the same board.
    return life > 0 ? { unless: { kind: 'payLife', life } } : null;
  }
  const unless = UNLESS.exec(s);
  if (unless) {
    const condition = conditionOf(unless[1] ?? '');
    return condition === null ? null : { unless: condition };
  }
  const iff = IF_TAPPED.exec(s);
  if (iff) {
    const condition = conditionOf(iff[1] ?? '');
    if (condition === null) return null;
    const flipped = invert(condition);
    return flipped === null ? null : { unless: flipped };
  }
  return null;
}

/**
 * Does this face enter the battlefield tapped, and under what condition?
 *
 * Read per LINE, so a card whose second line happens to mention tapping cannot
 * make its first one true.
 */
export function parseEntersTapped(oracleText: string, cardName: string): EntersTapped | null {
  if (!oracleText) return null;
  for (const line of oracleText.split('\n')) {
    const hit = parseEntersTappedLine(line, cardName);
    if (hit) return hit;
  }
  return null;
}

/**
 * "As this ~ enters, choose a color." — CR 614.12, and one of the three shapes
 * the `asEnters` family takes.
 *
 * ⚠️ **ONLY THE COLOUR, and refusing the other two is the decision.** Measured
 * over the Commander-legal pool: 52 colour lines, 58 creature type, 12 opponent,
 * 5 player. Colour is the ONLY one with a consumer the engine already has —
 * `{T}: Add one mana of the chosen color`, which `parseManaProduction` models as
 * an `anyColor` scope. Creature type and opponent are read only by card text
 * that needs a script (M6.4), so asking those questions today would store an
 * answer nothing reads: D136's "a prompt as theatre, worse than the silence it
 * replaced".
 *
 * ⚠️ ANCHORED AT BOTH ENDS, like every other rule in this file. "choose a color
 * OTHER THAN BLACK" and "choose a color, then …" are different sentences and a
 * prefix match would answer them both with the wrong question.
 */
const CHOOSE_COLOR_RE = /^As (?:this [a-z]+|[A-Z][^,]*) enters, choose a colou?r\.$/;

export function parseChoosesColorOnEntry(oracleText: string): boolean {
  return oracleText.split('\n').some((line) => CHOOSE_COLOR_RE.test(line.trim()));
}
