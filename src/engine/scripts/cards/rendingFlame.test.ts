// `Rending Flame` — a Spirit victim burns its controller too; a plain
// creature does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RENDING_FLAME_SCRIPT } from './rendingFlame';
import { advanceUntil, find, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rent(name: string): { g: Game; target: string } {
  const g = startedGame({
    players: 2,
    decks: [['Rending Flame'], ['Plagued Rusalka', 'Colossal Dreadmaw']],
    scripts: createRegistry([RENDING_FLAME_SCRIPT]),
  });
  put(g, 'p2', 'Plagued Rusalka');
  put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  const target = find(g, 'p2', 'battlefield', name) as string;
  const spell = put(g, 'p1', 'Rending Flame', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target };
}

describe('Rending Flame', () => {
  test('a Spirit victim dies and its controller takes 2', () => {
    const { g, target } = rent('Plagued Rusalka');
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('a plain Dreadmaw wears 5 and the controller takes nothing', () => {
    const { g } = rent('Colossal Dreadmaw');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g } = rent('Plagued Rusalka');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
