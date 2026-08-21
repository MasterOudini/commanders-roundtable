// `Shu Soldier-Farmers` — entering pays 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHU_SOLDIER_FARMERS_SCRIPT } from './shuSoldierFarmers';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function farmed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Shu Soldier-Farmers'], []],
    scripts: createRegistry([SHU_SOLDIER_FARMERS_SCRIPT]),
  });
  put(g, 'p1', 'Shu Soldier-Farmers');
  settle(g);
  return g;
}

describe('Shu Soldier-Farmers', () => {
  test('entering pays 4 life', () => {
    const g = farmed();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = farmed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
