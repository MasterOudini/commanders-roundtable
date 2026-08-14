// `Kemba's Skyguard` — entering pays 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KEMBAS_SKYGUARD_SCRIPT } from './kembasSkyguard';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SKYGUARD = "Kemba's Skyguard";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[SKYGUARD], []],
    scripts: createRegistry([KEMBAS_SKYGUARD_SCRIPT]),
  });
  put(g, 'p1', SKYGUARD);
  settle(g);
  return g;
}

describe("Kemba's Skyguard", () => {
  test('entering gains its controller 2 life', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
