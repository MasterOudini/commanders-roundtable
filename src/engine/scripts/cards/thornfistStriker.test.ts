// `Thornfist Striker` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { THORNFIST_STRIKER_SCRIPT } from './thornfistStriker';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Thornfist Striker";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; yes: InstanceId; condOff: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([THORNFIST_STRIKER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([THORNFIST_STRIKER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Thornfist Striker", "Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([THORNFIST_STRIKER_SCRIPT]),
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
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  let condOff = false;
  if (which === 0) {
    settle(g);
    condOff = pt(g, yes)[0] === 2 && pt(g, yes)[1] === 1 && !kw(g, yes).has("trample");
    // D398 - stage two: the condition is met.
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p1', delta: 1 }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, yes, condOff };
}

describe("Thornfist Striker", () => {
  test("`Thornfist Striker` - as long as you gained life this turn: absent while it is unmet, read once it holds", () => {
    const { g, self, no, yes, condOff } = armed(0);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
    expect(pt(g, yes)).toEqual([3, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("trample")).toBe(true);
    expect(kw(g, no).has("trample")).toBe(false);
    expect(pt(g, self)).toEqual([4, 3]);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
