// `Ravenous Lindwurm` — four life on arrival.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAVENOUS_LINDWURM_SCRIPT } from './ravenousLindwurm';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Ravenous Lindwurm', () => {
  test('gains 4 on entry', () => {
    const g = startedGame({
      players: 2,
      decks: [['Ravenous Lindwurm'], []],
      scripts: createRegistry([RAVENOUS_LINDWURM_SCRIPT]),
    });
    put(g, 'p1', 'Ravenous Lindwurm');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [['Ravenous Lindwurm'], []],
      scripts: createRegistry([RAVENOUS_LINDWURM_SCRIPT]),
    });
    put(g, 'p1', 'Ravenous Lindwurm');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
