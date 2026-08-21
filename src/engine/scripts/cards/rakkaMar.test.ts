// `Rakka Mar` — two activations over two turns, two distinct Elementals.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAKKA_MAR_SCRIPT } from './rakkaMar';
import { advanceUntil, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function summoned(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Rakka Mar'], []],
    scripts: createRegistry([RAKKA_MAR_SCRIPT]),
  });
  const rakka = put(g, 'p1', 'Rakka Mar');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rakka, abilityIndex: 0 }));
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 5, 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rakka, abilityIndex: 0 }));
  settle(g);
  return g;
}

describe('Rakka Mar', () => {
  test('two activations mint two distinct Elementals', () => {
    const g = summoned();
    const tokens = g.state.zones.battlefield.filter((id) => nameOf(g, id) === 'Elemental');
    expect(tokens).toHaveLength(2);
    expect(new Set(tokens).size).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = summoned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 6, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
