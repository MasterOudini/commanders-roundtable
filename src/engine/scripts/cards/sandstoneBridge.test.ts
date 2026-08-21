// `Sandstone Bridge` — enters tapped, and the trigger's grant rides:
// +1/+1 and DERIVED vigilance until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { SANDSTONE_BRIDGE_SCRIPT } from './sandstoneBridge';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bridged(): { g: Game; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sandstone Bridge', 'Grizzly Bears'], []],
    scripts: createRegistry([SANDSTONE_BRIDGE_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  const land = put(g, 'p1', 'Sandstone Bridge');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, land, bears };
}

describe('Sandstone Bridge', () => {
  test('enters tapped; the target reads 3/3 with vigilance until cleanup', () => {
    const { g, land, bears } = bridged();
    expect(g.state.cards[land]?.tapped).toBe(true);
    const d = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(d.power).toBe(3);
    expect(d.keywords.has('vigilance')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    const after = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(after.power).toBe(2);
    expect(after.keywords.has('vigilance')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = bridged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
