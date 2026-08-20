// `Price of Progress` — each player pays for their own nonbasics; basics
// are free.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRICE_OF_PROGRESS_SCRIPT } from './priceOfProgress';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function priced(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Price of Progress', "Phyrexia's Core"],
      ['Darksteel Citadel', "Phyrexia's Core"],
    ],
    scripts: createRegistry([PRICE_OF_PROGRESS_SCRIPT]),
  });
  put(g, 'p1', "Phyrexia's Core");
  put(g, 'p1', 'Mountain');
  put(g, 'p2', 'Darksteel Citadel');
  put(g, 'p2', "Phyrexia's Core");
  settle(g);
  const spell = put(g, 'p1', 'Price of Progress', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Price of Progress', () => {
  test('one nonbasic costs me 2; their two cost them 4; the Mountain is free', () => {
    const g = priced();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(36);
  });

  test('replays to the same hash', () => {
    const g = priced();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
