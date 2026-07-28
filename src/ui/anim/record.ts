// Per-frame transform recorder. The verification vehicle for every beat.
//
// "Trust me, it overshoots" is not a verification. The only way to assert that a
// motion beat feels like Arena is to sample what the compositor was actually
// given, frame by frame, and assert numeric properties of the track — most
// importantly that the PEAK scale exceeds the SETTLE scale, which is the
// measurable form of "the card rebounded instead of easing in".
//
// ⚠️ Sampling must go through getComputedStyle on the element, not through the
// MotionValues. A MotionValue can be perfectly animated while the element is not
// (a stale ref, a `transform` overwritten by a CSS class, an ancestor with
// `display: none`). Reading the resolved transform is the only measurement that
// cannot lie about what reached the screen.

export interface Sample {
  /** ms since the recording started. */
  t: number;
  /** Translation, in px. */
  x: number;
  y: number;
  /** Uniform scale. */
  scale: number;
  /** rotateZ, in degrees. */
  rotate: number;
  /** rotateY, in degrees — the mid-flight face flip. */
  rotateY: number;
  opacity: number;
  /** The raw matrix, so a failing assertion can be diagnosed. */
  matrix: string;
}

const DEG = 180 / Math.PI;

/**
 * Decompose a computed `transform` matrix.
 *
 * Valid for the exact composition `motion` emits — translate · scale ·
 * rotateZ · rotateY, with a uniform scale — which is what every beat in this app
 * uses. It is not a general TRS decomposition and does not try to be: a general
 * one needs SVD and would be far more code for cases we never produce.
 *
 * Derivation, with s = scale, γ = rotateZ, β = rotateY:
 *   M₃ₓ₃ = s · Rz(γ) · Ry(β)
 *   column 2 is s·(−sin γ, cos γ, 0) → s = |col2|, γ = atan2(−m12, m22)
 *   row 3 is s·(−sin β, 0, cos β)    → β = atan2(−m31/s, m33/s)
 */
export function decomposeTransform(matrix: string): {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  rotateY: number;
} {
  const zero = { x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0 };
  if (!matrix || matrix === 'none') return zero;

  const nums = matrix
    .slice(matrix.indexOf('(') + 1, matrix.lastIndexOf(')'))
    .split(',')
    .map((v) => Number(v.trim()));

  if (matrix.startsWith('matrix3d')) {
    if (nums.length < 16 || nums.some((n) => !Number.isFinite(n))) return zero;
    const m11 = nums[0]!, m12 = nums[4]!, m22 = nums[5]!;
    const m31 = nums[2]!, m33 = nums[10]!;
    const x = nums[12]!, y = nums[13]!;
    const scale = Math.hypot(m12, m22) || Math.hypot(m11, nums[1]!) || 1;
    const rotate = Math.atan2(-m12, m22) * DEG;
    const rotateY = Math.atan2(-m31 / scale, m33 / scale) * DEG;
    return { x, y, scale, rotate, rotateY };
  }

  // Plain 2-D: matrix(a, b, c, d, e, f)
  if (nums.length < 6 || nums.some((n) => !Number.isFinite(n))) return zero;
  const [a, b, , , e, f] = nums as [number, number, number, number, number, number];
  return {
    x: e,
    y: f,
    scale: Math.hypot(a, b) || 1,
    rotate: Math.atan2(b, a) * DEG,
    rotateY: 0,
  };
}

export type Target = string | (() => Element | null);

function resolveTarget(target: Target): Element | null {
  return typeof target === 'string' ? document.querySelector(target) : target();
}

/**
 * Sample an element's transform every animation frame for `ms`.
 *
 * Keeps sampling across frames where the element is briefly absent (a clone
 * mounts one frame after `fly()` is called) so the caller does not have to
 * synchronise with React's commit.
 */
export function recordElement(target: Target, ms: number): Promise<Sample[]> {
  return new Promise((resolve) => {
    const samples: Sample[] = [];
    const t0 = performance.now();
    let seen = false;

    const tick = () => {
      const now = performance.now();
      const el = resolveTarget(target);
      if (el) {
        seen = true;
        const cs = getComputedStyle(el);
        const parts = decomposeTransform(cs.transform);
        samples.push({
          t: now - t0,
          ...parts,
          opacity: Number(cs.opacity),
          matrix: cs.transform,
        });
      } else if (seen) {
        // The element existed and is now gone — it landed and unmounted. Stop
        // early rather than padding the track with nothing.
        resolve(samples);
        return;
      }
      if (now - t0 >= ms) {
        resolve(samples);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Summary statistics a probe can assert on without shipping the whole track. */
export interface TrackSummary {
  frames: number;
  durationMs: number;
  /** Did the transform actually change between consecutive frames? */
  distinctMatrices: number;
  scale: { first: number; last: number; peak: number; min: number };
  rotate: { first: number; last: number };
  rotateY: { first: number; last: number };
  /** Normalised time at which |rotateY| first crosses 90°, or null. */
  flipAtT: number | null;
  x: { first: number; last: number };
  y: { first: number; last: number };
  opacity: { first: number; last: number; min: number };
}

/**
 * @param normalizeMs The beat's REQUESTED duration. Pass it whenever you know it.
 *
 * ⚠️ Normalising against the recorded window instead is subtly wrong, and it
 * produced a flapping assertion. The recording starts on the frame the clone first
 * exists (one frame after the animation begins) and stops on the frame it
 * unmounts, so the observed span is neither the animation's duration nor centred
 * on it. Dividing by that span inflated the measured flip time from 0.50 to
 * anywhere in 0.52–0.60 depending on frame alignment — which looks exactly like a
 * mis-timed keyframe. Dividing by the requested duration leaves only ±1 frame of
 * error, so a 900 ms beat resolves the crossing to ±2%.
 */
export function summarize(samples: Sample[], normalizeMs?: number): TrackSummary | null {
  if (samples.length === 0) return null;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const total = normalizeMs && normalizeMs > 0 ? normalizeMs : last.t - first.t || 1;

  let flipAtT: number | null = null;
  for (let i = 1; i < samples.length; i++) {
    const a = Math.abs(samples[i - 1]!.rotateY);
    const b = Math.abs(samples[i]!.rotateY);
    if ((a - 90) * (b - 90) <= 0 && a !== b) {
      flipAtT = (samples[i]!.t - first.t) / total;
      break;
    }
  }

  const scales = samples.map((s) => s.scale);
  const opacities = samples.map((s) => s.opacity);

  return {
    frames: samples.length,
    durationMs: total,
    distinctMatrices: new Set(samples.map((s) => s.matrix)).size,
    scale: {
      first: first.scale,
      last: last.scale,
      peak: Math.max(...scales),
      min: Math.min(...scales),
    },
    rotate: { first: first.rotate, last: last.rotate },
    rotateY: { first: first.rotateY, last: last.rotateY },
    flipAtT,
    x: { first: first.x, last: last.x },
    y: { first: first.y, last: last.y },
    opacity: {
      first: first.opacity,
      last: last.opacity,
      min: Math.min(...opacities),
    },
  };
}
