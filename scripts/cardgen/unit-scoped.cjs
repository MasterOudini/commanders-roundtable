// D335 - THE UNIT SUITE, SCOPED. Two vitest runs that together are the unit
// gate for a generator-only wave: everything outside the card suites (the
// engine, the data, the bot, the UI, the accounting), then the batch's own
// card suites. Exit status is the OR of the two. The FULL suite (every card
// suite, `verify.cjs --full` without `--scope`) is still owed on the cadence
// AGENTS.md states, and always when an engine, data or bot file changed.
//
//   node scripts/cardgen/unit-scoped.cjs <scope-file>
//     scope-file: a JSON array of test paths, or a text file with one
//     generated module name per line (`src/engine/scripts/cards/<name>.test.ts`).
'use strict';
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..', '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const scopeFile = process.argv[2];
if (!scopeFile) {
  console.error('usage: node scripts/cardgen/unit-scoped.cjs <scope-file>');
  process.exit(2);
}
const raw = readFileSync(scopeFile, 'utf8');
const listed = raw.trim().startsWith('[')
  ? JSON.parse(raw)
  : raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((m) => (m.endsWith('.test.ts') ? m : `src/engine/scripts/cards/${m}.test.ts`));
const suites = listed.filter((p) => existsSync(join(root, p)));
if (suites.length !== listed.length) {
  console.error(`scope: ${listed.length - suites.length} listed suite(s) do not exist`);
  process.exit(2);
}

function run(label, args) {
  console.log(`\n   ${label}`);
  const r = spawnSync(npx, ['vitest', 'run', '--no-isolate', ...args], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
}

const outside = run('everything outside the card suites', ['--exclude', 'src/engine/scripts/cards/**']);
const own = suites.length > 0 ? run(`the batch's own card suites (${suites.length})`, suites) : 0;
console.log(`\n   scoped unit suite: outside the cards ${outside === 0 ? 'ok' : 'FAILED'} · ${suites.length} card suites ${own === 0 ? 'ok' : 'FAILED'}`);
process.exit(outside === 0 && own === 0 ? 0 : 1);
