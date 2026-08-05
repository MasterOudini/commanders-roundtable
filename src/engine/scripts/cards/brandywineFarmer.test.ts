// `Brandywine Farmer` — one line, two zone-changes: entering makes a Food,
// and LEAVING (to a hand, not a graveyard — the broader half) makes another.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BRANDYWINE_FARMER_SCRIPT } from './brandywineFarmer';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FARMER = 'Brandywine Farmer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foods(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food').length;
}

describe('Brandywine Farmer', () => {
  test('ENTERING makes a Food, and BOUNCING to hand makes another — leaves ≠ dies', () => {
    const g = startedGame({
      players: 2,
      decks: [[FARMER], []],
      scripts: createRegistry([BRANDYWINE_FARMER_SCRIPT]),
    });
    const farmer = put(g, 'p1', FARMER);
    settle(g);
    expect(foods(g)).toBe(1);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: farmer, to: { kind: 'hand', player: 'p1' } }),
    );
    settle(g);
    expect(foods(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[FARMER], []],
      scripts: createRegistry([BRANDYWINE_FARMER_SCRIPT]),
    });
    const farmer = put(g, 'p1', FARMER);
    settle(g);
    must(
      g.submit({ t: 'ManualMoveCard', player: 'p1', card: farmer, to: { kind: 'hand', player: 'p1' } }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
