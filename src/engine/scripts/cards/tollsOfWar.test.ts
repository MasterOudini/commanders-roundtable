// `Tolls of War` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { TOLLS_OF_WAR_SCRIPT } from './tollsOfWar';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Tolls of War";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sacManaIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([TOLLS_OF_WAR_SCRIPT]));
  const inst = g.state.cards[id];
  const face = inst ? d.oracle.byPrinting(inst.printingId)?.faces[inst.faceIndex] : undefined;
  const p = face?.producesMana.find((m) => m.extraCost?.sacrificeSelf);
  if (!p) throw new Error('no mana ability whose price is its own sacrifice');
  return p.abilityIndex;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Tolls of War", "Lotus Petal"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([TOLLS_OF_WAR_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const sacFix0 = put(g, 'p1', "Lotus Petal");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'TapForMana', player: 'p1', card: sacFix0, abilityIndex: sacManaIndex(g, sacFix0), outputChoice: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Tolls of War", () => {
  test("When this enchantment enters: 1 token made", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test("Whenever you sacrifice a permanent during your turn: 1 token made", () => {
    const { g, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1 - 1);
  });

  test('the once-per-turn rider rides the def (D492)', () => {
    expect(TOLLS_OF_WAR_SCRIPT.triggers?.find((t) => t.abilityId.startsWith("youSacrifice-1") && t.oncePerTurn === true), 'the def of line 1 carries oncePerTurn').toBeDefined();
  });
  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
