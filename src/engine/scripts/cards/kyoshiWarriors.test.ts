// `Kyoshi Warriors` — entering brings an Ally.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KYOSHI_WARRIORS_SCRIPT } from './kyoshiWarriors';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WARRIORS = 'Kyoshi Warriors';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[WARRIORS], []],
    scripts: createRegistry([KYOSHI_WARRIORS_SCRIPT]),
  });
  put(g, 'p1', WARRIORS);
  settle(g);
  return g;
}

describe('Kyoshi Warriors', () => {
  test('entering creates a 1/1 Ally', () => {
    const g = entered();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Ally')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
