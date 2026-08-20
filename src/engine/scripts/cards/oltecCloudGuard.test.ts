// `Oltec Cloud Guard` — the entry builds a Gnome.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OLTEC_CLOUD_GUARD_SCRIPT } from './oltecCloudGuard';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gnomes(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Gnome';
  }).length;
}

describe('Oltec Cloud Guard', () => {
  test('entering builds a Gnome', () => {
    const g = startedGame({
      players: 2,
      decks: [['Oltec Cloud Guard'], []],
      scripts: createRegistry([OLTEC_CLOUD_GUARD_SCRIPT]),
    });
    put(g, 'p1', 'Oltec Cloud Guard');
    settle(g);
    expect(gnomes(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Oltec Cloud Guard'], []],
      scripts: createRegistry([OLTEC_CLOUD_GUARD_SCRIPT]),
    });
    put(g, 'p1', 'Oltec Cloud Guard');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
