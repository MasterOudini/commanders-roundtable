// `Hot Dog Cart` — entering makes a Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HOT_DOG_CART_SCRIPT } from './hotDogCart';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CART = 'Hot Dog Cart';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[CART], []],
    scripts: createRegistry([HOT_DOG_CART_SCRIPT]),
  });
  put(g, 'p1', CART);
  settle(g);
  return g;
}

describe('Hot Dog Cart', () => {
  test('entering creates a Food token', () => {
    const g = entered();
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
