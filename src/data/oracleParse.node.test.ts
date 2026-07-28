// The whole card database, through the ingest, in one pass.
//
// The unit tests next door prove the parsers do the right thing on ~70 cards
// somebody chose. This proves they do not THROW on 113,559 cards nobody chose —
// a completely different failure surface, and the only one that matters when a
// player imports a deck full of cards the author never saw.
//
// It also prints the warning tally by category, which is the honest measure of
// Tier-2 coverage: "6,231 cards produced `mana:variableAmount`" is a number
// that belongs in DECISIONS.md, and its movement between milestones is a
// meaningful signal. Set `CRT_INGEST_REPORT=1` to see the breakdown.
//
// ⚠️ Skips (rather than fails) with no card database, so a fresh clone still
// runs green. The skip is loud, because a suite that silently tests nothing is
// worse than one that fails.

import { existsSync, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import { parseFace, parseManaCost, parseTypeLine } from './oracleParse';
import type { CardData } from './cardTypes';

const NDJSON = process.env.CRT_DATA_DIR
  ? join(process.env.CRT_DATA_DIR, 'cards', 'cards.ndjson')
  : join(homedir(), '.commanders-roundtable', 'cards', 'cards.ndjson');

const HAVE_DB = existsSync(NDJSON);

interface Report {
  cards: number;
  faces: number;
  threw: { name: string; error: string }[];
  warnings: Record<string, number>;
  landsWithBasicTypeAndNoMana: string[];
  typelessFaces: number;
  typelessButLegal: string[];
  /** Commander-legal cards carrying a type word we do not know. Must be empty. */
  unknownTypeButLegal: string[];
  /** Cards where a Tier-2 keyword was promoted in M5, as a live regression count. */
  infect: number;
  wither: number;
  toxic: number;
  wardMana: number;
  wardLife: number;
  /**
   * ⚠️ Targeting coverage measured in BOTH directions. The warning tally counts
   * only what the parser could not read; on its own that number can be driven to
   * zero by a refactor that routes everything to free aim while every pinned
   * warning still "matches". These count what it DID read.
   */
  targets: {
    facesWithSpecs: number;
    specs: number;
    confident: number;
    free: number;
    enchant: number;
    withUnenforced: number;
  };
  activated: { lines: number; payable: number; manaAbility: number; targeted: number };
  /** `confident` with no `kinds` — an impossible state. Must stay empty. */
  impossibleSpecs: string[];
  /**
   * A free-aim spec demanding MORE THAN ONE target. Must stay empty.
   *
   * ⚠️ The bound is one, not zero, and the difference is a real distinction. An
   * Aura whose subtype the parser cannot read (`Enchant Zombie`) genuinely does
   * require exactly one target, and requiring it is honest — there is always at
   * least one living player to point at, so a `min` of 1 can always be
   * satisfied. A `min` of two or more could not be, on a board that had emptied,
   * and that is the shape that makes a card uncastable.
   */
  freeSpecsDemandingMany: string[];
}

async function run(): Promise<Report> {
  const report: Report = {
    cards: 0,
    faces: 0,
    threw: [],
    warnings: {},
    landsWithBasicTypeAndNoMana: [],
    typelessFaces: 0,
    typelessButLegal: [],
    unknownTypeButLegal: [],
    infect: 0,
    wither: 0,
    toxic: 0,
    wardMana: 0,
    wardLife: 0,
    targets: { facesWithSpecs: 0, specs: 0, confident: 0, free: 0, enchant: 0, withUnenforced: 0 },
    activated: { lines: 0, payable: 0, manaAbility: 0, targeted: 0 },
    impossibleSpecs: [],
    freeSpecsDemandingMany: [],
  };
  const warn = (c: string): void => {
    report.warnings[c] = (report.warnings[c] ?? 0) + 1;
  };
  const BASIC_TYPES = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']);

  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card: CardData;
    try {
      card = JSON.parse(line) as CardData;
    } catch (err) {
      report.threw.push({ name: '<unparseable line>', error: String(err) });
      continue;
    }
    report.cards++;
    for (let i = 0; i < card.faces.length; i++) {
      report.faces++;
      const before = report.warnings['typeLine:unknownType'] ?? 0;
      try {
        const face = parseFace(card, i, warn);
        // ⚠️ M5 promotions, counted live rather than trusted. A parser change
        // that silently stopped producing one of these would leave every test
        // below green while the engine quietly enforced nothing.
        if (face.keywords.includes('infect')) report.infect++;
        if (face.keywords.includes('wither')) report.wither++;
        if (face.toxicAmount > 0) report.toxic++;
        if (face.wardCost) report.wardMana++;
        if (face.wardLife > 0) report.wardLife++;

        const allSpecs = [...face.targets, ...face.activated.flatMap((a) => a.targets)];
        for (const spec of allSpecs) {
          if (spec.confident && spec.kinds.length === 0 && report.impossibleSpecs.length < 20) {
            report.impossibleSpecs.push(`${card.name} :: ${spec.text}`);
          }
          if (spec.kinds.length === 0 && spec.min > 1 && report.freeSpecsDemandingMany.length < 20) {
            report.freeSpecsDemandingMany.push(`${card.name} :: ${spec.text}`);
          }
        }
        if (face.targets.length > 0) report.targets.facesWithSpecs++;
        for (const spec of face.targets) {
          report.targets.specs++;
          if (spec.kinds.length === 0) report.targets.free++;
          else report.targets.confident++;
          if (spec.unenforced.length > 0) report.targets.withUnenforced++;
          if (/^Enchant\b/i.test(spec.text)) report.targets.enchant++;
        }
        for (const ability of face.activated) {
          report.activated.lines++;
          if (ability.payable) report.activated.payable++;
          if (ability.isManaAbility) report.activated.manaAbility++;
          if (ability.targets.length > 0) report.activated.targeted++;
        }
        if (
          (report.warnings['typeLine:unknownType'] ?? 0) > before &&
          card.commanderLegality === 'legal' &&
          report.unknownTypeButLegal.length < 20
        ) {
          report.unknownTypeButLegal.push(`${card.name} :: ${card.faces[i]?.typeLine ?? ''}`);
        }
        if (face.isLand && face.typeLine.subtypes.some((s) => BASIC_TYPES.has(s))) {
          if (face.producesMana.length === 0 && report.landsWithBasicTypeAndNoMana.length < 20) {
            report.landsWithBasicTypeAndNoMana.push(card.name);
          }
        }
        if (face.typeLine.types.length === 0) {
          report.typelessFaces++;
          // A face with no type at all can never be played. It matters only if
          // one is Commander-legal, in which case something is genuinely wrong.
          if (card.commanderLegality === 'legal' && report.typelessButLegal.length < 20) {
            report.typelessButLegal.push(`${card.name} [${card.layout}]`);
          }
        }
      } catch (err) {
        if (report.threw.length < 20) report.threw.push({ name: card.name, error: String(err) });
      }
    }
  }
  return report;
}

describe.skipIf(!HAVE_DB)('bulk oracle ingest', () => {
  let report: Report;

  test('reads the whole database', async () => {
    report = await run();
    expect(report.cards).toBeGreaterThan(100_000);
    if (process.env.CRT_INGEST_REPORT) {
      const sorted = Object.entries(report.warnings).sort((a, b) => b[1] - a[1]);
      // eslint-disable-next-line no-console
      console.log(
        `\ningest: ${report.cards} cards / ${report.faces} faces\n` +
          sorted.map(([k, v]) => `  ${String(v).padStart(7)}  ${k}`).join('\n'),
      );
    }
  }, 180_000);

  test('nothing throws', () => {
    expect(report.threw).toEqual([]);
  });

  /**
   * ⚠️ The regression guard for the intrinsic land-type pass. Every land with a
   * basic land type must produce mana, whether or not it prints any text — the
   * original duals print none at all.
   */
  test('every land with a basic land type produces mana', () => {
    expect(report.landsWithBasicTypeAndNoMana).toEqual([]);
  });

  /**
   * Measured on the 2026-07-26 data: exactly 17 faces have an empty type line,
   * every one of them layout `other` and `commanderLegality: 'not_legal'` —
   * the second halves of Un-set minigame cards ("Dominarioes (cont'd)"). They
   * cannot reach a deck, so the assertion that matters is the second one; the
   * count is pinned so the number moving is visible rather than silent.
   */
  test('a face with no card type is Commander-illegal, and there are 17 of them', () => {
    expect(report.typelessButLegal).toEqual([]);
    expect(report.typelessFaces).toBe(17);
  });

  /**
   * ⚠️ THE ASSERTION THAT ACTUALLY MATTERS about unknown type words.
   *
   * The count is not zero and should not be: `Card`, `Summon`, `Event` and
   * `Boss` are Un-set and Portal oddities on cards that can never reach a
   * Commander deck. What would be a real bug is a LEGAL card whose type we do
   * not understand — `isPermanent` would be wrong, and the card would be
   * castable and never land. Battle and Spacecraft were both added since 2023,
   * so this is the check that notices the next one.
   */
  test('no Commander-LEGAL card carries a type word we do not know', () => {
    expect(report.unknownTypeButLegal).toEqual([]);
  });

  /**
   * The M5 Tier-2 promotions (D68), pinned as counts.
   *
   * ⚠️ A data refresh legitimately moves these. When it does, re-measure and
   * update D32 in DECISIONS.md in the same commit — that is the whole point of
   * pinning them rather than asserting "> 0". A number drifting silently is how
   * a promoted keyword quietly stops being parsed.
   */
  test('the M5 keyword promotions are all still parsed', () => {
    // One object, so a data refresh shows EVERY number that moved in one run
    // rather than the first one and nothing else.
    expect({
      infect: report.infect,
      wither: report.wither,
      toxic: report.toxic,
      wardMana: report.wardMana,
      wardLife: report.wardLife,
    }).toEqual({ infect: 96, wither: 46, toxic: 89, wardMana: 630, wardLife: 57 });
  });

  /**
   * ⚠️ The D32 table, as an executable pin. These are the honest measure of
   * Tier-2 coverage, and DECISIONS.md D32 carries the same numbers with the
   * reasoning. If this fails after a card-data update, re-measure, update BOTH,
   * and say in D32 what moved and why.
   */
  test('the measured coverage matches the numbers pinned in D32', () => {
    expect(report.warnings).toEqual({
      'keywords:noneTier2': 23555,
      'effect:none': 18569,
      'effect:partial': 4148,
      'effect:auto': 1614,
      'activated:nonManaCost': 13581,
      'activated:loyalty': 4635,
      'target:modalUnion': 2751,
      'target:unparsedClause': 1459,
      'typeLine:unknownType': 729,
      'protection:unenforced': 677,
      'mana:noSymbols': 629,
      'target:unparsedCount': 549,
      'ward:nonManaCost': 151,
      'mana:variableAmount': 102,
      'target:unparsedEnchant': 14,
      'mana:unknownSymbolInAbility': 18,
      'mana:noUsableOutput': 10,
      'manaCost:unknownSymbol': 2,
      'manaCost:halfMana': 1,
    });
  });

  /**
   * Targeting coverage, measured POSITIVELY.
   *
   * ⚠️ The warning tally above counts only what the parser failed to read, and a
   * refactor that quietly routed every clause to free aim would leave all of it
   * matching while the feature stopped working. These are the numbers that say
   * it still reads cards.
   */
  test('the targeting coverage matches the numbers pinned in D79', () => {
    expect(report.targets).toEqual({
      facesWithSpecs: 19757,
      specs: 20840,
      confident: 17330,
      free: 3510,
      enchant: 3536,
      withUnenforced: 1987,
    });
    expect(report.activated).toEqual({
      lines: 42945,
      payable: 24729,
      manaAbility: 11911,
      targeted: 11031,
    });
  });

  /**
   * The structural invariants — true of EVERY card, no matter what the data does.
   *
   * ⚠️ The second one is the safety property the whole free-aim design rests on:
   * a clause the parser could not read must never make a spell uncastable. If
   * this ever fails, some card in the database has become impossible to play.
   */
  test('a spec is never confident with no kinds, and no free spec demands more than one target', () => {
    expect(report.impossibleSpecs).toEqual([]);
    expect(report.freeSpecsDemandingMany).toEqual([]);
  });

  test('the warning tally is dominated by known, named categories', () => {
    // A new category appearing here means a parser met something it has never
    // seen. That should be a deliberate decision, not a silent drift.
    const known = new Set([
      'keywords:noneTier2',
      'mana:variableAmount',
      'mana:noSymbols',
      'mana:noUsableOutput',
      'mana:unknownSymbolInAbility',
      'mana:anyCombination',
      'protection:unenforced',
      'ward:nonManaCost',
      'typeLine:unknownType',
      'manaCost:strayCharacters',
      'manaCost:unknownSymbol',
      'manaCost:halfMana',
      'manaCost:infinity',
      'manaCost:unparseable',
      'manaCost:unknownHybridHalf',
      'manaCost:degenerateHybrid',
      // Targeting (D79). Each one is a clause the parser declined to guess at
      // and routed to free aim, which is a deliberate outcome, not a defect.
      'target:unparsedClause',
      'target:unparsedCount',
      'target:unparsedEnchant',
      'target:modalUnion',
      'activated:nonManaCost',
      'activated:loyalty',
      // Effects (D90). 'partial' is the load-bearing one: understood-but-
      // incomplete NEVER executes, it is offered to the player instead.
      'effect:auto',
      'effect:partial',
      'effect:none',
    ]);
    expect(Object.keys(report.warnings).filter((k) => !known.has(k))).toEqual([]);
  });

  test('a handful of real cards parse to the expected shape', () => {
    // Sanity that the file being read is the file we think it is.
    expect(parseTypeLine('Legendary Creature — Human Wizard').types).toEqual(['Creature']);
    expect(parseManaCost('{1}{U}{B}{R}')?.manaValue).toBe(4);
  });
});

describe.skipIf(HAVE_DB)('bulk oracle ingest (skipped)', () => {
  test('no card database — run `node electron/cardsvc-worker.cjs --sync`', () => {
    expect(HAVE_DB).toBe(false);
  });
});
