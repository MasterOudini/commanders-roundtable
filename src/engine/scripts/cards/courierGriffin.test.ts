// `Courier Griffin` — the ETB gain behind an engine keyword line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { COURIER_GRIFFIN_SCRIPT } from './courierGriffin';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GRIFFIN = 'Courier Griffin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[GRIFFIN], []],
    scripts: createRegistry([COURIER_GRIFFIN_SCRIPT]),
  });
}

describe('Courier Griffin', () => {
  test('entering gains 2 life', () => {
    const g = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    put(g, 'p1', GRIFFIN);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 2);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', GRIFFIN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
