// The ONLY place this app talks to the network (besides electron-updater).
//
// Runs in the main process or the card-database worker — never the renderer,
// which has `connect-src 'self'` and no network reach at all (DECISIONS.md D4).
// The renderer can ask for a sync; it can never name a URL.
//
// Hardening, adopted from cartapriscus's hillshade fetcher:
//   • exact-host allowlist, https only, no credentials, no non-default port
//   • per-request byte cap and idle timeout
//   • rate limit (Scryfall asks for ≥50–100 ms between requests; we use 100 ms)
//   • descriptive User-Agent and explicit Accept, both required by Scryfall
//
// ─── Endpoint facts, measured 2026-07-26 (do not re-derive by guessing) ───
//
// Scryfall's bulk-data manifest offers each dataset twice. For `default_cards`:
//
//   download_uri        .json      620,655,865 B decompressed
//                                  · plain GET  → 200, Content-Encoding: gzip,
//                                    ~200 MB on the wire, NO Content-Length,
//                                    NO Accept-Ranges  → not resumable
//                                  · any Range  → 206 but the CDN DECOMPRESSES,
//                                    so a resume costs 620 MB identity bytes
//   jsonl_download_uri  .jsonl.gz   76,985,138 B
//                                  · plain GET  → 200, a genuine .gz file
//                                    (1f 8b magic), exact Content-Length,
//                                    Accept-Ranges: bytes
//                                  · Range      → 206 + Content-Range over the
//                                    COMPRESSED bytes → genuinely resumable
//
// We use jsonl_download_uri: a third of the bytes, an exact progress total, real
// resume, and one JSON object per line — so the transform needs no streaming-JSON
// parser, just a line splitter.

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ⚠️ Keep the version in step with package.json — Scryfall asks for a
// descriptive User-Agent, and a stale one misidentifies the build calling.
const USER_AGENT = 'CommandersRoundtable/0.1.1 (private Commander game client)';

/** Exact hosts, not suffixes: 'evil-api.scryfall.com.attacker.net' must not pass. */
const ALLOWED_HOSTS = new Set([
  'api.scryfall.com', // bulk-data manifest
  'data.scryfall.io', // bulk data files
  'cards.scryfall.io', // card images
]);

const LIMITS = {
  /** Small JSON responses (the manifest is ~4 KB). */
  jsonMaxBytes: 4 * 1024 * 1024,
  /** Hard ceiling for a bulk file. Today's is 77 MB; 1 GB catches a runaway. */
  bulkMaxBytes: 1024 * 1024 * 1024,
  /** A single card image. The png tier tops out near 2 MB. */
  imageMaxBytes: 16 * 1024 * 1024,
  /** No data at all for this long → give up. Not a total-duration cap: a slow
   *  connection downloading steadily must be allowed to finish. */
  idleTimeoutMs: 30_000,
  /** Scryfall's stated courtesy floor. */
  minRequestSpacingMs: 100,
  maxRedirects: 3,
};

/** Observability for tests: how many requests have actually gone out. */
const stats = { requests: 0, bytesDown: 0 };
function getStats() {
  return { ...stats };
}
function resetStats() {
  stats.requests = 0;
  stats.bytesDown = 0;
}

let lastRequestAt = 0;
/**
 * Serializes the spacing computation. ⚠️ The obvious version —
 *
 *   const wait = MIN - (Date.now() - lastRequestAt);
 *   if (wait > 0) await sleep(wait);
 *   lastRequestAt = Date.now();
 *
 * — is correct for ONE caller at a time and silently wrong for several. Six
 * concurrent image downloads all read the same `lastRequestAt`, all compute
 * wait <= 0, and all fire at once: zero spacing, six simultaneous requests.
 * That was invisible while only the sequential bulk sync used it, and it is
 * exactly what the prefetch queue would have violated Scryfall's courtesy limit
 * with. Chaining through a promise makes each caller wait for the previous one's
 * slot.
 */
let rateGate = Promise.resolve();
function rateLimit() {
  const slot = rateGate.then(async () => {
    const wait = LIMITS.minRequestSpacingMs - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  // Swallow rejections on the chain itself so one failure cannot wedge the gate.
  rateGate = slot.catch(() => {});
  return slot;
}

class ScryfallError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ScryfallError';
    this.code = code;
  }
}

/**
 * Validate a URL against the allowlist. Throws rather than returning null so a
 * missing check at a call site is a crash, not a silent bypass.
 */
function assertAllowedUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new ScryfallError(`Not a valid URL: ${raw}`, 'badUrl');
  }
  if (url.protocol !== 'https:') {
    throw new ScryfallError(`Refusing non-https URL: ${url.protocol}`, 'notHttps');
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new ScryfallError(`Host not in allowlist: ${url.hostname}`, 'hostNotAllowed');
  }
  if (url.username || url.password) {
    throw new ScryfallError('Refusing URL with embedded credentials', 'hasCredentials');
  }
  if (url.port && url.port !== '443') {
    throw new ScryfallError(`Refusing non-default port: ${url.port}`, 'badPort');
  }
  return url;
}

/** A cancellation token. Cheaper than AbortController and works across IPC. */
function createCancelToken() {
  const token = { cancelled: false, reason: null, _listeners: [] };
  token.cancel = (reason = 'cancelled') => {
    if (token.cancelled) return;
    token.cancelled = true;
    token.reason = reason;
    for (const fn of token._listeners) {
      try { fn(reason); } catch { /* listener errors must not mask the cancel */ }
    }
  };
  token.onCancel = (fn) => {
    if (token.cancelled) fn(token.reason);
    else token._listeners.push(fn);
  };
  return token;
}

/**
 * One HTTPS GET with the allowlist, headers, redirect handling and idle timeout
 * applied. Resolves with the live response stream — the caller consumes it.
 */
function request(rawUrl, { headers = {}, cancel, redirectsLeft = LIMITS.maxRedirects } = {}) {
  const url = assertAllowedUrl(rawUrl);

  return new Promise((resolve, reject) => {
    if (cancel?.cancelled) return reject(new ScryfallError('Cancelled', 'cancelled'));

    stats.requests += 1;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          ...headers,
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        // Redirects must be re-validated against the allowlist — a redirect to an
        // arbitrary host is exactly what an allowlist exists to stop.
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            return reject(new ScryfallError('Too many redirects', 'tooManyRedirects'));
          }
          const next = new URL(res.headers.location, url).toString();
          return request(next, { headers, cancel, redirectsLeft: redirectsLeft - 1 })
            .then(resolve, reject);
        }

        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new ScryfallError(`HTTP ${status} for ${url.pathname}`, `http${status}`));
        }

        resolve(res);
      },
    );

    // Idle, not total: a steady slow download must be able to finish.
    req.setTimeout(LIMITS.idleTimeoutMs, () => {
      req.destroy(new ScryfallError('No data for 30s', 'idleTimeout'));
    });
    req.on('error', reject);
    cancel?.onCancel(() => req.destroy(new ScryfallError('Cancelled', 'cancelled')));
  });
}

/** GET a small JSON document (the bulk-data manifest). */
async function fetchJson(rawUrl, { cancel } = {}) {
  await rateLimit();
  const res = await request(rawUrl, {
    headers: { Accept: 'application/json;q=0.9,*/*;q=0.8' },
    cancel,
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    res.on('data', (c) => {
      size += c.length;
      stats.bytesDown += c.length;
      if (size > LIMITS.jsonMaxBytes) {
        res.destroy();
        reject(new ScryfallError('JSON response exceeded cap', 'tooLarge'));
        return;
      }
      chunks.push(c);
    });
    res.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new ScryfallError(`Malformed JSON: ${e.message}`, 'badJson'));
      }
    });
    res.on('error', reject);
  });
}

/** The bulk-data manifest entry for one dataset type. */
async function fetchBulkInfo(type, { cancel } = {}) {
  const manifest = await fetchJson('https://api.scryfall.com/bulk-data', { cancel });
  const entry = Array.isArray(manifest?.data)
    ? manifest.data.find((b) => b?.type === type)
    : null;
  if (!entry) throw new ScryfallError(`No bulk dataset named '${type}'`, 'noSuchDataset');
  if (!entry.jsonl_download_uri) {
    throw new ScryfallError(
      `Dataset '${type}' has no jsonl_download_uri — Scryfall changed its manifest shape.`,
      'noJsonlUri',
    );
  }
  return {
    type: entry.type,
    updatedAt: entry.updated_at,
    /** Decompressed size of the .json variant — NOT the .jsonl.gz we download. */
    jsonSize: entry.size,
    url: entry.jsonl_download_uri,
  };
}

/**
 * Download to `dest`, resuming a partial file when the server allows it.
 *
 * Writes to `<dest>.part` and renames on success, so `dest` is never a truncated
 * file. A `.part` left behind is the resume point, which is why cancel keeps it.
 *
 * onProgress({ received, total, resumedFrom }) is called at most ~3×/s.
 */
async function download(rawUrl, dest, {
  cancel,
  onProgress,
  maxBytes = LIMITS.bulkMaxBytes,
  allowResume = true,
} = {}) {
  const part = `${dest}.part`;
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  let resumeFrom = 0;
  if (allowResume) {
    try {
      const st = fs.statSync(part);
      if (st.isFile() && st.size > 0) resumeFrom = st.size;
    } catch { /* no partial file — a fresh download */ }
  } else {
    try { fs.unlinkSync(part); } catch { /* nothing to remove */ }
  }

  await rateLimit();

  const headers = {};
  if (resumeFrom > 0) headers.Range = `bytes=${resumeFrom}-`;

  let res;
  try {
    res = await request(rawUrl, { headers, cancel });
  } catch (e) {
    // A stale/rejected range is recoverable exactly once, from scratch.
    if (resumeFrom > 0 && (e.code === 'http416' || e.code === 'http200')) {
      try { fs.unlinkSync(part); } catch { /* already gone */ }
      return download(rawUrl, dest, { cancel, onProgress, maxBytes, allowResume: false });
    }
    throw e;
  }

  // If we asked to resume but got a 200, the server ignored the Range and is
  // sending the whole file — so the existing bytes must be discarded, or the
  // output would be the tail glued onto a duplicate head.
  const resumed = res.statusCode === 206 && resumeFrom > 0;
  if (resumeFrom > 0 && !resumed) resumeFrom = 0;

  const contentLength = Number(res.headers['content-length'] ?? 0) || 0;
  const total = resumed ? resumeFrom + contentLength : contentLength;

  if (total > maxBytes) {
    res.destroy();
    throw new ScryfallError(
      `Refusing ${total} B download (cap ${maxBytes} B)`, 'tooLarge',
    );
  }

  const out = fs.createWriteStream(part, { flags: resumed ? 'a' : 'w' });
  let received = resumeFrom;
  let lastReport = 0;

  await new Promise((resolve, reject) => {
    const fail = (e) => { out.destroy(); res.destroy(); reject(e); };

    cancel?.onCancel(() => fail(new ScryfallError('Cancelled', 'cancelled')));

    res.on('data', (chunk) => {
      received += chunk.length;
      stats.bytesDown += chunk.length;
      if (received > maxBytes) {
        return fail(new ScryfallError('Download exceeded cap mid-stream', 'tooLarge'));
      }
      const now = Date.now();
      if (onProgress && now - lastReport > 320) {
        lastReport = now;
        onProgress({ received, total, resumedFrom: resumeFrom });
      }
    });

    res.on('error', fail);
    out.on('error', fail);
    res.pipe(out);
    out.on('finish', resolve);
  });

  if (total > 0 && received !== total) {
    // Keep the .part: it is a valid resume point for the next attempt.
    throw new ScryfallError(
      `Truncated download: got ${received} of ${total} B`, 'truncated',
    );
  }

  fs.renameSync(part, dest);
  onProgress?.({ received, total, resumedFrom: resumeFrom, done: true });
  return { bytes: received, resumedFrom: resumeFrom, resumed };
}

/**
 * Verify a gzip file decompresses cleanly and count its lines.
 *
 * The manifest carries no checksum (measured: no hash/md5/sha field), so this is
 * the integrity check available to us — and it is a real one: a truncated or
 * corrupt gzip fails to inflate rather than yielding partial garbage.
 */
function inspectGzipJsonl(file, { cancel } = {}) {
  return new Promise((resolve, reject) => {
    let lines = 0;
    let bytes = 0;
    let tail = '';
    const stream = fs.createReadStream(file).pipe(zlib.createGunzip());
    cancel?.onCancel(() => stream.destroy(new ScryfallError('Cancelled', 'cancelled')));
    stream.on('data', (chunk) => {
      bytes += chunk.length;
      const text = tail + chunk.toString('utf8');
      const parts = text.split('\n');
      tail = parts.pop() ?? '';
      lines += parts.filter((l) => l.trim().length > 0).length;
    });
    stream.on('end', () => {
      if (tail.trim().length > 0) lines += 1;
      resolve({ lines, decompressedBytes: bytes });
    });
    stream.on('error', reject);
  });
}

module.exports = {
  USER_AGENT,
  ALLOWED_HOSTS,
  LIMITS,
  ScryfallError,
  assertAllowedUrl,
  createCancelToken,
  fetchJson,
  fetchBulkInfo,
  download,
  inspectGzipJsonl,
  getStats,
  resetStats,
};
