// `Staunch Defenders` — the entry gains 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STAUNCH_DEFENDERS_SCRIPT } from './staunchDefenders';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function defended(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Staunch Defenders'], []],
    scripts: createRegistry([STAUNCH_DEFENDERS_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Staunch Defenders');
  settle(g);
  return g;
}

describe('Staunch Defenders', () => {
  test('the entry gains 4', () => {
    const g = defended();
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = defended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
