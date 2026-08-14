// `Hornet Queen` — entering brings FOUR Insects with distinct ids.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HORNET_QUEEN_SCRIPT } from './hornetQueen';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const QUEEN = 'Hornet Queen';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[QUEEN], []],
    scripts: createRegistry([HORNET_QUEEN_SCRIPT]),
  });
  put(g, 'p1', QUEEN);
  settle(g);
  return g;
}

describe('Hornet Queen', () => {
  test('entering creates four Insects with distinct ids', () => {
    const g = entered();
    const insects = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Insect');
    expect(insects).toHaveLength(4);
    expect(new Set(insects).size).toBe(4);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
