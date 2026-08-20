// `Nimble Thopterist` — the entry builds a Thopter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIMBLE_THOPTERIST_SCRIPT } from './nimbleThopterist';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thopters(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Thopter';
  }).length;
}

describe('Nimble Thopterist', () => {
  test('entering builds a Thopter', () => {
    const g = startedGame({
      players: 2,
      decks: [['Nimble Thopterist'], []],
      scripts: createRegistry([NIMBLE_THOPTERIST_SCRIPT]),
    });
    put(g, 'p1', 'Nimble Thopterist');
    settle(g);
    expect(thopters(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Nimble Thopterist'], []],
      scripts: createRegistry([NIMBLE_THOPTERIST_SCRIPT]),
    });
    put(g, 'p1', 'Nimble Thopterist');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
