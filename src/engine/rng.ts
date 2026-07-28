// The only source of randomness in the game. Everything else in `src/engine/`
// is a pure function of state.
//
// ⚠️ `Math.random()` is banned engine-wide (purity.test.ts enforces it). Every
// draw goes through an explicit `RngState` that is threaded through the event
// log as `rngBefore` / `rngAfter`, which is what makes a replay bit-exact rather
// than merely plausible. If a shuffle could consume entropy the log does not
// record, a replayed game would diverge from the played one on the first draw
// and every downstream assertion would be worthless.
//
// The generator is sfc32 (Small Fast Counter, 32-bit): four uint32 words, all
// arithmetic done with `| 0` / `>>> 0` so it is bit-identical on every JS engine
// and across a JSON round-trip. It passes PractRand well past the sizes a card
// game needs, and — the property that actually matters here — it has no hidden
// state, so `{a,b,c,d}` in an NDJSON line fully determines the future.

/** Four uint32 words. Serialises to JSON losslessly, which replay depends on. */
export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** A draw: the value, plus the state to carry forward. Never mutates its input. */
export interface Draw<T> {
  readonly value: T;
  readonly next: RngState;
}

/** xmur3 — a string → uint32 stream, used only to expand a seed into four words. */
function seedWords(seed: string): [number, number, number, number] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const step = (): number => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
  return [step(), step(), step(), step()];
}

/**
 * Expand a seed string into a warmed-up generator state.
 *
 * The 12 discarded outputs are not superstition: sfc32 seeded straight from a
 * hash correlates its first few outputs with the seed, so two games seeded
 * `'game-1'` and `'game-2'` would deal suspiciously similar opening hands.
 */
export function seedRng(seed: string): RngState {
  const [a, b, c, d] = seedWords(seed);
  let s: RngState = { a, b, c, d };
  for (let i = 0; i < 12; i++) s = nextU32(s).next;
  return s;
}

/** One 32-bit draw. Pure: returns the value and the successor state. */
export function nextU32(s: RngState): Draw<number> {
  const t = (((s.a + s.b) | 0) + s.d) | 0;
  const d = (s.d + 1) | 0;
  const a = s.b ^ (s.b >>> 9);
  const b = (s.c + (s.c << 3)) | 0;
  let c = (s.c << 21) | (s.c >>> 11);
  c = (c + t) | 0;
  return { value: t >>> 0, next: { a, b, c, d } };
}

/**
 * A uniform integer in [0, n).
 *
 * ⚠️ Rejection sampling, not `% n`. The modulo shortcut biases the low values by
 * up to one part in 2³²/n, which is invisible in a hand of seven and obvious
 * over a 99-card shuffle repeated across a fuzzer run — exactly the kind of bug
 * that makes a "random" deck feel wrong without ever failing a test that only
 * checks the output is in range. `rng.test.ts` measures the distribution over
 * 10⁶ draws.
 */
export function nextBelow(s: RngState, n: number): Draw<number> {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`nextBelow: n must be a positive integer, got ${n}`);
  if (n === 1) return { value: 0, next: s };
  // The largest multiple of n that fits in 2³². Values at or above it are
  // rejected, which leaves every residue class exactly equally likely.
  const limit = Math.floor(0x100000000 / n) * n;
  let cur = s;
  // Bounded so a pathological state can never hang the engine loop. The
  // expected number of iterations is < 2 for every n.
  for (let guard = 0; guard < 1000; guard++) {
    const draw = nextU32(cur);
    cur = draw.next;
    if (draw.value < limit) return { value: draw.value % n, next: cur };
  }
  throw new Error('nextBelow: rejection sampling failed to terminate');
}

/** Fisher–Yates, descending. Returns a new array; the input is untouched. */
export function shuffle<T>(s: RngState, xs: readonly T[]): Draw<T[]> {
  const out = [...xs];
  let cur = s;
  for (let i = out.length - 1; i > 0; i--) {
    const draw = nextBelow(cur, i + 1);
    cur = draw.next;
    const j = draw.value;
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return { value: out, next: cur };
}

/** A d<sides> roll, 1-based, for the Tier-3 dice tool. */
export function rollDie(s: RngState, sides: number): Draw<number> {
  const draw = nextBelow(s, sides);
  return { value: draw.value + 1, next: draw.next };
}

/** A coin flip. `true` is heads. */
export function flipCoin(s: RngState): Draw<boolean> {
  const draw = nextBelow(s, 2);
  return { value: draw.value === 1, next: draw.next };
}

/** Structural equality, for asserting an event's recorded rngAfter. */
export function sameRng(a: RngState, b: RngState): boolean {
  return a.a === b.a && a.b === b.b && a.c === b.c && a.d === b.d;
}
