// D310 - THE CHARACTERISTIC-DEFINING KEYWORDS, in the data layer: a Changeling
// or Devoid line is the engine's own (the canon), so a pure carrier is
// COMPLETE by the accounting alone and the disclosure says nothing.

import { describe, expect, test } from 'vitest';
import { engineCompleteness } from './engineComplete';
import { tier3NotesFor } from './tier3';
import { canonicalKeyword } from '../engine/keywords';
import { AVIAN_CHANGELING, VESTIGE_OF_EMRAKUL, WOODLAND_CHANGELING } from './fixtures/engineCards';

describe('the characteristic-defining keywords (D310)', () => {
  test('Changeling and Devoid are canon keywords now', () => {
    expect(canonicalKeyword('Changeling')).toBe('changeling');
    expect(canonicalKeyword('Devoid')).toBe('devoid');
  });

  test('a pure carrier is complete by the accounting alone', () => {
    for (const card of [WOODLAND_CHANGELING, AVIAN_CHANGELING, VESTIGE_OF_EMRAKUL]) {
      expect(engineCompleteness(card).complete, card.name).toBe(true);
    }
  });

  test('the disclosure says nothing about either', () => {
    expect(tier3NotesFor(WOODLAND_CHANGELING)).toEqual([]);
    expect(tier3NotesFor(VESTIGE_OF_EMRAKUL)).toEqual([]);
  });
});
