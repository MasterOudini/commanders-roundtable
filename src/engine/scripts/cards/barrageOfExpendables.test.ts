// `Barrage of Expendables` — an ENCHANTMENT charging the chooser cost and
// pinging any target: the creature pays, the player bleeds.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BARRAGE_OF_EXPENDABLES_SCRIPT } from './barrageOfExpendables';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BARRAGE = 'Barrage of Expendables';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; barrage: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BARRAGE, BEARS], []],
    scripts: createRegistry([BARRAGE_OF_EXPENDABLES_SCRIPT]),
  });
  const barrage = put(g, 'p1', BARRAGE);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  return { g, barrage, bears };
}

describe('Barrage of Expendables', () => {
  test('a creature pays, and the player target takes 1', () => {
    const { g, barrage, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: barrage, abilityIndex: 0, sacrifice: bears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[barrage]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, barrage, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: barrage, abilityIndex: 0, sacrifice: bears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
