// `Jewel Thief` — entering makes a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JEWEL_THIEF_SCRIPT } from './jewelThief';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const THIEF = 'Jewel Thief';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[THIEF], []],
    scripts: createRegistry([JEWEL_THIEF_SCRIPT]),
  });
  put(g, 'p1', THIEF);
  settle(g);
  return g;
}

describe('Jewel Thief', () => {
  test('entering creates a Treasure token', () => {
    const g = entered();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
