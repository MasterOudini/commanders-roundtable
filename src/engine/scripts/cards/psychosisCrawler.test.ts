// `Psychosis Crawler` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PSYCHOSIS_CRAWLER_SCRIPT } from './psychosisCrawler';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Psychosis Crawler";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; gy0: number; cda0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([PSYCHOSIS_CRAWLER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Psychosis Crawler"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([PSYCHOSIS_CRAWLER_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority here.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  if (![false,false][which]) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
  }
  const life0 = g.state.players.p1?.life ?? 0;
  const hand0 = (g.state.zones.hand.p1 ?? []).length;
  const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
  const p2life0 = g.state.players.p2?.life ?? 0;
  const gy0 = (g.state.zones.graveyard.p1 ?? []).length;
  let cda0 = 0;
  if (which === 0) {
    cda0 = pt(g, self)[0] ?? 0;
    const top = (g.state.zones.library.p1 ?? [])[0] as InstanceId;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: top, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.step === 'draw', 40_000);
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, gy0, cda0 };
}

describe("Psychosis Crawler", () => {
  test("Psychosis Crawler's power and toughness are each equal to the number of cards in your hand.: its power and toughness follow the count", () => {
    const { g, self, cda0 } = armed(0);
    expect(pt(g, self)).toEqual([cda0 + 1, cda0 + 1]);
  });

  test("Whenever you draw a card: each opponent loses 1 life", () => {
    const { g, p2life0 } = armed(1);
    expect(g.state.players.p2?.life).toBe(p2life0 - 1);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
