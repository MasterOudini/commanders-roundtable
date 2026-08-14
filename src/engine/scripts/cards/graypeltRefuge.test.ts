// `Graypelt Refuge` — enters TAPPED (D134's built-in) and pays 1 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRAYPELT_REFUGE_SCRIPT } from './graypeltRefuge';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const REFUGE = 'Graypelt Refuge';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Graypelt Refuge', () => {
  test('enters tapped and gains 1 life', () => {
    const g = startedGame({
      players: 2,
      decks: [[REFUGE], []],
      scripts: createRegistry([GRAYPELT_REFUGE_SCRIPT]),
    });
    const refuge = put(g, 'p1', REFUGE);
    settle(g);
    expect(g.state.cards[refuge]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[REFUGE], []],
      scripts: createRegistry([GRAYPELT_REFUGE_SCRIPT]),
    });
    put(g, 'p1', REFUGE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
