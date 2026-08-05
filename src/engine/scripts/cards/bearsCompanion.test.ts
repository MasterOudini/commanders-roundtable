// `Bear's Companion` — the 4/4 Bear, real on the battlefield.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BEARS_COMPANION_SCRIPT } from './bearsCompanion';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const COMPANION = "Bear's Companion";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe("Bear's Companion", () => {
  test('entering creates a real 4/4 Bear token', () => {
    const g = startedGame({
      players: 2,
      decks: [[COMPANION], []],
      scripts: createRegistry([BEARS_COMPANION_SCRIPT]),
    });
    put(g, 'p1', COMPANION);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Bear')).toHaveLength(1);
    expect(g.log.some((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual')).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[COMPANION], []],
      scripts: createRegistry([BEARS_COMPANION_SCRIPT]),
    });
    put(g, 'p1', COMPANION);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
