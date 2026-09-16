// D469 - THE SHIELD COUNTER (CR 122.1i): "If damage would be dealt to this permanent, prevent that damage and remove a
// shield counter from it. If this permanent would be destroyed, instead remove a shield counter from it." The damage
// half sits in the prevention funnel (one counter per damage EVENT, however many entries hit the permanent); the
// destruction half at the three destroy sites - the targeted destroy, the sweep, the lethal-damage SBA (the damage
// stays marked and the next pass asks again). Proven on the Bears under a manual counter: the Bolt prevented and the
// counter gone, the second Bolt lethal, two blockers' damage one event, Infernal Grasp replaced, Wrath of God replaced
// per member, a counter put after lethal damage spent by the SBA and the creature still dying, the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function shield(g: Game, id: InstanceId, n: number): void {
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: id, kind: 'shield', delta: n }));
}
function mana(g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
}
function shields(g: Game, id: InstanceId): number {
  return g.state.cards[id]?.counters['shield'] ?? 0;
}

function armed(spells: string[]): { g: Game; bears: InstanceId; no: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...spells], ['Cyclops of One-Eyed Pass', 'Grizzly Bears', 'Grizzly Bears']], scripts: SCRIPTS });
  holdEverywhere(g);
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, bears, no };
}
function bolt(g: Game, target: InstanceId): void {
  const card = put(g, 'p1', 'Lightning Bolt', 'hand');
  mana(g, 'R', 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: target }] }));
  settle(g);
}

describe('D469 - the damage half', () => {
  test('a Bolt is prevented whole and the counter spent; the next Bolt is lethal', () => {
    const { g, bears } = armed(['Lightning Bolt', 'Lightning Bolt']);
    shield(g, bears, 1);
    bolt(g, bears);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(0);
    expect(shields(g, bears)).toBe(0);
    expect(g.log.some((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.card === bears && c.kind === 'shield' && c.delta === -1))).toBe(true);
    bolt(g, bears);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('two counters survive two Bolts; a third kills', () => {
    const { g, bears } = armed(['Lightning Bolt', 'Lightning Bolt', 'Lightning Bolt']);
    shield(g, bears, 2);
    bolt(g, bears);
    bolt(g, bears);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(shields(g, bears)).toBe(0);
    bolt(g, bears);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('a double block is ONE damage event: both blockers prevented, one counter spent', () => {
    const { g, bears } = armed([]);
    shield(g, bears, 2);
    const b1 = put(g, 'p2', 'Grizzly Bears');
    const b2 = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: b1, attacker: bears }, { blocker: b2, attacker: bears }] }));
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(0);
    expect(shields(g, bears)).toBe(1);
    // The blockers took the Bears' 2 as usual: one of them is dead, the shield is not theirs.
    expect([b1, b2].filter((id) => g.state.cards[id]?.zone.kind === 'graveyard').length).toBe(1);
  });
});

describe('D469 - the destruction half', () => {
  test('Infernal Grasp: the counter is removed instead, the rest of the spell resolves', () => {
    const { g, bears } = armed(['Infernal Grasp']);
    shield(g, bears, 1);
    const life0 = g.state.players.p1?.life ?? 0;
    const card = put(g, 'p1', 'Infernal Grasp', 'hand');
    mana(g, 'C', 1);
    mana(g, 'B', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(shields(g, bears)).toBe(0);
    expect(g.state.players.p1?.life).toBe(life0 - 2);
  });

  test('Wrath of God: the shielded Bears stays, the unshielded Cyclops dies, the counter spent per member', () => {
    const { g, bears, no } = armed(['Wrath of God']);
    shield(g, bears, 1);
    const card = put(g, 'p1', 'Wrath of God', 'hand');
    mana(g, 'C', 2);
    mana(g, 'W', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(shields(g, bears)).toBe(0);
    expect(g.state.cards[no]?.zone.kind).toBe('graveyard');
  });

  test('lethal damage already marked: the SBA spends the counter instead, asks again, and the creature still dies', () => {
    const g = startedGame({ players: 2, decks: [['Giant Spider', 'Lightning Bolt'], []], scripts: SCRIPTS });
    holdEverywhere(g);
    const cyc = put(g, 'p1', 'Giant Spider');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    bolt(g, cyc);
    expect(g.state.cards[cyc]?.damage).toBe(3);
    shield(g, cyc, 1);
    // A -1/-1 counter makes the marked 3 lethal on the 2/4 Spider: the shield counter goes first, then the creature.
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: cyc, kind: '-1/-1', delta: 1 }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.card === cyc && c.kind === 'shield' && c.delta === -1))).toBe(true);
    expect(g.state.cards[cyc]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bears } = armed(['Lightning Bolt', 'Infernal Grasp']);
    shield(g, bears, 2);
    bolt(g, bears);
    const card = put(g, 'p1', 'Infernal Grasp', 'hand');
    mana(g, 'C', 1);
    mana(g, 'B', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(shields(g, bears)).toBe(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
