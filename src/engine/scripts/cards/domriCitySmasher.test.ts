// `Domri, City Smasher` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DOMRI_CITY_SMASHER_SCRIPT } from './domriCitySmasher';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Domri, City Smasher";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId; refused: boolean; ownC0: number; selfC0: number; ownBear: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([DOMRI_CITY_SMASHER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([DOMRI_CITY_SMASHER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Domri, City Smasher", "Coral Eel", "Grizzly Bears", "Runeclaw Bear"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DOMRI_CITY_SMASHER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Coral Eel");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownBear = put(g, 'p1', "Runeclaw Bear");
  settle(g);
  const self = put(g, 'p1', CARD);
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
  let refused = false;
  let ownC0 = 0;
  let selfC0 = 0;
  if (which === 0) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'loyalty', delta: 5 }));
    ownC0 = g.state.cards[ownBear]?.counters["+1/+1"] ?? 0;
    selfC0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes, refused, ownC0, selfC0, ownBear };
}

describe("Domri, City Smasher", () => {
  test("+2: its controller's creatures get +1/+1 and gain haste until end of turn", () => {
    const { g, self, no, yes, refused } = armed(0);
    expect(pt(g, yes)).toEqual([3, 2]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(kw(g, yes).has("haste")).toBe(true);
    expect(kw(g, no).has("haste")).toBe(false);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(6);
  });

  test("−3: it deals 3 damage to the declared creature", () => {
    const { g, self, no, refused } = armed(1);
    expect(g.state.cards[no]?.zone.kind).toBe('graveyard');
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(1);
  });

  test("−8: the vocabulary resolves \"Put three +1/+1 counters on each creature you control. Those creatures gain trample until end of turn.\"", () => {
    const { g, self, no, refused, ownC0, ownBear } = armed(2);
    expect(g.state.cards[ownBear]?.counters["+1/+1"] ?? 0, "a counter on the witness on your side").toBe(ownC0 + 3);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0, "the opponent's creature outside the scope").toBe(0);
    expect(kw(g, ownBear).has("trample"), "gained trample").toBe(true);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(1);
  });

  test('the pump ends at cleanup', () => {
    const { g, yes } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(pt(g, yes)).toEqual([2, 1]);
    expect(kw(g, yes).has("haste")).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
