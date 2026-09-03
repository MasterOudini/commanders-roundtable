// `Tradewind Rider` — its own tap and two untapped creatures tapped return
// the opponent's artifact to their hand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TRADEWIND_RIDER_SCRIPT } from './tradewindRider';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RIDER = 'Tradewind Rider';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';
const STAFF = 'Staff of Nin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; rider: InstanceId; a: InstanceId; b: InstanceId; staff: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RIDER, BEARS, NIGHTHAWK], [STAFF]],
    scripts: createRegistry([TRADEWIND_RIDER_SCRIPT]),
  });
  const staff = put(g, 'p2', STAFF);
  const a = put(g, 'p1', BEARS);
  const b = put(g, 'p1', NIGHTHAWK);
  const rider = put(g, 'p1', RIDER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, rider, a, b, staff };
}

describe('Tradewind Rider (tap two creatures)', () => {
  test('the Rider taps and two creatures tap; their Staff returns to hand', () => {
    const { g, rider, a, b, staff } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rider, abilityIndex: 0, tap: [a, b] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    expect(g.state.cards[staff]?.zone).toEqual({ kind: 'hand', player: 'p2' });
    expect(g.state.cards[rider]?.tapped).toBe(true);
    expect(g.state.cards[a]?.tapped).toBe(true);
    expect(g.state.cards[b]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, rider, a, b, staff } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rider, abilityIndex: 0, tap: [a, b] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
