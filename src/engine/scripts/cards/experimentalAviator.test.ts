// `Experimental Aviator` — TWO distinct Thopters on entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { EXPERIMENTAL_AVIATOR_SCRIPT } from './experimentalAviator';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const AVIATOR = 'Experimental Aviator';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Experimental Aviator', () => {
  test('entering creates two DISTINCT Thopters', () => {
    const g = startedGame({
      players: 2,
      decks: [[AVIATOR], []],
      scripts: createRegistry([EXPERIMENTAL_AVIATOR_SCRIPT]),
    });
    put(g, 'p1', AVIATOR);
    settle(g);
    const tokens = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter');
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[AVIATOR], []],
      scripts: createRegistry([EXPERIMENTAL_AVIATOR_SCRIPT]),
    });
    put(g, 'p1', AVIATOR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
