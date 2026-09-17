// D478 - THE PERMANENT NOUN. `permanent` names no card type; a permanent card is one of the six types that go onto the
// battlefield (CR 110.4). The search noun expands `Rebel permanent` to one alternative per permanent type before the
// shared reader sees it, `nonland permanent` leaves the land out, and an alternative spelled with its own `card`
// (`a basic land card or Gate card`, `up to two basic land cards and/or Gate cards`) folds to the `or` list. What is
// proven here: the six alternatives and their qualifier, the five of nonland, a Goblin tribal instant refused as a
// Goblin permanent card while a Goblin creature is admitted, the folded alternative, and the refusals - `and/or` with
// no count, a qualifier beside an alternative, `noncreature` still unread.
import { describe, expect, test } from 'vitest';
import { parseEffects } from './effectParse';
import { predicateAdmits } from './replacementParse';

const search = (text: string) => {
  const p = parseEffects(text, '~', true);
  const e = p.effects[0];
  return p.mode === 'auto' && e && e.kind === 'search' && e.search ? e.search : null;
};

describe('D478 - the permanent noun in a search', () => {
  test('a Rebel permanent card with mana value 3 or less is six alternatives under one qualifier', () => {
    const s = search('Search your library for a Rebel permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.');
    expect(s).not.toBeNull();
    expect(s?.predicates.map((p) => p.types.join('+'))).toEqual(['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle']);
    expect(s?.predicates.every((p) => p.subtypes.length === 1 && p.subtypes[0] === 'Rebel')).toBe(true);
    expect(s?.qualifier).toEqual({ manaValue: { op: 'lte', n: 3 }, name: null });
    expect(s?.destination).toBe('battlefield');
    expect(s?.label).toBe('Rebel permanent card with mana value 3 or less');
  });

  test('nonland permanent leaves the land out; a Goblin tribal instant is no Goblin permanent card', () => {
    const s = search('Search your library for a nonland permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.');
    expect(s?.predicates.map((p) => p.types[0])).toEqual(['Artifact', 'Creature', 'Enchantment', 'Planeswalker', 'Battle']);
    const g = search('Search your library for a Goblin permanent card, put it onto the battlefield, then shuffle.');
    expect(g).not.toBeNull();
    const preds = g?.predicates ?? [];
    expect(predicateAdmits({ typeLine: { supertypes: [], types: ['Tribal', 'Instant'], subtypes: ['Goblin'] }, colors: ['R'] }, preds)).toBe(false);
    expect(predicateAdmits({ typeLine: { supertypes: [], types: ['Creature'], subtypes: ['Goblin', 'Warrior'] }, colors: ['R'] }, preds)).toBe(true);
    expect(predicateAdmits({ typeLine: { supertypes: [], types: ['Creature'], subtypes: ['Elf'] }, colors: ['G'] }, preds)).toBe(false);
  });

  test('an alternative spelled with its own card folds to the or list', () => {
    const s = search('Search your library for a basic land card or Gate card, reveal it, put it into your hand, then shuffle.');
    expect(s?.predicates).toEqual([{ supertypes: ['Basic'], types: ['Land'], subtypes: [], colors: [] }, { supertypes: [], types: [], subtypes: ['Gate'], colors: [] }]);
    expect(s?.label).toBe('basic land or Gate card');
    const two = search('Search your library for up to two basic land cards and/or Gate cards, put them onto the battlefield tapped, then shuffle.');
    expect(two?.count).toBe(2);
    expect(two?.tapped).toBe(true);
    expect(two?.predicates).toHaveLength(2);
  });

  test('the refusals stand: and/or with no count, a qualifier beside an alternative, an unread word', () => {
    expect(parseEffects('Search your library for an instant card and/or a sorcery card, reveal them, put them into your hand, then shuffle.', '~', true).mode).toBe('manual');
    expect(parseEffects('Search your library for a basic Plains card or a creature card with mana value 1 or less, reveal it, put it into your hand, then shuffle.', '~', true).mode).toBe('manual');
    expect(parseEffects('Search your library for a noncreature permanent card, put it onto the battlefield, then shuffle.', '~', true).mode).toBe('manual');
  });
});
