// `Mechanized Ninja Cavalry` — entering pays a 1/1 Robot.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MECHANIZED_NINJA_CAVALRY_SCRIPT } from './mechanizedNinjaCavalry';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CAVALRY = 'Mechanized Ninja Cavalry';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Mechanized Ninja Cavalry', () => {
  test('entering pays a Robot token', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVALRY], []],
      scripts: createRegistry([MECHANIZED_NINJA_CAVALRY_SCRIPT]),
    });
    put(g, 'p1', CAVALRY);
    settle(g);
    const robots = battlefieldOf(g, 'p1').filter(
      (id) => nameOf(g, id) === 'Robot' && g.state.cards[id]?.isToken,
    );
    expect(robots).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CAVALRY], []],
      scripts: createRegistry([MECHANIZED_NINJA_CAVALRY_SCRIPT]),
    });
    put(g, 'p1', CAVALRY);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
