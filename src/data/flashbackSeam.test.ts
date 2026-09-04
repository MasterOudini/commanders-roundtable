// D307 - THE FLASHBACK SEAM, the parser, accounting and classifier half: a
// "Flashback {N}" line is read as the face's flashback cost, the accounting and
// the disclosure no longer hold the line against the card, the classifier files
// it as scriptable; a dash cost stays where it was.

import { describe, expect, test } from 'vitest';
import { BEAST_ATTACK, DEEP_ANALYSIS, FEELING_OF_DREAD } from './fixtures/engineCards';
import { engineCompleteness } from './engineComplete';
import { parseFlashback } from './oracleParse';
import { flashbackLineRuns, primitiveFor } from './primitives';
import { tier3NotesFor } from './tier3';

describe('the Flashback seam (D307)', () => {
  test('Flashback {N} is read as a mana cost; a dash cost is not', () => {
    expect(parseFlashback('Tap up to two target creatures.\nFlashback {1}{U} (You may cast this card from your graveyard for its flashback cost. Then exile it.)')?.generic).toBe(1);
    expect(parseFlashback('Target player draws two cards.\nFlashback—Pay 3 life.')).toBeNull();
    expect(parseFlashback('Draw a card.')).toBeNull();
  });

  test('the accounting and the disclosure no longer hold the Flashback line against the card', () => {
    expect(engineCompleteness(FEELING_OF_DREAD).complete).toBe(true);
    expect(engineCompleteness(BEAST_ATTACK).complete).toBe(true);
    expect(tier3NotesFor(FEELING_OF_DREAD).map((n) => n.what)).toEqual([]);
    // Deep Analysis pays life for its flashback: still the keyword loop's.
    expect(tier3NotesFor(DEEP_ANALYSIS).map((n) => n.what)).toContain('Flashback');
  });

  test('the classifier files a mana Flashback as scriptable and a dash cost as keyword:altCost', () => {
    expect(flashbackLineRuns('Flashback {3}{U}')).toBe(true);
    expect(flashbackLineRuns('Flashback—Pay 3 life.')).toBe(false);
    expect(primitiveFor({ text: 'Flashback {2}{G}{G}{G}', kind: 'sentence' }, 'X')).toBe('scriptable');
    expect(primitiveFor({ text: 'Flashback—Pay 3 life.', kind: 'sentence' }, 'X')).toBe('keyword:altCost');
  });
});
