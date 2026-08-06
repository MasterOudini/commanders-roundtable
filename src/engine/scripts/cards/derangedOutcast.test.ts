// `Deranged Outcast` — a Human pays, a bear does not, and the two +1/+1
// counters land on the target.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DERANGED_OUTCAST_SCRIPT } from './derangedOutcast';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OUTCAST = 'Deranged Outcast';
const HUMAN = 'Devout Monk';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; outcast: InstanceId; monk: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OUTCAST, HUMAN, BEARS], []],
    scripts: createRegistry([DERANGED_OUTCAST_SCRIPT]),
  });
  const outcast = put(g, 'p1', OUTCAST);
  // The Monk is an unregistered Human BODY here — zero registrations, so its
  // own printed trigger does nothing (the shipped def is not in this registry).
  const monk = put(g, 'p1', HUMAN);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, outcast, monk, bears };
}

describe('Deranged Outcast', () => {
  test('a Human pays, and the target carries two +1/+1 counters', () => {
    const { g, outcast, monk, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: outcast, abilityIndex: 0, sacrifice: monk }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.cards[monk]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
  });

  test('a NON-Human creature cannot pay the Human-only cost', () => {
    const { g, outcast, bears } = board();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: outcast, abilityIndex: 0, sacrifice: bears });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, outcast, monk, bears } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: outcast, abilityIndex: 0, sacrifice: monk }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
