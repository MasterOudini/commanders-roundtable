// `Neurok Replica` — pays mana and itself; the Bears goes home.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEUROK_REPLICA_SCRIPT } from './neurokReplica';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function replicated(): { g: Game; replica: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Neurok Replica'], ['Grizzly Bears']],
    scripts: createRegistry([NEUROK_REPLICA_SCRIPT]),
  });
  const replica = put(g, 'p1', 'Neurok Replica');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  return { g, replica, bears };
}

describe('Neurok Replica', () => {
  test("the Replica dies paying and the Bears returns to its owner's hand", () => {
    const { g, replica, bears } = replicated();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: replica,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[replica]?.zone.kind).toBe('graveyard');
    const card = g.state.cards[bears];
    expect(card?.zone.kind).toBe('hand');
    expect(card?.zone.kind === 'hand' && card.zone.player).toBe('p2');
  });

  test('replays to the same hash', () => {
    const { g, replica, bears } = replicated();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: replica,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
