// Supervisor for the card-database worker.
//
// Shape adopted from mundifex/electron/engine.cjs, which supervises a Python
// sidecar: an explicit state machine, a bounded log ring mirrored to disk, and
// recovery that treats a crash as survivable rather than terminal. The worker
// here is a Node utilityProcess rather than a spawned interpreter, so there is no
// install step and no port — but the lifecycle discipline is the same.
//
// Main owns the worker in dev AND production. The dev launcher never spawns it.

const { utilityProcess } = require('electron');
const fs = require('fs');
const path = require('path');

const paths = require('./paths.cjs');

const WORKER = path.join(__dirname, 'cardsvc-worker.cjs');
const LOG_RING = 200;
const REQUEST_TIMEOUT_MS = 15_000;
/** A sync legitimately takes minutes; it gets no timeout, only cancellation. */
const UNTIMED = new Set(['sync']);

/** not-started → starting → ready → (crashed) → starting … */
let state = 'not-started';
let child = null;
let nextId = 1;
const pending = new Map();
const ring = [];
let win = null;
let logStream = null;
let restarts = 0;
/**
 * Requests posted before the worker finishes loading would be dropped, so they
 * wait here until its `ready` handshake arrives.
 */
let outbox = [];

function attachWindow(w) {
  win = w;
}

function pushLog(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  ring.push(stamped);
  if (ring.length > LOG_RING) ring.shift();
  if (!logStream) {
    try {
      fs.mkdirSync(paths.dirs.logs(), { recursive: true });
      logStream = fs.createWriteStream(path.join(paths.dirs.logs(), 'cardsvc.log'), { flags: 'a' });
    } catch { /* logging must never break the app */ }
  }
  try { logStream?.write(`${stamped}\n`); } catch { /* disk full — keep going */ }
}

function setState(next, detail) {
  if (state === next) return;
  state = next;
  pushLog(`state → ${next}${detail ? ` (${detail})` : ''}`);
  send('carddb:state', { state, restarts });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function start() {
  if (child) return;
  setState('starting');

  // ⚠️ Packaging note: utilityProcess.fork must resolve a script inside
  // app.asar. Verify this in an INSTALLED build (M5) — if it fails there, add
  // electron/cardsvc-worker.cjs to build.asarUnpack and fork the unpacked copy.
  child = utilityProcess.fork(WORKER, [], {
    serviceName: 'commanders-roundtable-carddb',
    stdio: 'ignore',
  });

  child.on('message', (message) => {
    if (!message || typeof message !== 'object') return;

    if (message.t === 'ready') {
      setState('ready');
      const queued = outbox;
      outbox = [];
      for (const envelope of queued) {
        try { child?.postMessage(envelope); } catch { /* the exit handler rejects it */ }
      }
      return;
    }
    if (message.t === 'log') {
      pushLog(message.line);
      return;
    }
    if (message.t === 'progress') {
      // Straight through to the renderer; the worker already throttles.
      send('carddb:progress', message);
      return;
    }

    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.ok) entry.resolve(message.value);
    else entry.reject(Object.assign(new Error(message.error?.message ?? 'worker error'), {
      code: message.error?.code ?? 'error',
    }));
  });

  child.on('exit', (code) => {
    const wasReady = state === 'ready';
    child = null;
    // Drop anything still waiting on the handshake — its promise is rejected
    // below, so flushing it into a replacement worker would double-run it.
    outbox = [];
    // Fail every in-flight request; leaving them pending would hang the UI.
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(Object.assign(new Error('The card database worker stopped.'), {
        code: 'workerGone',
      }));
    }
    pending.clear();

    if (shuttingDown) {
      setState('stopped', `exit ${code}`);
      return;
    }
    setState('crashed', `exit ${code}`);
    // A crash is not a one-way door: restart lazily on the next request rather
    // than in a tight loop, so a worker that crashes on boot cannot spin.
    if (wasReady) pushLog('worker will restart on next request');
  });

  return child;
}

let shuttingDown = false;

function ensureStarted() {
  if (!child) {
    if (state === 'crashed') restarts += 1;
    start();
  }
}

/** Send a request and await its reply. */
function call(t, payload) {
  ensureStarted();
  if (!child) return Promise.reject(new Error('Could not start the card database worker.'));

  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = UNTIMED.has(t)
      ? null
      : setTimeout(() => {
          pending.delete(id);
          reject(Object.assign(new Error(`Card database request '${t}' timed out.`), {
            code: 'timeout',
          }));
        }, REQUEST_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
    const envelope = { id, t, payload };
    if (state !== 'ready') {
      // Hold it until the handshake; the 'ready' branch flushes the outbox.
      outbox.push(envelope);
      return;
    }
    try {
      child.postMessage(envelope);
    } catch (e) {
      pending.delete(id);
      if (timer) clearTimeout(timer);
      reject(e);
    }
  });
}

/** Worker OS pid, or null when it is not running. Diagnostics + crash tests. */
function getPid() {
  return child?.pid ?? null;
}

async function getStatus() {
  // Report supervisor state even when the worker is down, so the UI can say
  // "the card database stopped" rather than showing a spinner forever.
  if (state === 'crashed' || state === 'not-started') {
    let disk = { state: 'unknown' };
    try { disk = await call('status'); } catch { /* worker still unavailable */ }
    return { ...disk, worker: state, restarts };
  }
  try {
    return { ...(await call('status')), worker: state, restarts, pid: getPid() };
  } catch (e) {
    return { state: 'unknown', worker: state, restarts, error: e.message };
  }
}

function sync(payload) { return call('sync', payload); }
function cancel() { return call('cancel'); }
function stats() { return call('stats'); }

function getLogTail() {
  return ring.join('\n');
}

async function restart() {
  pushLog('restart requested');
  if (child) {
    try { child.kill(); } catch { /* already gone */ }
    child = null;
  }
  restarts += 1;
  start();
  return { restarted: true };
}

function shutdown() {
  shuttingDown = true;
  if (child) {
    try { child.kill(); } catch { /* already gone */ }
    child = null;
  }
  try { logStream?.end(); } catch { /* ignore */ }
}

module.exports = {
  attachWindow,
  start,
  getPid,
  /** Raw request escape hatch, used by ipc.cjs for the query channels. */
  call,
  getStatus,
  sync,
  cancel,
  stats,
  restart,
  shutdown,
  getLogTail,
  get state() { return state; },
};
