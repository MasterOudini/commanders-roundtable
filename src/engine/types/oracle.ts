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
import type { EntersTapped, EntersTappedCondition, PermanentPredicate } from '../../data/replacementParse';
import type { ManaCost } from './mana';
import type { ManaPool, SpendRestriction } from './mana';
import type { AbilityRef, InstanceId, OracleId, PrintingId } from './ids';

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
  // D308 - THE KEYWORD-TRIGGER SEAM: keywords that ARE triggered abilities, run
  // from one table (`keywordTriggers.ts`) for every permanent that carries them.
  'prowess',
  'exalted',
  'bushido',
  'flanking',
  'persist',
  'undying',
  'evolve',
  // D361 - the same table, seven entries on: each of these prints a rule that IS a
  // triggered ability whose every piece the engine already had. `soulshift` is the
  // first keyword trigger that is OPTIONAL and TARGETS; `afterlife` the first that
  // makes a token; `ingest` the first on combat damage.
  'soulshift',
  'afterlife',
  'dethrone',
  'melee',
  'training',
  'afflict',
  'ingest',
  // D310 - THE CHARACTERISTIC-DEFINING KEYWORDS: read at layer 1 by the derive.
  'changeling',
  'devoid',
] as const;

export type Keyword = (typeof TIER2_KEYWORDS)[number];

export const KEYWORD_SET: ReadonlySet<string> = new Set<string>(TIER2_KEYWORDS);

/** `protection from red`, `protection from everything`. */
export interface Protection {
  readonly colors: readonly ColorLetter[];
  readonly fromEverything: boolean;
  /**
   * D356 - a card TYPE the card has protection from, singular and capitalised the way a type line
   * spells it (`Artifact`, `Creature`, `Land`, `Enchantment`). Enforced.
   */
  readonly types?: readonly string[];
  /**
   * D356 - a SUBTYPE, stored AS PRINTED (`Vampires`, `Elves`, `Werewolves`) because the printed
   * form is the plural and the engine stores the singular. `protectedFrom` matches the two with a
   * closed set of English plural forms rather than deriving one - Elf/Elves and Werewolf/Werewolves
   * break any rule that just appends an `s`, and a protection that silently fails to match is worse
   * than one that is honestly unenforced.
   */
  readonly subtypes?: readonly string[];
  /** D356 - `multicolored`, `monocolored` or `colorless`, decided from the source's colour list. */
  readonly categories?: readonly ProtectionCategory[];
  /** Everything else the card says it has protection from, verbatim, unenforced. */
  readonly other: readonly string[];
}

export type ProtectionCategory = 'multicolored' | 'monocolored' | 'colorless';

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
    /**
     * D397 - three more sets the board answers exactly, one wording each: `among legendary
     * permanents you control` (Plaza of Heroes), `among legendary creatures and planeswalkers
     * you control` (Mox Amber), `among legendary creature cards in your graveyard` (The Grey
     * Havens). Resolved like `landsYou` - at solve time, off DERIVED colours for a permanent
     * and printed ones for a graveyard card - and an EMPTY set is an honest answer: Mox Amber
     * on a board with no legend makes nothing.
     */
    readonly scope: 'all' | 'identity' | 'landsYou' | 'landsOpponents' | 'chosen' | 'legendaryYou' | 'legendaryCreaturesWalkersYou' | 'legendaryGraveyard';
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
  /**
   * D325 - the cost beside the {T} the engine CHARGES when the ability is
   * tapped by hand: mana from the pool ({1}, {G}), a life payment, the
   * permanent's own sacrifice. Null when there is none. A piece the engine
   * cannot charge (tap another creature, discard, exile a card) leaves the
   * line `conditional` instead, exactly as before - tapped by hand, the
   * extra cost the player's.
   */
  readonly extraCost?: { readonly mana: ManaCost | null; readonly life: number; readonly sacrificeSelf: boolean } | null;
  /**
   * D355 - the PRICE the line charges when the mana is made: `This land deals 1
   * damage to you.` Null when the line is nothing but its mana.
   *
   * ⚠️ It is applied in the same action as the mana, because a mana ability
   * never uses the stack (CR 605.1) - there is no window between the damage and
   * the mana in which anything could respond.
   *
   * ⚠️ DETERMINISTIC ONLY, and that is the whole boundary: a drawback that asks
   * a question (sacrifice a permanent, discard a card) is a decision, and a mana
   * ability cannot stop to ask one. Such a line keeps no `drawback`, stays
   * unclaimed by the accounting, and the card stays incomplete - which is the
   * true answer rather than a convenient one.
   */
  readonly drawback?: { readonly kind: 'damageToYou'; readonly amount: number } | { readonly kind: 'skipUntap' } | null;
  /**
   * D397 - the "Spend this mana only ..." sentence beside the mana, READ: what the mana
   * may pay for. Null when the line prints no restriction; a restriction the reader
   * cannot express is not here at all - the line stays `conditional` instead.
   */
  readonly restriction?: SpendRestriction | null;
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
 * D389 - the FILTER a look may carry: `You may reveal a creature card from among
 * them and put it into your hand.` The noun is `predicatesOf`'s shape, read by the
 * same reader a search's noun is (D357), and `what` is the printed noun for the
 * prompt bar. It is PUBLIC - printed on the card - so it rides the prompt; what
 * never crosses the wire is the revealed run itself.
 */
export interface LookFilter {
  readonly predicates: readonly PermanentPredicate[];
  readonly what: string;
}

/**
 * `lookAtTop` only: how many of the revealed cards are taken, and where the
 * rest go.
 *
 * ⚠️ **THE DESTINATIONS WERE CLOSED AT TWO (D141) AND OPENED ONE AT A TIME:**
 * "in any order" when `Awaiting.orderCards` gave it somewhere to ask (D142), and
 * "in a RANDOM order" when the ANSWER handler learned to shuffle the leftovers off
 * the seeded generator (D389) - `effectEvents` still has no rng, and it does not
 * need one, because the leftovers are only known once the pick is answered.
 */
export interface LookSpec {
  /**
   * D389 - `you may reveal a <noun> card from among them`: the pick is bounded by a
   * filter, and the sentence is REFUSED when the noun cannot be placed (D90). `null`
   * for the plain forms.
   */
  readonly filter: LookFilter | null;
  /** D389 - `you may`: the player may keep fewer than `take`, down to none. */
  readonly optional: boolean;
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
  readonly rest: 'graveyard' | 'bottom' | 'bottomOrdered' | 'topOrdered' | 'random';
}

export interface NumericRestriction {
  readonly attr: 'manaValue' | 'power' | 'toughness';
  /**
   * D341 - Mentor's "with lesser power": `lessThanSource` / `greaterThanSource`
   * compare against the SOURCE's own attribute, read at the choice; `value` is
   * 0 and unused for those two.
   */
  readonly cmp: 'atMost' | 'atLeast' | 'lessThanSource' | 'greaterThanSource';
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
/**
 * D383 - one member of a scoped board effect's set. A CLOSED shape: a creature
 * filter, a permanent type, or a group of players. Anything a printed sentence
 * names outside this leaves the whole sentence unread (D90).
 */
export interface BoardScope {
  readonly kind: 'creature' | 'permanent' | 'player';
  /** Whose. `any` is every player's, which is what "each creature" means. */
  readonly controller: 'you' | 'opponents' | 'any';
  /** `permanent` only: the card type the sentence names. */
  readonly type?: 'Creature' | 'Artifact' | 'Enchantment' | 'Land';
  /** `creature` only: a Tier-2 keyword the member must have, or must not. */
  readonly keyword?: Keyword;
  readonly keywordAbsent?: boolean;
  /** `creature` only: the member must be attacking right now. */
  readonly attacking?: boolean;
}

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
  /** D391 - CR 701.27a: one more counter of each kind on the permanents and players chosen. */
  | 'proliferate'
  | 'tap'
  | 'untap'
  /**
   * D393 - THREATEN: "Gain control of target <noun> until end of turn." - a control change WITH
   * AN END. The executor emits `ControlChangedUntilEndOfTurn`; the cleanup step hands the
   * permanent back (CR 514.2) if it is still on the battlefield.
   */
  | 'control'
  /**
   * D394 - "<target> can't block this turn." (CR 509.1b with an END): an until-end-of-turn entry
   * `canBlock` reads and cleanup clears; the same list the pumps and the grants ride.
   */
  | 'cantBlock'
  /**
   * D399 - "<target> can't be blocked this turn." (the evasion with an END, CR 509.1b's other
   * side): an until-end-of-turn entry on the ATTACKER that `canBlock` reads and cleanup clears.
   * The self form ("This creature can't be blocked this turn.") is aimed at the source (D373).
   */
  | 'cantBeBlocked'
  /**
   * D395 - the ANIMATE family: "<this land | target land> becomes a N/N [colour] [Type] [artifact]
   * creature [with KW] until end of turn." - a base P/T at layer 7b, subtypes at layer 4, colours
   * at layer 5 and keywords at layer 6, all on the one until-end-of-turn entry. "It's still a
   * land." is a `noop` beside it.
   */
  | 'animate'
  /**
   * D396 - BITE and FIGHT (CR 701.12): "<subject> deals damage equal to its power to <target>." and
   * "<subject> fights <target>." - two operands, one `DamageDealt`. The subject is a target, the
   * self, or the referent; the object is the clause's OTHER target (`otherTargetIndex`). A bite is
   * the one-way half; a fight deals both ways at once.
   */
  | 'bite'
  | 'fight'
  /**
   * D373 - CR 701.19: "Regenerate this creature." / "Regenerate target creature." -
   * a shield on the permanent, spent by the next destruction this turn (`destroy`
   * and `sba.ts` both read it; cleanup clears it with the other until-end-of-turn
   * effects). The verb the row library had and the vocabulary did not: six quoted
   * grants were one line from landing on it (Clot Sliver, Trollhide, Molting
   * Snakeskin, Savage Silhouette, Skeletal Grimace, Consecrated by Blood).
   */
  | 'regenerate'
  /**
   * D382 - CR 615: a prevention SHIELD. "Prevent all combat damage that would be
   * dealt this turn." (the Fog cycle), "Prevent the next N damage that would be
   * dealt to any target this turn.", and their kin. The shield goes on
   * `GameState.preventionShields` and the replacement funnel spends it, because
   * CR 615.1 says a prevention effect IS a replacement effect and the funnel is
   * the one place every damage event passes through - a shield consulted at the
   * emitter would be skipped by the hundreds of shipped modules that build a
   * `DamageDealt` themselves (D233's measured gap).
   */
  | 'prevent'
  /**
   * D383 - THE SCOPED BOARD EFFECT. `massPump` (D301) has walked a board-defined
   * SET rather than a target since it shipped; these are the same idea with the
   * other verbs, over ONE closed scope reader: "~ deals N damage to each creature
   * [without flying] [and each player]", "Destroy all enchantments.", "Return all
   * artifacts to their owners' hands." A scoped effect consumes no target slot.
   */
  | 'damageEach'
  | 'destroyAll'
  | 'bounceAll'
  /** D383 - "You gain N life for each <count>": a life gain the BOARD sizes. */
  | 'gainLifePer'
  /** D383 - "Put target creature on top of its owner's library." */
  | 'toLibraryTop'
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
  /**
   * D369 - "<effect> unless <player> pays <cost>." and "You may pay <cost>. If
   * you do, <effect>.": a PAYMENT the resolution stops to ask for, with the
   * effect it decides riding the spec (`EffectSpec.pay`). The one effect kind
   * whose consequence is chosen by the player it is aimed AT rather than by
   * the caster - a counterspell that its target's controller can buy off.
   */
  | 'payOptional'
  /**
   * D369 - "Sacrifice this creature." - a body the pay prompt decides. A row's
   * sentence, never a spell's: "sacrifice this creature unless you pay {U}".
   */
  | 'sacrificeSelf'
  /**
   * D390 - "Each player sacrifices a creature of their choice." / "Each opponent sacrifices a
   * permanent of their choice." - THE PLAYER QUEUE: every player in the spec's PLAYER scope
   * chooses in APNAP order, each seeing the choices before theirs, then the sacrifices happen at
   * once (CR 101.4). The noun is `sacrifice.predicates`; the count is `amount`. It ASKS, so it is
   * the sentence's last (the ASKS rule). A scoped `discard` is the same queue over the hand.
   */
  | 'sacrifice'
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
  | 'lookAtTop'
  /**
   * CR 701.19 - search a library for a card matching a predicate, put it somewhere, and shuffle.
   * `Rampant Growth`, `Cultivate`, `Demonic Tutor`, every ramp land and every tutor.
   *
   * ⚠️ The THIRD effect kind whose resolution stops and asks (after `discard` and `lookAtTop`),
   * and the first whose prompt is over a zone the player can see NONE of until it is raised.
   * The candidates never ride the prompt - it crosses the wire whole (D61) - they reach the
   * searcher through their own projection, SORTED, because the library's real order is the one
   * thing `project.ts` exists to strip and a search is only allowed to show you the SET.
   */
  | 'search'
  /**
   * D409 - explore (CR 701.42): reveal the top card of your library; a land goes to your hand, anything
   * else puts a +1/+1 counter on the exploring permanent and MAY go to your graveyard - the question is
   * the scry prompt over the revealed card (`toGraveyard`, D195). `amount` is how many times in a row
   * (`explores, then it explores again`). The subject is the source (`self`) or the target.
   */
  | 'explore'
  /**
   * D411 - "doesn't untap during its controller's next untap step": the aim (or the source) sits out its
   * controller's next untap step. Reaches a tapped target through the referent rewrite (`Tap target
   * creature. It doesn't untap ...`) as well as the bare form. No end of its own: the step spends it.
   */
  | 'freeze'
  /**
   * D412 - connive (CR 701.50): draw a card, then discard a card; a nonland card discarded this way puts
   * a +1/+1 counter on the conniving permanent. The discard is the hand prompt (`chooseFromZone`) carrying
   * `connive`. `amount` is how many times in a row. The subject is the source (`self`) or the target.
   */
  | 'connive';

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

/**
 * D357 - what a library search is allowed to find, and where it goes.
 *
 * ⚠️ `count` is a MAXIMUM and never a floor: CR 701.19b lets a player fail to find whatever the
 * card says, so an answer of zero cards is always legal and the handler must accept it. A search
 * that demanded its count would let a card lie about a deck it cannot see.
 */
/**
 * D359 - a bound on the CARD rather than on its type line.
 *
 * ⚠️ **IT IS NOT A `PermanentPredicate` FIELD, AND THAT IS THE POINT.** The same predicate
 * shape is read by the sacrifice chooser, the tap cost and the token resolver, none of which asks
 * about mana value or a printed name - so a bound parked there would be carried past every one of
 * them and silently ignored, which is the dead-field trap D355 paid for. It rides the SEARCH,
 * where exactly one reader consumes it.
 *
 * The qualifier is a CONJUNCT: it narrows every predicate in the list at once, because
 * `a Rebel permanent card with mana value 2 or less` is one noun with one bound on it.
 */
export interface SearchQualifier {
  /** `with mana value 3 or less` / `or greater` / `with mana value 3`. */
  readonly manaValue: { readonly op: 'lte' | 'gte' | 'eq'; readonly n: number } | null;
  /** `a card named Squadron Hawk` - matched against the printed name, exactly. */
  readonly name: string | null;
}

export interface SearchSpec {
  /** What may be chosen, through `predicatesOf` - the same reader the sacrifice and tap costs ask. */
  readonly predicates: readonly PermanentPredicate[];
  /** The printed noun, for the prompt the player reads (`a basic land card`). */
  readonly label: string;
  /** At most this many. */
  readonly count: number;
  /**
   * ⚠️ `libraryTop` IS NOT A MOVE. `Search your library for a card, then shuffle and put
   * that card on top` never takes the card out of the library - the library is shuffled and the
   * found card is placed back on top of it, which is why the answer handler writes ONE
   * `LibraryShuffled` order rather than a move and a shuffle.
   */
  readonly destination: 'hand' | 'battlefield' | 'graveyard' | 'libraryTop';
  /** The card arrives TAPPED - every ramp land, `Explosive Vegetation`, `Krosan Verge`. */
  readonly tapped: boolean;
  /**
   * Whether the library is shuffled afterwards. 511 of the 514 measured cards shuffle, and the
   * three that do not are why this is a field rather than an assumption: a search that showed
   * the player their library and did NOT shuffle would leave them knowing their next draws, and
   * that is exactly the case the sorted projection protects.
   */
  readonly shuffle: boolean;
  /**
   * D359 - `you may search your library for ...`.
   *
   * ⚠️ **DECLINING IS NOT FINDING NOTHING.** A search that finds nothing still looked, and
   * still shuffles; a search declined never looked and never shuffles, and the difference is
   * visible in the seeded generator and therefore in the replay hash. It is also an INFORMATION
   * difference, which is the sharper one: the library may not be revealed until the offer is
   * accepted, or a player could look, decline, and keep what they saw. The prompt is raised in
   * two stages for exactly that reason.
   */
  readonly optional: boolean;
  /** A bound on the card itself - mana value, printed name. Null when the noun carries none. */
  readonly qualifier: SearchQualifier | null;
}

/**
 * D369 - what a `payOptional` clause asks and decides. `who` is the PAYER: the
 * caster, the first target's controller ("unless its controller pays") or the
 * targeted player. Exactly one branch is non-empty per printed shape: "unless"
 * runs `ifNotPaid`, "you may pay ... if you do" runs `ifPaid`. The branches are
 * ordinary specs parsed by the same rules, so what the prompt decides is
 * exactly what the vocabulary already runs; a branch that itself ASKS is
 * refused at parse time.
 */
/**
 * D390 - the each-player sacrifice's noun, read by the sacrifice chooser's OWN reader (D168's
 * `predicatesOf`: "a creature or planeswalker" is two arms, and a word it cannot place refuses the
 * whole sentence), plus the printed noun for the prompt and the log.
 */
export interface SacrificeSpec {
  readonly predicates: readonly PermanentPredicate[];
  readonly what: string;
}

export interface PaySpec {
  /** The mana, printed; `null` when the price is life alone. Never carries X. */
  readonly cost: ManaCost | null;
  readonly life: number;
  readonly who: 'controller' | 'targetController' | 'targetPlayer';
  readonly ifPaid: readonly EffectSpec[];
  readonly ifNotPaid: readonly EffectSpec[];
}

/**
 * D373 - THE SELF-AIMED KINDS. A `self` clause of one of these is aimed by `effects.ts`
 * at the resolving object's SOURCE - for a granted ability the RECIPIENT (CR 113.7a),
 * for a permanent's printed ability the permanent - and the same arm that serves a
 * target then serves the source. Every other self kind keeps its meaning (a draw is
 * the caster's, the mass pump walks the board), and a self clause of an aimable kind
 * OUTSIDE this set is still refused by the vocabulary bridge, because the executor
 * would resolve it for nothing.
 *
 * ⚠️ CLOSED, and each member has a parser rule with the SELF subject and a proof in
 * `selfAimed.test.ts`. A kind listed here without a rule would be a subject the
 * executor claims and no sentence ever fills - a dead seam `tsc` cannot see (D158).
 */
export const SELF_AIMED: ReadonlySet<EffectKind> = new Set<EffectKind>(['pump', 'putCounters', 'bounce', 'untap', 'regenerate', 'animate', 'bite', 'fight', 'cantBeBlocked']);

/**
 * D402 - WHEN a delayed trigger fires: the step, and whose turn it must be. `next` is the first
 * such step to begin after the arming (the next end step of ANY turn); `controller` is the
 * first such step of the controller's own turn (`your next upkeep`). `the next turn's upkeep`
 * is `upkeep` + `next` with the turn required to be a LATER one, which the bus reads off the
 * arming turn.
 */
export interface DelayWhen {
  readonly step: 'upkeep' | 'end';
  readonly whose: 'next' | 'controller';
}

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
  /** `searchLibrary` only: what may be found, how many, and where it goes (D357). */
  readonly search: SearchSpec | null;
  /** `payOptional` only: the price and the branches (D369). REQUIRED, `null` elsewhere (D355). */
  readonly pay: PaySpec | null;
  /**
   * D399 - `pump` only: the printed rider "... until end of turn and can't be blocked this turn"
   * ("gets +1/+0 until end of turn and can't be blocked this turn") rides the same until-end-of-turn
   * entry as the pump. REQUIRED (D355/D356's rule), `false` on every other kind.
   */
  readonly cantBeBlocked: boolean;
  /** D390 - `sacrifice` only; `null` on every other kind. REQUIRED (D355/D356's rule). */
  readonly sacrifice: SacrificeSpec | null;
  /**
   * D402 - THE DELAYED TRIGGER (CR 603.7): this effect happens at the beginning of a LATER step
   * (`Draw a card at the beginning of the next turn's upkeep.`) rather than on resolution. The
   * resolution ARMS it (`DelayedTriggerArmed` carrying this spec with `delay` cleared) and the
   * trigger bus puts it on the stack when that step begins. REQUIRED (D355/D356's rule), `null`
   * on every effect that happens now. Only a sentence with no target, no referent and no ask
   * is read delayed (the vocabulary's rule).
   */
  readonly delay: DelayWhen | null;
  /**
   * D403 - `If this spell was kicked, <X>.`: this effect happens only when the spell was cast
   * kicked (`StackObject.kicked` > 0). REQUIRED (D355/D356's rule), `false` on every other effect.
   * The `instead` forms (`it deals 4 damage instead`) stay unread.
   */
  readonly ifKicked: boolean;
  /**
   * D407 - `exile` only: `Exile target creature an opponent controls until this permanent leaves the
   * battlefield.` (CR 610.3) - the exile is LINKED to the resolving object's source on the battlefield
   * and ends the moment that permanent leaves (or is a new object). Nothing is exiled when the source
   * has already left (610.3b). REQUIRED (D355/D356's rule), `false` on every other effect.
   */
  readonly untilLeaves: boolean;
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
  /**
   * No target clause: the subject is the caster (`You gain 3 life`), the board (the
   * mass pump) - or, for a kind in `SELF_AIMED` (D373), the resolving object's own
   * SOURCE: "This creature gets +1/+0 until end of turn." on a granted ability is the
   * RECIPIENT (CR 113.7a), on a permanent's printed ability the permanent itself, and
   * `effects.ts` aims the clause there - or says the subject has gone, exactly as it
   * says a target has.
   */
  readonly self: boolean;
  /**
   * D392 - THE REFERENT SUBJECT: the clause is about the previous clause's subject ("Untap that
   * creature.", "It gains haste until end of turn."). `effectParse` read it by the rule its
   * explicit form is read by and aims it where the previous clause aimed - it consumes NO target
   * of its own, so the printed target count and the effect count still agree. Absent on every
   * other clause.
   */
  readonly referent?: true;
  /**
   * D396 - the clause's OTHER target (a bite's or a fight's object), a second index the clause
   * consumes in printed order after its subject. Absent on every one-operand clause.
   */
  readonly otherTargetIndex?: number;
  /** D395 - the animate family's shape: what the permanent becomes until end of turn. */
  readonly animate?: {
    readonly power: number;
    readonly toughness: number;
    readonly colors: readonly ('W' | 'U' | 'B' | 'R' | 'G')[];
    readonly subtypes: readonly string[];
    readonly artifact: boolean;
    readonly keywords: readonly Keyword[];
  };
  /** D330 - "It can't be regenerated." rides the destroy it follows: the shield is not consulted. */
  readonly noRegenerate?: boolean;
  /**
   * D382 - "The damage can't be prevented." (CR 615.9) rides the damage it
   * follows, exactly as `noRegenerate` rides its destroy: the shields are not
   * consulted for it. D233 wrote the tripwire that made this debt honest.
   */
  readonly cantBePrevented?: boolean;
  /**
   * D383 - the set a scoped board effect applies to, read by ONE closed reader so
   * the scope vocabulary lives in a single place (D346's rule for the scoped
   * anthems). Absent on every clause that names a target instead.
   *
   * ⚠️ `massPump` carries it too and DEFAULTS to "creatures you control" when it
   * is absent, so every spec shipped before D383 means exactly what it meant.
   */
  readonly scopes?: readonly BoardScope[];
  /** D383 - `gainLifePer`: what the life gain counts. A CLOSED list. */
  readonly perCount?: 'creaturesYouControl' | 'cardsInYourGraveyard' | 'creatureCardsInYourGraveyard';
  /** D382 - `prevent`: how much (a number) or all of it this turn. */
  readonly preventAmount?: number | 'all';
  /** D382 - `prevent`: "combat damage" rather than any damage. */
  readonly preventCombatOnly?: boolean;
  /**
   * D382 - `prevent` with NO target clause: what the shield covers. `any` is
   * "damage that would be dealt this turn" with no recipient named at all (the
   * Fog cycle); `players` and `you` name one.
   */
  readonly preventScope?: 'any' | 'players' | 'you';
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
/**
 * D342 - "Activate only <condition>." (CR 602.5b-d): the printed conditions the
 * engine can evaluate from the state it holds - the turn, the board (DERIVED),
 * the hand and graveyard counts. Read by `activatedParse.parseActivationConditions`
 * into `ActivatedAbility.activateOnly`, offered by `legal.ts` and refused by
 * `handlers.ts` through `activationConditions.ts`. A condition outside this union
 * is an UNPAID cost: never offered, never claimed with its restriction dropped.
 */
export type ActivationCondition =
  | { readonly kind: 'duringYourTurn' }
  | { readonly kind: 'duringOpponentsTurn' }
  | { readonly kind: 'duringStep'; readonly step: 'upkeep' | 'declareAttackers' | 'declareBlockers'; readonly whose: 'yours' | 'any' }
  | { readonly kind: 'duringCombat' }
  | { readonly kind: 'beforeAttackersDeclared' }
  | { readonly kind: 'board'; readonly condition: Exclude<EntersTappedCondition, { kind: 'payLife' }> }
  | { readonly kind: 'controlCount'; readonly count: number; readonly any: readonly PermanentPredicate[] }
  | { readonly kind: 'selfPowerAtLeast'; readonly power: number }
  | { readonly kind: 'handSize'; readonly cmp: 'atMost' | 'exactly' | 'atLeast'; readonly count: number }
  | { readonly kind: 'graveyardCards'; readonly count: number; readonly types: readonly string[] }
  | { readonly kind: 'selfIsCreature' }
  /**
   * D348 - A CONDITION ON WHAT THIS TURN DID: "if a creature died this turn", "if
   * an opponent lost life this turn", "if an artifact entered under your control
   * this turn". One kind for all of them, because `TurnMemory` is one map and the
   * question is always the same shape.
   *
   * `who` is whose slot to read - `you`, an `opponent` (any one of them), or
   * `any`. `count` is how many the turn must have seen. `any`/`none` are the
   * predicates the CHECK derives over the recorded cards (the record holds ids,
   * not types): a noncreature spell is `none: [Creature]`, an instant or sorcery
   * is `any: [Instant, Sorcery]`, a non-Skeleton creature is both.
   */
  | { readonly kind: 'turnMemory';
      readonly what: TurnMemoryQuestion;
      readonly who: 'you' | 'opponent' | 'any';
      readonly count: number;
      readonly any: readonly import("../../data/replacementParse").PermanentPredicate[] | null;
      readonly none: readonly import("../../data/replacementParse").PermanentPredicate[] | null;
      /** D398 - the recorded card must be the SOURCE itself: "if this land entered this turn". */
      readonly self?: true;
      /** D398 - the source itself does not count: "if you've cast ANOTHER spell this turn", "if another creature died this turn". */
      readonly excludeSelf?: true };

/**
 * D348 - which slot of the turn record a condition asks about.
 *
 * D398 - `left` (any exit from the battlefield, `died` its graveyard subset),
 * `damaged` (damage dealt to a player), `toGraveyard` (a card put into a graveyard
 * from anywhere - descend), `drawn` (`TurnState.cardsDrawn`), and the AMOUNTS
 * `lifeGained` / `lifeLost` beside the booleans ("if you gained 3 or more life").
 */
export type TurnMemoryQuestion =
  | 'cast' | 'died' | 'entered' | 'leftGraveyard' | 'discarded' | 'tokensCreated' | 'lostLife' | 'gainedLife' | 'attackers'
  | 'left' | 'damaged' | 'toGraveyard' | 'drawn' | 'lifeGained' | 'lifeLost';

/**
 * D367 - ONE activated ability a permanent HAS because ANOTHER permanent's
 * static grants it: `Enchanted creature has "{T}: This creature deals 1 damage
 * to any target."` The runtime carrier the quoted-grant dossier named as
 * missing (d354/DESIGN-quoted-grant.md): `MutableCharacteristics` carried
 * keywords and a `hasAbilities` flag and no list of granted abilities, so the
 * engine could install a keyword and nothing else.
 *
 * `provider` is the permanent whose static installed it - its SCRIPT owns the
 * def (`ref` is `<providerOracleId>#g<n>`, which `activatedDefFor` already
 * resolves by prefix). The RECIPIENT is the ability's source (CR 113.7a):
 * "this creature" and "you" resolve there, the recipient taps for its {T},
 * and the recipient is what a stack object names as `source`.
 *
 * ⚠️ `ability` is the quoted body PARSED AS ANY PRINTED ABILITY IS
 * (`scripts/grants.ts`, at module load, throwing by name on anything the
 * engine cannot charge) - one object, shared by reference with the def's
 * `granted`, so the offer and the resolution can never disagree about it.
 */
/**
 * D368 - ONE TRIGGERED ability a permanent has because ANOTHER permanent's static
 * granted it. The activated sibling below carries the parsed ability, because
 * `legal.ts` needs a cost to offer; a trigger needs no such copy - the bus reads
 * the def itself off the PROVIDER's script by `ref`, exactly as `triggerDefFor`
 * already resolves one at resolution.
 */
export interface GrantedTriggered {
  /** The permanent whose static installed this. Its script owns the def. */
  readonly provider: InstanceId;
  /** `<providerOracleId>#gt<n>` - the key the registry's grant index holds. */
  readonly ref: AbilityRef;
}

export interface GrantedActivated {
  readonly provider: InstanceId;
  readonly ref: AbilityRef;
  readonly ability: ActivatedAbility;
}

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
    /**
     * D353 - how many permanents the cost eats. 1 for "a"/"an"/"another"; the
     * counted wordings ("Sacrifice two lands", "Sacrifice three Treasures")
     * read their number here, exactly as the discard and tap choosers have
     * since D286. ⚠️ A COMPOUND cost ("Sacrifice two lands and this artifact")
     * is two prices in one phrase and stays in `unpaidCosts`.
     */
    readonly count: number;
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
    /** D328 - "Discard a card at random": no choice to price; `finishAbility` draws the cards off the seeded rng. */
    readonly atRandom: boolean;
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
    /**
     * D311 - CREW: "any number" of the candidates whose POWER adds up to at
     * least this, instead of a count. The count is 0 when this is set.
     */
    readonly powerAtLeast?: number;
  } | null;
  /**
   * D352 - `Return N <predicate> you control to its owner's hand` — a bounce
   * the player CHOOSES, in the tap chooser's shape (D286), named by
   * `ActivateAbility.returnToHand`; `another` drops the source. ⚠️ Tapped or
   * untapped, and the source itself IS a candidate unless the wording says
   * otherwise — nothing about returning a permanent asks it to be ready.
   */
  readonly returnCost: {
    readonly count: number;
    readonly another: boolean;
    readonly any: readonly import('../../data/replacementParse').PermanentPredicate[];
  } | null;
  /**
   * D352 - `Return this enchantment to its owner's hand` — a SELF-return:
   * deterministic, no chooser, so a price the engine takes (the
   * self-sacrifice's rule, D159). ⚠️ Chargeable is not offerable, and
   * `resolve` then runs with its source in HAND — read `obj.controller`,
   * never the board position of `self`.
   */
  readonly returnsSelf: boolean;
  /**
   * `Sacrifice this <type>` — a SELF-sacrifice: deterministic, no chooser, so
   * the engine can charge it (D159). ⚠️ Chargeable is not offerable: a
   * destructive cost is OFFERED only when the game's registry carries an
   * `ActivatedDef` that will run the effect — charging mana for nothing is
   * D122's disclosed status quo, eating a permanent for nothing is not.
   * `Sacrifice a creature` (a choice) stays in `unpaidCosts`.
   */
  readonly sacrificesSelf: boolean;
  /**
   * D353 - `Put a -1/-1 counter on this creature`: `removeCounterCost`'s
   * mirror. SELF only and a fixed count, so it is a price rather than a
   * decision; "on a creature you control" is a chooser and stays unpaid.
   */
  readonly putCounterCost: { readonly kind: string; readonly count: number } | null;
  /** Cost components the engine cannot charge, verbatim: `Sacrifice a creature`, `+1`. */
  /**
   * D319 - "Remove a +1/+1 counter from this creature": SELF only and a fixed
   * count, deterministic, so a price the engine takes (offered only while the
   * counters are there, and only with a registered def). "X" stays in
   * `unpaidCosts` - a computed cost the engine cannot compute.
   *
   * D363 - AND `from` NAMES THE CHOOSER. "Remove a +1/+1 counter from a creature
   * you control" is the same price with a decision in it, so the ACTIVATION names
   * the permanents (`ActivateAbility.removeCounter`) exactly as the sacrifice,
   * discard, tap, return and exile-from-graveyard choosers do. `null` is SELF, the
   * shape D319 shipped and every existing row still uses.
   *
   * ⚠️ THE KIND IS NEVER A CHOICE. `CounterKind` is +1/+1 and -1/-1 and nothing
   * else (D130), so "Remove A COUNTER" - any kind - stays unpaid: the engine
   * cannot enumerate what it cannot represent.
   *
   * ⚠️ REPETITION IS LEGAL where the sacrifice chooser forbids it. "Remove two
   * +1/+1 counters from AMONG creatures you control" may take both from one
   * creature carrying two, so the picks are a MULTISET and a permanent named k
   * times must carry k counters.
   */
  readonly removeCounterCost: {
    readonly kind: string;
    readonly count: number;
    /** D363 - the permanents the picks may name; `null` is this permanent alone. */
    readonly from: readonly PermanentPredicate[] | null;
  } | null;
  /**
   * D329 - "Exile N <predicate> cards from your graveyard": a chooser over the
   * activator's graveyard (the discard chooser's shape, D286), named by
   * `ActivateAbility.exileFromGraveyard`; a `null` predicate list is "card(s)".
   */
  readonly exileFromGraveyardCost: {
    readonly count: number;
    readonly any: readonly import('../../data/replacementParse').PermanentPredicate[] | null;
    /** D334 - "another" / "other": the activating card itself is never a candidate. */
    readonly another: boolean;
  } | null;
  /**
   * D329 - "Exile this card from your graveyard" (CR 113.6): the ability is
   * activated from the GRAVEYARD and the card is exiled as its cost.
   */
  readonly exileSelfFromGraveyard: boolean;
  /**
   * D333 - "Return this card from your graveyard to the battlefield ...": the
   * ability is activated from the GRAVEYARD (CR 113.6) though its cost exiles
   * nothing; the effect moves the card itself.
   */
  readonly activatesFromGraveyard: boolean;
  readonly unpaidCosts: readonly string[];
  readonly payable: boolean;
  /** CR 605 — does NOT use the stack. */
  readonly isManaAbility: boolean;
  readonly isLoyalty: boolean;
  /** `Activate only as a sorcery`. */
  readonly sorceryOnly: boolean;
  /** D328 - `Activate only once each turn` (CR 602.5b): refused and unoffered once `TurnState.activations` counts it. */
  readonly oncePerTurn: boolean;
  /**
   * D342 - every other `Activate only ...` condition the vocabulary read, ALL of
   * which must hold at activation (`activationConditionsHold`). Empty when the
   * line prints none; an unread one made the ability unpayable instead.
   */
  readonly activateOnly: readonly ActivationCondition[];
  readonly targets: readonly TargetSpec[];
  /**
   * D305 - THE EQUIPMENT SEAM. Set on the ability `activatedParse` synthesizes
   * for an "Equip {N}" line (CR 702.6a: "{N}: Attach this permanent to target
   * creature you control. Activate only as a sorcery."), carrying the printed
   * line so the accounting can find it. `resolveAbility` attaches natively.
   */
  readonly equip?: { readonly line: string };
  /**
   * D306 - THE CYCLING SEAM. Set on the ability `activatedParse` synthesizes
   * for a "Cycling {N}" line (CR 702.29a: "{N}, Discard this card: Draw a
   * card."), carrying the printed line. Offered from the HAND at instant speed
   * (`legal.ts`), the discard charged as the cost (`handlers.ts`), the draw
   * resolved natively (`resolveAbility`).
   */
  readonly cycling?: {
    readonly line: string;
    /** D410 - TYPECYCLING (CR 702.29b): the type searched for (`Forest`, `basic land`, `Sliver`), and the search the vocabulary read for it (hung on by `oracleParse`). */
    readonly type?: string;
    readonly effects?: readonly EffectSpec[];
  };
  /**
   * D311 - THE CREW SEAM. The synthesized "Crew N" ability (CR 702.122a): tap
   * any number of untapped creatures you control with total power N or more,
   * and the Vehicle becomes an artifact creature until end of turn. `line`
   * is the printed line it accounts for.
   */
  readonly crew?: { readonly line: string; readonly power: number };
}

/**
 * D343 - one mode of a modal ability as a card script declares it: the printed
 * text after the bullet, and its target clauses (parsed by the script from the
 * same text). `StackObject.modes` holds the chosen indices; the def's `resolve`
 * reads them.
 */
export interface ModeDecl {
  readonly text: string;
  readonly targets?: readonly TargetSpec[];
}

/** D343 - a modal SPELL's mode: its clauses and the effect vocabulary's read of its text. */
export interface ModeSpec extends ModeDecl {
  readonly targets: readonly TargetSpec[];
  readonly effects: readonly EffectSpec[];
  readonly effectMode: EffectMode;
}

/** D343 - a modal instant or sorcery: the head's printed line, how many modes it allows, the modes. */
export interface ModalFace {
  readonly line: number;
  readonly min: number;
  readonly max: number;
  readonly modes: readonly ModeSpec[];
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
   * D307 - THE FLASHBACK SEAM. The mana cost of the face's "Flashback {N}"
   * line, or null: cast from its owner's GRAVEYARD for this cost instead of
   * its mana cost, and exiled if it would leave the stack (CR 702.34a).
   * "Flashback-<other cost>" stays null.
   */
  readonly flashbackCost: ManaCost | null;
  /**
   * D403 - KICKER (CR 702.33): the optional additional cost `Kicker {M}` on its own line, paid at
   * cast time when the caster chooses (`CastSpell.kicked`), and `Multikicker {M}` paid any number
   * of times. The two-kicker form (`Kicker {M} and/or {M}`) is null: a choice the intent does not
   * carry yet. Read once at ingest, like `flashbackCost`.
   */
  readonly kickerCost: ManaCost | null;
  readonly multikickerCost: ManaCost | null;
  /**
   * D405 - CONVOKE (CR 702.51), IMPROVISE (CR 702.126), DELVE (CR 702.66): the cast may pay part of
   * the cost by tapping creatures, tapping artifacts or exiling cards from the graveyard
   * (`CastSpell.convoke` / `improvise` / `delve`). Read off the keyword line at ingest.
   */
  readonly convoke: boolean;
  readonly improvise: boolean;
  readonly delve: boolean;
  /**
   * D406 - THE ADDITIONAL COST AT CAST (`As an additional cost to cast this spell, <cost>.`): a
   * chooser verb (a sacrifice, a discard, a tap, an exile from the graveyard, a return to hand) or a
   * life payment the cast charges ahead of the mana, with `or pay {M}` as the verb's alternative.
   * Null when the face prints none, or one the cost grammar cannot read (`parseAdditionalCost`).
   */
  readonly additionalCost: import('../../data/activatedParse').AdditionalCost | null;
  /**
   * D408 - THE ALTERNATIVE COST AT CAST (`You may <cost> rather than pay this spell's mana cost.`):
   * the mana cost REPLACED by a mana payment, a life payment, one chooser verb or the pitch, under a
   * condition the activation grammar reads; elected by `CastSpell.alternative`. Null when the face
   * prints none, one the grammar cannot read, or one beside an additional cost with a chooser verb.
   */
  readonly alternativeCost: import('../../data/activatedParse').AlternativeCost | null;
  /**
   * D309 - THE MORPH SEAM. "Morph {N}" / "Megamorph {N}" as a mana cost (CR
   * 702.37): cast face down as a 2/2 for {3}, turned face up for this. Null
   * when the card has none or prints a dash cost. Permanents only.
   */
  readonly morphCost: ManaCost | null;
  /** The printed morph cost ("{1}{R}{R}"), for the offer's label; null with no morph cost. */
  readonly morphCostText: string | null;
  readonly megamorph: boolean;
  /**
   * D312 - THE COST-REDUCTION SEAM. The printed generic reductions the engine
   * prices from the board at cast time (affinity, "costs {N} less to cast for
   * each ... you control / for each ... card in your graveyard / if you
   * control a ..."). Empty when there are none the engine can price.
   */
  readonly costReductions: readonly import('../../data/costParse').CostReduction[];
  /** D404 - the reductions this PERMANENT grants to the spells its controller (or anyone) casts. */
  readonly grantedReductions: readonly import('../../data/costParse').GrantedReduction[];
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
   * D343 - THE MODAL SEAM: an instant or sorcery whose whole text is "Choose
   * <word> —" and its "• mode" lines, each mode with its own target clauses and
   * effects. Set only for that shape; `targets` and `effects` are then EMPTY
   * (the modes carry them) and `effectMode` is `auto` when every mode is.
   */
  readonly modal: ModalFace | null;
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
  /**
   * D310 - every creature subtype the database prints, for changeling (CR
   * 702.73a: "every creature type"). Computed once at ingest from the creature
   * faces; the derive hands a changeling all of them.
   */
  readonly creatureTypes: ReadonlySet<string>;
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
  /**
   * D367 - the activated abilities OTHER permanents' statics have installed on
   * this one, in layer-6 order. Empty for almost everything; read by
   * `legal.ts` beside the face's own `activated`. Cleared with every other
   * ability when the object has lost its abilities (CR 613 layer 6).
   */
  readonly grantedActivated: readonly GrantedActivated[];
  /** D368 - triggered abilities another permanent's static granted this one. */
  readonly grantedTriggered: readonly GrantedTriggered[];
}
