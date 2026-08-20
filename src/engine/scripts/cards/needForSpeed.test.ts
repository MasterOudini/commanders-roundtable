// `Need for Speed` — a land pays for derived haste.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEED_FOR_SPEED_SCRIPT } from './needForSpeed';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sped(): { g: Game; nfs: InstanceId; land: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Need for Speed', 'Mountain', 'Grizzly Bears'], []],
    scripts: createRegistry([NEED_FOR_SPEED_SCRIPT]),
  });
  const nfs = put(g, 'p1', 'Need for Speed');
  const land = put(g, 'p1', 'Mountain');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  return { g, nfs, land, bears };
}

describe('Need for Speed', () => {
  test('the land pays; the Bears gains derived haste until cleanup', () => {
    const { g, nfs, land, bears } = sped();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: nfs,
        abilityIndex: 0,
        sacrifice: land,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, nfs, land, bears } = sped();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: nfs,
        abilityIndex: 0,
        sacrifice: land,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
