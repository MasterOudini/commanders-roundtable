// `Silverchase Fox` — pays itself and the enchantment is EXILED.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SILVERCHASE_FOX_SCRIPT } from './silverchaseFox';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function foxed(): { g: Game; fox: InstanceId; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Silverchase Fox'], ['Captive Flame']],
    scripts: createRegistry([SILVERCHASE_FOX_SCRIPT]),
  });
  const fox = put(g, 'p1', 'Silverchase Fox');
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: fox,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: flame }],
    }),
  );
  settle(g);
  return { g, fox, flame };
}

describe('Silverchase Fox', () => {
  test('the Fox pays itself and the enchantment is exiled', () => {
    const { g, fox, flame } = foxed();
    expect(g.state.cards[fox]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('exile');
  });

  test('replays to the same hash', () => {
    const { g } = foxed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
