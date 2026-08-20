// `Outlaw Medic` — dying draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OUTLAW_MEDIC_SCRIPT } from './outlawMedic';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mediced(): { g: Game; medic: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Outlaw Medic'], []],
    scripts: createRegistry([OUTLAW_MEDIC_SCRIPT]),
  });
  const medic = put(g, 'p1', 'Outlaw Medic');
  settle(g);
  return { g, medic };
}

describe('Outlaw Medic', () => {
  test('dying draws a card', () => {
    const { g, medic } = mediced();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: medic,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, medic } = mediced();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: medic,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
