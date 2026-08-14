// `Kor Celebrant` — its OWN entry pays 1 (the printed self arm), and
// another creature of mine pays again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KOR_CELEBRANT_SCRIPT } from './korCelebrant';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CELEBRANT = 'Kor Celebrant';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [CELEBRANT, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([KOR_CELEBRANT_SCRIPT]),
  });
  put(g, 'p1', CELEBRANT);
  settle(g);
  return g;
}

describe('Kor Celebrant', () => {
  test('its OWN entry pays 1 — the printed self arm', () => {
    const g = board();
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('another creature of mine entering pays again', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players.p1?.life).toBe(42);
  });

  test("an opponent's creature pays nothing — the controller filter", () => {
    const g = board();
    put(g, 'p2', BEARS);
    settle(g);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
