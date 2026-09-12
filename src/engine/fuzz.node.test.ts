import { describe, expect, test } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Game } from './game';
import { checkInvariants } from './invariants';
import { legalActions } from './legal';
import { project } from './project';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { derive } from './derive';
import { buildPaymentProblem } from './mana';
import { applyAlternativePayment, assignAlternativePayment, chooseAlternatives, type ConvokeCandidate } from './altPayment';
import { makeDeriveCache } from './derive';
import { solveInputFor, suggestPayment } from './payment';
import { spellPurpose } from './spend';
import type { InstanceId, PlayerId } from './types/ids';
import type { LegalAction } from './legal';
import { nextBelow, seedRng, shuffle, type RngState } from './rng';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import {
  AJANIS_MANTRA,
  GRAVITY_SPHERE_SCRIPT,
  LEVITATION_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  KWENDE_SCRIPT,
  HUMILITY_SCRIPT,
} from './testing/cardScripts';
// ⚠️ The SHIPPED scripts are DERIVED from `SHIPPED_SCRIPTS` (imported above),
// never hand-imported one by one: at 500+ scripts every hand list is a rot
// site, and all five broken-guard incidents in this repo were hand-list drift
// (D102, D107, D108, D121, D156). The guard at the bottom holds both halves
// mechanically; `createRegistry` throws on a duplicate oracleId, so a testing
// script shadowing a shipped one cannot register twice silently.
import { deps, makeSpec, ORACLE, simplestAnswer } from './testing/harness';
import { predicateAdmits } from '../data/replacementParse';
import { proliferateCandidates } from './proliferate';
import { zoneId } from '../view/types';
import type { GameEvent } from './types/events';
import type { Intent } from './types/intents';
import type { GameState } from './types/state';

// ⚠️ THE GATE. Networking does not start until this is green, because every
// networking bug becomes unfalsifiable if the engine itself is nondeterministic.
//
// One property test covers what a hundred hand-written scenarios cannot:
// reducer/handler agreement, `apply` totality, invariant preservation, PRNG
// self-consistency and the absence of hidden nondeterminism. A random-legal-
// player fuzzer over tens of thousands of intents finds crash bugs no scenario
// will, because it plays sequences nobody would think to write down.
//
// Scale: `CRT_FUZZ_SEEDS` (default 60 here, 500 in the full run — see
// `npm run test:fuzz`). Sixty seeds × 200 intents is ~9 s and catches
// essentially everything; the 500-seed run is the milestone gate and is
// recorded in DECISIONS.md with its measured numbers.

const SEEDS = Number(process.env.CRT_FUZZ_SEEDS ?? 60);
const INTENTS = Number(process.env.CRT_FUZZ_INTENTS ?? 200);

/**
 * D296 — the gate SHARDED over the machine's cores. `CRT_FUZZ_SHARD="i/W"` runs
 * the seeds ≡ i (mod W) and writes its seeds + totals to `CRT_FUZZ_OUT`;
 * `CRT_FUZZ_AGGREGATE=<dir>` reads every shard file, asserts the seed sets are an
 * EXACT partition of [0, SEEDS), sums them, and asserts the canary floors over
 * the UNION. Per-seed properties (every hash equal) are asserted inside each
 * shard exactly as before; the floors are stated in ONE place, `assertFloors`.
 */
const SHARD = parseShard(process.env.CRT_FUZZ_SHARD);
const AGGREGATE = process.env.CRT_FUZZ_AGGREGATE ?? null;

function parseShard(spec: string | undefined): { readonly i: number; readonly w: number } | null {
  if (!spec) return null;
  const m = /^(\d+)\/(\d+)$/.exec(spec);
  if (!m) throw new Error(`CRT_FUZZ_SHARD must be "i/W", got "${spec}"`);
  const i = Number(m[1]);
  const w = Number(m[2]);
  if (!(w >= 1) || !(i >= 0) || i >= w) throw new Error(`CRT_FUZZ_SHARD out of range: "${spec}"`);
  return { i, w };
}

/**
 * ⚠️⚠️ **THE CANARY-STAPLES TABLE (D193)** — the structural end of the
 * rate-canary rot class its own comments spent nine incidents predicting
 * (D149 · D164 · D173 · D175 · D176 · D177 · D178 · D180 ×2): a canary's
 * FUEL is declared beside the counter it feeds and dealt into EVERY seat of
 * EVERY seed by `poolFor`, so pool growth can never dilute it again. The
 * copy weights and their rot histories moved here from the inline comments
 * they used to live in; `counterKeys` names the `Run` fields each staple
 * exists to move (a compile-time tie — a renamed counter fails tsc here).
 */
interface CanaryStaple {
  /** The card — or EVERY card of a set that must meet on one battlefield. */
  readonly names: readonly string[];
  /** Deliberate per-seat weight. Pairs compound — the weight is per NAME. */
  readonly copiesPerSeat: number;
  readonly counterKeys: readonly (keyof Run)[];
  readonly rotHistory: string;
}

const CANARY_STAPLES: readonly CanaryStaple[] = [
  // Transform-into-planeswalker: draw him, afford {1}{U}, resolve, then roll
  // the one manual tool in nine that flips — the rarest event in the gate.
  { names: ["Jace, Vryn's Prodigy // Jace, Telepath Unbound"], copiesPerSeat: 5,
    counterKeys: ['transformedIntoPlaneswalker'], rotHistory: 'D108 D177' },
  // The ONLY source either optional counter reads.
  { names: ["Ajani's Mantra"], copiesPerSeat: 5,
    counterKeys: ['optionalTaken', 'optionalDeclined'], rotHistory: 'D128 D178' },
  // The layer-6 ordering pair — a grant against a removal (CR 613.7).
  { names: ['Levitation', 'Gravity Sphere'], copiesPerSeat: 5,
    counterKeys: ['layer6Sources'], rotHistory: 'D129 D149 D173' },
  // The CR 616 pair — rots QUADRATICALLY (both must share a battlefield);
  // D180's comment demanded this table if it rotted a third time.
  { names: ['Hardened Scales', 'Branching Evolution'], copiesPerSeat: 15,
    counterKeys: ['replacementChoices'], rotHistory: 'D148 D149 D164 D180' },
  // The only trigger that LOOKS BACK (CR 603.10a) — a dies trigger that
  // never fires leaves no trace at all.
  { names: ['Onulet'], copiesPerSeat: 5,
    counterKeys: ['diesTriggers'], rotHistory: 'D158 D175' },
  // The only permanents in Magic that ARRIVE with counters (CR 306.5b/310.6).
  { names: ['Grist, the Hunger Tide', 'Invasion of Gobakhan // Lightshield Array'],
    copiesPerSeat: 1, counterKeys: ['enteredWithCounters'], rotHistory: 'D107 D176' },
  // CR 614.1c and D135's conditions — the unconditional tap, the count and
  // the type check, from both sides as a real board fills up.
  { names: ['Orzhov Guildgate', 'Haunted Ridge', 'Sunpetal Grove'], copiesPerSeat: 1,
    counterKeys: ['enteredTapped'], rotHistory: 'D134 D135' },
  // The enters-choice prompt, BOTH answers — The Black Gate pays THREE, so a
  // cost hardcoded to 2 cannot pass.
  { names: ['Godless Shrine', 'The Black Gate'], copiesPerSeat: 1,
    counterKeys: ['entersPaid', 'entersDeclined'], rotHistory: 'D136' },
  // D369 - the payment prompt, BOTH answers: a counter its target can buy off.
  { names: ['Mana Leak'], copiesPerSeat: 3,
    counterKeys: ['paymentsPaid', 'paymentsDeclined'], rotHistory: 'D369' },
  // The only route to `chooseFromZone` — a real cast at a real player.
  { names: ['Mind Rot'], copiesPerSeat: 1,
    counterKeys: ['discardsChosen', 'cardsDiscarded'], rotHistory: 'D137 D176' },
  // The scry prompt (D195) — a {U} cantrip the fuzzer can afford, whose
  // resolution stops and asks; the driver answers keep-all via
  // simplestAnswer's no-op scry.
  { names: ['Preordain'], copiesPerSeat: 1,
    counterKeys: ['scryChoices'], rotHistory: 'D195' },
  // D390 - the player queue (CR 101.4): a sacrifice every seat can cast and a discard aimed at
  // every opponent, whose resolutions ask the players in APNAP order and move every pick at once.
  { names: ['Innocent Blood', 'Unnerve'], copiesPerSeat: 1,
    counterKeys: ['queueAsks', 'queueBatches'], rotHistory: 'D390' },
  { names: ['Grim Affliction'], copiesPerSeat: 1,
    counterKeys: ['proliferateAsks', 'proliferations'], rotHistory: 'D391' },
  // D393 - threaten (CR 514.2): a {2}{R} sorcery every seat can cast whose control change ENDS,
  // so the cleanup revert is exercised at gate size.
  { names: ['Act of Treason'], copiesPerSeat: 1,
    counterKeys: ['controlTaken', 'controlReverted'], rotHistory: 'D393' },
  // D394 - the can't-block restriction (CR 509.1b with an END): a {R} instant every seat can cast
  // whose second sentence is the referent form, so the flag is set at gate size.
  { names: ['Mugging'], copiesPerSeat: 1,
    counterKeys: ['cantBlockSet'], rotHistory: 'D394' },
  // D399 - the can't-be-blocked evasion (CR 509.1b's other side, with an END): a {U} instant every
  // seat can aim at any creature, so the flag is set at gate size whether or not it then attacks.
  { names: ['Infiltrate'], copiesPerSeat: 1,
    counterKeys: ['cantBeBlockedSet'], rotHistory: 'D399' },
  // D402 - the delayed trigger (CR 603.7): a {1}{W} instant with no target whose draw waits for the
  // next turn's upkeep, so an arming and a fire are both reached at gate size without combat.
  { names: ['Blessed Wine'], copiesPerSeat: 1,
    counterKeys: ['delayedArmed', 'delayedFired'], rotHistory: 'D402' },
  // D403 - kicker (CR 702.33): Ardent Soldier ({1}{W} kicked for {2} - one coloured source and three
  // lands, which the core deals every seat) enters with a counter when kicked; the driver always
  // tries the kick. Goblin Bushwhacker ({R} + {R}) read ZERO kicked casts over 60 seeds: two red
  // sources at once are rare in a core with one basic of each colour, so it stays a plain deal.
  { names: ['Ardent Soldier'], copiesPerSeat: 2,
    counterKeys: ['kickedCasts', 'kickedEntries'], rotHistory: 'D403' },
  // D404 - the board-granted cost reduction: a {2} artifact making the seat's white spells cheaper,
  // and the core deals white spells every seat (Swords, Pacifism, Wrath, the Angel), so a cast
  // priced below its printed generic is reached at gate size.
  { names: ['Pearl Medallion'], copiesPerSeat: 1,
    counterKeys: ['reducedCasts'], rotHistory: 'D404' },
  // D405 - convoke and delve (CR 702.51 / 702.66): a {2}{G} pump every seat can aim at a creature and
  // pay by tapping its own (the driver ALWAYS pays with a payable pick; the core deals green creatures
  // every seat - Scatter the Seeds' {G}{G} read ZERO over 60 seeds, the second coloured symbol being the
  // wall D398 and D403 named, one Forest a seat), and a {5}{G} 4/4 whose
  // generic the seat's graveyard pays as the game fills it; the driver names the chooser's pick
  // when the mana falls short, as the bot does. Improvise (Bastion Inventor) is counted, no floor:
  // the seat's untapped artifacts are few and mostly tapped for mana already.
  { names: ["Pack's Favor", 'Hooting Mandrills'], copiesPerSeat: 1,
    counterKeys: ['convokedCasts', 'delvedCasts'], rotHistory: 'D405' },
  // D406 - the additional cost at cast: a {B} sorcery that sacrifices a creature and draws two, and a
  // {1}{R} sorcery that discards a card and draws two - one coloured source each, a creature or a hand
  // card every seat has; the driver names the first candidates the offer lists.
  { names: ['Village Rites', 'Tormenting Voice'], copiesPerSeat: 1,
    counterKeys: ['additionalCostCasts'], rotHistory: 'D406' },
  // D407 - the linked exile (CR 610.3): a {2}{W} enchantment every seat can cast at an opponent's
  // nonland permanent, whose exile ENDS when it leaves - Wrath, Swords and the wipes take it off the
  // battlefield at gate size, so the state-based return is reached too (counted, no floor).
  // Fairgrounds Warden ({2}{W}, a 1/3 that exiles a creature) dies to the core's Bolts, Wraths and combat, so
  // the RETURN is reached where the enchantment alone read two exiles and no return over 60 seeds.
  { names: ['Banishing Light', 'Fairgrounds Warden'], copiesPerSeat: 1,
    counterKeys: ['linkedExiles', 'linkedReturns'], rotHistory: 'D407' },
  // D408 - the alternative cost (CR 118.9): Daze returns an Island instead of paying {1}{U} and counters a
  // spell unless its controller pays {1} (a response window, an Island: 1 at 60 alone); Mistvein Borderpost pays
  // {1} and returns a basic land at sorcery speed; Snuff Out pays 4 life under a Swamp - the driver always elects
  // an available, affordable alternative.
  { names: ['Daze', 'Mistvein Borderpost', 'Snuff Out'], copiesPerSeat: 1,
    counterKeys: ['alternativeCasts'], rotHistory: 'D408' },
  // D409 - explore (CR 701.42): Merfolk Branchwalker explores as it enters - a {1}{G} 2/1 every seat can cast;
  // the driver keeps the revealed card on top (the scry answer it already gives).
  { names: ['Merfolk Branchwalker'], copiesPerSeat: 1,
    counterKeys: ['explores'], rotHistory: 'D409' },
  // D410 - typecycling (CR 702.29b): Ash Barrens' basic landcycling {1} searches the library for a basic,
  // which every seat's core holds; the driver cycles from the hand and answers the search.
  { names: ['Ash Barrens'], copiesPerSeat: 1,
    counterKeys: ['typecyclings'], rotHistory: 'D410' },
  // D411 - the untap skip: Thalakos Lowlands' coloured ability sets it whenever the payment taps it (the
  // plan taps charge the rider too); the untap step spends it a turn later.
  { names: ['Thalakos Lowlands'], copiesPerSeat: 1,
    counterKeys: ['untapSkips'], rotHistory: 'D411' },
  { names: ['Bastion Inventor'], copiesPerSeat: 1,
    counterKeys: ['improvisedCasts'], rotHistory: 'D405' },
  // D395 - the animate family: a colourless artifact every seat can animate for {2}, so a base P/T
  // set at layer 7b (and ended at cleanup) is exercised at gate size.
  { names: ['Guardian Idol'], copiesPerSeat: 1,
    counterKeys: ['animations'], rotHistory: 'D395' },
  // D396 - bite and fight (CR 701.12): a {G} fight and a {1}{G} bite every seat can cast, so the
  // two-operand resolution and its one DamageDealt are exercised at gate size.
  { names: ['Prey Upon', 'Rabid Bite'], copiesPerSeat: 1,
    counterKeys: ['fights', 'bites'], rotHistory: 'D396' },
  // D357 - the library search. A one-mana sorcery every seat can cast, whose resolution stops
  // and asks, and whose answer moves a card, taps it and shuffles - the three things the
  // prompt exists to drive.
  { names: ['Rampant Growth'], copiesPerSeat: 2,
    counterKeys: ['librarySearches'], rotHistory: 'D357' },
  // The modes prompt (D343) - a "choose one" instant whose two modes both
  // target (a flyer, an enchantment); offered only while a mode can be chosen,
  // answered by simplestAnswer's first-mode policy, then the aim.
  { names: ['Crushing Canopy'], copiesPerSeat: 1,
    counterKeys: ['modeChoices'], rotHistory: 'D343' },
  // The only TARGETED trigger — fires off Darksteel Citadel in FIXED_CORE.
  { names: ['Yotian Dissident'], copiesPerSeat: 1,
    counterKeys: ['triggerTargetsChosen'], rotHistory: 'D147' },
  // The rules-written token — its Soldier printing is pinned in TOKEN_TABLE.
  { names: ['Raise the Alarm'], copiesPerSeat: 1,
    counterKeys: ['tokensNamed'], rotHistory: 'D133' },
  // The counter EFFECT on both sides of the vocabulary boundary; Scar's
  // -1/-1 reaches lethality through layer 7d and the SBA.
  { names: ['Battlegrowth', 'Scar'], copiesPerSeat: 1,
    counterKeys: ['ptCountersWritten'], rotHistory: 'D130' },
  // The modal DFC — the face path and D134's rule on a back face at once.
  { names: ['Malakir Rebirth // Malakir Mire'], copiesPerSeat: 1,
    counterKeys: ['backFacesPlayed'], rotHistory: 'D155' },
  // D364 - the SNOW SOURCE. `poolSnow` is in the state hash, so without a snow
  // permanent in the pool 500 seeds of equal replay hashes would prove nothing about
  // it: every pool would hold zero snow mana and the field would replay perfectly
  // because it never moved. Two per seat, because a land is only useful once tapped.
  { names: ['Snow-Covered Forest'], copiesPerSeat: 2,
    counterKeys: ['snowManaMade'], rotHistory: 'D364' },
  // D397 - the SPEND-RESTRICTED SOURCE. `poolRestricted` is in the state hash, so without a
  // restricted source in the pool 500 seeds of equal replay hashes would prove nothing about
  // it. Ancient Ziggurat makes any colour that may pay for a CREATURE SPELL only; the solver
  // funds a creature from it and withholds it from everything else. Two per seat, because a
  // land is only useful once tapped and a creature is only cast once affordable.
  { names: ['Ancient Ziggurat'], copiesPerSeat: 2,
    counterKeys: ['restrictedManaMade', 'restrictedManaSpent'], rotHistory: 'D397' },
  // D398 - THIS-TURN CONDITIONS on a replacement and on a trigger. `turn.memory` is in the state
  // hash and the reducer fills it in every game, so equal hashes vouch for the RECORD and not
  // for a def ever reading it. A condition is reachable by this driver only when a staple
  // satisfies it at the START of the caster's turn: the driver declares 97 real attacks against
  // 2,948 empty ones in 60 seeds (a random subset over every untapped permanent, refused whole
  // when one pick is illegal), so Raid and every combat-borne condition sit at zero over 500
  // seeds - measured, gate 398's first run. Drana's Emissary drains each opponent at its
  // controller's upkeep, which makes Cindering Cutthroat's `an opponent lost life this turn`
  // hold for that whole turn; Ajani's Mantra's upkeep gain does the same for Courier Bat's
  // `you gained life this turn`. Four each; the floor is over the union of the two counters.
  { names: ['Cindering Cutthroat', "Drana's Emissary", 'Courier Bat'], copiesPerSeat: 4,
    counterKeys: ['thisTurnEntersWith', 'thisTurnTriggers'], rotHistory: 'D398' },
  // D372 - the GRANTED MANA ABILITY: a production a layer-6 static pushed onto a recipient
  // that prints none. Cryptolith Rite makes every creature its controller has a source, so
  // the solver auto-taps granted mana whenever a creature stands and a spell is cast.
  { names: ['Cryptolith Rite'], copiesPerSeat: 2,
    counterKeys: ['grantedManaMade'], rotHistory: 'D372' },
  // D373 - the SELF-AIMED effect: a granted body about the RECIPIENT ITSELF. Barbed Sliver is a
  // Sliver creature granting "{2}: This creature gets +1/+0" to all Sliver creatures, so it is
  // inside its OWN scope and can pump ITSELF with no second Sliver on the board - which is what
  // makes the canary self-sufficient at any pool size.
  { names: ['Barbed Sliver'], copiesPerSeat: 2,
    counterKeys: ['selfAimedResolved'], rotHistory: 'D373' },
  // D382 - THE PREVENTION SHIELD (CR 615). `preventionShields` IS part of `GameState` and so of
  // the state hash, but 500 seeds of equal hashes prove nothing while every game's list is empty
  // (D128's green tick over nothing, D364's own warning), so a source of shields is dealt to
  // every seat. Fog is the self-sufficient one: {G}, no target to find, and its shield is
  // COMBAT-wide, so the fuzzer's own attacks spend it without having to aim anything.
  { names: ['Fog'], copiesPerSeat: 5,
    counterKeys: ['preventionShields', 'damagePrevented'], rotHistory: 'D382' },
  // D385 - THE CONTINUOUS PREVENTION EFFECT (CR 615), a `PreventionDef` on a battlefield
  // permanent. Nothing on the state moves for it (a static spends nothing), so the replay hash
  // cannot vouch for it at all (D364) and only the log can.
  // ⚠️⚠️ THE FIRST STAPLE HERE WAS `Fog Bank` AND IT HAD NO FUEL, which this canary's own floor
  // caught at ZERO over 500 seeds. Fog Bank is a 0/2 DEFENDER: it cannot attack, and the only
  // combat damage it could take or deal is in a BLOCK - and `declareBlockers` above answers
  // `blocks: []`, so THE FUZZ DRIVER HAS NEVER BLOCKED, IN THIS WHOLE ARC. A staple's fuel is a
  // claim about what the DRIVER produces, never about what the card does (D193); the comment that
  // shipped with it said "the fuzzer's own attacks run into it", which was an assumption about
  // the driver that nothing had checked.
  // These three are fuelled by damage the driver demonstrably deals: Statecraft absorbs the
  // combat damage my own UNBLOCKED attackers deal to a player (the same damage Fog's shield is
  // measured spending), and Bubble Matrix and Mark of Asylum absorb the noncombat pings the
  // rotating pool's damage rows aim at creatures. Three cards, three fuels, one counter -
  // D149's CR 616 pair one card wider.
  { names: ['Statecraft', 'Bubble Matrix', 'Mark of Asylum'], copiesPerSeat: 2,
    counterKeys: ['staticDamagePrevented'], rotHistory: 'D385' },
  // D377 - THE MOVE'S REASON. `reason` never reaches `GameState` (the reducer reads the moves and
  // moves the cards), so unlike D364's `poolSnow` the replay hash cannot vouch for it at all: what
  // these three prove is that REAL GAMES produce the three reasons a printed head watches for,
  // where `moveReason.test.ts` proves each emitter on a staged board. One staple per verb, each
  // self-sufficient: Bile Urchin sacrifices ITSELF for free, Rummaging Goblin's own cost is the
  // discard, and Lonely Sandbar cycles from hand with no board at all.
  { names: ['Bile Urchin'], copiesPerSeat: 2,
    counterKeys: ['sacrificesRecorded'], rotHistory: 'D377' },
  { names: ['Rummaging Goblin'], copiesPerSeat: 2,
    counterKeys: ['discardsRecorded'], rotHistory: 'D377' },
  { names: ['Lonely Sandbar'], copiesPerSeat: 2,
    counterKeys: ['cyclingsRecorded'], rotHistory: 'D377' },
];

/** What every seat is GUARANTEED to hold of the staples, weights applied. */
const STAPLE_DEAL: readonly string[] = CANARY_STAPLES.flatMap((s) =>
  s.names.flatMap((n) => Array<string>(s.copiesPerSeat).fill(n)),
);
const STAPLE_NAMES: ReadonlySet<string> = new Set(CANARY_STAPLES.flatMap((s) => s.names));

/**
 * The unweighted half of every pool: basics, mana rocks, real creatures and
 * spells so the fuzzer meets real decisions, the mechanism cards whose paths
 * the gate exists to reach, and the support bodies shipped watchers need.
 * ⚠️ A CARD MISSING FROM THE POOLS IS A CODE PATH THIS GATE CANNOT REACH
 * (D102, D107, D108, D121). Weighted canary fuel lives in CANARY_STAPLES,
 * never here — an inline weight is the rot shape D193 ended.
 */
const FIXED_CORE = [
  'Forest', 'Island', 'Mountain', 'Plains', 'Swamp',
  'Command Tower', 'Sol Ring', 'Arcane Signet', 'Tundra', 'Boros Garrison',
  'Llanowar Elves', 'Birds of Paradise', 'Grizzly Bears', 'Serra Angel',
  'Giant Spider', 'Colossal Dreadmaw', 'Vampire Nighthawk', 'Typhoid Rats',
  'White Knight', 'Boros Swiftblade', 'Boggart Brute', 'Wall of Omens',
  'Raging Goblin', 'Child of Night', 'Ambush Viper', 'Baleful Strix',
  'Lightning Bolt', 'Counterspell', 'Cultivate', 'Swords to Plowshares',
  'Pacifism', 'Wrath of God', 'Brainstorm', 'Dark Ritual', 'Lightning Greaves',
  // M6.1 (D121): a land creature, an artifact land, a pump spell, and six
  // enforced keywords plus protection on one body.
  'Dryad Arbor', 'Darksteel Citadel', 'Monstrous Growth', 'Akroma, Angel of Wrath',
  // M6.3c (D130): the permanent side of the counter effect, no vocabulary.
  "Ajani's Pridemate",
  // M6.3j (D137): the card that must NOT resolve by itself ("at random").
  'Hymn to Tourach',
  // M6.3v (D149): the CR 613.8 dependency pair — Kwende reads a keyword
  // Knighthood grants, the only observable dependency in this vocabulary.
  'Knighthood', 'Kwende, Pride of Femeref',
  // SUPPORT BODIES for shipped watchers — not scripts themselves; a shipped
  // filter needs something real to catch, and the derivation cannot know
  // that (Tuinvale is engine-complete through the VOCABULARY, so it is not
  // in SHIPPED_SCRIPTS at all).
  'Duskwatch Recruiter // Krallenhorde Howler', 'Walking Corpse',
  'Merfolk of the Pearl Trident', 'Tuinvale Treefolk // Oaken Boon',
];

/**
 * ⚠️⚠️ **ROTATING PER-SEED POOLS (D193).** The one DECK that dealt every
 * shipped name to every seat made `checkInvariants` walk 4×|DECK| card
 * instances per accepted intent — the measured wall (D167/D181: the bus is
 * at the floor; the cost is the games and the walk). Every seat now holds
 * FIXED_CORE, the full staples deal, and a round-robin WINDOW of the
 * scripted names — per-seed libraries shrink from ~600 to ~150 while the
 * RUN still covers every shipped script many times over.
 *
 * The pool-membership invariant becomes three checked layers:
 *   L1 — the set-math theorem below: the union of every seed's windows
 *        covers every scripted name with multiplicity ≥ 2, at BOTH sizes;
 *   L2 — the aggregate counters the gate already asserts;
 *   L3 — the staples, in every pool by construction.
 *
 * ⚠️ PURE in (seed, seat, canonical sorted list) — registration order must
 * never decide a shuffle (D129 one seam over), and the same seed must deal
 * the same pool forever or replay breaks.
 */
const CORE_NAMES: ReadonlySet<string> = new Set([...FIXED_CORE, ...STAPLE_NAMES]);
const SCRIPTED_SORTED: readonly string[] = SHIPPED_SCRIPTS.map((s) => s.name)
  .filter((n) => !CORE_NAMES.has(n))
  .sort();
/**
 * Rotating slots per seat, DERIVED so the L1 theorem cannot rot.
 *
 * A run deals `SEEDS × 4 × STRIDE` slots over `SCRIPTED_SORTED`, and L1 needs
 * every scripted name in at least TWO of them. A hardcoded 40 dealt 9,600 slots
 * at the smallest leg the gate runs, and D365 took the list to 4,810 names -
 * needing 9,620. The gate named the shortfall exactly: the last twenty names,
 * dealt once each.
 *
 * ⚠️ Bumping the number would buy a handful of decisions and rot again, which is
 * the rate-canary rot class D193 ended for the staples. Derived from the list it
 * depends on, it grows on its own - about one slot per 120 scripts.
 *
 * ⚠️ From a CONSTANT seed count, never the RUNNING one: a stride that moved with
 * `CRT_FUZZ_SEEDS` would make the same seed deal different pools at different
 * sizes, and "the same seed deals the same pool forever" is what replay rests on.
 */
const L1_MIN_SEEDS = 60;
const STRIDE = Math.max(40, Math.ceil((2 * SCRIPTED_SORTED.length) / (L1_MIN_SEEDS * 4)));

function poolFor(seed: number, seat: number): readonly string[] {
  const rotating: string[] = [];
  if (SCRIPTED_SORTED.length > 0) {
    const offset = (seed * 4 + seat) * STRIDE;
    for (let k = 0; k < STRIDE; k++) {
      rotating.push(SCRIPTED_SORTED[(offset + k) % SCRIPTED_SORTED.length] as string);
    }
  }
  return [...FIXED_CORE, ...STAPLE_DEAL, ...rotating];
}

/**
 * ⚠️ THE FIRST NON-EMPTY REGISTRY THIS GATE HAS EVER RUN, and it is what makes
 * the `optionalTrigger` prompt reachable at all: the prompt is raised only when
 * a `TriggerDef` says `optional`, and a `TriggerDef` only exists if something
 * registered one. A card in `DECK` with no script here would be a code path the
 * gate still could not reach — the failure D102, D107, D108 and D121 all record,
 * with an extra step.
 *
 * ⚠️ Since M6.4a this holds BOTH kinds: the testing scripts that exist to reach
 * engine seams (`Ajani's Mantra` for the optional prompt, the layer pairs), and
 * every SHIPPED script — because a shipped card missing from this registry is a
 * code path the gate cannot reach, which is the failure D102, D107, D108 and
 * D121 all record. The guard below asserts the shipped half mechanically.
 */
const SCRIPTS = createRegistry([
  // The TESTING scripts that exist to reach engine seams no shipped card
  // covers yet: the optional-trigger prompt, the layer-6 ordering pair, the
  // CR 616 replacement pair, and the CR 613.8 dependency pair. `Humility`
  // stays out — it is the teeth below.
  AJANIS_MANTRA,
  // ⚠️ `Ajani's Pridemate` SHIPS since D303 (`cards/ajanisPridemate`, a derived
  // counter row under the you-gain-life head) - the testing copy that stood in
  // for it here (D130) would be the duplicate the throw below refuses.
  // ⚠️ `Levitation` SHIPS since D300 (`cards/levitation`, a derived static row) -
  // the testing copy would be the duplicate the throw below refuses; the pair
  // with Gravity Sphere still orders the same grant on the same layer.
  GRAVITY_SPHERE_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  // ⚠️ `Knighthood` SHIPS since D300 (`cards/knighthood`, a derived static row) -
  // the testing copy that stood in for it here would be the duplicate the
  // throw below refuses. Kwende still reads the same grant off the same layer.
  KWENDE_SCRIPT,
  // ⚠️ Every shipped script, BY CONSTRUCTION — the registered-here half of
  // the guard below is now impossible to forget. The duplicate-oracleId
  // throw in `createRegistry` keeps this spread honest: a testing copy of a
  // shipped card would fail construction loudly instead of double-firing.
  ...SHIPPED_SCRIPTS,
]);

/** The two layer-6 sources, for the canary that says `applyStatics` ran. */
const LAYER6_ORACLES = new Set([LEVITATION_SCRIPT.oracleId, GRAVITY_SPHERE_SCRIPT.oracleId]);

/**
 * Every shipped `ActivatedDef` ref, for the canary that says the D159 seam ran
 * HERE — an ability charged by the engine and resolved by a script, in a real
 * fuzzed game rather than only in a unit test.
 */
const ACTIVATED_REFS = new Set(
  // ⚠️ DERIVED from every shipped script (D188) — the hand list of four it
  // replaces was the canary-rot shape one counter over: a batch landing new
  // ActivatedDefs widened the real population while the counter watched the
  // original four forever.
  SHIPPED_SCRIPTS.flatMap((s) => (s.activated ?? []).map((d) => d.ref)),
);

interface Picker {
  rng: RngState;
  below(n: number): number;
  pick<T>(xs: readonly T[]): T | undefined;
}

function picker(seed: string): Picker {
  const self: Picker = {
    rng: seedRng(seed),
    below(n: number) {
      const d = nextBelow(self.rng, Math.max(1, n));
      self.rng = d.next;
      return d.value;
    },
    pick<T>(xs: readonly T[]): T | undefined {
      if (xs.length === 0) return undefined;
      return xs[self.below(xs.length)];
    },
  };
  return self;
}

/** A Tier-3 tool, chosen 5% of the time — manual play must replay too. */
function manualIntentFor(state: GameState, p: Picker): Intent | null {
  const players = state.seating.filter((id) => !(state.players[id]?.hasLost ?? true));
  const player = p.pick(players);
  if (!player) return null;
  const battlefield = state.zones.battlefield;
  const anyCard = p.pick([...battlefield, ...(state.zones.hand[player] ?? [])]);
  switch (p.below(13)) {
    case 0:
      return { t: 'ManualSetLife', player, target: p.pick(players) ?? player, delta: p.below(7) - 3 };
    case 1:
      return anyCard
        ? { t: 'ManualSetCounter', player, card: anyCard, kind: '+1/+1', delta: 1 }
        : null;
    case 2:
      return { t: 'ManualAddMana', player, target: player, symbol: 'C', amount: 1 };
    case 3:
      return anyCard ? { t: 'ManualSetTapped', player, cards: [anyCard], tapped: true } : null;
    case 4:
      return { t: 'RollDice', player, sides: 6 };
    case 5:
      return { t: 'FlipCoin', player };
    case 6:
      return { t: 'ManualDraw', player, target: player, count: 1 };
    case 7:
      return anyCard
        ? {
            t: 'ManualMoveCard',
            player,
            card: anyCard,
            to: { kind: 'graveyard', player: state.cards[anyCard]?.owner ?? player },
          }
        : null;
    case 8: {
      // ⚠️ AIMED, not drawn from `anyCard` like its siblings. A flip picked out
      // of every card on the board and in a hand would land on the one card with
      // a second face a handful of times in 100,000 intents, and a canary that
      // fires by luck is the rot it exists to catch (D102) with an extra step.
      // Battlefield only, because that is the only place a transform can write a
      // loyalty counter — the `zone` guard in D108's rule is what the `in a hand`
      // case in `sba.test.ts` pins, and it does not need a fuzz seed too.
      const twoFaced = battlefield.filter((id) => {
        const c = state.cards[id];
        return c ? (ORACLE.byPrinting(c.printingId)?.faces.length ?? 1) > 1 : false;
      });
      const target = p.pick(twoFaced);
      // ⚠️ AND IT MUST NOT RETURN NULL. `runOne` reads a null intent as "this
      // game has nothing left to do" and BREAKS out of the seed, so a manual
      // case that usually has nothing to act on does not skip a beat — it ends
      // the run. Aiming the flip made "usually" the common case, and the first
      // cut cost 37% of the gate's accepted intents (11,883 → 7,434 at 60 seeds)
      // and a third of its turns. That reads as a slower engine, not as a
      // fuzzer that stopped playing. The dice are the one sibling that needs
      // nothing from the board.
      if (!target) return { t: 'RollDice', player, sides: 6 };
      return { t: 'ManualFlipFace', player, card: target };
    }
    // ── The library tools ─────────────────────────────────────────────────
    //
    // ⚠️ These three arrived together and the leak test below is why they had
    // to reach the fuzzer at all: it asserts that NO library card appears in
    // any projection, which was only true because nothing in this file had
    // ever peeked. An assertion that holds because the path is unreachable is
    // the rot D102 and D108 both name — so the fuzzer peeks now, and the leak
    // test asserts the real boundary instead.
    case 9:
      return { t: 'ManualPeekLibrary', player, count: 1 + p.below(3) };
    case 10:
      return { t: 'ManualStopPeeking', player };
    case 11:
      return {
        t: 'ManualMoveTopOfLibrary',
        player,
        target: p.pick(players) ?? player,
        count: 1 + p.below(3),
        to: p.below(2) === 0 ? 'graveyard' : 'exile',
      };
    // ⚠️ It REJECTS on an empty pile, which is most of the time early on — and
    // that is fine, unlike returning null: a rejection is counted and the seed
    // plays on, where a null ends the run (D108).
    case 12:
      return {
        t: 'ManualMoveZone',
        player,
        target: p.pick(players) ?? player,
        from: p.below(2) === 0 ? 'graveyard' : 'exile',
        to: p.below(2) === 0 ? 'library' : 'exile',
        shuffle: p.below(2) === 0,
      };
    default:
      return null;
  }
}

/** Answer whatever prompt is up, choosing randomly among the legal answers. */
function answerFor(state: GameState, p: Picker): Intent | null {
  const awaiting = state.priority.awaiting;
  if (!awaiting) return null;
  switch (awaiting.kind) {
    case 'mulligan': {
      const player = p.pick(awaiting.players);
      if (!player) return null;
      return { t: 'MulliganDecision', player, keep: p.below(4) > 0 };
    }
    case 'mulliganBottom': {
      const hand = [...(state.zones.hand[awaiting.player] ?? [])];
      const picked = shuffle(p.rng, hand);
      p.rng = picked.next;
      return { t: 'MulliganBottom', player: awaiting.player, cards: picked.value.slice(0, awaiting.count) };
    }
    case 'declareAttackers': {
      const attackers = state.zones.battlefield.filter(
        (id) => state.cards[id]?.controller === awaiting.player && !state.cards[id]?.tapped,
      );
      const defenders = state.seating.filter(
        (id) => id !== awaiting.player && !(state.players[id]?.hasLost ?? true),
      );
      const defender = p.pick(defenders);
      if (!defender || attackers.length === 0 || p.below(2) === 0) {
        return { t: 'DeclareAttackers', player: awaiting.player, attackers: [] };
      }
      // Declare a random subset; the handler rejects anything illegal, which is
      // itself a thing worth exercising.
      const chosen = attackers.filter(() => p.below(2) === 0);
      return {
        t: 'DeclareAttackers',
        player: awaiting.player,
        attackers: chosen.map((card) => ({ card, defender: { kind: 'player' as const, id: defender } })),
      };
    }
    case 'declareBlockers': {
      const player = awaiting.players.find((x) => !awaiting.submitted.includes(x));
      if (!player) return null;
      return { t: 'DeclareBlockers', player, blocks: [] };
    }
    /**
     * ⚠️ ITS OWN RANDOMISED CASE rather than the `simplestAnswer` fallthrough,
     * for the same reason `mulligan` has one. `simplestAnswer` always DECLINES —
     * that is its stated policy and the right one for a driver that must never
     * run card text a test did not ask for — so falling through would leave the
     * ACCEPT half of this primitive, the half that runs a card script, untaken
     * in all 500 seeds while the gate stayed green. A coin flip reaches both,
     * and the two canaries below assert it did.
     */
    case 'optionalTrigger':
      return {
        t: 'AnswerOptionalTrigger',
        player: awaiting.player,
        stackId: awaiting.stackId,
        accept: p.below(2) === 0,
      };
    // D369 - a coin flip for the reason above: the paying half is the one that charges a
    // plan, and the prompt is raised only while the host can suggest one, so no plan rides.
    case 'payMana':
      return { t: 'AnswerPayMana', player: awaiting.player, pay: p.below(2) === 0 };
    /**
     * ⚠️ A COIN FLIP for the case above's reason, and here the declining half
     * is the one `simplestAnswer` would have left the gate stuck on: paying is
     * the answer that changes a life total, and a driver that never paid would
     * run 500 seeds without a single `LifeChanged` from this path while both
     * canaries stayed green on the taps alone.
     *
     * ⚠️ AND PAYING CAN BE REJECTED — `answerEntersChoice` re-checks the life
     * total — so the flip is guarded on what the player can afford. A rejected
     * intent is not a wedge here (`runOne` submits the next one), but it is a
     * seed that silently stopped testing the thing it was reached for.
     */
    /**
     * ⚠️ THE ONLY ANSWER IN THIS DRIVER THAT READS THE BOARD, because the
     * prompt ships no candidates (D137) — a hand is hidden, so listing it in an
     * `Awaiting` would post it to every client. The fuzzer picks RANDOMLY rather
     * than taking the first `count`, so the discard is not always the same
     * corner of the hand and a replay that depended on the order would diverge.
     */
    /**
     * D391 - proliferate: a RANDOM subset of what carries a counter, so both "something" and
     * "nothing" are reached and the counters that grow are not always the same corner of the
     * board. The harness chooses none; a gate that always did would never add a counter here.
     */
    case 'proliferateChoice': {
      const c = proliferateCandidates(state);
      return {
        t: 'AnswerProliferate',
        player: awaiting.player,
        permanents: c.permanents.filter(() => p.below(2) === 0),
        players: c.players.filter(() => p.below(2) === 0),
      };
    }
    case 'searchLibrary': {
      // ⚠️ FINDS SOMETHING WHENEVER IT CAN. Failing to find is legal and the harness does it, but
      // a gate that always declined would never move a card, never tap one and never shuffle -
      // and those are the three things this prompt exists to drive.
      const lib = state.zones.library[awaiting.player] ?? [];
      const legal = lib.filter((id) => {
        const inst = state.cards[id];
        if (!inst) return false;
        const printing = ORACLE.byPrinting(inst.printingId);
        if (!printing) return false;
        const f = faceOf(printing, 0);
        return awaiting.predicates.some(
          (p) =>
            p.supertypes.every((t) => f.typeLine.supertypes.includes(t)) &&
            p.types.every((t) => f.typeLine.types.includes(t)) &&
            p.subtypes.every((t) => f.typeLine.subtypes.includes(t)) &&
            p.colors.every((c) => f.colors.includes(c)),
        );
      });
      return { t: 'AnswerSearchLibrary', player: awaiting.player, cards: legal.slice(0, awaiting.count), declined: false };
    }
    case 'chooseFromZone': {
      // D389 - a LIBRARY look answers from the revealed run, through the look's own filter
      // (asked of the oracle face, D357), between the prompt's `min` and its count. A hand
      // discard is unchanged. An answer the handler would reject leaves the prompt up and spends
      // the rest of the seed on rejections, so the pool has to be the legal one.
      const pool =
        awaiting.zone === 'library'
          ? (state.zones.library[awaiting.player] ?? []).filter((id) => {
              const inst = state.cards[id];
              if (!inst || !inst.revealedTo.includes(awaiting.player)) return false;
              if (!awaiting.filter) return true;
              const face = ORACLE.byPrinting(inst.printingId)?.faces[0];
              return face ? predicateAdmits(face, awaiting.filter.predicates) : false;
            })
          : awaiting.zone === 'battlefield'
            ? state.zones.battlefield.filter((id) => {
                // D390 - a queued sacrifice: my own permanents the printed noun admits.
                const inst = state.cards[id];
                if (!inst || inst.controller !== awaiting.player) return false;
                if (!awaiting.filter) return true;
                const face = ORACLE.byPrinting(inst.printingId)?.faces[0];
                return face ? predicateAdmits(face, awaiting.filter.predicates) : false;
              })
            : [...(state.zones.hand[awaiting.player] ?? [])];
      const min = awaiting.min ?? awaiting.count;
      const most = Math.min(awaiting.count, pool.length);
      const want = most > min ? min + p.below(most - min + 1) : most;
      const picked: string[] = [];
      while (picked.length < want && pool.length > 0) {
        picked.push(...pool.splice(p.below(pool.length), 1));
      }
      return { t: 'AnswerChooseFromZone', player: awaiting.player, cards: picked };
    }
    case 'entersChoice': {
      const life = state.players[awaiting.player]?.life ?? 0;
      return {
        t: 'AnswerEntersChoice',
        player: awaiting.player,
        source: awaiting.source,
        pay: life >= awaiting.life && p.below(2) === 0,
      };
    }
    default:
      return simplestAnswer(awaiting, state);
  }
}

/**
 * D405 - what the driver taps or exiles for a cast the mana cannot pay: the chooser's pick over the
 * holder's untapped creatures (with their derived colours), untapped artifacts and graveyard cards,
 * against the offer's own problem (X at 0, the tax the offer priced). Null when the face has none, the
 * pick is empty, or no mana plan pays the remainder - a cast refused at its pay stage AFTER a targets
 * prompt would be answered forever (the harness's answer is not a cancel), so it is never started.
 */
function altPickFor(state: GameState, holder: PlayerId, action: Extract<LegalAction, { t: 'CastSpell' }>): { convoke?: readonly InstanceId[]; improvise?: readonly InstanceId[]; delve?: readonly InstanceId[] } | null {
  if (!(action.convoke || action.improvise || action.delve)) return null;
  const inst = state.cards[action.card];
  const printing = inst ? ORACLE.byPrinting(inst.printingId) : undefined;
  if (!inst || !printing) return null;
  const face = faceOf(printing, action.faceIndex);
  if (!face.manaCost) return null;
  const cache = makeDeriveCache(state);
  // D406 - the additional cost the same cast pays: its life, or its mana alternative when the picks fall short.
  const add = face.additionalCost;
  const picksShort = add !== null && Object.keys(castPicksOf(action)).length === 0 && (add.sacrificeCost || add.discardCost || add.tapCost || add.exileFromGraveyardCost || add.returnCost) !== null;
  const base = buildPaymentProblem(face.manaCost, 0, add && picksShort && add.orPay ? [add.orPay] : [], action.tax, add && !picksShort ? add.lifeCost : 0);
  const convoke: ConvokeCandidate[] = [];
  const improvise: InstanceId[] = [];
  for (const id of [...state.zones.battlefield].sort()) {
    const c = state.cards[id];
    if (!c || c.controller !== holder || c.tapped || c.faceDown) continue;
    const d = derive(state, ORACLE, SCRIPTS, id, cache);
    if (action.convoke && d.isCreature) convoke.push({ id, colors: d.colors });
    if (action.improvise && d.typeLine.types.includes('Artifact')) improvise.push(id);
  }
  const delve = action.delve ? [...(state.zones.graveyard[holder] ?? [])].sort() : [];
  const pick = chooseAlternatives(base, convoke, improvise, delve);
  if (pick.convoke.length + pick.improvise.length + pick.delve.length === 0) return null;
  const byId = new Map(convoke.map((c) => [c.id, c]));
  const assigned = assignAlternativePayment(base, pick.convoke.map((id) => byId.get(id) ?? { id, colors: [] }), pick.improvise.length, pick.delve.length);
  if (assigned.failed) return null;
  const solve = solveInputFor(state, ORACLE, SCRIPTS, holder, cache);
  const gone = new Set<InstanceId>([...pick.convoke, ...pick.improvise]);
  const plan = suggestPayment({ ...solve, sources: solve.sources.filter((s) => !gone.has(s.card)) }, applyAlternativePayment(base, assigned.paid), spellPurpose(face, false));
  if (!plan) return null;
  return {
    ...(pick.convoke.length > 0 ? { convoke: pick.convoke } : {}),
    ...(pick.improvise.length > 0 ? { improvise: pick.improvise } : {}),
    ...(pick.delve.length > 0 ? { delve: pick.delve } : {}),
  };
}

/** D406 - the picks a cast's additional cost takes: the first candidates the offer lists, exactly the count. */
function castPicksOf(action: Extract<LegalAction, { t: 'CastSpell' }>): { sacrifice?: readonly InstanceId[]; discard?: readonly InstanceId[]; tap?: readonly InstanceId[]; exileFromGraveyard?: readonly InstanceId[]; returnToHand?: readonly InstanceId[] } {
  const first = (ids: readonly InstanceId[] | undefined, n: number | undefined): readonly InstanceId[] | null => (ids && n !== undefined && ids.length >= n ? ids.slice(0, n) : null);
  const sacrifice = first(action.sacrificeCandidates, action.sacrificeCount);
  if (sacrifice) return { sacrifice };
  const discard = first(action.discardCandidates, action.discardCount);
  if (discard) return { discard };
  const tap = first(action.tapCandidates, action.tapCount);
  if (tap) return { tap };
  const exileFromGraveyard = first(action.exileFromGraveyardCandidates, action.exileFromGraveyardCount);
  if (exileFromGraveyard) return { exileFromGraveyard };
  const returnToHand = first(action.returnCandidates, action.returnCount);
  if (returnToHand) return { returnToHand };
  return {};
}

function nextIntent(state: GameState, p: Picker): Intent | null {
  if (state.gamePhase === 'finished') return null;
  if (state.priority.awaiting) return answerFor(state, p);
  if (p.below(20) === 0) return manualIntentFor(state, p);
  const holder = state.priority.player;
  if (!holder) return null;
  const actions = legalActions(state, ORACLE, SCRIPTS, holder);
  // D405 - a cast the mana cannot pay stays usable when the face has convoke / improvise / delve: the
  // driver names the chooser's pick and the host refuses what still falls short (a rejection, not a wedge).
  const picks = new Map<string, ReturnType<typeof altPickFor>>();
  const altFor = (a: Extract<LegalAction, { t: 'CastSpell' }>): ReturnType<typeof altPickFor> => {
    if (!picks.has(a.card)) picks.set(a.card, altPickFor(state, holder, a));
    return picks.get(a.card) ?? null;
  };
  const usable = actions.filter((a) => (a.t !== 'CastSpell' && a.t !== 'TurnFaceUp') || a.affordable || (a.t === 'CastSpell' && (altFor(a) !== null || (a.alternativeAvailable === true && a.alternativeAffordable === true))));
  const chosen = p.pick(usable);
  if (!chosen) return { t: 'PassPriority', player: holder };
  switch (chosen.t) {
    case 'PlayLand':
      // ⚠️ THE FACE THE OFFER NAMES. Taking face 0 here is exactly the bug
      // D155 fixed one layer up, and it would leave the gate unable to reach a
      // modal DFC's land half however many were dealt.
      return { t: 'PlayLand', player: holder, card: chosen.card, faceIndex: chosen.faceIndex };
    case 'CastSpell':
      // D309 - a face-down (morph) offer is cast face down, for {3}.
      // D403 - a kicker is ALWAYS tried kicked (a cast the pool cannot pay is rejected, not a wedge, and
      // the driver's next pick may cast it plain): half the time read ZERO over 60 seeds - a second
      // coloured source beside the first is rare in a core that deals one basic of each colour.
      // D405 - convoke / improvise / delve are ALWAYS paid with when a payable pick exists (the kicker's
      // rule): the mana falling short reached a pick eight times in twenty seeds, and the pick is checked
      // for a plan before the cast starts, so nothing here can wedge.
      // D406 - the additional cost's picks: the first candidates the offer lists (an offer whose candidates
      // fall short is not made unless `or pay {M}` stands in, and then no pick is named).
      // D408 - an available, affordable ALTERNATIVE cost is ALWAYS elected (the kicker's rule), its pick the first
      // candidates the offer lists; the picks then pay it and no additional-cost verb prints beside one.
      if (chosen.alternativeAvailable && chosen.alternativeAffordable) {
        const n = chosen.altPickCount ?? 0;
        const picked = (chosen.altPickCandidates ?? []).slice(0, n);
        const verb = chosen.altPickVerb;
        const altPicks = verb === undefined || n === 0 ? {} : verb === 'sacrifice' ? { sacrifice: picked } : verb === 'discard' ? { discard: picked } : verb === 'tap' ? { tap: picked } : verb === 'exileFromGraveyard' ? { exileFromGraveyard: picked } : verb === 'returnToHand' ? { returnToHand: picked } : { exileFromHand: picked };
        return { t: 'CastSpell', player: holder, card: chosen.card, ...(chosen.kicker ? { kicked: 1 } : {}), alternative: true, ...altPicks };
      }
      return { t: 'CastSpell', player: holder, card: chosen.card, ...(chosen.faceDown ? { faceDown: true } : {}), ...(chosen.kicker ? { kicked: 1 } : {}), ...(altFor(chosen) ?? {}), ...castPicksOf(chosen) };
    case 'TurnFaceUp':
      // D309 - the special action: pay the morph cost, turn it face up.
      return { t: 'TurnFaceUp', player: holder, card: chosen.card };
    case 'TapForMana':
      return {
        t: 'TapForMana',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
        outputChoice: p.below(Math.max(1, chosen.outputs.length)),
      };
    case 'PassPriority':
      return { t: 'PassPriority', player: holder };
    case 'ActivateAbility': {
      // ⚠️ D168: a sacrifice-cost ability arrives with its legal candidates on
      // the offer, and the intent must NAME one or the host rejects it — pick
      // at random so the chooser is exercised across the gate's games.
      const sacs = chosen.sacrificeCandidates;
      // D286: a discard- or tap-cost ability arrives with its candidates and
      // its count; pick that many at random the same way.
      const pickN = <T>(pool: readonly T[] | undefined, n: number | undefined): readonly T[] | undefined => {
        if (!pool || n === undefined || pool.length < n) return undefined;
        const left = [...pool];
        const out: T[] = [];
        while (out.length < n) out.push(left.splice(p.below(left.length), 1)[0] as T);
        return out;
      };
      const discards = pickN(chosen.discardCandidates, chosen.discardCount);
      // D311 - a crew offer names the power to reach: tap every candidate
      // (any number is legal), the count-shaped costs pick exactly N.
      const taps = chosen.tapPower !== undefined ? [...(chosen.tapCandidates ?? [])] : pickN(chosen.tapCandidates, chosen.tapCount);
      // D352 - the return chooser: exactly N permanents you control, the same way.
      const returns = pickN(chosen.returnCandidates, chosen.returnCount);
      // D353 - the sacrifice chooser counts now: exactly N distinct candidates.
      const sac = pickN(sacs, chosen.sacrificeCount);
      // D363 - the remove-counter chooser. ⚠️ Its picks are a MULTISET, so `pickN`
      // (which draws WITHOUT replacement) is the wrong shape: a board with one
      // creature carrying two counters legally pays a count of two, and drawing
      // without replacement would call that unpayable and never exercise it.
      const removeCounters = ((): readonly string[] | undefined => {
        const pool = chosen.removeCounterCandidates;
        const want = chosen.removeCounterCount;
        const kind = chosen.removeCounterKind;
        if (!pool || want === undefined || kind === undefined) return undefined;
        const left = new Map<string, number>();
        for (const id of pool) left.set(id, state.cards[id]?.counters[kind] ?? 0);
        const out: string[] = [];
        while (out.length < want) {
          const able = [...left].filter(([, n]) => n > 0);
          if (able.length === 0) return undefined;
          const [id, n] = able[p.below(able.length)] as [string, number];
          left.set(id, n - 1);
          out.push(id);
        }
        return out;
      })();
      return {
        t: 'ActivateAbility',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
        // D367 - a granted ability carries its ref on the offer; the intent carries it back.
        ...(chosen.grantRef !== undefined ? { grantRef: chosen.grantRef } : {}),
        ...(sac !== undefined ? { sacrifice: sac } : {}),
        ...(discards !== undefined ? { discard: discards } : {}),
        ...(taps !== undefined ? { tap: taps } : {}),
        ...(returns !== undefined ? { returnToHand: returns } : {}),
        ...(removeCounters !== undefined ? { removeCounter: removeCounters } : {}),
      };
    }
  }
}

interface Run {
  readonly seed: number;
  readonly intents: number;
  readonly accepted: number;
  readonly events: number;
  readonly turns: number;
  readonly finished: boolean;
  readonly targetPrompts: number;
  readonly targetsChosen: number;
  /** Permanents that entered carrying loyalty or defense counters. */
  readonly enteredWithCounters: number;
  /** Permanents that BECAME a planeswalker and were given its loyalty. */
  readonly transformedIntoPlaneswalker: number;
  readonly peeked: number;
  /** Triggered abilities put on the stack — zero for the whole of M3–M6.2. */
  readonly triggersFired: number;
  readonly activatedRun: number;
  readonly optionalTaken: number;
  readonly optionalDeclined: number;
  /** Layer-6 sources that reached a battlefield — `applyStatics` had live work. */
  readonly layer6Sources: number;
  /** `+1/+1`/`-1/-1` counters written by a SPELL or a SCRIPT, never by a tool. */
  readonly ptCountersWritten: number;
  /** Tokens created by the RULES — every one before M6.3f came from a tool. */
  readonly tokensCreated: number;
  /** …and how many of them the oracle could actually name. */
  readonly tokensNamed: number;
  /** Permanents that arrived TAPPED because their own text says so (CR 614.1c). */
  readonly enteredTapped: number;
  readonly entersPaid: number;
  readonly entersDeclined: number;
  readonly paymentsPaid: number;
  readonly paymentsDeclined: number;
  readonly discardsChosen: number;
  readonly cardsDiscarded: number;
  readonly triggerTargetsChosen: number;
  readonly triggersFizzled: number;
  readonly diesTriggers: number;
  readonly replacementChoices: number;
  /** Scry/surveil prompts raised by a resolving effect (D195). */
  readonly scryChoices: number;
  /** D390 - player queues raised (a resolution that had to ask several players) and completed. */
  readonly queueAsks: number;
  readonly queueBatches: number;
  /** D391 - proliferate prompts raised, and answers that chose at least one thing. */
  readonly proliferateAsks: number;
  readonly proliferations: number;
  readonly controlTaken: number;
  readonly controlReverted: number;
  readonly cantBlockSet: number;
  /** D399 - until-end-of-turn entries carrying the can't-be-blocked evasion. */
  readonly cantBeBlockedSet: number;
  /** D402 - delayed triggers armed by a resolution, and fired at their step. */
  readonly delayedArmed: number;
  readonly delayedFired: number;
  /** D403 - spells cast kicked, and permanents that entered kicked (the move carries the count). */
  readonly kickedCasts: number;
  readonly kickedEntries: number;
  /** D404 - non-commander casts priced below their printed generic by a board-granted reduction. */
  readonly reducedCasts: number;
  /** D406 - casts that paid an additional cost (a chooser verb's picks, a life payment, or the mana alternative). */
  readonly additionalCostCasts: number;
  /** D408 - casts that elected an alternative cost (the stack object's `alternativePaid`). */
  readonly alternativeCasts: number;
  /** D409 - permanents that explored (the `Explored` marker, CR 701.42c). */
  readonly explores: number;
  /** D410 - cycling discards whose card carries a TYPED cycling (the search, not the draw). */
  readonly typecyclings: number;
  /** D411 - untap skips SET (an effect's, or a depletion land's rider); the untap step spends them a turn later. */
  readonly untapSkips: number;
  /** D407 - exiles linked to a permanent (the move carries `until`), and the state-based returns that ended them. */
  readonly linkedExiles: number;
  readonly linkedReturns: number;
  /** D405 - casts paid in part by convoke, by improvise, by delve (the stack object's counts). */
  readonly convokedCasts: number;
  readonly improvisedCasts: number;
  readonly delvedCasts: number;
  readonly animations: number;
  readonly fights: number;
  readonly bites: number;
  readonly snowManaMade: number;
  /** D397 - mana made under a SPEND RESTRICTION, and spends that drew on a restricted bucket. */
  readonly restrictedManaMade: number;
  readonly restrictedManaSpent: number;
  /** D398 - an enters-with replacement whose this-turn condition was MET, and a trigger whose was. */
  readonly thisTurnEntersWith: number;
  readonly thisTurnTriggers: number;
  /** D372 - mana made by a permanent that PRINTS no mana ability (a granted one). */
  readonly grantedManaMade: number;
  /** D373 - a granted ability's payload that landed on its own SOURCE (the recipient). */
  readonly selfAimedResolved: number;
  /** D382 - CR 615: shields put up, and damage a shield actually stopped. */
  readonly preventionShields: number;
  readonly damagePrevented: number;
  /** D385 - CR 615: damage a CONTINUOUS prevention ability (a `PreventionDef`) absorbed. */
  readonly staticDamagePrevented: number;
  /** D377 - moves the rules recorded a reason on: a sacrifice, a discard, a cycling discard. */
  readonly sacrificesRecorded: number;
  readonly discardsRecorded: number;
  readonly cyclingsRecorded: number;
  /** Library searches raised by a resolving effect (D357). */
  readonly librarySearches: number;
  /** Modes chosen for a spell, an activation or a trigger (D343). */
  readonly modeChoices: number;
  /** Permanents that entered as a face other than the front one (CR 712). */
  readonly backFacesPlayed: number;
}

/** D377 - every move in the log the rules gave `reason`, counted per MOVE. */
/** D410 - does the card's face carry a typed cycling (a search, not a draw)? */
function typedCycler(game: Game, id: InstanceId): boolean {
  const c = game.state.cards[id];
  const p = c ? ORACLE.byPrinting(c.printingId) : undefined;
  return !!c && !!p && faceOf(p, c.faceIndex).activated.some((a) => a.cycling?.type !== undefined);
}
function countMoves(game: Game, reason: 'sacrifice' | 'discard' | 'cycling'): number {
  let n = 0;
  for (const e of game.log) {
    if (e.body.t !== 'CardsMoved') continue;
    for (const m of e.body.moves) if (m.reason === reason) n += 1;
  }
  return n;
}

function runOne(seed: number): Run {
  const p = picker(`fuzz-${seed}`);
  const game = Game.create(makeSpec({ players: 4, seed: `fuzz-${seed}`, decks: [poolFor(seed, 0), poolFor(seed, 1), poolFor(seed, 2), poolFor(seed, 3)], librarySize: 60 }), deps(SCRIPTS), {
    checkInvariants: false,
  });
  let accepted = 0;

  const check = (): void => {
    const problems = checkInvariants(game.state);
    if (problems.length > 0) {
      // D343 - the message names the events that last touched the offending
      // ids, so a hole reads as a sequence rather than as a card number.
      const ids = new Set<string>();
      for (const p of problems) for (const m of p.matchAll(/\b(c\d+)\b/g)) ids.add(m[1] ?? '');
      const trail = game.log
        .filter((e) => {
          const s = JSON.stringify(e.body);
          return [...ids].some((id) => s.includes('"' + id + '"'));
        })
        .slice(-14)
        .map((e) => '#' + e.seq + ' ' + JSON.stringify(e.body).slice(0, 260));
      throw new Error(`seed ${seed} @ event ${game.state.eventCount}: ${problems.join('; ')}\n${trail.join('\n')}`);
    }
  };
  check();

  let targetPrompts = 0;
  for (let i = 0; i < INTENTS; i++) {
    if (game.state.priority.awaiting?.kind === 'chooseTargets') targetPrompts++;
    const intent = nextIntent(game.state, p);
    if (!intent) break;
    const result = game.submit(intent);
    if (result.ok) accepted++;
    // ⚠️ Checked after EVERY submitted intent, not at the end. Without this the
    // failure reads as "the state is corrupt somewhere in the last 40 000
    // events" instead of naming the intent that did it.
    check();
  }

  // The whole point: the same log, re-folded, is the same game.
  const replayed = replay(game.log, game.seed);
  if (stateHash(replayed) !== game.hash()) {
    throw new Error(`seed ${seed}: replay hash differs after ${game.log.length} events`);
  }

  // Every event's seq is dense from zero.
  game.log.forEach((e, i) => {
    if (e.seq !== i) throw new Error(`seed ${seed}: seq ${e.seq} at index ${i}`);
  });

  // PRNG self-consistency: an event that recorded an rng advance must have
  // recorded BOTH ends of it, and the state must have taken the recorded one.
  for (const e of game.log) {
    if (e.rngAfter === undefined) continue;
    if (e.rngBefore === undefined) throw new Error(`seed ${seed}: rngAfter with no rngBefore at ${e.seq}`);
  }

  return {
    seed,
    intents: INTENTS,
    accepted,
    events: game.log.length,
    turns: game.state.turn.turnNumber,
    finished: game.state.gamePhase === 'finished',
    targetPrompts,
    targetsChosen: game.log.filter((e) => e.body.t === 'TargetsChosen').length,
    // ⚠️ TWO rules write these kinds now, so counting them is no longer enough
    // to say which one ran — D108's transform rule writes `loyalty` exactly as
    // the entry rule does. They are told apart by the event they were appended
    // to: the funnel returns `[FaceIndexSet, CountersChanged]` for a transform,
    // so a loyalty change sitting immediately after a flip came from D108 and
    // anything else came from an entry. (The entry side cannot use the same
    // adjacency in reverse: `commanderZoneReplacement` can push an `AwaitingSet`
    // in between, so the counters do not always follow their `CardsMoved`.)
    enteredWithCounters: countersWritten(game.log, false),
    transformedIntoPlaneswalker: countersWritten(game.log, true),
    peeked: game.log.filter((e) => e.body.t === 'CardsRevealed').length,
    // ⚠️ `kind === 'triggered'`, not every `AbilityPutOnStack`. That event also
    // carries every ACTIVATED ability, and this counter read 249 with an EMPTY
    // registry when it did not filter — a canary that would have gone green over
    // a trigger bus that never ran once.
    triggersFired: game.log.filter(
      (e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.kind === 'triggered',
    ).length,
    // ⚠️ Filtered to the SHIPPED refs, not `kind === 'activated'` alone — the
    // engine has stacked activated abilities since M3 and resolved them to
    // nothing; only one whose ref a def claims runs a script (D159), and that
    // is the new ground this canary exists for.
    activatedRun: game.log.filter(
      (e) =>
        e.body.t === 'AbilityPutOnStack' &&
        e.body.obj.kind === 'activated' &&
        ACTIVATED_REFS.has(e.body.obj.abilityRef ?? ''),
    ).length,
    optionalTaken: game.log.filter((e) => e.body.t === 'OptionalTriggerAnswered' && e.body.accept).length,
    optionalDeclined: game.log.filter((e) => e.body.t === 'OptionalTriggerAnswered' && !e.body.accept).length,
    // ⚠️ Layer 6 emits NO EVENT — it is a derivation, and `derive.ts`'s header
    // says characteristics are never stored. So the canary counts the SOURCES
    // arriving instead: an enchantment on a battlefield is `applyStatics` having
    // real work, which is the closest a log can get to "the layer ran".
    layer6Sources: game.log.filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.to.kind === 'battlefield' && LAYER6_ORACLES.has(game.state.cards[m.card]?.oracleId ?? ''),
        ),
    ).length,
    // ⚠️ `cause.kind !== 'manual'` is the whole assertion. The fuzzer's Tier-3
    // tools write `+1/+1` counters one manual intent in thirteen, so an
    // unfiltered count would have been green before this milestone existed —
    // the same green-over-nothing the trigger canary was caught by in D128.
    ptCountersWritten: game.log.filter(
      (e) =>
        e.body.t === 'CountersChanged' &&
        e.cause.kind !== 'manual' &&
        e.body.changes.some((c) => c.kind === '+1/+1' || c.kind === '-1/-1'),
    ).length,
    tokensCreated: game.log.filter((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual').length,
    // ⚠️ THE CANARY THAT MATTERS, not the count above it. A token whose printing
    // the pool does not hold still produces a `TokenCreated` — it just derives
    // to the inert unknown-printing object, a nameless 0/0 the state-based
    // action bins on the next pass. Counting the EVENT would have gone green on
    // a game that created nothing anybody could see; this counts the ones the
    // oracle can name.
    tokensNamed: game.log.filter(
      (e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual' && ORACLE.byPrinting(e.body.printingId) !== undefined,
    ).length,
    // ⚠️ The tap must follow the MOVE that caused it. Counting every
    // `PermanentsTapped` would also count the untap step's mirror, every Tier-3
    // wrench and every land tapped for mana — none of which is this rule.
    // ⚠️ BOTH ANSWERS COUNTED SEPARATELY, because either one alone can be zero
    // while the gate stays green. Paying is a `LifeChanged` and declining is a
    // `PermanentsTapped`, and both of those events happen constantly for
    // unrelated reasons — so the marker is the only thing that can tell this
    // path apart from a land tapped for mana, which is why it exists.
    // ⚠️ TWO NUMBERS AGAIN: the prompts ANSWERED, and the cards that actually
    // moved. A discard whose answer was rejected leaves the first rising and the
    // second flat, which is exactly the silent half-failure a single counter
    // would hide.
    discardsChosen: game.log.filter(
      (e) => e.body.t === 'Narrated' && /\bdiscard(?:s)? \d+ card/.test(e.body.text),
    ).length,
    cardsDiscarded: game.log.filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.cause.kind !== 'manual' &&
        e.body.moves.some((m) => m.from.kind === 'hand' && m.to.kind === 'graveyard'),
    ).length,
    // ⚠️ THE TARGETED-TRIGGER COUNTERS. `StackTargetsSet` is written by this
    // path and NOTHING else, so unlike `TargetsChosen` (which a spell also
    // writes) it cannot go green on somebody else's work.
    triggerTargetsChosen: game.log.filter((e) => e.body.t === 'StackTargetsSet').length,
    // ⚠️ `ReplacementPending` is written by the CR 616 suspension and NOTHING
    // else, so unlike a counter over 'was a replacement applied' it cannot go
    // green on the single-effect path that has worked since D134.
    replacementChoices: game.log.filter((e) => e.body.t === 'ReplacementPending').length,
    // D364 - mana a SNOW SOURCE made. Counted off the event rather than off the pool,
    // because a pool is emptied at every step boundary and the making is the fact.
    snowManaMade: game.log.filter((e) => e.body.t === 'ManaAdded' && e.body.snow).length,
    // D397 - restricted mana made, and the spends that named a restricted bucket. Counted off
    // the events: the pool empties at every step boundary, and a bucket a payment drew on is
    // the fact that the solver funded something from restricted mana.
    restrictedManaMade: game.log.filter((e) => e.body.t === 'ManaAdded' && e.body.only !== undefined).length,
    restrictedManaSpent: game.log.filter((e) => e.body.t === 'ManaSpent' && e.body.restricted.length > 0).length,
    // D398 - a +1/+1 counter Cindering Cutthroat's replacement put on itself as it entered: the
    // replacement returns the move and the counters together, so they are ADJACENT on the log,
    // and only a met `an opponent lost life this turn` writes the second one. A manual counter
    // is a CountersChanged with no entry move before it, so the adjacency is the D130 filter too.
    thisTurnEntersWith: game.log.filter((e, i) => {
      if (e.body.t !== 'CountersChanged') return false;
      const prev = game.log[i - 1]?.body;
      if (!prev || prev.t !== 'CardsMoved') return false;
      return e.body.changes.some((c) => {
        if (c.kind !== '+1/+1' || c.delta <= 0) return false;
        const inst = game.state.cards[c.card];
        if (!inst || ORACLE.byPrinting(inst.printingId)?.name !== 'Cindering Cutthroat') return false;
        return prev.moves.some((m) => m.card === c.card && m.to.kind === 'battlefield');
      });
    }).length,
    // D398 - Courier Bat's enters trigger reaches the stack only when `matches` read a met
    // condition (CR 603.4), so the stacking IS the proof that the record was consulted.
    thisTurnTriggers: game.log.filter(
      (e) => e.body.t === 'AbilityPutOnStack' && /^Courier Bat - /.test(e.body.obj.label),
    ).length,
    // D377 - the three rules ACTIONS the move records. Counted per MOVE rather than per event,
    // because one batch is one simultaneous sacrifice of N permanents and each is its own.
    sacrificesRecorded: countMoves(game, 'sacrifice'),
    discardsRecorded: countMoves(game, 'discard'),
    cyclingsRecorded: countMoves(game, 'cycling'),
    // D382 - CR 615. The first counts the shields real games put up; the second counts the damage
    // one actually stopped, which is the half a shield nothing spends could never prove.
    preventionShields: game.log.filter((e) => e.body.t === 'PreventionShieldsAdded').length,
    damagePrevented: game.log.reduce(
      (n, e) => (e.body.t === 'DamagePrevented' ? n + e.body.spends.reduce((m, s) => m + s.amount, 0) : n),
      0,
    ),
    // D385 - the CONTINUOUS half of CR 615: what a `PreventionDef` absorbed, read off the same event.
    staticDamagePrevented: game.log.reduce(
      (n, e) => (e.body.t === 'DamagePrevented' ? n + e.body.statics.reduce((m, s) => m + s.amount, 0) : n),
      0,
    ),
    // D372 - mana made by a permanent whose PRINTED face has no mana ability: a GRANTED one.
    // Read off the event and the oracle face, never off the pool. A spell that makes mana
    // (a ritual) is not a permanent, so the type-line check keeps it out.
    grantedManaMade: game.log.filter((e) => {
      if (e.body.t !== 'ManaAdded') return false;
      const src = e.body.source;
      const inst = src ? game.state.cards[src] : undefined;
      const card = inst ? ORACLE.byPrinting(inst.printingId) : undefined;
      if (!inst || !card) return false;
      const f = faceOf(card, inst.faceIndex);
      return f.producesMana.length === 0 && f.typeLine.types.some((t) => t === 'Creature' || t === 'Land' || t === 'Artifact' || t === 'Enchantment');
    }).length,
    // D373 - a GRANTED ability whose payload landed on its own SOURCE. Counted by walking BACK
    // from the mark to the nearest `AbilityPutOnStack`: that object carries both the ref (a
    // granted one says `#g`/`#gt`) and the source, so this cannot go green on a targeted effect
    // that merely happened to hit the same permanent, nor on a printed self ability.
    selfAimedResolved: game.log.filter((e, i) => {
      const b = e.body;
      const cards =
        b.t === 'PtModifiedUntilEndOfTurn' || b.t === 'RegenerationShieldAdded'
          ? [b.card]
          : b.t === 'PermanentsUntapped'
            ? b.cards
            : b.t === 'CountersChanged'
              ? b.changes.map((c) => c.card)
              : [];
      if (cards.length === 0) return false;
      for (let k = i - 1; k >= 0 && i - k < 40; k--) {
        const prev = game.log[k]?.body;
        if (prev?.t !== 'AbilityPutOnStack') continue;
        const ref = prev.obj.abilityRef;
        return typeof ref === 'string' && /#gt?\d+$/.test(ref) && cards.includes(prev.obj.source as never);
      }
      return false;
    }).length,
    scryChoices: game.log.filter(
      (e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'scryChoice',
    ).length,
    // D390 - a queue is raised only when somebody had a real choice, and resolved by the last
    // answer; the two together are what the staple's resolution exists to drive.
    queueAsks: game.log.filter((e) => e.body.t === 'AsksQueued').length,
    queueBatches: game.log.filter((e) => e.body.t === 'AsksResolved').length,
    proliferateAsks: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'proliferateChoice').length,
    proliferations: game.log.filter((e) => e.body.t === 'Proliferated' && e.body.permanents.length + e.body.players.length > 0).length,
    controlTaken: game.log.filter((e) => e.body.t === 'ControlChangedUntilEndOfTurn').length,
    controlReverted: game.log.filter((e) => e.body.t === 'ControlChanged').length,
    cantBlockSet: game.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.cantBlock === true).length,
    cantBeBlockedSet: game.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.cantBeBlocked === true).length,
    delayedArmed: game.log.filter((e) => e.body.t === 'DelayedTriggerArmed').length,
    delayedFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.delayedEffects !== undefined).length,
    kickedCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.kicked ?? 0) > 0).length,
    kickedEntries: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.to.kind === 'battlefield' && (m.kicked ?? 0) > 0)).length,
    reducedCasts: game.log.filter((e) => e.body.t === 'SpellCast' && !e.body.obj.isCommanderCast && e.body.obj.taxApplied < 0).length,
    additionalCostCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.additionalPaid ?? 0) > 0).length,
    alternativeCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.alternativePaid === true).length,
    explores: game.log.filter((e) => e.body.t === 'Explored').length,
    typecyclings: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.reason === 'cycling' && typedCycler(game, m.card))).length,
    untapSkips: game.log.filter((e) => e.body.t === 'UntapSkipSet' && e.body.skip).length,
    linkedExiles: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.until !== undefined)).length,
    linkedReturns: game.log.filter((e) => e.body.t === 'StateBasedActionsApplied' && e.body.actions.some((a) => a.t === 'linkedExileReturns')).length,
    convokedCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.convoked ?? 0) > 0).length,
    improvisedCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.improvised ?? 0) > 0).length,
    delvedCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.delved ?? 0) > 0).length,
    animations: game.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.basePt !== undefined).length,
    fights: game.log.filter((e) => e.body.t === 'Fought' && e.body.mutual).length,
    bites: game.log.filter((e) => e.body.t === 'Fought' && !e.body.mutual).length,
    librarySearches: game.log.filter(
      (e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'searchLibrary',
    ).length,
    modeChoices: game.log.filter((e) => e.body.t === 'ModesChosen' || e.body.t === 'StackModesSet').length,
    // CR 608.2b for a TRIGGER — a distinct sentence from the spell fizzle, so
    // the two cannot be confused for each other.
    triggersFizzled: game.log.filter(
      (e) => e.body.t === 'Narrated' && /does not resolve \(CR 608\.2b\)/.test(e.body.text),
    ).length,
    // ⚠️ COUNTED BY THE ABILITY, not by the life: `Onulet` gains 2 life and so
    // does nothing else in `DECK`, but a canary that watched a life total would
    // be one card away from going green over the wrong thing.
    diesTriggers: game.log.filter(
      (e) => e.body.t === 'AbilityPutOnStack' && /^Onulet —/.test(e.body.obj.label),
    ).length,
    entersPaid: game.log.filter((e) => e.body.t === 'EntersChoiceAnswered' && e.body.pay).length,
    entersDeclined: game.log.filter((e) => e.body.t === 'EntersChoiceAnswered' && !e.body.pay).length,
    paymentsPaid: game.log.filter((e) => e.body.t === 'PaymentAnswered' && e.body.paid).length,
    paymentsDeclined: game.log.filter((e) => e.body.t === 'PaymentAnswered' && !e.body.paid).length,
    // ⚠️ A MOVE that names a face — the one mechanism D155 rests on. Counting
    // `FaceIndexSet` instead would count TRANSFORMS, which is a different rule.
    backFacesPlayed: game.log.filter(
      (e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => (m.faceIndex ?? 0) !== 0),
    ).length,
    enteredTapped: game.log.filter(
      (e, i) => e.body.t === 'PermanentsTapped' && game.log[i - 1]?.body.t === 'CardsMoved',
    ).length,
  };
}

function countersWritten(log: readonly GameEvent[], viaTransform: boolean): number {
  return log.filter((e, i) => {
    if (e.body.t !== 'CountersChanged') return false;
    const relevant = e.body.changes.some(
      (c) => (c.kind === 'loyalty' || c.kind === 'defense') && c.delta > 0,
    );
    if (!relevant) return false;
    return (log[i - 1]?.body.t === 'FaceIndexSet') === viaTransform;
  }).length;
}

/**
 * ⚠️⚠️ **EVERY SHIPPED SCRIPT MUST BE IN THIS GATE’S POOL** — M6.4-LIBRARY-SPEC
 * §6 gate 3, and the rule this repo has broken FOUR times (D102, D107, D108,
 * D121). A card missing from `DECK` is a code path the fuzzer cannot reach, and
 * the gate stays green the whole time that path rots.
 *
 * ⚠️ It is written NOW, while `SHIPPED_SCRIPTS` is empty and the check is
 * vacuous, for the reason `shippedScripts.node.test.ts` gives about itself: the
 * rule has lived in comments since D102 and comments are what got broken. M6.4
 * lands scripts in batches, and a batch that forgets this is indistinguishable
 * from a batch that did it right.
 *
 * ⚠️ Two halves, because either alone is satisfiable while the path stays dead:
 * the script has to be REGISTERED here (or the trigger bus never sees it) and
 * its card has to be DEALT here (or nothing ever puts it on a battlefield).
 */
describe('the fuzz pool covers every shipped script', () => {
  test('every shipped script is registered in this gate', () => {
    const missing = SHIPPED_SCRIPTS.filter((s) => !SCRIPTS.get(s.oracleId)).map((s) => s.name);
    expect(missing).toEqual([]);
  });

  test('L1 — the pools of a run cover every scripted name, at both sizes', () => {
    // ⚠️ COMPUTED, never derived on paper — the modulo arithmetic is exactly
    // where an off-by-one hides. What is asserted is the floor the gate
    // needs: every scripted name dealt in ≥ 2 seats across the run, and
    // every staple in EVERY pool at exactly its declared weight.
    const counts = new Map<string, number>();
    for (let seed = 0; seed < SEEDS; seed++) {
      for (let seat = 0; seat < 4; seat++) {
        for (const n of poolFor(seed, seat)) counts.set(n, (counts.get(n) ?? 0) + 1);
      }
    }
    const under = SCRIPTED_SORTED.filter((n) => (counts.get(n) ?? 0) < 2);
    expect(under).toEqual([]);
    for (const s of CANARY_STAPLES) {
      for (const n of s.names) expect(counts.get(n) ?? 0).toBe(SEEDS * 4 * s.copiesPerSeat);
    }
  });

  test('the staples table is sound: every staple resolves in the oracle', () => {
    // A typo'd staple is a SILENT BLANK (D133's lesson for tokens, the same
    // failure one layer up) — makeSpec would throw at game creation, but this
    // names the bad entry directly.
    for (const s of CANARY_STAPLES) {
      for (const n of s.names) {
        expect(ORACLE.byName(n), `staple ${n} does not resolve in the oracle`).toBeDefined();
      }
      expect(s.counterKeys.length).toBeGreaterThan(0);
      expect(s.copiesPerSeat).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ THE TEETH, because both checks above pass over an empty list — D128’s
   * green-over-nothing, which this repo has now written down five times. The
   * TEST registry is the right thing to point them at: those scripts are
   * deliberately not shipped, and `AJANIS_MANTRA` IS dealt while
   * `KNIGHTHOOD_SCRIPT`’s card is not, so one half fires and the other does not.
   */
  test('and the checks have teeth', () => {
    const dealt = new Set(poolFor(0, 0));
    expect(SCRIPTS.get(AJANIS_MANTRA.oracleId)).toBeDefined();
    expect(dealt.has(AJANIS_MANTRA.name)).toBe(true);
    // ⚠️ A script whose card this gate does NOT deal — the failure the second
    // check exists to catch, on a real one. `Humility` is registered nowhere and
    // dealt nowhere, which is exactly the state a forgotten batch would leave a
    // shipped script in. (The first card I reached for, `Kwende`, IS dealt — the
    // gate is already correct about every script it registers, which is the
    // point of the two checks above and the reason this one needed a real miss.)
    expect(dealt.has(HUMILITY_SCRIPT.name)).toBe(false);
  });
});
/** The per-run counters the gate sums (D296: in one list, so a shard and the union agree). */
const TOTAL_KEYS = [
  'accepted',
  'events',
  'turns',
  'targetPrompts',
  'targetsChosen',
  'enteredWithCounters',
  'transformedIntoPlaneswalker',
  'peeked',
  'triggersFired',
  'activatedRun',
  'optionalTaken',
  'optionalDeclined',
  'layer6Sources',
  'ptCountersWritten',
  'tokensCreated',
  'tokensNamed',
  'enteredTapped',
  'entersPaid',
  'discardsChosen',
  'cardsDiscarded',
  'triggerTargetsChosen',
  'triggersFizzled',
  'diesTriggers',
  'replacementChoices',
  'scryChoices',
  'queueAsks',
  'queueBatches',
  'proliferateAsks',
  'proliferations',
  'controlTaken',
  'controlReverted',
  'cantBlockSet',
  'cantBeBlockedSet',
  'delayedArmed',
  'delayedFired',
  'kickedCasts',
  'kickedEntries',
  'reducedCasts',
  'additionalCostCasts',
  'alternativeCasts',
  'explores',
  'typecyclings',
  'untapSkips',
  'linkedExiles',
  'linkedReturns',
  'convokedCasts',
  'improvisedCasts',
  'delvedCasts',
  'animations',
  'fights',
  'bites',
  'snowManaMade',
  'restrictedManaMade',
  'restrictedManaSpent',
  'thisTurnEntersWith',
  'thisTurnTriggers',
  'grantedManaMade',
  'selfAimedResolved',
  'sacrificesRecorded',
  'discardsRecorded',
  'cyclingsRecorded',
  'librarySearches',
  'modeChoices',
  'entersDeclined',
  'paymentsPaid',
  'paymentsDeclined',
  'preventionShields',
  'damagePrevented',
  'staticDamagePrevented',
] as const;
type TotalKey = (typeof TOTAL_KEYS)[number] | 'finished';
type Totals = Record<TotalKey, number>;

function zeroTotals(): Totals {
  const t = {} as Totals;
  for (const k of TOTAL_KEYS) t[k] = 0;
  t.finished = 0;
  return t;
}

function sumRuns(runs: readonly Run[]): Totals {
  const t = zeroTotals();
  for (const r of runs) {
    for (const k of TOTAL_KEYS) t[k] += r[k];
    t.finished += r.finished ? 1 : 0;
  }
  return t;
}

function addTotals(a: Totals, b: Totals): Totals {
  const t = zeroTotals();
  for (const k of TOTAL_KEYS) t[k] = a[k] + b[k];
  t.finished = a.finished + b.finished;
  return t;
}

/** A shard writes what it ran; the aggregate run reads every shard back. */
function writeShard(runs: readonly Run[], totals: Totals): void {
  const out = process.env.CRT_FUZZ_OUT;
  if (!out) throw new Error('CRT_FUZZ_SHARD needs CRT_FUZZ_OUT');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ seeds: runs.map((r) => r.seed), totals }, null, 2));
}

/**
 * THE CANARY FLOORS, over `seeds` runs — the whole gate (500) or the union of
 * its shards. A fuzzer that silently did nothing would pass the hash check;
 * these are what say it did something. Every comment below is the reason a
 * floor is where it is; none of them moved in D296.
 */
function assertFloors(totals: Totals, seeds: number): void {
      // A fuzzer that silently did nothing would pass. These are the canaries.
      expect(totals.accepted).toBeGreaterThan(seeds * 50);
      expect(totals.events).toBeGreaterThan(seeds * 300);
      expect(totals.turns).toBeGreaterThan(seeds * 2);
      // ⚠️ TARGETING PATH CANARIES. Without these, a regression that stopped
      // emitting the prompt — or a harness that answered every one by
      // cancelling — leaves the whole gate green while the feature is dead.
      expect(totals.targetPrompts).toBeGreaterThan(seeds);
      expect(totals.targetsChosen).toBeGreaterThan(seeds);
      // ⚠️ THE ENTRY-COUNTER CANARY. The hash equality above is only evidence
      // about a rule the run actually EXERCISED, and until Grist and the Siege
      // joined `DECK` this gate could not put a planeswalker on a battlefield at
      // all. Deliberately `> 0` rather than a rate: it is asserting the path is
      // reachable, and the fuzzer has to draw and afford a 3-drop to get there.
      // ⚠️ **AT THE GATE SIZE ONLY since D176** — the FIFTH rate-canary rot:
      // batch 18's DECK growth took the 60-seed expectation under Poisson
      // reliability (measured 0 at 60 while the same commit's 500-seed run
      // held 30), exactly the profile that gate-sized the transform canary
      // below and the dies canary before D175's re-weight.
      if (seeds >= 500) expect(totals.enteredWithCounters).toBeGreaterThan(0);
      // ⚠️ THE TRANSFORM CANARY, and it needed a new INTENT as well as a new
      // card: `manualIntentFor` had no `ManualFlipFace` case at all, so no seed
      // could turn a permanent over however many faces it had. Same `> 0`
      // reasoning as the entry canary above — it asserts the path is reachable,
      // and getting there means drawing Jace, affording him, resolving him, and
      // then rolling the one manual tool in nine that flips.
      // ⚠️ **AT THE GATE SIZE ONLY, and D155 is what moved it there** — D149's
      // precedent, now for the second canary. Adding one modal DFC to `DECK`
      // diluted every other card enough that this path stopped being reached at
      // the 60-seed default while staying comfortable at 500: measured 0 at 60
      // and green at 500 on the same commit. A `> 0` that is a coin flip at the
      // default is a check that fails for reasons unrelated to what it tests.
      if (seeds >= 500) expect(totals.transformedIntoPlaneswalker).toBeGreaterThan(0);
      // ⚠️ THE PEEK CANARY. The leak test above now asserts a BOUNDARY —
      // a library card may reach a projection only when it is revealed to
      // that viewer — and an assertion about a boundary nothing crosses is
      // the same green-over-nothing this file has been caught by twice.
      expect(totals.peeked).toBeGreaterThan(0);
      // ⚠️ THE TRIGGER-BUS CANARY, and it is new ground rather than a widening.
      // Until D128 this gate ran `NO_SCRIPTS`, so `collectTriggers`
      // short-circuited on `scripts.size === 0` in every one of 500 seeds and
      // the whole bus — collect, APNAP sort, drain, `AbilityPutOnStack` — was
      // unreachable from the one thing that runs the engine ten thousand times
      // a night.
      expect(totals.triggersFired).toBeGreaterThan(0);
      // ⚠️ THE ACTIVATED-SEAM CANARY (D159). The engine has stacked activated
      // abilities since M3 — the counter is filtered to the SHIPPED refs, so
      // it counts only an ability a def RESOLVED, which is the new ground.
      // Gate-size only, like the dies-trigger canary: reaching one takes
      // drawing the artifact or land, playing it, affording the activation and
      // the fuzzer choosing it, which is a coin flip across 60 arbitrary seeds.
      if (seeds >= 500) expect(totals.activatedRun).toBeGreaterThan(0);
      // ⚠️ BOTH ANSWERS, separately. One canary over "was the prompt raised"
      // would stay green with a driver that only ever declined, and declining
      // runs no script at all — so the accept path, which is the entire point of
      // the primitive, would be exercised by nothing. Deliberately `> 0` rather
      // than a rate, like the entry-counter canary: getting here means drawing
      // Ajani's Mantra, affording `{1}{W}`, resolving it, and surviving to an
      // upkeep of your own.
      expect(totals.optionalTaken).toBeGreaterThan(0);
      expect(totals.optionalDeclined).toBeGreaterThan(0);
      // ⚠️ THE LAYER-6 CANARY. `applyStatics` short-circuits on an empty def
      // list, so before D129 it had never run its body here either — and unlike
      // the trigger bus, layer 6 writes NO EVENT to assert on. This counts the
      // sources arriving, which is what gives the layer live work.
      expect(totals.layer6Sources).toBeGreaterThan(0);
      // ⚠️ THE COUNTER-EFFECT CANARY. `CountersChanged` has been on the log
      // since D107, so the EVENT was always reachable — what was not is the
      // rules writing one: a spell resolving through `effectEvents`, or a card
      // script returning one. Filtered against `manual` for exactly that reason.
      expect(totals.ptCountersWritten).toBeGreaterThan(0);
      // ⚠️ THE TOKEN CANARY, and it asserts the NAMED count rather than the
      // event count — see `tokensNamed`. Equality between the two is the real
      // property: every token the rules created was a card the oracle knew.
      expect(totals.tokensNamed).toBeGreaterThan(0);
      expect(totals.tokensNamed).toBe(totals.tokensCreated);
      // ⚠️ THE ENTERS-TAPPED CANARY. Ten places move a card onto the
      // battlefield and the rule lives in the replacement funnel so it catches
      // all ten; a gate that never played one of these lands would be green on
      // a rule that fired nowhere.
      expect(totals.enteredTapped).toBeGreaterThan(0);
      // ⚠️ THE ENTERS-CHOICE CANARY, and it is TWO numbers for the reason the
      // may-trigger canary is two: a driver that only ever declined would leave
      // the paying half — the half that costs life and can be REJECTED —
      // untaken in all 500 seeds, and the tap count above would rise anyway.
      expect(totals.entersPaid).toBeGreaterThan(0);
      expect(totals.entersDeclined).toBeGreaterThan(0);
      // D369 - THE PAYMENT CANARY, two numbers for the same reason, AT GATE SIZE: a
      // counter needs a spell on the stack under it, which a 60-seed leg reaches too
      // rarely to assert on.
      if (seeds >= 500) expect(totals.paymentsPaid).toBeGreaterThan(0);
      if (seeds >= 500) expect(totals.paymentsDeclined).toBeGreaterThan(0);
      // D382 - THE PREVENTION CANARY, and it is TWO numbers because a shield nothing
      // spends proves only half of CR 615. `preventionShields` is comfortable at any
      // size (measured 56 at 60 seeds, 9 at 8), because Fog needs nothing but {G};
      // `damagePrevented` is GATE SIZE ONLY, because the shield is COMBAT-wide and
      // spending it needs the Fog cast on a turn that reaches combat damage - measured
      // 4 at 60 seeds, which is a coin flip and not a floor (D155/D176's rule).
      expect(totals.preventionShields).toBeGreaterThan(0);
      if (seeds >= 500) expect(totals.damagePrevented).toBeGreaterThan(0);
      // D385 - THE CONTINUOUS PREVENTION CANARY. A `PreventionDef` spends nothing, so the state
      // hash proves nothing about it (D364) and only this count says the funnel consulted one.
      // ⚠️ ITS FIRST STAPLE READ ZERO AT 500 SEEDS and the finding was the DRIVER, not the seam:
      // `declareBlockers` answers `blocks: []`, so a prevention effect that can only fire in a
      // block has no fuel here (see CANARY_STAPLES). The three staples now dealt are fuelled by
      // damage the driver actually deals.
      // ⚠️ GATE SIZE ONLY, and D385 had this WRONG for one decision: it made the floor
      // unconditional on the strength of ONE 60-seed leg passing - a single sample, which is
      // exactly what D155/D176 call a coin flip. D386 added 21 scripted names, every seed's
      // round-robin window shifted with them (D193), and the unit suite's 60-seed run read ZERO
      // while the 500-seed gate read 77 with every shard positive (D385's gate: 42). Two samples
      // at 60 (>0, 0) against two at 500 (42, 77): the fuel is reliable at gate size and nowhere
      // smaller, and that is where the floor sits.
      if (seeds >= 500) expect(totals.staticDamagePrevented).toBeGreaterThan(0);
      // ⚠️ THE DISCARD CANARY. `CardsMoved` hand→graveyard also happens at
      // cleanup for a hand over seven, so the count alone would have been green
      // since M3; the narration counter is the one that only this path writes.
      // ⚠️ **`discardsChosen` AT THE GATE SIZE ONLY since D176** — measured 10
      // per 500 seeds, so its 60-seed expectation is ~1.2 and a zero is a 30%
      // coin flip; it flipped in D176's second gate run, one run after the
      // entry-counter canary did (the same batch-18 DECK dilution took both).
      // `cardsDiscarded` stays at every size: cleanup discards keep it ~93/500.
      if (seeds >= 500) expect(totals.discardsChosen).toBeGreaterThan(0);
      expect(totals.cardsDiscarded).toBeGreaterThan(0);
      // ⚠️ THE TARGETED-TRIGGER CANARY. Before D147 `drainTriggers` built every
      // stack object with `targets: []`, so this whole path — the prompt, the
      // validation, `StackTargetsSet`, and CR 608.2b for an ability — did not
      // exist. A gate that never played a Yotian Dissident would be green on it.
      expect(totals.triggerTargetsChosen).toBeGreaterThan(0);
      // ⚠️ THE LOOK-BACK CANARY, and it is the one that would have been green
      // over nothing in the most misleading way: a dies trigger that never
      // fires leaves NO trace at all, so every other counter here is unmoved by
      // it being broken. Counting the ability reaching the stack is the only
      // evidence that CR 603.10a ran.
      // ⚠️ **AT THE GATE SIZE, for D155's reason and D149's precedent.** Adding
      // one card to `DECK` does not merely dilute it — it RE-ROLLS every seed's
      // game, because the deck list feeds the shuffle. So a canary that is rare
      // at the 60-seed default is a coin flip on which 60 arbitrary games come
      // up, and this one and the Jace transform both went to 0 at 60 while the
      // 500-seed gate stayed green on the same commit.
      if (seeds >= 500) expect(totals.diesTriggers).toBeGreaterThan(0);
      // ⚠️ THE CR 616 CANARY. The funnel suspends only when TWO replacements
      // apply to one event, which needs both cards on one battlefield and a
      // counter being put — so this is the one number that says the
      // continuation, its three parked queues and the resume all ran in a real
      // game rather than only in a unit test.
      // ⚠️ **NOT ASSERTED > 0, AND MEASURED RATHER THAN ASSUMED: 500 seeds
      // reach it ZERO times.** CR 616 suspends only when TWO replacements apply
      // to ONE event, which needs both one-of enchantments cast onto the same
      // battlefield AND a +1/+1 counter put afterwards — three specific cards
      // inside 200 random intents. Asserting a positive here would be a flaky
      // gate; asserting nothing and saying so is D137's precedent for the
      // "no legal target" narration, which also fired zero times.
      //
      // ⚠️ THE COVERAGE IS ELSEWHERE AND IS STRONGER: `battery-anim.cjs prompts`
      // drives both branches with REAL CLICKS in a real Electron, through the
      // `HostOptions.scripts` seam D146 built. The counter stays because it is
      // free and will start moving the day this deck changes.
      // ⚠️ **AT THE GATE SIZE ONLY, and the rate is why: MEASURED at 5 across
      // 500 seeds.** Two replacements applying to ONE event needs both one-of
      // enchantments cast onto the same battlefield and a +1/+1 counter after —
      // roughly one seed in a hundred. Asserting it at the 60-seed default would
      // be a coin-flip gate; asserting it at 500 and saying the rate is the
      // honest form. `battery-anim.cjs prompts` covers both branches with real
      // clicks either way, which is the coverage that does not depend on luck.
      if (seeds >= 500) expect(totals.replacementChoices).toBeGreaterThan(0);
      // ⚠️ THE SCRY CANARY (D195): Preordain is a staple in every pool, {U} is
      // affordable, and the prompt is answered by the driver's no-op scry —
      // so at gate size the effect that stops and asks must have stopped and
      // asked somewhere.
      if (seeds >= 500) expect(totals.scryChoices).toBeGreaterThan(0);
      // D390 - THE PLAYER QUEUE: Innocent Blood ({B}, each player sacrifices a creature of their
      // choice) and Unnerve (each opponent discards two) are staples in every pool, and a queue
      // is raised only where a player has more legal choices than the count - so at gate size
      // some seat, somewhere, must have been asked and the batch must have followed.
      if (seeds >= 500) {
        expect(totals.queueAsks).toBeGreaterThan(0);
        expect(totals.queueBatches).toBeGreaterThan(0);
      }
      // D391 - Grim Affliction is a staple in every pool: a -1/-1 counter on a target creature,
      // then the ask, and the driver answers at random - so at gate size the prompt must have been
      // raised and something must have grown at least once.
      if (seeds >= 500) {
        expect(totals.proliferateAsks).toBeGreaterThan(0);
        expect(totals.proliferations).toBeGreaterThan(0);
        // D393 - a permanent taken until end of turn, and handed back at cleanup, at gate size.
        expect(totals.controlTaken).toBeGreaterThan(0);
        expect(totals.controlReverted).toBeGreaterThan(0);
        // D394 - a can't-block restriction set at least once at gate size.
        expect(totals.cantBlockSet).toBeGreaterThan(0);
        // D399 - one Infiltrate a seat, the evasion set at gate size.
        expect(totals.cantBeBlockedSet).toBeGreaterThan(0);
        // D402 - one Blessed Wine a seat: a delayed trigger armed AND fired at gate size.
        expect(totals.delayedArmed).toBeGreaterThan(0);
        expect(totals.delayedFired).toBeGreaterThan(0);
        // D403 - one Ardent Soldier a seat, the kick always tried: a kicked cast and a kicked entry at gate size.
        expect(totals.kickedCasts).toBeGreaterThan(0);
        expect(totals.kickedEntries).toBeGreaterThan(0);
        // D404 - one Pearl Medallion a seat: a white spell priced down at gate size.
        expect(totals.reducedCasts).toBeGreaterThan(0);
        // D405 - Pack's Favor convoked and Hooting Mandrills delved at gate size (improvise counted only).
        expect(totals.convokedCasts).toBeGreaterThan(0);
        expect(totals.delvedCasts).toBeGreaterThan(0);
        // D406 - Village Rites' sacrifice and Tormenting Voice's discard paid at gate size.
        expect(totals.additionalCostCasts).toBeGreaterThan(0);
        // D407 - the linked exile made at gate size; the RETURN is counted, no floor: six exiles and one return
        // over 60 seeds (a Warden must die or a Light be removed), too thin for a rate (D398's rule).
        expect(totals.linkedExiles).toBeGreaterThan(0);
        // D408 - Daze cast for its alternative at gate size.
        expect(totals.alternativeCasts).toBeGreaterThan(0);
        // D409 - Merfolk Branchwalker explored at gate size.
        expect(totals.explores).toBeGreaterThan(0);
        // D410 - Ash Barrens typecycled at gate size.
        expect(totals.typecyclings).toBeGreaterThan(0);
        // D411 - a depletion land's rider set the skip at gate size.
        expect(totals.untapSkips).toBeGreaterThan(0);
        // D395 - a permanent animated at least once at gate size.
        expect(totals.animations).toBeGreaterThan(0);
        // D396 - a fight and a bite resolved at least once at gate size.
        expect(totals.fights).toBeGreaterThan(0);
        expect(totals.bites).toBeGreaterThan(0);
      }
      // D364 - at gate size only, like every rate canary: two snow lands a seat, and a
      // pool with provenance is only proven by mana that actually carried it.
      if (seeds >= 500) expect(totals.snowManaMade).toBeGreaterThan(0);
      // D397 - at gate size only: two Ancient Ziggurats a seat, and a pool with a restricted
      // bucket is proven only by mana that carried the restriction and a spend that drew on it.
      if (seeds >= 500) expect(totals.restrictedManaMade).toBeGreaterThan(0);
      if (seeds >= 500) expect(totals.restrictedManaSpent).toBeGreaterThan(0);
      // D398 - at gate size only, and over the UNION of the two counters: a this-turn condition
      // is proven only by a counter or a stacking that a MET record produced, and under a driver
      // that rarely attacks each side alone is a ~10-per-500 event (measured: 1 + 1 at 60 seeds
      // with four staples a seat). The unit suites prove each side both ways; the gate proves
      // that real games read the record at all.
      if (seeds >= 500) expect(totals.thisTurnEntersWith + totals.thisTurnTriggers).toBeGreaterThan(0);
      // D372 - at gate size only: two Cryptolith Rites a seat, and a granted production is
      // proven only by mana a recipient actually made.
      if (seeds >= 500) expect(totals.grantedManaMade).toBeGreaterThan(0);
      // D373 - at gate size only: two Barbed Slivers a seat, each inside its own scope, and a
      // self-aimed payload is proven only by a mark that actually landed on the recipient.
      if (seeds >= 500) expect(totals.selfAimedResolved).toBeGreaterThan(0);
      // D377 - at gate size only: the three rules ACTIONS a printed head names by verb. A move
      // with no reason is indistinguishable from a move whose reason nothing set, so the only
      // honest proof is that real games recorded all three.
      if (seeds >= 500) expect(totals.sacrificesRecorded).toBeGreaterThan(0);
      if (seeds >= 500) expect(totals.discardsRecorded).toBeGreaterThan(0);
      if (seeds >= 500) expect(totals.cyclingsRecorded).toBeGreaterThan(0);
      // ⚠️ THE MODAL CANARY (D343): Crushing Canopy is a staple in every pool and
      // is offered whenever a flyer or an enchantment stands, so at gate size a
      // mode must have been chosen somewhere.
      if (seeds >= 500) expect(totals.modeChoices).toBeGreaterThan(0);
}

describe('replay-equivalence fuzzer — THE GATE', () => {
  test.skipIf(AGGREGATE !== null)(
    `${SEEDS} seeds × ${INTENTS} random legal intents replay to an identical hash`,
    () => {
      const runs: Run[] = [];
      for (let seed = SHARD?.i ?? 0; seed < SEEDS; seed += SHARD?.w ?? 1) runs.push(runOne(seed));

      const totals = sumRuns(runs);
      // eslint-disable-next-line no-console
      console.log(
        `fuzz: ${runs.length} seeds${SHARD ? ` (shard ${SHARD.i}/${SHARD.w})` : ''} · ${totals.accepted} accepted intents · ${totals.events} events · ` +
          `${totals.turns} turns · ${totals.finished} games finished · ` +
          `${totals.targetPrompts} target prompts · ${totals.targetsChosen} declared · ` +
          `${totals.enteredWithCounters} entered with counters · ` +
          `${totals.transformedIntoPlaneswalker} transformed into a planeswalker · ` +
          `${totals.peeked} library peeks · ` +
          `${totals.triggersFired} triggered abilities · ` +
          `${totals.activatedRun} activated abilities resolved by script · ` +
          `${totals.optionalTaken} may-triggers taken / ${totals.optionalDeclined} declined · ` +
          `${totals.layer6Sources} layer-6 sources on a battlefield · ` +
          `${totals.ptCountersWritten} +1/+1 or -1/-1 counters written by the rules · ` +
          `${totals.tokensCreated} tokens created by the rules (${totals.tokensNamed} the oracle can name) · ` +
          `${totals.enteredTapped} permanents entered tapped · ` +
          `${totals.entersPaid} paid life to enter untapped / ${totals.entersDeclined} declined · ` +
          `${totals.discardsChosen} discards chosen, ${totals.cardsDiscarded} moves of hand→graveyard · ` +
          `${totals.snowManaMade} mana made by a snow source · ` +
          `${totals.restrictedManaMade} made under a spend restriction / ${totals.restrictedManaSpent} spends that drew on it · ` +
          `${totals.thisTurnEntersWith} entered with a counter under a this-turn condition / ${totals.thisTurnTriggers} triggers stacked under one · ` +
          `${totals.grantedManaMade} by a granted mana ability · ` +
          `${totals.selfAimedResolved} granted payloads that hit their own source · ` +
          `${totals.sacrificesRecorded} sacrifices / ${totals.discardsRecorded} discards / ${totals.cyclingsRecorded} cyclings recorded · ` +
          `${totals.paymentsPaid} payments made / ${totals.paymentsDeclined} declined · ` +
          `${totals.queueAsks} player queues raised / ${totals.queueBatches} completed · ` +
          `${totals.proliferateAsks} proliferate asks / ${totals.proliferations} answered with something · ` +
          `${totals.controlTaken} permanents taken until end of turn / ${totals.controlReverted} handed back · ` +
          `${totals.cantBlockSet} can't-block restrictions set · ` +
          `${totals.cantBeBlockedSet} can't-be-blocked evasions set · ` +
          `${totals.delayedArmed} delayed triggers armed / ${totals.delayedFired} fired · ` +
          `${totals.kickedCasts} kicked casts / ${totals.kickedEntries} kicked entries · ` +
          `${totals.reducedCasts} casts priced down by the board · ` +
          `${totals.convokedCasts} convoked / ${totals.improvisedCasts} improvised / ${totals.delvedCasts} delved casts · ` +
          `${totals.additionalCostCasts} casts paying an additional cost · ` +
          `${totals.linkedExiles} linked exiles / ${totals.linkedReturns} returns · ` +
          `${totals.alternativeCasts} casts for an alternative cost · ` +
          `${totals.explores} explores · ` +
          `${totals.typecyclings} typecyclings · ` +
          `${totals.untapSkips} untap skips · ` +
          `${totals.animations} permanents animated · ` +
          `${totals.fights} fights / ${totals.bites} bites · ` +
          `${totals.preventionShields} prevention shields put up (${totals.damagePrevented} damage prevented) · ` +
          `${totals.staticDamagePrevented} damage absorbed by a continuous prevention ability`,
      );

      if (SHARD) {
        writeShard(runs, totals);
      } else {
        assertFloors(totals, SEEDS);
      }
    },
    // ⚠️ A HANG CATCHER, NOT A PERF REFEREE (D133's testTimeout rule). The
    // wall grows with the arc's whole point — more scripts mean richer games
    // mean more events — and it crossed 600 s at 148 scripts (D167). A
    // second bus pass (lazy construction + present-def memo) measured ~2% at
    // 60 seeds, which is the proof the cost is the GAMES, not the bus.
    // History: 394 s @ 57 · 471 s @ 107 · 568 s @ 128 · timeout @ 148 ·
    // 589.6 s @ 148 · 622.7 s @ 174 · timeout @ 197 (D170 — the run
    // COMPLETED all 500 seeds with every hash equal at 1,162 s under desktop
    // load; ~145 s per 60 seeds projects ~900–1,200 s, straddling the old
    // ceiling even idle, on 2.84 M events / 24 K turns of genuinely richer
    // games) · 1,357 s @ 347 · 1,394.8 s @ 365 · 1,553.4 s @ 386 ·
    // 1,774.5 s @ 406 (D180's round 31 — completed, every hash equal, 26 s
    // under the old ceiling). Raised THREE times now, and only ever after a
    // completed-and-equal run proved the wall was growth rather than a hang.
    // ⚠️ THE NAMED LEVER WAS TRIED AND MEASURED FLAT (D181): reordering the
    // candidate loop to run `matches` before the `hasAbilities` derive — the
    // whole of D169's "self-only dispatch" idea, structurally identical by
    // conjunction-commutes — moved a 60-seed leg from 221.6 s to 222.3 s.
    // The bus is FLAT at 406 scripts; D167's verdict holds. The wall is the
    // games, the games are the arc's point, and the honest response is this
    // ceiling on its stated criterion — not a lever that measures 0%.
    3_600_000,
  );

  /**
   * ⚠️ ITS OWN TIMEOUT, and the number is measured rather than guessed. Idle, with the limit
   * lifted, this test passes in 25.7 s against the 20 s default - it plays 300 intents and D357
   * put a library search in every seat's pool, so a whole library is revealed and cleared inside
   * that loop repeatedly. Raised only after a COMPLETED run proved growth rather than a hang,
   * which is the rule the 500-seed ceiling is raised under (D167, D170, D181), and raised HERE
   * rather than for the file so a genuine hang in the six tests beside it still fails fast.
   */
  test('a fuzzed game never leaks a library into any projection', () => {
    const p = picker('leak');
    const game = Game.create(
      makeSpec({ players: 4, seed: 'leak', decks: [poolFor(0, 0), poolFor(0, 1), poolFor(0, 2), poolFor(0, 3)], librarySize: 60 }),
      deps(SCRIPTS),
      { checkInvariants: false },
    );
    for (let i = 0; i < 300; i++) {
      const intent = nextIntent(game.state, p);
      if (!intent) break;
      game.submit(intent);
    }
    for (const viewer of game.state.seating) {
      const view = project(game.state, ORACLE, game.deps.scripts, viewer);
      const libraries = new Set(game.state.seating.flatMap((x) => [...(game.state.zones.library[x] ?? [])]));
      // ⚠️ THE BOUNDARY, not a blanket ban. A library card may appear in a
      // projection for exactly one reason — it has been revealed to THIS viewer,
      // which is what a peek is and has been since M3. This assertion used to
      // read "no library card, ever", and it passed only because nothing in this
      // file could peek; the fuzzer does now, so it says what it means.
      for (const id of Object.keys(view.cards)) {
        if (!libraries.has(id)) continue;
        expect(
          game.state.cards[id]?.revealedTo.includes(viewer),
          `${viewer} can see library card ${id} without it being revealed to them`,
        ).toBe(true);
      }
      // ⚠️ And the ORDER exception is bounded the same way: `peek` is only ever
      // my OWN library, only cards revealed to me, and only the run from the top
      // — the three clauses that stop it becoming "the client knows the deck".
      const ownLibrary = game.state.zones.library[viewer] ?? [];
      for (const [i, id] of view.peek.entries()) {
        expect(ownLibrary.includes(id), `${viewer} peeked at a card not in their library`).toBe(true);
        expect(game.state.cards[id]?.revealedTo.includes(viewer)).toBe(true);
        expect(ownLibrary[ownLibrary.length - 1 - i], `peek is not the top run, in order`).toBe(id);
      }
      // ⚠️ D357 - THE SECOND LIBRARY EXCEPTION, bounded by the same three clauses. A search shows
      // its searcher the SET of their library and never the ORDER, and never anyone else at all.
      // Without this the gate would not notice a search leaking the shuffle order, which is the
      // one thing the design exists to prevent.
      const searchingNow =
        game.state.priority.awaiting?.kind === 'searchLibrary' &&
        game.state.priority.awaiting.player === viewer;
      if (!searchingNow) {
        expect(view.searching, `${viewer} is offered a search with no search prompt up`).toEqual([]);
      }
      for (const id of view.searching) {
        expect(ownLibrary.includes(id), `${viewer} is offered a card not in their library`).toBe(true);
        expect(game.state.cards[id]?.revealedTo.includes(viewer)).toBe(true);
      }
      // ⚠️ SORTED, which is the whole point: the library order must not survive the projection.
      const searchNames = view.searching.map(
        (id) => ORACLE.byPrinting(game.state.cards[id]?.printingId ?? '')?.name ?? id,
      );
      expect([...searchNames], 'searching is not sorted - the library order would leak').toEqual(
        [...searchNames].sort(),
      );
      // ⚠️ AND THE TWO EXCEPTIONS NEVER OVERLAP: while a search is up the peek is empty, or the
      // peek would walk the revealed library from the top and hand back the order anyway.
      if (searchingNow) expect(view.peek, 'peek is live during a search').toEqual([]);
      for (const other of game.state.seating) {
        expect(view.zones[zoneId('lib', other)]).toBeUndefined();
        if (other === viewer) continue;
        for (const id of view.zones[zoneId('hand', other)] ?? []) {
          expect(view.cards[id]?.card, `${viewer} can see ${other}'s ${id}`).toBeNull();
        }
      }
    }
    // D405 - the budget moves on a COMPLETED run (D370's rule): the driver's convoke / improvise / delve fallback
    // changed seed 'leak''s shape from a game wedged at intent 200 (5,779 events, 18 permanents) into one that
    // plays all 300 (10,818 events, 41 permanents) - 47 s alone on the idle machine, past 60 s in six shards.
  }, 180_000);

  // D387 - an explicit budget, the projection-leak test's (D269), because this one plays a 200-intent
  // game and then REPLAYS the whole log five times over the shipped registry, and it runs in EVERY
  // shard at once. Measured: 18.7 s ALONE on the idle machine at 5,232 scripts, 25.8-30.6 s in four of
  // six concurrent shards - past the 20 s default with every assertion green (D370's rule: a budget
  // moves only after a COMPLETED run proves growth rather than a hang). The cost is the game, not the
  // rewind: seed 0's pool shifts with every name the sorted list gains (D193/D365), so the game this
  // test plays changes shape with each wave.
  test('a fuzzed game rewinds to any point and still replays', () => {
    const p = picker('rewind');
    const game = Game.create(
      makeSpec({ players: 4, seed: 'rewind', decks: [poolFor(0, 0), poolFor(0, 1), poolFor(0, 2), poolFor(0, 3)], librarySize: 60 }),
      deps(SCRIPTS),
      { checkInvariants: false },
    );
    const marks: number[] = [];
    for (let i = 0; i < 200; i++) {
      const intent = nextIntent(game.state, p);
      if (!intent) break;
      game.submit(intent);
      if (i % 40 === 0) marks.push(game.log.length);
    }
    for (const mark of marks.reverse()) {
      expect(game.rewind(mark)).toBe(true);
      expect(checkInvariants(game.state)).toEqual([]);
      expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
    }
  }, 60_000);
});


describe('the sharded gate adds up (D296)', () => {
  test.skipIf(AGGREGATE === null)('every seed ran exactly once across the shards, and the floors hold over the union', () => {
    const dir = AGGREGATE as string;
    const files = readdirSync(dir)
      .filter((f) => /^shard-\d+\.json$/.test(f))
      .sort();
    expect(files.length).toBeGreaterThan(0);
    const seen = new Map<number, string>();
    let sum = zeroTotals();
    for (const f of files) {
      const shard = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { seeds: number[]; totals: Totals };
      for (const s of shard.seeds) {
        expect(seen.has(s), `seed ${s} ran in both ${seen.get(s)} and ${f}`).toBe(false);
        seen.set(s, f);
      }
      sum = addTotals(sum, shard.totals);
    }
    const missing: number[] = [];
    for (let s = 0; s < SEEDS; s++) if (!seen.has(s)) missing.push(s);
    expect(missing).toEqual([]);
    expect(seen.size).toBe(SEEDS);
    // eslint-disable-next-line no-console
    console.log(
      `fuzz (union of ${files.length} shards): ${SEEDS} seeds · ${sum.accepted} accepted intents · ${sum.events} events · ` +
        `${sum.turns} turns · ${sum.finished} games finished · ${sum.targetPrompts} target prompts · ` +
        `${sum.triggersFired} triggered abilities · ${sum.activatedRun} activated abilities resolved by script`,
    );
    assertFloors(sum, SEEDS);
  });
});