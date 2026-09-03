// `Catapult Master` — five untapped Soldiers tap to exile the opponent's
// creature; four are refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CATAPULT_MASTER_SCRIPT } from './catapultMaster';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MASTER = 'Catapult Master';
const SOLDIERS = ['Stern Constable', 'Thraben Standard Bearer', 'Siege Veteran', 'Skystrike Officer'];
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function placed(): { g: Game; master: InstanceId; soldiers: InstanceId[]; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MASTER, ...SOLDIERS], [BEARS]],
    scripts: createRegistry([CATAPULT_MASTER_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const soldiers = SOLDIERS.map((n) => put(g, 'p1', n));
  const master = put(g, 'p1', MASTER);
  settle(g);
  return { g, master, soldiers, theirs };
}

describe('Catapult Master (tap five Soldiers)', () => {
  test('the Master and four Soldiers tap; their bear is exiled', () => {
    const { g, master, soldiers, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: master, abilityIndex: 0, tap: [master, ...soldiers] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
    for (const id of [master, ...soldiers]) expect(g.state.cards[id]?.tapped).toBe(true);
  });

  test('four Soldiers are refused', () => {
    const { g, master, soldiers } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: master, abilityIndex: 0, tap: [master, ...soldiers.slice(0, 3)] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, master, soldiers, theirs } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: master, abilityIndex: 0, tap: [master, ...soldiers] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
