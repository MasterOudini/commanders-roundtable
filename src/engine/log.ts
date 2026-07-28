// The append-only log: committing events, replaying them, hashing the result.
//
// ⚠️ APPEND-ONLY, ALWAYS. Nothing truncates the log — not a cancelled cast, not
// a rewind. A cancelled cast emits COMPENSATING events (`cause.kind ===
// 'rewindCompensation'`); a group rewind re-folds a PREFIX of the log into a
// fresh state and keeps the whole history on disk. Truncation is easier to read
// and destroys the one property that reconnect, replay and the trigger bus all
// rest on.

import { hashOf } from './hash';
import { apply } from './reducer';
import { seedRng, type RngState } from './rng';
import { EMPTY_COUNTERS } from './types/ids';
import type { EventBody, EventCause, GameEvent } from './types/events';
import { DEFAULT_OPTIONS, type GameState } from './types/state';

/**
 * What a producer returns: events, plus the RNG state if it consumed any.
 *
 * ⚠️ The rng advance is recorded on the LAST event of the batch, and `apply`
 * takes `state.rng` from `rngAfter` rather than re-running the generator. That
 * makes replay exact by construction: adding or reordering an event upstream
 * cannot drift the shuffle, because the shuffle's outcome is already in the log
 * and the generator is never consulted twice.
 */
export interface Emitted {
  readonly events: readonly EventBody[];
  readonly rng?: RngState;
}

export function emitted(events: readonly EventBody[], rng?: RngState): Emitted {
  return rng === undefined ? { events } : { events, rng };
}

export interface CommitResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * Wrap a batch of event bodies into log entries and fold them in.
 *
 * `stepId` is the choreographer's grouping key: everything one unit of engine
 * work produced shares one, so LIFO stack resolution is visibly ordered while
 * independent things inside a group still overlap.
 */
export function commit(
  state: GameState,
  log: readonly GameEvent[],
  batch: Emitted,
  cause: EventCause,
  stepId: number,
): { state: GameState; log: GameEvent[]; events: GameEvent[] } {
  const out: GameEvent[] = [];
  let next = state;
  let seq = log.length;
  const last = batch.events.length - 1;
  for (let i = 0; i < batch.events.length; i++) {
    const body = batch.events[i];
    if (!body) continue;
    const carriesRng = batch.rng !== undefined && i === last;
    const event: GameEvent = {
      seq: seq++,
      stepId,
      body,
      cause,
      ...(carriesRng ? { rngBefore: state.rng, rngAfter: batch.rng } : {}),
    };
    next = apply(next, event);
    out.push(event);
  }
  return { state: next, log: [...log, ...out], events: out };
}

/** A game before anything has happened. `GameCreated` is always event 0. */
export function emptyState(seed = 'unseeded'): GameState {
  return {
    gameId: '',
    options: DEFAULT_OPTIONS,
    gamePhase: 'lobby',
    seating: [],
    players: {},
    cards: {},
    zones: { library: {}, hand: {}, battlefield: [], graveyard: {}, exile: {}, command: {} },
    stack: [],
    turn: {
      turnNumber: 0,
      activePlayer: '',
      phase: 'beginning',
      step: 'untap',
      turnBasedActionsDone: false,
      cleanupNeedsRepeat: false,
    },
    priority: {
      player: null,
      passedSinceLastAction: [],
      stackAdds: 0,
      seenStackAdds: {},
      awaiting: null,
      holdingPriority: null,
    },
    combat: null,
    pendingCast: null,
    untilEndOfTurn: [],
    pendingTriggers: [],
    winners: [],
    rng: seedRng(seed),
    eventCount: 0,
    counters: EMPTY_COUNTERS,
    narration: [],
    stepId: 0,
  };
}

/**
 * Re-fold a log into a state.
 *
 * This is the same `apply` the live game uses — not a parallel implementation.
 * A second implementation would agree right up until it didn't, and the whole
 * value of `stateHash(replay(log)) === stateHash(live)` is that it compares two
 * runs of the SAME code over the same data, so a mismatch means a genuine
 * nondeterminism rather than a transcription slip.
 */
export function replay(events: readonly GameEvent[], seed = 'unseeded'): GameState {
  let state = emptyState(seed);
  for (const event of events) state = apply(state, event);
  return state;
}

/** Re-fold only the first `count` events. The whole implementation of rewind. */
export function replayPrefix(events: readonly GameEvent[], count: number, seed = 'unseeded'): GameState {
  let state = emptyState(seed);
  for (let i = 0; i < Math.min(count, events.length); i++) {
    const event = events[i];
    if (event) state = apply(state, event);
  }
  return state;
}

/**
 * A stable hash of everything that IS the game.
 *
 * Deliberately covers the narration too: two states that differ only in what
 * the log says happened are still different states, and a rules change that
 * altered a log line without altering the board is exactly the kind of drift a
 * golden log exists to catch.
 */
export function stateHash(state: GameState): string {
  return hashOf({
    gameId: state.gameId,
    options: state.options,
    gamePhase: state.gamePhase,
    seating: state.seating,
    players: state.players,
    cards: state.cards,
    zones: state.zones,
    stack: state.stack,
    turn: state.turn,
    priority: state.priority,
    combat: state.combat,
    pendingCast: state.pendingCast,
    pendingTriggers: state.pendingTriggers,
    winners: state.winners,
    rng: state.rng,
    eventCount: state.eventCount,
    counters: state.counters,
    narration: state.narration,
  });
}

/** NDJSON, one `GameEvent` per line. What lands in `games/<id>.ndjson`. */
export function toNdjson(events: readonly GameEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + (events.length > 0 ? '\n' : '');
}

/**
 * Parse an NDJSON log. A torn final line — the app was killed mid-write — is
 * DISCARDED rather than throwing, because the alternative is an unopenable game.
 */
export function fromNdjson(text: string): GameEvent[] {
  const out: GameEvent[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      out.push(JSON.parse(line) as GameEvent);
    } catch {
      break;
    }
  }
  return out;
}
