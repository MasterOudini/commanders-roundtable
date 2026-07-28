// Append-only game logs: `<dataRoot>/games/<gameId>.ndjson`, one event per line.
//
// ⚠️ NDJSON, not JSON and not SQLite. Append-only on disk mirrors append-only in
// memory, which is the invariant the whole engine rests on. It is crash-safe (a
// torn final line is discarded on load rather than corrupting the file), it
// replays through the same `apply()` the live game used, and it is readable in a
// text editor — which matters enormously when a pod is arguing about what
// happened three turns ago.
//
// ⚠️ THE RENDERER NEVER NAMES A FILE. It passes a game id; this module resolves
// it inside the games directory through the capability gate, exactly like
// decks.cjs. A generic "append to this path" channel is the one thing the IPC
// rules at the top of ipc.cjs forbid outright.

const fs = require('node:fs');
const path = require('node:path');

const { dirs } = require('./paths.cjs');
const { resolveInsideDir } = require('./capability.cjs');

/** Keep it boring: ids come from the host session and are already opaque. */
function logPath(gameId) {
  fs.mkdirSync(dirs.games(), { recursive: true });
  return resolveInsideDir(dirs.games(), `${gameId}.ndjson`);
}

function desyncPath() {
  fs.mkdirSync(dirs.games(), { recursive: true });
  return path.join(dirs.games(), 'desync.log');
}

/**
 * Append events. Each entry is written as one line of canonical JSON.
 *
 * ⚠️ ONE `appendFileSync` FOR THE WHOLE BATCH, not one per line. D12b measured
 * the cost of the other shape on the card-database transform: a per-line write
 * helper that attached a listener and allocated a Promise per record turned an
 * 18-second build into a 40-second one. A group of engine work is 1–30 events
 * and arrives many times a second; joining them first is the difference between
 * one syscall and thirty.
 */
function append(gameId, events) {
  const file = logPath(gameId);
  if (!file) return { ok: false, written: 0, message: 'That game id is not valid.' };
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) return { ok: true, written: 0, message: '' };
  let text = '';
  for (const event of list) text += `${JSON.stringify(event)}\n`;
  fs.appendFileSync(file, text, 'utf8');
  return { ok: true, written: list.length, message: '' };
}

/**
 * Read a log back.
 *
 * ⚠️ A torn final line is DISCARDED, not repaired and not thrown on. A crash
 * mid-append leaves a partial line, and the honest recovery is "the game is one
 * event shorter than it was" — which replays cleanly — rather than a parse error
 * that makes the whole file unopenable.
 */
function read(gameId) {
  const file = logPath(gameId);
  if (!file || !fs.existsSync(file)) return { ok: false, events: [], truncated: false };
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const events = [];
  let truncated = false;
  for (const [i, line] of lines.entries()) {
    if (line === '') continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Only the LAST line may legitimately be torn. Anything else is a real
      // corruption and worth saying so.
      truncated = true;
      if (i !== lines.length - 1) break;
    }
  }
  return { ok: true, events, truncated };
}

function list() {
  const dir = dirs.games();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.ndjson'))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { gameId: name.slice(0, -'.ndjson'.length), bytes: stat.size, updatedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Record a view-hash disagreement.
 *
 * ⚠️ BOTH SIDES WRITE THIS, and that is the point: "the board looked wrong once"
 * is not a bug report, whereas two files containing the same `eventCount` with
 * two different hashes is one that can be chased. It is a repair AND a record;
 * dropping the record because the repair worked is how a reproducible bug
 * becomes folklore.
 */
function desync(record) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...record });
  fs.appendFileSync(desyncPath(), `${line}\n`, 'utf8');
  return { ok: true };
}

function desyncTail(limit = 50) {
  const file = desyncPath();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-limit).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { raw: line };
    }
  });
}

module.exports = { append, read, list, desync, desyncTail, logPath };
