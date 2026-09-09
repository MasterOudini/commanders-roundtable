// `Cathar's Call` - the granted TRIGGER proven end to end (D368): the recipient HAS the
// ability, it FIRES off the recipient, and a permanent outside the scope has nothing.
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CATHARS_CALL_SCRIPT } from './catharsCall';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Cathar's Call";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function mana(g: Game): void {
  for (const sym of ['C', 'W', 'U', 'B', 'R', 'G'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 8 }));
  }
}

function board(): { g: Game; self: InstanceId; host: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Cathar's Call","Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CATHARS_CALL_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Grizzly Bears");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  // ⚠️ CAST the Aura: one moved onto the battlefield by hand is UNATTACHED, and the
  // state-based action bins it before anything can attach it (D269).
  mana(g);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: host }] }));
  settle(g);
  return { g, self, host, no };
}

describe("Cathar's Call", () => {
  test("grants the trigger to Grizzly Bears, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedTriggered).toHaveLength(1);
    expect(d.grantedTriggered[0]?.provider).toBe(self);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedTriggered).toHaveLength(0);
    expect(d.keywords.has("vigilance")).toBe(true);
  });

  test('it FIRES off the recipient and the payload runs', () => {
    const { g, host } = board();
    const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    settle(g);
    expect(Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length).toBeGreaterThan(board0);
    expect(host).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
