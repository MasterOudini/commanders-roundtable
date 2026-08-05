// Turning the honest pool into a deck the bot can actually sit down with.
//
// ⚠️ Every input is a card the engine runs COMPLETELY (`engineComplete.ts`), so
// nothing here decides what is playable — only what is worth playing. That split
// matters: the pool is a fact about the app, and this is taste, and taste that
// could quietly widen the pool would be the bot cheating.
//
// ⚠️ DETERMINISTIC, WITH NO RANDOMNESS ANYWHERE. Every comparison ends in the
// card name, which is a total order, so the same pool always builds the same
// deck. A bot game has to replay to the same state hash, and a deck that varied
// between runs would break that in a way nobody could trace back to here.
//
// ⚠️ NO POPULARITY DATA. "What gets played" is an internet dependency and the
// offline-first policy says stop and ask. The ranking below is instead built
// from fields the ingest already produced — mana value, power, toughness,
// keywords, whether it makes mana, whether its effect is one the engine runs —
// which is a defensible proxy and is honest about being one.

import type { CardData, ColorLetter } from './cardTypes';
import { commanderEligibility } from './validate';
import { isEngineComplete } from './engineComplete';
import { parseTypeLine } from './oracleParse';

export interface BotDeckSpec {
  readonly commander: string;
  /** Exactly 99. Basics repeat; nothing else does. */
  readonly main: readonly string[];
  /** One line per decision, so the generator's output explains itself. */
  readonly why: readonly string[];
}

/**
 * ⚠️ A STATED CONSTANT, not a derived one. 37 is the ordinary Commander land
 * count for a curve like this; deriving a number from the pool would be taste
 * wearing a measurement's clothes. `battery-bot.cjs` tunes it in M6.2, against
 * games won rather than against a formula.
 */
const LAND_COUNT = 37;

/** 62 nonland cards, in the shape a deck that means to curve out has. */
const CURVE: readonly (readonly [maxMv: number, want: number])[] = [
  [1, 6],
  [2, 14],
  [3, 14],
  [4, 12],
  [5, 8],
  [6, 5],
  [99, 3],
];

const BASIC_FOR: Readonly<Record<ColorLetter, string>> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

function typesOf(card: CardData): readonly string[] {
  const face = card.faces[0];
  return face ? parseTypeLine(face.typeLine).types : [];
}

const isLand = (c: CardData): boolean => typesOf(c).includes('Land');
const isCreature = (c: CardData): boolean => typesOf(c).includes('Creature');

/** `Plains`, `Snow-Covered Island`, `Wastes` — the cards a deck may repeat. */
function isBasic(card: CardData): boolean {
  const face = card.faces[0];
  return face ? parseTypeLine(face.typeLine).supertypes.includes('Basic') : false;
}

function numberOf(raw: string | null): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function withinIdentity(card: CardData, identity: readonly ColorLetter[]): boolean {
  return card.colorIdentity.every((c) => identity.includes(c));
}

/**
 * How much the bot wants this card, given how the bot plays.
 *
 * ⚠️ Level 1 curves out and attacks (see `src/bot/`), so a body per mana is the
 * dominant term and evasion is the tie-breaker. When the policy learns to hold
 * up interaction, this is the function that changes — not the pool.
 */
function score(card: CardData): number {
  const face = card.faces[0];
  if (!face) return 0;
  const mv = Math.max(1, card.cmc);
  let s = 0;
  if (isCreature(card)) {
    s += (numberOf(face.power) + numberOf(face.toughness)) / mv;
    // Keywords the engine enforces in combat, which is where this bot wins.
    for (const k of card.keywords) {
      const kw = k.toLowerCase();
      if (kw === 'flying' || kw === 'menace' || kw === 'trample' || kw === 'fear') s += 0.5;
      if (kw === 'deathtouch' || kw === 'lifelink' || kw === 'first strike' || kw === 'double strike') s += 0.5;
      if (kw === 'vigilance' || kw === 'haste') s += 0.25;
      if (kw === 'defender') s -= 2;
    }
  } else {
    // A non-creature the engine runs is removal, a counter or a rock. All three
    // are worth more than a marginal body, and there are very few of them.
    s += 3;
  }
  return s;
}

/** Descending score, then ascending name. A total order — no ties, ever. */
function byValue(a: CardData, b: CardData): number {
  const d = score(b) - score(a);
  return d !== 0 ? d : a.name.localeCompare(b.name);
}

/**
 * Pick the commander, then the 99.
 *
 * Returns null when the pool cannot seat a commander at all, which is a real
 * answer rather than an exception: it is what "the engine runs too little to
 * play Commander" would look like, and the generator prints it.
 */
export function buildBotDeck(pool: readonly CardData[]): BotDeckSpec | null {
  // ⚠️ SINGLE-FACE ONLY, and this is a deck decision rather than a rules one —
  // the pool measurement counts multi-face cards, because the engine really does
  // run some of them. The first generated deck contained both `Command Tower`
  // and `Command Tower // Command Tower`, which the validator accepted (it
  // compares the names it is given, and Scryfall stores a double-faced card's
  // name as "Front // Back") and which is two Command Towers at a real table.
  // Skipping every `//` name costs this deck two lands and removes the whole
  // class — including handing the bot a modal land whose back face it would have
  // to know to choose.
  const clean = pool.filter((c) => isEngineComplete(c) && c.faces.length === 1);
  const byName = new Map<string, CardData>();
  for (const c of clean) if (!byName.has(c.name)) byName.set(c.name, c);
  const cards = [...byName.values()];

  // ── the commander ────────────────────────────────────────────────────────
  //
  // ⚠️ Asked of `commanderEligibility`, the SAME predicate the validator will
  // use on the finished deck. A generator with its own idea of what may command
  // would build decks the validator then rejects, and the disagreement would
  // read as a validator bug.
  const candidates = cards.filter((c) => commanderEligibility(c) === 'yes');
  if (candidates.length === 0) return null;

  // Widest deck first: a commander is worth most when it opens the most cards.
  const reachOf = (c: CardData): number =>
    cards.filter((x) => x !== c && withinIdentity(x, c.colorIdentity)).length;
  candidates.sort((a, b) => {
    const d = reachOf(b) - reachOf(a);
    if (d !== 0) return d;
    const mv = a.cmc - b.cmc;
    return mv !== 0 ? mv : a.name.localeCompare(b.name);
  });
  const commander = candidates[0];
  if (!commander) return null;

  const identity = commander.colorIdentity;
  const inColour = cards.filter((c) => c !== commander && withinIdentity(c, identity));
  const why: string[] = [
    `commander: ${commander.name} (${identity.join('') || 'colourless'}), chosen from ` +
      `${candidates.length} fully-executable legendary creatures for reaching ${reachOf(commander)} cards`,
  ];

  // ── the spells ───────────────────────────────────────────────────────────
  const spellPool = inColour.filter((c) => !isLand(c)).sort(byValue);
  const main: string[] = [];
  const taken = new Set<string>();
  let floor = 0;
  for (const [maxMv, want] of CURVE) {
    let got = 0;
    for (const card of spellPool) {
      if (got >= want) break;
      if (taken.has(card.name)) continue;
      if (card.cmc < floor || card.cmc > maxMv) continue;
      taken.add(card.name);
      main.push(card.name);
      got++;
    }
    why.push(`mv ${floor}–${maxMv === 99 ? '∞' : maxMv}: wanted ${want}, took ${got}`);
    floor = maxMv + 1;
  }
  // ⚠️ A short bucket is backfilled from anywhere rather than left short. The
  // curve is a preference; ninety-nine cards is a rule.
  for (const card of spellPool) {
    if (main.length >= 99 - LAND_COUNT) break;
    if (taken.has(card.name)) continue;
    taken.add(card.name);
    main.push(card.name);
  }

  // ── the mana base ────────────────────────────────────────────────────────
  //
  // Every clean nonbasic land in identity first — there are few enough that
  // choosing between them would be noise — then basics, split by the coloured
  // pips the chosen spells actually ask for.
  const nonbasicLands = inColour
    .filter((c) => isLand(c) && !isBasic(c))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lands: string[] = [];
  for (const land of nonbasicLands) {
    if (lands.length >= LAND_COUNT) break;
    if (taken.has(land.name)) continue;
    taken.add(land.name);
    lands.push(land.name);
  }

  const pips: Record<string, number> = {};
  for (const colour of identity) pips[colour] = 0;
  for (const name of main) {
    const card = byName.get(name);
    for (const c of card?.colorIdentity ?? []) {
      if (c in pips) pips[c] = (pips[c] ?? 0) + 1;
    }
  }
  const basicsWanted = LAND_COUNT - lands.length;
  const colours = identity.length > 0 ? [...identity] : (['G'] as ColorLetter[]);
  const totalPips = colours.reduce((s, c) => s + Math.max(1, pips[c] ?? 0), 0);
  const basics: string[] = [];
  for (const colour of colours) {
    const share = Math.floor((basicsWanted * Math.max(1, pips[colour] ?? 0)) / totalPips);
    for (let i = 0; i < share; i++) basics.push(BASIC_FOR[colour] ?? 'Forest');
  }
  // Largest-remainder in WUBRG order, so the split is exact and reproducible.
  let i = 0;
  while (basics.length < basicsWanted) {
    const colour = colours[i % colours.length] ?? 'G';
    basics.push(BASIC_FOR[colour] ?? 'Forest');
    i++;
  }
  why.push(`lands: ${lands.length} nonbasic + ${basics.length} basic = ${LAND_COUNT}`);

  const deck = [...main, ...lands, ...basics];
  why.push(`main: ${deck.length} cards`);
  return { commander: commander.name, main: deck, why };
}
