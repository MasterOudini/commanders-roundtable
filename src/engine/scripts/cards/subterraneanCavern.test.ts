// `Subterranean Cavern` — the refuge: tapped entry AND the gain.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUBTERRANEAN_CAVERN_SCRIPT } from './subterraneanCavern';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function caverned(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Subterranean Cavern'], []],
    scripts: createRegistry([SUBTERRANEAN_CAVERN_SCRIPT]),
  });
  holdEverywhere(g);
  const land = put(g, 'p1', 'Subterranean Cavern');
  settle(g);
  return { g, land };
}

describe('Subterranean Cavern', () => {
  test('enters tapped and pays 1 life', () => {
    const { g, land } = caverned();
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('replays to the same hash', () => {
    const { g } = caverned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
