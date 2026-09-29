// `Merry Bards` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { MERRY_BARDS_SCRIPT } from './merryBards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Merry Bards";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtL0_etb_0: InstanceId; payL0_p1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Merry Bards", "Cyclops of One-Eyed Pass", "Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([MERRY_BARDS_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL0_etb_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  const payL0_p1_0 = put(g, 'p1', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtL0_etb_0, payL0_p1_0 };
}

describe("Merry Bards", () => {
  test("When this creature enters: the vocabulary resolves \"You may pay {1}. When you do, create a Young Hero Role token attached to target creature you control.\" - the price is declined", () => {
    const { g, payL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    const reflexiveAt = g.log.length;
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.log.slice(reflexiveAt).some((ev) => ev.body.t === 'ReflexiveTriggered'), 'declined: nothing triggers').toBe(false);
    expect(g.log.slice(reflexiveAt).some((ev) => ev.body.t === 'AwaitingSet' && ev.body.awaiting?.kind === 'chooseTargets'), 'declined: nothing is aimed').toBe(false);
    expect(g.state.cards[payL0_p1_0]?.tapped, 'declining costs nothing').toBe(false);
  });

  test("When this creature enters: the vocabulary resolves \"You may pay {1}. When you do, create a Young Hero Role token attached to target creature you control.\" - the price is paid", () => {
    const { g, board0, vtL0_etb_0, payL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    const reflexiveAt = g.log.length;
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL0_etb_0 }] }));
    settle(g);
    expect(g.log.slice(reflexiveAt).some((ev) => ev.body.t === 'ReflexiveTriggered'), 'paid: the payload triggers').toBe(true);
    expect(g.state.cards[payL0_p1_0]?.tapped, 'the payment taps what it spends').toBe(true);
    { const role = Object.values(g.state.cards).find((c) => c.isToken === true && c.zone.kind === 'battlefield' && c.printingId === "cff8ef48-2988-4d21-837e-01f1459e07c5" && c.faceIndex === 1); expect(role?.attachedTo, 'the Role is attached').toBe(vtL0_etb_0); }
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
