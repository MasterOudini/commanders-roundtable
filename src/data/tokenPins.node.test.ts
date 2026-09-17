// D445 - THE TOKEN-PIN GUARD. A token a shipped script can create must be a printing the engine fixtures hold, or
// the fuzz oracle derives it to a nameless 0/0 the state-based action bins (D133's reason). The port's token-pin step
// pins every `tokenRef` a wave's modules name; what it never saw was a token INSIDE a pay prompt's branch
// (`You may pay {2}. If you do, create a 4/4 green Fungus Beast`) - Trudge Garden's Beast reached the fuzz's named-token
// canary only once the driver's economy could pay the {2}, 200 decisions after the card landed. This reads every
// module the way the fuzz would: every `tokenRef` key, and every token the vocabulary resolves out of a
// `vocabularyEffects` payload, the pay branches and the delayed lists included.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ENGINE_CARDS } from './fixtures/engineCards';
import { TOKEN_TABLE } from './tokenTable';
import { vocabularyEffects } from '../engine/scripts/vocabulary';

type E = { token?: { printingId?: string } | null; pay?: { ifPaid?: readonly E[]; ifNotPaid?: readonly E[] } | null; delay?: { effects?: readonly E[] } | null };
function tokensOf(effects: readonly E[], out: string[]): void {
  for (const e of effects) {
    if (e.token?.printingId) out.push(e.token.printingId);
    if (e.pay) { tokensOf(e.pay.ifPaid ?? [], out); tokensOf(e.pay.ifNotPaid ?? [], out); }
    if (e.delay?.effects) tokensOf(e.delay.effects, out);
  }
}

describe('the tokens the shipped scripts create are fixtures (D445)', () => {
  test('every tokenRef key and every vocabulary token names a pinned printing', () => {
    const dir = 'src/engine/scripts/cards';
    const pinned = new Set(ENGINE_CARDS.map((c) => c.scryfallId));
    const table = TOKEN_TABLE as Record<string, { printingId: string; name: string } | undefined>;
    const TOKEN_REF = new RegExp('tokenRef' + String.fromCharCode(92) + '("([^"]+)"' + String.fromCharCode(92) + ')', 'g');
    // D476 - the call site's options ride too: a `{ memo: true }` payload reads `that many` tokens as its module does.
    const re = new RegExp("vocabularyEffects\\(\\s*(\"(?:[^\"\\\\]|\\\\.)*\")([^)]*)\\)", 'g');
    const missing: string[] = [];
    let refs = 0;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
      const text0 = readFileSync(dir + '/' + f, 'utf8');
      for (const m of text0.matchAll(TOKEN_REF)) {
        refs++;
        const ref = table[m[1] as string];
        if (!ref) missing.push(f + ': no TOKEN_TABLE entry ' + m[1]);
        else if (!pinned.has(ref.printingId)) missing.push(f + ': ' + ref.name + ' [' + m[1] + '] ' + ref.printingId);
      }
      for (const m of text0.matchAll(re)) {
        const text = JSON.parse(m[1] as string) as string;
        if (!/token/i.test(text)) continue;
        const ids: string[] = [];
        tokensOf(vocabularyEffects(text, f, { memo: /memo: true/.test(m[2] ?? '') }) as never, ids);
        for (const pid of ids) {
          refs++;
          if (!pinned.has(pid)) missing.push(f + ': ' + (Object.keys(table).find((k) => table[k]?.printingId === pid) ?? pid));
        }
      }
    }
    expect(refs).toBeGreaterThan(300);
    expect(missing).toEqual([]);
  });
});
