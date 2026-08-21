// `Stronghold Discipline` — each player pays their OWN creature count: two
// for me, one for them.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRONGHOLD_DISCIPLINE_SCRIPT } from './strongholdDiscipline';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function disciplined(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Stronghold Discipline', 'Grizzly Bears', 'Grizzly Bears'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([STRONGHOLD_DISCIPLINE_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stronghold Discipline', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Stronghold Discipline', () => {
  test('each player loses their own count', () => {
    const g = disciplined();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const g = disciplined();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
