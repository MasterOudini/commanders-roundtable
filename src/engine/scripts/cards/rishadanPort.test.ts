// `Rishadan Port` — the tap ability is #a1 behind the engine's mana
// line, and a land never had summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RISHADAN_PORT_SCRIPT } from './rishadanPort';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ported(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rishadan Port'], ['Mountain']],
    scripts: createRegistry([RISHADAN_PORT_SCRIPT]),
  });
  const port = put(g, 'p1', 'Rishadan Port');
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: port,
      abilityIndex: 1,
      targets: [{ kind: 'card', id: land }],
    }),
  );
  settle(g);
  return { g, land };
}

describe('Rishadan Port', () => {
  test('the targeted land turns', () => {
    const { g, land } = ported();
    expect(g.state.cards[land]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = ported();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
