// `Presence of the Wise` — two life per card still in hand at resolution.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRESENCE_OF_THE_WISE_SCRIPT } from './presenceOfTheWise';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wise(): { g: Game; expected: number } {
  const g = startedGame({
    players: 2,
    decks: [['Presence of the Wise'], []],
    scripts: createRegistry([PRESENCE_OF_THE_WISE_SCRIPT]),
  });
  settle(g);
  const spell = put(g, 'p1', 'Presence of the Wise', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  // The spell leaves the hand as it goes to the stack, so the census at
  // resolution is one smaller than the hand it was cast from.
  const expected = 2 * ((g.state.zones.hand['p1'] ?? []).length - 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, expected };
}

describe('Presence of the Wise', () => {
  test('gains twice the resolved hand size', () => {
    const { g, expected } = wise();
    expect(expected).toBeGreaterThan(0);
    expect(g.state.players['p1']?.life).toBe(40 + expected);
  });

  test('replays to the same hash', () => {
    const { g } = wise();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
