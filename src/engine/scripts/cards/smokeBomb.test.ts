// `Smoke Bomb` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SMOKE_BOMB_SCRIPT } from './smokeBomb';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Smoke Bomb";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId; vtL2_upkeep_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([SMOKE_BOMB_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SMOKE_BOMB_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Smoke Bomb", "Grizzly Bears", "Cyclops of One-Eyed Pass"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SMOKE_BOMB_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Grizzly Bears");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL2_upkeep_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const energy0 = g.state.players.p1?.energy ?? 0;
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
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 60000);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL2_upkeep_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes, vtL2_upkeep_0 };
}

describe("Smoke Bomb", () => {
  test("All creatures have shroud. (They can't be the targets of spells or abilities.): every creature on the battlefield reads it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("shroud")).toBe(true);
    expect(kw(g, no).has("shroud"), 'the scope is every creature on the battlefield').toBe(true);
  });

  test("At the beginning of your upkeep: the vocabulary resolves \"Sacrifice this artifact. When you do, target creature you control can't be blocked this turn.\"", () => {
    const { g, self, board0, vtL2_upkeep_0 } = armed(1);
    expect(g.log.some((ev) => ev.body.t === 'ReflexiveTriggered'), 'the action happened: its payload triggered').toBe(true);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
    if (g.state.cards[vtL2_upkeep_0]?.zone.kind === 'battlefield') expect(g.state.untilEndOfTurn.some((m) => m.card === vtL2_upkeep_0 && m.cantBeBlocked === true), 'cannot be blocked this turn').toBe(true);
    expect(onBoard(g)).toBe(board0 + -1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
