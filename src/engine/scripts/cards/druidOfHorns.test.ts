// `Druid of Horns` — a CAST Aura aimed at the Druid pays a Beast; aimed
// elsewhere, or merely ATTACHED without a cast, nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DRUID_OF_HORNS_SCRIPT } from './druidOfHorns';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const DRUID = 'Druid of Horns';
const AURA = 'Pacifism';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function beasts(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Beast').length;
}

function board(): { g: Game; druid: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[DRUID, AURA, BEARS], []],
    scripts: createRegistry([DRUID_OF_HORNS_SCRIPT]),
  });
  const druid = put(g, 'p1', DRUID);
  const bears = put(g, 'p1', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, druid, bears };
}

describe('Druid of Horns', () => {
  test('a cast Aura AIMED AT the Druid creates a 3/3 Beast', () => {
    const { g, druid } = board();
    const aura = put(g, 'p1', AURA, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: druid }] }));
    settle(g);
    expect(beasts(g)).toBe(1);
  });

  test('a cast Aura aimed at ANOTHER creature pays nothing', () => {
    const { g, bears } = board();
    const aura = put(g, 'p1', AURA, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(beasts(g)).toBe(0);
  });

  test('ATTACHING without a cast pays nothing — the trigger is the cast', () => {
    const { g, druid } = board();
    const aura = put(g, 'p1', AURA);
    settle(g);
    must(g.submit({ t: 'ManualAttach', player: 'p1', card: aura, to: druid }));
    settle(g);
    expect(beasts(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, druid } = board();
    const aura = put(g, 'p1', AURA, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: druid }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
