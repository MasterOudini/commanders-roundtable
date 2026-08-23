// `Timberland Guide` — the targeted ETB counter with NO "you control", so an
// opponent's creature is a legal answer too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { TIMBERLAND_GUIDE_SCRIPT } from './timberlandGuide';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUIDE = 'Timberland Guide';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function guided(seat: 'p1' | 'p2'): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUIDE, BEARS], [BEARS]],
    scripts: createRegistry([TIMBERLAND_GUIDE_SCRIPT]),
  });
  const bears = put(g, seat, BEARS);
  settle(g);
  put(g, 'p1', GUIDE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Timberland Guide', () => {
  test('a +1/+1 counter lands on my own creature', () => {
    const { g, bears } = guided('p1');
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
  });

  test("an OPPONENT's creature is a legal answer — the clause has no controller", () => {
    const { g, bears } = guided('p2');
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = guided('p1');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
