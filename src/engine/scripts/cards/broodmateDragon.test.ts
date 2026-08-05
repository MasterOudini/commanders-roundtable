// `Broodmate Dragon` — the 4/4 Dragon, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BROODMATE_DRAGON_SCRIPT } from './broodmateDragon';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BROODMATE = 'Broodmate Dragon';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Broodmate Dragon', () => {
  test('entering creates a real 4/4 Dragon token', () => {
    const g = startedGame({
      players: 2,
      decks: [[BROODMATE], []],
      scripts: createRegistry([BROODMATE_DRAGON_SCRIPT]),
    });
    put(g, 'p1', BROODMATE);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Dragon')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[BROODMATE], []],
      scripts: createRegistry([BROODMATE_DRAGON_SCRIPT]),
    });
    put(g, 'p1', BROODMATE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
