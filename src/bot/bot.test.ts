// Four bots, one host, a whole game — over the REAL host and the REAL clients.
//
// ⚠️ `makeTable` is not a mock. It is `HostSession` plus one `ClientSession` per
// seat over `loopbackPair`, which is exactly what `session.startLocal` builds
// for a solo game minus the renderer. So a game that plays here plays at a
// table, and it plays here with no Electron, no React and no timers.
//
// ⚠️ Timers are absent on purpose. `step()` is driven directly rather than
// through a clock that fires instantly, because a synchronous clock re-enters
// through the submit and recurses once per game action — a stack overflow
// dressed up as a fast test. See the header of `runner.ts`.

import { describe, expect, test } from 'vitest';
import { makeTable, settle } from '../net/testing/table';
import type { GameEvent } from '../engine/types/events';
import { replay } from '../engine/log';
import { stateHash } from '../engine/log';
import { createRunner, type BotFault } from './runner';
import { BOT_STOPS, type BotPort } from './types';

const SEED = 'bot-test-seed';

interface Played {
  readonly turns: number;
  readonly acts: number;
  readonly finished: boolean;
  readonly hostHash: string;
  readonly replayHash: string;
  readonly faults: readonly BotFault[];
  readonly eventCount: number;
  readonly kinds: Record<string, number>;
}

function tally(events: readonly GameEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    const t = (e as { body?: { t?: string } }).body?.t ?? 'unknown';
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

async function playBotGame(seats = 4, maxRounds = 3000): Promise<Played> {
  const events: GameEvent[] = [];
  const table = makeTable({ seed: SEED, onEvents: (e) => events.push(...e) });
  for (let i = 0; i < seats; i++) table.join(`Bot${i + 1}`);
  const started = await table.startGame(60);
  expect(started.ok, started.message).toBe(true);

  const runners = table.clients.map((client) =>
    createRunner({
      port: client.session as unknown as BotPort,
      cfg: { level: 1, thinkMs: 0 },
      // ⚠️ `delay` never runs its callback: nothing here arms the clock, because
      // the loop below calls `step()` itself.
      clock: { delay: () => () => undefined, settled: () => true },
      submit: (intent) => client.session.submit(intent),
    }),
  );

  // Every bot sets its own stop policy through the ordinary intent, exactly as
  // it will in a real game — so the policy is in the log and auditable.
  for (const client of table.clients) {
    client.session.submit({ t: 'SetStops', player: client.session.snapshot().you, stops: BOT_STOPS });
  }

  let acts = 0;
  for (let round = 0; round < maxRounds; round++) {
    let moved = false;
    for (const runner of runners) {
      if (runner.step()) {
        moved = true;
        acts++;
      }
    }
    if (!moved) break;
    if (table.clients[0]?.session.snapshot().finished) break;
  }
  await settle();

  const snapshot = table.clients[0]!.session.snapshot();
  return {
    turns: snapshot.turn.number,
    acts,
    finished: snapshot.finished,
    hostHash: table.host.hash(),
    replayHash: stateHash(replay(events, SEED)),
    faults: runners.flatMap((r) => [...r.faults]),
    eventCount: table.host.eventCount(),
    kinds: tally(events),
  };
}

describe('a bot plays a whole game', () => {
  let played: Played;

  test('four bots play without wedging', async () => {
    played = await playBotGame();
    // ⚠️ A canary on the GAME, not on the loop. A driver that answered nothing
    // would also "finish" its rounds; what proves it played is turns and events.
    const shape = `acts ${played.acts} · turns ${played.turns} · events ${played.eventCount} · finished ${played.finished}`;
    expect(played.acts, shape).toBeGreaterThan(60);
    expect(played.turns, shape).toBeGreaterThan(5);
    expect(played.eventCount, shape).toBeGreaterThan(1000);
  }, 120_000);

  /**
   * ⚠️ THE ASSERTION THAT KEEPS THE BOT HONEST, and the reason it exists is
   * measured: a bot that only plays lands and attacks with whatever it has still
   * finishes a game, still never faults and still replays to the same hash. On
   * the first run of this suite it cast FOUR spells in 88 turns and every other
   * check here was green — the stop policy was auto-passing it out of its own
   * main phase (see `BOT_STOPS`). "It played a game" is not the same as "it
   * played", and only these counters tell the two apart.
   */
  test('it casts, blocks and attacks — not just plays lands', () => {
    const k = played.kinds;
    expect(k['LandPlayed'] ?? 0).toBeGreaterThan(30);
    expect(k['SpellCast'] ?? 0).toBeGreaterThan(12);
    expect(k['AttackersDeclared'] ?? 0).toBeGreaterThan(20);
    expect(k['BlockersDeclared'] ?? 0).toBeGreaterThan(20);
    expect(k['CombatDamageDealt'] ?? 0).toBeGreaterThan(20);
  });

  /**
   * ⚠️ THE HEADLINE ASSERTION. A fault is the bot saying "no answer exists" —
   * every one of the five prompts `simplestIntent` cannot answer would show up
   * here, and so would a livelock, a rejection loop or a thirteenth `Awaiting`
   * kind added later.
   */
  test('no prompt went unanswered', () => {
    expect(played.faults.map((f) => `${f.seat}: ${f.kind} — ${f.why}`)).toEqual([]);
  });

  /**
   * ⚠️ The determinism proof, and it is structural rather than hopeful: the bot
   * only ever submits intents, the host is the only thing that reduces, and the
   * log is the host's own. Re-folding it has to give the same state — and if any
   * policy tie-break were resolved by `Math.random`, iteration order or a clock,
   * this is where it would surface.
   */
  test("the host's log replays to the same state hash", () => {
    expect(played.replayHash).toBe(played.hostHash);
  });

  /**
   * ⚠️ The same seed twice must give the same GAME, not merely a valid one. This
   * is the check that catches non-determinism creeping in through the policy —
   * the one thing the replay check above cannot see, because a replay of a
   * different game is still self-consistent.
   */
  test('the same seed plays the same game twice', async () => {
    const again = await playBotGame();
    expect(again.hostHash).toBe(played.hostHash);
    expect(again.eventCount).toBe(played.eventCount);
    expect(again.turns).toBe(played.turns);
  }, 120_000);

  test('a two-seat table plays too', async () => {
    const heads = await playBotGame(2);
    expect(heads.faults).toEqual([]);
    expect(heads.turns).toBeGreaterThan(5);
    expect(heads.replayHash).toBe(heads.hostHash);
  }, 120_000);
});
