// `Blood Aspirant` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { BLOOD_ASPIRANT_SCRIPT } from './bloodAspirant';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Blood Aspirant";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sacManaIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([BLOOD_ASPIRANT_SCRIPT]));
  const inst = g.state.cards[id];
  const face = inst ? d.oracle.byPrinting(inst.printingId)?.faces[inst.faceIndex] : undefined;
  const p = face?.producesMana.find((m) => m.extraCost?.sacrificeSelf);
  if (!p) throw new Error('no mana ability whose price is its own sacrifice');
  return p.abilityIndex;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Blood Aspirant", "Grizzly Bears", "Lotus Petal"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([BLOOD_ASPIRANT_SCRIPT]),
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
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, sacrifice: fodder0.slice(0, 1) }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, fodder0 };
}

describe("Blood Aspirant", () => {
  test("Whenever you sacrifice a permanent: it gets 1 +1/+1 counter", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(1);
  });

  test("{1}{R}, {T}, Sacrifice a creature or enchantment: the vocabulary resolves \"~ deals 1 damage to target creature. That creature can't block this turn.\"", () => {
    const { g, self, no, fodder0 } = armed(1);
    expect(g.state.cards[no]?.damage).toBe(1);
    if (g.state.cards[no]?.zone.kind === 'battlefield') expect(g.state.untilEndOfTurn.some((m) => m.card === no && m.cantBlock === true), 'cannot block this turn').toBe(true);
    expect(g.state.cards[self]?.tapped).toBe(true);
    for (const f of fodder0.slice(0, 1)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
