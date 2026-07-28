import { describe, expect, test } from 'vitest';
import {
  canBeCommander,
  commanderEligibility,
  copyLimit,
  pairingOf,
  unionIdentity,
  validateCommanderDeck,
} from './validate';
import type { CardData } from './cardTypes';
import type { ResolvedEntry } from './deckTypes';

// ⚠️ Every oracle text and type line below is copied VERBATIM from the real
// 2026-07-26 Scryfall data. That matters: these rules key off exact wording ("up
// to nine cards named"), so a paraphrase would test the fixture rather than the
// card. `scripts/battery-carddb.cjs` cross-checks the real cards still say this,
// so if Scryfall rewords something, that battery fails rather than these tests
// silently passing against stale assumptions.

let lineCounter = 0;

function mk(over: Partial<CardData> & { name: string }): CardData {
  return {
    scryfallId: `00000000-0000-0000-0000-${String(++lineCounter).padStart(12, '0')}`,
    oracleId: `11111111-0000-0000-0000-${String(lineCounter).padStart(12, '0')}`,
    layout: 'normal',
    colorIdentity: [],
    cmc: 0,
    keywords: [],
    setCode: 'tst',
    collectorNumber: String(lineCounter),
    commanderLegality: 'legal',
    singleImage: true,
    faces: [{
      name: over.name,
      manaCost: '',
      typeLine: 'Creature — Human',
      oracleText: '',
      flavorText: null,
      power: '1',
      toughness: '1',
      loyalty: null,
      defense: null,
      colors: [],
      artist: null,
      imageId: `00000000-0000-0000-0000-${String(lineCounter).padStart(12, '0')}`,
    }],
    ...over,
  };
}

function face(card: CardData, over: Partial<CardData['faces'][number]>): CardData {
  return { ...card, faces: [{ ...card.faces[0]!, ...over }] };
}

let entryLine = 0;
function ent(card: CardData | null, quantity = 1, name?: string): ResolvedEntry {
  entryLine += 1;
  return {
    entry: {
      quantity,
      name: name ?? card?.name ?? 'Unknown',
      section: 'main',
      lineNo: entryLine,
      raw: `${quantity} ${name ?? card?.name}`,
    },
    card,
  };
}

// ── real cards, real text ──

const SOL_RING = face(mk({ name: 'Sol Ring', cmc: 1 }), {
  typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}.', power: null, toughness: null,
});

const ISLAND = face(mk({ name: 'Island', colorIdentity: ['U'] }), {
  typeLine: 'Basic Land — Island', oracleText: '({T}: Add {U}.)', power: null, toughness: null,
});

const WASTES = face(mk({ name: 'Wastes' }), {
  typeLine: 'Basic Land', oracleText: '{T}: Add {C}.', power: null, toughness: null,
});

const SNOW_PLAINS = face(mk({ name: 'Snow-Covered Plains', colorIdentity: ['W'] }), {
  typeLine: 'Basic Snow Land — Plains', oracleText: '({T}: Add {W}.)',
  power: null, toughness: null,
});

const NAZGUL = face(mk({ name: 'Nazgûl', colorIdentity: ['B'], keywords: ['Deathtouch'] }), {
  typeLine: 'Creature — Wraith Knight',
  oracleText: 'Deathtouch\nWhen this creature enters, the Ring tempts you.\nWhenever the Ring tempts you, put a +1/+1 counter on each Wraith you control.\nA deck can have up to nine cards named Nazgûl.',
});

const SEVEN_DWARVES = face(mk({ name: 'Seven Dwarves', colorIdentity: ['R'] }), {
  typeLine: 'Creature — Dwarf',
  oracleText: 'This creature gets +1/+1 for each other creature named Seven Dwarves you control.\nA deck can have up to seven cards named Seven Dwarves.',
});

const RELENTLESS_RATS = face(mk({ name: 'Relentless Rats', colorIdentity: ['B'] }), {
  typeLine: 'Creature — Rat',
  oracleText: 'This creature gets +1/+1 for each other creature on the battlefield named Relentless Rats.\nA deck can have any number of cards named Relentless Rats.',
});

const KESS = face(mk({ name: 'Kess, Dissident Mage', colorIdentity: ['U', 'B', 'R'], keywords: ['Flying'] }), {
  typeLine: 'Legendary Creature — Human Wizard',
  oracleText: 'Flying\nDuring each of your turns, you may cast an instant or sorcery spell from your graveyard.',
});

const FARSEEK = face(mk({ name: 'Farseek', colorIdentity: ['G'] }), {
  typeLine: 'Sorcery',
  oracleText: 'Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.',
  power: null, toughness: null,
});

const GOLOS = face(mk({
  name: 'Golos, Tireless Pilgrim',
  colorIdentity: ['W', 'U', 'B', 'R', 'G'],
  commanderLegality: 'banned',
}), {
  typeLine: 'Legendary Artifact Creature — Scout',
  oracleText: 'When Golos enters, you may search your library for a land card, put that card onto the battlefield tapped, then shuffle.',
});

const GRIST = face(mk({ name: 'Grist, the Hunger Tide', colorIdentity: ['B', 'G'], keywords: ['Mill'] }), {
  typeLine: 'Legendary Planeswalker — Grist',
  oracleText: "As long as Grist isn't on the battlefield, it's a 1/1 Insect creature in addition to its other types.",
  power: null, toughness: null, loyalty: '3',
});

const SHORIKAI = face(mk({ name: 'Shorikai, Genesis Engine', colorIdentity: ['U', 'W'], keywords: ['Crew'] }), {
  typeLine: 'Legendary Artifact — Vehicle',
  oracleText: '{1}, {T}: Draw two cards, then discard a card.\nCrew 8',
  power: '0', toughness: '6',
});

const THRASIOS = face(mk({
  name: 'Thrasios, Triton Hero', colorIdentity: ['G', 'U'], keywords: ['Partner', 'Scry'],
}), {
  typeLine: 'Legendary Creature — Merfolk Wizard',
  oracleText: '{4}: Scry 1, then reveal the top card of your library.\nPartner (You can have two commanders if both have partner.)',
});

const VIAL_SMASHER = face(mk({
  name: 'Vial Smasher the Fierce', colorIdentity: ['B', 'R'], keywords: ['Partner'],
}), {
  typeLine: 'Legendary Creature — Goblin Berserker',
  oracleText: "Whenever you cast your first spell each turn, choose an opponent at random.\nPartner (You can have two commanders if both have partner.)",
});

const REGNA = face(mk({
  name: 'Regna, the Redeemer', colorIdentity: ['W'], keywords: ['Flying', 'Partner with', 'Partner'],
}), {
  typeLine: 'Legendary Creature — Angel',
  oracleText: 'Flying\nPartner with Krav, the Unredeemed (When this creature enters, target opponent may put this card into its owner\'s library third from the top.)',
});

const KRAV = face(mk({
  name: 'Krav, the Unredeemed', colorIdentity: ['B'], keywords: ['Partner with', 'Partner'],
}), {
  typeLine: 'Legendary Creature — Demon',
  oracleText: 'Partner with Regna, the Redeemer\nSacrifice another creature: Krav gets +1/+1 until end of turn.',
});

const WILSON = face(mk({
  name: 'Wilson, Refined Grizzly',
  colorIdentity: ['G'],
  keywords: ['Reach', 'Vigilance', 'Choose a background', 'Trample', 'Ward'],
}), {
  typeLine: 'Legendary Creature — Bear Warrior',
  oracleText: "This spell can't be countered.\nVigilance, reach, trample\nWard {2}\nChoose a Background (You can have a Background as a second commander.)",
});

const RAISED_BY_GIANTS = face(mk({ name: 'Raised by Giants', colorIdentity: ['G'] }), {
  typeLine: 'Legendary Enchantment — Background',
  oracleText: 'Commander creatures you own get +2/+2 and are Giants in addition to their other types.',
  power: null, toughness: null,
});

const TENTH_DOCTOR = face(mk({
  name: 'The Tenth Doctor', colorIdentity: ['U', 'R'],
  keywords: ['Allons-y!', 'Time Travel', 'Timey-Wimey'],
}), {
  typeLine: 'Legendary Creature — Time Lord Doctor',
  oracleText: 'Whenever this creature attacks, you may suspend a card.',
});

const ROSE_TYLER = face(mk({
  name: 'Rose Tyler', colorIdentity: ['W'], keywords: ['Bad Wolf', "Doctor's companion"],
}), {
  typeLine: 'Legendary Creature — Human',
  oracleText: "Doctor's companion (You can have two commanders if the other is the Doctor.)",
});

// ─────────────────────────────────────────────────────────────────

describe('copyLimit — singleton exceptions come from card text', () => {
  test('an ordinary card is limited to one', () => {
    expect(copyLimit(SOL_RING)).toBe(1);
    expect(copyLimit(KESS)).toBe(1);
  });

  test('basic lands are unlimited', () => {
    expect(copyLimit(ISLAND)).toBe(Infinity);
  });

  test('Wastes is a basic land despite having no subtype', () => {
    expect(copyLimit(WASTES)).toBe(Infinity);
  });

  test('Snow-Covered lands are basic ("Basic Snow Land — Plains")', () => {
    expect(copyLimit(SNOW_PLAINS)).toBe(Infinity);
  });

  test('"any number of cards named" is unlimited', () => {
    expect(copyLimit(RELENTLESS_RATS)).toBe(Infinity);
  });

  test('Nazgûl allows exactly nine', () => {
    expect(copyLimit(NAZGUL)).toBe(9);
  });

  test('Seven Dwarves allows exactly seven', () => {
    expect(copyLimit(SEVEN_DWARVES)).toBe(7);
  });
});

describe('commanderEligibility', () => {
  test('a legendary creature is eligible', () => {
    expect(commanderEligibility(KESS)).toBe('yes');
  });

  test('a non-legendary card is definitively not', () => {
    expect(commanderEligibility(SOL_RING)).toBe('no');
    expect(commanderEligibility(FARSEEK)).toBe('no');
  });

  test('Grist is eligible by rules-committee ruling despite reading Planeswalker', () => {
    expect(commanderEligibility(GRIST)).toBe('yes');
  });

  test('Shorikai — a legendary Vehicle — is eligible', () => {
    // Its text says nothing about being a commander, and it is not a creature,
    // yet it heads a real preconstructed deck.
    expect(commanderEligibility(SHORIKAI)).toBe('yes');
  });

  test('"can be your commander" is honoured', () => {
    const elminster = face(mk({ name: 'Elminster' }), {
      typeLine: 'Legendary Planeswalker — Elminster',
      oracleText: 'Elminster can be your commander.',
      power: null, toughness: null,
    });
    expect(commanderEligibility(elminster)).toBe('yes');
  });

  test('an unrecognised legendary non-creature is "unknown", not "no"', () => {
    const relic = face(mk({ name: 'Some Legendary Relic' }), {
      typeLine: 'Legendary Artifact', oracleText: 'Do a thing.', power: null, toughness: null,
    });
    expect(commanderEligibility(relic)).toBe('unknown');
    expect(canBeCommander(relic)).toBe(true);
  });

  test('a card that is only a creature on its BACK face is not eligible', () => {
    const backOnly: CardData = {
      ...mk({ name: 'Front Land // Back Creature' }),
      singleImage: false,
      faces: [
        { ...KESS.faces[0]!, name: 'Front Land', typeLine: 'Land', oracleText: '', power: null, toughness: null },
        { ...KESS.faces[0]!, name: 'Back Creature', typeLine: 'Legendary Creature — Avatar' },
      ],
    };
    expect(commanderEligibility(backOnly)).toBe('no');
  });
});

describe('pairingOf', () => {
  test.each([
    [THRASIOS, 'partner'],
    [VIAL_SMASHER, 'partner'],
    [REGNA, 'partner-with'],
    [WILSON, 'choose-background'],
    [RAISED_BY_GIANTS, 'background'],
    [TENTH_DOCTOR, 'doctor'],
    [ROSE_TYLER, 'doctors-companion'],
    [KESS, null],
    [SOL_RING, null],
  ])('$name', (card, expected) => {
    expect(pairingOf(card as CardData)).toBe(expected);
  });

  test('"Partner with" is not mistaken for plain Partner', () => {
    // Regna's keywords contain both, and its text contains the word "Partner".
    expect(pairingOf(REGNA)).toBe('partner-with');
  });
});

describe('unionIdentity', () => {
  test('single commander', () => {
    expect(unionIdentity([KESS])).toEqual(['U', 'B', 'R']);
  });

  test('two commanders union, in WUBRG order', () => {
    expect(unionIdentity([THRASIOS, VIAL_SMASHER])).toEqual(['U', 'B', 'R', 'G']);
  });

  test('colourless commander', () => {
    expect(unionIdentity([SHORIKAI])).toEqual(['W', 'U']);
  });

  test('no commanders', () => {
    expect(unionIdentity([])).toEqual([]);
  });
});

// ── whole-deck validation ──

/** Build a legal 100-card deck around a commander, padded with basics. */
function deckOf(
  commander: CardData | CardData[],
  extras: ResolvedEntry[] = [],
  padWith: CardData = ISLAND,
) {
  entryLine = 0;
  const commanders = (Array.isArray(commander) ? commander : [commander]).map((c) => ent(c));
  const used = commanders.length + extras.reduce((s, e) => s + e.entry.quantity, 0);
  const main = [...extras, ent(padWith, 100 - used)];
  return { commanders, main };
}

describe('deck size', () => {
  test('exactly 100 passes', () => {
    const { commanders, main } = deckOf(KESS);
    const report = validateCommanderDeck(commanders, main);
    expect(report.counts.total).toBe(100);
    expect(report.issues.filter((i) => i.code === 'deck-size')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test('99 says how many to add', () => {
    entryLine = 0;
    const report = validateCommanderDeck([ent(KESS)], [ent(ISLAND, 98)]);
    const issue = report.issues.find((i) => i.code === 'deck-size');
    expect(issue?.message).toContain('add 1');
    expect(report.ok).toBe(false);
  });

  test('103 says how many to remove', () => {
    entryLine = 0;
    const report = validateCommanderDeck([ent(KESS)], [ent(ISLAND, 102)]);
    const issue = report.issues.find((i) => i.code === 'deck-size');
    expect(issue?.message).toContain('remove 3');
    expect(issue?.detail).toMatchObject({ total: 103, delta: 3 });
  });

  test('the commander counts toward the 100', () => {
    entryLine = 0;
    const report = validateCommanderDeck([ent(KESS)], [ent(ISLAND, 99)]);
    expect(report.counts.total).toBe(100);
    expect(report.issues.filter((i) => i.code === 'deck-size')).toEqual([]);
  });
});

describe('singleton', () => {
  test('two copies of one card fails', () => {
    const { commanders, main } = deckOf(KESS, [ent(SOL_RING, 2)]);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'singleton');
    expect(issue?.cardName).toBe('Sol Ring');
    expect(issue?.message).toContain('singleton');
  });

  test('many basic lands pass', () => {
    const { commanders, main } = deckOf(KESS);
    expect(validateCommanderDeck(commanders, main).issues
      .filter((i) => i.code === 'singleton')).toEqual([]);
  });

  test('nine Nazgûl pass', () => {
    const { commanders, main } = deckOf(mkBlackCommander(), [ent(NAZGUL, 9)], SWAMP);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.filter((i) => i.code === 'singleton')).toEqual([]);
  });

  test('ten Nazgûl fail, and the message states the real limit', () => {
    const { commanders, main } = deckOf(mkBlackCommander(), [ent(NAZGUL, 10)], SWAMP);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'singleton');
    expect(issue?.cardName).toBe('Nazgûl');
    expect(issue?.detail).toMatchObject({ quantity: 10, limit: 9 });
    expect(issue?.message).toContain('up to 9');
  });

  test('thirty Relentless Rats pass', () => {
    const { commanders, main } = deckOf(mkBlackCommander(), [ent(RELENTLESS_RATS, 30)], SWAMP);
    expect(validateCommanderDeck(commanders, main).issues
      .filter((i) => i.code === 'singleton')).toEqual([]);
  });

  test('quantities on separate lines are summed', () => {
    // `1 Sol Ring` twice is still two Sol Rings.
    const { commanders, main } = deckOf(KESS, [ent(SOL_RING, 1), ent(SOL_RING, 1)]);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.find((i) => i.code === 'singleton')?.detail)
      .toMatchObject({ quantity: 2 });
  });
});

const SWAMP = face(mk({ name: 'Swamp', colorIdentity: ['B'] }), {
  typeLine: 'Basic Land — Swamp', oracleText: '({T}: Add {B}.)', power: null, toughness: null,
});

function mkBlackCommander(): CardData {
  return face(mk({ name: 'Black Commander', colorIdentity: ['B'] }), {
    typeLine: 'Legendary Creature — Zombie', oracleText: 'Menace',
  });
}

describe('colour identity', () => {
  test('a card outside the identity fails, naming the offending colour', () => {
    const { commanders, main } = deckOf(KESS, [ent(FARSEEK)]);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'color-identity');
    expect(issue?.cardName).toBe('Farseek');
    expect(issue?.detail).toMatchObject({ offending: ['G'], identity: ['U', 'B', 'R'] });
    expect(issue?.message).toContain('{G}');
    expect(report.ok).toBe(false);
  });

  test('a card inside the identity passes', () => {
    const brainstorm = face(mk({ name: 'Brainstorm', colorIdentity: ['U'] }), {
      typeLine: 'Instant', oracleText: 'Draw three cards, then put two back.',
      power: null, toughness: null,
    });
    const { commanders, main } = deckOf(KESS, [ent(brainstorm)]);
    expect(validateCommanderDeck(commanders, main).issues
      .filter((i) => i.code === 'color-identity')).toEqual([]);
  });

  test('colourless cards are always allowed', () => {
    const { commanders, main } = deckOf(KESS, [ent(SOL_RING)]);
    expect(validateCommanderDeck(commanders, main).issues
      .filter((i) => i.code === 'color-identity')).toEqual([]);
  });

  test('two commanders widen the identity', () => {
    // Farseek is green; Thrasios provides green.
    const { commanders, main } = deckOf([THRASIOS, VIAL_SMASHER], [ent(FARSEEK)]);
    const report = validateCommanderDeck(commanders, main);
    expect(report.colorIdentity).toEqual(['U', 'B', 'R', 'G']);
    expect(report.issues.filter((i) => i.code === 'color-identity')).toEqual([]);
  });

  test('identity is reported even when the deck is otherwise broken', () => {
    entryLine = 0;
    const report = validateCommanderDeck([ent(KESS)], [ent(ISLAND, 1)]);
    expect(report.colorIdentity).toEqual(['U', 'B', 'R']);
  });
});

describe('commander legality', () => {
  test('a missing commander is reported', () => {
    entryLine = 0;
    const report = validateCommanderDeck([], [ent(ISLAND, 100)]);
    expect(report.issues.some((i) => i.code === 'commander-missing')).toBe(true);
  });

  test('a non-legendary commander is an error', () => {
    const { commanders, main } = deckOf(SOL_RING);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'commander-illegal');
    expect(issue?.severity).toBe('error');
    expect(report.ok).toBe(false);
  });

  test('a legendary non-creature is a WARNING, not a blocking error', () => {
    const relic = face(mk({ name: 'Some Legendary Relic' }), {
      typeLine: 'Legendary Artifact', oracleText: 'Do a thing.', power: null, toughness: null,
    });
    const { commanders, main } = deckOf(relic, [], WASTES);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'commander-illegal');
    expect(issue?.severity).toBe('warning');
    expect(report.ok).toBe(true);
  });

  test('Grist is accepted', () => {
    const { commanders, main } = deckOf(GRIST, [], SWAMP);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.filter((i) => i.code === 'commander-illegal')).toEqual([]);
  });

  test('three commanders is an error', () => {
    entryLine = 0;
    const report = validateCommanderDeck(
      [ent(THRASIOS), ent(VIAL_SMASHER), ent(KESS)],
      [ent(ISLAND, 97)],
    );
    expect(report.issues.some((i) => i.code === 'commander-too-many')).toBe(true);
  });

  test('the same commander listed twice is an error', () => {
    entryLine = 0;
    const report = validateCommanderDeck([ent(KESS, 2)], [ent(ISLAND, 98)]);
    expect(report.issues.some((i) => i.code === 'commander-too-many')).toBe(true);
  });
});

describe('two-commander pairings', () => {
  test('Partner + Partner is legal', () => {
    const { commanders, main } = deckOf([THRASIOS, VIAL_SMASHER]);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.filter((i) => i.code === 'partner-mismatch')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test('Partner with names each other', () => {
    const { commanders, main } = deckOf([REGNA, KRAV], [], SWAMP);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.filter((i) => i.code === 'partner-mismatch')).toEqual([]);
  });

  test('Partner with a card it does not name fails', () => {
    const { commanders, main } = deckOf([REGNA, THRASIOS]);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.some((i) => i.code === 'partner-mismatch')).toBe(true);
  });

  test('Choose a Background + Background is legal, and the Background is not flagged', () => {
    // Regression: judging the Background alone reported "cannot be a commander"
    // for a perfectly legal pair.
    const { commanders, main } = deckOf([WILSON, RAISED_BY_GIANTS], [], FOREST);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.filter((i) => i.code === 'partner-mismatch')).toEqual([]);
    expect(report.issues.filter((i) => i.code === 'commander-illegal')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  test('a Doctor and its companion is legal', () => {
    const { commanders, main } = deckOf([TENTH_DOCTOR, ROSE_TYLER], [], ISLAND);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.filter((i) => i.code === 'partner-mismatch')).toEqual([]);
  });

  test('two unrelated legendary creatures cannot pair', () => {
    const { commanders, main } = deckOf([KESS, mkBlackCommander()]);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'partner-mismatch');
    expect(issue?.message).toContain('cannot be played together');
  });
});

const FOREST = face(mk({ name: 'Forest', colorIdentity: ['G'] }), {
  typeLine: 'Basic Land — Forest', oracleText: '({T}: Add {G}.)', power: null, toughness: null,
});

describe('ban list', () => {
  test('a banned card is an error', () => {
    const { commanders, main } = deckOf(KESS, [ent(GOLOS)]);
    const report = validateCommanderDeck(commanders, main);
    const issue = report.issues.find((i) => i.code === 'banned');
    expect(issue?.cardName).toBe('Golos, Tireless Pilgrim');
    expect(report.ok).toBe(false);
  });

  test('a not-legal card gets its own distinct code', () => {
    const unset = face(mk({ name: 'Silly Un-Card', commanderLegality: 'not_legal' }), {
      typeLine: 'Creature — Clown', oracleText: 'Do something silly.',
    });
    const { commanders, main } = deckOf(KESS, [ent(unset)]);
    const report = validateCommanderDeck(commanders, main);
    expect(report.issues.some((i) => i.code === 'not-legal-in-format')).toBe(true);
    expect(report.issues.some((i) => i.code === 'banned')).toBe(false);
  });
});

describe('unresolved names', () => {
  test('an unknown card is an error carrying its line number', () => {
    entryLine = 0;
    const missing: ResolvedEntry = {
      entry: { quantity: 1, name: 'Sol Rng', section: 'main', lineNo: 7, raw: '1 Sol Rng' },
      card: null,
      suggestions: ['Sol Ring', 'Sol Talisman'],
    };
    const report = validateCommanderDeck([ent(KESS)], [missing, ent(ISLAND, 98)]);
    const issue = report.issues.find((i) => i.code === 'unresolved');
    expect(issue?.lineNo).toBe(7);
    expect(issue?.message).toContain('Sol Ring');
    expect(issue?.detail).toMatchObject({ suggestions: ['Sol Ring', 'Sol Talisman'] });
  });

  test('with no suggestions it still says what to do', () => {
    entryLine = 0;
    const missing: ResolvedEntry = {
      entry: { quantity: 1, name: 'Zzzzz', section: 'main', lineNo: 2, raw: '1 Zzzzz' },
      card: null,
    };
    const report = validateCommanderDeck([ent(KESS)], [missing, ent(ISLAND, 98)]);
    expect(report.issues.find((i) => i.code === 'unresolved')?.message)
      .toContain('update the card database');
  });
});

describe('warnings and the soft gate', () => {
  test('a sideboard is a warning, not an error', () => {
    const { commanders, main } = deckOf(KESS);
    const report = validateCommanderDeck(commanders, main, [ent(SOL_RING)]);
    const issue = report.issues.find((i) => i.code === 'sideboard-ignored');
    expect(issue?.severity).toBe('warning');
    expect(report.ok).toBe(true);
  });

  test('stale card data is a warning', () => {
    const { commanders, main } = deckOf(KESS);
    const report = validateCommanderDeck(commanders, main, [], {
      cardDataUpdatedAt: '2026-01-01T00:00:00Z',
      now: Date.parse('2026-07-26T00:00:00Z'),
    });
    const issue = report.issues.find((i) => i.code === 'stale-card-data');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toMatch(/\d+ days old/);
  });

  test('fresh card data raises no staleness warning', () => {
    const { commanders, main } = deckOf(KESS);
    const report = validateCommanderDeck(commanders, main, [], {
      cardDataUpdatedAt: '2026-07-20T00:00:00Z',
      now: Date.parse('2026-07-26T00:00:00Z'),
    });
    expect(report.issues.filter((i) => i.code === 'stale-card-data')).toEqual([]);
  });

  test('houseRuled reports everything but does not block', () => {
    const { commanders, main } = deckOf(KESS, [ent(GOLOS), ent(FARSEEK)]);
    const strict = validateCommanderDeck(commanders, main);
    const relaxed = validateCommanderDeck(commanders, main, [], { houseRuled: true });
    expect(strict.ok).toBe(false);
    expect(relaxed.ok).toBe(true);
    // Crucially, the issues are still all there to read.
    expect(relaxed.issues.length).toBe(strict.issues.length);
    expect(relaxed.issues.some((i) => i.code === 'banned')).toBe(true);
  });
});

describe('a fully legal deck reports nothing', () => {
  test('Kess, 99 legal cards', () => {
    const { commanders, main } = deckOf(KESS, [ent(SOL_RING)]);
    const report = validateCommanderDeck(commanders, main, [], {
      cardDataUpdatedAt: new Date().toISOString(),
    });
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.counts).toMatchObject({ total: 100, commanders: 1 });
  });
});
