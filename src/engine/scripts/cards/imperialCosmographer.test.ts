// `Imperial Cosmographer` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { IMPERIAL_COSMOGRAPHER_SCRIPT } from './imperialCosmographer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Imperial Cosmographer";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Imperial Cosmographer", "Crimson Kobolds", "Crimson Kobolds", "Crimson Kobolds"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([IMPERIAL_COSMOGRAPHER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
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
    // D381 - stage one: it DIES, and dying is the one exit this head does not pay for (D259).
    const died = put(g, 'p1', "Crimson Kobolds");
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: died, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    if ((g.state.cards[self]?.counters['+1/+1'] ?? 0) !== 0) throw new Error("the trigger fired on a death, which this head does not pay for");
    // stage two: it LEAVES the battlefield without dying.
    const gone = put(g, 'p1', "Crimson Kobolds");
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: gone, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0 };
}

describe("Imperial Cosmographer", () => {
  test("Whenever another creature you control leaves the battlefield without dying: it gets 2 +1/+1 counters", () => {
    const { g, self } = armed(0);
    expect(g.state.cards[self]?.counters["+1/+1"] ?? 0).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
