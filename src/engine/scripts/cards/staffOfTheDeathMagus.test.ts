// `Staff of the Death Magus` — the family's deep test: a black cast pays,
// a red cast does not, a Swamp entry pays, a Mountain entry does not.
//
// ⚠️ Life is read through `life(g)` rather than inline: an inline
// `!== 41` guard NARROWS the literal type, and TypeScript then rejects a
// later `!== 42` comparison as impossible (`types '41' and '42' have no
// overlap`). A function call re-widens it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STAFF_OF_THE_DEATH_MAGUS_SCRIPT } from './staffOfTheDeathMagus';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function life(g: Game): number {
  return g.state.players['p1']?.life ?? 0;
}

function staffed(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Staff of the Death Magus', 'Songs of the Damned', 'Sizzle', 'Swamp', 'Mountain'],
      [],
    ],
    scripts: createRegistry([STAFF_OF_THE_DEATH_MAGUS_SCRIPT]),
  });
  put(g, 'p1', 'Staff of the Death Magus');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // The BLACK cast pays 1: 40 -> 41 (the unregistered spell resolves inert).
  const black = put(g, 'p1', 'Songs of the Damned', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: black }));
  settle(g);
  if (life(g) !== 41) throw new Error(`the black cast must pay 1 — life ${life(g)}`);
  // The RED cast pays nothing.
  const red = put(g, 'p1', 'Sizzle', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: red }));
  settle(g);
  if (life(g) !== 41) throw new Error(`the red cast must pay nothing — life ${life(g)}`);
  // The SWAMP entry pays 1: 41 -> 42.
  put(g, 'p1', 'Swamp');
  settle(g);
  if (life(g) !== 42) throw new Error(`the Swamp entry must pay 1 — life ${life(g)}`);
  // The MOUNTAIN entry pays nothing.
  put(g, 'p1', 'Mountain');
  settle(g);
  return g;
}

describe('Staff of the Death Magus', () => {
  test('black casts and Swamp entries pay; red casts and Mountains do not', () => {
    const g = staffed();
    expect(life(g)).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = staffed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
