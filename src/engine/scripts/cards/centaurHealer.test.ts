// `Centaur Healer` — the ETB gain 3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CENTAUR_HEALER_SCRIPT } from './centaurHealer';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HEALER = 'Centaur Healer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Centaur Healer', () => {
  test('entering gains its controller 3 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[HEALER], []],
      scripts: createRegistry([CENTAUR_HEALER_SCRIPT]),
    });
    put(g, 'p1', HEALER);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[HEALER], []],
      scripts: createRegistry([CENTAUR_HEALER_SCRIPT]),
    });
    put(g, 'p1', HEALER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
