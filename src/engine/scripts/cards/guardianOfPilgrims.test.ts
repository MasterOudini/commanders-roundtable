// `Guardian of Pilgrims` — entering asks for a creature and pumps it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GUARDIAN_OF_PILGRIMS_SCRIPT } from './guardianOfPilgrims';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GUARDIAN = 'Guardian of Pilgrims';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GUARDIAN, BEARS], []],
    scripts: createRegistry([GUARDIAN_OF_PILGRIMS_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, bears };
}

describe('Guardian of Pilgrims', () => {
  test('entering pumps the chosen creature +1/+1', () => {
    const { g, bears } = board();
    put(g, 'p1', GUARDIAN);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === 1,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, bears } = board();
    put(g, 'p1', GUARDIAN);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
