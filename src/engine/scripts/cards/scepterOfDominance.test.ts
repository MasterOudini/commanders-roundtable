// `Scepter of Dominance` — {W}, {T} turns any permanent, a LAND
// included: the permanent kind at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SCEPTER_OF_DOMINANCE_SCRIPT } from './scepterOfDominance';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dominated(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Scepter of Dominance'], ['Mountain']],
    scripts: createRegistry([SCEPTER_OF_DOMINANCE_SCRIPT]),
  });
  const scepter = put(g, 'p1', 'Scepter of Dominance');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: scepter,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: land }],
    }),
  );
  settle(g);
  return { g, land };
}

describe('Scepter of Dominance', () => {
  test('turns the targeted land', () => {
    const { g, land } = dominated();
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = dominated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
