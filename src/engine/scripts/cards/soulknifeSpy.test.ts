// `Soulknife Spy` — connecting with a player draws; the trigger settles by
// the postcombat main.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOULKNIFE_SPY_SCRIPT } from './soulknifeSpy';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function spied(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Soulknife Spy'], []],
    scripts: createRegistry([SOULKNIFE_SPY_SCRIPT]),
  });
  const spy = put(g, 'p1', 'Soulknife Spy');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.turn.turnNumber >= 3,
    60_000,
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [{ card: spy, defender: { kind: 'player', id: 'p2' } }],
    }),
  );
  advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 60_000);
  settle(g);
  return { g, before };
}

describe('Soulknife Spy', () => {
  test('connecting draws a card', () => {
    const { g, before } = spied();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('replays to the same hash', () => {
    const { g } = spied();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
