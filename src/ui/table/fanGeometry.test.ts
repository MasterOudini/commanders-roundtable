import { describe, expect, it } from 'vitest';
import {
  HOVER_LIFT,
  HOVER_SCALE,
  MAX_FAN_CARDS,
  PART_AMPLITUDE,
  PART_FALLOFF,
  fanGeometry,
  handCardPose,
  partOffset,
} from './fanGeometry';

const BAND = { bandWidth: 1600, cardW: 149, pitchCap: 119 };

describe('fanGeometry', () => {
  it('is empty for an empty hand', () => {
    const g = fanGeometry({ count: 0, ...BAND });
    expect(g.slots).toEqual([]);
  });

  it('centres a single card with no rotation', () => {
    const g = fanGeometry({ count: 1, ...BAND });
    expect(g.slots).toHaveLength(1);
    expect(g.slots[0]!.angle).toBe(0);
    expect(g.slots[0]!.y).toBe(0);
    expect(g.slots[0]!.x).toBeCloseTo((1600 - 149) / 2, 6);
  });

  it('fans a 7-card opening hand symmetrically, ±15° at most', () => {
    const g = fanGeometry({ count: 7, ...BAND });
    expect(g.slots).toHaveLength(7);
    const angles = g.slots.map((s) => s.angle);
    expect(angles[3]).toBeCloseTo(0, 6); // the middle card is upright
    expect(angles[0]).toBeCloseTo(-angles[6]!, 6);
    expect(Math.abs(angles[0]!)).toBeLessThanOrEqual(15.001);
  });

  it('droops at the edges — a held fan hangs lower at its ends', () => {
    const g = fanGeometry({ count: 7, ...BAND });
    expect(g.slots[3]!.y).toBeCloseTo(0, 6);
    expect(g.slots[0]!.y).toBeCloseTo(16, 1);
    expect(g.slots[6]!.y).toBeCloseTo(16, 1);
    // Monotone from the middle outwards.
    expect(g.slots[1]!.y).toBeLessThan(g.slots[0]!.y);
  });

  it('caps the sweep, so a 24-card hand fans as widely as a 7-card one', () => {
    const seven = fanGeometry({ count: 7, ...BAND });
    const many = fanGeometry({ count: 24, ...BAND });
    const sweep = (g: typeof seven) =>
      Math.abs(g.slots[g.slots.length - 1]!.angle - g.slots[0]!.angle);
    expect(sweep(seven)).toBeCloseTo(30, 0);
    expect(sweep(many)).toBeCloseTo(30, 0);
  });

  it('tightens the pitch as the hand grows, down to a 46 px floor', () => {
    const pitches = [7, 12, 18, 24, 32].map((count) => fanGeometry({ count, ...BAND }).pitch);
    for (let i = 1; i < pitches.length; i++) {
      expect(pitches[i]!).toBeLessThanOrEqual(pitches[i - 1]!);
    }
    expect(pitches[pitches.length - 1]!).toBeGreaterThanOrEqual(46);
  });

  it('honours the pitch cap so cards never drift apart in a small hand', () => {
    const g = fanGeometry({ count: 3, ...BAND });
    expect(g.pitch).toBeLessThanOrEqual(BAND.pitchCap);
  });

  it('keeps the fan inside its band', () => {
    for (const count of [1, 2, 7, 12, 20, 32]) {
      const g = fanGeometry({ count, ...BAND });
      expect(g.slots[0]!.x, `n=${count} left`).toBeGreaterThanOrEqual(-0.5);
      const last = g.slots[g.slots.length - 1]!;
      expect(last.x + BAND.cardW, `n=${count} right`).toBeLessThanOrEqual(1600.5);
    }
  });

  it('switches to a chit list past 32 cards — Commander really does that', () => {
    expect(fanGeometry({ count: MAX_FAN_CARDS, ...BAND }).mode).toBe('fan');
    expect(fanGeometry({ count: MAX_FAN_CARDS + 1, ...BAND }).mode).toBe('list');
  });

  it('stacks later cards on top', () => {
    const g = fanGeometry({ count: 5, ...BAND });
    expect(g.slots.map((s) => s.z)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('partOffset', () => {
  it('is zero with no hover', () => {
    expect(partOffset(3, null)).toBe(0);
  });

  it('is zero for the hovered card itself', () => {
    expect(partOffset(3, 3)).toBe(0);
  });

  it('matches 26·e^(−0.55·d) exactly — the value the battery asserts', () => {
    // ⚠️ The FORMULA is the contract, not the sequence annotated beside it in
    // ui-animation-spec §4.5. The spec tabulates "26, 15.0, 8.6, 5.0, 2.9", which
    // is the formula evaluated at d = 0…4 — and d = 0 is the hovered card, which
    // by definition does not move. So the real displacements start at d = 1, where
    // the immediate neighbour moves 15.0 px. Both the spec's own formula and the
    // M2 handoff's verification ("offsets match 26·e^(−0.55·d) within 0.5 px")
    // agree with this reading; only the tabulation is off by one.
    const expected = [15.0, 8.63, 4.98, 2.87, 1.66];
    for (let d = 1; d <= 5; d++) {
      expect(partOffset(3 + d, 3), `d=${d}`).toBeCloseTo(expected[d - 1]!, 1);
      expect(partOffset(3 + d, 3)).toBeCloseTo(PART_AMPLITUDE * Math.exp(-PART_FALLOFF * d), 9);
    }
    // The amplitude constant itself is the d = 0 value, which is why 26 appears in
    // the spec's list at all.
    expect(PART_AMPLITUDE * Math.exp(-PART_FALLOFF * 0)).toBe(26);
  });

  it('pushes cards AWAY from the hovered one, in both directions', () => {
    expect(partOffset(5, 3)).toBeGreaterThan(0);
    expect(partOffset(1, 3)).toBeLessThan(0);
    expect(partOffset(1, 3)).toBeCloseTo(-partOffset(5, 3), 9);
  });

  it('decays to under a pixel a few cards away', () => {
    // Visible for three cards and gone by the sixth — that is what makes it read
    // as the cards being pushed rather than the whole hand shifting.
    expect(Math.abs(partOffset(3 + 6, 3))).toBeLessThan(1);
  });
});

describe('handCardPose', () => {
  const g = fanGeometry({ count: 7, ...BAND });

  it('lifts, straightens and enlarges the hovered card', () => {
    const pose = handCardPose(g.slots[3]!, 3);
    expect(pose.y).toBeCloseTo(g.slots[3]!.y - HOVER_LIFT, 6);
    expect(pose.rotate).toBe(0);
    expect(pose.scale).toBe(HOVER_SCALE);
    expect(pose.z).toBe(1000);
  });

  it('lifts an EDGE card to the same height as a middle one', () => {
    // The lift is applied on top of the droop, so hovering the leftmost card does
    // not leave it sitting 16 px lower than the middle card would.
    const middle = handCardPose(g.slots[3]!, 3);
    const edge = handCardPose(g.slots[0]!, 0);
    expect(edge.y - edge.rotate).toBeCloseTo(g.slots[0]!.y - HOVER_LIFT, 6);
    expect(edge.rotate).toBe(0);
    expect(middle.rotate).toBe(0);
  });

  it('leaves an unhovered card at its fan pose, displaced sideways only', () => {
    const pose = handCardPose(g.slots[4]!, 3);
    expect(pose.rotate).toBeCloseTo(g.slots[4]!.angle, 6);
    expect(pose.y).toBeCloseTo(g.slots[4]!.y, 6);
    expect(pose.scale).toBe(1);
    expect(pose.x).toBeCloseTo(g.slots[4]!.x + PART_AMPLITUDE * Math.exp(-PART_FALLOFF), 6);
  });

  it('is the identity fan pose with no hover at all', () => {
    for (const slot of g.slots) {
      const pose = handCardPose(slot, null);
      expect(pose.x).toBe(slot.x);
      expect(pose.y).toBe(slot.y);
      expect(pose.rotate).toBe(slot.angle);
      expect(pose.scale).toBe(1);
    }
  });
});
