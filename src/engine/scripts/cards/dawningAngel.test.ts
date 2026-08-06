// `Dawning Angel` — the ETB gain-4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAWNING_ANGEL_SCRIPT } from './dawningAngel';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ANGEL = 'Dawning Angel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[ANGEL], []],
    scripts: createRegistry([DAWNING_ANGEL_SCRIPT]),
  });
}

describe('Dawning Angel', () => {
  test('entering gains 4', () => {
    const g = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    put(g, 'p1', ANGEL);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 4);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', ANGEL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
