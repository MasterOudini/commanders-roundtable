// D309 - THE MORPH SEAM, in the engine: a morph creature cast face down for {3}
// is a nameless colorless 2/2 with no abilities; turned face up for its morph
// cost it is itself again (a megamorph with a +1/+1 counter); a face-down spell
// countered reaches the graveyard face up; the special action is refused
// without priority, without the mana, on a face-up permanent; the game replays.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { derive } from './derive';
import { createRegistry } from './scripts/registry';
import { legalActions } from './legal';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function main3(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

function chars(g: Game, id: InstanceId): { name: string; power: number | null; toughness: number | null; colors: readonly string[]; types: readonly string[]; keywords: string[]; hasAbilities: boolean } {
  const d = deps(createRegistry([]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { name: got.name, power: got.power, toughness: got.toughness, colors: got.colors, types: got.typeLine.types, keywords: [...got.keywords], hasAbilities: got.hasAbilities };
}

function mana(g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
}

function armed(name: string): { g: Game; card: InstanceId } {
  const g = startedGame({ players: 2, decks: [[name], ['Cyclops of One-Eyed Pass', 'Counterspell']], scripts: createRegistry([]) });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const card = put(g, 'p1', name, 'hand');
  main3(g);
  return { g, card };
}

function castFaceDown(g: Game, card: InstanceId): void {
  mana(g, 'C', 3);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, faceDown: true, targets: [] }));
}

describe('the morph seam (D309)', () => {
  test('cast face down for {3}: a nameless colorless 2/2 creature with no abilities', () => {
    const { g, card } = armed('Battering Craghorn');
    const offers = legalActions(g.state, deps(createRegistry([])).oracle, deps(createRegistry([])).scripts, 'p1');
    expect(offers.some((a) => a.t === 'CastSpell' && a.card === card && a.faceDown === true)).toBe(true);
    castFaceDown(g, card);
    settle(g);
    const inst = g.state.cards[card];
    expect(inst?.zone.kind).toBe('battlefield');
    expect(inst?.faceDown).toBe(true);
    const c = chars(g, card);
    expect(c.name).toBe('');
    expect([c.power, c.toughness]).toEqual([2, 2]);
    expect(c.colors).toEqual([]);
    expect(c.types).toEqual(['Creature']);
    expect(c.keywords).toEqual([]);
    expect(c.hasAbilities).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('turned face up for its morph cost it is itself again, first strike and all', () => {
    const { g, card } = armed('Battering Craghorn');
    castFaceDown(g, card);
    settle(g);
    const d = deps(createRegistry([]));
    const offer = legalActions(g.state, d.oracle, d.scripts, 'p1').find((a) => a.t === 'TurnFaceUp' && a.card === card);
    expect(offer).toBeDefined();
    expect(offer && offer.t === 'TurnFaceUp' ? offer.costText : '').toBe('{1}{R}{R}');
    mana(g, 'R', 2);
    mana(g, 'C', 1);
    must(g.submit({ t: 'TurnFaceUp', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.faceDown).toBe(false);
    const c = chars(g, card);
    expect(c.name).toBe('Battering Craghorn');
    expect([c.power, c.toughness]).toEqual([3, 1]);
    expect(c.colors).toEqual(['R']);
    expect(c.keywords).toContain('firstStrike');
    expect(c.hasAbilities).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a megamorph turns face up with a +1/+1 counter', () => {
    const { g, card } = armed('Aerie Bowmasters');
    castFaceDown(g, card);
    settle(g);
    mana(g, 'G', 1);
    mana(g, 'C', 5);
    must(g.submit({ t: 'TurnFaceUp', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.counters['+1/+1'] ?? 0).toBe(1);
    const c = chars(g, card);
    expect(c.name).toBe('Aerie Bowmasters');
    expect([c.power, c.toughness]).toEqual([4, 5]);
    expect(c.keywords).toContain('reach');
  });

  test('the special action is refused on a face-up permanent, without the mana, and by the other player', () => {
    const { g, card } = armed('Woolly Loxodon');
    castFaceDown(g, card);
    settle(g);
    expect(g.submit({ t: 'TurnFaceUp', player: 'p1', card }).ok).toBe(false);
    expect(g.submit({ t: 'TurnFaceUp', player: 'p2', card }).ok).toBe(false);
    mana(g, 'G', 1);
    mana(g, 'C', 5);
    must(g.submit({ t: 'TurnFaceUp', player: 'p1', card }));
    expect(g.submit({ t: 'TurnFaceUp', player: 'p1', card }).ok).toBe(false);
    expect(chars(g, card).name).toBe('Woolly Loxodon');
  });

  test('a face-down spell countered reaches the graveyard face up', () => {
    const { g, card } = armed('Glacial Stalker');
    const counter = put(g, 'p2', 'Counterspell', 'hand');
    castFaceDown(g, card);
    advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 1, 20_000);
    const spell = g.state.stack[0];
    expect(spell?.faceDown).toBe(true);
    expect(spell?.label).toBe('a face-down creature');
    must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p2', card: counter, targets: [{ kind: 'stack', id: spell?.id ?? '' }] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[card]?.faceDown).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a face-down spell on the stack is a creature spell, nameless and colorless', () => {
    const { g, card } = armed('Glacial Stalker');
    castFaceDown(g, card);
    advanceUntil(g, (s) => s.stack.length === 1, 20_000);
    const c = chars(g, card);
    expect(c.name).toBe('');
    expect(c.types).toEqual(['Creature']);
    expect(c.colors).toEqual([]);
  });

  test('a face-down cast is refused at instant speed and from the graveyard', () => {
    const { g, card } = armed('Woolly Loxodon');
    advanceUntil(g, (s) => s.turn.turnNumber === 4 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    mana(g, 'C', 3);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card, faceDown: true, targets: [] }).ok).toBe(false);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.turn.turnNumber === 5 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    mana(g, 'C', 3);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card, faceDown: true, targets: [] }).ok).toBe(false);
  });
});
