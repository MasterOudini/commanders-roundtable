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
  readonly anyColor: { readonly scope: 'all' | 'identity'; readonly amount: number } | null;
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

export type TargetZone = 'graveyard' | 'exile';

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
  | 'bounce'
  | 'counter'
  | 'pump'
  | 'tap'
  | 'untap'
  | 'draw'
  | 'gainLife'
  | 'loseLife';

export interface EffectSpec {
  readonly kind: EffectKind;
  /** Damage dealt, life gained/lost, cards drawn. 0 where it does not apply. */
  readonly amount: number;
  /** `pump` only: the two halves, which may be negative. */
  readonly power: number;
  readonly toughness: number;
  /**
   * Which of the spell's targets this clause applies to — an index into
   * `StackObject.targets`. -1 means "no target", e.g. `Draw three cards`.
   */
  readonly targetIndex: number;
  /** Applies to the caster rather than to a target. `You gain 3 life`. */
  readonly self: boolean;
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
  /** Cost components the engine cannot charge, verbatim: `Sacrifice a creature`, `+1`. */
  readonly unpaidCosts: readonly string[];
  readonly payable: boolean;
  /** CR 605 — does NOT use the stack. */
  readonly isManaAbility: boolean;
  readonly isLoyalty: boolean;
  /** `Activate only as a sorcery`. */
  readonly sorceryOnly: boolean;
  readonly targets: readonly TargetSpec[];
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
   * reaches the stack with targets without a card script, and `EMPTY_REGISTRY`
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
