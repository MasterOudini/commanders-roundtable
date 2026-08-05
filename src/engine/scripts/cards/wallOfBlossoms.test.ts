// `Wall of Blossoms` — Wall of Omens' twin to the word; the empty-library case
// lives in `wallOfOmens.test.ts`. This file proves THIS card's script draws for
// its own controller, wherever it enters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WALL_OF_BLOSSOMS_SCRIPT } from './wallOfBlossoms';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WALL = 'Wall of Blossoms';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[], [WALL]],
    scripts: createRegistry([WALL_OF_BLOSSOMS_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Wall of Blossoms', () => {
  test("an opponent's Wall draws the OPPONENT a card", () => {
    const g = game();
    // Staged through the graveyard so the hand arithmetic cannot race the
    // entry — see wallOfOmens.test.ts for the measured reason.
    const id = put(g, 'p2', WALL, 'graveyard');
    settle(g);
    const p1Before = idsIn(g, 'p1', 'hand').length;
    const p2Before = idsIn(g, 'p2', 'hand').length;
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'battlefield', player: 'p2' } }),
    );
    settle(g);
    expect(idsIn(g, 'p2', 'hand').length).toBe(p2Before + 1);
    expect(idsIn(g, 'p1', 'hand').length).toBe(p1Before);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p2', WALL);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
