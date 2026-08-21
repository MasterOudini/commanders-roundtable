// `Sejiri Refuge` — enters tapped and pays 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEJIRI_REFUGE_SCRIPT } from './sejiriRefuge';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landed(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sejiri Refuge'], []],
    scripts: createRegistry([SEJIRI_REFUGE_SCRIPT]),
  });
  const land = put(g, 'p1', 'Sejiri Refuge');
  settle(g);
  return { g, land };
}

describe('Sejiri Refuge', () => {
  test('enters tapped and pays 1 life', () => {
    const { g, land } = landed();
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = landed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
