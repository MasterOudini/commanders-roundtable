// `Storm Seeker` — the damage is the TARGET's hand size, not the caster's:
// read p2's hand at resolution time.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STORM_SEEKER_SCRIPT } from './stormSeeker';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sought(): { g: Game; theirHand: number } {
  const g = startedGame({
    players: 2,
    decks: [['Storm Seeker'], []],
    scripts: createRegistry([STORM_SEEKER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Storm Seeker', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  const theirHand = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirHand };
}

describe('Storm Seeker', () => {
  test("p2 takes their own hand's worth", () => {
    const { g, theirHand } = sought();
    expect(theirHand).toBeGreaterThan(0);
    expect(g.state.players['p2']?.life).toBe(40 - theirHand);
  });

  test('replays to the same hash', () => {
    const { g } = sought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
