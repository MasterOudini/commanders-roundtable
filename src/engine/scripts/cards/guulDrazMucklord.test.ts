// `Guul Draz Mucklord` — dying pays a +1/+1 counter to a creature I control.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GUUL_DRAZ_MUCKLORD_SCRIPT } from './guulDrazMucklord';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MUCKLORD = 'Guul Draz Mucklord';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mucklord: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MUCKLORD, BEARS], []],
    scripts: createRegistry([GUUL_DRAZ_MUCKLORD_SCRIPT]),
  });
  const mucklord = put(g, 'p1', MUCKLORD);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, mucklord, bears };
}

describe('Guul Draz Mucklord', () => {
  test('dying pays a +1/+1 counter to the chosen creature', () => {
    const { g, mucklord, bears } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mucklord, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, mucklord, bears } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: mucklord, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
