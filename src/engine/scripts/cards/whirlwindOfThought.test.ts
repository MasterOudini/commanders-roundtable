// `Whirlwind of Thought` — MY noncreature cast draws; my CREATURE cast does
// not; and an opponent's noncreature cast does not either.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WHIRLWIND_OF_THOUGHT_SCRIPT } from './whirlwindOfThought';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ENCHANTMENT = 'Whirlwind of Thought';
const NONCREATURE = 'Vitalize'; // {G} instant
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [ENCHANTMENT, NONCREATURE, CREATURE],
      [NONCREATURE],
    ],
    scripts: createRegistry([WHIRLWIND_OF_THOUGHT_SCRIPT]),
  });
  put(g, 'p1', ENCHANTMENT);
  settle(g);
  return g;
}

describe('Whirlwind of Thought', () => {
  test('my NONCREATURE cast draws a card', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    const spell = put(g, 'p1', NONCREATURE, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    // −1 for the cast spell, +1 for the draw: net level.
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('my CREATURE cast pays nothing', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const spell = put(g, 'p1', CREATURE, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    // −1 for the cast creature, no draw.
    expect(idsIn(g, 'p1', 'hand').length).toBe(before - 1);
  });

  test("an OPPONENT's noncreature cast pays nothing — the line says 'you'", () => {
    const g = board();
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
    const spell = put(g, 'p2', NONCREATURE, 'hand');
    const before = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('replays to the same hash', () => {
    const g = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    const spell = put(g, 'p1', NONCREATURE, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
