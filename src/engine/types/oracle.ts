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
import type { EntersAsCopy, EntersTapped, EntersTappedCondition, PermanentPredicate } from '../../data/replacementParse';
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
  // D439 - THE UPKEEP PRICES: two keywords that ARE upkeep triggers with a price the engine asks for (the same
  // table): echo (CR 702.30) and cumulative upkeep (CR 702.24). ⚠️ GATED on the printed price - `parseKeywords`
  // grants the keyword only when `readUpkeepPrice` reads it (a mana cost, `Pay N life.`, or both); an echo of
  // `Discard a card` or a cumulative upkeep of `Sacrifice a creature` stays a leftover line.
  'echo',
  'cumulativeUpkeep',
  // D440 - THE TABLE, PART 3: extort (CR 702.100a - a pay prompt with the drain rider as its body) and modular
  // (CR 702.43 - enters with N +1/+1 counters, a built-in; dies: put them on target artifact creature, a memo).
  'extort',
  'modular',
  // D444 - THE ENTRY CHOICES: unleash (CR 702.98 - a +1/+1 counter as it enters, or none; it can't block while it
  // has one) and riot (CR 702.132 - a +1/+1 counter or haste as it enters). Asked through D136's `entersChoice`
  // with an `option`; the haste chosen is remembered on the object (`CardInstance.riotHaste`).
  'unleash',
  'riot',
  // D445 - BACKUP (CR 702.165): an ETB trigger from the same table - N +1/+1 counters on target creature, and the
  // keywords printed below the line granted until end of turn when the target is another creature. Gated on the
  // reading (`parseBackup`): every line below must be a Tier-2 keyword line.
  'backup',
  // D449 - THE KEYWORD ALTERNATIVE COSTS: evoke (CR 702.74 - cast for the evoke cost, sacrificed as it enters: an
  // ETB trigger from the same table, gated on `CardInstance.evoked`) and dash (CR 702.109 - cast for the dash cost,
  // haste while it stays, returned to hand at the next end step by a delayed trigger armed as it resolves). Both
  // are the face's `alternativeCost` with a `keyword`, elected by `CastSpell.alternative` (D408's machinery).
  'evoke',
  'dash',
  // D450 - VANISHING (CR 702.63 - N time counters as it enters, one removed each of its controller's upkeeps, sacrificed
  // when the last is removed) and FADING (CR 702.32 - N fade counters, one removed each upkeep, sacrificed when none
  // can be): the entry counters from `withEntryCounters`, the triggers from the keyword table.
  'vanishing',
  'fading',
  // D459 - FABRICATE (CR 702.122 - N +1/+1 counters or N Servos as it enters): a modal trigger from the keyword table.
  'fabricate',
  // D463 - MOBILIZE (CR 702.179 - N Warrior tokens tapped and attacking as it attacks, sacrificed at the next end step).
  'mobilize',
  // D525 - CASCADE (CR 702.85): a keyword that IS a cast trigger - exile from the top of the library until a nonland
  // card with a lesser mana value, which may be cast for nothing; the rest to the bottom in a random order. Run from
  // the keyword table off the SPELL on the stack (`fromStack`), once per printing of the word (Apex Devastator's four).
  'cascade',
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
  readonly rest: 'graveyard' | 'bottom' | 'bottomOrdered' | 'topOrdered' | 'random' | 'top' | 'hand';
  /** D493 - the LOOK GRAMMAR: the taken cards go onto the battlefield (`tapped` when the line says so) instead of the hand. */
  readonly to?: 'battlefield';
  readonly tapped?: true;
  /** D493 - `Reveal the top N cards`: the look is public (revealed to every seat, not the looker alone). */
  readonly reveal?: true;
  /** D493 - the noun's negations (`a noncreature, nonland card`): the types the pick must LACK (the hand reveal's reader). */
  readonly none?: readonly string[];
  /** D526 - the taken cards enter the battlefield FACE DOWN as manifested 2/2 creatures (manifest dread's pick, a manifest from the hand). */
  readonly faceDown?: true;
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
  /**
   * D414 - `another target creature` / `up to one other target creature`: the resolving object's own
   * SOURCE is refused (`TargetingSource.sourceId`, `specAdmits`). Optional so every spec that never
   * said it keeps its exact shape.
   */
  readonly another?: true;
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
/**
 * D418 - THE COUNT EXPRESSION: what `for each <noun>` and `where X is the number of <noun>` count at
 * resolution - permanents the noun admits (a controller, the qualifiers `other` / `attacking` / `untapped`,
 * a keyword, a power floor, a +1/+1 counter, a name), cards in a hand or a graveyard, the object's own
 * kicker count (D403), the creatures that died this turn (the turn record, D348), the party, the players,
 * the basic land types among your lands. A CLOSED union: a noun outside it refuses the sentence.
 */
/** D427 - the shield's source as the sentence names it (the executor resolves the target forms to ids). */
export type PreventSourceSpec =
  | { readonly kind: 'target' }
  | {
      readonly kind: 'creatures' | 'sources';
      readonly controller: 'any' | 'you' | 'opponents' | 'targetPlayer';
      readonly attacking?: true;
      readonly unblocked?: true;
      readonly powerAtMost?: number;
      readonly notColor?: ColorLetter;
      readonly colorless?: true;
      readonly notSubtype?: string;
      readonly withoutKeyword?: Keyword;
      readonly noPlusCounter?: true;
      readonly exceptTarget?: true;
    };

export type CountExpr =
  | {
      readonly kind: 'permanents';
      readonly controller: 'you' | 'opponents' | 'any';
      readonly predicates: readonly PermanentPredicate[];
      readonly other: boolean;
      readonly attacking: boolean;
      readonly untapped: boolean;
      readonly keyword: Keyword | null;
      readonly powerAtLeast: number | null;
      readonly withPlusCounter: boolean;
      readonly named: string | null;
    }
  | { readonly kind: 'cardsInHand'; readonly who: 'you' }
  | { readonly kind: 'cardsInGraveyard'; readonly predicates: readonly PermanentPredicate[] | null; readonly named: string | null }
  | { readonly kind: 'kicked' }
  /** D437 - the spell's announced X (`{X}` in its mana cost, `xValue` on the stack object): `Draw X cards.`, `~ deals X damage`. */
  | { readonly kind: 'spellX' }
  /** D476 - the trigger's own number (`obj.memo`): `you gain that much life`, `draw that many cards` under a damage head. */
  | { readonly kind: 'memo' }
  | { readonly kind: 'diedThisTurn' }
  | { readonly kind: 'party' }
  | { readonly kind: 'players'; readonly who: 'opponents' | 'any' }
  | { readonly kind: 'basicLandTypes' };

export interface BoardScope {
  readonly kind: 'creature' | 'permanent' | 'player';
  /** Whose. `any` is every player's, which is what "each creature" means. D482 - `target`: the player the effect aimed at. */
  readonly controller: 'you' | 'opponents' | 'any' | 'target';
  /** `permanent` only: the card type the sentence names. */
  readonly type?: 'Creature' | 'Artifact' | 'Enchantment' | 'Land';
  /** `creature` only: a Tier-2 keyword the member must have, or must not. */
  readonly keyword?: Keyword;
  readonly keywordAbsent?: boolean;
  /** `creature` only: the member must be attacking right now. */
  readonly attacking?: boolean;
  /** D505 - `other`: every member but the source itself (`each other creature you control`, `all other creatures`). */
  readonly other?: true;
  /** D505 - `creature` only: a subtype the member must have (`each Merfolk creature you control`, `each Fractal you control`). */
  readonly subtype?: string;
  /** D505 - `permanent` only: `nonland permanents`. */
  readonly nonland?: true;
  /** D512 - `creature` only: the member attacked this turn (`all creatures that attacked this turn` - TurnMemory.attackerIds). */
  readonly attackedThisTurn?: true;
}

export type EffectKind =
  | 'damage'
  | 'destroy'
  | 'exile'
  /** COUNTER A SPELL. The counters you put on a permanent are the two below. */
  | 'counter'
  /** D487 - COPY A SPELL (CR 707.10): a stack object with the target spell's copiable values, `copy` its exceptions. */
  | 'copySpell'
  /** D488 - POPULATE (CR 701.31): a token that is a copy of a creature token the controller controls, their choice. */
  | 'populate'
  /** D491 - THE FROM-HAND FREE CAST (CR 601.2 / 118.9): `You may cast a spell ... from your hand without paying its mana cost.` - a hand chooser, then a cast begun by the answer. */
  | 'castFromHand'
  /** D489 - the suspend tick (CR 702.62c/d): a time counter off the exiled card; with the last gone, the free cast. */
  | 'suspendTick'
  /**
   * D494 - THE PREVIOUS CLAUSE'S OBJECTS: a sentence about `it` / `that token` / `those cards` / `them` whose
   * referent is what the clause before it produced (its targets, the tokens it created, the permanents it put onto
   * the battlefield), resolved at execution. `grantObj` - `It gains haste (until end of turn).` (indefinite without
   * the duration: `CardInstance.gained`, CR 611.2c); the rest are DELAYED (`... at the beginning of the next end
   * step`): `sacrificeObj`, `exileObj`, `destroyObj`, `returnObj` (to the battlefield under its owner's control),
   * `bounceObj` (to its owner's hand). Aimless at parse (`ofPrevious`); the delayed ones fire over the bound aims.
   */
  | 'grantObj'
  | 'sacrificeObj'
  | 'exileObj'
  | 'destroyObj'
  | 'returnObj'
  | 'bounceObj'
  | 'bounce'
  | 'pump'
  /**
   * D301 - "Creatures you control get +N/+N [and gain KW] until end of turn":
   * a self clause (no target) the consumer applies to EVERY creature its
   * controller controls as the board derives at resolution - D194's carrier,
   * one entry per creature, all ending at cleanup.
   */
  | 'massPump'
  /**
   * D505 - THE MASS VERBS OVER A SCOPE: `Put a +1/+1 counter on each creature you control.` (`massCounters` - the
   * counter kind and the count on every member), `Tap all creatures your opponents control.` (`massTap`), `Untap all
   * creatures you control.` (`massUntap`). The scope names no target and consumes no slot; the executor walks the
   * board (`scopeMembers`), and the members it reached ride the events for the object verbs after it (D500).
   */
  | 'massCounters'
  | 'massTap'
  | 'massUntap'
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
  /**
   * D434 - `Mill three cards.` / `Target player mills two cards.` / `Each opponent mills four cards.`: the top N
   * cards of a library into its owner's graveyard (CR 701.13) - the caster's own, the aimed player's, or every
   * member of a player scope in APNAP order. Fewer than N mills what is there; no loss, no prompt.
   */
  | 'mill'
  /**
   * D526 - MANIFEST (CR 701.34a): the top N cards of a library onto the battlefield FACE DOWN as 2/2 creatures, the
   * permanent marked `manifested` (a creature card turns face up for its mana cost, 701.34c); `libraryOf` names the
   * head's player's library. `manifestDread` (701.34e): look at the top two, one face down, the other into the
   * graveyard - a look whose pick enters face down (`LookSpec.faceDown`), an ask.
   */
  | 'manifest'
  | 'manifestDread'
  /**
   * D527 - CLASH (CR 701.10): you and an opponent each reveal the top card of your library and put it on top or on
   * the bottom; the higher mana value wins. `returnSelf`: `Return ~ to its owner's hand` - the source, or the spell's
   * own card once it has resolved (its hand fate when it is still on the stack).
   */
  | 'clash'
  | 'returnSelf'
  | 'gainLife'
  /** D519 - `You get {E}{E}.`: energy counters for the caster (CR 122.1); `amount` is the symbols printed. */
  | 'gainEnergy'
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
  /** D475 - `You get an emblem with "..."`: the emblem printing on `token`, created in the controller's command zone (CR 114). */
  | 'createEmblem'
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
  /** D448 - the source itself to exile, if it is still on the battlefield (unearth's delayed exile). */
  | 'exileSelf'
  /**
   * D501 - THE SPELL'S OWN FATE. `Exile ~.` / `Shuffle ~ into its owner's library.` / `Put ~ on the bottom of its
   * owner's library.` as a spell's own sentence: CR 608.2n replaced by the card's text - the resolving spell leaves the
   * stack for exile, or its owner's library (shuffled in, or on the bottom), never the graveyard. The self kinds parse
   * as any other; `resolveTop` reads them off the face and moves the card as it leaves the stack (the card is still on
   * the stack while its clauses run, CR 608.2), so the executor leaves a source on the stack alone. On a permanent the
   * same words are the source's own move from the battlefield, the executor's.
   */
  | 'shuffleSelf'
  | 'bottomSelf'
  /**
   * D502 - THE EXTRA TURN (CR 500.7). `Take an extra turn after this one.` (the controller's; `two extra turns` is
   * `amount` 2) / `Target player takes an extra turn after this one.` (the aimed player's): an entry on
   * `GameState.extraTurns`, a STACK - the most recently created extra turn is taken first, and the regular
   * succession resumes from the turn it interrupted. `skipUntapThatTurn` - `Skip the untap step of that turn.` right
   * after it (Savor the Moment): the entry just added skips its untap step.
   */
  | 'extraTurn'
  | 'skipUntapThatTurn'
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
   * D431 - `Return a land you control to its owner's hand.` / `Return a creature you control to its owner's hand.` -
   * THE PLAYER QUEUE's third verb over the battlefield (the caster alone, the `you` scope): the noun is
   * `returnChoose.predicates`, the count `amount`; the picks go to their owners' hands at once. It ASKS, so it is
   * the sentence's last.
   */
  | 'returnChoose'
  /**
   * D510 - THE UNTAP CHOICE: `Untap up to N lands.` (Frantic Search, Snap, Rewind, Peregrine Drake) - the queue's fifth
   * verb (`untap`): the caster chooses up to N permanents the noun admits, any controller's (CR: any lands), and they
   * untap; the prompt carries `min` 0 (`up to`). The noun rides `untapChoose`.
   */
  | 'untapChoose'
  /**
   * D511 - BOLSTER N (CR 701.37): a creature with the least toughness among creatures you control gets N +1/+1 counters;
   * the queue's sixth verb (`bolster`) - the candidates are computed, a tie is asked, the only one goes unasked, none
   * does nothing. `amount` is N.
   */
  | 'bolster'
  /**
   * D520 - AMASS [SUBTYPE] N (CR 701.47): if you control no Army creature token, create a 0/0 black [subtype] Army
   * creature token; choose an Army creature token you control (the queue's seventh verb - asked among several, the only
   * one unasked); put N +1/+1 counters on it; it becomes the subtype in addition to its other types. `amount` is N,
   * `token` the table's Army, `subtype` the singular the Army becomes.
   */
  | 'amass'
  /**
   * D521 - THE RING TEMPTS YOU (CR 701.54): the caster chooses a creature they control as their Ring-bearer (the queue's
   * eighth verb - asked among several, the only one unasked, none still counts), the seat's count rises and the Ring
   * emblem arrives with the first temptation; the emblem's abilities unlock on the count.
   */
  | 'ringTempt'
  /**
   * D522 - THE MONARCH (CR 724.2): `You become the monarch.` / `Target opponent becomes the monarch.` - the named
   * player takes the crown and the previous monarch loses it; a player who is already the monarch becomes nothing
   * (no state moves, so no event). The crown's own rules - the end-step draw and the combat-damage steal - are the
   * engine's since D332; this kind is the sentence that hands it over. `self` names the controller, otherwise the aim.
   */
  | 'becomeMonarch'
  /**
   * D510 - THE WHEEL INTO THE LIBRARY: `Each player shuffles their hand and graveyard into their library, then draws N
   * cards.` (Timetwister, Time Reversal, Echo of Eons, Time Spiral) - every player in APNAP order, one shuffle each off
   * the seeded generator; `amount` is the draw. The `you` form (`Shuffle your hand and graveyard into your library,
   * then draw N cards.`) scopes the caster alone.
   */
  | 'wheelShuffle'
  /**
   * D512 - THE ADDITIONAL COMBAT PHASE (CR 500.8): `After this main phase, there is an additional combat phase followed
   * by an additional main phase.` (Relentless Assault, Fury of the Horde, Seize the Day) and `After this (combat) phase,
   * there is an additional combat phase.` (Aurelia, Hellkite Charger, Aggravated Assault's second half). `extraPhases`
   * is what is added, `extraAfter` which phase it follows: `main` is the next main phase to end (this one, cast in a
   * main phase), `current` the phase the clause resolves in.
   */
  | 'extraCombat'
  /**
   * D514 - THE OBJECT'S STAT AS LAST KNOWN: `You gain life equal to that creature's toughness.` (Sheltering Word, Angelic
   * Chorus, Heal the Scars, Engulfing Slagwurm) - aimed at the creature the sentence is about (the item under a head, the
   * previous clause's target through the referent), the amount its power or toughness (`stat`) as the executor finds it:
   * on the battlefield as the step runs, or as it last was before this resolution once it has left (CR 608.2h).
   */
  | 'gainLifeStat'
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
   * D436 - `Exile target card from a graveyard.` / `Exile target creature card from an opponent's graveyard.`: the
   * aimed card, in whichever graveyard the target clause admits, into exile; and `Put target card from a graveyard
   * on the bottom of its owner's library.` - the same aim, under its owner's library. The TARGET does the narrowing
   * (D138's rule): the noun, the adjectives, the owner and the zone are the target parser's, enforced at the aim.
   */
  | 'exileFromGraveyard'
  | 'graveyardToLibraryBottom'
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
   * D508 - THE HAND PUT: `You may put a land card from your hand onto the battlefield (tapped).` / `Put up to two land
   * cards from your hand onto the battlefield tapped.` (Sakura-Tribe Scout, Elvish Piper, Growth Spiral, Burgeoning).
   * The spec rides `look` (its `take`, `filter`, `none`, `optional`, `to: 'battlefield'`, `tapped`; `rest` is `hand` -
   * the unchosen stay where they are): the question is `chooseFromZone` over the hand with `to: 'battlefield'`, the
   * one hand prompt whose picks arrive as PERMANENTS (the entry funnel runs for them, as for a look's battlefield pick).
   * Nothing the noun admits asks nothing; a mandatory put with no more admitted than it takes moves them unasked (CR
   * 701.8a's one-legal-answer rule, D141); `up to N` and `any number of` are optional counts.
   */
  | 'putFromHand'
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
  | 'connive'
  /**
   * D413 - "if <it> would die this turn, exile it instead" (CR 614.1): a mark on the creature(s) the
   * sentence names - the previous clause's target (the referent), every creature or permanent the
   * resolution DEALT DAMAGE to (`exileScope` 'damaged'), or every creature on the battlefield ('all',
   * 'opponents' - a creature that enters later this turn is not marked, reportable). Read by the
   * replacement funnel on the move to a graveyard.
   */
  | 'exileIfDies'
  /** D416 - `Target opponent reveals their hand. You choose a <noun> card from it. That player discards that card.` */
  | 'revealHandChoose'
  /** D417 - `Exile the top card of your library. Until the end of your next turn, you may play that card.` */
  | 'exileTopPlay';

/**
 * The counters a spell may put on or take off, and the list is CLOSED at the ones the engine reads.
 *
 * D469 - `shield` joined: the prevention funnel and the three destroy sites apply it (CR 122.1i),
 * so putting one is a change the board shows. D470 - `stun` joined the same way (CR 122.1j, the
 * untap built-in). D471 - the KEYWORD counters the engine enforces joined (CR 122.1c, `derive`
 * reads them at layer 6). The rule for the others stands.
 *
 * ⚠️ **BECAUSE THESE ARE THE ONES THE ENGINE READS.** `derive.ts` sums `+1/+1`
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
export type CounterKind =
  | '+1/+1'
  | '-1/-1'
  | 'shield'
  | 'stun'
  | 'flying'
  | 'first strike'
  | 'double strike'
  | 'deathtouch'
  | 'hexproof'
  | 'indestructible'
  | 'lifelink'
  | 'menace'
  | 'reach'
  | 'trample'
  | 'vigilance'
  | 'shadow';
/** D471 - the counter kinds the vocabulary may put, as printed; `counterKindOf` is the one gate. */
export const COUNTER_KINDS: readonly CounterKind[] = ['+1/+1', '-1/-1', 'shield', 'stun', 'flying', 'first strike', 'double strike', 'deathtouch', 'hexproof', 'indestructible', 'lifelink', 'menace', 'reach', 'trample', 'vigilance', 'shadow'];

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
/**
 * D416 - THE HAND REVEAL AND CHOOSE (Thoughtseize's family): the target player's hand is revealed to
 * every seat (CR 701.15a) and the CASTER chooses one card the noun admits (the look's reader, D389;
 * `a card` unfiltered; a mana-value bound through the search's own qualifier), which that player then
 * discards, or which is exiled.
 */
export interface HandChoice {
  /** The types the card must NOT have (`nonland`, `noncreature`) - a negation `PermanentPredicate` cannot express. */
  readonly none: readonly string[];
  /** What the card must be, past the negations; null for `a card` or a noun made of negations alone. */
  readonly filter: LookFilter | null;
  /** The printed noun, for the prompt and the log (`nonland card`). */
  readonly what: string;
  readonly qualifier: SearchQualifier | null;
  readonly then: 'discard' | 'exile';
  /** Thoughtseize's `You lose 2 life.` - the caster's life loss AFTER the pick, carried here so the ask stays last (D195). */
  readonly loseLife: number;
}

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
  /** D483 - `search your library and/or graveyard`: the searcher's graveyard is searched beside the library. */
  readonly graveyardToo?: boolean;
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

/**
 * D415 - THE VERB PRICE: the payment prompt's price when it is a chooser verb (D406's grammar - one
 * sacrifice, discard, tap, exile from the graveyard or return to hand) or the object's own sacrifice
 * (`sacrifice it`) instead of mana. `costText` is the printed price, for the prompt and the log.
 */
export interface VerbPrice {
  readonly costText: string;
  readonly sacrificeSelf: boolean;
  readonly sacrificeCost: ActivatedAbility['sacrificeCost'];
  readonly discardCost: ActivatedAbility['discardCost'];
  readonly tapCost: ActivatedAbility['tapCost'];
  readonly exileFromGraveyardCost: ActivatedAbility['exileFromGraveyardCost'];
  readonly returnCost: ActivatedAbility['returnCost'];
}

export interface PaySpec {
  /** The mana, printed; `null` when the price is life alone or a verb (D415). Never carries X. */
  readonly cost: ManaCost | null;
  readonly life: number;
  /** D519 - the ENERGY in the price (`you may pay {E}{E}`): counters, never mana. REQUIRED (D355/D356's rule), 0 elsewhere. */
  readonly energy: number;
  /** D415 - the chooser-verb price; REQUIRED (D355/D356's rule), null when the price is mana and/or life. */
  readonly verbs: VerbPrice | null;
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
export const SELF_AIMED: ReadonlySet<EffectKind> = new Set<EffectKind>(['pump', 'putCounters', 'bounce', 'untap', 'regenerate', 'animate', 'bite', 'fight', 'cantBeBlocked', 'destroy']);

/**
 * D402 - WHEN a delayed trigger fires: the step, and whose turn it must be. `next` is the first
 * such step to begin after the arming (the next end step of ANY turn); `controller` is the
 * first such step of the controller's own turn (`your next upkeep`). `the next turn's upkeep`
 * is `upkeep` + `next` with the turn required to be a LATER one, which the bus reads off the
 * arming turn.
 */
export interface DelayWhen {
  /** D497 - `endCombat`: `at end of combat` (CR 603.7 too) - the first end-of-combat step to begin, this turn's when armed in combat. */
  readonly step: 'upkeep' | 'end' | 'endCombat';
  readonly whose: 'next' | 'controller';
}

/**
 * D485 - CR 707.9b: what a copy is `except`. Read at layer 1 beside the printing the copy took (`derive.ts`), and
 * carried by the copy itself (707.3: a copy of a copy copies these too). A CLOSED set - exactly what the parser's
 * exception grammar spells - so an exception the copy would silently lack never reads as understood (D90).
 */
export interface CopyExceptions {
  /** D487 - `except that the copy is red` (Fork): the copy's colours are these instead of the copied object's. */
  readonly colors?: readonly ColorLetter[];
  readonly notLegendary?: true;
  readonly addTypes?: readonly string[];
  readonly addSubtypes?: readonly string[];
  readonly keywords?: readonly Keyword[];
  readonly power?: number;
  readonly toughness?: number;
}

/**
 * D485 - `createToken` only: the token is a COPY (CR 707) of the resolving object's source (`this creature`, `this
 * card`) or of the clause's target, with these exceptions. The printing is read at RESOLUTION off the copied object
 * (its copiable values), never at build time - which is why `token` is null beside it.
 */
export interface CopySpec {
  readonly of: 'self' | 'target';
  readonly exceptions: CopyExceptions | null;
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
  /** D520 - `amass` only: the creature subtype the chosen Army becomes (`Zombie`, `Orc`, `Sliver`). */
  readonly subtype?: string;
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
  /** D413 - `exileIfDies` only: whom the sentence names. REQUIRED (D355/D356's rule), null elsewhere. */
  readonly exileScope: 'target' | 'damaged' | 'all' | 'opponents' | null;
  /** D390 - `sacrifice` only; `null` on every other kind. REQUIRED (D355/D356's rule). */
  readonly sacrifice: SacrificeSpec | null;
  /** D431 - `returnChoose` only: the noun the queue offers. Absent on every other kind. */
  readonly returnChoose?: SacrificeSpec;
  /** D510 - the untap choice's noun (`lands`, `creatures`, `permanents`) - the queue's `untap` verb reads it as its filter. */
  readonly untapChoose?: SacrificeSpec;
  /**
   * D512 - `extraCombat`: the phases added (`combat`, or `combat` then `main`) and the phase they follow. On a `massUntap`
   * the same fields are the rider of the compound `Untap all ... and after this phase, there is an additional combat phase.`
   */
  readonly extraPhases?: readonly ('combat' | 'main')[];
  readonly extraAfter?: 'main' | 'current';
  /** D514 - `gainLifeStat` only: which stat of the creature the amount is. */
  readonly stat?: 'power' | 'toughness';
  /** D416 - `revealHandChoose` only: what the caster may choose and what becomes of it. REQUIRED (D355/D356's rule), null elsewhere. */
  readonly handChoice: HandChoice | null;
  /** D417 - `exileTopPlay` only: how many off the top, and how long they may be played. REQUIRED (D355/D356's rule), null elsewhere. */
  readonly exilePlay: { readonly count: number; readonly until: 'thisTurn' | 'yourNextTurn' | 'yourNextEndStep' } | null;
  /** D418 - a counted effect: the amount (a pump's halves) is multiplied by this count at resolution. REQUIRED (D355/D356's rule), null elsewhere. */
  readonly per: CountExpr | null;
  /**
   * D422 - `counter` only: where the countered spell goes INSTEAD of its owner's graveyard (`If that spell is
   * countered this way, exile it / put it into its owner's hand / on top of / on the bottom of its owner's
   * library instead ...`). REQUIRED (D355/D356's rule), null elsewhere and for the plain counter.
   */
  readonly counterTo: 'exile' | 'hand' | 'libraryTop' | 'libraryBottom' | null;
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
   * D423 - the `instead` forms ride `kickedInstead` below.
   */
  readonly ifKicked: boolean;
  /**
   * D523 - THE GATED CLAUSE: the conditions that must hold when this clause resolves, or null. `If you control four
   * or more creatures, ...` / `Then if you're the monarch, ...` - the engine's own `ActivationCondition` union, asked
   * at RESOLUTION over the board the clauses before it left. An unmet gate says so and does nothing (D90).
   */
  readonly gate?: readonly ActivationCondition[];
  /**
   * D523 - `If <condition>, <clause> instead.`: with the gate met this clause REPLACES the clause before it (D423's
   * shape for the kicked rider, one condition wider).
   */
  readonly gateInstead?: true;
  /**
   * D423 - `If this spell was kicked, <clause> instead.`: this effect REPLACES the effect before it when the
   * spell was kicked (the executor skips the base then, and this one when it was not). Always beside
   * `ifKicked: true`. REQUIRED (D355/D356's rule), `false` on every other effect.
   */
  readonly kickedInstead: boolean;
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
  /** D485 - `createToken` only: the token copies a permanent (CR 707). Absent on every token the table names. */
  readonly copy?: CopySpec;
  /** D487 - `copySpell` only: `You may choose new targets for the copy.` - its controller is asked once the copy exists. */
  readonly newTargets?: true;
  /**
   * D491 - `castFromHand` only: the grant's bound. `none` the types the noun negates (`noncreature`), `filter` its
   * predicates (`an instant or sorcery spell`, `a creature spell`, `a permanent spell`; null for `a spell`), `bound`
   * the mana-value ceiling (`with mana value N or less`; `x` the spell's announced X; `referent` the mana value of
   * the spell's first target - `with equal or lesser mana value`), `sharesType` the referent's card types
   * (`that shares a card type with it`). Absent on every other effect.
   */
  readonly castFree?: {
    readonly none: readonly string[];
    readonly filter: LookFilter | null;
    readonly bound: { readonly kind: 'n'; readonly n: number } | { readonly kind: 'x' } | { readonly kind: 'referent' } | null;
    readonly sharesType: boolean;
  };
  readonly thenDraw: number;
  /**
   * D435 - `Draw N cards. If you do, discard M cards.` (a `discard` of M): the draw of N precedes the discard and
   * GATES it - an empty library draws nothing, so nothing is discarded (CR 701.8, the if-you-do read at
   * resolution). Absent on every other discard.
   */
  readonly ifDrew?: number;
  /**
   * D439 - `Each opponent loses N life. You gain life equal to the life lost this way.` (a scoped `loseLife`): the
   * caster gains what the scope's members lost, summed at resolution. Absent on every other loss.
   */
  readonly gainLost?: boolean;
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
   * D494 - the clause is ABOUT THE PREVIOUS CLAUSE'S OBJECTS (`It gains haste.`, `Sacrifice it at the beginning of
   * the next end step.`): aimless at parse, its aims are what the clause before it produced, read off the events it
   * emitted (its targets, the tokens it created, the permanents it put onto the battlefield) as it runs. Absent on
   * every other effect.
   */
  readonly ofPrevious?: true;
  /**
   * D504 - the clause is done BY THE CONTROLLER (or the owner) OF THE PREVIOUS CLAUSE'S OBJECT (`Its controller
   * creates a 3/3 green Beast creature token.`, `That creature's controller mills four cards.`, `Its owner ...`):
   * aimless at parse, the executor binds it to that player as it runs - the controller as the object was last known
   * when the clause before acted on it (CR 608.2h), a countered spell's the spell's own. Absent on every other effect.
   */
  readonly ofPreviousPlayer?: 'controller' | 'owner';
  /** D526 - the library a manifest reads is the stack object's referent player's (`the top card of that player's library`, D428's `player`). */
  readonly libraryOf?: 'player';
  /** D494 - `grantObj` only: the keywords last while the object stays (no `until end of turn` printed). */
  readonly indefinite?: true;
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
   * D427 - `prevent` over a creature RECIPIENT set rather than one aim: `to creatures this turn`, `to creatures
   * you control`, `to you and creatures you control`, `to you and permanents you control`.
   */
  readonly preventRecipient?: 'creatures' | 'creaturesYouControl' | 'youAndCreatures' | 'youAndPermanents';
  /**
   * D427 - the SOURCE the shield stands against: this clause's target (`by target creature`, `target creature
   * would deal`), or a filter over creatures / sources (a controller - `your opponents`, a target player -,
   * attacking, unblocked, a power ceiling, a colour or subtype the source must not have, a keyword it must
   * lack, no +1/+1 counter, one target excepted). Absent is every source.
   */
  readonly preventSource?: PreventSourceSpec;
  /** D427 - `to and dealt by <target>`: the shield covers damage TO the target and damage FROM it. */
  readonly preventBothWays?: true;
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
  | { readonly kind: 'board'; readonly condition: Exclude<EntersTappedCondition, { kind: 'payLife' | 'reveal' }> }
  | { readonly kind: 'controlCount'; readonly count: number; readonly any: readonly PermanentPredicate[] }
  | { readonly kind: 'selfPowerAtLeast'; readonly power: number }
  | { readonly kind: 'handSize'; readonly cmp: 'atMost' | 'exactly' | 'atLeast'; readonly count: number }
  | { readonly kind: 'graveyardCards'; readonly count: number; readonly types: readonly string[] }
  | { readonly kind: 'selfIsCreature' }
  /** D490 - `if you control a commander` (the free-cast conditions): a commander among the player's permanents. */
  | { readonly kind: 'controlsCommander' }
  /**
   * D523 - the crown (CR 724), the condition half of D522's payload: `if you're the monarch` (and an opponent's, and
   * nobody's). Read off `state.monarch`, so a gated clause and an `Activate only if` line ask the same question.
   */
  | { readonly kind: 'monarch'; readonly who: 'you' | 'opponent' | 'none' }
  /** D527 - `if you win` (a clash, CR 701.10): the resolution's own verdict, never the board - `gateHolds` alone answers it. */
  | { readonly kind: 'clashWon' }
  /** D490 - `if an opponent controls a Plains and you control a Swamp` (the Legates): a predicate on some opponent's board and one on the player's. */
  | { readonly kind: 'acrossControl'; readonly theirs: readonly PermanentPredicate[]; readonly yours: readonly PermanentPredicate[] }
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
  /** D519 - `Pay {E}{E}`: energy counters the activation charges (CR 122.1, 118.13). 0 when there is none. */
  readonly energyCost: number;
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
   * else (D130), so the CHOOSER names its kind - a pick over the board must say
   * what it takes.
   *
   * D447 - AND THE SELF FORM MAY NAME NONE. "Remove a counter from this creature"
   * is `kind: null`: the two kinds the engine represents annihilate in pairs as a
   * state-based action (CR 704.5q), so a permanent carries ONE kind whenever a
   * player has priority and the price is still deterministic - the engine takes
   * the kind the permanent carries (`handlers.ts` drains the kinds present in a
   * fixed order, which only matters in a state no player ever acts in).
   *
   * ⚠️ REPETITION IS LEGAL where the sacrifice chooser forbids it. "Remove two
   * +1/+1 counters from AMONG creatures you control" may take both from one
   * creature carrying two, so the picks are a MULTISET and a permanent named k
   * times must carry k counters.
   */
  readonly removeCounterCost: {
    /** D447 - `null` is a counter of ANY kind (the self form alone; the chooser always names one). */
    readonly kind: string | null;
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
  /**
   * D451 - "Discard this card" in the cost: the ability is activated from the HAND (CR 113.6 - bloodrush,
   * reinforce) and the discard is charged in the cost batch as cycling's is (D306). Absent everywhere else.
   */
  readonly discardsSelf?: true;
  readonly unpaidCosts: readonly string[];
  readonly payable: boolean;
  /** CR 605 — does NOT use the stack. */
  readonly isManaAbility: boolean;
  readonly isLoyalty: boolean;
  /**
   * D472 - the loyalty cost as a signed number (CR 606): `+2` adds, `−3` removes and needs that many
   * counters (606.5), `0` is free. Absent for an X cost, which stays unpaid. Once a turn per
   * PERMANENT (606.3), at sorcery speed - `sorceryOnly` is set with it.
   */
  readonly loyaltyCost?: number;
  /** `Activate only as a sorcery`. */
  readonly sorceryOnly: boolean;
  /** D328 - `Activate only once each turn` (CR 602.5b): refused and unoffered once `TurnState.activations` counts it. */
  readonly oncePerTurn: boolean;
  /**
   * D457 - `Exhaust — <cost>: <effect>` (CR 702.178): activated only once per OBJECT. Read off the printed word,
   * the cost charged behind it; `legal.ts` withholds and `handlers.ts` refuses it once `CardInstance.exhausted`
   * names its ref. Absent when the line prints no exhaust.
   */
  readonly exhaust?: true;
  /**
   * D458 - `Boast — <cost>: <effect>` (CR 702.142): activated only if this creature attacked this turn, once each
   * turn (`oncePerTurn` is set with it). Read off the printed word, the cost charged behind it; `legal.ts` withholds
   * and `handlers.ts` refuses it while `TurnMemory.attackerIds` does not name the source.
   */
  readonly boast?: true;
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
  /**
   * D440 - THE SCAVENGE SEAM. The synthesized "Scavenge {cost}" ability (CR 702.96a): the mana and the card's own
   * exile from the graveyard as the cost, `target creature` as the clause, and the card's PRINTED power in +1/+1
   * counters resolved natively (`resolveAbility`) - the card is in exile by then, and its power is last known
   * information the parse carries. `line` is the printed line it accounts for.
   */
  readonly scavenge?: { readonly line: string; readonly power: number };
  /**
   * D448 - THE UNEARTH SEAM. The synthesized "Unearth {cost}" ability (CR 702.84a): the printed mana as the cost,
   * activated from its owner's graveyard at sorcery speed, resolved natively (`resolveAbility`) - the card returns
   * to the battlefield `unearthed` (haste while it stays, exile instead of leaving, exile at the next end step by
   * the delayed trigger armed with it). `line` is the printed line it accounts for.
   */
  readonly unearth?: { readonly line: string };
  /**
   * D462 - NINJUTSU (CR 702.49a): synthesized from the printed `Ninjutsu {cost}` line - activated from the hand,
   * the cost the mana plus `returnCost` (one unblocked attacker you control), the effect native (`loop.ts`: the
   * card enters tapped and attacking the returned creature's defender). Offered only inside the combat window.
   */
  readonly ninjutsu?: { readonly line: string };
  /**
   * D451 - THE REINFORCE SEAM. The synthesized "Reinforce N—{cost}" ability (CR 702.77a): the mana and the
   * card's own discard from the hand as the cost, `target creature` as the clause, N +1/+1 counters resolved
   * natively. `line` is the printed line it accounts for.
   */
  readonly reinforce?: { readonly line: string; readonly n: number };
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
   * D489 - `Suspend N—{cost}` on its own line (CR 702.62), or null: a special action from the hand any time the card
   * could be cast - pay the cost, exile it with N time counters; at each of its owner's upkeeps one comes off, and
   * with the last gone the card is cast without paying its mana cost (a creature has haste while it stays). The line
   * is the engine's only for a face the free cast needs no question for (no target, no mode, no X, no additional
   * cost) - the accounting says so.
   */
  readonly suspend: { readonly count: number; readonly cost: ManaCost } | null;
  /**
   * D422 - `This spell can't be countered.` printed on a SPELL face (CR 701.5a: countering it does nothing).
   * A permanent's line is its script's (`CardScript.cantBeCountered`, D336); a spell has no script, so the
   * face carries it and the counter funnel reads both. False on every other face.
   */
  readonly cantBeCountered: boolean;
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
  /** D460 - the morph cost is a DISGUISE cost (CR 702.168): the face-down permanent has ward {2}. */
  readonly disguise: boolean;
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
   * D486 - `You may have ~ enter as a copy of <noun>` (CR 707.9): a replacement the funnel asks about as the permanent
   * enters (`Awaiting.chooseCopy`), applied on the move itself (`CardMove.asCopyOf`). Null on every face that prints
   * no such line, and on an instant or sorcery.
   */
  readonly entersAsCopy: EntersAsCopy | null;
  /**
   * "As this ~ enters, choose a color." (CR 614.12). See
   * `CardInstance.chosenColor` for why the colour and not the other two shapes
   * of that sentence.
   */
  readonly choosesColorOnEntry: boolean;
  /**
   * D465 - "As this ~ enters, choose a creature type." (CR 614.12), the colour clause one noun
   * over: asked as the permanent enters, remembered on `CardInstance.chosenType`, read by the
   * statics over "of the chosen type".
   */
  readonly choosesTypeOnEntry: boolean;
  /**
   * D453 - `You control enchanted creature.` / `You control enchanted permanent.` on an Aura (CR 613.2 - a layer-2
   * control effect): while the Aura stays attached, its controller controls the enchanted permanent (`sba.ts`'s
   * built-in takes it and gives it back). Read off ONE exact line; false everywhere else.
   */
  readonly controlsEnchanted: boolean;
  /**
   * D442 - a printed MAXIMUM HAND SIZE modifier (CR 402.2), read off ONE exact line of a permanent
   * (`parseHandSize`): `You have no maximum hand size.`, `Players have no maximum hand size.`,
   * `Your maximum hand size is N.`, `Your maximum hand size is reduced/increased by N.`,
   * `Each opponent's maximum hand size is reduced by N.` The cleanup step reads it off every
   * battlefield permanent that still has abilities (`maxHandSize`), the way the entry flags above
   * are read - a rules-text static with a closed vocabulary, not a script line. `null` when the
   * face prints none of the six; a line with a duration (`for the rest of the game`, `until your
   * next turn`) or a chosen player is NOT read - it is a spell effect or a memory the engine lacks.
   */
  readonly handSize: HandSizeMod | null;
  /**
   * D443 - CR 701.39a: the card lets its controller exert it as it attacks - `You may exert this creature as
   * it attacks.` alone (the payload on a `Whenever you exert a creature` line) or with `When you do, ...` on the
   * same line (the reflexive trigger). Read by `canExert`, which also needs the script to fire on `Exerted`.
   */
  readonly exertsOnAttack: boolean;
  /**
   * D445 - Backup N (CR 702.165): `When this creature enters, put N +1/+1 counters on target creature. If that's
   * another creature, it gains the following abilities until end of turn.` - `grants` are the keywords printed
   * BELOW the Backup line (the abilities that follow it), every one a Tier-2 keyword the engine models; a card
   * with a non-keyword line below backup is not read (`null`), and the keyword is not granted (`parseKeywords`).
   */
  readonly backup: { readonly n: number; readonly grants: readonly Keyword[] } | null;
}

/** D442 - see `OracleFace.handSize`. `none` is unlimited; `set` replaces the seven; `delta` adds to it. */
export interface HandSizeMod {
  readonly who: 'you' | 'each' | 'opponents';
  readonly kind: 'none' | 'set' | 'delta';
  readonly n: number;
  /** The line as printed, for the accounting (`linesUnaccounted` asks the parser, never re-reads). */
  readonly line: string;
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
