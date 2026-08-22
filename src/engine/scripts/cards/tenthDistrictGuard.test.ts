// `Tenth District Guard` — the targeted ETB at +0/+1: TOUGHNESS only.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TENTH_DISTRICT_GUARD_SCRIPT } from './tenthDistrictGuard';
import { derive } from '../../derive';
import { advanceUntil, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUARD = 'Tenth District Guard';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUARD, BEARS], []],
    scripts: createRegistry([TENTH_DISTRICT_GUARD_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', GUARD);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Tenth District Guard', () => {
  test('the target is a 2/3 — power UNCHANGED', () => {
    const { g, bears } = entered();
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(2);
    expect(d.toughness).toBe(3);
  });

  test('the bonus ends at cleanup, and it replays to the same hash', () => {
    const { g, bears } = entered();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
