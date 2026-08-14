// `Iron Bully` — entering grows a chosen creature by a +1/+1 counter.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { IRON_BULLY_SCRIPT } from './ironBully';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BULLY = 'Iron Bully';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answered(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BULLY, BEARS], []],
    scripts: createRegistry([IRON_BULLY_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  put(g, 'p1', BULLY);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Iron Bully', () => {
  test('entering puts a +1/+1 counter on the chosen creature', () => {
    const { g, bears } = answered();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = answered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
