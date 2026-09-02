// `Zarichi Tiger` — {1}{W},{T} gains 2, past summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZARICHI_TIGER_SCRIPT } from './zarichiTiger';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TIGER = 'Zarichi Tiger';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function activated(): { g: Game; tiger: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TIGER], []],
    scripts: createRegistry([ZARICHI_TIGER_SCRIPT]),
  });
  const tiger = put(g, 'p1', TIGER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tiger, abilityIndex: 0, targets: [] }));
  settle(g);
  return { g, tiger };
}

describe('Zarichi Tiger', () => {
  test('it taps and I gain 2', () => {
    const { g, tiger } = activated();
    expect(g.state.players['p1']?.life).toBe(42);
    expect(g.state.cards[tiger]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = activated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
