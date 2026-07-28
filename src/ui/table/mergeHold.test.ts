import { describe, expect, it } from 'vitest';
import { mergedAwayPiles, refreshTapState, sameCards } from './mergeHold';
import type { PackItem } from './packRow';

// The three decisions the hold rests on, each tested for what it must NOT do as
// much as for what it must: hold nothing when a card actually left, hold nothing
// when the board changed under it, and never let a held shape carry stale facts.

function pile(id: string, members: string[], tapped: boolean): PackItem {
  return {
    instanceId: id,
    members,
    untapped: tapped ? 0 : members.length,
    tapped,
    attachments: [],
    cluster: 'land',
  };
}

describe('mergedAwayPiles', () => {
  it('finds a tapped pile that has been absorbed by another', () => {
    const prev = [pile('f1', ['f1', 'f2', 'f3'], false), pile('f4', ['f4', 'f5'], true)];
    const next = [pile('f1', ['f1', 'f2', 'f3', 'f4', 'f5'], false)];
    expect(mergedAwayPiles(prev, next)).toEqual(['f4']);
  });

  it('says nothing about a pile that still has its own slot', () => {
    const prev = [pile('f1', ['f1'], false), pile('f2', ['f2'], true)];
    expect(mergedAwayPiles(prev, prev)).toEqual([]);
  });

  it('says nothing about a card that LEFT the battlefield', () => {
    // ⚠️ The important negative. A destroyed permanent is the flight layer's job,
    // and holding its slot open would leave a ghost racing its own clone to the
    // graveyard.
    const prev = [pile('f1', ['f1'], false), pile('f2', ['f2'], true)];
    const next = [pile('f1', ['f1'], false)];
    expect(mergedAwayPiles(prev, next)).toEqual([]);
  });

  it('ignores an UNTAPPED pile merging away — there is no turn owed to it', () => {
    const prev = [pile('f1', ['f1'], false), pile('f2', ['f2'], false)];
    const next = [pile('f1', ['f1', 'f2'], false)];
    expect(mergedAwayPiles(prev, next)).toEqual([]);
  });

  it('finds every tapped pile when several merge at once', () => {
    const prev = [
      pile('a', ['a'], false),
      pile('b', ['b'], true),
      pile('c', ['c'], true),
    ];
    const next = [pile('a', ['a', 'b', 'c'], false)];
    expect(mergedAwayPiles(prev, next).sort()).toEqual(['b', 'c']);
  });
});

describe('sameCards', () => {
  it('is true when only the grouping changed', () => {
    const split = [pile('f1', ['f1', 'f2'], false), pile('f3', ['f3'], true)];
    const merged = [pile('f1', ['f1', 'f2', 'f3'], false)];
    expect(sameCards(split, merged)).toBe(true);
  });

  it('is false when a card arrived or left', () => {
    const before = [pile('f1', ['f1', 'f2'], false)];
    expect(sameCards(before, [pile('f1', ['f1'], false)])).toBe(false);
    expect(sameCards(before, [pile('f1', ['f1', 'f2', 'f9'], false)])).toBe(false);
  });
});

describe('refreshTapState', () => {
  it('reports a held pile as untapped once its cards have untapped', () => {
    // The shape is stale on purpose; the facts inside it never are. This is what
    // lets the row start closing on the same frame the turn starts.
    const held = [pile('f4', ['f4', 'f5'], true)];
    const [item] = refreshTapState(held, () => false);
    expect(item!.tapped).toBe(false);
    expect(item!.untapped).toBe(2);
  });

  it('keeps a pile tapped while its cards still are', () => {
    const held = [pile('f4', ['f4', 'f5'], true)];
    const [item] = refreshTapState(held, () => true);
    expect(item!.tapped).toBe(true);
    expect(item!.untapped).toBe(0);
  });

  it('counts a half-untapped pile honestly rather than rounding it either way', () => {
    const held = [pile('f4', ['f4', 'f5'], true)];
    const [item] = refreshTapState(held, (id) => id === 'f4');
    expect(item!.untapped).toBe(1);
    expect(item!.tapped).toBe(false);
  });

  it('does not mutate what it was given', () => {
    const held = [pile('f4', ['f4'], true)];
    refreshTapState(held, () => false);
    expect(held[0]!.tapped).toBe(true);
  });
});
