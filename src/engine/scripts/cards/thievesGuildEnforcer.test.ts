// `Thieves' Guild Enforcer` - every printed ability proven in its own game: the cost's mark, the pump
// (or the token, the card, the life, the tap, the bounce), the end at cleanup, the replay
// hash (D301). Generated from one table row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { THIEVES_GUILD_ENFORCER_SCRIPT } from './thievesGuildEnforcer';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Thieves' Guild Enforcer";

type Armed = { g: Game; self: InstanceId; no: InstanceId; life0: number; hand0: number; board0: number; p2life0: number; p2hand0: number; gy0: number; p2gy0: number; lib0: number; bears: InstanceId; condOff: boolean };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([THIEVES_GUILD_ENFORCER_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([THIEVES_GUILD_ENFORCER_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function armed(which: number): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Thieves' Guild Enforcer", "Grizzly Bears", "Triton Shorethief"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([THIEVES_GUILD_ENFORCER_SCRIPT]),
    options: { maxHandSize: null },
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  if (![true,null,null][which]) {
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
  let condOff = false;
  if (which === 0) {
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    }
  if (which === 1) {
    bears = put(g, 'p1', "Triton Shorethief");
    hand0 = (g.state.zones.hand.p1 ?? []).length;
    settle(g);
    }
  if (which === 2) {
    condOff = pt(g, self)[0] === 1 && pt(g, self)[1] === 1 && !kw(g, self).has("deathtouch");
    // D398 - stage two: the condition is met.
    for (let i = 0; i < 8; i++) {
      const top = (g.state.zones.library.p2 ?? [])[0] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: top, to: { kind: 'graveyard', player: 'p2' } }));
    }
    settle(g);
    }
  return { g, self, no, life0, hand0, board0, p2life0, p2hand0, gy0, p2gy0, lib0, bears, condOff };
}

describe("Thieves' Guild Enforcer", () => {
  test("Whenever this creature or another Rogue you control enters: the vocabulary resolves \"Each opponent mills two cards.\" [etb]", () => {
    const { g, p2gy0 } = armed(0);
    expect((g.state.zones.graveyard.p2 ?? []).length).toBe(p2gy0 + 2);
  });

  test("Whenever this creature or another Rogue you control enters: the vocabulary resolves \"Each opponent mills two cards.\" [anotherCreatureEnters]", () => {
    const { g, p2gy0 } = armed(1);
    expect((g.state.zones.graveyard.p2 ?? []).length).toBe(p2gy0 + 2);
  });

  test("`Thieves' Guild Enforcer` - as long as an opponent has eight or more cards in their graveyard: absent while it is unmet, read once it holds", () => {
    const { g, self, condOff } = armed(2);
    expect(pt(g, self)).toEqual([3, 2]);
    expect(kw(g, self).has("deathtouch")).toBe(true);
    expect(condOff, 'the static is absent while the condition is unmet').toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
