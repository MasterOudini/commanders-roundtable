#!/usr/bin/env node
// Register a drafted card script so the app actually runs it — §5. See D157.
//
//   node scripts/cardgen/land.cjs ajanisPridemate [more…]
//
// Takes files already written into `src/engine/scripts/cards/` and adds them to
// `SHIPPED_SCRIPTS`. It does NOT write card logic: drafting is a reviewed step
// (see README.md), and a tool that both writes and lands a script is a tool that
// can land one nobody read.
//
// ⚠️ **IT REGISTERS AND THEN REFUSES TO CLAIM SUCCESS.** Landing is only real
// once `verify.cjs` is green, so this prints the next command rather than
// implying the card is done. The accounting a landed card owes is enforced by
// `shippedScripts.node.test.ts` and the fuzz-pool checks in `fuzz.node.test.ts`,
// neither of which this can satisfy on the card's behalf.

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..', '..');
const cardsDir = join(root, 'src', 'engine', 'scripts', 'cards');
const registryPath = join(root, 'src', 'engine', 'scripts', 'registry.ts');
const CR = '\r\n';

const names = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (names.length === 0) {
  console.error('usage: node scripts/cardgen/land.cjs <moduleName> [more…]');
  console.error('  each must already exist as src/engine/scripts/cards/<moduleName>.ts');
  process.exit(2);
}

/** The exported const a card module must provide, derived from its file name. */
const exportOf = (mod) => mod.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase() + '_SCRIPT';

const landing = [];
for (const mod of names) {
  const file = join(cardsDir, `${mod}.ts`);
  if (!existsSync(file)) {
    console.error(`no such module: src/engine/scripts/cards/${mod}.ts`);
    process.exit(1);
  }
  const src = readFileSync(file, 'utf8');
  const wanted = exportOf(mod);
  // ⚠️ The export name is CHECKED rather than discovered. A module whose export
  // this cannot predict is one the registry import would silently miss, and a
  // script that is present but unimported runs never — which looks exactly like
  // a script that is present and working.
  if (!new RegExp(`export const ${wanted}\\b`).test(src)) {
    console.error(`${mod}.ts does not export ${wanted}`);
    console.error('  a card module exports exactly one CardScript, named after its file');
    process.exit(1);
  }
  landing.push({ mod, exported: wanted });
}

let registry = readFileSync(registryPath, 'utf8');
// ⚠️ WORD-BOUNDARY, not includes() (D184): `KINGFISHER_SCRIPT` is a
// substring of `ITHILIEN_KINGFISHER_SCRIPT`, and the plain substring test
// refused a fresh card the day the shorter name followed the longer one in.
// `_` is a word character, so \b correctly rejects the embedded match while
// still catching a genuine duplicate.
const already = landing.filter((l) => new RegExp(`\\b${l.exported}\\b`).test(registry));
if (already.length > 0) {
  console.error(`already landed: ${already.map((l) => l.exported).join(', ')}`);
  process.exit(1);
}

const imports = landing.map((l) => `import { ${l.exported} } from './cards/${l.mod}';`).join(CR);
const anchor = "import type { OracleId } from '../types/ids';";
if (!registry.includes(anchor)) {
  console.error('registry.ts has changed shape — land these by hand and fix this script.');
  process.exit(1);
}
registry = registry.replace(anchor, anchor + CR + imports);

const listAnchor = 'export const SHIPPED_SCRIPTS: readonly CardScript[] = [';
if (!registry.includes(listAnchor)) {
  console.error('SHIPPED_SCRIPTS has changed shape — land these by hand and fix this script.');
  process.exit(1);
}
const entries = landing.map((l) => `  ${l.exported},`).join(CR);
registry = registry.replace(
  `${listAnchor}];`,
  `${listAnchor}${CR}${entries}${CR}];`,
);
// A list that already has entries: insert after the opening bracket instead.
if (!registry.includes(entries)) {
  registry = registry.replace(listAnchor, `${listAnchor}${CR}${entries}`);
}

writeFileSync(registryPath, registry);
console.log(`registered ${landing.length} script(s) in SHIPPED_SCRIPTS:`);
for (const l of landing) console.log(`  ${l.exported}  ← cards/${l.mod}.ts`);
console.log('\n⚠️ NOT LANDED YET. Each of these now owes:');
console.log('  · its tier3 note silent and engineComplete accepting it');
console.log('  · a place in the fuzz gate’s SCRIPTS *and* its DECK');
console.log('  · per-card tests written against the real oracle text');
console.log('\nNext:  node scripts/cardgen/verify.cjs --full');
