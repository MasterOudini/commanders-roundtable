// `Jungle Barrier` — entering draws a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JUNGLE_BARRIER_SCRIPT } from './jungleBarrier';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BARRIER = 'Jungle Barrier';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[BARRIER], []],
    scripts: createRegistry([JUNGLE_BARRIER_SCRIPT]),
  });
  put(g, 'p1', BARRIER);
  settle(g);
  return g;
}

describe('Jungle Barrier', () => {
  test('entering draws its controller a card', () => {
    const g = entered();
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
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
