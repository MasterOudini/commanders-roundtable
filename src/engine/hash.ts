// Canonical serialisation + a 64-bit state hash.
//
// Two jobs, both of them about being able to say "these two states are the
// same" with certainty:
//
//  • REPLAY EQUIVALENCE. `stateHash(replay(log)) === stateHash(live)` is the
//    single assertion the whole determinism story rests on (M3 step 11). It is
//    only meaningful if the serialisation is canonical — otherwise two
//    structurally identical states built by different code paths (setup vs
//    replay) hash differently purely because `JSON.stringify` preserves
//    insertion order, and the test fails for a reason that has nothing to do
//    with the rules.
//  • DESYNC DETECTION (M4). The client recomputes the hash of its patched view
//    and compares it with the host's.
//
// ⚠️ Not a cryptographic hash and not trying to be. The threat model is
// "friends playing a game", where the job is catching an accidental divergence,
// not resisting a forged collision.

/**
 * JSON with every object's keys in sorted order.
 *
 * `undefined` members are dropped (matching `JSON.stringify`), so a field that
 * is absent and a field explicitly set to `undefined` hash identically — which
 * matters under `exactOptionalPropertyTypes`, where both spellings occur.
 */
export function canonicalJson(value: unknown): string {
  return write(value);
}

function write(v: unknown): string {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'number') {
    // -0 and 0 are the same game state; JSON.stringify already folds them, but
    // being explicit costs nothing and documents the intent.
    if (!Number.isFinite(v as number)) throw new Error(`canonicalJson: non-finite number ${String(v)}`);
    return JSON.stringify(v === 0 ? 0 : v);
  }
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'string') return JSON.stringify(v);
  if (t === 'undefined' || t === 'function' || t === 'symbol') return 'null';
  if (Array.isArray(v)) {
    let out = '[';
    for (let i = 0; i < v.length; i++) {
      if (i > 0) out += ',';
      out += write(v[i]);
    }
    return out + ']';
  }
  if (t === 'object') {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    let out = '{';
    let first = true;
    for (const k of keys) {
      const val = obj[k];
      if (val === undefined) continue;
      if (!first) out += ',';
      first = false;
      out += JSON.stringify(k) + ':' + write(val);
    }
    return out + '}';
  }
  if (t === 'bigint') return JSON.stringify((v as bigint).toString());
  return 'null';
}

/**
 * A 64-bit hash of a string, as 16 lowercase hex characters.
 *
 * Two independent 32-bit lanes with `Math.imul`, then a cross-avalanche.
 * BigInt would be tidier to read and roughly 20× slower; the replay fuzzer
 * hashes 100 000 states, so the lanes earn their keep.
 */
export function hash64(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** `hash64(canonicalJson(v))`. The one function callers should reach for. */
export function hashOf(value: unknown): string {
  return hash64(canonicalJson(value));
}
