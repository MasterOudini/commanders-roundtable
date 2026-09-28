// `Lore Drakkis` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { LORE_DRAKKIS_SCRIPT } from './loreDrakkis';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Lore Drakkis";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtL1_mutates_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Lore Drakkis", "Lightning Bolt", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([LORE_DRAKKIS_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bearsM = put(g, 'p1', "Grizzly Bears");
  const vtL1_mutates_0 = put(g, 'p1', "Lightning Bolt", 'graveyard');
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  if (![true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
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
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: self, alternative: true, targets: [{ kind: 'card', id: bearsM }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'mutateOrder', 20_000);
    { const mo = g.state.priority.awaiting; if (mo?.kind === 'mutateOrder') must(g.submit({ t: 'AnswerMutateOrder', player: 'p1', stackId: mo.stackId, over: true })); }
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_mutates_0 }] }));
    settle(g);
    }
  return { g, self: [true][which] ? bearsM : self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtL1_mutates_0 };
}

describe("Lore Drakkis", () => {
  test("Whenever this creature mutates: the vocabulary resolves \"Return target instant or sorcery card from your graveyard to your hand.\"", () => {
    const { g, hand0, vtL1_mutates_0 } = armed(0);
    expect(g.state.cards[vtL1_mutates_0]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
