// `Golgari Rotwurm` — {B} plus a sacrificed creature drains a player for 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOLGARI_ROTWURM_SCRIPT } from './golgariRotwurm';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ROTWURM = 'Golgari Rotwurm';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; rotwurm: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ROTWURM, BEARS], []],
    scripts: createRegistry([GOLGARI_ROTWURM_SCRIPT]),
  });
  const rotwurm = put(g, 'p1', ROTWURM);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  return { g, rotwurm, bears };
}

describe('Golgari Rotwurm', () => {
  test('the sacrificed creature pays for the life loss', () => {
    const { g, rotwurm, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: rotwurm,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g, rotwurm, bears } = board();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: rotwurm,
        abilityIndex: 0,
        sacrifice: bears,
      }),
    );
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
