// `Rain of Embers` — one to everything: the 1/1 dies, both players
// singe.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAIN_OF_EMBERS_SCRIPT } from './rainOfEmbers';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function embered(): { g: Game; small: string; big: string } {
  const g = startedGame({
    players: 2,
    decks: [['Rain of Embers'], ['Aysen Bureaucrats', 'Grizzly Bears']],
    scripts: createRegistry([RAIN_OF_EMBERS_SCRIPT]),
  });
  const small = put(g, 'p2', 'Aysen Bureaucrats');
  const big = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Rain of Embers', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, small, big };
}

describe('Rain of Embers', () => {
  test('the 1/1 dies, the 2/2 stands, both players take 1', () => {
    const { g, small, big } = embered();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(39);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g } = embered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
