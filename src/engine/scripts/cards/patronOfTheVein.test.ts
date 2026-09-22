// `Patron of the Vein` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { PATRON_OF_THE_VEIN_SCRIPT } from './patronOfTheVein';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Patron of the Vein";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; ownC0: number; selfC0: number; vtL1_etb_0: InstanceId; ownVampire: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Patron of the Vein", "Falkenrath Pit Fighter"], ["Cyclops of One-Eyed Pass", "Grizzly Bears"]],
    scripts: createRegistry([PATRON_OF_THE_VEIN_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL1_etb_0 = put(g, 'p2', "Grizzly Bears");
  const ownVampire = put(g, 'p1', "Falkenrath Pit Fighter");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_etb_0 }] }));
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
  let ownC0 = 0;
  let selfC0 = 0;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL1_etb_0 }] }));
    settle(g);
    }
  if (which === 1) {
    ownC0 = g.state.cards[ownVampire]?.counters["+1/+1"] ?? 0;
    selfC0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: no, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, ownC0, selfC0, vtL1_etb_0, ownVampire };
}

describe("Patron of the Vein", () => {
  test("When this creature enters: the vocabulary resolves \"Destroy target creature an opponent controls.\"", () => {
    const { g, vtL1_etb_0 } = armed(0);
    expect(g.state.cards[vtL1_etb_0]?.zone.kind).toBe('exile');
  });

  test("Whenever a creature an opponent controls dies: the vocabulary resolves \"Exile target creature and put a +1/+1 counter on each Vampire you control.\"", () => {
    const { g, no, ownC0, ownVampire } = armed(1);
    expect(g.state.cards[no]?.zone.kind).toBe('exile');
    expect(g.state.cards[ownVampire]?.counters["+1/+1"] ?? 0, "a counter on the witness on your side").toBe(ownC0 + 1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0, "the opponent's creature outside the scope").toBe(0);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
