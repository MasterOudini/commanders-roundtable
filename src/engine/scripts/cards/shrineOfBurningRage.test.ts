// `Shrine of Burning Rage` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SHRINE_OF_BURNING_RAGE_SCRIPT } from './shrineOfBurningRage';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Shrine of Burning Rage";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Shrine of Burning Rage", "Grizzly Bears", "Crimson Kobolds"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SHRINE_OF_BURNING_RAGE_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![null,null,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const bearsSpell = put(g, 'p1', "Crimson Kobolds", 'hand');
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
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'upkeep', 60000);
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bearsSpell }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    { const sc0 = g.state.cards[self]?.counters["charge"] ?? 0; if (sc0 !== 2) must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: "charge", delta: 2 - sc0 })); }
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0 };
}

describe("Shrine of Burning Rage", () => {
  test("At the beginning of your upkeep and whenever you cast a red spell: the vocabulary resolves \"Put a charge counter on this artifact.\" [upkeep]", () => {
    const { g, self } = armed(0);
    expect(g.log.some((x) => x.body.t === 'CountersChanged' && x.body.changes.some((c) => c.card === self && c.kind === "charge" && c.delta === 1)), 'the counter on the card').toBe(true);
  });

  test("At the beginning of your upkeep and whenever you cast a red spell: the vocabulary resolves \"Put a charge counter on this artifact.\" [castSpell]", () => {
    const { g, self } = armed(1);
    expect(g.log.some((x) => x.body.t === 'CountersChanged' && x.body.changes.some((c) => c.card === self && c.kind === "charge" && c.delta === 1)), 'the counter on the card').toBe(true);
  });

  test("{3}, {T}, Sacrifice this artifact: the vocabulary resolves \"~ deals damage equal to the number of charge counters on it to any target.\"", () => {
    const { g, self, no } = armed(2);
    expect(g.state.cards[no]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
