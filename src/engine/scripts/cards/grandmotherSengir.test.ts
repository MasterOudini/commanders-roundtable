// `Grandmother Sengir` — the {1}{B},{T} -1/-1 debuff.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRANDMOTHER_SENGIR_SCRIPT } from './grandmotherSengir';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GRANDMOTHER = 'Grandmother Sengir';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function debuffs(g: Game, card: InstanceId): number {
  return g.log.filter(
    (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === card && e.body.power === -1,
  ).length;
}

function board(): { g: Game; grandmother: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GRANDMOTHER], [BEARS]],
    scripts: createRegistry([GRANDMOTHER_SENGIR_SCRIPT]),
  });
  const grandmother = put(g, 'p1', GRANDMOTHER);
  const bears = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, grandmother, bears };
}

describe('Grandmother Sengir', () => {
  test('taps to give the target -1/-1', () => {
    const { g, grandmother, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: grandmother,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(debuffs(g, bears)).toBe(1);
    expect(g.state.cards[grandmother]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, grandmother, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: grandmother,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
