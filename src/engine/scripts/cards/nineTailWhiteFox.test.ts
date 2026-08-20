// `Nine-Tail White Fox` — connecting with a player draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NINE_TAIL_WHITE_FOX_SCRIPT } from './nineTailWhiteFox';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foxed(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Nine-Tail White Fox'], []],
    scripts: createRegistry([NINE_TAIL_WHITE_FOX_SCRIPT]),
  });
  const fox = put(g, 'p1', 'Nine-Tail White Fox');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: fox, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
  return { g, mid };
}

describe('Nine-Tail White Fox', () => {
  test('connecting draws a card', () => {
    const { g, mid } = foxed();
    expect((g.state.zones.hand['p1'] ?? []).length).toBeGreaterThanOrEqual(mid + 1);
    expect(g.state.players['p2']?.life).toBeLessThan(40);
  });

  test('replays to the same hash', () => {
    const { g } = foxed();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
