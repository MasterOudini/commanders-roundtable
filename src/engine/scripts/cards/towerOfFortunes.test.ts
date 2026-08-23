// `Tower of Fortunes` — four cards for {8} and a tap, counted off the LOG.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TOWER_OF_FORTUNES_SCRIPT } from './towerOfFortunes';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const TOWER = 'Tower of Fortunes';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawn(g: Game, since: number): number {
  let n = 0;
  for (let i = since; i < g.log.length; i++) {
    const body = g.log[i]?.body;
    if (body?.t === 'DrewCards' && body.player === 'p1') n += body.cards.length;
  }
  return n;
}

function drewFour(): { g: Game; drew: number } {
  const g = startedGame({
    players: 2,
    decks: [[TOWER], []],
    scripts: createRegistry([TOWER_OF_FORTUNES_SCRIPT]),
  });
  const tower = put(g, 'p1', TOWER);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  const since = g.log.length;
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tower, abilityIndex: 0 }));
  settle(g);
  return { g, drew: drawn(g, since) };
}

describe('Tower of Fortunes', () => {
  test('exactly four cards, through the one draw rule', () => {
    const { drew } = drewFour();
    expect(drew).toBe(4);
  });

  test('replays to the same hash', () => {
    const { g } = drewFour();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
