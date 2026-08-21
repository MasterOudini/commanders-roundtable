// `Sylvan Brushstrider` — the plain ETB gain at two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYLVAN_BRUSHSTRIDER_SCRIPT } from './sylvanBrushstrider';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const STRIDER = 'Sylvan Brushstrider';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[STRIDER], []],
    scripts: createRegistry([SYLVAN_BRUSHSTRIDER_SCRIPT]),
  });
  put(g, 'p1', STRIDER);
  settle(g);
  return g;
}

describe('Sylvan Brushstrider', () => {
  test('entering gains 2 life', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
