// `Helpful Hunter` — entering draws a card, counted in LOG MOVES (an ETB
// draw may stage through the graveyard fetch, so hand size alone lies).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HELPFUL_HUNTER_SCRIPT } from './helpfulHunter';
import { advanceUntil, idsIn, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HUNTER = 'Helpful Hunter';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [[HUNTER], []],
    scripts: createRegistry([HELPFUL_HUNTER_SCRIPT]),
  });
  const before = idsIn(g, 'p1', 'hand').length;
  put(g, 'p1', HUNTER);
  settle(g);
  return { g, before };
}

describe('Helpful Hunter', () => {
  test('entering draws its controller a card', () => {
    const { g } = entered();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'CardsMoved' &&
          e.body.moves.some(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === 'p1',
          ),
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
