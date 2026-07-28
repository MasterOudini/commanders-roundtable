// Turning saved decks (or nothing at all) into something the engine can start.
//
// ⚠️ Card data comes from the MAIN process, never from a bundled copy. A deck
// entry names a card; the card database resolves it to a printing, and the
// printing is what carries the art the table renders. Bundling card data would
// mean the engine and the card-database screen could disagree about what a card
// says — and would put Wizards' copyright in the installer.

import type { CardData } from '../data/cardTypes';
import type { DeckFile } from '../data/deckTypes';
import type { SeatSpec, StartSpec } from './session';

/**
 * ⚠️ NO SEAT IS CALLED "YOU". Seat 0 used to be, and it was wrong twice over.
 * The engine's narration is third-person and interpolates the seat's name, so
 * every line about seat 0 read "You draws a card." — and solo play is a HOTSEAT
 * (D42): `session.setViewer` rotates the one viewer across every seat, so the
 * seat labelled "You" is often not the seat you are currently playing.
 *
 * A seat has a name; whether that seat is YOU is a question about the reader, and
 * it is answered where the reader is known — the second person comes from
 * `project()` re-rendering the narration parts for the viewer (see
 * `src/engine/narrate.ts`), and the table already says which pod is yours by
 * putting it at the bottom.
 */
const SEAT_NAMES = ['Ana', 'Ben', 'Cy', 'Dee'];

/** A playable starter deck when the user has not imported one for a seat. */
const STARTER_COMMANDERS = [
  'Kess, Dissident Mage',
  'Krenko, Mob Boss',
  'Talrand, Sky Summoner',
  "Yeva, Nature's Herald",
];

const STARTER_BASICS: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

const STARTER_SPELLS = [
  'Sol Ring',
  'Arcane Signet',
  'Command Tower',
  'Grizzly Bears',
  'Serra Angel',
  'Air Elemental',
  'Colossal Dreadmaw',
  'Giant Spider',
  'Llanowar Elves',
  'Lightning Bolt',
  'Wall of Omens',
  'Vampire Nighthawk',
  'Raging Goblin',
  'Boros Swiftblade',
  'Child of Night',
];

export interface CardResolver {
  byName(name: string, set?: string, collectorNumber?: string): Promise<CardData | null>;
  many(names: readonly { name: string; set?: string; collectorNumber?: string }[]): Promise<(CardData | null)[]>;
}

/** Resolve a saved deck into cards, dropping (and reporting) what is missing. */
export async function seatFromDeck(
  id: string,
  name: string,
  deck: DeckFile,
  resolver: CardResolver,
): Promise<{ seat: SeatSpec; missing: string[] }> {
  const wanted = [...deck.commanders, ...deck.main].flatMap((entry) =>
    Array.from({ length: Math.max(1, entry.quantity) }, () => ({
      name: entry.name,
      ...(entry.set !== undefined ? { set: entry.set } : {}),
      ...(entry.collectorNumber !== undefined ? { collectorNumber: entry.collectorNumber } : {}),
      isCommander: entry.section === 'commander',
    })),
  );
  const resolved = await resolver.many(wanted);
  const commanders: CardData[] = [];
  const library: CardData[] = [];
  const missing: string[] = [];
  for (const [i, card] of resolved.entries()) {
    const want = wanted[i];
    if (!want) continue;
    if (!card) {
      missing.push(want.name);
      continue;
    }
    if (want.isCommander) commanders.push(card);
    else library.push(card);
  }
  return { seat: { id, name, commanders, library }, missing };
}

/**
 * A 60-card mono-ish starter, so a seat with no imported deck is still playable.
 *
 * ⚠️ Deliberately NOT a legal Commander deck. It exists so the engine can be
 * exercised end to end without four imported decks, and the lobby says so; the
 * validator's job is the real deck, and pretending this passes it would be a lie.
 */
export async function starterSeat(
  id: string,
  name: string,
  index: number,
  resolver: CardResolver,
): Promise<SeatSpec> {
  const commanderName = STARTER_COMMANDERS[index % STARTER_COMMANDERS.length] as string;
  const commander = await resolver.byName(commanderName);
  const identity = commander?.colorIdentity ?? ['G'];
  const basics = identity.length > 0 ? identity : (['G'] as const);

  // ⚠️ NINETY-NINE cards, like a real Commander deck. The first version dealt
  // 49, and a solo game then ended by everyone DECKING on turn ~170 with all
  // four players still at 40 life — technically a correct finish, and completely
  // useless as a test of the engine. Library size is what decides whether a game
  // is long enough to have a board.
  const names: string[] = [];
  for (let i = 0; i < 40; i++) {
    const letter = basics[i % basics.length] as string;
    names.push(STARTER_BASICS[letter] ?? 'Forest');
  }
  while (names.length < 99) {
    names.push(STARTER_SPELLS[(names.length - 40) % STARTER_SPELLS.length] as string);
  }
  const cards = (await resolver.many(names.map((n) => ({ name: n })))).filter(
    (c): c is CardData => c !== null,
  );
  return {
    id,
    name,
    commanders: commander ? [commander] : [],
    library: cards,
  };
}

/** Everything the oracle db needs: every deck card plus the token printings. */
export function poolOf(seats: readonly SeatSpec[], tokens: readonly CardData[]): CardData[] {
  const byPrinting = new Map<string, CardData>();
  for (const seat of seats) {
    for (const card of [...seat.commanders, ...seat.library]) byPrinting.set(card.scryfallId, card);
  }
  for (const card of tokens) byPrinting.set(card.scryfallId, card);
  return [...byPrinting.values()];
}

export function startSpec(
  seats: readonly SeatSpec[],
  tokens: readonly CardData[],
  seed: string,
): StartSpec {
  return { seats, pool: poolOf(seats, tokens), seed };
}

export function seatName(index: number): string {
  return SEAT_NAMES[index] ?? `Player ${index + 1}`;
}

/** The token printings the manual tool offers. Resolved from the card database. */
export const TOKEN_NAMES = [
  'Soldier',
  'Treasure',
  'Beast',
  'Zombie',
  'Goblin',
  'Angel',
  'Spirit',
  'Saproling',
  'Insect',
  'Elemental',
  'Clue',
  'Food',
];
