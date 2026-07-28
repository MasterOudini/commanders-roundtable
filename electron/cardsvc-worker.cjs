// The card-database worker.
//
// Runs in an Electron utilityProcess (a real Node child), NOT the main process.
// Downloading 77 MB and later inflating 620 MB of JSON would stall main's event
// loop, and a stalled main process is a frozen window — a sibling app in this
// workspace learned that with synchronous fs inside an IPC handler under load.
//
// Protocol: request/response with correlation ids over parentPort.
//   in   { id, t: 'status' | 'sync' | 'cancel' | 'stats', payload }
//   out  { id, ok, value | error }     a reply
//        { t: 'progress' | 'log' }     unsolicited
//
// Also runnable headless, which is how the download battery exercises resume and
// cancel without booting a window (same require.main pattern as
// mundifex/electron/setup.cjs):
//   node electron/cardsvc-worker.cjs --sync [--force] [--log-requests]
//   node electron/cardsvc-worker.cjs --status

const fs = require('fs');
const path = require('path');

const paths = require('./paths.cjs');
const scryfall = require('./scryfall.cjs');
const cardindex = require('./cardindex.cjs');
const cardimages = require('./cardimages.cjs');
const { readJson, writeJsonAtomic } = require('./jsonstore.cjs');

const DATASET = 'default_cards';
/** Bumped when the on-disk layout changes, so an old cache is rebuilt, not misread. */
const CACHE_FORMAT = 1;

/** A real default_cards release is ~110k printings; anything near this is broken. */
const MIN_PLAUSIBLE_CARDS = 10_000;

let currentCancel = null;
let phase = 'idle';

/** Swappable so the headless CLI can render progress without a parent port. */
let emit = (message) => {
  if (process.parentPort) process.parentPort.postMessage(message);
};

function log(...parts) {
  emit({ t: 'log', line: `[cardsvc] ${parts.join(' ')}` });
}

// ── on-disk state ────────────────────────────────────────────────

function readMeta() {
  const meta = readJson(paths.files.cardMeta(), null);
  if (!meta || meta.cacheFormat !== CACHE_FORMAT) return null;
  return meta;
}

/**
 * Where the bulk file for a given manifest entry lives. Named after the dataset
 * plus Scryfall's own release timestamp, so a new release is a new file and stale
 * ones can be pruned unambiguously.
 */
function bulkPathFor(info) {
  const stamp = String(info.updatedAt).replace(/[^0-9]/g, '').slice(0, 14);
  return path.join(paths.dirs.downloads(), `${info.type}-${stamp}.jsonl.gz`);
}

function status() {
  const meta = readMeta();
  if (!meta) return { state: 'absent', phase, cacheFormat: CACHE_FORMAT };
  return {
    // 'downloaded' means phase A is done but the index is not built yet (M1.6).
    state: meta.transformedAt ? 'ready' : 'downloaded',
    phase,
    dataset: meta.dataset,
    updatedAt: meta.updatedAt,
    downloadedAt: meta.downloadedAt,
    transformedAt: meta.transformedAt ?? null,
    cardCount: meta.cardCount ?? null,
    bulkBytes: meta.bulkBytes ?? null,
    bulkLines: meta.bulkLines ?? null,
    cacheFormat: meta.cacheFormat,
    ageDays: meta.updatedAt
      ? Math.floor((Date.now() - Date.parse(meta.updatedAt)) / 86_400_000)
      : null,
  };
}

/** Remove bulk files from older releases; keep the one we just used. */
function pruneOldBulkFiles(keepPath) {
  let removed = 0;
  try {
    for (const name of fs.readdirSync(paths.dirs.downloads())) {
      const full = path.join(paths.dirs.downloads(), name);
      if (full === keepPath || full === `${keepPath}.part`) continue;
      if (!/\.jsonl\.gz(\.part)?$/.test(name)) continue;
      try { fs.unlinkSync(full); removed += 1; } catch { /* in use — leave it */ }
    }
  } catch { /* downloads dir missing — nothing to prune */ }
  return removed;
}

// ── sync ─────────────────────────────────────────────────────────

/**
 * Phase A: fetch the manifest, download the bulk file, verify it inflates.
 *
 * Exactly TWO outbound requests in the normal path — one manifest, one download.
 * A resumed download is still one request. The battery asserts that count.
 */
/**
 * @param {object} [options]
 * @param {boolean} [options.force]   re-download even if the file is present
 * @param {boolean} [options.rebuild] re-run the transform from the file already on
 *   disk. Needed after a projection or CACHE_FORMAT change: `force` would re-fetch
 *   77 MB for no reason, and the plain path would short-circuit as up to date.
 */
async function sync({ force = false, rebuild = false } = {}) {
  const cancel = scryfall.createCancelToken();
  currentCancel = cancel;
  const started = Date.now();

  try {
    phase = 'manifest';
    emit({ t: 'progress', phase, message: 'Checking for the latest card data…' });
    const info = await scryfall.fetchBulkInfo(DATASET, { cancel });
    log(`manifest: ${info.type} released ${info.updatedAt}`);

    const existing = readMeta();
    if (!force && !rebuild && existing?.updatedAt === info.updatedAt && existing.transformedAt) {
      phase = 'idle';
      emit({ t: 'progress', phase, message: 'Card data is already up to date.' });
      return { ...status(), alreadyCurrent: true };
    }

    const dest = bulkPathFor(info);

    let bytes;
    let resumed = false;
    let reused = false;

    if (!force && fs.existsSync(dest)) {
      // This exact release is already on disk — no network needed at all.
      bytes = fs.statSync(dest).size;
      reused = true;
      log(`reusing existing download (${bytes} B)`);
      emit({ t: 'progress', phase: 'download', received: bytes, total: bytes, reused: true });
    } else {
      phase = 'download';
      const partSize = (() => {
        try { return fs.statSync(`${dest}.part`).size; } catch { return 0; }
      })();
      if (partSize > 0 && !force) log(`resuming at ${partSize} B`);

      const result = await scryfall.download(info.url, dest, {
        cancel,
        allowResume: !force,
        onProgress: (p) => emit({ t: 'progress', phase: 'download', ...p }),
      });
      bytes = result.bytes;
      resumed = result.resumed;
      log(`downloaded ${bytes} B${resumed ? ` (resumed from ${result.resumedFrom})` : ''}`);
    }

    phase = 'verify';
    emit({ t: 'progress', phase, message: 'Checking the download…' });
    // The manifest carries no checksum (measured: no hash/md5/sha field), so a
    // clean inflate plus a plausible record count IS the integrity check. A
    // truncated gzip fails to inflate rather than yielding partial garbage.
    const { lines, decompressedBytes } = await scryfall.inspectGzipJsonl(dest, { cancel });
    log(`verified: ${lines} cards, ${decompressedBytes} B inflated`);

    if (lines < MIN_PLAUSIBLE_CARDS) {
      throw new scryfall.ScryfallError(
        `Only ${lines} cards in the download — treating it as corrupt.`,
        'implausiblySmall',
      );
    }

    // ── Phase B: project every record into cards.ndjson + build cards.idx ──
    phase = 'transform';
    emit({ t: 'progress', phase, message: 'Building the card index…' });
    cardindex.unload();
    cardindex.closeNdjson();

    const built = await cardindex.build(dest, {
      cancel,
      expectedLines: lines,
      onProgress: (p) => emit({ t: 'progress', phase: 'transform', ...p }),
    });

    // The honest measure of how much of the data we understand. Anything
    // unexpected is counted rather than swallowed, and the totals go in the log.
    const warningSummary = Object.entries(built.warnings)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    log(`indexed ${built.kept} of ${built.read} records` +
      (warningSummary ? ` · notes: ${warningSummary}` : ' · no warnings'));

    // meta.json LAST: while it is absent or stale, the previous database is what
    // the app uses, so a crash anywhere above leaves a working install.
    writeJsonAtomic(paths.files.cardMeta(), {
      cacheFormat: CACHE_FORMAT,
      dataset: info.type,
      updatedAt: info.updatedAt,
      downloadedAt: new Date().toISOString(),
      bulkPath: dest,
      bulkBytes: bytes,
      bulkLines: lines,
      decompressedBytes,
      transformedAt: new Date().toISOString(),
      cardCount: built.kept,
      sourceRecords: built.read,
      ndjsonBytes: built.ndjsonBytes,
      indexWarnings: built.warnings,
    });

    const pruned = pruneOldBulkFiles(dest);
    if (pruned) log(`pruned ${pruned} stale bulk file(s)`);

    phase = 'idle';
    log(`sync complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    return { ...status(), bytes, lines, resumed, reused, indexed: built.kept };
  } catch (e) {
    phase = 'idle';
    if (e.code === 'cancelled') {
      log('cancelled — the partial download is kept as a resume point');
    } else {
      log(`failed: ${e.code ?? 'error'}: ${e.message}`);
    }
    throw e;
  } finally {
    currentCancel = null;
  }
}

function cancel() {
  if (!currentCancel) return { cancelled: false, reason: 'nothing in progress' };
  currentCancel.cancel('user');
  return { cancelled: true };
}

// ── message loop ─────────────────────────────────────────────────

/**
 * Make the index usable, repairing it locally if we can.
 *
 * ⚠️ A missing or unreadable cards.idx must NEVER trigger a download. The NDJSON
 * is the source of truth once it exists, so the index is rebuilt from it with no
 * network at all — verified by the battery.
 */
async function ensureIndex() {
  if (cardindex.isLoaded()) return;

  const meta = readMeta();
  if (!meta?.transformedAt) {
    throw Object.assign(
      new Error('The card database has not been built yet. Download it first.'),
      { code: 'noIndex' },
    );
  }

  try {
    cardindex.load();
    return;
  } catch (e) {
    log(`index unreadable (${e.code ?? 'error'}) — rebuilding from cards.ndjson, offline`);
  }

  phase = 'transform';
  try {
    const { kept } = await cardindex.rebuildIndexFromNdjson({
      onProgress: (p) => emit({ t: 'progress', phase: 'transform', ...p }),
    });
    log(`rebuilt index for ${kept} cards without touching the network`);
    cardindex.load({ force: true });
  } finally {
    phase = 'idle';
  }
}

const HANDLERS = {
  status: async () => status(),
  sync: async (payload) => sync(payload ?? {}),
  cancel: async () => cancel(),

  // ── queries ──
  // Every one of these takes plain text and folds it worker-side, so the renderer
  // never needs to know the folding rules (see cardfold.cjs).
  indexStats: async () => { await ensureIndex(); return cardindex.stats(); },
  byId: async (p) => { await ensureIndex(); return cardindex.byScryfallId(p?.id); },
  hydrate: async (p) => {
    await ensureIndex();
    const ids = Array.isArray(p?.ids) ? p.ids.slice(0, 5000) : [];
    return cardindex.hydrate(ids);
  },
  byName: async (p) => {
    await ensureIndex();
    return cardindex.byName(p?.name ?? '', { set: p?.set, collectorNumber: p?.collectorNumber });
  },
  /** Batch name resolution — one call for a whole decklist. */
  resolveNames: async (p) => {
    await ensureIndex();
    const entries = Array.isArray(p?.entries) ? p.entries.slice(0, 2000) : [];
    return entries.map((entry) => {
      const card = cardindex.byName(entry?.name ?? '', {
        set: entry?.set,
        collectorNumber: entry?.collectorNumber,
      });
      if (card) return { name: entry?.name, card };
      return {
        name: entry?.name,
        card: null,
        suggestions: cardindex.searchFuzzy(entry?.name ?? '', 5).map((c) => c.name),
      };
    });
  },
  printingsOf: async (p) => { await ensureIndex(); return cardindex.printingsOf(p?.name ?? ''); },
  searchPrefix: async (p) => {
    await ensureIndex();
    return cardindex.searchPrefix(p?.query ?? '', Math.min(p?.limit ?? 20, 100));
  },
  searchFuzzy: async (p) => {
    await ensureIndex();
    return cardindex.searchFuzzy(p?.query ?? '', Math.min(p?.limit ?? 5, 25));
  },

  // ── card art ──
  // ⚠️ These return as soon as the work is QUEUED. A deck's art takes minutes;
  // blocking the reply would hit the supervisor's request timeout and look like a
  // hung worker. Progress arrives as unsolicited `progress` events with
  // phase 'images'.
  imageQueueStatus: async () => ({
    ...cardimages.queueStatus(),
    cache: cardimages.cacheUsage(),
  }),

  /** Queue every face of the given cards: art crops first, then full art. */
  prefetchCards: async (p) => {
    await ensureIndex();
    const ids = Array.isArray(p?.ids) ? p.ids.slice(0, 400) : [];
    const tier = p?.tier === 'large' ? 'large' : 'png';
    const cards = cardindex.hydrate(ids);
    const wanted = cardimages.wantListFor(cards, tier);
    const result = cardimages.enqueue(wanted);
    startImagePrefetch();
    return { ...result, wanted: wanted.length, cards: cards.length };
  },

  /** Used by the on-demand path: a card was rendered and its art was missing. */
  enqueueImages: async (p) => {
    const items = (Array.isArray(p?.items) ? p.items : []).slice(0, cardimages.MAX_ENQUEUE);
    const result = cardimages.enqueue(items);
    if (result.added > 0) startImagePrefetch();
    return result;
  },

  cancelImages: async () => cardimages.cancelRun(),

  /** Verification hook: which of a want-list is still absent from disk. */
  missingImages: async (p) => cardimages.missingOf(p?.items),

  /** Test hooks: real request counters, so a battery can assert on network calls. */
  stats: async () => scryfall.getStats(),
  resetStats: async () => { scryfall.resetStats(); return true; },
};

/** Kick the image queue if it is not already draining. Never awaited. */
function startImagePrefetch() {
  if (cardimages.queueStatus().running) return;
  void cardimages
    .run({ onProgress: (p) => emit({ t: 'progress', ...p }) })
    .then((r) => {
      if (r?.alreadyRunning) return;
      log(`images: ${r.saved ?? 0} saved, ${r.failed ?? 0} failed, ${r.pending ?? 0} still queued`);
    })
    .catch((e) => log(`image prefetch stopped: ${e.message}`));
}

if (process.parentPort) {
  process.parentPort.on('message', async (event) => {
    const msg = event.data ?? {};
    const handler = HANDLERS[msg.t];
    if (!handler) {
      emit({
        id: msg.id,
        ok: false,
        error: { code: 'unknownRequest', message: `Unknown request '${msg.t}'` },
      });
      return;
    }
    try {
      emit({ id: msg.id, ok: true, value: await handler(msg.payload) });
    } catch (e) {
      emit({ id: msg.id, ok: false, error: { code: e.code ?? 'error', message: e.message } });
    }
  });
  emit({ t: 'ready' });

  // Resume an interrupted art prefetch. The queue is persisted, so a download
  // stopped by quitting the app (or losing the network) picks up here rather than
  // silently never finishing.
  const resumable = cardimages.queueStatus().pending;
  if (resumable > 0) {
    log(`resuming art prefetch: ${resumable} image(s) still queued`);
    startImagePrefetch();
  }
}

// ── headless CLI (verification) ──────────────────────────────────
//
// ⚠️ `!process.parentPort` is load-bearing, not belt-and-braces.
// utilityProcess.fork runs this file as the entry module, so `require.main ===
// module` is TRUE inside the forked worker as well. Without the parentPort guard
// the CLI block below reassigns `emit` to write to stdout — and stdio is
// 'ignore' — so every reply after the initial `ready` handshake vanished into
// nothing. The supervisor saw the worker come up and then time out on its first
// real request, which looks exactly like a hung child.

if (require.main === module && !process.parentPort) {
  const argv = process.argv.slice(2);
  const logRequests = argv.includes('--log-requests');
  let lastPct = -1;

  // Render progress to the terminal instead of a parent port.
  emit = (m) => {
    if (m.t === 'log') {
      process.stdout.write(`\n${m.line}\n`);
    } else if (m.t === 'progress' && m.phase === 'download' && m.total) {
      const pct = Math.floor((m.received / m.total) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        process.stdout.write(
          `\r  download ${String(pct).padStart(3)}%  ` +
          `${(m.received / 1048576).toFixed(1)}/${(m.total / 1048576).toFixed(1)} MB   `,
        );
      }
    } else if (m.t === 'progress' && m.message) {
      process.stdout.write(`\n  ${m.message}\n`);
    }
  };

  (async () => {
    if (argv.includes('--status')) {
      console.log(JSON.stringify(status(), null, 2));
      return;
    }

    // Rebuild the index from an existing cards.ndjson, offline.
    if (argv.includes('--reindex')) {
      const t = Date.now();
      const { kept } = await cardindex.rebuildIndexFromNdjson();
      console.log(`reindexed ${kept} cards in ${Date.now() - t} ms (no network)`);
      return;
    }

    // Ad-hoc lookup, for eyeballing resolution behaviour.
    const qIdx = argv.indexOf('--query');
    if (qIdx !== -1) {
      await ensureIndex();
      const q = argv.slice(qIdx + 1).join(' ');
      const hit = cardindex.byName(q);
      console.log(hit
        ? JSON.stringify({ name: hit.name, set: hit.setCode, cn: hit.collectorNumber, cost: hit.faces[0].manaCost, type: hit.faces[0].typeLine }, null, 2)
        : `no exact match; did you mean: ${cardindex.searchFuzzy(q, 5).map((c) => c.name).join(', ')}`);
      return;
    }

    if (!argv.includes('--sync')) {
      console.log('Usage: node electron/cardsvc-worker.cjs --sync [--force] [--log-requests]');
      console.log('       node electron/cardsvc-worker.cjs --status | --reindex | --query <name>');
      return;
    }

    // Ctrl-C cancels cleanly, keeping the .part as a resume point.
    process.on('SIGINT', () => {
      process.stdout.write('\n  cancelling…\n');
      cancel();
    });

    try {
      const result = await sync({
        force: argv.includes('--force'),
        rebuild: argv.includes('--rebuild'),
      });
      process.stdout.write('\n');
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      process.stdout.write('\n');
      console.error(`FAILED ${e.code ?? 'error'}: ${e.message}`);
      process.exitCode = 1;
    } finally {
      if (logRequests) console.error(`requests: ${JSON.stringify(scryfall.getStats())}`);
    }
  })();
}

module.exports = { status, sync, cancel, bulkPathFor, readMeta, CACHE_FORMAT, DATASET, MIN_PLAUSIBLE_CARDS };
