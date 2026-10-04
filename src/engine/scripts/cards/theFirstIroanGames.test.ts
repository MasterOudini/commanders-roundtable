// `The First Iroan Games` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { THE_FIRST_IROAN_GAMES_SCRIPT } from './theFirstIroanGames';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "The First Iroan Games";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; energy0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; vtL2_chapter_0: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function onBoard(g: Game): number {
  return Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["The First Iroan Games", "Cyclops of One-Eyed Pass", "Colossal Dreadmaw"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([THE_FIRST_IROAN_GAMES_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const vtL2_chapter_0 = put(g, 'p1', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,true,true,true][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (which === 2) {
    // the payload's gate: you control a creature with power 4 or greater
    put(g, 'p1', 'Colossal Dreadmaw');
      settle(g);
  }
  if (which === 1) {
    // D528 - the earlier chapters told before the baseline
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  if (which === 2) {
    // D528 - the earlier chapters told before the baseline
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'lore', delta: 1 }));
    settle(g);
  }
  if (which === 3) {
    // D528 - the earlier chapters told before the baseline
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'lore', delta: 1 }));
    settle(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'lore', delta: 1 }));
    settle(g);
  }
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
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'lore', delta: 1 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: vtL2_chapter_0 }] }));
    settle(g);
    }
  if (which === 2) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'lore', delta: 1 }));
    settle(g);
    }
  if (which === 3) {
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: self, kind: 'lore', delta: 1 }));
    settle(g);
    }
  return { g, self, no, life0, energy0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, vtL2_chapter_0 };
}

describe("The First Iroan Games", () => {
  test("I — Create a 1/1 white Human Soldier creature token.: 1 token made", () => {
    const { g, board0 } = armed(0);
    expect(onBoard(g)).toBe(board0 + 1 + 1);
  });

  test("II — Put three +1/+1 counters on target creature you control.: the vocabulary resolves \"Put three +1/+1 counters on target creature you control.\"", () => {
    const { g, vtL2_chapter_0 } = armed(1);
    expect(g.state.cards[vtL2_chapter_0]?.counters["+1/+1"] ?? 0).toBe(3);
  });

  test("III — If you control a creature with power 4 or greater: the vocabulary resolves \"If you control a creature with power 4 or greater, draw two cards.\"", () => {
    const { g, hand0 } = armed(2);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 2);
  });

  test("IV — Create a Gold token. (It's an artifact with \"Sacrifice this token: Add one mana of any color.\"): 1 token made", () => {
    const { g, board0 } = armed(3);
    expect(onBoard(g)).toBe(board0 + 1 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
