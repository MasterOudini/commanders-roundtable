// `Herald of the Fair` — Haazda Officer's text on its OWN oracle id: the
// twin proven on its own registration.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HERALD_OF_THE_FAIR_SCRIPT } from './heraldOfTheFair';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HERALD = 'Herald of the Fair';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HERALD, BEARS], []],
    scripts: createRegistry([HERALD_OF_THE_FAIR_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, bears };
}

describe('Herald of the Fair', () => {
  test('entering pumps the chosen creature I control', () => {
    const { g, bears } = board();
    put(g, 'p1', HERALD);
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
    put(g, 'p1', HERALD);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
