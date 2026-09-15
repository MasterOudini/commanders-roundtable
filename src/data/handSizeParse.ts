// D442 - THE MAXIMUM HAND SIZE (CR 402.2), read off ONE exact line of a permanent's text.
//
// Six forms, each anchored at both ends (the rule every reader in `replacementParse.ts` follows):
// a prefix match would read `You have no maximum hand size for the rest of the game.` - a SPELL
// effect with a duration the engine has no memory for - as the permanent's static. Measured over
// the leftover (d442/probe-hand.cjs): 23 `You have no maximum hand size.`, 4 `Players have no
// maximum hand size.`, 7 `Your maximum hand size is N.`, 5 `... reduced / increased by N.`, 3
// `Each opponent's maximum hand size is reduced by N.`; the 13 others carry a duration, a chosen
// player, a counter count or a delirium condition and stay unread.
//
// The engine reads the field at the cleanup step (`maxHandSize`, CR 514.1): unlimited when any
// applicable line says `no maximum hand size` (a modifier then has no effect - the printed ruling on
// Spellbook), else seven, replaced by the LAST `set` in battlefield order (timestamp order), then
// every `delta` added, floored at zero.

import type { HandSizeMod } from '../engine/types/oracle';

const NUMBERS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
};

function count(raw: string): number | null {
  const key = raw.toLowerCase();
  if (key in NUMBERS) return NUMBERS[key] ?? null;
  if (/^\d+$/.test(key)) return Number(key);
  return null;
}

const WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|\\d+)';
const YOU_NONE = /^You have no maximum hand size\.$/;
const EACH_NONE = /^Players have no maximum hand size\.$/;
const YOU_SET = new RegExp('^Your maximum hand size is (' + WORD + ')\\.$');
const YOU_DELTA = new RegExp('^Your maximum hand size is (reduced|increased) by (' + WORD + ')\\.$');
const OPP_DELTA = new RegExp("^Each opponent's maximum hand size is reduced by (" + WORD + ')\\.$');

/** One line, as printed. `null` for every other sentence. */
export function parseHandSizeLine(raw: string): HandSizeMod | null {
  const line = raw.trim();
  if (YOU_NONE.test(line)) return { who: 'you', kind: 'none', n: 0, line };
  if (EACH_NONE.test(line)) return { who: 'each', kind: 'none', n: 0, line };
  const set = YOU_SET.exec(line);
  if (set) {
    const n = count(set[1] ?? '');
    return n === null ? null : { who: 'you', kind: 'set', n, line };
  }
  const delta = YOU_DELTA.exec(line);
  if (delta) {
    const n = count(delta[2] ?? '');
    return n === null ? null : { who: 'you', kind: 'delta', n: delta[1] === 'reduced' ? -n : n, line };
  }
  const opp = OPP_DELTA.exec(line);
  if (opp) {
    const n = count(opp[1] ?? '');
    return n === null ? null : { who: 'opponents', kind: 'delta', n: -n, line };
  }
  return null;
}

/** The first hand-size line of a face, read per LINE so no other sentence can make one true. */
export function parseHandSize(oracleText: string): HandSizeMod | null {
  if (!oracleText) return null;
  for (const line of oracleText.split('\n')) {
    const hit = parseHandSizeLine(line);
    if (hit) return hit;
  }
  return null;
}
