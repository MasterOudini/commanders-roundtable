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
  /**
   * ⚠️ MULTI-COLOUR LANDS, measured in both directions — the honest form of "the
   * mana chooser works for every land, not only Command Tower". `multiColour` is
   * how many Commander-legal lands can make more than one colour at all;
   * `oneOption` is how many of those the ingest still boils down to a single
   * choice, which is the number that must be talked about rather than rounded
   * off. `byShape` says HOW they got there, because the three shapes fail
   * differently: intrinsic land types, one clause reading "Add {W} or {U}", and
   * "any colour".
   */
  lands: {
    total: number;
    multiColour: number;
    oneOption: number;
    byShape: Record<string, number>;
    examples: Record<string, string>;
    misses: string[];
  };
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
    lands: { total: 0, multiColour: 0, oneOption: 0, byShape: {}, examples: {}, misses: [] },
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
        // ── What a multi-colour land actually OFFERS when you tap it ─────────
        //
        // ⚠️ Counted through the SAME arithmetic the panel uses: expand
        // `anyColor` (against five colours, the widest a real identity gets),
        // flatten every ability's outputs, and dedupe by cost string. Counting
        // `producesMana.length` instead would say a dual land has two options
        // and a "{T}: Add {W} or {U}" land has one, when to a player they are
        // the same land.
        if (face.isLand && card.commanderLegality === 'legal' && i === 0) {
          report.lands.total++;
          const costs: string[] = [];
          for (const prod of face.producesMana) {
            const outs = prod.anyColor
              ? (['W', 'U', 'B', 'R', 'G'] as const).map((c) => ({
                  mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, [c]: prod.anyColor?.amount ?? 1 },
                }))
              : prod.outputs;
            for (const o of outs) {
              const cost = (['W', 'U', 'B', 'R', 'G', 'C'] as const)
                .map((k) => `{${k}}`.repeat((o.mana as Record<string, number>)[k] ?? 0))
                .join('');
              if (cost && !costs.includes(cost)) costs.push(cost);
            }
          }
          // ⚠️ "MAKES TWO COLOURS" AND "OFFERS A CHOICE" ARE DIFFERENT THINGS,
          // and conflating them is the first thing this measurement got wrong.
          // Dimir Aqueduct taps for `{U}{B}` — two colours, one option, nothing
          // to choose — as do the Odyssey filter lands (`{W}{U}`) and every
          // karoo. Flagging those as misses reported twenty perfectly correct
          // lands as broken. What the panel exists for is a land offering more
          // than one ANSWER.
          if (costs.length >= 2) {
            report.lands.multiColour++;
            const shape = face.producesMana.some((p) => p.anyColor)
              ? 'any colour'
              : face.producesMana.length > 1
                ? 'several abilities'
                : 'one clause, several outputs';
            report.lands.byShape[shape] = (report.lands.byShape[shape] ?? 0) + 1;
            report.lands.examples[shape] ??= `${card.name} → ${costs.join(' ')}`;
          }
          // ⚠️ THE MISS TEST, in the direction that can rot: the card's own text
          // (or its land types) says there is a choice, and the ingest produced
          // fewer than two answers. Two intrinsic basic types is a dual; `or`
          // between mana symbols is `Add {W} or {U}`; "any color" is the Tower.
          // Each is a shape the parser has a branch for, so a miss means a
          // branch stopped firing — which is exactly the failure that would let
          // a player tap a dual land and silently get whichever colour is first.
          const basics = face.typeLine.subtypes.filter((s) => BASIC_TYPES.has(s));
          const text = face.oracleText ?? '';
          const saysChoice =
            basics.length >= 2
            || /add\b[^.]*\{[WUBRGC]\}[^.]*\bor\b[^.]*\{[WUBRGC]\}/i.test(text)
            || /add\s+(?:one|two|three|a|an|X)\s+mana\s+of\s+any/i.test(text);
          if (saysChoice && costs.length < 2) {
            report.lands.oneOption++;
            if (report.lands.misses.length < 20) {
              report.lands.misses.push(`${card.name} → [${costs.join(' ')}]`);
            }
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
      // eslint-disable-next-line no-console
      console.log(
        `\nlands: ${report.lands.total} Commander-legal · ${report.lands.multiColour} make more `
          + `than one colour · ${report.lands.oneOption} of those offer fewer than two options\n`
          + Object.entries(report.lands.byShape)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `  ${String(v).padStart(7)}  ${k}  (e.g. ${report.lands.examples[k]})`)
            .join('\n')
          + (report.lands.misses.length ? `\n  misses: ${report.lands.misses.join(' | ')}` : ''),
      );
    }
  }, 180_000);

  /**
   * ⚠️ EVERY land that can make more than one colour offers more than one
   * choice. This is "the mana chooser works for every land, not only Command
   * Tower" as a number rather than a claim, and it is asserted in the direction
   * that can actually rot: a parser change that collapsed `Add {W} or {U}` into
   * one output, or dropped an intrinsic land type, would leave the player
   * tapping a dual land and silently getting whichever colour came first.
   *
   * ⚠️ `multiColour` is pinned as a floor too, because zero of zero satisfies
   * the line above — the same green-over-nothing this repo has been caught by
   * three times.
   */
  test('every multi-colour land offers every colour it can make', () => {
    // ⚠️ 4,270 of 12,500 Commander-legal lands offer more than one answer, in
    // three shapes: 2,070 "one clause, several outputs" (Orzhov Guildgate),
    // 1,487 "several abilities" (the duals and their intrinsic types), and 713
    // "any colour" (Command Tower, Reflecting Pool, Pillar of the Paruns).
    // Pinned as a floor, because "zero of zero" satisfies the assertion below.
    expect(report.lands.multiColour).toBeGreaterThan(4000);
    // ⚠️ TWENTY-SIX PRINTINGS ARE NOT COVERED, and the list is named rather
    // than rounded off. Every one is a scope the ingest genuinely cannot
    // resolve, in THREE families since D147: a SUBTYPE-scoped set ("a Gate you
    // control could produce" — Plaza of Harmony, Gond Gate, Pit of Offerings), a
    // VARIABLE amount ("Add X mana of any one color" — Baldur's Gate,
    // Springjack Pasture), and — new — an any-colour ability that IS NOT THIS
    // LAND'S TO USE, either on a trigger or granted to something else.
    // Widening either would offer mana the card cannot make, which is worse than
    // offering none. They keep whatever concrete ability they have — all five
    // still tap for {C} — and `tier3.ts` says on the card what is not enforced.
    const distinct = [...new Set(report.lands.misses.map((m) => m.split(' →')[0]))].sort();
    expect(distinct).toEqual([
      "Baldur's Gate",
      // ⚠️ FOUR LANDS JOINED THIS LIST IN D147, and every one of them was
      // OFFERING MANA IT CANNOT MAKE before that. Their any-colour ability is
      // not theirs to use: `Crumbling Vestige` and `Branch of Vitu-Ghazi` have
      // it on a TRIGGER (when it enters / when it is turned face up), and
      // `The World Tree` and `Riftstone Portal` GRANT it to other lands in
      // quoted text. Tapping any of the four gives {C} or {G} and nothing else
      // — which is what they offer now.
      'Branch of Vitu-Ghazi',
      'Crumbling Vestige',
      'Gond Gate',
      'Pit of Offerings',
      'Plaza of Harmony',
      'Riftstone Portal',
      'Springjack Pasture',
      'The World Tree',
    ]);
    // ⚠️ PRINTINGS, not names — 26 across the nine cards above, where the list
    // itself is deduplicated. It was 13 across five until D147 added four
    // lands whose any-colour ability turned out not to be theirs to use.
    expect(report.lands.oneOption).toBe(26);
  });

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
      // ⚠️ M6.3c moved all three (D130): the counter vocabulary took 115 FACES
      // out of "understood nothing" — 17 to fully understood and 98 to partly,
      // where the prompt bar offers the counter clause as one logged click.
      // These count FACES over every printing, which is why they are an order of
      // magnitude larger than `botPool`'s distinct-name figures.
      'effect:none': 16501,
      'effect:partial': 5066,
      'effect:auto': 2764,
      // ⚠️ 13,581 → 10,372 in M6.4b (D159): `Sacrifice this <type>` and War
      // Room's commanders'-colors life phrase became CHARGEABLE cost parts, so
      // 3,209 printings' ability lines stopped warning `nonManaCost`. The
      // engine OFFERS a self-sacrifice only when a def will run it —
      // `legal.ts`'s gate — so this is the parse admitting a price, not the
      // app charging one for nothing.
      // ⚠️ 10,372 → 8,572 in M6.4k (D168): `Sacrifice a <predicate>` became
      // the CHOOSER cost — 1,800 printings' lines moved, and `payable` below
      // grew by exactly the same 1,800, the two sides of one reclassification.
      // Same def gate: chargeable is not offerable.
      'activated:nonManaCost': 8572,
      'activated:loyalty': 4635,
      'target:modalUnion': 2751,
      'target:unparsedClause': 1459,
      'typeLine:unknownType': 729,
      'protection:unenforced': 677,
      // ⚠️ 629 → 540 when "any TYPE" started parsing (D116): 89 of these were
      // Reflecting Pool and its family falling through to "there are no mana
      // symbols in this line", because the pattern only knew "any color".
      'mana:noSymbols': 227,
      // ⚠️ The same shape over a set the parser cannot resolve — "a GATE you
      // control could produce", and nothing else. Answering it with every colour
      // your lands make would offer mana the card cannot produce, so it warns
      // and produces nothing.
      'mana:anyScopeUnread': 16,
      // 549 → 551 in M6.4b (D159): two long-cost lines reclassified
      // sentence→activated by the brace rule carry a count clause the parser
      // declines to guess — invisible to targeting before, honestly counted now.
      'target:unparsedCount': 551,
      'ward:nonManaCost': 151,
      'mana:variableAmount': 88,
      'target:unparsedEnchant': 14,
      'mana:unknownSymbolInAbility': 10,
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
      withUnenforced: 1300,
    });
    // ⚠️ M6.4b (D159) moved three of these over the whole 113,559-printing
    // database: `lines` +195 (the brace rule admits a long cost that opens
    // with a mana/tap symbol — before, an 82-character cost read as a static
    // sentence), `payable` +3,404 (self-sacrifice and the commanders'-colors
    // life phrase became chargeable PRICES — offered only where a def will run
    // the effect, `legal.ts`'s gate), `targeted` +50 (target clauses inside
    // the newly admitted lines).
    expect(report.activated).toEqual({
      lines: 43140,
      // ⚠️ 28,133 → 29,933 in M6.4k (D168): the sacrifice-cost chooser's
      // 1,800 lines — the exact mirror of `nonManaCost`'s fall above.
      payable: 29933,
      // ⚠️ 11,911 → 11,938: the 27 lines D116 taught the parser to read.
      manaAbility: 11582,
      targeted: 11081,
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
      'mana:anyScopeUnread',
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
