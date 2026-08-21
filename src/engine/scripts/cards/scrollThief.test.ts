// `Scroll Thief` — connecting draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCROLL_THIEF_SCRIPT } from './scrollThief';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thieved(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Scroll Thief'], []],
    scripts: createRegistry([SCROLL_THIEF_SCRIPT]),
  });
  const thief = put(g, 'p1', 'Scroll Thief');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: thief, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 120_000);
  settle(g);
  return { g, mid };
}

describe('Scroll Thief', () => {
  test('connecting draws a card', () => {
    const { g, mid } = thieved();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g } = thieved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
