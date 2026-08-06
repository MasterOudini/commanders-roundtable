// `Falcon Abomination` — entering brings the decayed Zombie, a REAL
// printing the oracle can name.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FALCON_ABOMINATION_SCRIPT } from './falconAbomination';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ABOMINATION = 'Falcon Abomination';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Falcon Abomination', () => {
  test('entering creates the 2/2 decayed Zombie', () => {
    const g = startedGame({
      players: 2,
      decks: [[ABOMINATION], []],
      scripts: createRegistry([FALCON_ABOMINATION_SCRIPT]),
    });
    put(g, 'p1', ABOMINATION);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Zombie')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[ABOMINATION], []],
      scripts: createRegistry([FALCON_ABOMINATION_SCRIPT]),
    });
    put(g, 'p1', ABOMINATION);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
