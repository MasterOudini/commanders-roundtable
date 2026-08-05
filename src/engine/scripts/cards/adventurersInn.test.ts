// `Adventurer's Inn` — Radiant Fountain's twin to the word; the deeper cases
// (re-entry from a graveyard, a different card not firing it) live in
// `radiantFountain.test.ts`. This file proves THIS card's script, including
// that "you" is the controller — an opponent's Inn pays the opponent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ADVENTURERS_INN_SCRIPT } from './adventurersInn';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const INN = "Adventurer's Inn";

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[INN], [INN]],
    scripts: createRegistry([ADVENTURERS_INN_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

describe("Adventurer's Inn", () => {
  test('its own entry gains its controller 2', () => {
    const g = game();
    put(g, 'p1', INN);
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test("an OPPONENT'S Inn pays the opponent — 'you' is the controller", () => {
    const g = game();
    put(g, 'p2', INN);
    settle(g);
    expect(g.state.players['p2']?.life).toBe(42);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const g = game();
    put(g, 'p1', INN);
    put(g, 'p2', INN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
