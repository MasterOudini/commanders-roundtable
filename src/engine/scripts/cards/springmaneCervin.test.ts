// `Springmane Cervin` — the entry gains 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPRINGMANE_CERVIN_SCRIPT } from './springmaneCervin';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cervined(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Springmane Cervin'], []],
    scripts: createRegistry([SPRINGMANE_CERVIN_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Springmane Cervin');
  settle(g);
  return g;
}

describe('Springmane Cervin', () => {
  test('the entry gains 2', () => {
    const g = cervined();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = cervined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
