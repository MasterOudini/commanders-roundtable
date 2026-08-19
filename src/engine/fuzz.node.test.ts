import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { checkInvariants } from './invariants';
import { legalActions } from './legal';
import { project } from './project';
import { replay, stateHash } from './log';
import { nextBelow, seedRng, shuffle, type RngState } from './rng';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import {
  AJANIS_MANTRA,
  AJANIS_PRIDEMATE,
  GRAVITY_SPHERE_SCRIPT,
  LEVITATION_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  KNIGHTHOOD_SCRIPT,
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
  // The only route to `chooseFromZone` — a real cast at a real player.
  { names: ['Mind Rot'], copiesPerSeat: 1,
    counterKeys: ['discardsChosen', 'cardsDiscarded'], rotHistory: 'D137 D176' },
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
/** Rotating slots per seat — 500 seeds × 4 seats × 40 = 80k slots per run. */
const STRIDE = 40;

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
  AJANIS_PRIDEMATE,
  LEVITATION_SCRIPT,
  GRAVITY_SPHERE_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  KNIGHTHOOD_SCRIPT,
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
    case 'chooseFromZone': {
      const hand = [...(state.zones.hand[awaiting.player] ?? [])];
      const picked: string[] = [];
      while (picked.length < awaiting.count && hand.length > 0) {
        picked.push(...hand.splice(p.below(hand.length), 1));
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

function nextIntent(state: GameState, p: Picker): Intent | null {
  if (state.gamePhase === 'finished') return null;
  if (state.priority.awaiting) return answerFor(state, p);
  if (p.below(20) === 0) return manualIntentFor(state, p);
  const holder = state.priority.player;
  if (!holder) return null;
  const actions = legalActions(state, ORACLE, SCRIPTS, holder);
  const usable = actions.filter((a) => a.t !== 'CastSpell' || a.affordable);
  const chosen = p.pick(usable);
  if (!chosen) return { t: 'PassPriority', player: holder };
  switch (chosen.t) {
    case 'PlayLand':
      // ⚠️ THE FACE THE OFFER NAMES. Taking face 0 here is exactly the bug
      // D155 fixed one layer up, and it would leave the gate unable to reach a
      // modal DFC's land half however many were dealt.
      return { t: 'PlayLand', player: holder, card: chosen.card, faceIndex: chosen.faceIndex };
    case 'CastSpell':
      return { t: 'CastSpell', player: holder, card: chosen.card };
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
      const sac = sacs && sacs.length > 0 ? sacs[p.below(sacs.length)] : undefined;
      return {
        t: 'ActivateAbility',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
        ...(sac !== undefined ? { sacrifice: sac } : {}),
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
  readonly discardsChosen: number;
  readonly cardsDiscarded: number;
  readonly triggerTargetsChosen: number;
  readonly triggersFizzled: number;
  readonly diesTriggers: number;
  readonly replacementChoices: number;
  /** Permanents that entered as a face other than the front one (CR 712). */
  readonly backFacesPlayed: number;
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
      throw new Error(`seed ${seed} @ event ${game.state.eventCount}: ${problems.join('; ')}`);
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
describe('replay-equivalence fuzzer — THE GATE', () => {
  test(
    `${SEEDS} seeds × ${INTENTS} random legal intents replay to an identical hash`,
    () => {
      const runs: Run[] = [];
      for (let seed = 0; seed < SEEDS; seed++) runs.push(runOne(seed));

      const totals = runs.reduce(
        (a, r) => ({
          accepted: a.accepted + r.accepted,
          events: a.events + r.events,
          turns: a.turns + r.turns,
          finished: a.finished + (r.finished ? 1 : 0),
          targetPrompts: a.targetPrompts + r.targetPrompts,
          targetsChosen: a.targetsChosen + r.targetsChosen,
          enteredWithCounters: a.enteredWithCounters + r.enteredWithCounters,
          transformedIntoPlaneswalker: a.transformedIntoPlaneswalker + r.transformedIntoPlaneswalker,
          peeked: a.peeked + r.peeked,
          triggersFired: a.triggersFired + r.triggersFired,
          activatedRun: a.activatedRun + r.activatedRun,
          optionalTaken: a.optionalTaken + r.optionalTaken,
          optionalDeclined: a.optionalDeclined + r.optionalDeclined,
          layer6Sources: a.layer6Sources + r.layer6Sources,
          ptCountersWritten: a.ptCountersWritten + r.ptCountersWritten,
          tokensCreated: a.tokensCreated + r.tokensCreated,
          tokensNamed: a.tokensNamed + r.tokensNamed,
          enteredTapped: a.enteredTapped + r.enteredTapped,
          entersPaid: a.entersPaid + r.entersPaid,
          discardsChosen: a.discardsChosen + r.discardsChosen,
          cardsDiscarded: a.cardsDiscarded + r.cardsDiscarded,
          triggerTargetsChosen: a.triggerTargetsChosen + r.triggerTargetsChosen,
          triggersFizzled: a.triggersFizzled + r.triggersFizzled,
          diesTriggers: a.diesTriggers + r.diesTriggers,
          replacementChoices: a.replacementChoices + r.replacementChoices,
          entersDeclined: a.entersDeclined + r.entersDeclined,
        }),
        {
          accepted: 0,
          events: 0,
          turns: 0,
          finished: 0,
          targetPrompts: 0,
          targetsChosen: 0,
          enteredWithCounters: 0,
          transformedIntoPlaneswalker: 0,
          peeked: 0,
          triggersFired: 0,
          activatedRun: 0,
          optionalTaken: 0,
          optionalDeclined: 0,
          layer6Sources: 0,
          ptCountersWritten: 0,
          tokensCreated: 0,
          tokensNamed: 0,
          enteredTapped: 0,
          entersPaid: 0,
          discardsChosen: 0,
          cardsDiscarded: 0,
          triggerTargetsChosen: 0,
          triggersFizzled: 0,
          diesTriggers: 0,
          replacementChoices: 0,
          entersDeclined: 0,
        },
      );
      // eslint-disable-next-line no-console
      console.log(
        `fuzz: ${SEEDS} seeds · ${totals.accepted} accepted intents · ${totals.events} events · ` +
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
          `${totals.discardsChosen} discards chosen, ${totals.cardsDiscarded} moves of hand→graveyard`,
      );

      // A fuzzer that silently did nothing would pass. These are the canaries.
      expect(totals.accepted).toBeGreaterThan(SEEDS * 50);
      expect(totals.events).toBeGreaterThan(SEEDS * 300);
      expect(totals.turns).toBeGreaterThan(SEEDS * 2);
      // ⚠️ TARGETING PATH CANARIES. Without these, a regression that stopped
      // emitting the prompt — or a harness that answered every one by
      // cancelling — leaves the whole gate green while the feature is dead.
      expect(totals.targetPrompts).toBeGreaterThan(SEEDS);
      expect(totals.targetsChosen).toBeGreaterThan(SEEDS);
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
      if (SEEDS >= 500) expect(totals.enteredWithCounters).toBeGreaterThan(0);
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
      if (SEEDS >= 500) expect(totals.transformedIntoPlaneswalker).toBeGreaterThan(0);
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
      if (SEEDS >= 500) expect(totals.activatedRun).toBeGreaterThan(0);
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
      // ⚠️ THE DISCARD CANARY. `CardsMoved` hand→graveyard also happens at
      // cleanup for a hand over seven, so the count alone would have been green
      // since M3; the narration counter is the one that only this path writes.
      // ⚠️ **`discardsChosen` AT THE GATE SIZE ONLY since D176** — measured 10
      // per 500 seeds, so its 60-seed expectation is ~1.2 and a zero is a 30%
      // coin flip; it flipped in D176's second gate run, one run after the
      // entry-counter canary did (the same batch-18 DECK dilution took both).
      // `cardsDiscarded` stays at every size: cleanup discards keep it ~93/500.
      if (SEEDS >= 500) expect(totals.discardsChosen).toBeGreaterThan(0);
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
      if (SEEDS >= 500) expect(totals.diesTriggers).toBeGreaterThan(0);
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
      if (SEEDS >= 500) expect(totals.replacementChoices).toBeGreaterThan(0);
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
      for (const other of game.state.seating) {
        expect(view.zones[zoneId('lib', other)]).toBeUndefined();
        if (other === viewer) continue;
        for (const id of view.zones[zoneId('hand', other)] ?? []) {
          expect(view.cards[id]?.card, `${viewer} can see ${other}'s ${id}`).toBeNull();
        }
      }
    }
  });

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
  });
});
