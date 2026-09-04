// `Captain of the Watch` - the anthem reaches the permanent its scope names and not the other;
// it ends when the source leaves; replay equal (D300). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CAPTAIN_OF_THE_WATCH_SCRIPT } from './captainOfTheWatch';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Captain of the Watch";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([CAPTAIN_OF_THE_WATCH_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([CAPTAIN_OF_THE_WATCH_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBattlefield(g: Game, player: 'p1' | 'p2'): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === player).length;
}

function board(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Captain of the Watch", "Straw Soldiers", "Coral Eel"], ["Grizzly Bears"]],
    scripts: createRegistry([CAPTAIN_OF_THE_WATCH_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Straw Soldiers");
  const no = put(g, 'p1', "Coral Eel");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, yes, no };
}

describe("Captain of the Watch", () => {
  test("Straw Soldiers is reached, Coral Eel is not", () => {
    const { g, yes, no } = board();
    expect(pt(g, yes)).toEqual([2, 4]);
    expect(kw(g, yes).has("vigilance")).toBe(true);
    expect(pt(g, no)).toEqual([2, 1]);
    expect(kw(g, no).has("vigilance")).toBe(false);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, yes } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, yes)).toEqual([1, 3]);
    expect(kw(g, yes).has("vigilance")).toBe(false);
  });

  test("entering creates 3 tokens", () => {
    const g = startedGame({ players: 2, decks: [[CARD], ["Grizzly Bears"]], scripts: createRegistry([CAPTAIN_OF_THE_WATCH_SCRIPT]) });
    holdEverywhere(g);
    const before = onBattlefield(g, 'p1');
    put(g, 'p1', CARD);
    settle(g);
    expect(onBattlefield(g, 'p1')).toBe(before + 1 + 3);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
