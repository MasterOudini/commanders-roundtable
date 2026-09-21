// `Hellkite Charger` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { HELLKITE_CHARGER_SCRIPT } from './hellkiteCharger';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Hellkite Charger";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; payL1_p1_0: InstanceId; payL1_p1_1: InstanceId; payL1_p1_2: InstanceId; payL1_p1_3: InstanceId; payL1_p1_4: InstanceId; payL1_p1_5: InstanceId; payL1_p1_6: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Hellkite Charger", "Mountain", "Mountain", "Forest", "Forest", "Forest", "Forest", "Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([HELLKITE_CHARGER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const payL1_p1_0 = put(g, 'p1', "Mountain");
  const payL1_p1_1 = put(g, 'p1', "Mountain");
  const payL1_p1_2 = put(g, 'p1', "Forest");
  const payL1_p1_3 = put(g, 'p1', "Forest");
  const payL1_p1_4 = put(g, 'p1', "Forest");
  const payL1_p1_5 = put(g, 'p1', "Forest");
  const payL1_p1_6 = put(g, 'p1', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, payL1_p1_0, payL1_p1_1, payL1_p1_2, payL1_p1_3, payL1_p1_4, payL1_p1_5, payL1_p1_6 };
}

describe("Hellkite Charger", () => {
  test("Whenever this creature attacks: the vocabulary resolves \"You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.\" - the price is declined", () => {
    const { g, payL1_p1_0, payL1_p1_1, payL1_p1_2, payL1_p1_3, payL1_p1_4, payL1_p1_5, payL1_p1_6 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[payL1_p1_0]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_1]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_2]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_3]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_4]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_5]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.state.cards[payL1_p1_6]?.tapped, 'declining costs nothing').toBe(false);
    expect(g.log.some((e) => e.body.t === 'ScopeWalked' && e.body.verb === 'massUntap'), 'the untap walked iff the price was paid').toBe(false);
    expect(g.log.filter((e) => e.body.t === 'ExtraPhasesAdded'), 'the additional combat phase rides the paid branch').toHaveLength(0);
  });

  test("Whenever this creature attacks: the vocabulary resolves \"You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.\" - the price is paid", () => {
    const { g, payL1_p1_0, payL1_p1_1, payL1_p1_2, payL1_p1_3, payL1_p1_4, payL1_p1_5, payL1_p1_6 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    settle(g);
    expect(g.state.cards[payL1_p1_0]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_1]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_2]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_3]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_4]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_5]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.state.cards[payL1_p1_6]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(g.log.some((e) => e.body.t === 'ScopeWalked' && e.body.verb === 'massUntap'), 'the untap walked iff the price was paid').toBe(true);
    expect(g.log.filter((e) => e.body.t === 'ExtraPhasesAdded'), 'the additional combat phase rides the paid branch').toHaveLength(1);
    /*EXTRA_COMBAT_WALK*/
    {
      const tn = g.state.turn.turnNumber;
      advanceUntil(g, (s) => s.turn.turnNumber === tn + 1 && s.turn.step === 'upkeep', 40_000);
      let tAt = 0;
      let combats = 0;
      for (const e of g.log) {
        if (e.body.t === 'TurnBegan') tAt = e.body.turnNumber;
        if (e.body.t === 'StepBegan' && e.body.step === 'beginCombat' && tAt === tn) combats += 1;
      }
      expect(combats, 'the additional combat phase was taken in the fire turn (CR 500.8)').toBeGreaterThanOrEqual(2);
      expect(g.state.turn.extraPhases, 'nothing pending into the next turn').toEqual([]);
      expect(g.state.turn.resumeStep, 'the insertion is over').toBeNull();
    }
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
