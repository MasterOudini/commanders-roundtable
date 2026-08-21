// `Summit Sentinel` — the death draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUMMIT_SENTINEL_SCRIPT } from './summitSentinel';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sentried(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Summit Sentinel'], []],
    scripts: createRegistry([SUMMIT_SENTINEL_SCRIPT]),
  });
  const sentinel = put(g, 'p1', 'Summit Sentinel');
  settle(g);
  holdEverywhere(g);
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: sentinel,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  settle(g);
  return { g, before };
}

describe('Summit Sentinel', () => {
  test('the death draws a card', () => {
    const { g, before } = sentried();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
  });

  test('replays to the same hash', () => {
    const { g } = sentried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
