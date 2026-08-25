// `Wily Goblin` — one Treasure on the way in, mine.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WILY_GOBLIN_SCRIPT } from './wilyGoblin';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GOBLIN = 'Wily Goblin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GOBLIN], []],
    scripts: createRegistry([WILY_GOBLIN_SCRIPT]),
  });
  put(g, 'p1', GOBLIN);
  settle(g);
  return g;
}

describe('Wily Goblin', () => {
  test('the entry makes exactly one Treasure, under MY control', () => {
    const g = entered();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(1);
    expect(battlefieldOf(g, 'p2').filter((id) => nameOf(g, id) === 'Treasure')).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
