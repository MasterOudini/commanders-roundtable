// `Statecraft` - the continuous prevention effect proven both ways (D385): the damage the line
// covers never arrives and nothing is spent; damage outside the line lands. Generated from one row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { STATECRAFT_SCRIPT } from './statecraft';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Statecraft";

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
    decks: [["Statecraft", "Grizzly Bears", "Spark Spray"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([STATECRAFT_SCRIPT]),
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

describe("Statecraft", () => {
  test("combat damage from the blocking Cyclops is prevented, and nothing is spent", () => {
    const a = armed();
    advanceUntil(a.g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(a.g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: a.bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(a.g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(a.g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: a.no, attacker: a.bears }] }));
    advanceUntil(a.g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain', 20_000);
    expect(dmg(a.g, a.bears)).toBe(0);
    expect(a.g.state.cards[a.bears]?.zone.kind).toBe('battlefield');
    expect(dmg(a.g, a.no)).toBe(0);
  });

  test("a Spark Spray is outside the line and lands", () => {
    const a = armed();
    spray(a.g, "p1", a.bears);
    expect(landed(a.g, a.bears)).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
