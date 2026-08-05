#!/usr/bin/env node
// Pick the next batch of cards to script — M6.4-LIBRARY-SPEC §5/§7. See D157.
//
//   node scripts/cardgen/select.cjs [count]        # default 200
//
// Writes `scripts/cardgen/batch.json`: the cards, in the order §7 asks for, each
// blocked on a per-card SCRIPT and nothing else.
//
// ⚠️ THIS IS A WRAPPER AND THE LOGIC IS IN TYPESCRIPT, deliberately. Selection
// has to ask `engineCompleteness` and `primitivesFor` which cards are blocked on
// a script alone; `scripts/` is CommonJS and cannot import them. The alternative
// is a second copy of those predicates in CJS, which is the one thing five
// entries of DECISIONS.md say not to do (the Command Tower lesson, D122, D127,
// D129, D133). So the real work lives in `src/data/cardgenSelect.node.test.ts`
// and this runs it.

const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const count = Number(process.argv[2] ?? 200);
if (!Number.isFinite(count) || count < 1) {
  console.error('usage: node scripts/cardgen/select.cjs [count]');
  process.exit(2);
}

const out = join(__dirname, 'batch.json');
const run = spawnSync(
  'npx',
  ['vitest', 'run', 'src/data/cardgenSelect.node.test.ts'],
  {
    cwd: join(__dirname, '..', '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CRT_CARDGEN_OUT: out, CRT_CARDGEN_COUNT: String(count) },
  },
);

if (run.status !== 0) {
  console.error('\nselection failed — see the vitest output above.');
  process.exit(run.status ?? 1);
}
if (!existsSync(out)) {
  // ⚠️ The selection test SKIPS without a card database, and a skip is not a
  // batch. Saying so is the difference between "nothing to script" and "nothing
  // was asked".
  console.error('\nNo batch written. The card database is probably missing:');
  console.error('  node electron/cardsvc-worker.cjs --sync');
  process.exit(1);
}

const batch = JSON.parse(readFileSync(out, 'utf8'));
console.log(`\n${batch.batch} of ${batch.total} scriptable cards → ${out}`);
console.log(`  rung 1 (your decks): ${batch.byRung['1']}`);
console.log(`  rung 2 (fuzz pool + fixtures): ${batch.byRung['2']}`);
console.log(`  rung 3 (everything else): ${batch.byRung['3']}`);
console.log('\nNext: draft the scripts (see scripts/cardgen/README.md), then');
console.log('  node scripts/cardgen/verify.cjs');
