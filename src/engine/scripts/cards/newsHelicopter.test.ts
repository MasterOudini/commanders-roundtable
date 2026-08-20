// `News Helicopter` — the entry drops a Human Citizen.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEWS_HELICOPTER_SCRIPT } from './newsHelicopter';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function citizens(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Human Citizen';
  }).length;
}

describe('News Helicopter', () => {
  test('entering drops a Human Citizen', () => {
    const g = startedGame({
      players: 2,
      decks: [['News Helicopter'], []],
      scripts: createRegistry([NEWS_HELICOPTER_SCRIPT]),
    });
    put(g, 'p1', 'News Helicopter');
    settle(g);
    expect(citizens(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['News Helicopter'], []],
      scripts: createRegistry([NEWS_HELICOPTER_SCRIPT]),
    });
    put(g, 'p1', 'News Helicopter');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
