// `Songs of the Damned` — two dead Bears make {B}{B}; the dead Swamp
// contributes nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SONGS_OF_THE_DAMNED_SCRIPT } from './songsOfTheDamned';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sung(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Songs of the Damned', 'Grizzly Bears', 'Grizzly Bears', 'Swamp'], []],
    scripts: createRegistry([SONGS_OF_THE_DAMNED_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Swamp', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Songs of the Damned', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Songs of the Damned', () => {
  test('two creature cards make {B}{B}; the land counts not', () => {
    const g = sung();
    expect(g.state.players['p1']?.pool.B).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = sung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
