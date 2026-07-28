import type { CardData, ColorLetter } from './cardTypes';
import type {
  ResolvedEntry,
  ValidationIssue,
  ValidationReport,
} from './deckTypes';

// Commander deck legality.
//
// Pure: takes resolved entries (each a parsed line paired with its card data) and
// returns a report. No I/O, no network — so every rule below is unit-testable, and
// they are, in validate.test.ts.
//
// ─── Two principles ───
//
// 1. NEVER hand-roll colour identity. Scryfall's `color_identity` already
//    implements CR 903.4 across hybrid mana, phyrexian symbols, mana symbols in
//    rules text, colour indicators on costless cards, and the union across both
//    faces of a double-faced card. Reimplementing it would be strictly worse and
//    would drift.
//
// 2. Singleton exceptions are derived from CARD TEXT, not a hardcoded list. Cards
//    that say "A deck can have any number of cards named …" or "up to nine cards
//    named …" state their own rule, and a new one printed next year works without
//    a code change.
//
// The gate is SOFT (see docs/DECISIONS.md): everything is reported, and a deck may
// be marked house-ruled. This is a private app for a friend group — hard-blocking
// a silver-bordered card the pod agreed to play would be a defect.

const DECK_SIZE = 100;

/** Data older than this makes the ban list untrustworthy. */
export const STALE_DATA_DAYS = 30;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * Cards the rules committee treats as legal commanders despite a type line that
 * says otherwise.
 *
 * ⚠️ Deliberately a single-entry allowlist, not a general escape hatch. Grist, the
 * Hunger Tide is a creature everywhere except the battlefield, so it is a legal
 * commander while reading "Legendary Planeswalker".
 */
const COMMANDER_OVERRIDES = new Set(['Grist, the Hunger Tide']);

/** Text of every face joined, for rules that can appear on either side. */
function allText(card: CardData): string {
  return card.faces.map((f) => f.oracleText).join('\n');
}
function frontFace(card: CardData) {
  return card.faces[0]!;
}
function typeLineOf(card: CardData): string {
  return frontFace(card).typeLine;
}

/** How many copies of this card a Commander deck may contain. */
export function copyLimit(card: CardData): number {
  const type = typeLineOf(card);
  // Basic lands — covers Wastes and every Snow-Covered variant, which read
  // "Basic Snow Land — Plains".
  if (/\bBasic\b/.test(type) && /\bLand\b/.test(type)) return Infinity;

  const text = allText(card);
  if (/A deck can have any number of cards named/i.test(text)) return Infinity;

  const upTo = /A deck can have up to (\w+) cards? named/i.exec(text);
  if (upTo) {
    const word = (upTo[1] ?? '').toLowerCase();
    const n = NUMBER_WORDS[word] ?? Number(word);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

/**
 * How confident are we that this card can be a commander?
 *
 * ⚠️ Type line and oracle text cannot always decide this, and pretending
 * otherwise produces false errors on real decks. Measured against the
 * 2026-07-26 data:
 *   • 40 cards say "can be your commander" (33 of them legendary non-creatures,
 *     e.g. Minsc & Boo, Elminster, The Grand Calcutron) — a well-populated and
 *     reliable signal.
 *   • Shorikai, Genesis Engine is a real precon face commander whose text says
 *     NOTHING about being a commander and which is a Legendary Artifact — Vehicle,
 *     not a creature. Requiring "creature or says so" rejects it.
 *   • Grist, the Hunger Tide reads "Legendary Planeswalker" and is legal by
 *     rules-committee ruling.
 *
 * So: 'yes' when we can prove it, 'unknown' when the card is legendary but we
 * cannot, and 'no' only when the card is not legendary at all — which is the
 * unambiguous case (someone marked Sol Ring as their commander). 'unknown'
 * becomes a warning, never a blocking error.
 */
export type CommanderEligibility = 'yes' | 'unknown' | 'no';

export function commanderEligibility(card: CardData): CommanderEligibility {
  if (COMMANDER_OVERRIDES.has(card.name)) return 'yes';
  if (/can be your commander/i.test(allText(card))) return 'yes';

  // ⚠️ Only the FRONT face counts: a card that is a legendary creature only on
  // its back is not a legal commander.
  const type = typeLineOf(card);
  if (!/\bLegendary\b/.test(type)) return 'no';
  if (/\bCreature\b/.test(type)) return 'yes';
  // Legendary Vehicles and Spacecraft head real precon decks (Shorikai).
  if (/\bVehicle\b/.test(type) || /\bSpacecraft\b/.test(type)) return 'yes';
  return 'unknown';
}

/** Convenience for callers that only care whether it is not-clearly-illegal. */
export function canBeCommander(card: CardData): boolean {
  return commanderEligibility(card) !== 'no';
}

export type PairingKind =
  | 'partner'
  | 'partner-with'
  | 'background'
  | 'choose-background'
  | 'friends-forever'
  | 'doctor'
  | 'doctors-companion'
  | null;

/** Which two-commander mechanic, if any, this card brings. */
export function pairingOf(card: CardData): PairingKind {
  const text = allText(card);
  const keywords = card.keywords.map((k) => k.toLowerCase());
  const type = typeLineOf(card);

  if (/\bPartner with\b/i.test(text)) return 'partner-with';
  if (keywords.includes('friends forever') || /\bFriends forever\b/i.test(text)) {
    return 'friends-forever';
  }
  if (keywords.includes("doctor's companion") || /\bDoctor's companion\b/i.test(text)) {
    return 'doctors-companion';
  }
  if (/\bTime Lord Doctor\b/.test(type)) return 'doctor';
  if (/Choose a Background/i.test(text)) return 'choose-background';
  if (/\bBackground\b/.test(type)) return 'background';
  // Plain Partner last: "Partner with" also contains the word.
  if (keywords.includes('partner') || /\bPartner\b(?! with)/i.test(text)) return 'partner';
  return null;
}

/** The named counterpart of a "Partner with X" card. */
function partnerWithName(card: CardData): string | null {
  const m = /Partner with ([^(\n.]+)/i.exec(allText(card));
  return m ? (m[1] ?? '').trim() : null;
}

/**
 * May these two be a commander pair? Exported so the IMPORT can ask the same
 * question the validator does — a detected pair the validator would then reject
 * is worse than no detection at all.
 */
export function pairsLegally(a: CardData, b: CardData): boolean {
  return pairingProblem(a, b) === null;
}

/** Are these two cards a legal commander pair? Returns null if legal. */
function pairingProblem(a: CardData, b: CardData): string | null {
  const pa = pairingOf(a);
  const pb = pairingOf(b);

  if (pa === 'partner-with' || pb === 'partner-with') {
    const named = partnerWithName(pa === 'partner-with' ? a : b);
    const other = pa === 'partner-with' ? b : a;
    if (named && other.name.toLowerCase().startsWith(named.toLowerCase())) return null;
    return `${a.name} and ${b.name} do not name each other with Partner with.`;
  }
  if (pa === 'partner' && pb === 'partner') return null;
  if (
    (pa === 'choose-background' && pb === 'background') ||
    (pb === 'choose-background' && pa === 'background')
  ) return null;
  if (pa === 'friends-forever' && pb === 'friends-forever') return null;
  if (
    (pa === 'doctor' && pb === 'doctors-companion') ||
    (pb === 'doctor' && pa === 'doctors-companion')
  ) return null;

  return `${a.name} and ${b.name} cannot be played together as commanders. Two commanders need Partner, Partner with, a Background, Friends forever, or a Doctor and its companion.`;
}

export interface ValidateOptions {
  /** The Scryfall release the card data came from, for the staleness warning. */
  cardDataUpdatedAt?: string | null;
  /** Suppresses the `ok: false` verdict; issues are still reported in full. */
  houseRuled?: boolean;
  /** Injected so the staleness check is testable. */
  now?: number;
}

export function validateCommanderDeck(
  commanders: ResolvedEntry[],
  main: ResolvedEntry[],
  sideboard: ResolvedEntry[] = [],
  options: ValidateOptions = {},
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const now = options.now ?? Date.now();

  // ── unresolved names ──
  // Reported first: every later rule is unreliable for a card we could not
  // identify, and the user's real problem is the typo.
  for (const r of [...commanders, ...main]) {
    if (!r.card) {
      const hint = r.suggestions?.length
        ? ` Did you mean ${r.suggestions.slice(0, 3).join(', ')}?`
        : ' Check the spelling, or update the card database if it is a new card.';
      issues.push({
        code: 'unresolved',
        severity: 'error',
        message: `No card named "${r.entry.name}" was found.${hint}`,
        cardName: r.entry.name,
        lineNo: r.entry.lineNo,
        ...(r.suggestions?.length ? { detail: { suggestions: r.suggestions } } : {}),
      });
    }
  }

  const resolvedCommanders = commanders.filter((r) => r.card).map((r) => r);
  const counted = [...commanders, ...main];
  const total = counted.reduce((sum, r) => sum + r.entry.quantity, 0);

  // ── deck size ──
  if (total !== DECK_SIZE) {
    const delta = total - DECK_SIZE;
    issues.push({
      code: 'deck-size',
      severity: 'error',
      message: total > DECK_SIZE
        ? `${total} cards — remove ${delta}. A Commander deck is exactly ${DECK_SIZE}, including the commander.`
        : `${total} cards — add ${-delta}. A Commander deck is exactly ${DECK_SIZE}, including the commander.`,
      detail: { total, expected: DECK_SIZE, delta },
    });
  }

  // ── commander ──
  if (resolvedCommanders.length === 0) {
    issues.push({
      code: 'commander-missing',
      severity: 'error',
      message: 'No commander chosen. Mark one card as your commander.',
    });
  } else if (resolvedCommanders.length > 2) {
    issues.push({
      code: 'commander-too-many',
      severity: 'error',
      message: `${resolvedCommanders.length} commanders. A deck has one, or two with Partner, a Background, Friends forever, or a Doctor and companion.`,
      detail: { count: resolvedCommanders.length },
    });
  }

  // A Background is never a commander on its own — it is the SECOND commander
  // alongside a "Choose a Background" creature. Judging it in isolation reported
  // "Raised by Giants cannot be a commander" for a perfectly legal pair, so
  // eligibility is checked with the pairing in view.
  const pairIsValid = resolvedCommanders.length === 2
    && pairingProblem(resolvedCommanders[0]!.card!, resolvedCommanders[1]!.card!) === null;

  for (const r of resolvedCommanders) {
    const card = r.card!;
    const pairing = pairingOf(card);
    const excusedByPairing = pairIsValid
      && (pairing === 'background' || pairing === 'doctors-companion');

    const eligibility = commanderEligibility(card);
    if (eligibility === 'no' && !excusedByPairing) {
      issues.push({
        code: 'commander-illegal',
        severity: 'error',
        message: `${card.name} cannot be a commander — it is not legendary. A commander must be a legendary creature, or a card that says it can be your commander.`,
        cardName: card.name,
        lineNo: r.entry.lineNo,
        detail: { typeLine: typeLineOf(card), eligibility },
      });
    } else if (eligibility === 'unknown' && !excusedByPairing) {
      // Honest about the limit rather than guessing in either direction.
      issues.push({
        code: 'commander-illegal',
        severity: 'warning',
        message: `${card.name} is legendary but is not a creature, so it can only be your commander if a rule or its printing says so. If your pod agrees it is legal, carry on.`,
        cardName: card.name,
        lineNo: r.entry.lineNo,
        detail: { typeLine: typeLineOf(card), eligibility },
      });
    }
    if (r.entry.quantity > 1) {
      issues.push({
        code: 'commander-too-many',
        severity: 'error',
        message: `${card.name} is listed ${r.entry.quantity} times as a commander. List it once.`,
        cardName: card.name,
        lineNo: r.entry.lineNo,
      });
    }
  }

  if (resolvedCommanders.length === 2) {
    const [a, b] = [resolvedCommanders[0]!.card!, resolvedCommanders[1]!.card!];
    const problem = pairingProblem(a, b);
    if (problem) {
      issues.push({
        code: 'partner-mismatch',
        severity: 'error',
        message: problem,
        detail: { a: a.name, b: b.name, pairingA: pairingOf(a), pairingB: pairingOf(b) },
      });
    }
  }

  // ── colour identity ──
  const identity = unionIdentity(resolvedCommanders.map((r) => r.card!));
  const identitySet = new Set(identity);

  for (const r of counted) {
    if (!r.card) continue;
    const offending = r.card.colorIdentity.filter((c) => !identitySet.has(c));
    if (offending.length > 0 && resolvedCommanders.length > 0) {
      issues.push({
        code: 'color-identity',
        severity: 'error',
        message: `${r.card.name} adds ${offending.map(pip).join('')}, which is not in your commander's colour identity (${identity.length ? identity.map(pip).join('') : 'colourless'}).`,
        cardName: r.card.name,
        lineNo: r.entry.lineNo,
        detail: { offending, identity },
      });
    }
  }

  // ── singleton ──
  // Keyed on card NAME: two different printings of Sol Ring are still two Sol
  // Rings, and the oracle name is what the rule is about.
  const byName = new Map<string, { quantity: number; card: CardData; lineNo: number }>();
  for (const r of counted) {
    if (!r.card) continue;
    const existing = byName.get(r.card.name);
    if (existing) existing.quantity += r.entry.quantity;
    else byName.set(r.card.name, {
      quantity: r.entry.quantity, card: r.card, lineNo: r.entry.lineNo,
    });
  }

  for (const [name, info] of byName) {
    const limit = copyLimit(info.card);
    if (info.quantity > limit) {
      issues.push({
        code: 'singleton',
        severity: 'error',
        message: limit === 1
          ? `${info.quantity} copies of ${name}. Commander is singleton — one of each card except basic lands.`
          : `${info.quantity} copies of ${name}, but its text allows up to ${limit}.`,
        cardName: name,
        lineNo: info.lineNo,
        detail: { quantity: info.quantity, limit },
      });
    }
  }

  // ── legality ──
  for (const [name, info] of byName) {
    const legality = info.card.commanderLegality;
    if (legality === 'banned') {
      issues.push({
        code: 'banned',
        severity: 'error',
        message: `${name} is banned in Commander.`,
        cardName: name,
        lineNo: info.lineNo,
      });
    } else if (legality !== 'legal' && legality !== 'restricted') {
      issues.push({
        code: 'not-legal-in-format',
        severity: 'error',
        message: `${name} is not a legal Commander card (it is from a set that Commander does not use, such as an Un-set or a promo oversized card).`,
        cardName: name,
        lineNo: info.lineNo,
        detail: { legality },
      });
    }
  }

  // ── informational ──
  if (sideboard.length > 0) {
    issues.push({
      code: 'sideboard-ignored',
      severity: 'warning',
      message: `${sideboard.length} sideboard ${sideboard.length === 1 ? 'card is' : 'cards are'} saved with the deck but not used — Commander has no sideboard.`,
      detail: { count: sideboard.length },
    });
  }

  const updatedAt = options.cardDataUpdatedAt ?? null;
  if (updatedAt) {
    const ageDays = Math.floor((now - Date.parse(updatedAt)) / 86_400_000);
    if (Number.isFinite(ageDays) && ageDays > STALE_DATA_DAYS) {
      issues.push({
        code: 'stale-card-data',
        severity: 'warning',
        message: `Your card data is ${ageDays} days old, so the ban list may be out of date. Update the card database to be sure.`,
        detail: { ageDays },
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    ok: options.houseRuled ? true : !hasErrors,
    issues,
    counts: { total, unique: byName.size, commanders: resolvedCommanders.length },
    colorIdentity: identity,
    cardDataUpdatedAt: updatedAt,
  };
}

const WUBRG: ColorLetter[] = ['W', 'U', 'B', 'R', 'G'];

/** Union of the commanders' identities, in WUBRG order. */
export function unionIdentity(cards: CardData[]): ColorLetter[] {
  const set = new Set<ColorLetter>();
  for (const card of cards) for (const c of card.colorIdentity) set.add(c);
  return WUBRG.filter((c) => set.has(c));
}

function pip(c: ColorLetter): string {
  return `{${c}}`;
}
