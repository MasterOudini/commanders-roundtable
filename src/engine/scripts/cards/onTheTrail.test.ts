// `On the Trail` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ON_THE_TRAIL_SCRIPT } from './onTheTrail';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "On the Trail";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["On the Trail", "Divination", "Forest", "Forest"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ON_THE_TRAIL_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const div = put(g, 'p1', 'Divination', 'hand');
  const life0 = g.state.players.p1?.life ?? 0;
  let hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    { const inHand = (g.state.zones.hand.p1 ?? []).some((id) => nameOf(g, id) === "Forest");
      const inLib = (g.state.zones.library.p1 ?? []).find((id) => nameOf(g, id) === "Forest");
      if (!inHand) { expect(inLib, "Forest is dealt for the hand put").toBeDefined(); must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: inLib as InstanceId, to: { kind: 'hand', player: 'p1' } })); } }
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 40_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: div }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("On the Trail", () => {
  test("Whenever you draw your second card each turn: the vocabulary resolves \"Put a land card from your hand onto the battlefield tapped.\"", () => {
    const { g, hand0, board0 } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const ask = g.state.priority.awaiting;
      expect(ask?.kind === 'chooseFromZone' && ask.zone === 'hand' && ask.to === 'battlefield' ? ask.player : null, 'the hand put asks p1').toBe('p1');
      const found = (g.state.zones.hand.p1 ?? []).find((id) => nameOf(g, id) === "Forest");
      expect(found, "Forest is in hand for the put").toBeDefined();
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [found as InstanceId] }));
      settle(g);
      expect(g.state.cards[found as InstanceId]?.zone).toEqual({ kind: 'battlefield', player: 'p1' });
      expect(g.state.cards[found as InstanceId]?.tapped, 'entered tapped').toBe(true);
    }
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + -1 + 2);
    expect(onBoard(g)).toBe(board0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
