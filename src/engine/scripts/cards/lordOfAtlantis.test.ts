// `Lord of Atlantis` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { LORD_OF_ATLANTIS_SCRIPT } from './lordOfAtlantis';
import { advanceUntil, deps, holdEverywhere, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Lord of Atlantis";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; yes: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([LORD_OF_ATLANTIS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function lw(g: Game, id: InstanceId): readonly string[] {
  const d = deps(createRegistry([LORD_OF_ATLANTIS_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).landwalk;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Lord of Atlantis", "Merfolk of the Pearl Trident"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([LORD_OF_ATLANTIS_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Merfolk of the Pearl Trident");
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
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, yes };
}

describe("Lord of Atlantis", () => {
  test("Other Merfolk get +1/+1 and have islandwalk. (They can't be blocked as long as defending player controls an Island.): only the Merfolk reads it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([2, 2]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(lw(g, yes)).toContain("Island");
    expect(lw(g, no)).not.toContain("Island");
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
