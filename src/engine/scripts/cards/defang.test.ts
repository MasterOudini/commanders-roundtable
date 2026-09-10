// `Defang` - the continuous prevention effect proven both ways (D385): the damage the line
// covers never arrives and nothing is spent; damage outside the line lands. Generated from one row.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DEFANG_SCRIPT } from './defang';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Defang";

type Armed = { g: Game; self: InstanceId; no: InstanceId; bears: InstanceId; life0: number; p2life0: number };

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function mana(g: Game, player: 'p1' | 'p2', symbols: readonly string[]): void {
  for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: s as 'W', amount: 1 }));
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
    decks: [["Defang", "Grizzly Bears", "Spark Spray"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DEFANG_SCRIPT]),
  });
  holdEverywhere(g);
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  const bears = put(g, 'p1', "Grizzly Bears");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  // CAST the Aura (D269): one moved onto the battlefield by hand is unattached and binned.
  for (const sym of ['C', 'W', 'U', 'B', 'R', 'G'] as const) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: no }] }));
  settle(g);
  const life0 = g.state.players.p1?.life ?? 0;
  const p2life0 = g.state.players.p2?.life ?? 0;
  return { g, self, no, bears, life0, p2life0 };
}

describe("Defang", () => {
  test("the unblocked attack is prevented, and nothing is spent", () => {
    const a = armed();
    advanceUntil(a.g, (s) => s.turn.turnNumber === 4 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(a.g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: a.no, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(a.g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(a.g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [] }));
    advanceUntil(a.g, (s) => s.turn.turnNumber === 4 && s.turn.phase === 'postcombatMain', 20_000);
    expect(a.g.state.players.p1?.life).toBe(a.life0);
  });

  test("a Spark Spray is outside the line and lands", () => {
    const a = armed();
    spray(a.g, "p1", a.no);
    expect(landed(a.g, a.no)).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
