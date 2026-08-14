// `Lone Missionary` — entering pays 4 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LONE_MISSIONARY_SCRIPT } from './loneMissionary';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MISSIONARY = 'Lone Missionary';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[MISSIONARY], []],
    scripts: createRegistry([LONE_MISSIONARY_SCRIPT]),
  });
  put(g, 'p1', MISSIONARY);
  settle(g);
  return g;
}

describe('Lone Missionary', () => {
  test('entering gains its controller 4 life', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
