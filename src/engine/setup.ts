// Creating a game and dealing opening hands.

import { n, narrated, ref, vb } from './narrate';
import type { ColorLetter } from '../data/cardTypes';
import { shuffle, type RngState } from './rng';
import { emitted, type Emitted } from './log';
import { instanceIdAt } from './types/ids';
import type { EventBody } from './types/events';
import type { InstanceId, OracleId, PlayerId, PrintingId } from './types/ids';
import { DEFAULT_OPTIONS, type GameOptions, type GameState } from './types/state';

export interface SetupCard {
  readonly oracleId: OracleId;
  readonly printingId: PrintingId;
}

export interface SetupPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly commanders: readonly SetupCard[];
  /** The 99 (or however many). Order does not matter — it is shuffled. */
  readonly library: readonly SetupCard[];
  readonly identity: readonly ColorLetter[];
}

export interface SetupSpec {
  readonly gameId: string;
  readonly seed: string;
  readonly players: readonly SetupPlayer[];
  readonly options?: Partial<GameOptions>;
  /** Omit to roll for it. Tests pin it; a real game should not. */
  readonly startingPlayer?: PlayerId;
}

/**
 * Everything from "four people clicked ready" to "everyone is looking at seven
 * cards".
 *
 * ⚠️ Instance ids are allocated by a COUNTER here, in a fixed order (player by
 * player, commanders then library). That is what makes them reproducible: the
 * 41st instance created in a replayed game is `c41`, exactly as it was live.
 * Allocating them from a shuffled order, or from the deck file's order, would
 * make the log's ids depend on something the log does not record.
 */
export function newGame(spec: SetupSpec, rngState: RngState): Emitted {
  const options: GameOptions = { ...DEFAULT_OPTIONS, ...spec.options };
  const events: EventBody[] = [];
  const seating = spec.players.map((p) => p.id);

  events.push({
    t: 'GameCreated',
    gameId: spec.gameId,
    options,
    seating,
    players: spec.players.map((p, i) => ({ id: p.id, name: p.name, seat: i })),
    seed: spec.seed,
  });

  let next = 0;
  let rng = rngState;
  const libraries = new Map<PlayerId, InstanceId[]>();

  for (const player of spec.players) {
    const commanders = player.commanders.map((c) => ({ id: instanceIdAt(++next), ...c }));
    const cards = player.library.map((c) => ({ id: instanceIdAt(++next), ...c }));
    events.push({
      t: 'DeckLoaded',
      player: player.id,
      cards,
      commanders,
      identity: player.identity,
    });
    libraries.set(player.id, cards.map((c) => c.id));
  }

  for (const player of spec.players) {
    const ids = libraries.get(player.id) ?? [];
    const drawn = shuffle(rng, ids);
    rng = drawn.next;
    events.push({ t: 'LibraryShuffled', player: player.id, order: drawn.value });
  }

  // The starting player. CR 103.1 is a die roll; a seeded draw is the same
  // thing with a record of it, which is what lets a replay reproduce the game.
  let startingPlayer = spec.startingPlayer;
  if (!startingPlayer) {
    const pick = shuffle(rng, seating);
    rng = pick.next;
    startingPlayer = pick.value[0] ?? seating[0] ?? '';
  }

  events.push({ t: 'GameStarted', startingPlayer });
  events.push({ t: 'GamePhaseChanged', phase: 'mulligan' });
  // ⚠️ `ref` rather than `who(state, …)`: there is no state yet, only the spec.
  const first = ref(
    startingPlayer,
    spec.players.find((p) => p.id === startingPlayer)?.name ?? startingPlayer,
    'you',
  );
  events.push(
    narrated(
      n`${first} ${vb(startingPlayer, 'goes', 'go')} first. ${options.startingLife} life each.`,
      startingPlayer,
    ),
  );

  // Opening hands. Drawn from the TOP, which is the end of the array.
  for (const player of spec.players) {
    const ids = libraries.get(player.id) ?? [];
    void ids;
    events.push(...drawFromTop(player.id, options.startingHandSize, orderAfterShuffle(events, player.id)));
  }

  return emitted(events, rng);
}

/** The shuffled order this batch just recorded for a player. */
function orderAfterShuffle(events: readonly EventBody[], player: PlayerId): readonly InstanceId[] {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.t === 'LibraryShuffled' && e.player === player) return e.order;
  }
  return [];
}

/** `count` cards off the top of a known library order, as one CardsMoved. */
export function drawFromTop(
  player: PlayerId,
  count: number,
  library: readonly InstanceId[],
): EventBody[] {
  const take = Math.min(count, library.length);
  if (take === 0) return [];
  const ids = library.slice(library.length - take).reverse();
  return [
    {
      t: 'CardsMoved',
      moves: ids.map((id) => ({
        card: id,
        from: { kind: 'library' as const, player },
        to: { kind: 'hand' as const, player },
      })),
    },
  ];
}

/** How many cards a player must bottom if they keep now. CR 103.5 + the free first. */
export function bottomCountFor(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  if (!p) return 0;
  const free = state.options.freeFirstMulligan ? 1 : 0;
  return Math.max(0, p.mulligan.taken - free);
}

/** Every seated player has kept and finished bottoming. */
export function mulligansComplete(state: GameState): boolean {
  return state.seating.every((id) => {
    const p = state.players[id];
    return !!p && p.mulligan.kept && p.mulligan.toBottom === 0;
  });
}
