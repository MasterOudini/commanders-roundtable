// `Looming Spires` — enters tapped, then the entry ASKS and the answer
// pumps and grants first strike.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { LOOMING_SPIRES_SCRIPT } from './loomingSpires';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function loomed(): { g: Game; spires: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Looming Spires', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([LOOMING_SPIRES_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const spires = put(g, 'p1', 'Looming Spires');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, spires, bears };
}

describe('Looming Spires', () => {
  test('enters TAPPED; the answer makes the 2/2 a 3/3 with first strike', () => {
    const { g, spires, bears } = loomed();
    expect(g.state.cards[spires]?.tapped).toBe(true);
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.keywords.has('firstStrike')).toBe(true);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = loomed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
