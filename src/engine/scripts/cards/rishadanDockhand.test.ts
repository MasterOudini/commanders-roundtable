// `Rishadan Dockhand` — {1}, {T} turns the opponent's land; the cost
// has a {T}, so the Merfolk waits out its summoning sickness first.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RISHADAN_DOCKHAND_SCRIPT } from './rishadanDockhand';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ported(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rishadan Dockhand'], ['Mountain']],
    scripts: createRegistry([RISHADAN_DOCKHAND_SCRIPT]),
  });
  const dockhand = put(g, 'p1', 'Rishadan Dockhand');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: dockhand,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: land }],
    }),
  );
  settle(g);
  return { g, land };
}

describe('Rishadan Dockhand', () => {
  test('the targeted land turns', () => {
    const { g, land } = ported();
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = ported();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
