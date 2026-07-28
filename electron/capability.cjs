// Capability-gated filesystem access for the renderer.
//
// The renderer is treated as UNTRUSTED. It may only touch paths that the user
// authorized through a native OS dialog, plus the app's own data root. Every
// path-taking IPC handler in main.cjs MUST run its argument through
// canReadPath / canWritePath — there is deliberately no generic
// "read this file" / "write this file" channel.
//
// Adopted from cartapriscus/electron/main.cjs, whose security audit found an
// unvalidated FS bridge to be the weak point. Three sets:
//   authorizedFiles  — exact files from open/save/export dialogs (read + write)
//   authorizedDirs   — folders from directory dialogs (read within), persisted
//                      so a picked folder still works next launch
//   appWritableDirs  — the app's own data root (read + write)
//
// ⚠️ The OS temp directory is deliberately NOT app-writable. cartapriscus
// includes it because its export pipeline stages files there; this app writes
// nothing outside its data root, and temp is a shared, world-writable location
// where a stray write can land next to another program's files. A probe caught
// this: with temp allowed, every "outside the data root" assertion passed
// vacuously because the test paths were themselves in temp.

const fs = require('fs');
const path = require('path');
const { files, dataRoot } = require('./paths.cjs');

const authorizedFiles = new Set();
const authorizedDirs = new Set();
let appWritableDirs = [];

function resolvePathSafe(p) {
  if (typeof p !== 'string' || p.length === 0) return null;
  // A NUL byte truncates the path inside some syscalls — reject outright.
  if (p.includes('\0')) return null;
  try { return path.resolve(p); } catch { return null; }
}

/** Windows filesystems are case-insensitive; compare on a folded form. */
function fold(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

/**
 * Is `target` inside `dir` (or equal to it)?
 *
 * ⚠️ Uses path.relative, NOT startsWith. A prefix test says "/DEM-evil" is
 * inside "/DEM", which is a real escape. path.relative returns "../DEM-evil"
 * there, which we reject.
 */
function pathWithin(dir, target) {
  const rel = path.relative(fold(dir), fold(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function authorizeFile(p) {
  const n = resolvePathSafe(p);
  if (n) authorizedFiles.add(fold(n));
  return p;
}

function authorizeDir(p) {
  const n = resolvePathSafe(p);
  if (!n) return p;
  const key = fold(n);
  if (!authorizedDirs.has(key)) {
    authorizedDirs.add(key);
    persistAuthorizedDirs();
  }
  return p;
}

function canReadPath(p) {
  const n = resolvePathSafe(p);
  if (!n) return false;
  const key = fold(n);
  if (authorizedFiles.has(key)) return true;
  for (const d of authorizedDirs) if (pathWithin(d, n)) return true;
  for (const d of appWritableDirs) if (pathWithin(d, n)) return true;
  return false;
}

function canWritePath(p) {
  const n = resolvePathSafe(p);
  if (!n) return false;
  // Note: authorizedDirs grants READ only. A folder the user picked to browse
  // must not become a folder the renderer may write into.
  if (authorizedFiles.has(fold(n))) return true;
  for (const d of appWritableDirs) if (pathWithin(d, n)) return true;
  return false;
}

/**
 * Resolve a caller-supplied *filename* inside a directory we chose, stripping
 * any path structure. Use this whenever the renderer names a file in one of our
 * own folders (a deck id, a card image id) — it makes traversal impossible
 * rather than merely detectable.
 */
function resolveInsideDir(dir, unsafeName) {
  if (typeof unsafeName !== 'string' || unsafeName.length === 0) return null;
  const base = path.basename(unsafeName);
  if (!base || base === '.' || base === '..') return null;
  const full = path.join(dir, base);
  return pathWithin(dir, full) ? full : null;
}

function persistAuthorizedDirs() {
  try {
    fs.writeFileSync(files.authorizedDirs(), JSON.stringify([...authorizedDirs], null, 2), 'utf8');
  } catch { /* best effort — losing the allowlist only costs a re-pick */ }
}

/** Call once, after installAppPaths and before any IPC can fire. */
function init() {
  appWritableDirs = [dataRoot()]
    .map(resolvePathSafe)
    .filter(Boolean)
    .map(fold);
  try {
    const saved = JSON.parse(fs.readFileSync(files.authorizedDirs(), 'utf8'));
    if (Array.isArray(saved)) {
      for (const d of saved) {
        const n = resolvePathSafe(d);
        if (n) authorizedDirs.add(fold(n));
      }
    }
  } catch { /* first run — no persisted allowlist */ }
}

module.exports = {
  init,
  authorizeFile,
  authorizeDir,
  canReadPath,
  canWritePath,
  resolveInsideDir,
  resolvePathSafe,
  pathWithin,
};
