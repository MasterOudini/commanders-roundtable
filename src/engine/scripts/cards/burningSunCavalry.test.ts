// `Burning Sun Cavalry` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { BURNING_SUN_CAVALRY_SCRIPT } from './burningSunCavalry';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Burning Sun Cavalry";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([BURNING_SUN_CAVALRY_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Burning Sun Cavalry", "Raptor Companion"], ["Cyclops of One-Eyed Pass", "Raging Goblin", "Raging Goblin"]],
    scripts: createRegistry([BURNING_SUN_CAVALRY_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const whileGobA = put(g, 'p2', 'Raging Goblin');
  const whileGobB = put(g, 'p2', 'Raging Goblin');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    // D381 - stage one: the condition is BROKEN, so nothing may happen.
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    if (pt(g, self)[0] !== 2 || pt(g, self)[1] !== 2) throw new Error("the trigger fired with its condition broken");
    // stage two: the condition is MET.
    put(g, 'p1', "Raptor Companion");
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  if (which === 1) {
    // D381 - stage one: the condition is BROKEN, so nothing may happen.
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: whileGobA, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: whileGobA }] }));
    settle(g);
    if (pt(g, self)[0] !== 2 || pt(g, self)[1] !== 2) throw new Error("the trigger fired with its condition broken");
    // stage two: the condition is MET.
    put(g, 'p1', "Raptor Companion");
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 6 && s.priority.awaiting?.kind === 'declareAttackers', 60_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: whileGobB, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: whileGobB }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Burning Sun Cavalry", () => {
  test("Whenever this creature attacks or blocks while you control a Dinosaur: it gets +1/+1 until end of turn [attacks]", () => {
    const { g, self } = armed(0);
    expect(pt(g, self)).toEqual([3, 3]);
  });

  test("Whenever this creature attacks or blocks while you control a Dinosaur: it gets +1/+1 until end of turn [blocks]", () => {
    const { g, self } = armed(1);
    expect(pt(g, self)).toEqual([3, 3]);
  });

  test('the pump ends at cleanup', () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 6, 40_000);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
