// `Angrath, Captain of Chaos` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ANGRATH_CAPTAIN_OF_CHAOS_SCRIPT } from './angrathCaptainOfChaos';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Angrath, Captain of Chaos";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId; refused: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([ANGRATH_CAPTAIN_OF_CHAOS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([ANGRATH_CAPTAIN_OF_CHAOS_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Angrath, Captain of Chaos", "Coral Eel", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ANGRATH_CAPTAIN_OF_CHAOS_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
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
  let refused = false;
  if (which === 0) {
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes, refused };
}

describe("Angrath, Captain of Chaos", () => {
  test("Creatures you control have menace.: its controller's creatures read it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("menace")).toBe(true);
    expect(kw(g, no).has("menace")).toBe(false);
  });

  test("−2: the vocabulary resolves \"Amass Zombies 2.\"", () => {
    const { g, self, board0, refused } = armed(1);
    settle(g);
    { const am = g.log.filter((e) => e.body.t === 'Amassed' && e.body.player === 'p1');
      expect(am.length, 'an amass ran for p1').toBeGreaterThan(0);
      const army = (am[am.length - 1]?.body as { card: InstanceId | null }).card as InstanceId;
      expect(army, 'the Army the counters went on').toBeDefined();
      expect(g.state.cards[army]?.isToken, 'an Army creature token').toBe(true);
      expect(g.state.cards[army]?.counters['+1/+1'] ?? 0, 'amassed: the Army carries the counters').toBe(2);
    }
    expect(onBoard(g)).toBe(board0 + 1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
