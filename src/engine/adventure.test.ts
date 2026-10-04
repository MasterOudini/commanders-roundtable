// D616 - THE ADVENTURE (CR 715.3-715.4): a card cast as its Adventure is exiled as it resolves instead of going to its
// owner's graveyard - "on an adventure" - and the player who cast it may cast the card from there as its creature, never
// as the Adventure again. A countered or fizzled Adventure goes to the graveyard (it never resolved). An OMEN, the same
// two-faced layout, is shuffled into its owner's library as it resolves instead.
//
// ⚠️ WHAT WAS MISSING: the engine offered both faces of an adventurer card (D155) and resolved the Adventure into the
// GRAVEYARD - the creature could never be cast after its Adventure, and an Omen stayed in the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { NO_SCRIPTS } from './scripts/registryCore';
import { advanceUntil, fullControl, holdEverywhere, must, ORACLE, put, startedGame } from './testing/harness';

const TREEFOLK = 'Tuinvale Treefolk // Oaken Boon';
const STORMBROOD = 'Whirlwing Stormbrood // Dynamic Soar';
const FORESTS: string[] = Array.from({ length: 14 }, () => 'Forest');

function forests(g: ReturnType<typeof startedGame>, n: number): void {
  for (let i = 0; i < n; i++) put(g, 'p1', 'Forest');
}

describe('an Adventure goes on an adventure (CR 715.4)', () => {
  test('the fixtures are an Adventure and an Omen', () => {
    expect(ORACLE.byName(TREEFOLK)?.layout).toBe('adventure');
    expect(ORACLE.byName(TREEFOLK)?.faces[1]?.typeLine.subtypes).toContain('Adventure');
    expect(ORACLE.byName(STORMBROOD)?.layout).toBe('adventure');
    expect(ORACLE.byName(STORMBROOD)?.faces[1]?.typeLine.subtypes).toContain('Omen');
  });

  test('the Adventure resolves into exile, and only its caster casts the creature from there - as the creature', () => {
    const g = startedGame({ decks: [[...FORESTS, 'Grizzly Bears', TREEFOLK], ['Forest']] });
    fullControl(g, 'p1');
    forests(g, 10);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const id = put(g, 'p1', TREEFOLK, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 1 }));
    advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
    expect(g.state.cards[id]?.zone.kind).toBe('exile');
    expect(g.state.cards[id]?.onAdventure).toBe('p1');
    const offers = legalActions(g.state, ORACLE, NO_SCRIPTS, 'p1').filter((a) => 'card' in a && a.card === id);
    expect(offers.map((a) => [a.t, 'faceIndex' in a ? a.faceIndex : null])).toEqual([['CastSpell', 0]]);
    expect(legalActions(g.state, ORACLE, NO_SCRIPTS, 'p2').some((a) => 'card' in a && a.card === id)).toBe(false);
    // Never as the Adventure again (CR 715.4).
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 1 }).ok).toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 0 }));
    advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    expect(g.state.cards[id]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[id]?.faceIndex ?? 0).toBe(0);
    expect(g.state.cards[id]?.onAdventure).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a fizzled Adventure goes to the graveyard - it never resolved', () => {
    const g = startedGame({ decks: [[...FORESTS, 'Grizzly Bears', TREEFOLK], ['Forest']] });
    holdEverywhere(g);
    forests(g, 4);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const id = put(g, 'p1', TREEFOLK, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 1 }));
    advanceUntil(g, (s) => s.stack.length === 1, 400);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    expect(g.state.cards[id]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[id]?.onAdventure).toBeUndefined();
    expect(legalActions(g.state, ORACLE, NO_SCRIPTS, 'p1').some((a) => 'card' in a && a.card === id)).toBe(false);
  });

  test('an Omen is shuffled into its owner library as it resolves', () => {
    const g = startedGame({ decks: [[...FORESTS, 'Grizzly Bears', STORMBROOD], ['Forest']] });
    fullControl(g, 'p1');
    forests(g, 3);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const id = put(g, 'p1', STORMBROOD, 'hand');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 1 }));
    advanceUntil(g, (s) => s.cards[id]?.zone.kind !== 'stack' && s.stack.length === 0 && s.pendingTriggers.length === 0, 400);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(3);
    expect(g.state.cards[id]?.zone.kind).toBe('library');
    expect(g.log.some((e) => e.body.t === 'LibraryShuffled' && e.body.player === 'p1')).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
