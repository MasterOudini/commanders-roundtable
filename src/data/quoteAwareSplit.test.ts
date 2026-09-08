// D366 — A LINE'S KIND IS DECIDED BY THE LINE, NOT BY WORDS INSIDE A QUOTE.
//
// `splitAbilityLines` tested the RAW line for a trigger word and then for a colon
// before the first sentence break. Both tests could be answered by text that
// belongs to a DIFFERENT ability — the one the line grants, or the one a reminder
// paraphrases — so:
//
//   Enchanted creature has "{T}: This creature deals 1 damage to any target."
//
// read as an ACTIVATED ability (the quote's colon is the first one) and
//
//   Enchanted creature has "Whenever this creature attacks, draw a card."
//
// read as a TRIGGERED one, when both are STATIC grants. D354's dossier measured
// the cost: 113 of the 221 quoted-grant lines land in the activated claim bucket
// for this reason alone, so a correct static implementation of one would produce
// the right text key in the wrong bucket and the accounting would refuse it.
//
// ⚠️ THE MASK IS FOR RECOGNITION ONLY. `scrub` blanks reminders and quotes IN
// PLACE with spaces of the same length, so an offset found in the mask is the
// same offset in the raw line — which is why `costText` and `effectText` can
// still be cut from the raw text and every caller keeps the substrings it had.

import { describe, expect, test } from 'vitest';
import { splitAbilityLines } from './targetParse';

const kindOf = (line: string): string => splitAbilityLines(line, true)[0]?.kind ?? '(none)';

describe('D366 - a quoted ability does not decide the kind of the line that grants it', () => {
  test('a granted ACTIVATED ability leaves the outer line static', () => {
    expect(kindOf('Enchanted creature has "{T}: This creature deals 1 damage to any target."')).toBe('static');
    expect(kindOf('Equipped creature has "{2}: This creature gets +1/+0 until end of turn."')).toBe('static');
    expect(kindOf('All Slivers have "{2}: This creature gains flying until end of turn."')).toBe('static');
  });

  test('a granted TRIGGERED ability leaves the outer line static', () => {
    expect(kindOf('Enchanted creature has "Whenever this creature attacks, draw a card."')).toBe('static');
    expect(kindOf('Enchanted land has "When this land is put into a graveyard, draw a card."')).toBe('static');
  });

  test('a reminder that paraphrases a cost does not make the line activated', () => {
    // Cycling's reminder text contains a colon; the printed line is a keyword.
    expect(kindOf('Cycling {2} ({2}, Discard this card: Draw a card.)')).toBe('static');
  });
});

describe('D366 - the teeth: a real ability is still read as one', () => {
  test('a genuine activated line is still activated, and keeps its RAW substrings', () => {
    const [a] = splitAbilityLines('{T}, Sacrifice this creature: Draw a card.', true);
    expect(a?.kind).toBe('activated');
    expect(a?.costText).toBe('{T}, Sacrifice this creature');
    expect(a?.effectText).toBe('Draw a card.');
  });

  test('a genuine triggered line is still triggered', () => {
    expect(kindOf('Whenever this creature attacks, you gain 1 life.')).toBe('triggered');
  });

  test("D159's long cost still reads as a cost, because the line OPENS with a brace", () => {
    const [a] = splitAbilityLines(
      "{3}, {T}, Pay life equal to the number of colors in your commanders' color identity: Draw a card.",
      true,
    );
    expect(a?.kind).toBe('activated');
  });

  // ⚠️ An activated ability whose EFFECT quotes something is still activated: the
  // colon is outside the quote, which is exactly the distinction being drawn.
  test('an activated ability that grants a quoted ability is still activated', () => {
    const [a] = splitAbilityLines('{1}: Target creature gains "{T}: Add {C}." until end of turn.', true);
    expect(a?.kind).toBe('activated');
    expect(a?.costText).toBe('{1}');
  });
});
