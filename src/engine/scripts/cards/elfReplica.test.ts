// `Elf Replica` — the no-tap self-sacrifice enchantment kill.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ELF_REPLICA_SCRIPT } from './elfReplica';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const REPLICA = 'Elf Replica';
const ENCHANTMENT = 'Contemplation';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; replica: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[REPLICA], [ENCHANTMENT]],
    scripts: createRegistry([ELF_REPLICA_SCRIPT]),
  });
  const replica = put(g, 'p1', REPLICA);
  const theirs = put(g, 'p2', ENCHANTMENT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, replica, theirs };
}

describe('Elf Replica', () => {
  test('destroys the enchantment with the Replica spent on the answer', () => {
    const { g, replica, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: replica, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    expect(g.state.cards[replica]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, replica, theirs } = armed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: replica, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
