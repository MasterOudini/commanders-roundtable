// `Sudden Insight` — DISTINCT mana values, not a card count: two copies of
// one spell plus one of another draw TWO, and the dead land counts not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUDDEN_INSIGHT_SCRIPT } from './suddenInsight';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function insightful(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Sudden Insight', 'Lightning Bolt', 'Lightning Bolt', 'Grizzly Bears', 'Swamp'],
      [],
    ],
    scripts: createRegistry([SUDDEN_INSIGHT_SCRIPT]),
  });
  // Two mana-value-1 Bolts and one mana-value-2 Bears = TWO distinct values;
  // the Swamp is a land and counts for nothing.
  put(g, 'p1', 'Lightning Bolt', 'graveyard');
  put(g, 'p1', 'Lightning Bolt', 'graveyard');
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Swamp', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sudden Insight', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 6 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Sudden Insight', () => {
  test('two distinct mana values draw two', () => {
    const { g, before } = insightful();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1 + 2);
  });

  test('replays to the same hash', () => {
    const { g } = insightful();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
