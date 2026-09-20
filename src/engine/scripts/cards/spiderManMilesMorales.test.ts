// `Spider-Man, Miles Morales` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { SPIDER_MAN_MILES_MORALES_SCRIPT } from './spiderManMilesMorales';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Spider-Man, Miles Morales";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; ownC0: number; selfC0: number; ownBear: InstanceId };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([SPIDER_MAN_MILES_MORALES_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Spider-Man, Miles Morales", "Runeclaw Bear"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([SPIDER_MAN_MILES_MORALES_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const ownBear = put(g, 'p1', "Runeclaw Bear");
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
    ownC0 = g.state.cards[ownBear]?.counters["+1/+1"] ?? 0;
    selfC0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    ownC0 = g.state.cards[ownBear]?.counters["+1/+1"] ?? 0;
    selfC0 = g.state.cards[self]?.counters["+1/+1"] ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: self, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, ownC0, selfC0, ownBear };
}

describe("Spider-Man, Miles Morales", () => {
  test("Whenever Spider-Man enters or attacks: the vocabulary resolves \"Put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.\" [etb]", () => {
    const { g, no, ownC0, ownBear } = armed(0);
    expect(g.state.cards[ownBear]?.counters["+1/+1"] ?? 0, "a counter on the witness on your side").toBe(ownC0 + 1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0, "the opponent's creature outside the scope").toBe(0);
    expect(kw(g, ownBear).has("trample"), "gained trample").toBe(true);
  });

  test("Whenever Spider-Man enters or attacks: the vocabulary resolves \"Put a +1/+1 counter on each other creature you control. Those creatures gain trample until end of turn.\" [attacks]", () => {
    const { g, no, ownC0, ownBear } = armed(1);
    expect(g.state.cards[ownBear]?.counters["+1/+1"] ?? 0, "a counter on the witness on your side").toBe(ownC0 + 1);
    expect(g.state.cards[no]?.counters["+1/+1"] ?? 0, "the opponent's creature outside the scope").toBe(0);
    expect(kw(g, ownBear).has("trample"), "gained trample").toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
