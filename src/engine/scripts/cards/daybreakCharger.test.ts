// `Daybreak Charger` — the ETB pump through the staged prompt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DAYBREAK_CHARGER_SCRIPT } from './daybreakCharger';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHARGER = 'Daybreak Charger';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHARGER, BEARS], []],
    scripts: createRegistry([DAYBREAK_CHARGER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  return { g, bears };
}

describe('Daybreak Charger', () => {
  test('entering asks, and the pump lands', () => {
    const { g, bears } = game();
    put(g, 'p1', CHARGER);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(
      g.log.some(
        (e) => e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === 2,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, bears } = game();
    put(g, 'p1', CHARGER);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
