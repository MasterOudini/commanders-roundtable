// WHICH CARDS THE NEXT BATCH SHOULD SCRIPT — M6.4-LIBRARY-SPEC §7. See D157.
//
// ⚠️ **IT IS A `.node.test.ts` AND THAT IS FORCED, NOT CHOSEN.** Selection has to
// ask `engineCompleteness` and `primitivesFor` which cards are blocked on a
// script alone, and those are TypeScript. `scripts/` is CommonJS and cannot
// import them — the same wall D133 hit when the token table could not be built
// at ingest, and the answer is the same: run the TS through vitest rather than
// keep a second copy of it in CJS. `scripts/cardgen/select.cjs` is the wrapper.
//
// ⚠️ **THE ORDERING IS THE SPEC'S, AND ITS FIRST RUNG IS THE USER'S OWN DECKS.**
// §7: popularity data is an internet dependency and the offline policy applies —
// **stop and ask before fetching any.** So the proxy is what is already on disk:
//   1. cards in the user's saved decks (`~/.commanders-roundtable/decks/`),
//   2. cards in the fuzz `DECK` and the `ENGINE_CARDS` fixtures,
//   3. everything else that is blocked on a script alone,
// and within each rung, cheapest first — fewest unaccounted lines.
//
// ⚠️ It emits only cards whose sole need is `scriptable`. A card that also needs
// a PRIMITIVE cannot be scripted however easy its text looks, and offering one to
// a drafter is how a batch produces something that cannot pass verification.
//
// Run it:
//   node scripts/cardgen/select.cjs [count]

import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import { engineCompleteness, unaccountedLines } from './engineComplete';
import { parseFace } from './oracleParse';
import { primitivesFor } from './primitives';
import { ENGINE_CARDS } from './fixtures/engineCards';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const EMIT = process.env.CRT_CARDGEN_OUT;
const WANT = Number(process.env.CRT_CARDGEN_COUNT ?? 200);

/** Card names in the user's saved decks — rung 1. */
function deckNames(): Set<string> {
  const out = new Set<string>();
  const dir = join(DATA_DIR, 'decks');
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    try {
      const deck = JSON.parse(readFileSync(join(dir, entry), 'utf8')) as {
        commanders?: { name?: string }[];
        main?: { name?: string }[];
      };
      for (const line of [...(deck.commanders ?? []), ...(deck.main ?? [])]) {
        if (line.name) out.add(line.name);
      }
    } catch {
      // A deck file we cannot read is not a reason to fail selection.
    }
  }
  return out;
}

/** Card names the fuzz gate and the fixtures already carry — rung 2. */
function poolNames(): Set<string> {
  const out = new Set<string>(ENGINE_CARDS.map((c) => c.name));
  const fuzz = join(process.cwd(), 'src', 'engine', 'fuzz.node.test.ts');
  if (existsSync(fuzz)) {
    // ⚠️ Read as TEXT rather than imported: importing a `.node.test.ts` from
    // another test file runs its describes. The names are string literals in a
    // `DECK` array and that is all this needs from them.
    const src = readFileSync(fuzz, 'utf8');
    const deck = /const DECK = \[([\s\S]*?)\n\];/.exec(src)?.[1] ?? '';
    for (const m of deck.matchAll(/'([^']+)'|"([^"]+)"/g)) out.add(m[1] ?? m[2] ?? '');
  }
  return out;
}

interface Candidate {
  readonly name: string;
  readonly oracleId: string;
  readonly rung: 1 | 2 | 3;
  /** Unaccounted lines — the cheapest-first tie-break within a rung. */
  readonly lines: number;
}

/**
 * ⚠️ THE THIRD SELECTION FILTER, AND UNLIKE THE TWO PARSE FILTERS IT IS A
 * NAMED LEDGER — each entry is a card a drafter HELD and refused for a
 * machinery gap the needs column has no row for. Twelve of batch 6's 25
 * slots were batch 5's refusals re-offered (D162's dozen, verbatim); half a
 * batch of re-classification per batch is the tax this table ends.
 *
 * ⚠️ SELF-CORRECTING BY CONSTRUCTION: `select()` records any entry whose card
 * has become COMPLETE, and a test fails naming it — so the day a class is
 * built and its cards land, the stale entries cannot survive the suite. The
 * class strings exist so that day is findable with grep.
 */
const REFUSED: ReadonlyMap<string, string> = new Map([
  // ⚠️ The 'sacrifice-cost chooser' class — FIFTEEN entries at its peak, the
  // ledger's largest — was BUILT in D168 (`ActivateAbility.sacrifice`) and its
  // entries deleted the same day, so those cards re-enter the offer stream.
  // A script cannot raise ANOTHER player's prompt from resolve (D160).
  ['Abyssal Horror', 'script-raised prompt'],
  // The "modified" predicate (D160).
  ['Akki Ember-Keeper', 'modified predicate'],
  // Random-discard cost — and `ctx.random` is still a stub (D161).
  ['Amok', 'random-discard cost'],
  // Tap-N-untapped-creatures costs (D161).
  ["Ancestor's Prophet", 'tap-creatures cost'],
  ['Aphetto Grifter', 'tap-creatures cost'],
  ['Azami, Lady of Scrolls', 'tap-creatures cost'],
  // Exile-from-library cost (D161).
  ['Arc-Slogger', 'exile-from-library cost'],
  // "For the first time each turn" needs per-turn trigger memory the engine
  // does not hold (D163).
  ['Axgard Artisan', 'once-per-turn trigger memory'],
  // `CombatDamageDealt` batches EVERY creature's damage into one event and
  // the bus fires per event, so a per-creature damage trigger under-fires on
  // multi-attacker turns (D163).
  ['Aya of Alexandria', 'per-damage-entry trigger granularity'],
  // Discard-a-card-as-cost chooser — the hand-side sibling of the sacrifice
  // chooser (D163).
  ["Ayula's Influence", 'discard-cost chooser'],
  // Batch 7 (D164).
  // Exile-N-cards-from-your-graveyard as a COST is a chooser over a public
  // zone nothing charges yet — the graveyard sibling of the sacrifice
  // chooser (D164).
  ['Bearscape', 'exile-from-graveyard cost'],
  // "…discards a card AT RANDOM" as an EFFECT — `ctx.random` is a stub at
  // every ScriptCtx site (D158), so no random card may ship until it is
  // wired to the seeded generator (D164).
  ['Black Cat', 'ctx.random stub'],
  // Batch 8 (D165).
  // Remove-a-+1/+1-counter-from-a-creature-you-control as a COST is a
  // chooser over counter state nothing charges yet (D165).
  ['Bolrac-Clan Crusher', 'remove-counter cost'],
  // Batch 9 (D166).
  // "Exile this artifact" as a cost — sacrificesSelf ONE EVENT OVER
  // (CardsMoved to exile instead of graveyard); named cheap, not built yet.
  ['Brittle Effigy', 'exile-self cost'],
  ['Cabal Surgeon', 'exile-from-graveyard cost'],
  ['Catapult Master', 'tap-creatures cost'],
  // Batch 10 (D167).
  ['Charging Strifeknight', 'discard-cost chooser'],
  // "Your second spell each turn" is Axgard's per-turn trigger memory one
  // count over (D167).
  ['Clarion Spirit', 'once-per-turn trigger memory'],
  // Tap-two-untapped-ARTIFACTS as a cost — the tap-creatures chooser's
  // artifact sibling (D167).
  ['Clock of Omens', 'tap-permanents cost'],
  // Batch 11 (D169).
  ['Coral Helm', 'random-discard cost'],
  // "target opponent discards a card" from a trigger's resolve is the
  // script-raised prompt class (D160) — the caster's script asking ANOTHER
  // player's hidden-zone question.
  ['Corrupt Court Official', 'script-raised prompt'],
  // Batch 12 (D170).
  // "Whenever a Dinosaur you control deals combat damage" — NOT self-only,
  // so `CombatDamageDealt`'s per-event batching under-fires it on
  // multi-Dinosaur turns (Aya's class, D163).
  ['Curious Altisaur', 'per-damage-entry trigger granularity'],
  // A dies-trigger raising the TARGET OPPONENT's discard prompt (D160's
  // class, Corrupt Court Official's dies-twin).
  ['Deadbridge Shaman', 'script-raised prompt'],
]);

/** Filled by `select()`: REFUSED entries whose card now runs completely. */
const staleRefusals: string[] = [];

async function select(): Promise<Candidate[]> {
  const decks = deckNames();
  const pool = poolNames();
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const raw of rl) {
    if (raw === '') continue;
    let card: CardData;
    try {
      card = JSON.parse(raw) as CardData;
    } catch {
      continue;
    }
    if (card.commanderLegality !== 'legal') continue;
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    const complete = engineCompleteness(card).complete;
    if (REFUSED.has(card.name)) {
      // A refused card that now runs completely is a STALE ledger entry — its
      // class was built and the entry must go; the guard test names it.
      if (complete) staleRefusals.push(card.name);
      continue;
    }
    // Already run completely — there is nothing for a script to add.
    if (complete) continue;

    const p = primitivesFor(card);
    // ⚠️ SOLE NEED `scriptable`, nothing else. A card that also waits on a
    // primitive is not draftable today whatever its text looks like.
    if (p.needs.size !== 1 || !p.needs.has('scriptable')) continue;

    // ⚠️ TWO SHAPES THE NEEDS COLUMN CANNOT SEE, both found by handing them to
    // a drafter (D160, D161). A SPELL face outside the effect vocabulary is
    // "scriptable" by lines and unlandable in fact — `CardScript` has no spell
    // seam; a spell executes through the vocabulary or not at all. And a
    // target spec with an UNREAD or UNENFORCED clause fails `faceCompleteness`
    // whatever a script claims, so the gate would refuse the landed card
    // ("attacking or blocking" cost this batch two drafts). Both are asked of
    // the parsers that decide them, never re-read here.
    let landable = true;
    for (let i = 0; i < card.faces.length; i++) {
      const face = parseFace(card, i);
      if (!face.isPermanent && face.effectMode !== 'auto') landable = false;
      const specs = [...face.targets, ...face.activated.flatMap((a) => a.targets)];
      if (specs.some((s) => s.kinds.length === 0 || s.unenforced.length > 0)) landable = false;
    }
    if (!landable) continue;

    let lines = 0;
    for (let i = 0; i < card.faces.length; i++) lines += unaccountedLines(card, i).length;
    const rung: 1 | 2 | 3 = decks.has(card.name) ? 1 : pool.has(card.name) ? 2 : 3;
    out.push({ name: card.name, oracleId: card.oracleId, rung, lines });
  }

  out.sort((a, b) => a.rung - b.rung || a.lines - b.lines || a.name.localeCompare(b.name));
  return out;
}

describe.skipIf(!HAVE_DB)('the next batch to script', () => {
  let all: Candidate[] = [];

  test('reads the whole database and ranks what is scriptable', async () => {
    all = await select();
    expect(all.length).toBeGreaterThan(0);
    // Everything emitted needs a script and nothing else — the property the
    // whole pipeline downstream depends on.
    expect(all.every((c) => c.lines > 0)).toBe(true);
  }, 600_000);

  test('the ordering puts the user’s own cards first', () => {
    const rungs = all.map((c) => c.rung);
    expect([...rungs].sort((a, b) => a - b)).toEqual(rungs);
  });

  test('the REFUSED ledger holds only cards still waiting on their named gap', () => {
    // A name here means: delete that ledger entry — its class was built.
    expect(staleRefusals).toEqual([]);
    // And nothing refused leaks into the ranking.
    const offered = new Set(all.map((c) => c.name));
    for (const name of REFUSED.keys()) expect(offered.has(name)).toBe(false);
  });

  test('and writes the batch when asked', () => {
    if (!EMIT) return;
    const batch = all.slice(0, WANT);
    writeFileSync(
      EMIT,
      JSON.stringify(
        {
          generated: 'scripts/cardgen/select.cjs',
          total: all.length,
          batch: batch.length,
          byRung: { 1: all.filter((c) => c.rung === 1).length, 2: all.filter((c) => c.rung === 2).length, 3: all.filter((c) => c.rung === 3).length },
          cards: batch,
        },
        null,
        2,
      ),
      'utf8',
    );
    expect(existsSync(EMIT)).toBe(true);
  });
});

/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('the next batch to script', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect(HAVE_DB).toBe(false);
  });
});
