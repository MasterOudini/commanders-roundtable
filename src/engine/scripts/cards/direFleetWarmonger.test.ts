// `Dire Fleet Warmonger` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DIRE_FLEET_WARMONGER_SCRIPT } from './direFleetWarmonger';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Dire Fleet Warmonger";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; priceL0_p1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([DIRE_FLEET_WARMONGER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Dire Fleet Warmonger", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DIRE_FLEET_WARMONGER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const priceL0_p1_0 = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![false][which]) {
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
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'beginCombat', 20000);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, priceL0_p1_0 };
}

describe("Dire Fleet Warmonger", () => {
  test("At the beginning of combat on your turn: the vocabulary resolves \"You may sacrifice another creature. If you do, this creature gets +2/+2 and gains trample until end of turn.\" - the price is declined", () => {
    const { g, self, priceL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[priceL0_p1_0]?.zone.kind, 'declining costs nothing').toBe('battlefield');
    expect(g.state.untilEndOfTurn.some((m) => m.card === self && m.power === 2 && m.toughness === 2), 'the pump rides the until-end-of-turn entry').toBe(false);
  });

  test("At the beginning of combat on your turn: the vocabulary resolves \"You may sacrifice another creature. If you do, this creature gets +2/+2 and gains trample until end of turn.\" - the price is paid", () => {
    const { g, self, board0, priceL0_p1_0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true, picks: [priceL0_p1_0] }));
    settle(g);
    expect(g.state.cards[priceL0_p1_0]?.zone.kind, 'the price took what it named').toBe('graveyard');
    expect(g.state.untilEndOfTurn.some((m) => m.card === self && m.power === 2 && m.toughness === 2), 'the pump rides the until-end-of-turn entry').toBe(true);
    expect(kw(g, self).has("trample")).toBe(true);
    expect(onBoard(g)).toBe(board0 + -1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
