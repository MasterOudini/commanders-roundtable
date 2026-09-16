// `Bird` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { BIRD_TOKEN1FBC471D_SCRIPT } from './birdToken1fbc471d';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { BIRD_1FBC471D_TOKEN } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';


type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([BIRD_TOKEN1FBC471D_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [[], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([BIRD_TOKEN1FBC471D_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  let self: InstanceId;
  must(g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: BIRD_1FBC471D_TOKEN.scryfallId, count: 1 }));
  self = Object.values(g.state.cards).filter((c) => c.isToken && c.controller === 'p1' && c.printingId === BIRD_1FBC471D_TOKEN.scryfallId).map((c) => c.id).pop() as InstanceId;
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  let hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const p2hand0 = (g.state.zones.hand.p2 ?? []).length;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const p2gy0 = (g.state.zones.graveyard.p2 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    put(g, 'p1', 'Forest');
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Bird", () => {
  test("Whenever a land you control enters: it gets +1/+0 until end of turn", () => {
    const { g, self } = armed(0);
    expect(pt(g, self)).toEqual([3, 2]);
  });

  test('the pump ends at cleanup', () => {
    const { g, self } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
