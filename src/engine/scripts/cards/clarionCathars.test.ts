// `Clarion Cathars` — the ETB Human.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CLARION_CATHARS_SCRIPT } from './clarionCathars';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CATHARS = 'Clarion Cathars';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Clarion Cathars', () => {
  test('entering creates a real 1/1 Human token', () => {
    const g = startedGame({
      players: 2,
      decks: [[CATHARS], []],
      scripts: createRegistry([CLARION_CATHARS_SCRIPT]),
    });
    put(g, 'p1', CATHARS);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CATHARS], []],
      scripts: createRegistry([CLARION_CATHARS_SCRIPT]),
    });
    put(g, 'p1', CATHARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
