// `Aven of Enduring Hope` — the self-ETB gain, on the controller.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AVEN_OF_ENDURING_HOPE_SCRIPT } from './avenOfEnduringHope';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const AVEN = 'Aven of Enduring Hope';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Aven of Enduring Hope', () => {
  test('entering gains its controller 3 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[AVEN], []],
      scripts: createRegistry([AVEN_OF_ENDURING_HOPE_SCRIPT]),
    });
    put(g, 'p1', AVEN);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[AVEN], []],
      scripts: createRegistry([AVEN_OF_ENDURING_HOPE_SCRIPT]),
    });
    put(g, 'p1', AVEN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
