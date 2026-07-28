/**
 * Card-database battery: folding, projection, index build/load, and queries.
 *
 *   node scripts/battery-carddb.cjs
 *
 * Runs against the REAL card database in the data root (read-only apart from the
 * explicitly-labelled reindex test, which rewrites cards.idx from cards.ndjson).
 * Requires a completed sync — run `node electron/cardsvc-worker.cjs --sync` first.
 *
 * These are main-process CommonJS modules, so they are verified here rather than
 * in Vitest (which this project scopes to src/engine and src/net).
 */

const fs = require('fs');
const path = require('path');

const paths = require('../electron/paths.cjs');
const { foldName, frontFaceKey } = require('../electron/cardfold.cjs');
const { projectCard, printingRank, releaseKey } = require('../electron/cardproject.cjs');
const cardindex = require('../electron/cardindex.cjs');
const { readJson } = require('../electron/jsonstore.cjs');

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

// ─────────────────────────────────────────────────────────────────
section('Name folding');

// The cards that actually break a naive lookup.
eq('Æ folds to the typed form', foldName('Æther Vial'), 'aether vial');
ok('…and matches the ASCII spelling', foldName('Æther Vial') === foldName('Aether Vial'));
eq('acute accent', foldName('Séance'), 'seance');
eq('circumflex + apostrophe', foldName("Lim-Dûl's Vault"), 'lim-duls vault');
eq('umlaut', foldName('Jötun Grunt'), 'jotun grunt');
eq('trailing accent', foldName('Ghazbán Ogre'), 'ghazban ogre');
eq('heavy punctuation', foldName('Ach! Hans, Run!'), 'ach hans run');
ok('curly apostrophe matches straight',
  foldName('Urza’s Tower') === foldName("Urza's Tower"));
eq('en dash becomes a hyphen', foldName('Cut–Ribbons'), 'cut-ribbons');
eq('meaningful hyphen survives', foldName('Ghost-Lit Raider'), 'ghost-lit raider');
eq('DFC separator kept', foldName('Fire // Ice'), 'fire // ice');
eq('DFC spacing collapsed', foldName('Fire  //  Ice'), 'fire // ice');
eq('case and surrounding space', foldName('  SOL RING  '), 'sol ring');
// Unifying '&' with 'and' would collide genuinely different cards.
eq('ampersand is NOT rewritten', foldName('Feast & Famine'), 'feast & famine');
// The index is built from folded keys, so a non-idempotent fold would make a
// rebuild subtly change what resolves.
ok('idempotent (Æ)', foldName(foldName('Æther Vial')) === foldName('Æther Vial'));
ok('idempotent (accents)', foldName(foldName("Lim-Dûl's Vault")) === foldName("Lim-Dûl's Vault"));
eq('front face of a DFC', frontFaceKey('Delver of Secrets // Insectile Aberration'), 'delver of secrets');
eq('single face unchanged', frontFaceKey('Sol Ring'), 'sol ring');
eq('empty string', foldName(''), '');
eq('non-string', foldName(null), '');

// ─────────────────────────────────────────────────────────────────
section('Projection');

const SINGLE = {
  id: '0000579f-7b35-4ed3-b44c-db2a538066fe',
  oracle_id: 'aaaaaaaa-7b35-4ed3-b44c-db2a538066fe',
  name: 'Fury Sliver', layout: 'normal', cmc: 6, mana_cost: '{5}{R}',
  type_line: 'Creature — Sliver', oracle_text: 'All Sliver creatures have double strike.',
  power: '3', toughness: '3', colors: ['R'], color_identity: ['R'],
  keywords: ['Double strike'], set: 'TSP', collector_number: '157',
  legalities: { commander: 'legal' }, image_uris: { png: 'x' },
  released_at: '2006-10-06', lang: 'en', image_status: 'highres_scan',
};
const single = projectCard(SINGLE);
eq('single-face card yields one face', single.faces.length, 1);
eq('imageId is the bare id', single.faces[0].imageId, SINGLE.id);
ok('singleImage is true for a normal card', single.singleImage === true);
eq('set code is lowercased downstream, preserved here', single.setCode, 'TSP');
eq('colour identity passed through', single.colorIdentity.join(''), 'R');

// transform: an image PER FACE → singleImage false
const TRANSFORM = {
  id: '86bf43b1-8d4e-4759-bb2d-0b2e03ba7012', oracle_id: 'bbbbbbbb-0000-0000-0000-000000000000',
  name: 'Delver of Secrets // Insectile Aberration', layout: 'transform', cmc: 1,
  color_identity: ['U'], keywords: [], set: 'isd', collector_number: '51',
  legalities: { commander: 'legal' }, released_at: '2011-09-30', lang: 'en',
  card_faces: [
    { name: 'Delver of Secrets', mana_cost: '{U}', type_line: 'Creature — Human Wizard', oracle_text: 'x', power: '1', toughness: '1', colors: ['U'], image_uris: { png: 'a' } },
    { name: 'Insectile Aberration', mana_cost: '', type_line: 'Creature — Human Insect', oracle_text: 'Flying', power: '3', toughness: '2', colors: ['U'], image_uris: { png: 'b' } },
  ],
};
const transform = projectCard(TRANSFORM);
eq('transform yields two faces', transform.faces.length, 2);
ok('transform has per-face images', transform.singleImage === false);
eq('face 0 imageId', transform.faces[0].imageId, `${TRANSFORM.id}-0`);
eq('face 1 imageId', transform.faces[1].imageId, `${TRANSFORM.id}-1`);

// split: both halves on ONE image → singleImage true
const SPLIT = {
  id: '4d5a1c60-2f6e-4c1e-9d2a-6e1f0a3b0003', oracle_id: 'cccccccc-0000-0000-0000-000000000000',
  name: 'Fire // Ice', layout: 'split', cmc: 4, color_identity: ['U', 'R'], keywords: [],
  set: 'apc', collector_number: '128', legalities: { commander: 'legal' },
  released_at: '2001-06-04', lang: 'en', image_uris: { png: 'one' },
  card_faces: [
    { name: 'Fire', mana_cost: '{1}{R}', type_line: 'Instant', oracle_text: 'x', colors: ['R'] },
    { name: 'Ice', mana_cost: '{1}{U}', type_line: 'Instant', oracle_text: 'y', colors: ['U'] },
  ],
};
const split = projectCard(SPLIT);
eq('split yields two faces', split.faces.length, 2);
ok('split shares ONE image', split.singleImage === true);
ok('both split faces address the same image',
  split.faces[0].imageId === SPLIT.id && split.faces[1].imageId === SPLIT.id);

// reversible_card: oracle_id lives on the faces, not the root
const REVERSIBLE = {
  id: '5e6f2d71-3a7f-4d2f-8e3b-7f2a1b4c9999', name: 'Propaganda // Propaganda',
  layout: 'reversible_card', cmc: 3, color_identity: ['U'], keywords: [], set: 'sld',
  collector_number: '1', legalities: { commander: 'legal' }, released_at: '2022-01-01', lang: 'en',
  card_faces: [
    { name: 'Propaganda', oracle_id: 'dddddddd-0000-0000-0000-000000000000', mana_cost: '{2}{U}', type_line: 'Enchantment', oracle_text: 'x', image_uris: { png: 'a' } },
    { name: 'Propaganda', oracle_id: 'dddddddd-0000-0000-0000-000000000000', mana_cost: '{2}{U}', type_line: 'Enchantment', oracle_text: 'x', image_uris: { png: 'b' } },
  ],
};
const reversible = projectCard(REVERSIBLE);
eq('reversible falls back to a face oracle_id', reversible.oracleId, 'dddddddd-0000-0000-0000-000000000000');

ok('art series is skipped entirely', projectCard({ ...SINGLE, layout: 'art_series' }) === null);
ok('a record with no id is skipped', projectCard({ ...SINGLE, id: undefined }) === null);
ok('a record with no name is skipped', projectCard({ ...SINGLE, name: '' }) === null);
ok('garbage is skipped', projectCard(null) === null);

// Printing preference: lower rank wins.
ok('digital printings rank worse than paper',
  printingRank({ digital: true, image_status: 'highres_scan' }) >
  printingRank({ digital: false, image_status: 'highres_scan' }));
ok('oversized ranks worse',
  printingRank({ oversized: true, image_status: 'highres_scan' }) >
  printingRank({ image_status: 'highres_scan' }));
ok('a low-res scan ranks worse',
  printingRank({ image_status: 'lowres' }) > printingRank({ image_status: 'highres_scan' }));
ok('non-English ranks worse',
  printingRank({ lang: 'ja', image_status: 'highres_scan' }) >
  printingRank({ lang: 'en', image_status: 'highres_scan' }));
eq('release key is a sortable integer', releaseKey('2026-07-26'), 20260726);
eq('missing release date is 0', releaseKey(undefined), 0);

// ─────────────────────────────────────────────────────────────────
section('Index integrity');

const meta = readJson(paths.files.cardMeta(), null);
if (!meta?.transformedAt) {
  console.log('\n  Card database not built. Run: node electron/cardsvc-worker.cjs --sync\n');
  process.exit(2);
}

const ndjsonPath = paths.files.cardNdjson();
const idxPath = paths.files.cardIndex();
ok('cards.ndjson exists', fs.existsSync(ndjsonPath));
ok('cards.idx exists', fs.existsSync(idxPath));
ok('no .tmp files left from the build',
  !fs.existsSync(`${ndjsonPath}.tmp`) && !fs.existsSync(`${idxPath}.tmp`));

// Line count must equal what meta claims, or lookups silently address the wrong
// bytes. Counted by scanning the file, not by trusting the index.
const ndjsonBytes = fs.statSync(ndjsonPath).size;
let lineCount = 0;
{
  const fd = fs.openSync(ndjsonPath, 'r');
  const buf = Buffer.allocUnsafe(1 << 20);
  let read;
  let position = 0;
  while ((read = fs.readSync(fd, buf, 0, buf.length, position)) > 0) {
    for (let i = 0; i < read; i++) if (buf[i] === 0x0a) lineCount += 1;
    position += read;
  }
  fs.closeSync(fd);
}
eq('NDJSON line count matches meta.cardCount', lineCount, meta.cardCount);
eq('NDJSON byte size matches meta.ndjsonBytes', ndjsonBytes, meta.ndjsonBytes);

const t0 = Date.now();
const idx = cardindex.load({ force: true });
const loadMs = Date.now() - t0;
eq('index cardCount matches meta', idx.count, meta.cardCount);
ok('cold index load is under 500 ms', loadMs < 500, `${loadMs} ms`);
ok('unique names is a sane fraction of printings',
  idx.uniqueNames.length > 20000 && idx.uniqueNames.length < idx.count,
  `${idx.uniqueNames.length} unique / ${idx.count} printings`);

// Offsets must be strictly increasing and cover the file exactly.
let monotonic = true;
for (let i = 1; i < idx.count; i++) {
  if (idx.raw.off[i] !== idx.raw.off[i - 1] + idx.raw.len[i - 1]) { monotonic = false; break; }
}
ok('offsets are contiguous and ordered', monotonic);
eq('offsets span the whole file',
  idx.raw.off[idx.count - 1] + idx.raw.len[idx.count - 1], ndjsonBytes);

// ─────────────────────────────────────────────────────────────────
section('Queries against real data');

const solRing = cardindex.byName('Sol Ring');
ok('exact name resolves', !!solRing, solRing?.name);
eq('…to the right card', solRing?.name, 'Sol Ring');
ok('…with a real mana cost', solRing?.faces[0].manaCost === '{1}', solRing?.faces[0].manaCost);
ok('…and is Commander-legal', solRing?.commanderLegality === 'legal');

// ── Unicode, in the direction that actually matters ──
// Measured against the 2026-07-26 release: ZERO card names contain a ligature.
// Wizards renamed Æther → Aether in oracle text and Scryfall carries current
// oracle names, so the card is literally 'Aether Vial'. The fold's Æ handling
// therefore exists for INPUT tolerance — an old decklist export or someone typing
// the printed spelling of an old card — not to match a stored name.
// 100 names do carry diacritics (Gríma, Éomer, Dúnedain, Palantír, Lim-Dûl…),
// and those are the cases the fold really earns its keep on.
const aetherAscii = cardindex.byName('Aether Vial');
const aetherLigature = cardindex.byName('Æther Vial');
ok('the ASCII name resolves', !!aetherAscii, aetherAscii?.name);
ok('typing the old ligature spelling resolves too', !!aetherLigature, aetherLigature?.name);
ok('…and both give the SAME card',
  !!aetherAscii && aetherAscii.scryfallId === aetherLigature?.scryfallId);

for (const [typed, expectFragment] of [
  ["Lim-Dul's Vault", 'Lim-Dûl'],
  ['Nazgul', 'Nazgûl'],
  ['Grima Wormtongue', 'Gríma'],
  ['Eomer, Marshal of Rohan', 'Éomer'],
  ['Palantir of Orthanc', 'Palantír'],
]) {
  const hit = cardindex.byName(typed);
  ok(`unaccented "${typed}" resolves`, hit?.name?.includes(expectFragment), hit?.name);
}

const fireIce = cardindex.byName('Fire // Ice');
ok('split card by full name', !!fireIce, fireIce?.name);
ok('…has two faces', fireIce?.faces.length === 2);
ok('…on one shared image', fireIce?.singleImage === true);

// A decklist that names only the front face of a DFC must still resolve.
const delverFront = cardindex.byName('Delver of Secrets');
ok('front-face-only name resolves to the DFC', !!delverFront, delverFront?.name);
ok('…and it is the two-faced card', (delverFront?.faces.length ?? 0) === 2);

// Case and whitespace are not the user's problem.
ok('lowercase input works', !!cardindex.byName('sol ring'));
ok('surrounding whitespace works', !!cardindex.byName('  Sol Ring  '));

// A specific printing, by set + collector number.
const printings = cardindex.printingsOf('Sol Ring');
ok('many printings of Sol Ring exist', printings.length > 20, `${printings.length} printings`);
const target = printings.find((p) => p.setCode.toLowerCase() === 'ltc');
if (target) {
  const bySetCn = cardindex.byName('Sol Ring', {
    set: target.setCode, collectorNumber: target.collectorNumber,
  });
  eq('set + collector number selects that exact printing', bySetCn?.scryfallId, target.scryfallId);
} else {
  ok('set + collector number selects that exact printing', false, 'no LTC printing found');
}

// A wrong set code must not return the wrong card — it falls back to the name.
const wrongSet = cardindex.byName('Sol Ring', { set: 'zzz', collectorNumber: '999' });
eq('a bogus set code falls back to the name, not a wrong card', wrongSet?.name, 'Sol Ring');

// Preferred printing should be a real paper English card.
ok('preferred Sol Ring printing is not digital-only',
  !!solRing && printings[0].scryfallId === solRing.scryfallId);

// by id, and batch hydrate
eq('byScryfallId round-trips', cardindex.byScryfallId(solRing.scryfallId)?.name, 'Sol Ring');
ok('unknown id returns null', cardindex.byScryfallId('ffffffff-ffff-ffff-ffff-ffffffffffff') === null);
const deckIds = printings.slice(0, 100).map((p) => p.scryfallId);
const hydrated = cardindex.hydrate(deckIds);
eq('hydrate returns every requested card', hydrated.length, deckIds.length);
ok('hydrate skips unknown ids without throwing',
  cardindex.hydrate([...deckIds.slice(0, 3), 'ffffffff-ffff-ffff-ffff-ffffffffffff']).length === 3);

section('Search');

const prefix = cardindex.searchPrefix('sol r', 10);
ok('prefix search finds Sol Ring', prefix.some((c) => c.name === 'Sol Ring'),
  prefix.slice(0, 3).map((c) => c.name).join(' | '));
eq('prefix search ranks the shortest match first', prefix[0]?.name, 'Sol Ring');
ok('prefix search respects the limit', cardindex.searchPrefix('a', 5).length <= 5);
ok('empty prefix returns nothing', cardindex.searchPrefix('', 5).length === 0);

const fuzzy = cardindex.searchFuzzy('sol rign', 5);
ok('fuzzy search fixes a transposition', fuzzy.some((c) => c.name === 'Sol Ring'),
  fuzzy.slice(0, 3).map((c) => c.name).join(' | '));
ok('fuzzy search handles a missing letter',
  cardindex.searchFuzzy('lightnig bolt', 5).some((c) => c.name === 'Lightning Bolt'));
ok('fuzzy search on nonsense returns few or none',
  cardindex.searchFuzzy('qqqqzzzzxxxxvvvv', 5).length <= 5);

eq('bounded edit distance: identical', cardindex.editDistanceWithin('abc', 'abc', 2), 0);
eq('bounded edit distance: one substitution', cardindex.editDistanceWithin('abc', 'abd', 2), 1);
ok('bounded edit distance bails out past the cap',
  cardindex.editDistanceWithin('abc', 'zzzzzz', 2) > 2);

section('Performance');

// p95 over real queries, using names actually present in the index.
const sampleNames = [];
for (let i = 0; i < 200; i++) {
  sampleNames.push(idx.uniqueNames[(i * 617) % idx.uniqueNames.length]);
}
const timings = [];
for (const name of sampleNames) {
  const t = process.hrtime.bigint();
  cardindex.byName(name);
  timings.push(Number(process.hrtime.bigint() - t) / 1e6);
}
timings.sort((a, b) => a - b);
const p50 = timings[Math.floor(timings.length * 0.5)];
const p95 = timings[Math.floor(timings.length * 0.95)];
ok('p95 name lookup is under 20 ms', p95 < 20, `p50 ${p50.toFixed(2)} ms · p95 ${p95.toFixed(2)} ms`);

const tHydrate = Date.now();
cardindex.hydrate(deckIds.slice(0, 100));
const hydrateMs = Date.now() - tHydrate;
ok('hydrating 100 cards is under 150 ms', hydrateMs < 150, `${hydrateMs} ms`);

section('Validator assumptions still hold against real cards');

// ⚠️ src/data/validate.test.ts uses hand-written fixtures whose oracle text is
// copied verbatim from real cards, because the rules key off exact wording. Those
// tests would keep passing if Scryfall reworded a card. THIS is the check that
// catches it — if one of these fails, the fixture in validate.test.ts is stale and
// the rule may no longer fire on the real card.
for (const [name, pattern, why] of [
  ['Nazgûl', /A deck can have up to nine cards named/i, 'copyLimit → 9'],
  ['Seven Dwarves', /A deck can have up to seven cards named/i, 'copyLimit → 7'],
  ['Relentless Rats', /A deck can have any number of cards named/i, 'copyLimit → Infinity'],
  ['Thrasios, Triton Hero', /\bPartner\b/i, 'pairing → partner'],
  ['Regna, the Redeemer', /Partner with Krav/i, 'pairing → partner-with'],
  ['Wilson, Refined Grizzly', /Choose a Background/i, 'pairing → choose-background'],
  ['Rose Tyler', /Doctor's companion/i, "pairing → doctor's companion"],
]) {
  const card = cardindex.byName(name);
  const text = card ? card.faces.map((f) => f.oracleText).join('\n') : '';
  ok(`${name}: ${why}`, !!card && pattern.test(text),
    card ? '' : 'card not found');
}

for (const [name, pattern, why] of [
  ['Grist, the Hunger Tide', /Legendary Planeswalker/, 'needs the COMMANDER_OVERRIDES entry'],
  ['Shorikai, Genesis Engine', /Legendary Artifact .* Vehicle/, 'eligibility via Vehicle'],
  ['Raised by Giants', /Legendary Enchantment .* Background/, 'pairing → background'],
  ['The Tenth Doctor', /Time Lord Doctor/, 'pairing → doctor'],
  ['Wastes', /^Basic Land$/, 'basic land with no subtype'],
  ['Snow-Covered Plains', /^Basic Snow Land/, 'snow basic is still basic'],
]) {
  const card = cardindex.byName(name);
  ok(`${name}: ${why}`, !!card && pattern.test(card.faces[0].typeLine),
    card ? card.faces[0].typeLine : 'card not found');
}

// Golos must still be banned, or the ban-list test is testing nothing.
{
  const golos = cardindex.byName('Golos, Tireless Pilgrim');
  eq('Golos, Tireless Pilgrim is still banned', golos?.commanderLegality, 'banned');
}
// And Shorikai still must NOT say "can be your commander" — that absence is the
// entire reason commanderEligibility has an 'unknown'/Vehicle path.
{
  const shorikai = cardindex.byName('Shorikai, Genesis Engine');
  const text = shorikai ? shorikai.faces.map((f) => f.oracleText).join('\n') : '';
  ok('Shorikai still lacks "can be your commander" (why Vehicle is special-cased)',
    !!shorikai && !/can be your commander/i.test(text));
}

// The remaining checks need await, and this is CommonJS — so the tail runs in an
// async main() rather than at the top level.
async function offlineRebuildAndReport() {
section('Offline index rebuild');

// ⚠️ A lost or corrupt index must be recoverable with NO network. This test
// destroys cards.idx on purpose and rebuilds it from cards.ndjson alone.
const idxBackup = `${idxPath}.batterybak`;
fs.copyFileSync(idxPath, idxBackup);
try {
  fs.writeFileSync(idxPath, '{ truncated garbage');
  cardindex.unload();
  let threw = false;
  try { cardindex.load({ force: true }); } catch { threw = true; }
  ok('a corrupt index fails loudly rather than loading garbage', threw);

  const tRebuild = Date.now();
  const { kept } = await cardindex.rebuildIndexFromNdjson();
  const rebuildMs = Date.now() - tRebuild;
  eq('rebuild recovers every record', kept, meta.cardCount);
  ok('rebuild is reasonably quick', rebuildMs < 30000, `${rebuildMs} ms`);

  cardindex.unload();
  cardindex.closeNdjson();
  cardindex.load({ force: true });
  eq('queries work again after a rebuild', cardindex.byName('Sol Ring')?.name, 'Sol Ring');
  ok('the rebuilt index is marked as such', cardindex.stats().rebuilt === true);
} finally {
  // Restore the real index so the app is left exactly as we found it.
  fs.copyFileSync(idxBackup, idxPath);
  fs.unlinkSync(idxBackup);
  cardindex.unload();
  cardindex.closeNdjson();
  cardindex.load({ force: true });
}
ok('the original index is restored', cardindex.stats().rebuilt === false);

section('A build interrupted halfway leaves the old database working');

// ⚠️ This is the claim that makes an update safe to attempt on a flaky machine:
// the transform writes .tmp siblings and renames at the very end, so a crash or
// cancel mid-build must leave the previous cards.ndjson + cards.idx untouched and
// still queryable. Asserted here by cancelling a real build against real data.
{
  const { createCancelToken } = require('../electron/scryfall.cjs');
  const beforeNdjson = fs.statSync(ndjsonPath);
  const beforeIdx = fs.statSync(idxPath);
  const beforeCount = cardindex.stats().cardCount;

  const cancel = createCancelToken();
  setTimeout(() => cancel.cancel('battery'), 1200);

  let cancelled = false;
  try {
    await cardindex.build(meta.bulkPath, { cancel, expectedLines: meta.bulkLines });
  } catch (e) {
    cancelled = e.code === 'cancelled';
  }
  ok('the interrupted build reports cancellation', cancelled);

  const afterNdjson = fs.statSync(ndjsonPath);
  const afterIdx = fs.statSync(idxPath);
  eq('cards.ndjson size is unchanged', afterNdjson.size, beforeNdjson.size);
  eq('cards.ndjson mtime is unchanged', afterNdjson.mtimeMs, beforeNdjson.mtimeMs);
  eq('cards.idx size is unchanged', afterIdx.size, beforeIdx.size);
  eq('cards.idx mtime is unchanged', afterIdx.mtimeMs, beforeIdx.mtimeMs);
  ok('no .tmp files were left behind',
    !fs.existsSync(`${ndjsonPath}.tmp`) && !fs.existsSync(`${idxPath}.tmp`));

  // The whole point: the app still works.
  cardindex.unload();
  cardindex.closeNdjson();
  eq('the old database is still queryable', cardindex.byName('Sol Ring')?.name, 'Sol Ring');
  eq('…with the same card count', cardindex.stats().cardCount, beforeCount);
}

// ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(64)}`);
console.log(`${pass}/${pass + fail} checks passed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  • ${f}`);
}
process.exit(fail ? 1 : 0);
}

offlineRebuildAndReport().catch((e) => {
  console.error('\nBattery crashed:', e);
  process.exit(1);
});
