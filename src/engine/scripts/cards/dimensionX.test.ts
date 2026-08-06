// `Dimension X` — enters TAPPED (the engine's D134 rule) and the def pays
// the 1 life on the same entry.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DIMENSION_X_SCRIPT } from './dimensionX';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LAND = 'Dimension X';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Dimension X', () => {
  test('enters tapped AND gains 1 — both halves of the card', () => {
    const g = startedGame({
      players: 2,
      decks: [[LAND], []],
      scripts: createRegistry([DIMENSION_X_SCRIPT]),
    });
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    const land = put(g, 'p1', LAND);
    settle(g);
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[LAND], []],
      scripts: createRegistry([DIMENSION_X_SCRIPT]),
    });
    const land = put(g, 'p1', LAND);
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [land], tapped: false }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
