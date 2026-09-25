// `Overgrown Arch` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { OVERGROWN_ARCH_SCRIPT } from './overgrownArch';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Overgrown Arch";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; priceA1_p1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Overgrown Arch", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([OVERGROWN_ARCH_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const priceA1_p1_0 = put(g, 'p1', "Grizzly Bears", 'hand');
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
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana' || (s.stack.length === 0 && s.pendingTriggers.length === 0), 20_000);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, priceA1_p1_0 };
}

describe("Overgrown Arch", () => {
  test("{T}: 1 life is gained", () => {
    const { g, self, life0 } = armed(0);
    expect(g.state.players.p1?.life).toBe(life0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("{2}, Sacrifice this creature: the vocabulary resolves \"Learn.\" - the price is declined", () => {
    const { g, self, priceA1_p1_0 } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: false }));
    settle(g);
    expect(g.state.cards[priceA1_p1_0]?.zone.kind, 'declining costs nothing').toBe('hand');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test("{2}, Sacrifice this creature: the vocabulary resolves \"Learn.\" - the price is paid", () => {
    const { g, self, priceA1_p1_0 } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'payMana' && ask.player, 'the payer is the one the clause names').toBe("p1"); }
    must(g.submit({ t: 'AnswerPayMana', player: "p1", pay: true, picks: [priceA1_p1_0] }));
    settle(g);
    expect(g.state.cards[priceA1_p1_0]?.zone.kind, 'the price took what it named').toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
