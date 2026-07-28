/**
 * Minimal Chrome DevTools Protocol client for driving the REAL dev renderer.
 *
 *   node scripts/cdp.cjs "expression"          # evaluate and print JSON
 *   node scripts/cdp.cjs --file check.js       # evaluate a file's contents
 *
 * Assumes an Electron dev instance started with --remote-debugging-port=9223.
 * Used for anything the headless dist probe can't reach: live stores, running
 * animations, real HMR state.
 *
 * ⚠️ THREE TRAPS, each of which has cost a full debugging round in this
 * workspace — read before trusting a result:
 *
 * 1. RESTART VITE before probing after an edit session. With HMR active, app
 *    modules resolve as `file.ts?t=<stamp>`; an `await import('/src/...')` in a
 *    probe loads a SECOND module instance, so you read a ghost zustand store and
 *    every assertion lies. Reach state through window.__crt handles instead.
 * 2. LAUNCH WITH --disable-backgrounding-occluded-windows
 *    --disable-renderer-backgrounding. An occluded window freezes rAF and
 *    throttles timers to 1 s, so animation probes "hang" in a way that looks
 *    exactly like a code regression.
 * 3. DON'T SYNTHESIZE POINTER DRAGS. If the real mouse is over the Electron
 *    window, genuine and synthetic pointermoves interleave and corrupt the
 *    gesture. Assert on store-injected state instead.
 */

const http = require('http');

const PORT = Number(process.env.CDP_PORT) || 9223;

function httpJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: pathname }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => { req.destroy(new Error('CDP HTTP timeout')); });
  });
}

/** The app's own page target, skipping devtools:// and about: targets. */
async function findPageTarget() {
  const targets = await httpJson('/json/list');
  const page = targets.find(
    (t) => t.type === 'page' && /^(file|http):/.test(t.url) && !t.url.startsWith('devtools://'),
  );
  if (!page) {
    throw new Error(`No page target on :${PORT}. Is Electron running with --remote-debugging-port=${PORT}?`);
  }
  return page;
}

async function evaluate(expression, { timeoutMs = 15000 } = {}) {
  const page = await findPageTarget();

  // Node 22+/24 has a global WebSocket, so no `ws` dependency is needed here.
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
  });

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    const timer = setTimeout(() => reject(new Error('CDP evaluate timed out')), timeoutMs);

    socket.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.id !== id) return;
      clearTimeout(timer);
      if (msg.error) return reject(new Error(msg.error.message));
      const r = msg.result;
      if (r.exceptionDetails) {
        return reject(new Error(r.exceptionDetails.exception?.description ?? 'renderer threw'));
      }
      resolve(r.result?.value);
    });

    socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: {
        expression,
        // ⚠️ Do NOT add replMode: true here. It silently defeats awaitPromise —
        // every promise-returning expression comes back as {} instead of its
        // resolved value, which reads as "the assertion returned nothing" rather
        // than as a client bug. Wrap async work in an IIFE instead.
        awaitPromise: true,
        returnByValue: true,
      },
    }));
  });

  socket.close();
  return result;
}

module.exports = { evaluate, findPageTarget, PORT };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    let expression;
    if (args[0] === '--file') {
      expression = require('fs').readFileSync(args[1], 'utf8');
    } else {
      expression = args.join(' ');
    }
    if (!expression) {
      console.error('Usage: node scripts/cdp.cjs "<expression>" | --file <path>');
      process.exit(2);
    }
    try {
      const value = await evaluate(expression);
      console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    } catch (e) {
      console.error(`CDP failed: ${e.message}`);
      process.exit(1);
    }
  })();
}
