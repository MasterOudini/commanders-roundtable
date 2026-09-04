// D310 - THE CHARACTERISTIC-DEFINING KEYWORDS, in the engine: a changeling
// derives every creature type the database prints (a Sliver lord's "Sliver
// creatures you control" would see it), a devoid card derives no color, the
// catalogue is what the ingest saw, and the games replay.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { derive } from './derive';
import { createRegistry } from './scripts/registry';
import { advanceUntil, deps, holdEverywhere, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function derived(g: Game, id: InstanceId) {
  const d = deps(createRegistry([]));
  return derive(g.state, d.oracle, d.scripts, id);
}

describe('the characteristic-defining keywords (D310)', () => {
  test('the ingest catalogues every creature type it prints', () => {
    const d = deps(createRegistry([]));
    expect(d.oracle.creatureTypes.size).toBeGreaterThan(100);
    for (const t of ['Elf', 'Goblin', 'Sliver', 'Human', 'Dragon', 'Wizard']) expect(d.oracle.creatureTypes.has(t), t).toBe(true);
    expect(d.oracle.creatureTypes.has('Aura')).toBe(false);
    expect(d.oracle.creatureTypes.has('Equipment')).toBe(false);
  });

  test('a changeling is every creature type; its neighbour is not', () => {
    const g = startedGame({ players: 2, decks: [['Woodland Changeling', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const changeling = put(g, 'p1', 'Woodland Changeling');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const c = derived(g, changeling);
    expect(c.typeLine.types).toEqual(['Creature']);
    expect(c.typeLine.subtypes).toContain('Shapeshifter');
    for (const t of ['Elf', 'Goblin', 'Sliver', 'Dragon']) expect(c.typeLine.subtypes, t).toContain(t);
    expect(c.keywords.has('changeling')).toBe(true);
    expect([c.power, c.toughness]).toEqual([2, 2]);
    const b = derived(g, bears);
    expect(b.typeLine.subtypes).toEqual(['Bear']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a flying changeling keeps its own keywords beside the types', () => {
    const g = startedGame({ players: 2, decks: [['Avian Changeling'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const avian = put(g, 'p1', 'Avian Changeling');
    settle(g);
    const c = derived(g, avian);
    expect(c.keywords.has('flying')).toBe(true);
    expect(c.keywords.has('changeling')).toBe(true);
    expect(c.typeLine.subtypes).toContain('Bird');
    expect(c.typeLine.subtypes).toContain('Sliver');
  });

  test('a devoid card is colorless whatever its cost', () => {
    const g = startedGame({ players: 2, decks: [['Vestige of Emrakul'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
    holdEverywhere(g);
    const devastator = put(g, 'p1', 'Vestige of Emrakul');
    settle(g);
    const c = derived(g, devastator);
    expect(c.colors).toEqual([]);
    expect(c.keywords.has('devoid')).toBe(true);
    expect(c.keywords.has('trample')).toBe(true);
    expect([c.power, c.toughness]).toEqual([3, 4]);
  });
});
