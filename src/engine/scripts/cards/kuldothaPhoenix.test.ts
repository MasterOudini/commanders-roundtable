// `Kuldotha Phoenix` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { KULDOTHA_PHOENIX_SCRIPT } from './kuldothaPhoenix';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Kuldotha Phoenix";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; condRefused: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Kuldotha Phoenix", "Sol Ring", "Sol Ring", "Sol Ring"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([KULDOTHA_PHOENIX_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, [0].includes(which) ? 'graveyard' : 'battlefield');
  settle(g);
  const cond0_1_0 = put(g, 'p1', "Sol Ring");
  const cond0_1_1 = put(g, 'p1', "Sol Ring");
  const cond0_1_2 = put(g, 'p1', "Sol Ring");
  let condRefused = false;
  if (which === 0) {
    // D371 - the opponent's second turn: not your turn, not your upkeep - refused for the condition alone.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'upkeep' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && ([0].includes(which) ? s.turn.step === 'upkeep' : s.turn.phase === 'precombatMain') && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    // D371 - the condition broken: every fixture exiled (the card itself may count), the activation refused, the fixtures back.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond0_1_0, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond0_1_1, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond0_1_2, to: { kind: 'exile', player: 'p1' } }));
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond0_1_0, to: { kind: 'battlefield', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond0_1_1, to: { kind: 'battlefield', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond0_1_2, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, condRefused };
}

describe("Kuldotha Phoenix", () => {
  test("Metalcraft — {4}: it returns from the graveyard to the battlefield - refused unless during your upkeep and only if you control three or more artifacts", () => {
    const { g, self, condRefused } = armed(0);
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[self]?.controller).toBe('p1');
    expect(g.state.cards[self]?.tapped).toBe(false);
    expect(condRefused).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
