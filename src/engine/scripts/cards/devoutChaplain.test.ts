// `Devout Chaplain` — its own tap and two untapped Humans tapped exile the
// opponent's artifact.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEVOUT_CHAPLAIN_SCRIPT } from './devoutChaplain';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHAPLAIN = 'Devout Chaplain';
const HUMANS = ['Stern Constable', 'Corrupt Court Official'];
const STAFF = 'Staff of Nin';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ready(): { g: Game; chaplain: InstanceId; humans: InstanceId[]; staff: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHAPLAIN, ...HUMANS], [STAFF]],
    scripts: createRegistry([DEVOUT_CHAPLAIN_SCRIPT]),
  });
  const staff = put(g, 'p2', STAFF);
  const humans = HUMANS.map((n) => put(g, 'p1', n));
  const chaplain = put(g, 'p1', CHAPLAIN);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, chaplain, humans, staff };
}

describe('Devout Chaplain (tap two Humans)', () => {
  test('the Chaplain taps and two Humans tap; their Staff is exiled', () => {
    const { g, chaplain, humans, staff } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chaplain, abilityIndex: 0, tap: humans }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    expect(g.state.cards[staff]?.zone.kind).toBe('exile');
    expect(g.state.cards[chaplain]?.tapped).toBe(true);
    for (const id of humans) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, chaplain, humans, staff } = ready();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chaplain, abilityIndex: 0, tap: humans }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
