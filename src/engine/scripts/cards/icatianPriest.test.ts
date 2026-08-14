// `Icatian Priest` — {1}{W}{W} pumps a chosen creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ICATIAN_PRIEST_SCRIPT } from './icatianPriest';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PRIEST = 'Icatian Priest';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PRIEST, BEARS], []],
    scripts: createRegistry([ICATIAN_PRIEST_SCRIPT]),
  });
  const priest = put(g, 'p1', PRIEST);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: priest, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Icatian Priest', () => {
  test('paying {1}{W}{W} pumps the chosen creature', () => {
    const { g, bears } = pumped();
    expect(
      g.log.some(
        (e) =>
          e.body.t === 'PtModifiedUntilEndOfTurn' && e.body.card === bears && e.body.power === 1,
      ),
    ).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = pumped();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
