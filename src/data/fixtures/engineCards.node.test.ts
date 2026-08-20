// Every committed engine fixture, re-read from the live card database and
// compared byte for byte.
//
// ⚠️ THIS IS THE GUARD `engineCards.ts` HAS BEEN CLAIMING SINCE IT WAS FIRST
// GENERATED. Its header — and `scripts/make-engine-fixtures.cjs`, which writes
// that header — said `scripts/battery-carddb.cjs` cross-checks these records.
// It never did: that battery's "Validator assumptions still hold against real
// cards" section is D15b's guard for `src/data/validate.test.ts`'s hand-written
// fixtures, and its 15 checks touch ENGINE_CARDS at four cards (Wastes,
// Thrasios, Grist, Shorikai) and only in the one field each pattern reads. The
// 86 records here had NO guard at all — and `src/engine/testing/harness.ts`
// builds the engine's whole `OracleDb` from them, `src/net/testing/table.ts`
// builds the wire's card pool from them, and the 500-seed fuzz gate plus six
// test files sit on top of that.
//
// D15b is the rule and it applies with more force here than where it was
// written: the engine keys off EXACT wording. Tundra's text being literally
// `({T}: Add {W} or {U}.)` is what shaped `parseManaProduction`. A fixture that
// has drifted from the card tests the fixture, and keeps passing forever.
//
// ⚠️ WHAT "BYTE-IDENTICAL" MEANS HERE: `JSON.stringify(record, null, 2)` — the
// exact bytes the generator writes. So this asserts the stronger property that
// REGENERATING WOULD BE A NO-OP, which catches a reworded oracle line, a
// re-typed card, a legality change, a field the projection stopped emitting, a
// hand edit, and a key-order change, in one comparison rather than in a list of
// pinned patterns that only covers what somebody thought to pin.
//
// ⚠️ A `.node.test.ts` rather than the section in `battery-carddb.cjs` the old
// claim promised, for `botPool.node.test.ts`'s reason, and it is forced rather
// than chosen: ENGINE_CARDS is TypeScript and this project has no TS runner
// outside Vitest, so a `.cjs` would have to read the generated file with a
// regex — a second reader of the generator's output, beside the generator. That
// is the "second heuristic beside the first" this repo records learning to
// avoid twice.
//
// Run it:
//   npx vitest run src/data/fixtures/engineCards.node.test.ts
//
// ⚠️ Skips (rather than fails) with no card database, and the skip is loud — a
// suite that silently tests nothing is worse than one that fails.

import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from '../cardTypes';
import { ENGINE_CARDS } from './engineCards';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);

/** The bytes `scripts/make-engine-fixtures.cjs` writes for one record. */
const render = (card: unknown): string => JSON.stringify(card, null, 2);

/** Enough to find the printing in the data by hand. */
const label = (c: CardData): string => `${c.name} [${c.setCode} ${c.collectorNumber}]`;

/**
 * Which live printing a fixture was copied from, decided from the FIXTURE'S OWN
 * fields so there is no second copy of the generator's `WANTED` list here to
 * drift out of step with it.
 *
 * ⚠️ Two rules, because the generator has two. A token is pinned by set +
 * collector number, because token names collide wildly — there are hundreds of
 * cards named `Soldier`. Everything else takes the FIRST printing of that name
 * that is not a token, which is what makes the fixture reproducible only for as
 * long as the NDJSON order is stable; if a new printing ever sorts ahead of the
 * committed one, this reports `scryfallId` as the field that moved, and that is
 * the honest answer rather than a silent re-pin.
 */
function isTheOne(card: CardData, want: CardData): boolean {
  if (want.layout === 'token') {
    return card.name === want.name
      && card.setCode === want.setCode
      && card.collectorNumber === want.collectorNumber;
  }
  return card.name === want.name && card.layout !== 'token';
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** A value, short enough to read in a failure list. */
function brief(v: unknown): string {
  if (v === undefined) return '(absent)';
  const s = JSON.stringify(v);
  return s.length > 72 ? `${s.slice(0, 69)}…` : s;
}

/**
 * Every LEAF whose bytes moved, as `path: committed → live`.
 *
 * ⚠️ The whole point of walking down rather than reporting "the record differs":
 * a card's record is 40 lines, and "Akroma, Angel of Wrath" against 40 lines of
 * JSON does not say what happened. `faces[0].oracleText: … → …` does, and names
 * the one thing to go and read on Scryfall.
 */
function moved(mine: unknown, live: unknown, path: string): string[] {
  if (render(mine) === render(live)) return [];
  if (isRecord(mine) && isRecord(live) && Array.isArray(mine) === Array.isArray(live)) {
    const keys = [...new Set([...Object.keys(mine), ...Object.keys(live)])];
    return keys.flatMap((k) => {
      const at = path === '' ? k : Array.isArray(mine) ? `${path}[${k}]` : `${path}.${k}`;
      return moved(mine[k], live[k], at);
    });
  }
  return [`${path}: ${brief(mine)} → ${brief(live)}`];
}

interface Live {
  lines: number;
  /** fixture record → the live printing it was copied from. */
  found: Map<CardData, CardData>;
}

async function readLive(): Promise<Live> {
  // Indexed by name, so the scan costs one map lookup per line rather than 86
  // string comparisons across 113,559 of them.
  const byName = new Map<string, CardData[]>();
  for (const want of ENGINE_CARDS) {
    const at = byName.get(want.name) ?? [];
    at.push(want);
    byName.set(want.name, at);
  }

  const found = new Map<CardData, CardData>();
  let lines = 0;
  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    lines++;
    let card: CardData;
    try {
      card = JSON.parse(line) as CardData;
    } catch {
      continue;
    }
    const wants = byName.get(card.name);
    if (!wants) continue;
    for (const want of wants) {
      if (found.has(want)) continue;
      if (isTheOne(card, want)) found.set(want, card);
    }
  }
  return { lines, found };
}

describe.skipIf(!HAVE_DB)('the committed engine fixtures still match the real cards', () => {
  let live: Live = { lines: 0, found: new Map() };

  test('reads the whole database', async () => {
    live = await readLive();
    expect(live.lines).toBeGreaterThan(100_000);
  }, 180_000);

  /**
   * ⚠️ Pinned as a count, because "every fixture matches" is satisfied by an
   * EMPTY fixture list — the green-over-nothing this repo has been caught by
   * three times. 84 cards taken by name plus 3 tokens pinned by set + collector
   * number. It grew to 86 in M6.1, when the fuzz gate turned out to have no land
   * creature (Dryad Arbor), no artifact land (Darksteel Citadel), no pump spell
   * (Monstrous Growth) and nothing carrying six enforced keywords at once
   * (Akroma, Angel of Wrath), and to 89 in M6.3, when it turned out to have no
   * card whose text is a "MAY" TRIGGER (`Ajani's Mantra`, D128) and no pair
   * whose LAYER-6 effects disagree (`Levitation` + `Gravity Sphere`, D129) —
   * and, one step behind both, no card script of any kind. It reached 93 with
   * M6.3c's counter effects (D130): `Battlegrowth` and `Scar` for the two
   * counter kinds, `Burst of Strength` for the sentence the anchor must refuse,
   * and `Ajani's Pridemate` for the script path that needed no vocabulary. It
   * reached 140 in M6.4a (D158), when the first SHIPPED batch needed its five
   * missing cards as fixtures so their `printed()` guards and per-card tests
   * could run against DB-guarded records rather than paraphrases (D15b).
   */
  test('there are 983 fixtures: 913 taken by name, 70 tokens pinned by printing', () => {
    expect(ENGINE_CARDS).toHaveLength(983);
    expect(ENGINE_CARDS.filter((c) => c.layout === 'token')).toHaveLength(70);
  });

  /**
   * A fixture whose card cannot be found is reported HERE rather than as 40
   * moved fields, and it has to be its own check because the comparison below
   * has nothing to compare and must skip it.
   */
  test('every fixture still resolves to a printing in the database', () => {
    const missing = ENGINE_CARDS.filter((c) => !live.found.has(c)).map(label);
    expect(missing).toEqual([]);
  });

  /**
   * THE CHECK the fixture header has been promising.
   *
   * When this fails, the fixture is stale and the rules test built on it is
   * testing the fixture: read what moved, confirm it against the real card, then
   * `node scripts/make-engine-fixtures.cjs` and re-run the engine suites — a
   * reworded card can legitimately change what a rules test should expect.
   */
  test('every committed record is byte-identical to the live card', () => {
    const drifted: string[] = [];
    for (const want of ENGINE_CARDS) {
      const now = live.found.get(want);
      if (!now) continue; // named by the check above
      if (render(want) === render(now)) continue;
      drifted.push(`${label(want)} — ${moved(want, now, '').join(' · ')}`);
    }
    expect(drifted).toEqual([]);
  });
});

/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('the committed engine fixtures still match the real cards', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect(HAVE_DB).toBe(false);
  });
});
