// `Blood Rites` — Barrage of Expendables one mana over: the creature pays,
// any target takes 2 from the enchantment.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BLOOD_RITES_SCRIPT } from './bloodRites';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RITES = 'Blood Rites';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; rites: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[RITES, BEARS], []],
    scripts: createRegistry([BLOOD_RITES_SCRIPT]),
  });
  const rites = put(g, 'p1', RITES);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, rites, bears };
}

describe('Blood Rites', () => {
  test('the creature pays and the target player takes 2', () => {
    const { g, rites, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rites, abilityIndex: 0, sacrifice: bears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('replays to the same hash', () => {
    const { g, rites, bears } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rites, abilityIndex: 0, sacrifice: bears }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
