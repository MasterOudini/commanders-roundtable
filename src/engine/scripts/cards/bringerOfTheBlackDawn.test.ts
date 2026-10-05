// `Bringer of the Black Dawn` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { BRINGER_OF_THE_BLACK_DAWN_SCRIPT } from './bringerOfTheBlackDawn';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Bringer of the Black Dawn";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Bringer of the Black Dawn"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([BRINGER_OF_THE_BLACK_DAWN_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
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
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 60000);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Bringer of the Black Dawn", () => {
  test("At the beginning of your upkeep: the vocabulary resolves \"You may pay 2 life. If you do, search your library for a card, then shuffle and put that card on top.\" - the price is declined", () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    const paidAt = g.log.length;
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    advanceUntil(g, (s) => s.priority.awaiting === null && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.log.slice(paidAt).some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'searchLibrary'), 'the branch searched iff it ran').toBe(false);
  });

  test("At the beginning of your upkeep: the vocabulary resolves \"You may pay 2 life. If you do, search your library for a card, then shuffle and put that card on top.\" - the price is paid", () => {
    const { g, life0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    const paidAt = g.log.length;
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    advanceUntil(g, (s) => s.priority.awaiting === null && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.log.slice(paidAt).some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'searchLibrary'), 'the branch searched iff it ran').toBe(true);
    expect(g.state.players.p1?.life).toBe(life0 + -2);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
