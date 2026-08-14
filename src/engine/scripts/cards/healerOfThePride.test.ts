// `Healer of the Pride` — ANOTHER creature of mine entering pays 2; its own
// entry pays nothing ("another"), and an opponent's creature pays nothing
// ("you control").

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEALER_OF_THE_PRIDE_SCRIPT } from './healerOfThePride';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HEALER = 'Healer of the Pride';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [HEALER, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([HEALER_OF_THE_PRIDE_SCRIPT]),
  });
  put(g, 'p1', HEALER);
  settle(g);
  return g;
}

describe('Healer of the Pride', () => {
  test('its own entry pays nothing — "another"', () => {
    const g = board();
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('another creature of mine entering pays 2', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players.p1?.life).toBe(42);
  });

  test("an opponent's creature pays nothing — the controller filter", () => {
    const g = board();
    put(g, 'p2', BEARS);
    settle(g);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
