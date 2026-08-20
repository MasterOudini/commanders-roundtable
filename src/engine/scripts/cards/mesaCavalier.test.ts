// `Mesa Cavalier` — the entry pays 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MESA_CAVALIER_SCRIPT } from './mesaCavalier';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Mesa Cavalier', () => {
  test('entering gains 2', () => {
    const g = startedGame({
      players: 2,
      decks: [['Mesa Cavalier'], []],
      scripts: createRegistry([MESA_CAVALIER_SCRIPT]),
    });
    put(g, 'p1', 'Mesa Cavalier');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Mesa Cavalier'], []],
      scripts: createRegistry([MESA_CAVALIER_SCRIPT]),
    });
    put(g, 'p1', 'Mesa Cavalier');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
