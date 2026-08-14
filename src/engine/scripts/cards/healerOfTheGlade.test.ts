// `Healer of the Glade` — entering pays 3 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HEALER_OF_THE_GLADE_SCRIPT } from './healerOfTheGlade';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const HEALER = 'Healer of the Glade';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[HEALER], []],
    scripts: createRegistry([HEALER_OF_THE_GLADE_SCRIPT]),
  });
  put(g, 'p1', HEALER);
  settle(g);
  return g;
}

describe('Healer of the Glade', () => {
  test('entering gains its controller 3 life', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(43);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
