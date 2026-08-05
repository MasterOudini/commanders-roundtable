// `Celestial Force` — EACH upkeep pays, whoever's turn it is.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CELESTIAL_FORCE_SCRIPT } from './celestialForce';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FORCE = 'Celestial Force';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe('Celestial Force', () => {
  test("fires on the OPPONENT's upkeep and on its controller's — each means each", () => {
    const g = startedGame({
      players: 2,
      decks: [[FORCE], []],
      scripts: createRegistry([CELESTIAL_FORCE_SCRIPT]),
    });
    put(g, 'p1', FORCE);
    settle(g);
    const before = g.state.players['p1']?.life ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber >= 2 && s.turn.step !== 'upkeep', 20_000);
    settle(g);
    const afterOne = g.state.players['p1']?.life ?? 0;
    expect(afterOne).toBe(before + 3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.turn.step !== 'upkeep', 20_000);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(before + 6);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[FORCE], []],
      scripts: createRegistry([CELESTIAL_FORCE_SCRIPT]),
    });
    put(g, 'p1', FORCE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
