// `Dragon Trainer` — a 1/1 that brings a 4/4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRAGON_TRAINER_SCRIPT } from './dragonTrainer';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TRAINER = 'Dragon Trainer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Dragon Trainer', () => {
  test('entering creates the 4/4 Dragon', () => {
    const g = startedGame({
      players: 2,
      decks: [[TRAINER], []],
      scripts: createRegistry([DRAGON_TRAINER_SCRIPT]),
    });
    put(g, 'p1', TRAINER);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Dragon')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[TRAINER], []],
      scripts: createRegistry([DRAGON_TRAINER_SCRIPT]),
    });
    put(g, 'p1', TRAINER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
