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

const { spawn, spawnSync } = require('node:child_process');
const { mkdtempSync, openSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const root = join(__dirname, '..', '..');
const full = process.argv.includes('--full');
// D296: --full runs the 500-seed gate as W concurrent SHARDS (default 6 of this
// machine's 8 cores) and then one aggregate run that asserts the seed sets
// partition [0, 500) exactly and the canary floors hold over the union.
const shardsArg = process.argv.indexOf('--fuzz-shards');
const SHARDS = shardsArg >= 0 ? Number(process.argv[shardsArg + 1]) : 6;
if (!(SHARDS >= 1)) throw new Error('--fuzz-shards needs a positive count');
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
    sharded: true,
  },
];

/** The fuzz gate at --full: W shards concurrently, then the aggregate. Returns an exit status. */
async function runSharded(gate) {
  const dir = mkdtempSync(join(tmpdir(), 'crt-fuzz-'));
  const t0 = Date.now();
  console.log(`   ${SHARDS} shards of 500 seeds, concurrently (logs in ${dir})`);
  const [cmd, args] = gate.cmd;
  const codes = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) => {
      const log = openSync(join(dir, `shard-${i}.log`), 'w');
      return new Promise((resolve) => {
        const child = spawn(cmd, args, {
          cwd: root,
          stdio: ['ignore', log, log],
          shell: process.platform === 'win32',
          env: { ...process.env, ...(gate.env ?? {}), CRT_FUZZ_SHARD: `${i}/${SHARDS}`, CRT_FUZZ_OUT: join(dir, `shard-${i}.json`) },
        });
        child.on('exit', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
      });
    }),
  );
  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  for (let i = 0; i < SHARDS; i++) {
    const text = readFileSync(join(dir, `shard-${i}.log`), 'utf8');
    const line = text.split(/\r?\n/).find((l) => l.includes('fuzz: '));
    console.log(`   shard ${i}: ${codes[i] === 0 ? 'ok' : 'FAILED'}${line ? ' · ' + line.trim() : ''}`);
    if (codes[i] !== 0) console.error(text.split(/\r?\n/).slice(-40).join('\n'));
  }
  console.log(`   shards done in ${wall} s wall`);
  if (codes.some((c) => c !== 0)) return 1;
  console.log('   aggregate: the seed partition and the canary floors over the union');
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(gate.env ?? {}), CRT_FUZZ_AGGREGATE: dir },
  });
  return r.status ?? 1;
}

async function main() {
let failed = 0;
for (const gate of GATES) {
  if (gate.slow && !full) {
    console.log(`\n── ${gate.name} — at the DEFAULT seed count (pass --full for 500) ──`);
  } else {
    console.log(`\n── ${gate.name} ──`);
  }
  console.log(`   catches: ${gate.catches}`);
  const [cmd, args] = gate.cmd;
  const status =
    gate.sharded && full
      ? await runSharded(gate)
      : (spawnSync(cmd, args, {
          cwd: root,
          stdio: 'inherit',
          shell: process.platform === 'win32',
          env: { ...process.env, ...(gate.env ?? {}) },
        }).status ?? 1);
  if (status !== 0) {
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
}

main();
