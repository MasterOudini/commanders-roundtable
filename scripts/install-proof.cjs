/**
 * The install-and-confirm-the-data-root proof — "the MSIX proof".
 *
 *   node scripts/install-proof.cjs            # install, launch, verify, leave installed
 *   node scripts/install-proof.cjs --uninstall  # remove it again afterwards
 *
 * ⚠️ WHY THIS EXISTS AT ALL (D2, D10b). The Claude desktop app is
 * MSIX-containerized, so `%APPDATA%` / `%LOCALAPPDATA%` writes made from an
 * agent session are VIRTUALIZED into `…\Packages\Claude_…\LocalCache\…`. If the
 * app's data root were under either of those, the ~550 MB card database written
 * while developing would not be the directory the user's real, installed app
 * reads — it would launch, look completely empty, and start re-downloading.
 *
 * D2 chose a profile-root dotfolder to escape that, and D10b confirmed the
 * download is not virtualized. What NEITHER of them proved is the thing that
 * actually matters to a user: that the INSTALLED build reads the same folder.
 * This script installs the real installer, launches the real installed binary,
 * and asks it — through the same preload bridge the UI uses — where its data
 * root is.
 *
 * ⚠️ It installs PER-USER (`perMachine: false`), so it needs no administrator
 * rights and is removed by the uninstaller it drops beside itself.
 */

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync, execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const PORT = 9241;
const UNINSTALL_AFTER = process.argv.includes('--uninstall');
const EXPECTED_ROOT = path.join(os.homedir(), '.commanders-roundtable');

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  const mark = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${mark}  ${name}${detail ? `  ${detail}` : ''}`);
  return !!ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * ⚠️ `child.kill()` DOES NOT KILL ELECTRON ON WINDOWS. It signals the launcher
 * and leaves the main process — and its listening sockets — alive, so the next
 * run dies on EADDRINUSE. Trap 42.
 */
function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    /* already gone */
  }
}

function httpJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('timeout')));
  });
}

/** Minimal CDP client: connect to the page target and evaluate. */
async function connect(port, timeoutMs = 90000) {
  const WebSocket = require('ws');
  const deadline = Date.now() + timeoutMs;
  let page = null;
  while (Date.now() < deadline) {
    try {
      const targets = await httpJson(port, '/json/list');
      page = targets.find((t) => t.type === 'page' && /^(file|http):/.test(t.url));
      if (page) break;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  if (!page) throw new Error(`no debuggable page on :${port}`);

  const socket = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  await new Promise((res, rej) => {
    socket.once('open', res);
    socket.once('error', rej);
  });
  let nextId = 1;
  const pending = new Map();
  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const slot = pending.get(msg.id);
    if (!slot) return;
    pending.delete(msg.id);
    if (msg.error) slot.reject(new Error(msg.error.message));
    else if (msg.result?.exceptionDetails) {
      slot.reject(new Error(msg.result.exceptionDetails.exception?.description ?? 'renderer threw'));
    } else slot.resolve(msg.result?.result?.value);
  });

  const js = (expression, timeout = 30000) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('CDP evaluate timed out'));
      }, timeout);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      // ⚠️ Never replMode: true — it silently defeats awaitPromise (D7).
      socket.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }));
    });

  return { js, close: () => socket.close() };
}

/** Recursively look for a needle under a directory, bounded so it cannot hang. */
function findUnder(dir, matches, limit = 12, depth = 0, out = []) {
  if (out.length >= limit || depth > 8) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // permission denied is not a shadow copy
  }
  for (const e of entries) {
    if (out.length >= limit) break;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findUnder(full, matches, limit, depth + 1, out);
    else if (matches(full)) out.push(full);
  }
  return out;
}

async function main() {
  const installer = fs
    .readdirSync(RELEASE)
    .filter((f) => /Setup .*\.exe$/.test(f))
    .map((f) => path.join(RELEASE, f))[0];
  if (!installer) {
    console.error('No "… Setup ….exe" in release/ — run `npm run electron:build` first.');
    process.exit(1);
  }

  console.log('\n── Installing ──');
  console.log(`  ${path.basename(installer)}`);

  // ⚠️ /S is NSIS's silent switch. electron-builder's per-user installer needs
  // no elevation, so this is an ordinary user-level install with an uninstaller.
  const install = spawnSync(installer, ['/S'], { stdio: 'inherit', windowsHide: true });
  check('the installer ran without an error code', install.status === 0 || install.status === null,
    `exit ${install.status}`);
  // NSIS returns before it has finished writing; give it a moment.
  await sleep(6000);

  // ⚠️ DISCOVER the install directory, do not guess it. electron-builder's NSIS
  // names the folder after the package NAME (`commanders-roundtable`) while the
  // executable inside it is named after `productName` (`Commander's
  // Roundtable.exe`) — so the obvious guess is wrong in a way that reads as "the
  // installer silently failed" when it in fact succeeded. Found by this script
  // reporting exit 0 and no app.
  const programsRoot = path.join(process.env.LOCALAPPDATA ?? '', 'Programs');
  const programs = fs
    .readdirSync(programsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(programsRoot, e.name))
    .find((d) => fs.existsSync(path.join(d, "Commander's Roundtable.exe")));
  const exe = programs ? path.join(programs, "Commander's Roundtable.exe") : '';
  check('the app was installed', !!programs, exe || `nothing matching under ${programsRoot}`);
  if (!programs) {
    report();
    return;
  }

  // ⚠️ The desktop shortcut is a workspace requirement, and it is the thing a
  // friend will actually double-click. Checked on disk, not assumed from config.
  const desktops = [
    path.join(os.homedir(), 'Desktop'),
    path.join(process.env.PUBLIC ?? 'C:\\Users\\Public', 'Desktop'),
  ];
  const shortcut = desktops
    .flatMap((d) => {
      try {
        return fs.readdirSync(d).map((f) => path.join(d, f));
      } catch {
        return [];
      }
    })
    .find((f) => /Commander.s Roundtable\.lnk$/i.test(f));
  check('the installer created a desktop shortcut', !!shortcut, shortcut ?? 'not found');

  console.log('\n── Launching the INSTALLED build ──');

  const child = spawn(exe, [
    `--remote-debugging-port=${PORT}`,
    // An occluded window freezes rAF and throttles timers to 1 s, which reads
    // exactly like a hang (trap 3).
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ], { detached: false, stdio: 'ignore', windowsHide: false });

  let cdp = null;
  try {
    cdp = await connect(PORT);
    check('the installed app launched and is debuggable', true, `:${PORT}`);

    // ⚠️ A debuggable PAGE is not a LOADED page. The first attempt evaluated
    // `window.crt.app.info()` the moment a target appeared and got "Cannot read
    // properties of undefined (reading 'app')" — which reads as "the preload
    // bridge is missing from the packaged build", i.e. exactly the catastrophic
    // packaging failure this script is meant to detect, when in fact the
    // document simply had not run its preload yet.
    let bridgeUp = false;
    for (let i = 0; i < 120 && !bridgeUp; i++) {
      bridgeUp = (await cdp.js('!!(window.crt && window.crt.app)').catch(() => false)) === true;
      if (!bridgeUp) await sleep(500);
    }
    check('the preload bridge is present in the PACKAGED build', bridgeUp);

    const info = await cdp.js('window.crt.app.info()', 60000);
    check('the installed build reports itself as packaged', info?.isPackaged === true,
      `isPackaged=${info?.isPackaged} version=${info?.version}`);

    // ⚠️ THE ASSERTION THE WHOLE SCRIPT EXISTS FOR.
    check('the INSTALLED app reads the same data root a dev session writes',
      path.resolve(info?.dataRoot ?? '') === path.resolve(EXPECTED_ROOT),
      `${info?.dataRoot}  (expected ${EXPECTED_ROOT})`);

    check('…and that root is not under %APPDATA% or %LOCALAPPDATA%',
      !/AppData[\\/](Local|Roaming)/i.test(info?.dataRoot ?? 'AppData/Local'),
      info?.dataRoot ?? '');

    // The card database written during development must be visible to it. This
    // is the user-visible consequence: an app that cannot see it re-downloads
    // 550 MB and looks broken.
    const db = await cdp.js('window.crt.cardDb.status()', 60000);
    check('the installed app can see the existing card database',
      db?.state === 'ready' && (db?.cardCount ?? 0) > 100000,
      `state=${db?.state} cards=${db?.cardCount ?? 0}`);

    const decks = await cdp.js('window.crt.decks.list()', 30000);
    check('…and the same decks folder', Array.isArray(decks), `${(decks ?? []).length} deck(s)`);
  } catch (err) {
    check('the installed app launched and answered', false, err.message);
  } finally {
    if (cdp) cdp.close();
    killTree(child.pid);
    await sleep(1500);
  }

  console.log('\n── ⚠️ No MSIX shadow copy (D2 / D10b) ──');

  const packages = path.join(process.env.LOCALAPPDATA ?? '', 'Packages');
  if (!fs.existsSync(packages)) {
    check('%LOCALAPPDATA%\\Packages does not exist on this machine', true, packages);
  } else {
    // The two artefacts that would prove virtualization happened: our bulk data
    // file, and a virtualized copy of the data root itself.
    const bulk = findUnder(packages, (f) => /\.jsonl\.gz$/i.test(f) || /cards\.ndjson$/i.test(f));
    check('no card database shadow copy under %LOCALAPPDATA%\\Packages',
      bulk.length === 0, bulk.slice(0, 3).join(', ') || 'none');

    const rootCopy = findUnder(packages, (f) => /[\\/]\.commanders-roundtable[\\/]/i.test(f));
    check('no virtualized copy of the data root under %LOCALAPPDATA%\\Packages',
      rootCopy.length === 0, rootCopy.slice(0, 3).join(', ') || 'none');
  }

  // And the real one is genuinely there, with content.
  check('the real data root exists and holds the card database',
    fs.existsSync(path.join(EXPECTED_ROOT, 'cards', 'cards.ndjson')),
    path.join(EXPECTED_ROOT, 'cards', 'cards.ndjson'));

  if (UNINSTALL_AFTER) {
    console.log('\n── Uninstalling ──');
    const uninstaller = path.join(programs, 'Uninstall Commander\'s Roundtable.exe');
    if (fs.existsSync(uninstaller)) {
      spawnSync(uninstaller, ['/S'], { stdio: 'inherit', windowsHide: true });
      await sleep(6000);
      check('the uninstaller removed the app', !fs.existsSync(exe), exe);
      check('⚠️ uninstalling did NOT delete your files', fs.existsSync(EXPECTED_ROOT), EXPECTED_ROOT);
    } else {
      check('an uninstaller was installed alongside the app', false, uninstaller);
    }
  } else {
    console.log(`\n  The app is still installed at ${programs}`);
    console.log('  Re-run with --uninstall to remove it.');
  }

  // ⚠️ THE INSTALLER OVERWRITES THE DEVELOPER'S DESKTOP SHORTCUT. Both are named
  // `Commander's Roundtable.lnk`, so installing here silently repoints the
  // workspace's dev shortcut at the PACKAGED build — which then goes stale the
  // moment anything is edited, and is exactly what the standing rule in
  // ~/AGENTS.md forbids ("shortcuts must always launch the latest code").
  // Say so; the fix is one command.
  console.log('\n  ⚠️ The installer replaced the desktop shortcut with one pointing at the');
  console.log('     packaged build. On a development machine put it back with:');
  console.log('       powershell -ExecutionPolicy Bypass -File create-shortcut.ps1');

  report();
}

function report() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('\nInstall proof crashed:', e);
  process.exit(1);
});
