// `Silverback Shaman` — dying draws.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SILVERBACK_SHAMAN_SCRIPT } from './silverbackShaman';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shamaned(): { g: Game; shaman: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Silverback Shaman'], []],
    scripts: createRegistry([SILVERBACK_SHAMAN_SCRIPT]),
  });
  const shaman = put(g, 'p1', 'Silverback Shaman');
  settle(g);
  return { g, shaman };
}

describe('Silverback Shaman', () => {
  test('dying draws a card', () => {
    const { g, shaman } = shamaned();
    const mid = (g.state.zones.hand['p1'] ?? []).length;
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: shaman,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g, shaman } = shamaned();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: shaman,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
