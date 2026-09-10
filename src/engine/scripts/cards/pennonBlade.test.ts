// `Pennon Blade` - the pump is COUNTED: zero of them is no bonus, and each one moves the
// derived power and toughness by the printed delta. Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { PENNON_BLADE_SCRIPT } from './pennonBlade';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Pennon Blade";
const COUNTED = "Grizzly Bears";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([PENNON_BLADE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}
function fund(g: Game): void {
  for (const sym of ['C', 'W', 'U', 'B', 'R', 'G'] as const) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 8 }));
}

function board(): { g: Game; self: InstanceId; subject: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, "Grizzly Bears", COUNTED, COUNTED, COUNTED], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([PENNON_BLADE_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', 'Grizzly Bears');
  const other = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  fund(g);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: host }] }));
  settle(g);
  return { g, self, subject: host, other };
}
function plus(a: [number | null, number | null], n: number): [number | null, number | null] {
  return [a[0] === null ? null : a[0] + 1 * n, a[1] === null ? null : a[1] + 1 * n];
}

describe("Pennon Blade", () => {
  test("each Grizzly Bears counted moves the P/T by [1, 1], and one leaving takes it back", () => {
    const { g, subject } = board();
    const pt0 = pt(g, subject);
    // the arm puts a KNOWN board down, so the starting count is 1 and the base is the printed P/T
    expect(pt0).toEqual(plus([2, 2], 1));
    put(g, 'p1', COUNTED);
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pt0, 1));
    const c2 = put(g, 'p1', COUNTED);
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pt0, 2));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: c2, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pt0, 1));
  });
  test("the other creature is untouched", () => {
    const { g, other } = board();
    put(g, 'p1', COUNTED);
    settle(g);
    expect(pt(g, other)).toEqual([5, 2]);
  });
  test('replays to the same hash', () => {
    const { g } = board();
    put(g, 'p1', COUNTED);
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
