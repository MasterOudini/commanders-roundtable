// `Llanowar Visionary` — entering draws a card (the mana line is the
// engine's).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LLANOWAR_VISIONARY_SCRIPT } from './llanowarVisionary';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const VISIONARY = 'Llanowar Visionary';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[VISIONARY], []],
    scripts: createRegistry([LLANOWAR_VISIONARY_SCRIPT]),
  });
  put(g, 'p1', VISIONARY);
  settle(g);
  return g;
}

describe('Llanowar Visionary', () => {
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
