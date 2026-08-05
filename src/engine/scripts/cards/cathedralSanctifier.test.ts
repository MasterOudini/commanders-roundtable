// `Cathedral Sanctifier` — the ETB gain 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CATHEDRAL_SANCTIFIER_SCRIPT } from './cathedralSanctifier';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SANCTIFIER = 'Cathedral Sanctifier';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Cathedral Sanctifier', () => {
  test('entering gains its controller 3 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[SANCTIFIER], []],
      scripts: createRegistry([CATHEDRAL_SANCTIFIER_SCRIPT]),
    });
    put(g, 'p1', SANCTIFIER);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[SANCTIFIER], []],
      scripts: createRegistry([CATHEDRAL_SANCTIFIER_SCRIPT]),
    });
    put(g, 'p1', SANCTIFIER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
