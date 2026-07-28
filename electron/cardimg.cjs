// The `cardimg://` scheme — how the renderer displays cached card art.
//
// Why a custom scheme rather than the alternatives:
//   • `file://`  — would force `img-src file:` into the CSP, which grants the
//                  renderer read access to the ENTIRE filesystem for images.
//   • base64 over IPC — a 745×1040 PNG is ~0.9 MB, ~1.2 MB base64-encoded. With
//                  ~400 cards visible across four boards that is ~500 MB of
//                  string copying through IPC. Non-starter.
//   • renderer fetch — the renderer has no network reach by design (D4), and
//                  should not gain any.
//
// A privileged scheme gives exactly one capability: read an image out of OUR
// cache directory, addressed by card id. It cannot name a path.
//
// URL shape:  cardimg://card/<tier>/<scryfallId>[-<faceIndex>]
//   e.g.      cardimg://card/png/0000579f-7b35-4ed3-b44c-db2a538066fe
//             cardimg://card/art_crop/86bf43b1-8d4e-4759-bb2d-0b2e03ba7012-1

const { protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const { dirs } = require('./paths.cjs');
const { pathWithin } = require('./capability.cjs');

/** Tier → file extension. An unlisted tier is refused. */
const TIERS = {
  png: 'png', // 745×1040, transparent corners — the fidelity tier and our default
  large: 'jpg', // 672×936
  normal: 'jpg', // 488×680
  small: 'jpg', // 146×204 — pile thumbnails
  art_crop: 'jpg', // art only, used by `chit` mode
};

// A Scryfall id is a UUID; the optional `-0` / `-1` suffix selects a face of a
// double-faced card. Anchored, so nothing else can get through.
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-[01])?$/;

/**
 * Must be called BEFORE app.whenReady(). Registering a scheme as privileged
 * after the app is ready silently does nothing.
 */
function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'cardimg',
      privileges: {
        standard: true, // parse as cardimg://host/path
        secure: true, // treated as a trustworthy origin
        supportFetchAPI: false, // images only; the renderer never fetches these
        corsEnabled: false,
        stream: true, // range requests, so large PNGs decode progressively
      },
    },
  ]);
}

/**
 * Absolute on-disk path for a cache entry, or null if the request is malformed
 * or would escape the cache directory.
 */
function resolveImagePath(tier, id) {
  const ext = TIERS[tier];
  if (!ext) return null;
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;

  // Shard on the first four hex digits so no directory holds 100k files.
  const shardA = id.slice(0, 2);
  const shardB = id.slice(2, 4);
  const tierDir = path.join(dirs.images(), tier);
  const full = path.join(tierDir, shardA, shardB, `${id}.${ext}`);

  // Belt and braces: ID_RE already forbids separators and dots, but assert
  // containment anyway. A regex is one edit away from being loosened.
  return pathWithin(tierDir, full) ? full : null;
}

/** Where a downloader should write this entry (same layout, dirs created). */
function cachePathFor(tier, id) {
  const full = resolveImagePath(tier, id);
  if (!full) return null;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

function has(tier, id) {
  const full = resolveImagePath(tier, id);
  if (!full) return false;
  try {
    return fs.statSync(full).size > 0;
  } catch {
    return false;
  }
}

/**
 * Install the handler. Call after app.whenReady().
 *
 * @param {(tier: string, id: string) => void} [onMiss] Notified when a requested
 *   image is absent, so the download queue can enqueue it (M1.7).
 */
function installHandler({ onMiss } = {}) {
  protocol.handle('cardimg', (request) => {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('bad url', { status: 400 });
    }

    if (url.hostname !== 'card') {
      return new Response('unknown resource', { status: 404 });
    }

    // pathname is '/<tier>/<id>'. Reject anything with extra segments.
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) {
      return new Response('bad request', { status: 400 });
    }
    const [tier, id] = parts;

    // decodeURIComponent so a percent-encoded traversal ('..%2f..') is caught by
    // ID_RE rather than sneaking through as an opaque blob.
    let decodedId;
    try {
      decodedId = decodeURIComponent(id);
    } catch {
      return new Response('bad request', { status: 400 });
    }

    const full = resolveImagePath(tier, decodedId);
    if (!full) {
      return new Response('forbidden', { status: 403 });
    }

    if (!has(tier, decodedId)) {
      // 404 is the signal the renderer's fallback chain expects: it draws a
      // SyntheticFace and the card stays playable.
      if (onMiss) {
        try { onMiss(tier, decodedId); } catch { /* queue is best-effort */ }
      }
      return new Response('not cached', { status: 404 });
    }

    // net.fetch on a file:// URL streams from disk with correct range support.
    return net.fetch(pathToFileURL(full).toString());
  });
}

module.exports = { registerScheme, installHandler, resolveImagePath, cachePathFor, has, TIERS, ID_RE };
