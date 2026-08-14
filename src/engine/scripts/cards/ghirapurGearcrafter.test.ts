// `Ghirapur Gearcrafter` — the ETB Thopter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GHIRAPUR_GEARCRAFTER_SCRIPT } from './ghirapurGearcrafter';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const GEARCRAFTER = 'Ghirapur Gearcrafter';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thopters(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter').length;
}

describe('Ghirapur Gearcrafter', () => {
  test('entering creates a 1/1 Thopter with flying', () => {
    const g = startedGame({
      players: 2,
      decks: [[GEARCRAFTER], []],
      scripts: createRegistry([GHIRAPUR_GEARCRAFTER_SCRIPT]),
    });
    put(g, 'p1', GEARCRAFTER);
    settle(g);
    expect(thopters(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[GEARCRAFTER], []],
      scripts: createRegistry([GHIRAPUR_GEARCRAFTER_SCRIPT]),
    });
    put(g, 'p1', GEARCRAFTER);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
