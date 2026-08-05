// The two-pass effect parser — M6.3w. See D150.
//
// ⚠️ WHAT CHANGED: `sentences()` used to carry a JOIN LIST — a hardcoded head
// pattern for the one card shape that prints two sentences the parser reads as
// one. D141 built that and said plainly it was the wrong shape "past two or
// three entries". It never got a second entry, so this is the rewrite done at
// ONE, on request, with the bar set accordingly: **every pinned coverage number
// over the 31,692-card database must come out byte-identical**, and does.
//
// ⚠️ THE PROPERTY THAT MAKES IT SAFE was already in the file and is not an
// accident: every rule is ANCHORED AT BOTH ENDS (D90, so a prefix could never
// "understand" `Homing Lightning`). A one-sentence rule therefore CANNOT match a
// two-sentence window — which is exactly what lets pass two try wider windows
// first with no head list and no per-rule declaration.

import { describe, expect, test } from 'vitest';
import { parseEffects } from './effectParse';

/** `parseEffects` is pure in its text, so a constructed face is a fair input. */
const parse = (text: string) => parseEffects(text, 'Test Card', true);

describe('pass two joins only what a rule asks for', () => {
  /**
   * ⚠️ **THE JOIN, WITH NO JOIN LIST.** `Impulse` prints two sentences that are
   * one effect. Nothing in the parser names its opening words any more; the
   * `lookAtTop` rule simply has a pattern that spans the full stop, and the
   * sliding window offers it one.
   */
  test('a rule written across a full stop still matches', () => {
    const r = parse(
      'Look at the top four cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.',
    );
    expect(r.mode).toBe('auto');
    expect(r.effects).toHaveLength(1);
    expect(r.effects[0]?.kind).toBe('lookAtTop');
    // ⚠️ ONE clause, not two — and the clause count is what decides `auto`
    // versus `assisted`, so the arithmetic the join list used to produce has to
    // survive the rewrite exactly.
    expect(r.effects[0]?.text).toContain('Look at the top four');
    expect(r.effects[0]?.text).toContain('into your hand');
  });

  /**
   * ⚠️ **THE FAILURE THE JOIN LIST RISKED, asserted directly.** D141's own
   * comment warned that "a LOOSER head would glue an unrelated following
   * sentence on and quietly turn an `assisted` card into a `manual` one". Two
   * independently-understood sentences must stay TWO clauses and two effects.
   */
  test('two independent sentences are not glued into one', () => {
    const r = parse('Destroy target creature. Draw two cards.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => e.kind)).toEqual(['destroy', 'draw']);
  });

  /**
   * ⚠️ An understood sentence followed by one the vocabulary cannot read is the
   * `assisted` shape — the 1,300-card case the file header is about. It must
   * stay two clauses, or the card would read as `auto` and half-execute.
   */
  test('understood + unread stays assisted, never auto', () => {
    const r = parse('Destroy target creature. Its controller sacrifices a Goblin of their choice.');
    expect(r.mode).toBe('assisted');
    expect(r.effects).toHaveLength(1);
    expect(r.effects[0]?.kind).toBe('destroy');
  });

  /**
   * ⚠️ **A WINDOW THAT MATCHES NOTHING ADVANCES BY ONE, and the sentence after it
   * still gets its own chance.** The join list could not do this: it consumed the
   * pair unconditionally, so a head followed by a tail it could not read took the
   * tail down with it.
   */
  test('an unmatched leading sentence does not swallow the next one', () => {
    const r = parse('Roll a d20 and consult the table. Draw two cards.');
    expect(r.mode).toBe('assisted');
    expect(r.effects.map((e) => e.kind)).toEqual(['draw']);
  });

  /** The refusals D141 and D142 pinned are unchanged by the rewrite. */
  test('“in a random order” is still refused', () => {
    const r = parse(
      'Look at the top four cards of your library. Put one of them into your hand and the rest on the bottom of your library in a random order.',
    );
    expect(r.mode).toBe('manual');
    expect(r.effects).toEqual([]);
  });

  test('a single unread sentence is manual, as before', () => {
    expect(parse('Untap all Forests you control.').mode).toBe('manual');
  });

  test('a face with no text at all is manual', () => {
    expect(parse('').mode).toBe('manual');
  });
});
