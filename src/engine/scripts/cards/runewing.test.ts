// `Runewing` — dying draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUNEWING_SCRIPT } from './runewing';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function winged(): { g: Game; wing: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Runewing'], []],
    scripts: createRegistry([RUNEWING_SCRIPT]),
  });
  const wing = put(g, 'p1', 'Runewing');
  settle(g);
  return { g, wing };
}

describe('Runewing', () => {
  test('dying draws a card', () => {
    const { g, wing } = winged();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: wing,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, wing } = winged();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: wing,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
