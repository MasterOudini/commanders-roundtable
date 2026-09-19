// `Sage of the Falls` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SAGE_OF_THE_FALLS_SCRIPT } from './sageOfTheFalls';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Sage of the Falls";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; bears: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Sage of the Falls", "Grizzly Bears", "Crimson Kobolds"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SAGE_OF_THE_FALLS_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
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
  let bears: InstanceId = self;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    }
  if (which === 1) {
    bears = put(g, 'p1', "Crimson Kobolds");
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, bears };
}

describe("Sage of the Falls", () => {
  test("Whenever this creature or another non-Human creature you control enters: the vocabulary resolves \"Draw a card. If you do, discard a card.\" [etb]", () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const dh = [...(g.state.zones.hand.p1 ?? [])];
      expect(dh.length).toBeGreaterThanOrEqual(1);
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: dh.slice(0, 1) }));
      settle(g);
      for (const id of dh.slice(0, 1)) expect(g.state.cards[id]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
      expect((g.state.zones.hand.p1 ?? []).length).toBe(dh.length - 1); }
  });

  test("Whenever this creature or another non-Human creature you control enters: the vocabulary resolves \"Draw a card. If you do, discard a card.\" [anotherCreatureEnters]", () => {
    const { g } = armed(1);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    { const dh = [...(g.state.zones.hand.p1 ?? [])];
      expect(dh.length).toBeGreaterThanOrEqual(1);
      must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: dh.slice(0, 1) }));
      settle(g);
      for (const id of dh.slice(0, 1)) expect(g.state.cards[id]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
      expect((g.state.zones.hand.p1 ?? []).length).toBe(dh.length - 1); }
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
