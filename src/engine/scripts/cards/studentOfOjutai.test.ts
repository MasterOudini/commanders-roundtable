// `Student of Ojutai` — a noncreature cast pays 2; a creature cast pays
// nothing. Both spells are batch-mates.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STUDENT_OF_OJUTAI_SCRIPT } from './studentOfOjutai';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function studied(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Student of Ojutai', 'Succumb to Temptation', 'Striped Bears'], []],
    scripts: createRegistry([STUDENT_OF_OJUTAI_SCRIPT]),
  });
  put(g, 'p1', 'Student of Ojutai');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // The NONCREATURE cast pays 2: 40 -> 42.
  const instant = put(g, 'p1', 'Succumb to Temptation', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: instant }));
  settle(g);
  if ((g.state.players['p1']?.life ?? 0) !== 42) {
    throw new Error(`the noncreature cast must pay 2 — life ${g.state.players['p1']?.life}`);
  }
  // The CREATURE cast pays nothing.
  const creature = put(g, 'p1', 'Striped Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: creature }));
  settle(g);
  return g;
}

describe('Student of Ojutai', () => {
  test('noncreature casts pay; creature casts do not', () => {
    const g = studied();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = studied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
