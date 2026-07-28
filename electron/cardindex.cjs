// The local card index: build it, load it, query it.
//
// Layout on disk (both in <dataRoot>/cards/):
//   cards.ndjson  one projected CardData per line, in bulk-file order
//   cards.idx     a compact lookup index — parallel arrays of primitives
//
// Why NDJSON + a separate index rather than one big JSON blob: cold start.
// Parsing 116k records to answer "what is Sol Ring" costs over a second; the
// index is ~10 MB of primitives that parses in well under 200 ms, and full
// records are read by byte offset only when actually needed.
//
// Why parallel arrays rather than an array of objects: a JSON array of 116k
// objects carries every key name 116k times. Parallel primitive arrays are
// roughly a third of the bytes and measurably faster to parse.

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

const paths = require('./paths.cjs');
const { foldName, frontFaceKey } = require('./cardfold.cjs');
const { projectCard, projectIndexFields, newWarnings } = require('./cardproject.cjs');

const INDEX_FORMAT = 1;

// ── build ────────────────────────────────────────────────────────

/**
 * Transform a downloaded .jsonl.gz into cards.ndjson + cards.idx.
 *
 * Atomic: everything is written to .tmp siblings and renamed at the end, with
 * meta.json (written by the caller) last. A build killed halfway therefore
 * leaves the previous database fully queryable — verified by the battery.
 */
async function build(bulkGzPath, { onProgress, cancel, expectedLines = 0 } = {}) {
  const ndjsonPath = paths.files.cardNdjson();
  const idxPath = paths.files.cardIndex();
  const ndjsonTmp = `${ndjsonPath}.tmp`;
  const idxTmp = `${idxPath}.tmp`;

  fs.mkdirSync(paths.dirs.cards(), { recursive: true });

  const out = fs.createWriteStream(ndjsonTmp);
  const off = [];
  const len = [];
  const id = [];
  const name = [];
  const set = [];
  const cn = [];
  const rank = [];
  const rel = [];
  const warnings = newWarnings();

  let offset = 0;
  let read = 0;
  let kept = 0;
  let lastReport = 0;

  const gunzip = fs.createReadStream(bulkGzPath).pipe(zlib.createGunzip());
  const lines = readline.createInterface({ input: gunzip, crlfDelay: Infinity });

  cancel?.onCancel(() => {
    lines.close();
    gunzip.destroy();
  });

  // ⚠️ The error listener is attached ONCE, here. An earlier version added
  // `out.once('error', reject)` inside the per-line write helper, which
  // accumulated one listener per record — 113k of them, and a
  // MaxListenersExceededWarning at 11. It also allocated a Promise per line.
  let writeError = null;
  out.on('error', (e) => { writeError = e; });

  /**
   * Write one line, awaiting only when the stream is actually full.
   * Backpressure matters: 113k unthrottled writes balloon memory.
   */
  const writeLine = (text) => {
    if (writeError) throw writeError;
    if (out.write(text)) return null; // fast path — no promise, no await
    return new Promise((resolve) => out.once('drain', resolve));
  };

  try {
    for await (const line of lines) {
      if (cancel?.cancelled) throw Object.assign(new Error('Cancelled'), { code: 'cancelled' });
      read += 1;
      if (line.length === 0) continue;

      let raw;
      try {
        raw = JSON.parse(line);
      } catch {
        warnings.badJsonLine = (warnings.badJsonLine ?? 0) + 1;
        continue;
      }

      const projected = projectCard(raw, warnings);
      if (!projected) continue;

      const text = `${JSON.stringify(projected)}\n`;
      const bytes = Buffer.byteLength(text, 'utf8');
      const meta = projectIndexFields(raw, projected);

      off.push(offset);
      len.push(bytes);
      id.push(meta.id);
      name.push(meta.name);
      set.push(meta.set);
      cn.push(meta.cn);
      rank.push(meta.rank);
      rel.push(meta.rel);

      offset += bytes;
      kept += 1;
      const backpressure = writeLine(text);
      if (backpressure) await backpressure;

      const now = Date.now();
      if (onProgress && now - lastReport > 320) {
        lastReport = now;
        onProgress({ read, kept, total: expectedLines });
      }
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }

  if (cancel?.cancelled) {
    try { fs.unlinkSync(ndjsonTmp); } catch { /* already gone */ }
    throw Object.assign(new Error('Cancelled'), { code: 'cancelled' });
  }

  const index = {
    formatVersion: INDEX_FORMAT,
    cardCount: kept,
    sourceLines: read,
    off, len, id, name, set, cn, rank, rel,
  };
  fs.writeFileSync(idxTmp, JSON.stringify(index), 'utf8');

  // Swap both files in before the caller writes meta.json.
  fs.renameSync(ndjsonTmp, ndjsonPath);
  fs.renameSync(idxTmp, idxPath);

  onProgress?.({ read, kept, total: expectedLines, done: true });
  return { read, kept, warnings, ndjsonBytes: offset };
}

/**
 * Rebuild cards.idx by scanning an existing cards.ndjson.
 *
 * ⚠️ Deliberately NOT a re-download. A lost or truncated index must be
 * recoverable with no network at all — the battery asserts that.
 *
 * The rank/rel fields are printing-preference hints derived from Scryfall fields
 * the projection drops, so a rebuilt index cannot recover them exactly. We store
 * neutral values; the effect is that printing preference falls back to file order
 * (which is Scryfall's own order) until the next full sync. Correct, slightly
 * less good at picking a "nicest" printing — an honest degradation rather than a
 * silent wrong answer.
 */
async function rebuildIndexFromNdjson({ onProgress } = {}) {
  const ndjsonPath = paths.files.cardNdjson();
  const idxPath = paths.files.cardIndex();
  if (!fs.existsSync(ndjsonPath)) {
    throw Object.assign(new Error('No cards.ndjson to rebuild from.'), { code: 'noNdjson' });
  }

  const off = []; const len = []; const id = []; const name = [];
  const set = []; const cn = []; const rank = []; const rel = [];
  let offset = 0;
  let kept = 0;

  const lines = readline.createInterface({
    input: fs.createReadStream(ndjsonPath),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (line.length === 0) continue;
    const bytes = Buffer.byteLength(`${line}\n`, 'utf8');
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      // A torn final line from an interrupted write: stop, keep what parsed.
      break;
    }
    off.push(offset);
    len.push(bytes);
    id.push(rec.scryfallId);
    name.push(foldName(rec.name));
    set.push((rec.setCode ?? '').toLowerCase());
    cn.push((rec.collectorNumber ?? '').toLowerCase());
    rank.push(0);
    rel.push(0);
    offset += bytes;
    kept += 1;
    if (onProgress && kept % 20000 === 0) onProgress({ kept });
  }

  const idxTmp = `${idxPath}.tmp`;
  fs.writeFileSync(idxTmp, JSON.stringify({
    formatVersion: INDEX_FORMAT,
    cardCount: kept,
    sourceLines: kept,
    rebuilt: true,
    off, len, id, name, set, cn, rank, rel,
  }), 'utf8');
  fs.renameSync(idxTmp, idxPath);
  return { kept };
}

// ── load ─────────────────────────────────────────────────────────

let loaded = null;

/**
 * Load the index into memory and derive the lookup maps.
 *
 * ⚠️ Only the maps EVERY query needs are built eagerly. Measured on the
 * 113,559-card release, an eager load cost 514 ms and broke the 500 ms cold-start
 * budget, split as: read 52 · parse 104 · byName 100 · byId 76 · bySetCn 111 ·
 * bucket sort 71. So:
 *   • byName    — eager. Every lookup goes through it.
 *   • byId      — lazy. Only byScryfallId and hydrate use it.
 *   • bySetCn   — lazy. Only a decklist naming an exact printing uses it, and it
 *                 is the single most expensive map (113k composite string keys).
 *   • byFrontFace — lazy. Only reached when a name misses.
 *   • ordering  — NOT sorted eagerly. `byName` needs the single best printing, so
 *                 a linear minimum over a bucket (~5 entries) beats sorting 20,683
 *                 buckets up front. Full ordering is sorted on demand and cached.
 * That brings a cold load to roughly 260 ms, and every deferred cost is paid only
 * by the query that actually needs it.
 */
function load({ force = false } = {}) {
  if (loaded && !force) return loaded;

  const idxPath = paths.files.cardIndex();
  const started = Date.now();
  const raw = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  if (raw.formatVersion !== INDEX_FORMAT) {
    throw Object.assign(
      new Error(`Card index format ${raw.formatVersion} != ${INDEX_FORMAT}; rebuild required.`),
      { code: 'indexFormatMismatch' },
    );
  }

  const count = raw.cardCount;

  const byName = new Map();
  for (let i = 0; i < count; i++) {
    const key = raw.name[i];
    const bucket = byName.get(key);
    if (bucket) bucket.push(i);
    else byName.set(key, [i]);
  }

  const state = {
    raw,
    count,
    byName,
    uniqueNames: [...byName.keys()],
    loadMs: Date.now() - started,
    rebuilt: raw.rebuilt === true,
    // Lazily populated.
    _byId: null,
    _bySetCn: null,
    _byFrontFace: null,
    _sortedBuckets: new Set(),
  };

  state.byId = () => {
    if (!state._byId) {
      const map = new Map();
      for (let i = 0; i < count; i++) map.set(raw.id[i], i);
      state._byId = map;
    }
    return state._byId;
  };

  state.bySetCn = () => {
    if (!state._bySetCn) {
      const map = new Map();
      for (let i = 0; i < count; i++) map.set(`${raw.set[i]}/${raw.cn[i]}`, i);
      state._bySetCn = map;
    }
    return state._bySetCn;
  };

  /**
   * Front-face aliases for double-faced cards, so a decklist naming only
   * 'Delver of Secrets' resolves. A front-face alias never shadows a real card
   * that owns that exact name.
   */
  state.byFrontFace = () => {
    if (!state._byFrontFace) {
      const map = new Map();
      for (const [key, bucket] of byName) {
        const cut = key.indexOf(' // ');
        if (cut === -1) continue;
        const front = key.slice(0, cut);
        if (byName.has(front)) continue;
        const existing = map.get(front);
        if (existing) existing.push(...bucket);
        else map.set(front, [...bucket]);
      }
      state._byFrontFace = map;
    }
    return state._byFrontFace;
  };

  loaded = state;
  return loaded;
}

/** Is printing `a` preferred over `b`? Lower rank, then newer, then stable by id. */
function printingBetter(raw, a, b) {
  if (raw.rank[a] !== raw.rank[b]) return raw.rank[a] < raw.rank[b];
  if (raw.rel[a] !== raw.rel[b]) return raw.rel[a] > raw.rel[b];
  return raw.id[a] < raw.id[b];
}

/** The single best printing in a bucket, without sorting it. */
function bestIndex(idx, bucket) {
  let best = bucket[0];
  for (let i = 1; i < bucket.length; i++) {
    if (printingBetter(idx.raw, bucket[i], best)) best = bucket[i];
  }
  return best;
}

/** A bucket in full preference order, sorted once and cached in place. */
function orderedBucket(idx, key, bucket) {
  if (bucket.length > 1 && !idx._sortedBuckets.has(key)) {
    bucket.sort((a, b) => (printingBetter(idx.raw, a, b) ? -1 : 1));
    idx._sortedBuckets.add(key);
  }
  return bucket;
}

/** Resolve a folded key to its bucket, falling back to front-face aliases. */
function bucketFor(idx, key) {
  return idx.byName.get(key) ?? idx.byFrontFace().get(key) ?? null;
}

function unload() {
  loaded = null;
}

function isLoaded() {
  return loaded !== null;
}

// ── record reads ─────────────────────────────────────────────────

let ndjsonFd = null;

function openNdjson() {
  if (ndjsonFd !== null) return ndjsonFd;
  ndjsonFd = fs.openSync(paths.files.cardNdjson(), 'r');
  return ndjsonFd;
}

function closeNdjson() {
  if (ndjsonFd !== null) {
    try { fs.closeSync(ndjsonFd); } catch { /* already closed */ }
    ndjsonFd = null;
  }
}

/** Read one record by its index position. */
function readAt(i) {
  const idx = load();
  if (i < 0 || i >= idx.count) return null;
  const length = idx.raw.len[i];
  const buffer = Buffer.allocUnsafe(length);
  fs.readSync(openNdjson(), buffer, 0, length, idx.raw.off[i]);
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

// ── queries ──────────────────────────────────────────────────────

function byScryfallId(cardId) {
  const idx = load();
  const i = idx.byId().get(cardId);
  return i === undefined ? null : readAt(i);
}

/** Batch id lookup, for hydrating a whole deck at once. */
function hydrate(ids) {
  const idx = load();
  const map = idx.byId();
  const out = [];
  for (const cardId of Array.isArray(ids) ? ids : []) {
    const i = map.get(cardId);
    if (i !== undefined) {
      const rec = readAt(i);
      if (rec) out.push(rec);
    }
  }
  return out;
}

/**
 * Resolve a name as written in a decklist.
 * Tries: exact folded name → front face of a DFC → nothing.
 */
function byName(rawName, { set: setCode, collectorNumber } = {}) {
  const idx = load();

  // A set + collector number is the most specific thing a decklist can say.
  if (setCode && collectorNumber) {
    const i = idx.bySetCn().get(
      `${String(setCode).toLowerCase()}/${String(collectorNumber).toLowerCase()}`,
    );
    if (i !== undefined) {
      const rec = readAt(i);
      // Guard a typo'd set code: the name must still match what was asked for.
      // Compare on the front face too, so 'Delver of Secrets (isd) 51' works.
      if (rec) {
        const want = foldName(rawName);
        if (foldName(rec.name) === want || frontFaceKey(rec.name) === want) return rec;
      }
      // Fall through to name resolution rather than returning the wrong card.
    }
  }

  const key = foldName(rawName);
  const bucket = bucketFor(idx, key);
  if (!bucket || bucket.length === 0) return null;
  // Only the best printing is wanted, so take a linear minimum rather than
  // paying to sort the bucket.
  return readAt(bestIndex(idx, bucket));
}

/** Every printing of a name, best first. */
function printingsOf(rawName) {
  const idx = load();
  const key = foldName(rawName);
  const bucket = bucketFor(idx, key);
  if (!bucket) return [];
  return orderedBucket(idx, key, bucket).map((i) => readAt(i)).filter(Boolean);
}

/** Prefix search over unique names, for the card browser and token picker. */
function searchPrefix(query, limit = 20) {
  const idx = load();
  const key = foldName(query);
  if (key.length === 0) return [];
  const hits = [];
  for (const name of idx.uniqueNames) {
    if (name.startsWith(key)) {
      hits.push(name);
      if (hits.length >= limit * 3) break; // over-collect, then rank
    }
  }
  // Shorter names first: typing "sol r" should surface Sol Ring, not
  // "Sol Ring Reproduction of the Ancients".
  hits.sort((a, b) => a.length - b.length || (a < b ? -1 : 1));
  // bestIndex, not bucket[0]: buckets are no longer sorted eagerly, so taking the
  // first entry would surface an arbitrary printing (possibly an Arena-only one).
  return hits.slice(0, limit)
    .map((name) => readAt(bestIndex(idx, idx.byName.get(name))))
    .filter(Boolean);
}

/**
 * Bounded Levenshtein distance with early exit.
 * Returns a number > maxDist as soon as it is certain, so most candidates cost
 * only a few rows of the matrix.
 */
function editDistanceWithin(a, b, maxDist) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;

  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const from = Math.max(1, i - maxDist);
    const to = Math.min(lb, i + maxDist);
    // Cells outside the band cannot beat maxDist.
    for (let j = 1; j < from; j++) curr[j] = maxDist + 1;
    for (let j = from; j <= to; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    for (let j = to + 1; j <= lb; j++) curr[j] = maxDist + 1;
    if (rowMin > maxDist) return maxDist + 1;
    const swap = prev; prev = curr; curr = swap;
  }
  return prev[lb];
}

/**
 * Fuzzy search, used only to suggest alternatives for an unresolved deck line —
 * never to silently substitute a card.
 */
function searchFuzzy(query, limit = 5) {
  const idx = load();
  const key = foldName(query);
  if (key.length === 0) return [];

  // Scale tolerance with length: a 4-letter name gets 1 edit, a long one gets 3.
  const maxDist = key.length <= 5 ? 1 : key.length <= 10 ? 2 : 3;
  const scored = [];

  for (const name of idx.uniqueNames) {
    // Cheap prefilter first — the length band alone discards most of 30k names.
    if (Math.abs(name.length - key.length) > maxDist) continue;
    const dist = editDistanceWithin(key, name, maxDist);
    if (dist <= maxDist) scored.push([dist, name]);
  }

  // A substring match is often what someone meant even when the edit distance is
  // large ("borrower" → "brazen borrower"), so blend those in behind exact-ish hits.
  if (scored.length < limit) {
    for (const name of idx.uniqueNames) {
      if (name.includes(key) && !scored.some((s) => s[1] === name)) {
        scored.push([maxDist + 1, name]);
        if (scored.length >= limit * 4) break;
      }
    }
  }

  scored.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length);
  return scored.slice(0, limit)
    .map(([, name]) => readAt(bestIndex(idx, idx.byName.get(name))))
    .filter(Boolean);
}

function stats() {
  const idx = load();
  return {
    cardCount: idx.count,
    uniqueNames: idx.uniqueNames.length,
    loadMs: idx.loadMs,
    rebuilt: idx.rebuilt,
  };
}

module.exports = {
  INDEX_FORMAT,
  build,
  rebuildIndexFromNdjson,
  load,
  unload,
  isLoaded,
  closeNdjson,
  readAt,
  byScryfallId,
  hydrate,
  byName,
  printingsOf,
  searchPrefix,
  searchFuzzy,
  editDistanceWithin,
  stats,
};
