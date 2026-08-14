// `Makeshift Munitions` — {1} and either arm of the OR pay for the ping.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAKESHIFT_MUNITIONS_SCRIPT } from './makeshiftMunitions';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MUNITIONS = 'Makeshift Munitions';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MUNITIONS, BEARS], []],
    scripts: createRegistry([MAKESHIFT_MUNITIONS_SCRIPT]),
  });
  const munitions = put(g, 'p1', MUNITIONS);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: munitions,
      abilityIndex: 0,
      sacrifice: bears,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, bears };
}

describe('Makeshift Munitions', () => {
  test('the creature arm pays and the chosen player takes 1', () => {
    const { g, bears } = fired();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('replays to the same hash', () => {
    const { g } = fired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
