// `Relic Barrier` — taps an artifact sideways.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RELIC_BARRIER_SCRIPT } from './relicBarrier';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function barred(): { g: Game; ring: string } {
  const g = startedGame({
    players: 2,
    decks: [['Relic Barrier'], ['Sol Ring']],
    scripts: createRegistry([RELIC_BARRIER_SCRIPT]),
  });
  const barrier = put(g, 'p1', 'Relic Barrier');
  const ring = put(g, 'p2', 'Sol Ring');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: barrier,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: ring }],
    }),
  );
  settle(g);
  return { g, ring };
}

describe('Relic Barrier', () => {
  test('the targeted artifact ends tapped', () => {
    const { g, ring } = barred();
    expect(g.state.cards[ring]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = barred();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
