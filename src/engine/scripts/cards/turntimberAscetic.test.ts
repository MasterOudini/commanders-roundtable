// `Turntimber Ascetic` — Tireless Missionaries' text on a second id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TURNTIMBER_ASCETIC_SCRIPT } from './turntimberAscetic';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const ASCETIC = 'Turntimber Ascetic';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[ASCETIC], []],
    scripts: createRegistry([TURNTIMBER_ASCETIC_SCRIPT]),
  });
  put(g, 'p1', ASCETIC);
  settle(g);
  return g;
}

describe('Turntimber Ascetic', () => {
  test('entering gains its controller 3, and nobody else', () => {
    const g = entered();
    expect(g.state.players.p1?.life).toBe(43);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
