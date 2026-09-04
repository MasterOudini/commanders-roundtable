// What the token resolver actually resolves, over the whole card database.
//
// ⚠️ THE NUMBER THAT SAYS WHETHER `effect:token` CAN BE BUILT AT ALL (D132).
// D131 established that both halves of that row — 373 spells and 750 permanents
// — are blocked on the same thing: `TokenCreated` needs an `oracleId` and a
// `printingId`, and nothing mapped a printed description to one. This measures
// the resolver that closes it, against the 3,290 token printings on disk.
//
// ⚠️ EVERY FAILURE IS A REFUSAL, and that is the property worth pinning rather
// than the coverage. A description this module cannot read completely, or that
// names no token, or that names two, produces NOTHING — never a guess. The
// alternative is the wrong permanent on the battlefield on a card that reads
// correctly, which is D90's failure with a body on it.
//
// Run it:
//   CRT_TOKENS_REPORT=1 npx vitest run src/data/tokenParse.node.test.ts

import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import { engineCompleteness } from './engineComplete';
import { primitivesFor } from './primitives';
import { matchToken, parseTokenClause, resolveToken } from './tokenParse';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const REPORT = process.env.CRT_TOKENS_REPORT === '1';

interface Report {
  tokenPrintings: number;
  tokenNames: number;
  cards: number;
  lines: number;
  parsed: number;
  unparsed: number;
  unique: number;
  ambiguous: number;
  noMatch: number;
  cardsFullyResolved: number;
  misses: Record<string, number>;
}

async function run(): Promise<Report> {
  const byName = new Map<string, CardData[]>();
  const lines: { card: string; text: string }[] = [];
  const seen = new Set<string>();
  const names = new Set<string>();
  let tokenPrintings = 0;
  let cards = 0;

  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card: CardData;
    try {
      card = JSON.parse(line) as CardData;
    } catch {
      continue;
    }
    if (card.layout === 'token') {
      tokenPrintings++;
      names.add(card.name);
      const list = byName.get(card.name) ?? [];
      list.push(card);
      byName.set(card.name, list);
      continue;
    }
    if (card.commanderLegality !== 'legal' || seen.has(card.name)) continue;
    seen.add(card.name);
    if (engineCompleteness(card).complete) continue;
    const p = primitivesFor(card);
    if (p.needs.size !== 1 || !p.needs.has('effect:token')) continue;
    cards++;
    for (const l of p.lines) {
      if (l.primitive === 'effect:token') lines.push({ card: card.name, text: l.text });
    }
  }

  const r: Report = {
    tokenPrintings,
    tokenNames: names.size,
    cards,
    lines: lines.length,
    parsed: 0,
    unparsed: 0,
    unique: 0,
    ambiguous: 0,
    noMatch: 0,
    cardsFullyResolved: 0,
    misses: {},
  };
  const resolvedCards = new Set<string>();
  const failedCards = new Set<string>();
  for (const { card, text } of lines) {
    const spec = parseTokenClause(text);
    if (!spec) {
      r.unparsed++;
      failedCards.add(card);
      continue;
    }
    r.parsed++;
    const candidates = byName.get(spec.name) ?? [];
    if (resolveToken(spec, candidates)) {
      r.unique++;
      resolvedCards.add(card);
      continue;
    }
    failedCards.add(card);
    if (matchToken(spec, candidates).length > 0) {
      r.ambiguous++;
      continue;
    }
    r.noMatch++;
    const key = `${spec.name} ${spec.power ?? '-'}/${spec.toughness ?? '-'} [${spec.colors.join('')}]`;
    r.misses[key] = (r.misses[key] ?? 0) + 1;
  }
  for (const c of failedCards) resolvedCards.delete(c);
  r.cardsFullyResolved = resolvedCards.size;
  return r;
}

describe.skipIf(!HAVE_DB)('the token resolver, over the real database', () => {
  let r: Report;

  test('reads the whole database', async () => {
    r = await run();
    expect.soft(r.tokenPrintings).toBeGreaterThan(1000);
    if (!REPORT) return;
    // eslint-disable-next-line no-console
    console.log(
      `\nTOKEN RESOLVER — ${r.tokenPrintings} printings, ${r.tokenNames} distinct names\n` +
        `  ${r.cards} sole-need effect:token cards, ${r.lines} token lines\n` +
        `  parsed ${r.parsed} · unparsed ${r.unparsed}\n` +
        `  of parsed — unique ${r.unique} · ambiguous ${r.ambiguous} · no match ${r.noMatch}\n` +
        `  cards whose EVERY token line resolves: ${r.cardsFullyResolved}\n\n` +
        `NO SUCH TOKEN (the database has never printed one):\n` +
        Object.entries(r.misses)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `  ${String(v).padStart(3)}  ${k}`)
          .join('\n'),
    );
  }, 600_000);

  /**
   * ⚠️ **ZERO AMBIGUOUS IS THE LOAD-BEARING ONE.** It is not a coverage figure —
   * it says that when this module names a token, the description identified
   * exactly one, so nothing is being chosen on the app's behalf. It only reads
   * zero because ambiguity is counted by `oracleId`: the plain 1/1 white Soldier
   * has 66 printings and ONE oracle id, and the first cut of this measurement
   * counted printings and reported 328 ambiguities that were nothing of the kind.
   */
  test('every description that resolves, resolves to exactly one token', () => {
    expect.soft(r.ambiguous).toBe(0);
  });

  /**
   * ⚠️ THE PINNED MEASUREMENT, in this repo's style: every figure moves when the
   * parser widens or Scryfall prints more tokens, which is exactly when the
   * build order should be re-read.
   *
   * 258 of 280 readable clauses name exactly one printing — **92.1%** — and 244
   * of the 915 cards have EVERY token line resolved, which is the number that
   * matters, because a card is only executable if all of it is.
   *
   * ⚠️ **EVERY FIGURE HERE ROSE IN D153 AND THE RESOLVER DID NOT CHANGE.** This
   * measures cards whose SOLE need is `effect:token`, and the `optional`
   * pre-filter had been holding 199 token lines out of that population — a "you
   * may create a token" was filed under the yes/no. The tell that it is a bigger
   * sample rather than a better parser: the hit rate is 258/280 against 225/244,
   * **92.1% against 92.2%**, so the 103 cards that arrived behave exactly like
   * the ones already here.
   */
  test('the resolver is worth what it is worth', () => {
    expect.soft({
      tokenPrintings: r.tokenPrintings,
      cards: r.cards,
      lines: r.lines,
      parsed: r.parsed,
      unique: r.unique,
      noMatch: r.noMatch,
      cardsFullyResolved: r.cardsFullyResolved,
    }).toEqual({
      tokenPrintings: 3290,
      // D289: one card (Fell the Pheasant) reads whole through the widened
      // target macro, so its token line leaves this bucket - the one-card
      // move primitives records as token 911 -> 910.
      cards: 917,
      lines: 950,
      parsed: 273,
      unique: 251,
      noMatch: 22,
      cardsFullyResolved: 237,
    });
  });

  /**
   * ⚠️ The 22 misses are the DATABASE, not the parser: a green Dog, a blue 2/2
   * Elemental with flying, a 2/3 red Minotaur *with haste* where only the
   * vanilla one was printed. Old cards whose tokens never got a physical card.
   * Pinned low so a parser that started inventing matches would show up here
   * first — and it is a SHARE that matters, 22 of 280 against 19 of 244, which
   * is the same 7.8% before and after D153 widened the population.
   */
  test('the misses are few, and they are the database', () => {
    expect.soft(r.noMatch).toBe(22);
  });
});

describe.skipIf(HAVE_DB)('the token resolver, over the real database', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect.soft(HAVE_DB).toBe(false);
  });
});
