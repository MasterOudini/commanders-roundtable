// `Nebelgast Intruder` - every declared pick is accepted and the pump lands; a permanent the clause
// excludes is refused (D299). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEBELGAST_INTRUDER_SCRIPT } from './nebelgastIntruder';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Nebelgast Intruder";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([NEBELGAST_INTRUDER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(): { g: Game; self: InstanceId; target: InstanceId; wrong: InstanceId; life0: number } {
  const g = startedGame({
    players: 2,
    decks: [["Nebelgast Intruder", "Vampire Nighthawk"], ["Grizzly Bears"]],
    scripts: createRegistry([NEBELGAST_INTRUDER_SCRIPT]),
  });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  const target = put(g, 'p2', "Grizzly Bears");
  const wrong = put(g, 'p1', "Vampire Nighthawk");
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, self, target, wrong, life0 };
}

describe("Nebelgast Intruder", () => {
  test("Grizzly Bears is accepted and the pump lands", () => {
    const { g, self, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    expect(pt(g, target)).toEqual([0, 2]);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
  });

  test("Vampire Nighthawk is refused (D299)", () => {
    const { g, wrong } = armed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wrong }] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, target } = armed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
