// `Ajani, Adversary of Tyrants` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { AJANI_ADVERSARY_OF_TYRANTS_SCRIPT } from './ajaniAdversaryOfTyrants';
import { AJANI_ADVERSARY_OF_TYRANTS_EMBLEM1C97E5B2_SCRIPT } from './ajaniAdversaryOfTyrantsEmblem1c97e5b2';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Ajani, Adversary of Tyrants";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; refused: boolean; vtA1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Ajani, Adversary of Tyrants", "Grizzly Bears", "Walking Corpse"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([AJANI_ADVERSARY_OF_TYRANTS_SCRIPT, AJANI_ADVERSARY_OF_TYRANTS_EMBLEM1C97E5B2_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA1_0 = put(g, 'p1', "Walking Corpse", 'graveyard');
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
  if (which === 0) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA1_0 }] }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'loyalty', delta: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }));
    settle(g);
    { const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 2 }); refused = !again.ok && again.reason === 'timingRestriction'; }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, refused, vtA1_0 };
}

describe("Ajani, Adversary of Tyrants", () => {
  test("+1: the vocabulary resolves \"Put a +1/+1 counter on each of up to two target creatures.\"", () => {
    const { g, self, no, refused } = armed(0);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0).toBe(1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(5);
  });

  test("−2: the vocabulary resolves \"Return target creature card with mana value 2 or less from your graveyard to the battlefield.\"", () => {
    const { g, self, board0, refused, vtA1_0 } = armed(1);
    expect(g.state.cards[vtA1_0]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[vtA1_0]?.controller).toBe('p1');
    expect(onBoard(g)).toBe(board0 + 1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(2);
  });

  test("−7: the vocabulary resolves \"You get an emblem with \\\"At the beginning of your end step, create three 1/1 white Cat creature tokens with lifelink.\\\"\"", () => {
    const { g, self, refused } = armed(2);
    expect((g.state.zones.command.p1 ?? []).filter((c) => g.state.cards[c]?.printingId === "1c97e5b2-a024-4aa7-a9b8-45f441aad138").length, 'the emblem is in the command zone').toBe(1);
    expect(refused).toBe(true);
    expect(g.state.cards[self]?.counters['loyalty'] ?? 0).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
