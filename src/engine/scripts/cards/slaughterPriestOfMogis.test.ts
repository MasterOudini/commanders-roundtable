// `Slaughter-Priest of Mogis` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SLAUGHTER_PRIEST_OF_MOGIS_SCRIPT } from './slaughterPriestOfMogis';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Slaughter-Priest of Mogis";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sacManaIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([SLAUGHTER_PRIEST_OF_MOGIS_SCRIPT]));
  const inst = g.state.cards[id];
  const face = inst ? d.oracle.byPrinting(inst.printingId)?.faces[inst.faceIndex] : undefined;
  const p = face?.producesMana.find((m) => m.extraCost?.sacrificeSelf);
  if (!p) throw new Error('no mana ability whose price is its own sacrifice');
  return p.abilityIndex;
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SLAUGHTER_PRIEST_OF_MOGIS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SLAUGHTER_PRIEST_OF_MOGIS_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Slaughter-Priest of Mogis", "Grizzly Bears", "Lotus Petal"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SLAUGHTER_PRIEST_OF_MOGIS_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const fodder0 = [put(g, 'p1', "Grizzly Bears")];
  const sacFix0 = put(g, 'p1', "Lotus Petal");
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
    must(g.submit({ t: 'TapForMana', player: 'p1', card: sacFix0, abilityIndex: sacManaIndex(g, sacFix0), outputChoice: 0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 1) }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, fodder0 };
}

describe("Slaughter-Priest of Mogis", () => {
  test("Whenever you sacrifice a permanent: it gets +2/+0 until end of turn", () => {
    const { g, self } = armed(0);
    expect(pt(g, self)).toEqual([4, 2]);
  });

  test("{2}, Sacrifice another creature or an enchantment: it gains firstStrike until end of turn", () => {
    const { g, self, fodder0 } = armed(1);
    expect(pt(g, self)).toEqual([4, 2]);
    expect(kw(g, self).has("firstStrike")).toBe(true);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('the pump ends at cleanup', () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
