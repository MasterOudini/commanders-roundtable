// `Elder Gargaroth` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ELDER_GARGAROTH_SCRIPT } from './elderGargaroth';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Elder Gargaroth";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Elder Gargaroth"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ELDER_GARGAROTH_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
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
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: no }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    settle(g);
    }
  if (which === 2) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    settle(g);
    }
  if (which === 3) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: no }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    settle(g);
    }
  if (which === 4) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [2] }));
    settle(g);
    }
  if (which === 5) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: no }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [2] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Elder Gargaroth", () => {
  test("Whenever this creature attacks or blocks: choosing \"Create a 3/3 green Beast creature token.\", token", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Whenever this creature attacks or blocks: choosing \"Create a 3/3 green Beast creature token.\", token", () => {
    const { g, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Whenever this creature attacks or blocks: choosing \"You gain 3 life.\", gainLife", () => {
    const { g, life0 } = armed(2);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
  });

  test("Whenever this creature attacks or blocks: choosing \"You gain 3 life.\", gainLife", () => {
    const { g, life0 } = armed(3);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
  });

  test("Whenever this creature attacks or blocks: choosing \"Draw a card.\", draw", () => {
    const { g, hand0 } = armed(4);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
  });

  test("Whenever this creature attacks or blocks: choosing \"Draw a card.\", draw", () => {
    const { g, hand0 } = armed(5);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
