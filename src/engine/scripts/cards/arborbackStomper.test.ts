// `Arborback Stomper` — ETB gain 5; lean twin.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARBORBACK_STOMPER_SCRIPT } from './arborbackStomper';
import { advanceUntil, put, startedGame } from '../../testing/harness';

describe('Arborback Stomper', () => {
  test('gains 5 on entry and replays', () => {
    const g = startedGame({
      players: 2,
      decks: [['Arborback Stomper'], []],
      scripts: createRegistry([ARBORBACK_STOMPER_SCRIPT]),
    });
    put(g, 'p1', 'Arborback Stomper');
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.players['p1']?.life).toBe(45);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
