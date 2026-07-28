/**
 * Headless Electron verification probe.
 *
 *   npx electron scripts/probe.cjs            # production posture (file://, prod CSP)
 *   npx electron scripts/probe.cjs --dev-csp  # dev CSP, for comparison
 *
 * Why this and not the preview MCP: preview_start does not work with the
 * Electron apps in this workspace ("system cannot find the path specified").
 * The proven approach is a hidden BrowserWindow loading the BUILT dist/ with the
 * real security posture installed, then executeJavaScript assertions.
 *
 * ⚠️ Requires `npm run build` first — it deliberately tests dist/, not the dev
 * server, because the things most likely to break in packaging (base: './',
 * the prod CSP, the privileged protocol) only exist there.
 *
 * ⚠️ Runs against a THROWAWAY data root (CRT_DATA_DIR under the OS temp dir) so
 * a probe can never scribble on the user's real profile, decks or card cache.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Must be set before paths.cjs is required by anything.
const PROBE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-probe-'));
process.env.CRT_DATA_DIR = PROBE_ROOT;

const { app, BrowserWindow } = require('electron');
const paths = require('./../electron/paths.cjs');
paths.installAppPaths(app);

// Must happen before app.whenReady(), exactly as main.cjs does it.
const cardimg = require('./../electron/cardimg.cjs');
cardimg.registerScheme();

const capability = require('./../electron/capability.cjs');
const { registerIpc } = require('./../electron/ipc.cjs');
const { installSecurity, guardContents } = require('./../electron/window.cjs');

const DEV_CSP = process.argv.includes('--dev-csp');
const INDEX = path.join(__dirname, '..', 'dist', 'index.html');

// ── tiny assertion harness ────────────────────────────────────────
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  const mark = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${mark}  ${name}${detail ? `  ${detail}` : ''}`);
}
function check(name, ok, detail) { record(name, ok, detail); }
function eq(name, actual, expected) {
  record(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}`);
}

/** Minimal valid RGBA PNG of the given size, for cache fixtures. */
function makeTestPng(w, h) {
  const zlib = require('zlib');
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h); // all-zero pixels; size is what matters
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 1 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  if (!fs.existsSync(INDEX)) {
    console.error(`dist/index.html is missing — run \`npm run build\` first.`);
    app.exit(1);
    return;
  }

  capability.init();
  installSecurity({ isDev: DEV_CSP });
  const imageMisses = [];
  cardimg.installHandler({ onMiss: (tier, id) => imageMisses.push(`${tier}/${id}`) });
  // The real IPC surface, not a reimplementation of it.
  registerIpc({ app, isDev: DEV_CSP });

  const win = new BrowserWindow({
    show: false,
    width: 1500,
    height: 950,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
    },
  });
  guardContents(win.webContents, DEV_CSP);

  const cspViolations = [];
  win.webContents.on('console-message', (event) => {
    const text = typeof event === 'string' ? event : (event?.message ?? '');
    if (/Content Security Policy/i.test(text)) cspViolations.push(text);
  });

  await win.loadFile(INDEX);
  // One paint + React mount.
  await new Promise((r) => setTimeout(r, 700));

  const js = (src) => win.webContents.executeJavaScript(src, true);

  console.log(`\n── Shell (${DEV_CSP ? 'dev' : 'production'} CSP, dist/) ──`);

  eq('document.title', await js('document.title'), "Commander's Roundtable");
  check('preload bridge window.crt exists', await js('!!window.crt'));
  check('bridge exposes no raw ipcRenderer', await js('!window.crt.ipcRenderer && !window.require'));
  check('#root has rendered content', await js('document.getElementById("root").childElementCount > 0'));
  check(
    'app name rendered in the header',
    await js(`document.body.innerText.includes("Commander's Roundtable")`),
  );

  console.log('\n── Content Security Policy ──');

  // Snapshot BEFORE the deliberate-violation tests below, or our own probes
  // trip this check. What we care about is that loading the app cleanly
  // produces no violations of its own.
  check('app loads with no CSP violations of its own', cspViolations.length === 0,
    cspViolations.length ? `\n      ${cspViolations.slice(0, 3).join('\n      ')}` : '');

  // eval must be dead in BOTH modes (no 'unsafe-eval' anywhere, by design).
  eq(
    "eval() is blocked (no 'unsafe-eval')",
    await js(`(() => { try { eval('1+1'); return 'ALLOWED'; } catch (e) { return 'blocked'; } })()`),
    'blocked',
  );
  eq(
    'new Function() is blocked',
    await js(`(() => { try { new Function('return 1')(); return 'ALLOWED'; } catch (e) { return 'blocked'; } })()`),
    'blocked',
  );
  // connect-src: 'self' PLUS the multiplayer origins the user configured, and
  // NOTHING else. Everything that is not a game socket still happens in main
  // behind a host allowlist. See D48 and electron/netallow.cjs.
  eq(
    'renderer cannot fetch an external origin',
    await js(`fetch('https://example.com/').then(() => 'ALLOWED', () => 'blocked')`),
    'blocked',
  );
  // ⚠️ Including the one host the renderer has a text box for. Importing a deck
  // by link is a MAIN-process download (D92); if this ever reads "ALLOWED", the
  // renderer has grown its own way onto the internet.
  eq(
    'renderer cannot fetch the deck site itself, link box or no link box',
    await js(`fetch('https://tappedout.net/mtg-decks/x/').then(() => 'ALLOWED', () => 'blocked')`),
    'blocked',
  );
  // CSP blocks a WebSocket ASYNCHRONOUSLY — the constructor does not throw, so
  // testing for a throw reports "allowed" on a connection that is in fact
  // refused. Watch for the securitypolicyviolation event instead, which also
  // distinguishes "CSP refused it" from "the host simply wasn't reachable".
  const wsProbe = (url) => js(`new Promise((resolve) => {
      const onViolation = (e) => {
        if (e.violatedDirective.startsWith('connect-src')) {
          document.removeEventListener('securitypolicyviolation', onViolation);
          resolve('blocked');
        }
      };
      document.addEventListener('securitypolicyviolation', onViolation);
      try { new WebSocket(${JSON.stringify(url)}); } catch { resolve('blocked'); }
      setTimeout(() => resolve('reached-network'), 600);
    })`);

  eq(
    'renderer cannot open a WebSocket to an origin the user never configured',
    await wsProbe('wss://example.com/'),
    'blocked',
  );

  // ⚠️ THE OTHER HALF OF THE ASSERTION, and the one that keeps it honest. A CSP
  // that blocked EVERYTHING would pass the check above while making multiplayer
  // impossible — so the widening has to be shown to have actually happened. The
  // LAN loopback origin is always in the allowlist (netallow.cjs), and nothing
  // is listening on it here, so "reached-network" is the correct answer.
  eq(
    'the LAN origin IS reachable — connect-src was widened, not just tightened',
    await wsProbe('ws://127.0.0.1:5282/'),
    'reached-network',
  );

  // The allowlist itself: exact origins, never a bare scheme.
  const origins = await js('window.crt.net.allowedOrigins()');
  check(
    'the connect-src allowlist holds exact origins, never a scheme wildcard',
    Array.isArray(origins) &&
      origins.length > 0 &&
      origins.every((o) => /^wss?:\/\/[^/]+$/.test(o)),
    JSON.stringify(origins),
  );
  eq(
    'a plaintext ws:// origin on the public internet is refused by the gate',
    (await js(`window.crt.net.allowOrigin('ws://example.com:5281')`)).ok,
    false,
  );
  eq(
    'an https:// address is refused — a game address is a WebSocket',
    (await js(`window.crt.net.allowOrigin('https://relay.example.com')`)).ok,
    false,
  );

  console.log('\n── LAN listener (bound only while a game runs) ──');

  eq('nothing is listening on the network at rest', (await js('window.crt.lan.status()')).running, false);
  const lan = await js(`window.crt.lan.start('')`);
  check('a LAN game binds the local network and reports an address',
    lan.running === true && lan.port > 0 && lan.token.length >= 32,
    `port=${lan.port} addresses=${(lan.addresses || []).length}`);
  // ⚠️ A LAN code is read aloud exactly like a relay code, so it has to BE one:
  // six characters, no I/O/0/1. A literal `LANGAME` failed the join form's own
  // validation, which is how this was found.
  check('the LAN room code is a real six-character code',
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(lan.code || ''), lan.code);
  await js('window.crt.lan.stop()');
  eq('stopping the game closes the listener', (await js('window.crt.lan.status()')).running, false);

  console.log('\n── Data root (MSIX-safe location) ──');

  const info = await js('window.crt.app.info()');
  eq('dataRoot honours CRT_DATA_DIR', info.dataRoot, PROBE_ROOT);
  check('userData is the data root, not %APPDATA%',
    path.resolve(app.getPath('userData')) === path.resolve(PROBE_ROOT),
    app.getPath('userData'));
  // The probe runs under a temp CRT_DATA_DIR, so assert on the real DEFAULT —
  // that is the value that has to stay clear of the MSIX-virtualized dirs.
  const realDefault = paths.defaultDataRoot();
  check('default data root avoids %LOCALAPPDATA%/%APPDATA% (MSIX virtualization)',
    !/AppData[\\/](Local|Roaming)/i.test(realDefault), realDefault);
  check('default data root is a profile-root dotfolder',
    path.basename(realDefault) === '.commanders-roundtable'
      && path.dirname(realDefault) === os.homedir(),
    realDefault);
  for (const dir of ['cards', 'images', 'decks', 'games', 'logs', 'downloads']) {
    check(`data dir created: ${dir}`, fs.existsSync(path.join(PROBE_ROOT, dir)));
  }

  console.log('\n── Settings ──');

  const defaults = await js('window.crt.settings.defaults()');
  eq('default imageTier is the max-fidelity tier', defaults.imageTier, 'png');
  eq('default relayUrl is empty (LAN-first)', defaults.relayUrl, '');

  const wrote = await js(`window.crt.settings.set({ playerName: 'Probe', animationSpeed: 'fast' })`);
  eq('settings round-trip: playerName', wrote.playerName, 'Probe');
  eq('settings round-trip: animationSpeed', wrote.animationSpeed, 'fast');

  const withJunk = await js(`window.crt.settings.set({ nope: 1, __proto__: { polluted: true } })`);
  check('unknown keys are dropped', !('nope' in withJunk));
  check('prototype pollution attempt dropped', !('polluted' in withJunk) && !({}).polluted);
  eq('bad enum value falls back to default',
    (await js(`window.crt.settings.set({ animationSpeed: 'turbo' })`)).animationSpeed, 'cinematic');

  const settingsFile = path.join(PROBE_ROOT, 'settings.json');
  const raw = fs.readFileSync(settingsFile);
  eq('settings.json has NO BOM (first byte is "{")', raw[0], 0x7b);
  check('settings.json parses', (() => {
    try { JSON.parse(raw.toString('utf8')); return true; } catch { return false; }
  })());
  check('no .tmp left behind by the atomic write', !fs.existsSync(`${settingsFile}.tmp`));

  console.log('\n── cardimg:// protocol ──');

  // Plant a real 745×1040 PNG (Scryfall's `png` tier dimensions) in the cache,
  // then prove the renderer can load it and cannot escape the cache directory.
  const FIXTURE_ID = '0000579f-7b35-4ed3-b44c-db2a538066fe';
  const fixturePath = cardimg.cachePathFor('png', FIXTURE_ID);
  fs.writeFileSync(fixturePath, makeTestPng(745, 1040));
  check('cache path is sharded by id prefix',
    fixturePath.includes(`${path.sep}00${path.sep}00${path.sep}`), fixturePath);

  const loadImg = (url) => js(`new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth + 'x' + img.naturalHeight);
    img.onerror = () => resolve('error');
    img.src = ${JSON.stringify(url)};
    setTimeout(() => resolve('timeout'), 4000);
  })`);

  eq('cached image loads at full resolution',
    await loadImg(`cardimg://card/png/${FIXTURE_ID}`), '745x1040');
  eq('an uncached id yields an error, not a hang (404 → SyntheticFace)',
    await loadImg(`cardimg://card/png/ffffffff-ffff-ffff-ffff-ffffffffffff`), 'error');
  check('a miss is reported to the download queue',
    imageMisses.includes('png/ffffffff-ffff-ffff-ffff-ffffffffffff'), JSON.stringify(imageMisses));

  // Traversal / malformed-request battery. Every one of these must fail.
  for (const [label, url] of [
    ['plain traversal', 'cardimg://card/png/../../../settings.json'],
    ['encoded traversal', 'cardimg://card/png/..%2f..%2fsettings.json'],
    ['absolute path', 'cardimg://card/png/C:%5CWindows%5Csystem.ini'],
    ['unknown tier', `cardimg://card/original/${FIXTURE_ID}`],
    ['tier with traversal', `cardimg://card/..%2f..%2f/${FIXTURE_ID}`],
    ['non-uuid id', 'cardimg://card/png/not-a-uuid'],
    ['extra path segment', `cardimg://card/png/${FIXTURE_ID}/extra`],
    ['unknown host', `cardimg://settings/png/${FIXTURE_ID}`],
    ['bad face index', `cardimg://card/png/${FIXTURE_ID}-9`],
  ]) {
    eq(`refused: ${label}`, await loadImg(url), 'error');
  }

  // The protocol must also work under the PRODUCTION CSP from a file:// page —
  // that combination (privileged scheme + `img-src … cardimg:`) is the thing
  // most likely to break only in the packaged build.
  check('protocol works under the CSP in force (img-src includes cardimg:)',
    (await loadImg(`cardimg://card/png/${FIXTURE_ID}`)) === '745x1040');

  console.log('\n── CSP canary (measured by bundled app code) ──');

  // ⚠️ The probe must NOT call eval() itself to test this: anything the debugger
  // evaluates bypasses page CSP, so a self-test reports "allowed" even when the
  // real CSP forbids it. src/devHandles.ts measures it from inside the bundle.
  // (Only exposed in dev builds, so this is informational under a prod bundle.)
  const canary = await js('window.__crt && window.__crt.csp ? JSON.stringify(window.__crt.csp) : null');
  if (canary) {
    const c = JSON.parse(canary);
    check('app-measured: eval blocked', c.evalBlocked === true);
    check('app-measured: Function() blocked', c.functionCtorBlocked === true);
  } else {
    console.log('  ----  canary absent (production bundle strips dev handles) — expected');
  }

  console.log('\n── M2 · Fonts, theme tokens, motion under the real CSP ──');

  // Everything in this section is measured through standard DOM APIs rather than
  // through window.__crt, because dev handles are stripped from a production
  // bundle (exposeDevHandles early-returns on !import.meta.env.DEV) and this
  // probe deliberately tests dist/. Nothing here is CSP-sensitive, so evaluating
  // it from the debugger is honest — unlike the eval() canary above.

  const cspBeforeTokens = cspViolations.length;
  await js(`(async () => {
    window.location.hash = 'tokens';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await document.fonts.ready;
  })()`);
  await new Promise((r) => setTimeout(r, 400));

  eq('the #tokens gallery is the mounted screen',
    await js(`!!document.querySelector('[data-screen-slot="tokens"]')`), true);

  // ⚠️ A missing font does NOT throw, warn, or log. It renders in the fallback
  // (Georgia) and looks deliberate. `false` on any row below means every card
  // name in the app is silently the wrong typeface. Checked at 700 as well as
  // 400 because a variable face has to cover the whole weight axis, not one end.
  const FAMILIES = [
    'Alegreya Variable', 'Alegreya SC', 'Inter Variable',
    'Crimson Pro Variable', 'JetBrains Mono Variable',
  ];
  for (const fam of FAMILIES) {
    const both = await js(
      `JSON.stringify([document.fonts.check('400 16px "${fam}"'), document.fonts.check('700 16px "${fam}"')])`,
    );
    const [at400, at700] = JSON.parse(both);
    check(`font loaded: ${fam} (400 + 700)`, at400 === true && at700 === true,
      `400=${at400} 700=${at700}`);
  }

  // The 111-utility canary. An unlayered universal reset outranks
  // @layer utilities and zeroes every spacing utility at once; it zeroed 111 of
  // them across two sibling apps in this workspace and produced no diagnostic
  // of any kind.
  const ladder = JSON.parse(await js(`JSON.stringify(
    [1,2,3,4,5,6,7,8].map((n) => {
      const el = document.querySelector('[data-probe="p' + n + '"]');
      return el ? getComputedStyle(el).paddingTop : null;
    })
  )`));
  eq('p-4 computes to 16px', ladder[3], '16px');
  check('the p-1…p-8 ladder has 8 DISTINCT values (no reset zeroed them)',
    new Set(ladder).size === 8 && !ladder.includes('0px') && !ladder.includes(null),
    JSON.stringify(ladder));

  // D12 regression guard: `@theme static` must emit every token, including the
  // five reached only by interpolation (identityToken() builds
  // `var(--color-mtg-${letter})`). An undefined var inside color-mix() makes the
  // browser discard the WHOLE declaration — cards lost background AND box-shadow,
  // with no error and no warning, and only for single-colour cards.
  const tokens = JSON.parse(await js(`JSON.stringify((() => {
    const cs = getComputedStyle(document.documentElement);
    const names = ['mtg-w','mtg-u','mtg-b','mtg-r','mtg-g','mtg-c','mtg-m',
      'crt-void','crt-table','crt-surface','crt-raised','crt-inset','crt-border',
      'crt-text','crt-dim','crt-faint','crt-accent','crt-accent-hi','crt-accent-lo',
      'crt-on-accent','crt-ok','crt-warn','crt-danger','crt-cmd'];
    const out = {};
    for (const n of names) out[n] = cs.getPropertyValue('--color-' + n).trim();
    return out;
  })())`));
  const emptyTokens = Object.entries(tokens).filter(([, v]) => !v).map(([k]) => k);
  check('@theme static emitted every colour token (D12)', emptyTokens.length === 0,
    emptyTokens.length ? `missing: ${emptyTokens.join(', ')}` : `${Object.keys(tokens).length} tokens`);

  // The five colours must be lightness-matched, or one of them dominates the
  // table and the "tasteful, not garish" lever is gone. Parse the L out of oklch().
  // ⚠️ Chromium serializes oklch() lightness as a PERCENTAGE — the authored
  // `oklch(0.930 0.045 92)` reads back as `oklch(93% 0.045 92)`. Parsing the bare
  // number gave 93 instead of 0.93 and failed a threshold expressed in 0–1.
  const lightness = ['mtg-w', 'mtg-u', 'mtg-b', 'mtg-r', 'mtg-g'].map((k) => {
    const m = /oklch\(\s*([\d.]+)(%?)/.exec(tokens[k]);
    if (!m) return NaN;
    return m[2] === '%' ? Number(m[1]) / 100 : Number(m[1]);
  });
  check('the five colours stay within a 0.5 lightness band',
    lightness.every(Number.isFinite) && Math.max(...lightness) - Math.min(...lightness) <= 0.5,
    JSON.stringify(lightness));

  // Motion mounts real elements and can inject a <style>. Under a CSP without
  // 'unsafe-inline' in style-src that injection is blocked and animations
  // silently stop; this is the check that would catch it.
  check('a motion.div is mounted', await js(`!!document.querySelector('[data-probe="motion-div"]')`));
  const newCsp = cspViolations.slice(cspBeforeTokens)
    .filter((t) => !/connect-src/i.test(t));
  check('motion mounts under the production CSP with zero CSP entries',
    newCsp.length === 0,
    newCsp.length ? `\n      ${newCsp.slice(0, 3).join('\n      ')}` : '');

  console.log('\n── M5 · Settings and About screens (production CSP) ──');

  // ⚠️ Asserted against dist/ under the PRODUCTION posture, because that is the
  // build where these two screens carry an obligation rather than a convenience:
  // the About screen discharges docs/SCRYFALL.md §4, and a bundle that dropped
  // the notice would look completely normal in dev.

  const gotoScreen = async (id) => {
    await js(`(async () => {
      window.location.hash = ${JSON.stringify(id)};
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    })()`);
    await new Promise((r) => setTimeout(r, 250));
  };

  const cspBeforeM5 = cspViolations.length;

  await gotoScreen('settings');
  check('the Settings screen mounts', await js(`!!document.querySelector('[data-screen="settings"]')`));
  for (const key of ['playerName', 'animationSpeed', 'autoTapMana', 'imageTier', 'prefetchArtOnImport', 'relayUrl']) {
    check(`Settings exposes a control for ${key}`,
      await js(`!!document.querySelector('[data-setting="${key}"]')`));
  }
  // Every settings key in the main-process SPEC must be reachable from the UI,
  // or it is a setting only a text editor can change. `allowedOrigins` is the
  // deliberate exception — it is the CSP allowlist, shown read-only and grown
  // only by saving a relay address (D48), never typed in freehand.
  const spec = Object.keys(require('./../electron/settings.cjs').SPEC);
  const missing = [];
  for (const key of spec) {
    if (key === 'allowedOrigins') continue;
    if (!(await js(`!!document.querySelector('[data-setting="${key}"]')`))) missing.push(key);
  }
  check('every settings key in the schema has a control', missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : `${spec.length - 1} keys`);
  check('the connect-src allowlist is shown to the user',
    (await js(`document.querySelectorAll('[data-origin]').length`)) > 0);
  check('the data root is shown on the Settings screen',
    await js(`!!document.querySelector('[data-setting="dataRoot"]')`));

  // The settings screen WRITES through the same bridge the probe just tested,
  // so driving a real control proves the whole path rather than the render.
  await js(`(() => {
    const el = document.querySelector('[data-setting="animationSpeed"]');
    el.value = 'brisk';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise((r) => setTimeout(r, 300));
  eq('changing a control on the screen persists through the bridge',
    (await js('window.crt.settings.get()')).animationSpeed, 'brisk');

  await gotoScreen('about');
  check('the About screen mounts', await js(`!!document.querySelector('[data-screen="about"]')`));

  // ⚠️ The two obligation strings, asserted as TEXT rather than as an element.
  // An element with the right data attribute and empty content would pass a
  // presence check and discharge nothing.
  const aboutText = await js('document.body.innerText');
  check('About carries the Scryfall attribution (docs/SCRYFALL.md §4)',
    aboutText.includes('provided by Scryfall')
      && aboutText.includes('not produced by, endorsed by, supported by, or affiliated with Scryfall'));
  check('About carries the Wizards Fan Content notice (docs/SCRYFALL.md §4)',
    aboutText.includes('unofficial Fan Content permitted under the Fan Content Policy')
      && aboutText.includes('©Wizards of the Coast LLC'));
  check('About states that card pictures never ship in the installer',
    /never included in this app(?:’|')s\s+installer/.test(aboutText), '');
  // ⚠️ A COUNT, deliberately. A new outbound connection has to be approved and
  // then said on this screen; making the check "at least the ones I know about"
  // would let the fifth one ship unlisted. Deck import by link is the fifth (D92).
  check('About lists the five approved connections and no more',
    (await js(`document.querySelectorAll('[data-screen="about"] tbody tr').length`)) === 5);
  check('About names every deck site the link box can reach',
    /moxfield\.com/.test(aboutText) && /archidekt\.com/.test(aboutText)
      && /tappedout\.net/.test(aboutText));
  check('About says there is no telemetry',
    /no analytics, tracking or telemetry/i.test(aboutText));

  const m5Csp = cspViolations.slice(cspBeforeM5).filter((t) => !/connect-src/i.test(t));
  check('Settings and About render with zero CSP violations', m5Csp.length === 0,
    m5Csp.length ? `\n      ${m5Csp.slice(0, 3).join('\n      ')}` : '');

  console.log('\n── Card-database worker (supervisor) ──');

  // The worker is forked lazily by the first request, so an idle launch does not
  // start a process that may have nothing to do.
  const cardsvc = require('./../electron/cardsvc.cjs');
  check('worker is not started before the first request', cardsvc.getPid() === null,
    `state=${cardsvc.state}`);

  const dbStatus = await js('window.crt.cardDb.status()');
  check('status reachable through the bridge', typeof dbStatus?.state === 'string',
    JSON.stringify({ state: dbStatus?.state, worker: dbStatus?.worker }));
  // Probe runs on a throwaway data root, so there is no cached database.
  eq('reports absent on a fresh data root', dbStatus.state, 'absent');
  eq('worker came up', dbStatus.worker, 'ready');
  check('worker has a pid now', Number.isInteger(cardsvc.getPid()), String(cardsvc.getPid()));

  eq('cancel with nothing running is a no-op, not an error',
    (await js('window.crt.cardDb.cancel()')).cancelled, false);

  // ── crash recovery ──
  // Killing the worker must not wedge the app: the next request restarts it.
  const victimPid = cardsvc.getPid();
  const { execFileSync } = require('child_process');
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(victimPid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(victimPid, 'SIGKILL');
    }
  } catch { /* already gone */ }
  await new Promise((r) => setTimeout(r, 900));

  check('supervisor noticed the crash', cardsvc.state === 'crashed', `state=${cardsvc.state}`);

  const afterCrash = await js('window.crt.cardDb.status()');
  eq('a request after a crash recovers the worker', afterCrash.worker, 'ready');
  check('it is a NEW worker process', cardsvc.getPid() !== victimPid,
    `${victimPid} → ${cardsvc.getPid()}`);
  check('the restart was counted', afterCrash.restarts >= 1, String(afterCrash.restarts));
  eq('on-disk state is unchanged by a crash', afterCrash.state, 'absent');

  // ── queries with NO database ──
  // A fresh install must fail with a clear, actionable error rather than hanging
  // or returning empty results that look like "this card doesn't exist".
  const noDbError = await js(`window.crt.cardDb.byName({ name: 'Sol Ring' })
    .then(() => 'RESOLVED', (e) => String(e.message))`);
  check('a query with no database rejects rather than hanging',
    noDbError !== 'RESOLVED', noDbError);
  check('…and the message tells the user what to do',
    /download/i.test(noDbError), noDbError);

  const tail = await js('window.crt.cardDb.logTail()');
  check('supervisor keeps a log tail', typeof tail === 'string' && tail.includes('state'),
    `${String(tail).split('\n').length} lines`);

  console.log('\n── Window state ──');

  const winstate = require('./../electron/winstate.cjs');
  const { writeJsonAtomic } = require('./../electron/jsonstore.cjs');
  const windowFile = paths.files.window();
  const primary = require('electron').screen.getPrimaryDisplay().workArea;

  // A rect on a monitor that no longer exists must NOT be restored, or the
  // window opens off-screen and the app looks like it failed to launch.
  writeJsonAtomic(windowFile, { x: -9000, y: -9000, width: 1400, height: 900, maximized: false });
  const offscreen = winstate.load();
  check('off-screen saved position is discarded', offscreen.x === undefined && offscreen.y === undefined,
    JSON.stringify(offscreen));
  eq('…but the saved size is kept', offscreen.width, 1400);

  // A rect on the real primary display must be restored verbatim.
  const good = { x: primary.x + 60, y: primary.y + 60, width: 1300, height: 860, maximized: false };
  writeJsonAtomic(windowFile, good);
  const restored = winstate.load();
  eq('on-screen position is restored (x)', restored.x, good.x);
  eq('on-screen position is restored (y)', restored.y, good.y);
  eq('maximized flag round-trips', restored.maximized, false);

  // Undersized/garbage bounds must be clamped to the app's minimums, not passed
  // through — a 20×20 window is unusable and unrecoverable by the user.
  writeJsonAtomic(windowFile, { x: null, y: null, width: 20, height: 20, maximized: false });
  const clamped = winstate.load();
  check('undersized bounds are clamped to the minimum',
    clamped.width >= 1100 && clamped.height >= 720, JSON.stringify(clamped));

  writeJsonAtomic(windowFile, { garbage: true });
  const fallback = winstate.load();
  eq('unreadable window.json falls back to the default width', fallback.width, 1500);

  console.log('\n── Capability gate (main-process unit checks) ──');

  const outside = path.join(os.tmpdir(), 'crt-probe-outsider.txt');
  check('un-authorized path is not readable', !capability.canReadPath(outside));
  check('un-authorized path is not writable', !capability.canWritePath(outside));
  check('data root IS writable', capability.canWritePath(path.join(PROBE_ROOT, 'decks', 'a.json')));
  check('traversal out of the data root is refused',
    !capability.canWritePath(path.join(PROBE_ROOT, 'decks', '..', '..', 'escaped.json')));

  // The sibling-prefix escape: "<root>-evil" must NOT count as inside "<root>".
  check('sibling-prefix escape is refused (startsWith would pass this)',
    !capability.canWritePath(`${PROBE_ROOT}-evil${path.sep}x.json`));

  check('resolveInsideDir strips path structure',
    capability.resolveInsideDir(path.join(PROBE_ROOT, 'decks'), '../../../etc/passwd')
      === path.join(PROBE_ROOT, 'decks', 'passwd'));
  check('resolveInsideDir rejects ".."', capability.resolveInsideDir(PROBE_ROOT, '..') === null);
  check('resolveInsideDir rejects an empty name', capability.resolveInsideDir(PROBE_ROOT, '') === null);
  check('NUL byte in a path is refused', !capability.canReadPath(`${PROBE_ROOT}\0.json`));

  console.log('\n── Deck import by link (through the real bridge) ──');

  // No network needed: a host that is not on the allowlist, and a path that is
  // not a deck, are both refused before a socket is opened — which is what makes
  // these safe to run offline.
  const wrongSite = await js(`window.crt.decks.fetchUrl('https://deckstats.net/decks/12345/')`);
  check('the link channel exists on the bridge', !!wrongSite && typeof wrongSite === 'object');
  eq('a deck site we do not import from is refused', wrongSite?.code, 'hostNotAllowed');
  check('…and the refusal names the three sites that do work',
    ['TappedOut', 'Moxfield', 'Archidekt'].every((s) => (wrongSite?.message ?? '').includes(s)),
    wrongSite?.message);
  for (const [site, link] of [
    ['TappedOut', 'https://tappedout.net/users/somebody/'],
    ['Moxfield', 'https://www.moxfield.com/users/somebody'],
    ['Archidekt', 'https://archidekt.com/decks/not-a-number/x'],
  ]) {
    eq(`${site}: a link that is not a deck is refused`,
      (await js(`window.crt.decks.fetchUrl(${JSON.stringify(link)})`))?.code, 'notADeckUrl');
  }
  eq('an empty box is refused without a request',
    (await js(`window.crt.decks.fetchUrl('')`))?.code, 'empty');

  console.log('\n── Navigation guard ──');

  // Assert the OUTCOME (we're still on our page), plus that the guard actually
  // saw the attempt. Racing did-start-navigation against a preventDefault is
  // flaky and proves nothing either way.
  const urlBefore = await js('location.href');
  const attempts = [];
  const observer = (_e, url) => attempts.push(url);
  win.webContents.on('will-navigate', observer);
  await js(`try { location.href = 'https://example.com/'; } catch (e) {}`).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  win.webContents.off('will-navigate', observer);

  check('will-navigate saw the external attempt',
    attempts.some((u) => u.includes('example.com')), JSON.stringify(attempts));
  eq('navigation was blocked — still on our own page', await js('location.href'), urlBefore);
  eq('still a file:// document', await js('location.protocol'), 'file:');

  // ── report ──
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  }

  win.destroy();
  try { fs.rmSync(PROBE_ROOT, { recursive: true, force: true }); } catch { /* leave it */ }
  app.exit(failed.length ? 1 : 0);
}

app.whenReady().then(() =>
  main().catch((e) => {
    console.error('\nProbe crashed:', e);
    app.exit(1);
  }),
);
