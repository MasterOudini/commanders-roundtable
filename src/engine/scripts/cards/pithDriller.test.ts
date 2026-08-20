// `Pith Driller` — the entry pins a -1/-1 counter on a targeted creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { PITH_DRILLER_SCRIPT } from './pithDriller';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drilled(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Pith Driller'], ['Grizzly Bears']],
    scripts: createRegistry([PITH_DRILLER_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Pith Driller');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Pith Driller', () => {
  test('the Bears carries the counter and reads 1/1', () => {
    const { g, bears } = drilled();
    expect(g.state.cards[bears]?.counters['-1/-1']).toBe(1);
    const derived = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(derived.power).toBe(1);
    expect(derived.toughness).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = drilled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
