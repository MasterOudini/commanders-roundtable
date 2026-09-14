// `Cankerbloom` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CANKERBLOOM_SCRIPT } from './cankerbloom';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Cankerbloom";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; lib0: number; vtA0_m0_0: InstanceId; vtA0_m1_0: InstanceId; prolifFodderA0_m2: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Cankerbloom", "Grizzly Bears"], ["Cyclops of One-Eyed Pass", "Sol Ring", "Hissing Miasma"]],
    scripts: createRegistry([CANKERBLOOM_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA0_m0_0 = put(g, 'p2', "Sol Ring");
  const vtA0_m1_0 = put(g, 'p2', "Hissing Miasma");
  const prolifFodderA0_m2 = put(g, 'p1', 'Grizzly Bears');
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: prolifFodderA0_m2, kind: '+1/+1', delta: 1 }));
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  const lib0 = (g.state.zones.library.p1 ?? []).length;
  if (which === 0) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA0_m0_0 }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA0_m1_0 }] }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [2] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, lib0, vtA0_m0_0, vtA0_m1_0, prolifFodderA0_m2 };
}

describe("Cankerbloom", () => {
  test("{1}, Sacrifice this creature: choosing \"Destroy target artifact.\", the vocabulary resolves \"Destroy target artifact.\"", () => {
    const { g, self, vtA0_m0_0 } = armed(0);
    expect(g.state.cards[vtA0_m0_0]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test("{1}, Sacrifice this creature: choosing \"Destroy target enchantment.\", the vocabulary resolves \"Destroy target enchantment.\"", () => {
    const { g, self, vtA0_m1_0 } = armed(1);
    expect(g.state.cards[vtA0_m1_0]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test("{1}, Sacrifice this creature: choosing \"Proliferate.\", the vocabulary resolves \"Proliferate.\"", () => {
    const { g, self, prolifFodderA0_m2 } = armed(2);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'proliferateChoice', 20_000);
    expect(g.state.priority.awaiting?.kind, 'the proliferate ask').toBe('proliferateChoice');
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [prolifFodderA0_m2], players: [] }));
    settle(g);
    expect(g.state.cards[prolifFodderA0_m2]?.counters['+1/+1'], 'the fodder took one more counter').toBe(2);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
