// No source file contains a control character. See D154.
//
// ⚠️ WHY THIS EXISTS, and it is not hypothetical. Three regexes in this
// repository were written with their `\b` as a literal BACKSPACE (0x08) by a
// patch script, so they matched no string that has ever existed:
//
//   · `primitives.node.test.ts` — `isLand`, which was therefore FALSE for every
//     card in the database (D129 found this class of bug, fixed the lines it had
//     noticed, and never swept for more; D153 found this one).
//   · `purity.node.test.ts` — `new WebSocket`, `document.` and `window.`: the
//     entire socket-and-DOM half of invariant 7. **Three architectural guards
//     passing over nothing**, for twenty-four decisions.
//
// ⚠️ **INVISIBLE BY CONSTRUCTION, WHICH IS THE WHOLE ARGUMENT FOR A MACHINE
// CHECK.** A backspace renders as nothing. The source reads correctly in an
// editor, in a diff, in a code review and in every tool that printed it during
// the sessions that introduced and later fixed it. Only a scan for the character
// code can see it, so a human being careful is not a control.
//
// ⚠️ IT SCANS TEST FILES, deliberately, and that is the opposite of what
// `purity.node.test.ts` does two directories over. Every instance found so far
// has been IN a test — which stands to reason, because a corrupted regex in
// product code fails loudly the first time it runs, while a corrupted regex in
// an assertion just stops asserting.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

/** Build output, dependencies and history. `.electron-dist/` is a vendored
 *  Chromium tree whose LICENSES file legitimately carries a form feed. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'release',
  '.electron-dist',
  'coverage',
  '.vite',
]);

/** Text we author. Anything not listed is treated as binary and skipped. */
const TEXT = /\.(ts|tsx|cjs|mjs|js|jsx|json|md|css|html|yml|yaml)$/;

function textFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...textFiles(full));
      continue;
    }
    if (TEXT.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The escape a control character was almost certainly meant to be, so the
 * failure says what to type rather than only what is wrong.
 *
 * ⚠️ Written with `String.fromCharCode`, never as a literal — a file that scans
 * for control characters must not contain one, and this check runs over itself.
 */
const MEANT: Readonly<Record<number, string>> = {
  0: String.fromCharCode(92) + '0 (null)',
  7: String.fromCharCode(92) + 'a (bell)',
  8: String.fromCharCode(92) + 'b — a REGEX WORD BOUNDARY, and the one that has bitten this repo three times',
  11: String.fromCharCode(92) + 'v (vertical tab)',
  12: String.fromCharCode(92) + 'f (form feed)',
  27: String.fromCharCode(92) + 'e (escape)',
  127: 'DEL',
};

/** Tab, newline and carriage return are the only ones a source file may hold. */
function offendingCodes(line: string): number[] {
  const bad: number[] = [];
  for (const ch of line) {
    const c = ch.charCodeAt(0);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || c === 127) bad.push(c);
  }
  return bad;
}

const FILES = textFiles(process.cwd());

describe('source integrity', () => {
  /** ⚠️ A scan that silently finds nothing passes forever — `purity.node.test.ts`'s
   *  rule, and the reason that file opens with the same canary. */
  test('there are files to scan', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  /**
   * ⚠️ THE TEETH, and without them the check above is D128's green-over-nothing:
   * a scan whose predicate never fires reports a clean tree in exactly the same
   * way as a clean tree does. Both directions, because a predicate that flagged
   * everything would also "pass" the negative half by accident.
   */
  test('the detector detects', () => {
    const BS = String.fromCharCode(8);
    expect(offendingCodes(`/${BS}Land${BS}/`)).toEqual([8, 8]);
    expect(offendingCodes(String.fromCharCode(0, 11, 12, 127))).toEqual([0, 11, 12, 127]);
    // …and leaves the three that belong in a text file alone.
    expect(offendingCodes('\tindented\r\n')).toEqual([]);
    expect(offendingCodes('nothing here at all')).toEqual([]);
  });

  /**
   * ⚠️⚠️ **HOW MANY TEST FILES CI CANNOT CHECK.** Nine of them need the 86 MB
   * Scryfall database, are written with `describe.skipIf`, and therefore SKIP
   * on a machine without it — leaving the run GREEN. That is D128’s
   * green-over-nothing at the scale of a whole pipeline (D157).
   *
   * ⚠️ Pinned so a TENTH cannot quietly join the set. Raising this number is the
   * moment to ask whether the new check should really be invisible to CI, or
   * whether it belongs on committed fixtures like the conformance corpus does.
   */
  test('the set of database-gated tests has not grown unnoticed', () => {
    const isTest = /\.test\.ts$/;
    const dbGated = /skipIf\(!HAVE_DB\)|skipIf\(!existsSync\(NDJSON\)\)/;
    const gated = FILES.filter((f) => isTest.test(f) && dbGated.test(readFileSync(f, 'utf8'))).map((f) =>
      relative(process.cwd(), f),
    );
    expect(gated).toHaveLength(9);
  });

  test('no source file contains a control character', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const bad = offendingCodes(line);
        if (bad.length === 0) return;
        const what = [...new Set(bad)]
          .map((c) => `0x${c.toString(16).padStart(2, '0')} (meant: ${MEANT[c] ?? 'unknown'})`)
          .join(', ');
        offenders.push(`${relative(process.cwd(), file)}:${i + 1} — ${what}`);
      });
    }
    // ⚠️ The message has to say what to DO. A patch script that builds a
    // replacement string through a shell heredoc is how every instance of this
    // got in; writing the script to a FILE and running it with `node <file>` is
    // what stops the shell eating the backslash.
    expect(
      offenders,
      'control characters in source — rewrite the escape as two characters (backslash + letter)',
    ).toEqual([]);
  });
});
