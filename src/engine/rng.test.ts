import { describe, expect, test } from 'vitest';
import {
  flipCoin,
  nextBelow,
  nextU32,
  rollDie,
  sameRng,
  seedRng,
  shuffle,
  type RngState,
} from './rng';

/**
 * Known-answer vectors.
 *
 * ⚠️ These were generated from this implementation, so they do not validate
 * sfc32 against a reference — they LOCK THE SEQUENCE. That is the property that
 * actually matters: a refactor that changes a single shift silently changes
 * every shuffle in every saved game, and a golden log recorded last week would
 * replay to a different board with no error anywhere. Regenerating these
 * numbers is therefore a deliberate act that must come with a DECISIONS entry.
 */
const VECTORS: readonly { seed: string; first: readonly number[] }[] = [
  { seed: 'commanders-roundtable', first: [4225906643, 1396182867, 695717728, 4234490822, 71427225] },
  { seed: 'game-1', first: [3493898357, 1915383512, 832344308, 204507804, 1939306944] },
  { seed: 'game-2', first: [759907545, 2797242412, 1074068776, 4248041538, 1050107603] },
  { seed: '', first: [1402465000, 3326695321, 2578689289, 1354170855, 4293656207] },
];

function take(seed: string, n: number): number[] {
  let s = seedRng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = nextU32(s);
    out.push(d.value);
    s = d.next;
  }
  return out;
}

describe('rng', () => {
  test.each(VECTORS)('$seed produces its recorded sequence', ({ seed, first }) => {
    expect(take(seed, first.length)).toEqual([...first]);
  });

  test('every output is a uint32', () => {
    for (const v of take('range', 500)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });

  test('the same seed replays identically and a different seed does not', () => {
    expect(take('alpha', 40)).toEqual(take('alpha', 40));
    expect(take('alpha', 40)).not.toEqual(take('alphb', 40));
  });

  test('a state survives a JSON round-trip', () => {
    let s = seedRng('json');
    for (let i = 0; i < 17; i++) s = nextU32(s).next;
    const revived = JSON.parse(JSON.stringify(s)) as RngState;
    expect(sameRng(s, revived)).toBe(true);
    expect(nextU32(revived).value).toBe(nextU32(s).value);
  });

  test('nextU32 does not mutate its input', () => {
    const s = seedRng('immutable');
    const copy = { ...s };
    nextU32(s);
    nextU32(s);
    expect(s).toEqual(copy);
  });

  /**
   * The bias `% n` would introduce is tiny for a 99-card library and enormous
   * for the pathological n we can measure quickly. This uses a real n (7, the
   * opening hand size) over 10⁶ draws — the χ² of a modulo-biased generator at
   * this n and count is not distinguishable, so the test that actually catches
   * the bug is the `limit` one below it.
   */
  test('nextBelow is unbiased over 10^6 draws', () => {
    const n = 7;
    const counts = new Array<number>(n).fill(0);
    let s = seedRng('uniform');
    const draws = 1_000_000;
    for (let i = 0; i < draws; i++) {
      const d = nextBelow(s, n);
      s = d.next;
      counts[d.value] = (counts[d.value] ?? 0) + 1;
    }
    const expected = draws / n;
    // χ² with 6 degrees of freedom: 22.46 is the 0.999 critical value.
    let chi2 = 0;
    for (const c of counts) chi2 += ((c - expected) ** 2) / expected;
    expect(chi2).toBeLessThan(22.46);
    for (const c of counts) expect(Math.abs(c - expected) / expected).toBeLessThan
      (0.01);
  });

  /**
   * The direct test for the rejection window. With n = 0x60000000, `% n` maps
   * [0, 0x40000000) to residues twice as often as [0x40000000, n) — a 2:1 bias
   * that a naive implementation shows immediately. Rejection sampling must give
   * the two halves equal weight.
   */
  test('nextBelow rejects rather than folding the top of the range', () => {
    const n = 0x60000000;
    let s = seedRng('rejection');
    let low = 0;
    let high = 0;
    for (let i = 0; i < 200_000; i++) {
      const d = nextBelow(s, n);
      s = d.next;
      if (d.value < 0x30000000) low++;
      else high++;
    }
    const ratio = low / high;
    expect(ratio).toBeGreaterThan(0.98);
    expect(ratio).toBeLessThan(1.02);
  });

  test('nextBelow(1) consumes no entropy', () => {
    const s = seedRng('one');
    const d = nextBelow(s, 1);
    expect(d.value).toBe(0);
    expect(sameRng(d.next, s)).toBe(true);
  });

  test('nextBelow rejects a non-positive or non-integer n', () => {
    const s = seedRng('bad');
    expect(() => nextBelow(s, 0)).toThrow();
    expect(() => nextBelow(s, -3)).toThrow();
    expect(() => nextBelow(s, 2.5)).toThrow();
  });

  test('shuffle is a permutation and leaves the input alone', () => {
    const deck = Array.from({ length: 99 }, (_, i) => i);
    const frozen = [...deck];
    const out = shuffle(seedRng('deck'), deck);
    expect(deck).toEqual(frozen);
    expect([...out.value].sort((a, b) => a - b)).toEqual(frozen);
    expect(out.value).not.toEqual(frozen);
  });

  test('shuffle is stable for a seed and different across seeds', () => {
    const deck = Array.from({ length: 99 }, (_, i) => i);
    expect(shuffle(seedRng('s1'), deck).value).toEqual(shuffle(seedRng('s1'), deck).value);
    expect(shuffle(seedRng('s1'), deck).value).not.toEqual(shuffle(seedRng('s2'), deck).value);
  });

  test('shuffle of 0 or 1 elements consumes no entropy', () => {
    const s = seedRng('tiny');
    expect(sameRng(shuffle(s, []).next, s)).toBe(true);
    expect(sameRng(shuffle(s, ['x']).next, s)).toBe(true);
  });

  /**
   * Every position must be reachable from every start. A Fisher–Yates written
   * with `nextBelow(i)` instead of `nextBelow(i + 1)` still looks shuffled but
   * can never leave an element in place — a real, published bug class.
   */
  test('shuffle can move any element to any position', () => {
    const seen = new Set<string>();
    let s = seedRng('coverage');
    for (let i = 0; i < 4000; i++) {
      const r = shuffle(s, [0, 1, 2, 3]);
      s = r.next;
      seen.add(r.value.join(''));
    }
    expect(seen.size).toBe(24);
  });

  test('rollDie is 1-based and covers its whole range', () => {
    let s = seedRng('dice');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const d = rollDie(s, 20);
      s = d.next;
      expect(d.value).toBeGreaterThanOrEqual(1);
      expect(d.value).toBeLessThanOrEqual(20);
      seen.add(d.value);
    }
    expect(seen.size).toBe(20);
  });

  test('flipCoin is roughly fair', () => {
    let s = seedRng('coin');
    let heads = 0;
    for (let i = 0; i < 100_000; i++) {
      const d = flipCoin(s);
      s = d.next;
      if (d.value) heads++;
    }
    expect(Math.abs(heads - 50_000)).toBeLessThan(1000);
  });
});
