// `Tempered Sliver` - the carrier proven end to end (D367/D368) with a D373 payload: the recipient
// HAS the quoted ability, and what the body does it does to the RECIPIENT (CR 113.7a) - the
// self subject the vocabulary learned in D373. A permanent outside the scope has nothing.
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { TEMPERED_SLIVER_SCRIPT } from './temperedSliver';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Tempered Sliver";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; self: InstanceId; host: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Tempered Sliver","Metallic Sliver"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([TEMPERED_SLIVER_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Metallic Sliver");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, self, host, no };
}

describe("Tempered Sliver", () => {
  test("grants Whenever this creature deals combat damage to a player, put a +1/+1 counter on it. to Metallic Sliver, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedTriggered).toHaveLength(1);
    expect(d.grantedTriggered[0]?.provider).toBe(self);
    // The standing negative: a permanent outside the scope has nothing.
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedTriggered).toHaveLength(0);
  });

  test('it FIRES off the recipient and the body hits the RECIPIENT', () => {
    const { g, host } = board();
    advanceUntil(g, (s) => s.turn.phase === 'combat' && s.turn.step === 'declareAttackers' && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: host, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.step === 'postcombatMain' || s.turn.phase === 'postcombatMain', 20_000);
    settle(g);
    expect(g.state.cards[host]?.counters["+1/+1"] ?? 0).toBeGreaterThan(0);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
