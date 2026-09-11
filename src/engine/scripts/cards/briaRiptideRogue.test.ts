// `Bria, Riptide Rogue` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { BRIA_RIPTIDE_ROGUE_SCRIPT } from './briaRiptideRogue';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Bria, Riptide Rogue";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; yes: InstanceId; vtL2_castNoncreature_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([BRIA_RIPTIDE_ROGUE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([BRIA_RIPTIDE_ROGUE_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Bria, Riptide Rogue", "Coral Eel", "Pyretic Ritual", "Cyclops of One-Eyed Pass"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([BRIA_RIPTIDE_ROGUE_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL2_castNoncreature_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
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
    settle(g);
    }
  if (which === 1) {
    const ritual = put(g, 'p1', "Pyretic Ritual", 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ritual }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL2_castNoncreature_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, yes, vtL2_castNoncreature_0 };
}

describe("Bria, Riptide Rogue", () => {
  test("Other creatures you control have prowess. (If a creature has multiple instances of prowess, each triggers separately.): its controller's other creatures read it", () => {
    const { g, self, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("prowess")).toBe(true);
    expect(kw(g, no).has("prowess")).toBe(false);
    expect(pt(g, self)).toEqual([3, 3]);
  });

  test("Whenever you cast a noncreature spell: the vocabulary resolves \"Target creature you control can't be blocked this turn.\"", () => {
    const { g, vtL2_castNoncreature_0 } = armed(1);
    if (g.state.cards[vtL2_castNoncreature_0]?.zone.kind === 'battlefield') expect(g.state.untilEndOfTurn.some((m) => m.card === vtL2_castNoncreature_0 && m.cantBeBlocked === true), 'cannot be blocked this turn').toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
