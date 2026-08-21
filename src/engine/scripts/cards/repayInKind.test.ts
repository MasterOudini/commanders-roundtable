// `Repay in Kind` — everyone drops to the lowest total.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REPAY_IN_KIND_SCRIPT } from './repayInKind';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function repaid(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Repay in Kind'], []],
    scripts: createRegistry([REPAY_IN_KIND_SCRIPT]),
  });
  settle(g);
  must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: -29 }));
  const spell = put(g, 'p1', 'Repay in Kind', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Repay in Kind', () => {
  test('the opponent falls to my 11', () => {
    const g = repaid();
    expect(g.state.players['p1']?.life).toBe(11);
    expect(g.state.players['p2']?.life).toBe(11);
  });

  test('replays to the same hash', () => {
    const g = repaid();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
