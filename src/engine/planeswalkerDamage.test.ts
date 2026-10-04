// D624 - CR 120.3c: damage dealt to a planeswalker removes that many loyalty counters. Found under the scope words:
// the engine MARKED the damage and the loyalty never moved, so a planeswalker could not be attacked to death. The funnel
// now marks each damage to a planeswalker (`ResolvedDamage.counterLoss`) and the reducer takes the counters, never below
// zero (a count at zero leaves the map), no damage mark on a noncreature. Proven in combat: an unblocked Bears attacking
// a Jace takes two of its three loyalty and marks nothing; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';

describe('D624 - damage to a planeswalker removes loyalty (CR 120.3c)', () => {
  test('an unblocked Bears attacking a Jace takes two loyalty and marks nothing', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears'], ['Jace Beleren']], scripts: createRegistry([]) });
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const jace = put(g, 'p2', 'Jace Beleren');
    expect(g.state.cards[jace]?.counters['loyalty']).toBe(3);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'permanent', id: jace } }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'postcombatMain', 40_000);
    expect(g.state.cards[jace]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[jace]?.counters['loyalty'], 'two of three loyalty taken').toBe(1);
    expect(g.state.cards[jace]?.damage ?? 0, 'no damage marked on a noncreature').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
