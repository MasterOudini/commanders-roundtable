// `Sanguimancy` — devotion to black decides both the draw and the bill.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SANGUIMANCY_SCRIPT } from './sanguimancy';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bled(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [
      // Two Rathi Trappers on the battlefield carry one {B} pip each —
      // devotion 2.
      ['Sanguimancy', 'Rathi Trapper', 'Rathi Trapper'],
      [],
    ],
    scripts: createRegistry([SANGUIMANCY_SCRIPT]),
  });
  const a = put(g, 'p1', 'Rathi Trapper');
  const b = put(g, 'p1', 'Rathi Trapper');
  expect(a).not.toBe(b);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sanguimancy', 'hand');
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mid };
}

describe('Sanguimancy', () => {
  test('two {B} pips draw two and cost two', () => {
    const { g, mid } = bled();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid - 1 + 2);
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g } = bled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
