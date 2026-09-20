// `Action News Crew` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ACTION_NEWS_CREW_SCRIPT } from './actionNewsCrew';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Action News Crew";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; ownC0: number; selfC0: number; ownBear: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Action News Crew", "Runeclaw Bear"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ACTION_NEWS_CREW_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownBear = put(g, 'p1', "Runeclaw Bear");
  settle(g);
  const self = put(g, 'p1', CARD, [0].includes(which) ? 'hand' : 'battlefield');
  settle(g);
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
  let ownC0 = 0;
  let selfC0 = 0;
  if (which === 0) {
    ownC0 = g.state.cards[ownBear]?.counters["+1/+1"] ?? 0;
    selfC0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 6 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, ownC0, selfC0, ownBear };
}

describe("Action News Crew", () => {
  test("Channel — {6}, Discard this card: the vocabulary resolves \"Put a +1/+1 counter on each creature you control. Draw a card.\"", () => {
    const { g, self, no, hand0, ownC0, ownBear } = armed(0);
    expect(g.state.cards[ownBear]?.counters["+1/+1"] ?? 0, "a counter on the witness on your side").toBe(ownC0 + 1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0, "the opponent's creature outside the scope").toBe(0);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1 - 1);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
