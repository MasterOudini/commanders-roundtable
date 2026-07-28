// Card art: where it comes from, and the queue that fetches it.
//
// ⚠️ Card art is Wizards of the Coast's copyright. It is NEVER bundled into the
// installer and NEVER relayed between players — each player's own app fetches its
// own copy from Scryfall and caches it locally. A packaging audit (M5) asserts
// that no image files exist under release/.
//
// ─── URL derivation, measured 2026-07-26 ───
//
// Scryfall image URLs are fully derivable from the card id, so the projection
// does not need to store image_uris (which would have added ~34 MB to the
// NDJSON for 113k cards):
//
//   https://cards.scryfall.io/<tier>/<face>/<id[0]>/<id[1]>/<id>.<ext>
//
// Verified: no `?<timestamp>` cache-buster is required; the front face exists for
// every card; a `back` image exists exactly when the card has per-face images
// (our `singleImage: false`), and 404s otherwise. Confirmed against transform,
// modal_dfc and split layouts.
//
// Sizes, for expectation-setting: png ≈ 0.8–1.7 MB, art_crop ≈ 40 KB. So the
// queue fetches art_crop for a whole deck first — a few MB, and cards become
// recognisable within seconds through the `chit` render mode — then upgrades to
// png in a second pass. useCardImage's fallback chain already handles the
// in-between state.

const fs = require('fs');
const path = require('path');

const paths = require('./paths.cjs');
const scryfall = require('./scryfall.cjs');
const cardimg = require('./cardimg.cjs');
const { readJson, writeJsonAtomic } = require('./jsonstore.cjs');

/** Tier → file extension on Scryfall's CDN. */
const TIER_EXT = {
  png: 'png',
  large: 'jpg',
  normal: 'jpg',
  small: 'jpg',
  art_crop: 'jpg',
};

const CONCURRENCY = 6;
/** Beyond this a caller is doing something unreasonable; refuse rather than churn. */
const MAX_ENQUEUE = 3000;
/** Retry schedule in ms. A 404 is permanent and never retried. */
const BACKOFF_MS = [1000, 4000, 15_000, 60_000];

/**
 * Split an imageId into its card id and face.
 *   '<uuid>'    → front  (single-image card)
 *   '<uuid>-0'  → front  (first face of a per-face-image card)
 *   '<uuid>-1'  → back
 */
function parseImageId(imageId) {
  if (typeof imageId !== 'string') return null;
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-([01]))?$/.exec(imageId);
  if (!m) return null;
  return { cardId: m[1], face: m[2] === '1' ? 'back' : 'front' };
}

function imageUrlFor(tier, imageId) {
  const ext = TIER_EXT[tier];
  const parsed = parseImageId(imageId);
  if (!ext || !parsed) return null;
  const { cardId, face } = parsed;
  return `https://cards.scryfall.io/${tier}/${face}/${cardId[0]}/${cardId[1]}/${cardId}.${ext}`;
}

// ── queue state ──────────────────────────────────────────────────

const QUEUE_VERSION = 1;

/** `${tier}/${imageId}` → the unit of work. */
function keyOf(tier, imageId) {
  return `${tier}/${imageId}`;
}
function splitKey(key) {
  const cut = key.indexOf('/');
  return { tier: key.slice(0, cut), imageId: key.slice(cut + 1) };
}

let state = null;

function loadQueue() {
  if (state) return state;
  const saved = readJson(paths.files.imageQueue(), null);
  state = {
    version: QUEUE_VERSION,
    pending: [],
    /** key → { attempts, code } for things that failed but may be retried. */
    failed: {},
    /** key → code for permanent failures (404 and friends). Never retried. */
    dead: {},
  };
  if (saved && saved.version === QUEUE_VERSION) {
    if (Array.isArray(saved.pending)) {
      state.pending = saved.pending.filter((k) => typeof k === 'string');
    }
    if (saved.failed && typeof saved.failed === 'object') state.failed = saved.failed;
    if (saved.dead && typeof saved.dead === 'object') state.dead = saved.dead;
  }
  return state;
}

/** Persist so an interrupted prefetch resumes on the next launch. */
function saveQueue() {
  if (!state) return;
  writeJsonAtomic(paths.files.imageQueue(), state);
}

function queueStatus() {
  const s = loadQueue();
  return {
    pending: s.pending.length,
    failed: Object.keys(s.failed).length,
    dead: Object.keys(s.dead).length,
    running,
  };
}

/**
 * Add work. Already-cached and permanently-dead entries are skipped, so calling
 * this repeatedly with the same deck is cheap and idempotent.
 *
 * @returns {{added:number, alreadyCached:number, skippedDead:number, refused?:string}}
 */
function enqueue(items) {
  const s = loadQueue();
  if (!Array.isArray(items)) return { added: 0, alreadyCached: 0, skippedDead: 0 };
  if (items.length > MAX_ENQUEUE) {
    return {
      added: 0,
      alreadyCached: 0,
      skippedDead: 0,
      refused: `Refusing ${items.length} images at once (limit ${MAX_ENQUEUE}).`,
    };
  }

  const already = new Set(s.pending);
  let added = 0;
  let alreadyCached = 0;
  let skippedDead = 0;

  for (const item of items) {
    const tier = item?.tier;
    const imageId = item?.imageId;
    if (!TIER_EXT[tier] || !parseImageId(imageId)) continue;
    const key = keyOf(tier, imageId);
    if (already.has(key)) continue;
    if (s.dead[key]) { skippedDead += 1; continue; }
    if (cardimg.has(tier, imageId)) { alreadyCached += 1; continue; }
    s.pending.push(key);
    already.add(key);
    added += 1;
  }

  if (added > 0) saveQueue();
  return { added, alreadyCached, skippedDead };
}

/**
 * Build the want-list for a set of cards: art_crop for every face first (cheap,
 * makes the deck recognisable fast), then the fidelity tier.
 */
function wantListFor(cards, fidelityTier = 'png') {
  const crops = [];
  const full = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    for (const face of card?.faces ?? []) {
      if (!face?.imageId) continue;
      crops.push({ tier: 'art_crop', imageId: face.imageId });
      full.push({ tier: fidelityTier, imageId: face.imageId });
    }
    // A single-image card's faces all share one imageId — de-duplicated below.
  }
  const seen = new Set();
  return [...crops, ...full].filter((item) => {
    const key = keyOf(item.tier, item.imageId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── the runner ───────────────────────────────────────────────────

let running = false;
let activeCancel = null;
let drainTimer = null;

/**
 * Ensure a non-empty queue always has something draining it.
 *
 * ⚠️ Without this, work can strand: items are re-queued after a backoff (via a
 * timer that fires long after the workers have exited), and `enqueue` can land in
 * the window between the last worker returning and `running` going false. Either
 * way the queue ends up non-empty with `running: false` and nothing to restart
 * it — observed as 2 images that simply never downloaded.
 *
 * The delay both breaks a tight loop when everything left is in backoff and gives
 * a burst of enqueues time to coalesce. `unref` so a pending drain never keeps the
 * worker process alive on its own.
 */
function scheduleDrain(delayMs = 750) {
  if (drainTimer || running) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    if (loadQueue().pending.length > 0 && !running) {
      void run({ onProgress: lastOnProgress }).catch(() => { /* logged by the caller */ });
    }
  }, delayMs);
  if (typeof drainTimer.unref === 'function') drainTimer.unref();
}

/** Kept so a self-scheduled drain keeps reporting progress to the same listener. */
let lastOnProgress = null;

/** Download one image to the cache. Returns 'saved' | 'cached' | throws. */
async function fetchOne(tier, imageId, { cancel } = {}) {
  if (cardimg.has(tier, imageId)) return 'cached';

  const url = imageUrlFor(tier, imageId);
  if (!url) {
    throw Object.assign(new Error(`Bad image request: ${tier}/${imageId}`), { code: 'badRequest' });
  }
  const dest = cardimg.cachePathFor(tier, imageId);
  if (!dest) {
    throw Object.assign(new Error(`Refusing cache path for ${tier}/${imageId}`), { code: 'badPath' });
  }

  await scryfall.download(url, dest, {
    cancel,
    // Images are small and the CDN has no partial-content story worth relying on;
    // a failed image is simply retried whole.
    allowResume: false,
    maxBytes: scryfall.LIMITS.imageMaxBytes,
  });
  return 'saved';
}

/**
 * Drain the queue with bounded concurrency.
 *
 * Spacing between requests is enforced globally inside scryfall.download (see the
 * rate-limit note there — it is a serialized gate precisely so concurrent workers
 * here cannot all fire at once).
 */
async function run({ onProgress, cancel } = {}) {
  if (running) return { alreadyRunning: true };
  const s = loadQueue();
  if (s.pending.length === 0) return { done: true, saved: 0, failed: 0 };

  running = true;
  activeCancel = cancel ?? scryfall.createCancelToken();
  if (onProgress) lastOnProgress = onProgress;

  const total = s.pending.length;
  let saved = 0;
  let cachedAlready = 0;
  let failed = 0;
  let lastReport = 0;

  const report = (force = false) => {
    const now = Date.now();
    if (!force && now - lastReport < 320) return;
    lastReport = now;
    onProgress?.({
      phase: 'images',
      done: saved + cachedAlready + failed,
      total,
      saved,
      failed,
      pending: s.pending.length,
    });
  };

  const worker = async () => {
    for (;;) {
      if (activeCancel.cancelled) return;
      const key = s.pending.shift();
      if (key === undefined) return;

      const { tier, imageId } = splitKey(key);
      try {
        const result = await fetchOne(tier, imageId, { cancel: activeCancel });
        if (result === 'saved') saved += 1;
        else cachedAlready += 1;
        delete s.failed[key];
      } catch (e) {
        if (e.code === 'cancelled') {
          // Put it back — this is a resume point, not a failure.
          s.pending.unshift(key);
          return;
        }
        // A 404 means the image genuinely does not exist at that tier/face.
        // Retrying it forever would be pointless traffic.
        if (e.code === 'http404') {
          s.dead[key] = 'notFound';
          failed += 1;
        } else {
          const prior = s.failed[key]?.attempts ?? 0;
          const attempts = prior + 1;
          if (attempts > BACKOFF_MS.length) {
            s.dead[key] = e.code ?? 'error';
            delete s.failed[key];
            failed += 1;
          } else {
            s.failed[key] = { attempts, code: e.code ?? 'error' };
            // Re-queue at the BACK, after a backoff, so one bad entry cannot
            // block the rest of the deck. scheduleDrain matters here: this timer
            // fires after the workers have exited, so without it the re-queued
            // item would sit in `pending` with nothing running.
            const delay = BACKOFF_MS[attempts - 1];
            const retry = setTimeout(() => {
              if (!s.pending.includes(key)) {
                s.pending.push(key);
                saveQueue();
              }
              scheduleDrain(0);
            }, delay);
            if (typeof retry.unref === 'function') retry.unref();
          }
        }
      }
      report();
    }
  };

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  } finally {
    running = false;
    const wasCancelled = activeCancel.cancelled;
    activeCancel = null;
    saveQueue();
    report(true);
    // Anything that arrived while we were finishing — or was re-queued after a
    // backoff — gets picked up rather than stranded. Not scheduled after a
    // cancel: the user asked it to stop.
    if (!wasCancelled && s.pending.length > 0) scheduleDrain();
    if (wasCancelled) {
      return { cancelled: true, saved, failed, pending: s.pending.length };
    }
  }

  return { done: true, saved, cachedAlready, failed, pending: s.pending.length };
}

function cancelRun() {
  if (!activeCancel) return { cancelled: false, reason: 'no prefetch running' };
  activeCancel.cancel('user');
  return { cancelled: true };
}

/** Which of a want-list is still missing from disk. For verification and UI. */
function missingOf(items) {
  return (Array.isArray(items) ? items : []).filter(
    (item) => !cardimg.has(item?.tier, item?.imageId),
  );
}

/** Total bytes the cache occupies, and a file count, for the settings screen. */
function cacheUsage() {
  let bytes = 0;
  let files = 0;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try { bytes += fs.statSync(full).size; files += 1; } catch { /* vanished */ }
      }
    }
  };
  walk(paths.dirs.images());
  return { bytes, files };
}

module.exports = {
  TIER_EXT,
  CONCURRENCY,
  MAX_ENQUEUE,
  BACKOFF_MS,
  parseImageId,
  imageUrlFor,
  wantListFor,
  enqueue,
  run,
  cancelRun,
  queueStatus,
  loadQueue,
  saveQueue,
  missingOf,
  cacheUsage,
  fetchOne,
};
