import { describe, expect, test } from 'vitest';
import { pickCommanders } from './pickCommanders';
import type { CardData } from './cardTypes';
import type { ResolvedEntry } from './deckTypes';

// ⚠️ Every oracle text, type line and keyword list below is copied VERBATIM from
// the real 2026-07-27 card database (`cardindex.byName`). These rules key off
// exact wording — "Partner (You can have two commanders…)", "Choose a
// Background" — so a paraphrase would test the fixture rather than the card.

let n = 0;
function mk(over: Partial<CardData> & { name: string; typeLine: string; oracleText: string }): CardData {
  n += 1;
  const pad = String(n).padStart(12, '0');
  return {
    scryfallId: `00000000-0000-0000-0000-${pad}`,
    oracleId: `11111111-0000-0000-0000-${pad}`,
    layout: 'normal',
    colorIdentity: over.colorIdentity ?? [],
    cmc: 0,
    keywords: over.keywords ?? [],
    setCode: 'tst',
    collectorNumber: String(n),
    commanderLegality: 'legal',
    singleImage: true,
    faces: [{
      name: over.name,
      manaCost: '',
      typeLine: over.typeLine,
      oracleText: over.oracleText,
      flavorText: null,
      power: '1',
      toughness: '1',
      loyalty: null,
      defense: null,
      colors: [],
      artist: null,
      imageId: `00000000-0000-0000-0000-${pad}`,
    }],
    ...over,
  } as CardData;
}

let line = 0;
function ent(card: CardData | null, quantity = 1, name?: string): ResolvedEntry {
  line += 1;
  return {
    entry: {
      quantity,
      name: name ?? card?.name ?? 'Unknown',
      section: 'main',
      lineNo: line,
      raw: `${quantity} ${name ?? card?.name}`,
    },
    card,
  };
}

// ── the pair out of the user's own import ──
const ARDENN = mk({
  name: 'Ardenn, Intrepid Archaeologist',
  typeLine: 'Legendary Creature — Kor Scout',
  keywords: ['Partner'],
  colorIdentity: ['W'],
  oracleText: 'At the beginning of combat on your turn, you may attach any number of Auras and Equipment you control to target permanent or player.\nPartner (You can have two commanders if both have partner.)',
});
const ROGRAKH = mk({
  name: 'Rograkh, Son of Rohgahh',
  typeLine: 'Legendary Creature — Kobold Warrior',
  keywords: ['First strike', 'Partner', 'Trample', 'Menace'],
  colorIdentity: ['R'],
  oracleText: 'First strike, menace, trample\nPartner (You can have two commanders if both have partner.)',
});

const WILSON = mk({
  name: 'Wilson, Refined Grizzly',
  typeLine: 'Legendary Creature — Bear Warrior',
  keywords: ['Reach', 'Vigilance', 'Choose a background', 'Trample', 'Ward'],
  colorIdentity: ['G'],
  oracleText: "This spell can't be countered.\nVigilance, reach, trample\nWard {2}\nChoose a Background (You can have a Background as a second commander.)",
});
const RAISED_BY_GIANTS = mk({
  name: 'Raised by Giants',
  typeLine: 'Legendary Enchantment — Background',
  colorIdentity: ['G'],
  oracleText: 'Commander creatures you own have base power and toughness 10/10 and are Giants in addition to their other types.',
});

const REGNA = mk({
  name: 'Regna, the Redeemer',
  typeLine: 'Legendary Creature — Angel',
  keywords: ['Flying', 'Partner with', 'Partner'],
  colorIdentity: ['W'],
  oracleText: "Flying\nPartner with Krav, the Unredeemed (When this creature enters, target opponent may put this card into its owner's library third from the top.)",
});
const KRAV = mk({
  name: 'Krav, the Unredeemed',
  typeLine: 'Legendary Creature — Human Warrior',
  keywords: ['Partner with', 'Partner'],
  colorIdentity: ['B'],
  oracleText: 'Partner with Regna, the Redeemer\nSacrifice another creature: Krav gets +1/+1 until end of turn.',
});

const KESS = mk({
  name: 'Kess, Dissident Mage',
  typeLine: 'Legendary Creature — Human Wizard',
  keywords: ['Flying'],
  colorIdentity: ['U', 'B', 'R'],
  oracleText: 'Flying\nDuring each of your turns, you may cast a sorcery or instant spell from your graveyard.',
});

const SOL_RING = mk({
  name: 'Sol Ring', typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.',
});
const ISLAND = mk({
  name: 'Island', typeLine: 'Basic Land — Island', oracleText: '({T}: Add {U}.)', colorIdentity: ['U'],
});

describe('a list that never said which card is the commander', () => {
  test('one legendary creature is the commander', () => {
    const picked = pickCommanders([ent(SOL_RING), ent(KESS), ent(ISLAND)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual(['Kess, Dissident Mage']);
    expect(picked.main.map((r) => r.card?.name)).toEqual(['Sol Ring', 'Island']);
    expect(picked.note).toMatch(/Kess, Dissident Mage is your commander/);
  });

  // ⚠️ THE CASE THIS EXISTS FOR. The old rule took line one whatever it was, so
  // an alphabetical list (TappedOut's ?fmt=txt) made Accorder's Shield the
  // commander and left the real one in the deck.
  test('a leading non-commander is skipped, not promoted', () => {
    const picked = pickCommanders([ent(SOL_RING), ent(ISLAND), ent(KESS)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual(['Kess, Dissident Mage']);
  });

  test('two Partner commanders are BOTH found, in list order', () => {
    const picked = pickCommanders([ent(SOL_RING), ent(ARDENN), ent(ISLAND), ent(ROGRAKH)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual([
      'Ardenn, Intrepid Archaeologist',
      'Rograkh, Son of Rohgahh',
    ]);
    expect(picked.main.map((r) => r.card?.name)).toEqual(['Sol Ring', 'Island']);
    expect(picked.note).toMatch(/both have Partner/);
  });

  test('“Partner with” takes the card it names, not just any partner', () => {
    // Ardenn has plain Partner and comes first in the list; Regna names Krav.
    const picked = pickCommanders([ent(REGNA), ent(ARDENN), ent(KRAV)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual([
      'Regna, the Redeemer',
      'Krav, the Unredeemed',
    ]);
    expect(picked.note).toMatch(/name each other/);
  });

  test('a Background is taken as the second commander', () => {
    const picked = pickCommanders([ent(RAISED_BY_GIANTS), ent(WILSON), ent(ISLAND)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual([
      'Wilson, Refined Grizzly',
      'Raised by Giants',
    ]);
    expect(picked.note).toMatch(/Background/);
  });

  // ⚠️ A Background is never the FIRST commander. Leading with one produces a
  // deck that fails eligibility for a reason the player did not cause.
  test('a Background alone is not made the commander', () => {
    const picked = pickCommanders([ent(RAISED_BY_GIANTS), ent(SOL_RING), ent(ISLAND)]);
    expect(picked.commanders).toEqual([]);
    expect(picked.note).toBeNull();
    expect(picked.main).toHaveLength(3);
  });

  test('a lone Partner commander stays alone when nothing pairs with it', () => {
    const picked = pickCommanders([ent(ARDENN), ent(SOL_RING), ent(ISLAND)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual(['Ardenn, Intrepid Archaeologist']);
    expect(picked.note).toMatch(/is your commander/);
  });

  // Two legendary creatures with no pairing mechanic are NOT a pair.
  test('two plain legends do not become two commanders', () => {
    const other = mk({
      name: 'Talrand, Sky Summoner',
      typeLine: 'Legendary Creature — Merfolk Wizard',
      colorIdentity: ['U'],
      oracleText: 'Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.',
    });
    const picked = pickCommanders([ent(KESS), ent(other), ent(ISLAND)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual(['Kess, Dissident Mage']);
    expect(picked.main.map((r) => r.card?.name)).toEqual(['Talrand, Sky Summoner', 'Island']);
  });

  test('nothing that could be a commander leaves the list untouched', () => {
    const picked = pickCommanders([ent(SOL_RING), ent(ISLAND)]);
    expect(picked.commanders).toEqual([]);
    expect(picked.main).toHaveLength(2);
    expect(picked.note).toBeNull();
  });

  test('an unresolved card is never guessed at', () => {
    const picked = pickCommanders([ent(null, 1, 'Ardenn, Intrepd Archaeologist'), ent(KESS)]);
    expect(picked.commanders.map((r) => r.card?.name)).toEqual(['Kess, Dissident Mage']);
  });

  // A commander entry is ONE card; a second copy is a singleton problem for the
  // validator to report, not a card for the importer to delete.
  test('a duplicate line leaves its second copy in the deck', () => {
    const picked = pickCommanders([ent(KESS, 2), ent(ISLAND)]);
    expect(picked.commanders[0]?.entry.quantity).toBe(1);
    expect(picked.commanders[0]?.entry.section).toBe('commander');
    expect(picked.main.map((r) => [r.card?.name, r.entry.quantity])).toEqual([
      ['Kess, Dissident Mage', 1],
      ['Island', 1],
    ]);
  });
});
