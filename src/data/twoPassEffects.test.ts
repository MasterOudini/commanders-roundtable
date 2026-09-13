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

  /**
   * ⚠️ **THIS TEST CHANGED SIDES (D389).** From D150 to D388 it pinned "in a random
   * order" as REFUSED - `effectEvents` has no rng. That reason went the honest way:
   * the shuffle lives in the ANSWER handler, off the seeded generator, where the
   * leftovers are known. What must never come back is the middle outcome - the
   * sentence read and its order decided for the player without the generator.
   */
  test('“in a random order” is read now, still as one clause', () => {
    const r = parse(
      'Look at the top four cards of your library. Put one of them into your hand and the rest on the bottom of your library in a random order.',
    );
    expect(r.mode).toBe('auto');
    expect(r.effects).toHaveLength(1);
    expect(r.effects[0]).toMatchObject({ kind: 'lookAtTop', amount: 4, look: { take: 1, rest: 'random' } });
  });

  /**
   * D389 - `MAX_SPAN` is 3 now, and D150's property still carries it: a rule anchored
   * at both ends cannot match a wider window, so three independent sentences stay three.
   */
  test('three independent sentences are not glued into one at the wider window', () => {
    const r = parse('Destroy target creature. Draw two cards. You gain 2 life.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => e.kind)).toEqual(['destroy', 'draw', 'gainLife']);
  });

  test('a single unread sentence is manual, as before', () => {
    expect(parse('Untap all Forests you control.').mode).toBe('manual');
  });

  test('a face with no text at all is manual', () => {
    expect(parse('').mode).toBe('manual');
  });
});

/**
 * D425 - the `you` scope and the `opponent or planeswalker` noun: two wordings the executor already had
 * the machinery for (a player scope; the target parser's player + planeswalker kinds) that the sentence
 * reader refused - the pain family (`~ deals 1 damage to you.`) and Inferno Jet's aim.
 */
describe('D425 - the you scope and the opponent-or-planeswalker noun', () => {
  test('damage to you is a player scope on the controller alone', () => {
    const r = parse('~ deals 2 damage to you.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.amount, e.scopes])).toEqual([['damageEach', 2, [{ kind: 'player', controller: 'you' }]]]);
  });

  test('a compound with a target and a you rider stays unread (Char)', () => {
    expect(parse('~ deals 4 damage to any target and 2 damage to you.').mode).toBe('manual');
  });

  test('target opponent or planeswalker reads as a damage aim', () => {
    const r = parse('~ deals 6 damage to target opponent or planeswalker.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.amount, e.targetIndex])).toEqual([['damage', 6, 0]]);
  });

  test('destroy refuses the you scope, as it refuses each player', () => {
    expect(parse('Destroy you.').mode).toBe('manual');
  });
});

/**
 * D426 - THE CONJUNCTION: one printed sentence that is two clauses the vocabulary reads whole on their own,
 * joined by ` and ` (or `, then `). Tried only after no rule read the whole sentence; both halves must read as
 * one clause each; the targets are numbered in printed order across the halves.
 */
describe('D426 - the conjunction', () => {
  test('a drain is a life loss and a life gain', () => {
    const r = parse('Target opponent loses 2 life and you gain 2 life.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.amount, e.targetIndex])).toEqual([['loseLife', 2, 0], ['gainLife', 2, -1]]);
  });

  test('a gain and a draw; a counter and a draw', () => {
    expect(parse('You gain 2 life and draw a card.').effects.map((e) => e.kind)).toEqual(['gainLife', 'draw']);
    const r = parse('Put a +1/+1 counter on target creature and draw a card.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['putCounters', 0], ['draw', -1]]);
  });

  test('a loot: the draw, then the discard that asks LAST', () => {
    const r = parse('Draw a card, then discard a card.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => e.kind)).toEqual(['draw', 'discard']);
  });

  test('the right half may be a referent of the left (a tap and its freeze)', () => {
    const r = parse("Tap target creature and it doesn't untap during its controller's next untap step.");
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['tap', 0], ['freeze', 0]]);
  });

  test('two targets across the halves are numbered in printed order', () => {
    const r = parse('Destroy target permanent and return target nonlegendary creature card from your graveyard to the battlefield.');
    expect(r.mode).toBe('auto');
    expect(r.effects.map((e) => [e.kind, e.targetIndex])).toEqual([['destroy', 0], ['reanimate', 1]]);
  });

  test('a half that is a noun leaves the sentence unread', () => {
    expect(parse('Destroy target creature and target land.').mode).toBe('manual');
    expect(parse('Exile target artifact and target creature.').mode).toBe('manual');
  });

  test('an asking left half still lands assisted (D195)', () => {
    expect(parse('Sacrifice a creature and draw a card.').mode).not.toBe('auto');
  });
});
