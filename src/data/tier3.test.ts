import { describe, expect, test } from 'vitest';
import { tier3NotesFor, tier3SummaryFor } from './tier3';
import * as C from './fixtures/engineCards';
import type { CardData } from './cardTypes';

// ⚠️ The fixtures carry VERBATIM oracle text (D15b), so these tests are about
// the real wording rather than about a paraphrase that would keep passing after
// Scryfall reworded something.

const what = (card: CardData, faceIndex = 0): string[] =>
  tier3NotesFor(card, faceIndex).map((n) => n.what);

describe('tier3NotesFor', () => {
  /**
   * ⚠️ THE MOST IMPORTANT CASE. A card the engine handles completely must say
   * NOTHING. A disclosure that appears on every card is furniture within a
   * minute, and then the one card that genuinely needed it is not read either.
   */
  test('a card the engine fully handles produces no notes', () => {
    expect(tier3NotesFor(C.GRIZZLY_BEARS)).toEqual([]);
    expect(tier3NotesFor(C.FOREST)).toEqual([]);
    expect(tier3SummaryFor(C.GRIZZLY_BEARS)).toBeNull();
  });

  test('an automated keyword produces no note', () => {
    // Flying, vigilance, first strike and the rest are enforced, so saying
    // anything about them would be a lie in the other direction.
    expect(tier3NotesFor(C.SERRA_ANGEL)).toEqual([]);
    expect(tier3NotesFor(C.VAMPIRE_NIGHTHAWK)).toEqual([]);
  });

  /**
   * ⚠️ Protection is PARTLY enforced, which is the hardest case to describe
   * honestly. "Protection is not automatic" would be false; saying nothing lets
   * a player assume `protection from creatures` is being checked. Name the
   * clause that is not enforced, and stay quiet about the one that is.
   */
  test('protection from a COLOUR is enforced, so it is not mentioned', () => {
    // Kor Firewalker: "protection from red".
    expect(what(C.KOR_FIREWALKER)).toEqual([]);
  });

  test('protection from a non-colour IS mentioned, with the clause', () => {
    const card = withText(C.GRIZZLY_BEARS, 'Protection from creatures');
    expect(what(card)).toEqual(['Protection from creatures']);
  });

  test('a multi-colour protection clause is still enforced and stays quiet', () => {
    const card = withText(C.GRIZZLY_BEARS, 'Protection from black and from red');
    expect(what(card)).toEqual([]);
  });

  test('an enforced ward is not mentioned; a decision ward is', () => {
    // Ward {4} and Ward—Pay N life are charged (D68), so they stay quiet.
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward {2}'))).toEqual([]);
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward—Pay 3 life.'))).toEqual([]);
    expect(what(withText(C.GRIZZLY_BEARS, 'Ward—Discard a card.'))).toEqual(['Ward']);
  });

  test('a mana ability the solver cannot model is named', () => {
    // Bloom Tender: "Add one mana of any color your commanders could produce" —
    // a board-dependent amount, so it stays manually tappable.
    expect(what(C.BLOOM_TENDER).length).toBeGreaterThan(0);
    expect(what(C.BLOOM_TENDER)).toContain('Its mana ability');
  });

  test('a plain land keeps quiet about its mana', () => {
    expect(what(C.TUNDRA)).toEqual([]);
    expect(what(C.COMMAND_TOWER)).toEqual([]);
  });

  test('an unautomated keyword worth naming is named with what to do instead', () => {
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Crew'] };
    const notes = tier3NotesFor(card);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.what).toBe('Crew');
    // ⚠️ The note says what the PLAYER does, not what the card does. Explaining
    // the card would be a second rules text that drifts from Scryfall's.
    expect(notes[0]?.how).toContain('yourself');
  });

  test('an unautomated keyword NOT on the short list stays quiet', () => {
    // 885 distinct keyword strings exist; naming all of them would be a wall of
    // text nobody reads, which is the same outcome as saying nothing.
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Sonic Rainboom'] };
    expect(tier3NotesFor(card)).toEqual([]);
  });

  test('a note is never repeated', () => {
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Crew', 'Crew'] };
    expect(tier3NotesFor(card)).toHaveLength(1);
  });
});

describe('tier3SummaryFor', () => {
  test('caps the list at three and counts the rest', () => {
    const card = {
      ...C.GRIZZLY_BEARS,
      keywords: ['Crew', 'Equip', 'Cycling', 'Kicker', 'Morph'],
    };
    const summary = tier3SummaryFor(card);
    expect(summary).toContain('and 2 more');
    expect(summary?.startsWith('Not automatic:')).toBe(true);
  });

  test('no cap notice when there are three or fewer', () => {
    const card = { ...C.GRIZZLY_BEARS, keywords: ['Crew', 'Equip'] };
    expect(tier3SummaryFor(card)).toBe('Not automatic: Crew, Equip.');
  });
});

/** A fixture with one face's oracle text replaced, keeping everything else real. */
function withText(card: CardData, oracleText: string): CardData {
  const face = card.faces[0]!;
  return { ...card, faces: [{ ...face, oracleText }, ...card.faces.slice(1)] };
}
