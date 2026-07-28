// Commander's Roundtable desktop dev launcher (silent-friendly, self-healing).
//
// The desktop shortcut runs this HIDDEN (no console), so a silent failure is
// invisible — hence launch.log.
//
// ⚠️ Why this exists instead of `npm run electron:dev`:
// `concurrently -k "vite" "wait-on … && electron ."` plus strictPort dies
// whenever ANY dev server already holds :5280 — commonly an orphaned vite that
// outlived its Electron window. The second vite exits instantly and `-k` kills
// Electron with it. Under the hidden-console shortcut that reads as "the
// shortcut does nothing". This launcher instead REUSES a server that is already
// serving, starts vite only when the port is free, and only ever stops the vite
// it started itself.

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5280;
const DEV_URL = `http://localhost:${PORT}`;
const LOG = path.join(ROOT, 'launch.log');
const VITE_JS = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

function log(msg) {
  try {
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* logging must never crash the launcher */ }
}

/** Resolve true only if something answers HTTP at the given URL. */
function urlUp(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(retries = 120, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    if (await urlUp(DEV_URL)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

let viteProc = null;

function stopOurViteAndExit(code) {
  if (viteProc && viteProc.pid && !viteProc.killed) {
    log(`Stopping the vite server this launcher started (pid ${viteProc.pid}).`);
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(viteProc.pid), '/T', '/F']);
      else viteProc.kill();
    } catch (e) { log(`taskkill failed: ${e.message}`); }
  }
  process.exit(code);
}

function launchElectron() {
  // require('electron') outside Electron resolves to the electron.exe path.
  const electronExe = require('electron');
  log(`Launching Electron (${electronExe}) against ${DEV_URL}`);
  const el = spawn(electronExe, ['.', '--dev'], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
  el.on('error', (e) => { log(`Electron spawn error: ${e.message}`); stopOurViteAndExit(1); });
  el.on('exit', (c) => { log(`Electron exited with code ${c}`); stopOurViteAndExit(c == null ? 0 : c); });
}

(async () => {
  log('--- launch requested ---');

  if (!fs.existsSync(VITE_JS)) {
    log('node_modules/vite is missing — run `npm install` in the project folder first.');
    process.exit(1);
  }

  if (await urlUp(DEV_URL)) {
    log(`A dev server is already serving :${PORT} — reusing it (no second vite).`);
    launchElectron();
    return;
  }

  log(`Port :${PORT} is free — starting vite.`);
  viteProc = spawn(process.execPath, [VITE_JS, '--port', String(PORT)], {
    cwd: ROOT, stdio: 'ignore', windowsHide: true,
  });
  viteProc.on('error', (e) => { log(`vite spawn error: ${e.message}`); stopOurViteAndExit(1); });
  viteProc.on('exit', (c) => log(`vite exited with code ${c}`));

  if (await waitForServer()) {
    launchElectron();
  } else {
    log(`vite did not come up on :${PORT} within timeout — aborting.`);
    stopOurViteAndExit(1);
  }
})();
