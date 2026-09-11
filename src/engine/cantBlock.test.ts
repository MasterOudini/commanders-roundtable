// D394 - "can't block this turn" (CR 509.1b with an END): the vocabulary's `cantBlock` puts an
// until-end-of-turn entry on the creature, `canBlock` refuses the block while it stands, and the
// cleanup step clears it with the pumps and the grants. With D392's referent the Mugging text and
// the counted plural ("Those creatures can't block this turn.") read by the vocabulary.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { parseTargetClauses } from '../data/targetParse';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}

describe("the can't-block vocabulary (D394)", () => {
  test('the sentence is read alone, after damage through the referent, and counted through the plural referent', () => {
    const one = parseEffects("Target creature can't block this turn.", 'Test Card', true);
    expect(one.mode).toBe('auto');
    expect(one.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['cantBlock', 0]]);
    const mugging = parseEffects("~ deals 2 damage to target creature. That creature can't block this turn.", 'Mugging', true);
    expect(mugging.mode).toBe('auto');
    expect(mugging.effects.map((e) => [e.kind, e.targetIndex, e.referent ?? false])).toEqual([
      ['damage', 0, false],
      ['cantBlock', 0, true],
    ]);
    const panic = parseEffects("Up to three target creatures can't block this turn.", 'Panic Attack', true);
    expect(panic.mode).toBe('auto');
    expect(panic.effects[0]?.optional).toBe(true);
    const wrap = "~ deals 1 damage to each of up to three target creatures. Those creatures can't block this turn.";
    const w = parseEffects(wrap, 'Wrap in Flames', true);
    expect(w.mode).toBe('auto');
    expect(w.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['damage', 0], ['cantBlock', 0]]);
    expect(parseTargetClauses(wrap)).toHaveLength(1);
  });

  test('the scoped form stays unread', () => {
    expect(parseEffects("Creatures without flying can't block this turn.", 'Falter', true).mode).not.toBe('auto');
  });
});

describe("can't block in play (D394)", () => {
  test('a mugged creature cannot block this turn, blocks next turn, and the game replays', () => {
    // p2 keeps a SECOND creature that may block: with the mugged one alone the engine declares
    // no blockers itself and never asks (a restricted-only board is a prompt with nothing in it).
    const g = startedGame({ players: 2, decks: [['Mugging', 'Grizzly Bears'], ['Colossal Dreadmaw', 'Grizzly Bears']] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const dreadmaw = put(g, 'p2', 'Colossal Dreadmaw');
    const wall = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    // p1's Bears is past summoning sickness by its next turn; mug the Dreadmaw on that turn.
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const mugging = put(g, 'p1', 'Mugging', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mugging, targets: [{ kind: 'card', id: dreadmaw }] }));
    settle(g);
    expect(g.state.cards[dreadmaw]?.damage, 'the damage landed').toBe(2);
    expect(g.state.untilEndOfTurn.some((m) => m.card === dreadmaw && m.cantBlock === true), 'the restriction is remembered').toBe(true);
    // Attack with the Bears; the Dreadmaw may not block.
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('declareBlockers');
    const refused = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: dreadmaw, attacker: bears }] });
    expect(refused.ok, 'the mugged creature is refused as a blocker').toBe(false);
    expect(JSON.stringify(refused)).toMatch(/can't block this turn/);
    // The unrestricted creature blocks as it always could.
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: wall, attacker: bears }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 3, 20_000);
    // Cleanup cleared it: no entry remains.
    expect(g.state.untilEndOfTurn.some((m) => m.cantBlock === true)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
