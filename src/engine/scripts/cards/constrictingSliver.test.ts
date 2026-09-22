// `Constricting Sliver` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CONSTRICTING_SLIVER_SCRIPT } from './constrictingSliver';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Constricting Sliver";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; yes: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([CONSTRICTING_SLIVER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Constricting Sliver", "Metallic Sliver"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CONSTRICTING_SLIVER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', "Metallic Sliver");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
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
  if (which === 0) {
    settle(g);
    }
  if (which === 1) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: yes, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: yes, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'optionalTrigger', 20_000);
    const ask = g.state.priority.awaiting;
    must(g.submit({ t: 'AnswerOptionalTrigger', player: 'p1', stackId: ask && ask.kind === 'optionalTrigger' ? ask.stackId : '', accept: true }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, yes };
}

describe("Constricting Sliver", () => {
  test("Sliver creatures you control have \"When this creature enters, you may exile target creature an opponent controls until this creature leaves the battlefield.\": only the Sliver reads it", () => {
    const { g, no } = armed(0);
    expect(pt(g, no)).toEqual([5, 2]);
  });

  test("Sliver creatures you control have \"When this creature enters: the vocabulary resolves \"Exile target creature an opponent controls until ~ leaves the battlefield.\" [etb]", () => {
    const { g, no, yes } = armed(1);
    expect(g.state.cards[no]?.zone.kind).toBe('exile');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: yes, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[no]?.zone.kind, 'the linked exile ends when the permanent leaves (CR 610.3c)').toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
