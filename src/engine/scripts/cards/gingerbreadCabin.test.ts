// `Gingerbread Cabin` — both halves from both sides: alone it enters TAPPED
// and pays nothing; behind three other Forests it enters UNTAPPED and pays
// the Food.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GINGERBREAD_CABIN_SCRIPT } from './gingerbreadCabin';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CABIN = 'Gingerbread Cabin';
const FOREST = 'Forest';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foods(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Food').length;
}

describe('Gingerbread Cabin', () => {
  test('alone: enters TAPPED, and the enters-untapped trigger stays silent', () => {
    const g = startedGame({
      players: 2,
      decks: [[CABIN, FOREST], []],
      scripts: createRegistry([GINGERBREAD_CABIN_SCRIPT]),
    });
    const cabin = put(g, 'p1', CABIN);
    settle(g);
    expect(g.state.cards[cabin]?.tapped).toBe(true);
    expect(foods(g)).toBe(0);
  });

  test('behind three other Forests: enters UNTAPPED and creates the Food', () => {
    const g = startedGame({
      players: 2,
      decks: [[CABIN, FOREST], []],
      scripts: createRegistry([GINGERBREAD_CABIN_SCRIPT]),
    });
    put(g, 'p1', FOREST);
    put(g, 'p1', FOREST);
    put(g, 'p1', FOREST);
    settle(g);
    const cabin = put(g, 'p1', CABIN);
    settle(g);
    expect(g.state.cards[cabin]?.tapped).toBe(false);
    expect(foods(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CABIN, FOREST], []],
      scripts: createRegistry([GINGERBREAD_CABIN_SCRIPT]),
    });
    put(g, 'p1', FOREST);
    put(g, 'p1', FOREST);
    put(g, 'p1', FOREST);
    settle(g);
    put(g, 'p1', CABIN);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
