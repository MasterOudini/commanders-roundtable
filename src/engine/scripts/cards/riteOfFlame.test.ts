// `Rite of Flame` — {R}{R} plus one per namesake across EVERY
// graveyard; the copy resolving is on the stack and counts itself not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RITE_OF_FLAME_SCRIPT } from './riteOfFlame';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function lit(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rite of Flame', 'Rite of Flame'],
      ['Rite of Flame'],
    ],
    scripts: createRegistry([RITE_OF_FLAME_SCRIPT]),
  });
  put(g, 'p1', 'Rite of Flame', 'graveyard');
  put(g, 'p2', 'Rite of Flame', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rite of Flame', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Rite of Flame', () => {
  test('adds {R}{R} plus one per namesake in each graveyard', () => {
    const g = lit();
    // One copy in each graveyard: 2 + 2 = 4. The resolving copy is on
    // the stack while it counts, so it never counts itself.
    expect(g.state.players['p1']?.pool.R).toBe(4);
  });

  test('replays to the same hash', () => {
    const g = lit();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
