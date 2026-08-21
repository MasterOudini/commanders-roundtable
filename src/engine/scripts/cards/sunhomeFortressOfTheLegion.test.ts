// `Sunhome, Fortress of the Legion` — the double-strike grant, gone at
// cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SUNHOME_FORTRESS_OF_THE_LEGION_SCRIPT } from './sunhomeFortressOfTheLegion';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sunhomed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sunhome, Fortress of the Legion', 'Grizzly Bears'], []],
    scripts: createRegistry([SUNHOME_FORTRESS_OF_THE_LEGION_SCRIPT]),
  });
  const land = put(g, 'p1', 'Sunhome, Fortress of the Legion');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: 1 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Sunhome, Fortress of the Legion', () => {
  test('the Bears gains double strike until cleanup', () => {
    const { g, bears } = sunhomed();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('doubleStrike')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('doubleStrike')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = sunhomed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
