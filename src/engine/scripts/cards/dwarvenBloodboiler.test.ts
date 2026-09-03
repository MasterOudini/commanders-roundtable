// `Dwarven Bloodboiler` — it taps itself as the Dwarf to give my bear +2/+0
// until cleanup; a bear is not a Dwarf.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DWARVEN_BLOODBOILER_SCRIPT } from './dwarvenBloodboiler';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BLOODBOILER = 'Dwarven Bloodboiler';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([DWARVEN_BLOODBOILER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function placed(): { g: Game; bloodboiler: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BLOODBOILER, BEARS], []],
    scripts: createRegistry([DWARVEN_BLOODBOILER_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const bloodboiler = put(g, 'p1', BLOODBOILER);
  settle(g);
  return { g, bloodboiler, bears };
}

describe('Dwarven Bloodboiler (tap a Dwarf)', () => {
  test('tapping itself gives the bear +2/+0 until cleanup', () => {
    const { g, bloodboiler, bears } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bloodboiler, abilityIndex: 0, tap: [bloodboiler] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(pt(g, bears)).toEqual({ power: 4, toughness: 2 });
    expect(g.state.cards[bloodboiler]?.tapped).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, bears)).toEqual({ power: 2, toughness: 2 });
  });

  test('a bear is not a Dwarf', () => {
    const { g, bloodboiler, bears } = placed();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: bloodboiler, abilityIndex: 0, tap: [bears] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, bloodboiler, bears } = placed();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bloodboiler, abilityIndex: 0, tap: [bloodboiler] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
