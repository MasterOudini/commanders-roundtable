// `Spiritual Guardian` — the entry gains 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPIRITUAL_GUARDIAN_SCRIPT } from './spiritualGuardian';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function guarded(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Spiritual Guardian'], []],
    scripts: createRegistry([SPIRITUAL_GUARDIAN_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Spiritual Guardian');
  settle(g);
  return g;
}

describe('Spiritual Guardian', () => {
  test('the entry gains 4', () => {
    const g = guarded();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = guarded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
