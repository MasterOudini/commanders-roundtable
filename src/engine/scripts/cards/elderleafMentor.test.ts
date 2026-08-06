// `Elderleaf Mentor` — entering brings the Elf Warrior.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELDERLEAF_MENTOR_SCRIPT } from './elderleafMentor';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MENTOR = 'Elderleaf Mentor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Elderleaf Mentor', () => {
  test('entering creates the 1/1 Elf Warrior', () => {
    const g = startedGame({
      players: 2,
      decks: [[MENTOR], []],
      scripts: createRegistry([ELDERLEAF_MENTOR_SCRIPT]),
    });
    put(g, 'p1', MENTOR);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Elf Warrior')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MENTOR], []],
      scripts: createRegistry([ELDERLEAF_MENTOR_SCRIPT]),
    });
    put(g, 'p1', MENTOR);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
