/**
 * The packaging audit: what did we actually ship?
 *
 *   node scripts/audit-bundle.cjs           # audit release/
 *   node scripts/audit-bundle.cjs --json    # machine-readable summary
 *
 * ⚠️ THE FIRST ASSERTION IS A LEGAL ONE, not a hygiene one. Card art is Wizards
 * of the Coast's copyright: Scryfall hosts it and cannot sublicense it to us, so
 * each player's app fetches its own copy at runtime and NO image of a card may
 * appear anywhere under `release/`. Shipping a .exe containing that art is
 * redistribution — see docs/SCRYFALL.md §3. Everything else here is smaller.
 *
 * ⚠️ `build.files` is an allowlist, so in principle none of this can happen.
 * "In principle" is exactly the kind of claim a packaging audit exists to
 * replace with a measurement: an allowlist that gains one careless entry, an
 * `extraResources` block, or a dependency that vendors a fixture would all slip
 * through silently, and the artefact is 120 MB so nobody looks by eye.
 */

const fs = require('node:fs');
const path = require('node:path');


const ROOT = path.resolve(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const JSON_OUT = process.argv.includes('--json');

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (!JSON_OUT) {
    const mark = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`  ${mark}  ${name}${detail ? `  ${detail}` : ''}`);
  }
  return !!ok;
}

/** Every file under a directory, as paths relative to it. */
function walk(dir, base = dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/**
 * List an asar's contents.
 *
 * ⚠️ Through `@electron/asar`'s own API, which electron-builder already depends
 * on — not by parsing the header here. A hand-rolled reader that got the format
 * subtly wrong would report an empty archive, and an empty archive passes every
 * "must not contain" assertion below vacuously, which is the worst possible
 * failure mode for this file.
 *
 * ⚠️ And not through the CLI either. The first version shelled out to
 * `node_modules/.bin/asar.cmd` with `shell: true`, which on Windows splits
 * `H:\Claude Apps\…` at the space and dies with "'H:\Claude' is not recognized".
 * Every path in this workspace contains a space.
 */
function asarList(asarPath) {
  const { listPackage } = require('@electron/asar');
  return listPackage(asarPath, { isPack: false })
    .map((l) => String(l).replace(/^[/\\]/, '').split(/[\\/]/).join('/'))
    .filter(Boolean);
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?)$/i;

function main() {
  if (!fs.existsSync(RELEASE)) {
    console.error('release/ does not exist — run `npm run electron:build` first.');
    process.exit(1);
  }

  if (!JSON_OUT) console.log('\n── Installer artefacts ──');

  const releaseFiles = walk(RELEASE);
  const installers = releaseFiles.filter((f) => /^[^/]+\.exe$/.test(f));
  check('an NSIS installer was produced', installers.length > 0, installers.join(', '));

  const installer = installers[0] ? path.join(RELEASE, installers[0]) : null;
  if (installer) {
    const mb = fs.statSync(installer).size / 1024 / 1024;
    check('the installer is a plausible size (60–400 MB)', mb > 60 && mb < 400, `${mb.toFixed(1)} MB`);
  }

  // electron-updater needs this beside the installer to know what is current.
  check('latest.yml is present for electron-updater',
    releaseFiles.includes('latest.yml'),
    releaseFiles.filter((f) => f.endsWith('.yml')).join(', ') || 'none');

  const unpacked = path.join(RELEASE, 'win-unpacked');
  const asarPath = path.join(unpacked, 'resources', 'app.asar');
  check('app.asar exists in the unpacked build', fs.existsSync(asarPath), asarPath);
  if (!fs.existsSync(asarPath)) {
    report();
    return;
  }

  const inAsar = asarList(asarPath);
  // ⚠️ Guard against the vacuous pass. If `asar list` returned nothing, every
  // exclusion below would "pass" while proving nothing at all.
  check('app.asar listing is non-empty (the exclusions below mean something)',
    inAsar.length > 50, `${inAsar.length} entries`);

  if (!JSON_OUT) console.log('\n── ⚠️ Card art must not ship (Wizards\' copyright) ──');

  // Any image ANYWHERE under release/, not just in the asar. Art could equally
  // arrive through extraResources or a stray copy beside the exe.
  const releaseImages = releaseFiles.filter((f) => IMAGE_EXT.test(f));
  // The app icon is ours and is supposed to be there.
  const notOurIcon = releaseImages.filter((f) => !/(^|\/)(icon|installerHeader|uninstaller)\.(png|ico|bmp)$/i.test(f));
  check('no unexpected image files anywhere under release/',
    notOurIcon.length === 0,
    notOurIcon.length ? notOurIcon.slice(0, 8).join(', ') : `${releaseImages.length} icon file(s) only`);

  const asarImages = inAsar.filter((f) => IMAGE_EXT.test(f) && !/build\/icon\./i.test(f));
  check('no image files inside app.asar',
    asarImages.length === 0,
    asarImages.slice(0, 8).join(', ') || 'none');

  // A cached card is stored under a two-level shard of its Scryfall id. Even one
  // would mean the image cache leaked into the build.
  const shardLike = releaseFiles.filter((f) => /(^|\/)[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f-]{30,}\./i.test(f));
  check('no sharded card-image cache paths under release/',
    shardLike.length === 0, shardLike.slice(0, 5).join(', ') || 'none');

  if (!JSON_OUT) console.log('\n── ⚠️ relay/ must never reach app.asar (D59) ──');

  const relayEntries = inAsar.filter((f) => f === 'relay' || f.startsWith('relay/'));
  check('no relay/ inside app.asar', relayEntries.length === 0,
    relayEntries.slice(0, 5).join(', ') || 'none');
  check('no relay node_modules anywhere under release/',
    !releaseFiles.some((f) => f.includes('relay/node_modules')),
    'none');

  if (!JSON_OUT) console.log('\n── Development-only files must not ship ──');

  const EXCLUSIONS = [
    ['test files', (f) => /\.(test|bench)\.[cm]?[jt]sx?$/.test(f) || /\.node\.test\./.test(f)],
    ['src/net/testing/', (f) => f.startsWith('src/net/testing/') || f.includes('/net/testing/')],
    ['engine test harness', (f) => f.includes('engine/testing/')],
    ['engineCards fixtures', (f) => /fixtures\/engineCards\./.test(f)],
    ['the src/ tree itself', (f) => f.startsWith('src/')],
    ['scripts/', (f) => f.startsWith('scripts/')],
    ['docs/', (f) => f.startsWith('docs/')],
    ['TypeScript sources', (f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f)],
    ['tsconfig / vite config', (f) => /^(tsconfig.*\.json|vite\.config\.[jt]s)$/.test(f)],
  ];
  for (const [label, match] of EXCLUSIONS) {
    const hits = inAsar.filter(match);
    check(`no ${label} in app.asar`, hits.length === 0, hits.slice(0, 5).join(', ') || 'none');
  }

  // ⚠️ RENDERER PACKAGES MUST NOT SHIP, and "no node_modules at all" is the
  // wrong way to say it — electron-builder correctly bundles the main process's
  // production `dependencies`, which here are `electron-updater` and `ws` plus
  // their transitive closure.
  //
  // What was wrong, and what this check now catches: every renderer package was
  // listed under `dependencies`, so all of them shipped even though Vite had
  // already bundled them into `dist/assets/index-*.js`. 6,689 of the archive's
  // 6,760 entries were node_modules — lucide-react alone was 4,056 files — plus
  // two native binaries (`@tailwindcss/oxide-win32-x64-msvc`,
  // `lightningcss-win32-x64-msvc`) that exist only to build CSS. Moving them to
  // `devDependencies` changed nothing about how the app runs and took the
  // installer from 118.0 MB to 103.2 MB.
  const RENDERER_ONLY = [
    'react', 'react-dom', 'motion', 'framer-motion', 'motion-dom', 'zustand',
    'lucide-react', 'tailwindcss', '@tailwindcss', 'mana-font',
    '@fontsource', '@fontsource-variable', 'lightningcss', 'jiti',
    'enhanced-resolve', 'scheduler',
  ];
  const shippedRenderer = RENDERER_ONLY.filter((p) =>
    inAsar.some((f) => f === `node_modules/${p}` || f.startsWith(`node_modules/${p}/`)),
  );
  check('no renderer-only package ships inside app.asar (Vite already bundled them)',
    shippedRenderer.length === 0, shippedRenderer.join(', ') || 'none');

  // The positive form of the same statement, so the archive cannot quietly
  // regrow a dependency tree nobody looked at.
  const topLevel = new Set();
  for (const f of inAsar) {
    const m = /^node_modules\/(@[^/]+\/[^/]+|[^/]+)/.exec(f);
    if (m?.[1]) topLevel.add(m[1]);
  }
  check('app.asar ships a small, main-process-only dependency tree',
    topLevel.size <= 25, `${topLevel.size} packages: ${[...topLevel].sort().join(', ')}`);
  check('…and it contains the two packages the main process really needs',
    topLevel.has('electron-updater') && topLevel.has('ws'),
    [...topLevel].filter((p) => p === 'ws' || p === 'electron-updater').join(', '));

  if (!JSON_OUT) console.log('\n── What SHOULD be there ──');

  // ⚠️ The other half, and it keeps the exclusions honest. An empty or truncated
  // asar would satisfy every "must not contain" check above; these are what say
  // the app is actually in there.
  for (const [label, match] of [
    ['the built renderer (dist/index.html)', (f) => f === 'dist/index.html'],
    ['the renderer bundle', (f) => /^dist\/assets\/.*\.js$/.test(f)],
    ['the main process', (f) => f === 'electron/main.cjs'],
    ['the preload bridge', (f) => f === 'electron/preload.cjs'],
    ['the card-database worker', (f) => f === 'electron/cardsvc-worker.cjs'],
    ['the LAN listener', (f) => f === 'electron/lanServer.cjs'],
    ['package.json', (f) => f === 'package.json'],
  ]) {
    const hits = inAsar.filter(match);
    check(`app.asar contains ${label}`, hits.length > 0, hits[0] ?? 'MISSING');
  }

  if (!JSON_OUT) console.log('\n── Installer configuration ──');

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('NSIS creates a desktop shortcut by default', pkg.build?.nsis?.createDesktopShortcut === true,
    String(pkg.build?.nsis?.createDesktopShortcut));
  check('the shortcut has a real name', typeof pkg.build?.nsis?.shortcutName === 'string' && pkg.build.nsis.shortcutName.length > 0,
    pkg.build?.nsis?.shortcutName ?? 'unset');
  check('the app icon is configured and present',
    pkg.build?.win?.icon === 'build/icon.ico' && fs.existsSync(path.join(ROOT, 'build', 'icon.ico')));
  check('the installer lets the user choose a directory', pkg.build?.nsis?.allowToChangeInstallationDirectory === true);

  // ⚠️ electron-updater reads app-update.yml from resources/, not package.json.
  // A publish block that never made it into the packaged file is an updater that
  // silently never checks — which looks identical to one that is up to date.
  const updateYml = path.join(unpacked, 'resources', 'app-update.yml');
  const yml = fs.existsSync(updateYml) ? fs.readFileSync(updateYml, 'utf8') : '';
  const owner = /^\s*owner:\s*(.+?)\s*$/m.exec(yml)?.[1]?.replace(/^['"]|['"]$/g, '') ?? '';
  check('app-update.yml shipped in resources/', yml.length > 0, updateYml);
  check('the update feed owner is a real account, not the OWNER placeholder',
    owner !== '' && owner !== 'OWNER', owner || 'missing');
  check('the update feed points at GitHub', /provider:\s*github/.test(yml), owner ? `${owner}/${/repo:\s*(.+)/.exec(yml)?.[1] ?? '?'}` : '');

  report();
}

function report() {
  const failed = results.filter((r) => !r.ok);
  if (JSON_OUT) {
    console.log(JSON.stringify({ passed: results.length - failed.length, total: results.length, results }, null, 2));
  } else {
    console.log(`\n${'─'.repeat(64)}`);
    console.log(`${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      console.log('\nFailures:');
      for (const f of failed) console.log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
    }
  }
  process.exit(failed.length ? 1 : 0);
}

main();
