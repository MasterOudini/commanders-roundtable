// `Diamond Pick-Axe` - the granted TRIGGER proven end to end (D368): the recipient HAS the
// ability, it FIRES off the recipient, and a permanent outside the scope has nothing.
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { DIAMOND_PICK_AXE_SCRIPT } from './diamondPickAxe';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Diamond Pick-Axe";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; self: InstanceId; host: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Diamond Pick-Axe","Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([DIAMOND_PICK_AXE_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Grizzly Bears");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualAttach', player: 'p1', card: self, to: host }));
  settle(g);
  return { g, self, host, no };
}

describe("Diamond Pick-Axe", () => {
  test("grants the trigger to Grizzly Bears, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedTriggered).toHaveLength(1);
    expect(d.grantedTriggered[0]?.provider).toBe(self);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedTriggered).toHaveLength(0);
    expect([d.power, d.toughness]).toEqual([3, 3]);
  });

  test('it FIRES off the recipient and the payload runs', () => {
    const { g, host } = board();
    const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
    advanceUntil(g, (s) => s.turn.phase === 'combat' && s.turn.step === 'declareAttackers' && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: host, defender: { kind: 'player', id: 'p2' } }] }));
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
