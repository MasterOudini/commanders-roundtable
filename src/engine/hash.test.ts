import { describe, expect, test } from 'vitest';
import { canonicalJson, hash64, hashOf } from './hash';

describe('canonicalJson', () => {
  test('is key-order independent', () => {
    const a = { z: 1, a: 2, m: { q: 3, b: 4 } };
    const b = { m: { b: 4, q: 3 }, a: 2, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":2,"m":{"b":4,"q":3},"z":1}');
  });

  test('preserves ARRAY order — a library is not a set', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
  });

  /**
   * ⚠️ `exactOptionalPropertyTypes` means both spellings occur in real state:
   * a field left off, and a field explicitly set to undefined. They are the
   * same game state and must hash the same, or replay-vs-live comparisons fail
   * for a reason that is invisible in a diff of the two objects.
   */
  test('an absent field and an explicit undefined hash identically', () => {
    expect(canonicalJson({ a: 1 })).toBe(canonicalJson({ a: 1, b: undefined }));
  });

  test('nested arrays of objects sort each object', () => {
    expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  test('null, booleans and strings round-trip', () => {
    expect(canonicalJson({ n: null, t: true, f: false, s: 'x"y' })).toBe(
      '{"f":false,"n":null,"s":"x\\"y","t":true}',
    );
  });

  test('-0 and 0 are the same state', () => {
    expect(canonicalJson({ v: -0 })).toBe(canonicalJson({ v: 0 }));
  });

  test('a non-finite number throws rather than serialising as null', () => {
    // JSON.stringify writes `null` for NaN, which would make two different
    // states hash the same — the one failure mode a state hash must not have.
    expect(() => canonicalJson({ v: NaN })).toThrow();
    expect(() => canonicalJson({ v: Infinity })).toThrow();
  });

  test('parses back to an equal value', () => {
    const v = { a: [1, { b: 'c' }], d: null, e: true };
    expect(JSON.parse(canonicalJson(v))).toEqual(v);
  });
});

describe('hash64', () => {
  test('is 16 lowercase hex characters', () => {
    for (const s of ['', 'a', 'commanders-roundtable', '{"a":1}']) {
      expect(hash64(s)).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  test('is stable', () => {
    expect(hash64('sol ring')).toBe(hash64('sol ring'));
  });

  test('separates near-identical inputs', () => {
    expect(hash64('c1')).not.toBe(hash64('c2'));
    expect(hash64('{"a":1,"b":2}')).not.toBe(hash64('{"a":2,"b":1}'));
  });

  test('has no collisions over 50k structured inputs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50_000; i++) seen.add(hash64(`{"card":"c${i}","zone":"hand"}`));
    expect(seen.size).toBe(50_000);
  });

  test('hashOf agrees with hash64(canonicalJson(v)) and ignores key order', () => {
    const v = { z: 1, a: [2, 3] };
    expect(hashOf(v)).toBe(hash64(canonicalJson(v)));
    expect(hashOf(v)).toBe(hashOf({ a: [2, 3], z: 1 }));
    expect(hashOf(v)).not.toBe(hashOf({ a: [3, 2], z: 1 }));
  });
});
