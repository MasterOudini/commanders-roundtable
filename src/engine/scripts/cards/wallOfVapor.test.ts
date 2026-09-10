// `Wall of Vapor` - the continuous prevention effect proven both ways (D385): the damage the line
// covers never arrives and nothing is spent; damage outside the line lands. Generated from one row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { WALL_OF_VAPOR_SCRIPT } from './wallOfVapor';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Wall of Vapor";

type Armed = { g: Game; self: InstanceId; no: InstanceId; bears: InstanceId; life0: number; p2life0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function mana(g: Game, player: 'p1' | 'p2', symbols: readonly string[]): void {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: s as 'W', amount: 1 }));
}
function dmg(g: Game, id: InstanceId): number {
  return g.state.cards[id]?.damage ?? -1;
}
/** Damage that LANDED: a mark on the card, or the card dead of it. */
function landed(g: Game, id: InstanceId): boolean {
  const c = g.state.cards[id];
  return c === undefined || c.zone.kind === 'graveyard' || c.damage > 0;
}
function spray(g: Game, player: 'p1' | 'p2', target: InstanceId): void {
  // An instant of the OPPONENT's is cast only when the opponent holds priority: pass to them first.
  if (player === 'p2') advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
  const s = put(g, player, 'Spark Spray', 'hand');
  mana(g, player, ['R']);
  must(g.submit({ t: 'CastSpell', player, card: s, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

function armed(): Armed {
  const g = startedGame({
    players: 2,
    decks: [["Wall of Vapor", "Grizzly Bears", "Spark Spray"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([WALL_OF_VAPOR_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bears = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const life0 = g.state.players.p1?.life ?? 0;
  const p2life0 = g.state.players.p2?.life ?? 0;
  return { g, self, no, bears, life0, p2life0 };
}

describe("Wall of Vapor", () => {
  test("combat damage from the attacking Cyclops is prevented, and nothing is spent", () => {
    const a = armed();
    advanceUntil(a.g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(a.g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: a.no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(a.g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(a.g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: a.self, attacker: a.no }] }));
    advanceUntil(a.g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 20_000);
    expect(dmg(a.g, a.self)).toBe(0);
    expect(a.g.state.cards[a.self]?.zone.kind).toBe('battlefield');
  });

  test("a Spark Spray is outside the line and lands", () => {
    const a = armed();
    spray(a.g, "p1", a.self);
    expect(landed(a.g, a.self)).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
