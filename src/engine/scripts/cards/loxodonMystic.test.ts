// `Loxodon Mystic` — {W} and the tap tap a chosen creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LOXODON_MYSTIC_SCRIPT } from './loxodonMystic';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MYSTIC = 'Loxodon Mystic';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [MYSTIC],
      [BEARS],
    ],
    scripts: createRegistry([LOXODON_MYSTIC_SCRIPT]),
  });
  const mystic = put(g, 'p1', MYSTIC);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: mystic, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Loxodon Mystic', () => {
  test('{W} and the tap tap the chosen creature', () => {
    const { g, bears } = answered();
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
