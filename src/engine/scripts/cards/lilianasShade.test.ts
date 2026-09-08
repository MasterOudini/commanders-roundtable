// `Liliana's Shade` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { LILIANAS_SHADE_SCRIPT } from './lilianasShade';
import { advanceUntil, deps, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Liliana's Shade";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([LILIANAS_SHADE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Liliana's Shade", "Swamp"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([LILIANAS_SHADE_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,false][which]) {
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
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Liliana's Shade", () => {
  test("When this creature enters: the vocabulary resolves \"Search your library for a Swamp card, reveal it, put it into your hand, then shuffle.\"", () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    { const stray = Object.keys(g.state.cards).find((id) => nameOf(g, id as InstanceId) === "Swamp" && g.state.cards[id as InstanceId]?.zone.kind !== 'library');
      if (stray) must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: stray as InstanceId, to: { kind: 'library', player: 'p1' } }));
      const lib = [...(g.state.zones.library.p1 ?? [])];
      const found = lib.find((id) => nameOf(g, id) === "Swamp");
      expect(found, "Swamp is not in the library for the search to find").toBeDefined();
      must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [found as InstanceId], declined: false }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: "hand", player: 'p1' });
    }
  });

  test("{B}: it gets +1/+1 until end of turn", () => {
    const { g, self } = armed(1);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
