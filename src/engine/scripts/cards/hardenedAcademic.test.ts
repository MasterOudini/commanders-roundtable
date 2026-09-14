// `Hardened Academic` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { HARDENED_ACADEMIC_SCRIPT } from './hardenedAcademic';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Hardened Academic";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; vtL2_cardLeavesYourGraveyard_0: InstanceId; disc0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([HARDENED_ACADEMIC_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([HARDENED_ACADEMIC_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Hardened Academic", "Grizzly Bears", "Badlands", "Cyclops of One-Eyed Pass"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([HARDENED_ACADEMIC_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL2_cardLeavesYourGraveyard_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  const disc0 = [put(g, 'p1', "Grizzly Bears", 'hand')];
  const gyFix0 = put(g, 'p1', "Badlands", 'graveyard');
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
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, discard: disc0 }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: gyFix0, to: { kind: 'hand', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL2_cardLeavesYourGraveyard_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, vtL2_cardLeavesYourGraveyard_0, disc0 };
}

describe("Hardened Academic", () => {
  test("Discard a card: it gains lifelink until end of turn", () => {
    const { g, self, disc0 } = armed(0);
    expect(pt(g, self)).toEqual([2, 1]);
    expect(kw(g, self).has("lifelink")).toBe(true);
    for (const c of disc0) expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
  });

  test("Whenever one or more cards leave your graveyard: the vocabulary resolves \"Put a +1/+1 counter on target creature you control.\"", () => {
    const { g, vtL2_cardLeavesYourGraveyard_0 } = armed(1);
    expect(g.state.cards[vtL2_cardLeavesYourGraveyard_0]?.counters["+1/+1"] ?? 0).toBe(1);
  });

  test('the pump ends at cleanup', () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, self)).toEqual([2, 1]);
    expect(kw(g, self).has("lifelink")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
