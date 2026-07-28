// Motion tokens — the single source of every duration, easing and spring in the app.
//
// ⚠️ Nothing outside this file may hard-code a millisecond value for a beat.
// Everything goes through `d(ms)`, which divides by the current animation scale.
// A component that writes `duration: 0.42` cannot be sped up, slowed down,
// fast-forwarded or skipped, and the choreographer's speed governor silently
// stops working for it.
//
// Why these numbers read as MTG Arena rather than "a web page with transitions":
//   • nothing exceeds 520 ms except the life counter (which is a readable count,
//     not a movement);
//   • the settle ALWAYS overshoots — EASE.overshoot peaks at 1.56 and the springs
//     bounce 0.34–0.42, so a card arriving in hand rebounds instead of easing in;
//   • the flight ease is a brief wind-up, then a fast middle, then a soft
//     landing — measured: 0.095 of the distance covered in the first eighth of
//     the time, 0.37 by a quarter, 0.81 by halfway. That is the velocity profile
//     of something thrown, and it is why a card launches across the table rather
//     than sliding evenly to its destination;
//   • taps are 180 ms, so a board of 40 permanents never feels gummy.
//
// ⚠️ Deviation from docs/specs/ui-animation-spec.md §4.4, recorded as D16: the
// spec's `d()` reads `useSettings.getState().timeScale` directly. This file
// instead keeps a module-local scale that the choreographer pushes in. Two
// reasons: (a) the effective scale is the PRODUCT of three inputs — the user's
// speed setting, the speed governor's backpressure rate, and hold-to-fast-forward
// — and only the choreographer knows all three; (b) importing a zustand store
// here would make every animation-math unit test need a store instance.

/** Cubic-bezier control points, in the tuple shape `motion` accepts for `ease`. */
export type Bezier = [number, number, number, number];

export type EaseName =
  | 'out'
  | 'outSoft'
  | 'in'
  | 'inOut'
  | 'flight'
  | 'overshoot'
  | 'impact';

export const EASE: Record<EaseName, Bezier> = {
  /** expo-out — the workhorse settle. */
  out: [0.16, 1, 0.3, 1],
  outSoft: [0.22, 1, 0.36, 1],
  in: [0.5, 0, 0.75, 0],
  inOut: [0.65, 0, 0.35, 1],
  /**
   * Wind-up, fast middle, soft landing → reads as "thrown", not "moved".
   * Both ends are gentle (y₁ ≈ 0, y₂ = 1); the speed lives in the middle third.
   */
  flight: [0.3, 0.05, 0.2, 1],
  /** the Arena signature: overshoot then settle back. */
  overshoot: [0.34, 1.56, 0.64, 1],
  /** slam, then a micro-rebound past 1. */
  impact: [0.2, 0.9, 0.1, 1.02],
};

/** Unscaled durations in ms. Read them through `d()`, never directly. */
export const DUR = {
  microTap: 120,
  hoverLift: 160,
  tap: 180,
  zoomIn: 140,
  fanReflow: 220,
  counterNudge: 220,
  landDrop: 200,
  landThump: 260,
  resolve: 300,
  blockSlide: 300,
  revealFlip: 340,
  attackLunge: 340,
  flourish: 360,
  draw: 420,
  deathDrop: 440,
  damagePunch: 480,
  castFlight: 520,
  /** A floor; the real value comes from `lifeCountMs(delta)`. */
  lifeCount: 520,
  podExpand: 320,
  diceRoll: 700,
  /** Digest mode's whole vocabulary: one fade, no clone. */
  digest: 140,
  /** The lift that precedes a cast flight. */
  castLift: 100,
  /** The hard-sync flash after a reconnect. */
  hardSync: 240,
} as const;

/** Per-item delays inside a coalesced beat, in ms. */
export const STAGGER = {
  draw: 60,
  fanArrive: 28,
  untapSweep: 34,
  attackers: 50,
  blockers: 40,
  stackSlideUp: 40,
} as const;

/**
 * Spring transitions, in `motion`'s own shape so they can be spread straight
 * into an `animate()` options object.
 *
 * ⚠️ SPRINGS ARE FOR TWO-VALUE TRANSITIONS ONLY. `motion` silently produces NO
 * animation when a multi-keyframe array is paired with a spring — e.g.
 * `animate(el, { scale: [1, 1.06, 1] }, SPRING.nudge)` leaves the element's
 * transform constant, with no error and no warning. The beats battery caught two
 * of these as "76 frames, 1 distinct matrix", which reads as "this beat does
 * nothing" rather than as "wrong transition type". For a there-and-back bump use
 * `{ duration: ds(...), ease: EASE.overshoot }` or `EASE.impact` instead.
 */
export const SPRING = {
  /** ≈180 ms visual — a card being turned sideways. */
  tap: { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 },
  /** Hand arrival. The bounce is the point; do not lower it. */
  settle: { type: 'spring', visualDuration: 0.26, bounce: 0.34 },
  lift: { type: 'spring', visualDuration: 0.16, bounce: 0.12 },
  /** Battlefield landing — squash and rebound. */
  thump: { type: 'spring', visualDuration: 0.22, bounce: 0.42 },
  /** Neighbours parting in the hand fan. */
  fan: { type: 'spring', visualDuration: 0.22, bounce: 0.1 },
  /** Badges and counters ticking. */
  nudge: { type: 'spring', stiffness: 700, damping: 30, mass: 0.6 },
} as const;

// ── The scale gate ────────────────────────────────────────────────────────────

/**
 * Product of the user's speed setting, the governor's backpressure rate and
 * hold-to-fast-forward. `Infinity` means "instant" (speed Off), and `d()` maps
 * that to 0 rather than to NaN.
 */
let scale = 1;

/** Set by the choreographer before it constructs a group's beats. */
export function setAnimScale(next: number): void {
  scale = Number.isFinite(next) ? Math.max(0.05, next) : Infinity;
}

export function animScale(): number {
  return scale;
}

/** Scale a duration. THE only way a component may obtain a millisecond value. */
export function d(ms: number): number {
  if (scale === Infinity) return 0;
  return ms / scale;
}

/** Same, in seconds — what `motion`'s `duration` option wants. */
export function ds(ms: number): number {
  return d(ms) / 1000;
}

/**
 * The life counter is the one duration allowed past 520 ms, because it is a
 * number being *read*, not an object being moved: 40 → 12 has to be followable.
 */
export function lifeCountMs(delta: number): number {
  return Math.min(900, Math.max(320, 320 + 22 * Math.abs(delta)));
}

/**
 * Multi-item stagger, capped so a big batch does not become a cutscene: a
 * 7-card opening hand is 420 + 6×60 = 780 ms, and a 20-card mill is still 1.2 s
 * rather than 20 × 60 ms of dead time.
 */
export function staggerFor(count: number, base: number, totalCapMs = 1200): number {
  if (count <= 1) return 0;
  return Math.min(base, totalCapMs / count);
}
