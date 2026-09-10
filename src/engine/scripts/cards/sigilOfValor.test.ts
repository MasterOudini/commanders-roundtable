// `Sigil of Valor` - the pump is COUNTED: zero of them is no bonus, and each one moves the
// derived power and toughness by the printed delta. Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SIGIL_OF_VALOR_SCRIPT } from './sigilOfValor';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Sigil of Valor";
const COUNTED = "Grizzly Bears";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SIGIL_OF_VALOR_SCRIPT]));
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
    scripts: createRegistry([SIGIL_OF_VALOR_SCRIPT]),
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

describe("Sigil of Valor", () => {
  test("attacking pumps it for the turn by the count; two more Grizzly Bears pump it by 2 x [1, 1] more; and it ends at cleanup", () => {
    const { g, subject } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const rest = pt(g, subject);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: subject, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    const pumpedA = pt(g, subject);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    expect(pt(g, subject)).toEqual(rest);
    put(g, 'p1', COUNTED);
    put(g, 'p1', COUNTED);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: subject, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(pt(g, subject)).toEqual(plus(pumpedA, 2));
  });
  test('replays to the same hash', () => {
    const { g } = board();
    put(g, 'p1', COUNTED);
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
