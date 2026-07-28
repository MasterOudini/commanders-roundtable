// Flight-path geometry. PURE — no DOM, no React, no motion. Unit-tested.
//
// A card crossing the table on a straight line reads as a UI transition. The
// same card on a shallow arc reads as an object being thrown, and that single
// difference is most of what makes a table feel physical rather than web-shaped.
//
// One quadratic bezier with one control point, offset perpendicular to the
// straight line. The offset is signed so the bow always goes AWAY from the
// nearest viewport edge: a card drawn from the library at the bottom of the
// screen arcs up into the middle of the table, not down off the edge where the
// arc would be clipped and the motion would read as a glitch.

export interface Pt {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function centerOf(r: RectLike): Pt {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export interface Viewport {
  w: number;
  h: number;
}

/**
 * The single control point.
 *
 * @param arc 0 = straight. 0.22 = the draw beat's bow. Expressed as a fraction
 *            of the flight distance, so a short hop bows a little and a
 *            cross-table flight bows a lot — which is what "thrown" looks like.
 *
 * ⚠️ The bow direction is chosen by "which way is the viewport centre", NOT by
 * "is the midpoint in the bottom half". The obvious version —
 * `sign = mid.y > viewportH/2 ? +1 : -1` — is what the spec sketches and it is
 * WRONG for half of all flights: the perpendicular `(-dy, dx)` flips with the
 * direction of travel, so a fixed sign bows a right-going flight up and a
 * left-going flight down. A unit test caught it (an opponent's draw arced off the
 * top of the screen while mine arced correctly). Projecting onto the direction of
 * the viewport centre is the same intent expressed so it cannot invert, and it
 * needs no special case for near-vertical flights either.
 */
export function controlPoint(from: Pt, to: Pt, arc: number, viewport: Viewport): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  // A zero-length flight has no perpendicular; bow straight up so the card still
  // visibly moves rather than producing NaN and vanishing.
  if (dist < 0.5) return { x: mid.x, y: mid.y - arc * 40 };

  const nx = -dy / dist;
  const ny = dx / dist;
  const towardCentreX = viewport.w / 2 - mid.x;
  const towardCentreY = viewport.h / 2 - mid.y;
  const sign = nx * towardCentreX + ny * towardCentreY >= 0 ? 1 : -1;
  const off = arc * dist * sign;
  return { x: mid.x + nx * off, y: mid.y + ny * off };
}

export function bezierAt(from: Pt, ctrl: Pt, to: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u;
  const b = 2 * u * t;
  const c = t * t;
  return {
    x: a * from.x + b * ctrl.x + c * to.x,
    y: a * from.y + b * ctrl.y + c * to.y,
  };
}

/**
 * Sample the path at the given times, as two keyframe arrays.
 *
 * Motion interpolates linearly between keyframes, so 5 samples of a quadratic
 * are visually indistinguishable from the true curve at these distances while
 * costing one MotionValue instead of a per-frame callback.
 */
export function pathKeys(
  from: Pt,
  ctrl: Pt,
  to: Pt,
  times: readonly number[],
): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (const t of times) {
    const p = bezierAt(from, ctrl, to, t);
    x.push(p.x);
    y.push(p.y);
  }
  return { x, y };
}

/**
 * Keyframe times for scale, flip and spin. Normalised WALL-CLOCK time.
 *
 * ⚠️ These are time fractions, not bezier parameters, and the distinction is not
 * pedantic — it was a real bug. The first implementation drove every property off
 * one progress value that was itself eased with EASE.flight, so a keyframe "at
 * 0.5" actually happened at 32% of the elapsed time: the card's face flip
 * finished while it was still only two thirds of the way across. The battery
 * caught it (`rotateY crosses 90° at t=0.318`).
 *
 * The fix is that the driving MotionValue is now LINEAR in time, and the flight
 * ease is instead baked into where the position keyframes SAMPLE the curve (see
 * `easedPathKeys`). One MotionValue still drives the whole flight, every keyframe
 * time now means the same thing, and the flip crosses 90° at exactly half the
 * flight — which is also what makes it read as one physical motion.
 */
export const FLIGHT_TIMES = [0, 0.32, 0.5, 0.68, 1] as const;

/** Position samples. Denser than FLIGHT_TIMES because the path is a curve. */
export const PATH_TIMES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1] as const;

/**
 * Evaluate a CSS cubic-bezier easing at time `t`, i.e. solve Bx(s) = t for s and
 * return By(s). Newton–Raphson with a bisection fallback; 8 iterations is far
 * more than enough for a 1e-6 tolerance on these curves.
 *
 * Needed because the flight ease has to be applied when SAMPLING the path, not
 * when playing back the keyframes.
 */
export function cubicBezierEase(curve: readonly number[], t: number): number {
  const x1 = curve[0] ?? 0;
  const y1 = curve[1] ?? 0;
  const x2 = curve[2] ?? 1;
  const y2 = curve[3] ?? 1;
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const bx = (s: number) => {
    const u = 1 - s;
    return 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s;
  };
  const by = (s: number) => {
    const u = 1 - s;
    return 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s;
  };
  const dbx = (s: number) => {
    const u = 1 - s;
    return 3 * u * u * x1 + 6 * u * s * (x2 - x1) + 3 * s * s * (1 - x2);
  };

  let s = t;
  for (let i = 0; i < 8; i++) {
    const err = bx(s) - t;
    if (Math.abs(err) < 1e-6) return by(s);
    const slope = dbx(s);
    // A flat slope makes Newton diverge; fall back to bisection for the rest.
    if (Math.abs(slope) < 1e-6) break;
    s -= err / slope;
  }
  let lo = 0;
  let hi = 1;
  s = t;
  for (let i = 0; i < 24; i++) {
    const x = bx(s);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return by(s);
}

/**
 * Position keyframes on a LINEAR time grid, with the flight ease baked in by
 * sampling the curve at eased parameters. The card still launches out of the
 * library and settles into the hand; the difference is that every other
 * property's keyframe times now mean wall-clock time too.
 */
export function easedPathKeys(
  from: Pt,
  ctrl: Pt,
  to: Pt,
  ease: readonly number[],
  times: readonly number[] = PATH_TIMES,
): { x: number[]; y: number[] } {
  return pathKeys(
    from,
    ctrl,
    to,
    times.map((t) => cubicBezierEase(ease, t)),
  );
}

/**
 * Scale keyframes, in the DESTINATION size basis.
 *
 * ⚠️ Deviation from ui-animation-spec §4.5, recorded as D17. The spec quotes
 * scale numbers in two different bases — `draw` ends at 1.00 (destination basis)
 * while `cast` ends at 0.635 and annotates it "132/208" (source basis). Mixing
 * bases means a beat lands a pixel or two off its slot, and the error is
 * different per beat, which is unfalsifiable by eye.
 *
 * So: the clone is ALWAYS rendered at the destination size and scale is always
 * relative to that. The first keyframe is forced to `fromH/toH` so the clone
 * starts exactly covering the source, and the last is forced to exactly 1 so it
 * lands pixel-perfect on the destination slot. Beats only choose the mid-flight
 * bulge.
 *
 * The bulge is not decoration: a card that grows slightly as it crosses the
 * middle of the table reads as passing nearer the viewer. `peak > 1` is also the
 * numeric signature of "the overshoot actually happened", which is how the beats
 * battery asserts feel.
 */
export function scaleKeys(fromH: number, toH: number, peak: number): number[] {
  const s0 = toH > 0 ? fromH / toH : 1;
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;
  return [s0, mix(s0, peak, 0.62), peak, mix(peak, 1, 0.72), 1];
}

/** Default bulge: always a little, because a perfectly linear scale reads dead. */
export function defaultPeak(fromH: number, toH: number): number {
  const s0 = toH > 0 ? fromH / toH : 1;
  return Math.max(s0, 1) * 1.06;
}

/**
 * rotateY keyframes for the mid-flight face flip.
 *
 * ⚠️ The 90° crossing must land at the ARC APEX (t = 0.5), not at the start or
 * the end. Edge-on at the apex is what makes a drawn card look like it is being
 * turned over as it travels; flipping early looks like the card was already
 * face-up and flipping late looks like a glitch at the destination. The beats
 * battery asserts the crossing is inside t ∈ [0.45, 0.55] for exactly this
 * reason.
 */
export function flipKeys(faceUpAtStart: boolean, faceUpAtEnd: boolean): number[] {
  if (faceUpAtStart === faceUpAtEnd) {
    const held = faceUpAtStart ? 0 : 180;
    return [held, held, held, held, held];
  }
  return faceUpAtEnd
    ? [180, 180, 90, 0, 0] // back → front, edge-on at the apex
    : [0, 0, 90, 180, 180]; // front → back
}
