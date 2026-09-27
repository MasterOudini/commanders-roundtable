// `Charming Scoundrel` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CHARMING_SCOUNDREL_SCRIPT } from './charmingScoundrel';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Charming Scoundrel";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtL1_m2_etb_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Charming Scoundrel", "Cyclops of One-Eyed Pass"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CHARMING_SCOUNDREL_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL1_m2_etb_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,true,true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_m2_etb_0 }] }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
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
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [2] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_m2_etb_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtL1_m2_etb_0 };
}

describe("Charming Scoundrel", () => {
  test("When this creature enters: choosing \"Discard a card, then draw a card.\", the vocabulary resolves \"Discard a card, then draw a card.\" [etb 1]", () => {
    const { g, hand0 } = armed(0);
    let qdL1_m0 = 0;
    for (let qi = 0; qi < 4; qi++) {
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null), 20_000);
      const qa = g.state.priority.awaiting;
      if (qa?.kind !== 'chooseFromZone' || qa.zone !== 'hand') break;
      must(g.submit({ t: 'AnswerChooseFromZone', player: qa.player, cards: (g.state.zones.hand[qa.player] ?? []).slice(0, qa.count) }));
    }
    settle(g);
    expect(g.state.pendingAsks).toBeNull();
    { const qb = [...g.log].reverse().find((x) => x.body.t === 'CardsMoved' && x.body.moves.some((m) => m.reason === 'discard'));
      expect(qb, 'the queued discard landed').toBeDefined();
      const qm = qb && qb.body.t === 'CardsMoved' ? qb.body.moves : [];
      for (const m of qm) expect(g.state.cards[m.card]?.zone.kind).toBe('graveyard');
      expect(qm.some((m) => m.from.kind === 'hand' && m.from.player === 'p2'), 'p2 was not in the scope').toBe(false);
      qdL1_m0 = qm.filter((m) => m.from.kind === 'hand' && m.from.player === 'p1').length;
    }
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1 - qdL1_m0);
  });

  test("When this creature enters: choosing \"Create a Treasure token.\", token [etb 2]", () => {
    const { g, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test("When this creature enters: choosing \"Create a Wicked Role token attached to target creature you control.\", the vocabulary resolves \"Create a Wicked Role token attached to target creature you control.\" [etb 3]", () => {
    const { g, board0, vtL1_m2_etb_0 } = armed(2);
    { const role = Object.values(g.state.cards).find((c) => c.isToken === true && c.zone.kind === 'battlefield' && c.printingId === "6929750f-cf08-4e3e-83b0-076e1f6fa8e0" && c.faceIndex === 0); expect(role?.attachedTo, 'the Role is attached').toBe(vtL1_m2_etb_0); }
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
