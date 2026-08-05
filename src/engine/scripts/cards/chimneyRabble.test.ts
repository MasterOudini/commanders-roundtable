// `Chimney Rabble` — the ETB Phyrexian Goblin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CHIMNEY_RABBLE_SCRIPT } from './chimneyRabble';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const RABBLE = 'Chimney Rabble';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Chimney Rabble', () => {
  test('entering creates a real 1/1 Phyrexian Goblin token', () => {
    const g = startedGame({
      players: 2,
      decks: [[RABBLE], []],
      scripts: createRegistry([CHIMNEY_RABBLE_SCRIPT]),
    });
    put(g, 'p1', RABBLE);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Phyrexian Goblin')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[RABBLE], []],
      scripts: createRegistry([CHIMNEY_RABBLE_SCRIPT]),
    });
    put(g, 'p1', RABBLE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
