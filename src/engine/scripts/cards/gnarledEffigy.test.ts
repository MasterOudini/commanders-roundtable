// `Gnarled Effigy` — the tap-and-mana -1/-1 counter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GNARLED_EFFIGY_SCRIPT } from './gnarledEffigy';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EFFIGY = 'Gnarled Effigy';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; effigy: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EFFIGY], [BEARS]],
    scripts: createRegistry([GNARLED_EFFIGY_SCRIPT]),
  });
  const effigy = put(g, 'p1', EFFIGY);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  return { g, effigy, bears };
}

describe('Gnarled Effigy', () => {
  test('puts a -1/-1 counter on the target', () => {
    const { g, effigy, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: effigy,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.counters['-1/-1']).toBe(1);
    expect(g.state.cards[effigy]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, effigy, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: effigy,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
