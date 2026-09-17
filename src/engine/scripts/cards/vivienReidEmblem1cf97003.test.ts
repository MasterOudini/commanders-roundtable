// `Vivien Reid Emblem` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { VIVIEN_REID_EMBLEM1CF97003_SCRIPT } from './vivienReidEmblem1cf97003';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { VIVIEN_REID_EMBLEM } from '../../../data/fixtures/engineCards';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';


type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([VIVIEN_REID_EMBLEM1CF97003_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([VIVIEN_REID_EMBLEM1CF97003_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Coral Eel"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([VIVIEN_REID_EMBLEM1CF97003_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  let self: InstanceId;
  must(g.submit({ t: 'ManualCreateEmblem', player: 'p1', printingId: VIVIEN_REID_EMBLEM.scryfallId }));
  self = (g.state.zones.command.p1 ?? []).filter((c) => g.state.cards[c]?.printingId === VIVIEN_REID_EMBLEM.scryfallId).pop() as InstanceId;
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
  if (which === 0) {
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes };
}

describe("Vivien Reid Emblem", () => {
  test("Creatures you control get +2/+2 and have vigilance, trample, and indestructible.: its controller's creatures read it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, yes)).toEqual([4, 3]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("vigilance")).toBe(true);
    expect(kw(g, no).has("vigilance")).toBe(false);
    expect(kw(g, yes).has("trample")).toBe(true);
    expect(kw(g, no).has("trample")).toBe(false);
    expect(kw(g, yes).has("indestructible")).toBe(true);
    expect(kw(g, no).has("indestructible")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
