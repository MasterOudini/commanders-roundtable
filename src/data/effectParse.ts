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

import type {
  BoardScope,
  CounterKind,
  EffectKind,
  DelayWhen,
  EffectMode,
  EffectSpec,
  Keyword,
  LookFilter,
  PaySpec,
  VerbPrice,
  CountExpr,
  PreventSourceSpec,
  SearchQualifier,
  SearchSpec,
} from '../engine/types/oracle';
import type { ColorLetter } from './cardTypes';
import { SELF_AIMED } from '../engine/types/oracle';
import { predicatesOf } from './replacementParse';
import type { PermanentPredicate } from './replacementParse';
import { parseManaCost, type Warn } from './oracleParse';
import { scrub } from './targetParse';
import { parseTokenClause, specKey } from './tokenParse';
import { TOKEN_TABLE } from './tokenTable';
import { parseCostReductionLine } from './costParse';
import { ADDITIONAL_COST_LINE, ALTERNATIVE_COST_LINE, cyclingAbilities, parseAdditionalCost, parseAlternativeCost, readCostVerbs } from './activatedParse';

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
  // D407 - the nouns the linked exile prints (Banishing Light, Vault Guardsman, Ossification, Isolation Zone ...),
  // admitted because targetParse reads the controller off any noun (readController) and each list per
  // alternative; the longer alternatives sit above their prefixes.
  'artifact, creature, or enchantment an opponent controls',
  'creature or planeswalker an opponent controls',
  'creature or enchantment an opponent controls',
  'artifact or creature an opponent controls',
  'nonland permanent an opponent controls',
  "nonland permanent you don't control",
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
  // D425 - `target opponent or planeswalker` (Inferno Jet, Burning Sun's Avatar, Zealot of the God-Pharaoh): the
  // target parser has read it since D293 (kinds player + planeswalker, controller opponent); above `opponent`.
  'opponent or planeswalker',
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
// D414 - `another` and `up to one other` are count words the target parser reads (the spec carries `another`).
const COUNTED = '(?:(?:each of )?(?:up to (?:one|two|three)(?: other)?|two|three|any number of|another) )?';
const TARGET = `(?:any target|${COUNTED}target ${ADJECTIVE}(?:${NOUNS})s?${QUALIFIER})`;
const NUM = '(?:\\d+)';
/**
 * D373 - THE SELF SUBJECT: the clause is about the resolving object's own source.
 * `selfRef` has already spelled the card's name and "This creature" as `~`; the
 * lowercase form is what a quoted body prints after a trigger's head ("Whenever
 * this creature attacks, this creature gets +1/+0 until end of turn").
 *
 * ⚠️ NEVER `it`. On a spell "it" is the previous sentence's target ("Destroy
 * target creature. It can't be regenerated.", "... Untap it."), and a rule that
 * admitted it here would read that sentence for the spell itself - a whole card
 * going `auto` over a clause aimed at the wrong thing. The REFERENT rewrite
 * (D392, `referentRewrite` below) reads it for what it is: the previous clause's
 * subject, spelled out before the rule sees the sentence. A QUOTED body's leading
 * "it" IS its recipient, and the vocabulary bridge spells it `~` before the parse,
 * where the text is known to be a quoted body (`scripts/vocabulary.ts`).
 */
const SELF = '(?:this (?:creature|permanent|artifact|enchantment|land)|~)';


const WORD_NUMBERS: Readonly<Record<string, number>> = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  // D434 - the mill counts run past seven (`mills ten cards`, `Mill twelve cards`); every rule still gates its own words.
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
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
  search: null,
  atRandom: false,
  thenDraw: 0,
  pay: null,
  cantBeBlocked: false,
  exileScope: null,
  sacrifice: null,
  handChoice: null,
  exilePlay: null,
  per: null,
  counterTo: null,
  delay: null,
  ifKicked: false,
  kickedInstead: false,
  untilLeaves: false,
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

/**
 * D427 - the shield's SOURCE filter and RECIPIENT set, as the sentence names them. Closed lists: the funnel
 * (`prevention.ts` `covers`) reads exactly these off the derived source, so a word outside them refuses the
 * sentence rather than widening a shield.
 */
const SHIELD_COLOR = '(?:white|blue|black|red|green)';
const SHIELD_SRC = [
  `creatures other than ${TARGET}`,
  `${TARGET}`,
  'creatures your opponents control',
  'creatures target opponent controls',
  `creatures with power ${NUM} or less`,
  `creatures without (?:${KW})`,
  `non${SHIELD_COLOR} creatures`,
  'non-[A-Z][a-z]+ creatures',
  'creatures with no \\+1/\\+1 counters on them',
  'attacking creatures',
  'unblocked creatures',
  'creatures',
  'non-[A-Z][a-z]+ sources',
  'colorless sources',
].join('|');
const SHIELD_RECIP = `(?:${TARGET}|you and creatures you control|you and permanents you control|creatures you control|creatures)`;
const SHIELD_COLOR_LETTER: Readonly<Record<string, ColorLetter>> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
function readShieldSource(raw: string): PreventSourceSpec | null {
  const s = raw.trim();
  const low = s.toLowerCase();
  if (/^creatures other than target /i.test(s)) return { kind: 'creatures', controller: 'any', exceptTarget: true };
  if (/^(?:any target|target )/i.test(s)) return { kind: 'target' };
  if (low === 'creatures') return { kind: 'creatures', controller: 'any' };
  if (low === 'attacking creatures') return { kind: 'creatures', controller: 'any', attacking: true };
  if (low === 'unblocked creatures') return { kind: 'creatures', controller: 'any', unblocked: true };
  if (low === 'creatures your opponents control') return { kind: 'creatures', controller: 'opponents' };
  if (low === 'creatures target opponent controls') return { kind: 'creatures', controller: 'targetPlayer' };
  if (low === 'creatures with no +1/+1 counters on them') return { kind: 'creatures', controller: 'any', noPlusCounter: true };
  if (low === 'colorless sources') return { kind: 'sources', controller: 'any', colorless: true };
  let m: RegExpExecArray | null;
  if ((m = /^creatures with power (\d+) or less$/i.exec(s))) return { kind: 'creatures', controller: 'any', powerAtMost: Number(m[1]) };
  if ((m = /^creatures without ([a-z ]+)$/i.exec(s))) { const kw = GRANTABLE.get((m[1] ?? '').toLowerCase()); return kw === undefined ? null : { kind: 'creatures', controller: 'any', withoutKeyword: kw }; }
  if ((m = /^non(white|blue|black|red|green) creatures$/i.exec(s))) { const c = SHIELD_COLOR_LETTER[(m[1] ?? '').toLowerCase()]; return c === undefined ? null : { kind: 'creatures', controller: 'any', notColor: c }; }
  if ((m = /^non-([A-Z][a-z]+) (creatures|sources)$/.exec(s))) return { kind: m[2] === 'creatures' ? 'creatures' : 'sources', controller: 'any', notSubtype: m[1] ?? '' };
  return null;
}
function readShieldRecipient(raw: string): 'target' | 'creatures' | 'creaturesYouControl' | 'youAndCreatures' | 'youAndPermanents' | null {
  const low = raw.trim().toLowerCase();
  if (/^(?:any target|target )/.test(low)) return 'target';
  if (low === 'creatures') return 'creatures';
  if (low === 'creatures you control') return 'creaturesYouControl';
  if (low === 'you and creatures you control') return 'youAndCreatures';
  if (low === 'you and permanents you control') return 'youAndPermanents';
  return null;
}

/**
 * D383 - THE CLOSED SCOPE VOCABULARY. Every phrase a scoped board effect may
 * name, and nothing else: a sentence naming a set outside this stays unread
 * (D90), which is what keeps "each creature that dealt damage this turn" or
 * "all nonland permanents" from being half-executed as something narrower.
 *
 * ⚠️ The keyword filter is GRANTABLE's own key set - every one of them a keyword
 * the engine ENFORCES - so a filter can never name a quality `derive` cannot
 * answer (the closed map IS the safety property here, exactly as it is for the
 * pump's grant).
 */
// D425 - `you`: the controller alone (`~ deals 1 damage to you.` - Serendib Efreet, City of Brass, the pain family; 61
// cards carry it, 17 with nothing else unread). A player scope the executor reads as the resolving object's
// controller; a verb that refuses player scopes (destroy, exile, bounce) refuses it as it refuses `each player`.
const SCOPE = `(each creature(?: (?:with|without) (?:${KW}))?|each opponent|each player|you|all creatures|all artifacts|all enchantments|all lands|creatures your opponents control|creatures you control|attacking creatures)`;
function readScope(raw: string | undefined): BoardScope | null {
  if (raw === undefined) return null;
  const s = raw.toLowerCase();
  if (s === 'each opponent') return { kind: 'player', controller: 'opponents' };
  if (s === 'you') return { kind: 'player', controller: 'you' };
  if (s === 'each player') return { kind: 'player', controller: 'any' };
  if (s === 'creatures you control') return { kind: 'creature', controller: 'you' };
  if (s === 'creatures your opponents control') return { kind: 'creature', controller: 'opponents' };
  if (s === 'attacking creatures') return { kind: 'creature', controller: 'any', attacking: true };
  if (s === 'all creatures' || s === 'each creature') return { kind: 'creature', controller: 'any' };
  if (s === 'all artifacts') return { kind: 'permanent', controller: 'any', type: 'Artifact' };
  if (s === 'all enchantments') return { kind: 'permanent', controller: 'any', type: 'Enchantment' };
  if (s === 'all lands') return { kind: 'permanent', controller: 'any', type: 'Land' };
  const kw = /^each creature (with|without) (.+)$/.exec(s);
  if (kw === null) return null;
  const word = GRANTABLE.get(kw[2] as string);
  return word === undefined ? null : { kind: 'creature', controller: 'any', keyword: word, keywordAbsent: kw[1] === 'without' };
}

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
 * actually reads at layer 7d and the shield counter the funnel and the destroy
 * sites spend (D469, CR 122.1i). See `CounterKind` for why a `charge counter` is
 * not here: recording a counter nothing applies is half-execution with a number
 * on it.
 */
const COUNTER_KIND = String.raw`(?:\+1/\+1|-1/-1|shield)`;
const COUNT = '(?:a|one|two|three|four|five|six|seven|\\d+)';
/** D434 - a mill's count: the words past seven the printed mills use. */
const MILL_COUNT = '(?:a|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|\\d+)';

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
  if (raw === '+1/+1' || raw === '-1/-1' || raw === 'shield') return raw;
  return null;
}

/**
 * ⚠️ Every pattern is anchored at BOTH ends. A sentence with anything left over
 * is not understood — that is the whole safety property, and the reason these
 * read as strict rather than helpful.
 */

/**
 * D357 - CR 701.19, the LIBRARY SEARCH.
 *
 * 514 cards carried this sentence as their single remaining piece - the densest family the seam map
 * holds - and the engine had no verb for it at all. What is searched for, measured: basic land 145,
 * creature 35, artifact 18, land 14, Forest 13, Plains 11, Aura 9. Where it goes: hand 192,
 * battlefield tapped 126, battlefield 101, graveyard 10. 511 of the 514 shuffle afterwards.
 *
 * ⚠️ THE SHUFFLE IS READ, NEVER ASSUMED. Three of the 514 do not shuffle, and a search that showed
 * a player their library without shuffling would leave them knowing their next draws - which is the
 * case the sorted projection in `project.ts` exists to protect.
 */
const SEARCH_WHERE = String.raw`into your hand|onto the battlefield tapped|onto the battlefield|into your graveyard`;
const SEARCH_DEST: readonly (readonly [RegExp, SearchSpec['destination'], boolean])[] = [
  [/onto the battlefield tapped/i, 'battlefield', true],
  [/onto the battlefield/i, 'battlefield', false],
  [/into your hand/i, 'hand', false],
  [/into your graveyard/i, 'graveyard', false],
];

/**
 * D357 - `basic Plains, Island, or Swamp` -> `basic Plains or basic Island or basic Swamp`.
 *
 * ⚠️ THE ADJECTIVES DISTRIBUTE. Everything before the first comma that is not the first noun
 * qualifies every alternative - `basic` in the line above applies to all three, and a reader that
 * kept it on the first only would find an Island that is not basic.
 */
function distributeList(noun: string): string {
  if (!noun.includes(',')) return noun;
  const parts = noun.split(/\s*,\s*/).map((p) => p.replace(/^or\s+/i, '').trim()).filter((p) => p !== '');
  if (parts.length < 2) return noun;
  const head = (parts[0] ?? '').split(/\s+/);
  const lead = head.slice(0, -1);
  return parts.map((p, i) => (i === 0 ? p : [...lead, p].join(' '))).join(' or ');
}

/**
 * D359 - everything from `search your library for` to the end of the noun, shared by the two
 * destination shapes so that one reading of the noun serves both.
 *
 * ⚠️ THE NAME RUNS THROUGH COMMAS, AND ONLY THROUGH THE ONES INSIDE IT. Twenty-odd cards search
 * for a card named after a planeswalker - `a card named Chandra, Fire Artisan, reveal it, ...` -
 * so a name that stopped at the first comma would look for a card called `Chandra` and find
 * nothing. A comma continues the name only when an upper-case letter follows it; the sentence's
 * own commas are always followed by `reveal`, `put` or `then`.
 */
const SEARCH_HEAD =
  String.raw`^(?<may>you may )?search your library for ` +
  // `a`/`an`, or a COUNT that makes failing to find explicit.
  String.raw`(?:(?:a|an)\b|up to (?<count>one|two|three|four)\b) ?` +
  // The noun, or nothing at all - `Search your library for a card` is a real, unrestricted line.
  String.raw`(?<noun>[a-zA-Z][a-zA-Z, ]*?)? ?cards?` +
  // A bound on the CARD rather than on its type line.
  String.raw`(?<qual> with mana value (?<mvn>\d+) or (?<mvop>less|greater)` +
  String.raw`| with mana value (?<mveq>\d+)` +
  String.raw`| named (?<named>(?:[^,.]|,\s(?=[A-Z]))+?))?` +
  String.raw`(?:(?:,| and) reveal (?:it|them|those cards|that card))?`;

const COUNTS: Readonly<Record<string, number>> = { one: 1, two: 2, three: 3, four: 4 };

/**
 * D389 - the noun of a look's filter, `you may reveal a <noun> card from among them`, read by
 * the search's own reader (`distributeList` + `predicatesOf`, D357) so one grammar names what
 * a library may give up whether a search or a look is asking. A word the reader cannot place
 * (`historic`, `noncreature`, `double-faced`) refuses the whole sentence (D90).
 */
const LOOK_NOUN = String.raw`(?:a|an) (?<noun>[a-zA-Z][a-zA-Z, ]*?) cards?`;
function lookFilter(g: Record<string, string | undefined>): LookFilter | null {
  const noun = (g['noun'] ?? '').trim();
  if (noun === '') return null;
  // `a Mount creature card or a Plains card` (Frontier Seeker) repeats the article and the word
  // `card` per alternative; each is read back to its bare noun before the shared reader sees it.
  const bare = distributeList(noun)
    .split(/\bor\b/)
    .map((p) => p.trim().replace(/^(?:a|an)\s+/i, '').replace(/\s+cards?$/i, ''))
    .join(' or ');
  const predicates = predicatesOf(bare);
  if (!predicates || predicates.length === 0) return null;
  return { predicates, what: noun + ' card' };
}

/**
 * The count, the predicates, the qualifier and the printed label - the four things both search
 * shapes need and neither reads differently. Null when the noun is one `predicatesOf` refuses.
 */
function searchNoun(
  g: Record<string, string | undefined>,
): { count: number; predicates: readonly PermanentPredicate[]; qualifier: SearchQualifier | null; label: string } | null {
  const count = g['count'] ? (COUNTS[g['count'].toLowerCase()] ?? 0) : 1;
  if (count < 1) return null;
  const noun = (g['noun'] ?? '').trim();
  // ⚠️ A BARE `a card` IS UNRESTRICTED, and the empty predicate says so: `cardMatchesSearch`
  // asks `every`, so a predicate with no supertype, type, subtype or colour admits any card.
  // That is the honest reading of the line, not a hole - `Demonic Tutor` really does find
  // anything.
  const predicates = noun === ''
    ? [{ supertypes: [], types: [], subtypes: [], colors: [] }]
    // ⚠️ A COMMA LIST IS AN `or` LIST. `a basic Plains, Island, or Swamp card` names three
    // alternatives and `predicatesOf` splits on `or` alone, so the commas become `or` first -
    // and the leading adjectives distribute, which is why each alternative is rebuilt with
    // every word that preceded the first comma.
    : predicatesOf(distributeList(noun));
  if (!predicates || predicates.length === 0) return null;

  let qualifier: SearchQualifier | null = null;
  if (g['mvn'] !== undefined && g['mvop'] !== undefined) {
    const n = Number(g['mvn']);
    if (!Number.isFinite(n)) return null;
    qualifier = { manaValue: { op: g['mvop'].toLowerCase() === 'less' ? 'lte' : 'gte', n }, name: null };
  } else if (g['mveq'] !== undefined) {
    const n = Number(g['mveq']);
    if (!Number.isFinite(n)) return null;
    qualifier = { manaValue: { op: 'eq', n }, name: null };
  } else if (g['named'] !== undefined) {
    const name = g['named'].trim();
    if (name === '') return null;
    qualifier = { manaValue: null, name };
  }

  const label = (noun === '' ? 'card' : noun + ' card') + (count > 1 ? 's' : '') + (g['qual'] ?? '');
  return { count, predicates, qualifier, label };
}

function searchRule(): Rule {
  return {
    kind: 'search',
    re: new RegExp(
      SEARCH_HEAD +
        // `put it` / `put them` / `put that card` / `put those cards`, with the comma optional
        // because some printings write `and put it` instead.
        String.raw`(?:,| and) put (?:it|them|that card|those cards) ` +
        String.raw`(?<where>` + SEARCH_WHERE + String.raw`)` +
        // `, then shuffle` and `. Then shuffle.` are the same sentence to the two-sentence window.
        String.raw`(?:[,.] ?then shuffle(?: your library)?| and shuffle(?: your library)?)?\.?$`,
      'i',
    ),
    build: (m) => {
      const g = m.groups ?? {};
      const noun = searchNoun(g);
      if (!noun) return null;
      const where = (g['where'] ?? '').toLowerCase();
      const hit = SEARCH_DEST.find(([re]) => re.test(where));
      if (!hit) return null;
      return {
        ...BASE,
        targetIndex: -1,
        self: true,
        search: {
          predicates: noun.predicates,
          label: noun.label,
          count: noun.count,
          destination: hit[1],
          tapped: hit[2],
          shuffle: /shuffle/i.test(m[0] ?? ''),
          optional: g['may'] !== undefined,
          qualifier: noun.qualifier,
        },
      };
    },
  };
}

/**
 * D359 - the tutor: `Search your library for a card, reveal it, then shuffle and put that card
 * on top.`
 *
 * ⚠️ **NOTHING MOVES.** The found card never leaves the library; the library is shuffled and it
 * is placed back on top of it, in that order. Reading it as a move to the hand and back would
 * shuffle the wrong pile and put a different card on top, which the replay hash would then carry
 * forever. The destination says so by name, and the answer handler writes one library order.
 *
 * The card is singular by construction - `put those cards on top in any order` is a different
 * sentence with an ordering prompt behind it, and this rule does not match it.
 */
function searchTopRule(): Rule {
  return {
    kind: 'search',
    re: new RegExp(
      SEARCH_HEAD +
        String.raw`[,.] ?then shuffle(?: your library)? and put (?:it|that card) on top(?: of your library)?\.?$`,
      'i',
    ),
    build: (m) => {
      const g = m.groups ?? {};
      const noun = searchNoun(g);
      if (!noun || noun.count !== 1) return null;
      return {
        ...BASE,
        targetIndex: -1,
        self: true,
        search: {
          predicates: noun.predicates,
          label: noun.label,
          count: 1,
          destination: 'libraryTop',
          tapped: false,
          // The shuffle is not optional in this shape - it is printed in the middle of it.
          shuffle: true,
          optional: g['may'] !== undefined,
          qualifier: noun.qualifier,
        },
      };
    },
  };
}

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
  // D407 - THE LINKED EXILE (CR 610.3): the same aim, linked to the source until it leaves the battlefield.
  { kind: 'exile', re: new RegExp(`^exile ${TARGET} until (?:this (?:creature|enchantment|artifact|permanent|land)|~) leaves the battlefield\\.$`, 'i'), build: () => ({ ...BASE, untilLeaves: true }) },
  // D369 - "Sacrifice this creature." as a body the pay prompt decides (a row's sentence).
  { kind: 'sacrificeSelf', re: /^sacrifice (?:this (?:creature|permanent|artifact|enchantment|land|aura|equipment)|it|~)\.$/i, build: () => ({ ...BASE, targetIndex: -1, self: true }) },
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
   * D391 - proliferate (CR 701.27a): the resolution stops and asks its controller to choose any
   * number of permanents and players with a counter; the ANSWER puts one more of each kind
   * present. A bare sentence, no target, the caster asks - and an ASKING kind, so it must be the
   * sentence's last (D195's rule). `sentences()` splits ", then proliferate." into a sentence of
   * its own, so "Destroy target creature, then proliferate." is two clauses, both read.
   */
  /**
   * D409 - explore (CR 701.42): the subject is the source (`~`, `this creature`; a quoted body's
   * leading `it` is spelled `~` by the bridge) or a target. An ASK (the graveyard question), so last
   * in its sentence (D195). `explores X times` and `that creature explores` stay unread.
   */
  {
    kind: 'explore',
    re: new RegExp(`^${SELF} explores\.$`, 'i'),
    build: () => ({ ...BASE, amount: 1, targetIndex: -1, self: true }),
  },
  {
    kind: 'explore',
    re: new RegExp(`^${SELF} explores, then (?:it|${SELF}) explores again\.$`, 'i'),
    build: () => ({ ...BASE, amount: 2, targetIndex: -1, self: true }),
  },
  {
    kind: 'explore',
    re: new RegExp(`^${TARGET} explores\.$`, 'i'),
    build: () => ({ ...BASE, amount: 1 }),
  },
  {
    kind: 'explore',
    re: new RegExp(`^${TARGET} explores, then it explores again\.$`, 'i'),
    build: () => ({ ...BASE, amount: 2 }),
  },
  {
    kind: 'proliferate',
    re: /^proliferate[.]$/i,
    build: () => ({ ...BASE, targetIndex: -1, self: true }),
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
  /**
   * D383 - THE SCOPED BOARD EFFECT. `massPump` above has walked a board-defined
   * SET since D301; these are the same idea with the other verbs, over ONE closed
   * scope reader (D346's rule for the scoped anthems: the scope vocabulary lives
   * in a single place, so a scope can never widen a body).
   *
   * ⚠️ The reader is CLOSED and every rule is anchored at both ends (D90). A
   * sentence with a rider - "If a creature dealt damage this way would die this
   * turn, exile it instead", "If this spell was kicked ..." - is a DIFFERENT card
   * and stays unread, which is why the anchored count (29) is a third of the 247
   * cards that merely CARRY a scoped sentence.
   */
  {
    kind: 'damageEach',
    re: new RegExp(`^~ deals (${NUM}) damage to ${SCOPE}(?: and ${SCOPE})?\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const a = readScope(m[2]);
      const b = m[3] === undefined ? null : readScope(m[3]);
      if (n === null || a === null || (m[3] !== undefined && b === null)) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, scopes: b === null ? [a] : [a, b] };
    },
  },
  {
    kind: 'destroyAll',
    re: new RegExp(`^destroy ${SCOPE}\.$`, 'i'),
    build: (m) => {
      const s = readScope(m[1]);
      return s === null || s.kind === 'player' ? null : { ...BASE, targetIndex: -1, self: true, scopes: [s] };
    },
  },
  {
    kind: 'bounceAll',
    re: new RegExp(`^return ${SCOPE} to their owners(?:'|\u2019) hands\.$`, 'i'),
    build: (m) => {
      const s = readScope(m[1]);
      return s === null || s.kind === 'player' ? null : { ...BASE, targetIndex: -1, self: true, scopes: [s] };
    },
  },
  {
    kind: 'massPump',
    re: new RegExp(`^${SCOPE} get ([+-]${NUM})/([+-]${NUM})(?: and gain (${KW})(?: and (${KW}))?)? until end of turn\.$`, 'i'),
    build: (m) => {
      const s = readScope(m[1]);
      const p = Number(m[2]);
      const t = Number(m[3]);
      const kws = m[4] === undefined ? [] : grantedKeywords(m[4], m[5]);
      if (s === null || s.kind !== 'creature' || !Number.isFinite(p) || !Number.isFinite(t) || kws === null) return null;
      return { ...BASE, power: p, toughness: t, keywords: kws, targetIndex: -1, self: true, scopes: [s] };
    },
  },
  {
    kind: 'gainLifePer',
    re: new RegExp(`^you gain (${NUM}) life for each (creature you control|card in your graveyard|creature card in your graveyard)\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const per =
        m[2] === 'creature you control'
          ? 'creaturesYouControl'
          : m[2] === 'card in your graveyard'
            ? 'cardsInYourGraveyard'
            : 'creatureCardsInYourGraveyard';
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true, perCount: per };
    },
  },
  {
    kind: 'toLibraryTop',
    re: new RegExp(`^put ${TARGET} on top of its owner(?:'|\u2019)s library\.$`, 'i'),
    build: () => ({ ...BASE }),
  },
  /**
   * D373 - THE SELF-AIMED EFFECT. "This creature gets +1/+0 until end of turn.",
   * "Put a +1/+1 counter on this creature.", "Return this permanent to its owner's
   * hand.", "Untap this creature.", "Regenerate this creature." - the subject is the
   * resolving object's own SOURCE: for a granted ability the RECIPIENT (CR 113.7a),
   * for a permanent's printed ability the permanent. `self: true, targetIndex: -1`
   * exactly as the mass pump, and `effects.ts` aims a self clause of a `SELF_AIMED`
   * kind at the source, or says the subject has gone. The same three pump shapes as
   * the targeted pump above, over the same closed keyword map.
   */
  {
    kind: 'pump',
    re: new RegExp(`^${SELF} gets ([+-]${NUM})/([+-]${NUM}) until end of turn\\.$`, 'i'),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      return Number.isFinite(p) && Number.isFinite(t) ? { ...BASE, power: p, toughness: t, targetIndex: -1, self: true } : null;
    },
  },
  {
    kind: 'pump',
    re: new RegExp(`^${SELF} gets ([+-]${NUM})/([+-]${NUM}) and gains (${KW})(?: and (${KW}))? until end of turn\\.$`, 'i'),
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
    kind: 'pump',
    re: new RegExp(`^${SELF} gains (${KW})(?: and (${KW}))? until end of turn\\.$`, 'i'),
    build: (m) => {
      const kws = grantedKeywords(m[1], m[2]);
      return kws !== null ? { ...BASE, keywords: kws, targetIndex: -1, self: true } : null;
    },
  },
  {
    kind: 'putCounters',
    re: new RegExp(`^put (${COUNT}) (${COUNTER_KIND}) counters? on ${SELF}\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const kind = counterKindOf(m[2]);
      return n === null || kind === null ? null : { ...BASE, amount: n, counterKind: kind, targetIndex: -1, self: true };
    },
  },
  { kind: 'bounce', re: new RegExp(`^return ${SELF} to its owner(?:'|’)?s? hand\\.$`, 'i'), build: () => ({ ...BASE, targetIndex: -1, self: true }) },
  { kind: 'untap', re: new RegExp(`^untap ${SELF}\\.$`, 'i'), build: () => ({ ...BASE, targetIndex: -1, self: true }) },
  // D373 - CR 701.19, the verb itself: on the source, and on a target ("Regenerate target creature.").
  { kind: 'regenerate', re: new RegExp(`^regenerate ${SELF}\\.$`, 'i'), build: () => ({ ...BASE, targetIndex: -1, self: true }) },
  { kind: 'regenerate', re: new RegExp(`^regenerate ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  /**
   * D373 - CR 701.16a: "Investigate." is "create a Clue token", the printing resolved
   * from TOKEN_TABLE at build time exactly as the token rule below resolves its own.
   */
  {
    kind: 'createToken',
    re: /^investigate\.$/i,
    build: () => {
      const spec = parseTokenClause('Create a Clue token.');
      const token = spec ? TOKEN_TABLE[specKey(spec)] : undefined;
      return token ? { ...BASE, amount: 1, targetIndex: -1, self: true, token } : null;
    },
  },
  { kind: 'tap', re: new RegExp(`^tap ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'untap', re: new RegExp(`^untap ${TARGET}\\.$`, 'i'), build: () => ({ ...BASE }) },
  // D411 - THE UNTAP SKIP: the bare targeted form, and the self form under a trigger's head or an
  // activation (`~ doesn't untap during your next untap step`); `It / That creature doesn't untap ...`
  // after a tap is the referent rewrite's (D392).
  { kind: 'freeze', re: new RegExp(`^${TARGET} doesn't untap during its controller's next untap step\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'freeze', re: new RegExp(`^${SELF} doesn't untap during (?:your|its controller's) next untap step\\.$`, 'i'), build: () => ({ ...BASE, targetIndex: -1, self: true }) },
  // D412 - CONNIVE (CR 701.50): the subject is the source (`~`; a quoted body's leading `it` is spelled `~`
  // by the bridge) or a target. An ASK (the discard), so last in its sentence (D195).
  { kind: 'connive', re: new RegExp(`^${SELF} connives\\.$`, 'i'), build: () => ({ ...BASE, amount: 1, targetIndex: -1, self: true }) },
  { kind: 'connive', re: new RegExp(`^${SELF} connives, then (?:it|${SELF}) connives again\\.$`, 'i'), build: () => ({ ...BASE, amount: 2, targetIndex: -1, self: true }) },
  { kind: 'connive', re: new RegExp(`^${TARGET} connives\\.$`, 'i'), build: () => ({ ...BASE, amount: 1 }) },
  // D413 - THE EXILE-INSTEAD RIDER (CR 614.1). The targeted form reaches the previous clause's target
  // through the referent rewrite (`If that creature would die ...` - the lead admits `if`); the
  // dealt-damage form marks what this resolution damaged; the bare forms mark the board.
  { kind: 'exileIfDies', re: new RegExp(`^if ${TARGET}(?: or planeswalker)? would die this turn, exile (?:it|${TARGET}) instead\\.$`, 'i'), build: () => ({ ...BASE, exileScope: 'target' }) },
  { kind: 'exileIfDies', re: /^if a (?:creature|permanent) dealt damage this way would die this turn, exile it instead\.$/i, build: () => ({ ...BASE, targetIndex: -1, self: true, exileScope: 'damaged' }) },
  { kind: 'exileIfDies', re: /^if a creature would die this turn, exile it instead\.$/i, build: () => ({ ...BASE, targetIndex: -1, self: true, exileScope: 'all' }) },
  { kind: 'exileIfDies', re: /^if a creature an opponent controls would die this turn, exile it instead\.$/i, build: () => ({ ...BASE, targetIndex: -1, self: true, exileScope: 'opponents' }) },
  // D393 - THREATEN: a control change WITH AN END. The permanent form ("Gain control of target
  // creature.") is a different family and stays unread until it is measured and built.
  { kind: 'control', re: new RegExp(`^gain control of ${TARGET} until end of turn\\.$`, 'i'), build: () => ({ ...BASE }) },
  // D394 - "can't block this turn": a restriction WITH AN END (CR 509.1b), on the until-end-of-turn
  // list, read by `canBlock`. The scoped forms ("Creatures without flying can't block this turn.")
  // are a different reader and stay unread until they are measured.
  { kind: 'cantBlock', re: new RegExp(`^${TARGET} can't block this turn\\.$`, 'i'), build: () => ({ ...BASE }) },
  // D399 - "can't be blocked this turn": the EVASION with an end (CR 509.1b's other side), the same
  // list, read by `canBlock` for the attacker. A target, the self (D373), and the pump-with-rider
  // ("gets +N/+N until end of turn and can't be blocked this turn") on one entry. The scoped forms
  // and "can't be blocked by <predicate> this turn" are different readers and stay unread.
  { kind: 'cantBeBlocked', re: new RegExp(`^${TARGET} can't be blocked this turn\\.$`, 'i'), build: () => ({ ...BASE }) },
  { kind: 'cantBeBlocked', re: new RegExp(`^${SELF} can't be blocked this turn\\.$`, 'i'), build: () => ({ ...BASE, targetIndex: -1, self: true }) },
  {
    kind: 'pump',
    re: new RegExp(`^${TARGET} gets ([+-]${NUM})/([+-]${NUM}) until end of turn and can't be blocked this turn\\.$`, 'i'),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      return Number.isFinite(p) && Number.isFinite(t) ? { ...BASE, power: p, toughness: t, cantBeBlocked: true } : null;
    },
  },
  {
    kind: 'pump',
    re: new RegExp(`^${SELF} gets ([+-]${NUM})/([+-]${NUM}) until end of turn and can't be blocked this turn\\.$`, 'i'),
    build: (m) => {
      const p = Number(m[1]);
      const t = Number(m[2]);
      return Number.isFinite(p) && Number.isFinite(t) ? { ...BASE, power: p, toughness: t, cantBeBlocked: true, targetIndex: -1, self: true } : null;
    },
  },
  // D395 - the ANIMATE family: "<this land | target land> becomes a N/N [colour [and colour]] [Type
  // words] [artifact] creature [with KW [and KW]] [in addition to its other types] until end of
  // turn." - the duration fronted or trailing, exactly one of the two. The subject is the self or a
  // target; the colours SET the colour (CR 613.1e); the words before "creature" are the subtypes;
  // "artifact creature" adds Artifact; "It's still a land." beside it is a noop. An X in the P/T
  // is not a number and stays unread, as every counted X does.
  {
    kind: 'animate',
    re: new RegExp(
      `^(until end of turn, )?(${SELF}|${TARGET}) becomes an? (${NUM})/(${NUM}) (?:(white|blue|black|red|green|colorless)(?: and (white|blue|black|red|green))? )?((?:[a-z]+ )*?)(artifact )?creature(?: with (${KW})(?: and (${KW}))?)?(?: in addition to its other types)?( until end of turn)?\\.$`,
      'i',
    ),
    build: (m) => {
      const fronted = m[1] !== undefined;
      const trailing = m[11] !== undefined;
      if (fronted === trailing) return null;
      const power = num(m[3]);
      const toughness = num(m[4]);
      if (power === null || toughness === null) return null;
      const LETTER: Readonly<Record<string, 'W' | 'U' | 'B' | 'R' | 'G'>> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
      const colors: ('W' | 'U' | 'B' | 'R' | 'G')[] = [];
      for (const c of [m[5], m[6]]) {
        if (c === undefined) continue;
        const l = LETTER[c.toLowerCase()];
        if (l !== undefined && !colors.includes(l)) colors.push(l);
      }
      const subtypes = (m[7] ?? '').split(' ').map((w) => w.trim()).filter((w) => w !== '').map((w) => w.charAt(0).toUpperCase() + w.slice(1));
      // Groups: 1 fronted, 2 subject, 3/4 P/T, 5/6 colours, 7 subtype words, 8 artifact, 9/10
      // keywords, 11 trailing.
      const keywords = m[9] === undefined ? [] : grantedKeywords(m[9], m[10]);
      if (keywords === null) return null;
      const self = new RegExp(`^${SELF}$`, 'i').test(m[2] ?? '');
      return {
        ...BASE,
        ...(self ? { targetIndex: -1, self: true } : {}),
        animate: { power, toughness, colors, subtypes, artifact: m[8] !== undefined, keywords },
      };
    },
  },
  // D395 - the reminder beside an animation: it adds nothing of its own.
  { kind: 'noop', re: /^it(?:'|’)s still an? (?:land|artifact|enchantment|creature|permanent)\.$/i, build: () => ({ ...BASE, targetIndex: -1, self: true }) },
  // D396 - BITE and FIGHT (CR 701.12): two operands. The subject is the self ("~", "this creature")
  // or a target; the object is the clause's OTHER target, a second index `parseEffects` hands out
  // after the subject's. The referent forms ("that creature fights ...") arrive here rewritten to
  // the subject's phrase (D392) and read as the target-subject shape; a leading "Then" is print.
  // "Fights each other" (the opponent's choice) and "fights another target creature" (the
  // targeting layer holds "another" unenforced) stay outside, refused by name.
  {
    kind: 'bite',
    re: new RegExp(`^(?:then )?(${SELF}|${TARGET}) deals damage equal to its power to (${TARGET})\\.$`, 'i'),
    build: (m) => {
      const self = new RegExp(`^${SELF}$`, 'i').test(m[1] ?? '');
      return { ...BASE, ...(self ? { targetIndex: -1, self: true } : {}), otherTargetIndex: 0 };
    },
  },
  {
    kind: 'fight',
    re: new RegExp(`^(?:then )?(${SELF}|${TARGET}) fights (${TARGET})\\.$`, 'i'),
    build: (m) => {
      const self = new RegExp(`^${SELF}$`, 'i').test(m[1] ?? '');
      return { ...BASE, ...(self ? { targetIndex: -1, self: true } : {}), otherTargetIndex: 0 };
    },
  },
  {
    kind: 'draw',
    re: /^(?:you )?draw (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i,
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  /**
   * D433 - `Target player draws a card.` / `Target opponent draws two cards.` - the draw aimed at a player (the
   * draw-step heads' referent: Howling Mine's `that player draws an additional card`); and `Each player draws a
   * card.` / `Each opponent draws a card.` - the draw over a PLAYER scope, in APNAP order (the mass shape D383 gave
   * every board effect). Neither asks.
   */
  {
    kind: 'draw',
    re: /^target (?:player|opponent) draws (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i,
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: 0 };
    },
  },
  {
    kind: 'draw',
    re: /^each (player|opponent) draws (a|one|two|three|four|five|six|seven|\d+) cards?\.$/i,
    build: (m) => {
      const n = num(m[2]);
      if (n === null) return null;
      const controller = (m[1] ?? '').toLowerCase() === 'opponent' ? 'opponents' : 'any';
      return { ...BASE, amount: n, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller }] };
    },
  },
  /**
   * D434 - the mill: `Mill three cards.` (the caster's own library), `Target player mills two cards.` (aimed at the
   * player), `Each player mills four cards.` (a player scope, APNAP). The top N into the graveyard; fewer if the
   * library is short. Nothing asks.
   */
  {
    kind: 'mill',
    re: new RegExp(`^(?:you )?mill (${MILL_COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: -1, self: true };
    },
  },
  {
    kind: 'mill',
    re: new RegExp(`^target (?:player|opponent) mills (${MILL_COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, amount: n, targetIndex: 0 };
    },
  },
  {
    kind: 'mill',
    re: new RegExp(`^each (player|opponent) mills (${MILL_COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[2]);
      if (n === null) return null;
      const controller = (m[1] ?? '').toLowerCase() === 'opponent' ? 'opponents' : 'any';
      return { ...BASE, amount: n, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller }] };
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
   * D439 - `Each player loses 2 life.` / `Each opponent loses 1 life.` - THE SCOPED LIFE LOSS, D434's mill shape one
   * verb over: every member of the player scope, APNAP. `You gain life equal to the life lost this way.` beside it
   * (Kokusho, Gray Merchant's shape without the count) is the same clause with the sum handed back (`gainLost`).
   */
  {
    kind: 'loseLife',
    re: new RegExp(`^each (player|opponent) loses (${NUM}) life\\.( you gain life equal to the life lost this way\\.)?$`, 'i'),
    build: (m) => {
      const n = num(m[2]);
      if (n === null) return null;
      const controller = (m[1] ?? '').toLowerCase() === 'opponent' ? 'opponents' : 'any';
      const gainLost = (m[3] ?? '') !== '';
      return { ...BASE, amount: n, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller }], ...(gainLost ? { gainLost: true } : {}) };
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
    build: () => ({ ...BASE, targetIndex: -1, self: true, noRegenerate: true }),
  },
  /**
   * D382 - CR 615.9, and `noRegenerate`'s shape one mechanism over. Claimed as a
   * `noop` whose FLAG rides the batch: the sentence adds nothing of its own, it
   * says the damage beside it ignores the shields. D233's tripwire existed
   * because this was executed as NOTHING while no shield could exist.
   */
  {
    kind: 'noop',
    re: /^(?:the|that) damage can't be prevented\.$/i,
    build: () => ({ ...BASE, targetIndex: -1, self: true, cantBePrevented: true }),
  },
  /**
   * D382 - the prevention shield, CR 615. Four printed forms, every one anchored
   * at both ends (D90): a shield that reads one word wider than the card prints
   * would stop damage the card never claimed to stop.
   *
   * ⚠️ The Fog cycle - "Prevent all combat damage that would be dealt this
   * turn." - names NO recipient at all, so its scope is `any` and it covers
   * every creature and every player alike. That is the card, and it is why the
   * scope is a field rather than an aim.
   */
  {
    kind: 'prevent',
    re: /^prevent all combat damage that would be dealt this turn\.$/i,
    build: () => ({ ...BASE, targetIndex: -1, self: true, preventAmount: 'all', preventCombatOnly: true, preventScope: 'any' }),
  },
  {
    kind: 'prevent',
    re: /^prevent all (combat )?damage that would be dealt to (you|players) this turn\.$/i,
    build: (m) => ({
      ...BASE,
      targetIndex: -1,
      self: true,
      preventAmount: 'all',
      preventCombatOnly: m[1] !== undefined,
      preventScope: m[2]?.toLowerCase() === 'you' ? 'you' : 'players',
    }),
  },
  {
    kind: 'prevent',
    re: new RegExp(`^prevent all (combat )?damage that would be dealt to ${TARGET} this turn\.$`, 'i'),
    build: (m) => ({ ...BASE, preventAmount: 'all', preventCombatOnly: m[1] !== undefined }),
  },
  /**
   * D427 - THE SHIELD'S SOURCE AND RECIPIENT SCOPES. `Prevent all combat damage that would be dealt this turn by
   * attacking creatures.` (Harmless Assault), `... by creatures with power 3 or less.` (Vine Snare), `... by
   * creatures target opponent controls.` (Encircling Fissure), `... by target creature this turn.` (Fend Off),
   * `Prevent all damage that would be dealt to creatures this turn.` (Forfend), `... to you and creatures you
   * control this turn.` (Safe Passage), `... to and dealt by target creature this turn.` (Foxfire's referent) -
   * 36 spells with nothing else unread carried one of these, over a shield that named a recipient and never a
   * source. The source is a closed filter (`readShieldSource`) the funnel reads off the derived source; a form
   * outside it (a colour of your choice, two colours, `except`) leaves the sentence unread (D90).
   */
  {
    kind: 'prevent',
    re: new RegExp(`^prevent all (combat )?damage that would be dealt (?:this turn by (${SHIELD_SRC})|by (${SHIELD_SRC}) this turn)\\.$`, 'i'),
    build: (m) => {
      const src = readShieldSource(m[2] ?? m[3] ?? '');
      if (src === null) return null;
      const targeted = src.kind === 'target' || src.controller === 'targetPlayer' || src.exceptTarget === true;
      return { ...BASE, ...(targeted ? {} : { targetIndex: -1, self: true }), preventAmount: 'all', preventCombatOnly: m[1] !== undefined, preventScope: 'any', preventSource: src };
    },
  },
  {
    kind: 'prevent',
    re: new RegExp(`^prevent all (combat )?damage that would be dealt (?:to (${SHIELD_RECIP}) this turn|this turn to (${SHIELD_RECIP}))(?: by (${SHIELD_SRC}))?\\.$`, 'i'),
    build: (m) => {
      const recip = readShieldRecipient(m[2] ?? m[3] ?? '');
      const src = m[4] === undefined ? null : readShieldSource(m[4]);
      if (recip === null || (m[4] !== undefined && src === null)) return null;
      const srcTargeted = src !== null && (src.kind === 'target' || src.controller === 'targetPlayer' || src.exceptTarget === true);
      // Two targets in one prevention (a target recipient and a target source) is a shape the aim cannot carry.
      if (recip === 'target' && srcTargeted) return null;
      const targeted = recip === 'target' || srcTargeted;
      return { ...BASE, ...(targeted ? {} : { targetIndex: -1, self: true }), preventAmount: 'all', preventCombatOnly: m[1] !== undefined, ...(recip === 'target' ? {} : { preventRecipient: recip }), ...(src === null ? {} : { preventSource: src }) };
    },
  },
  {
    kind: 'prevent',
    re: new RegExp(`^prevent all (combat )?damage (?:that )?(${SHIELD_SRC}) would deal this turn\\.$`, 'i'),
    build: (m) => {
      const src = readShieldSource(m[2] ?? '');
      if (src === null) return null;
      const targeted = src.kind === 'target' || src.controller === 'targetPlayer' || src.exceptTarget === true;
      return { ...BASE, ...(targeted ? {} : { targetIndex: -1, self: true }), preventAmount: 'all', preventCombatOnly: m[1] !== undefined, preventScope: 'any', preventSource: src };
    },
  },
  {
    kind: 'prevent',
    re: new RegExp(`^prevent all (combat )?damage that would be dealt to and dealt by ${TARGET} this turn\\.$`, 'i'),
    build: (m) => ({ ...BASE, preventAmount: 'all', preventCombatOnly: m[1] !== undefined, preventBothWays: true }),
  },
  {
    kind: 'prevent',
    re: new RegExp(`^prevent the next (${NUM}) (combat )?damage that would be dealt to ${TARGET} this turn\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null ? null : { ...BASE, preventAmount: n, preventCombatOnly: m[2] !== undefined };
    },
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
   * D390 - "Each opponent discards a card." / "Each player discards two cards." - THE PLAYER
   * QUEUE (CR 101.4): every player in the scope chooses in APNAP order, each seeing the choices
   * before theirs, and then all discard at once. The scope rides `scopes` (one PLAYER scope), the
   * clause aims at nobody (`targetIndex: -1`, `self: true` - D383's shape), and it ASKS, so it must
   * be the sentence's last. This is the sentence the comment above refused since D137, and the
   * field it would not invent is the scope D383 gave every board effect.
   */
  /**
   * D426 - the caster's OWN discard: `Discard a card.` / `You discard two cards.` - the each-player queue below over
   * the `you` scope (D425), one player, the ask last as ever. The loot's second half (`Draw a card, then discard a
   * card.` - the conjunction reads it as two clauses), Careful Study's, the wheel's tail.
   */
  {
    kind: 'discard',
    re: new RegExp(`^(?:you )?discards? (${COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      return n === null || n <= 0 ? null : { ...BASE, amount: n, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller: 'you' }] };
    },
  },
  /**
   * D435 - THE IF-YOU-DO PAIR. `Draw a card. If you do, discard a card.` (the loot the library gates: an empty
   * library draws nothing and discards nothing) and `Discard a card. If you do, draw a card.` (the rummage the
   * hand gates: an empty hand discards nothing and draws nothing). Each is ONE clause - a discard of the
   * controller's own, with the draw riding it (`ifDrew` before, `thenDraw` after) - so the ask stays last.
   */
  {
    kind: 'discard',
    re: new RegExp(`^draw (${COUNT}) cards?\\. if you do, discard (${COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const d = num(m[1]);
      const n = num(m[2]);
      return d === null || n === null || d <= 0 || n <= 0 ? null : { ...BASE, amount: n, targetIndex: -1, self: true, ifDrew: d };
    },
  },
  {
    kind: 'discard',
    re: new RegExp(`^discard (${COUNT}) cards?\\. if you do, draw (${COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      const d = num(m[2]);
      return d === null || n === null || d <= 0 || n <= 0 ? null : { ...BASE, amount: n, targetIndex: -1, self: true, thenDraw: d };
    },
  },
  {
    kind: 'discard',
    re: new RegExp(`^each (player|opponent) discards (${COUNT}) cards?\\.$`, 'i'),
    build: (m) => {
      const n = num(m[2]);
      if (n === null || n <= 0) return null;
      const controller = (m[1] ?? '').toLowerCase() === 'opponent' ? 'opponents' : 'any';
      return { ...BASE, amount: n, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller }] };
    },
  },
  /**
   * D390 - "Each player sacrifices a creature of their choice." / "Each opponent sacrifices a
   * permanent of their choice." - the same queue over the BATTLEFIELD. The noun goes through the
   * sacrifice chooser's own reader (D168), so "a creature or planeswalker" is two arms and a word
   * it cannot place ("with flying", "nontoken") refuses the sentence rather than widening it.
   */
  /**
   * D431 - the caster's OWN sacrifice: `Sacrifice a creature.` / `You sacrifice a land.` / `Sacrifice two creatures.` - the
   * queue above over the `you` scope (D426's discard shape), the ask last as ever. `Sacrifice ~` / `it` stays `sacrificeSelf`
   * (its rule stands earlier); a noun the sacrifice chooser's reader cannot place refuses the sentence (D390's rule).
   */
  {
    kind: 'sacrifice',
    re: new RegExp(`^(?:you )?sacrifices? (${COUNT}) ([A-Za-z ]+?)\\.$`, 'i'),
    build: (m) => {
      const n = num(m[1]);
      if (n === null || n <= 0) return null;
      const noun = (m[2] ?? '').trim().replace(/s$/, '');
      const predicates = predicatesOf(noun);
      if (!predicates || predicates.length === 0) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller: 'you' }], sacrifice: { predicates, what: noun } };
    },
  },
  /**
   * D431 - `Return a land you control to its owner's hand.` / `Return a creature you control to its owner's hand.` - THE
   * QUEUE's third verb (the bounce lands, the Invasion lairs' kin): the caster alone chooses a permanent the noun admits
   * and it goes to its owner's hand. The same reader names the noun; it ASKS, so it is the sentence's last.
   */
  {
    kind: 'returnChoose',
    re: /^return (an? [A-Za-z ]+?) you control to its owner's hand\.$/i,
    build: (m) => {
      const noun = (m[1] ?? '').trim().replace(/^an? /i, '');
      const predicates = predicatesOf(noun);
      if (!predicates || predicates.length === 0) return null;
      return { ...BASE, amount: 1, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller: 'you' }], returnChoose: { predicates, what: noun } };
    },
  },
  {
    kind: 'sacrifice',
    re: /^each (player|opponent) sacrifices (an? [A-Za-z ]+?) of their choice\.$/i,
    build: (m) => {
      const what = (m[2] ?? '').trim();
      const predicates = predicatesOf(what.replace(/^an? /i, ''));
      if (!predicates || predicates.length === 0) return null;
      const controller = (m[1] ?? '').toLowerCase() === 'opponent' ? 'opponents' : 'any';
      return { ...BASE, amount: 1, targetIndex: -1, self: true, scopes: [{ kind: 'player', controller }], sacrifice: { predicates, what: what.replace(/^an? /i, '') } };
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
   * D436 - THE GRAVEYARD-CARD TARGET, one verb over from the returns above: `Exile target card from a graveyard.`
   * (any graveyard - the target parser reads `a` as no owner), `... from your graveyard`, `... from an opponent's
   * graveyard`, with the adjectives and nouns `GY_NOUN` admits; and `Put target card from a graveyard on the bottom
   * of its owner's library.` Neither asks; a counted clause (`up to one`) runs once per pick.
   */
  {
    kind: 'exileFromGraveyard',
    re: new RegExp(`^exile ${COUNTED}target ${GY_NOUN} from (?:a|your|an opponent's) graveyard\\.$`, 'i'),
    build: () => ({ ...BASE }),
  },
  {
    kind: 'graveyardToLibraryBottom',
    re: new RegExp(`^put ${COUNTED}target ${GY_NOUN} from (?:a|your|an opponent's) graveyard on the bottom of (?:its|their) owner's library\\.$`, 'i'),
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
      `^look at the top (${COUNT}) cards of your library\\. put (${COUNT}) of them into your hand and (the rest|the other) into your graveyard\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      const take = num(m[2]);
      if (n === null || take === null || take < 1 || take >= n) return null;
      // D389 - "the OTHER into your graveyard" is singular (Talas Lookout, Ral's Outburst):
      // exactly one card may be left over, the same arithmetic the bottom form checks.
      if ((m[3] ?? '').toLowerCase() === 'the other' && n - take !== 1) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'graveyard', filter: null, optional: false } };
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
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'bottom', filter: null, optional: false } };
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
   * ⚠️ D389 - "in a RANDOM order" is READ now. `effectEvents` still has no
   * generator and needs none: the shuffle happens in the ANSWER handler off the
   * seeded rng (D147's `rngAfter` shape), which is where the leftovers are known.
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
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'bottomOrdered', filter: null, optional: false } };
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
      return n === null || n < 2 ? null : { ...BASE, amount: n, targetIndex: -1, self: true, look: { take: 0, rest: 'topOrdered', filter: null, optional: false } };
    },
  },
  /**
   * D389 - THE LOOK WITH A FILTER, the densest one-piece family the fresh leftover
   * held after D388 (57 cards, most of them trigger payloads under an enters head):
   * "Look at the top N cards of your library. You may reveal a creature card from
   * among them and put it into your hand. Put the rest on the bottom of your
   * library in a random order." Three sentences, one effect (`MAX_SPAN` is 3 for
   * it), and three things D141's shape did not have: a FILTER on the pick (the
   * search's own noun reader - refused when a word cannot be placed), an OPTIONAL
   * pick ("you may": down to none), and a RANDOM order for the leftovers, shuffled
   * in the ANSWER handler off the seeded generator.
   */
  {
    kind: 'lookAtTop',
    re: new RegExp(
      `^look at the top (${COUNT}) cards of your library\\. you may reveal ${LOOK_NOUN} from among them and put (?:it|that card) into your hand\\. put the rest on the bottom of your library in (?<order>a random order|any order)\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      const filter = lookFilter(m.groups ?? {});
      if (n === null || n < 1 || !filter) return null;
      const rest = (m.groups?.['order'] ?? '').toLowerCase() === 'any order' ? 'bottomOrdered' : 'random';
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take: 1, rest, filter, optional: true } };
    },
  },
  /**
   * D416 - THE HAND REVEAL AND CHOOSE (Thoughtseize's family): `Target opponent reveals their hand. You
   * choose a nonland card from it. That player discards that card.` - three sentences, one effect. The
   * hand is revealed to everyone (CR 701.15a), the CASTER chooses among what the noun admits (the look's
   * own reader, D389; `a card` unfiltered; a mana-value bound beside the noun or after `from it`), and the
   * card is discarded (the owner's discard, CR 701.8) or exiled. `from that player's graveyard or hand`
   * (two zones), a second pick and `then you may cast it` stay out.
   */
  {
    kind: 'revealHandChoose',
    re: new RegExp(
      `^target (?:opponent|player) reveals their hand\\. you choose (?:${LOOK_NOUN}|a card)(?: with mana value (?<mvn1>\\d+) or (?<mvop1>less|greater))? from it(?: with mana value (?<mvn2>\\d+) or (?<mvop2>less|greater))?(?<tail>\\. that player discards that card|\\. exile that card| and exiles? that card)\\.(?: you lose (?<life>\\d+) life\\.)?$`,
      'i',
    ),
    build: (m) => {
      const g = m.groups ?? {};
      // The negations first (`noncreature, nonland`): types the card must lack; the rest is the look's noun.
      const NON: Readonly<Record<string, string>> = { nonland: 'Land', noncreature: 'Creature', nonartifact: 'Artifact', nonenchantment: 'Enchantment', noninstant: 'Instant', nonsorcery: 'Sorcery', nonplaneswalker: 'Planeswalker' };
      let noun = (g['noun'] ?? '').trim();
      const none: string[] = [];
      for (;;) {
        const lead = noun.match(/^(non[a-z]+),?\s*/i);
        const type = lead ? NON[(lead[1] ?? '').toLowerCase()] : undefined;
        if (!lead || type === undefined) break;
        none.push(type);
        noun = noun.slice(lead[0].length);
      }
      if (/\bnon[a-z]+/i.test(noun)) return null;
      // An Oxford list (`artifact, instant, or sorcery`) is alternatives: every comma reads as `or`.
      const rest = noun.replace(/,\s*(?:or\s+)?/g, ' or ').replace(/\s+/g, ' ').trim();
      const filter = rest !== '' ? lookFilter({ noun: rest }) : null;
      if (rest !== '' && !filter) return null;
      const what = g['noun'] ? g['noun'] + ' card' : 'card';
      const n = g['mvn1'] ?? g['mvn2'];
      const op = (g['mvop1'] ?? g['mvop2'] ?? '').toLowerCase();
      const qualifier = n ? { manaValue: { op: op === 'less' ? ('lte' as const) : ('gte' as const), n: Number(n) }, name: null } : null;
      const then = /discards/i.test(g['tail'] ?? '') ? ('discard' as const) : ('exile' as const);
      return { ...BASE, handChoice: { none, filter, what, qualifier, then, loseLife: g['life'] ? Number(g['life']) : 0 } };
    },
  },
  /**
   * D417 - THE PLAY PERMISSION: `Exile the top card of your library. Until the end of your next turn, you
   * may play that card.` - two sentences, one effect: the cards go to exile face up and the caster may play
   * each until the deadline (this turn; the end of your next turn; your next end step), a permission the
   * legal offer, the cast and the land play read. `you may cast` (a spell-only permission), `without
   * paying its mana cost`, a permission on ANOTHER player's card and a permission with a condition stay out.
   */
  {
    kind: 'exileTopPlay',
    re: new RegExp(
      `^exile the top (?:(${COUNT}) )?cards? of your library\\. (?:until the end of your next turn, you may play (?:it|that card|those cards)|you may play (?:it|that card|those cards) (?<tail>this turn|until the end of your next turn|until end of turn)|until end of turn, you may play (?:it|that card|those cards)|until your next end step, you may play (?:it|that card|those cards))\\.$`,
      'i',
    ),
    build: (m) => {
      const n = m[1] === undefined ? 1 : num(m[1]);
      if (n === null || n < 1) return null;
      const text = m[0].toLowerCase();
      const until = /next end step/.test(text) ? ('yourNextEndStep' as const) : /your next turn/.test(text) ? ('yourNextTurn' as const) : ('thisTurn' as const);
      return { ...BASE, amount: n, targetIndex: -1, self: true, exilePlay: { count: n, until } };
    },
  },
  /** D389 - the plain "in a random order" (`Drawn from Dreams`), read for the same reason. */
  {
    kind: 'lookAtTop',
    re: new RegExp(
      `^look at the top (${COUNT}) cards of your library\\. put (${COUNT}) of them into your hand and the rest on the bottom of your library in a random order\\.$`,
      'i',
    ),
    build: (m) => {
      const n = num(m[1]);
      const take = num(m[2]);
      if (n === null || take === null || take < 1 || take >= n) return null;
      return { ...BASE, amount: n, targetIndex: -1, self: true, look: { take, rest: 'random', filter: null, optional: false } };
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
  searchRule(),
  searchTopRule(),
];

/**
 * Replace the card's own name with `~`, so a self-reference does not defeat
 * matching. Lightning Bolt's text literally says "Lightning Bolt deals 3 damage".
 */
/** D449 - the delayed return dash arms (CR 702.109a): the source itself to its owner's hand, if it is still on the battlefield. */
export function dashReturnSpec(): EffectSpec {
  return { ...BASE, kind: 'bounce', text: "Return it to its owner's hand.", targetIndex: -1, self: true };
}

/** D463 - the delayed sacrifice mobilize arms on each Warrior (CR 702.179a): the token itself, if it is still there. */
export function mobilizeSacrificeSpec(): EffectSpec {
  return { ...BASE, kind: 'sacrificeSelf', text: 'Sacrifice it.', targetIndex: -1, self: true };
}

/** D448 - the delayed exile unearth arms (CR 702.84c): the source itself, if it is still on the battlefield. */
export function unearthExileSpec(): EffectSpec {
  return { ...BASE, kind: 'exileSelf', text: 'Exile it.', targetIndex: -1, self: true };
}

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
  // D391 - ", then proliferate." is a clause of its own (CR 701.27a is a separate action), so it
  // is split off: the sentence before it is read by its own rule and the ask stays LAST.
  return text
    .replace(/, then proliferate[.]/gi, '. Proliferate.')
    .split('\n')
    .flatMap((line) => line.split(/(?<=\.)\s+/))
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * How many printed sentences one effect may span.
 *
 * ⚠️ THREE since D389: the filtered look prints three sentences that are one
 * effect ("Look at the top N. You may reveal a creature card from among them and
 * put it into your hand. Put the rest on the bottom in a random order."), and
 * raising the bound needed no other change - which is the whole point of the
 * rewrite. It is a bound on the window, not a list of what may be joined.
 */
// D416 - FOUR: Thoughtseize's `You lose 2 life.` is the hand reveal's fourth sentence, carried inside the spec.
const MAX_SPAN = 4;

/** D299: the counts a clause may be declared with NO target for. */
const OPTIONAL_COUNT = /\b(?:up to (?:one|two|three)|any number of) target\b/i;

/** One clause of a face: the text it covers, and what it was understood as. */
interface Clause {
  readonly text: string;
  readonly spec: EffectSpec | null;
  /**
   * D392 - what the clause is ABOUT, for the sentence after it: its first target phrase as
   * printed, `~` for a self subject, or the phrase inherited from the clause it referred to;
   * null when the clause names nothing a later sentence could point back at.
   */
  readonly phrase: string | null;
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
/**
 * D392 - THE REFERENT SUBJECT. A later sentence about the previous clause's subject ("Untap
 * that creature.", "It gains haste until end of turn.", "That creature gains reach until end
 * of turn.") is read by the rule its explicit form is read by: the referent is replaced, in
 * the sentence handed to the rules only, by the previous clause's phrase - its first target
 * phrase as printed, or `~` after a self subject - and the clause keeps its PRINTED text, so
 * the targeting layer (which counts `target` phrases in the printed text) and the effect
 * count still agree; `parseEffects` aims the clause where the previous one aimed instead of
 * consuming a target. Only a sentence that STARTS with the referent, or with one of the verbs
 * that take it as their object, is rewritten; a referent with nothing before it to point at
 * is left unread, exactly as before. "Its controller", "that player" and "them" are not
 * referents here: a player or a counted set is a different subject, refused by name.
 */
// D394 - the COUNTED referent ("Those creatures can't block this turn." after "up to three target
// creatures"): the clause inherits the counted phrase and runs once per pick, as the clause it
// refers to does.
const REFERENT = '(?:it|that (?:creature|permanent|artifact|enchantment|land|planeswalker)|those (?:creatures|permanents))';
const REFERENT_LEAD = new RegExp(`^(?:then )?(?:if )?${REFERENT}(?![a-z'])`, 'i');
const REFERENT_OBJECT = new RegExp(`^(?:then )?(?:untap|tap|destroy|exile|sacrifice|return|attach) ${REFERENT}(?![a-z'])`, 'i');
// D427 - a prevention shield ABOUT the referent: `Prevent all damage that would be dealt to it this turn.`
// (Djeru's Resolve), `... to and dealt by that creature this turn.` (Foxfire, Energy Arc) - the referent
// stands where the target clause would, mid-sentence.
const REFERENT_SHIELD = new RegExp(`^prevent all (?:combat )?damage that would be dealt (?:to|to and dealt by) ${REFERENT}(?![a-z'])`, 'i');
const REFERENT_ANY = new RegExp(`(?<![a-z])${REFERENT}(?![a-z'])`, 'gi');
const PHRASE_TARGET = new RegExp(TARGET, 'i');
const PHRASE_SELF = new RegExp(`^(?:then )?${SELF}(?![a-z])`, 'i');

// D394 - the TARGET first: "~ deals 2 damage to target creature. That creature can't block this
// turn." is about the creature dealt the damage, not the source, however the sentence starts. The
// self is the phrase only when the sentence names no target at all.
function phraseOf(text: string): string | null {
  const m = text.match(PHRASE_TARGET);
  if (m) return m[0];
  return PHRASE_SELF.test(text) ? '~' : null;
}

function referentRewrite(sentence: string, previous: Clause | undefined): EffectSpec | null {
  if (!previous?.spec || previous.phrase === null) return null;
  if (!REFERENT_LEAD.test(sentence) && !REFERENT_OBJECT.test(sentence) && !REFERENT_SHIELD.test(sentence)) return null;
  const hit = matchSentence(sentence.replace(REFERENT_ANY, previous.phrase));
  return hit ? { ...hit, text: sentence, referent: true } : null;
}

/**
 * D423 - THE KICKED INSTEAD (CR 702.33): `If this spell was kicked, <clause> instead.` REPLACES the clause before
 * it when the spell was kicked - `it deals 4 damage instead` (the spell's own damage at the previous target),
 * `that creature gets +4/+4 until end of turn instead` (a referent clause about the previous object), `create
 * four of those tokens instead` (the previous token, a new count). Read against the clause before it, the way a
 * referent is (D392); the executor skips the base when the spell was kicked and the instead clause when it was
 * not. An instead clause with a target of its own (`instead destroy target creature`) is a second mode the cast
 * does not carry and stays unread; so does a referent the vocabulary has no phrase for (`that player`).
 */
const KICKED_INSTEAD = /^If this spell was kicked, (?:instead )?(.+?)(?: instead)?\.$/i;
const TOKEN_WORDS: Readonly<Record<string, number>> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
function kickedInsteadRewrite(sentence: string, previous: Clause | undefined): EffectSpec | null {
  if (!/\binstead\b/i.test(sentence)) return null;
  const m = KICKED_INSTEAD.exec(sentence);
  if (!m || !previous?.spec) return null;
  const inner = (m[1] ?? '').trim();
  const tok = /^create (a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve) of those tokens$/i.exec(inner);
  if (tok) {
    if (previous.spec.kind !== 'createToken' || previous.spec.ifKicked) return null;
    return { ...previous.spec, amount: TOKEN_WORDS[(tok[1] ?? '').toLowerCase()] ?? 1, text: sentence, ifKicked: true, kickedInstead: true };
  }
  const dmg = /^it deals (\d+) damage$/i.exec(inner);
  if (dmg) {
    if (previous.spec.kind !== 'damage' || previous.phrase === null) return null;
    const hit = matchSentence(`~ deals ${dmg[1]} damage to ${previous.phrase}.`);
    return hit ? { ...hit, text: sentence, referent: true, ifKicked: true, kickedInstead: true } : null;
  }
  const ref = referentRewrite(inner + '.', previous);
  if (!ref || ref.targetIndex === -1 || ref.pay || ref.per) return null;
  return { ...ref, text: sentence, ifKicked: true, kickedInstead: true };
}
/**
 * D426 - THE CONJUNCTION. `Target opponent loses 2 life and you gain 2 life.`, `You gain 2 life and draw a
 * card.`, `Put a +1/+1 counter on target creature and draw a card.`, `Draw a card, then discard a card.` - one
 * printed sentence that is TWO clauses the vocabulary reads whole on their own (a rule each, or the right half a
 * referent of the left - `Tap target creature and it doesn't untap ...`). Measured before it was built: 235
 * sentences over the leftover split so, 188 cards with nothing else unread. The split is tried only after no
 * rule read the whole sentence (a pump's `gets +2/+2 and gains flying` is one rule and never reaches here), at
 * each ` and ` / `, then ` from the left, and BOTH halves must read as one clause each - a half that is a noun
 * (`target creature and target land` - `Target land.` reads as nothing) leaves the sentence unread, as before.
 * Each half keeps its own text (the narration says what it did) and takes its targets in printed order
 * (`parseEffects` numbers them clause by clause). An asking left half still lands `assisted` by D195's rule.
 */
function conjunctionSplit(sentence: string, previous: Clause | undefined): Clause[] | null {
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  for (const sep of [' and ', ', then ']) {
    const parts = sentence.split(sep);
    for (let k = 1; k < parts.length; k++) {
      const leftText = parts.slice(0, k).join(sep) + '.';
      const rightText = cap(parts.slice(k).join(sep));
      if (!/[.]$/.test(rightText) || /^(?:you may|if |when |whenever |unless )/i.test(rightText)) continue;
      const left = matchSentence(leftText);
      if (!left || left.pay || left.delay) continue;
      const leftClause: Clause = { text: leftText, spec: left, phrase: phraseOf(leftText) };
      // D433 - a right half with NO subject after a PLAYER subject on the left (`Target player draws a card, then discards a
      // card.`, `Each player draws a card, then discards a card.`) is THAT player's, never the caster's own discard: the
      // subject continues, and a targeted one aims where the left aimed (a referent, no index of its own).
      const subj = /^(target (?:player|opponent)|each (?:player|opponent)) /i.exec(leftText)?.[1];
      const bare = subj && /^(?:draws|discards|loses|gains|sacrifices|mills|exiles|reveals|puts|shuffles|creates|gets) /i.test(rightText)
        ? matchSentence(cap(subj + ' ' + rightText.charAt(0).toLowerCase() + rightText.slice(1)))
        : null;
      const continued = bare ? (bare.targetIndex === -1 ? bare : { ...bare, referent: true as const }) : null;
      const right = continued ?? matchSentence(rightText) ?? referentRewrite(rightText, leftClause) ?? (previous ? referentRewrite(rightText, previous) : null);
      if (!right || right.pay || right.delay) continue;
      const rightIsReferent = right.referent === true;
      return [leftClause, { text: rightText, spec: right, phrase: rightIsReferent ? leftClause.phrase : phraseOf(rightText) }];
    }
  }
  return null;
}

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
    // D392 - a sentence no rule reads on its own may be about the clause before it.
    const previous = out[out.length - 1];
    const referred = spec === null ? referentRewrite(raw[i] ?? '', previous) : null;
    if (referred) spec = referred;
    // D423 - a kicked `instead` clause is read against the clause before it too.
    const insteadK = spec === null ? kickedInsteadRewrite(raw[i] ?? '', previous) : null;
    if (insteadK) spec = insteadK;
    // D426 - a sentence no rule reads whole may be TWO clauses joined by `and` (or `, then`).
    const joined2 = spec === null ? conjunctionSplit(raw[i] ?? '', previous) : null;
    if (joined2) {
      out.push(...joined2);
      i += 1;
      continue;
    }
    const clauseText = raw.slice(i, i + span).join(' ');
    out.push({ text: clauseText, spec, phrase: referred || insteadK ? (previous?.phrase ?? null) : phraseOf(clauseText) });
    i += span;
  }
  return out;
}

/**
 * D369 - THE PAYMENT SHAPES. "<body> unless <payer> pays <cost>." and "You may pay
 * <cost>. If you do, <body>." The BODY is one sentence the table reads on its own, so
 * what the prompt decides is exactly what the vocabulary already runs. Refused: a body
 * that itself asks or uses randomness (no continuation past a prompt, no RNG through
 * the answer), a body that starts "you may" (a second choice inside the first), a payer
 * the engine cannot name ("any player", "they"), a cost with X.
 */
const PAY_COST = String.raw`((?:\{[^}]+\})+|\d+ life|(?:\{[^}]+\})+ and \d+ life)`;
// D432 - `unless target player pays` (a referent row's rewrite, D428) and `unless they pay` (the draw heads' player).
const UNLESS_RE = new RegExp(String.raw`^(.+?) unless (its controller|that player|target player|they|you) pays? ${PAY_COST}\.$`, 'i');
const MAY_PAY_RE = new RegExp(String.raw`^you may pay ${PAY_COST}\. if you do, (.+)$`, 'i');
// D432 - `Target player may pay {2}. If the player doesn't, you create a Treasure token.` (Smothering Tithe's shape): the
// referent player is asked and the body happens when they decline - `X unless target player pays` in the other order.
const TARGET_MAY_PAY_RE = new RegExp(String.raw`^target player may pay ${PAY_COST}\. if (?:the player|they) (?:doesn't|don't), (.+)$`, 'i');
/**
 * D415 - THE VERB PRICE. `You may <verb>. If you do, <body>.` and `<body> unless you <verb>.` are the
 * same prompt with a chooser-verb price - D406's grammar (one sacrifice, discard, tap, exile from the
 * graveyard or return to hand; a random discard, two verbs and a comma stay unread) or the object's own
 * sacrifice (`sacrifice it`). Only the CASTER pays a verb price: another player's hand and board are
 * not this prompt's to pick from, so `unless that player sacrifices ...` stays unread.
 */
const VERB_LEAD = String.raw`(?:sacrifice|discard|exile|return|tap)`;
const MAY_VERB_RE = new RegExp(String.raw`^(?:then )?you may (${VERB_LEAD} .+?)\. if you do, (.+)$`, 'i');
const UNLESS_VERB_RE = new RegExp(String.raw`^(.+?) unless you (${VERB_LEAD} [^.]+)\.$`, 'i');
const SELF_PRICE_RE = /^sacrifice (?:it|~|this (?:creature|permanent|artifact|enchantment|land))$/i;

function readVerbPrice(raw: string): VerbPrice | null {
  const price = raw.trim();
  if (SELF_PRICE_RE.test(price)) {
    return { costText: price, sacrificeSelf: true, sacrificeCost: null, discardCost: null, tapCost: null, exileFromGraveyardCost: null, returnCost: null };
  }
  const read = readCostVerbs(price, parseManaCost);
  if (!read || read.lifeCost > 0) return null;
  return { costText: price, sacrificeSelf: false, sacrificeCost: read.sacrificeCost, discardCost: read.discardCost, tapCost: read.tapCost, exileFromGraveyardCost: read.exileFromGraveyardCost, returnCost: read.returnCost };
}
const PAY_BODY_REFUSED: ReadonlySet<EffectKind> = new Set(['discard', 'lookAtTop', 'scry', 'surveil', 'search', 'payOptional', 'sacrifice', 'proliferate', 'explore', 'connive', 'revealHandChoose']);

function readPrice(raw: string): { cost: PaySpec['cost']; life: number } | null {
  const life = raw.match(/(\d+) life$/i);
  const mana = raw.match(/^(?:\{[^}]+\})+/);
  const cost = mana ? parseManaCost(mana[0]) : null;
  // D422 - a price of `{X}` is the spell's announced X, substituted as the prompt is raised (`obj.xValue`).
  if (mana && (cost === null || mana[0].includes('~'))) return null;
  return { cost, life: life ? Number(life[1]) : 0 };
}

function payBody(sentence: string): EffectSpec | null {
  if (/^you may\b/i.test(sentence)) return null;
  // D432 - `you create a Treasure token` (Smothering Tithe's decline body): the imperative the rules read, with the
  // caster named. `you may` above stays refused; `you gain` / `you lose` / `you draw` already read with their subject.
  const bare = sentence.replace(/^you create\b/i, 'create');
  const inner = matchRule(bare.endsWith('.') ? bare : bare + '.');
  if (!inner || PAY_BODY_REFUSED.has(inner.kind) || inner.atRandom) return null;
  return inner;
}

function matchPayment(sentence: string): EffectSpec | null {
  const u = sentence.match(UNLESS_RE);
  if (u) {
    const price = readPrice(u[3] ?? '');
    const inner = payBody(u[1] ?? '');
    if (!price || !inner) return null;
    const who = /^its controller$/i.test(u[2] ?? '') ? 'targetController' : /^(?:that player|target player|they)$/i.test(u[2] ?? '') ? 'targetPlayer' : 'controller';
    return { ...BASE, kind: 'payOptional', text: sentence, targetIndex: inner.targetIndex, self: inner.self, pay: { cost: price.cost, life: price.life, verbs: null, who, ifPaid: [], ifNotPaid: [inner] } };
  }
  const tm = sentence.match(TARGET_MAY_PAY_RE);
  if (tm) {
    const price = readPrice(tm[1] ?? '');
    const inner = payBody(tm[2] ?? '');
    if (!price || !inner) return null;
    return { ...BASE, kind: 'payOptional', text: sentence, targetIndex: inner.targetIndex, self: inner.self, pay: { cost: price.cost, life: price.life, verbs: null, who: 'targetPlayer', ifPaid: [], ifNotPaid: [inner] } };
  }
  const m = sentence.match(MAY_PAY_RE);
  if (m) {
    const price = readPrice(m[1] ?? '');
    const inner = payBody(m[2] ?? '');
    if (!price || !inner) return null;
    return { ...BASE, kind: 'payOptional', text: sentence, targetIndex: inner.targetIndex, self: inner.self, pay: { cost: price.cost, life: price.life, verbs: null, who: 'controller', ifPaid: [inner], ifNotPaid: [] } };
  }
  // D415 - the verb prices, after the mana forms (`pay` is not a verb lead, so neither shadows the other).
  const uv = sentence.match(UNLESS_VERB_RE);
  if (uv) {
    const verbs = readVerbPrice(uv[2] ?? '');
    const inner = payBody(uv[1] ?? '');
    if (!verbs || !inner) return null;
    return { ...BASE, kind: 'payOptional', text: sentence, targetIndex: inner.targetIndex, self: inner.self, pay: { cost: null, life: 0, verbs, who: 'controller', ifPaid: [], ifNotPaid: [inner] } };
  }
  const mv = sentence.match(MAY_VERB_RE);
  if (mv) {
    const verbs = readVerbPrice(mv[1] ?? '');
    const inner = payBody(mv[2] ?? '');
    if (!verbs || !inner) return null;
    return { ...BASE, kind: 'payOptional', text: sentence, targetIndex: inner.targetIndex, self: inner.self, pay: { cost: null, life: 0, verbs, who: 'controller', ifPaid: [inner], ifNotPaid: [] } };
  }
  return null;
}

/**
 * D402 - THE DELAYED TRIGGER'S CLAUSE (CR 603.7). `Draw a card at the beginning of the next turn's
 * upkeep.` is `Draw a card.` armed for a later step, and `At the beginning of the next end step,
 * sacrifice it.` is the same shape led. The inner sentence is asked of the rules as it stands, and
 * the delay rides the spec. ⚠️ Only an effect with NO target, NO referent, NO ask and NO payment
 * is read delayed: the fire runs over an empty target list long after the picks were legal, and a
 * referent (`it`, `that creature`) names an object the executor does not carry across the wait.
 * `the next turn's upkeep` and `the next upkeep` are the same step of the next turn; `your next
 * upkeep` waits for the controller's own; `the next end step` is the first end step to begin.
 */
const DELAY_TAIL = /^(.+?) at the beginning of (the next turn(?:'|’)s upkeep|the next upkeep|your next upkeep|the next end step|your next end step)\.$/i;
const DELAY_HEAD = /^At the beginning of (the next turn(?:'|’)s upkeep|the next upkeep|your next upkeep|the next end step|your next end step), (.+)$/i;
const DELAY_ASKS: ReadonlySet<EffectKind> = new Set(['discard', 'lookAtTop', 'scry', 'surveil', 'search', 'payOptional', 'sacrifice', 'proliferate', 'explore', 'connive', 'revealHandChoose']);
function delayWhen(phrase: string): DelayWhen {
  const p = phrase.toLowerCase();
  return { step: p.includes('upkeep') ? 'upkeep' : 'end', whose: p.startsWith('your') ? 'controller' : 'next' };
}
function matchDelayed(sentence: string): EffectSpec | null {
  const tail = DELAY_TAIL.exec(sentence);
  const head = tail ? null : DELAY_HEAD.exec(sentence);
  if (!tail && !head) return null;
  const innerText0 = tail ? (tail[1] ?? '') : (head?.[2] ?? '');
  const innerText = innerText0.charAt(0).toUpperCase() + innerText0.slice(1) + (innerText0.endsWith('.') ? '' : '.');
  const inner = matchRule(innerText);
  if (!inner) return null;
  // A SELF-aimed effect (a sacrifice of the source, a pump on it) names an object the fire may not find; a
  // draw or a life gain is aimed at the CONTROLLER and carries no such mark.
  if (inner.targetIndex !== -1 || inner.referent || (inner.self && SELF_AIMED.has(inner.kind)) || inner.kind === 'sacrificeSelf' || inner.pay || inner.atRandom || DELAY_ASKS.has(inner.kind)) return null;
  return { ...inner, text: sentence, delay: delayWhen((tail ? tail[2] : head?.[1]) ?? '') };
}

/**
 * D403 - KICKER'S CONDITIONAL CLAUSE (CR 702.33): `If this spell was kicked, <X>.` is X gated on the
 * kick the cast announced (`StackObject.kicked`), and the executor skips it - saying so - on an
 * unkicked spell. The inner sentence is asked of the rules as it stands (a target, a referent, an
 * ask are all fine: the clause runs in the spell's own resolution, unlike a delayed one). The
 * `instead` forms (`it deals 4 damage instead`) do not read as a sentence and stay unread.
 */
const IF_KICKED = /^If this spell was kicked, (.+)$/i;
function matchKicked(sentence: string): EffectSpec | null {
  const m = IF_KICKED.exec(sentence);
  if (!m) return null;
  const rest0 = m[1] ?? '';
  const rest = rest0.charAt(0).toUpperCase() + rest0.slice(1);
  const inner = matchPayment(rest) ?? matchRule(rest);
  if (!inner) return null;
  return { ...inner, text: sentence, ifKicked: true };
}

/**
 * D418 - THE COUNT NOUN: `creature you control`, `other attacking Goblin`, `artifact you control with a
 * +1/+1 counter on it`, `card in your hand`, `creature card in your graveyard`, `time it was kicked`,
 * `creature that died this turn`, `creature in your party`, `opponent`, `basic land type among lands you
 * control`. A permanent noun goes through `predicatesOf` (the sacrifice and tap costs' reader); a
 * controller is required unless the noun is attacking or `on the battlefield`; `and` between two types
 * (both, or either - print is ambiguous), `tapped`, `they control` (a referent) and a keyword the
 * grantable list lacks refuse the noun, and with it the sentence (D90).
 */
const COUNT_KW = String.raw`(?:flying|vigilance|trample|haste|lifelink|deathtouch|first strike|double strike|reach|menace|defender|hexproof|indestructible|flash)`;
const COUNT_PERM = new RegExp(
  String.raw`^(?<other>other )?(?<qual>attacking |untapped |tapped )?(?<noun>[a-zA-Z][a-zA-Z/' -]*?)(?: (?<ctl>you control|your opponents control|on the battlefield|target opponent controls|they control))?(?: with (?<kw>${COUNT_KW}))?(?: with power (?<pw>\d+) or greater)?(?<pc> with a \+1/\+1 counter on it)?(?: named (?<named>[^,.]+))?$`,
  'i',
);
function readCountNoun(raw: string): CountExpr | null {
  const noun = raw.trim();
  const low = noun.toLowerCase();
  if (/^time (?:it|this spell|this creature|this permanent|~) was kicked$/.test(low)) return { kind: 'kicked' };
  if (low === 'card in your hand') return { kind: 'cardsInHand', who: 'you' };
  if (low === 'creature that died this turn') return { kind: 'diedThisTurn' };
  if (low === 'creature in your party') return { kind: 'party' };
  if (low === 'opponent') return { kind: 'players', who: 'opponents' };
  if (low === 'player') return { kind: 'players', who: 'any' };
  if (low === 'basic land type among lands you control') return { kind: 'basicLandTypes' };
  const gy = /^(?:(?<pred>.+?) )?card(?: named (?<gname>[^,.]+?))? in your graveyard$/i.exec(noun);
  if (gy) {
    const pred = gy.groups?.['pred'];
    if (pred && /\band\b/.test(pred.replace(/and\/or/g, ''))) return null;
    const predicates = pred ? predicatesOf(pred) : null;
    if (pred && (!predicates || predicates.length === 0)) return null;
    return { kind: 'cardsInGraveyard', predicates, named: gy.groups?.['gname']?.trim() ?? null };
  }
  const m = COUNT_PERM.exec(noun);
  const g = m?.groups;
  if (!g) return null;
  const nounText = (g['noun'] ?? '').trim();
  if (nounText === '' || /\band\b/.test(nounText.replace(/and\/or/g, ''))) return null;
  const predicates = predicatesOf(nounText);
  if (!predicates || predicates.length === 0) return null;
  const qual = (g['qual'] ?? '').trim().toLowerCase();
  if (qual === 'tapped') return null;
  const ctl = (g['ctl'] ?? '').toLowerCase();
  const controller =
    ctl === 'you control' ? 'you' : ctl === 'your opponents control' ? 'opponents' : ctl === 'on the battlefield' ? 'any' : ctl === '' && qual === 'attacking' ? 'any' : null;
  if (controller === null) return null;
  const kw = g['kw'] !== undefined ? (GRANTABLE.get(g['kw'].toLowerCase()) ?? null) : null;
  if (g['kw'] !== undefined && kw === null) return null;
  return {
    kind: 'permanents',
    controller,
    predicates,
    other: g['other'] !== undefined,
    attacking: qual === 'attacking',
    untapped: qual === 'untapped',
    keyword: kw,
    powerAtLeast: g['pw'] !== undefined ? Number(g['pw']) : null,
    withPlusCounter: g['pc'] !== undefined,
    named: g['named'] !== undefined ? g['named'].trim() : null,
  };
}
/** `creatures you control` -> `creature you control`: the head word (the last before a qualifier or the end) loses its plural. */
function singularCountNoun(plural: string): string {
  const words = plural.trim().split(/\s+/);
  const STOP = new Set(['you', 'your', 'on', 'in', 'that', 'with', 'named', 'target', 'among', 'they']);
  let head = words.length - 1;
  for (let i = 0; i < words.length; i++) if (STOP.has((words[i] ?? '').toLowerCase())) { head = i - 1; break; }
  if (head < 0) return plural.trim();
  const w = words[head] ?? '';
  words[head] = /ies$/.test(w) ? w.replace(/ies$/, 'y') : /ves$/.test(w) ? w.replace(/ves$/, 'f') : /s$/.test(w) && !/ss$/.test(w) ? w.replace(/s$/, '') : w;
  return words.join(' ');
}
/**
 * D418 - THE COUNTED SENTENCE: `<sentence> for each <noun>.` and `<sentence with X>, where X is the number
 * of <nouns>.` The base sentence (X read as one) is asked of the rules on its own, and the count rides
 * the spec as `per`; the executor multiplies the amount (a pump's halves) by the count read at
 * resolution. Only the amount-bearing kinds are counted - a gain, a loss, a draw, a token, a counter, a
 * pump, a damage; an `X/X` token or a bare X left in the sentence refuses it.
 */
const MULTIPLIABLE: ReadonlySet<EffectKind> = new Set(['gainLife', 'loseLife', 'draw', 'createToken', 'putCounters', 'pump', 'damage', 'damageEach', 'mill']);
/**
 * D437 - THE SPELL'S X. `Draw X cards.`, `~ deals X damage to any target.`, `Target creature gets -X/-X until end
 * of turn.`, `Create X 1/1 white Soldier creature tokens.`: the X is the spell's announced X (`{X}` in its mana
 * cost, `xValue` on the stack object), and the sentence is the counted sentence D418 reads with `X` as one, the
 * count riding as `per: { kind: 'spellX' }`. ⚠️ ONLY while the FACE's mana cost carries {X}: a bare X elsewhere
 * (`where X is` defines its own, an additional cost's X is not the mana's) stays unread. The gate is set by
 * `parseEffects` for the length of one synchronous parse and cleared in its `finally`.
 */
let SPELL_X = false;
function substituteX(base: string): string {
  return base
    .replace(/\bX cards\b/gi, 'a card')
    .replace(/\bX life\b/gi, '1 life')
    .replace(/\bX damage\b/gi, '1 damage')
    .replace(/\bX \+1\/\+1 counters\b/gi, 'a +1/+1 counter')
    .replace(/\bX -1\/-1 counters\b/gi, 'a -1/-1 counter')
    .replace(/([+-])X\b/g, '$11')
    .replace(/\b(create|creates) X ([^.]*?tokens?)\b/i, (_m, verb: string, rest: string) => verb + ' a ' + rest.replace(/tokens\b/, 'token'));
}
function matchSpellX(sentence: string): EffectSpec | null {
  if (!SPELL_X || !/\bX\b/.test(sentence) || /\bwhere X is\b/i.test(sentence) || /\bX\/X\b/.test(sentence)) return null;
  const base = substituteX(sentence);
  if (/\bX\b/.test(base)) return null;
  const inner = matchRule(base);
  if (!inner || !MULTIPLIABLE.has(inner.kind) || inner.per !== null) return null;
  return { ...inner, text: sentence, per: { kind: 'spellX' } };
}
function matchCounted(sentence: string): EffectSpec | null {
  const fe = /^(.+?) for each ([^.]+)\.$/i.exec(sentence);
  if (fe) {
    const per = readCountNoun(fe[2] ?? '');
    const inner = per ? matchRule((fe[1] ?? '') + '.') : null;
    if (!per || !inner || !MULTIPLIABLE.has(inner.kind) || inner.per !== null) return null;
    return { ...inner, text: sentence, per };
  }
  const wx = /^(.+?), where X is the number of ([^.]+)\.$/i.exec(sentence);
  if (wx) {
    const per = readCountNoun(singularCountNoun(wx[2] ?? ''));
    if (!per) return null;
    let base = wx[1] ?? '';
    if (/\bX\/X\b/.test(base)) return null;
    base = base
      .replace(/\bX cards\b/gi, 'a card')
      .replace(/\bX life\b/gi, '1 life')
      .replace(/\bX damage\b/gi, '1 damage')
      .replace(/\bX \+1\/\+1 counters\b/gi, 'a +1/+1 counter')
      .replace(/\bX -1\/-1 counters\b/gi, 'a -1/-1 counter')
      .replace(/([+-])X\b/g, '$11')
      .replace(/\b(create|creates) X ([^.]*?tokens?)\b/i, (_m, verb: string, rest: string) => verb + ' a ' + rest.replace(/tokens\b/, 'token'));
    if (/\bX\b/.test(base)) return null;
    const inner = matchRule(base + '.');
    if (!inner || !MULTIPLIABLE.has(inner.kind) || inner.per !== null) return null;
    return { ...inner, text: sentence, per };
  }
  return null;
}

/**
 * D422 - THE COUNTERED-THIS-WAY DESTINATION (CR 701.5a's `instead`): `<counter sentence>. If that spell is
 * countered this way, exile it | put it into its owner's hand | put it on top of its owner's library | put it
 * on the bottom of its owner's library instead of (putting it) into its owner's / that player's graveyard.` The
 * first sentence is asked of the rules on its own (a plain counter, or a counter-unless-pays whose unpaid
 * branch is the counter), and the destination rides the counter clause as `counterTo`; the executor moves the
 * countered card there. A first sentence that is not a counter refuses the span.
 */
const COUNTERED_THIS_WAY = /^(.+?)\. If that spell is countered this way, (exile it|put it into its owner's hand|put it on top of its owner's library|put it on the bottom of its owner's library) instead of (?:putting it )?into (?:its owner's|that player's) graveyard\.$/i;
function matchCounteredThisWay(sentence: string): EffectSpec | null {
  const m = COUNTERED_THIS_WAY.exec(sentence);
  if (!m) return null;
  const where = (m[2] ?? '').toLowerCase();
  const counterTo = where === 'exile it' ? 'exile' : where.includes('hand') ? 'hand' : where.includes('top') ? 'libraryTop' : 'libraryBottom';
  const inner = matchSentence((m[1] ?? '') + '.');
  if (!inner) return null;
  if (inner.kind === 'counter') return { ...inner, text: sentence, counterTo };
  if (inner.kind === 'payOptional' && inner.pay && inner.pay.ifNotPaid.length === 1 && inner.pay.ifNotPaid[0]?.kind === 'counter' && inner.pay.ifPaid.length === 0) {
    const c = inner.pay.ifNotPaid[0];
    return { ...inner, text: sentence, pay: { ...inner.pay, ifNotPaid: [{ ...c, counterTo }] } };
  }
  return null;
}
function matchSentence(sentence: string): EffectSpec | null {
  const paid = matchPayment(sentence);
  if (paid) return paid;
  // D403 - the kicked clause before the rules (its inner sentence is what the rules read).
  const kicked = matchKicked(sentence);
  if (kicked) return kicked;
  // D402 - a delayed sentence before the rules: the rules would read `Draw a card at the`... as nothing.
  const delayed = matchDelayed(sentence);
  if (delayed) return delayed;
  // D422 - the countered-this-way span before the rules (its first sentence is what the rules read).
  const counteredTo = matchCounteredThisWay(sentence);
  if (counteredTo) return counteredTo;
  // D418 - a counted sentence after the plain rules: `for each <noun>` and `where X is the number of`.
  // D437 - and the spell's own X after those, while the face's cost carries one.
  return matchRule(sentence) ?? matchCounted(sentence) ?? matchSpellX(sentence);
}

function matchRule(sentence: string): EffectSpec | null {
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
/**
 * D360 - `a card named ~` names THIS card.
 *
 * ⚠️ `selfRef` replaces a card's own printed name with `~` before any rule sees the sentence, so
 * a card searching for another copy of itself (Squadron Hawk, Whisper Squad, Avarax - thirteen in
 * the wave that found this) arrives here with `~` as its qualifier's name. Stored verbatim it
 * matches nothing: `cardMatchesSearch` compares it against a printed name and no card is called
 * `~`, so the prompt would come up and refuse every legal answer - a silent half-execution of
 * exactly the shape D90 forbids.
 *
 * The tilde is resolved HERE because this is the only place that knows the card's name; a rule's
 * `build` receives the match and nothing else. A qualifier naming some other card is untouched.
 */
function withBranchIndex(spec: EffectSpec, index: number): EffectSpec {
  if (!spec.pay) return spec;
  const re = (e: EffectSpec): EffectSpec => (e.targetIndex === -1 ? e : { ...e, targetIndex: index });
  return { ...spec, pay: { ...spec.pay, ifPaid: spec.pay.ifPaid.map(re), ifNotPaid: spec.pay.ifNotPaid.map(re) } };
}

function withSelfName(spec: EffectSpec, cardName: string): EffectSpec {
  const search = spec.search;
  if (!search || search.qualifier?.name !== '~') return spec;
  return { ...spec, search: { ...search, qualifier: { ...search.qualifier, name: cardName } } };
}

export function parseEffects(
  oracleText: string,
  cardName: string,
  isInstantOrSorcery: boolean,
  warn: Warn = NOOP_WARN,
  /** D437 - the face's mana cost carries {X}: a bare X in its text is the announced X. */
  xCost = false,
): ParsedEffects {
  if (!isInstantOrSorcery || !oracleText) return { effects: [], mode: 'manual' };
  SPELL_X = xCost;
  try {
    return parseEffectsInner(oracleText, cardName, warn);
  } finally {
    SPELL_X = false;
  }
}

function parseEffectsInner(oracleText: string, cardName: string, warn: Warn): ParsedEffects {

  // D306 - a "Cycling {N}" line on an instant or sorcery is an activated
  // ability the engine runs from the hand (`activatedParse` synthesizes it), not
  // an effect clause of the spell: dropped here so the face's own sentences
  // decide its mode. Reminder text is already scrubbed at this point.
  // D312 - a reduction line the engine prices is no clause of the spell either,
  // dropped on the PRINTED line before the scrub changes its shape.
  const priced = oracleText
    .split('\n')
    .filter((l) => parseCostReductionLine(l) === null)
    // D406 - an additional cost the engine CHARGES at cast is no clause of the spell either; one the
    // grammar cannot read stays, and keeps the face from resolving without its price (D90).
    .filter((l) => !(ADDITIONAL_COST_LINE.test(l.replace(/\s*\([^)]*\)\s*$/, '').trim()) && parseAdditionalCost(l, parseManaCost, cardName) !== null))
    // D408 - an alternative cost the engine charges is no clause of the spell either (unread, it stays).
    .filter((l) => !(ALTERNATIVE_COST_LINE.test(l.replace(/\s*\([^)]*\)\s*$/, '').trim()) && parseAlternativeCost(l, parseManaCost, cardName) !== null))
    // D410 - a TYPECYCLING line is the hand ability's (`activatedParse`), no clause of the spell either.
    .filter((l) => !(/cycling \{/i.test(l) && cyclingAbilities(l.replace(/\s*\([^)]*\)\s*$/, '').trim()) !== null))
    .join('\n');
  const clean = scrub(selfRef(priced, cardName))
    .split('\n')
    // D403 - a Kicker / Multikicker line is a cost the cast announces, no clause of the spell.
    // D405 - a Convoke / Improvise / Delve line is a way to pay the cost, no clause of the spell.
    .filter((l) => !/^(?:Cycling|Flashback|Kicker|Multikicker) (?:\{[^}]+\})+\s*$/.test(l.trim()) && !/^(?:Convoke|Improvise|Delve)(?:, (?:convoke|improvise|delve))*$/.test(l.trim()))
    // D422 - `This spell can't be countered.` is the face's own (`OracleFace.cantBeCountered`), no clause of the spell either.
    .filter((l) => !/^(?:This spell|~) can't be countered\.$/.test(l.trim()))
    // D413 - a Devoid line is a keyword the engine honours (D310), no clause of the spell either.
    .filter((l) => !/^Devoid$/i.test(l.trim()))
    .join('\n');
  const clauses = clausesOf(clean);
  if (clauses.length === 0) return { effects: [], mode: 'manual' };

  const effects: EffectSpec[] = [];
  let understood = 0;
  // Each understood clause consumes the next target in printed order, which is
  // the same order `targetParse` produced its specs in.
  let nextTarget = 0;
  // D394 - a referent clause after a COUNTED clause ("Those creatures can't block this turn.")
  // runs over the same picks, so it carries the same optional mark.
  let lastOptional = false;
  for (const clause of clauses) {
    const spec0 = clause.spec;
    if (!spec0) continue;
    const spec = withSelfName(spec0, cardName);
    // D392 - a referent clause aims where the previous target went; with no target before it
    // there is nothing to point at, and the sentence stays unread.
    if (spec.referent && spec.targetIndex !== -1 && nextTarget === 0) continue;
    understood++;
    // D299: an "up to N" / "any number of" clause may be declared with no target.
    const optional = OPTIONAL_COUNT.test(clause.text);
    if (spec.targetIndex !== -1 && !spec.referent) lastOptional = optional;
    const placed0 =
      spec.targetIndex === -1
        ? spec
        : spec.referent
          ? { ...spec, targetIndex: nextTarget - 1, ...(lastOptional ? { optional: true as const } : {}) }
          : { ...spec, targetIndex: nextTarget++, ...(optional ? { optional: true as const } : {}) };
    // D396 - a two-operand clause (a bite, a fight) consumes a SECOND index for its object, after
    // its subject's, in printed order - the self and the referent subjects consume none of their own.
    const placed = placed0.otherTargetIndex === undefined ? placed0 : { ...placed0, otherTargetIndex: nextTarget++ };
    // D369 - a payment's branches aim where the wrapper aims: one printed clause, one index.
    effects.push(placed.pay ? withBranchIndex(placed, placed.targetIndex) : placed);
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
  // D390 - a queued sacrifice asks too (the first player with a real choice is prompted).
  // D416 - the hand reveal asks too (the caster picks from the revealed hand; a trailing life loss rides the spec).
  const ASKS: ReadonlySet<EffectKind> = new Set(['discard', 'lookAtTop', 'scry', 'surveil', 'search', 'payOptional', 'sacrifice', 'returnChoose', 'proliferate', 'explore', 'connive', 'revealHandChoose']);
  if (effects.slice(0, -1).some((e) => ASKS.has(e.kind))) {
    warn('effect:partial');
    return { effects, mode: 'assisted' };
  }
  warn('effect:auto');
  return { effects, mode: 'auto' };
}
