// `Prosperity` — X = 3 hands everyone three cards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROSPERITY_SCRIPT } from './prosperity';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prospered(): { g: Game; p1Before: number; p2Before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Prosperity'], []],
    scripts: createRegistry([PROSPERITY_SCRIPT]),
  });
  settle(g);
  const spell = put(g, 'p1', 'Prosperity', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  const p1Before = (g.state.zones.hand['p1'] ?? []).length;
  const p2Before = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  settle(g);
  return { g, p1Before, p2Before };
}

describe('Prosperity', () => {
  test('each player draws exactly three', () => {
    const { g, p1Before, p2Before } = prospered();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(p1Before - 1 + 3);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(p2Before + 3);
  });

  test('replays to the same hash', () => {
    const { g } = prospered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
