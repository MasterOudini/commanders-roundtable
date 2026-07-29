#!/usr/bin/env node
// Regenerate `src/data/fixtures/engineCards.ts` from the real card database.
//
// ⚠️ GENERATED, not hand-written, and that is the point. D15b established the
// rule the hard way: the validator's rules key off EXACT wording ("A deck can
// have up to nine cards named"), so a paraphrased fixture tests the fixture
// rather than the card, and keeps passing forever after Scryfall rewords
// something. The engine has the same exposure — `parseManaProduction` reads
// oracle text, and Tundra's text being literally `({T}: Add {W} or {U}.)`
// changed the parser's design.
//
// So: every fixture here is a verbatim `CardData` record, copied byte for byte
// out of ~/.commanders-roundtable/cards/cards.ndjson, and
// `scripts/battery-carddb.cjs` cross-checks that the real cards still say it.
// Regenerate with:
//
//     node scripts/make-engine-fixtures.cjs
//
// Requires a synced card database. The generated file is committed, so tests
// run on a machine that has never synced.

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { dataRoot } = require('../electron/paths.cjs');

/**
 * name → optional { set, cn } to pin a printing.
 *
 * Pinning matters only where printings differ in a way the engine can see;
 * everything else takes the first printing encountered, which is stable because
 * the NDJSON order is stable.
 */
const WANTED = [
  // basics + lands
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Forest',
  'Command Tower', 'Tundra', 'Ancient Tomb', 'Boros Garrison', 'Gemstone Mine',
  'Reflecting Pool', 'Cavern of Souls', 'Bojuka Bog',
  // artifacts
  'Sol Ring', 'Arcane Signet', 'Mox Diamond', 'Lightning Greaves', 'Darksteel Myr',
  // mana creatures
  'Llanowar Elves', 'Birds of Paradise', 'Bloom Tender',
  // keyword creatures — one per Tier-2 keyword the combat matrix exercises
  'Grizzly Bears', 'Scathe Zombies', 'Silvercoat Lion',
  'Air Elemental', 'Serra Angel', 'Giant Spider', 'Colossal Dreadmaw',
  'Vampire Nighthawk', 'Typhoid Rats', 'White Knight', 'Boros Swiftblade',
  'Boggart Brute', 'Wall of Omens', 'Scaled Behemoth', 'Kor Firewalker',
  'Raging Goblin', 'Child of Night', 'Bull Hippo', 'Ambush Viper',
  'Baleful Strix', 'Tarmogoyf', 'Spearbreaker Behemoth',
  // M5's Tier-2 promotions (D68): infect, wither, toxic and a life ward.
  // Flensermite is the important one — infect AND lifelink on one body is the
  // whole of CR 702.90b, which says life gain keys off the damage being DEALT
  // and not off how it was applied.
  'Priests of Norn', 'Rot Wolf', 'Flensermite',
  'Twinblade Slasher', 'Tyrranax Rex', 'Bloated Contaminator',
  'Sedgemoor Witch',
  // odd shapes the parser has to survive
  'Delver of Secrets // Insectile Aberration', 'Figure of Destiny',
  'Gitaxian Probe', 'Fire // Ice', 'Wear // Tear', 'Shorikai, Genesis Engine',
  // spells
  'Lightning Bolt', 'Counterspell', 'Cultivate', 'Swords to Plowshares',
  'Pacifism', 'Wrath of God', 'Brainstorm', 'Dark Ritual',
  // commanders
  'Kess, Dissident Mage', 'Krenko, Mob Boss', 'Talrand, Sky Summoner',
  'Yeva, Nature\'s Herald', 'Thrasios, Triton Hero', 'Tymna the Weaver',
  'Grist, the Hunger Tide', 'Avacyn, Angel of Hope',
  // The two permanent types that enter with counters on them (CR 306.5b/310.6).
  // Grist above is the planeswalker; this is the only battle in the fixtures,
  // and without it the defense half of that rule has nothing to test against.
  'Invasion of Gobakhan // Lightshield Array',
];

/** Tokens, pinned by set+collector number because names collide wildly. */
const WANTED_TOKENS = [
  { name: 'Soldier', set: 'tmd1', cn: '1', key: 'SOLDIER_TOKEN' },
  { name: 'Treasure', set: 'trna', cn: '12', key: 'TREASURE_TOKEN' },
  { name: 'Beast', set: 'tclb', cn: '38', key: 'BEAST_TOKEN' },
];

function constName(name) {
  return name
    .replace(/\/\//g, ' ')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

async function main() {
  const ndjson = path.join(dataRoot(), 'cards', 'cards.ndjson');
  if (!fs.existsSync(ndjson)) {
    console.error(`No card database at ${ndjson}.\nRun: node electron/cardsvc-worker.cjs --sync`);
    process.exit(1);
  }

  const wantNames = new Set(WANTED);
  const found = new Map();
  const foundTokens = new Map();

  const rl = readline.createInterface({ input: fs.createReadStream(ndjson), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card;
    try {
      card = JSON.parse(line);
    } catch {
      continue;
    }
    if (wantNames.has(card.name) && !found.has(card.name) && card.layout !== 'token') {
      found.set(card.name, card);
    }
    for (const t of WANTED_TOKENS) {
      if (foundTokens.has(t.key)) continue;
      if (card.name === t.name && card.setCode === t.set && card.collectorNumber === t.cn) {
        foundTokens.set(t.key, card);
      }
    }
  }

  const missing = WANTED.filter((n) => !found.has(n));
  const missingTokens = WANTED_TOKENS.filter((t) => !foundTokens.has(t.key));
  if (missing.length || missingTokens.length) {
    console.error('Missing:', [...missing, ...missingTokens.map((t) => `${t.name} (${t.set} ${t.cn})`)].join(', '));
    process.exit(1);
  }

  const lines = [];
  lines.push('// ⚠️ GENERATED by scripts/make-engine-fixtures.cjs — DO NOT EDIT BY HAND.');
  lines.push('//');
  lines.push('// Verbatim `CardData` records from the real Scryfall data, so the engine tests');
  lines.push('// exercise the same text the app will. Hand-editing a value here silently');
  lines.push('// turns a rules test into a test of the edit — the D15b failure mode.');
  lines.push('// Regenerate with `node scripts/make-engine-fixtures.cjs` (needs a synced DB).');
  lines.push('//');
  lines.push('// `scripts/battery-carddb.cjs` cross-checks these against the live database, so');
  lines.push('// a Scryfall rewording fails there rather than rotting silently here.');
  lines.push('');
  lines.push("import type { CardData } from '../cardTypes';");
  lines.push('');

  const exported = [];
  for (const name of WANTED) {
    const card = found.get(name);
    const id = constName(name);
    exported.push(id);
    lines.push(`export const ${id}: CardData = ${JSON.stringify(card, null, 2)};`);
    lines.push('');
  }
  for (const t of WANTED_TOKENS) {
    const card = foundTokens.get(t.key);
    exported.push(t.key);
    lines.push(`export const ${t.key}: CardData = ${JSON.stringify(card, null, 2)};`);
    lines.push('');
  }

  lines.push('/** Every fixture card, for building an OracleDb in a test. */');
  lines.push('export const ENGINE_CARDS: CardData[] = [');
  for (const id of exported) lines.push(`  ${id},`);
  lines.push('];');
  lines.push('');

  const out = path.join(__dirname, '..', 'src', 'data', 'fixtures', 'engineCards.ts');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`Wrote ${exported.length} cards → ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
