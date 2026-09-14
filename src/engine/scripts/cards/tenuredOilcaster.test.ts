// `Tenured Oilcaster` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { TENURED_OILCASTER_SCRIPT } from './tenuredOilcaster';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Tenured Oilcaster";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; condOff: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([TENURED_OILCASTER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Tenured Oilcaster"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([TENURED_OILCASTER_SCRIPT]),
  });
  holdEverywhere(g);
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
  let condOff = false;
  if (which === 0) {
    condOff = pt(g, self)[0] === 2 && pt(g, self)[1] === 4;
    // D398 - stage two: the condition is met.
    for (let i = 0; i < 8; i++) {
      const top = (g.state.zones.library.p2 ?? [])[0] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: top, to: { kind: 'graveyard', player: 'p2' } }));
    }
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  if (which === 2) {
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: self, attacker: no }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, condOff };
}

describe("Tenured Oilcaster", () => {
  test("`Tenured Oilcaster` - as long as an opponent has eight or more cards in their graveyard: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(0);
    expect(pt(g, self)).toEqual([5, 4]);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test("Whenever this creature attacks or blocks: the vocabulary resolves \"Each player mills a card.\" [attacks]", () => {
    const { g, gy0, p2gy0 } = armed(1);
    expect((g.state.zones.graveyard.p1 ?? []).length).toBe(gy0 + 1);
    expect((g.state.zones.graveyard.p2 ?? []).length).toBe(p2gy0 + 1);
  });

  test("Whenever this creature attacks or blocks: the vocabulary resolves \"Each player mills a card.\" [blocks]", () => {
    const { g, gy0, p2gy0 } = armed(2);
    expect((g.state.zones.graveyard.p1 ?? []).length).toBe(gy0 + 1);
    expect((g.state.zones.graveyard.p2 ?? []).length).toBe(p2gy0 + 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
