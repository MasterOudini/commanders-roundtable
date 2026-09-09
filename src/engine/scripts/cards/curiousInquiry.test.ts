// `Curious Inquiry` - the carrier proven end to end (D367/D368) with a D373 payload: the recipient
// HAS the quoted ability, and what the body does it does to the RECIPIENT (CR 113.7a) - the
// self subject the vocabulary learned in D373. A permanent outside the scope has nothing.
// Generated from one table row.

import { describe, expect, test } from 'vitest';
import { derive } from '../../derive';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registryCore';
import { CURIOUS_INQUIRY_SCRIPT } from './curiousInquiry';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = "Curious Inquiry";

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
    decks: [["Curious Inquiry","Grizzly Bears"], ["Cyclops of One-Eyed Pass"]],
    scripts: createRegistry([CURIOUS_INQUIRY_SCRIPT]),
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

describe("Curious Inquiry", () => {
  test("grants Whenever this creature deals combat damage to a player, investigate. to Grizzly Bears, and to nothing outside the scope", () => {
    const { g, self, host, no } = board();
    const d = derive(g.state, g.deps.oracle, g.deps.scripts, host);
    expect(d.grantedTriggered).toHaveLength(1);
    expect(d.grantedTriggered[0]?.provider).toBe(self);
    // The standing negative: a permanent outside the scope has nothing.
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, no).grantedTriggered).toHaveLength(0);
    // The same printed line's P/T bonus, on the same recipient.
    expect([d.power, d.toughness]).toEqual([3, 3]);
  });

  test('it FIRES off the recipient and the body hits the RECIPIENT', () => {
    const { g, host } = board();
    const board0 = Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length;
    advanceUntil(g, (s) => s.turn.phase === 'combat' && s.turn.step === 'declareAttackers' && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: host, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.step === 'postcombatMain' || s.turn.phase === 'postcombatMain', 20_000);
    settle(g);
    expect(Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1').length).toBeGreaterThan(board0);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
