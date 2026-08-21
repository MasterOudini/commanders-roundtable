// `Soldier of the Grey Host` — the targeted ETB pump behind two keyword
// lines.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SOLDIER_OF_THE_GREY_HOST_SCRIPT } from './soldierOfTheGreyHost';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hosted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Soldier of the Grey Host', 'Grizzly Bears'], []],
    scripts: createRegistry([SOLDIER_OF_THE_GREY_HOST_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Soldier of the Grey Host');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Soldier of the Grey Host', () => {
  test('the Bears gets +2/+0 until cleanup', () => {
    const { g, bears } = hosted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(4);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = hosted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
