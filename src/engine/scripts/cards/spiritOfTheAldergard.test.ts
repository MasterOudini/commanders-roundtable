// `Spirit of the Aldergard` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SPIRIT_OF_THE_ALDERGARD_SCRIPT } from './spiritOfTheAldergard';
import { advanceUntil, deps, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Spirit of the Aldergard";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; cda0: number; cdaT0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SPIRIT_OF_THE_ALDERGARD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Spirit of the Aldergard", "Snow-Covered Forest", "Snow-Covered Forest", "Snow-Covered Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SPIRIT_OF_THE_ALDERGARD_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  put(g, 'p1', "Snow-Covered Forest");
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
  let cda0 = 0;
  let cdaT0 = 0;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    cda0 = pt(g, self)[0] ?? 0;
    cdaT0 = pt(g, self)[1] ?? 0;
    put(g, 'p1', "Snow-Covered Forest");
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, cda0, cdaT0 };
}

describe("Spirit of the Aldergard", () => {
  test("When this creature enters: the vocabulary resolves \"Search your library for a snow land card, reveal it, put it into your hand, then shuffle.\"", () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    { const stray = Object.keys(g.state.cards).find((id) => nameOf(g, id as InstanceId) === "Snow-Covered Forest" && g.state.cards[id as InstanceId]?.zone.kind === 'hand');
      if (stray) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: stray as InstanceId, to: { kind: 'library', player: 'p1' } }));
      const lib = [...(g.state.zones.library.p1 ?? [])];
      const found = lib.find((id) => nameOf(g, id) === "Snow-Covered Forest");
      expect(found, "Snow-Covered Forest is not in the library for the search to find").toBeDefined();
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [found as InstanceId], declined: false }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: "hand", player: 'p1' });
    }
  });

  test("This creature gets +1/+0 for each other snow permanent you control.: it gets +1/+0 for each other snow permanent you control", () => {
    const { g, self, cda0, cdaT0 } = armed(1);
    expect(pt(g, self)).toEqual([cda0 + 1, cdaT0 + 0]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
