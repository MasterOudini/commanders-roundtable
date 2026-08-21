// `Sailor of Means` — entering pays a Treasure.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAILOR_OF_MEANS_SCRIPT } from './sailorOfMeans';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function sailed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sailor of Means'], []],
    scripts: createRegistry([SAILOR_OF_MEANS_SCRIPT]),
  });
  put(g, 'p1', 'Sailor of Means');
  settle(g);
  return g;
}

describe('Sailor of Means', () => {
  test('entering pays one Treasure', () => {
    const g = sailed();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = sailed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
