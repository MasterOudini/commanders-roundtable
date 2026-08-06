// `Elder Auntie` — entering brings the two-colour Goblin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELDER_AUNTIE_SCRIPT } from './elderAuntie';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const AUNTIE = 'Elder Auntie';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Elder Auntie', () => {
  test('entering creates the 1/1 Goblin', () => {
    const g = startedGame({
      players: 2,
      decks: [[AUNTIE], []],
      scripts: createRegistry([ELDER_AUNTIE_SCRIPT]),
    });
    put(g, 'p1', AUNTIE);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Goblin')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[AUNTIE], []],
      scripts: createRegistry([ELDER_AUNTIE_SCRIPT]),
    });
    put(g, 'p1', AUNTIE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
