// `Fountainport` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { FOUNTAINPORT_SCRIPT } from './fountainport';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';
import { TOKEN_TABLE } from '../../../data/tokenTable';

const CARD = "Fountainport";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; fodder0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Fountainport"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([FOUNTAINPORT_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: TOKEN_TABLE["Saproling|1/1|G|Creature|"]?.printingId ?? '', count: 1 }));
  const made0 = Object.values(g.state.cards).find((c) => c.isToken && c.controller === 'p1');
  if (!made0) throw new Error('no token made');
  const fodder0 = made0.id;
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1, sacrifice: [fodder0] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 3 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, fodder0 };
}

describe("Fountainport", () => {
  test("{2}, {T}, Sacrifice a token: a card is drawn", () => {
    const { g, self, hand0, fodder0 } = armed(0);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.cards[fodder0]?.zone.kind ?? 'gone').not.toBe('battlefield');
  });

  test("{3}, {T}, Pay 1 life: 1 token made", () => {
    const { g, self, life0, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(life0 - 1);
  });

  test("{4}, {T}: 1 token made", () => {
    const { g, self, board0 } = armed(2);
    expect(onBoard(g)).toBe(board0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
