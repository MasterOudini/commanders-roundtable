// The tripwire under every script-created token (D298; D133's rot class): a
// `TokenCreated` whose printing the FIXTURE oracle cannot name derives to a
// nameless 0/0 the state-based action bins - and the fuzz gate's
// `tokensNamed === tokensCreated` canary goes red one seed in five hundred, as
// gate 149 did for Titania's Elemental. So every `tokenRef('<key>')` a shipped
// script prints must resolve through the fixture oracle, which means its
// printing is PINNED in `make-engine-fixtures.cjs`'s token list. This scans the
// scripts by file and fails BY KEY.
//
// ⚠️ D361 - and the ENGINE's own table: `afterlife` creates its Spirit from
// `keywordTriggers.ts`, which no script directory holds. A tripwire that cannot
// see every site that creates a token is green over nothing.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { TOKEN_TABLE } from './tokenTable';
import { ORACLE } from '../engine/testing/harness';

describe('every token a shipped script creates is a pinned fixture (D298)', () => {
  test('each tokenRef key resolves in the TOKEN_TABLE and its printing in the fixture oracle', () => {
    const dir = join(__dirname, '..', 'engine', 'scripts', 'cards');
    const missingKey: string[] = [];
    const unpinned: string[] = [];
    const files: [string, string][] = readdirSync(dir)
      .filter((e) => e.endsWith('.ts') && !e.includes('.test.'))
      .map((e) => [e, join(dir, e)]);
    files.push(['keywordTriggers.ts', join(__dirname, '..', 'engine', 'keywordTriggers.ts')]);
    for (const [entry, path] of files) {
      const src = readFileSync(path, 'utf8');
      for (const m of src.matchAll(/tokenRef\('([^']+)'\)/g)) {
        const key = m[1] ?? '';
        const ref = TOKEN_TABLE[key];
        if (!ref) {
          missingKey.push(`${entry}: ${key}`);
          continue;
        }
        if (ORACLE.byPrinting(ref.printingId) === undefined) unpinned.push(`${entry}: ${key} (${ref.name}, printing ${ref.printingId})`);
      }
    }
    expect(missingKey).toEqual([]);
    expect(unpinned).toEqual([]);
  });
});
