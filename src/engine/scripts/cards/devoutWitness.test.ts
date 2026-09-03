// `Devout Witness` — two mana, the tap and a discarded card destroy the
// opponent's artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEVOUT_WITNESS_SCRIPT } from './devoutWitness';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WITNESS = 'Devout Witness';
const STAFF = 'Staff of Nin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; witness: InstanceId; staff: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WITNESS], [STAFF]],
    scripts: createRegistry([DEVOUT_WITNESS_SCRIPT]),
  });
  const staff = put(g, 'p2', STAFF);
  const witness = put(g, 'p1', WITNESS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, witness, staff };
}

describe('Devout Witness', () => {
  test('{1}{W}, {T}, discard a card: their artifact is destroyed', () => {
    const { g, witness, staff } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witness, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    expect(g.state.cards[staff]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test('replays to the same hash', () => {
    const { g, witness, staff } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: witness, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
