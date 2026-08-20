// `Mossbeard Ancient` — the entry pays 5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOSSBEARD_ANCIENT_SCRIPT } from './mossbeardAncient';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Mossbeard Ancient', () => {
  test('entering gains 5', () => {
    const g = startedGame({
      players: 2,
      decks: [['Mossbeard Ancient'], []],
      scripts: createRegistry([MOSSBEARD_ANCIENT_SCRIPT]),
    });
    put(g, 'p1', 'Mossbeard Ancient');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(45);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Mossbeard Ancient'], []],
      scripts: createRegistry([MOSSBEARD_ANCIENT_SCRIPT]),
    });
    put(g, 'p1', 'Mossbeard Ancient');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
