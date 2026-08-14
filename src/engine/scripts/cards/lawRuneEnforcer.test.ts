// `Law-Rune Enforcer` — {1} and the tap tap a big spell; a one-drop is
// refused by D139's mana-value floor.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LAW_RUNE_ENFORCER_SCRIPT } from './lawRuneEnforcer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ENFORCER = 'Law-Rune Enforcer';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; enforcer: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [ENFORCER],
      [BEARS],
    ],
    scripts: createRegistry([LAW_RUNE_ENFORCER_SCRIPT]),
  });
  const enforcer = put(g, 'p1', ENFORCER);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, enforcer, bears };
}

describe('Law-Rune Enforcer', () => {
  test('the tap taps a mana-value-2 creature', () => {
    const { g, enforcer, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: enforcer, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, enforcer, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: enforcer, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
