// `Relic Bane` - the granted TRIGGER proven end to end (D368): the recipient HAS the
// ability, it FIRES off the recipient, and a permanent outside the scope has nothing.
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { RELIC_BANE_SCRIPT } from './relicBane';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Relic Bane";

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
    decks: [["Relic Bane","Sol Ring"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([RELIC_BANE_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Sol Ring");
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

describe("Relic Bane", () => {
  test("grants the trigger to Sol Ring, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedTriggered).toHaveLength(1);
    expect(d.grantedTriggered[0]?.provider).toBe(self);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedTriggered).toHaveLength(0);
  });

  test('it FIRES off the recipient and the payload runs', () => {
    const { g, host } = board();
    const life0 = g.state.players.p1?.life ?? 0;
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    settle(g);
    expect(g.state.players.p1?.life ?? 0).toBeLessThan(life0);
    expect(host).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
