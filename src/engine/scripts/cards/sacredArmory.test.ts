// `Sacred Armory` — {2} pumps the chosen creature +1/+0.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SACRED_ARMORY_SCRIPT } from './sacredArmory';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sacred Armory', 'Grizzly Bears'], []],
    scripts: createRegistry([SACRED_ARMORY_SCRIPT]),
  });
  const armory = put(g, 'p1', 'Sacred Armory');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: armory,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: bears }],
    }),
  );
  settle(g);
  return { g, bears };
}

describe('Sacred Armory', () => {
  test('the chosen creature reads +1/+0 until cleanup', () => {
    const { g, bears } = armed();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
