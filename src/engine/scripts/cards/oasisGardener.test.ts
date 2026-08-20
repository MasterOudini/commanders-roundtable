// `Oasis Gardener` — the entry pays 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OASIS_GARDENER_SCRIPT } from './oasisGardener';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Oasis Gardener', () => {
  test('entering gains 2', () => {
    const g = startedGame({
      players: 2,
      decks: [['Oasis Gardener'], []],
      scripts: createRegistry([OASIS_GARDENER_SCRIPT]),
    });
    put(g, 'p1', 'Oasis Gardener');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Oasis Gardener'], []],
      scripts: createRegistry([OASIS_GARDENER_SCRIPT]),
    });
    put(g, 'p1', 'Oasis Gardener');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
