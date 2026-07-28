// Tiny atomic JSON store shared by settings.cjs, winstate.cjs and the deck
// index. Main-process only.
//
// ⚠️ BOM-free, always. A UTF-8 BOM in a JSON file the app reads once nuked a
// runtime config in this workspace: the reader got an empty object and
// overwrote the real config with defaults. Node's fs writes UTF-8 without a
// BOM, so the rule is simply "never let PowerShell -Encoding utf8 near these
// files" — read them with utf-8-sig if you must touch them from a shell.
//
// ⚠️ Atomic, always. A torn settings.json costs the user their whole profile.
// Write to a sibling .tmp, fsync, then rename — rename is atomic on NTFS.

const fs = require('fs');
const path = require('path');

function readJson(file, fallback) {
  try {
    let text = fs.readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // tolerate a BOM we'd never write
    const parsed = JSON.parse(text);
    return parsed === null || typeof parsed !== 'object' ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, JSON.stringify(value, null, 2), 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    return true;
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ }
    return false;
  }
}

/**
 * Validate an untrusted object against a spec, dropping unknown keys and
 * replacing invalid values with their default. Returns a fresh object that only
 * ever contains keys the spec declares — which is what makes a hand-edited or
 * downgraded settings file safe to load.
 *
 * spec: { key: { default, check(value) -> boolean } }
 */
function coerce(spec, raw) {
  const out = {};
  const source = raw && typeof raw === 'object' ? raw : {};
  for (const [key, def] of Object.entries(spec)) {
    const value = source[key];
    out[key] = value !== undefined && def.check(value) ? value : def.default;
  }
  return out;
}

const is = {
  string: (v) => typeof v === 'string',
  nonEmptyString: (v) => typeof v === 'string' && v.trim().length > 0,
  boolean: (v) => typeof v === 'boolean',
  integer: (v) => Number.isInteger(v),
  oneOf: (...allowed) => (v) => allowed.includes(v),
  stringOrNull: (v) => v === null || typeof v === 'string',
  // ⚠️ Checks EVERY element, not just that it is an array. A settings value the
  // main process later splices into a CSP header must not be able to carry an
  // object through coercion untouched.
  stringArray: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
};

module.exports = { readJson, writeJsonAtomic, coerce, is };
