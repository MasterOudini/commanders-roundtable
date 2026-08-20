// `Preening Champion` — the entry mints the blue-and-red Elemental.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PREENING_CHAMPION_SCRIPT } from './preeningChampion';
import { advanceUntil, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function preened(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Preening Champion'], []],
    scripts: createRegistry([PREENING_CHAMPION_SCRIPT]),
  });
  put(g, 'p1', 'Preening Champion');
  settle(g);
  return g;
}

describe('Preening Champion', () => {
  test('entering mints one Elemental', () => {
    const g = preened();
    const elementals = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Elemental');
    expect(elementals).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = preened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
