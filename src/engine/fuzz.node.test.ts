import { describe, expect, test } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Game } from './game';
import { checkInvariants } from './invariants';
import { castCostCandidates, legalActions } from './legal';
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
import { candidatesFromState, legalTargetsFor, minimumLegalTargets } from './targets';
import { targetingSourceFor } from './loop';
import type { TargetChoice } from './types/state';
import { predicateAdmits } from '../data/replacementParse';
import { revealAdmits } from './triggers';
import { freeCastCandidates, handChoiceCandidates, madnessCastAdmits } from './handChoice';
import { armyTokens, leastToughnessCreatures, ringBearerCandidates } from './effects';
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

/** D473 - the Eldrazi Spawn and Scion token oracles the quoted descriptions resolve to (`TOKEN_TABLE`, the `|q=` keys). */
const SPAWN_ORACLES: ReadonlySet<string> = new Set(['3aaf906a-e749-4e86-ac79-97650b92f271', '0eb3cd4b-c34e-448c-a9ab-e7b0b4524833']);
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
  // D513 - five Doom Blades beside it: the pools' kill density has decayed as the scripted names grew (2 / 2 / 0 / 1 / 0 dies
  // triggers over the 60-seed canaries of D510-D513, and 0 over D513's 500-seed gate - the floor's first red since D175), so the
  // staple carries its own killer; the driver aims the Blade at a random nonblack creature and the colorless 2/2 is one
  // (a Bolt would double-count: FIXED_CORE deals one a seat already, and the staple accounting is exact).
  // D514 - eight a seat: five read 11 over D513's 500-seed gate but 0 over the next 60-seed canary (the rotation moved again).
  { names: ['Onulet', 'Doom Blade'], copiesPerSeat: 8,
    counterKeys: ['diesTriggers'], rotHistory: 'D158 D175 D513 D514' },
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
  // D445 - two a seat: proliferations read 2 over 500 seeds at D445's first gate.
  { names: ['Grim Affliction'], copiesPerSeat: 2,
    counterKeys: ['proliferateAsks', 'proliferations'], rotHistory: 'D391, D445' },
  // D393 - threaten (CR 514.2): a {2}{R} sorcery every seat can cast whose control change ENDS,
  // so the cleanup revert is exercised at gate size.
  // D445 - ROTTED to 0 over 500 seeds (3, 1, 2 at the three gates before) once the staples reshaped the pools: three a seat.
  { names: ['Act of Treason'], copiesPerSeat: 3,
    counterKeys: ['controlTaken', 'controlReverted'], rotHistory: 'D393, D445' },
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
  // D443 - ROTTED to 0 kicked entries over 500 seeds (1 / 1, 2 / 0, 1 / 0 at the last three 60-seed reads) once two
  // exert staples reshaped the pools - the third rot, so a MECHANISM (D180): the offer says whether the kick is
  // payable (`kickerAffordable`) and the driver kicks exactly then, never on a coin. Copies unchanged.
  { names: ['Ardent Soldier'], copiesPerSeat: 2,
    counterKeys: ['kickedCasts', 'kickedEntries'], rotHistory: 'D403, D443' },
  // D443 - and a THREE-mana kicked permanent ({1}{W} + {B}): the driver's random land drops reach four mana rarely.
  { names: ['Benalish Sleeper'], copiesPerSeat: 2,
    counterKeys: ['kickedEntries'], rotHistory: 'D443' },
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
  // D445 - two a seat: convoked casts read 4 over 500 seeds at D445's first gate.
  { names: ["Pack's Favor", 'Hooting Mandrills'], copiesPerSeat: 2,
    counterKeys: ['convokedCasts', 'delvedCasts'], rotHistory: 'D405, D445' },
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
  // D490 - the conditional free cast: two Cho-Arrim Legates a seat (`If an opponent controls a Swamp and you control
  // a Plains, you may cast this spell without paying its mana cost` - the core deals a basic of each colour, so the
  // condition holds once the lands are down, and the driver always elects an available, affordable alternative).
  { names: ['Cho-Arrim Legate'], copiesPerSeat: 2,
    counterKeys: ['freeCasts'], rotHistory: 'D490' },
  // D491 - the from-hand free cast: two Sram's Expertises a seat ({2}{W}{W}: three Servos, then `You may cast a spell
  // with mana value 3 or less from your hand without paying its mana cost` - the chooser is asked whenever a cheap
  // castable spell is in hand, and the driver answers it half the time).
  { names: ["Sram's Expertise"], copiesPerSeat: 2,
    counterKeys: ['freeGrantsAsked', 'freeGrantCasts'], rotHistory: 'D491' },
  // D492 - the once-per-turn trigger: two Ghoulish Processions a seat ({1}{B} enchantment, `Whenever one or more nontoken
  // creatures die, create a 2/2 black Zombie creature token with decayed. This ability triggers only once each turn.` - it
  // never dies in combat, and creatures die every few turns at gate size) and two Irreverent Gremlins ({1}{R}, `Whenever
  // another creature you control with power 2 or less enters, ...` - the core's Bears); the second match of a turn is
  // the case the rider suppresses (Morbid Opportunist alone read 1 firing over 60 seeds).
  { names: ['Ghoulish Procession', 'Irreverent Gremlin'], copiesPerSeat: 2,
    counterKeys: ['onceTriggersFired'], rotHistory: 'D492' },
  // D493 - the look grammar: two Elvish Rejuvenators a seat ({2}{G} 3/3, `look at the top five cards of your library. You
  // may put a land card from among them onto the battlefield tapped. Put the rest on the bottom of your library in a random
  // order.` - the pick onto the battlefield, the new destination) and two Satyr Wayfinders ({1}{G} 1/1, `reveal the top four
  // cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard.` - a
  // public reveal); the driver answers a library look off the revealed run through the filter, as before.
  { names: ['Elvish Rejuvenator', 'Satyr Wayfinder'], copiesPerSeat: 2,
    counterKeys: ['looksToBattlefield', 'looksRevealed'], rotHistory: 'D493' },
  // D494 - the previous clause's objects: two Forces of Rage a seat ({2}{R} instant, `Create two 3/1 red Elemental creature
  // tokens with trample and haste. Sacrifice those tokens at the beginning of your next upkeep.` - the delayed clause armed
  // with the tokens as its aims) and two Turns to Mist a seat ({1}{W/U} instant, the flicker: `Exile target creature. Return
  // that card to the battlefield under its owner's control at the beginning of the next end step.`).
  { names: ['Force of Rage', 'Turn to Mist'], copiesPerSeat: 2,
    counterKeys: ['objectsBound', 'objectsActed'], rotHistory: 'D494' },
  // D501 - the spell's own fate: two Treasured Finds a seat ({B}{G} sorcery, `Return target card from your graveyard to
  // your hand. Exile Treasured Find.` - one graveyard card of any kind to aim at, two mana: the fuel) and two Beacons
  // of Creation a seat ({3}{G} sorcery, `Create a 1/1 green Insect creature token for each Forest you control. Shuffle
  // Beacon of Creation into its owner's library.` - no target, the shuffle form when four mana are there).
  // ⚠️ The first fuel here was Restock ({3}{G}{G}, two graveyard targets) beside the Beacon, and over sixty seeds neither
  // was ever cast (`spellFates` 0, canary501): a four- and a five-mana sorcery on a seat of four basics is no fuel.
  { names: ['Treasured Find', 'Beacon of Creation'], copiesPerSeat: 2,
    counterKeys: ['spellFates'], rotHistory: 'D501' },
  // D502 - the extra turn: two Savors of the Moment a seat ({1}{U}{U} sorcery, `Take an extra turn after this one. Skip
  // the untap step of that turn.` - no target, three mana: the extra turn taken on the seat's next turn, its untap
  // step skipped).
  { names: ['Savor the Moment'], copiesPerSeat: 2,
    counterKeys: ['extraTurnsAdded', 'extraTurnsTaken'], rotHistory: 'D502' },
  // D504 - the previous object's controller: two Beast Withins and two Generous Gifts a seat ({2}{G} / {2}{W} instants,
  // `Destroy target permanent. Its controller creates a 3/3 green Beast / Elephant creature token.` - the token goes to
  // the destroyed permanent's controller, bound as the clause runs).
  { names: ['Beast Within', 'Generous Gift'], copiesPerSeat: 2,
    counterKeys: ['referentPlayers'], rotHistory: 'D504' },
  // D505 - the mass verbs over a scope: two Vitalizes and two Bonds of Discipline a seat ({G} instant `Untap all
  // creatures you control.`; {4}{W} sorcery `Tap all creatures your opponents control. Creatures you control gain
  // lifelink until end of turn.` - the scope walked, the marker counted).
  { names: ['Vitalize', 'Bond of Discipline'], copiesPerSeat: 2,
    counterKeys: ['scopesWalked'], rotHistory: 'D505' },
  // D507 - the referent search: two Paths to Exile a seat ({W} instant, `Exile target creature. Its controller may search
  // their library for a basic land card, put that card onto the battlefield tapped, then shuffle.` - the search asked of
  // the exiled creature's controller, who accepts the offer and finds in their own library).
  { names: ['Path to Exile'], copiesPerSeat: 2,
    counterKeys: ['referentSearches'], rotHistory: 'D507' },
  // D508 - the hand put: two Swells of Growth a seat ({1}{G} instant, `Target creature gets +2/+2 until end of turn. You
  // may put a land card from your hand onto the battlefield.` - the pump on a creature the seat controls, then the
  // question over the hand; the driver puts the most expensive land it holds).
  // ⚠️ D509 - a pump instant is thin fuel under a driver that picks a random legal action: 2 hand puts over the 3,000-seed
  // gate at D508 and 0 at D509's first run (25 casts and activations for 1 question over 20 seeds - the ask needs the
  // resolution to find a land in hand, and a random activation of Walking Atlas or a Swell with a target is rare).
  // Arboreal Grazer ({G} 0/3, `When this creature enters, you may put a land card from your hand onto the battlefield
  // tapped.` - its D508 row) is the fuel: a one-drop the driver casts, the question raised by the entry itself.
  // ⚠️ D509 - and the FLOOR is the clause, not the put: the driver plays a land the moment it draws one, so a resolution
  // finds a land in hand only when two were drawn together - 7 Grazer entries and 21 Atlas activations over 20 seeds put
  // nothing. The executor names the clause it ran with an empty `PutFromHand` (D505's `ScopeWalked` with no members);
  // `handPutClauses` counts the clauses, `handPuts` the cards, `handPutAsks` the questions.
  { names: ['Arboreal Grazer', 'Walking Atlas'], copiesPerSeat: 2,
    counterKeys: ['handPutClauses'], rotHistory: 'D508 D509' },
  // D510 - the untap choice, the mass can't-block and the wheel: two Snaps a seat ({1}{U} instant, `Return target creature to
  // its owner's hand. Untap up to two lands.` - the queue's untap verb asked of the caster), two Falters ({1}{R} instant,
  // `Creatures without flying can't block this turn.` - the scope walked, no target) and two Timetwisters ({2}{U}
  // sorcery, `Each player shuffles their hand and graveyard into their library, then draws seven cards.`).
  // Timetwister ({2}{U}) over Time Reversal ({3}{U}{U}): the five-mana sorcery wheeled nobody over 60 seeds (canary510).
  { names: ['Snap', 'Falter', 'Timetwister'], copiesPerSeat: 2,
    counterKeys: ['untapChoices', 'massCantBlocks', 'wheels'], rotHistory: 'D510' },
  // D511 - bolster (CR 701.37): two Cached Defenses ({2}{G} sorcery, `Bolster 3.`) and two Abzan Advantages ({1}{W} instant,
  // `Target player sacrifices an enchantment. Bolster 1.`) a seat - the queue's bolster verb over the caster's least-toughness
  // creature, asked on a tie; the marker `Bolstered` is written on every path (the null-card one too). 1 over 20 seeds with
  // Cached Defenses alone; the two-mana instant is the fuel.
  { names: ['Cached Defenses', 'Abzan Advantage'], copiesPerSeat: 2, counterKeys: ['bolsters'], rotHistory: 'D511' },
  // D519 - ENERGY (CR 122.1): the enters gain (Sage of Shaila's Claim, Bristling Hydra), the activation the offer withholds
  // short of the counters (the Hydra's `Pay {E}{E}{E}`), the attack prompt with an energy price (Aether Chaser's Servo).
  { names: ["Sage of Shaila's Claim", 'Bristling Hydra', 'Aether Chaser'], copiesPerSeat: 3, counterKeys: ['energyGained', 'energyPaid'], rotHistory: 'D519' },
  // D520 - AMASS (CR 701.47): Relentless Advance ({3}{U} sorcery, `Amass Zombies 3.`), Lazotep Reaver ({1}{B} 1/2, `When this
  // creature enters, amass Zombies 1.`) and Dunland Crebain ({2}{B} 1/1 flying, `... amass Orcs 2.` - the Orc onto a Zombie
  // Army) two a seat: the Army token made and grown, the subtype added, the tie asked when a copy effect made a second.
  { names: ['Relentless Advance', 'Lazotep Reaver', 'Dunland Crebain'], copiesPerSeat: 2, counterKeys: ['amasses'], rotHistory: 'D520' },
  // D521 - THE RING TEMPTS YOU (CR 701.54): Claim the Precious ({2}{B} sorcery, `Destroy target creature. The Ring tempts
  // you.`), Birthday Escape ({U} sorcery, `Draw a card. The Ring tempts you.`), Took Reaper ({B} 1/1, dies: tempts) and
  // Relentless Rohirrim ({3}{R} 3/2, enters: tempts) two a seat: the bearer chosen, the emblem given, its abilities as
  // the count climbs (the loot on attack, the blocker's sacrifice, the drain).
  { names: ['Claim the Precious', 'Birthday Escape', 'Took Reaper', 'Relentless Rohirrim'], copiesPerSeat: 2, counterKeys: ['ringTempts', 'ringAbilities'], rotHistory: 'D521' },
  // D522 - THE MONARCH (CR 724): Grave Venerations ({3}{B} enchantment, `When this enchantment enters, you become the
  // monarch.` and an end-step return gated on wearing it), Garrulous Sycophant ({2}{B} 1/4, the end-step drain gated on
  // the crown) and Throne Warden ({1}{W} 2/2, the counter gated on it) two a seat: the crown handed out by a payload,
  // read by an intervening if, and taken back by D332's combat steal.
  { names: ['Grave Venerations', 'Thorn of the Black Rose', 'Garrulous Sycophant', 'Throne Warden'], copiesPerSeat: 2, counterKeys: ['crownings'], rotHistory: 'D522' },
  // D523 - THE GATED CLAUSE: For the Family ({G} instant, `Target creature gets +2/+2 until end of turn. If you control
  // four or more creatures, that creature gets +4/+4 until end of turn instead.`) and Resourceful Return ({1}{B} sorcery,
  // `Return target creature card from your graveyard to your hand. If you control an artifact, draw a card.`) two a seat:
  // the board decides which reading runs, and the log says which either way.
  { names: ['For the Family', 'Resourceful Return'], copiesPerSeat: 2, counterKeys: ['gatedClauses'], rotHistory: 'D523' },
  // D525 - CASCADE: two Bloodbraid Elves ({2}{R}{G} 3/2 haste, cascade) and two Ardent Pleas ({1}{W}{U} exalted,
  // cascade) a seat - the keyword trigger off the spell on the stack; the driver answers the exiled candidate's
  // chooser through the same pool the host admits, and declines it half the time.
  { names: ['Bloodbraid Elf', 'Ardent Plea'], copiesPerSeat: 2, counterKeys: ['cascades', 'cascadeCasts'], rotHistory: 'D525' },
  // D526 - MANIFEST: two Soul Summons ({1}{W}: manifest the top card) and two Manifest Dreads ({1}{G}: look at two, one
  // face down, one into the graveyard - the driver answers the look) a seat; a manifested creature card is offered face
  // up for its mana cost, which the driver takes when it can afford it (`TurnFaceUp` is a usable action).
  { names: ['Soul Summons', 'Manifest Dread'], copiesPerSeat: 2, counterKeys: ['manifests', 'manifestDreads'], rotHistory: 'D526' },
  // D527 - CLASH: two Release the Ants and two Research the Deeps a seat - each clashes with an opponent (two placement
  // prompts, the harness's scry answer keeps the card on top) and returns itself to hand on a win (D523's gate over the
  // verdict); in a four-seat game the caster is asked which opponent (the first candidate).
  { names: ['Release the Ants', 'Research the Deep'], copiesPerSeat: 2, counterKeys: ['clashes', 'clashWins'], rotHistory: 'D527' },
  // D528 - SAGAS: two Origins of the Hulk and two Births of Meletis a seat - each enters with a lore counter (chapter I),
  // gets one as its controller's precombat main begins (II, III) and is sacrificed once the final chapter has resolved.
  { names: ['Origin of the Hulk', 'The Birth of Meletis'], copiesPerSeat: 2, counterKeys: ['chaptersFired', 'sagasSacrificed'], rotHistory: 'D528' },
  // D530 - THE KICKER'S OTHER COSTS: two Final Flourishes (kicked by sacrificing an artifact or creature - the driver
  // names the first candidates) and two Thornscape Battlemages (kicker {R} and/or {W} - the driver names both when both
  // are payable, else the second) a seat.
  { names: ['Final Flourish', 'Thornscape Battlemage'], copiesPerSeat: 2, counterKeys: ['kickerVerbCasts', 'secondKickerCasts'], rotHistory: 'D530' },
  // D531 - CONTROL WITH A DURATION AND THE EXCHANGE: two Political Trickeries (the exchange of two lands) and two Sowers
  // of Temptation (a creature held for as long as Sower stays) a seat.
  { names: ['Political Trickery', 'Sower of Temptation'], copiesPerSeat: 2, counterKeys: ['controlGained', 'controlHeld'], rotHistory: 'D531' },
  // D533 - MONSTROSITY: two Fleecemane Lions and two Sinuous Vermin a seat (the cheapest Monstrosity activations rowed).
  { names: ['Fleecemane Lion', 'Sinuous Vermin'], copiesPerSeat: 2, counterKeys: ['monstrosities'], rotHistory: 'D533' },
  // D534 - COIN FLIP: two Winter Skies a seat (a flip, and a branch either way).
  { names: ['Winter Sky'], copiesPerSeat: 2, counterKeys: ['rulesFlips'], rotHistory: 'D534' },
  // D535 - BUYBACK: two Searing Touches a seat (a one-mana ping, bought back for {4} more).
  { names: ['Searing Touch'], copiesPerSeat: 2, counterKeys: ['buybackCasts', 'buybackReturns'], rotHistory: 'D535' },
  // D536 - STORM: two Grapeshots a seat (a ping, copied for each spell cast before it this turn).
  { names: ['Grapeshot'], copiesPerSeat: 2, counterKeys: ['stormTriggers', 'stormCopies'], rotHistory: 'D536, D537' },
  // D537 - no retrace or jump-start staple: two Flame Jabs and a Direct Current a seat moved every seed's game (the 60-seed
  // canary lost its buyback returns and D398's floor, 8,396 accepted intents -> 7,255) and still cast no retrace - the
  // graveyard casts are the proofs' (retrace.test.ts); the fuzz counts them where the pool deals them, with no floor.
  // D512 - the additional combat phase (CR 500.8): two Seize the Days ({2}{R} sorcery, `Untap target creature. After this main
  // phase, there is an additional combat phase followed by an additional main phase.`) and two Relentless Assaults ({2}{R}{R},
  // the attacked-this-turn untap) a seat - the clause queues the phases, the phase end inserts them, the turn resumes after.
  // Relentless Assault alone was cast by nobody over 20 seeds (fuzz20-512).
  // D513 - three a seat: two a seat read 2 clauses over the first 60 seeds at D512 and 0 at D513 (the rotation moved).
  { names: ['Seize the Day', 'Relentless Assault'], copiesPerSeat: 3, counterKeys: ['extraCombats', 'insertedPhases'], rotHistory: 'D512 D513' },
  // D514 - the object's stat as last known: two Sheltering Words a seat ({1}{G} instant, `Target creature you control gains
  // hexproof until end of turn. You gain life equal to that creature's toughness.`) - the read on the battlefield; the
  // last-known read (a destroyed creature's toughness) has no cheap spell and is the executor test's.
  { names: ['Sheltering Word'], copiesPerSeat: 3, counterKeys: ['statReads'], rotHistory: 'D514' },
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
  // D412 - connive (CR 701.50): Raffine's Informant connives as it enters - a {W} 1/1 every seat can cast; the
  // driver answers the discard as it answers any hand prompt.
  { names: ["Raffine's Informant"], copiesPerSeat: 1,
    counterKeys: ['connives'], rotHistory: 'D412' },
  // D413 - the exile-instead rider (CR 614.1): Lava Coil marks its target (3 at 60 alone); Anger of the Gods marks
  // every creature it damages; the mark redirects the death this turn.
  { names: ['Lava Coil', 'Anger of the Gods'], copiesPerSeat: 1,
    counterKeys: ['exileMarks'], rotHistory: 'D413' },
  // D414 - the `another` qualifier (CR 115.10 by way of `specAdmits`): Selfless Savior and Torch Courier
  // sacrifice themselves for another creature (no mana - the driver takes them), Manifold Key untaps another
  // artifact (colourless), Kiora's Follower another permanent ({G}{U} - 1 at 60 alone), and Trained Condor's
  // attack trigger gives another creature flying (0 at 60 alone - the driver rarely attacks). Never itself.
  { names: ['Selfless Savior', 'Torch Courier', 'Manifold Key', "Kiora's Follower", 'Trained Condor'], copiesPerSeat: 1,
    counterKeys: ['anotherTargets'], rotHistory: 'D414' },
  // D415 - the verb price at resolution: a discard for a draw, a sacrifice for two counters, and two
  // enters taxes (a land card discarded, a Forest sacrificed) - the driver pays half the prompts it can.
  { names: ['Viashino Racketeer', 'Harvester Troll', 'Fallow Wurm', 'Rogue Elephant'], copiesPerSeat: 1,
    counterKeys: ['verbPricesPaid'], rotHistory: 'D415' },
  // D416 - the hand reveal and choose (CR 701.15a): Duress, Thoughtseize and Coercion reveal a player's hand
  // to every seat and the caster picks from it (a targeted sorcery is thin fuel, D413 - three of them).
  { names: ['Duress', 'Thoughtseize', 'Coercion'], copiesPerSeat: 1,
    counterKeys: ['handChoicesAsked'], rotHistory: 'D416' },
  // D417 - the play permission: Reckless Impulse and Wrenn's Resolve exile the top two and let the caster
  // play them until the end of their next turn; the driver casts and plays from exile through the legal list.
  { names: ['Reckless Impulse', "Wrenn's Resolve", 'Act on Impulse'], copiesPerSeat: 2,
    counterKeys: ['playedFromExile'], rotHistory: 'D417' },
  // D418 - the count expression: Wellwisher and Timberwatch Elf count the Elves on the battlefield (themselves
  // at least) off a {T}; Spontaneous Generation counts the hand. The driver activates and casts them freely.
  { names: ['Wellwisher', 'Timberwatch Elf', 'Spontaneous Generation'], copiesPerSeat: 2,
    counterKeys: ['countsResolved'], rotHistory: 'D418' },
  // D422 - the counterspell family: Remand (to the hand) and Dissipate (to exile) counter whatever the driver aims
  // them at; Abrupt Decay is the uncounterable spell a counter may meet.
  { names: ['Remand', 'Dissipate', 'Abrupt Decay'], copiesPerSeat: 1,
    counterKeys: ['countersRedirected'], rotHistory: 'D422' },
  // D423 - the kicked instead: a bolt and a token spell whose kicked clause replaces the base (the driver always
  // tries the kick, D403).
  { names: ['Burst Lightning', 'Saproling Migration', 'Gift of Growth'], copiesPerSeat: 2,
    counterKeys: ['kickedInsteadSkipped'], rotHistory: 'D423' },
  // D427 - the scoped shield: Harmless Assault (a SOURCE filter - attacking creatures, combat-wide like Fog) and
  // Forfend (a RECIPIENT set - creatures) need no target, so the driver casts them wherever it holds them.
  { names: ['Harmless Assault', 'Forfend'], copiesPerSeat: 2,
    counterKeys: ['scopedShields'], rotHistory: 'D427' },
  // D428 - the triggering player: Copper Tablet ({2}, every seat) pings the player whose upkeep it is, Oppression
  // makes whoever cast a spell discard - both name their player off the event (`playerOf`) and ask no target.
  { names: ['Copper Tablet', 'Oppression'], copiesPerSeat: 1,
    counterKeys: ['playerReferents'], rotHistory: 'D428' },
  // D431 - the queue's return verb: a bounce land every seat can play - it enters and asks its player to return a
  // land they control (the land itself when it is the only one), which the driver answers as it answers a sacrifice.
  { names: ['Dimir Aqueduct'], copiesPerSeat: 2,
    counterKeys: ['returnsResolved'], rotHistory: 'D431' },
  // D432 - the draw heads: Fate Unraveler ({3}{B} - one black source, where Underworld Dreams' {B}{B}{B} went uncast
  // at 60 seeds) pings whoever draws (once per card, the drawing player named off the event); every seat draws
  // every turn, so the head fires wherever the creature lands.
  { names: ['Fate Unraveler'], copiesPerSeat: 2,
    counterKeys: ['drawHeadFires'], rotHistory: 'D432' },
  // D433 - the draw-step head: Font of Mythos ({4}) makes each player draw two more in their draw step and Kami of
  // the Crescent Moon ({U}{U}) one more - a colourless body and a cheap one, two a seat each, where Font alone (one a
  // seat) went uncast over 60 seeds in these mana-light pools; the active player named off the step.
  { names: ['Font of Mythos', 'Kami of the Crescent Moon'], copiesPerSeat: 2,
    counterKeys: ['drawStepHeadFires'], rotHistory: 'D433' },
  // D434 - the mill vocabulary: Hedron Crab ({U}, landfall - target player mills three) and Millstone ({2}; {2}, {T}:
  // target player mills two) - a trigger and an activation, a coloured body and a colourless one, two a seat each.
  { names: ['Hedron Crab', 'Millstone'], copiesPerSeat: 2,
    counterKeys: ['millsResolved'], rotHistory: 'D434' },
  // D435 - the if-you-do pair: Stadium Tidalmage ({3}{U} - enters or attacks: a cast is a fire), Rook Turret ({3} - another
  // artifact you control enters) and Riddlesmith ({1}{U} - you cast an artifact spell) loot off the seat's own casts; two a
  // seat each, so the pair fires without a second event or the coin's consent (the counter reads the stack, not the prompt).
  { names: ['Stadium Tidalmage', 'Rook Turret', 'Riddlesmith'], copiesPerSeat: 2,
    counterKeys: ['ifYouDoFires'], rotHistory: 'D435' },
  // D436 - the graveyard-card target: Honored Heirloom ({3}; {2}, {T}: exile target card from a graveyard) and Crypt
  // Creeper ({1}{B}; sacrifice: the same) - a colourless activation and a cheap one; the graveyards fill by turn two.
  { names: ['Honored Heirloom', 'Crypt Creeper'], copiesPerSeat: 2,
    counterKeys: ['graveyardAims'], rotHistory: 'D436' },
  // D437 - the spell's X: Blaze ({X}{R} - X damage to any target), two a seat; the driver names X 0..2 and the count
  // reads the casts announced for more than nothing.
  { names: ['Blaze'], copiesPerSeat: 2,
    counterKeys: ['spellXCasts'], rotHistory: 'D437' },
  // D439 - the upkeep prices: Shivan Raptor (echo {1}{R}) and Illusionary Forces (cumulative upkeep {U}), two a
  // seat; the trigger fires at the next upkeep of anything the driver cast, and the prompt is raised only while
  // the price is payable (an unpayable one sacrifices without a question, D369).
  { names: ['Shivan Raptor', 'Illusionary Forces'], copiesPerSeat: 2,
    counterKeys: ['upkeepPricesFired'], rotHistory: 'D439' },
  // D440 - extort (Syndic of Tithes - every spell the seat casts asks for {W/B}), modular (two Arcbound Workers - a
  // dying one may move its counter to the other) and scavenge (Deadbridge Goliath - a graveyard activation the
  // driver picks like any other); the trigger on the stack is the floor.
  { names: ['Syndic of Tithes', 'Deadbridge Goliath'], copiesPerSeat: 1,
    counterKeys: ['extortsFired'], rotHistory: 'D440' },
  { names: ['Arcbound Worker'], copiesPerSeat: 2,
    counterKeys: ['modularMoves'], rotHistory: 'D440' },
  // D441 - the reveal lands: Port Town asks for a Plains or Island from the hand as it enters - three a seat, because
  // the pool holds one Plains and one Island in ~150 cards and the question needs one in hand at the drop (0 asks at
  // 60 seeds with one copy); the driver reveals on its coin flip, and a hand with nothing to show taps silently.
  { names: ['Port Town'], copiesPerSeat: 3,
    counterKeys: ['revealsAsked'], rotHistory: 'D441' },
  // D443 - exert: the three two-drops with a reflexive pump (one per colour the core deals), three a seat, and the
  // driver exerts EVERY exertable attacker it declares - it rarely attacks (the gate's standing fact), so two
  // copies on a coin flip read 5 exerts over 500 seeds and 0 over a 60-seed leg.
  { names: ['Gust Walker'], copiesPerSeat: 3,
    counterKeys: ['exerts'], rotHistory: 'D443' },
  { names: ['Nef-Crop Entangler'], copiesPerSeat: 3,
    counterKeys: ['exertTriggers'], rotHistory: 'D443' },
  { names: ['Bitterblade Warrior'], copiesPerSeat: 3,
    counterKeys: ['exerts'], rotHistory: 'D443' },
  // D444 - the entry choices: an unleash two-drop and a riot two-drop, asked as they enter (the driver flips).
  // The one-hybrid-mana Cackler and the mono-red Shaman, three a seat: Gore-House Chainwalker x2 read 4 then 0 asks
  // at 60 seeds, Zhur-Taa Goblin's {R}{G} one, Arcbound Slasher's {4}{R} none.
  { names: ['Rakdos Cackler'], copiesPerSeat: 3,
    counterKeys: ['unleashAsked'], rotHistory: 'D444' },
  { names: ['Clamor Shaman'], copiesPerSeat: 3,
    counterKeys: ['riotAsked'], rotHistory: 'D444' },
  // D445 - backup: a {2}{W} vigilance creature whose entry puts a counter on a target and grants vigilance.
  { names: ['Sigiled Sentinel'], copiesPerSeat: 3,
    counterKeys: ['backupsFired'], rotHistory: 'D445' },
  // D448 - unearth: a {1}{B} 2/1 that comes back from the graveyard for {B} with haste, exiled at the end step.
  { names: ['Dregscape Zombie'], copiesPerSeat: 3,
    counterKeys: ['unearths'], rotHistory: 'D448' },
  // D449 - the keyword alternative costs: an evoke flier (sacrificed as it enters) and a dash two-drop (haste, back
  // to hand at the end step); the driver elects an alternative cost when it can pay it.
  { names: ['Mulldrifter'], copiesPerSeat: 2,
    counterKeys: ['evokedCasts'], rotHistory: 'D449' },
  { names: ['Zurgo Bellstriker'], copiesPerSeat: 3,
    counterKeys: ['dashedCasts'], rotHistory: 'D449' },
  // D450 - the counted-down keywords: a vanishing 5/5 and a fading 5/5 a seat (both shroud - no aims lost to them).
  { names: ['Calciderm'], copiesPerSeat: 2,
    counterKeys: ['vanishingTicks'], rotHistory: 'D450' },
  { names: ['Blastoderm'], copiesPerSeat: 2,
    counterKeys: ['fadingFires'], rotHistory: 'D450' },
  // D451 - the hand activations: a reinforce 4/4 a seat (two counters on a target for {1}{G} and the card).
  { names: ['Bannerhide Krushok'], copiesPerSeat: 2,
    counterKeys: ['handActivations'], rotHistory: 'D451' },
  // D453 - the control Auras: two Control Magics a seat (the aim is random, D445 - a creature of anyone's).
  { names: ['Control Magic'], copiesPerSeat: 2,
    counterKeys: ['controlAuras'], rotHistory: 'D453' },
  // D457 - exhaust: a Prowcatcher Specialist a seat ({3}{R} once per object - the driver pays it when it can).
  { names: ['Prowcatcher Specialist'], copiesPerSeat: 2,
    counterKeys: ['exhaustActivations'], rotHistory: 'D457' },
  // D458 - boast: a Fearless Pup a seat ({2}{R} after it attacked, once a turn - the driver attacks and pays by chance).
  { names: ['Fearless Pup'], copiesPerSeat: 2,
    counterKeys: ['boastActivations'], rotHistory: 'D458' },
  // D459 - fabricate: a Weaponcraft Enthusiast a seat (the entry choice, answered at random - counters or Servos).
  { names: ['Weaponcraft Enthusiast'], copiesPerSeat: 2,
    counterKeys: ['fabricateFired'], rotHistory: 'D459' },
  // D460 - disguise: a Museum Nightwatch a seat (cast face down for {3} with ward {2}, turned up for {1}{W}).
  { names: ['Museum Nightwatch'], copiesPerSeat: 2,
    counterKeys: ['disguiseCasts'], rotHistory: 'D460' },
  // D462 - ninjutsu: a Mukotai Ambusher a seat ({1}{B} and an unblocked attacker returned, in the combat window).
  { names: ['Mukotai Ambusher'], copiesPerSeat: 2,
    counterKeys: ['ninjutsus'], rotHistory: 'D462' },
  // D463 - mobilize: a Shock Brigade a seat ({1}{R}, mobilize 1 whenever it attacks - a Warrior tapped and attacking;
  // the four-mana Lancer was never cast over 150 seeds - a seat holds three basics, D445). D465 - FOUR a seat: two
  // read 0 at 60 and 150 seeds on the D465 tree (15 over the D464 gate`s 500), and the rate is the deal, not the
  // mechanism (8 fires in one 20-seed shard at twelve a seat).
  { names: ['Shock Brigade'], copiesPerSeat: 4,
    counterKeys: ['mobilizeFired'], rotHistory: 'D463, D465' },
  // D465 - the chosen creature type: a Shared Triumph a seat ({1}{W}; the entry prompt the driver answers Bear,
  // the anthem the generated static reads off the answer).
  { names: ['Shared Triumph'], copiesPerSeat: 2,
    counterKeys: ['creatureTypesChosen'], rotHistory: 'D465' },
  // D469 - the shield counter: a Disciplined Duelist a seat ({G}{W}, enters with one); the Bolts, the blocks and the
  // sweeps the pool already deals spend it (CR 122.1i, the funnel and the three destroy sites).
  { names: ['Disciplined Duelist'], copiesPerSeat: 2,
    counterKeys: ['shieldCountersPut', 'shieldCountersSpent'], rotHistory: 'D469' },
  // D470 - the stun counter: a Rowdy Snowballers a seat ({2}{U}; taps an opponent`s creature and stuns it on entry - the
  // counter spent at that creature's next untap step by the built-in, CR 122.1j).
  { names: ['Rowdy Snowballers'], copiesPerSeat: 2,
    counterKeys: ['stunCountersPut', 'stunCountersSpent'], rotHistory: 'D470' },
  // D472 - the loyalty ability: a Jace Beleren a seat ({1}{U}{U}; +2 each player draws, −1 target player draws - the
  // driver activates whichever is offered at sorcery speed, once a turn).
  { names: ['Jace Beleren'], copiesPerSeat: 2,
    counterKeys: ['loyaltyActivations'], rotHistory: 'D472' },
  // D473 - the quoted token: a Nest Invader a seat ({1}{G} 2/2; enters with a 0/1 Eldrazi Spawn whose quoted
  // `Sacrifice this token: Add {C}.` is the printing's own, run by the mana path).
  { names: ['Nest Invader'], copiesPerSeat: 2,
    counterKeys: ['spawnTokensMade', 'spawnTokensSpent'], rotHistory: 'D473' },
  // D474 - a token printing's own def: a Chocobo Racetrack a seat ({2}{G} enchantment; each land drop makes a 2/2 Bird
  // whose own landfall pump - the printing's line, rowed like a card - fires on the next land drop).
  { names: ['Chocobo Racetrack'], copiesPerSeat: 2,
    counterKeys: ['tokenTriggersFired'], rotHistory: 'D474' },
  // D476 - the trigger's own number: a Mourning Thrull a seat ({1}{W/B} 1/1 flier; `Whenever this creature deals damage,
  // you gain that much life` - the damage it dealt rides the trigger onto the stack as `memo`, the gain reads it).
  { names: ['Mourning Thrull'], copiesPerSeat: 2,
    counterKeys: ['memoTriggers'], rotHistory: 'D476' },
  // D484 - the prompt continuation: a Vampiric Tutor a seat ({B}; `Search your library for a card, then shuffle and put
  // that card on top. You lose 2 life.`) - the search always asks while the library holds a card, the question carries
  // the life loss, and the driver's answer (it finds whenever it can) runs it.
  { names: ['Vampiric Tutor'], copiesPerSeat: 3,
    counterKeys: ['continuationsCarried', 'continuationsRun'], rotHistory: 'D484' },
  // D485 - the token copy (CR 707): two Cackling Counterparts a seat ({1}{U}{U}; `Create a token that's a copy of
  // target creature you control`) - a copy made whenever the driver aims it at a creature it controls.
  { names: ['Cackling Counterpart'], copiesPerSeat: 2,
    counterKeys: ['tokenCopiesMade'], rotHistory: 'D485' },
  // D486 - the clone (CR 707.9): two Clones a seat ({3}{U}; `You may have this creature enter as a copy of any creature
  // on the battlefield`) - the funnel holds its move and asks; the driver copies a random creature three times in four.
  // D487 - two a seat: one read 4 clones over 60 seeds at D486 and 0 once the deal shifted under the spell-copy staple.
  { names: ['Clone'], copiesPerSeat: 2,
    counterKeys: ['clonesEntered'], rotHistory: 'D486, D487' },
  // D487 - the spell copy (CR 707.10): two Expansion // Explosions a seat (Expansion is {U/R}{U/R}; `Copy target instant
  // or sorcery spell with mana value 4 or less. You may choose new targets for the copy.`) - a copy made whenever the
  // driver casts the half at a spell on the stack (its own, held priority after a cast, or another seat's); the copy's
  // new targets asked, kept one time in three. Hybrid, because Reverberate's {R}{R} read 0 copies over 60 seeds: a
  // second red source beside the core's one Mountain is rare (D403's lesson), and the half needs the mana OPEN while
  // a spell is on the stack.
  // Four a seat: two read 0 copies over 60 seeds even with the copy-first pick - a copier was in hand at 4% of the
  // driver's stack decisions and an instant or sorcery on the stack at 16% (diag487), and the two never met.
  { names: ['Expansion // Explosion'], copiesPerSeat: 4,
    counterKeys: ['spellsCopied'], rotHistory: 'D487' },
  // D488 - populate (CR 701.31): two Eyes in the Skies a seat ({3}{W}; `Create a 1/1 white Bird creature token with
  // flying, then populate.`) - the populate copies the Bird the same resolution made (the batch is folded first), and
  // with other creature tokens about the driver is asked which (the D390 queue's question, its own verb).
  { names: ['Eyes in the Skies'], copiesPerSeat: 2,
    counterKeys: ['populates'], rotHistory: 'D488' },
  // D489 - suspend (CR 702.62): two Rift Sowers a seat (`Suspend 2—{G}`; a 2/2 Elf Druid for {2}{G}) - the driver
  // suspends when the offer is affordable, the tick fires at its next two upkeeps, and the free cast follows.
  { names: ['Rift Sower'], copiesPerSeat: 2,
    counterKeys: ['suspends'], rotHistory: 'D489' },
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
  // D530 - ROTTED to 0 over 500 seeds (3, 4, 3 at the three gates before) once the kicker staples reshaped the
  // pools: five a seat.
  { names: ['Cindering Cutthroat', "Drana's Emissary", 'Courier Bat'], copiesPerSeat: 5,
    counterKeys: ['thisTurnEntersWith', 'thisTurnTriggers'], rotHistory: 'D398, D530' },
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
  // D445 - TEN of each basic: one was a single source of its colour in ~300 cards (eight percent land - a real deck
  // is a third), and every coloured canary outside the seat's identity starved: Act of Treason, Lava Coil and Anger
  // of the Gods were in hand and unaffordable at every probe, on one to four lands mid-game. Three of each moved
  // nothing; ten (a fifth of the pool) with the land drop taken first is the shape every rate reads against now.
  ...Array<readonly string[]>(10).fill(['Forest', 'Island', 'Mountain', 'Plains', 'Swamp']).flat(),
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
// D474 - a TOKEN printing's script (a Pest's dies trigger, a Rat's can't-block) is registered like any other and
// never dealt: a token is not a library card, and a name shared with a card (`Wizard`) would deal the wrong thing.
// D475 - nor an EMBLEM printing's (layout `other`): an object a card gives, never a card in a library.
const SCRIPTED_SORTED: readonly string[] = SHIPPED_SCRIPTS.filter((s) => { const l = ORACLE.byOracle(s.oracleId)?.layout; return l !== 'token' && l !== 'other'; }).map((s) => s.name)
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
  // ⚠️ `Ajani's Mantra` SHIPS since D429 (`cards/ajanisMantra`, the subjectless `Gain 1 life.` under its
  // optional landfall trigger) - the testing copy that stood here since M6.4a for the optional-trigger
  // prompt would be the duplicate the throw below refuses; the shipped def is optional too.
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
      // D443 - every exertable attacker (the prompt lists them) is exerted: the attack itself is the rare event.
      return {
        t: 'DeclareAttackers',
        player: awaiting.player,
        attackers: chosen.map((card) => (awaiting.exertable.includes(card) ? { card, defender: { kind: 'player' as const, id: defender }, exert: true } : { card, defender: { kind: 'player' as const, id: defender } })),
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
    // D437 - the spell's X is a coin flip over 0..1 (`simplestAnswer` names zero, and zero is the half that scales
    // nothing; one extra mana is what the pool usually has spare - 0..2 named ONE cast for more over 60 seeds): a value
    // the pool cannot pay is refused at the payment and the driver's next pick names another.
    case 'chooseX':
      return { t: 'ChooseX', player: awaiting.player, x: p.below(2) };
    case 'optionalTrigger':
      return {
        t: 'AnswerOptionalTrigger',
        player: awaiting.player,
        stackId: awaiting.stackId,
        accept: p.below(2) === 0,
      };
    // D369 - a coin flip for the reason above: the paying half is the one that charges a
    // plan, and the prompt is raised only while the host can suggest one, so no plan rides.
    case 'payMana': {
      const pay = p.below(2) === 0;
      // D415 - a VERB price is paid with the first `count` of the candidates the host would accept -
      // the prompt's own for a public zone, `castCostCandidates` over the hand for a discard (the
      // same list the answer is checked against, D139) - so the paying half is reached, never refused.
      const v = awaiting.verbs;
      if (!pay || !v) return { t: 'AnswerPayMana', player: awaiting.player, pay };
      const count = v.sacrificeSelf ? 1 : (v.sacrificeCost?.count ?? v.discardCost?.count ?? v.tapCost?.count ?? v.exileFromGraveyardCost?.count ?? v.returnCost?.count ?? 0);
      let pool: readonly InstanceId[] = awaiting.candidates ?? [];
      if (!awaiting.candidates && !v.sacrificeSelf) {
        const cache = makeDeriveCache(state);
        const cand = castCostCandidates(state, (cid) => derive(state, ORACLE, SCRIPTS, cid, cache), awaiting.player, awaiting.source ?? awaiting.card ?? '', v);
        pool = Object.values(cand.fields).find((x): x is readonly InstanceId[] => Array.isArray(x)) ?? [];
      }
      const picks = pool.slice(0, count);
      return picks.length === count ? { t: 'AnswerPayMana', player: awaiting.player, pay: true, picks } : { t: 'AnswerPayMana', player: awaiting.player, pay: false };
    }
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
      // D416 - the hand reveal's pick: the owner's hand through the one reader the host asks.
      const pool =
        awaiting.owner !== undefined
          ? [...handChoiceCandidates(state, ORACLE, awaiting.owner, { none: awaiting.none ?? [], filter: awaiting.filter ?? null, qualifier: awaiting.qualifier ?? null })]
          : awaiting.zone === 'library'
          ? (state.zones.library[awaiting.player] ?? []).filter((id) => {
              const inst = state.cards[id];
              if (!inst || !inst.revealedTo.includes(awaiting.player)) return false;
              const face = ORACLE.byPrinting(inst.printingId)?.faces[0];
              // D493 - the look grammar's negations (`noncreature, nonland`): the types the pick must lack.
              if (face && (awaiting.none ?? []).some((t) => face.typeLine.types.includes(t))) return false;
              if (!awaiting.filter) return true;
              return face ? predicateAdmits(face, awaiting.filter.predicates) : false;
            })
          : awaiting.zone === 'battlefield'
            // D511 - a computed pick (bolster's least toughness) is the host's own set.
            ? awaiting.pick === 'leastToughness' ? [...leastToughnessCreatures(state, deps(SCRIPTS), awaiting.player)] : awaiting.pick === 'army' ? [...armyTokens(state, deps(SCRIPTS), awaiting.player)] : awaiting.pick === 'ringBearer' ? [...ringBearerCandidates(state, deps(SCRIPTS), awaiting.player)] : state.zones.battlefield.filter((id) => {
                // D390 - a queued sacrifice: my own permanents the printed noun admits.
                const inst = state.cards[id];
                if (!inst || inst.controller !== awaiting.player) return false;
                if (!awaiting.filter) return true;
                // D488 - a populate's noun names a TOKEN; the host refuses a card (a rejected answer spends the seed).
                if (awaiting.filter.predicates.some((p) => p.token === true) && !inst.isToken) return false;
                const face = ORACLE.byPrinting(inst.printingId)?.faces[0];
                return face ? predicateAdmits(face, awaiting.filter.predicates) : false;
              })
            // D491 - the from-hand free cast's pick: my own hand through the one reader the host asks (a card the
            // host refuses spends the seed); the answer may be empty, and `want` below declines it half the time.
            : awaiting.castFree === true
              // D541 - a madness prompt: the pool's card when the host reads it castable and payable now.
              ? awaiting.madness !== undefined
                ? (awaiting.pool ?? []).filter((id) => madnessCastAdmits(state, deps(SCRIPTS), id))
                : [...freeCastCandidates(state, deps(SCRIPTS), awaiting.player, { none: awaiting.none ?? [], filter: awaiting.filter ?? null, qualifier: awaiting.qualifier ?? null }, awaiting.pool)]
              // D509 - the hand put's pool (D508): the cards of the hand the printed noun admits (the host's reader); the whole hand
              // offered a creature to a land put and the answer was refused - 2 hand puts over the 3,000-seed gate at D508, 0 at D509.
              : awaiting.to === 'battlefield'
                ? [...handChoiceCandidates(state, ORACLE, awaiting.player, { none: awaiting.none ?? [], filter: awaiting.filter ?? null, qualifier: awaiting.qualifier ?? null })]
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
    case 'chooseTargets': {
      // D445 - a RANDOM legal candidate per required pick (the harness takes the first, which is usually the
      // caster's own oldest permanent - a threaten aimed that way changes nothing). Short of a legal pick, the
      // cast is cancelled, as the harness would.
      // D487 - a copy's new targets: one time in three the copy keeps the original's (the empty answer), else a random
      // legal set; short of one, it keeps them - a copy is never cancelled.
      const keep = awaiting.forKind === 'copy';
      if (keep && p.below(3) === 0) return { t: 'ChooseTargets', player: awaiting.player, targets: [] };
      const src = targetingSourceFor(state, deps(SCRIPTS), awaiting.source, awaiting.player, awaiting.lki);
      if (!src) return keep ? { t: 'ChooseTargets', player: awaiting.player, targets: [] } : simplestAnswer(awaiting, state);
      const pool = candidatesFromState(state, deps(SCRIPTS));
      const picked: TargetChoice[] = [];
      for (const spec of awaiting.specs) {
        for (let i = 0; i < spec.min; i++) {
          const legal = legalTargetsFor(spec, src, pool).filter((c) => !picked.some((q) => q.kind === c.kind && q.id === c.id));
          if (legal.length === 0) return keep ? { t: 'ChooseTargets', player: awaiting.player, targets: [] } : { t: 'CancelPendingCast', player: awaiting.player };
          picked.push(legal[p.below(legal.length)] as TargetChoice);
        }
      }
      return { t: 'ChooseTargets', player: awaiting.player, targets: picked };
    }
    case 'entersChoice': {
      // D441 - a reveal price: on the paying half of the flip, the first hand card the noun admits (the prompt
      // ships no candidates - the driver reads the state, as the answerer reads its own hand).
      if (awaiting.reveal !== undefined) {
        const any = awaiting.reveal.any;
        const shown = (state.zones.hand[awaiting.player] ?? []).find((id) => revealAdmits(state, ORACLE, id, any));
        return shown !== undefined && p.below(2) === 0
          ? { t: 'AnswerEntersChoice', player: awaiting.player, source: awaiting.source, pay: true, reveal: shown }
          : { t: 'AnswerEntersChoice', player: awaiting.player, source: awaiting.source, pay: false };
      }
      const life = state.players[awaiting.player]?.life ?? 0;
      return {
        t: 'AnswerEntersChoice',
        player: awaiting.player,
        source: awaiting.source,
        pay: life >= awaiting.life && p.below(2) === 0,
      };
    }
    // D459 - a modal prompt answered at random among the legal modes (the harness takes the first, and a
    // fabricate's Servo mode - every modal trigger's second mode - was never played over 150 seeds).
    case 'chooseModes': {
      const want = Math.min(awaiting.max, Math.max(awaiting.min, 1));
      const pool = [...awaiting.legal];
      const modes: number[] = [];
      while (modes.length < want && pool.length > 0) {
        const m = p.pick(pool);
        if (m === undefined) break;
        modes.push(m);
        pool.splice(pool.indexOf(m), 1);
      }
      if (modes.length < awaiting.min && awaiting.forKind !== 'trigger') return { t: 'CancelPendingCast', player: awaiting.player };
      return { t: 'ChooseModes', player: awaiting.player, modes };
    }
    // D486 - the clone's choice: a random candidate, or (one time in four) itself - both branches are fuel.
    case 'chooseCopy': {
      const pick = awaiting.candidates.length > 0 && p.below(4) !== 0 ? (awaiting.candidates[p.below(awaiting.candidates.length)] ?? null) : null;
      return { t: 'AnswerChooseCopy', player: awaiting.player, source: awaiting.source, card: pick };
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
/**
 * D487 - a COPY SPELL in hand with a spell on the stack it may copy (the face's `copySpell` clause, its target
 * clause satisfiable now): the driver casts it before anything else, the way it kicks and plays lands. The uniform
 * pick reached the copy 0 times over 60 seeds with two Reverberates and then two Expansions a seat - the spell to
 * copy must be on the stack AND the mana open at the same priority, which the driver holds right after its own cast
 * and rarely spends there. Checked for a legal target first: a copier cast at a creature spell would be cancelled at
 * the targets question and picked again on the same board.
 */
/** D490 - a cast for an alternative cost of nothing (`AlternativeCost.free`), read off the card's face. */
function isFreeAlternative(state: GameState, obj: { readonly card: InstanceId | null; readonly faceIndex: number }): boolean {
  const inst = obj.card === null ? undefined : state.cards[obj.card];
  const card = inst ? ORACLE.byPrinting(inst.printingId) : undefined;
  return card !== undefined && faceOf(card, obj.faceIndex).alternativeCost?.free === true;
}

function copyTargetOnStack(state: GameState, holder: PlayerId, id: InstanceId, faceIndex: number): boolean {
  const inst = state.cards[id];
  const card = inst ? ORACLE.byPrinting(inst.printingId) : undefined;
  if (!card) return false;
  const face = faceOf(card, faceIndex);
  if (!face.effects.some((e) => e.kind === 'copySpell') || face.targets.length === 0) return false;
  const src = targetingSourceFor(state, deps(SCRIPTS), id, holder) ?? { controller: holder, colors: face.colors };
  return minimumLegalTargets(face.targets, src, candidatesFromState(state, deps(SCRIPTS))) !== null;
}

/**
 * D487 - the other half of the copy fuel: with a payable copier in hand and an empty stack, the driver casts an
 * instant or sorcery it can aim (not a copier itself) before anything else, so the next priority - its own, held
 * after the cast - finds a spell to copy. Checked for a legal target: a cast cancelled at the targets question would
 * be picked again on the same board.
 */
function copyableSpellToCast(state: GameState, holder: PlayerId, id: InstanceId, faceIndex: number): boolean {
  const inst = state.cards[id];
  const card = inst ? ORACLE.byPrinting(inst.printingId) : undefined;
  if (!card) return false;
  const face = faceOf(card, faceIndex);
  if (face.isPermanent || face.isLand || face.effects.some((e) => e.kind === 'copySpell')) return false;
  if (face.targets.length === 0) return true;
  const src = targetingSourceFor(state, deps(SCRIPTS), id, holder) ?? { controller: holder, colors: face.colors };
  return minimumLegalTargets(face.targets, src, candidatesFromState(state, deps(SCRIPTS))) !== null;
}

function holdsCopier(state: GameState, holder: PlayerId, usable: readonly LegalAction[]): boolean {
  return usable.some((a) => {
    if (a.t !== 'CastSpell' || !a.affordable) return false;
    const inst = state.cards[a.card];
    const card = inst ? ORACLE.byPrinting(inst.printingId) : undefined;
    return card !== undefined && faceOf(card, a.faceIndex).effects.some((e) => e.kind === 'copySpell') && inst?.controller === holder;
  });
}

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
/**
 * D530 - the kick the driver names (D443: kicked exactly when payable, never on a coin): both kickers of a two-kicker
 * face when both are payable, else its second alone, else the first; a verb kicker with the first candidates of its
 * verb (the offer's own list, the host re-validating).
 */
function kickOf(a: Extract<LegalAction, { t: 'CastSpell' }>): Record<string, unknown> {
  if (a.kickerBothAffordable === true) return { kicked: 2, kickedWith: [0, 1] };
  if (a.kickerSecondAffordable === true) return { kicked: 1, kickedWith: [1] };
  if (a.kicker && a.kickerAffordable === true) return { kicked: 1 };
  if (a.kickerVerbAffordable === true) {
    const n = a.kickerPickCount ?? 0;
    const picked = (a.kickerPickCandidates ?? []).slice(0, n);
    const verb = a.kickerPickVerb;
    return { kicked: 1, ...(verb !== undefined && n > 0 ? { [verb]: picked } : {}) };
  }
  return {};
}

/** D535 - the buyback the driver pays: whenever the offer says the bought-back cast is payable (a verb: its first candidates). */
function buyOf(a: Extract<LegalAction, { t: 'CastSpell' }>): Record<string, unknown> {
  if (a.buyback === undefined || a.buybackAffordable !== true) return {};
  if (a.buyback === 'mana') return { buyback: true };
  const n = a.buybackPickCount ?? 0;
  const picked = (a.buybackPickCandidates ?? []).slice(0, n);
  const verb = a.buybackPickVerb;
  return { buyback: true, ...(verb !== undefined && n > 0 ? { [verb]: picked } : {}) };
}

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
  // D418 - the doubling guard: a board of forty or more permanents takes no activation (Krenko's Goblins).
  const crowded = state.zones.battlefield.filter((id) => state.cards[id]?.controller === holder).length >= 40;
  const usable = actions.filter((a) => (a.t !== 'CastSpell' && a.t !== 'TurnFaceUp' && a.t !== 'Suspend' && a.t !== 'Foretell') || a.affordable || (a.t === 'CastSpell' && (altFor(a) !== null || (a.alternativeAvailable === true && a.alternativeAffordable === true)))).filter((a) => !(crowded && a.t === 'ActivateAbility'))
    // D535 - a mana-buyback spell waits in hand until it can be cast bought back.
    .filter((a) => !(a.t === 'CastSpell' && a.buyback === 'mana' && a.buybackAffordable !== true));
  // D443 - a kicker card whose kick is payable is cast now, kicked (D408's rule for an alternative cost): the
  // uniform pick over every usable action reached a kicked Ardent Soldier once in sixty seeds, and the kicked
  // ENTRY canary rotted to 0 over 500. The plain branch stays the early turns' (the kick unaffordable).
  // D530 - the first-priority list stays the MANA kicker's (D443): a verb kicker cast the moment it was payable
  // sacrificed a creature every time and rotted the D398 floor to 0 over 500 seeds; the new kicks ride the ordinary
  // pick, `kickOf` naming them whenever the card is chosen.
  const kickable = usable.filter((a) => a.t === 'CastSpell' && a.kicker !== undefined && a.kickerAffordable === true);
  // D535 - and a spell whose MANA buyback is payable is cast now, bought back (0 over 60 seeds on the ordinary pick).
  const buyable = usable.filter((a) => a.t === 'CastSpell' && a.buyback === 'mana' && a.buybackAffordable === true);
  // D537 - a STORM spell is cast now once a spell has been cast this turn (D536's gate: 17 triggers, no copy over 500).
  const castThisTurn = Object.values(state.turn.spellsCast).reduce((n, k) => n + k, 0);
  const stormable = castThisTurn === 0 ? [] : usable.filter((a) => a.t === 'CastSpell' && (ORACLE.byPrinting(state.cards[a.card]?.printingId ?? '')?.faces[a.faceIndex]?.keywords.includes('storm') ?? false));
  // D445 - the land drop first: the uniform pick skipped most of them, and every three-mana canary starved (a seat
  // on one to three lands mid-game). A land is played whenever one can be; which land stays random.
  const lands = usable.filter((a) => a.t === 'PlayLand');
  // D487 - a copy spell with a spell on the stack to copy is cast first (see `copyTargetOnStack`).
  const copiers = state.stack.length === 0 ? [] : usable.filter((a) => a.t === 'CastSpell' && copyTargetOnStack(state, holder, a.card, a.faceIndex));
  // D487 - and with a payable copier in hand and nothing on the stack, an instant or sorcery to copy is cast first.
  const copyable = state.stack.length === 0 && holdsCopier(state, holder, usable) ? usable.filter((a) => a.t === 'CastSpell' && a.affordable && copyableSpellToCast(state, holder, a.card, a.faceIndex)) : [];
  const chosen = lands.length > 0 ? p.pick(lands) : copiers.length > 0 ? p.pick(copiers) : copyable.length > 0 ? p.pick(copyable) : kickable.length > 0 ? p.pick(kickable) : buyable.length > 0 ? p.pick(buyable) : stormable.length > 0 ? p.pick(stormable) : p.pick(usable);
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
      // D423 - a plain cast is the other half of every kicker card (and the only cast the pool can pay early), so
      // both branches of a kicked clause are fuel. D443 - the kick is taken exactly when the offer says it is
      // payable (D180's mechanism for the kicked-entry canary, which read 0 over 500 seeds on a coin flip): the
      // plain branch is the early turns', the kicked branch the later ones' - neither waits on a coin.
      return { t: 'CastSpell', player: holder, card: chosen.card, ...(chosen.faceDown ? { faceDown: true } : {}), ...kickOf(chosen), ...buyOf(chosen), ...(altFor(chosen) ?? {}), ...castPicksOf(chosen) };
    case 'TurnFaceUp':
      // D309 - the special action: pay the morph cost, turn it face up.
      return { t: 'TurnFaceUp', player: holder, card: chosen.card };
    case 'Suspend':
      // D489 - the special action: pay the suspend cost, exile the card with its time counters.
      return { t: 'Suspend', player: holder, card: chosen.card };
    case 'Foretell':
      // D540 - the special action: pay {2}, exile the card face down (cast from exile on a later turn).
      return { t: 'Foretell', player: holder, card: chosen.card };
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
  /** D449 - the entry moves marked evoke / dash, the evoke sacrifices on the stack, the dash returns resolved. */
  readonly evokedCasts: number;
  readonly dashedCasts: number;
  readonly evokeSacrifices: number;
  readonly dashReturns: number;
  /** D450 - the vanishing upkeep ticks, the last-counter sacrifices, the fading upkeep fires. */
  readonly vanishingTicks: number;
  readonly vanishingSacrifices: number;
  readonly fadingFires: number;
  /** D451 - the abilities on the stack whose source was discarded from the hand as the cost (reinforce, bloodrush). */
  readonly handActivations: number;
  /** D453 - the control Auras: the permanents taken through an Aura, and the give-backs. */
  readonly controlAuras: number;
  readonly controlAuraReverts: number;
  /** D457 - the exhaust abilities put on the stack (each at most once per object - the invariant walker checks). */
  readonly exhaustActivations: number;
  /** D458 - the boast abilities put on the stack (their source attacked this turn - the offer says so). */
  readonly boastActivations: number;
  /** D459 - the fabricate triggers put on the stack, and the Servos they made (the other mode is the counters). */
  readonly fabricateFired: number;
  readonly fabricateServos: number;
  /** D460 - the face-down casts of a DISGUISE card, and the turns face up of one (the ward rode in between). */
  readonly disguiseCasts: number;
  readonly disguiseUnmasks: number;
  /** D462 - the ninjutsu activations put on the stack (the defender remembered on the object). */
  readonly ninjutsus: number;
  /** D463 - the mobilize triggers put on the stack, and the Warriors that joined a combat attacking. */
  readonly mobilizeFired: number;
  readonly mobilizeWarriors: number;
  /** D465 - the creature types named as a permanent entered (`CreatureTypeChosen`, CR 614.12). */
  readonly creatureTypesChosen: number;
  /** D469 - the shield counters removed in place of damage or a destruction (CR 122.1i). */
  readonly shieldCountersSpent: number;
  readonly shieldCountersPut: number;
  /** D470 - the stun counters put on permanents, and the ones the untap built-in removed in place of an untap (CR 122.1j). */
  readonly stunCountersPut: number;
  readonly stunCountersSpent: number;
  /** D472 - the loyalty abilities put on the stack (CR 606; the cost charged in counters). */
  readonly loyaltyActivations: number;
  /** D473 - the Eldrazi Spawn and Scions created off a quoted description, and the ones sacrificed for {C}. */
  readonly spawnTokensMade: number;
  readonly spawnTokensSpent: number;
  /** D474 - a token printing's OWN triggered ability put on the stack (the printings rowed like cards). */
  readonly tokenTriggersFired: number;
  /** D475 - the emblems given (CR 114): a walker's ultimate the driver reached. */
  readonly emblemsGiven: number;
  /** D476 - a triggered ability put on the stack carrying its own number (`obj.memo`, the damage its head's event dealt). */
  readonly memoTriggers: number;
  /** D484 - questions raised carrying the clauses after them (`EffectContinuation`), and the answers that ran them. */
  readonly continuationsCarried: number;
  readonly continuationsRun: number;
  /** D485 - tokens created as COPIES of a permanent (`TokenCreated.copyOf`, CR 707). */
  readonly tokenCopiesMade: number;
  /** D486 - permanents that entered AS A COPY of another (`CardMove.asCopyOf`, CR 707.9). */
  readonly clonesEntered: number;
  /** D487 - copies of spells put on the stack (`SpellCopied`, CR 707.10). */
  readonly spellsCopied: number;
  /** D488 - populates (the `Populated` marker beside each token copy, CR 701.31). */
  readonly populates: number;
  /** D489 - cards suspended (the exile move that marks them, CR 702.62a). */
  readonly suspends: number;
  /** D489 - spells the suspend tick cast without paying (`StackObject.suspended`, CR 702.62d). */
  readonly suspendCasts: number;
  /** D490 - casts for an alternative cost of NOTHING (`AlternativeCost.free`, the conditional free cast). */
  readonly freeCasts: number;
  /** D491 - the from-hand free cast: the choosers raised (`chooseFromZone` with `castFree`) and the casts they began (`StackObject.freeCast`). */
  readonly freeGrantsAsked: number;
  readonly freeGrantCasts: number;
  /** D492 - once-per-turn triggers queued (`PendingTrigger.oncePerTurn`; the suppressed second match of a turn is never on the log). */
  readonly onceTriggersFired: number;
  /** D493 - the look grammar: library looks whose picks go onto the battlefield, and looks revealed to every seat. */
  readonly looksToBattlefield: number;
  readonly looksRevealed: number;
  /** D494 - delayed clauses armed with the previous clause's objects (`DelayedTrigger.aims`), and their fires that moved one. */
  readonly objectsBound: number;
  readonly objectsActed: number;
  /** D501 - spells that left the stack by their own printed fate (exiled, shuffled in, put on the bottom of a library). */
  readonly spellFates: number;
  /** D502 - extra turns created (CR 500.7), and extra turns actually begun (`TurnBegan.extra`). */
  readonly extraTurnsAdded: number;
  readonly extraTurnsTaken: number;
  /** D504 - clauses bound to the previous object's controller or owner (`ReferentPlayerBound`). */
  readonly referentPlayers: number;
  /** D505 - mass verbs that walked a scope (`ScopeWalked`). */
  readonly scopesWalked: number;
  /** D507 - referent searches: a search bound to the previous object's controller (`ReferentPlayerBound` with a search text). */
  readonly referentSearches: number;
  /** D508 - hand puts: cards put from a hand onto the battlefield by a put clause (`PutFromHand`). */
  readonly handPuts: number;
  /** D509 - the hand put's questions raised (a `chooseFromZone` over a hand with `to: 'battlefield'`), beside the puts made. */
  readonly handPutAsks: number;
  /** D509 - hand-put clauses that ran (every `PutFromHand`, an empty one included - the executor names the clause it ran). */
  readonly handPutClauses: number;
  /** D510 - untap choices resolved (an `AsksResolved` with the untap verb - the queue's fifth). */
  readonly untapChoices: number;
  /** D510 - mass can't-block walks (a `ScopeWalked` with verb massCantBlock). */
  readonly massCantBlocks: number;
  /** D510 - wheels into the library (a `WheelShuffled` per player). */
  readonly wheels: number;
  /** D511 - bolster clauses that ran (a `Bolstered` marker each - a chosen creature or none). */
  readonly bolsters: number;
  /** D520 - amass clauses that ran (an `Amassed` marker each - the Army that got the counters, or none). */
  readonly amasses: number;
  /** D523 - gated clauses that were ASKED (the executor says so either way: replaced, or did nothing). */
  readonly gatedClauses: number;
  /** D525 - cascade: the triggers queued off a cast spell, and the exiled candidates cast without paying (`freeCast` from exile). */
  readonly cascades: number;
  readonly cascadeCasts: number;
  /** D526 - manifest: the cards put onto the battlefield face down off a manifest, the dreads resolved, and the face-down cards turned up for a mana cost (no morph cost printed). */
  readonly manifests: number;
  readonly manifestDreads: number;
  readonly manifestFlips: number;
  /** D527 - clash: the clashes decided (`Clashed`), and the ones the clasher won. */
  readonly clashes: number;
  readonly clashWins: number;
  /** D528 - sagas: the lore counters put, the chapter abilities that went on the stack, the Sagas sacrificed after their last. */
  readonly loreCounters: number;
  readonly chaptersFired: number;
  readonly sagasSacrificed: number;
  /** D530 - the casts kicked by a kicker that is not only mana, and the casts kicked with a second kicker. */
  readonly kickerVerbCasts: number;
  readonly secondKickerCasts: number;
  /** D531 - the controls taken for good or exchanged (`ControlGained`), and the controls a source holds (`ControlTakenBySource`). */
  readonly controlGained: number;
  readonly controlHeld: number;
  /** D533 - the permanents that became monstrous (`BecameMonstrous`). */
  readonly monstrosities: number;
  /** D534 - the coin flips a resolution made (`CoinFlipped` not caused by the manual tool's `FlipCoin` intent). */
  readonly rulesFlips: number;
  /** D535 - the spells cast with their buyback paid, and the ones that went back to hand as they resolved. */
  readonly buybackCasts: number;
  readonly buybackReturns: number;
  /** D536 - the storm triggers put on the stack, and the copies of a storm spell they made. */
  readonly stormTriggers: number;
  readonly stormCopies: number;
  /** D537 - the spells cast from the graveyard by retrace, and by jump-start. */
  readonly retraceCasts: number;
  readonly jumpStartCasts: number;
  /** D538 - the rebound triggers armed, and the spells cast from exile by their rebound. */
  readonly reboundArms: number;
  readonly reboundCasts: number;
  /** D540 - the cards foretold (exiled face down from the hand), and the spells cast from exile whose face foretells. */
  readonly foretells: number;
  readonly foretoldCasts: number;
  /** D541 - the discards madness sent to exile, and the spells cast from exile whose face has madness. */
  readonly madnessExiles: number;
  readonly madnessCasts: number;
  /** D544 - the partner-with triggers put on the stack (a permanent with `Partner with <name>` entered). */
  readonly partnerWithTriggers: number;
  /** D545 - the sacrifices an exploit paid (a move tagged `exploitedBy`). */
  readonly exploitSacrifices: number;
  /** D546 - the token copies an embalm or an eternalize made (a TokenCreated with `noManaCost` among its exceptions). */
  readonly embalmTokens: number;
  /** D547 - the warp exiles (a move marked `warpedTurn`: the end-step exile a warp cast armed). */
  readonly warpExiles: number;
  /** D548 - the lands an awakened spell awakened (an `Awakened` event). */
  readonly awakenedLands: number;
  /** D549 - the token copies a myriad attack made (the end-of-combat exile each arms). */
  readonly myriadTokens: number;
  /** D550 - the split second spells cast (the stack locked while each waited). */
  readonly splitSecondCasts: number;
  /** D522 - the crown moving (a `MonarchChanged` each: a payload crowning someone, D332's combat steal, the wrench). */
  readonly crownings: number;
  /** D521 - temptations of the Ring (a `RingTempted` each - a bearer chosen or none), and the emblem abilities that fired (the loot, the blocked sacrifice, the drain). */
  readonly ringTempts: number;
  readonly ringAbilities: number;
  /** D519 - energy counters gained (`EnergyChanged` with a positive delta) and paid (a negative one). */
  readonly energyGained: number;
  readonly energyPaid: number;
  /** D512 - additional-phase clauses that ran (an `ExtraPhasesAdded` each). */
  readonly extraCombats: number;
  /** D512 - inserted phases begun (an `ExtraPhasesConsumed` carrying a resume step each). */
  readonly insertedPhases: number;
  /** D514 - stat reads for an amount (a `StatRead` each), and the ones read as last known among them. */
  readonly statReads: number;
  readonly lastKnownReads: number;
  /** D409 - permanents that explored (the `Explored` marker, CR 701.42c). */
  readonly explores: number;
  /** D410 - cycling discards whose card carries a TYPED cycling (the search, not the draw). */
  readonly typecyclings: number;
  /** D411 - untap skips SET (an effect's, or a depletion land's rider); the untap step spends them a turn later. */
  readonly untapSkips: number;
  /** D412 - permanents that connived (the `Connived` marker, CR 701.50c). */
  readonly connives: number;
  /** D413 - exile-instead marks set, and the deaths the funnel redirected to exile. */
  readonly exileMarks: number;
  readonly exiledInstead: number;
  /** D414 - the `another` staples' abilities that chose their target, and the self-picks among them (a hard zero). */
  readonly anotherTargets: number;
  readonly anotherSelfPicks: number;
  /** D415 - verb-price prompts raised (the price was payable), and the ones paid with picks. */
  readonly verbPricesAsked: number;
  readonly verbPricesPaid: number;
  /** D416 - hands revealed to every seat, and the picks the caster was asked for. */
  readonly handReveals: number;
  readonly handChoicesAsked: number;
  /** D417 - play permissions granted, and the casts and land plays taken out of exile under one. */
  readonly permissionsGranted: number;
  readonly playedFromExile: number;
  /** D418 - counted clauses resolved at a count of one or more, and at a count of zero (`counts nothing`). */
  readonly countsResolved: number;
  readonly countsEmpty: number;
  /** D422 - countered cards moved off the stack to a hand or a library (the countered-this-way destination), and the funnel's `can't be countered` line. */
  readonly countersRedirected: number;
  readonly uncounterableSaid: number;
  /** D423 - base clauses skipped for their kicked `instead` (the executor's `is replaced` line). */
  readonly kickedReplaced: number;
  /** D423 - instead clauses that said `does nothing` on an unkicked cast (the abundant branch; the floor). */
  readonly kickedInsteadSkipped: number;
  /** D428 - triggers that reached the stack carrying the player their head named (`StackObject.player`). */
  readonly playerReferents: number;
  /** D431 - player queues that resolved with the return verb (`AsksResolved` carrying `verb: 'return'`). */
  readonly returnsResolved: number;
  /** D432 - triggers of the draw heads that reached the stack (an opponent's or any player's draw, per card). */
  readonly drawHeadFires: number;
  /** D433 - triggers of the draw-step heads that reached the stack (each player's draw step, your own). */
  readonly drawStepHeadFires: number;
  /** D434 - mills that resolved: a `CardsMoved` whose every move is library to graveyard (a mill's one event). */
  readonly millsResolved: number;
  /** D435 - the if-you-do pair's fires: stack objects whose label carries the conditional sentence (a hand of one asks nothing). */
  readonly ifYouDoFires: number;
  /** D436 - abilities aimed at a card in a graveyard that reached the stack (a fire needs a legal aim: the target layer found one). */
  readonly graveyardAims: number;
  /** D437 - spells cast with an announced X above zero (the vocabulary scales their X clauses by it). */
  readonly spellXCasts: number;
  /** D439 - echo / cumulative upkeep triggers on the stack, the pay prompts they raised, the age counters put. */
  readonly upkeepPricesFired: number;
  /** D440 - extort triggers on the stack, modular counters moved to a target, scavenge activations on the stack. */
  readonly extortsFired: number;
  /** D441 - reveal-land prompts raised (a noun on the entersChoice), and one-card reveals shown to every seat. */
  readonly revealsAsked: number;
  readonly revealsShown: number;
  /** D442 - cleanup discard prompts raised (CR 514.1), and cleanup steps repeated for an SBA or a trigger (CR 514.3a). */
  readonly cleanupDiscards: number;
  readonly cleanupRepeats: number;
  /** D443 - creatures exerted as they attacked (CR 701.39), and the `When you do` triggers that put on the stack. */
  readonly exerts: number;
  readonly exertTriggers: number;
  /** D444 - the entry choices asked (unleash / riot), and the hastes chosen. */
  readonly unleashAsked: number;
  readonly riotAsked: number;
  readonly riotHastes: number;
  /** D445 - backup triggers on the stack, and the keyword-only until-end-of-turn grants of ANY source (backup among them). */
  readonly backupsFired: number;
  readonly keywordGrants: number;
  readonly modularMoves: number;
  readonly scavenges: number;
  /** D448 - unearth activations on the stack, and the exiles its riders performed (the end step, the leave). */
  readonly unearths: number;
  readonly unearthExiles: number;
  readonly upkeepPricesAsked: number;
  readonly agesAdded: number;
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
  /** D427 - shields put up with a source filter or a recipient set (the floor), and what such a shield stopped. */
  readonly scopedShields: number;
  readonly scopedPrevented: number;
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

  // D414 - the `another` staples' pushes, keyed by the SOURCE's name: Kiora's Follower's activation carries
  // its target on the object; Trained Condor's trigger takes it through StackTargetsSet (D147), so the
  // triggered ones are mapped by stack id to the Condor that pushed them.
  const ANOTHER_STAPLES = new Set(['Selfless Savior', 'Torch Courier', 'Manifold Key', "Kiora's Follower", 'Trained Condor']);
  const nameOf = (id: InstanceId | null): string => {
    const inst = id === null ? undefined : game.state.cards[id];
    return inst === undefined ? '' : (ORACLE.byPrinting(inst.printingId)?.name ?? '');
  };
  const anotherPushes = game.log.flatMap((e) =>
    e.body.t === 'AbilityPutOnStack' && ANOTHER_STAPLES.has(nameOf(e.body.obj.source)) ? [e.body.obj] : [],
  );
  const anotherTriggers = new Map<string, InstanceId | null>();
  for (const o of anotherPushes) if (o.kind === 'triggered') anotherTriggers.set(o.id, o.source);

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
    // D427 - the scoped shields: a source filter or a set recipient on the record; the damage they stopped is read
    // off the spends by shield id.
    scopedShields: game.log.reduce((n, e) => (e.body.t === 'PreventionShieldsAdded' ? n + e.body.shields.filter((s) => s.source !== undefined || s.recipient.kind === 'creatures' || s.recipient.kind === 'playerAndTheirs').length : n), 0),
    scopedPrevented: (() => {
      const scoped = new Set<string>();
      for (const e of game.log) if (e.body.t === 'PreventionShieldsAdded') for (const s of e.body.shields) if (s.source !== undefined || s.recipient.kind === 'creatures' || s.recipient.kind === 'playerAndTheirs') scoped.add(s.id);
      return game.log.reduce((n, e) => (e.body.t === 'DamagePrevented' ? n + e.body.spends.filter((s) => scoped.has(s.id)).reduce((m, s) => m + s.amount, 0) : n), 0);
    })(),
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
    evokedCasts: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.altKeyword === 'evoke')).length,
    dashedCasts: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.altKeyword === 'dash')).length,
    evokeSacrifices: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:evoke$/.test(e.body.obj.abilityRef ?? '')).length,
    dashReturns: game.log.filter((e) => e.body.t === 'Narrated' && /dash: return it to hand resolves/.test(e.body.text)).length,
    vanishingTicks: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:vanishing$/.test(e.body.obj.abilityRef ?? '')).length,
    vanishingSacrifices: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:vanishingLast$/.test(e.body.obj.abilityRef ?? '')).length,
    fadingFires: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:fading$/.test(e.body.obj.abilityRef ?? '')).length,
    controlAuras: game.log.filter((e) => e.body.t === 'ControlTakenByAura').length,
    controlAuraReverts: game.log.filter((e) => e.body.t === 'ControlReverted').length,
    exhaustActivations: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.exhaust === true).length,
    boastActivations: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.boast === true).length,
    fabricateFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:fabricate')).length,
    fabricateServos: game.log.filter((e) => e.body.t === 'TokenCreated' && e.body.oracleId === 'b6ca7bd1-d72e-4260-8b52-997ee1377279').length,
    disguiseCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.faceDown === true && e.body.obj.card !== null && (ORACLE.byPrinting(game.state.cards[e.body.obj.card]?.printingId ?? '')?.faces[0]?.disguise ?? false)).length,
    disguiseUnmasks: game.log.filter((e) => e.body.t === 'FaceDownSet' && e.body.faceDown === false && (ORACLE.byPrinting(game.state.cards[e.body.card]?.printingId ?? '')?.faces[0]?.disguise ?? false)).length,
    ninjutsus: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.ninjutsuDefender !== undefined).length,
    mobilizeFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:mobilize')).length,
    mobilizeWarriors: (() => { const made = new Set(game.log.flatMap((e) => (e.body.t === 'TokenCreated' ? [e.body.card] : []))); return game.log.filter((e) => e.body.t === 'AttackerAdded' && made.has(e.body.card)).length; })(),
    creatureTypesChosen: game.log.filter((e) => e.body.t === 'CreatureTypeChosen').length,
    shieldCountersSpent: game.log.filter((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.kind === 'shield' && c.delta < 0)).length,
    shieldCountersPut: game.log.filter((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.kind === 'shield' && c.delta > 0)).length,
    stunCountersPut: game.log.filter((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.kind === 'stun' && c.delta > 0)).length,
    stunCountersSpent: game.log.filter((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.kind === 'stun' && c.delta < 0)).length,
    loyaltyActivations: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.loyalty !== undefined).length,
    spawnTokensMade: game.log.filter((e) => e.body.t === 'TokenCreated' && SPAWN_ORACLES.has(e.body.oracleId)).length,
    spawnTokensSpent: (() => { const spawn = new Set(game.log.flatMap((e) => (e.body.t === 'TokenCreated' && SPAWN_ORACLES.has(e.body.oracleId) ? [e.body.card] : []))); return game.log.filter((e) => e.body.t === 'ManaAdded' && e.body.source !== null && spawn.has(e.body.source)).length; })(),
    tokenTriggersFired: (() => { const made = new Set(game.log.flatMap((e) => (e.body.t === 'TokenCreated' ? [e.body.card] : []))); return game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.kind === 'triggered' && e.body.obj.source !== null && made.has(e.body.obj.source)).length; })(),
    emblemsGiven: game.log.filter((e) => e.body.t === 'EmblemCreated').length,
    memoTriggers: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.kind === 'triggered' && (e.body.obj.memo ?? 0) > 0).length,
    continuationsCarried: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting !== null && 'continuation' in e.body.awaiting && e.body.awaiting.continuation !== undefined).length,
    continuationsRun: game.log.filter((e) => e.body.t === 'ContinuationResumed').length,
    tokenCopiesMade: game.log.filter((e) => e.body.t === 'TokenCreated' && e.body.copyOf !== undefined).length,
    clonesEntered: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.asCopyOf !== undefined)).length,
    spellsCopied: game.log.filter((e) => e.body.t === 'SpellCopied').length,
    populates: game.log.filter((e) => e.body.t === 'Populated').length,
    suspends: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.suspend === true)).length,
    suspendCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.suspended === true).length,
    freeCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.alternativePaid === true && isFreeAlternative(game.state, e.body.obj)).length,
    freeGrantsAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone' && e.body.awaiting.castFree === true).length,
    freeGrantCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.freeCast === true).length,
    onceTriggersFired: game.log.reduce((n, e) => n + (e.body.t === 'PendingTriggersAdded' ? e.body.triggers.filter((t) => t.oncePerTurn === true).length : 0), 0),
    looksToBattlefield: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone' && e.body.awaiting.zone === 'library' && e.body.awaiting.to === 'battlefield').length,
    looksRevealed: game.log.filter((e) => e.body.t === 'CardsRevealed' && e.body.to.length > 1 && e.body.cards.length > 1).length,
    objectsBound: game.log.filter((e) => e.body.t === 'DelayedTriggerArmed' && (e.body.trigger.aims?.length ?? 0) > 0).length,
    objectsActed: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.delayedEffects !== undefined && e.body.obj.targets.length > 0).length,
    spellFates: game.log.filter((e) => e.body.t === 'StackResolved' && e.body.fate !== undefined).length,
    extraTurnsAdded: game.log.filter((e) => e.body.t === 'ExtraTurnAdded').length,
    extraTurnsTaken: game.log.filter((e) => e.body.t === 'TurnBegan' && e.body.extra !== undefined).length,
    referentPlayers: game.log.filter((e) => e.body.t === 'ReferentPlayerBound').length,
    scopesWalked: game.log.filter((e) => e.body.t === 'ScopeWalked').length,
    referentSearches: game.log.filter((e) => e.body.t === 'ReferentPlayerBound' && /search/i.test(e.body.text)).length,
    handPuts: game.log.reduce((n, e) => n + (e.body.t === 'PutFromHand' ? e.body.cards.length : 0), 0),
    handPutAsks: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone' && e.body.awaiting.zone === 'hand' && e.body.awaiting.to === 'battlefield').length,
    handPutClauses: game.log.filter((e) => e.body.t === 'PutFromHand').length,
    untapChoices: game.log.filter((e) => e.body.t === 'AsksResolved' && e.body.verb === 'untap').length,
    massCantBlocks: game.log.filter((e) => e.body.t === 'ScopeWalked' && e.body.verb === 'massCantBlock').length,
    wheels: game.log.filter((e) => e.body.t === 'WheelShuffled').length,
    bolsters: game.log.filter((e) => e.body.t === 'Bolstered').length,
    amasses: game.log.filter((e) => e.body.t === 'Amassed').length,
    gatedClauses: game.log.filter((e) => e.body.t === 'Narrated' && /(?:is replaced|does nothing: if )/.test(e.body.text)).length,
    cascades: game.log.reduce((n, e) => n + (e.body.t === 'PendingTriggersAdded' ? e.body.triggers.filter((t) => t.abilityRef.endsWith('#kw:cascade')).length : 0), 0),
    cascadeCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.freeCast === true && e.body.obj.castFrom?.kind === 'exile').length,
    manifests: game.log.reduce((n, e) => n + (e.body.t === 'CardsMoved' ? e.body.moves.filter((m) => m.manifested === true).length : 0), 0),
    manifestDreads: game.log.filter((e) => e.body.t === 'ManifestedDread').length,
    manifestFlips: game.log.filter((e) => e.body.t === 'FaceDownSet' && e.body.faceDown === false && (ORACLE.byPrinting(game.state.cards[e.body.card]?.printingId ?? '')?.faces[0]?.morphCost ?? null) === null).length,
    clashes: game.log.filter((e) => e.body.t === 'Clashed').length,
    clashWins: game.log.filter((e) => e.body.t === 'Clashed' && e.body.won === true).length,
    loreCounters: game.log.reduce((n, e) => n + (e.body.t === 'CountersChanged' ? e.body.changes.filter((c) => c.kind === 'lore' && c.delta > 0).reduce((m, c) => m + c.delta, 0) : 0), 0),
    chaptersFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').includes('#chapter-')).length,
    sagasSacrificed: game.log.filter((e) => e.body.t === 'SagaSacrificed').length,
    kickerVerbCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.kicked ?? 0) > 0 && (ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.kickerVerb ?? null) !== null).length,
    secondKickerCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.kickedWith ?? []).includes(1)).length,
    controlGained: game.log.filter((e) => e.body.t === 'ControlGained').length,
    controlHeld: game.log.filter((e) => e.body.t === 'ControlTakenBySource').length,
    monstrosities: game.log.filter((e) => e.body.t === 'BecameMonstrous').length,
    rulesFlips: game.log.filter((e) => e.body.t === 'CoinFlipped' && !(e.cause.kind === 'intent' && e.cause.intent === 'FlipCoin')).length,
    buybackCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.buyback === true).length,
    buybackReturns: game.log.filter((e) => e.body.t === 'StackResolved' && e.body.buyback === true).length,
    stormTriggers: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:storm')).length,
    stormCopies: game.log.filter((e) => e.body.t === 'SpellCopied' && (ORACLE.byPrinting(e.body.obj.copyOf?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.keywords.includes('storm') ?? false)).length,
    retraceCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.castFrom?.kind === 'graveyard' && ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.graveyardCast?.kind === 'retrace').length,
    jumpStartCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.castFrom?.kind === 'graveyard' && ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.graveyardCast?.kind === 'jumpStart').length,
    reboundArms: game.log.filter((e) => e.body.t === 'DelayedTriggerArmed' && e.body.trigger.id.includes('-rebound-')).length,
    reboundCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.castFrom?.kind === 'exile' && (ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.rebound ?? false)).length,
    foretells: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.foretoldTurn !== undefined && m.from.kind === 'hand')).length,
    foretoldCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.castFrom?.kind === 'exile' && (ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.foretellCost ?? null) !== null).length,
    madnessExiles: game.log.reduce((k, e) => k + (e.body.t === 'CardsMoved' ? e.body.moves.filter((m) => m.madness === true).length : 0), 0),
    madnessCasts: game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.castFrom?.kind === 'exile' && (ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.madnessCost ?? null) !== null).length,
    partnerWithTriggers: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && (e.body.obj.abilityRef ?? '').endsWith('#kw:partnerWith')).length,
    exploitSacrifices: game.log.reduce((n, e) => n + (e.body.t === 'CardsMoved' ? e.body.moves.filter((m) => m.exploitedBy !== undefined).length : 0), 0),
    embalmTokens: game.log.filter((e) => e.body.t === 'TokenCreated' && e.body.copyExceptions?.noManaCost === true).length,
    warpExiles: game.log.reduce((n, e) => n + (e.body.t === 'CardsMoved' ? e.body.moves.filter((m) => m.warpedTurn !== undefined).length : 0), 0),
    awakenedLands: game.log.filter((e) => e.body.t === 'Awakened').length,
    myriadTokens: game.log.filter((e) => e.body.t === 'DelayedTriggerArmed' && e.body.trigger.id.includes('-myriad-')).length,
    splitSecondCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (ORACLE.byPrinting(game.state.cards[e.body.obj.card ?? '']?.printingId ?? '')?.faces[e.body.obj.faceIndex]?.keywords ?? []).includes('splitSecond')).length,
    crownings: game.log.filter((e) => e.body.t === 'MonarchChanged').length,
    ringTempts: game.log.filter((e) => e.body.t === 'RingTempted').length,
    ringAbilities: game.log.reduce((k, e) => k + (e.body.t === 'PendingTriggersAdded' ? e.body.triggers.filter((t) => /^The Ring - /.test(t.label)).length : 0), 0),
    energyGained: game.log.filter((e) => e.body.t === 'EnergyChanged' && e.body.delta > 0).length,
    energyPaid: game.log.filter((e) => e.body.t === 'EnergyChanged' && e.body.delta < 0).length,
    extraCombats: game.log.filter((e) => e.body.t === 'ExtraPhasesAdded').length,
    insertedPhases: game.log.filter((e) => e.body.t === 'ExtraPhasesConsumed' && e.body.resume !== null).length,
    statReads: game.log.filter((e) => e.body.t === 'StatRead').length,
    lastKnownReads: game.log.filter((e) => e.body.t === 'StatRead' && e.body.lastKnown).length,
    handActivations: game.log.filter((e, i) => {
      const b = e.body;
      if (b.t !== 'AbilityPutOnStack') return false;
      const src = b.obj.source;
      return game.log.slice(Math.max(0, i - 6), i).some((d) => d.body.t === 'CardsMoved' && d.body.moves.some((m) => m.card === src && m.reason === 'discard' && m.from.kind === 'hand'));
    }).length,
    explores: game.log.filter((e) => e.body.t === 'Explored').length,
    typecyclings: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.reason === 'cycling' && typedCycler(game, m.card))).length,
    untapSkips: game.log.filter((e) => e.body.t === 'UntapSkipSet' && e.body.skip).length,
    connives: game.log.filter((e) => e.body.t === 'Connived').length,
    exileMarks: game.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.exileIfDies === true).length,
    // D414 - a staple's ability chose its target (the `another` spec admitted the pick), and how many of
    // those picks were the source itself - `specAdmits` refuses it, so the second is a hard zero.
    anotherTargets:
      anotherPushes.filter((o) => o.kind === 'activated' && o.targets.length > 0).length +
      game.log.filter((e) => e.body.t === 'StackTargetsSet' && anotherTriggers.has(e.body.stackId)).length,
    anotherSelfPicks:
      anotherPushes.filter((o) => o.kind === 'activated' && o.targets.some((t) => t.kind === 'card' && t.id === o.source)).length +
      game.log.filter((e) => {
        const b = e.body;
        if (b.t !== 'StackTargetsSet' || !anotherTriggers.has(b.stackId)) return false;
        const source = anotherTriggers.get(b.stackId);
        return b.targets.some((t) => t.kind === 'card' && t.id === source);
      }).length,
    exiledInstead: game.log.filter((e) => e.body.t === 'Narrated' && /is exiled instead of dying/.test(e.body.text)).length,
    // D415 - a verb price asked (the prompt carries `verbs`) and paid (the answer names the verb).
    verbPricesAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana' && e.body.awaiting.verbs !== undefined).length,
    verbPricesPaid: game.log.filter((e) => e.body.t === 'PaymentAnswered' && e.body.paid && e.body.verb !== undefined).length,
    // D416 - a hand revealed to EVERY seat (a look reveals to its controller alone), and the pick with an owner.
    handReveals: game.log.filter((e) => e.body.t === 'CardsRevealed' && e.body.cards.length > 0 && e.body.to.length === game.state.seating.length).length,
    handChoicesAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone' && e.body.awaiting.owner !== undefined).length,
    // D417 - a permission granted; a spell cast from exile (its object says so) or a land played out of exile
    // (the move from exile to the battlefield beside a LandPlayed) under one.
    permissionsGranted: game.log.filter((e) => e.body.t === 'PlayPermissionGranted').length,
    // D418 - the executor narrates every counted clause: `counts N for` when it ran N times, `counts nothing` when not.
    countsResolved: game.log.filter((e) => e.body.t === 'Narrated' && / counts \d+ for /.test(e.body.text)).length,
    countsEmpty: game.log.filter((e) => e.body.t === 'Narrated' && / counts nothing /.test(e.body.text)).length,
    // D422 - a move from the stack to a hand or a library is the countered-this-way destination (nothing else moves a
    // card off the stack to either); the funnel's line is the uncounterable spell.
    countersRedirected: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.from.kind === 'stack' && (m.to.kind === 'hand' || m.to.kind === 'library'))).length,
    uncounterableSaid: game.log.filter((e) => e.body.t === 'Narrated' && /can't be countered/.test(e.body.text)).length,
    kickedReplaced: game.log.filter((e) => e.body.t === 'Narrated' && / is replaced\.$/.test(e.body.text)).length,
    kickedInsteadSkipped: game.log.filter((e) => e.body.t === 'Narrated' && /was not kicked — “If this spell was kicked, [^”]* instead\.” does nothing\.$/.test(e.body.text)).length,
    playerReferents: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.player !== undefined).length,
    returnsResolved: game.log.filter((e) => e.body.t === 'AsksResolved' && e.body.verb === 'return').length,
    drawHeadFires: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#(?:opponentDrawsCard|aPlayerDrawsCard)-/.test(e.body.obj.abilityRef ?? '')).length,
    drawStepHeadFires: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#(?:eachPlayerDrawStep|yourDrawStep)-/.test(e.body.obj.abilityRef ?? '')).length,
    millsResolved: game.log.filter((e) => e.body.t === 'CardsMoved' && e.body.moves.length > 0 && e.body.moves.every((m) => m.from.kind === 'library' && m.to.kind === 'graveyard')).length,
    ifYouDoFires: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /\. If you do, (?:discard|draw) /.test(e.body.obj.label)).length,
    graveyardAims: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /target [a-z ,]*card from (?:a|your|an opponent's) graveyard/i.test(e.body.obj.label) && e.body.obj.targets.some((t) => t.kind === 'card')).length,
    spellXCasts: game.log.filter((e) => e.body.t === 'SpellCast' && (e.body.obj.xValue ?? 0) > 0).length,
    upkeepPricesFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:(?:echo|cumulativeUpkeep)$/.test(e.body.obj.abilityRef ?? '')).length,
    extortsFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:extort$/.test(e.body.obj.abilityRef ?? '')).length,
    revealsAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'entersChoice' && e.body.awaiting.reveal !== undefined).length,
    revealsShown: game.log.filter((e) => e.body.t === 'CardsRevealed' && e.body.cards.length === 1 && e.body.to.length === game.state.seating.length).length,
    cleanupDiscards: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone' && e.body.awaiting.label === 'Cleanup step').length,
    cleanupRepeats: game.log.filter((e) => e.body.t === 'CleanupRepeatSet' && e.body.value === true).length,
    exerts: game.log.filter((e) => e.body.t === 'Exerted').length,
    unleashAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'entersChoice' && e.body.awaiting.option === 'unleash').length,
    riotAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'entersChoice' && e.body.awaiting.option === 'riot').length,
    riotHastes: game.log.filter((e) => e.body.t === 'HasteChosen').length,
    backupsFired: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:backup$/.test(e.body.obj.abilityRef ?? '')).length,
    keywordGrants: game.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.power === 0 && e.body.toughness === 0 && (e.body.keywords ?? []).length > 0).length,
    exertTriggers: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#(?:exertAttack|youExertCreature)-\d+$/.test(e.body.obj.abilityRef ?? '')).length,
    modularMoves: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /#kw:modular$/.test(e.body.obj.abilityRef ?? '') && e.body.obj.targets.length > 0).length,
    scavenges: game.log.filter((e) => e.body.t === 'AbilityPutOnStack' && /equal to this card's power on target creature/.test(e.body.obj.label)).length,
    unearths: game.log.filter((e) => e.body.t === 'Unearthed').length,
    unearthExiles: game.log.filter((e) => e.body.t === 'Narrated' && /(was unearthed: it is exiled instead|unearth: exile it resolves)/.test(e.body.text)).length,
    upkeepPricesAsked: game.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'payMana' && / - (?:echo|cumulative upkeep) /.test(e.body.awaiting.label)).length,
    agesAdded: game.log.filter((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.kind === 'age' && c.delta > 0)).length,
    playedFromExile:
      game.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.castFrom?.kind === 'exile').length +
      game.log.filter((e, i) => {
        if (e.body.t !== 'LandPlayed') return false;
        const prev = game.log[i - 1]?.body;
        return !!prev && prev.t === 'CardsMoved' && prev.moves.some((m) => m.card === (e.body as { card: string }).card && m.from.kind === 'exile');
      }).length,
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
   * deliberately not shipped (`AJANIS_MANTRA`'s card ships since D429 - its oracleId still
   * names a registered, dealt script, now the shipped one), and `Ajani's Mantra` IS dealt while
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
  'evokedCasts',
  'dashedCasts',
  'evokeSacrifices',
  'dashReturns',
  'vanishingTicks',
  'vanishingSacrifices',
  'fadingFires',
  'handActivations',
  'controlAuras',
  'controlAuraReverts',
  'exhaustActivations',
  'boastActivations',
  'fabricateFired',
  'fabricateServos',
  'disguiseCasts',
  'disguiseUnmasks',
  'ninjutsus',
  'mobilizeFired',
  'mobilizeWarriors',
  'creatureTypesChosen',
  'shieldCountersSpent',
  'shieldCountersPut',
  'stunCountersPut',
  'stunCountersSpent',
  'loyaltyActivations',
  'spawnTokensMade',
  'spawnTokensSpent',
  'tokenTriggersFired',
  'emblemsGiven',
  'memoTriggers',
  'continuationsCarried',
  'continuationsRun',
  'tokenCopiesMade',
  'clonesEntered',
  'spellsCopied',
  'populates',
  'suspends',
  'suspendCasts',
  'freeCasts',
  'freeGrantsAsked',
  'freeGrantCasts',
  'onceTriggersFired',
  'looksToBattlefield',
  'looksRevealed',
  'objectsBound',
  'objectsActed',
  'spellFates',
  'extraTurnsAdded',
  'extraTurnsTaken',
  'referentPlayers',
  'scopesWalked',
  'referentSearches',
  'handPuts',
  'handPutAsks',
  'handPutClauses',
  'untapChoices',
  'massCantBlocks',
  'wheels',
  'bolsters',
  'amasses',
  'gatedClauses',
  'cascades',
  'cascadeCasts',
  'manifests',
  'manifestDreads',
  'manifestFlips',
  'clashes',
  'clashWins',
  'loreCounters',
  'chaptersFired',
  'sagasSacrificed',
  'kickerVerbCasts',
  'secondKickerCasts',
  'controlGained',
  'controlHeld',
  'monstrosities',
  'rulesFlips',
  'buybackCasts',
  'buybackReturns',
  'stormTriggers',
  'stormCopies',
  'retraceCasts',
  'jumpStartCasts',
  'reboundArms',
  'reboundCasts',
  'foretells',
  'foretoldCasts',
  'madnessExiles',
  'madnessCasts',
  'partnerWithTriggers',
  'exploitSacrifices',
  'embalmTokens',
  'warpExiles',
  'awakenedLands',
  'myriadTokens',
  'splitSecondCasts',
  'crownings',
  'ringTempts',
  'ringAbilities',
  'energyGained',
  'energyPaid',
  'extraCombats',
  'insertedPhases',
  'statReads',
  'lastKnownReads',
  'explores',
  'typecyclings',
  'untapSkips',
  'connives',
  'exileMarks',
  'exiledInstead',
  'anotherTargets',
  'anotherSelfPicks',
  'verbPricesAsked',
  'verbPricesPaid',
  'handReveals',
  'handChoicesAsked',
  'permissionsGranted',
  'playedFromExile',
  'countsResolved',
  'countsEmpty',
  'countersRedirected',
  'uncounterableSaid',
  'kickedReplaced',
  'kickedInsteadSkipped',
  'playerReferents',
  'returnsResolved',
  'drawHeadFires',
  'drawStepHeadFires',
  'millsResolved',
  'ifYouDoFires',
  'graveyardAims',
  'spellXCasts',
  'upkeepPricesFired',
  'extortsFired',
  'revealsAsked',
  'revealsShown',
  'cleanupDiscards',
  'cleanupRepeats',
  'exerts',
  'exertTriggers',
  'unleashAsked',
  'riotAsked',
  'riotHastes',
  'backupsFired',
  'keywordGrants',
  'modularMoves',
  'scavenges',
  'unearths',
  'unearthExiles',
  'upkeepPricesAsked',
  'agesAdded',
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
  'scopedShields',
  'scopedPrevented',
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
      // D427 - a scoped shield went up at gate size (Harmless Assault, Forfend); what it stopped is reported.
      expect(totals.scopedShields).toBeGreaterThan(0);
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
        // D412 - Raffine's Informant connived at gate size.
        expect(totals.connives).toBeGreaterThan(0);
        // D413 - Lava Coil marked a creature at gate size (the redirect is counted, no floor: it needs a death).
        expect(totals.exileMarks).toBeGreaterThan(0);
        // D414 - an `another` staple chose its target at gate size, and never itself.
        expect(totals.anotherTargets).toBeGreaterThan(0);
        expect(totals.anotherSelfPicks).toBe(0);
        // D415 - a verb price was asked and paid at gate size.
        expect(totals.verbPricesAsked).toBeGreaterThan(0);
        expect(totals.verbPricesPaid).toBeGreaterThan(0);
        // D416 - a hand was revealed and a pick asked at gate size.
        expect(totals.handReveals).toBeGreaterThan(0);
        expect(totals.handChoicesAsked).toBeGreaterThan(0);
        // D417 - a permission was granted and taken (a cast or a land play out of exile) at gate size.
        expect(totals.permissionsGranted).toBeGreaterThan(0);
        expect(totals.playedFromExile).toBeGreaterThan(0);
        // D418 - a counted clause resolved at a count of one or more at gate size.
        expect(totals.countsResolved).toBeGreaterThan(0);
        // D422 - a counter sent its spell to a hand or a library at gate size.
        expect(totals.countersRedirected).toBeGreaterThan(0);
        // D423 - an instead clause was read and gated on an unkicked cast at gate size (the kicked branch is the
        // driver's coin flip - a {4} kick - and the unit suite's; it is reported, not floored).
        expect(totals.kickedInsteadSkipped).toBeGreaterThan(0);
        // D428 - a trigger carried the player its head named at gate size (Copper Tablet's upkeep ping, Oppression).
        expect(totals.playerReferents).toBeGreaterThan(0);
        // D431 - a queued return resolved at gate size (Dimir Aqueduct's entry).
        expect(totals.returnsResolved).toBeGreaterThan(0);
        // D432 - a draw head fired at gate size (Fate Unraveler on an opponent's draw).
        expect(totals.drawHeadFires).toBeGreaterThan(0);
        // D433 - a draw-step head fired at gate size (Font of Mythos).
        expect(totals.drawStepHeadFires).toBeGreaterThan(0);
        // D434 - a mill resolved at gate size (Hedron Crab's landfall, Millstone's activation).
        expect(totals.millsResolved).toBeGreaterThan(0);
        // D435 - an if-you-do loot fired at gate size (Stadium Tidalmage, Rook Turret, Riddlesmith).
        expect(totals.ifYouDoFires).toBeGreaterThan(0);
        // D436 - an ability aimed at a graveyard card at gate size (Honored Heirloom, Crypt Creeper).
        expect(totals.graveyardAims).toBeGreaterThan(0);
        // D437 - an X spell cast for more than nothing at gate size (Blaze).
        expect(totals.spellXCasts).toBeGreaterThan(0);
        // D439 - an echo or a cumulative upkeep on the stack at gate size (Shivan Raptor, Illusionary Forces).
        expect(totals.upkeepPricesFired).toBeGreaterThan(0);
        // D440 - an extort trigger on the stack at gate size (Syndic of Tithes).
        expect(totals.extortsFired).toBeGreaterThan(0);
        // D441 - a reveal land asked at gate size (Port Town with a Plains or Island in hand).
        expect(totals.revealsAsked).toBeGreaterThan(0);
        // D442 - the cleanup discard asked at gate size (a hand above seven at the end of a turn).
        expect(totals.cleanupDiscards).toBeGreaterThan(0);
        // D443 - a creature exerted at gate size (Khenra Scrapper, a staple).
        expect(totals.exerts).toBeGreaterThan(0);
        // D444 - an unleash and a riot asked at gate size (Gore-House Chainwalker, Zhur-Taa Goblin).
        expect(totals.unleashAsked).toBeGreaterThan(0);
        expect(totals.riotAsked).toBeGreaterThan(0);
        // D445 - a backup trigger on the stack at gate size (Sigiled Sentinel).
        expect(totals.backupsFired).toBeGreaterThan(0);
        // D448 - an unearth resolved at gate size (Dregscape Zombie; 5 at 60 seeds).
        expect(totals.unearths).toBeGreaterThan(0);
        // D460 - a disguise cast face down at gate size (Museum Nightwatch 8 at 60 seeds, 21 at 150).
        expect(totals.disguiseCasts).toBeGreaterThan(0);
        // D463 - a mobilize fired at gate size (Shock Brigade 4 at 60 seeds, 12 at 150).
        expect(totals.mobilizeFired).toBeGreaterThan(0);
        // D470 - a stun counter spent in place of an untap at gate size (Rowdy Snowballers 6 at 60 seeds, 11 at 150).
        expect(totals.stunCountersSpent).toBeGreaterThan(0);
        // D472 - a loyalty ability activated at gate size (Jace Beleren 21 at 60 seeds, 53 at 150).
        expect(totals.loyaltyActivations).toBeGreaterThan(0);
        // D473 - a quoted Eldrazi Spawn created and sacrificed for {C} at gate size (Nest Invader 2 / 2 at 60 seeds, 14 / 8 at 150).
        expect(totals.spawnTokensMade).toBeGreaterThan(0);
        expect(totals.spawnTokensSpent).toBeGreaterThan(0);
        // D476 - a trigger carried its own number onto the stack at gate size (Mourning Thrull 4 at 60 seeds, 12 at 150).
        expect(totals.memoTriggers).toBeGreaterThan(0);
        // D484 - a question carried the clauses after it and its answer ran them at gate size (Vampiric Tutor a seat).
        expect(totals.continuationsCarried).toBeGreaterThan(0);
        expect(totals.continuationsRun).toBeGreaterThan(0);
        // D485 - a token copy of a permanent at gate size (Cackling Counterpart, two a seat).
        expect(totals.tokenCopiesMade).toBeGreaterThan(0);
        // D486 - a permanent entered as a copy of another at gate size (Clone a seat).
        expect(totals.clonesEntered).toBeGreaterThan(0);
        // D487 - a spell copied at gate size (Reverberate, two a seat).
        expect(totals.spellsCopied).toBeGreaterThan(0);
        // D488 - a populate at gate size (Eyes in the Skies, two a seat: its own Bird is always there to copy).
        expect(totals.populates).toBeGreaterThan(0);
        // D489 - a suspend at gate size (Rift Sower, two a seat); the free cast two upkeeps later is reported.
        expect(totals.suspends).toBeGreaterThan(0);
        // D490 - a conditional free cast at gate size (Cho-Arrim Legate, two a seat).
        expect(totals.freeCasts).toBeGreaterThan(0);
        // D491 - a cast granted from the hand at gate size (Sram's Expertise, two a seat).
        expect(totals.freeGrantCasts).toBeGreaterThan(0);
        // D492 - a once-per-turn trigger queued at gate size (Ghoulish Procession and Irreverent Gremlin, two a seat).
        expect(totals.onceTriggersFired).toBeGreaterThan(0);
        // D493 - a look onto the battlefield at gate size (Elvish Rejuvenator, two a seat).
        expect(totals.looksToBattlefield).toBeGreaterThan(0);
        // D494 - a delayed clause bound to the previous clause's objects and fired at gate size (Force of Rage, Turn to Mist, two a seat).
        expect(totals.objectsActed).toBeGreaterThan(0);
        // D501 - a spell that left the stack by its own fate at gate size (Treasured Find's exile, Beacon of Creation's shuffle-in, two a seat).
        expect(totals.spellFates).toBeGreaterThan(0);
        // D502 - an extra turn created and taken at gate size (Savor the Moment, two a seat).
        expect(totals.extraTurnsTaken).toBeGreaterThan(0);
        // D504 - a clause bound to the previous object's controller at gate size (Beast Within, Generous Gift, two a seat).
        expect(totals.referentPlayers).toBeGreaterThan(0);
        // D505 - a mass verb walked a scope at gate size (Vitalize, Bond of Discipline, two a seat).
        expect(totals.scopesWalked).toBeGreaterThan(0);
        // D507 - a search asked of the previous object's controller at gate size (Path to Exile, two a seat; 7 over the first 60 seeds, canary507).
        expect(totals.referentSearches).toBeGreaterThan(0);
        // D508 - a hand-put clause run at gate size (Arboreal Grazer, Walking Atlas, two a seat). D509 - the CLAUSE, not the
        // put: the driver plays a land the moment it draws one, so a put with something to put is a coincidence of two
        // lands drawn together (2 over 3,000 seeds at D508, 0 at D509's first run); the executor's empty marker says the
        // clause ran and what it found.
        expect(totals.handPutClauses).toBeGreaterThan(0);
        // D510 - the untap choice resolved, a mass can't-block walked and a wheel turned at gate size (Snap, Falter, Timetwister,
        // two a seat; 4 / 6 / 16 over the first 60 seeds, canary510).
        expect(totals.untapChoices).toBeGreaterThan(0);
        expect(totals.massCantBlocks).toBeGreaterThan(0);
        expect(totals.wheels).toBeGreaterThan(0);
        // D511 - a bolster ran at gate size (Cached Defenses and Abzan Advantage two a seat; 4 over the first 60 seeds, canary511 -
        // the marker counts the unasked and the empty paths too).
        expect(totals.bolsters).toBeGreaterThan(0);
        // D519 - energy was gained and paid at gate size (Sage of Shaila's Claim, Bristling Hydra and Aether Chaser three a
        // seat; the canary519 figures in the decision).
        expect(totals.energyGained).toBeGreaterThan(0);
        expect(totals.energyPaid).toBeGreaterThan(0);
        // D520 - an amass ran at gate size (Relentless Advance, Lazotep Reaver and Dunland Crebain two a seat; the canary520
        // figures in the decision).
        expect(totals.amasses).toBeGreaterThan(0);
        // D521 - the Ring tempted a player at gate size (Claim the Precious, Birthday Escape, Took Reaper and Relentless
        // Rohirrim two a seat; the canary521 figures in the decision); the emblem's abilities are counted, not floored.
        expect(totals.ringTempts).toBeGreaterThan(0);
        // D522 - the crown moved at gate size (Grave Venerations, Garrulous Sycophant and Throne Warden two a seat, and
        // D332's combat steal over any of them; the canary522 figures in the decision).
        expect(totals.crownings).toBeGreaterThan(0);
        // D523 - a gated clause was asked at gate size (For the Family and Resourceful Return two a seat; the canary523
        // figures in the decision).
        expect(totals.gatedClauses).toBeGreaterThan(0);
        // D525 - a cascade at gate size (Bloodbraid Elf and Ardent Plea, two a seat).
        expect(totals.cascades).toBeGreaterThan(0);
        // D526 - a manifest at gate size (Soul Summons and Manifest Dread, two a seat).
        expect(totals.manifests).toBeGreaterThan(0);
        // D527 - a clash at gate size (Release the Ants and Research the Deep, two a seat).
        expect(totals.clashes).toBeGreaterThan(0);
        // D528 - a chapter ability at gate size (Origin of the Hulk and The Birth of Meletis, two a seat).
        expect(totals.chaptersFired).toBeGreaterThan(0);
        // D530 - a kick D530 opened at gate size (Final Flourish and Thornscape Battlemage, two a seat).
        expect(totals.kickerVerbCasts + totals.secondKickerCasts).toBeGreaterThan(0);
        // D531 - a control D531 opened at gate size (Political Trickery and Sower of Temptation, two a seat).
        expect(totals.controlGained + totals.controlHeld).toBeGreaterThan(0);
        // D533 - a permanent became monstrous at gate size (Fleecemane Lion and Sinuous Vermin, two a seat).
        expect(totals.monstrosities).toBeGreaterThan(0);
        // D534 - a rules coin flip at gate size (Winter Sky, two a seat).
        expect(totals.rulesFlips).toBeGreaterThan(0);
        // D535 - a bought-back spell back in its owner's hand at gate size (Searing Touch, two a seat).
        expect(totals.buybackReturns).toBeGreaterThan(0);
        // D536 - a storm trigger at gate size (Grapeshot, two a seat).
        expect(totals.stormTriggers).toBeGreaterThan(0);
        // D537 - a retrace cast at gate size (Flame Jab, two a seat).
        // D512 - an additional combat phase was queued and an inserted phase begun at gate size (Seize the Day and Relentless
        // Assault two a seat; 2 clauses / 3 inserted phases over the first 60 seeds, canary512).
        expect(totals.extraCombats).toBeGreaterThan(0);
        expect(totals.insertedPhases).toBeGreaterThan(0);
        // D514 - a creature's stat was read for an amount at gate size (Sheltering Word three a seat; 7 over the first 60 seeds,
        // fuzz60-514b). The last-known read has no cheap spell in the pools and is the executor test's (lkiStat.test.ts).
        expect(totals.statReads).toBeGreaterThan(0);
        // D449 - an evoked and a dashed entry at gate size (Mulldrifter 9, Zurgo Bellstriker 44 at 150 seeds).
        expect(totals.evokedCasts).toBeGreaterThan(0);
        expect(totals.dashedCasts).toBeGreaterThan(0);
        // D450 - a vanishing tick and a fading fire at gate size (Calciderm 15, Blastoderm 6 at 150 seeds).
        expect(totals.vanishingTicks).toBeGreaterThan(0);
        expect(totals.fadingFires).toBeGreaterThan(0);
        // D451 - a hand activation at gate size (Bannerhide Krushok; 4 at 60 seeds, 9 at 150).
        expect(totals.handActivations).toBeGreaterThan(0);
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
          `${totals.evokedCasts} evoked (${totals.evokeSacrifices} evoke sacrifices) · ${totals.dashedCasts} dashed (${totals.dashReturns} dash returns) · ` +
          `${totals.vanishingTicks} vanishing ticks (${totals.vanishingSacrifices} last-counter sacrifices) · ${totals.fadingFires} fading fires · ` +
          `${totals.handActivations} hand activations (the card discarded as the cost) · ` +
          `${totals.controlAuras} control Auras (${totals.controlAuraReverts} given back) · ` +
          `${totals.exhaustActivations} exhaust activations · ` +
          `${totals.boastActivations} boast activations · ` +
          `${totals.fabricateFired} fabricates (${totals.fabricateServos} Servos) · ` +
          `${totals.disguiseCasts} disguise casts (${totals.disguiseUnmasks} turned up) · ` +
          `${totals.ninjutsus} ninjutsus · ` +
          `${totals.mobilizeFired} mobilizes (${totals.mobilizeWarriors} Warriors attacking) · ` +
          `${totals.creatureTypesChosen} creature types chosen · ` +
          `${totals.shieldCountersPut} shield counters put / ${totals.shieldCountersSpent} spent · ` +
          `${totals.stunCountersPut} stun counters put / ${totals.stunCountersSpent} spent · ` +
          `${totals.loyaltyActivations} loyalty activations · ` +
          `${totals.spawnTokensMade} Spawn made / ${totals.spawnTokensSpent} spent · ` +
          `${totals.tokenTriggersFired} token triggers · ` +
          `${totals.emblemsGiven} emblems · ` +
          `${totals.memoTriggers} memo triggers · ` +
          `${totals.continuationsCarried}/${totals.continuationsRun} continuations carried/run · ` +
          `${totals.tokenCopiesMade} token copies · ` +
          `${totals.clonesEntered} clones · ` +
          `${totals.spellsCopied} spell copies · ` +
          `${totals.populates} populates · ` +
          `${totals.suspends}/${totals.suspendCasts} suspends/suspend casts · ` +
          `${totals.freeCasts} free casts · ` +
          `${totals.freeGrantsAsked}/${totals.freeGrantCasts} free grants asked/cast · ` +
          `${totals.onceTriggersFired} once-per-turn triggers · ` +
          `${totals.looksToBattlefield}/${totals.looksRevealed} looks to the battlefield/revealed · ` +
          `${totals.objectsBound}/${totals.objectsActed} objects bound/acted on · ` +
          `${totals.spellFates} spell fates · ` +
          `${totals.extraTurnsAdded}/${totals.extraTurnsTaken} extra turns added/taken · ` +
          `${totals.referentPlayers} referent players · ` +
          `${totals.scopesWalked} scopes walked · ` +
          `${totals.referentSearches} referent searches · ` +
          `${totals.handPutClauses}/${totals.handPutAsks}/${totals.handPuts} hand-put clauses/asks/cards · ` +
          `${totals.untapChoices} untap choices · ${totals.massCantBlocks} mass can't-blocks · ${totals.wheels} wheels · ` +
          `${totals.bolsters} bolsters · ` +
          `${totals.extraCombats}/${totals.insertedPhases} extra-combat clauses/inserted phases · ` +
          `${totals.statReads}/${totals.lastKnownReads} stat reads/last known · ` +
          `${totals.explores} explores · ` +
          `${totals.typecyclings} typecyclings · ` +
          `${totals.untapSkips} untap skips · ` +
          `${totals.connives} connives · ` +
          `${totals.exileMarks} exile marks / ${totals.exiledInstead} exiled instead · ` +
          `${totals.anotherTargets} another-targets / ${totals.anotherSelfPicks} self-picks · ` +
          `${totals.verbPricesAsked} verb prices asked / ${totals.verbPricesPaid} paid · ` +
          `${totals.handReveals} hands revealed / ${totals.handChoicesAsked} picks asked · ` +
          `${totals.permissionsGranted} permissions / ${totals.playedFromExile} played from exile · ` +
          `${totals.countsResolved} counts resolved / ${totals.countsEmpty} empty · ` +
          `${totals.countersRedirected} counters redirected / ${totals.uncounterableSaid} uncounterable · ` +
          `${totals.kickedReplaced} kicked replaced / ${totals.kickedInsteadSkipped} instead skipped · ` +
          `${totals.playerReferents} triggers naming their player · ` +
          `${totals.returnsResolved} queued returns resolved · ` +
          `${totals.drawHeadFires} draw-head triggers · ` +
          `${totals.drawStepHeadFires} draw-step triggers · ` +
          `${totals.millsResolved} mills resolved · ` +
          `${totals.ifYouDoFires} if-you-do fires · ` +
          `${totals.graveyardAims} graveyard aims · ` +
          `${totals.spellXCasts} X spells cast for more than nothing · ` +
          `${totals.upkeepPricesFired} upkeep prices fired (${totals.upkeepPricesAsked} asked, ${totals.agesAdded} age counters) · ` +
          `${totals.extortsFired} extorts fired · ${totals.modularMoves} modular moves · ${totals.scavenges} scavenges · ` +
          `${totals.unearths} unearths (${totals.unearthExiles} unearth exiles) · ` +
          `${totals.revealsAsked} reveal lands asked (${totals.revealsShown} shown) · ` +
          `${totals.cleanupDiscards} cleanup discards asked (${totals.cleanupRepeats} cleanup steps repeated) · ` +
          `${totals.exerts} exerts (${totals.exertTriggers} exert triggers on the stack) · ` +
          `${totals.unleashAsked} unleash / ${totals.riotAsked} riot asked (${totals.riotHastes} hastes) · ` +
          `${totals.backupsFired} backups fired (${totals.keywordGrants} keyword-only grants until end of turn, all sources) · ` +
          `${totals.animations} permanents animated · ` +
          `${totals.fights} fights / ${totals.bites} bites · ` +
          `${totals.preventionShields} prevention shields put up (${totals.damagePrevented} damage prevented; ${totals.scopedShields} scoped, ${totals.scopedPrevented} stopped by them) · ` +
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