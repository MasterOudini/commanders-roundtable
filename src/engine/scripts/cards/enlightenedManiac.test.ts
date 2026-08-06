// `Enlightened Maniac` — entering brings the 3/2 Eldrazi Horror.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ENLIGHTENED_MANIAC_SCRIPT } from './enlightenedManiac';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MANIAC = 'Enlightened Maniac';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Enlightened Maniac', () => {
  test('entering creates the 3/2 Eldrazi Horror', () => {
    const g = startedGame({
      players: 2,
      decks: [[MANIAC], []],
      scripts: createRegistry([ENLIGHTENED_MANIAC_SCRIPT]),
    });
    put(g, 'p1', MANIAC);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Eldrazi Horror')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MANIAC], []],
      scripts: createRegistry([ENLIGHTENED_MANIAC_SCRIPT]),
    });
    put(g, 'p1', MANIAC);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
