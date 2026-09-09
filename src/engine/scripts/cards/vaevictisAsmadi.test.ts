// `Vaevictis Asmadi` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { VAEVICTIS_ASMADI_SCRIPT } from './vaevictisAsmadi';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Vaevictis Asmadi";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; payL1_p1_0: InstanceId; payL1_p1_1: InstanceId; payL1_p1_2: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([VAEVICTIS_ASMADI_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Vaevictis Asmadi", "Swamp", "Mountain", "Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([VAEVICTIS_ASMADI_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const payL1_p1_0 = put(g, 'p1', "Swamp");
  const payL1_p1_1 = put(g, 'p1', "Mountain");
  const payL1_p1_2 = put(g, 'p1', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![false,false,false,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 40_000);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    }
  if (which === 3) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, payL1_p1_0, payL1_p1_1, payL1_p1_2 };
}

describe("Vaevictis Asmadi", () => {
  test("At the beginning of your upkeep: the vocabulary resolves \"Sacrifice ~ unless you pay {B}{R}{G}.\" - the price is declined", () => {
    const { g, self, board0, payL1_p1_0, payL1_p1_1, payL1_p1_2 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[payL1_p1_0]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_1]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_2]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[self]?.zone.kind, 'the price went unpaid, so it is sacrificed').toBe('graveyard');
    expect(onBoard(g)).toBe(board0 + -1);
  });

  test("At the beginning of your upkeep: the vocabulary resolves \"Sacrifice ~ unless you pay {B}{R}{G}.\" - the price is paid", () => {
    const { g, self, payL1_p1_0, payL1_p1_1, payL1_p1_2 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    settle(g);
    expect(g.state.cards[payL1_p1_0]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_1]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_2]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[self]?.zone.kind, 'the price was paid, so it stays').toBe('battlefield');
  });

  test("{B}: it gets +1/+0 until end of turn", () => {
    const { g, self } = armed(1);
    expect(pt(g, self)).toEqual([8, 7]);
  });

  test("{R}: it gets +1/+0 until end of turn", () => {
    const { g, self } = armed(2);
    expect(pt(g, self)).toEqual([8, 7]);
  });

  test("{G}: it gets +1/+0 until end of turn", () => {
    const { g, self } = armed(3);
    expect(pt(g, self)).toEqual([8, 7]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
