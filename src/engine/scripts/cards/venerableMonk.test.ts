// `Venerable Monk` — the ETB gain at 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VENERABLE_MONK_SCRIPT } from './venerableMonk';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CARD = 'Venerable Monk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[CARD], []],
    scripts: createRegistry([VENERABLE_MONK_SCRIPT]),
  });
  put(g, 'p1', CARD);
  settle(g);
  return g;
}

describe('Venerable Monk', () => {
  test('entering gains its controller 2, and nobody else', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(42);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
