// `Dragoon's Wyvern` — entering brings the 1/1 Hero.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRAGOONS_WYVERN_SCRIPT } from './dragoonsWyvern';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const WYVERN = "Dragoon's Wyvern";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe("Dragoon's Wyvern", () => {
  test('entering creates the 1/1 Hero', () => {
    const g = startedGame({
      players: 2,
      decks: [[WYVERN], []],
      scripts: createRegistry([DRAGOONS_WYVERN_SCRIPT]),
    });
    put(g, 'p1', WYVERN);
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Hero')).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[WYVERN], []],
      scripts: createRegistry([DRAGOONS_WYVERN_SCRIPT]),
    });
    put(g, 'p1', WYVERN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
