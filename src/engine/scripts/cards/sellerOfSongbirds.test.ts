// `Seller of Songbirds` — entering deploys one Bird.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SELLER_OF_SONGBIRDS_SCRIPT } from './sellerOfSongbirds';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokens(g: Game): number {
  return (g.state.zones.battlefield ?? []).filter((id) => g.state.cards[id]?.isToken).length;
}

function sold(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Seller of Songbirds'], []],
    scripts: createRegistry([SELLER_OF_SONGBIRDS_SCRIPT]),
  });
  put(g, 'p1', 'Seller of Songbirds');
  settle(g);
  return g;
}

describe('Seller of Songbirds', () => {
  test('entering deploys one Bird token', () => {
    const g = sold();
    expect(tokens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = sold();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
