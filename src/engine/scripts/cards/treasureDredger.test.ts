// `Treasure Dredger` — the three-part cost, every part charged: the mana,
// ONE LIFE, and the tap.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TREASURE_DREDGER_SCRIPT } from './treasureDredger';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DREDGER = 'Treasure Dredger';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasures(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Treasure';
  }).length;
}

function dredged(): { g: Game; dredger: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DREDGER], []],
    scripts: createRegistry([TREASURE_DREDGER_SCRIPT]),
  });
  const dredger = put(g, 'p1', DREDGER);
  settle(g);
  holdEverywhere(g);
  // The cost carries {T}, so the Dredger must have been here since the turn began.
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: dredger, abilityIndex: 0 }));
  settle(g);
  return { g, dredger };
}

describe('Treasure Dredger', () => {
  test('a Treasure arrives, the life is paid and the Dredger is turned', () => {
    const { g, dredger } = dredged();
    expect(treasures(g)).toBe(1);
    expect(g.state.players.p1?.life).toBe(39);
    expect(g.state.cards[dredger]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = dredged();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
