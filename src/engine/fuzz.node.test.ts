import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { checkInvariants } from './invariants';
import { legalActions } from './legal';
import { project } from './project';
import { replay, stateHash } from './log';
import { nextBelow, seedRng, shuffle, type RngState } from './rng';
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
 * A deck with enough variety that the fuzzer meets real decisions.
 *
 * ⚠️ A CARD MISSING FROM HERE IS A CODE PATH THIS GATE CANNOT REACH, and the
 * gate stays green the whole time it rots. It has now happened three times in
 * this repo: the net fixture pool was forty lands, then had no targeted spell
 * (D102) — and this list had no planeswalker and no battle, so the two SBAs that
 * read a `loyalty` or a `defense` counter ran against an empty counter map in
 * every one of 500 seeds. The two entries below are the only permanents in Magic
 * that arrive with counters already on them (CR 306.5b/310.6), which makes them
 * the only ones whose ENTRY changes the state hash.
 *
 * ⚠️ And Jace for the same reason one step along (D108): a permanent that
 * TRANSFORMS into a planeswalker is the other way loyalty counters get written,
 * and until he joined this list no card in the deck had a second face worth
 * turning over. He is here rather than any of the other 13 because `{1}{U}` is
 * cheap enough for the fuzzer to actually cast.
 */
const DECK = [
  'Forest', 'Island', 'Mountain', 'Plains', 'Swamp',
  'Command Tower', 'Sol Ring', 'Arcane Signet', 'Tundra', 'Boros Garrison',
  'Llanowar Elves', 'Birds of Paradise', 'Grizzly Bears', 'Serra Angel',
  'Giant Spider', 'Colossal Dreadmaw', 'Vampire Nighthawk', 'Typhoid Rats',
  'White Knight', 'Boros Swiftblade', 'Boggart Brute', 'Wall of Omens',
  'Raging Goblin', 'Child of Night', 'Ambush Viper', 'Baleful Strix',
  'Lightning Bolt', 'Counterspell', 'Cultivate', 'Swords to Plowshares',
  'Pacifism', 'Wrath of God', 'Brainstorm', 'Dark Ritual', 'Lightning Greaves',
  'Grist, the Hunger Tide', 'Invasion of Gobakhan // Lightshield Array',
  "Jace, Vryn's Prodigy // Jace, Telepath Unbound",
];

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
  switch (p.below(9)) {
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
  const actions = legalActions(state, ORACLE, deps().scripts, holder);
  const usable = actions.filter((a) => a.t !== 'CastSpell' || a.affordable);
  const chosen = p.pick(usable);
  if (!chosen) return { t: 'PassPriority', player: holder };
  switch (chosen.t) {
    case 'PlayLand':
      return { t: 'PlayLand', player: holder, card: chosen.card };
    case 'CastSpell':
      return { t: 'CastSpell', player: holder, card: chosen.card };
    case 'TapForMana':
      return {
        t: 'TapForMana',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
        outputChoice: p.below(Math.max(1, chosen.outputs)),
      };
    case 'PassPriority':
      return { t: 'PassPriority', player: holder };
    case 'ActivateAbility':
      return {
        t: 'ActivateAbility',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
      };
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
}

function runOne(seed: number): Run {
  const p = picker(`fuzz-${seed}`);
  const game = Game.create(makeSpec({ players: 4, seed: `fuzz-${seed}`, decks: [DECK, DECK, DECK, DECK], librarySize: 60 }), deps(), {
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
        },
      );
      // eslint-disable-next-line no-console
      console.log(
        `fuzz: ${SEEDS} seeds · ${totals.accepted} accepted intents · ${totals.events} events · ` +
          `${totals.turns} turns · ${totals.finished} games finished · ` +
          `${totals.targetPrompts} target prompts · ${totals.targetsChosen} declared · ` +
          `${totals.enteredWithCounters} entered with counters · ` +
          `${totals.transformedIntoPlaneswalker} transformed into a planeswalker`,
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
      expect(totals.enteredWithCounters).toBeGreaterThan(0);
      // ⚠️ THE TRANSFORM CANARY, and it needed a new INTENT as well as a new
      // card: `manualIntentFor` had no `ManualFlipFace` case at all, so no seed
      // could turn a permanent over however many faces it had. Same `> 0`
      // reasoning as the entry canary above — it asserts the path is reachable,
      // and getting there means drawing Jace, affording him, resolving him, and
      // then rolling the one manual tool in nine that flips.
      expect(totals.transformedIntoPlaneswalker).toBeGreaterThan(0);
    },
    600_000,
  );

  test('a fuzzed game never leaks a library into any projection', () => {
    const p = picker('leak');
    const game = Game.create(
      makeSpec({ players: 4, seed: 'leak', decks: [DECK, DECK, DECK, DECK], librarySize: 60 }),
      deps(),
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
      for (const id of Object.keys(view.cards)) {
        expect(libraries.has(id), `${viewer} can see library card ${id}`).toBe(false);
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
      makeSpec({ players: 4, seed: 'rewind', decks: [DECK, DECK, DECK, DECK], librarySize: 60 }),
      deps(),
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
