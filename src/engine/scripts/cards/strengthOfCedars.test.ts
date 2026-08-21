// `Strength of Cedars` — three lands, +3/+3.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STRENGTH_OF_CEDARS_SCRIPT } from './strengthOfCedars';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function strengthened(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Strength of Cedars', 'Grizzly Bears', 'Forest', 'Forest', 'Swamp'], []],
    scripts: createRegistry([STRENGTH_OF_CEDARS_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Forest');
  put(g, 'p1', 'Forest');
  put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Strength of Cedars', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Strength of Cedars', () => {
  test('three lands make the Bears a 5/5 until cleanup', () => {
    const { g, bears } = strengthened();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(5);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = strengthened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
