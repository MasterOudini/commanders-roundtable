// `Goblin Instigator` — the ETB Goblin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_INSTIGATOR_SCRIPT } from './goblinInstigator';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INSTIGATOR = 'Goblin Instigator';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Goblin Instigator', () => {
  test('entering creates a 1/1 Goblin', () => {
    const g = startedGame({
      players: 2,
      decks: [[INSTIGATOR], []],
      scripts: createRegistry([GOBLIN_INSTIGATOR_SCRIPT]),
    });
    put(g, 'p1', INSTIGATOR);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goblin')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[INSTIGATOR], []],
      scripts: createRegistry([GOBLIN_INSTIGATOR_SCRIPT]),
    });
    put(g, 'p1', INSTIGATOR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
