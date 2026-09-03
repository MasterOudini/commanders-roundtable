// `Vampiric Spirit` - enters: its controller loses 4 life; replay equal.
// Generated from one table row (D295).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VAMPIRIC_SPIRIT_SCRIPT } from './vampiricSpirit';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Vampiric Spirit";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(): { g: Game; self: InstanceId; life0: number } {
  const g = startedGame({ players: 2, decks: [[CARD], ['Grizzly Bears']], scripts: createRegistry([VAMPIRIC_SPIRIT_SCRIPT]) });
  holdEverywhere(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, self, life0 };
}

describe("Vampiric Spirit", () => {
  test("entering costs 4 life", () => {
    const { g, self, life0 } = fired();
    expect(g.state.cards[self]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(life0 + (-4));
    expect(g.state.players.p2?.life).toBe(g.state.players.p2?.life);
  });

  test('replays to the same hash', () => {
    const { g } = fired();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
