// D403 - KICKER (CR 702.33): the face reads `Kicker {M}` / `Multikicker {M}` as a cost, the cast
// announces a count (`CastSpell.kicked`) the payment prices, the stack object remembers it, the
// permanent the spell becomes carries it, and `If this spell was kicked, <X>.` runs X only on a
// kicked spell - saying so on an unkicked one.

import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { advanceUntil, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));

describe('kicker (D403)', () => {
  test('the face reads the costs, the Kicker line is claimed, and the kicked clause reads gated', () => {
    const roil = ORACLE.byName('Into the Roil');
    expect(roil?.faces[0]?.kickerCost?.raw).toBe('{1}{U}');
    expect(roil?.faces[0]?.multikickerCost).toBeNull();
    const lizards = ORACLE.byName('Skitter of Lizards');
    expect(lizards?.faces[0]?.multikickerCost?.raw).toBe('{1}{R}');
    expect(lizards?.faces[0]?.kickerCost).toBeNull();
    const p = parseEffects('Return target nonland permanent to its owner\'s hand.\nIf this spell was kicked, draw a card.', 'Into the Roil', true);
    expect(p.mode).toBe('auto');
    expect(p.effects.map((e) => [e.kind, e.targetIndex, e.ifKicked])).toEqual([
      ['bounce', 0, false],
      ['draw', -1, true],
    ]);
    // The `instead` form stays unread: a rewrite of an amount, not a sentence the rules read.
    const instead = parseEffects('This spell deals 2 damage to any target. If this spell was kicked, it deals 4 damage instead.', 'Test Card', true);
    expect(instead.mode).not.toBe('auto');
  });

  test('a kicked cast pays the kicker, remembers it, and runs the kicked clause; an unkicked cast does not', () => {
    const g = startedGame({ players: 2, decks: [['Into the Roil', 'Into the Roil', 'Grizzly Bears'], ['Grizzly Bears']] });
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const roil = put(g, 'p1', 'Into the Roil', 'hand');
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    // Kicked with only the base cost in the pool: refused for the mana, not for the kick.
    mana(g, 'U', 1); mana(g, 'C', 1);
    const short = g.submit({ t: 'CastSpell', player: 'p1', card: roil, targets: [{ kind: 'card', id: bears }], kicked: 1 });
    expect(short.ok, 'two more mana are owed').toBe(false);
    // Kicked twice on a plain kicker: refused by name.
    mana(g, 'U', 1); mana(g, 'C', 1);
    const twice = g.submit({ t: 'CastSpell', player: 'p1', card: roil, targets: [{ kind: 'card', id: bears }], kicked: 2 });
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.message).toMatch(/kicked once/);
    // Kicked once with {1}{U}{1}{U} in the pool: the Bears bounces AND a card is drawn.
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: roil, targets: [{ kind: 'card', id: bears }], kicked: 1 }));
    settle(g);
    expect(g.log.slice(n1).find((e) => e.body.t === 'SpellCast')?.body, 'the stack object remembers the kick').toMatchObject({ obj: { kicked: 1 } });
    expect(g.state.cards[bears]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length, 'the kicked draw').toBe(hand0 - 1 + 1);
    expect(g.state.cards[roil]?.zone.kind).toBe('graveyard');
    // Unkicked: the Bears bounces again and no card is drawn; the narration says the clause did nothing.
    const bearsAgain = put(g, 'p2', 'Grizzly Bears');
    const roil2 = put(g, 'p1', 'Into the Roil', 'hand');
    const hand1 = (g.state.zones.hand.p1 ?? []).length;
    mana(g, 'U', 1); mana(g, 'C', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: roil2, targets: [{ kind: 'card', id: bearsAgain }] }));
    settle(g);
    expect((g.log.slice(n0).find((e) => e.body.t === 'SpellCast')?.body as { obj?: { kicked?: number } }).obj?.kicked).toBeUndefined();
    expect(g.state.cards[bearsAgain]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand.p1 ?? []).length, 'no draw unkicked').toBe(hand1 - 1);
    expect(g.log.slice(n0).some((e) => e.body.t === 'Narrated' && JSON.stringify(e.body).includes('was not kicked')), 'the skipped clause is narrated').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a multikicker announces a count, pays it that many times, and the permanent carries it', () => {
    const g = startedGame({ players: 2, decks: [['Skitter of Lizards', 'Grizzly Bears'], ['Grizzly Bears']] });
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const lizards = put(g, 'p1', 'Skitter of Lizards', 'hand');
    // {R} + 2 x {1}{R}: five mana for a double kick.
    mana(g, 'R', 3); mana(g, 'C', 2);
    const short = g.submit({ t: 'CastSpell', player: 'p1', card: lizards, kicked: 3 });
    expect(short.ok, 'a third kick is two more mana').toBe(false);
    const n2 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: lizards, kicked: 2 }));
    settle(g);
    expect(g.log.slice(n2).find((e) => e.body.t === 'SpellCast')?.body).toMatchObject({ obj: { kicked: 2 } });
    expect(g.state.cards[lizards]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[lizards]?.kicked, 'the permanent remembers its kicks').toBe(2);
    expect(Object.values(g.state.players.p1?.pool ?? {}).every((v) => v === 0 || v === undefined), 'the pool is spent').toBe(true);
    // A permanent that enters any other way carries no kick.
    const bears = put(g, 'p1', 'Grizzly Bears');
    expect(g.state.cards[bears]?.kicked).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
