// `Krosan Restorer` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { KROSAN_RESTORER_SCRIPT } from './krosanRestorer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Krosan Restorer";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; condRefused: boolean; vtA0_0: InstanceId; vtA1_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Krosan Restorer", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears", "Grizzly Bears"], ["Cyclops of One-Eyed Pass", "Forest", "Forest"]],
    scripts: createRegistry([KROSAN_RESTORER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtA0_0 = put(g, 'p2', "Forest");
  const vtA1_0 = put(g, 'p2', "Forest");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  const cond1_0_0 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const cond1_0_1 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const cond1_0_2 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const cond1_0_3 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const cond1_0_4 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const cond1_0_5 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  const cond1_0_6 = put(g, 'p1', "Grizzly Bears", 'graveyard');
  let condRefused = false;
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
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [vtA0_0], tapped: true }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA0_0 }] }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [self], tapped: false }));
    settle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p2', cards: [vtA1_0], tapped: true }));
    settle(g);
    // D371 - the condition broken: every fixture exiled (the card itself may count), the activation refused, the fixtures back.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_0, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_1, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_2, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_3, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_4, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_5, to: { kind: 'exile', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_6, to: { kind: 'exile', player: 'p1' } }));
    { const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }); condRefused = !early.ok && early.reason === 'timingRestriction'; }
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_0, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_1, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_2, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_3, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_4, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_5, to: { kind: 'graveyard', player: 'p1' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: cond1_0_6, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtA1_0 }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, condRefused, vtA0_0, vtA1_0 };
}

describe("Krosan Restorer", () => {
  test("{T}: the vocabulary resolves \"Untap target land.\"", () => {
    const { g, self, vtA0_0 } = armed(0);
    expect(g.state.cards[vtA0_0]?.tapped).toBe(false);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test("Threshold — {T}: the vocabulary resolves \"Untap up to three target lands.\" - refused unless if there are seven or more cards in your graveyard", () => {
    const { g, self, condRefused, vtA1_0 } = armed(1);
    expect(g.state.cards[vtA1_0]?.tapped).toBe(false);
    expect(condRefused).toBe(true);
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
