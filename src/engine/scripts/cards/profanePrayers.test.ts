// `Profane Prayers` — two Clerics on the whole battlefield mean 2 in and
// 2 back.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PROFANE_PRAYERS_SCRIPT } from './profanePrayers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function prayed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Profane Prayers', 'Moonrise Cleric'], ['Moonrise Cleric']],
    scripts: createRegistry([PROFANE_PRAYERS_SCRIPT]),
  });
  put(g, 'p1', 'Moonrise Cleric');
  put(g, 'p2', 'Moonrise Cleric');
  settle(g);
  const spell = put(g, 'p1', 'Profane Prayers', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }),
  );
  settle(g);
  return g;
}

describe('Profane Prayers', () => {
  test('X = 2 Clerics across both boards: p2 takes 2 and I gain 2', () => {
    const g = prayed();
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = prayed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
