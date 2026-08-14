// `Head of the Homestead` — entering brings two Rabbits with DISTINCT ids
// (D164's allocator teeth).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEAD_OF_THE_HOMESTEAD_SCRIPT } from './headOfTheHomestead';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HEAD = 'Head of the Homestead';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HEAD], []],
    scripts: createRegistry([HEAD_OF_THE_HOMESTEAD_SCRIPT]),
  });
  put(g, 'p1', HEAD);
  settle(g);
  return g;
}

describe('Head of the Homestead', () => {
  test('entering creates two Rabbits with distinct ids', () => {
    const g = entered();
    const rabbits = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Rabbit');
    expect(rabbits).toHaveLength(2);
    expect(new Set(rabbits).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
