// `Tower of Eons` — 10 life for {8} and a tap, and the only Tower that asks
// for no target at all.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOWER_OF_EONS_SCRIPT } from './towerOfEons';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TOWER = 'Tower of Eons';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gained(): Game {
  const g = startedGame({
    players: 2,
    decks: [[TOWER], []],
    scripts: createRegistry([TOWER_OF_EONS_SCRIPT]),
  });
  const tower = put(g, 'p1', TOWER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tower, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Tower of Eons', () => {
  test('its controller gains 10, and nobody else moves', () => {
    const g = gained();
    expect(g.state.players.p1?.life).toBe(50);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('nothing is asked — the ability targets nothing', () => {
    const g = gained();
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = gained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
