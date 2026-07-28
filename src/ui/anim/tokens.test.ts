import { describe, expect, it, afterEach } from 'vitest';
import {
  DUR,
  EASE,
  SPRING,
  STAGGER,
  animScale,
  d,
  ds,
  lifeCountMs,
  setAnimScale,
  staggerFor,
} from './tokens';

afterEach(() => setAnimScale(1));

describe('the scale gate', () => {
  it('divides by the current scale', () => {
    setAnimScale(1);
    expect(d(420)).toBe(420);
    setAnimScale(2.2);
    expect(d(420)).toBeCloseTo(190.9, 1);
  });

  it('maps "off" (Infinity) to 0 rather than NaN', () => {
    // TIME_SCALE.off is Infinity. 420/Infinity is 0 in JS, but an explicit
    // branch documents the intent and survives someone passing a huge finite
    // number instead.
    setAnimScale(Infinity);
    expect(animScale()).toBe(Infinity);
    expect(d(420)).toBe(0);
    expect(ds(420)).toBe(0);
  });

  it('refuses a zero or negative scale — it would divide by zero', () => {
    setAnimScale(0);
    expect(d(100)).toBe(100 / 0.05);
    setAnimScale(-3);
    expect(d(100)).toBe(100 / 0.05);
  });

  it('converts to seconds for motion', () => {
    setAnimScale(1);
    expect(ds(520)).toBeCloseTo(0.52, 6);
  });
});

describe('the token table', () => {
  it('keeps every duration at or under 520 ms except the life count and dice', () => {
    // This is the numeric form of "it reads as Arena, not as a cutscene".
    const exempt = new Set(['lifeCount', 'diceRoll']);
    for (const [name, ms] of Object.entries(DUR)) {
      if (exempt.has(name)) continue;
      expect(ms, `DUR.${name}`).toBeLessThanOrEqual(520);
    }
  });

  it('overshoots on the settle — the Arena signature', () => {
    // EASE.overshoot's second control point must exceed 1, or the card eases in
    // instead of rebounding, and the whole table feels like a web page.
    expect(EASE.overshoot[1]).toBeGreaterThan(1);
    expect(EASE.impact[3]).toBeGreaterThan(1);
    expect(SPRING.settle.bounce).toBeGreaterThan(0.3);
    expect(SPRING.thump.bounce).toBeGreaterThan(0.4);
  });

  it('gives the flight ease gentle ends and a fast middle', () => {
    // Both ends nearly stationary — y₁ near 0, y₂ at 1 — is what puts the speed
    // in the middle third and makes the motion read as thrown rather than slid.
    // (The measured distance-over-time profile is asserted in arc.test.ts, where
    // the curve evaluator lives.)
    expect(EASE.flight[1]).toBeLessThan(0.1);
    expect(EASE.flight[3]).toBe(1);
    // The settle ease is the opposite shape: all its speed is at the start.
    expect(EASE.out[1]).toBe(1);
  });

  it('has 4 control points in every ease', () => {
    for (const [name, curve] of Object.entries(EASE)) {
      expect(curve, `EASE.${name}`).toHaveLength(4);
    }
  });
});

describe('lifeCountMs', () => {
  it('scales with the size of the swing, clamped to [320, 900]', () => {
    expect(lifeCountMs(0)).toBe(320);
    expect(lifeCountMs(1)).toBe(342);
    expect(lifeCountMs(-7)).toBe(474); // sign does not matter
    expect(lifeCountMs(40)).toBe(900); // a commander-damage blowout still ends
  });
});

describe('staggerFor', () => {
  it('is 0 for a single item', () => {
    expect(staggerFor(1, STAGGER.draw)).toBe(0);
  });

  it('uses the base stagger for a normal opening hand', () => {
    // 7 cards → 420 + 6×60 = 780 ms total. That is the target.
    expect(staggerFor(7, STAGGER.draw)).toBe(60);
  });

  it('compresses a big batch so it never becomes a cutscene', () => {
    // 20 cards at the base 60 ms would be 1.2 s of dead time on its own.
    expect(staggerFor(20, STAGGER.draw)).toBe(60);
    expect(staggerFor(40, STAGGER.draw)).toBe(30);
    expect(staggerFor(40, STAGGER.draw) * 40).toBeLessThanOrEqual(1200);
  });
});
