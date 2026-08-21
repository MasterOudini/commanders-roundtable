// `Take Inventory` — Frantic Inventory's self-name census on a second id:
// one draw plus one per namesake already in the graveyard.
//
// ⚠️ The hand baseline is captured immediately BEFORE the cast, never before
// the `put`s — `put()` fetches from the library OR the opening hand, and a
// baseline taken earlier measures the fetch as well as the draw (D169, met
// again in D240 and D255).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TAKE_INVENTORY_SCRIPT } from './takeInventory';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const NAME = 'Take Inventory';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hand(g: Game): number {
  return (g.state.zones.hand.p1 ?? []).length;
}

/** Casts one copy with `buried` namesakes already in the graveyard. */
function inventoried(buried: number): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[NAME, NAME, NAME, NAME], []],
    scripts: createRegistry([TAKE_INVENTORY_SCRIPT]),
  });
  for (let i = 0; i < buried; i++) put(g, 'p1', NAME, 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', NAME, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  const before = hand(g);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  // The copy cast left the hand, so the draws are the delta plus that one.
  return { g, drew: hand(g) - before + 1 };
}

describe('Take Inventory', () => {
  test('an empty graveyard draws exactly one', () => {
    expect(inventoried(0).drew).toBe(1);
  });

  test('two namesakes in the graveyard draw three — the resolving copy counts itself NOT', () => {
    expect(inventoried(2).drew).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = inventoried(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
