// `Inspiring Cleric` — entering pays 4 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INSPIRING_CLERIC_SCRIPT } from './inspiringCleric';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CLERIC = 'Inspiring Cleric';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[CLERIC], []],
    scripts: createRegistry([INSPIRING_CLERIC_SCRIPT]),
  });
  put(g, 'p1', CLERIC);
  settle(g);
  return g;
}

describe('Inspiring Cleric', () => {
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
