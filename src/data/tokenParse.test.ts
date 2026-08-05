// The token resolver: a printed description → the printing it names. See D132.
//
// ⚠️ Driven against the THREE REAL TOKEN FIXTURES (`engineCards.node.test.ts`
// re-reads all three from the live database, so their bytes are the real card's
// bytes). A matcher tested against hand-written token records would be testing
// the records.

import { describe, expect, test } from 'vitest';
import { BEAST_TOKEN, SOLDIER_TOKEN, TREASURE_TOKEN } from './fixtures/engineCards';
import { matchToken, parseTokenClause, resolveToken, tokenNamesIn } from './tokenParse';

const TOKENS = [SOLDIER_TOKEN, TREASURE_TOKEN, BEAST_TOKEN];

function resolve(sentence: string): string | null {
  const spec = parseTokenClause(sentence);
  if (!spec) return null;
  return resolveToken(spec, TOKENS)?.name ?? null;
}

describe('reading a printed token description', () => {
  test('the plain shape, and everything it carries', () => {
    const spec = parseTokenClause('Create a 1/1 white Soldier creature token.');
    expect(spec).toEqual({
      count: 1,
      name: 'Soldier',
      power: '1',
      toughness: '1',
      colors: ['W'],
      types: ['Creature'],
      abilities: '',
    });
  });

  test('counts, in words and in digits', () => {
    expect(parseTokenClause('Create three 3/3 green Beast creature tokens.')?.count).toBe(3);
    expect(parseTokenClause('Create 5 3/3 green Beast creature tokens.')?.count).toBe(5);
  });

  test('a clause is read at the END of a longer sentence', () => {
    // A token clause is routinely the tail of a trigger, which is why the
    // pattern is not anchored at the start.
    expect(resolve('When this creature dies, create a 3/3 green Beast creature token.')).toBe('Beast');
  });

  test('multiple colours, in both printed forms', () => {
    expect(parseTokenClause('Create a 4/4 green and red Beast creature token.')?.colors).toEqual(['G', 'R']);
  });

  test('extra card types are part of the identity', () => {
    expect(parseTokenClause('Create a 1/1 colorless Servo artifact creature token.')?.types).toEqual([
      'Artifact',
      'Creature',
    ]);
    // "colorless" is a colour word that contributes no letter.
    expect(parseTokenClause('Create a 1/1 colorless Servo artifact creature token.')?.colors).toEqual([]);
  });

  test('a predefined artifact token has no size and no colour', () => {
    expect(parseTokenClause('Create a Treasure token.')).toEqual({
      count: 1,
      name: 'Treasure',
      power: null,
      toughness: null,
      colors: [],
      types: ['Artifact'],
      abilities: '',
    });
  });

  /**
   * ⚠️ THE ABILITY IS THE TOKEN'S, NOT THE CARD'S. `Treasure` prints "{T},
   * Sacrifice this token: Add one mana of any color." and the card that makes
   * one says only "create a Treasure token" — so comparing abilities for a
   * predefined token misses every one of them. Measured: it did.
   */
  test('and it resolves anyway, because its NAME is its whole identity', () => {
    expect(resolve('Create a Treasure token.')).toBe('Treasure');
  });
});

describe('what the resolver refuses', () => {
  test.each([
    ["a copy — CR 707, a different primitive", "Create a token that's a copy of target creature."],
    ['an X-sized token', 'Create X 1/1 white Soldier creature tokens.'],
    ['a token whose size is a characteristic', 'Create a */* green Elemental creature token.'],
    ['a state this module does not model', 'Create a tapped 1/1 white Soldier creature token.'],
    ['a count it cannot read', 'Create a number of 1/1 white Soldier creature tokens.'],
    ['a word it cannot account for', 'Create a 1/1 white Soldier zombie token.'],
    ['a token renamed by the card', 'Create a 1/1 white Soldier creature token named Wasp.'],
  ])('%s', (_why, sentence) => {
    expect(parseTokenClause(sentence)).toBeNull();
  });

  /**
   * ⚠️ **THE ONE THAT CANNOT BE SEEN IN THE WORDS.** Callers hand this module
   * text that has already been through `scrub`, which blanks quoted and
   * parenthesised text by replacing it with SPACES OF THE SAME LENGTH. So
   * `Dragon Egg`'s "…create a 2/2 red Dragon creature token with flying and
   * \"{R}: This token gets +1/+0 until end of turn.\"" arrives as a token with
   * flying and a run of spaces — a perfectly well-formed description of a
   * DIFFERENT card. Matching it would put the wrong permanent on the
   * battlefield, on a card that reads correctly. The gap is only visible in the
   * spaces the quotes left behind.
   */
  test('a clause whose quoted ability has been scrubbed away', () => {
    const scrubbed = 'Create a 1/1 white Soldier creature token with flying and                    .';
    expect(parseTokenClause(scrubbed)).toBeNull();
    // And the shape with no conjunction, which leaves no run of spaces to find
    // only because the quote was the whole clause.
    expect(parseTokenClause('Create a 1/1 white Soldier creature token with flying and')).toBeNull();
  });

  test('an ability list that is really a count', () => {
    // `Domain — Create a 1/1 blue Bird creature token with flying FOR EACH basic
    // land type among lands you control.` The tail belongs to the count.
    expect(
      parseTokenClause(
        'Create a 1/1 blue Bird creature token with flying for each basic land type among lands you control.',
      ),
    ).toBeNull();
  });

  test('an ability list that is really a second effect', () => {
    expect(
      parseTokenClause('Create a 1/1 white Bird creature token with flying, then populate.'),
    ).toBeNull();
  });
});

describe('matching a description to a printing', () => {
  test('an exact match resolves', () => {
    expect(resolve('Create a 1/1 white Soldier creature token.')).toBe('Soldier');
    expect(resolve('Create a 3/3 green Beast creature token.')).toBe('Beast');
  });

  test.each([
    ['the wrong size', 'Create a 2/2 white Soldier creature token.'],
    ['the wrong colour', 'Create a 1/1 black Soldier creature token.'],
    ['the wrong subtype', 'Create a 1/1 white Knight creature token.'],
    ['an extra card type the printing does not have', 'Create a 1/1 white Soldier artifact creature token.'],
    ['an ability the printing does not have', 'Create a 1/1 white Soldier creature token with flying.'],
  ])('%s does not resolve', (_why, sentence) => {
    expect(resolve(sentence)).toBeNull();
  });

  /**
   * ⚠️ **AMBIGUITY IS COUNTED BY `oracleId`, NOT BY PRINTING**, and getting that
   * wrong is what the first measurement of this module got wrong. The plain 1/1
   * white Soldier has **66 printings and ONE oracle id**; a printing count
   * reported 328 descriptions as ambiguous that were nothing of the kind.
   */
  test('reprints of one token are not an ambiguity', () => {
    const reprint = { ...SOLDIER_TOKEN, scryfallId: 'zzzz-different-printing' };
    const spec = parseTokenClause('Create a 1/1 white Soldier creature token.');
    if (!spec) throw new Error('expected a spec');
    expect(matchToken(spec, [SOLDIER_TOKEN, reprint])).toHaveLength(2);
    expect(resolveToken(spec, [SOLDIER_TOKEN, reprint])?.name).toBe('Soldier');
  });

  /**
   * ⚠️ TWO ORACLE IDS IS A REFUSAL. Two genuinely different tokens matching one
   * description means the description does not identify a card, and creating
   * either would be the app deciding something the rules did not.
   */
  test('two different tokens matching one description is a refusal', () => {
    const impostor = { ...SOLDIER_TOKEN, oracleId: 'a-different-token', scryfallId: 'zzzz' };
    const spec = parseTokenClause('Create a 1/1 white Soldier creature token.');
    if (!spec) throw new Error('expected a spec');
    expect(matchToken(spec, [SOLDIER_TOKEN, impostor])).toHaveLength(2);
    expect(resolveToken(spec, [SOLDIER_TOKEN, impostor])).toBeNull();
  });

  /**
   * ⚠️ Which PRINTING is returned among reprints does not matter to the rules —
   * they are the same object — but it must be deterministic, or two players
   * would disagree about a `printingId` on the wire.
   */
  test('the printing chosen among reprints is deterministic', () => {
    const spec = parseTokenClause('Create a 1/1 white Soldier creature token.');
    if (!spec) throw new Error('expected a spec');
    const a = { ...SOLDIER_TOKEN, scryfallId: 'bbbb' };
    const b = { ...SOLDIER_TOKEN, scryfallId: 'aaaa' };
    expect(resolveToken(spec, [a, b])?.scryfallId).toBe('aaaa');
    expect(resolveToken(spec, [b, a])?.scryfallId).toBe('aaaa');
  });
});

describe('the names a card asks for', () => {
  test('every token a card can make, by name', () => {
    expect(
      tokenNamesIn('When this creature enters, create a 1/1 white Soldier creature token.\nCreate a Treasure token.'),
    ).toEqual(['Soldier', 'Treasure']);
  });

  test('nothing for a card that makes none', () => {
    expect(tokenNamesIn('Flying\nWhen this creature dies, draw a card.')).toEqual([]);
  });
});
