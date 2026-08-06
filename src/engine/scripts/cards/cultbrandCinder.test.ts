// `Cultbrand Cinder` — ETB -1/-1 on any creature, through the staged prompt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CULTBRAND_CINDER_SCRIPT } from './cultbrandCinder';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CINDER = 'Cultbrand Cinder';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CINDER], [BEARS]],
    scripts: createRegistry([CULTBRAND_CINDER_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  settle(g);
  return { g, bears };
}

describe('Cultbrand Cinder', () => {
  test('entering asks, and the -1/-1 counter lands on the chosen creature', () => {
    const { g, bears } = game();
    put(g, 'p1', CINDER);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['-1/-1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, bears } = game();
    put(g, 'p1', CINDER);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
