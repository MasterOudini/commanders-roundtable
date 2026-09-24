// `Piper of the Swarm` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { PIPER_OF_THE_SWARM_SCRIPT } from './piperOfTheSwarm';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Piper of the Swarm";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId; fodder0: InstanceId[] };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([PIPER_OF_THE_SWARM_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([PIPER_OF_THE_SWARM_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Piper of the Swarm", "Muck Rats", "Muck Rats", "Muck Rats"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([PIPER_OF_THE_SWARM_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Muck Rats");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const fodder0 = [put(g, 'p1', "Muck Rats"), put(g, 'p1', "Muck Rats"), put(g, 'p1', "Muck Rats")];
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
  if (which === 0) {
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1, sacrifice: fodder0.slice(0, 3) }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes, fodder0 };
}

describe("Piper of the Swarm", () => {
  test("Rats you control have menace.: only the Rat reads it", () => {
    const { g, no, yes } = armed(0);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("menace")).toBe(true);
    expect(kw(g, no).has("menace")).toBe(false);
  });

  test("{1}{B}, {T}: 1 token made", () => {
    const { g, self, board0 } = armed(1);
    expect(onBoard(g)).toBe(board0 + 1);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("{2}{B}{B}, {T}, Sacrifice three Rats: the vocabulary resolves \"Gain control of target creature.\"", () => {
    const { g, self, no, board0, fodder0 } = armed(2);
    expect(g.state.cards[no]?.controller, 'taken for good').toBe('p1');
    expect(g.state.cards[no]?.controlledVia, 'for good: nothing to end it').toBeUndefined();
    expect(onBoard(g)).toBe(board0 + 1 - 3);
    expect(g.state.cards[self]?.tapped).toBe(true);
    for (const f of fodder0.slice(0, 3)) expect(g.state.cards[f]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
