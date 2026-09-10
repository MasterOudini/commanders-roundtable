// `Elvish Berserker` - the pump is COUNTED: zero of them is no bonus, and each one moves the
// derived power and toughness by the printed delta. Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ELVISH_BERSERKER_SCRIPT } from './elvishBerserker';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Elvish Berserker";
const COUNTED = "Cyclops of One-Eyed Pass";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([ELVISH_BERSERKER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}
function board(): { g: Game; self: InstanceId; subject: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, COUNTED, COUNTED, COUNTED], ["Cyclops of One-Eyed Pass", "Grizzly Bears", "Grizzly Bears"]],
    scripts: createRegistry([ELVISH_BERSERKER_SCRIPT]),
  });
  holdEverywhere(g);
  const other = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, subject: self, other };
}
function plus(a: [number | null, number | null], n: number): [number | null, number | null] {
  return [a[0] === null ? null : a[0] + 1 * n, a[1] === null ? null : a[1] + 1 * n];
}

describe("Elvish Berserker", () => {

function blockedBy(k: number): { g: Game; subject: InstanceId } {
  const { g, subject } = board();
  const blockers: InstanceId[] = [];
  for (let i = 0; i < k; i++) blockers.push(put(g, 'p2', 'Grizzly Bears'));
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: subject, defender: { kind: 'player', id: 'p2' } }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
  must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blockers.map((b) => ({ blocker: b, attacker: subject })) }));
  settle(g);
  return { g, subject };
}

  test("blocked by one creature it is pumped by [1, 1] x 1; by two, x 2", () => {
    const one = blockedBy(1);
    expect(pt(one.g, one.subject)).toEqual(plus([1, 1], 1));
    const two = blockedBy(2);
    expect(pt(two.g, two.subject)).toEqual(plus([1, 1], 2));
    expect(pt(two.g, two.subject)).toEqual(plus(pt(one.g, one.subject), 1));
  });
  test("unblocked, nothing happens", () => {
    const { g, subject } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const rest = pt(g, subject);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: subject, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [] }));
    settle(g);
    expect(pt(g, subject)).toEqual(rest);
  });
  test('replays to the same hash', () => {
    const { g } = board();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
