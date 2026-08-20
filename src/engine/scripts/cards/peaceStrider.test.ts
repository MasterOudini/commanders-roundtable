// `Peace Strider` — three life on arrival.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEACE_STRIDER_SCRIPT } from './peaceStrider';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Peace Strider', () => {
  test('gains 3 on entry', () => {
    const g = startedGame({
      players: 2,
      decks: [['Peace Strider'], []],
      scripts: createRegistry([PEACE_STRIDER_SCRIPT]),
    });
    put(g, 'p1', 'Peace Strider');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Peace Strider'], []],
      scripts: createRegistry([PEACE_STRIDER_SCRIPT]),
    });
    put(g, 'p1', 'Peace Strider');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
