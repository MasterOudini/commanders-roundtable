// Staff of the Mind Magus — the Island arm of the five-Staff family
// (the deep matrix lives on the Death Magus).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STAFF_OF_THE_MIND_MAGUS_SCRIPT } from './staffOfTheMindMagus';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function staffed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Staff of the Mind Magus', 'Island'], []],
    scripts: createRegistry([STAFF_OF_THE_MIND_MAGUS_SCRIPT]),
  });
  put(g, 'p1', 'Staff of the Mind Magus');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Island');
  settle(g);
  return g;
}

describe('Staff of the Mind Magus', () => {
  test('the Island entry pays 1', () => {
    const g = staffed();
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = staffed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
