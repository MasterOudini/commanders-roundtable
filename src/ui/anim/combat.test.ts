import { describe, expect, it } from 'vitest';
import { blockerSide, interceptPoint, lungeDistance, lungeVector } from './combat';

describe('lungeVector', () => {
  it('points AT the defender — the whole point at 4 players', () => {
    // The numeric form of "you can tell who is being attacked": the displacement's
    // dot product with the unit vector toward the defender must be positive.
    const from = { x: 800, y: 700 };
    for (const toward of [
      { x: 200, y: 200 },
      { x: 800, y: 150 },
      { x: 1500, y: 220 },
      { x: 100, y: 700 },
    ]) {
      const v = lungeVector(from, toward, 38);
      const dx = toward.x - from.x;
      const dy = toward.y - from.y;
      const len = Math.hypot(dx, dy);
      const dot = (v.x * dx) / len + (v.y * dy) / len;
      expect(dot, `toward ${JSON.stringify(toward)}`).toBeGreaterThan(0);
      // And it is the requested length, not an arbitrary fraction.
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(38, 6);
    }
  });

  it('distinguishes two defenders in opposite directions', () => {
    const from = { x: 800, y: 700 };
    const left = lungeVector(from, { x: 200, y: 200 }, 38);
    const right = lungeVector(from, { x: 1500, y: 200 }, 38);
    expect(Math.sign(left.x)).toBe(-1);
    expect(Math.sign(right.x)).toBe(1);
  });

  it('still moves when the attacker is on top of its target', () => {
    // Degenerate, but a real case with a collapsed pod: the anchor can resolve to
    // nearly the same point. A zero-length lunge reads as nothing happening.
    const v = lungeVector({ x: 500, y: 500 }, { x: 500, y: 500 }, 38);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(38, 6);
    expect(v.y).toBeLessThan(0); // up the table, where opponents are
  });

  it('lunges further at 2 players, where the pods are further apart', () => {
    expect(lungeDistance(2)).toBeGreaterThan(lungeDistance(4));
    expect(lungeDistance(3)).toBe(lungeDistance(4));
  });
});

describe('interceptPoint', () => {
  const attacker = { x: 800, y: 300 };
  const blocker = { x: 700, y: 800 };
  const CW = 106;

  it('lands between the two cards, not on top of the attacker', () => {
    const p = interceptPoint(attacker, blocker, CW, 1);
    const toAttacker = Math.hypot(attacker.x - p.x, attacker.y - p.y);
    const toBlocker = Math.hypot(blocker.x - p.x, blocker.y - p.y);
    const span = Math.hypot(attacker.x - blocker.x, attacker.y - blocker.y);
    // It moved a real distance…
    expect(toBlocker).toBeGreaterThan(span * 0.2);
    // …but stayed well clear of the attacker, so BOTH cards remain readable.
    expect(toAttacker).toBeGreaterThan(span * 0.4);
  });

  it('offsets perpendicular, so two blockers do not land in the same place', () => {
    const a = interceptPoint(attacker, blocker, CW, 1);
    const b = interceptPoint(attacker, blocker, CW, -1);
    const apart = Math.hypot(a.x - b.x, a.y - b.y);
    expect(apart).toBeCloseTo(2 * CW * 0.55, 4);
  });

  it('scales the offset with card width', () => {
    const small = interceptPoint(attacker, blocker, 69, 1);
    const large = interceptPoint(attacker, blocker, 149, 1);
    const spread = (p: { x: number; y: number }) =>
      Math.hypot(p.x - blocker.x, p.y - blocker.y);
    expect(spread(large)).toBeGreaterThan(spread(small));
  });

  it('survives a blocker sitting on its attacker', () => {
    const p = interceptPoint({ x: 500, y: 500 }, { x: 500, y: 500 }, CW, 1);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

describe('blockerSide', () => {
  it('is a single side for a lone blocker', () => {
    expect(blockerSide(0, 1)).toBe(1);
  });

  it('alternates outward from the centre for a multi-block', () => {
    // +1, −1, +2, −2, +3 — so five blockers fan symmetrically around the attacker
    // instead of piling up on one side.
    expect([0, 1, 2, 3, 4].map((i) => blockerSide(i, 5))).toEqual([1, -1, 2, -2, 3]);
  });

  it('never returns 0, which would put a blocker under the attacker', () => {
    for (let total = 1; total <= 6; total++) {
      for (let i = 0; i < total; i++) {
        expect(blockerSide(i, total)).not.toBe(0);
      }
    }
  });
});
