// `Sudden Impact` — Storm Seeker's text on a second id: the damage is the
// TARGET's hand size.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUDDEN_IMPACT_SCRIPT } from './suddenImpact';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function impacted(): { g: Game; theirHand: number } {
  const g = startedGame({
    players: 2,
    decks: [['Sudden Impact'], []],
    scripts: createRegistry([SUDDEN_IMPACT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Sudden Impact', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  const theirHand = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirHand };
}

describe('Sudden Impact', () => {
  test("p2 takes their own hand's worth", () => {
    const { g, theirHand } = impacted();
    expect(theirHand).toBeGreaterThan(0);
    expect(g.state.players['p2']?.life).toBe(40 - theirHand);
  });

  test('replays to the same hash', () => {
    const { g } = impacted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
