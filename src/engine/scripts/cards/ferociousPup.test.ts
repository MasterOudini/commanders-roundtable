// `Ferocious Pup` — entering brings the 2/2 Wolf.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FEROCIOUS_PUP_SCRIPT } from './ferociousPup';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const PUP = 'Ferocious Pup';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Ferocious Pup', () => {
  test('entering creates the 2/2 Wolf', () => {
    const g = startedGame({
      players: 2,
      decks: [[PUP], []],
      scripts: createRegistry([FEROCIOUS_PUP_SCRIPT]),
    });
    put(g, 'p1', PUP);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Wolf')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[PUP], []],
      scripts: createRegistry([FEROCIOUS_PUP_SCRIPT]),
    });
    put(g, 'p1', PUP);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
