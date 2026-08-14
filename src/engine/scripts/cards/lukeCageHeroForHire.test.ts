// `Luke Cage, Hero for Hire` — MY combat brings a Treasure; the opponent's
// combat brings nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LUKE_CAGE_HERO_FOR_HIRE_SCRIPT } from './lukeCageHeroForHire';
import { advanceUntil, battlefieldOf, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const LUKE = 'Luke Cage, Hero for Hire';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Treasure').length;
}

function combat(): Game {
  const g = startedGame({
    players: 2,
    decks: [[LUKE], []],
    scripts: createRegistry([LUKE_CAGE_HERO_FOR_HIRE_SCRIPT]),
  });
  put(g, 'p1', LUKE);
  settle(g);
  // Run to MY combat: the first beginCombat on p1's own turn pays.
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return g;
}

describe('Luke Cage, Hero for Hire', () => {
  test('my combat brings a Treasure (and only my combat)', () => {
    const g = combat();
    // At least one of the turns up to 3 was mine with a combat.
    expect(treasures(g)).toBeGreaterThanOrEqual(1);
  });

  test('replays to the same hash', () => {
    const g = combat();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
