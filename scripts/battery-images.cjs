/**
 * Card-art battery: URL derivation, queue behaviour, rate limiting, resume.
 *
 *   node scripts/battery-images.cjs [--offline]
 *
 * Uses a THROWAWAY data root under the OS temp dir, so it never touches the real
 * image cache — except that it does make real requests to Scryfall's CDN for a
 * handful of images (about 8 MB), because the things worth verifying here are
 * exactly the ones a mock would paper over: actual spacing between requests,
 * actual concurrency, and whether a derived URL resolves.
 *
 * `--offline` skips the network sections and runs only the pure-logic ones.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROBE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'crt-img-'));
process.env.CRT_DATA_DIR = PROBE_ROOT;

const paths = require('../electron/paths.cjs');
paths.ensureDirs();

const scryfall = require('../electron/scryfall.cjs');
const cardimg = require('../electron/cardimg.cjs');
const cardimages = require('../electron/cardimages.cjs');

const OFFLINE = process.argv.includes('--offline');

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? `  ${detail}` : ''}`);
  }
}
function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected), `got ${JSON.stringify(actual)}`);
}
function section(title) {
  console.log(`\n── ${title} ──`);
}

// Real ids, so a derived URL can actually be fetched.
const SOL_RING = '5805f64c-dd88-4e94-8f0a-a01dae67e3ba';
const DELVER = 'a808459c-f086-4cb6-a53e-4b9e196c1000'; // transform, per-face images

async function main() {
  section('Image id parsing');

  eq('bare uuid is the front face', cardimages.parseImageId(SOL_RING)?.face, 'front');
  eq('-0 suffix is the front face', cardimages.parseImageId(`${DELVER}-0`)?.face, 'front');
  eq('-1 suffix is the back face', cardimages.parseImageId(`${DELVER}-1`)?.face, 'back');
  eq('card id is recovered from a face id', cardimages.parseImageId(`${DELVER}-1`)?.cardId, DELVER);
  ok('a non-uuid is rejected', cardimages.parseImageId('not-a-uuid') === null);
  ok('a face index beyond 1 is rejected', cardimages.parseImageId(`${DELVER}-2`) === null);
  ok('a traversal attempt is rejected', cardimages.parseImageId('../../etc/passwd') === null);
  ok('a null id is rejected', cardimages.parseImageId(null) === null);

  section('URL derivation');

  eq('png front URL', cardimages.imageUrlFor('png', SOL_RING),
    `https://cards.scryfall.io/png/front/5/8/${SOL_RING}.png`);
  eq('art_crop uses .jpg', cardimages.imageUrlFor('art_crop', SOL_RING),
    `https://cards.scryfall.io/art_crop/front/5/8/${SOL_RING}.jpg`);
  eq('back face goes to /back/', cardimages.imageUrlFor('png', `${DELVER}-1`),
    `https://cards.scryfall.io/png/back/a/8/${DELVER}.png`);
  ok('an unknown tier yields no URL', cardimages.imageUrlFor('original', SOL_RING) === null);
  ok('a bad id yields no URL', cardimages.imageUrlFor('png', 'nope') === null);
  // Every derived URL must survive the allowlist that guards all our fetches.
  ok('derived URLs pass the host allowlist',
    !!scryfall.assertAllowedUrl(cardimages.imageUrlFor('png', SOL_RING)));

  section('Want-list construction');

  const dfcCard = {
    scryfallId: DELVER,
    singleImage: false,
    faces: [{ imageId: `${DELVER}-0` }, { imageId: `${DELVER}-1` }],
  };
  const splitCard = {
    scryfallId: SOL_RING,
    singleImage: true,
    // A single-image card's faces share one imageId.
    faces: [{ imageId: SOL_RING }, { imageId: SOL_RING }],
  };

  const want = cardimages.wantListFor([dfcCard, splitCard], 'png');
  eq('two-faced card contributes both faces at both tiers',
    want.filter((w) => w.imageId.startsWith(DELVER)).length, 4);
  eq('single-image card is de-duplicated to one id per tier',
    want.filter((w) => w.imageId === SOL_RING).length, 2);
  ok('art crops are queued BEFORE full art',
    want.findIndex((w) => w.tier === 'art_crop') < want.findIndex((w) => w.tier === 'png'),
    want.slice(0, 3).map((w) => w.tier).join(','));
  ok('no duplicate work in the want list',
    new Set(want.map((w) => `${w.tier}/${w.imageId}`)).size === want.length);

  section('Queue bookkeeping');

  const enq = cardimages.enqueue(want);
  eq('everything is queued on a cold cache', enq.added, want.length);
  eq('queue status agrees', cardimages.queueStatus().pending, want.length);
  eq('re-queueing the same work adds nothing', cardimages.enqueue(want).added, 0);

  const oversized = Array.from({ length: cardimages.MAX_ENQUEUE + 1 }, () => ({
    tier: 'png', imageId: SOL_RING,
  }));
  const refused = cardimages.enqueue(oversized);
  ok('an unreasonably large enqueue is refused', !!refused.refused, refused.refused);
  eq('…and nothing was added', refused.added, 0);

  ok('malformed entries are ignored, not thrown on',
    cardimages.enqueue([{ tier: 'bogus', imageId: SOL_RING }, { tier: 'png', imageId: 'x' }]).added === 0);

  // The queue must survive a restart, or an interrupted prefetch never finishes.
  cardimages.saveQueue();
  ok('queue file was written', fs.existsSync(paths.files.imageQueue()));
  const raw = fs.readFileSync(paths.files.imageQueue());
  eq('queue file has no BOM', raw[0], 0x7b);

  if (OFFLINE) {
    report();
    return;
  }

  section('Real downloads: spacing and concurrency');

  // Spacing and concurrency are MEASURED, not assumed from the constants — and
  // at the right layers:
  //
  //   concurrency → wrap scryfall.download (one call per image in flight)
  //   spacing     → hook https.get itself
  //
  // ⚠️ Timing at the download() boundary is the wrong layer for spacing: all six
  // workers enter download() within a millisecond of each other and then
  // serialize inside it on the rate-limit gate. Measuring there reports ~1 ms
  // gaps for a transport that is in fact correctly paced. Only the wire tells the
  // truth, and the wire is what Scryfall's courtesy limit is about.
  const https = require('https');
  const starts = [];
  const realGet = https.get;
  https.get = function instrumentedGet(...args) {
    starts.push(Date.now());
    return realGet.apply(this, args);
  };

  let inFlight = 0;
  let maxInFlight = 0;
  const realDownload = scryfall.download;
  scryfall.download = async (url, dest, opts) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      return await realDownload(url, dest, opts);
    } finally {
      inFlight -= 1;
    }
  };

  // Just the art crops (~40 KB each) — enough requests to measure pacing cheaply.
  cardimages.loadQueue().pending = want
    .filter((w) => w.tier === 'art_crop')
    .map((w) => `${w.tier}/${w.imageId}`);
  // Pad with more real crops so there is something to measure.
  const extraIds = [
    '3d5c99e9-7c3e-4149-82a6-3c7d5d302488',
    '86bf43b1-8d4e-4759-bb2d-0b2e03ba7012',
  ];
  cardimages.enqueue(extraIds.map((id) => ({ tier: 'art_crop', imageId: id })));

  const before = cardimages.queueStatus().pending;
  const result = await cardimages.run({});
  scryfall.download = realDownload;
  https.get = realGet;

  ok('the queue drained', result.done === true, JSON.stringify(result));
  eq('nothing is left pending', cardimages.queueStatus().pending, 0);
  ok('at least a few images were fetched', (result.saved ?? 0) >= 3,
    `${result.saved} saved of ${before} queued`);

  // Concurrency ceiling.
  ok(`concurrency stayed at or below ${cardimages.CONCURRENCY}`,
    maxInFlight <= cardimages.CONCURRENCY, `peak ${maxInFlight}`);
  ok('…and it actually ran more than one at a time', maxInFlight > 1, `peak ${maxInFlight}`);

  // Spacing between consecutive request starts. This is the check that would have
  // caught the non-serialized rate limiter: six workers all firing at t=0.
  starts.sort((a, b) => a - b);
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  const minGap = gaps.length ? Math.min(...gaps) : Infinity;
  const floor = scryfall.LIMITS.minRequestSpacingMs;
  // Allow a small timer tolerance; the point is that it is not ~0.
  ok(`min gap between requests respects the ${floor} ms floor`,
    minGap >= floor - 15, `min ${minGap} ms across ${gaps.length} gaps`);

  section('Cache state');

  const missing = cardimages.missingOf(
    want.filter((w) => w.tier === 'art_crop'),
  );
  eq('every requested crop is now on disk', missing.length, 0);

  for (const item of want.filter((w) => w.tier === 'art_crop')) {
    const p = cardimg.resolveImagePath(item.tier, item.imageId);
    const size = fs.existsSync(p) ? fs.statSync(p).size : 0;
    ok(`cached file is non-empty: ${item.imageId.slice(0, 8)}…`, size > 1000, `${size} B`);
  }

  const usage = cardimages.cacheUsage();
  ok('cache usage reports real bytes', usage.bytes > 10000, `${usage.files} files, ${(usage.bytes / 1024).toFixed(0)} KB`);

  // A file the protocol can actually serve.
  const solCrop = cardimg.resolveImagePath('art_crop', SOL_RING);
  const magic = fs.readFileSync(solCrop).slice(0, 2).toString('hex');
  eq('cached crop really is a JPEG', magic, 'ffd8');

  section('Permanent failures are not retried forever');

  // A back face for a single-image card genuinely does not exist → 404 → dead.
  cardimages.enqueue([{ tier: 'png', imageId: `${SOL_RING}` }]);
  cardimages.loadQueue().pending = [`png/${SOL_RING.slice(0, 35)}1`]; // malformed on purpose
  cardimages.loadQueue().pending = [];
  const deadBefore = cardimages.queueStatus().dead;
  // Sol Ring is a single-image card, so its 'back' image is a real 404.
  const fakeBack = `${SOL_RING}-1`;
  cardimages.enqueue([{ tier: 'png', imageId: fakeBack }]);
  await cardimages.run({});
  ok('a 404 is recorded as permanently dead, not retried',
    cardimages.queueStatus().dead > deadBefore,
    `dead ${deadBefore} → ${cardimages.queueStatus().dead}`);
  eq('…and it leaves the queue empty', cardimages.queueStatus().pending, 0);
  eq('re-queueing a dead entry is skipped',
    cardimages.enqueue([{ tier: 'png', imageId: fakeBack }]).skippedDead, 1);

  section('Resume across a restart');

  // Simulate quitting mid-prefetch: leave pending work, drop in-memory state,
  // reload from disk exactly as a fresh worker would.
  const pendingKeys = [
    `art_crop/${extraIds[0]}`,
    `png/${SOL_RING}`,
  ];
  cardimages.loadQueue().pending = [...pendingKeys];
  cardimages.saveQueue();

  // Force a cold reload of the module's queue state.
  delete require.cache[require.resolve('../electron/cardimages.cjs')];
  const reloaded = require('../electron/cardimages.cjs');
  eq('pending work survived the restart', reloaded.queueStatus().pending, pendingKeys.length);
  ok('…with the same entries',
    JSON.stringify(reloaded.loadQueue().pending) === JSON.stringify(pendingKeys));

  report();
}

function report() {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`${pass}/${pass + fail} checks passed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  • ${f}`);
  }
  try { fs.rmSync(PROBE_ROOT, { recursive: true, force: true }); } catch { /* leave it */ }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('\nBattery crashed:', e);
  try { fs.rmSync(PROBE_ROOT, { recursive: true, force: true }); } catch { /* leave it */ }
  process.exit(1);
});
