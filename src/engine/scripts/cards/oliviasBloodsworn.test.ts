// `Olivia's Bloodsworn` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { OLIVIAS_BLOODSWORN_SCRIPT } from './oliviasBloodsworn';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Olivia's Bloodsworn";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; vtA0_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([OLIVIAS_BLOODSWORN_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([OLIVIAS_BLOODSWORN_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Olivia's Bloodsworn", "Grizzly Bears"], ["Cyclops of One-Eyed Pass", "Falkenrath Reaver"]],
    scripts: createRegistry([OLIVIAS_BLOODSWORN_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA0_0 = put(g, 'p2', "Falkenrath Reaver");
  settle(g);
  const self = put(g, 'p1', CARD);
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
  let refused = false;
  if (which === 0) {
    put(g, 'p1', 'Grizzly Bears');
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    refused = !g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: no }] }).ok;
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA0_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, vtA0_0 };
}

describe("Olivia's Bloodsworn", () => {
  test("This creature can't block.: the block is refused", () => {
    const { refused } = armed(0);
    expect(refused).toBe(true);
  });

  test("{R}: the vocabulary resolves \"Target Vampire gains haste until end of turn.\"", () => {
    const { g, vtA0_0 } = armed(1);
    expect(pt(g, vtA0_0)).toEqual([2, 2]);
    expect(kw(g, vtA0_0).has("haste")).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
