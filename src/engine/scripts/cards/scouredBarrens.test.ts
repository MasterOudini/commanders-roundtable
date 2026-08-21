// `Scoured Barrens` — enters tapped and pays 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCOURED_BARRENS_SCRIPT } from './scouredBarrens';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landed(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Scoured Barrens'], []],
    scripts: createRegistry([SCOURED_BARRENS_SCRIPT]),
  });
  const land = put(g, 'p1', 'Scoured Barrens');
  settle(g);
  return { g, land };
}

describe('Scoured Barrens', () => {
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
