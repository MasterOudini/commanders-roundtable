// Driving one seat: when to think, when to act, and when to stop.
//
// ⚠️ THE HAZARD THIS EXISTS FOR. `loopbackPair` delivers SYNCHRONOUSLY, so a
// submit runs the host, updates the client and fires the client's subscribers —
// all inside the bot's own `submit` call. A runner that decided from inside that
// callback would drive the entire game to completion in one call: no frames, no
// beats, one enormous choreographer burst, and `maybeSwitchSeat`'s drain poll
// never getting a turn.
//
// ⚠️ `notify()` NEVER DECIDES. It marks the seat dirty and arms the clock. A
// burst of ten updates is one wake-up.
//
// ⚠️ `step()` is exposed so a headless test can drive the seat in a plain loop
// with no timers at all. That is deliberately not "a clock that fires
// instantly": a synchronous clock re-enters through the submit and recurses once
// per game action, which is a stack overflow dressed as a fast test.

import type { Intent } from '../engine/types/intents';
import type { Awaiting } from '../engine/types/state';
import { decide } from './policy';
import type { BotConfig, BotFaultKind, BotPort } from './types';

/**
 * The two impure things a running seat needs. Injected so `src/bot/` stays
 * clock-free and testable — see the purity note in `types.ts`.
 */
export interface BotClock {
  /** Run `fn` in `ms`. Returns a cancel. */
  delay(fn: () => void, ms: number): () => void;
  /** Has the table caught up? The bot waits for the choreographer to drain. */
  settled(): boolean;
}

export interface BotFault {
  readonly kind: BotFaultKind;
  readonly why: string;
  readonly seat: string;
}

export interface RunnerOptions {
  readonly port: BotPort;
  readonly cfg: BotConfig;
  readonly clock: BotClock;
  /** Injected, so `src/game/` decides whether a submit goes through the session. */
  readonly submit: (intent: Intent) => void;
  readonly onFault?: (fault: BotFault) => void;
}

export interface BotRunner {
  /** Something changed. Cheap, and safe to call from inside a submit. */
  notify(): void;
  /** Do at most one thing. Returns true if an intent was submitted. */
  step(): boolean;
  readonly faults: readonly BotFault[];
  stop(): void;
}

/** How long to keep waiting for the table to catch up before acting anyway. */
const DRAIN_CAP_MS = 4000;
const DRAIN_POLL_MS = 80;
/** Three identical answers to an identical position is a livelock, not a game. */
const SAME_STATE_LIMIT = 3;

/**
 * A key for "the game is asking the same thing about the same position".
 *
 * ⚠️ BOTH HALVES ARE NEEDED. A REJECTED intent produces no events, so the count
 * freezes; a cast → cancel → cast livelock DOES move the count while leaving the
 * question identical. Either alone misses one of them.
 */
function positionKey(awaiting: Awaiting | null): string {
  if (!awaiting) return 'priority';
  if (awaiting.kind === 'chooseTargets') return `chooseTargets:${awaiting.stackId}`;
  if (awaiting.kind === 'orderBlockers') return `orderBlockers:${awaiting.attacker}`;
  if (awaiting.kind === 'orderAttackers') return `orderAttackers:${awaiting.blocker}`;
  return awaiting.kind;
}

export function createRunner(opts: RunnerOptions): BotRunner {
  const { port, cfg, clock, submit, onFault } = opts;
  const faults: BotFault[] = [];

  let stopped = false;
  let armed = false;
  let cancelTimer: (() => void) | null = null;
  let inFlight = false;
  let dirty = false;
  let waitedMs = 0;

  let lastEventCount = -1;
  let lastKey = '';
  let sameState = 0;
  let lastRejectSeq = 0;
  let attempt = 0;

  const raise = (kind: BotFaultKind, why: string): void => {
    const fault: BotFault = { kind, why, seat: port.snapshot().you };
    faults.push(fault);
    onFault?.(fault);
    // ⚠️ A fault stops THIS SEAT rather than retrying. Every one of them means
    // "no answer exists", and a seat that spins on one burns the game's budget
    // while looking busy. The human is told and can take the seat or rewind.
    stopped = true;
  };

  function arm(ms: number): void {
    if (armed || stopped) return;
    armed = true;
    cancelTimer = clock.delay(() => {
      armed = false;
      cancelTimer = null;
      fire();
    }, ms);
  }

  function fire(): void {
    if (stopped) return;
    // ⚠️ The drain gate, with the same 4-second escape hatch `maybeSwitchSeat`
    // uses — without it a wedged beat wedges the bot, and a wedged bot is a
    // wedged game.
    if (!clock.settled() && waitedMs < DRAIN_CAP_MS) {
      waitedMs += DRAIN_POLL_MS;
      arm(DRAIN_POLL_MS);
      return;
    }
    waitedMs = 0;
    // ⚠️ `dirty` is the re-entrancy record: an update that arrived while we were
    // inside our own submit. Re-arming on it is what stops the seat going quiet
    // after a burst that landed at exactly the wrong moment.
    if (step() || dirty) arm(cfg.thinkMs);
  }

  function step(): boolean {
    if (stopped) return false;
    if (inFlight) {
      // Re-entered from inside our own submit. Come back for it.
      dirty = true;
      return false;
    }
    const snapshot = port.snapshot();
    if (!snapshot.running || snapshot.finished) return false;

    const decision = decide(port, snapshot, cfg, attempt);
    if (decision.t === 'wait') {
      attempt = 0;
      return false;
    }
    if (decision.t === 'fault') {
      raise(decision.kind, decision.why);
      return false;
    }

    const key = positionKey(snapshot.awaiting);
    if (snapshot.eventCount === lastEventCount && key === lastKey) {
      sameState++;
      if (sameState >= SAME_STATE_LIMIT) {
        raise('noProgress', `answered "${key}" ${sameState} times with nothing moving`);
        return false;
      }
    } else {
      sameState = 0;
    }
    lastEventCount = snapshot.eventCount;
    lastKey = key;

    inFlight = true;
    dirty = false;
    try {
      submit(decision.intent);
    } finally {
      inFlight = false;
    }

    // ⚠️ A rejection bumps `rejectSeq` and produces no events. Answering the
    // same way again is the livelock; `attempt` is what makes the next answer
    // the minimal legal one (no attackers, no blocks, cancel the cast).
    const after = port.snapshot();
    attempt = after.rejectSeq !== lastRejectSeq && after.message !== null ? attempt + 1 : 0;
    lastRejectSeq = after.rejectSeq;
    return true;
  }

  return {
    notify(): void {
      if (stopped) return;
      dirty = true;
      arm(cfg.thinkMs);
    },
    step,
    get faults(): readonly BotFault[] {
      return faults;
    },
    stop(): void {
      stopped = true;
      cancelTimer?.();
      cancelTimer = null;
      armed = false;
    },
  };
}
