// The whole card database, through `engineComplete`, in one pass — and the
// generator for the deck the bot sits down with.
//
// ⚠️ THIS IS THE ANSWER TO "MEASURE THE REAL STARTING POINT" (M6 handoff §10).
// Before this file, nothing in the repo computed how many CARDS the engine runs
// completely. `oracleParse.node.test.ts` counts FACES ACROSS ALL 113,559
// PRINTINGS — `effect:auto = 1,614` — with no legality filter, no type filter
// and no dedupe by name. D90's famous 274/1,300/6,975 are prose comments in
// `effectParse.ts` and `oracle.ts`, derived once by hand and copied forward
// three times since.
//
// ⚠️ UNITS. D90 counts DISTINCT NAMES; D116's land figures count PRINTINGS. The
// M6 brief's §2 table prints "6,975 instants and sorceries" next to "12,500
// lands" as if they were the same unit, and they are not — there are 1,114
// distinct Commander-legal lands. Every number below is labelled, and both units
// are reported where a claim exists in each.
//
// ⚠️ A `.node.test.ts` rather than a `scripts/*.cjs`, and that is forced rather
// than chosen: this has to run the REAL parsers over the REAL database, and
// there is no TypeScript runner in this project (no `tsx`, no `ts-node`, and
// Node's own type stripping cannot resolve the repo's extensionless imports).
// A `.cjs` would have to reimplement `parseFace` in CommonJS, which is exactly
// the "second heuristic beside the first" that `tier3.ts` records learning to
// avoid twice. `oracleParse.node.test.ts` is the precedent, in shape and in why.
//
// Run it:
//   CRT_BOTPOOL_REPORT=1 npx vitest run src/data/botPool.node.test.ts
//   CRT_WRITE_BOT_DECK=1 npx vitest run src/data/botPool.node.test.ts   → botDeck.ts
//
// ⚠️ Skips (rather than fails) with no card database, and the skip is loud — a
// suite that silently tests nothing is worse than one that fails.

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import type { ResolvedEntry } from './deckTypes';
import { engineCompleteness } from './engineComplete';
import { buildBotDeck } from './botDeckBuild';
import { parseFace, parseTypeLine } from './oracleParse';
import { validateCommanderDeck } from './validate';
import { BOT_DECK } from './botDeck';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const REPORT = process.env.CRT_BOTPOOL_REPORT === '1';
const WRITE = process.env.CRT_WRITE_BOT_DECK === '1';

type Bucket =
  | 'land'
  | 'creature'
  | 'artifact'
  | 'enchantment'
  | 'instant'
  | 'sorcery'
  | 'planeswalker'
  | 'battle'
  | 'other';

/**
 * ⚠️ FIRST FACE'S TYPE LINE, and the first face only — the same rule D90 used,
 * which is what makes 6,975 reproduce. `Fire // Ice` counts once, as an instant.
 */
function bucketOf(card: CardData): Bucket {
  const face = card.faces[0];
  if (!face) return 'other';
  const t = parseTypeLine(face.typeLine).types;
  if (t.includes('Land')) return 'land';
  if (t.includes('Creature')) return 'creature';
  if (t.includes('Planeswalker')) return 'planeswalker';
  if (t.includes('Battle')) return 'battle';
  if (t.includes('Instant')) return 'instant';
  if (t.includes('Sorcery')) return 'sorcery';
  if (t.includes('Artifact')) return 'artifact';
  if (t.includes('Enchantment')) return 'enchantment';
  return 'other';
}

interface Report {
  printings: number;
  legalPrintings: number;
  /** Distinct names with at least one Commander-legal printing. */
  distinct: number;
  legalLandPrintings: number;
  byType: Record<string, number>;
  poolByType: Record<string, number>;
  /** Instants + sorceries, distinct, by what `parseEffects` made of them. */
  spells: { total: number; auto: number; assisted: number; manual: number; autoAnyFace: number; multiFace: number };
  /** Why a card was refused, by its first unaccounted-for line's first four words. */
  rejects: Record<string, number>;
  pool: CardData[];
}

async function run(): Promise<Report> {
  const r: Report = {
    printings: 0,
    legalPrintings: 0,
    distinct: 0,
    legalLandPrintings: 0,
    byType: {},
    poolByType: {},
    spells: { total: 0, auto: 0, assisted: 0, manual: 0, autoAnyFace: 0, multiFace: 0 },
    rejects: {},
    pool: [],
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
    r.legalPrintings++;
    const bucket = bucketOf(card);
    if (bucket === 'land') r.legalLandPrintings++;
    // ⚠️ Dedupe AFTER the legality test, so a name counts from its first LEGAL
    // printing. A name whose every printing is banned never enters the set.
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    r.distinct++;
    r.byType[bucket] = (r.byType[bucket] ?? 0) + 1;

    if (bucket === 'instant' || bucket === 'sorcery') {
      r.spells.total++;
      const mode = parseFace(card, 0).effectMode;
      r.spells[mode]++;
      // ⚠️ D90 does not say which face it counted for a split card, so both
      // readings are measured. The gap between them is 2 cards — nowhere near
      // the 5 that separates this from D90's 274 — which is what rules the
      // hypothesis out rather than leaving it hanging.
      const modes = card.faces.map((_, i) => parseFace(card, i).effectMode);
      if (modes.includes('auto')) r.spells.autoAnyFace++;
      if (card.faces.length > 1) r.spells.multiFace++;
    }

    const verdict = engineCompleteness(card);
    if (verdict.complete) {
      r.poolByType[bucket] = (r.poolByType[bucket] ?? 0) + 1;
      r.pool.push(card);
    } else {
      const first = verdict.leftover[0] ?? '(unknown)';
      const key = first.split(/\s+/).slice(0, 4).join(' ');
      r.rejects[key] = (r.rejects[key] ?? 0) + 1;
    }
  }
  return r;
}

describe.skipIf(!HAVE_DB)('the bot pool, measured', () => {
  let r: Report;

  test('reads the whole database', async () => {
    r = await run();
    expect.soft(r.printings).toBeGreaterThan(100_000);
    if (!REPORT) return;
    const pool = Object.values(r.poolByType).reduce((a, b) => a + b, 0);
    const rows = (Object.keys(r.byType) as Bucket[])
      .sort((a, b) => (r.byType[b] ?? 0) - (r.byType[a] ?? 0))
      .map((k) => {
        const has = r.poolByType[k] ?? 0;
        const all = r.byType[k] ?? 0;
        const pc = all === 0 ? '—' : `${((100 * has) / all).toFixed(1)}%`;
        return `  ${String(has).padStart(6)} / ${String(all).padStart(6)}  ${pc.padStart(6)}  ${k}`;
      });
    // eslint-disable-next-line no-console
    console.log(
      `\nCARDS THE ENGINE RUNS COMPLETELY, of Commander-legal cards (distinct NAMES)\n` +
        rows.join('\n') +
        `\n  ${String(pool).padStart(6)} / ${String(r.distinct).padStart(6)}  ` +
        `${((100 * pool) / r.distinct).toFixed(1)}%  TOTAL\n` +
        `\nD90 cross-check — Commander-legal instants + sorceries, distinct names:\n` +
        `  ${r.spells.total} spells (D90 says 6,975)\n` +
        `  ${r.spells.auto} auto (D90 says 274) · ${r.spells.assisted} assisted (D90 says 1,300) · ` +
        `${r.spells.manual} manual\n` +
        `  auto counting ANY face: ${r.spells.autoAnyFace} · ` +
        `${r.spells.multiFace} of the 6,975 have two faces\n` +
        `\nD116 cross-check — Commander-legal lands:\n` +
        `  ${r.legalLandPrintings} PRINTINGS (D116 says 12,500) · ${r.byType['land']} distinct NAMES\n` +
        `\nWhy a card is refused (first unaccounted line, top 20):\n` +
        Object.entries(r.rejects)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([k, v]) => `  ${String(v).padStart(6)}  ${k}`)
          .join('\n'),
    );
  }, 300_000);

  /**
   * ⚠️ D90's number, reproduced rather than trusted — and the unit is what makes
   * it reproduce: DISTINCT NAMES with at least one Commander-legal printing,
   * typed by the FIRST face. Anything else lands somewhere else entirely.
   */
  test('D90 reproduces: 6,975 Commander-legal instants and sorceries', () => {
    expect.soft(r.spells.total).toBe(6975);
  });

  /**
   * ⚠️ D116 reads 12,500 lands, and it means PRINTINGS. There are 1,114 distinct
   * Commander-legal land names. Both are pinned so the next person reading §2 of
   * the M6 brief beside this report cannot mistake one for the other.
   */
  /**
   * ⚠️ D90's 274 AND 1,300 DO NOT REPRODUCE, and this is what the M6 brief's
   * §10 meant by "do not trust the numbers — reproduce them".
   *
   * Measured at M6.1, front face only: **269 auto, 1,359 assisted**, and 273
   * counting any face — which accounts for four of D90's five and strongly
   * suggests that is what it did (135 of the 6,975 have two faces). Nothing
   * explained the assisted gap.
   *
   * The definition is what was missing. D90 says "distinct cards, instants and
   * sorceries only" and does not say which face it counts, nor whether legality
   * is read per card or per printing. This test IS the definition now: distinct
   * NAME with at least one Commander-legal printing, typed and moded by the
   * FIRST face — the reading under which 6,975 reproduces exactly.
   *
   * ⚠️ **M6.3c MOVED THESE, and that is the vocabulary widening working**
   * (D130). `putCounters`/`removeCounters` joined `effectParse`'s closed list,
   * so **auto 269 → 276, assisted 1,359 → 1,403, any-face 273 → 280.** The
   * assisted jump is the larger and the more interesting: 44 more spells now
   * have a clause the prompt bar can offer as one logged click, where before the
   * whole card was the player's.
   */
  /**
   * ⚠️ **THREE NUMBERS THAT LOOK ALIKE AND ARE NOT, so read the field names.**
   * `auto` types a spell by its FIRST face; `autoAnyFace` counts a spell if ANY
   * face is auto, so `auto <= autoAnyFace` always. Landing D137 they moved by
   * different amounts (337 → 344 and 344 → 350), which puts the OLD value of one
   * on the NEW value of the other — and re-pinning the wrong line then produces
   * `auto` > `autoAnyFace`, a state no card pool can be in. If that ever appears,
   * the pins have been swapped; the measurement itself is deterministic and was
   * verified identical across isolated and full-suite runs.
   */
  test('D90 does not reproduce, and the vocabulary keeps moving it: 762 auto, 1,946 assisted (D199)', () => {
    expect.soft(r.spells.auto).toBe(762);
    expect.soft(r.spells.assisted).toBe(1946);
    expect.soft(r.spells.autoAnyFace).toBe(771);
  });

  /**
   * ⚠️ D116 reads 12,500 lands, and it means PRINTINGS. There are 1,114 distinct
   * Commander-legal land names. Both are pinned so the next person reading §2 of
   * the M6 brief beside this report cannot mistake one for the other — the table
   * there prints 6,975 (names) and 12,500 (printings) in adjacent rows.
   */
  test('D116 is a PRINTINGS count, not a distinct-name one', () => {
    expect.soft(r.legalLandPrintings).toBe(12500);
    expect.soft(r.byType['land']).toBe(1114);
  });

  test('the pool is what it is', () => {
    expect.soft(r.poolByType).toEqual(POOL);
    expect.soft(r.distinct).toBe(31692);
  });

  /**
   * ⚠️ THREE EXACT ZEROES, AND THEY ARE THE POINT. Not one of the 3,324
   * Commander-legal enchantments, not one of the 296 planeswalkers and not one
   * of the 36 battles is executable. An enchantment's whole text is a static or
   * triggered ability, a planeswalker's is loyalty abilities (`payable: false`
   * by design, `activatedParse.ts`), and a battle is a defense counter plus a
   * trigger. The bot's deck cannot contain any of the three until M6.3's
   * primitives land, and the lobby has to say so.
   *
   * ⚠️ Pinned as exact zeroes rather than as a floor, because the day one
   * becomes non-zero is a day worth noticing — and because a bug once made this
   * read 9 enchantments (see `clauseAccounted`'s substring note).
   */
  test('enchantments execute now - 137 after the counter seam; planeswalkers and battles still none', () => {
    // ⚠️ This pinned exact ZEROES from M6.1 until M6.4c (D160), "because the
    // day one becomes non-zero is a day worth noticing" — `Ajani's Welcome`
    // was that day; `Captive Flame` (D166) and `Centaur Glade` (D167 — an
    // activated token maker) followed, and D169's chooser+target batch more
    // than doubled it (Aura Fracture, Barrage of Expendables, Blood Rites,
    // Contemplation). Planeswalkers (loyalty costs) and battles are still
    // structurally out, and stay pinned at zero for the same reason the
    // enchantments were.
    expect.soft(r.poolByType['enchantment'] ?? 0).toBe(137);
    expect.soft(r.poolByType['planeswalker'] ?? 0).toBe(0);
    expect.soft(r.poolByType['battle'] ?? 0).toBe(0);
  });

  test('the committed deck still passes the predicate', () => {
    const byName = new Map(r.pool.map((c) => [c.name, c]));
    const missing: string[] = [];
    for (const name of [BOT_DECK.commander, ...BOT_DECK.main]) {
      if (!byName.has(name)) missing.push(name);
    }
    expect.soft(missing).toEqual([]);
  });

  /**
   * ⚠️ THE VERDICT IS PRINTED, NOT ASSUMED. The starter deck (D43) is
   * deliberately not a legal Commander deck and the lobby says so. This one has
   * to be, or the bot is playing something no opponent could.
   */
  test('the committed deck is a legal Commander deck', () => {
    const byName = new Map(r.pool.map((c) => [c.name, c]));
    const entry = (name: string, i: number, section: 'commander' | 'main'): ResolvedEntry => ({
      entry: { quantity: 1, name, section, lineNo: i + 1, raw: name },
      card: byName.get(name) ?? null,
    });
    const report = validateCommanderDeck(
      [entry(BOT_DECK.commander, 0, 'commander')],
      BOT_DECK.main.map((n, i) => entry(n, i + 1, 'main')),
      [],
      { cardDataUpdatedAt: null },
    );
    const errors = report.issues.filter((x) => x.severity === 'error');
    expect.soft(errors.map((e) => `${e.code}: ${e.message}`)).toEqual([]);
    expect.soft(report.counts.total).toBe(100);
    expect.soft(report.ok).toBe(true);
  });

  /**
   * ⚠️ **REGENERATING `botDeck.ts` IS A NO-OP** — the same guard D123 built for
   * `engineCards.ts`, in the second generated file this project has.
   *
   * D130 caught the gap the hard way: the pool grew, `Common Bond` displaced a
   * card at mana value 3, and the committed deck silently stopped being what
   * this generator produces. Its two existing guards are SEMANTIC — every card
   * is in the pool, the 100 cards are a legal Commander deck — and a stale deck
   * satisfies both, because the card it should have contained is legal too.
   *
   * ⚠️ Compared as the exact BYTES `render` writes, for D123's reason: one
   * comparison catches a re-ordering, a changed curve, a card leaving the pool,
   * a hand edit of a file that says DO NOT EDIT BY HAND, and the reason-lines in
   * the header drifting from the deck below them. A list of pinned properties
   * only ever covers what somebody thought to pin.
   *
   * ⚠️ It reads the file from disk rather than importing `BOT_DECK`, because the
   * import gives the parsed VALUE and the drift being guarded against includes
   * the generated comments — which are what tell the next person why this deck
   * looks the way it does.
   */
  test('regenerating botDeck.ts would change nothing', () => {
    const deck = buildBotDeck(r.pool);
    expect.soft(deck).not.toBeNull();
    if (!deck) return;
    const path = join(process.cwd(), 'src', 'data', 'botDeck.ts');
    const onDisk = readFileSync(path, 'utf8');
    // ⚠️ Line endings are normalised on BOTH sides: this repo is CRLF on disk
    // and `render` builds with `\n`, so a raw comparison fails on every line of
    // a file that is otherwise identical.
    const norm = (s: string): string => s.split('\r\n').join('\n');
    expect.soft(norm(render(deck))).toBe(norm(onDisk));
  });

  test.skipIf(!WRITE)('writes src/data/botDeck.ts', () => {
    const deck = buildBotDeck(r.pool);
    expect.soft(deck).not.toBeNull();
    if (!deck) return;
    writeFileSync(join(process.cwd(), 'src', 'data', 'botDeck.ts'), render(deck), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`\nwrote src/data/botDeck.ts\n${deck.why.map((w) => `  ${w}`).join('\n')}`);
  });
});

/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('the bot pool, measured', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect.soft(HAVE_DB).toBe(false);
  });
});

/**
 * The pool, by card type, as of the 2026-07-27 Scryfall release (113,559
 * printings). Pinned as ONE object so a data refresh or a parser change shows
 * every number that moved in a single failure rather than one per run.
 *
 * ⚠️ **M6.3c: 1,405 → 1,412** (D130), the first time a primitive has moved the
 * count of cards the engine runs COMPLETELY. `optional` (D128) and layer 6
 * (D129) moved it by zero, exactly as D127 said they would — a primitive makes a
 * card possible to SCRIPT, and no script ships. The counter vocabulary is
 * different because a spell resolves through `effectEvents` with no script at
 * all, so widening the vocabulary IS the execution.
 *
 * The seven, named because seven is a number small enough to name: `Battlegrowth`,
 * `Scar`, `Blight Rot`, `Common Bond`, `Honor`, `Instill Infection`, and
 * `Tuinvale Treefolk // Oaken Boon`.
 *
 * ⚠️ **THE CREATURE +1 IS THE ADVENTURE**, and it is worth understanding rather
 * than shrugging at. `Oaken Boon` is the Adventure half of a vanilla Treefolk;
 * `engineCompleteness` sums leftovers across ALL faces, and `bucketOf` types a
 * card by its FIRST — so a card completed by its instant half is counted as a
 * creature. It joins 26 other multi-face cards that were already in this pool
 * (5 Adventures, 9 Pathways, a split card, reversible basics). Per-face
 * castability is not built (M6.4-LIBRARY-SPEC §3), so none of the 27 says
 * anything about a half the app may not offer — a pre-existing silence this
 * change adds one card to rather than creating. See D130.
 */
const POOL: Record<string, number> = {
  // M6.4a (D158): +6 creatures (Soul Warden, Essence Warden, Wall of Blossoms,
  // Wall of Omens, Baleful Strix, Onulet) and +2 lands (Radiant Fountain,
  // Adventurer's Inn) — the first cards a SHIPPED SCRIPT put in this pool.
  // M6.4b (D159): +2 artifacts (Arcane Encyclopedia, Hedron Archive) and +2
  // lands (Deserted Temple, War Room) — the first ACTIVATED abilities.
  // M6.4c (D160): +13 creatures, +2 artifacts, +3 lands — and ⚠️ THE FIRST
  // ENCHANTMENT THIS POOL HAS EVER HELD (`Ajani's Welcome`). The bot deck's
  // own header said "no enchantments … because the engine runs none of those
  // yet"; the ceiling rose exactly as it promised it would.
  // M6.4d (D161): +13 creatures.
  // M6.4k (D168): the sacrifice-cost chooser's proof cards — +1 creature
  // (Ahriman), +2 artifacts (Carnage Altar, Claws of Gix).
  // M6.4l (D169): +18 creatures, +1 artifact — and the enchantment pin the
  // D160 zero-pin comment said was worth noticing reads SEVEN now (Aura
  // Fracture, Barrage of Expendables, Blood Rites, Contemplation joined).
  // M6.4q (D173): +20 creatures, +1 artifact, and FOUR enchantments at once
  // (Efficient Construction, Elemental Bond, Emrakul's Influence,
  // Enchantress's Presence) — the pool reads SEVENTEEN.
  // M6.4w (D179): +18 creatures, +2 lands (Hell's Kitchen, High Market) and
  // Hatching Plans — the pool reads TWENTY-SEVEN.
  // M6.4x (D180): +15 creatures, +2 artifacts (Hot Dog Cart, Ichor
  // Wellspring), +2 lands (Idyllic Grange, Illegitimate Business) and
  // Insight — the pool reads TWENTY-EIGHT.
  // M6.4z (D182): +17 creatures and +5 artifacts (the Izzet Cluestone,
  // Locket and Jeskai Banner beside Jandor's Saddlebags and Jayemdae Tome).
  // M6.4aa (D183): +16 creatures and +5 lands (three refuges, Kabira
  // Crossroads, Junktown).
  // M6.4ab (D184): +16 creatures (the pool crosses 1,500), +3 lands and
  // Letter of Acceptance.
  // M6.4ac (D185): +12 creatures, +1 land, and TWO enchantments (Makeshift
  // Munitions, Malevolent Awakening) — the pool reads THIRTY.
  // M6.4au (D206): +2 creatures, +2 instants, +9 sorceries, Darksteel
  // Pendant, and Dauthi Embrace — the pool reads THIRTY-TWO.
  // M6.4av (D207): +6 instants and +11 sorceries — an all-spell batch.
  // M6.4aw (D208): +7 instants, +7 sorceries, and two creatures (Dimir
  // Informant, Dinotomaton).
  // M6.4ax (D209): +7 instants and +5 sorceries — a second all-spell batch.
  // M6.4ay (D210): +7 instants, +6 sorceries, Elvish Herder, and Elegant
  // Parlor — the 262nd land.
  // M6.4az (D211): +3 instants and +10 sorceries — a third all-spell batch.
  // M6.4ba (D212): +8 instants, +4 sorceries, Faerie Seer, and Fear of
  // Surveillance.
  // M6.4bb (D213): +11 instants, +8 sorceries, and Fields of Strife — a
  // TWENTY-card batch.
  // M6.4bc (D214): +8 instants, +7 sorceries, Flying Carpet, and Forum of
  // Amity.
  creature: 2781,
  instant: 882,
  sorcery: 682,
  land: 356,
  artifact: 176,
  enchantment: 137,
};

function render(deck: { commander: string; main: readonly string[]; why: readonly string[] }): string {
  const lines = deck.main.map((n) => `  ${JSON.stringify(n)},`).join('\n');
  return `// GENERATED by src/data/botPool.node.test.ts — DO NOT EDIT BY HAND.
//
// Regenerate:  CRT_WRITE_BOT_DECK=1 npx vitest run src/data/botPool.node.test.ts
//
// The deck a bot seat plays. Every card in it is one the engine runs COMPLETELY
// — see \`engineComplete.ts\` — because a bot cannot read a card and apply it by
// hand the way a human can, so a card the app only partly runs is a card the bot
// must never draw.
//
// ⚠️ It is a LEGAL Commander deck, unlike the starter deck (D43), and that is
// asserted in \`botPool.node.test.ts\` rather than claimed here. It is also a
// weak one — no enchantments, no planeswalkers, no triggered abilities, no
// tutors, no recursion, because the engine runs none of those yet. That ceiling
// is the honest state of the app and it rises as the engine's coverage does.
//
${deck.why.map((w) => `// ${w}`).join('\n')}

export const BOT_DECK = {
  commander: ${JSON.stringify(deck.commander)},
  main: [
${lines}
  ],
} as const;
`;
}
