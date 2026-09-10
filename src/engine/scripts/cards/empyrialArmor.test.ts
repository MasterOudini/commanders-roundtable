// `Empyrial Armor` - the pump is COUNTED: zero of them is no bonus, and each one moves the
// derived power and toughness by the printed delta. Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { EMPYRIAL_ARMOR_SCRIPT } from './empyrialArmor';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Empyrial Armor";
const COUNTED = "Grizzly Bears";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([EMPYRIAL_ARMOR_SCRIPT]));
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
    scripts: createRegistry([EMPYRIAL_ARMOR_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', 'Grizzly Bears');
  const other = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  fund(g);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: host }] }));
  settle(g);
  return { g, self, subject: host, other };
}
function plus(a: [number | null, number | null], n: number): [number | null, number | null] {
  return [a[0] === null ? null : a[0] + 1 * n, a[1] === null ? null : a[1] + 1 * n];
}

describe("Empyrial Armor", () => {
  test("each card in hand counts [1, 1]: two leaving take it down, one returning brings it back", () => {
    const { g, subject } = board();
    const pt0 = pt(g, subject);
    const hand = Object.values(g.state.cards).filter((c) => c.zone.kind === 'hand' && c.zone.player === 'p1').map((c) => c.id);
    const h1 = hand[0] as InstanceId;
    const h2 = hand[1] as InstanceId;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: h1, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pt0, -1));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: h2, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pt0, -2));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: h1, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pt0, -1));
  });
  test("the other creature is untouched", () => {
    const { g, other } = board();
    expect(pt(g, other)).toEqual([5, 2]);
  });
  test('replays to the same hash', () => {
    const { g } = board();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
