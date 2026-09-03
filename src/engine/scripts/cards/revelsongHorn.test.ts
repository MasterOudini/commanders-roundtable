// `Revelsong Horn` — one mana, the Horn's own tap and an untapped creature
// of mine tapped give the target +1/+1 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { REVELSONG_HORN_SCRIPT } from './revelsongHorn';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HORN = 'Revelsong Horn';
const BEARS = 'Grizzly Bears';
const NIGHTHAWK = 'Vampire Nighthawk';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([REVELSONG_HORN_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function placed(): { g: Game; horn: InstanceId; bears: InstanceId; hawk: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HORN, BEARS, NIGHTHAWK], []],
    scripts: createRegistry([REVELSONG_HORN_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const hawk = put(g, 'p1', NIGHTHAWK);
  const horn = put(g, 'p1', HORN);
  settle(g);
  return { g, horn, bears, hawk };
}

describe('Revelsong Horn', () => {
  test('the bear taps, the Horn taps, the Nighthawk gets +1/+1 until cleanup', () => {
    const { g, horn, bears, hawk } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: horn, abilityIndex: 0, tap: [bears] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(g.state.cards[horn]?.tapped).toBe(true);
    expect(pt(g, hawk)).toEqual({ power: 3, toughness: 4 });
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, hawk)).toEqual({ power: 2, toughness: 3 });
  });

  test('the tapped creature may be the target itself', () => {
    const { g, horn, bears } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: horn, abilityIndex: 0, tap: [bears] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 3, toughness: 3 });
  });

  test('replays to the same hash', () => {
    const { g, horn, bears, hawk } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: horn, abilityIndex: 0, tap: [bears] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
