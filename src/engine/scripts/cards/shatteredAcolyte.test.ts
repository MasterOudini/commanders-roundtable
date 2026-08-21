// `Shattered Acolyte` — pays itself and the enchantment dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SHATTERED_ACOLYTE_SCRIPT } from './shatteredAcolyte';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shattered(): { g: Game; acolyte: InstanceId; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Shattered Acolyte'], ['Captive Flame']],
    scripts: createRegistry([SHATTERED_ACOLYTE_SCRIPT]),
  });
  const acolyte = put(g, 'p1', 'Shattered Acolyte');
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: acolyte,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: flame }],
    }),
  );
  settle(g);
  return { g, acolyte, flame };
}

describe('Shattered Acolyte', () => {
  test('the Acolyte pays itself and the enchantment dies', () => {
    const { g, acolyte, flame } = shattered();
    expect(g.state.cards[acolyte]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = shattered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
