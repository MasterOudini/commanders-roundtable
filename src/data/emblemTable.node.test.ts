// D475 - the baked emblem table (`src/data/emblemTable.ts`), the way `tokenTable.node.test.ts` bakes the tokens:
// every `You get an emblem with "Q"` a Commander-legal card prints, resolved to the emblem printing whose text is Q,
// kept only when that printing is engine-complete (its abilities are a shipped script's, run from the command zone).
//
//   CRT_WRITE_EMBLEM_TABLE=1 npx vitest run src/data/emblemTable.node.test.ts   - regenerate
//   npx vitest run src/data/emblemTable.node.test.ts                            - assert the committed table is current
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import { engineCompleteness } from './engineComplete';
import { EMBLEM_TABLE } from './emblemTable';
import { foldTokenQuotes } from './tokenParse';
import type { TokenRef } from './tokenTable';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const OUT = join(__dirname, 'emblemTable.ts');
const WRITE = process.env.CRT_WRITE_EMBLEM_TABLE === '1';

/** The self-reference read as one word, as `matchToken` reads a token's (D473): an emblem says `this emblem`. */
const same = (t: string): string => t.replace(/\s*\([^)]*\)/g, '').replace(/\bthis emblem\b/gi, 'this ~').trim().replace(/\.$/, '');

async function build(): Promise<Record<string, TokenRef>> {
  const emblems: CardData[] = [];
  const quotes = new Set<string>();
  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card: CardData;
    try { card = JSON.parse(line) as CardData; } catch { continue; }
    const face = card.faces[0];
    if (face && /^Emblem\b/.test(face.typeLine)) { emblems.push(card); continue; }
    if (card.commanderLegality !== 'legal') continue;
    for (const f of card.faces) {
      const folded = foldTokenQuotes(f.oracleText ?? '');
      for (const m of folded.text.matchAll(/You get an emblem with #q(\d+)#\./g)) {
        const q = folded.quotes[Number(m[1])];
        if (q !== undefined) quotes.add(q);
      }
    }
  }
  const out: Record<string, TokenRef> = {};
  for (const q of [...quotes].sort()) {
    const hits = emblems.filter((e) => same(e.faces[0]?.oracleText ?? '') === same(q));
    const oracles = new Set(hits.map((h) => h.oracleId));
    // ⚠️ Exactly one emblem, and one the engine RUNS (D473's gate: the quote is the card's own text).
    if (oracles.size !== 1) continue;
    const hit = [...hits].sort((a, b) => a.scryfallId.localeCompare(b.scryfallId))[0] as CardData;
    if (!engineCompleteness(hit).complete) continue;
    out[q] = { oracleId: hit.oracleId, printingId: hit.scryfallId, name: hit.name };
  }
  return out;
}

function render(table: Record<string, TokenRef>): string {
  const head = readFileSync(OUT, 'utf8').split('export const EMBLEM_TABLE')[0] ?? '';
  const rows = Object.keys(table).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])},`).join('\n');
  return `${head}export const EMBLEM_TABLE: Readonly<Record<string, TokenRef>> = {\n${rows}\n};\n`;
}

describe.skipIf(!HAVE_DB)('the baked emblem table', () => {
  test('regenerating the committed table would change nothing', async () => {
    const built = await build();
    const fresh = render(built);
    if (WRITE) writeFileSync(OUT, fresh, 'utf8');
    const committed = readFileSync(OUT, 'utf8');
    expect(fresh).toBe(committed);
    expect(Object.keys(EMBLEM_TABLE).length).toBe(Object.keys(built).length);
  }, 600_000);
});

describe.skipIf(HAVE_DB)('the baked emblem table', () => {
  test('SKIPPED — no card database', () => {
    expect(HAVE_DB).toBe(false);
  });
});
