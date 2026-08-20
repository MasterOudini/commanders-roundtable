// `Nim Replica` — pays mana and itself; the 1/1 dies to the debuff.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIM_REPLICA_SCRIPT } from './nimReplica';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function nimmed(): { g: Game; replica: InstanceId; clerk: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nim Replica'], ['Aysen Bureaucrats']],
    scripts: createRegistry([NIM_REPLICA_SCRIPT]),
  });
  const replica = put(g, 'p1', 'Nim Replica');
  const clerk = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, replica, clerk };
}

describe('Nim Replica', () => {
  test('the Replica pays itself; the 1/1 dies to -1/-1', () => {
    const { g, replica, clerk } = nimmed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: replica,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: clerk }],
      }),
    );
    settle(g);
    expect(g.state.cards[replica]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[clerk]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, replica, clerk } = nimmed();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: replica,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: clerk }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
