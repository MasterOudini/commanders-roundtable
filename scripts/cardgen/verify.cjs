#!/usr/bin/env node
// The five gates a batch has to pass before it lands — M6.4-LIBRARY-SPEC §6.
// See D157.
//
//   node scripts/cardgen/verify.cjs            # the fast gates
//   node scripts/cardgen/verify.cjs --full     # …and the 500-seed fuzz gate
//
// ⚠️ **A SCRIPT THAT CANNOT BE VERIFIED IS NOT LANDED. No exceptions, no
// "mostly works" tier** — the spec's words, and the reason this exists as a
// command rather than as a checklist somebody follows.
//
// ⚠️ THE ORDER IS CHEAPEST-FIRST ON PURPOSE. `tsc` catches a malformed script in
// seconds; the fuzz gate takes ~450 s and there is no point spending it on a
// batch that does not compile.

const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const root = join(__dirname, '..', '..');
const full = process.argv.includes('--full');
const npx = 'npx';

/**
 * ⚠️ Each entry says WHAT IT CATCHES, because a gate whose purpose nobody
 * remembers is a gate somebody deletes when it goes red at an awkward moment.
 */
const GATES = [
  {
    name: 'types',
    catches: 'a script that does not fit the CardScript surface at all',
    cmd: [npx, ['tsc', '-b']],
  },
  {
    name: 'the conformance corpus',
    catches: 'a script that is individually right and WRONG IN COMBINATION — §6 gate 2',
    cmd: [npx, ['vitest', 'run', 'src/engine/conformance.test.ts']],
  },
  {
    name: 'the coverage accounting',
    catches:
      'a card the engine now RUNS while tier3 still disclaims it, or engineComplete still refuses it — §6 gate 5',
    cmd: [npx, ['vitest', 'run', 'src/data/shippedScripts.node.test.ts']],
  },
  {
    name: 'the whole unit suite',
    catches: 'everything else, including the per-card tests landed with the batch — §6 gate 1',
    cmd: [npx, ['vitest', 'run']],
  },
  {
    name: 'the replay fuzz gate',
    catches:
      'a script whose events do not replay, and a landed card missing from the pool — §6 gates 3 and 4',
    cmd: [npx, ['vitest', 'run', 'src/engine/fuzz.node.test.ts']],
    env: full ? { CRT_FUZZ_SEEDS: '500' } : undefined,
    slow: true,
  },
];

let failed = 0;
for (const gate of GATES) {
  if (gate.slow && !full) {
    console.log(`\n── ${gate.name} — at the DEFAULT seed count (pass --full for 500) ──`);
  } else {
    console.log(`\n── ${gate.name} ──`);
  }
  console.log(`   catches: ${gate.catches}`);
  const [cmd, args] = gate.cmd;
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(gate.env ?? {}) },
  });
  if (r.status !== 0) {
    failed++;
    console.error(`   FAILED: ${gate.name}`);
    // ⚠️ Keep going. A batch usually fails several gates for one reason, and
    // stopping at the first hides how much of the batch is actually wrong.
  }
}

console.log('\n────────────────────────────────────────────────────────────────');
if (failed === 0) {
  console.log(`all ${GATES.length} gates passed${full ? '' : ' (fuzz gate at the default seed count)'}`);
  if (!full) console.log('⚠️ Run with --full before landing: the 500-seed gate is the one that matters.');
  process.exit(0);
}
console.error(`${failed} of ${GATES.length} gates FAILED — nothing lands.`);
process.exit(1);
