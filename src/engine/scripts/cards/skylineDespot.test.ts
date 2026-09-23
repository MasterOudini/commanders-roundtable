// `Skyline Despot` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SKYLINE_DESPOT_SCRIPT } from './skylineDespot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Skyline Despot";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Skyline Despot"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SKYLINE_DESPOT_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![true,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  if (which === 1) {
    if (g.state.monarch !== null) must(g.submit({ t: 'ManualSetMonarch', player: 'p1', target: null }));
      { const fired0 = g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length;
      advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 60000);
      settle(g);
          if (g.log.filter((e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.source === self).length !== fired0) throw new Error('the trigger fired with its condition unmet');
    }
    if (g.state.monarch !== "p1") must(g.submit({ t: 'ManualSetMonarch', player: 'p1', target: "p1" }));
      settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.step === 'upkeep', 60_000);
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 7 && s.turn.step === 'upkeep', 60000);
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Skyline Despot", () => {
  test("When this creature enters: its controller becomes the monarch", () => {
    const { g } = armed(0);
    expect(g.state.monarch).toBe('p1');
  });

  test("At the beginning of your upkeep: 1 token made", () => {
    const { g, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
