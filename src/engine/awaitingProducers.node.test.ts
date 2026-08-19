// Which prompts the engine can actually RAISE — asserted, not remembered.
//
// ⚠️ THIS IS THE OTHER HALF OF D102. `src/bot/awaiting.ts` proves every
// `Awaiting` kind can be ANSWERED; nothing proved which ones can be ASKED. The
// difference is where the hangs live: M6.1 found `assignCombatDamage` sitting in
// the union with no answering intent anywhere, and `orderAttackers` asking for a
// list `CardView.blocking` could not express — both invisible precisely because
// no producer existed to raise them, so no suite ever tried. "Unreachable today"
// was a fact somebody had checked once and written in a comment. See D125.
//
// So this file states the whole map:
//
//  • the thirteen kinds, read out of the union in `types/state.ts` itself;
//  • the eleven that some engine file constructs, with the sites;
//  • the two that nothing constructs, NAMED, with the reason they are dormant
//    rather than broken — each has an answering intent, a handler and a client
//    that can compute the answer, so turning on a producer is all that is
//    needed. That is the distinction `assignCombatDamage` failed.
//
// ⚠️ A NEW KIND FAILS THIS TEST. Adding a variant with no producer and no entry
// in `NO_PRODUCER` fails "every kind is accounted for"; adding one with no case
// in `src/bot/awaiting.ts` fails "every kind has an answer" (and `tsc -b` first).
// Either way the question gets asked at the time the variant is written, which
// is the only time it is cheap to answer.
//
// ⚠️ A `.node.test.ts` because it reads source with `node:fs`, exactly like
// `purity.node.test.ts`, and type-checked by tsconfig.node.json for that reason.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const SRC = join(process.cwd(), 'src');
const STATE_TS = join(SRC, 'engine', 'types', 'state.ts');

/**
 * ⚠️ `testing/` and `fixtures/` are excluded, and the reason is the whole point
 * of the file: a harness that hand-builds a prompt proves nothing about what the
 * engine raises in play. Counting one as a producer is how "this cannot happen"
 * turns into "this happens only in a test", which is the same blindness from the
 * other side.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'testing' || entry === 'fixtures' || entry === 'node_modules') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    if (entry.endsWith('.test.ts') && !entry.endsWith('.node.test.ts')) continue;
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    out.push(full);
  }
  return out;
}

// ── the union, read from the type ────────────────────────────────────────────

/**
 * The kinds, taken from `types/state.ts` rather than written out here.
 *
 * ⚠️ A second hand-maintained list is a list that disagrees. TypeScript erases
 * the union at runtime, so reading the declaration is the only way this test can
 * see a variant somebody added without telling it.
 */
function unionKinds(): string[] {
  const text = readFileSync(STATE_TS, 'utf8');
  const start = text.indexOf('export type Awaiting =');
  expect(start).toBeGreaterThan(-1);
  const rest = text.slice(start);
  const end = rest.indexOf('\nexport ', 1);
  const block = end === -1 ? rest : rest.slice(0, end);
  return [...block.matchAll(/readonly kind: '([a-zA-Z]+)'/g)].map((m) => m[1] as string);
}

const KINDS = unionKinds();

// ── the producers ────────────────────────────────────────────────────────────

interface Site {
  readonly kind: string;
  readonly at: string;
}

/**
 * `Extract<Awaiting, { kind: 'chooseTargets' }>` NAMES a variant; it does not
 * build one. Both halves must hold — an `Extract<` opened just before, and a
 * `}>` closing just after — so a real construction that happens to sit below a
 * generic is not swallowed by the exclusion.
 */
function isTypePosition(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 160), index);
  const after = text.slice(index, index + 80);
  return /Extract<[^;=]*$/.test(before) && /\}\s*>/.test(after);
}

function producerSites(): Site[] {
  const out: Site[] = [];
  for (const file of sourceFiles(SRC)) {
    // The declarations themselves are not constructions.
    if (file.includes(join('engine', 'types') + sep) || file === STATE_TS) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/kind:\s*'([a-zA-Z]+)'/g)) {
      const kind = m[1] as string;
      if (!KINDS.includes(kind)) continue;
      if (m.index === undefined || isTypePosition(text, m.index)) continue;
      const line = text.slice(0, m.index).split('\n').length;
      out.push({ kind, at: `${relative(process.cwd(), file).split(sep).join('/')}:${line}` });
    }
  }
  return out;
}

const SITES = producerSites();
const PRODUCED = [...new Set(SITES.map((s) => s.kind))].sort();

/**
 * The prompts nothing raises today, and why each is DORMANT rather than broken.
 *
 * Both are combat damage-assignment ORDER (CR 509.2, 509.3). The engine takes
 * the order creatures were declared in and never asks, so `BlockerOrderSet` /
 * `AttackerOrderSet` only ever arrive from a Tier-3-style deliberate answer.
 * Each has an `Intent`, a handler that validates it against `state.combat`, and
 * — since `CardView.blocking` became an array — a `PlayerView` that can express
 * the answer. Wiring a producer is the only missing piece.
 *
 * ⚠️ CONTRAST WITH WHAT WAS DELETED. `assignCombatDamage` was in this position
 * with NO intent, NO handler and NO button: raising it would have stopped the
 * game with nothing able to answer, on any client. That is why it left the union
 * rather than joining this list. A kind belongs here only if it is answerable.
 */
const NO_PRODUCER = ['orderAttackers', 'orderBlockers'] as const;

describe('Awaiting — which prompts the engine can raise', () => {
  test('the union is the nineteen kinds this test knows about', () => {
    expect([...KINDS].sort()).toEqual(
      [
        'chooseColor',
        'chooseReplacement',
        'chooseFromZone',
        'chooseLegendKeep',
        'chooseTargets',
        'chooseX',
        'commanderZoneChoice',
        'declareAttackers',
        'declareBlockers',
        'entersChoice',
        'mulligan',
        'mulliganBottom',
        'optionalTrigger',
        'orderAttackers',
        'orderCards',
        'orderBlockers',
        'orderTriggers',
        'rewindVote',
        'scryChoice',
      ].sort(),
    );
  });

  test('seventeen of the nineteen have a producer, and the sites are real', () => {
    expect(PRODUCED).toEqual(
      [
        'chooseColor',
        'chooseReplacement',
        'chooseFromZone',
        'chooseLegendKeep',
        'chooseTargets',
        'chooseX',
        'commanderZoneChoice',
        'declareAttackers',
        'declareBlockers',
        'entersChoice',
        'mulligan',
        'mulliganBottom',
        'optionalTrigger',
        'orderCards',
        'orderTriggers',
        'rewindVote',
        'scryChoice',
      ].sort(),
    );
    // Every kind claimed as produced must name at least one file:line, so the
    // count above cannot be satisfied by the scanner matching nothing at all.
    for (const kind of PRODUCED) {
      expect(SITES.filter((s) => s.kind === kind).length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ THE ASSERTION THAT DOES NOT DECAY. Producers plus known-dormant must be
   * the whole union: a seventeenth variant is unaccounted for the moment it is
   * written, whichever side it falls on. It has already earned its keep once —
   * `optionalTrigger` (D128) failed this test, by name, before it had a
   * producer, and `entersChoice` (D136) failed it the same way.
   */
  test('every kind is accounted for — produced, or named as dormant', () => {
    const accounted = new Set([...PRODUCED, ...NO_PRODUCER]);
    expect([...KINDS].sort()).toEqual([...accounted].sort());
    for (const kind of NO_PRODUCER) expect(PRODUCED).not.toContain(kind);
  });

  /**
   * ⚠️ A DORMANT PROMPT MUST STILL BE ANSWERABLE — that is the whole difference
   * between `orderAttackers` (dormant, wired) and `assignCombatDamage` (deleted).
   * Checked against the real intent union and the real handler switch, because a
   * prompt whose answer exists only in a comment is the D102 shape exactly.
   */
  test('the dormant prompts each have an intent and a handler', () => {
    const intents = readFileSync(join(SRC, 'engine', 'types', 'intents.ts'), 'utf8');
    const handlers = readFileSync(join(SRC, 'engine', 'handlers.ts'), 'utf8');
    for (const kind of NO_PRODUCER) {
      const name = kind.charAt(0).toUpperCase() + kind.slice(1); // orderAttackers → OrderAttackers
      expect(intents).toContain(`t: '${name}'`);
      expect(handlers).toContain(`case '${name}':`);
    }
  });

  /**
   * ⚠️ NOTHING OUTSIDE THE ENGINE MAY RAISE A PROMPT. `apply` is the only writer
   * of `state.priority.awaiting`, and a prompt fabricated in the UI or over the
   * wire would be a second source of truth for what the game is waiting on —
   * with no event behind it, so no replay and no reconnect.
   */
  test('only src/engine/ constructs a prompt', () => {
    const strays = SITES.filter((s) => !s.at.startsWith('src/engine/'));
    expect(strays).toEqual([]);
  });

  /**
   * ⚠️ The runtime echo of `awaiting.ts`'s `never` check. That fails `tsc -b`,
   * which is the stronger guard — but it fails on a MISSING case, not on a case
   * that exists and answers with a fault, and this file is where the reader is
   * looking when they ask "can anything answer this?".
   */
  test('every kind has a case in the bot, the one exhaustive answerer', () => {
    const bot = readFileSync(join(SRC, 'bot', 'awaiting.ts'), 'utf8');
    for (const kind of KINDS) expect(bot).toContain(`case '${kind}'`);
  });
});
