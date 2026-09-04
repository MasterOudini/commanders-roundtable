// D309 - THE MORPH SEAM, in the data layer: parseMorph reads a mana cost (and
// the megamorph flag), refuses a dash cost; a pure morph creature is COMPLETE
// by the accounting alone; the disclosure says nothing about a morph the
// engine runs; the classifier files the line scriptable.

import { describe, expect, test } from 'vitest';
import { parseMorph } from './oracleParse';
import { engineCompleteness } from './engineComplete';
import { tier3NotesFor } from './tier3';
import { primitiveFor } from './primitives';
import { AERIE_BOWMASTERS, BATTERING_CRAGHORN, GLACIAL_STALKER, WOOLLY_LOXODON } from './fixtures/engineCards';

describe('the morph seam (D309)', () => {
  test('parseMorph reads the cost and the megamorph flag; a dash cost is null', () => {
    const morph = parseMorph('First strike\nMorph {1}{R}{R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)');
    expect(morph).not.toBeNull();
    expect(morph?.mega).toBe(false);
    expect(morph?.cost.generic).toBe(1);
    const mega = parseMorph('Reach\nMegamorph {5}{G} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its megamorph cost and put a +1/+1 counter on it.)');
    expect(mega?.mega).toBe(true);
    expect(mega?.cost.generic).toBe(5);
    expect(parseMorph('Morph—Discard a card. (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)')).toBeNull();
    expect(parseMorph('Flying')).toBeNull();
  });

  test('a pure morph creature is complete by the accounting alone', () => {
    for (const card of [WOOLLY_LOXODON, GLACIAL_STALKER, BATTERING_CRAGHORN, AERIE_BOWMASTERS]) {
      expect(engineCompleteness(card).complete, card.name).toBe(true);
    }
  });

  test('the disclosure says nothing about a morph the engine runs', () => {
    expect(tier3NotesFor(WOOLLY_LOXODON)).toEqual([]);
    expect(tier3NotesFor(AERIE_BOWMASTERS)).toEqual([]);
  });

  test('the classifier files a mana morph scriptable and a dash morph as an alternative cost', () => {
    const line = (text: string) => ({ text, kind: 'sentence' as const });
    expect(primitiveFor(line('Morph {5}{G}'), 'Woolly Loxodon')).toBe('scriptable');
    expect(primitiveFor(line('Megamorph {5}{G}'), 'Aerie Bowmasters')).toBe('scriptable');
    expect(primitiveFor(line('Morph—Discard a card.'), 'Dragon Wings')).toBe('keyword:altCost');
  });
});
