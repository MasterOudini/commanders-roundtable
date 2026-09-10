// `Ivora, Insatiable Heir` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { IVORA_INSATIABLE_HEIR_SCRIPT } from './ivoraInsatiableHeir';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Ivora, Insatiable Heir";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Ivora, Insatiable Heir"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([IVORA_INSATIABLE_HEIR_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,false,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain', 20_000);
    settle(g);
    }
  if (which === 2) {
    { const lib = [...(g.state.zones.library.p1 ?? [])]; const pitch = lib[lib.length - 1];
      if (!pitch) throw new Error('no card to discard');
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: pitch, to: { kind: 'hand', player: 'p1' } }));
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: pitch, to: { kind: 'graveyard', player: 'p1' } })); }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Ivora, Insatiable Heir", () => {
  test("When Ivora enters and whenever it deals combat damage to a player: 1 token made [etb]", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test("When Ivora enters and whenever it deals combat damage to a player: 1 token made [combatDamagePlayer]", () => {
    const { g, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test("Whenever you discard a card: it gets 1 +1/+1 counter", () => {
    const { g, self } = armed(2);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
