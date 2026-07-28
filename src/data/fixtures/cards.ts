import type { CardData } from '../cardTypes';

// Hand-written fixtures covering every layout the renderer treats differently.
// Oracle text is paraphrased/abbreviated on purpose — these exist to exercise
// layout, not to be a card database, and the real data comes from Scryfall at
// runtime (M1.6).
//
// ⚠️ The scryfallIds are REAL. They were originally invented, which meant the
// fixture screen requested art for cards that do not exist — 18 guaranteed 404s
// on every cold cache, all correctly recorded as permanently dead. Real ids make
// the fixtures behave exactly like real cards, art included. Scryfall ids are
// stable, so these do not rot. `7a8b4f93-…` (Symbol Torture Test) is deliberately
// still synthetic: it is not a real card, and its art is expected to 404.

function face(over: Partial<CardData['faces'][number]> & { name: string; imageId: string }) {
  return {
    manaCost: '',
    typeLine: '',
    oracleText: '',
    flavorText: null,
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [],
    artist: null,
    ...over,
  };
}

function card(over: Partial<CardData> & { scryfallId: string; name: string; faces: CardData['faces'] }): CardData {
  return {
    oracleId: over.scryfallId,
    layout: 'normal',
    colorIdentity: [],
    cmc: 0,
    keywords: [],
    setCode: 'tst',
    collectorNumber: '1',
    commanderLegality: 'legal',
    singleImage: true,
    ...over,
  };
}

export const FIXTURE_CARDS: CardData[] = [
  card({
    scryfallId: 'ccf06e21-b0fb-4fb4-9f3f-c4e721b3cb6f',
    name: 'Fury Sliver',
    cmc: 6,
    colorIdentity: ['R'],
    keywords: ['Double strike'],
    setCode: 'tsp',
    collectorNumber: '157',
    faces: [face({
      name: 'Fury Sliver',
      imageId: 'ccf06e21-b0fb-4fb4-9f3f-c4e721b3cb6f',
      manaCost: '{5}{R}',
      typeLine: 'Creature — Sliver',
      oracleText: 'All Sliver creatures have double strike.',
      flavorText: 'A rack of thorns, a hail of blades.',
      power: '3',
      toughness: '3',
      colors: ['R'],
      artist: 'Paolo Parente',
    })],
  }),

  // The archetypal colourless artifact — and a mana source, so it exercises the
  // colourless pip path.
  card({
    scryfallId: '3d5c99e9-7c3e-4149-82a6-3c7d5d302488',
    name: 'Sol Ring',
    cmc: 1,
    setCode: 'ltc',
    collectorNumber: '264',
    faces: [face({
      name: 'Sol Ring',
      imageId: '3d5c99e9-7c3e-4149-82a6-3c7d5d302488',
      manaCost: '{1}',
      typeLine: 'Artifact',
      oracleText: '{T}: Add {C}{C}.',
      artist: 'Mike Bierek',
    })],
  }),

  // Basic land: no cost, no P/T — the sparsest possible face.
  card({
    scryfallId: '5f533364-0f91-4e49-aaeb-83c4c1f6d316',
    name: 'Forest',
    colorIdentity: ['G'],
    faces: [face({
      name: 'Forest',
      imageId: '5f533364-0f91-4e49-aaeb-83c4c1f6d316',
      typeLine: 'Basic Land — Forest',
      oracleText: '({T}: Add {G}.)',
    })],
  }),

  // Legendary creature = a legal commander, with hybrid mana in the cost.
  card({
    scryfallId: '63a795db-6b70-4534-b6e9-240895875d12',
    name: 'Kess, Dissident Mage',
    cmc: 4,
    colorIdentity: ['U', 'B', 'R'],
    keywords: ['Flying'],
    faces: [face({
      name: 'Kess, Dissident Mage',
      imageId: '63a795db-6b70-4534-b6e9-240895875d12',
      manaCost: '{2}{U}{B}{R}',
      typeLine: 'Legendary Creature — Human Wizard',
      oracleText:
        'Flying\nDuring each of your turns, you may cast an instant or sorcery spell from your graveyard. If a spell cast this way would be put into your graveyard, exile it instead.',
      power: '3',
      toughness: '4',
      colors: ['U', 'B', 'R'],
    })],
  }),

  // TRANSFORM: two faces, an image PER FACE (singleImage: false).
  card({
    scryfallId: 'a808459c-f086-4cb6-a53e-4b9e196c1000',
    name: 'Delver of Secrets // Insectile Aberration',
    layout: 'transform',
    cmc: 1,
    colorIdentity: ['U'],
    singleImage: false,
    faces: [
      face({
        name: 'Delver of Secrets',
        imageId: 'a808459c-f086-4cb6-a53e-4b9e196c1000-0',
        manaCost: '{U}',
        typeLine: 'Creature — Human Wizard',
        oracleText:
          "At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.",
        power: '1',
        toughness: '1',
        colors: ['U'],
      }),
      face({
        name: 'Insectile Aberration',
        imageId: 'a808459c-f086-4cb6-a53e-4b9e196c1000-1',
        typeLine: 'Creature — Human Insect',
        oracleText: 'Flying',
        power: '3',
        toughness: '2',
        colors: ['U'],
      }),
    ],
  }),

  // MODAL DFC: also one image per face, but you choose at cast time.
  card({
    scryfallId: '609d3ecf-f88d-4268-a8d3-4bf2bcf5df60',
    name: 'Malakir Rebirth // Malakir Mire',
    layout: 'modal_dfc',
    cmc: 1,
    colorIdentity: ['B'],
    singleImage: false,
    faces: [
      face({
        name: 'Malakir Rebirth',
        imageId: '609d3ecf-f88d-4268-a8d3-4bf2bcf5df60-0',
        manaCost: '{B}',
        typeLine: 'Instant',
        oracleText:
          'Until end of turn, target creature gains "When this creature dies, return it to the battlefield tapped under its owner\'s control."',
        colors: ['B'],
      }),
      face({
        name: 'Malakir Mire',
        imageId: '609d3ecf-f88d-4268-a8d3-4bf2bcf5df60-1',
        typeLine: 'Land',
        oracleText: 'Malakir Mire enters tapped.\n{T}: Add {B}.',
      }),
    ],
  }),

  // SPLIT: both halves on ONE printed image (singleImage: true).
  card({
    scryfallId: '18303862-4726-4136-814f-157aa7006579',
    name: 'Fire // Ice',
    layout: 'split',
    cmc: 4,
    colorIdentity: ['U', 'R'],
    faces: [
      face({
        name: 'Fire',
        imageId: '18303862-4726-4136-814f-157aa7006579',
        manaCost: '{1}{R}',
        typeLine: 'Instant',
        oracleText: 'Fire deals 2 damage divided as you choose among one or two targets.',
        colors: ['R'],
      }),
      face({
        name: 'Ice',
        imageId: '18303862-4726-4136-814f-157aa7006579',
        manaCost: '{1}{U}',
        typeLine: 'Instant',
        oracleText: 'Tap target permanent.\nDraw a card.',
        colors: ['U'],
      }),
    ],
  }),

  // ADVENTURE: one image, creature + spell halves.
  card({
    scryfallId: '25d309d6-9e56-441e-bd29-5c903d5221bf',
    name: 'Brazen Borrower // Petty Theft',
    layout: 'adventure',
    cmc: 3,
    colorIdentity: ['U'],
    keywords: ['Flash', 'Flying'],
    faces: [
      face({
        name: 'Brazen Borrower',
        imageId: '25d309d6-9e56-441e-bd29-5c903d5221bf',
        manaCost: '{1}{U}{U}',
        typeLine: 'Creature — Faerie Rogue',
        oracleText: 'Flash\nFlying\nThis creature can block only creatures with flying.',
        power: '3',
        toughness: '1',
        colors: ['U'],
      }),
      face({
        name: 'Petty Theft',
        imageId: '25d309d6-9e56-441e-bd29-5c903d5221bf',
        manaCost: '{1}{U}',
        typeLine: 'Instant — Adventure',
        oracleText: "Return target nonland permanent an opponent controls to its owner's hand.",
        colors: ['U'],
      }),
    ],
  }),

  // Planeswalker: loyalty instead of power/toughness.
  card({
    scryfallId: '1913788b-36d3-4488-a744-71e52b1ecb5c',
    name: 'Chandra, Torch of Defiance',
    layout: 'normal',
    cmc: 4,
    colorIdentity: ['R'],
    faces: [face({
      name: 'Chandra, Torch of Defiance',
      imageId: '1913788b-36d3-4488-a744-71e52b1ecb5c',
      manaCost: '{2}{R}{R}',
      typeLine: 'Legendary Planeswalker — Chandra',
      oracleText:
        '+1: Exile the top card of your library. You may cast that card.\n+1: Add {R}{R}.\n−3: Chandra deals 4 damage to target creature.\n−7: You get an emblem.',
      loyalty: '4',
      colors: ['R'],
    })],
  }),

  // Every exotic symbol shape in one cost: phyrexian, twobrid, hybrid, snow, X.
  card({
    scryfallId: '7a8b4f93-5c9b-4f4b-8a5d-9b4c3d6e0006',
    name: 'Symbol Torture Test',
    cmc: 9,
    colorIdentity: ['W', 'U', 'B', 'R', 'G'],
    faces: [face({
      name: 'Symbol Torture Test',
      imageId: '7a8b4f93-5c9b-4f4b-8a5d-9b4c3d6e0006',
      manaCost: '{X}{2/W}{U/B}{B/G/P}{R/P}{S}{C}{4}',
      typeLine: 'Artifact Creature — Construct',
      oracleText: 'Renders every symbol shape the parser must handle.',
      power: '*',
      toughness: '*',
    })],
  }),
];

export const FIXTURE_BY_NAME = new Map(FIXTURE_CARDS.map((c) => [c.name, c]));
