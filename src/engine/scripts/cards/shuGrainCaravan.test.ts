// `Shu Grain Caravan` — entering pays 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHU_GRAIN_CARAVAN_SCRIPT } from './shuGrainCaravan';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function caravaned(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Shu Grain Caravan'], []],
    scripts: createRegistry([SHU_GRAIN_CARAVAN_SCRIPT]),
  });
  put(g, 'p1', 'Shu Grain Caravan');
  settle(g);
  return g;
}

describe('Shu Grain Caravan', () => {
  test('entering pays 2 life', () => {
    const g = caravaned();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = caravaned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
