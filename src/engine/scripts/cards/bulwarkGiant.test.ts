// `Bulwark Giant` — the ETB gain 5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BULWARK_GIANT_SCRIPT } from './bulwarkGiant';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GIANT = 'Bulwark Giant';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Bulwark Giant', () => {
  test('entering gains its controller 5 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[GIANT], []],
      scripts: createRegistry([BULWARK_GIANT_SCRIPT]),
    });
    put(g, 'p1', GIANT);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(45);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GIANT], []],
      scripts: createRegistry([BULWARK_GIANT_SCRIPT]),
    });
    put(g, 'p1', GIANT);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
