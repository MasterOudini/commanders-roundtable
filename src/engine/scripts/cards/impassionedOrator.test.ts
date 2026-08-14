// `Impassioned Orator` — the third id of the Sanctifier text, proven on its
// own registration: another of mine pays 1, self and opponent pay nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IMPASSIONED_ORATOR_SCRIPT } from './impassionedOrator';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ORATOR = 'Impassioned Orator';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      [ORATOR, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([IMPASSIONED_ORATOR_SCRIPT]),
  });
  put(g, 'p1', ORATOR);
  settle(g);
  return g;
}

describe('Impassioned Orator', () => {
  test('its own entry pays nothing — "another"', () => {
    const g = board();
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('another creature of mine entering pays 1', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.players.p1?.life).toBe(41);
  });

  test("an opponent's creature pays nothing — the controller filter", () => {
    const g = board();
    put(g, 'p2', BEARS);
    settle(g);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = board();
    put(g, 'p1', BEARS);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
