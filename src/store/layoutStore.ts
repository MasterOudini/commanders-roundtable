import { create } from 'zustand';
import { computeTableMetrics, type TableMetrics } from '../ui/table/metrics';

// The single source of layout truth, for JS and for CSS at once.
//
// `useTableMetrics` computes this from one rAF-coalesced ResizeObserver and also
// stamps the same numbers as CSS custom properties on the table root, so Tailwind
// arbitrary values (`h-[var(--card-h-bf)]`) and the flight layer's arc maths
// cannot disagree about how big a card is.
//
// ⚠️ `metricsEpoch` invalidates in-flight animations. A clone captured its source
// and destination rects at a moment in time; if the table has since reflowed, a
// 400 ms flight to a rect that moved 300 px looks far worse than an instant snap,
// so the flight overlay compares epochs and snaps.

const INITIAL: TableMetrics = computeTableMetrics({
  hostW: 1600,
  hostH: 900,
  seatCount: 4,
});

interface LayoutState {
  metrics: TableMetrics;
  metricsEpoch: number;
  setMetrics: (m: TableMetrics) => void;
}

export const useLayout = create<LayoutState>((set, get) => ({
  metrics: INITIAL,
  metricsEpoch: 0,
  setMetrics: (m) => {
    const prev = get().metrics;
    // Only bump the epoch when something that MOVES A CARD changed. A resize that
    // leaves every dimension identical (a 1 px window nudge, a rail toggle that
    // rounds away) must not cancel every flight in progress.
    const moved =
      prev.hostW !== m.hostW ||
      prev.hostH !== m.hostH ||
      prev.tableW !== m.tableW ||
      prev.seatCount !== m.seatCount ||
      prev.cardH.hand !== m.cardH.hand ||
      prev.cardH.bf !== m.cardH.bf ||
      prev.cardH.bfOpp !== m.cardH.bfOpp ||
      prev.oppBands !== m.oppBands ||
      prev.myBands !== m.myBands;
    if (!moved) return;
    set({ metrics: m, metricsEpoch: get().metricsEpoch + 1 });
  },
}));
