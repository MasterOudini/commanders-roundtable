// `Peach Garden Oath` — two life per creature sworn to you.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PEACH_GARDEN_OATH_SCRIPT } from './peachGardenOath';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sworn(creatures: number): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Peach Garden Oath', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([PEACH_GARDEN_OATH_SCRIPT]),
  });
  for (let i = 0; i < creatures; i++) put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Peach Garden Oath', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Peach Garden Oath', () => {
  test('counts only its controller creatures', () => {
    const g = sworn(3);
    expect(g.state.players['p1']?.life).toBe(46);
  });

  test('an empty board gains nothing', () => {
    const g = sworn(0);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = sworn(2);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
