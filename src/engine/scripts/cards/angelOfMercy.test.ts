// `Angel of Mercy` — ETB gain 3 behind a keyword line; lean twin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANGEL_OF_MERCY_SCRIPT } from './angelOfMercy';
import { advanceUntil, put, startedGame } from '../../testing/harness';

describe('Angel of Mercy', () => {
  test('gains 3 on entry and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Angel of Mercy'], []],
      scripts: createRegistry([ANGEL_OF_MERCY_SCRIPT]),
    });
    put(g, 'p1', 'Angel of Mercy');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players['p1']?.life).toBe(43);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
