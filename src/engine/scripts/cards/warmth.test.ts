// `Warmth` — an OPPONENT'S red cast gains me 2; my own red cast pays nothing,
// and a non-red cast of theirs pays nothing either.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WARMTH_SCRIPT } from './warmth';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WARMTH = 'Warmth';
const RED = 'Cyclops of One-Eyed Pass'; // {2}{R}{R} — a plain red creature
const GREEN = 'Grizzly Bears'; // {1}{G}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [WARMTH, RED],
      [RED, GREEN],
    ],
    scripts: createRegistry([WARMTH_SCRIPT]),
  });
  put(g, 'p1', WARMTH);
  settle(g);
  return g;
}

function theirCast(g: Game, name: string, symbol: 'R' | 'G'): void {
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol, amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 4 }));
  const card = put(g, 'p2', name, 'hand');
  must(g.submit({ t: 'CastSpell', player: 'p2', card }));
  settle(g);
}

describe('Warmth', () => {
  test("an opponent's RED cast gains me 2", () => {
    const g = board();
    theirCast(g, RED, 'R');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test("an opponent's GREEN cast pays nothing", () => {
    const g = board();
    theirCast(g, GREEN, 'G');
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('my OWN red cast pays nothing — the opponent filter holds', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    const card = put(g, 'p1', RED, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = board();
    theirCast(g, RED, 'R');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
