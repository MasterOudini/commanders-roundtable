import type {
  DeckEntry,
  DeckSection,
  DecklistComment,
  DecklistProblem,
  ParsedDecklist,
} from './deckTypes';

// Decklist text → structured entries.
//
// Pure text handling: no card data, no network, no folding. Name resolution
// happens in the card-database worker, which owns the folding rules
// (electron/cardfold.cjs) — this parser only decides what the user *wrote*.
//
// ─── The formats this has to survive ───
//
//   1 Sol Ring                     plain
//   1x Sol Ring / 1 x Sol Ring     Moxfield, Archidekt
//   Sol Ring                       quantity omitted → 1
//   Sol Ring x1                    trailing quantity
//   1 Sol Ring (LTC) 264           a specific printing
//   1 Sol Ring [LTC] 264           bracketed set
//   1x Sol Ring (ltc) 264 [Ramp]{noPrice}   Archidekt with a category and flags
//   1x Sol Ring ^Ramp^             Archidekt tag form
//   SB: 1 Sol Ring                 MTGO sideboard prefix
//   1 Sol Ring *F*                 foil marker (also *E* for etched)
//   1 Fire // Ice                  a split card — NOT a comment
//   // Commander                   a section header
//   # Ramp                         a comment
//   Total: 100                     noise
//
// ⚠️ The order of the stripping passes below is load-bearing. Stripping the set
// group before the category group makes `(ltc) 264 [Ramp]` unparseable, and
// treating `//` as a comment before checking whether it is mid-line destroys
// every split and double-faced card in the list.

/** Section words, and the aliases people actually type. */
const SECTION_WORDS: Record<string, DeckSection> = {
  commander: 'commander',
  commanders: 'commander',
  deck: 'main',
  mainboard: 'main',
  main: 'main',
  maindeck: 'main',
  sideboard: 'sideboard',
  side: 'sideboard',
  maybeboard: 'maybeboard',
  maybe: 'maybeboard',
  considering: 'maybeboard',
  companion: 'companion',
  tokens: 'tokens',
  token: 'tokens',
};

/** Lines that are neither cards nor headers — totals and similar chatter. */
const NOISE = /^(total|cards?|count)\s*[:=]?\s*\d*$/i;

/**
 * A trailing group that is a plausible set code. Deliberately narrow: 2–6
 * alphanumerics. Real set codes are 3–6 (`ltc`, `neo`, `plst`, `40k`).
 */
const SETLIKE = /^[A-Za-z0-9]{2,6}$/;

/**
 * A collector number: alphanumeric runs joined by hyphens, containing at least
 * one digit, with an optional star or dagger.
 *
 * ⚠️ Real ones are stranger than "digits with a letter on the end". Measured
 * against actual deck exports: `264`, `157a`, `TSP-157` (The List), `A-123`
 * (Alchemy), `C18-150` (a List reprint's original set), `2023-8` (a media
 * promo), `★` suffixes. An earlier, tighter pattern rejected the last two —
 * and rejecting a collector number does NOT simply lose the printing: the peel
 * stops there, so `Harrow (PLST) C18-150` stayed glued together as the card's
 * NAME and resolved to nothing. Requiring a digit is what keeps a category like
 * `(ltc) Ramp` from being read as one.
 */
const COLLECTOR = /^(?=.*\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*[★†]?$/;

export function parseDecklist(text: string): ParsedDecklist {
  const entries: DeckEntry[] = [];
  const comments: DecklistComment[] = [];
  const problems: DecklistProblem[] = [];
  let hadSections = false;

  // A list with no header at all is read as: first line is the commander only if
  // the user later marks one. Default section is `main`; the import UI lets the
  // user promote a card to commander, so guessing here would be worse than not.
  let section: DeckSection = 'main';

  const lines = String(text ?? '')
    .replace(/^﻿/, '') // BOM from a Windows-saved .txt
    .replace(/\r\n?/g, '\n')
    .split('\n');

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const raw = rawLine.replace(/\t/g, ' ').trim();
    if (raw.length === 0) return;

    // ── section headers and comments ──
    // ⚠️ Only at LINE START. `Fire // Ice` has '//' in the middle and is a card.
    const marker = /^(\/\/+|#+)\s*(.*)$/.exec(raw);
    if (marker) {
      const body = (marker[2] ?? '').trim();
      const asSection = sectionFromHeader(body);
      if (asSection) {
        section = asSection;
        hadSections = true;
      } else if (body.length > 0) {
        comments.push({ lineNo, text: body });
      }
      return;
    }

    // A bare header word, with or without a count: `Commander`, `Deck (100)`,
    // `Sideboard:`.
    const bareSection = sectionFromHeader(raw);
    if (bareSection) {
      section = bareSection;
      hadSections = true;
      return;
    }

    if (NOISE.test(raw)) return;

    // ── MTGO's `SB:` line prefix — a per-line section, not a header ──
    let lineSection = section;
    let body = raw;
    const sbPrefix = /^(SB|MB|CM)\s*:\s*(.*)$/i.exec(body);
    if (sbPrefix) {
      const which = (sbPrefix[1] ?? '').toUpperCase();
      lineSection = which === 'SB' ? 'sideboard' : which === 'MB' ? 'maybeboard' : 'commander';
      body = (sbPrefix[2] ?? '').trim();
      hadSections = true;
    }

    // Leading list bullets.
    body = body.replace(/^[-*•]\s+/, '');
    if (body.length === 0) return;

    const parsed = parseCardLine(body);
    if (!parsed) {
      problems.push({ lineNo, raw, reason: 'Could not read a card name on this line.' });
      return;
    }

    entries.push({ ...parsed, section: lineSection, lineNo, raw });
  });

  return { entries, comments, problems, hadSections };
}

function sectionFromHeader(text: string): DeckSection | null {
  if (text.length === 0) return null;
  // `Commander (1)`, `Deck: 99`, `Sideboard —` …
  const m = /^([A-Za-z]+)\s*(?:\(\s*\d+\s*\)|:\s*\d*|\s*[-—–])?\s*$/.exec(text.trim());
  if (!m) return null;
  return SECTION_WORDS[(m[1] ?? '').toLowerCase()] ?? null;
}

/** The card part of a line, after section/prefix handling. */
function parseCardLine(input: string): Omit<DeckEntry, 'section' | 'lineNo' | 'raw'> | null {
  let rest = input;
  let foil = false;

  // ── pass 1: flags anywhere (`*F*`, `*E*`, `*foil*`) ──
  rest = rest.replace(/\*\s*(F|E|foil|etched)\s*\*/gi, () => {
    foil = true;
    return ' ';
  });

  // ── pass 2: trailing `{...}` groups (Archidekt `{noPrice}`) ──
  let changed = true;
  while (changed) {
    const next = rest.replace(/\s*\{[^{}]*\}\s*$/, '');
    changed = next !== rest;
    rest = next;
  }

  // ── pass 3: trailing `^tag^` (Archidekt) ──
  rest = rest.replace(/\s*\^[^^]*\^\s*$/, '');

  rest = rest.trim();

  // ── pass 4: leading or trailing quantity ──
  let quantity = 1;
  let sawQuantity = false;
  const leading = /^(\d{1,3})\s*[xX]?\s+(.*)$/.exec(rest);
  if (leading) {
    quantity = Number(leading[1]);
    rest = (leading[2] ?? '').trim();
    sawQuantity = true;
  } else {
    // `4x Lightning Bolt` with no space after the x.
    const tight = /^(\d{1,3})[xX](.+)$/.exec(rest);
    if (tight) {
      quantity = Number(tight[1]);
      rest = (tight[2] ?? '').trim();
      sawQuantity = true;
    }
  }
  if (!sawQuantity) {
    // `Sol Ring x1` — only when a quantity was not already given.
    const trailing = /^(.*?)\s+[xX]\s*(\d{1,3})$/.exec(rest);
    if (trailing) {
      quantity = Number(trailing[2]);
      rest = (trailing[1] ?? '').trim();
    }
  }
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;

  // ── pass 5: trailing groups, peeled right to left ──
  //
  // The printed shape is:  <name> (<set>) <cn> [<category>]…
  // so right-to-left we meet categories first, then the collector number, then
  // the set.
  //
  // ⚠️ Therefore the set is the LEFTMOST group, i.e. the LAST one peeled — not the
  // first. Taking the first set-like group read `1x Sol Ring (ltc) 264 [Ramp]` as
  // set "Ramp", because a category name is indistinguishable from a set code in
  // isolation (both are short alphanumerics). Position is the only reliable
  // discriminator, and this also handles `[LTC] 264 [Ramp]`, where both groups are
  // brackets.
  let collectorNumber: string | undefined;
  const peeled: string[] = [];

  for (;;) {
    // A bare collector number at the end, e.g. `… (ltc) 264`. Take the last
    // whitespace-delimited token and let COLLECTOR judge it — a second, tighter
    // copy of that pattern here silently narrowed which numbers could be seen
    // at all.
    if (collectorNumber === undefined) {
      const cn = /^(.*?)\s+(\S+)$/.exec(rest);
      if (cn && COLLECTOR.test(cn[2] ?? '') && (cn[1] ?? '').trim().length > 0) {
        // Only accept it when a group sits immediately before it — otherwise
        // `Fury Sliver 157` would lose the 157 from the card's actual name.
        const before = (cn[1] ?? '').trim();
        if (/[)\]}>]\s*$/.test(before)) {
          collectorNumber = cn[2];
          rest = before;
          continue;
        }
      }
    }

    const group = /^(.*?)\s*[([{<]([^)\]}>]*)[)\]}>]\s*$/.exec(rest);
    if (!group) break;
    const head = (group[1] ?? '').trim();
    if (head.length === 0) break; // the whole line was a group — not a card

    peeled.push((group[2] ?? '').trim());
    rest = head;
  }

  // Last peeled = leftmost in the original text = the set, if it looks like one.
  const set = [...peeled].reverse().find((g) => SETLIKE.test(g));

  const name = rest.trim();
  if (name.length === 0) return null;
  // A "name" that is only punctuation or digits is not a card.
  if (!/[A-Za-zÀ-ɏ]/.test(name)) return null;

  return {
    quantity,
    name,
    ...(set !== undefined ? { set } : {}),
    ...(collectorNumber !== undefined ? { collectorNumber } : {}),
    ...(foil ? { foil: true } : {}),
  };
}

/**
 * Split entries into the sections a DeckFile keeps.
 *
 * When a list had no `Commander` header, the first entry is NOT promoted
 * automatically — the import screen asks. Guessing produces a deck that fails
 * validation for a reason the user did not cause.
 */
export function groupBySection(parsed: ParsedDecklist): {
  commanders: DeckEntry[];
  main: DeckEntry[];
  sideboard: DeckEntry[];
  ignored: DeckEntry[];
} {
  const commanders: DeckEntry[] = [];
  const main: DeckEntry[] = [];
  const sideboard: DeckEntry[] = [];
  const ignored: DeckEntry[] = [];

  for (const entry of parsed.entries) {
    switch (entry.section) {
      case 'commander': commanders.push(entry); break;
      case 'main': main.push(entry); break;
      case 'sideboard': sideboard.push(entry); break;
      default: ignored.push(entry); break;
    }
  }
  return { commanders, main, sideboard, ignored };
}

/** Total cards by quantity. */
export function countCards(entries: DeckEntry[]): number {
  return entries.reduce((sum, e) => sum + e.quantity, 0);
}
