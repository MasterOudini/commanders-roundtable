// What each missing engine primitive is worth, over the whole card database.
//
// ⚠️ THIS REPORT DECIDES M6.3's BUILD ORDER, which is the M6 brief's own
// instruction: "Measure the unlock… That number is how you decide what to build
// next." It runs before any primitive is built, and again after, so the
// milestone's headline claim ("the number of executable cards has multiplied")
// is a subtraction rather than an impression.
//
// Two columns, and they answer different questions:
//   REACH    — cards with at least one line waiting on this primitive. An upper
//              bound: a card needing two primitives appears under both.
//   UNLOCK   — cards whose EVERY unaccounted line is covered by the set built so
//              far. The honest one, and the only one that can be added up.
//
// ⚠️ `scriptable` is not a primitive. It is the count of cards blocked ONLY by
// the absence of a per-card script — M6.4's work, already expressible with
// today's engine. If that number is large, the library is the bottleneck and
// M6.3 is smaller than the brief assumes.
//
// Run it:
//   CRT_PRIMITIVES_REPORT=1 npx vitest run src/data/primitives.node.test.ts

import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import { engineCompleteness } from './engineComplete';
import {
  layer6Kind,
  PRIMITIVE_LABEL,
  primitiveFor,
  primitivesFor,
  residueKind,
  replacementKind,
  tokenKind,
  unlockedBy,
  type Primitive,
} from './primitives';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const REPORT = process.env.CRT_PRIMITIVES_REPORT === '1';

/**
 * A continuous effect that ENDS — the thing `GameState.untilEndOfTurn` cannot
 * carry, since it holds power and toughness and nothing else.
 *
 * ⚠️ Defined HERE and not in `primitives.ts`, deliberately: the classifier does
 * not ask this question, so there is no second copy of a rule to drift from
 * (`layer6Kind` is exported precisely because the classifier DOES use it). If
 * anything ever classifies on duration, this moves rather than being copied.
 */
const TEMPORARY = /\buntil end of turn\b|\buntil your next turn\b|\buntil end of combat\b/i;

interface Report {
  distinct: number;
  complete: number;
  blocked: number;
  reach: Record<string, number>;
  /** Cards whose whole leftover is exactly this one primitive. */
  soleNeed: Record<string, number>;
  /** What the `unclassified` LINES are about — the fifth bucket split, D157. */
  residue: Record<string, number>;
  /** The most common lines nothing recognised, for refining the classifier. */
  unclassified: Record<string, number>;
  /** Every blocked card's primitive set, kept for the cumulative pass. */
  cards: {
    name: string;
    needs: ReadonlySet<Primitive>;
    lineCount: number;
    layer6Lines: string[];
    tokenLines: string[];
    replacementLines: string[];
    isLand: boolean;
    isSpell: boolean;
  }[];
}

async function run(): Promise<Report> {
  const r: Report = {
    distinct: 0,
    complete: 0,
    blocked: 0,
    reach: {},
    soleNeed: {},
    unclassified: {},
    residue: {},
    cards: [],
  };
  const seen = new Set<string>();
  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card: CardData;
    try {
      card = JSON.parse(line) as CardData;
    } catch {
      continue;
    }
    if (card.commanderLegality !== 'legal') continue;
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    r.distinct++;

    if (engineCompleteness(card).complete) {
      r.complete++;
      continue;
    }
    r.blocked++;

    const p = primitivesFor(card);
    for (const need of p.needs) r.reach[need] = (r.reach[need] ?? 0) + 1;
    if (p.needs.size === 1) {
      const only = [...p.needs][0]!;
      r.soleNeed[only] = (r.soleNeed[only] ?? 0) + 1;
    }
    for (const l of p.lines) {
      if (l.primitive !== 'unclassified') continue;
      r.residue[residueKind(l.text)] = (r.residue[residueKind(l.text)] ?? 0) + 1;
      const key = l.text.split(/\s+/).slice(0, 5).join(' ');
      r.unclassified[key] = (r.unclassified[key] ?? 0) + 1;
    }
    r.cards.push({
      name: card.name,
      needs: p.needs,
      lineCount: p.lines.length,
      layer6Lines: p.lines.filter((l) => l.primitive === 'layer6').map((l) => l.text),
      tokenLines: p.lines.filter((l) => l.primitive === 'effect:token').map((l) => l.text),
      replacementLines: p.lines.filter((l) => l.primitive === 'replacement').map((l) => l.text),
      isLand: /\bLand\b/.test(card.faces[0]?.typeLine ?? ''),
      isSpell: /\b(?:Instant|Sorcery)\b/.test(card.faces[0]?.typeLine ?? ''),
    });
  }
  return r;
}

/**
 * Cards unlocked by building these primitives, cumulatively.
 *
 * ⚠️ `scriptable` is always in the set, because every one of these cards needs a
 * script anyway — the question a primitive answers is whether a script COULD be
 * written, never whether one has been.
 */
function cumulative(r: Report, order: readonly Primitive[]): { step: string; unlocked: number }[] {
  const built = new Set<Primitive>(['scriptable']);
  const out: { step: string; unlocked: number }[] = [];
  const cardsAsSets = r.cards.map((c) => ({ lines: [...c.needs].map((p) => ({ primitive: p })), name: c.name }));
  out.push({
    step: 'scripts alone',
    unlocked: cardsAsSets.filter((c) => unlockedBy(c as never, built)).length,
  });
  for (const p of order) {
    built.add(p);
    out.push({
      step: `+ ${p}`,
      unlocked: cardsAsSets.filter((c) => unlockedBy(c as never, built)).length,
    });
  }
  return out;
}

/**
 * The primitives that EXIST IN THE ENGINE TODAY.
 *
 * ⚠️ THIS IS THE ONLY LINE THAT MOVES WHEN A PRIMITIVE LANDS, and saying so is
 * the point of separating it. `reach`, `soleNeed` and the cumulative table are
 * properties of the CARD TEXT and of the parsers that read it — building
 * something changes none of them, which is exactly why D127 took the
 * measurement before any primitive existed: so the "after" could be a
 * subtraction rather than an impression.
 *
 * ⚠️ AND SCRIPTABLE IS STILL NOT EXECUTABLE. `optional` being here moves what a
 * script COULD express from 1,263 cards to 1,362; it moves the number of cards
 * the engine runs completely by ZERO, because not one of them has a script. That
 * is M6.4, and `r.complete` is the number that answers it.
 *
 * ⚠️⚠️ **MOST ROWS CAN NEVER BE TICKED, AND THAT IS STRUCTURAL RATHER THAN A
 * JUDGEMENT.** `primitiveFor` asks `expressible` — that is, `parseEffects` —
 * BEFORE it reaches any rule, so a line that lands in a row is by definition a
 * line the vocabulary could not read. Widening the vocabulary therefore DRAINS
 * the row instead of ticking it, and the two measurements below are the proof:
 * `effect:counter` fell 1,441 → 1,364 when D130 built it, `effect:token`
 * 1,123 → 812 when D133 did. Listing either here would claim the exact opposite
 * of what the classifier had just measured.
 *
 * So the only rows that can EVER be ticked are the ones `parseEffects` is
 * structurally incapable of draining — the ones whose lines are not one-shot
 * spell effects at all: `layer6` (continuous statics), `optional` (a modifier on
 * an effect), `keyword:*`, `costMod`, `replacement`. Each still needs its own
 * evidence that the machinery exists for EVERY line the row catches, because
 * `unlockedBy` requires every line of a card to be covered.
 *
 * ⚠️ **`layer6` IS STILL NOT HERE, AND D129's REASON FOR THAT IS NOW THE WRONG
 * ONE.** It used to read "227 of the bucket's cards are combat RESTRICTIONS with
 * no seam in `canAttack`/`canBlock`" — and D147 built that seam (`CombatDef`), so
 * of the row's 689 restriction lines only **2** are still beyond the engine. The
 * live reason is one the split never looked for: **1,855 of the row's 4,676 lines
 * are grants that END** — "until end of turn", "until your next turn", "until end
 * of combat" — and `GameState.untilEndOfTurn` carries POWER AND TOUGHNESS AND
 * NOTHING ELSE. There is no temporary keyword grant in this engine at all, so
 * "target creature gains flying until end of turn" has nowhere to be written.
 * **958 of the 1,791 cards whose sole need is `layer6` — 53% — carry one**, and
 * ticking the row would claim every one of them. Pinned by "the layer6 bucket is
 * four different things" below, so the reason is a number rather than a comment.
 *
 * M6.3: `optional` — D128, and corrected in D153, which is where the row stopped
 * being a pre-filter that swallowed whatever else the line needed.
 */
const BUILT: readonly Primitive[] = ['optional'];

describe.skipIf(!HAVE_DB)('what each primitive is worth', () => {
  let r: Report;

  test('reads the whole database', async () => {
    r = await run();
    expect(r.distinct).toBeGreaterThan(30_000);
    if (!REPORT) return;

    const order = ([...Object.entries(r.reach)] as [Primitive, number][])
      .filter(([p]) => p !== 'scriptable' && p !== 'unclassified')
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);

    const row = (label: string, n: number): string =>
      `  ${String(n).padStart(6)}  ${((100 * n) / r.blocked).toFixed(1).padStart(5)}%  ${label}`;

    // eslint-disable-next-line no-console
    console.log(
      `\nPRIMITIVES — over ${r.distinct} distinct Commander-legal cards\n` +
        `  ${r.complete} run completely today · ${r.blocked} are blocked\n` +
        `\nREACH — blocked cards with at least one line waiting on this ` +
        `(a card needing two appears twice):\n` +
        ([...Object.entries(r.reach)] as [Primitive, number][])
          .sort((a, b) => b[1] - a[1])
          .map(([p, n]) => row(`${p} — ${PRIMITIVE_LABEL[p]}`, n))
          .join('\n') +
        `\n\nSOLE NEED — blocked cards waiting on this and nothing else:\n` +
        ([...Object.entries(r.soleNeed)] as [Primitive, number][])
          .sort((a, b) => b[1] - a[1])
          .map(([p, n]) => row(p, n))
          .join('\n') +
        `\n\nBUILT TODAY — ${BUILT.join(', ') || 'nothing'}: ` +
        `${cumulative(r, BUILT).at(-1)?.unlocked} cards are scriptable, ` +
        `${r.complete} actually run\n` +
        `\n\nCUMULATIVE — cards that become expressible as each is built, in reach order:\n` +
        cumulative(r, order)
          .map((s) => `  ${String(s.unlocked).padStart(6)}  ${s.step}`)
          .join('\n') +
        `\n\nUNCLASSIFIED — the top 25 lines nothing here recognises:\n` +
        Object.entries(r.unclassified)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 25)
          .map(([k, v]) => `  ${String(v).padStart(6)}  ${k}`)
          .join('\n'),
    );
  }, 600_000);

  /**
   * ⚠️ A canary on the CLASSIFIER, not on the engine. If `scriptable` were zero
   * the report would be saying every blocked card needs a new primitive, which
   * cannot be true while the trigger bus exists and the vocabulary has eleven
   * effect kinds in it — and it would send M6.3 off to build things that already
   * work.
   */
  test('the classifier discriminates', () => {
    expect(r.reach['scriptable'] ?? 0).toBeGreaterThan(100);
    expect(r.blocked).toBeGreaterThan(20_000);
    const residue = (r.reach['unclassified'] ?? 0) / r.blocked;
    // ⚠️ **45.1% → 49.5% IN D153, AND THE RISE WAS THE CORRECTION SHOWING**:
    // 1,898 of the lines the `optional` pre-filter had been swallowing are
    // recognised by nothing else here, so they came back as residue rather than
    // as a row. A classifier that got honester and looked worse.
    //
    // ⚠️ **AND THE BAR IS NO LONGER THE INTERESTING NUMBER (D157).** This share
    // counts every line no PRIMITIVE claims, which is a different question from
    // "how much of this report is a black box" — the residue is now split by
    // `residueKind`, and what actually needs bounding is the part that split
    // cannot name. Both are asserted, and the second is the one that matters.
    expect(residue, 'unclassified share of blocked cards').toBeLessThan(0.52);
  });

  /**
   * ⚠️ THE NUMBERS M6.3's BUILD ORDER RESTS ON, pinned so the order cannot
   * silently stop being the right one. Every one moves when a parser widens,
   * which is exactly when the order should be re-read.
   *
   * `soleNeed` is the honest column: cards waiting on this primitive and NOTHING
   * else, so building it alone makes them expressible. `reach` counts a card
   * under every primitive it needs and is an upper bound.
   */
  test('the build order is what it is', () => {
    expect({
      distinct: r.distinct,
      complete: r.complete,
      blocked: r.blocked,
      scriptableToday: r.soleNeed['scriptable'] ?? 0,
      optional: r.soleNeed['optional'] ?? 0,
      layer6: r.soleNeed['layer6'] ?? 0,
      counter: r.soleNeed['effect:counter'] ?? 0,
      token: r.soleNeed['effect:token'] ?? 0,
    }).toEqual({
      distinct: 31692,
      // ⚠️ M6.3c is the first primitive to move `complete` (D130): 1,405 →
      // 1,412, because a SPELL resolves through `effectEvents` with no script,
      // so widening the vocabulary is the execution. `optional` and layer 6 both
      // moved it by zero, exactly as D127 predicted.
      // ⚠️ M6.4a is the first SCRIPT BATCH to move it (D158): 1,730 → 1,738,
      // eight cards, every one leaving `blocked` and `scriptableToday` by
      // exactly one — which is the silence hook and the selection agreeing.
      // M6.4b (D159) moved it again by exactly the four the ActivatedDef seam
      // unblocked: 1,738 → 1,742. M6.4c (D160): the first select.cjs batch at
      // scale — 19 of 25, the six refusals named — 1,742 → 1,761. M6.4d
      // (D161): thirteen more, and the selection taught two refusal shapes —
      // 1,761 → 1,774.
      complete: 2116,
      blocked: 29576,
      // ⚠️ THE ONE FIGURE D153 DID NOT MOVE, and the tell that the correction was
      // a reclassification rather than a re-count: a card blocked on a script
      // alone has no unaccounted line for the `optional` pre-filter to have
      // mis-swallowed. The landed batches are what move it now: every shipped
      // card leaves this pool (1,263 → 1,255 in D158, → 1,251 in D159, → 1,232
      // in D160, → 1,219 in D161 — the D161 fall is 13 landed; the selection's
      // new spell/unenforced filters change what a BATCH offers, not this
      // count, which stays the parsers' own).
      scriptableToday: 877,
      // ⚠️⚠️ **2,025 → 96, AND THE OLD NUMBER WAS THE ARTEFACT.** `optional` was
      // tested ahead of `expressible` and every rule below it, so it caught any
      // line containing "you may" whatever else that line needed — 4,549 lines,
      // of which 169 genuinely needed nothing but the yes/no. It led D127's table
      // at 2,012 and is in fact the second SMALLEST row. See D153 and
      // `primitiveFor`.
      optional: 96,
      // ⚠️ The other rows ROSE by what `optional` had been hiding, which is the
      // same figure read from the other side: 1,736 → 1,791 · 1,364 → 1,575 ·
      // 812 → 915, and `chooseFromZone` 691 → 1,005 is the largest single move.
      layer6: 1791,
      counter: 1575,
      token: 915,
    });
  });

  /**
   * ⚠️ THE HEADLINE, AND THE WHOLE REASON THIS FILE RAN BEFORE ANY PRIMITIVE WAS
   * BUILT. D127 measured 795 → 8,286 across the first four, **10.4×**; D130 read
   * it as 845 → 8,279, **9.8×**. It is **1,263 → 6,386, 5.1×**, and the drop has
   * two causes that are worth telling apart:
   *
   *   · executing a primitive shrinks the pool. The cards D130, D133, D134/D135,
   *     D137, D138, D141, D142 and D147 made COMPLETE left `blocked` altogether,
   *     and this ladder is drawn from blocked cards.
   *   · **and D153 found the rest of it was never there.** The first rung was
   *     3,463 because `optional` was a pre-filter catching every line that
   *     contained "you may"; honestly classified it is 1,362, so the ladder had
   *     been standing on 2,101 cards whose real blocker was counted nowhere.
   *
   * ⚠️ A FALLING TOTAL IS THE MEASUREMENT WORKING, in both directions. The pool a
   * primitive could unlock shrinks every time one is executed, and a report whose
   * headline could only ever go up would be measuring effort rather than
   * coverage. It also has to be able to fall because the measurement was wrong.
   *
   * ⚠️ SCRIPTABLE IS STILL NOT EXECUTABLE. A primitive makes a card possible to
   * script; the script is M6.4. `complete` is the number that answers coverage,
   * and it is asserted below.
   */
  test('the first four primitives multiply what is scriptable by 5', () => {
    const order: Primitive[] = ['optional', 'layer6', 'effect:counter', 'effect:token'];
    const steps = cumulative(r, order);
    // Every rung fell by exactly 8 in M6.4a (D158) and by exactly 4 more in
    // M6.4b (D159): shipped batches leave the blocked pool, and the ladder is
    // drawn from blocked cards.
    expect(steps.map((s) => s.unlocked)).toEqual([877, 976, 2929, 4813, 6000]);
    expect(steps[4]!.unlocked / steps[0]!.unlocked).toBeGreaterThan(4.5);
  });

  /**
   * ⚠️ **THE FOURTH BUCKET SPLIT** (D134), and the one that decided M6.3g's
   * shape before a line of it was written. Of the 418 cards whose SOLE need is
   * `replacement`, the overwhelming majority are one clause — "this land enters
   * tapped" — which is CR 614.1c with no choice, no ordering and no interaction
   * with anything. It is a property of the card, and the last four rows have all
   * taught the same lesson: a bucket is not a primitive.
   */
  test('the replacement bucket is five different things', () => {
    const split = { entersTapped: 0, entersWith: 0, asEnters: 0, wouldInstead: 0, instead: 0, unclaimed: 0 };
    let tappedLands = 0;
    for (const card of r.cards) {
      if (card.needs.size !== 1 || !card.needs.has('replacement')) continue;
      const kinds = card.replacementLines.map(replacementKind);
      const first = (['entersTapped', 'entersWith', 'asEnters', 'wouldInstead', 'instead'] as const).find(
        (k) => kinds.includes(k),
      );
      if (first) split[first]++;
      else split.unclaimed++;
      if (first === 'entersTapped' && card.isLand) tappedLands++;
    }
    // eslint-disable-next-line no-console
    if (REPORT) console.log(`
replacement split: ${JSON.stringify(split)}  (tapped LANDS: ${tappedLands})`);
    expect(split.unclaimed).toBe(0);
    expect(Object.values(split).reduce((a, b) => a + b, 0)).toBe(r.soleNeed['replacement'] ?? 0);
    // ⚠️⚠️ **ASSERTED IN D153 BECAUSE IT HAD BEEN REPORTING ZERO.** `isLand` read
    // `/<backspace>Land<backspace>/` — a regex that matches nothing — which is
    // D129's patch-script bug (`\b` written as a literal BACKSPACE) surviving in
    // a line that sweep did not cover. It was invisible in every reading of the
    // file, because a backspace renders as nothing; the integrity check that
    // found it scans for control characters and should be run on any file a
    // script has edited.
    //
    // ⚠️ And it survived because `tappedLands` was PRINTED and never asserted.
    // That is the same failure as `BUILT` itself, one file over: a figure nobody
    // checks is a figure that can be wrong for as long as nobody looks.
    expect(tappedLands).toBe(16);
  });

  /**
   * ⚠️ **WHAT LAYER 6 IS AND IS NOT WORTH**, pinned so D129's "partially built"
   * is a number rather than a hedge. Of the 1,791 cards whose SOLE need is
   * `layer6`: **1,166** are ability grants (D129), **258** anthems (layer 7c,
   * since M3), **138** conditionals (a live `appliesTo`, since M3) and **229**
   * combat restrictions — which D147 gave a seam (`CombatDef`), so the reason
   * D129 gave for keeping this row out of `BUILT` is closed.
   *
   * ⚠️⚠️ **AND THE ROW IS STILL NOT TICKABLE, FOR A REASON THE FOUR-WAY SPLIT
   * NEVER LOOKED FOR: 1,855 of its 4,676 lines are grants that END.** "Until end
   * of turn" (the overwhelming majority), "until your next turn", "until end of
   * combat" — 1,605 of them grants, 248 anthems, and only 2 restrictions, so this
   * is almost exactly the half of the row D129 built and D147 did not touch.
   * `GameState.untilEndOfTurn` carries POWER AND TOUGHNESS AND NOTHING ELSE:
   * there is no temporary keyword grant anywhere in this engine, so "target
   * creature gains flying until end of turn" has nowhere to be written at all.
   * **958 of these 1,791 cards carry one**, and `unlockedBy` requires every line,
   * so ticking `layer6` would claim all 958.
   *
   * ⚠️ The 2 temporary RESTRICTIONS are the shape of the answer if this is ever
   * built: a duration is not a property of the grant, it is a fifth thing the
   * state has to remember, and it would serve all four kinds at once.
   *
   * ⚠️ **ASKED OF `layer6Kind`, NOT RE-DERIVED HERE.** The first cut copied the
   * four patterns into this file and they immediately disagreed with the
   * classifier — a scripted edit wrote `\b` as a literal BACKSPACE, so every
   * card fell into `other` while `primitives.ts` still filed them under
   * `layer6`. Two copies of one rule, caught within the hour. Fourth time this
   * project has written that lesson down (the Command Tower lesson, D122, D127).
   */
  test('the layer6 bucket is four different things', () => {
    const split = { grant: 0, anthem: 0, restriction: 0, conditional: 0, unclaimed: 0 };
    let temporary = 0;
    for (const card of r.cards) {
      if (card.needs.size !== 1 || !card.needs.has('layer6')) continue;
      const kinds = card.layer6Lines.map(layer6Kind);
      const first = (['grant', 'anthem', 'restriction', 'conditional'] as const).find((k) =>
        kinds.includes(k),
      );
      if (first) split[first]++;
      else split.unclaimed++;
      if (card.layer6Lines.some((t) => TEMPORARY.test(t))) temporary++;
    }
    expect(split).toEqual({ grant: 1166, anthem: 258, restriction: 229, conditional: 138, unclaimed: 0 });
    // ⚠️ THE NUMBER THAT KEEPS `layer6` OUT OF `BUILT`. Asserted here rather than
    // written in the comment above, because D129's reason lived in a comment and
    // stayed there for twenty-four decisions after D147 closed it.
    expect(temporary).toBe(958);
  });

  /**
   * ⚠️ **`effect:token` SPLIT BEFORE BUILDING IT** (D131), because D130 predicted
   * it would be the same shape as `effect:counter` — 981 cards already scriptable
   * because the EVENT exists — **and that prediction is wrong.**
   *
   * `CountersChanged` takes a free-string `kind`, so a script could always emit
   * one. `TokenCreated` requires an `oracleId` AND a `printingId`: a script must
   * NAME a token printing, and nothing anywhere maps a printed description to
   * one. The only token resolution in the app is `TOKEN_NAMES` in
   * `buildGame.ts` — twelve names, hand-written, for the Tier-3 tool.
   *
   * So both halves of this row are blocked on the SAME missing piece, and it is
   * a resolver over card DATA rather than an engine primitive.
   */
  test('the effect:token bucket, by who asks and by what is asked for', () => {
    const byOwner = { spell: 0, permanent: 0 };
    const byKind = { copy: 0, predefined: 0, withAbilities: 0, variable: 0, plain: 0, unclaimed: 0 };
    for (const card of r.cards) {
      if (card.needs.size !== 1 || !card.needs.has('effect:token')) continue;
      if (card.isSpell) byOwner.spell++;
      else byOwner.permanent++;
      const kinds = card.tokenLines.map(tokenKind);
      const first = (['copy', 'predefined', 'withAbilities', 'variable', 'plain'] as const).find(
        (k) => kinds.includes(k),
      );
      if (first) byKind[first]++;
      else byKind.unclaimed++;
    }
    // ⚠️ THE SPELLS are the only part that could move `complete` — and every one
    // of them still needs the resolver.
    expect(byOwner).toEqual({ spell: 321, permanent: 594 });
    // ⚠️ `unclaimed: 0` is the canary on the classifier: every one of the 1,123
    // is accounted for, so the five buckets are the whole row rather than five
    // buckets and a shrug.
    // ⚠️ Every bucket FELL when M6.3f landed (D133): 421 plain → 276, 212
    // predefined → 134, 342 with-abilities → 241. Those are cards that now
    // EXECUTE and so left `blocked` altogether. `copy` and `variable` barely
    // moved — 77 → 76 and 71 → 69 — because the resolver refuses both by design,
    // which is exactly the shape a correct measurement should have.
    // ⚠️ Every bucket ROSE again in D153, and NOT because anything was unbuilt:
    // the `optional` pre-filter had been hiding 199 token lines, so those cards
    // were being counted as blocked on a yes/no. Same row, read honestly.
    expect(byKind).toEqual({
      copy: 101,
      predefined: 149,
      withAbilities: 275,
      variable: 73,
      plain: 317,
      unclaimed: 0,
    });
  });

  /**
   * ⚠️ THE MILESTONE'S OWN TWO NUMBERS, and they answer different questions.
   *
   * With `optional` built (D128), a script can be written for **1,362**
   * Commander-legal cards, where 1,263 need no primitive at all. **So the whole
   * of M6.3's first primitive is worth 99 cards** — not the 2,120 D128 recorded
   * and not the 2,200 this test asserted until D153, both of which counted every
   * line that merely CONTAINED "you may".
   *
   * ⚠️ AND `complete` HAS MOVED, from 1,405 to **1,730** through M6.3 — entirely
   * the effect VOCABULARY and the built-in replacements: a spell resolves
   * through `effectEvents` with no script, so widening what the ingest reads IS
   * the execution. Every primitive that needs a SCRIPT to be worth anything —
   * `optional`, layer 6, CR 616, CR 613.8, ability removal — moved it by zero,
   * exactly as D127 predicted. **M6.4a's first landed batch is what moves it by
   * scripts: 1,730 → 1,738 (D158), and both columns fell by the same eight,
   * which is the selection and the silence hook agreeing.**
   *
   * ⚠️ The two are asserted TOGETHER, in one test, so the enabling figure can
   * never be reported as coverage — the claim M6.4-LIBRARY-SPEC §2 forbids.
   * Coverage comes from `engineComplete` and from nowhere else. ⚠️ And it is the
   * enabling figure that was wrong for twenty-four decisions while the coverage
   * one stayed right, which is the argument for keeping them in one place.
   */
  test('what a script can express today, and what the engine still runs', () => {
    const steps = cumulative(r, BUILT);
    expect(steps.map((s) => s.unlocked)).toEqual([877, 976]);
    expect(r.complete).toBe(2116);
  });
});

/**
 * ⚠️ **THE RULE `BUILT` RESTS ON, ASSERTED WITHOUT THE DATABASE**, because the
 * whole failure D153 corrected was a rule that lived in the ORDER of four lines
 * in `primitiveFor` and in nothing else. Every figure above is a count, and a
 * count tells you a number moved without telling you which way is right.
 *
 * `optional` is in `BUILT`, so a line filed under it is being counted as already
 * handled. It may therefore only ever be a line where the yes/no is ALL that is
 * missing — and the second case here is the one that was wrong for twenty-four
 * decisions: a library search that the row swallowed whole.
 */
describe('a "you may" line is only `optional` if that is all it needs', () => {
  // A permanent's triggered ability — `sentence`, which is what all four of these
  // arrive as from `unaccountedLines`.
  const of = (text: string): Primitive => primitiveFor({ text, kind: 'sentence' }, 'Test Card');

  test('the yes/no is all that is missing', () => {
    expect(of('When this creature dies, you may draw a card.')).toBe('optional');
  });

  test('and when it is not, the line says what it is really waiting on', () => {
    expect(
      of('When this creature enters, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.'),
    ).toBe('effect:search');
    expect(of('At the beginning of your upkeep, you may put a quest counter on this enchantment.')).toBe(
      'effect:counter',
    );
    expect(of('When this creature enters, you may sacrifice a land. If you do, draw a card.')).toBe(
      'effect:sacrifice',
    );
  });

  /** A "may" over an effect nothing here reads is residue, not a built primitive. */
  test('and an unreadable one is residue rather than a tick', () => {
    expect(of('When this creature enters, you may exile target card from a graveyard.')).toBe('unclassified');
  });
});

/**
 * ⚠️ **THE FIFTH BUCKET SPLIT, AND THE BIGGEST** (D157). `unclassified` is the
 * largest row in this report by a factor of four, and until now it was a black
 * box the build order could say nothing about — which is exactly the state
 * D129, D130, D131 and D134 each found their row in before splitting it.
 *
 * ⚠️ **NAMING A LINE DOES NOT MAKE IT EXPRESSIBLE.** Every line counted here is
 * still `unclassified` and still blocked; `residueKind` is a secondary
 * classification, never a `RULES` row. Moving these into `RULES` would shrink
 * the residue by RELABELLING it, which is the one way this report could lie
 * about its own coverage.
 */
describe.skipIf(!HAVE_DB)('what the residue is about', () => {
  let rr: Report;

  test('reads it', async () => {
    rr = await run();
    expect(rr.blocked).toBeGreaterThan(20_000);
  }, 600_000);

  /**
   * ⚠️ THE TWO LARGEST NAMED FAMILIES ARE BOTH ALREADY-NAMED M6.4 WORK.
   * `activatedCost` is an ability whose cost the engine cannot CHARGE — a
   * decision rather than a price (D68, D122) — and `triggeredShell` is a trigger
   * whose condition reads fine and whose payload does not, which wants the
   * effect vocabulary rather than a trigger primitive.
   */
  test('the residue splits into named families', () => {
    expect(rr.residue).toEqual({
      activatedCost: 3170,
      triggeredShell: 2509,
      damage: 1328,
      exile: 1263,
      staticShell: 1017,
      attackBlock: 999,
      lifeGainLoss: 939,
      drawDiscard: 577,
      tokensAndCounters: 507,
      copySpell: 224,
      cantBeCountered: 109,
      gainControl: 95,
      wardHexproofGrant: 49,
      other: 5422,
    });
  });

  /**
   * ⚠️⚠️ **THE BAR THAT REPLACED THE OLD ONE.** "What share of blocked cards has
   * no primitive" was at 49.5% against a hard 0.5 and would have failed on the
   * next parser widening — for a reason unrelated to anything going wrong. The
   * question worth bounding is **how much of the report is genuinely unnamed**,
   * and that is `other` as a share of the residue: 5,422 of 18,208, **29.8%**.
   *
   * ⚠️ Pinned as a share rather than a count, because both move together when a
   * parser widens and only the ratio says whether the black box is growing.
   */
  test('and what is left genuinely unnamed is under a third of it', () => {
    const total = Object.values(rr.residue).reduce((a, b) => a + b, 0);
    const unnamed = (rr.residue['other'] ?? 0) / total;
    expect(unnamed, 'unnamed share of the residue').toBeLessThan(0.32);
    expect(unnamed).toBeGreaterThan(0.2);
  });
});
describe.skipIf(HAVE_DB)('what each primitive is worth', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect(HAVE_DB).toBe(false);
  });
});
