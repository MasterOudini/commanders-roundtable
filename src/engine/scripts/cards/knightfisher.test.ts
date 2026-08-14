// `Knightfisher` — a nontoken Bird of mine entering pays a Fish; the Fish
// it made pays nothing when a token enters (the nontoken filter, proven by
// its own product's entry).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KNIGHTFISHER_SCRIPT } from './knightfisher';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const KNIGHTFISHER = 'Knightfisher';
const KINGFISHER = 'Kingfisher';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fish(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Fish').length;
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [[KNIGHTFISHER, KINGFISHER], []],
    scripts: createRegistry([KNIGHTFISHER_SCRIPT]),
  });
  put(g, 'p1', KNIGHTFISHER);
  settle(g);
  return g;
}

describe('Knightfisher', () => {
  test('a nontoken Bird of mine entering creates a Fish — and only one', () => {
    const g = board();
    put(g, 'p1', KINGFISHER);
    settle(g);
    // One Fish from the Bird; the Fish token's own entry pays nothing
    // (nontoken), or this would read 2.
    expect(fish(g)).toBe(1);
  });

  test('its own entry pays nothing — "another"', () => {
    const g = board();
    expect(fish(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', KINGFISHER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
