// `Hurler Cyclops` — {1} and ANOTHER creature pay for the ping; the Cyclops
// can never eat itself.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HURLER_CYCLOPS_SCRIPT } from './hurlerCyclops';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CYCLOPS = 'Hurler Cyclops';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; cyclops: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CYCLOPS, BEARS], []],
    scripts: createRegistry([HURLER_CYCLOPS_SCRIPT]),
  });
  const cyclops = put(g, 'p1', CYCLOPS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, cyclops, bears };
}

describe('Hurler Cyclops', () => {
  test('another creature pays and the chosen player takes 1', () => {
    const { g, cyclops, bears } = board();
    const before = g.state.players['p2']?.life ?? 0;
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: cyclops,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(before - 1);
  });

  test('it cannot pay with ITSELF — "another"', () => {
    const { g, cyclops } = board();
    const r = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: cyclops,
      abilityIndex: 0,
      sacrifice: cyclops,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
  });

  test('replays to the same hash', () => {
    const { g, cyclops, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: cyclops,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
