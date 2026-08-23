// `Verdant Force` — EACH upkeep, not just mine: the test watches an
// opponent's upkeep pay too, which is the whole difference from the "your
// upkeep" variant.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VERDANT_FORCE_SCRIPT } from './verdantForce';
import { advanceUntil, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const FORCE = 'Verdant Force';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saprolings(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Saproling';
  }).length;
}

describe('Verdant Force', () => {
  test("an OPPONENT's upkeep pays too, and the token is MINE", () => {
    const g = startedGame({
      players: 2,
      decks: [[FORCE], []],
      scripts: createRegistry([VERDANT_FORCE_SCRIPT]),
    });
    put(g, 'p1', FORCE);
    settle(g);
    const before = saprolings(g);

    // Walk to the NEXT upkeep, whoever's it is, and again to the one after.
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    settle(g);
    const afterOne = saprolings(g);
    expect(afterOne).toBeGreaterThan(before);

    advanceUntil(g, (s) => s.turn.turnNumber > turn + 1, 120_000);
    settle(g);
    // Two more turns, two more upkeeps — one of them an opponent's.
    expect(saprolings(g)).toBeGreaterThan(afterOne);

    const anySaproling = g.state.zones.battlefield.find((id) => {
      const c = g.state.cards[id];
      return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Saproling';
    });
    expect(anySaproling && g.state.cards[anySaproling]?.controller).toBe('p1');
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[FORCE], []],
      scripts: createRegistry([VERDANT_FORCE_SCRIPT]),
    });
    put(g, 'p1', FORCE);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
