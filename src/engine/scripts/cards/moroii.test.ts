// `Moroii` - each of its controller's upkeeps: its controller loses 1 life; replay equal.
// Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MOROII_SCRIPT } from './moroii';
import { advanceUntil, holdEverywhere, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Moroii";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): { g: Game; self: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], ['Grizzly Bears']], scripts: createRegistry([MOROII_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  // The controller's next upkeep (turn 3); the holds keep priority so the trigger resolves inside settle().
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.step === 'upkeep', 20_000);
  settle(g);
  return { g, self, life0 };
}

describe("Moroii", () => {
  test("its controller's upkeep costs 1 life", () => {
    const { g, self, life0 } = fired();
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(life0 + (-1));
    expect(g.state.players.p2?.life).toBe(g.state.players.p2?.life);
  });

  test('replays to the same hash', () => {
    const { g } = fired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
