#!/usr/bin/env node
'use strict';

// The bot tournament: level 1 against level 0, seeded, both ways round, with a
// confidence interval on the win rate.
//
// ⚠️ A LAUNCHER, NOT A BATTERY, and that is forced rather than chosen. Every
// other `scripts/battery-*.cjs` in this repo does its own work; this one cannot.
// The thing being measured is `src/bot/`'s policies playing against `src/net/`'s
// real host, both of which are TypeScript, and there is no TS runner in this
// project outside Vitest (no `tsx`, no `ts-node`, and Node's own type stripping
// cannot resolve the repo's extensionless imports — measured in M6.1). A `.cjs`
// that did the work itself would have to reimplement the policies in CommonJS,
// which is the "second heuristic beside the first" this project keeps refusing.
//
// So the logic lives in `src/bot/tournament.node.test.ts` and this is the
// discoverable command the M6 brief's §7 asks for by name. One home for the
// measurement, one place to run it.
//
//   node scripts/battery-bot.cjs                # 60 seed pairs = 120 games
//   node scripts/battery-bot.cjs --games 500    # the gate: 1,000 games
//   node scripts/battery-bot.cjs --quiet        # exit code only, no report

const { spawnSync } = require('node:child_process');

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const at = argv.indexOf(`--${name}`);
  if (at < 0) return fallback;
  return argv[at + 1] ?? fallback;
}

if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(
    'Usage: node scripts/battery-bot.cjs [--games N] [--quiet]\n\n' +
      '  --games N   seed PAIRS per matchup; each pair is two games, one from\n' +
      '              each side of the table. Default 60 (120 games).\n' +
      '  --quiet     suppress the report; the exit code is the whole answer.\n',
  );
  process.exit(0);
}

const games = flag('games', '60');
if (!/^\d+$/.test(String(games))) {
  process.stderr.write(`--games wants a whole number, got "${games}"\n`);
  process.exit(2);
}

process.stdout.write(
  `\n── Bot tournament ──\n  ${games} seed pairs = ${Number(games) * 2} games, ` +
    'level 1 vs level 0, alternating who goes first\n',
);

// ⚠️ `process.execPath` on vitest's own entry, NOT `npx`. Spawning `npx.cmd`
// without a shell fails with EINVAL on Windows under current Node, and spawning
// it WITH a shell means quoting arguments by hand. Resolving the module and
// running it with the Node that is already running is neither.
const { dirname, join } = require('node:path');
const vitestBin = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

const result = spawnSync(
  process.execPath,
  [vitestBin, 'run', 'src/bot/tournament.node.test.ts', '--disable-console-intercept'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CRT_BOT_GAMES: String(games),
      ...(argv.includes('--quiet') ? {} : { CRT_BOT_REPORT: '1' }),
    },
  },
);

if (result.error) {
  process.stderr.write(`could not run vitest: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
