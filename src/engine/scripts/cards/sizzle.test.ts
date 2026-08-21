// `Sizzle` — 3 to each opponent; the caster keeps their 40.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SIZZLE_SCRIPT } from './sizzle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sizzled(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Sizzle'], []],
    scripts: createRegistry([SIZZLE_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sizzle', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Sizzle', () => {
  test('each opponent takes 3; the caster takes nothing', () => {
    const g = sizzled();
    expect(g.state.players['p2']?.life).toBe(37);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = sizzled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
