// `Eternal Thirst` - the carrier proven end to end (D367/D368) with a D384 payload: the recipient
// HAS the quoted ability, and what the body does it does to the RECIPIENT (CR 113.7a) - the
// self subject the vocabulary learned in D384. A permanent outside the scope has nothing.
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { ETERNAL_THIRST_SCRIPT } from './eternalThirst';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Eternal Thirst";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Enough of every colour for any printed cost in this family; the solver picks. */
function mana(g: Game): void {
  for (const sym of ['C', 'W', 'U', 'B', 'R', 'G'] as const) {
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: 8 }));
  }
}

function board(): { g: Game; self: InstanceId; host: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Eternal Thirst","Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([ETERNAL_THIRST_SCRIPT]),
  });
  holdEverywhere(g);
  const host = put(g, 'p1', "Grizzly Bears");
  const no = put(g, 'p2', "Cyclops of One-Eyed Pass");
  settle(g);
  const self = put(g, 'p1', CARD, 'hand');
  settle(g);
  // p1's third-turn main phase: past summoning sickness (CR 302.6); the holds keep priority.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  // ⚠️ CAST the Aura: one moved onto the battlefield by hand is UNATTACHED, and the
  // state-based action bins it before anything can attach it (D269).
  mana(g);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: self, targets: [{ kind: 'card', id: host }] }));
  settle(g);
  return { g, self, host, no };
}

describe("Eternal Thirst", () => {
  test("grants Whenever a creature an opponent controls dies, put a +1/+1 counter on this creature. to Grizzly Bears, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedTriggered).toHaveLength(1);
    expect(d.grantedTriggered[0]?.provider).toBe(self);
    // The standing negative: a permanent outside the scope has nothing.
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedTriggered).toHaveLength(0);
    expect(d.keywords.has("lifelink")).toBe(true);
  });

  test('it FIRES off the recipient and the body hits the RECIPIENT', () => {
    const { g, host, no } = board();
    // The opponent's creature dies by the Tier-3 tool: a battlefield-to-graveyard move IS
    // the event the head reads, and `looksBack` sees the controller it had (D377).
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: no, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[host]?.counters["+1/+1"] ?? 0).toBeGreaterThan(0);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
