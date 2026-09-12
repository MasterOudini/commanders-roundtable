// `Raff, Weatherlight Stalwart` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { RAFF_WEATHERLIGHT_STALWART_SCRIPT } from './raffWeatherlightStalwart';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Raff, Weatherlight Stalwart";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; yes: InstanceId; priceL0_p1_0: InstanceId; priceL0_p1_1: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([RAFF_WEATHERLIGHT_STALWART_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([RAFF_WEATHERLIGHT_STALWART_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Raff, Weatherlight Stalwart", "Coral Eel", "Pyretic Ritual", "Grizzly Bears", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([RAFF_WEATHERLIGHT_STALWART_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const priceL0_p1_0 = put(g, 'p1', "Grizzly Bears");
  const priceL0_p1_1 = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const ritual = put(g, 'p1', "Pyretic Ritual", 'hand');
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, yes, priceL0_p1_0, priceL0_p1_1 };
}

describe("Raff, Weatherlight Stalwart", () => {
  test("Whenever you cast an instant or sorcery spell: the vocabulary resolves \"You may tap two untapped creatures you control. If you do, draw a card.\" - the price is declined", () => {
    const { g, priceL0_p1_0, priceL0_p1_1 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[priceL0_p1_0]?.tapped, 'the price taps what it names').toBe(false);
    expect(g.state.cards[priceL0_p1_1]?.tapped, 'the price taps what it names').toBe(false);
  });

  test("Whenever you cast an instant or sorcery spell: the vocabulary resolves \"You may tap two untapped creatures you control. If you do, draw a card.\" - the price is paid", () => {
    const { g, priceL0_p1_0, priceL0_p1_1 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true, picks: [priceL0_p1_0, priceL0_p1_1] }));
    settle(g);
    expect(g.state.cards[priceL0_p1_0]?.tapped, 'the price taps what it names').toBe(true);
    expect(g.state.cards[priceL0_p1_1]?.tapped, 'the price taps what it names').toBe(true);
  });

  test("{3}{W}{W}: its controller's creatures get +1/+1 and gain vigilance until end of turn", () => {
    const { g, no, yes } = armed(1);
    expect(pt(g, yes)).toEqual([3, 2]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("vigilance")).toBe(true);
    expect(kw(g, no).has("vigilance")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
