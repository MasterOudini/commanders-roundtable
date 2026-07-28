import { describe, expect, test } from 'vitest';
import { countCards, groupBySection, parseDecklist } from './decklist';
import type { DeckEntry } from './deckTypes';

/** Parse a single line and return its entry, for terse assertions. */
function one(line: string): DeckEntry {
  const parsed = parseDecklist(line);
  expect(parsed.problems, `unparsed: ${line}`).toEqual([]);
  expect(parsed.entries, `no entry for: ${line}`).toHaveLength(1);
  return parsed.entries[0]!;
}

describe('quantities', () => {
  test.each([
    ['1 Sol Ring', 1, 'Sol Ring'],
    ['1x Sol Ring', 1, 'Sol Ring'],
    ['1 x Sol Ring', 1, 'Sol Ring'],
    ['4x Lightning Bolt', 4, 'Lightning Bolt'],
    ['4 Lightning Bolt', 4, 'Lightning Bolt'],
    ['10 Forest', 10, 'Forest'],
    ['Sol Ring', 1, 'Sol Ring'],
    ['Sol Ring x1', 1, 'Sol Ring'],
    ['Seven Dwarves x7', 7, 'Seven Dwarves'],
    ['- 1 Sol Ring', 1, 'Sol Ring'],
    ['* 2 Sol Ring', 2, 'Sol Ring'],
  ])('%s → %i × %s', (line, qty, name) => {
    const e = one(line);
    expect(e.quantity).toBe(qty);
    expect(e.name).toBe(name);
  });

  test('a card name containing a number is not eaten as a quantity', () => {
    expect(one('1 Borrowing 100,000 Arrows').name).toBe('Borrowing 100,000 Arrows');
    // No leading quantity at all.
    expect(one('Krark-Clan Ironworks').name).toBe('Krark-Clan Ironworks');
  });

  test('a trailing number without a set group stays part of the name', () => {
    // Without this, `Fury Sliver 157` would silently lose the 157.
    expect(one('1 Fury Sliver 157').name).toBe('Fury Sliver 157');
  });
});

describe('set and collector number', () => {
  test('parenthesised set with collector number', () => {
    const e = one('1 Sol Ring (LTC) 264');
    expect(e).toMatchObject({ name: 'Sol Ring', set: 'LTC', collectorNumber: '264' });
  });

  test('lowercase set code', () => {
    expect(one('1 Sol Ring (ltc) 264')).toMatchObject({ set: 'ltc', collectorNumber: '264' });
  });

  test('bracketed set with collector number', () => {
    expect(one('1 Sol Ring [LTC] 264')).toMatchObject({
      name: 'Sol Ring', set: 'LTC', collectorNumber: '264',
    });
  });

  test('set with no collector number', () => {
    const e = one('1 Sol Ring (ltc)');
    expect(e.name).toBe('Sol Ring');
    expect(e.set).toBe('ltc');
    expect(e.collectorNumber).toBeUndefined();
  });

  test('a collector number with a letter suffix', () => {
    expect(one('1 Sol Ring (ltc) 264p')).toMatchObject({ collectorNumber: '264p' });
  });

  test('a set-prefixed collector number (The List)', () => {
    expect(one('1 Fury Sliver (plst) TSP-157')).toMatchObject({
      name: 'Fury Sliver', set: 'plst', collectorNumber: 'TSP-157',
    });
  });

  // ⚠️ Both of these came out of REAL deck exports and both used to be rejected,
  // which did not merely lose the printing: the peel stops at the first thing it
  // cannot read, so the set group stayed glued on and the NAME became
  // "Harrow (plst) C18-150", which resolves to no card at all.
  test.each([
    ['1 Harrow (plst) C18-150', 'Harrow', 'plst', 'C18-150'],
    ['1 Culling the Weak (pmei) 2023-8', 'Culling the Weak', 'pmei', '2023-8'],
    ['1 Sol Ring (plst) A-123', 'Sol Ring', 'plst', 'A-123'],
    ['1 Arcane Signet (ltc) 264★', 'Arcane Signet', 'ltc', '264★'],
  ])('%s keeps the name and the printing apart', (line, name, set, cn) => {
    expect(one(line)).toMatchObject({ name, set, collectorNumber: cn });
  });

  test('a trailing group that is a category, not a number, is still not one', () => {
    // No digit → not a collector number, so `Ramp` stays a peeled category and
    // the set is still the leftmost group.
    expect(one('1x Sol Ring (ltc) 264 [Ramp]')).toMatchObject({
      name: 'Sol Ring', set: 'ltc', collectorNumber: '264',
    });
  });

  test('no set given', () => {
    const e = one('1 Sol Ring');
    expect(e.set).toBeUndefined();
    expect(e.collectorNumber).toBeUndefined();
  });
});

describe('Archidekt and Moxfield extras', () => {
  test('category and flags after the printing', () => {
    // ⚠️ The classic ordering trap: the set group must be found even though a
    // bracketed category and a brace group follow it.
    const e = one('1x Sol Ring (ltc) 264 [Ramp]{noPrice}');
    expect(e).toMatchObject({
      quantity: 1, name: 'Sol Ring', set: 'ltc', collectorNumber: '264',
    });
  });

  test('caret tag form', () => {
    expect(one('1x Sol Ring ^Ramp^')).toMatchObject({ name: 'Sol Ring' });
  });

  test('multiple brace groups', () => {
    expect(one('1x Sol Ring (ltc) 264 {noPrice}{foil}')).toMatchObject({
      name: 'Sol Ring', set: 'ltc',
    });
  });

  test('foil markers set the flag and leave the name clean', () => {
    expect(one('1 Sol Ring *F*')).toMatchObject({ name: 'Sol Ring', foil: true });
    expect(one('1 Sol Ring *E*')).toMatchObject({ name: 'Sol Ring', foil: true });
    expect(one('1 Sol Ring').foil).toBeUndefined();
  });

  test('a bracketed category with no set does not corrupt the name', () => {
    // It may be misread as a set code, which is harmless: resolution only uses a
    // set when a collector number is present too. The NAME must be right.
    expect(one('1x Sol Ring [Ramp]').name).toBe('Sol Ring');
  });

  test('bracketed set AND bracketed category together', () => {
    // Both groups are brackets, so only POSITION distinguishes them: the set is
    // the leftmost group. See the pass-5 note in decklist.ts.
    expect(one('1 Sol Ring [LTC] 264 [Ramp]')).toMatchObject({
      name: 'Sol Ring', set: 'LTC', collectorNumber: '264',
    });
  });

  test('several trailing categories', () => {
    expect(one('1x Sol Ring (ltc) 264 [Ramp] [Artifacts]')).toMatchObject({
      name: 'Sol Ring', set: 'ltc', collectorNumber: '264',
    });
  });
});

describe('double-faced and split cards', () => {
  test('mid-line // is a face separator, not a comment', () => {
    expect(one('1 Fire // Ice').name).toBe('Fire // Ice');
    expect(one('1 Delver of Secrets // Insectile Aberration').name)
      .toBe('Delver of Secrets // Insectile Aberration');
  });

  test('line-start // is a comment or header', () => {
    const parsed = parseDecklist('// just a note\n1 Sol Ring');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.comments).toEqual([{ lineNo: 1, text: 'just a note' }]);
  });

  test('a front-face-only name is left alone for the resolver to handle', () => {
    expect(one('1 Delver of Secrets').name).toBe('Delver of Secrets');
  });

  test('a DFC with a printing', () => {
    expect(one('1 Malakir Rebirth // Malakir Mire (znr) 111')).toMatchObject({
      name: 'Malakir Rebirth // Malakir Mire', set: 'znr', collectorNumber: '111',
    });
  });
});

describe('sections', () => {
  test('// Commander header', () => {
    const parsed = parseDecklist('// Commander\n1 Kess, Dissident Mage\n// Deck\n1 Sol Ring');
    expect(parsed.hadSections).toBe(true);
    expect(parsed.entries.map((e) => e.section)).toEqual(['commander', 'main']);
  });

  test.each([
    'Commander',
    'Commander:',
    'Commander (1)',
    '//Commander',
    '# Commander',
    'COMMANDER',
    'Commanders',
  ])('recognises header %s', (header) => {
    const parsed = parseDecklist(`${header}\n1 Kess, Dissident Mage`);
    expect(parsed.entries[0]!.section).toBe('commander');
  });

  test.each([
    ['Deck', 'main'],
    ['Mainboard', 'main'],
    ['Sideboard', 'sideboard'],
    ['Maybeboard', 'maybeboard'],
    ['Companion', 'companion'],
    ['Tokens', 'tokens'],
  ])('header %s → section %s', (header, expected) => {
    const parsed = parseDecklist(`${header}\n1 Sol Ring`);
    expect(parsed.entries[0]!.section).toBe(expected);
  });

  test('SB: is a per-line prefix, not a header', () => {
    const parsed = parseDecklist('1 Sol Ring\nSB: 1 Lightning Bolt\n1 Forest');
    expect(parsed.entries.map((e) => e.section)).toEqual(['main', 'sideboard', 'main']);
    expect(parsed.entries[1]!.name).toBe('Lightning Bolt');
  });

  test('an unknown // line is a comment, not a section change', () => {
    const parsed = parseDecklist('// Commander\n1 Kess, Dissident Mage\n// ramp package\n1 Sol Ring');
    expect(parsed.entries.map((e) => e.section)).toEqual(['commander', 'commander']);
    expect(parsed.comments.map((c) => c.text)).toEqual(['ramp package']);
  });

  test('no header at all leaves everything in main', () => {
    const parsed = parseDecklist('1 Sol Ring\n1 Forest');
    expect(parsed.hadSections).toBe(false);
    expect(parsed.entries.every((e) => e.section === 'main')).toBe(true);
  });
});

describe('noise and whitespace', () => {
  test('blank lines and padding are ignored', () => {
    const parsed = parseDecklist('\n\n   1 Sol Ring   \n\n');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]!.name).toBe('Sol Ring');
  });

  test('CRLF input', () => {
    const parsed = parseDecklist('1 Sol Ring\r\n1 Forest\r\n');
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[1]!.name).toBe('Forest');
  });

  test('a UTF-8 BOM does not corrupt the first card', () => {
    const parsed = parseDecklist('﻿1 Sol Ring');
    expect(parsed.entries[0]!.name).toBe('Sol Ring');
  });

  test('tabs act as separators', () => {
    expect(one('1\tSol Ring').name).toBe('Sol Ring');
  });

  test.each(['Total: 100', 'Total 100', 'Cards: 99', 'Count: 100'])(
    'ignores the noise line %s',
    (line) => {
      const parsed = parseDecklist(`1 Sol Ring\n${line}`);
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.problems).toEqual([]);
    },
  );

  test('unicode names survive intact', () => {
    // Folding happens in the worker, not here — the parser must not touch these.
    expect(one('1 Lim-Dûl\'s Vault').name).toBe("Lim-Dûl's Vault");
    expect(one('1 Nazgûl').name).toBe('Nazgûl');
    expect(one('1 Æther Vial').name).toBe('Æther Vial');
    expect(one('1 Gríma Wormtongue').name).toBe('Gríma Wormtongue');
  });

  test('line numbers point at the real line', () => {
    const parsed = parseDecklist('// Commander\n\n1 Kess, Dissident Mage\n\n1 Sol Ring');
    expect(parsed.entries.map((e) => e.lineNo)).toEqual([3, 5]);
  });

  test('an unreadable line is reported, never dropped', () => {
    const parsed = parseDecklist('1 Sol Ring\n???\n1 Forest');
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.problems[0]).toMatchObject({ lineNo: 2, raw: '???' });
  });

  test('empty input is not an error', () => {
    const parsed = parseDecklist('');
    expect(parsed.entries).toEqual([]);
    expect(parsed.problems).toEqual([]);
  });
});

describe('grouping and counting', () => {
  const LIST = [
    '// Commander',
    '1 Kess, Dissident Mage',
    '// Deck',
    '1 Sol Ring',
    '30 Island',
    '// Sideboard',
    '1 Lightning Bolt',
    '// Maybeboard',
    '1 Brainstorm',
  ].join('\n');

  test('groups by section', () => {
    const grouped = groupBySection(parseDecklist(LIST));
    expect(grouped.commanders.map((e) => e.name)).toEqual(['Kess, Dissident Mage']);
    expect(grouped.main.map((e) => e.name)).toEqual(['Sol Ring', 'Island']);
    expect(grouped.sideboard.map((e) => e.name)).toEqual(['Lightning Bolt']);
    expect(grouped.ignored.map((e) => e.name)).toEqual(['Brainstorm']);
  });

  test('counts by quantity, not by line', () => {
    const grouped = groupBySection(parseDecklist(LIST));
    expect(countCards(grouped.main)).toBe(31);
    expect(countCards([...grouped.commanders, ...grouped.main])).toBe(32);
  });
});

describe('a realistic export, end to end', () => {
  // Shaped like a Moxfield "Export → Text" paste, with the quirks intact.
  const MOXFIELD = `Commander
1 Kess, Dissident Mage (c17) 39

Deck
1 Sol Ring (ltc) 264
1 Fire // Ice (dmr) 215
1 Æther Vial
1x Lim-Dûl's Vault
9 Nazgûl (ltr) 100
1 Brazen Borrower // Petty Theft *F*
7 Island
2 Mountain

Sideboard
1 Lightning Bolt`;

  test('parses every line without a problem', () => {
    const parsed = parseDecklist(MOXFIELD);
    expect(parsed.problems).toEqual([]);
  });

  test('sections and counts come out right', () => {
    const grouped = groupBySection(parseDecklist(MOXFIELD));
    expect(grouped.commanders).toHaveLength(1);
    expect(countCards(grouped.main)).toBe(1 + 1 + 1 + 1 + 9 + 1 + 7 + 2);
    expect(countCards(grouped.sideboard)).toBe(1);
  });

  test('printings, unicode and flags all survive together', () => {
    const grouped = groupBySection(parseDecklist(MOXFIELD));
    const byName = new Map(grouped.main.map((e) => [e.name, e]));
    expect(byName.get('Sol Ring')).toMatchObject({ set: 'ltc', collectorNumber: '264' });
    expect(byName.get('Fire // Ice')).toMatchObject({ set: 'dmr', collectorNumber: '215' });
    expect(byName.get('Æther Vial')).toBeDefined();
    expect(byName.get("Lim-Dûl's Vault")).toBeDefined();
    expect(byName.get('Nazgûl')).toMatchObject({ quantity: 9 });
    expect(byName.get('Brazen Borrower // Petty Theft')).toMatchObject({ foil: true });
  });
});

// ─── What a deck link actually delivers ───
//
// electron/deckfetch.cjs lifts an MTG Arena export out of a TappedOut deck page.
// This is that text, verbatim from https://tappedout.net/mtg-decks/
// verrak-swamps-matter/ on 2026-07-27, with the middle of the list cut out. The
// parser has to read it with no help, or importing by link silently produces a
// deck of unresolved names — so the format is pinned here rather than trusted.
describe('a decklist downloaded from a link', () => {
  const TAPPEDOUT = `Commander
1x Verrak, Warped Sengir (DMC) 16

Deck
1x Angel of the Ruins (EOC) 63
1x Arguel's Blood Fast (XLN) 90
1x Bolas's Citadel (000) 1
1x Cabal Coffers (000) 10
1x K'rrik, Son of Yawgmoth (000) 8
9x Swamp (ELD) 260
1x Urborg, Tomb of Yawgmoth (TSR) 275

Sideboard
1x Sol Ring (LTC) 264`;

  test('every line is read', () => {
    expect(parseDecklist(TAPPEDOUT).problems).toEqual([]);
  });

  test('the commander comes out of the Commander heading, not a guess', () => {
    const parsed = parseDecklist(TAPPEDOUT);
    expect(parsed.hadSections).toBe(true);
    const grouped = groupBySection(parsed);
    expect(grouped.commanders).toHaveLength(1);
    expect(grouped.commanders[0]).toMatchObject({
      name: 'Verrak, Warped Sengir',
      quantity: 1,
      set: 'DMC',
      collectorNumber: '16',
    });
  });

  test('Arena `Deck` is the mainboard, and quantities are per line', () => {
    const grouped = groupBySection(parseDecklist(TAPPEDOUT));
    expect(countCards(grouped.main)).toBe(6 + 9);
    expect(countCards(grouped.sideboard)).toBe(1);
  });

  test("TappedOut's own set codes stay on the entry rather than breaking the name", () => {
    // `(000)` is TappedOut's placeholder for a printing it cannot name. The
    // card must still resolve, so the NAME has to survive intact — cardindex
    // falls through to name resolution when a set + number matches nothing.
    const byName = new Map(
      groupBySection(parseDecklist(TAPPEDOUT)).main.map((e) => [e.name, e]),
    );
    expect(byName.get('Bolas\'s Citadel')).toMatchObject({ set: '000', collectorNumber: '1' });
    expect(byName.get('K\'rrik, Son of Yawgmoth')).toBeDefined();
    expect(byName.get('Cabal Coffers')).toBeDefined();
  });
});
