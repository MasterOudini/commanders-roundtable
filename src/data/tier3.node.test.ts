// How many real cards the Tier-3 disclosure speaks for — the whole card
// database through `tier3NotesFor`, in one pass.
//
// ⚠️ THIS IS THE NUMBER D122 AND D124 ARE ABOUT. AGENTS.md invariant 9 says a
// category the app does not enforce must be SAID, and `tier3.ts` was silent about
// three of them: a permanent's triggered and static text and a payable-but-unrun
// activated ability (D121's reportable list, items 1 and 2), plus the half of a
// mana line that is not "add mana" (D124, found by this pass). "A creature with a
// triggered ability says nothing" is a bug you can see on one card; how many cards
// it is, is a question only the database can answer, and the answer is what decides
// whether the gap was a curiosity or the common case.
//
// ⚠️ SAME PASS, SAME UNIT AS `botPool.node.test.ts`, deliberately: distinct NAMES
// with at least one Commander-legal printing, read from the FIRST face. D121 found
// D90's figures irreproducible because the unit was never written down — a
// distinct-name count and a printings count sat in adjacent rows of one table —
// so `distinct` is cross-checked against that file's 31,692 here rather than
// re-derived. Where a per-face reading differs, BOTH are reported.
//
// ⚠️ A `.node.test.ts` for `oracleParse.node.test.ts`'s reasons: the real parsers
// over the real database need TypeScript, and this project has no TS runner
// outside Vitest. A `.cjs` would have to reimplement `parseFace`, which is the
// "second heuristic beside the first" `tier3.ts` records learning to avoid twice.
//
// Run it:
//   CRT_TIER3_REPORT=1 npx vitest run src/data/tier3.node.test.ts
//
// ⚠️ Skips (rather than fails) with no card database, and the skip is loud.

import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import { ABILITY_TEXT_NOTE, MANA_PART_NOTE, abilityNoteLabel, tier3NotesFor } from './tier3';
import { engineCompleteness, unaccountedLines } from './engineComplete';
import { parseFace } from './oracleParse';
import { splitAbilityLines } from './targetParse';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const REPORT = process.env.CRT_TIER3_REPORT === '1';

/**
 * The labels the three D122/D124 branches — and only they — could have produced
 * for one face.
 *
 * ⚠️ THE POINT OF DOING IT THIS WAY. "How many cards were silent before?" needs a
 * before, and the honest before is not a second copy of the old predicate sitting
 * in a test file: it is the notes that are there now, minus the ones the new
 * branches added. All three branches are purely additive — nothing was removed
 * and no `how` of an existing note changed — so the subtraction is exact.
 *
 * ⚠️ Except for one collision, which is guarded: a payable and a NON-payable
 * ability can print the SAME cost string, notes dedupe by label, and the old code
 * already named the non-payable one. Crediting that label to D122 would overstate
 * the population.
 */
function newLabels(card: CardData, faceIndex: number): Set<string> {
  const face = parseFace(card, faceIndex);
  const labels = new Set<string>([ABILITY_TEXT_NOTE, MANA_PART_NOTE]);
  const alreadyNamed = new Set(
    face.activated
      .filter((a) => !a.isManaAbility && !a.isLoyalty && !a.payable)
      .map((a) => abilityNoteLabel(a.costText)),
  );
  for (const a of face.activated) {
    if (a.isManaAbility || a.isLoyalty || !a.payable) continue;
    const label = abilityNoteLabel(a.costText);
    if (!alreadyNamed.has(label)) labels.add(label);
  }
  return labels;
}

interface FaceVerdict {
  readonly notes: number;
  readonly before: number;
  readonly abilityText: boolean;
  readonly manaPart: boolean;
  readonly payable: boolean;
}

function verdictFor(card: CardData, faceIndex: number): FaceVerdict {
  const notes = tier3NotesFor(card, faceIndex);
  const added = newLabels(card, faceIndex);
  const fresh = notes.filter((n) => added.has(n.what));
  return {
    notes: notes.length,
    before: notes.length - fresh.length,
    abilityText: fresh.some((n) => n.what === ABILITY_TEXT_NOTE),
    manaPart: fresh.some((n) => n.what === MANA_PART_NOTE),
    // Whatever is left is an ability named by its cost — the D122 payable branch.
    payable: fresh.some((n) => n.what !== ABILITY_TEXT_NOTE && n.what !== MANA_PART_NOTE),
  };
}

interface Report {
  printings: number;
  /** Distinct names with at least one Commander-legal printing. */
  distinct: number;
  /** …whose first face is a permanent. */
  permanents: number;

  /** Front face raises the unrun-ability-text note (D122). */
  abilityText: number;
  /** Front face raises a note for an ability the engine charges and does not run (D122). */
  payable: number;
  /** Front face raises the part-of-a-mana-line note (D124). */
  manaPart: number;
  /** Any of the three. */
  either: number;
  /** Any of the three, counting ANY face rather than the front one. */
  eitherAnyFace: number;

  /** Said NOTHING before D122/D124 and says something now — invariant 9's population. */
  wasSilent: number;
  /** The same, counting any face. */
  wasSilentAnyFace: number;

  /** Cards with no note at all, before and after. */
  silentBefore: number;
  silentAfter: number;

  /**
   * ⚠️ WHAT IS STILL UNSAID, and it is reported rather than fixed. A card the
   * engine does not run completely and that no note mentions on any face.
   *
   * ⚠️ `residualManaLine` was 339 when D122 shipped and is **0** now: it was the
   * third gap, and D124 closed it. What is left is `residualKeyword` — a keyword
   * line D68 chose not to name (`Exalted`, `Undying`, `Bushido 1`) — which is a
   * decision rather than an omission. Both counters stay, because the day the mana
   * one goes non-zero again is a day worth failing on.
   */
  residual: number;
  residualKeyword: number;
  residualManaLine: number;
  residualOther: number;
  residualReasons: Record<string, number>;

  /**
   * ⚠️ THE INVARIANT, MEASURED OVER 31,692 CARDS INSTEAD OF 82 FIXTURES: a card
   * the app says it handles completely may carry no Tier-3 note.
   * `engineComplete.test.ts` asserts this over the fixtures; this is the same
   * claim with the whole database behind it.
   */
  completeButNoted: string[];

  /**
   * ⚠️ HOW LONG THE PANEL GETS, because `tier3.ts`'s own header says a nine-item
   * list "pushes the oracle text off the screen" and `CardZoomPanel` renders every
   * note rather than the capped summary. Adding two note kinds is exactly the
   * change that could have made that real.
   */
  maxNotes: number;
  maxNotesCard: string;
  fourOrMore: number;

  /**
   * ⚠️ A PRE-EXISTING DEFECT, MEASURED BECAUSE D124's CLASSIFIER HAD TO GUARD
   * AGAINST IT — reported, not fixed, and worse than it looked from the guard.
   *
   * A mana production recorded on a line that is not an activated ability, which
   * CR 605.1a says a mana ability must be. `parseManaProduction` tests a line for
   * the word "add" on the RAW text and, with no colon, takes the whole line as the
   * effect — so it records a production for `Whenever this creature attacks, add
   * {R}` (a trigger), and, worse, for text the card GRANTS TO SOMETHING ELSE or
   * merely explains: `Noggle Robber`'s Treasure reminder text, `Lotus Ring`'s
   * `"{T}, Sacrifice this creature: Add three mana of any one color."`. Every one
   * of those is a mana ability the card does not have. `scrub` exists for exactly
   * this and `parseManaProduction` does not use it.
   *
   * `manaSourcesOf` includes conditional productions for the manual tap menu and
   * all of these are conditional, so reading that path says they are offered as
   * clickable mana. Measured in the DATA and read in the CODE; not verified at a
   * table here, which is why it is reported rather than claimed.
   */
  strayMana: number;
  strayManaSamples: string[];

  samples: Record<string, string[]>;
}

function sample(r: Report, key: string, name: string): void {
  const list = (r.samples[key] ??= []);
  if (list.length < 12) list.push(name);
}

async function run(): Promise<Report> {
  const r: Report = {
    printings: 0,
    distinct: 0,
    permanents: 0,
    abilityText: 0,
    payable: 0,
    manaPart: 0,
    either: 0,
    eitherAnyFace: 0,
    wasSilent: 0,
    wasSilentAnyFace: 0,
    silentBefore: 0,
    silentAfter: 0,
    residual: 0,
    residualKeyword: 0,
    residualManaLine: 0,
    residualOther: 0,
    residualReasons: {},
    completeButNoted: [],
    maxNotes: 0,
    maxNotesCard: '',
    fourOrMore: 0,
    strayMana: 0,
    strayManaSamples: [],
    samples: {},
  };
  const seen = new Set<string>();
  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    r.printings++;
    let card: CardData;
    try {
      card = JSON.parse(line) as CardData;
    } catch {
      continue;
    }
    if (card.commanderLegality !== 'legal') continue;
    // ⚠️ Dedupe AFTER the legality test, exactly as `botPool.node.test.ts` does,
    // so a name counts from its first LEGAL printing and the two passes describe
    // the same 31,692 cards.
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    r.distinct++;

    const front = verdictFor(card, 0);
    if (parseFace(card, 0).isPermanent) r.permanents++;
    if (front.abilityText) {
      r.abilityText++;
      sample(r, 'abilityText', card.name);
    }
    if (front.payable) {
      r.payable++;
      sample(r, 'payable', card.name);
    }
    if (front.manaPart) {
      r.manaPart++;
      sample(r, 'manaPart', card.name);
    }
    if (front.abilityText || front.payable || front.manaPart) r.either++;
    if (front.notes === 0) r.silentAfter++;
    if (front.before === 0) r.silentBefore++;
    if (front.before === 0 && front.notes > 0) {
      r.wasSilent++;
      sample(r, 'wasSilent', card.name);
    }

    const faces = card.faces.map((_, i) => verdictFor(card, i));
    const longest = Math.max(...faces.map((f) => f.notes));
    if (longest >= 4) r.fourOrMore++;
    if (longest > r.maxNotes) {
      r.maxNotes = longest;
      r.maxNotesCard = card.name;
    }
    if (faces.some((f) => f.abilityText || f.payable || f.manaPart)) r.eitherAnyFace++;
    if (faces.every((f) => f.before === 0) && faces.some((f) => f.notes > 0)) r.wasSilentAnyFace++;

    // A mana production sitting on a line that is not an activated ability.
    for (let i = 0; i < card.faces.length; i++) {
      const face = parseFace(card, i);
      if (!face.isPermanent) continue;
      const activated = new Set(
        splitAbilityLines(face.oracleText, true)
          .filter((l) => l.kind === 'activated')
          .map((l) => l.index),
      );
      const stray = face.producesMana.filter((p) => p.line !== null && !activated.has(p.line));
      if (stray.length === 0) continue;
      r.strayMana++;
      if (r.strayManaSamples.length < 6) {
        r.strayManaSamples.push(`${card.name} ⟨${stray[0]?.text ?? ''}⟩`);
      }
      break;
    }

    const completeness = engineCompleteness(card);
    if (completeness.complete) {
      if (faces.some((f) => f.notes > 0)) r.completeButNoted.push(card.name);
    } else if (faces.every((f) => f.notes === 0)) {
      r.residual++;
      sample(r, 'residual', card.name);
      const lines = card.faces.flatMap((_, i) => [...unaccountedLines(card, i)]);
      if (lines.some((l) => l.kind === 'mana')) r.residualManaLine++;
      else if (lines.length > 0 && lines.every((l) => l.kind === 'keyword')) r.residualKeyword++;
      else r.residualOther++;
      // The shape of what is left, keyed like `botPool`'s reject table.
      const first = lines[0];
      const key = first ? `${first.kind}: ${first.text.split(/\s+/).slice(0, 5).join(' ')}` : '(nothing)';
      r.residualReasons[key] = (r.residualReasons[key] ?? 0) + 1;
    }
  }
  return r;
}

describe.skipIf(!HAVE_DB)('what the Tier-3 disclosure now says, measured', () => {
  let r: Report;

  test('reads the whole database', async () => {
    r = await run();
    expect(r.printings).toBeGreaterThan(100_000);
    if (!REPORT) return;
    const pc = (n: number): string => `${((100 * n) / r.distinct).toFixed(1)}%`;
    // eslint-disable-next-line no-console
    console.log(
      `\nD122/D124 — TIER-3 DISCLOSURE, over ${r.distinct} distinct Commander-legal cards\n` +
        `  ${String(r.permanents).padStart(6)}  first face is a permanent\n` +
        `\n  NEWLY SAID (front face):\n` +
        `  ${String(r.abilityText).padStart(6)}  ${pc(r.abilityText).padStart(6)}  unrun triggered/static ability text\n` +
        `  ${String(r.payable).padStart(6)}  ${pc(r.payable).padStart(6)}  an ability the engine charges and does not run\n` +
        `  ${String(r.manaPart).padStart(6)}  ${pc(r.manaPart).padStart(6)}  a mana line the engine runs only part of\n` +
        `  ${String(r.either).padStart(6)}  ${pc(r.either).padStart(6)}  any of the three\n` +
        `  ${String(r.eitherAnyFace).padStart(6)}  ${pc(r.eitherAnyFace).padStart(6)}  any of the three, counting ANY face\n` +
        `\n  THE SILENCE INVARIANT 9 IS ABOUT:\n` +
        `  ${String(r.wasSilent).padStart(6)}  ${pc(r.wasSilent).padStart(6)}  said NOTHING before, says something now\n` +
        `  ${String(r.wasSilentAnyFace).padStart(6)}  ${pc(r.wasSilentAnyFace).padStart(6)}  the same, any face\n` +
        `  ${String(r.silentBefore).padStart(6)}  ${pc(r.silentBefore).padStart(6)}  cards with no note at all BEFORE\n` +
        `  ${String(r.silentAfter).padStart(6)}  ${pc(r.silentAfter).padStart(6)}  cards with no note at all AFTER\n` +
        `\n  STILL UNSAID — reported, not fixed:\n` +
        `  ${String(r.residual).padStart(6)}  ${pc(r.residual).padStart(6)}  the engine runs them incompletely and nothing says so\n` +
        `  ${String(r.residualKeyword).padStart(6)}          of those, only an unnamed keyword line — D68's decision\n` +
        `  ${String(r.residualManaLine).padStart(6)}          of those, a part-run mana line — was 339, closed by D124\n` +
        `  ${String(r.residualOther).padStart(6)}          of those, something else\n` +
        Object.entries(r.residualReasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => `  ${String(v).padStart(6)}  ${k}`)
          .join('\n') +
        `\n\n  panel length: longest list ${r.maxNotes} (${r.maxNotesCard}) · ` +
        `${r.fourOrMore} cards list 4 or more\n` +
        `  invariant: engine-complete cards carrying a note: ${r.completeButNoted.length}\n` +
        `\n  REPORTED, NOT FIXED — a mana production on a line that is not an activated\n` +
        `  ability (CR 605.1a says it cannot be one), mostly reminder or granted text:\n` +
        `  ${r.strayMana} cards\n` +
        r.strayManaSamples.map((s) => `        ${s}`).join('\n') +
        '\n' +
        Object.entries(r.samples)
          .map(([k, v]) => `\n  ${k}: ${v.join(' · ')}`)
          .join(''),
    );
  }, 300_000);

  /** The same population `botPool.node.test.ts` measures, so the two are comparable. */
  test('the same 31,692 cards botPool counts', () => {
    expect(r.distinct).toBe(31692);
  });

  /**
   * ⚠️ THE INVARIANT, over 31,692 cards rather than 82 fixtures. A card the app
   * tells the player it runs completely may not also carry a Tier-3 note — the
   * one direction `engineComplete.ts`'s footer promises, and the direction D122's
   * new branches could most easily have broken, since both read that module's own
   * line accounting.
   */
  test('nothing the engine runs completely carries a note', () => {
    expect(r.completeButNoted).toEqual([]);
  });

  /**
   * ⚠️ PINNED AS ONE OBJECT, like `botPool`'s `POOL`, so a Scryfall refresh or a
   * parser change shows every number that moved in a single failure rather than
   * one per run. Measured on the 2026-07-27 release (113,559 printings).
   */
  test('the numbers are what D122 records', () => {
    expect({
      permanents: r.permanents,
      abilityText: r.abilityText,
      payable: r.payable,
      manaPart: r.manaPart,
      either: r.either,
      eitherAnyFace: r.eitherAnyFace,
      wasSilent: r.wasSilent,
      wasSilentAnyFace: r.wasSilentAnyFace,
      silentBefore: r.silentBefore,
      silentAfter: r.silentAfter,
      residual: r.residual,
      residualKeyword: r.residualKeyword,
      residualManaLine: r.residualManaLine,
      residualOther: r.residualOther,
      strayMana: r.strayMana,
    }).toEqual(MEASURED);
  });

  /**
   * ⚠️ THE SHAPE, not the size — a canary for the case where a parser change makes
   * the note fire on everything or on nothing. Either would leave the pinned
   * object above as the only thing that noticed, and a note on every card is the
   * exact failure `tier3.test.ts`'s first test exists to prevent.
   */
  test('the note is neither universal nor extinct', () => {
    expect(r.abilityText).toBeGreaterThan(1_000);
    expect(r.abilityText).toBeLessThan(r.permanents);
    expect(r.silentAfter).toBeGreaterThan(1_000);
  });

  /**
   * ⚠️ THE HOVER PANEL LISTS EVERY NOTE — `tier3SummaryFor` caps at three and
   * nothing calls it — and `tier3.ts`'s header is explicit that a long list pushes
   * the card's own text off the screen. Two new note kinds could have made the
   * panel the thing that broke, so the length is MEASURED rather than assumed.
   *
   * The longest in the whole Commander-legal pool is 6: `Kenrith, the Returned
   * King`, five activated abilities the engine charges and does not run plus his
   * static line. 140 cards list four or more. `CardZoomPanel` sets no height on
   * its container — only on the card inside it — so a long list grows the panel
   * rather than clipping it, and 6 items is roughly one card-height of text. Pinned
   * so the next kind of note added has to look at this number.
   */
  test('the longest note list is still panel-sized', () => {
    expect({ maxNotes: r.maxNotes, fourOrMore: r.fourOrMore }).toEqual({ maxNotes: 6, fourOrMore: 131 });
  });

  /**
   * ⚠️ THE THIRD GAP, CLOSED — and this is the assertion that says so rather than
   * the prose. D122 measured 339 cards the engine runs incompletely while saying
   * nothing, whose unrun line carried a mana ability. It is 0, and everything still
   * silent is a keyword line D68 decided not to name.
   */
  test('no part-run mana line is left unsaid', () => {
    expect(r.residualManaLine).toBe(0);
    expect(r.residual).toBe(r.residualKeyword);
  });
});

/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('what the Tier-3 disclosure now says, measured', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect(HAVE_DB).toBe(false);
  });
});

/**
 * D122's and D124's measurement, on the 2026-07-27 Scryfall release (113,559
 * printings).
 *
 * ⚠️ THE HEADLINE IS `wasSilent`: 16,020 of 31,692 distinct Commander-legal cards
 * — 50.5% — said NOTHING AT ALL before these three notes existed, on an app whose
 * silence is defined to mean "handled completely". `silentBefore` → `silentAfter`
 * is the same fact from the other side: 17,824 cards said nothing, and 1,804 do
 * now. Invariant 9 was not being kept for half the card pool.
 *
 * ⚠️ `residualManaLine: 0` is D124, and `residual === residualKeyword` is what
 * makes the remaining silence a DECISION rather than an omission: every card the
 * engine runs incompletely and says nothing about is one whose only unrun text is
 * a keyword line D68 chose not to name.
 */
const MEASURED: Record<string, number> = {
  permanents: 24669,
  // ⚠️ M6.4a (D158) moved `abilityText` and every counter downstream of it by
  // EXACTLY the eight shipped cards — the silence hook discounts a line only
  // when a `SHIPPED_SCRIPTS` def carries its exact printed text, so the note
  // goes quiet on precisely the cards whose text now runs, and nothing else.
  // ⚠️ M6.4b (D159) moved the PARSE-side counters, not just the four landed
  // cards: `costLike` now admits a long cost that OPENS WITH A BRACE (War
  // Room's is 82 characters), and `Sacrifice this <type>` plus the commanders'
  // -colors life phrase became chargeable — so ~45 long-cost lines left
  // `abilityText` for truer per-cost notes, and `payable` grew by ~812
  // sacrifice-self abilities THAT ARE STILL NEVER OFFERED (the def gate in
  // `legal.ts`): their note says the manual route, and `silentAfter` moving by
  // exactly the four landed cards is the proof no disclosure was lost.
  // ⚠️ M6.4c (D160): −11 abilityText, −8 payable — nineteen shipped cards'
  // notes went silent, split across the two note kinds by what each card is.
  // ⚠️ M6.4d (D161): −9/−4 across the two note kinds — thirteen more silences.
  // ⚠️ M6.4k (D168) is D159's shape again: the sacrifice-cost CHOOSER made
  // "Sacrifice a <predicate>" chargeable, so `payable` grew by 489 cards whose
  // abilities are STILL NEVER OFFERED without a def — their note keeps the
  // manual-route wording, `abilityText` does not move, and `silentAfter`
  // moving by exactly the three landed cards is the proof no disclosure was
  // lost.
  // ⚠️ M6.4l (D169): twenty-three silences — the batch's cards leaving both
  // note kinds, split by what each card is.
  // ⚠️ M6.4m (D170): twenty-three more, same shape.
  abilityText: 17291,
  payable: 5211,
  manaPart: 625,
  either: 21247,
  eitherAnyFace: 21272,
  wasSilent: 16630,
  // ⚠️ M6.3c moved the three SILENCE counters by exactly the seven cards the
  // counter vocabulary completed (D130), and moving them is the correct
  // behaviour rather than a regression: a card the engine now runs in full must
  // say NOTHING, which is the invariant at the bottom of `engineComplete.ts`
  // and the first test in `tier3.test.ts`. `silentBefore` moves too because it
  // is computed with today's parsers under the PRE-D122 note rules — a complete
  // card is silent under both. `wasSilentAnyFace` moves by 4 rather than 7
  // because its aggregation asks about every face.
  // ⚠️ M6.4a: `silentBefore` did NOT move — the pre-D122 note rules never saw
  // a permanent's ability text at all, so a script silencing one changes
  // nothing under them. M6.4b's PARSE widening does move it: these baselines
  // are parse-relative, and a line reclassified sentence→activated changes
  // what the old rules would have said too.
  wasSilentAnyFace: 16499,
  silentBefore: 19054,
  silentAfter: 2424,
  residual: 356,
  residualKeyword: 356,
  residualManaLine: 0,
  residualOther: 0,
  strayMana: 0,
};
