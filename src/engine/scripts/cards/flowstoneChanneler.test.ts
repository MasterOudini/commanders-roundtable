// `Flowstone Channeler` — two mana, the tap and a discarded card give my
// bear +1/-1 and haste until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FLOWSTONE_CHANNELER_SCRIPT } from './flowstoneChanneler';
import { advanceUntil, deps, idsIn, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHANNELER = 'Flowstone Channeler';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chars(g: Game, id: InstanceId): ReturnType<typeof derive> {
  const d = deps(createRegistry([FLOWSTONE_CHANNELER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id);
}

function ready(): { g: Game; channeler: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHANNELER, BEARS], []],
    scripts: createRegistry([FLOWSTONE_CHANNELER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const channeler = put(g, 'p1', CHANNELER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, channeler, bears };
}

describe('Flowstone Channeler', () => {
  test('{1}{R}, {T}, discard a card: +1/-1 and haste until cleanup', () => {
    const { g, channeler, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: channeler, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const got = chars(g, bears);
    expect({ power: got.power, toughness: got.toughness }).toEqual({ power: 3, toughness: 1 });
    expect(got.keywords.has('haste')).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    const later = chars(g, bears);
    expect({ power: later.power, toughness: later.toughness }).toEqual({ power: 2, toughness: 2 });
  });

  test('replays to the same hash', () => {
    const { g, channeler, bears } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: channeler, abilityIndex: 0, discard: [chosen] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
