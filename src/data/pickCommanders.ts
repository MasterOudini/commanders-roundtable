import { canBeCommander, commanderEligibility, pairingOf, pairsLegally } from './validate';
import type { CardData } from './cardTypes';
import type { ResolvedEntry } from './deckTypes';

// Working out the commander from a list that never said which card it is.
//
// A decklist with a `Commander` heading needs none of this — the file said so,
// and the file wins. This is for the other kind: a plain paste, or TappedOut's
// `?fmt=txt`, which is alphabetical and marks nothing (D92).
//
// ⚠️ It runs on RESOLVED cards, after the one batched name lookup, because every
// question worth asking — is this legal as a commander, does it have Partner,
// does that Background match — is a question about the CARD, not the line. The
// old behaviour ("treat the first card as the commander") could not ask any of
// them: it promoted line one whatever it was, so an alphabetical list made
// `Accorder's Shield` the commander, and a Partner pair lost its second
// commander into the deck.
//
// ⚠️ It never picks a pair the VALIDATOR would then reject: the legality of a
// pairing is asked of `pairsLegally`, the same predicate validation uses. A
// guess that immediately produces an error is worse than not guessing.

export interface CommanderPick {
  commanders: ResolvedEntry[];
  main: ResolvedEntry[];
  /**
   * What was decided, written for the user. Null when nothing could be found —
   * the screen then says the list has no commander, which is the truth.
   */
  note: string | null;
}

/** How a pair was recognised, phrased for the note. */
const PAIR_REASON: Record<string, string> = {
  partner: 'both have Partner',
  'partner-with': 'they name each other with Partner with',
  'choose-background': 'it chooses a Background',
  'friends-forever': 'both have Friends forever',
  doctor: "it is a Doctor with its companion",
  'doctors-companion': "it is a Doctor's companion",
};

/** The card's printed name, for a message. */
function nameOf(entry: ResolvedEntry): string {
  return entry.card?.name ?? entry.entry.name;
}

/**
 * A Background is never the FIRST commander — it is the second one, alongside a
 * "Choose a Background" creature. Leading with one would produce a deck that
 * fails eligibility for a reason the player did not cause.
 */
function canLead(card: CardData): boolean {
  return canBeCommander(card) && pairingOf(card) !== 'background';
}

/**
 * Choose the commander(s) from a decklist that did not mark any.
 *
 * The primary is the FIRST card in the list that could legally be one. That
 * keeps the convention every hand-written list follows — commander at the top —
 * while skipping a leading `Sol Ring` that the old rule would have promoted.
 * Cards that PROVE they are eligible win over merely-legendary ones, so a list
 * whose first legendary is an artifact does not beat the actual commander.
 */
export function pickCommanders(main: ResolvedEntry[]): CommanderPick {
  const eligible = main.filter((r) => r.card && canLead(r.card));
  if (eligible.length === 0) return { commanders: [], main, note: null };

  // 'yes' means we can prove it (a legendary creature, or the card says so);
  // 'unknown' is legendary-but-unprovable. Prefer proof, then list order.
  const primary =
    eligible.find((r) => commanderEligibility(r.card!) === 'yes') ?? eligible[0]!;
  const second = findPartner(primary, main);

  const chosen = second ? [primary, second] : [primary];
  const chosenSet = new Set(chosen);

  // ⚠️ A commander entry is ONE card. A list with `2 Rograkh` puts one in the
  // command zone and leaves the other where it was, rather than silently
  // deleting a card the player wrote down.
  const commanders = chosen.map((r) => ({ ...r, entry: { ...r.entry, section: 'commander' as const, quantity: 1 } }));
  const rest: ResolvedEntry[] = [];
  for (const r of main) {
    if (!chosenSet.has(r)) { rest.push(r); continue; }
    if (r.entry.quantity > 1) rest.push({ ...r, entry: { ...r.entry, quantity: r.entry.quantity - 1 } });
  }

  return { commanders, main: rest, note: noteFor(commanders, primary, second) };
}

/** The partner this commander allows, if the list holds a legal one. */
function findPartner(primary: ResolvedEntry, main: ResolvedEntry[]): ResolvedEntry | null {
  const card = primary.card;
  if (!card) return null;
  const kind = pairingOf(card);
  if (kind === null || kind === 'background') return null;

  // ⚠️ `pairsLegally` is the decision, not the loop's own reasoning. Asking
  // "does this one also have Partner?" here would be a second implementation of
  // the pairing rules, and the two would drift.
  for (const other of main) {
    if (other === primary || !other.card) continue;
    if (pairsLegally(card, other.card)) return other;
  }
  return null;
}

function noteFor(
  commanders: ResolvedEntry[],
  primary: ResolvedEntry,
  second: ResolvedEntry | null,
): string {
  const head = 'This list had no Commander heading, so the cards decided it: ';
  if (!second) {
    return `${head}${nameOf(primary)} is your commander. Add a “Commander” heading to choose a different one.`;
  }
  const kind = pairingOf(primary.card!) ?? '';
  const why = PAIR_REASON[kind] ?? 'they may be played together';
  return `${head}${commanders.map(nameOf).join(' and ')} — ${why}.`;
}
