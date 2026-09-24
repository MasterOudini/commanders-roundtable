// `Jace, Ingenious Mind-Mage` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { JACE_INGENIOUS_MIND_MAGE_SCRIPT } from './jaceIngeniousMindMage';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Jace, Ingenious Mind-Mage";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; ownBear: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Jace, Ingenious Mind-Mage", "Grizzly Bears", "Runeclaw Bear"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([JACE_INGENIOUS_MIND_MAGE_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownBear = put(g, 'p1', "Runeclaw Bear");
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
  let refused = false;
  if (which === 0) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ownBear], tapped: true }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'loyalty', delta: 5 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, ownBear };
}

describe("Jace, Ingenious Mind-Mage", () => {
  test("+1: a card is drawn", () => {
    const { g, self, hand0, refused } = armed(0);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(6);
  });

  test("+1: the vocabulary resolves \"Untap all creatures you control.\"", () => {
    const { g, self, refused, ownBear } = armed(1);
    expect(g.state.cards[ownBear]?.tapped, 'the witness on your side untapped').toBe(false);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(6);
  });

  test("−9: the vocabulary resolves \"Gain control of up to three target creatures.\"", () => {
    const { g, self, no, board0, refused } = armed(2);
    expect(g.state.cards[no]?.controller, 'taken for good').toBe('p1');
    expect(g.state.cards[no]?.controlledVia, 'for good: nothing to end it').toBeUndefined();
    expect(onBoard(g)).toBe(board0 + 1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
