// `Savannah Sage` — entering pays 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAVANNAH_SAGE_SCRIPT } from './savannahSage';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saged(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Savannah Sage'], []],
    scripts: createRegistry([SAVANNAH_SAGE_SCRIPT]),
  });
  put(g, 'p1', 'Savannah Sage');
  settle(g);
  return g;
}

describe('Savannah Sage', () => {
  test('entering pays 2 life', () => {
    const g = saged();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = saged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
