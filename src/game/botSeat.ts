// Where a bot meets the running app: a clock, a client, and nothing else.
//
// ⚠️ THE ONLY IMPURE FILE IN THE BOT'S PATH, and it is deliberately two adapters
// with no decisions in it. `src/bot/` may not name a timer, the choreographer or
// the session (see the purity block in `purity.node.test.ts`), so the state
// machine lives in `src/bot/runner.ts` behind an injected clock and everything
// that cannot be unit-tested is here — which is why the bot is proven to play a
// whole game in Vitest before a line of UI exists.

import * as session from './session';
import * as choreographer from '../ui/anim/choreographer';
import { createRunner, type BotClock, type BotFault } from '../bot/runner';
import { BOT_STOPS, type BotConfig, type BotPort } from '../bot/types';

/**
 * The real clock.
 *
 * ⚠️ `settled()` is the choreographer's drain, and it is the same question
 * `maybeSwitchSeat` asks before a hand-off — a bot that acted while beats were
 * still in the air would outrun the animation of its own last move, and the
 * table would show a board nobody saw arrive.
 */
const realClock: BotClock = {
  delay: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  settled: () => {
    const s = choreographer.stats();
    return s.queuedGroups === 0 && !s.running && s.liveBeats === 0 && s.inFlight === 0;
  },
};

export interface AttachedBots {
  readonly seats: readonly string[];
  readonly faults: () => readonly BotFault[];
  stop(): void;
}

/**
 * Put a bot in each of these seats. Call after the game has started.
 *
 * ⚠️ Each runner subscribes to its OWN client. `session.subscribe` notifies only
 * for the seat being looked at (`attach`), and a bot is never the seat being
 * looked at — so a bot driven from the session's subscription would simply never
 * be told anything. `ClientSession.subscribe` is public and multi-subscriber,
 * and the existing subscription is untouched.
 */
export function attachBots(seats: readonly string[], cfg: BotConfig): AttachedBots {
  const stops: (() => void)[] = [];
  const faults: BotFault[] = [];
  const attached: string[] = [];

  for (const seat of seats) {
    const client = session.clientFor(seat);
    // A guest holds one seat and it is not a bot's; `clientFor` returns null and
    // this loop simply seats nobody, which is the whole of "no bots over the
    // wire" as an executable rule.
    if (!client) continue;

    const runner = createRunner({
      port: client as unknown as BotPort,
      cfg,
      clock: realClock,
      // ⚠️ Straight to the seat's own client, NOT through `session.submit`. That
      // would arm `maybeSwitchSeat` on every bot action for a hand-off that is
      // now always suppressed, and re-render every React subscriber inside the
      // bot's timer. The human's own client is told about the same update on the
      // normal path and notifies once.
      submit: (intent) => client.submit(intent),
      onFault: (fault) => faults.push(fault),
    });

    const off = client.subscribe(() => runner.notify());
    stops.push(() => {
      off();
      runner.stop();
    });
    attached.push(seat);

    // ⚠️ Its own stop policy, through the ordinary intent, so it is in the
    // append-only log like every other decision and a replay reproduces it.
    // See `BOT_STOPS` for why this is not `fullControl`.
    client.submit({ t: 'SetStops', player: seat, stops: BOT_STOPS });
    runner.notify();
  }

  const handle: AttachedBots = {
    seats: attached,
    faults: () => faults,
    stop: () => {
      for (const off of stops) off();
      stops.length = 0;
    },
  };
  session.setBotSeats(attached, handle.stop);
  return handle;
}
