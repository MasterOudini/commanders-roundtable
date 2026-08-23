// `Wanderbrine Preacher` — ANY tap pays, not only an attack; and a tap of
// something else pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WANDERBRINE_PREACHER_SCRIPT } from './wanderbrinePreacher';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PREACHER = 'Wanderbrine Preacher';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; preacher: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PREACHER, BEARS], []],
    scripts: createRegistry([WANDERBRINE_PREACHER_SCRIPT]),
  });
  const preacher = put(g, 'p1', PREACHER);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, preacher, bears };
}

describe('Wanderbrine Preacher', () => {
  test('tapping it gains 2', () => {
    const { g, preacher } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [preacher], tapped: true }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('tapping something ELSE gains nothing', () => {
    const { g, bears } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g, preacher } = board();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [preacher], tapped: true }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
