// `Cartographer's Companion` — the ETB Map, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CARTOGRAPHERS_COMPANION_SCRIPT } from './cartographersCompanion';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COMPANION = "Cartographer's Companion";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe("Cartographer's Companion", () => {
  test('entering creates a real Map token', () => {
    const g = startedGame({
      players: 2,
      decks: [[COMPANION], []],
      scripts: createRegistry([CARTOGRAPHERS_COMPANION_SCRIPT]),
    });
    put(g, 'p1', COMPANION);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Map')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[COMPANION], []],
      scripts: createRegistry([CARTOGRAPHERS_COMPANION_SCRIPT]),
    });
    put(g, 'p1', COMPANION);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
