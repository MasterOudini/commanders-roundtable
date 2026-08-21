// `Sylvok Replica` — the self-sacrifice destroy on the probed
// 'artifact or enchantment' compound (D253's Stern Proctor shape), with the
// indestructible check earning its keep.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SYLVOK_REPLICA_SCRIPT } from './sylvokReplica';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const REPLICA = 'Sylvok Replica';
const RING = 'Sol Ring';
const MYR = 'Darksteel Myr';
const MANTRA = "Ajani's Mantra";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; replica: InstanceId; ring: InstanceId; myr: InstanceId; mantra: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[REPLICA, RING, MYR, MANTRA], []],
    scripts: createRegistry([SYLVOK_REPLICA_SCRIPT]),
  });
  const replica = put(g, 'p1', REPLICA);
  const ring = put(g, 'p1', RING);
  const myr = put(g, 'p1', MYR);
  const mantra = put(g, 'p1', MANTRA);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  return { g, replica, ring, myr, mantra };
}

describe('Sylvok Replica', () => {
  test('it eats ITSELF and destroys the artifact', () => {
    const { g, replica, ring } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: replica, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    expect(g.state.cards[replica]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
  });

  test('an ENCHANTMENT is the other arm of the compound', () => {
    const { g, replica, mantra } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: replica, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mantra }] }));
    settle(g);
    expect(g.state.cards[mantra]?.zone.kind).toBe('graveyard');
  });

  test('an indestructible artifact survives — and the Replica STAYS spent', () => {
    const { g, replica, myr } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: replica, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: myr }] }));
    settle(g);
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[replica]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, replica, ring } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: replica, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: ring }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
