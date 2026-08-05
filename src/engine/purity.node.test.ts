// The architectural guard. Written in step 2, before there is any logic to
// guard, because it is worth nothing after the fact: by the time an accidental
// `Date.now()` has been in `loop.ts` for a week, removing it is a refactor
// rather than a one-line fix, and the replay divergence it causes shows up as
// "the fuzzer fails on seed 331" with no visible cause.
//
// What it defends:
//
//  • `src/engine/` is PURE and DETERMINISTIC. Same state + same intent + same
//    RNG state ⇒ same events, forever, on any machine. Replay, group rewind,
//    reconnect and the M4 desync check all reduce to that one property.
//  • It has no platform. The engine runs in the renderer today and could run in
//    a worker, in Node, or in a test harness tomorrow. An `electron` import
//    would silently make it renderer-only.
//  • It owns no UI state. A zustand import would give the engine a second,
//    unlogged source of truth — the exact thing the append-only log exists to
//    make impossible.
//
// ⚠️ This file is a `.node.test.ts` because it needs `node:fs`, and it is
// therefore type-checked by tsconfig.node.json rather than tsconfig.app.json.
// It excludes `*.test.ts` from its own scan for the same reason: tests are not
// shipped (electron-builder's `files` allowlist is `dist/**` + `electron/**`),
// and a test that had to obey its own rule could not read the files it checks.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const ENGINE_DIR = join(process.cwd(), 'src', 'engine');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    if (entry.endsWith('.test.ts')) continue;
    out.push(full);
  }
  return out;
}

const FILES = sourceFiles(ENGINE_DIR);

/** Import specifiers the engine may never reach for. */
const BANNED_IMPORT = /from\s+['"](react|react-dom|electron|zustand|node:[a-z/]+|fs|path|os|crypto|child_process|motion[/a-z]*)['"]/;

/** Calls that make output depend on something the log does not record. */
const BANNED_CALLS: readonly [RegExp, string][] = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew\s+Date\s*\(/, 'new Date()'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bcrypto\.(getRandomValues|randomUUID)\s*\(/, 'crypto randomness'],
  [/\bprocess\.(env|hrtime|argv)\b/, 'process.*'],
  [/\bwindow\./, 'window.*'],
  [/\bdocument\./, 'document.*'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsetTimeout\s*\(/, 'setTimeout()'],
  [/\bsetInterval\s*\(/, 'setInterval()'],
];

/**
 * Comments legitimately mention the banned names — this file's own header does,
 * and several engine files explain *why* they cannot use one. Stripping
 * comments before matching is what keeps the test about code rather than prose.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('engine purity', () => {
  test('there are engine source files to check', () => {
    // A scan that silently finds nothing passes forever. This is the canary.
    expect(FILES.length).toBeGreaterThan(5);
  });

  test.each(FILES.map((f) => [relative(process.cwd(), f), f] as const))(
    '%s imports nothing platform-specific',
    (_name, file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const hit = code.match(BANNED_IMPORT);
      expect(hit?.[1] ?? null).toBeNull();
    },
  );

  test.each(FILES.map((f) => [relative(process.cwd(), f), f] as const))(
    '%s calls nothing nondeterministic',
    (_name, file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const found: string[] = [];
      for (const [re, label] of BANNED_CALLS) if (re.test(code)) found.push(label);
      expect(found).toEqual([]);
    },
  );

  /**
   * A relative import is resolved for real rather than pattern-matched, because
   * `../rng` from `types/` and `../../store/foo` from `types/` look identical to
   * a regex and mean completely different things. The allowed landing zones are
   * the engine itself, `src/data` (pure card shapes and the oracle ingest) and
   * `src/view` (the M2 seam's types). Anything else — a store, a component, the
   * preload bridge — would give the engine a second source of truth.
   */
  test('the engine imports only from src/engine, src/data and src/view', () => {
    const ALLOWED = ['src/engine', 'src/data', 'src/view'].map((p) => join(process.cwd(), p));
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const m of code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        const spec = m[1] ?? '';
        const target = resolve(dirname(file), spec);
        if (ALLOWED.some((root) => target === root || target.startsWith(root + sep))) continue;
        offenders.push(`${relative(process.cwd(), file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * ⚠️ A NARRATION LINE MAY NOT BAKE A PLAYER'S NAME INTO A STRING. See D101.
   *
   * `narrated()` still accepts a plain string, and it must — most lines have a
   * card as their subject ("Lightning Bolt resolves.") and read the same to
   * everybody. But a plain string interpolating a player's NAME is exactly the
   * bug D101 fixed: it compiles, it looks right, and it silently produces a log
   * that can only ever be third person. Nothing else would catch it, because the
   * sentence is *correct* — for every reader except the one it is about.
   *
   * The guard is on the shape of the interpolation, not on the whole file, so a
   * template built with `n` and parts passes and a hand-built one does not.
   *
   * ⚠️ It matches the two UNAMBIGUOUS ways to name a player — a `players[…].name`
   * lookup and a `playerName()` helper — and deliberately not a bare `.name`. A
   * bare `.name` is far more often a CARD's ("Lightning Bolt", "Grizzly Bears
   * dies.", "Legend rule: …"), which read the same to every seat and are exactly
   * what the plain-string form is for. A guard that flagged all three of those
   * would be deleted by the next person to see it, and then it guards nothing.
   */
  test('no narration bakes a player name into a plain string', () => {
    // `narrated(` followed by a backtick literal — the parts form is `narrated(n`…`.
    const HAND_BUILT = /narrated\(\s*`[^`]*`/g;
    const NAMES_A_PLAYER = /players\s*\[[^\]]*\]\s*\??\.\s*name|playerName\s*\(/;
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const m of code.matchAll(HAND_BUILT)) {
        if (NAMES_A_PLAYER.test(m[0])) {
          offenders.push(`${relative(process.cwd(), file)}: ${m[0].slice(0, 72)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── the net layer's own line ─────────────────────────────────────────────────
//
// ⚠️ `src/net/` runs on BOTH sides of the wire and in a Vitest process with no
// DOM, so it holds the same architectural line as the engine minus the one
// thing a transport genuinely needs: a socket. A React import here would make
// the host session renderer-only; a zustand import would give the wire a second
// source of truth beside the projected view.

const NET_DIR = join(process.cwd(), 'src', 'net');
const NET_FILES = sourceFiles(NET_DIR);

/** Only the socket transport may name a WebSocket; everything else is pure. */
const SOCKET_FILES = new Set(['socketTransport.ts', 'relayTransport.ts', 'devHandles.ts']);

describe('src/net purity', () => {
  test('there are net files to check', () => {
    expect(NET_FILES.length).toBeGreaterThan(5);
  });

  test('no file imports react, electron or zustand', () => {
    for (const file of NET_FILES) {
      const text = readFileSync(file, 'utf8');
      const hit = /from\s+['"](react|react-dom|electron|zustand|motion[/a-z]*)['"]/.exec(text);
      expect(hit?.[1], `${relative(process.cwd(), file)} imports ${hit?.[1]}`).toBeUndefined();
    }
  });

  /**
   * ⚠️⚠️ **ALL THREE OF THESE WERE PASSING OVER NOTHING UNTIL D153.** Each regex
   * had been written with its `\b` as a literal BACKSPACE character (0x08) by a
   * patch script — `/<BS>new WebSocket<BS>/` matches no string that has ever
   * existed — so the net layer's socket and DOM line was unenforced, silently,
   * and invisibly: a backspace renders as nothing, so the source read correctly
   * every time anyone looked at it. D129 records the same corruption in
   * `primitives.node.test.ts`, and D153 found a third instance in the same sweep.
   * **The detector is a scan for control characters, and it belongs on any file a
   * script has edited.**
   *
   * ⚠️ And repairing the regex is only half of it: the check read the RAW file,
   * so the first thing it caught was `protocol.ts` explaining a "5-minute grace
   * window." in prose. `stripComments` exists three screens up for exactly this
   * reason and its own comment says so — "what keeps the test about code rather
   * than prose". Two guards, one lesson, applied in one place and not the other.
   */
  test('only the transport layer touches a socket or the DOM', () => {
    for (const file of NET_FILES) {
      const name = file.split(sep).pop() ?? '';
      if (SOCKET_FILES.has(name)) continue;
      const code = stripComments(readFileSync(file, 'utf8'));
      expect(/\bnew WebSocket\b/.test(code), `${name} opens a socket`).toBe(false);
      expect(/\bdocument\./.test(code), `${name} touches the DOM`).toBe(false);
      expect(/\bwindow\./.test(code), `${name} touches window`).toBe(false);
    }
  });

  test('the host session never reaches into a store or a component', () => {
    const host = readFileSync(join(NET_DIR, 'host.ts'), 'utf8');
    expect(host).not.toMatch(/from\s+['"]\.\.\/(ui|store)\//);
    const client = readFileSync(join(NET_DIR, 'client.ts'), 'utf8');
    expect(client).not.toMatch(/from\s+['"]\.\.\/(ui|store)\//);
  });
});

// ── the bot's own line ───────────────────────────────────────────────────────
//
// ⚠️ `src/bot/` holds the ENGINE's clock rule with the NET's import rule, and
// the difference from `src/net/` is the point. The net block permits
// `setTimeout` because a transport needs backoff; a bot must not have one, or
// pacing ends up inside the policy and then a headless tournament can never run
// faster than real time and the replay proof acquires an "unless the timing
// differs" caveat nobody can discharge. Every timer lives in
// `src/game/botSeat.ts`, which is renderer code and is not scanned here.
//
// ⚠️ And one rule neither other block needs: NO RUNTIME IMPORT OF AN ENGINE
// MODULE THAT TAKES A `GameState`. `legalActions`, `canAttack` and
// `candidatesFromState` all look importable and would compile — they would just
// always be handed nothing, because a client has no `GameState` and a bot IS a
// client. This is M6 invariant 3 made mechanical instead of aspirational.

const BOT_DIR = join(process.cwd(), 'src', 'bot');
const BOT_FILES = sourceFiles(BOT_DIR);

/** Engine modules whose exported functions all take a `GameState`. */
const HOST_ONLY = /(?<!type\s)\{[^}]*\}\s*from\s+['"][^'"]*\.\.\/engine\/(legal|combat|loop|reducer|handlers|project|game|sba|triggers|turn|zones|derive)['"]/;

describe('src/bot purity', () => {
  test('there are bot files to check', () => {
    expect(BOT_FILES.length).toBeGreaterThan(3);
  });

  test.each(BOT_FILES.map((f) => [relative(process.cwd(), f), f] as const))(
    '%s imports nothing platform-specific',
    (_name, file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const hit = code.match(/from\s+['"](react|react-dom|electron|zustand|node:[a-z/]+|motion[/a-z]*)['"]/);
      expect(hit?.[1] ?? null).toBeNull();
    },
  );

  test.each(BOT_FILES.map((f) => [relative(process.cwd(), f), f] as const))(
    '%s has no clock and no randomness',
    (_name, file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const found: string[] = [];
      for (const [re, label] of BANNED_CALLS) if (re.test(code)) found.push(label);
      expect(found).toEqual([]);
    },
  );

  test('no bot file calls an engine function that needs a GameState', () => {
    const offenders: string[] = [];
    for (const file of BOT_FILES) {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (HOST_ONLY.test(code)) offenders.push(relative(process.cwd(), file));
    }
    expect(offenders).toEqual([]);
  });
});
