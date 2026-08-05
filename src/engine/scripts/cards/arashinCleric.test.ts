// `Arashin Cleric` — ETB gain 3; lean twin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARASHIN_CLERIC_SCRIPT } from './arashinCleric';
import { advanceUntil, put, startedGame } from '../../testing/harness';

describe('Arashin Cleric', () => {
  test('gains 3 on entry and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Arashin Cleric'], []],
      scripts: createRegistry([ARASHIN_CLERIC_SCRIPT]),
    });
    put(g, 'p1', 'Arashin Cleric');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players['p1']?.life).toBe(43);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
