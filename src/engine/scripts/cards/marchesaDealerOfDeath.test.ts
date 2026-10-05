// `Marchesa, Dealer of Death` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { MARCHESA_DEALER_OF_DEATH_SCRIPT } from './marchesaDealerOfDeath';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Marchesa, Dealer of Death";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; payL0_p1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Marchesa, Dealer of Death", "Icy Manipulator", "Forest"], ["Cyclops of One-Eyed Pass", "Forest"]],
    scripts: createRegistry([MARCHESA_DEALER_OF_DEATH_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const payL0_p1_0 = put(g, 'p1', "Forest");
  const crimeIcy = put(g, 'p1', 'Icy Manipulator');
  const crimeLand = put(g, 'p2', 'Forest');
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: crimeIcy, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: crimeLand }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, payL0_p1_0 };
}

describe("Marchesa, Dealer of Death", () => {
  test("Whenever you commit a crime: the vocabulary resolves \"You may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.\" - the price is declined", () => {
    const { g, payL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    const paidAt = g.log.length;
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    advanceUntil(g, (s) => s.priority.awaiting === null && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.cards[payL0_p1_0]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.log.slice(paidAt).some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand')), 'the look took into the hand iff the branch ran').toBe(false);
  });

  test("Whenever you commit a crime: the vocabulary resolves \"You may pay {1}. If you do, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.\" - the price is paid", () => {
    const { g, payL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    const paidAt = g.log.length;
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    advanceUntil(g, (s) => s.priority.awaiting === null && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.cards[payL0_p1_0]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.log.slice(paidAt).some((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand')), 'the look took into the hand iff the branch ran').toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
