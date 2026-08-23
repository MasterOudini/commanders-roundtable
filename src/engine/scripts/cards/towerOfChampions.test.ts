// `Tower of Champions` — +6/+6 for {8} and a tap, ended by the cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { TOWER_OF_CHAMPIONS_SCRIPT } from './towerOfChampions';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TOWER = 'Tower of Champions';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pumped(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TOWER, BEARS], []],
    scripts: createRegistry([TOWER_OF_CHAMPIONS_SCRIPT]),
  });
  const tower = put(g, 'p1', TOWER);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: tower, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Tower of Champions', () => {
  test('a 2/2 becomes an 8/8 until the cleanup', () => {
    const { g, bears } = pumped();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(8);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).toughness).toBe(8);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = pumped();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
