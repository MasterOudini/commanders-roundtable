// `Kobold Drill Sergeant` - the anthem reaches the permanent its scope names and not the other;
// it ends when the source leaves; replay equal (D300). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KOBOLD_DRILL_SERGEANT_SCRIPT } from './koboldDrillSergeant';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Kobold Drill Sergeant";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([KOBOLD_DRILL_SERGEANT_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([KOBOLD_DRILL_SERGEANT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function board(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Kobold Drill Sergeant", "Crimson Kobolds", "Coral Eel"], ["Grizzly Bears"]],
    scripts: createRegistry([KOBOLD_DRILL_SERGEANT_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Crimson Kobolds");
  const no = put(g, 'p1', "Coral Eel");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, yes, no };
}

describe("Kobold Drill Sergeant", () => {
  test("Crimson Kobolds is reached, Coral Eel is not", () => {
    const { g, yes, no } = board();
    expect(pt(g, yes)).toEqual([0, 2]);
    expect(kw(g, yes).has("trample")).toBe(true);
    expect(pt(g, no)).toEqual([2, 1]);
    expect(kw(g, no).has("trample")).toBe(false);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, yes } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, yes)).toEqual([0, 1]);
    expect(kw(g, yes).has("trample")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
