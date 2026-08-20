// `Mothrider Patrol` — the priced tap turns the target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOTHRIDER_PATROL_SCRIPT } from './mothriderPatrol';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function patrolled(): { g: Game; patrol: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Mothrider Patrol'], ['Grizzly Bears']],
    scripts: createRegistry([MOTHRIDER_PATROL_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const patrol = put(g, 'p1', 'Mothrider Patrol');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, patrol, bears };
}

describe('Mothrider Patrol', () => {
  test('taps the targeted creature and turns itself', () => {
    const { g, patrol, bears } = patrolled();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: patrol,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[patrol]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, patrol, bears } = patrolled();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: patrol,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
