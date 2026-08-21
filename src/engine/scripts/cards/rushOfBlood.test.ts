// `Rush of Blood` — the 6/6 reads 12 and cleanup ends it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RUSH_OF_BLOOD_SCRIPT } from './rushOfBlood';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rushed(): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rush of Blood', 'Colossal Dreadmaw'], []],
    scripts: createRegistry([RUSH_OF_BLOOD_SCRIPT]),
  });
  const maw = put(g, 'p1', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Rush of Blood', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw };
}

describe('Rush of Blood', () => {
  test('the 6/6 reads 12 until cleanup', () => {
    const { g, maw } = rushed();
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(12);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(6);
  });

  test('replays to the same hash', () => {
    const { g } = rushed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
