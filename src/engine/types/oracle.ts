// The engine's view of a card: everything the rules need, parsed once at ingest.
//
// ⚠️ The engine NEVER reads `CardData.faces[].oracleText` to make a decision.
// Every rules-relevant fact is parsed into a typed field here, at ingest time,
// exactly once. That is what keeps the Tier-2 boundary honest: if a fact is not
// on `OracleFace`, the engine does not enforce it, and a player uses a Tier-3
// tool. A regex reached for at a decision site would be an unmeasurable,
// undocumented Tier-2 claim.
//
// `OracleCard.data` carries the original `CardData` through untouched, because
// projection has to hand the renderer exactly the shape it already renders.

import type { CardData, ColorLetter } from '../../data/cardTypes';
// ⚠️ A TYPE-ONLY import, so the 400-entry generated table does not become an
// engine dependency. The table itself is read in `effectParse.ts`, at ingest.
import type { TokenRef } from '../../data/tokenTable';
import type { EntersTapped } from '../../data/replacementParse';
import type { ManaCost } from './mana';
import type { ManaPool } from './mana';
import type { OracleId, PrintingId } from './ids';

/**
 * The Tier-2 keywords. This list IS the scope boundary — see AGENTS.md.
 *
 * `phasing` and `changeling` are deliberately absent: both need continuous-
 * effect machinery that does not exist in v1, and a half-enforced keyword is
 * worse than an unenforced one because players stop checking.
 *
 * ⚠️ M5 added `infect`, `wither` and `toxic` (D68). All three change what combat
 * damage DOES, which is squarely inside "enforced where it affects combat", and
 * all three were cheap because the primitives already existed: `player.poison`,
 * the poison SBA at `options.poisonThreshold`, and `-1/-1` counters are M3 work
 * that only the Tier-3 manual tools were reaching.
 */
export const TIER2_KEYWORDS = [
  'flying',
  'reach',
  'trample',
  'vigilance',
  'haste',
  'lifelink',
  'deathtouch',
  'firstStrike',
  'doubleStrike',
  'menace',
  'defender',
  'indestructible',
  'flash',
  'fear',
  'intimidate',
  'skulk',
  'shadow',
  'horsemanship',
  'hexproof',
  'shroud',
  'infect',
  'wither',
  'toxic',
] as const;

export type Keyword = (typeof TIER2_KEYWORDS)[number];

export const KEYWORD_SET: ReadonlySet<string> = new Set<string>(TIER2_KEYWORDS);

/** `protection from red`, `protection from everything`. */
export interface Protection {
  readonly colors: readonly ColorLetter[];
  readonly fromEverything: boolean;
  /** Everything else the card says it has protection from, verbatim, unenforced. */
  readonly other: readonly string[];
}

export const NO_PROTECTION: Protection = { colors: [], fromEverything: false, other: [] };

export interface ParsedTypeLine {
  readonly supertypes: readonly string[];
  readonly types: readonly string[];
  readonly subtypes: readonly string[];
  readonly raw: string;
}

/** One way a mana ability can be paid off — a complete output, not one pip. */
export interface ManaOutput {
  readonly mana: ManaPool;
  readonly amount: number;
}

export interface ManaProduction {
  readonly abilityIndex: number;
  /** One entry per concrete choice. Empty when `anyColor` is set. */
  readonly outputs: readonly ManaOutput[];
  /**
   * "Add one mana of any colour", expanded at solve time rather than at ingest.
   *
   * ⚠️ `scope: 'identity'` is Command Tower and its many cousins, and it is
   * NOT conditional: the engine knows the controller's commander colour
   * identity exactly, so it can expand to the right five-or-fewer options when
   * the solver runs. Marking it conditional (and so excluding it from auto-tap)
   * would grey out half a real Commander deck's hand.
   */
  /**
   * ⚠️ `landsYou` / `landsOpponents` are resolved against the BOARD at solve
   * time, exactly as `identity` is resolved against the commander: Reflecting
   * Pool makes what your lands make, Exotic Orchard what an opponent's do. They
   * are not conditional — the engine knows both sets exactly — and a land whose
   * scope it CANNOT resolve ("a Gate you control", "X mana") stays unparsed
   * rather than being widened to something the card cannot do.
   */
  readonly anyColor: {
    readonly scope: 'all' | 'identity' | 'landsYou' | 'landsOpponents' | 'chosen';
    readonly amount: number;
  } | null;
  readonly requiresTap: boolean;
  /**
   * ⚠️ Excluded from auto-tap, still manually tappable.
   *
   * Text containing "if", "unless", "only", "Spend this mana only on…" means the
   * engine cannot know whether the mana is usable for this particular cost. The
   * spec's decision (Q8) is to model the pool as plain counts and mark such
   * sources conditional rather than have the solver guess and be confidently
   * wrong — which is the Tier-2/Tier-3 boundary made explicit.
   */
  readonly conditional: boolean;
  readonly text: string;
  /**
   * Index of the oracle-text line this was parsed from, or null for the
   * intrinsic land-type entries that have no line of their own (Tundra's oracle
   * text is the empty string — see the intrinsic pass in `oracleParse.ts`).
   *
   * ⚠️ Exists so `activatedParse` can ask "is the ability on this line a mana
   * ability?" by matching line index, instead of running a second heuristic
   * beside this one. See the note on `ActivatedAbility.isManaAbility`.
   */
  readonly line: number | null;
}

/**
 * What class of object a target clause admits.
 *
 * ⚠️ Deliberately COARSE. These are the classes `targetAllowed` can decide from a
 * derived type line and a zone, and nothing else. `nonblack`, `tapped`, `with
 * power 3 or less` and every creature subtype are recorded verbatim in
 * `TargetSpec.unenforced` and are NOT checked.
 */
export type TargetKind =
  | 'creature'
  | 'planeswalker'
  | 'battle'
  | 'artifact'
  | 'enchantment'
  | 'land'
  /** Any permanent on the battlefield. */
  | 'permanent'
  | 'player'
  /** Any object on the stack. */
  | 'spell'
  /** A card in a graveyard or in exile — narrowed by `TargetSpec.zones`. */
  | 'card';

export type TargetController = 'any' | 'you' | 'opponent';

/**
 * ⚠️ CLOSED at three attributes and two comparators, and every member is here
 * because the database prints it: mana value (504 lines), power (385),
 * toughness (33); "or less" (587), "or greater" (335). "converted mana cost" is
 * the same attribute under its pre-2021 name and normalises to `manaValue`.
 */
/**
 * `lookAtTop` only: how many of the revealed cards are taken, and where the
 * rest go.
 *
 * ⚠️ **CLOSED AT TWO DESTINATIONS, and the two it leaves out are left out for
 * different reasons.** "on the bottom of your library IN ANY ORDER" (6 lines) is
 * a second decision the player is owed and this does not offer; "IN A RANDOM
 * order" (2 lines) needs the seeded generator, which `effectEvents` does not
 * have — D137's refusal of "discards at random", one card type along.
 */
export interface LookSpec {
  /** How many go to the hand. `0` for a pure re-ordering (`Index`). */
  readonly take: number;
  /**
   * ⚠️ **THE TWO `Ordered` DESTINATIONS RAISE A SECOND PROMPT** (D142). D141
   * refused them precisely because "in any order" is a decision the card gives
   * the player and there was nowhere to ask; `Awaiting.orderCards` is that
   * somewhere. The unordered two stay separate rather than being folded in — a
   * graveyard has no order anybody chooses, and "the other" leaves one card,
   * so raising a prompt for either would be a question with one legal answer.
   */
  readonly rest: 'graveyard' | 'bottom' | 'bottomOrdered' | 'topOrdered';
}

export interface NumericRestriction {
  readonly attr: 'manaValue' | 'power' | 'toughness';
  readonly cmp: 'atMost' | 'atLeast';
  readonly value: number;
}

/**
 * A KEYWORD restriction on a target clause (D289) — "with flying", "without
 * flying", "with defender". `word` is the DERIVED keyword the engine tracks
 * (`TIER2_KEYWORDS`), never the printed spelling: "first strike" is stored as
 * 'firstStrike'. `present` is false for "without".
 */
export interface KeywordRestriction {
  readonly word: Keyword;
  readonly present: boolean;
}

/**
 * A COMBAT-ROLE restriction on a target clause (D291) — "target attacking
 * creature", "target blocking creature", "target attacking or blocking
 * creature". Checked against the current combat: outside combat nothing
 * holds a role, so such a clause admits nothing, which is the CR answer.
 */
export type CombatRole = 'attacking' | 'blocking' | 'attackingOrBlocking';

/**
 * The ADJECTIVES of a target clause the engine enforces (D294) — "nonblack
 * creature", "tapped creature", "legendary creature", "nonland permanent",
 * "noncreature spell", "nontoken creature". Every field is optional; an
 * absent field restricts nothing. Until D294 these words sat in `unenforced`
 * and every such card was refused, though a candidate already carries the
 * facts to check them.
 */
export interface TargetRestrictions {
  readonly colorsAny?: readonly ColorLetter[];
  readonly colorsNone?: readonly ColorLetter[];
  readonly colorCount?: 'zero' | 'one' | 'many';
  readonly typesNone?: readonly string[];
  readonly supertypesAny?: readonly string[];
  readonly supertypesNone?: readonly string[];
  /** D297 - a subtype the candidate must carry ("target Wall", "Equipment you control") / must not ("non-Elf creature"), derived. */
  readonly subtypesAll?: readonly string[];
  readonly subtypesNone?: readonly string[];
  readonly tapped?: boolean;
  readonly token?: boolean;
}

export type TargetZone = 'graveyard' | 'exile';

/**
 * D297 - ONE alternative of a printed target list whose alternatives differ:
 * "artifact, enchantment, or creature WITH FLYING" (the qualifier binds the
 * last), "creature or VEHICLE" (a subtype on one), "artifact creature or
 * BLACK creature" (an adjective on each). A candidate is admitted when SOME
 * alternative admits it. `cardTypes` and `subtypes` here are ALL-of ("artifact
 * creature" is both), unlike the clause-wide ANY-of `TargetSpec.cardTypes`.
 */
export interface TargetAlternative {
  readonly kinds: readonly TargetKind[];
  readonly cardTypes: readonly string[];
  readonly subtypes: readonly string[];
  readonly restrict: TargetRestrictions | null;
  readonly keyword: KeywordRestriction | null;
  readonly numeric: NumericRestriction | null;
}

/**
 * ONE target clause, as printed. A face has zero or more.
 *
 * ⚠️ `kinds: []` MEANS FREE AIM, and it is the most important thing in this type.
 * It is not "nothing is legal" — it is "the parser did not understand this
 * clause, so the host accepts whatever the player points at". `min` is always 0
 * when it is set, so a clause the parser could not read can never make a spell
 * uncastable. That asymmetry is the rule governing every judgement call in
 * `targetParse.ts`: an unread restriction may only ever ALLOW an illegal choice,
 * never BLOCK a legal one.
 *
 * ⚠️ Every field is REQUIRED. Under `exactOptionalPropertyTypes` an optional
 * field costs every producer a `...(x !== undefined ? {x} : {})` spread, and this
 * type is produced in six places; empty arrays and `false` say the same thing for
 * free.
 */
export interface TargetSpec {
  /** CR 601.2c. 1/1 for `target creature`; 0/2 for `up to two target creatures`. */
  readonly min: number;
  readonly max: number;
  readonly kinds: readonly TargetKind[];
  readonly controller: TargetController;
  /** Only ever non-empty when `kinds` includes `'card'`. */
  readonly zones: readonly TargetZone[];
  /**
   * CARD TYPES the clause requires — `['Creature']` for "target creature card".
   * Empty means the clause names no type.
   *
   * ⚠️ **THIS EXISTS BECAUSE `kinds` CANNOT SAY IT.** Everything in a
   * graveyard has exactly one kind, `card`, so "target creature card" and "target
   * card" were the SAME spec — the type went into `unenforced` and was checked by
   * nothing. `Raise Dead` could take a land. See D138.
   *
   * ⚠️ ANY of them matches, not all: a clause naming two types means "either"
   * ("target instant or sorcery card"), and a card that is both still qualifies.
   */
  readonly cardTypes: readonly string[];
  /**
   * A NUMERIC restriction — "with power 4 or greater", "with mana value 3 or
   * less". `null` when the clause names none.
   *
   * ⚠️ **THIS WAS NOT MERELY UNENFORCED, IT WAS DROPPED SILENTLY.** Before D139
   * "Destroy target creature with power 4 or greater" parsed to
   * `kinds:['creature'], confident:true, unenforced:[]` — the qualifier was not
   * matched by the noun table, so it never entered `unenforced` either. The app
   * would destroy a 1/1 with it, and `tier3.ts` said nothing, because there was
   * nothing recorded to say. `text` was wrong too: it read "target creature",
   * so the prompt bar showed a clause the card does not have.
   */
  readonly numeric: NumericRestriction | null;
  /**
   * A KEYWORD restriction — "with flying", "without flying", "with defender".
   * `null` when the clause names none.
   *
   * ⚠️ **THE SAME SILENT DROP D139 CLOSED, ONE QUALIFIER OVER (D289).** Before
   * this "Destroy target creature with flying" parsed to `kinds:['creature'],
   * unenforced:[]` with `text` reading "target creature" — the words matched
   * nothing, so nothing was recorded, so `tier3.ts` had nothing to say and a
   * script claiming the line would have destroyed a ground creature. Five
   * ledger witnesses (Topple, Trip Wire, Vertigo, Wing Snare, Wing Puncture).
   * Checked by `targetAllowed` against the candidate's DERIVED keywords.
   */
  readonly keyword: KeywordRestriction | null;
  /**
   * A COMBAT-ROLE restriction — "attacking", "blocking", "attacking or
   * blocking". `null` when the clause names none. Until D291 the noun table
   * listed these words in `unenforced` and every such card was refused.
   */
  readonly combatRole: CombatRole | null;
  /** The clause's enforced adjectives (D294), or `null` when it prints none the engine checks. */
  readonly restrict: TargetRestrictions | null;
  /**
   * D297 - set only for a printed list whose alternatives differ; `kinds` is
   * then their union and the clause-wide `cardTypes`/`numeric`/`keyword`/
   * `restrict` are empty, each alternative carrying its own. Null = the
   * clause's own fields apply, exactly as before.
   */
  readonly alternatives: readonly TargetAlternative[] | null;
  /**
   * The clause EXACTLY as printed, sliced out of the oracle text — never
   * re-worded. It is what the prompt bar says. A paraphrase would be a second
   * rules text that drifts from Scryfall's the moment Wizards rewords something,
   * which is the rule `tier3.ts` already states about itself.
   */
  readonly text: string;
  /** False ⇔ `kinds` is empty ⇔ free aim. Its own field so the check reads. */
  readonly confident: boolean;
  /**
   * Words in the clause the engine can SEE and cannot CHECK — `nonblack`,
   * `tapped`, `attacking`, `with flying`. Verbatim, for `tier3.ts`. Non-empty
   * means the KIND is enforced and the RESTRICTION is not.
   */
  readonly unenforced: readonly string[];
}

/** The fallback. `min: 0` is load-bearing: a free spec never blocks a cast. */
export const FREE_TARGET: TargetSpec = {
  min: 0,
  max: 99,
  kinds: [],
  controller: 'any',
  zones: [],
  cardTypes: [],
  numeric: null,
  keyword: null,
  combatRole: null,
  restrict: null,
  alternatives: null,
  text: '',
  confident: false,
  unenforced: [],
};

export function isFreeAim(spec: TargetSpec): boolean {
  return spec.kinds.length === 0;
}

/**
 * What one understood sentence of a card DOES.
 *
 * ⚠️ A CLOSED vocabulary, and deliberately tiny. This is the Tier-2 boundary all
 * over again: an effect the engine cannot express as events is an effect it must
 * not pretend to execute.
 */
export type EffectKind =
  | 'damage'
  | 'destroy'
  | 'exile'
  /** COUNTER A SPELL. The counters you put on a permanent are the two below. */
  | 'counter'
  | 'bounce'
  | 'pump'
  /**
   * D301 - "Creatures you control get +N/+N [and gain KW] until end of turn":
   * a self clause (no target) the consumer applies to EVERY creature its
   * controller controls as the board derives at resolution - D194's carrier,
   * one entry per creature, all ending at cleanup.
   */
  | 'massPump'
  | 'tap'
  | 'untap'
  | 'draw'
  | 'gainLife'
  | 'loseLife'
  /**
   * D295 - a sentence about the TARGET'S CONTROLLER ("Its controller loses 2
   * life.", "Its controller draws a card."): the aim is the target of the
   * sentence before, and the player is whoever controls it at resolution -
   * read from the state BEFORE the batch applies, so the permanent the first
   * sentence destroys is still there to ask.
   */
  | 'controllerLosesLife'
  | 'controllerDraws'
  /**
   * D295 - a printed restriction on a mechanism this engine does not have at
   * all (the D192 vacuity argument as a parser rule; `effectParse` names the
   * sentence). It forbids something that cannot happen, so the card is whole
   * without it - read as a sentence so the line is CLAIMED, never skipped.
   */
  | 'noop'
  | 'putCounters'
  | 'removeCounters'
  | 'createToken'
  /**
   * CR 701.8. A player puts cards from their hand into their graveyard — and
   * unless the card says otherwise, THEY choose which (see D137).
   *
   * ⚠️ The only effect kind whose resolution can STOP and ask. Every other one
   * turns into events and is done; this one raises `Awaiting.chooseFromZone`
   * when the player has more cards than the effect takes.
   */
  | 'discard'
  /**
   * CR 701.18 / 701.42 — scry and surveil: look at the top N of your own
   * library, keep some on top in an order you choose, and put the rest on
   * the bottom (scry) or into your graveyard (surveil). The SECOND and
   * THIRD effect kinds whose resolution can stop and ask (discard was the
   * first, D137); the answer is a partition plus an order, validated
   * entirely in the handler because the prompt ships no card ids (D195).
   */
  | 'scry'
  | 'surveil'
  /**
   * CR 400.7 — a card leaving a graveyard for its owner's HAND. `Raise Dead`.
   *
   * ⚠️ Distinct from `bounce` even though both end in a hand: `bounce` moves a
   * PERMANENT off the battlefield and is written to read a battlefield target,
   * where this reads a card in a graveyard. One kind for both would have to
   * decide which zone it meant at resolution, from a target that no longer says.
   */
  | 'returnFromGraveyard'
  /**
   * Reanimation — a creature card from a graveyard onto the BATTLEFIELD.
   * `Zombify`, `Resurrection`, `Unburial Rites`.
   *
   * ⚠️ Its own kind rather than a destination flag on the one above, because the
   * card arrives as a PERMANENT: it enters the battlefield, so it runs the whole
   * entry funnel — the loyalty counters (D107), "enters tapped" (D134/D135), and
   * the pay-to-enter-untapped prompt (D136) all apply to it and none of them
   * apply to a card going to a hand.
   */
  | 'reanimate'
  /**
   * CR 701.16 — look at the top N of your library, keep some, and the rest go
   * somewhere. `Forbidden Alchemy`, `Sleight of Hand`. See D141.
   *
   * ⚠️ The second effect kind whose resolution STOPS and asks (after `discard`),
   * and the first whose prompt is over a zone the player has just been SHOWN.
   */
  | 'lookAtTop';

/**
 * The counters a spell may put on or take off, and the list is CLOSED at two.
 *
 * ⚠️ **BECAUSE THESE ARE THE TWO THE ENGINE READS.** `derive.ts` sums `+1/+1`
 * and `-1/-1` at layer 7d, so putting one of them is a change the board actually
 * shows. Every other counter Magic prints — charge, trample, deathtouch, page,
 * stun — would be recorded on the card and applied by NOTHING, which is
 * half-execution wearing a number (D90): the log would say the counter went on,
 * the card would carry it, and the rules would ignore it forever.
 *
 * ⚠️ `loyalty` and `defense` are deliberately absent too, even though `sba.ts`
 * reads them. "Put two loyalty counters on target planeswalker" is real, but no
 * Commander-legal spell's WHOLE text is that clause, so admitting it would widen
 * the vocabulary for zero cards and one more thing to be wrong about.
 */
export type CounterKind = '+1/+1' | '-1/-1';

export interface EffectSpec {
  readonly kind: EffectKind;
  /** Damage dealt, life gained/lost, cards drawn. 0 where it does not apply. */
  readonly amount: number;
  /** `pump` only: the two halves, which may be negative. */
  readonly power: number;
  readonly toughness: number;
  /**
   * `pump` only: Tier-2 keywords GAINED until end of turn (D194) — "gets
   * +1/+1 and gains trample" and the pure "gains flying" form, which is a
   * pump of +0/+0 carrying a keyword. Empty for every other kind and for a
   * plain pump; the closed GRANTABLE map in `effectParse.ts` decides what
   * may appear here, so an unenforced keyword can never be granted.
   */
  readonly keywords: readonly Keyword[];
  /**
   * `putCounters` / `removeCounters` only: WHICH counter, from the closed list.
   *
   * ⚠️ `null` for every other kind, and `effects.ts` refuses to emit without it.
   * A default of `'+1/+1'` would have been tidier and would mean that any future
   * rule which forgot to set it silently put +1/+1 counters somewhere.
   */
  readonly counterKind: CounterKind | null;
  /**
   * `createToken` only: the printing the description names.
   *
   * ⚠️ RESOLVED AT BUILD TIME, from `TOKEN_TABLE` (D133). It is on the spec
   * rather than looked up in `effects.ts` because that is what keeps
   * `effectMode` a property of the CARD: a description the table cannot name is
   * a sentence the parser did not understand, decided once at ingest, the same
   * for every player. Resolving at resolution time instead would make whether a
   * spell executes depend on which tokens happened to be in the game's pool.
   */
  readonly token: TokenRef | null;
  /** `lookAtTop` only: how many to keep and where the rest go (D141). */
  readonly look: LookSpec | null;
  /**
   * `scry`/`surveil` only: cards drawn AFTER the choice resolves — the
   * "Scry 2, then draw a card" / "Surveil 1, then draw a card" shape
   * (Preordain, Consider). It rides the spec because the draw must see the
   * library AS REORDERED, so it is carried through the prompt and emitted
   * by the ANSWER handler against the post-choice state — emitting it here
   * would draw from under the cards the player has not placed yet (D195).
   */
  readonly thenDraw: number;
  /**
   * Which of the spell's targets this clause applies to — an index into
   * `StackObject.targets`. -1 means "no target", e.g. `Draw three cards`.
   */
  readonly targetIndex: number;
  /** Applies to the caster rather than to a target. `You gain 3 life`. */
  readonly self: boolean;
  /**
   * D299: the clause reads "up to N" / "any number of" — declaring NO target
   * for it is legal, and the consumer skips the clause silently rather than
   * narrating a lost target. Absent on every other clause.
   */
  readonly optional?: true;
  /**
   * `discard` only: the cards are chosen AT RANDOM rather than by their owner.
   *
   * ⚠️ **A DIFFERENT EFFECT, not a flag on a shared one, in every way that
   * matters.** A normal discard raises `chooseFromZone` and waits for a person;
   * this one takes the cards itself and raises nothing. `Hymn to Tourach`
   * against `Mind Rot` is the pair.
   *
   * ⚠️ It was refused outright until D147 (D137 measured 54 lines and said why):
   * `effectEvents` had no randomness, and randomness in this engine comes ONLY
   * from the seeded generator threaded through the log. Approximating it — the
   * first N in hand, say — would be a rule the app made up, and one that a
   * player watching their own hand would notice immediately.
   */
  readonly atRandom: boolean;
  /** The sentence exactly as printed, for the log and the assisted offer. */
  readonly text: string;
}

/**
 * How much of a card's text the app will execute.
 *
 * ⚠️ THE POINT OF THIS FIELD is that `assisted` exists at all. A card whose
 * first sentence we understand and whose second we do not must NEVER run the
 * first on its own — `Beast Within` is "Destroy target permanent" plus "its
 * controller creates a 3/3", and destroying the permanent while silently
 * skipping the token is worse than doing nothing, because the player cannot see
 * what was missed. Measured: 1,300 Commander-legal spells are this shape,
 * against 274 the app understands completely.
 */
export type EffectMode = 'auto' | 'assisted' | 'manual';

/**
 * One activated ability, parsed from a `cost: effect` line.
 *
 * ⚠️ `isManaAbility` is ASKED OF `parseManaProduction`, matched by `line`, never
 * re-guessed here. A mana ability that leaked into `ActivateAbility` would put
 * `{T}: Add {G}` on the stack (CR 605 — mana abilities do not use it), and a real
 * ability misclassified as mana would vanish from the action list. This is the
 * same "never a second heuristic" rule `tier3.ts` learned the hard way.
 */
export interface ActivatedAbility {
  /** Stable per face; the `AbilityRef` suffix. */
  readonly index: number;
  /** Verbatim, left of the colon. */
  readonly costText: string;
  /** Verbatim, right of the colon. */
  readonly effectText: string;
  readonly manaCost: ManaCost | null;
  readonly requiresTap: boolean;
  readonly requiresUntap: boolean;
  /** `Pay 3 life`. 0 when there is none. */
  readonly lifeCost: number;
  /**
   * `Pay life equal to the number of colors in your commanders' color
   * identity` — War Room's exact phrase, and only that phrase (D90). The
   * NUMBER is computed at ACTIVATION from the player's identity, which is why
   * it cannot live in `lifeCost` (D159).
   */
  readonly lifeCostCommanderColors: boolean;
  /**
   * `Sacrifice a <predicate>` — a sacrifice the player CHOOSES (D168): the
   * cost is chargeable once the activation names which permanent
   * (`ActivateAbility.sacrifice`), and `legal.ts` offers it only when the
   * def is registered AND at least one candidate exists. `another` excludes
   * the source itself ("Sacrifice another creature"). `null` for every
   * ability without such a cost; predicates reuse `replacementParse`'s
   * grammar so "a Forest or a Plains" reads one way everywhere.
   */
  readonly sacrificeCost: {
    readonly another: boolean;
    readonly any: readonly import('../../data/replacementParse').PermanentPredicate[];
  } | null;
  /**
   * `Discard a card` / `Discard two cards` / `Discard a land card` — a discard
   * the player CHOOSES (D286, the D168 shape one verb over): chargeable once
   * the activation names the cards (`ActivateAbility.discard`). `any` is
   * `null` for "a card" (any card) and a predicate list for a typed card;
   * `legal.ts` offers the ability only when the def is registered AND the
   * hand holds at least `count` candidates. Wordings the predicate reader
   * cannot place ("a nonland card", "two cards with the same name") stay in
   * `unpaidCosts`.
   */
  readonly discardCost: {
    readonly count: number;
    readonly any: readonly import('../../data/replacementParse').PermanentPredicate[] | null;
  } | null;
  /**
   * `Tap N untapped <predicate> you control` — a tap the player CHOOSES
   * (D286), named by `ActivateAbility.tap`; `another` excludes the source
   * ("Tap another untapped creature you control"). Summoning sickness does
   * not apply: CR 302.6 covers only the permanent's own {T}.
   */
  readonly tapCost: {
    readonly count: number;
    readonly another: boolean;
    readonly any: readonly import('../../data/replacementParse').PermanentPredicate[];
  } | null;
  /**
   * `Sacrifice this <type>` — a SELF-sacrifice: deterministic, no chooser, so
   * the engine can charge it (D159). ⚠️ Chargeable is not offerable: a
   * destructive cost is OFFERED only when the game's registry carries an
   * `ActivatedDef` that will run the effect — charging mana for nothing is
   * D122's disclosed status quo, eating a permanent for nothing is not.
   * `Sacrifice a creature` (a choice) stays in `unpaidCosts`.
   */
  readonly sacrificesSelf: boolean;
  /** Cost components the engine cannot charge, verbatim: `Sacrifice a creature`, `+1`. */
  readonly unpaidCosts: readonly string[];
  readonly payable: boolean;
  /** CR 605 — does NOT use the stack. */
  readonly isManaAbility: boolean;
  readonly isLoyalty: boolean;
  /** `Activate only as a sorcery`. */
  readonly sorceryOnly: boolean;
  readonly targets: readonly TargetSpec[];
  /**
   * D305 - THE EQUIPMENT SEAM. Set on the ability `activatedParse` synthesizes
   * for an "Equip {N}" line (CR 702.6a: "{N}: Attach this permanent to target
   * creature you control. Activate only as a sorcery."), carrying the printed
   * line so the accounting can find it. `resolveAbility` attaches natively.
   */
  readonly equip?: { readonly line: string };
}

export interface OracleFace {
  readonly name: string;
  readonly typeLine: ParsedTypeLine;
  readonly oracleText: string;
  readonly manaCost: ManaCost | null;
  readonly colors: readonly ColorLetter[];
  readonly printedPower: string | null;
  readonly printedToughness: string | null;
  readonly printedLoyalty: string | null;
  readonly printedDefense: string | null;
  /** null when the printed value is `*`, `X` or similar — see `derive()`. */
  readonly basePower: number | null;
  readonly baseToughness: number | null;
  readonly baseLoyalty: number | null;
  readonly baseDefense: number | null;
  readonly keywords: readonly Keyword[];
  readonly protection: Protection;
  /** Land types this creature can't be blocked by a controller of. */
  readonly landwalk: readonly string[];
  readonly producesMana: readonly ManaProduction[];
  readonly isPermanent: boolean;
  readonly isCreature: boolean;
  readonly isLand: boolean;
  /** Instant, or a permanent/sorcery with flash. */
  readonly instantSpeed: boolean;
  /** `ward {2}`, enforced as a cast-time tax when an opponent targets this. */
  readonly wardCost: ManaCost | null;
  /**
   * `ward—Pay 3 life`, as a life tax. 0 when there is none.
   *
   * ⚠️ A SEPARATE FIELD, not a degenerate `ManaCost`. D33 unified Phyrexian mana
   * into `HybridSymbol` because `{W/P}` and `{W/U}` are the same decision shape;
   * a life ward is NOT that shape — it is not a choice at all, just a second
   * currency. Squeezing it into `ManaCost` would need a one-option hybrid, which
   * `parseHybrid` already rejects as degenerate, and every consumer of
   * `wardCost` would have to learn that some mana costs are not mana.
   */
  readonly wardLife: number;
  /**
   * `Toxic N` — how many poison counters this creature's combat damage to a
   * player adds. 0 when it has no toxic.
   *
   * ⚠️ Scryfall reports the keyword as a bare `"Toxic"` with no amount, exactly
   * as it does for Landwalk and Protection, so the number has to come from the
   * text. Same rule, same exception, same reason: the amount IS the ability.
   */
  readonly toxicAmount: number;
  /**
   * Target clauses belonging to this face's OWN effect — the ones a player
   * chooses when casting it. Clauses on an activated ability's line live on
   * `activated[i].targets` instead; see `splitAbilityLines`.
   *
   * ⚠️ An Aura's `Enchant <X>` produces a spec here even though the word "target"
   * never appears (CR 303.4c/601.2c). 3,463 Commander-legal faces — leaving it
   * out would make the most-cast permanent class in Commander the one class that
   * never asks you to aim.
   *
   * ⚠️ Triggered-ability clauses are parsed and DISCARDED in v1: no trigger
   * reaches the stack with targets without a card script, and `SHIPPED_REGISTRY`
   * ships. A spell that asked you to aim an ETB it never executes is theatre.
   */
  readonly targets: readonly TargetSpec[];
  readonly activated: readonly ActivatedAbility[];
  /**
   * The sentences of this face the engine can execute, in printed order.
   *
   * ⚠️ Only ever read when `effectMode === 'auto'`. On an `assisted` face these
   * are what the prompt bar OFFERS the player, one click, marked manual in the
   * log — never what the engine does by itself.
   */
  readonly effects: readonly EffectSpec[];
  readonly effectMode: EffectMode;
  /**
   * CR 614.1c — this permanent enters the battlefield tapped.
   *
   * ⚠️ `null` means it does not; `{ unless: null }` means it always does; a
   * condition means it does UNLESS that board query holds (D135). A REPLACEMENT
   * EFFECT, applied by `applyReplacements` alongside the entry counters (D107),
   * and not a keyword or an ability line.
   *
   * ⚠️ ONE FIELD RATHER THAN A BOOLEAN AND A CONDITION BESIDE IT, because two
   * fields that must be read together are a trap: "enters tapped unless you
   * control a Forest" is not `entersTapped: false`, and a caller that checked
   * only the boolean would let it in untapped every time.
   */
  readonly entersTapped: EntersTapped | null;
  /**
   * "As this ~ enters, choose a color." (CR 614.12). See
   * `CardInstance.chosenColor` for why the colour and not the other two shapes
   * of that sentence.
   */
  readonly choosesColorOnEntry: boolean;
}

export interface OracleCard {
  readonly oracleId: OracleId;
  readonly printingId: PrintingId;
  readonly name: string;
  readonly layout: CardData['layout'];
  readonly faces: readonly OracleFace[];
  readonly colorIdentity: readonly ColorLetter[];
  readonly manaValue: number;
  readonly commanderLegality: string;
  /** True for the five basics + Wastes + snow basics. Drives solver preference. */
  readonly isBasicLand: boolean;
  /**
   * ⚠️ The original renderer shape, carried through untouched. `project()` puts
   * this straight into `CardView.card`; re-deriving it would mean the table
   * renders something subtly different from the card database screen.
   */
  readonly data: CardData;
}

/** Ingest problems, counted by category. The honest measure of Tier-2 coverage. */
export interface IngestWarnings {
  readonly [category: string]: number;
}

export interface OracleDb {
  byPrinting(id: PrintingId): OracleCard | undefined;
  /** Any printing of the card. Used for tokens and for rules that ignore art. */
  byOracle(id: OracleId): OracleCard | undefined;
  /** Exact name, case-folded by the caller's own rules. Test/setup convenience. */
  byName(name: string): OracleCard | undefined;
  readonly size: number;
}

/** Characteristics after the layer pipeline. Never stored — always recomputed. */
export interface DerivedCharacteristics {
  readonly name: string;
  readonly typeLine: ParsedTypeLine;
  readonly colors: readonly ColorLetter[];
  readonly power: number | null;
  readonly toughness: number | null;
  readonly loyalty: number | null;
  readonly defense: number | null;
  readonly keywords: ReadonlySet<Keyword>;
  /** CR 613 layer 6 — false when an effect has removed every ability. */
  readonly hasAbilities: boolean;
  readonly protection: Protection;
  readonly landwalk: readonly string[];
  /** `Toxic N`. 0 unless the creature has toxic. */
  readonly toxicAmount: number;
  readonly isCreature: boolean;
  readonly isLand: boolean;
  readonly isPermanent: boolean;
  readonly isLegendary: boolean;
  readonly manaValue: number;
  readonly producesMana: readonly ManaProduction[];
}
