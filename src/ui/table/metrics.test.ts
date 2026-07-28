import { describe, expect, it } from 'vitest';
import {
  MIN_BAND_CARD_H,
  MIN_HAND_CARD_H,
  computeTableMetrics,
  cssVarsFor,
  layOutSeats,
  type SeatCount,
} from './metrics';

// The 12 combinations the M2 plan calls for. Host height is the VIEWPORT height
// minus the 45 px app header — the table never gets the whole window, and
// pretending it does is how you produce a page scrollbar.
const APP_HEADER = 45;
const VIEWPORTS = [
  { w: 1920, h: 1080 },
  { w: 1600, h: 900 },
  { w: 1280, h: 800 },
] as const;
const SEATS: SeatCount[] = [2, 3, 4];

describe('computeTableMetrics — the 12 combinations', () => {
  for (const vp of VIEWPORTS) {
    for (const seatCount of SEATS) {
      const label = `${vp.w}×${vp.h} · ${seatCount} seats`;

      it(`${label}: fits the host height with no overflow`, () => {
        const m = computeTableMetrics({
          hostW: vp.w,
          hostH: vp.h - APP_HEADER,
          seatCount,
        });
        expect(m.requiredH, label).toBeLessThanOrEqual(vp.h - APP_HEADER);
        expect(m.fits, label).toBe(true);
        const summed =
          m.rows.phase + m.rows.oppStrip + m.rows.middle + m.rows.mySeat + m.rows.hand;
        expect(summed, `${label} rows`).toBeLessThanOrEqual(vp.h - APP_HEADER);
      });

      it(`${label}: every band and hand card stays readable`, () => {
        const m = computeTableMetrics({
          hostW: vp.w,
          hostH: vp.h - APP_HEADER,
          seatCount,
        });
        expect(m.cardH.bf, `${label} my battlefield`).toBeGreaterThanOrEqual(MIN_BAND_CARD_H);
        expect(m.cardH.bfOpp, `${label} opponent battlefield`).toBeGreaterThanOrEqual(
          MIN_BAND_CARD_H,
        );
        expect(m.cardH.hand, `${label} hand`).toBeGreaterThanOrEqual(MIN_HAND_CARD_H);
      });

      it(`${label}: pods tile the table width exactly, without overlapping`, () => {
        const m = computeTableMetrics({
          hostW: vp.w,
          hostH: vp.h - APP_HEADER,
          seatCount,
        });
        expect(m.seats).toHaveLength(seatCount - 1);
        for (let i = 1; i < m.seats.length; i++) {
          const prev = m.seats[i - 1]!;
          const cur = m.seats[i]!;
          expect(cur.left, `${label} pod ${i}`).toBeGreaterThanOrEqual(prev.left + prev.width);
        }
        const last = m.seats[m.seats.length - 1]!;
        expect(last.left + last.width).toBeLessThanOrEqual(m.tableW);
      });
    }
  }
});

describe('computeTableMetrics — the ladder', () => {
  it('uses full spec sizes when there is room', () => {
    const m = computeTableMetrics({ hostW: 1920, hostH: 1400, seatCount: 4 });
    expect(m.scale).toBe(1);
    expect(m.cardH.hand).toBe(208);
    expect(m.cardH.bf).toBe(148);
    expect(m.cardH.bfOpp).toBe(116);
    expect(m.oppBands).toBe(2);
    expect(m.myBands).toBe(2);
  });

  it('is symmetric at 2 players — an opponent bigger than you reads worse', () => {
    const m = computeTableMetrics({ hostW: 1920, hostH: 1400, seatCount: 2 });
    expect(m.cardH.bfOpp).toBe(m.cardH.bf);
  });

  it('shrinks opponents further as seats are added', () => {
    const two = computeTableMetrics({ hostW: 1920, hostH: 1400, seatCount: 2 });
    const three = computeTableMetrics({ hostW: 1920, hostH: 1400, seatCount: 3 });
    const four = computeTableMetrics({ hostW: 1920, hostH: 1400, seatCount: 4 });
    expect(three.cardH.bfOpp).toBeLessThan(two.cardH.bfOpp);
    expect(four.cardH.bfOpp).toBeLessThan(three.cardH.bfOpp);
  });

  it('scales down UNIFORMLY before it trades any layout away', () => {
    // The priority order: shrink everything proportionally first, and only start
    // clipping or folding once the readability floors block further shrinking.
    // Uniform scaling costs nothing structural; folding a band hides cards.
    const roomy = computeTableMetrics({ hostW: 1920, hostH: 1400, seatCount: 4 });
    const tighter = computeTableMetrics({ hostW: 1920, hostH: 940, seatCount: 4 });
    expect(tighter.scale).toBeLessThan(roomy.scale);
    expect(tighter.handClip).toBe(roomy.handClip);
    expect(tighter.oppBands).toBe(2);
    expect(tighter.myBands).toBe(2);
  });

  it('clips more of the hand once the card floors bind', () => {
    // Below ~926 px of host height, 4 seats cannot shrink further without
    // breaking the 96 px floor, so the ladder starts spending the hand's clipped
    // bottom edge — which carries nothing you read.
    //
    // ⚠️ That boundary tracks the FIXED chrome above the table, so it moves when
    // the phase bar does: it was ~908 while the bar was one 30 px row, and the
    // rung this asserts is now 901–925 rather than the old ~880–907. The height
    // below is the middle of the rung, not a number with meaning of its own.
    const m = computeTableMetrics({ hostW: 1920, hostH: 910, seatCount: 4 });
    expect(m.handClip).toBeGreaterThan(0.154);
    expect(m.oppBands).toBe(2);
    expect(m.myBands).toBe(2);
    expect(m.fits).toBe(true);
  });

  it('NEVER folds my bands while an opponent still has two', () => {
    // The real invariant behind "opponents fold first": no reachable
    // configuration has myBands === 1 while oppBands === 2. Asserted over a sweep,
    // because the property is about the ladder as a whole, not one viewport.
    for (let hostH = 380; hostH <= 1200; hostH += 5) {
      for (const seatCount of SEATS) {
        const m = computeTableMetrics({ hostW: 1280, hostH, seatCount });
        expect(
          m.myBands === 1 && m.oppBands === 2,
          `${seatCount} seats at hostH ${hostH}`,
        ).toBe(false);
      }
    }
  });

  it('folds both sides only at genuinely small viewports, and still fits', () => {
    const m = computeTableMetrics({ hostW: 1280, hostH: 700, seatCount: 4 });
    expect(m.oppBands).toBe(1);
    expect(m.fits).toBe(true);
    expect(m.requiredH).toBeLessThanOrEqual(700);
  });

  it('never silently renders an unreadable card, even when nothing fits', () => {
    // ⚠️ The standing rule is never to trade fidelity for fit. A viewport far
    // below the 1280×800 minimum must report `fits: false` and keep the floors,
    // NOT quietly draw 60 px cards.
    const m = computeTableMetrics({ hostW: 900, hostH: 420, seatCount: 4 });
    expect(m.fits).toBe(false);
    expect(m.cardH.bf).toBeGreaterThanOrEqual(MIN_BAND_CARD_H);
    expect(m.cardH.bfOpp).toBeGreaterThanOrEqual(MIN_BAND_CARD_H);
    expect(m.cardH.hand).toBeGreaterThanOrEqual(MIN_HAND_CARD_H);
  });

  it('gives the table more width when the rail collapses', () => {
    const open = computeTableMetrics({ hostW: 1920, hostH: 1000, seatCount: 4 });
    const shut = computeTableMetrics({
      hostW: 1920,
      hostH: 1000,
      seatCount: 4,
      railExpanded: false,
    });
    expect(shut.tableW).toBeGreaterThan(open.tableW);
    expect(shut.tableW).toBe(1920 - 44);
  });

  it('keeps every card at the printed aspect ratio', () => {
    const m = computeTableMetrics({ hostW: 1920, hostH: 1000, seatCount: 4 });
    for (const key of ['hand', 'bf', 'bfOpp', 'stack', 'pile'] as const) {
      const ratio = m.cardW[key] / m.cardH[key];
      expect(ratio, key).toBeCloseTo(745 / 1040, 2);
    }
  });

  it('survives absurd inputs instead of producing NaN', () => {
    const m = computeTableMetrics({ hostW: 0, hostH: 0, seatCount: 4 });
    expect(Number.isFinite(m.cardH.bf)).toBe(true);
    expect(m.tableW).toBeGreaterThan(0);
  });
});

describe('layOutSeats', () => {
  it('returns nothing for a solo table', () => {
    expect(layOutSeats(0, 1600, 30, 300)).toEqual([]);
  });

  it('gives one opponent the whole table', () => {
    const [box] = layOutSeats(1, 1600, 30, 300);
    expect(box).toEqual({ index: 0, left: 0, top: 30, width: 1600, height: 300 });
  });

  it('splits three pods evenly with gaps between them', () => {
    const boxes = layOutSeats(3, 1600, 40, 296, 8);
    expect(boxes).toHaveLength(3);
    for (const b of boxes) {
      expect(b.width).toBe(Math.floor((1600 - 16) / 3));
      expect(b.top).toBe(40);
      expect(b.height).toBe(296);
    }
    expect(boxes[1]!.left).toBe(boxes[0]!.width + 8);
    expect(boxes[2]!.left + boxes[2]!.width).toBeLessThanOrEqual(1600);
  });
});

describe('cssVarsFor', () => {
  it('stamps every card height as a px custom property', () => {
    const vars = cssVarsFor(computeTableMetrics({ hostW: 1920, hostH: 1000, seatCount: 4 }));
    expect(vars['--card-h-hand']).toMatch(/^\d+px$/);
    expect(vars['--card-h-bf-opp']).toMatch(/^\d+px$/);
    expect(vars['--rail-w']).toBe('272px');
  });
});
