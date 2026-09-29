// A TRAILING SOURCE QUALIFIER on a target clause - "target activated or triggered ability from an artifact source" -
// is read by nothing: not enforced (a stack candidate carries no characteristics of the ability's source) and, until
// now, not recorded either. D138's rule, and D297's for an unread "with ...": a restriction the engine does not check
// is RECORDED in `unenforced`, so tier3.ts says so on the card; dropped silently, the clause admitted any ability and
// the card said nothing. Measured over every Commander-legal card (2026-09-29): eight clauses, every one an ability
// target. What is proven here: each printed line records its whole source phrase, and nothing else changes - the
// clause still reads its noun, its controller and its text, and admits what it did (D79: an unread restriction may
// allow, never block); a "from" that names no source ("from combat") and Gogo's "X times" (how many copies, not a
// restriction) record nothing; the fixture card says it (tier3).
import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from './targetParse';
import { tier3NotesFor } from './tier3';
import { ENGINE_CARDS } from './fixtures/engineCards';

/** The printed lines (verbatim from the card database), the clause each reads, and the source phrase it drops. */
const SOURCE_LINES: readonly { readonly card: string; readonly line: string; readonly text: string; readonly from: string }[] = [
  {
    card: 'Scientist Supreme of A.I.M.',
    line: "Pay 2 life: Copy target activated or triggered ability you control from an artifact source. You may choose new targets for the copy. Activate only during your turn and only once each turn. (Mana abilities can't be targeted.)",
    text: 'target activated or triggered ability you control',
    from: 'from an artifact source',
  },
  {
    card: "Tawnos, Urza's Apprentice",
    line: "{U}{R}, {T}: Copy target activated or triggered ability you control from an artifact source. You may choose new targets for the copy. (Mana abilities can't be targeted.)",
    text: 'target activated or triggered ability you control',
    from: 'from an artifact source',
  },
  {
    card: 'Weaver of Harmony',
    line: "{G}, {T}: Copy target activated or triggered ability you control from an enchantment source. You may choose new targets for the copy. (Mana abilities can't be targeted.)",
    text: 'target activated or triggered ability you control',
    from: 'from an enchantment source',
  },
  {
    card: 'Emerald Dragon // Dissonant Wave',
    line: 'Counter target activated or triggered ability from a noncreature source. (Then exile this card. You may cast the creature later from exile.)',
    text: 'target activated or triggered ability',
    from: 'from a noncreature source',
  },
  {
    card: 'Abstruse Archaic',
    line: "{1}, {T}: Copy target activated or triggered ability you control from a colorless source. You may choose new targets for the copy. (Mana abilities can't be targeted.)",
    text: 'target activated or triggered ability you control',
    from: 'from a colorless source',
  },
  {
    card: 'The Peregrine Dynamo',
    line: "{1}, {T}: Copy target activated or triggered ability you control from another legendary source that's not a commander. You may choose new targets for the copy. (Mana abilities can't be targeted.)",
    text: 'target activated or triggered ability you control',
    from: "from another legendary source that's not a commander",
  },
  {
    card: 'Echo, Perceptive Prodigy',
    line: "{1}, {T}: Copy target activated or triggered ability you control from a creature source. You may choose new targets for the copy. (Mana abilities can't be targeted.)",
    text: 'target activated or triggered ability you control',
    from: 'from a creature source',
  },
  {
    card: 'Green Slime',
    line: "When this creature enters, counter target activated or triggered ability from an artifact or enchantment source. If a permanent's ability is countered this way, destroy that permanent.",
    text: 'target activated or triggered ability',
    from: 'from an artifact or enchantment source',
  },
];

describe('a source qualifier on a target clause is recorded, never dropped', () => {
  for (const { card, line, text, from } of SOURCE_LINES) {
    test(`${card}: "${from}"`, () => {
      const specs = parseTargetClauses(line);
      expect(specs, 'one clause').toHaveLength(1);
      const spec = specs[0]!;
      expect(spec.unenforced, 'the source phrase is recorded, whole').toEqual([from]);
      expect(spec.kinds.length, 'still read - not free aim').toBeGreaterThan(0);
      expect(spec.confident).toBe(true);
      expect(spec.text, 'the clause itself reads as before').toBe(text);
      expect(spec.controller).toBe(text.endsWith('you control') ? 'you' : 'any');
    });
  }

  test('a "from" that names no source records nothing, and neither does Gogo' + "'" + 's "X times"', () => {
    const warlord = parseTargetClauses('{T}: Remove target blocking creature from combat. Creatures it was blocking that hadn' + "'" + 't become blocked by another creature this combat become unblocked, then it blocks an attacking creature of your choice. Activate only during the declare blockers step.');
    expect(warlord.map((s) => s.unenforced), 'from combat is the effect, not a restriction').toEqual([[]]);
    const gogo = parseTargetClauses('{X}{X}, {T}: Copy target activated or triggered ability you control X times. You may choose new targets for the copies. This ability can' + "'" + 't be copied and X can' + "'" + 't be 0. (Mana abilities can' + "'" + 't be targeted.)');
    expect(gogo.map((s) => s.unenforced), 'X times is how many copies, not a restriction').toEqual([[]]);
  });

  test('the card says it: Scientist Supreme' + "'" + 's tier-3 note names the source', () => {
    const card = ENGINE_CARDS.find((c) => c.name === 'Scientist Supreme of A.I.M.');
    if (!card) throw new Error('no fixture Scientist Supreme of A.I.M.');
    expect(tier3NotesFor(card, 0).map((n) => n.what)).toContain('“from an artifact source” on its target');
  });
});
