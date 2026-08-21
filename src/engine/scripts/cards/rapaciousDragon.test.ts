// `Rapacious Dragon` — the entry hoards two distinct Treasures.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAPACIOUS_DRAGON_SCRIPT } from './rapaciousDragon';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hoarded(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Rapacious Dragon'], []],
    scripts: createRegistry([RAPACIOUS_DRAGON_SCRIPT]),
  });
  put(g, 'p1', 'Rapacious Dragon');
  settle(g);
  return g;
}

describe('Rapacious Dragon', () => {
  test('entering mints two distinct Treasures', () => {
    const g = hoarded();
    const treasures = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Treasure');
    expect(treasures).toHaveLength(2);
    expect(new Set(treasures).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = hoarded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
