// `Dwarven Mine` — both halves from both sides: alone it enters TAPPED and
// pays nothing; behind three other Mountains it enters UNTAPPED and pays the
// Dwarf.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DWARVEN_MINE_SCRIPT } from './dwarvenMine';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const MINE = 'Dwarven Mine';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dwarves(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Dwarf').length;
}

describe('Dwarven Mine', () => {
  test('alone: enters TAPPED, and the enters-untapped trigger stays silent', () => {
    const g = startedGame({
      players: 2,
      decks: [[MINE, MOUNTAIN], []],
      scripts: createRegistry([DWARVEN_MINE_SCRIPT]),
    });
    const mine = put(g, 'p1', MINE);
    settle(g);
    expect(g.state.cards[mine]?.tapped).toBe(true);
    expect(dwarves(g)).toBe(0);
  });

  test('behind three other Mountains: enters UNTAPPED and creates the Dwarf', () => {
    const g = startedGame({
      players: 2,
      decks: [[MINE, MOUNTAIN], []],
      scripts: createRegistry([DWARVEN_MINE_SCRIPT]),
    });
    put(g, 'p1', MOUNTAIN);
    put(g, 'p1', MOUNTAIN);
    put(g, 'p1', MOUNTAIN);
    settle(g);
    const mine = put(g, 'p1', MINE);
    settle(g);
    expect(g.state.cards[mine]?.tapped).toBe(false);
    expect(dwarves(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[MINE, MOUNTAIN], []],
      scripts: createRegistry([DWARVEN_MINE_SCRIPT]),
    });
    put(g, 'p1', MOUNTAIN);
    put(g, 'p1', MOUNTAIN);
    put(g, 'p1', MOUNTAIN);
    settle(g);
    put(g, 'p1', MINE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
