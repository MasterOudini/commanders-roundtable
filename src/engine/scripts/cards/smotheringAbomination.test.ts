// `Smothering Abomination` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SMOTHERING_ABOMINATION_SCRIPT } from './smotheringAbomination';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Smothering Abomination";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; queueFodderL2_upkeep: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sacManaIndex(g: Game, id: InstanceId): number {
  const d = deps(createRegistry([SMOTHERING_ABOMINATION_SCRIPT]));
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
    decks: [["Smothering Abomination", "Blood Pet", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SMOTHERING_ABOMINATION_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const queueFodderL2_upkeep = put(g, 'p1', "Grizzly Bears");
  const sacFix0 = put(g, 'p1', "Blood Pet");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![false,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 40_000);
    }
  if (which === 1) {
    must(g.submit({ t: 'TapForMana', player: 'p1', card: sacFix0, abilityIndex: sacManaIndex(g, sacFix0), outputChoice: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, queueFodderL2_upkeep };
}

describe("Smothering Abomination", () => {
  test("At the beginning of your upkeep: the vocabulary resolves \"Sacrifice a creature.\"", () => {
    const { g, board0, queueFodderL2_upkeep } = armed(0);
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'battlefield') break;
      if (qa.player === 'p1') { must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [queueFodderL2_upkeep] })); continue; }
      let qDone = false;
      for (const qc of g.state.zones.battlefield.filter((c) => g.state.cards[c]?.controller === qa.player)) {
        if (g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: [qc] }).ok) { qDone = true; break; }
      }
      expect(qDone, 'the queued sacrifice could be answered for ' + qa.player).toBe(true);
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
    expect(g.state.cards[queueFodderL2_upkeep]?.zone.kind).toBe('graveyard');
    expect(onBoard(g)).toBe(board0 + -1);
  });

  test("Whenever you sacrifice a creature: a card is drawn", () => {
    const { g, hand0 } = armed(1);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
