import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIMES,
  PATH_TIMES,
  bezierAt,
  centerOf,
  controlPoint,
  cubicBezierEase,
  defaultPeak,
  easedPathKeys,
  flipKeys,
  pathKeys,
  scaleKeys,
} from './arc';
import { EASE } from './tokens';

const VP = { w: 1920, h: 1080 };
const EASE_FLIGHT = EASE.flight;

describe('centerOf', () => {
  it('is the rect centre', () => {
    expect(centerOf({ left: 10, top: 20, width: 100, height: 200 })).toEqual({ x: 60, y: 120 });
  });
});

describe('controlPoint', () => {
  it('bows away from the nearest viewport edge — BOTH travel directions', () => {
    // ⚠️ This is the test that caught the sign bug. The naive
    // `sign = mid.y > h/2 ? +1 : -1` bows a right-going flight the opposite way
    // from a left-going one, because the perpendicular (-dy, dx) flips with the
    // direction of travel. Both cases below have to hold at once.

    // My draw: library bottom-right → hand, both low. Must bow UP.
    const mine = controlPoint({ x: 1600, y: 950 }, { x: 900, y: 960 }, 0.22, VP);
    expect(mine.y).toBeLessThan(955);

    // An opponent's draw: their library top-left → their hand chip, both high,
    // travelling the other way. Must bow DOWN, into the table.
    const theirs = controlPoint({ x: 300, y: 120 }, { x: 1000, y: 130 }, 0.22, VP);
    expect(theirs.y).toBeGreaterThan(125);

    // And the same pair reversed, so neither direction is privileged.
    expect(controlPoint({ x: 900, y: 960 }, { x: 1600, y: 950 }, 0.22, VP).y)
      .toBeLessThan(955);
    expect(controlPoint({ x: 1000, y: 130 }, { x: 300, y: 120 }, 0.22, VP).y)
      .toBeGreaterThan(125);
  });

  it('bows toward the horizontal centre for a near-vertical flight', () => {
    // A resolve: stack → battlefield, straight down the middle-left of the table.
    // There is no meaningful "up or down" bow here; the arc is horizontal, and it
    // should curve INWARD rather than off the left edge.
    const ctrl = controlPoint({ x: 240, y: 300 }, { x: 250, y: 800 }, 0.2, VP);
    expect(ctrl.x).toBeGreaterThan(245);
  });

  it('offsets perpendicular to the line, by arc × distance', () => {
    const from = { x: 0, y: 900 };
    const to = { x: 400, y: 900 };
    const ctrl = controlPoint(from, to, 0.25, VP);
    expect(ctrl.x).toBeCloseTo(200, 6); // still at the midpoint along the line
    expect(Math.abs(ctrl.y - 900)).toBeCloseTo(0.25 * 400, 6);
  });

  it('is straight when arc is 0', () => {
    const ctrl = controlPoint({ x: 0, y: 0 }, { x: 100, y: 100 }, 0, VP);
    expect(ctrl).toEqual({ x: 50, y: 50 });
  });

  it('never returns NaN for a zero-length flight', () => {
    // A card "moving" to the zone it is already in is a real case: the Tier-3
    // move tool, and a coalesced A→B→A hop. NaN here would make the clone vanish.
    const ctrl = controlPoint({ x: 500, y: 500 }, { x: 500, y: 500 }, 0.22, VP);
    expect(Number.isFinite(ctrl.x)).toBe(true);
    expect(Number.isFinite(ctrl.y)).toBe(true);
    expect(ctrl.y).toBeLessThan(500); // still visibly moves
  });
});

describe('bezierAt', () => {
  const from = { x: 0, y: 0 };
  const ctrl = { x: 50, y: -100 };
  const to = { x: 100, y: 0 };

  it('hits both endpoints exactly', () => {
    expect(bezierAt(from, ctrl, to, 0)).toEqual(from);
    expect(bezierAt(from, ctrl, to, 1)).toEqual(to);
  });

  it('passes through the expected apex', () => {
    // A quadratic at t=0.5 is (from + 2·ctrl + to)/4.
    expect(bezierAt(from, ctrl, to, 0.5)).toEqual({ x: 50, y: -50 });
  });

  it('is monotone along the flight direction', () => {
    let prev = -Infinity;
    for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const x = bezierAt(from, ctrl, to, t).x;
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
});

describe('pathKeys', () => {
  it('samples once per time and pins the endpoints', () => {
    const from = { x: 10, y: 20 };
    const to = { x: 500, y: 300 };
    const ctrl = controlPoint(from, to, 0.18, VP);
    const { x, y } = pathKeys(from, ctrl, to, FLIGHT_TIMES);
    expect(x).toHaveLength(FLIGHT_TIMES.length);
    expect(x[0]).toBe(10);
    expect(y[0]).toBe(20);
    expect(x[x.length - 1]).toBe(500);
    expect(y[y.length - 1]).toBe(300);
  });
});

describe('scaleKeys', () => {
  it('starts covering the source and lands EXACTLY on the destination', () => {
    // Pixel-perfect landing is the whole reason the destination basis was chosen
    // (D17). The last keyframe must be exactly 1, not 0.999.
    const keys = scaleKeys(92, 208, 1.14);
    expect(keys[0]).toBeCloseTo(92 / 208, 10);
    expect(keys[keys.length - 1]).toBe(1);
  });

  it('peaks above the settle — the numeric form of "it overshoots"', () => {
    const keys = scaleKeys(92, 208, 1.14);
    const peak = Math.max(...keys);
    expect(peak).toBeGreaterThan(keys[keys.length - 1]!);
    expect(peak).toBeCloseTo(1.14, 6);
  });

  it('handles a shrinking flight (hand → stack) without inverting', () => {
    // Cast: 208 → 132. It starts LARGER than 1 and shrinks to 1.
    const keys = scaleKeys(208, 132, 1.62);
    expect(keys[0]).toBeCloseTo(208 / 132, 6);
    expect(keys[keys.length - 1]).toBe(1);
    expect(keys.every((k) => k > 0)).toBe(true);
  });

  it('survives a zero-height destination instead of dividing by zero', () => {
    expect(scaleKeys(100, 0, 1.1).every(Number.isFinite)).toBe(true);
  });

  it('defaultPeak always bulges a little', () => {
    expect(defaultPeak(92, 208)).toBeGreaterThan(1);
    expect(defaultPeak(208, 132)).toBeGreaterThan(208 / 132);
  });
});

describe('cubicBezierEase', () => {
  it('pins both ends', () => {
    expect(cubicBezierEase(EASE_FLIGHT, 0)).toBe(0);
    expect(cubicBezierEase(EASE_FLIGHT, 1)).toBe(1);
    expect(cubicBezierEase(EASE_FLIGHT, -0.2)).toBe(0);
    expect(cubicBezierEase(EASE_FLIGHT, 1.5)).toBe(1);
  });

  it('is the identity for a linear curve', () => {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(cubicBezierEase([0, 0, 1, 1], t)).toBeCloseTo(t, 5);
    }
  });

  it('gives the flight ease a wind-up, a fast middle and a soft landing', () => {
    // The measured profile, which is the numeric statement of "reads as thrown":
    // a brief hesitation, then most of the distance covered in the middle third,
    // then a gentle arrival. Measured values, not aspirations.
    expect(cubicBezierEase(EASE_FLIGHT, 0.125)).toBeLessThan(0.125); // wind-up
    expect(cubicBezierEase(EASE_FLIGHT, 0.25)).toBeGreaterThan(0.3); // then away
    expect(cubicBezierEase(EASE_FLIGHT, 0.5)).toBeGreaterThan(0.75); // mostly there
    expect(cubicBezierEase(EASE_FLIGHT, 0.875)).toBeGreaterThan(0.98); // soft end
  });

  it('is monotone', () => {
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const v = cubicBezierEase(EASE_FLIGHT, i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('is symmetric about the midpoint for the inOut curve', () => {
    // The symmetry is what puts the face flip's 90° crossing at exactly half the
    // flight — the property the beats battery asserts.
    expect(cubicBezierEase([0.65, 0, 0.35, 1], 0.5)).toBeCloseTo(0.5, 4);
  });
});

describe('easedPathKeys', () => {
  it('samples the curve at eased parameters, on a linear time grid', () => {
    const from = { x: 0, y: 900 };
    const to = { x: 1000, y: 900 };
    const ctrl = controlPoint(from, to, 0.2, VP);
    const linear = pathKeys(from, ctrl, to, PATH_TIMES);
    const eased = easedPathKeys(from, ctrl, to, EASE_FLIGHT);

    expect(eased.x).toHaveLength(PATH_TIMES.length);
    expect(eased.x[0]).toBeCloseTo(0, 6);
    expect(eased.x[eased.x.length - 1]).toBeCloseTo(1000, 6);
    // Behind linear during the wind-up (the first sample only), then ahead of it
    // for the whole rest of the flight. Asserting "ahead everywhere" was wrong:
    // the wind-up is a deliberate part of the throw, not an error.
    expect(eased.x[1]!).toBeLessThan(linear.x[1]!);
    for (let i = 2; i < eased.x.length - 1; i++) {
      expect(eased.x[i]!, `sample ${i}`).toBeGreaterThan(linear.x[i]!);
    }
  });
});

describe('flipKeys', () => {
  it('crosses 90° at the apex when turning face-up', () => {
    const keys = flipKeys(false, true);
    // FLIGHT_TIMES[2] is 0.5 — the arc apex. Flipping earlier looks like the card
    // was already face-up; later looks like a glitch at the destination.
    expect(FLIGHT_TIMES[2]).toBe(0.5);
    expect(keys[2]).toBe(90);
    expect(keys[0]).toBe(180);
    expect(keys[keys.length - 1]).toBe(0);
  });

  it('crosses 90° at the apex when turning face-down', () => {
    const keys = flipKeys(true, false);
    expect(keys[2]).toBe(90);
    expect(keys[0]).toBe(0);
    expect(keys[keys.length - 1]).toBe(180);
  });

  it('holds a constant angle when the face does not change', () => {
    expect(new Set(flipKeys(true, true)).size).toBe(1);
    expect(flipKeys(true, true)[0]).toBe(0);
    expect(new Set(flipKeys(false, false)).size).toBe(1);
    expect(flipKeys(false, false)[0]).toBe(180);
  });

  it('returns one key per sample time', () => {
    for (const pair of [[true, true], [true, false], [false, true], [false, false]] as const) {
      expect(flipKeys(pair[0], pair[1])).toHaveLength(FLIGHT_TIMES.length);
    }
  });
});
