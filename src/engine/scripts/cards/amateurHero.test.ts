// `Amateur Hero` — Radiant Fountain's shape on a creature; the deep cases live
// in radiantFountain.test.ts.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AMATEUR_HERO_SCRIPT } from './amateurHero';
import { advanceUntil, put, startedGame } from '../../testing/harness';

describe('Amateur Hero', () => {
  test('gains 2 on its own entry and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Amateur Hero'], []],
      scripts: createRegistry([AMATEUR_HERO_SCRIPT]),
    });
    put(g, 'p1', 'Amateur Hero');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players['p1']?.life).toBe(42);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
