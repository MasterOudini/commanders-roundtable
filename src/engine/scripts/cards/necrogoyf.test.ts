// `Necrogoyf` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { NECROGOYF_SCRIPT } from './necrogoyf';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Necrogoyf";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; cda0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([NECROGOYF_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Necrogoyf", "Grizzly Bears", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([NECROGOYF_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  put(g, 'p1', "Grizzly Bears", 'graveyard');
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null,null][which]) {
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
  let cda0 = 0;
  if (which === 0) {
    cda0 = pt(g, self)[0] ?? 0;
    put(g, 'p1', "Grizzly Bears", 'graveyard');
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.turn.step === 'upkeep', 40_000);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, cda0 };
}

describe("Necrogoyf", () => {
  test("Necrogoyf's power is equal to the number of creature cards in all graveyards.: its power follows the count", () => {
    const { g, self, cda0 } = armed(0);
    expect(pt(g, self)[0]).toBe(cda0 + 1);
  });

  test("At the beginning of each player's upkeep: the vocabulary resolves \"Target player discards a card.\"", () => {
    const { g, p2hand0 } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const dh = [...(g.state.zones.hand.p2 ?? [])];
      expect(dh.length).toBeGreaterThanOrEqual(1);
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: dh.slice(0, 1) }));
      settle(g);
      for (const id of dh.slice(0, 1)) expect(g.state.cards[id]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
      expect((g.state.zones.hand.p2 ?? []).length).toBe(dh.length - 1); }
    expect((g.state.zones.hand.p2 ?? []).length).toBe(p2hand0 + -1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
