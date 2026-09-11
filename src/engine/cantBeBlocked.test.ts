// D399 - "can't be blocked this turn" (CR 509.1b's OTHER side, with an END): the vocabulary's
// `cantBeBlocked` puts an until-end-of-turn entry on the creature, `canBlock` refuses every block of
// it while the entry stands, and the cleanup step clears it with the pumps and the grants. D394's
// `cantBlock` one side of the block over. With D392's referent the Stealth Mission text reads, with
// D373's SELF subject the activated "This creature can't be blocked this turn" reads, and the printed
// rider "gets +1/+0 until end of turn and can't be blocked this turn" rides the pump's own entry.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

describe("the can't-be-blocked vocabulary (D399)", () => {
  test('the sentence is read alone, on the self, after a counter through the referent, and as a pump rider', () => {
    const one = parseEffects("Target creature can't be blocked this turn.", 'Test Card', true);
    expect(one.mode).toBe('auto');
    expect(one.effects.map((e) => [e.kind, e.targetIndex, e.self])).toEqual([['cantBeBlocked', 0, false]]);
    const self = parseEffects("This creature can't be blocked this turn.", 'Test Card', true);
    expect(self.mode).toBe('auto');
    expect(self.effects.map((e) => [e.kind, e.targetIndex, e.self])).toEqual([['cantBeBlocked', -1, true]]);
    const mission = parseEffects("Put two +1/+1 counters on target creature you control. That creature can't be blocked this turn.", 'Stealth Mission', true);
    expect(mission.mode).toBe('auto');
    expect(mission.effects.map((e) => [e.kind, e.targetIndex, e.referent ?? false])).toEqual([
      ['putCounters', 0, false],
      ['cantBeBlocked', 0, true],
    ]);
    const rider = parseEffects("This creature gets +1/+0 until end of turn and can't be blocked this turn.", 'Test Card', true);
    expect(rider.mode).toBe('auto');
    expect(rider.effects.map((e) => [e.kind, e.power, e.toughness, e.cantBeBlocked, e.self])).toEqual([['pump', 1, 0, true, true]]);
    const targetRider = parseEffects("Target creature gets +2/+2 until end of turn and can't be blocked this turn.", 'Test Card', true);
    expect(targetRider.mode).toBe('auto');
    expect(targetRider.effects.map((e) => [e.kind, e.power, e.toughness, e.cantBeBlocked, e.targetIndex])).toEqual([['pump', 2, 2, true, 0]]);
    const upTo = parseEffects("Up to two target creatures can't be blocked this turn.", 'Test Card', true);
    expect(upTo.mode).toBe('auto');
    expect(upTo.effects[0]?.optional).toBe(true);
  });

  test('the predicate form and the scoped form stay unread', () => {
    expect(parseEffects("Target creature can't be blocked by creatures with power 2 or less this turn.", 'Test Card', true).mode).not.toBe('auto');
    expect(parseEffects("Creatures you control can't be blocked this turn.", 'Test Card', true).mode).not.toBe('auto');
  });
});

describe("can't be blocked in play (D399)", () => {
  test('an infiltrating creature cannot be blocked this turn, is blockable two turns on, and the game replays', () => {
    const g = startedGame({ players: 2, decks: [['Infiltrate', 'Grizzly Bears'], ['Colossal Dreadmaw', 'Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    const wall = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const infiltrate = put(g, 'p1', 'Infiltrate', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: infiltrate, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.untilEndOfTurn.some((m) => m.card === bears && m.cantBeBlocked === true), 'the evasion is remembered').toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    // The engine asks nobody when no legal block exists (D232/D234): the prompt is skipped and the
    // Bears connects, though both of p2's creatures could block it a turn ago and can two turns on.
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life, 'the unblockable Bears connected').toBe(38);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 3, 20_000);
    expect(g.state.untilEndOfTurn.some((m) => m.cantBeBlocked === true), 'cleanup cleared it').toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 4 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.state.priority.awaiting?.kind, 'the block is offered again').toBe('declareBlockers');
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: wall, attacker: bears }] }));
    expect(g.state.cards[dreadmaw]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a block declared against an unblockable attacker is refused by name while another attacker may be blocked', () => {
    const g = startedGame({ players: 2, decks: [['Infiltrate', 'Grizzly Bears', 'Grizzly Bears'], ['Colossal Dreadmaw']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const bears2 = put(g, 'p1', 'Grizzly Bears');
    expect(bears2).not.toBe(bears);
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const infiltrate = put(g, 'p1', 'Infiltrate', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: infiltrate, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }, { card: bears2, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('declareBlockers');
    const refused = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: dreadmaw, attacker: bears }] });
    expect(refused.ok, 'the unblockable attacker is refused a blocker').toBe(false);
    expect(JSON.stringify(refused)).toMatch(/can't be blocked this turn/);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: dreadmaw, attacker: bears2 }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    expect(g.state.players.p2?.life, 'only the unblockable one connected').toBe(38);
    expect(g.state.cards[bears2]?.zone.kind, 'the blocked Bears died to the Dreadmaw').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
