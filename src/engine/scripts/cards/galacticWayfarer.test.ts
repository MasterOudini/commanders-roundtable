// `Galactic Wayfarer` — the ETB Lander, on the token's own pinned printing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GALACTIC_WAYFARER_SCRIPT } from './galacticWayfarer';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WAYFARER = 'Galactic Wayfarer';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function landers(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Lander').length;
}

describe('Galactic Wayfarer', () => {
  test('entering creates a Lander', () => {
    const g = startedGame({
      players: 2,
      decks: [[WAYFARER], []],
      scripts: createRegistry([GALACTIC_WAYFARER_SCRIPT]),
    });
    put(g, 'p1', WAYFARER);
    settle(g);
    expect(landers(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[WAYFARER], []],
      scripts: createRegistry([GALACTIC_WAYFARER_SCRIPT]),
    });
    put(g, 'p1', WAYFARER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
