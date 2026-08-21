// `Primordial Pachyderm` — two life on arrival.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRIMORDIAL_PACHYDERM_SCRIPT } from './primordialPachyderm';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Primordial Pachyderm', () => {
  test('gains 2 on entry', () => {
    const g = startedGame({
      players: 2,
      decks: [['Primordial Pachyderm'], []],
      scripts: createRegistry([PRIMORDIAL_PACHYDERM_SCRIPT]),
    });
    put(g, 'p1', 'Primordial Pachyderm');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Primordial Pachyderm'], []],
      scripts: createRegistry([PRIMORDIAL_PACHYDERM_SCRIPT]),
    });
    put(g, 'p1', 'Primordial Pachyderm');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
