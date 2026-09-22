// `Mortarpod` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { MORTARPOD_SCRIPT } from './mortarpod';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import { legalActions } from '../../legal';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Mortarpod";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; bearsB: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([MORTARPOD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Mortarpod", "Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([MORTARPOD_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bearsB = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0, targets: [{ kind: 'card', id: bearsB }] }));
    settle(g);
    { const grantOffer = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((x) => x.t === 'ActivateAbility' && x.card === bearsB && x.grantRef !== undefined);
      if (!grantOffer || grantOffer.t !== 'ActivateAbility' || grantOffer.grantRef === undefined) throw new Error('no granted offer on the host');
      must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bearsB, abilityIndex: grantOffer.abilityIndex, grantRef: grantOffer.grantRef }));
    }
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, bearsB };
}

describe("Mortarpod", () => {
  test("Living weapon (When this Equipment enters: a token is made and it attaches to it", () => {
    const { g, self, board0 } = armed(0);
    const germ = g.state.cards[self]?.attachedTo ?? null;
    expect(germ).not.toBeNull();
    const made = germ === null ? undefined : g.state.cards[germ];
    expect(made?.isToken).toBe(true);
    expect(made?.zone.kind).toBe('battlefield');
    expect(onBoard(g)).toBe(board0 + 2);
    if (germ !== null) expect(pt(g, germ)).toEqual([0, 1]);
  });

  test("Equipped creature gets +0/+1 and has \"Sacrifice this creature: the creature it is attached to reads it", () => {
    const { g, self, bearsB } = armed(1);
    expect(g.state.cards[self]?.attachedTo).toBe(bearsB);
    expect(pt(g, bearsB)).toEqual([2, 3]);
  });

  test("Equipped creature gets +0/+1 and has \"Sacrifice this creature: the vocabulary resolves \"~ deals 1 damage to any target.\"", () => {
    const { g, no, bearsB } = armed(2);
    expect(g.state.cards[no]?.damage).toBe(1);
    expect(g.state.cards[bearsB]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
