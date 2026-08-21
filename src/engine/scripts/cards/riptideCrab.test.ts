// `Riptide Crab` — dying draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RIPTIDE_CRAB_SCRIPT } from './riptideCrab';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function crabbed(): { g: Game; crab: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Riptide Crab'], []],
    scripts: createRegistry([RIPTIDE_CRAB_SCRIPT]),
  });
  const crab = put(g, 'p1', 'Riptide Crab');
  settle(g);
  return { g, crab };
}

describe('Riptide Crab', () => {
  test('dying draws a card', () => {
    const { g, crab } = crabbed();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: crab,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, crab } = crabbed();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: crab,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
