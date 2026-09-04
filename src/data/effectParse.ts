// What a card DOES, parsed once at ingest — the part the engine executes.
//
// ⚠️ THE RULE THAT SHAPES EVERY LINE BELOW: never half-execute a card. A face is
// `auto` only when EVERY sentence of it is understood. `Beast Within` reads
// "Destroy target permanent. Its controller creates a 3/3 green Beast creature
// token." — destroying the permanent and silently skipping the token is worse
// than doing nothing, because the player cannot see what was missed and has no
// reason to check. Measured over the Commander-legal pool: 274 spells are
// understood completely, 1,300 are this shape. The 1,300 become `assisted` — the
// app offers the part it understands as a one-click, logged, manual action and
// says the rest is yours.
//
// ⚠️ THE VOCABULARY IS CLOSED, and that is what makes the rule hold. The first
// cut of this used `[a-z ]+` for a target phrase and "understood" Homing
// Lightning ("deals 4 damage to target creature AND each other creature with the
// same name as that creature") and Spell Blast ("counter target spell WITH MANA
// VALUE X"). Both matched on their prefix. A closed noun list cannot do that:
// anything outside it simply is not understood.
//
// ⚠️ Same Tier-2 boundary as everywhere else — an effect the engine cannot
// express as EVENTS is an effect it must not claim. `tier3.ts` asks this module
// what it understood, and says so on the card.

import type { CounterKind, EffectKind, EffectMode, EffectSpec, Keyword } from '../engine/types/oracle';
import type { Warn } from './oracleParse';
import { scrub } from './targetParse';
import { parseTokenClause, specKey } from './tokenParse';
import { TOKEN_TABLE } from './tokenTable';

const NOOP_WARN: Warn = () => undefined;

/**
 * The target phrases this module admits, matching the coarse kinds `TargetSpec`
 * already models. Longest first, so `creature or planeswalker` cannot be eaten
 * by `creature`.
 */
const NOUNS = [
  // ⚠️ D293: admitted only because `targetParse` now reads the same lists.
  'artifact, enchantment, or creature',
  'artifact, creature, or land',
  'creature, planeswalker, or battle',
  'creature, planeswalker, or player',
  'creature, enchantment, or planeswalker',
  // ⚠️ NOT "spell or creature" (D293): the target parser reads it, but the
  // auto bounce has no path for a SPELL on the stack — Unsubstantiate aimed at
  // a held creature spell let it resolve. Admitting the sentence would ship a
  // half-executing card; it waits on a stack-aware bounce (or a script).
  'creature or sorcery spell',
  'attacking or blocking creature',
  'creature an opponent controls',
  "creature you don't control",
  'creature you don’t control',
  // ⚠️ The typed-spell forms sit ABOVE their permanent lookalikes and are
  // admitted ONLY because `targetAllowed` enforces the type against the cast
  // face (D198) — D139's order: enforce first, then admit the wording.
  'artifact or enchantment spell',
  'enchantment spell',
  'artifact spell',
  'instant or sorcery spell',
  'artifact, creature, or planeswalker',
  'artifact, creature, or enchantment',
  'artifact or enchantment',
  'creature or planeswalker',
  'player or planeswalker',
  'creature or enchantment',
  'artifact or creature',
  'creature or player',
  'permanent you control',
  'attacking creature',
  'blocking creature',
  'creature you control',
  'artifact you control',
  'nonland permanent',
  'noncreature spell',
  'creature spell',
  // ⚠️ D297: subtype nouns and one list, admitted ONLY because `targetParse`
  // enforces the subtype (`restrict.subtypesAll`) and the list per alternative.
  'artifact creature',
  'creature or vehicle',
  'equipment you control',
  'equipment',
  'vehicle',
  'aura',
  'wall',
  'plains',
  'island',
  'swamp',
  'mountain',
  'forest',
  'planeswalker',
  'enchantment',
  'permanent',
  'creatures',
  'creature',
  'opponent',
  'artifact',
  'players',
  'player',
  'spell',
  'land',
].join('|');

/**
 * A numeric qualifier the TARGETING layer now enforces (D139).
 *
 * ⚠️ **THIS MAY ONLY BE ACCEPTED BECAUSE `targetAllowed` CHECKS IT.** Widening
 * the target macro is the exact move D138 refused for "with mana value 3 or
 * less", and refused correctly: at the time `TargetSpec` had no field for the
 * restriction, so a spell matching the longer sentence would have destroyed or
 * reanimated ANYTHING. The order matters and is the whole point — enforce
 * first, then admit the wording. Doing it the other way round is how a card
 * that reads correctly runs incorrectly.
 *
 * ⚠️ Digits only, matching `NumericRestriction`'s own vocabulary; "with mana
 * value X or less" is not a number known at parse time.
 */
/**
 * ⚠️ And the KEYWORD qualifier (D289), admitted for the same reason and in the
 * same order: `TargetSpec.keyword` exists and `targetAllowed` enforces it on
 * DERIVED keywords, so "Destroy target creature with flying." may now be read
 * as the destroy it is. The list is `TIER2_KEYWORDS` in print spelling; a
 * word outside it keeps the sentence unread, as before.
 */
const KEYWORD_QUALIFIER =
  ' with(?:out)? (?:flying|reach|trample|vigilance|haste|lifelink|deathtouch|first strike|double strike|menace|defender|indestructible|flash|fear|intimidate|skulk|shadow|horsemanship|hexproof|shroud|infect|wither|toxic)';
const QUALIFIER = `(?: with (?:mana value|converted mana cost|power|toughness) \\d+ or (?:less|greater|more)|${KEYWORD_QUALIFIER})?`;
/**
 * ⚠️ The adjectives the TARGETING layer enforces since D294 — and ONLY those
 * (a word the target parser leaves unenforced must not be admitted here, or
 * a card would read whole over a restriction nothing checks). Same order as
 * D139 and D289: enforce first, then admit the wording.
 */
const ADJECTIVE =
  // D297: `non-[a-z]+` is the HYPHENATED subtype negation ("non-Elf"), enforced by targetParse.
  // D298: a comma between two adjectives ("nonartifact, nonblack creature") is print; the target parser reads it.
  '(?:(?:non(?:artifact|creature|enchantment|land|planeswalker|battle|white|blue|black|red|green|legendary|basic|snow|token)|non-[a-z]+|white|blue|black|red|green|colorless|multicolored|monocolored|tapped|untapped|legendary|basic|snow|token),?\\s+)*';
// D299: a COUNTED clause — "up to one", "up to two", "up to three", "two",
// "three", "any number of", each of them optionally behind "each of" — with its
// noun in the plural print uses. The target parser reads the same count into
// the spec (0..N / N..N); the consumer runs the clause once per pick. "X" stays
// out: the count is not known at parse time and the spec is left unconfident.
const COUNTED = '(?:(?:each of )?(?:up to (?:one|two|three)|two|three|any number of) )?';
const TARGET = `(?:any target|${COUNTED}target ${ADJECTIVE}(?:${NOUNS})s?${QUALIFIER})`;
const NUM = '(?:\\d+)';

const WORD_NUMBERS: Readonly<Record<string, number>> = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
};

function num(raw: string | undefined): number | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key in WORD_NUMBERS) return WORD_NUMBERS[key] ?? null;
  if (/^\d+$/.test(key)) return Number(key);
  return null; // "X" is not known at parse time.
}

/** `kind` comes from the rule; `text` is the sentence. The rest is built here. */
type EffectFields = Omit<EffectSpec, 'text' | 'kind'>;

interface Rule {
  readonly kind: EffectKind;
  readonly re: RegExp;
  /** Builds the spec, or returns null when a captured number is unusable. */
  readonly build: (m: RegExpMatchArray) => EffectFields | null;
}

const BASE: EffectFields = {
  amount: 0,
  power: 0,
  toughness: 0,
  keywords: [],
  targetIndex: 0,
  self: false,
  counterKind: null,
  token: null,
  look: null,
  atRandom: false,
  thenDraw: 0,
};

/**
 * ⚠️ **THE GRANTABLE KEYWORDS (D194)** — printed name → the Tier-2 member the
 * engine actually enforces. CLOSED deliberately: a keyword outside this map
 * ("banding", "protection from red" — a parameterised shape, not a word) makes
 * the whole sentence unread, which is D90's rule for grants: an unenforced
 * keyword granted "successfully" is a card half-working while looking whole.
 * `flash` is absent (a cast-time permission, meaningless until-end-of-turn on
 * a permanent already fielded here) and `toxic` is absent (it carries a
 * NUMBER, which this shape does not read).
 */
const GRANTABLE: ReadonlyMap<string, Keyword> = new Map<string, Keyword>([
  ['flying', 'flying'],
  ['reach', 'reach'],
  ['trample', 'trample'],
  ['vigilance', 'vigilance'],
  ['haste', 'haste'],
  ['lifelink', 'lifelink'],
  ['deathtouch', 'deathtouch'],
  ['first strike', 'firstStrike'],
  ['double strike', 'doubleStrike'],
  ['menace', 'menace'],
  ['defender', 'defender'],
  ['indestructible', 'indestructible'],
  ['hexproof', 'hexproof'],
  ['shroud', 'shroud'],
  ['fear', 'fear'],
  ['intimidate', 'intimidate'],
  ['skulk', 'skulk'],
  ['shadow', 'shadow'],
  ['horsemanship', 'horsemanship'],
  ['infect', 'infect'],
  ['wither', 'wither'],
]);
const KW = [...GRANTABLE.keys()].sort((a, b) => b.length - a.length).join('|');

function grantedKeywords(...raw: (string | undefined)[]): readonly Keyword[] | null {
  const out: Keyword[] = [];
  for (const r of raw) {
    if (r === undefined) continue;
    const k = GRANTABLE.get(r.toLowerCase());
    if (k === undefined) return null;
    if (!out.includes(k)) out.push(k);
  }
  return out.length > 0 ? out : null;
}

/**
 * The counters a spell may put on or take off — CLOSED at the two `derive.ts`
 * actually reads at layer 7d. See `CounterKind` for why a `charge counter` is
 * not here: recording a counter nothing applies is half-execution with a number
 * on it.
 */
const COUNTER_KIND = String.raw`(?:\+1/\+1|-1/-1)`;
const COUNT = '(?:a|one|two|three|four|five|six|seven|\\d+)';

/**
 * The nouns a graveyard-return sentence may name — CLOSED, and closed to exactly
 * the ones `targetParse` ENFORCES (D138).
 *
 * ⚠️ **A `.+` HERE IS A REAL BUG AND IT WAS CAUGHT BY ITS OWN TEST.** The first
 * cut read `^return target .+ from your graveyard to the battlefield\.$`, which
 * happily swallowed "creature card WITH MANA VALUE 3 OR LESS" — a restriction
 * `TargetSpec` has no field for and `targetAllowed` therefore cannot check. The
 * spell would have run, letting a player reanimate anything at all, on a card
 * that reads correctly. That is the D90 failure with the target clause doing the
 * lying instead of the effect clause.
 *
 * ⚠️ So the list is not "nouns that look like cards" — it is the three the
 * targeting layer can fully decide: no type at all, `Creature`, and the
 * `Instant`/`Sorcery` disjunction. `permanent card` is deliberately absent: its
 * noun entry still marks itself `unenforced`, so admitting it here would execute
 * a restriction nothing checks.
 */
// D298: the adjectives D294 enforces (with the comma print puts between two of
// them - "noncreature, nonland card") and the typed nouns the target parser
// reads now; "permanent card" is still deliberately absent (see above).
const GY_ADJECTIVE = ADJECTIVE.replace(/\\s\+\)\*$/, ',?\\s+)*');
// "permanent card" has been ENFORCED since D147 (six types, any-of); the note
// above that kept it out was stale. The two subtype cards and the two card
// lists are the measured shapes (d298/probe-gy.json), enforced by D297/D298.
const GY_NOUN = `${GY_ADJECTIVE}(?:artifact or enchantment card|artifact or creature card|instant or sorcery card|permanent card|creature card|artifact card|enchantment card|land card|planeswalker card|instant card|sorcery card|zombie card|goblin card|card)s?` + QUALIFIER;

function counterKindOf(raw: string | undefined): CounterKind | null {
  if (raw === '+1/+1' || raw === '-1/-1') return raw;
  return null;
}

/**
 * ⚠️ Every pattern is anchored at BOTH ends. A sentence with anything left over
 * is not understood — that is the whole safety property, and the reason these
 * read as strict rather than helpful.
 */
const RULES: readonly Rule[] = [
  {
    kind: 'damage',
    re: new RegExp(`^~ deals (${NUM}) damage to ${TARGET}\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n };
    },
  },
  { kind: 'destroy', re: new RegExp(`^destroy ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'exile', re: new RegExp(`^exile ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'counter', re: new RegExp(`^counter ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  {
    kind: 'bounce',
    re: new RegExp(`^return ${TARGET} to (?:its|their) owner(?:'|’)?s? hand\\.$`, 'i'),
    build: () => ({ ...BASE }),
  },
  {
    kind: 'pump',
    re: new RegExp(`^${TARGET} gets ([+-]${NUM})/([+-]${NUM}) until end of turn\\.$`, 'i'),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      return Number.isFinite(p) && Number.isFinite(t) ? { ...BASE, power: p, toughness: t } : null;
    },
  },
  /**
   * D194 — the pump-with-rider and the pure grant. Both are `pump` because
   * `untilEndOfTurn` is ONE carrier: the P/T halves and the keywords ride the
   * same entry and end at the same cleanup. A keyword outside GRANTABLE makes
   * `grantedKeywords` return null and the sentence stays unread — the closed
   * map IS the safety property here, exactly as `counterKindOf` is for
   * counters.
   */
  {
    kind: 'pump',
    re: new RegExp(
      `^${TARGET} gets ([+-]${NUM})/([+-]${NUM}) and gains (${KW})(?: and (${KW}))? until end of turn\\.$`,
      'i',
    ),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      const kws = grantedKeywords(m[3], m[4]);
      return Number.isFinite(p) && Number.isFinite(t) && kws !== null
        ? { ...BASE, power: p, toughness: t, keywords: kws }
        : null;
    },
  },
  {
    kind: 'pump',
    re: new RegExp(`^${TARGET} gains (${KW})(?: and (${KW}))? until end of turn\\.$`, 'i'),
    build: (m) => {
      const kws = grantedKeywords(m[1], m[2]);
      return kws !== null ? { ...BASE, keywords: kws } : null;
    },
  },
  /**
   * D195 — scry and surveil, the second and third effect kinds whose
   * resolution can stop and ask. The bare forms; the caster is the one who
   * looks, so there is no target.
   */
  {
    kind: 'scry',
    re: new RegExp(`^scry (${NUM})\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'surveil',
    re: new RegExp(`^surveil (${NUM})\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  /**
   * ⚠️ **THE DRAW RIDES THE SPEC, NEVER STANDS AFTER IT** — "Scry 2, then
   * draw a card." (Preordain) and "Surveil 1, then draw a card." (Consider)
   * are one printed sentence; Opt splits it as "Scry 1." then "Draw a
   * card.", which the two-pass window (D150) hands to the last rule below
   * as one string. All of them carry the draw INSIDE the scry spec because
   * the draw must see the library AS REORDERED: a separate draw effect in
   * the same batch would be built against the pre-answer state and take a
   * card the player had not placed yet. The answer handler emits the draw
   * against the post-choice state (D195).
   */
  {
    kind: 'scry',
    re: new RegExp(`^scry (${NUM}), then draw (a|one|two|three|four|five|six|seven|\\d+) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const d = num(m[2]);
      return n === null || d === null ? null : { ...BASE, amount: n, thenDraw: d, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'surveil',
    re: new RegExp(`^surveil (${NUM}), then draw (a|one|two|three|four|five|six|seven|\\d+) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const d = num(m[2]);
      return n === null || d === null ? null : { ...BASE, amount: n, thenDraw: d, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'scry',
    re: new RegExp(`^scry (${NUM})\\. (?:you )?draw (a|one|two|three|four|five|six|seven|\\d+) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const d = num(m[2]);
      return n === null || d === null ? null : { ...BASE, amount: n, thenDraw: d, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'surveil',
    re: new RegExp(`^surveil (${NUM})\\. (?:you )?draw (a|one|two|three|four|five|six|seven|\\d+) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const d = num(m[2]);
      return n === null || d === null ? null : { ...BASE, amount: n, thenDraw: d, targetIndex: -1, self: true };
    },
  },
  /**
   * D301 - the MASS pump: the subject is "creatures you control", so the clause
   * consumes no target slot and the consumer walks the board. The same three
   * shapes as the targeted pump above; the same closed keyword map.
   */
  {
    kind: 'massPump',
    re: new RegExp(`^creatures you control get ([+-]${NUM})/([+-]${NUM}) until end of turn\\.$`, 'i'),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      return Number.isFinite(p) && Number.isFinite(t) ? { ...BASE, power: p, toughness: t, targetIndex: -1, self: true } : null;
    },
  },
  {
    kind: 'massPump',
    re: new RegExp(
      `^creatures you control get ([+-]${NUM})/([+-]${NUM}) and gain (${KW})(?: and (${KW}))? until end of turn\\.$`,
      'i',
    ),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      const kws = grantedKeywords(m[3], m[4]);
      return Number.isFinite(p) && Number.isFinite(t) && kws !== null
        ? { ...BASE, power: p, toughness: t, keywords: kws, targetIndex: -1, self: true }
        : null;
    },
  },
  {
    kind: 'massPump',
    re: new RegExp(`^creatures you control gain (${KW})(?: and (${KW}))? until end of turn\\.$`, 'i'),
    build: (m) => {
      const kws = grantedKeywords(m[1], m[2]);
      return kws !== null ? { ...BASE, keywords: kws, targetIndex: -1, self: true } : null;
    },
  },
  { kind: 'tap', re: new RegExp(`^tap ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'untap', re: new RegExp(`^untap ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  {
    kind: 'draw',
    re: /^(?:you )?draw (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i,
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'gainLife',
    re: new RegExp(`^you gain (${NUM}) life\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'loseLife',
    re: new RegExp(`^target (?:player|opponent) loses (${NUM}) life\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n };
    },
  },
  /** D295. `Anguished Unmaking` - "You lose 3 life." - the controller, like `gainLife`. */
  {
    kind: 'loseLife',
    re: new RegExp(`^you lose (${NUM}) life\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  /**
   * D295. `Hideous End` - "Destroy target nonblack creature. Its controller
   * loses 2 life." and `Countersquall` - "Counter target noncreature spell.
   * Its controller loses 2 life." The aim is the FIRST target (the sentence
   * before named it); the player is its controller at resolution.
   */
  {
    kind: 'controllerLosesLife',
    re: new RegExp(`^its controller loses (${NUM}) life\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      // Consumes NO target of its own (`parseEffects` renumbers the ones that
      // do); the resolver reads the spell's FIRST target itself.
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  /** D295. `Introduction to Annihilation` - "Its controller draws a card." */
  {
    kind: 'controllerDraws',
    re: /^its controller draws (a|one|two|three) cards?\.$/i,
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  /**
   * D295. "It can't be regenerated." / "They can't be regenerated." - a
   * restriction on a mechanism the engine does not have (nothing regenerates,
   * ever), so the sentence is whole by construction. `self` so the resolver
   * never narrates a missing target for it.
   */
  {
    kind: 'noop',
    re: /^(?:it|they) can't be regenerated\.$/i,
    build: () => ({ ...BASE, targetIndex: -1, self: true }),
  },
  /**
   * M6.3c. `Battlegrowth` — "Put a +1/+1 counter on target creature." — and
   * `Scar`, which is the same sentence with `-1/-1` and can kill through the
   * state-based action rather than through damage.
   *
   * ⚠️ ANCHORED AT BOTH ENDS like every rule above it, and that anchor is doing
   * real work here rather than being a habit. `Burst of Strength` is
   * "Put a +1/+1 counter on target creature AND UNTAP IT." — one sentence, so
   * there is no second clause to fall foul of the assisted rule, and a pattern
   * that stopped at `creature` would execute two thirds of the card and call it
   * done. It comes out `manual`, which is correct and is pinned as a test.
   *
   * ⚠️ `X` is refused by `num()` returning null, exactly as it is for damage:
   * "Put X +1/+1 counters on target creature" is not known at parse time.
   */
  {
    kind: 'putCounters',
    re: new RegExp(`^put (${COUNT}) (${COUNTER_KIND}) counters? on ${TARGET}\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const kind = counterKindOf(m[2]);
      return n === null || kind === null ? null : { ...BASE, amount: n, counterKind: kind };
    },
  },
  {
    kind: 'removeCounters',
    re: new RegExp(`^remove (${COUNT}) (${COUNTER_KIND}) counters? from ${TARGET}\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const kind = counterKindOf(m[2]);
      return n === null || kind === null ? null : { ...BASE, amount: n, counterKind: kind };
    },
  },
  /**
   * M6.3f. `Raise the Alarm` — "Create two 1/1 white Soldier creature tokens."
   *
   * ⚠️ TWO GATES, and the second is the one that matters. The pattern here only
   * says the SHAPE is a whole-sentence token creation; `parseTokenClause` reads
   * it and `TOKEN_TABLE` says whether the description names exactly one printed
   * token. A description the table does not carry was REFUSED by the resolver —
   * unreadable, naming no printed token, or naming two — and this rule declines
   * it, so the sentence is not understood and the card never runs by itself.
   * See D132 for the four ways a token description lies, and D133 for why the
   * table is baked rather than consulted at resolution time.
   *
   * ⚠️ `self: true`, `targetIndex: -1` — the tokens go to the spell's
   * controller. A token creation aimed at a target ("target opponent creates…")
   * is a different sentence and is not in this vocabulary.
   */
  /**
   * M6.3j. `Mind Rot` — "Target player discards two cards." — and the whole
   * point of it is that the DISCARDING PLAYER CHOOSES (CR 701.8a), which is why
   * this is the first effect kind whose resolution can stop and ask.
   *
   * ⚠️ **ANCHORED AT BOTH ENDS, AND THE `$` IS DOING THE REFUSING.** Four
   * wordings sit one word past this one and every one is a different rule:
   *
   *   · `Target player discards two cards AT RANDOM.` — 54 lines, and **it has
   *     its own rule now** (D147, the entry above this one). It was refused for
   *     a milestone because `effectEvents` had no RNG and randomness in this
   *     engine comes only from the seeded generator threaded through the log;
   *     executing it as a CHOSEN discard would have handed the player a decision
   *     the card does not give them, which is D90 pointing the other way. The
   *     `$` still refuses it HERE, which is what keeps the two apart.
   *   · `Target player discards two cards AND LOSES 2 LIFE.` — one sentence, so
   *     the assisted rule never sees a second clause to decline.
   *   · `Target player discards two cards. SCRY 1.` — a second clause this
   *     vocabulary cannot read, so the card is `assisted` and never runs alone.
   *   · `Target opponent REVEALS THEIR HAND. You choose a nonland card from it.
   *     That player discards that card.` — 53 lines (Duress, Thoughtseize). The
   *     CASTER picks, from a hand that has been made public. A different chooser
   *     and a different prompt; not this one.
   *
   * ⚠️ `each opponent discards a card` is NOT here. This vocabulary addresses a
   * player through `targetIndex`, and "each opponent" is a SCOPE the spec has no
   * way to say — inventing one for a handful of cards would be a field every
   * other rule has to ignore.
   */
  /**
   * M6.3t. The SAME sentence with "at random" on the end — and it is a DIFFERENT
   * EFFECT, not a variant: this one takes the cards itself and asks nobody, where
   * the rule below raises a prompt and waits for a person. `Hymn to Tourach`
   * against `Mind Rot`.
   *
   * ⚠️ FIRST, because the rule below is anchored at `cards?\.$` and would not
   * match this sentence at all — but the ordering is written down rather than
   * relied on, because loosening that anchor later would silently turn every
   * random discard into a prompt.
   *
   * ⚠️ D137 refused this and said exactly why: `effectEvents` had no randomness,
   * and in this engine randomness comes ONLY from the seeded generator threaded
   * through the log. Approximating it would be a rule the app made up, and one
   * the player holding the cards would notice. D147 gave `effectEvents` an RNG.
   */
  {
    kind: 'discard',
    re: new RegExp(`^target (?:player|opponent) discards (${COUNT}) cards? at random\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null || n <= 0 ? null : { ...BASE, amount: n, atRandom: true };
    },
  },
  {
    kind: 'discard',
    re: new RegExp(`^target (?:player|opponent) discards (${COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null || n <= 0 ? null : { ...BASE, amount: n };
    },
  },
  /**
   * M6.3k. `Raise Dead` and `Zombify` — the same sentence, two destinations.
   *
   * ⚠️ **THE TARGET DOES THE NARROWING, NOT THIS PATTERN**, and that is why the
   * `.+` between "target" and "from your graveyard" is safe here where it would
   * be reckless elsewhere. `targetParse` reads the same clause into a
   * `TargetSpec` carrying the zone, the controller and the card types — and
   * since D138 `targetAllowed` enforces all three. So "target creature card"
   * cannot resolve onto a land, and "from your graveyard" cannot reach an
   * opponent's exile, whatever this rule matched.
   *
   * ⚠️ ANCHORED AT BOTH ENDS all the same, because the sentence is what decides
   * whether the CARD is `auto`. Four shapes sit one clause past these and each
   * is a different rule: "Return up to two target creature cards…" (a count this
   * spec cannot carry), "…to the battlefield TAPPED", "…to the battlefield under
   * your control", and "Return target creature card with mana value 3 or less"
   * (a numeric restriction `TargetSpec` has no field for — 4 lines, refused).
   */
  {
    kind: 'returnFromGraveyard',
    re: new RegExp(`^return ${COUNTED}target ${GY_NOUN} from your graveyard to your hand\\.$`, 'i'),
    build: () => ({ ...BASE }),
  },
  {
    kind: 'reanimate',
    re: new RegExp(`^return ${COUNTED}target ${GY_NOUN} from your graveyard to the battlefield\\.$`, 'i'),
    build: () => ({ ...BASE }),
  },
  /**
   * M6.3n. `Forbidden Alchemy` and `Sleight of Hand` — look at the top N, keep
   * some, and the rest go somewhere. See D141.
   *
   * ⚠️ **TWO ORDER QUALIFIERS ARE REFUSED, for two different reasons**, and they
   * are why these patterns are anchored so tightly:
   *
   *   · `…the rest on the bottom of your library IN ANY ORDER.` — 6 lines
   *     (`Dig Through Time`). "In any order" is a SECOND DECISION the card gives
   *     the player, and this offers only the first. Executing it would pick an
   *     order on their behalf: D90 with a smaller stake but the same shape.
   *   · `…IN A RANDOM order.` — 2 lines (`Drawn from Dreams`). `effectEvents` has
   *     no RNG; randomness comes only from the seeded generator threaded through
   *     the log. Exactly D137's refusal of "discards at random".
   *
   * ⚠️ `the other` (SINGULAR) is `Sleight of Hand`'s wording and is admitted
   * BECAUSE it is singular: with one card left there is no order to choose, so
   * the qualifier the other bottom-wordings carry is absent for a real reason
   * rather than by oversight. The build refuses the sentence if the arithmetic
   * disagrees.
   *
   * ⚠️ A GRAVEYARD NEEDS NO QUALIFIER AT ALL, and none of these lines carries
   * one — a graveyard is ordered but nobody chooses that order, so the question
   * never arises. That is why the graveyard form is the biggest one this takes.
   */
  {
    kind: 'lookAtTop',
    re: new RegExp(
      `^look at the top (${COUNT}) cards of your library\\. put (${COUNT}) of them into your hand and the rest into your graveyard\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      const take = num(m[2]);
      if (n === null || take === null || take < 1 || take >= n) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'graveyard' } };
    },
  },
  {
    kind: 'lookAtTop',
    re: new RegExp(
      `^look at the top (${COUNT}) cards of your library\\. put (${COUNT}) of them into your hand and the other on the bottom of your library\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      const take = num(m[2]);
      // ⚠️ "the OTHER" is singular, so exactly one card may be left over. A
      // sentence saying "the other" with two remaining is a printing this rule
      // has misread, and refusing is cheaper than being right by luck.
      if (n === null || take === null || take < 1 || n - take !== 1) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'bottom' } };
    },
  },
  /**
   * M6.3o. The two forms D141 REFUSED, now that there is somewhere to ask for
   * the sequence (`Awaiting.orderCards`). See D142.
   *
   * ⚠️ `Impulse`/`Stock Up`/`Anticipate` take some and order the rest to the
   * bottom; `Index` takes nothing and re-stacks all five on top. The take-zero
   * form is a different sentence, not a special case of the first — "then put
   * them back" has no "put N into your hand" clause at all.
   *
   * ⚠️ STILL REFUSED: "in a RANDOM order" (2 lines). That needs the seeded
   * generator, which `effectEvents` does not have, and no prompt fixes it —
   * D137's refusal of "discards at random" is unaffected by D142.
   */
  {
    kind: 'lookAtTop',
    re: new RegExp(
      `^look at the top (${COUNT}) cards of your library\\. put (${COUNT}) of them into your hand and the rest on the bottom of your library in any order\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      const take = num(m[2]);
      if (n === null || take === null || take < 1 || take >= n) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'bottomOrdered' } };
    },
  },
  {
    kind: 'lookAtTop',
    re: new RegExp(
      `^look at the top (${COUNT}) cards of your library, then put them back in any order\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      // ⚠️ `take: 0` — nothing goes to the hand. `effectEvents` reads that as
      // "skip the pick prompt", which is why the two forms can share one kind.
      return n === null || n < 2 ? null : { ...BASE, amount: n, targetIndex: -1, self: true, look: { take: 0, rest: 'topOrdered' } };
    },
  },
  {
    kind: 'createToken',
    re: new RegExp(`^creates? (${COUNT}) .+ tokens?(?: with [^.]+)?\\.$`, 'i'),
    build: (m) => {
      const spec = parseTokenClause(m[0] ?? '');
      if (!spec) return null;
      const token = TOKEN_TABLE[specKey(spec)];
      if (!token) return null;
      return { ...BASE, amount: spec.count, targetIndex: -1, self: true, token };
    },
  },
];

/**
 * Replace the card's own name with `~`, so a self-reference does not defeat
 * matching. Lightning Bolt's text literally says "Lightning Bolt deals 3 damage".
 */
export function selfRef(text: string, name: string): string {
  if (!name) return text;
  let out = text.split(name).join('~');
  const short = name.split(',')[0];
  if (short && short !== name) out = out.split(short).join('~');
  // Modern templating uses "This spell"/"This creature" for the same thing.
  return out.replace(/\bThis (?:spell|creature|permanent|artifact|enchantment|land)\b/g, '~');
}

/**
 * Split a scrubbed face into sentences, keeping the terminator.
 *
 * ⚠️ **PASS ONE, AND IT KNOWS NOTHING ABOUT ANY RULE.** Until D150 this function
 * also carried a JOIN LIST — a hardcoded head pattern for the one card shape
 * that prints two sentences the parser reads as one ("Look at the top three
 * cards of your library." plus what happens to them). D141 built that and said
 * plainly that a list of heads is the wrong shape past two or three entries.
 * Pass two does the joining now, so this is a splitter and only a splitter.
 */
function sentences(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line) => line.split(/(?<=\.)\s+/))
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * How many printed sentences one effect may span.
 *
 * ⚠️ TWO, because that is the widest any rule is written for today — and raising
 * it needs no other change, which is the whole point of the rewrite. It is a
 * bound on the window, not a list of what may be joined.
 */
const MAX_SPAN = 2;

/** D299: the counts a clause may be declared with NO target for. */
const OPTIONAL_COUNT = /\b(?:up to (?:one|two|three)|any number of) target\b/i;

/** One clause of a face: the text it covers, and what it was understood as. */
interface Clause {
  readonly text: string;
  readonly spec: EffectSpec | null;
}

/**
 * **PASS TWO — match rules against a sliding window, longest first.**
 *
 * ⚠️ **THIS IS SAFE ONLY BECAUSE EVERY RULE IS ANCHORED AT BOTH ENDS**, and that
 * is worth stating because it is not an accident: D90 anchored the vocabulary so
 * a prefix match could never "understand" `Homing Lightning` or `Spell Blast`
 * by their opening words. That same property means a one-sentence rule CANNOT
 * match a two-sentence window — so trying wider windows first costs nothing and
 * risks nothing, and a rule that wants two sentences simply writes a pattern
 * that spans the full stop. No head list, no per-rule declaration.
 *
 * ⚠️ **THE CLAUSE COUNT IS WHAT DECIDES `auto` VERSUS `assisted`**
 * (`understood < clauses.length`), and a joined pair counts as ONE clause — the
 * same arithmetic the join list produced. That is why this returns the groups
 * rather than a flat list of sentences: the denominator has to come from the
 * same place as the numerator.
 *
 * ⚠️ Longest-first, then advance past what matched. A window that matches no
 * rule at any width leaves its FIRST sentence as an unmatched clause and moves
 * on by one, so the sentence after it still gets its own chance — the join list
 * could not do that, because it consumed the pair unconditionally.
 */
function clausesOf(text: string): Clause[] {
  const raw = sentences(text);
  const out: Clause[] = [];
  for (let i = 0; i < raw.length; ) {
    let span = 1;
    let spec: EffectSpec | null = null;
    for (let k = Math.min(MAX_SPAN, raw.length - i); k >= 1; k--) {
      const joined = raw.slice(i, i + k).join(' ');
      const hit = matchSentence(joined);
      if (hit) {
        spec = hit;
        span = k;
        break;
      }
    }
    out.push({ text: raw.slice(i, i + span).join(' '), spec });
    i += span;
  }
  return out;
}

function matchSentence(sentence: string): EffectSpec | null {
  for (const rule of RULES) {
    const m = sentence.match(rule.re);
    if (!m) continue;
    const built = rule.build(m);
    if (!built) return null;
    return { ...built, kind: rule.kind, text: sentence };
  }
  return null;
}

export interface ParsedEffects {
  readonly effects: readonly EffectSpec[];
  readonly mode: EffectMode;
}

/**
 * What this face does, and how much of it the app will do for the player.
 *
 * ⚠️ Only INSTANTS and SORCERIES are considered. A permanent's text is a static
 * or triggered ability that needs the script registry and a trigger bus, not a
 * one-shot resolution — and pretending otherwise would execute a creature's
 * "whenever this attacks" the moment it entered the battlefield.
 */
export function parseEffects(
  oracleText: string,
  cardName: string,
  isInstantOrSorcery: boolean,
  warn: Warn = NOOP_WARN,
): ParsedEffects {
  if (!isInstantOrSorcery || !oracleText) return { effects: [], mode: 'manual' };

  const clean = scrub(selfRef(oracleText, cardName));
  const clauses = clausesOf(clean);
  if (clauses.length === 0) return { effects: [], mode: 'manual' };

  const effects: EffectSpec[] = [];
  let understood = 0;
  // Each understood clause consumes the next target in printed order, which is
  // the same order `targetParse` produced its specs in.
  let nextTarget = 0;
  for (const clause of clauses) {
    const spec = clause.spec;
    if (!spec) continue;
    understood++;
    // D299: an "up to N" / "any number of" clause may be declared with no target.
    const optional = OPTIONAL_COUNT.test(clause.text);
    effects.push(spec.targetIndex === -1 ? spec : { ...spec, targetIndex: nextTarget++, ...(optional ? { optional: true as const } : {}) });
  }

  if (understood === 0) {
    warn('effect:none');
    return { effects: [], mode: 'manual' };
  }
  if (understood < clauses.length) {
    // ⚠️ The important branch. Understood-but-incomplete NEVER runs by itself.
    warn('effect:partial');
    return { effects, mode: 'assisted' };
  }
  /**
   * ⚠️ **AN EFFECT THAT ASKS MUST BE LAST, OR THE CARD NEVER RUNS BY ITSELF
   * (D195).** `effectEvents` stops emitting at an `AwaitingSet`, so anything
   * after an asking effect in one resolution would be silently DROPPED —
   * "Scry 1. Do X." would scry and never do X, which is half-execution in
   * D90's exact sense while every sentence reads as understood. The
   * scry-then-draw shapes are safe because the draw rides INSIDE the scry
   * spec and the answer handler emits it; anything else lands `assisted`,
   * where the player applies the parts by hand. (`lookAtTop` chains its own
   * follow-ups through the answer, so it carries the same constraint.)
   */
  const ASKS: ReadonlySet<EffectKind> = new Set(['discard', 'lookAtTop', 'scry', 'surveil']);
  if (effects.slice(0, -1).some((e) => ASKS.has(e.kind))) {
    warn('effect:partial');
    return { effects, mode: 'assisted' };
  }
  warn('effect:auto');
  return { effects, mode: 'auto' };
}
