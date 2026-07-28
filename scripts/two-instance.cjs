/**
 * The M4 sign-off: TWO real Electron instances, one hosting and one joining,
 * playing a real game over a real socket on this machine.
 *
 *   node scripts/two-instance.cjs [--keep]
 *
 * ⚠️ SEPARATE DATA ROOTS, WHICH IS WHAT D2 IS FOR. Two instances sharing one
 * profile collide on settings.json, the deck index and the image queue. The
 * guest gets `CRT_DATA_DIR=<home>/.commanders-roundtable-guest` — with a
 * DIRECTORY JUNCTION to the host's `cards/` and `images/`, because the alternative
 * is downloading 77 MB of card data a second time to prove a networking point.
 * A junction needs no administrator rights on Windows.
 *
 * ⚠️ IT DRIVES THE REAL UI, not the net layer directly. The point of this script
 * is everything the unit tests cannot reach: the CSP the renderer actually runs
 * under, the preload bridge, the LAN listener binding a real interface, and two
 * separate processes disagreeing or not.
 */

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const KEEP = process.argv.includes('--keep');
/**
 * ⚠️ `--offline` is the M5 offline audit (step 7). It runs the SAME two-instance
 * session with external DNS made dark inside both spawned processes, which is
 * the honest test of "everything but card art works with no internet": the LAN
 * transport is local, the card database is on disk, and the only thing that
 * genuinely needs the network is fetching art it has not cached yet.
 */
const OFFLINE = process.argv.includes('--offline');
const ROOT = path.resolve(__dirname, '..');
const HOST_DIR = path.join(os.homedir(), '.commanders-roundtable');
const GUEST_DIR = path.join(os.homedir(), '.commanders-roundtable-guest');
const HOST_PORT = 9231;
const GUEST_PORT = 9232;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  const mark = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${mark}  ${name}${detail ? `  ${detail}` : ''}`);
  return !!ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Share the expensive read-only directories rather than re-downloading them. */
function prepareGuestProfile() {
  fs.mkdirSync(GUEST_DIR, { recursive: true });
  for (const name of ['cards', 'images']) {
    const link = path.join(GUEST_DIR, name);
    const target = path.join(HOST_DIR, name);
    if (!fs.existsSync(target)) continue;
    if (fs.existsSync(link)) continue;
    if (process.platform === 'win32') {
      spawnSync('cmd', ['/c', 'mklink', '/J', link, target], { stdio: 'ignore' });
    } else {
      fs.symlinkSync(target, link, 'dir');
    }
  }
  // ⚠️ A junction is not a copy. If it failed, say so instead of quietly
  // downloading half a gigabyte on the second instance.
  return fs.existsSync(path.join(GUEST_DIR, 'cards'));
}

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

/** Anything still holding the LAN port from an earlier run has to go first. */
function clearLanPort(port) {
  if (process.platform !== 'win32') return;
  const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? '';
  const pids = new Set();
  for (const line of out.split('\n')) {
    if (!line.includes(`:${port}`) || !line.includes('LISTENING')) continue;
    const pid = line.trim().split(/\s+/).pop();
    if (pid && pid !== '0') pids.add(pid);
  }
  for (const pid of pids) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  return pids.size;
}

/**
 * Copy the offline shim somewhere without a space in the path.
 *
 * ⚠️ `NODE_OPTIONS` is split on WHITESPACE before it is parsed, and every path
 * in this workspace contains one — `--require H:\Claude Apps\…` becomes
 * `Cannot find module 'H:\Claude'`. Quoting inside the variable does not survive
 * the shell reliably either. Copying to a space-free directory is the only form
 * that works the same way from bash, PowerShell and a scheduled task.
 */
function installOfflineShim() {
  const dir = path.join(path.parse(os.homedir()).root, 'crt-offline');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'shim.cjs');
  fs.copyFileSync(path.join(__dirname, 'offline-shim.cjs'), dest);
  return dest;
}

function launch(label, port, dataDir) {
  const env = { ...process.env, CRT_DATA_DIR: dataDir };
  if (OFFLINE) {
    // ⚠️ The cable is pulled for THIS PROCESS ONLY — no adapter is disabled, no
    // hosts file is edited, and nothing test-only ships in the app. See
    // scripts/offline-shim.cjs.
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : ''}--require ${OFFLINE_SHIM}`;
  }
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    [
      'electron',
      '.',
      '--dev',
      `--remote-debugging-port=${port}`,
      // An occluded window freezes rAF and throttles timers to 1 s, which reads
      // exactly like a hung app. AGENTS.md trap 2.
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
  );
  child.stdout.on('data', (d) => {
    const text = String(d).trim();
    if (text) console.log(`    [${label}] ${text.split('\n').slice(-1)[0]}`);
  });
  child.stderr.on('data', () => undefined);
  return child;
}

function httpJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

/** One long-lived CDP connection per instance, so state survives between calls. */
async function connect(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let page = null;
  while (Date.now() < deadline) {
    try {
      const targets = await httpJson(port, '/json/list');
      page = targets.find((t) => t.type === 'page' && /^(file|http):/.test(t.url));
      if (page) break;
    } catch {
      // Not up yet.
    }
    await sleep(400);
  }
  if (!page) throw new Error(`no page target on :${port}`);

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) return entry.reject(new Error(msg.error.message));
    const r = msg.result;
    if (r && r.exceptionDetails) {
      return entry.reject(new Error(r.exceptionDetails.exception?.description ?? 'renderer threw'));
    }
    entry.resolve(r && r.result ? r.result.value : undefined);
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
      socket.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        // ⚠️ Never replMode: true — it silently defeats awaitPromise (D7).
        params: { expression, awaitPromise: true, returnByValue: true },
      }));
    });

  return { js, close: () => socket.close() };
}

/** Wait for the renderer to satisfy a predicate, or give up and say so. */
async function until(js, expression, timeoutMs = 30000, everyMs = 250) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await js(expression).catch(() => undefined);
    if (last) return last;
    await sleep(everyMs);
  }
  return last;
}

// ── driving the REAL screen ───────────────────────────────────────────────────
//
// ⚠️ M5 moved this script off the `window.__crt.mp` dev handles and onto the
// actual buttons. The handles call `hostGame`/`joinGame` directly, which is one
// layer BELOW the screen — so every wiring mistake between a button and those
// functions was invisible to the M4 sign-off, and one of them was real: the
// whole screen was styled with colour tokens that do not exist, so Tailwind
// emitted none of those utilities and the panels had no borders, no background
// and no button fill. A test that never touched a button could not have noticed.
//
// Reading state still goes through `window.__crt.net.state()`. That is the right
// split: the assertions are about the SESSION, and only the driving has to be
// through the UI for the UI to be under test.

/** Navigate to a screen and wait for it to be the mounted slot. */
async function gotoScreen(js, screen) {
  await js(`(async () => {
    window.location.hash = ${JSON.stringify(screen)};
    for (let i = 0; i < 60; i++) {
      if (document.querySelector('[data-screen=${JSON.stringify(screen)}]')) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  })()`);
}

/** Click a real button by its data-mp attribute. Returns false if it is absent. */
function click(js, mp, timeout = 30000) {
  return js(`(() => {
    const el = document.querySelector('[data-mp=${JSON.stringify(mp)}]');
    if (!el) return false;
    if (el.disabled) return 'disabled';
    el.click();
    return true;
  })()`, timeout);
}

/**
 * Type into a React-controlled input.
 *
 * ⚠️ `el.value = x` DOES NOT WORK. React installs its own value setter on the
 * element and tracks the last value it wrote, so a direct assignment is seen as
 * "no change" and the onChange handler never fires — the field looks filled on
 * screen and the component's state is still empty, which reads as "the join
 * button ignored my room code". Going through the prototype's native setter is
 * what makes React notice.
 */
function type(js, mp, value) {
  return js(`(() => {
    const el = document.querySelector('[data-mp=${JSON.stringify(mp)}]');
    if (!el) return false;
    const proto = el instanceof window.HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
}

/** The text of the screen's message line, or null. */
function messageText(js) {
  return js(`(() => {
    const el = document.querySelector('[data-mp="message"]');
    return el ? el.innerText.trim() : null;
  })()`);
}

let OFFLINE_SHIM = '';

async function main() {
  console.log(OFFLINE ? '── Two-instance LAN game (OFFLINE AUDIT) ──' : '── Two-instance LAN game ──');
  if (OFFLINE) {
    OFFLINE_SHIM = installOfflineShim();
    console.log();
  }
  const junctioned = prepareGuestProfile();
  check('the guest profile shares the host card database (no second download)', junctioned,
    junctioned ? GUEST_DIR : 'junction failed — the guest would need its own 77 MB sync');

  const stale = clearLanPort(5282);
  if (stale) console.log(`  (cleared ${stale} stale listener(s) on :5282)`);

  const hostApp = launch('host ', HOST_PORT, HOST_DIR);
  const guestApp = launch('guest', GUEST_PORT, GUEST_DIR);
  let host = null;
  let guest = null;

  try {
    host = await connect(HOST_PORT);
    guest = await connect(GUEST_PORT);
    check('both instances are up and debuggable', true, `:${HOST_PORT} and :${GUEST_PORT}`);

    // Both need the app booted and the net handles registered — they live on the
    // table screen's mount effect, which is always mounted.
    for (const app of [host, guest]) {
      await until(app.js, '!!(window.__crt && window.__crt.net && window.crt)', 60000);
    }
    check('the preload bridge and net handles exist in both',
      (await host.js('!!(window.crt && window.__crt.net)')) === true &&
        (await guest.js('!!(window.crt && window.__crt.net)')) === true);

    const dbs = await Promise.all([
      host.js('window.crt.cardDb.status()'),
      guest.js('window.crt.cardDb.status()'),
    ]);
    if (dbs[0].state !== 'ready' || dbs[1].state !== 'ready') {
      check('both instances have a card database', false,
        `host=${dbs[0].state} guest=${dbs[1].state} — run: node electron/cardsvc-worker.cjs --sync`);
      return;
    }
    check('both instances have the SAME card database', dbs[0].updatedAt === dbs[1].updatedAt,
      `${dbs[0].updatedAt} / ${dbs[1].updatedAt}`);

    // ── the offline audit (M5 step 7) ──
    //
    // ⚠️ Run BEFORE the game, because if the network is not actually dark then
    // every "it works offline" claim below is worthless — and a shim that
    // silently failed to load would look exactly like a passing audit.
    if (OFFLINE) {
      console.log('\n── ⚠️ Offline audit: the cable is pulled ──');

      const reach = await host.js(`(async () => {
        try {
          const r = await window.crt.cardDb.sync();
          return { reached: true, state: r && r.state };
        } catch (e) {
          return { reached: false, message: String(e && e.message ? e.message : e) };
        }
      })()`, 120000);
      // ⚠️ THE CONTROL. Everything else in this section means nothing unless
      // Scryfall is genuinely unreachable.
      check('Scryfall is genuinely unreachable (the audit is not vacuous)',
        reach && reach.reached === false, reach ? (reach.message ?? `reached: ${reach.state}`) : 'no result');
      check('…and the failure says so in words rather than hanging',
        typeof reach?.message === 'string' && reach.message.length > 0, reach?.message ?? '');

      // The whole point of downloading the database once: gameplay never needs
      // the network again.
      const db = await host.js('window.crt.cardDb.status()', 60000);
      check('the card database still works with no internet',
        db && db.state === 'ready' && (db.cardCount ?? 0) > 100000,
        `state=${db?.state} cards=${db?.cardCount ?? 0}`);

      const lookup = await host.js(`window.crt.cardDb.byName({ name: 'Sol Ring' }).then((c) => c && c.name, (e) => 'ERROR: ' + e.message)`, 60000);
      check('a card lookup answers from the local index', lookup === 'Sol Ring', String(lookup));

      const search = await host.js(`window.crt.cardDb.searchPrefix('lightning', 5).then((r) => r.length, () => -1)`, 60000);
      check('search works offline', typeof search === 'number' && search > 0, `${search} result(s)`);

      // ⚠️ THE ONE APPROVED DEGRADATION. An uncached card must render its full
      // text as a SyntheticFace — never a blank rectangle, never a spinner, and
      // above all never a hang waiting on a socket that will not connect (D11).
      const art = await host.js(`(async () => {
        const started = performance.now();
        const result = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve('loaded');
          img.onerror = () => resolve('error');
          img.src = 'cardimg://card/png/ffffffff-ffff-ffff-ffff-ffffffffffff';
          setTimeout(() => resolve('timeout'), 8000);
        });
        return { result, ms: Math.round(performance.now() - started) };
      })()`, 30000);
      check('an uncached card image fails FAST rather than hanging',
        art && art.result === 'error' && art.ms < 5000, `${art?.result} in ${art?.ms}ms`);

      // The updater is the fourth approved exception; with no network it must
      // fail harmlessly rather than block the launch we are already past.
      const upd = await host.js('window.crt.updater.status()', 30000);
      check('the updater did not block or crash the launch',
        upd && typeof upd.state === 'string', `state=${upd?.state}`);

      // ⚠️ A SOLO game as well as the LAN one below. Solo is not a weaker case
      // of networked play here — it is the one a friend plays on the train, and
      // it exercises deck building against the local database, the full engine
      // and the whole animation path with nothing reachable at all.
      //
      // ⚠️ Trap 32: the table must be the VISIBLE screen before the engine
      // handles are usable, or the packer measures a 0×0 board.
      await gotoScreen(host.js, 'table');
      await sleep(600);
      const solo = await host.js(`(async () => {
        const started = await window.__crt.engine.start(4);
        if (!started.ok) return { ok: false, message: started.message };
        await window.__crt.engine.settle(9000);
        window.__crt.engine.setAutoSwitch(false);
        const r = await window.__crt.engine.autoplay(220);
        await window.__crt.engine.settle(9000);
        const end = window.__crt.engine.state();
        window.__crt.engine.stop();
        return {
          ok: true,
          seats: started.seats.length,
          missing: started.missing,
          steps: r.steps,
          rejected: r.rejected,
          turn: end.turn.number,
          events: end.events,
        };
      })()`, 180000);
      check('a full 4-seat SOLO game builds and plays with no internet',
        solo && solo.ok === true && solo.seats === 4 && solo.turn >= 3 && solo.rejected === 0,
        solo && solo.ok
          ? `${solo.steps} intents, turn ${solo.turn}, ${solo.events} events, ${solo.missing} card(s) missing`
          : (solo?.message ?? 'no result'));
    }

    // ── host, through the real Host button ──
    console.log('\n── Hosting on the local network (through the UI) ──');
    await gotoScreen(host.js, 'multiplayer');

    // ⚠️ The panel has to be STYLED, not merely present. This is the assertion
    // that would have caught M4's silent Tailwind bug: the screen was written
    // against colour tokens that are not declared, so Tailwind emitted none of
    // those utilities and every panel rendered with no border and no background.
    // Nothing errored, nothing warned, and no test looked.
    const styled = await host.js(`(() => {
      const el = document.querySelector('[data-mp="host-lan"]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const panel = document.querySelector('[data-screen="multiplayer"] section');
      const pcs = panel ? getComputedStyle(panel) : null;
      return {
        buttonBorder: cs.borderTopWidth,
        buttonBg: cs.backgroundColor,
        panelBorder: pcs ? pcs.borderTopWidth : null,
        panelBg: pcs ? pcs.backgroundColor : null,
      };
    })()`);
    check('the multiplayer screen is actually styled (borders and panels exist)',
      styled !== null &&
        styled.buttonBorder !== '0px' &&
        styled.panelBorder !== '0px' &&
        styled.panelBg !== 'rgba(0, 0, 0, 0)',
      styled ? JSON.stringify(styled) : 'the Host button is not on screen');

    const clickedHost = await host.js(`(async () => {
      document.querySelector('[data-mp="host-lan"]').click();
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (document.querySelector('[data-mp="code"]')) return true;
        const msg = document.querySelector('[data-mp="message"]');
        if (msg && !document.querySelector('[data-mp="share"]')) return msg.innerText.trim();
      }
      return 'the Host button produced neither a code nor a message';
    })()`, 120000);

    const hostedCode = await host.js(`(() => {
      const el = document.querySelector('[data-mp="code"]');
      return el ? el.innerText.trim() : null;
    })()`);
    const hostedToken = await host.js(`(() => {
      const el = document.querySelector('[data-mp="token"]');
      return el ? el.innerText.trim() : '';
    })()`);
    const hostedAddresses = await host.js(`(() => [...document.querySelectorAll('[data-mp="share"] li span:nth-child(2)')].map((e) => e.innerText.trim()))()`);

    check('the Host button started a LAN game and showed a room code',
      clickedHost === true && /^[A-Z0-9]{6}$/.test(hostedCode ?? ''),
      clickedHost === true
        ? `${hostedCode} · ${hostedAddresses.length} address(es)`
        : String(clickedHost));
    if (clickedHost !== true || !hostedCode) return;

    // ⚠️ D59, asserted from the SCREEN: a LAN game must show a join key, because
    // a guest cannot get in without one and the host is the only one who has it.
    check('the host screen shows the join key a guest needs (D59)',
      typeof hostedToken === 'string' && hostedToken.length >= 32,
      `${hostedToken.length} characters`);

    const lanUrl = hostedAddresses[0] ?? `ws://127.0.0.1:5282`;

    // ── guest joins, through the real Join form ──
    console.log('\n── Joining from the second instance (through the UI) ──');

    const fillAndJoin = async () => {
      await gotoScreen(guest.js, 'multiplayer');
      await type(guest.js, 'join-url', lanUrl);
      await type(guest.js, 'join-code', hostedCode);
      await type(guest.js, 'join-token', hostedToken);
      return guest.js(`(async () => {
        document.querySelector('[data-mp="join"]').click();
        for (let i = 0; i < 300; i++) {
          await new Promise((r) => setTimeout(r, 300));
          if (document.querySelector('[data-mp="lobby"]')) return { ok: true };
          const reload = document.querySelector('[data-mp="reload"]');
          const msg = document.querySelector('[data-mp="message"]');
          if (reload) return { reloadNeeded: true, message: msg ? msg.innerText.trim() : '' };
          if (msg) return { ok: false, message: msg.innerText.trim() };
        }
        return { ok: false, message: 'the Join button produced nothing at all' };
      })()`, 120000);
    };

    let joined = await fillAndJoin();
    if (joined && joined.reloadNeeded) {
      // ⚠️ EXPECTED THE FIRST TIME. The CSP header is set at document load, so a
      // brand-new origin only takes effect after a reload — that is the honest
      // cost of a per-origin allowlist (D48). The app says so, IN THE UI, and
      // offers the button; the probe clicks it exactly as a player would.
      check('a brand-new origin asks for one reload before it will connect', true, joined.message);
      await click(guest.js, 'reload').catch(() => undefined);
      await sleep(2500);
      guest.close();
      guest = await connect(GUEST_PORT);
      await until(guest.js, '!!(window.__crt && window.__crt.net)', 60000);
      // ⚠️ Join ONCE more, only because the reload happened. Joining twice makes
      // a second connection, and a second connection is a second player — which
      // is correct behaviour and completely wrong for this script.
      joined = await fillAndJoin();
    }
    check('the guest joined over a real WebSocket, from the Join button',
      joined && joined.ok === true, joined ? (joined.message ?? 'in the lobby') : 'no result');
    if (!joined || !joined.ok) return;

    // ⚠️ THE COPY RULE, asserted. "Could not connect" is the one thing this
    // screen must never say, because four different problems would share it.
    const anyMessage = await guest.js(`(() => {
      const el = document.querySelector('[data-mp="message"]');
      return el ? el.innerText.trim() : '';
    })()`);
    check('the screen never says the words "could not connect"',
      !/could not connect/i.test(String(anyMessage ?? '')), String(anyMessage || '(no message)'));

    const lobby = await until(host.js,
      '(() => { const s = window.__crt.net.state(); return s.lobby && s.lobby.seats.length === 2 ? s.lobby : null; })()',
      30000);
    check('the host sees two seats in the lobby', lobby && lobby.seats.length === 2,
      lobby ? lobby.seats.map((s) => `${s.name}:${s.deck ?? 'no deck'}`).join(', ') : 'never appeared');

    const decksIn = await until(host.js,
      '(() => { const s = window.__crt.net.state(); return s.lobby && s.lobby.seats.every((x) => x.deck) ? true : null; })()',
      60000);
    check('both decks resolved against the HOST\'s card database', decksIn === true,
      decksIn ? 'both seated' : 'a deck never resolved');

    // ── start, through the real Ready and Start buttons ──
    console.log('\n── Playing ──');

    // ⚠️ Assert the START BUTTON IS DISABLED before everyone is ready, and that
    // the screen SAYS WHY. A greyed-out button with no explanation is the single
    // most common way a lobby stalls: the host waits for something to change and
    // nobody at the table knows what.
    const blocked = await host.js(`(() => {
      const btn = document.querySelector('[data-mp="start"]');
      const why = document.querySelector('[data-mp="start-blocked"]');
      return { disabled: btn ? btn.disabled : null, why: why ? why.innerText.trim() : null };
    })()`);
    check('Start is disabled until everyone is ready, and the screen says why',
      blocked.disabled === true && typeof blocked.why === 'string' && blocked.why.length > 0,
      JSON.stringify(blocked));

    await click(host.js, 'ready');
    await click(guest.js, 'ready');
    await until(host.js,
      '(() => { const s = window.__crt.net.state(); return s.lobby && s.lobby.seats.every((x) => x.ready) ? true : null; })()',
      20000);

    const startClick = await host.js(`(async () => {
      const btn = document.querySelector('[data-mp="start"]');
      if (!btn) return 'no Start button';
      if (btn.disabled) return 'Start is still disabled after both players said ready';
      btn.click();
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (window.__crt.net.state().running) return true;
      }
      const msg = document.querySelector('[data-mp="message"]');
      return msg ? msg.innerText.trim() : 'the game never started';
    })()`, 90000);
    check('the host started the game from the Start button', startClick === true, String(startClick));
    if (startClick !== true) return;

    const bothRunning = await until(guest.js, '(() => window.__crt.net.state().running || null)()', 30000);
    check('the guest received the opening board over the wire', bothRunning === true);

    /**
     * Play until a spell has actually been CAST and RESOLVED, seen by both apps.
     *
     * ⚠️ Stopping at turn 3 stopped one step too early to prove anything about
     * casting. Turn 3 begins after two land drops, before either side has a main
     * phase to spend them in, so every run finished with a log of nothing but
     * `LandPlayed` and `MulliganKept` — the stack, the payment solver and the
     * whole cast path never ran over the wire at all. The starter deck is 40
     * basics and 59 spells including four Sol Rings, so a cast lands within a
     * couple more turns.
     *
     * ⚠️ The exit condition is the ASSERTION, not a turn count. A fixed "play to
     * turn 6" would still pass on a game that cast nothing, which is the failure
     * this replaces; stopping the moment both logs show a resolution also keeps
     * the run as short as it can be.
     *
     * A RESOLVED spell is the signal rather than a cast one: a spell only leaves
     * the stack after its costs were paid and — if it targets — after the host
     * accepted its targets, so it proves the round trip rather than the intent.
     */
    const PROGRESS = `(() => {
      const s = window.__crt.net.state();
      const rows = [...document.querySelectorAll('[data-log-id]')].map((e) => e.textContent.trim());
      return {
        turn: s.turn.number,
        // "You cast Sol Ring." to its caster and "Apps casts Sol Ring." to
        // everyone else — the log is written from the reader's side (D101), so
        // both forms count. A resolution reads the same to everybody.
        cast: rows.filter((r) => /\\bcasts?\\b/.test(r)).length,
        resolved: rows.filter((r) => / resolves\\.$/.test(r)).length,
      };
    })()`;

    const deadline = Date.now() + 180000;
    let acted = 0;
    let hp = { turn: 0, cast: 0, resolved: 0 };
    let gp = { turn: 0, cast: 0, resolved: 0 };
    while (Date.now() < deadline) {
      hp = await host.js(PROGRESS);
      gp = await guest.js(PROGRESS);
      if (hp.turn >= 3 && gp.turn >= 3 && hp.resolved > 0 && gp.resolved > 0) break;
      const did =
        (await host.js('window.__crt.mp.step()')) || (await guest.js('window.__crt.mp.step()'));
      if (did) acted += 1;
      await sleep(60);
    }
    // ⚠️ Still no upper bar on the intent count. Auto-pass decides how many
    // passes a turn costs, and an assertion of "more than ten" once failed on a
    // game that was working perfectly. What matters is that intents crossed the
    // socket and that the game got somewhere, which the checks below state
    // directly.
    check('both apps played real intents over the socket', acted >= 3, `${acted} intents`);

    /**
     * ⚠️ Deliberately "a spell", not "a targeted spell". Whether a Lightning Bolt
     * is castable depends on the shuffle and on the seat's colours, so requiring
     * one would trade a real assertion for a flaky one — even though in practice
     * it usually happens (a run of this logged `SpellCast` twice and a
     * `TargetsChosen`, so the D102 targeting answer really did cross the socket).
     * The targeting prompt is covered deterministically by `net.test.ts` ("a
     * scripted game casts a TARGETED spell and answers the prompt"); this one
     * proves the ordinary cast path runs between two real processes.
     *
     * ⚠️ The two counts are sampled one after the other, over two separate CDP
     * round trips, so they routinely differ BY ONE — the second app is read a few
     * milliseconds later and has seen one more resolution. That is skew in the
     * probe, not lag in the game: the hash check immediately below compares the
     * two apps at the same point and has to be exactly equal. Do not "fix" the
     * asymmetry by making the assertion compare the counts to each other.
     */
    check('a spell was cast and resolved, and BOTH apps saw it in their log',
      hp.cast > 0 && hp.resolved > 0 && gp.cast > 0 && gp.resolved > 0,
      `host ${hp.cast} cast / ${hp.resolved} resolved · guest ${gp.cast} cast / ${gp.resolved} resolved`);

    const agree = await until(host.js, `(async () => {
      const h = window.__crt.net.state();
      return h.events > 30 && h.turn.number >= 3 ? h : null;
    })()`, 30000);
    const gFinal = await guest.js('window.__crt.net.state()');
    check('the game reached turn 3 on both sides',
      agree && agree.turn.number >= 3 && gFinal.turn.number >= 3,
      `host t${agree ? agree.turn.number : '?'} / guest t${gFinal.turn.number}`);
    check('the two apps agree on the authoritative state hash',
      agree && gFinal && agree.hash === gFinal.hash, `${agree ? agree.hash : '?'} / ${gFinal.hash}`);
    check('each app is looking through its OWN seat',
      agree && gFinal && agree.viewer !== gFinal.viewer, `${agree ? agree.viewer : '?'} vs ${gFinal.viewer}`);

    // ── drop and rejoin ──
    console.log('\n── Dropping the guest\'s socket ──');
    const dropped = await guest.js('window.__crt.net.dropSocket()');
    check('the guest\'s socket was dropped from under it', dropped === true);

    const sawGone = await until(host.js,
      '(() => { const s = window.__crt.net.state(); return s.lobby && s.lobby.seats.some((x) => !x.connected) ? true : null; })()',
      15000);
    check('the host noticed the guest leave', sawGone === true, sawGone ? '' : 'presence never changed');

    const back = await until(host.js,
      '(() => { const s = window.__crt.net.state(); return s.lobby && s.lobby.seats.every((x) => x.connected) ? true : null; })()',
      30000);
    check('the guest reconnected on its resumeToken with no typing', back === true);

    const afterHost = await host.js('window.__crt.net.state()');
    const afterGuest = await guest.js('window.__crt.net.state()');
    check('the two apps agree again after the reconnect',
      afterHost.hash === afterGuest.hash, `${afterHost.hash} / ${afterGuest.hash}`);
    check('the guest is still in its own seat', afterGuest.viewer === gFinal.viewer,
      `${afterGuest.viewer}`);

    // ── persistence ──
    console.log('\n── On disk ──');
    const log = await host.js('window.__crt.net.verifyLog()');
    check('the host wrote an NDJSON log that replays to the live state',
      log && log.ok === true && log.match === true,
      log ? `${log.lines} lines, ${log.replayHash} vs ${log.liveHash}` : 'no result');
  } finally {
    if (!KEEP) {
      host?.close();
      guest?.close();
      // ⚠️ KILL THE TREE. `child.kill()` on Windows signals the launcher, not
      // Electron's own process group, so the renderer and the main process
      // survive — and the main process is the one holding port 5282. The next
      // run then crashed on EADDRINUSE with a modal dialog. `taskkill /T /F` is
      // what actually ends it.
      killTree(hostApp);
      killTree(guestApp);
    }
  }
}

main()
  .catch((err) => {
    check('the run completed', false, err && err.message ? err.message : String(err));
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      console.log('\nFailures:');
      for (const f of failed) console.log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
    }
    if (!KEEP) setTimeout(() => process.exit(failed.length ? 1 : 0), 500);
  });
