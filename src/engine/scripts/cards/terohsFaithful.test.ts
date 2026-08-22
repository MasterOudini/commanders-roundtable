// `Teroh's Faithful` — the plain ETB gain at four.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TEROHS_FAITHFUL_SCRIPT } from './terohsFaithful';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FAITHFUL = "Teroh's Faithful";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[FAITHFUL], []],
    scripts: createRegistry([TEROHS_FAITHFUL_SCRIPT]),
  });
  put(g, 'p1', FAITHFUL);
  settle(g);
  return g;
}

describe("Teroh's Faithful", () => {
  test('entering gains 4 life', () => {
    expect(entered().state.players.p1?.life).toBe(44);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
