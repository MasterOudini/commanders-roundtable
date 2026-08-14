// `Guarded Heir` — TWO 3/3 Knights with DISTINCT ids.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GUARDED_HEIR_SCRIPT } from './guardedHeir';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HEIR = 'Guarded Heir';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Guarded Heir', () => {
  test('entering creates two DISTINCT 3/3 Knights', () => {
    const g = startedGame({
      players: 2,
      decks: [[HEIR], []],
      scripts: createRegistry([GUARDED_HEIR_SCRIPT]),
    });
    put(g, 'p1', HEIR);
    settle(g);
    const knights = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Knight');
    expect(knights).toHaveLength(2);
    expect(new Set(knights).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[HEIR], []],
      scripts: createRegistry([GUARDED_HEIR_SCRIPT]),
    });
    put(g, 'p1', HEIR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
