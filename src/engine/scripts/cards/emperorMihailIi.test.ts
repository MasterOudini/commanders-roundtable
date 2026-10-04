// `Emperor Mihail II` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { EMPEROR_MIHAIL_II_SCRIPT } from './emperorMihailIi';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import { seesTop } from '../../topOfLibrary';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Emperor Mihail II";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; payL2_p1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Emperor Mihail II", "Grizzly Bears", "Merfolk of the Pearl Trident", "Forest", "Jungle Delver", "Jungle Delver"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([EMPEROR_MIHAIL_II_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const payL2_p1_0 = put(g, 'p1', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const bearsSpell = put(g, 'p1', "Merfolk of the Pearl Trident", 'hand');
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
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    const topSpell = (Object.keys(g.state.cards) as InstanceId[]).find((id) => nameOf(g, id) === "Jungle Delver" && (g.state.cards[id]?.zone.kind === 'library' || g.state.cards[id]?.zone.kind === 'hand') && g.state.cards[id]?.zone.player === 'p1');
    if (!topSpell) throw new Error("Jungle Delver is dealt for the top");
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: topSpell, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: topSpell }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bearsSpell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, payL2_p1_0 };
}

describe("Emperor Mihail II", () => {
  test("You may look at the top card of your library any time.: its owner sees the top card of the library", () => {
    const { g } = armed(0);
    expect(seesTop(g.state, g.deps.oracle, g.deps.scripts, 'p1', 'p1'), 'its owner sees the top card').toBe(true);
    expect(seesTop(g.state, g.deps.oracle, g.deps.scripts, 'p2', 'p1'), "a look is its owner alone").toBe(false);
  });

  test("You may cast Merfolk spells from the top of your library.: a Merfolk spell is cast from the top", () => {
    const { g } = armed(1);
    expect(g.log.some((ev) => ev.body.t === 'CardsMoved' && ev.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'stack' && nameOf(g, m.card) === "Jungle Delver")), 'a spell cast from the top').toBe(true);
  });

  test("Whenever you cast a Merfolk spell: the vocabulary resolves \"You may pay {1}. If you do, create a 1/1 blue Merfolk creature token.\" - the price is declined", () => {
    const { g, payL2_p1_0 } = armed(2);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[payL2_p1_0]?.tapped, 'declining costs nothing').toBe(false);
  });

  test("Whenever you cast a Merfolk spell: the vocabulary resolves \"You may pay {1}. If you do, create a 1/1 blue Merfolk creature token.\" - the price is paid", () => {
    const { g, board0, payL2_p1_0 } = armed(2);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true }));
    settle(g);
    expect(g.state.cards[payL2_p1_0]?.tapped, 'the payment taps what it spends').toBe(true);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
