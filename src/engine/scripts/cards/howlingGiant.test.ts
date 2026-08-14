// `Howling Giant` — entering brings two Wolves with distinct ids.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HOWLING_GIANT_SCRIPT } from './howlingGiant';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GIANT = 'Howling Giant';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[GIANT], []],
    scripts: createRegistry([HOWLING_GIANT_SCRIPT]),
  });
  put(g, 'p1', GIANT);
  settle(g);
  return g;
}

describe('Howling Giant', () => {
  test('entering creates two Wolves with distinct ids', () => {
    const g = entered();
    const wolves = battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Wolf');
    expect(wolves).toHaveLength(2);
    expect(new Set(wolves).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
