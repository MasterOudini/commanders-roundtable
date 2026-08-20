// `Pestered Wellguard` — every tap mints a Faerie, however it was turned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PESTERED_WELLGUARD_SCRIPT } from './pesteredWellguard';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function faeries(g: Game): number {
  return g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Faerie').length;
}

describe('Pestered Wellguard', () => {
  test('becoming tapped mints a Faerie; a tap of something else does not', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pestered Wellguard', 'Grizzly Bears'], []],
      scripts: createRegistry([PESTERED_WELLGUARD_SCRIPT]),
    });
    const guard = put(g, 'p1', 'Pestered Wellguard');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    settle(g);
    expect(faeries(g)).toBe(0);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [guard], tapped: true }));
    settle(g);
    expect(faeries(g)).toBe(1);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [guard], tapped: false }));
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [guard], tapped: true }));
    settle(g);
    expect(faeries(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Pestered Wellguard', 'Grizzly Bears'], []],
      scripts: createRegistry([PESTERED_WELLGUARD_SCRIPT]),
    });
    const guard = put(g, 'p1', 'Pestered Wellguard');
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [guard], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
