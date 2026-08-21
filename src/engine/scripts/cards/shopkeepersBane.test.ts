// `Shopkeeper's Bane` — attacking pays 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHOPKEEPERS_BANE_SCRIPT } from './shopkeepersBane';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function baned(): Game {
  const g = startedGame({
    players: 2,
    decks: [["Shopkeeper's Bane"], []],
    scripts: createRegistry([SHOPKEEPERS_BANE_SCRIPT]),
  });
  const bane = put(g, 'p1', "Shopkeeper's Bane");
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: bane, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  settle(g);
  return g;
}

describe("Shopkeeper's Bane", () => {
  test('attacking pays 2 life', () => {
    const g = baned();
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const g = baned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
