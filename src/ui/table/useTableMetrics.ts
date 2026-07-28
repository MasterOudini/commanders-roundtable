import { useEffect, type RefObject } from 'react';
import { useLayout } from '../../store/layoutStore';
import { bumpMetricsEpoch } from '../anim/rectRegistry';
import { computeTableMetrics, cssVarsFor, type SeatCount } from './metrics';

// One ResizeObserver on the table host, rAF-coalesced.
//
// ⚠️ rAF-coalesced, not debounced with a timer. A ResizeObserver can fire several
// times inside one frame while a window is being dragged; recomputing per
// callback both wastes work and — because we write CSS custom properties back to
// the observed element — risks a resize loop that Chromium then reports as
// "ResizeObserver loop completed with undelivered notifications". Coalescing to
// one write per frame makes that structurally impossible.
//
// The metrics land in TWO places on purpose: `layoutStore` for JavaScript (the
// flight arc, the fan geometry, the row packer) and CSS custom properties on the
// table root for Tailwind arbitrary values. Same numbers, so the two worlds cannot
// disagree about how tall a card is.

export function useTableMetrics(
  hostRef: RefObject<HTMLElement | null>,
  seatCount: SeatCount,
  railExpanded = true,
): void {
  const setMetrics = useLayout((s) => s.setMetrics);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    let disposed = false;

    const apply = () => {
      frame = 0;
      if (disposed) return;
      const rect = host.getBoundingClientRect();
      const metrics = computeTableMetrics({
        hostW: rect.width,
        hostH: rect.height,
        seatCount,
        railExpanded,
      });
      const before = useLayout.getState().metricsEpoch;
      setMetrics(metrics);
      // Only stamp CSS and invalidate flights when something actually moved —
      // layoutStore.setMetrics is the judge of that.
      if (useLayout.getState().metricsEpoch !== before) {
        for (const [name, value] of Object.entries(cssVarsFor(metrics))) {
          host.style.setProperty(name, value);
        }
        // Any clone that captured its rects before this reflow is now aiming at a
        // position that has moved. The overlay compares epochs and snaps.
        bumpMetricsEpoch();
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    const ro = new ResizeObserver(schedule);
    ro.observe(host);
    // A window resize that does not change the host's box can still change
    // devicePixelRatio, and the FX canvas cares.
    window.addEventListener('resize', schedule);

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [hostRef, seatCount, railExpanded, setMetrics]);
}
