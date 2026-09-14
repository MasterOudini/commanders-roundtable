// D437 - THE SPELL'S X: `Blaze deals X damage to any target.`, `Target player draws X cards.`, `Target creature gets
// -X/-X until end of turn.` - a bare X is the spell's announced X (`{X}` in its mana cost, `xValue` on the stack
// object), read as D418's counted sentence with `per: { kind: 'spellX' }` and scaled at resolution. The read is gated
// by the FACE's mana cost: a bare X under a cost without {X} stays unread.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { parseEffects } from '../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function toMyMain(g: Game): void {
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}
/** A game with no scripts at all: the vocabulary runs every spell. */
function game(p1: readonly string[], p2: readonly string[] = []): Game {
  const g = startedGame({ players: 2, decks: [[...p1], [...p2]], scripts: createRegistry([]) });
  settle(g);
  return g;
}
function mana(g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
}

describe("the spell's X (D437)", () => {
  test('a bare X reads as the announced X under a cost that carries {X}, and stays unread under one that does not', () => {
    const blaze = parseEffects('Blaze deals X damage to any target.', 'Blaze', true, undefined, true);
    expect(blaze.mode).toBe('auto');
    expect(blaze.effects.map((e) => [e.kind, e.amount, e.per])).toEqual([['damage', 1, { kind: 'spellX' }]]);
    expect(parseEffects('Blaze deals X damage to any target.', 'Blaze', true).mode).toBe('manual');
    const geyser = parseEffects('Target player draws X cards.', 'Braingeyser', true, undefined, true);
    expect(geyser.effects.map((e) => [e.kind, e.amount, e.targetIndex, e.per?.kind])).toEqual([['draw', 1, 0, 'spellX']]);
    const wind = parseEffects('Target creature gets -X/-X until end of turn.', 'Death Wind', true, undefined, true);
    expect(wind.effects.map((e) => [e.kind, e.power, e.toughness, e.per?.kind])).toEqual([['pump', -1, -1, 'spellX']]);
    // `where X is` keeps its own count; an X/X token stays unread.
    const where = parseEffects('You gain X life, where X is the number of creatures you control.', 'Count', true, undefined, true);
    expect(where.effects.map((e) => e.per?.kind)).toEqual(['permanents']);
    expect(parseEffects('Create an X/X green Ooze creature token.', 'Slime Molding', true, undefined, true).mode).toBe('manual');
  });

  test('Blaze for X = 3 deals 3 to the aimed player; the gate clears between parses', () => {
    const g = game(['Blaze', 'Forest', 'Forest', 'Forest']);
    const blaze = put(g, 'p1', 'Blaze', 'hand');
    toMyMain(g);
    const life0 = g.state.players.p2?.life ?? 0;
    mana(g, 'R', 1);
    mana(g, 'C', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: blaze, xValue: 3, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 3);
    expect(g.state.cards[blaze]?.zone.kind).toBe('graveyard');
  });

  test('Death Wind for X = 2 kills the Bears; for X = 0 it does nothing', () => {
    const g = game(['Death Wind', 'Death Wind'], ['Grizzly Bears']);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const one = put(g, 'p1', 'Death Wind', 'hand');
    const two = put(g, 'p1', 'Death Wind', 'hand');
    toMyMain(g);
    mana(g, 'B', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: one, xValue: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    mana(g, 'B', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: two, xValue: 2, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('Braingeyser for X = 2 draws two for the aimed player; the replay hash', () => {
    const g = game(['Braingeyser', 'Island', 'Island']);
    const geyser = put(g, 'p1', 'Braingeyser', 'hand');
    toMyMain(g);
    const hand2 = (g.state.zones.hand.p2 ?? []).length;
    mana(g, 'U', 2);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: geyser, xValue: 2, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect((g.state.zones.hand.p2 ?? []).length).toBe(hand2 + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('the X stage of a flashback cast (D437)', () => {
  test("Devil's Play flashed back pays {X}{R}{R}{R}, not the printed {X}{R}", () => {
    const g = game(["Devil's Play", 'Mountain', 'Mountain', 'Mountain']);
    const play = put(g, 'p1', "Devil's Play", 'graveyard');
    toMyMain(g);
    const life0 = g.state.players.p2?.life ?? 0;
    // The printed cost with X = 1 would be {1}{R}: the flashback cost is three red more than that.
    mana(g, 'R', 1);
    mana(g, 'C', 1);
    const short = g.submit({ t: 'CastSpell', player: 'p1', card: play, xValue: 1, targets: [{ kind: 'player', id: 'p2' }] });
    expect(short.ok).toBe(false);
    must(g.submit({ t: 'ManualEmptyPool', player: 'p1', target: 'p1' }));
    mana(g, 'R', 3);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: play, xValue: 1, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players.p2?.life).toBe(life0 - 1);
    expect(g.state.cards[play]?.zone.kind).toBe('exile');
  });
});
