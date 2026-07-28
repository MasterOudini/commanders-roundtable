// Performance measurement, dev-only.
//
// The M2 gate is `p95 ≤ 18 ms` and `≤ 2 long frames` over a 5 s stress run at
// 1920×1080. That number is not arbitrary: the frame budget is 16.67 ms, so a p95
// of 18 means 95% of frames were within about one frame of budget, which is what
// "smooth" actually means on a display that does not tear.
//
// ⚠️ Sampling rAF DELTAS, not `performance.now()` around a beat. A beat can report
// 420 ms and still have dropped nine frames in the middle of it. What a player
// perceives is the gap between painted frames, so that is what gets measured.
//
// `long-animation-frame` (LoAF) is the second half of the picture: it attributes a
// long frame to the script, style or layout work that caused it. Chromium 123+, so
// present in Electron 42. It is the single best tool for this and it is built in —
// a custom instrumentation layer would be less accurate and much more code.

import { isReading } from './rectRegistry';

export interface FrameReport {
  seconds: number;
  frames: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames over 20 ms — a visible hitch. */
  longFrames: number;
  /**
   * When each long frame happened, in ms from the start of the run, with its
   * duration. ⚠️ Without this a failing gate is unactionable: 16 long frames
   * clustered in the first 400 ms is a warm-up cost, while 16 spread evenly is a
   * steady-state problem, and the fix is completely different.
   */
  longFrameAt: { at: number; ms: number }[];
  /** Frames over 33 ms — a dropped frame at 60 Hz. */
  dropped: number;
  /** LoAF entries, with attribution, when the observer is available. */
  loaf: { duration: number; blockingDuration: number; scripts: string[] }[];
  /** Rect reads that happened outside a registry read window (should be 0). */
  strayRectReads: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i]!;
}

let loafEntries: { duration: number; blockingDuration: number; scripts: string[] }[] = [];
let loafObserver: PerformanceObserver | null = null;

function startLoaf(): void {
  if (loafObserver || typeof PerformanceObserver === 'undefined') return;
  try {
    loafObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & {
          blockingDuration?: number;
          scripts?: { name?: string; sourceURL?: string; invoker?: string }[];
        };
        loafEntries.push({
          duration: e.duration,
          blockingDuration: e.blockingDuration ?? 0,
          scripts: (e.scripts ?? []).map((s) => s.invoker ?? s.sourceURL ?? s.name ?? '?'),
        });
      }
    });
    loafObserver.observe({ type: 'long-animation-frame', buffered: true } as PerformanceObserverInit);
  } catch {
    // Not available on this Chromium. The rAF deltas alone still gate correctly;
    // only the attribution is lost.
    loafObserver = null;
  }
}

/** Sample rAF deltas for `seconds` and report the distribution. */
export function sample(seconds = 5): Promise<FrameReport> {
  startLoaf();
  loafEntries = [];
  strayRectReads = 0;
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const started = last;

    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (now - started >= seconds * 1000) {
        // Drop the first delta: it spans the gap between the call and the first
        // frame, which is not a rendered frame interval.
        const clean = deltas.slice(1);
        const sorted = [...clean].sort((a, b) => a - b);
        resolve({
          seconds: (now - started) / 1000,
          frames: clean.length,
          fps: clean.length / ((now - started) / 1000),
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
          p99: percentile(sorted, 99),
          max: sorted[sorted.length - 1] ?? 0,
          longFrames: clean.filter((d) => d > 20).length,
          longFrameAt: (() => {
            const out: { at: number; ms: number }[] = [];
            let t = 0;
            for (const dd of clean) {
              t += dd;
              if (dd > 20) out.push({ at: Math.round(t), ms: Math.round(dd) });
            }
            return out;
          })(),
          dropped: clean.filter((d) => d > 33).length,
          loaf: [...loafEntries].sort((a, b) => b.duration - a.duration).slice(0, 8),
          strayRectReads,
        });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ── Rect-read discipline ─────────────────────────────────────────────────────

let strayRectReads = 0;
let patched = false;

/**
 * Dev-only: count getBoundingClientRect calls made OUTSIDE a registry read window.
 *
 * ⚠️ The rule "rectRegistry is the only legal caller of getBoundingClientRect" is
 * otherwise just a comment, and comments do not survive six months of edits. Each
 * stray read forces a style-and-layout flush; interleaving reads with writes turns
 * one layout pass into N, and a six-card draw would do twelve. This makes the rule
 * MEASURABLE — `strayRectReads` in the perf report — instead of aspirational.
 *
 * Not installed in production: the wrapper itself costs something on a hot path.
 */
export function installRectDiscipline(): void {
  if (patched || !import.meta.env.DEV || typeof Element === 'undefined') return;
  patched = true;
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect() {
    if (!isReading()) strayRectReads++;
    return original.call(this);
  };
}

export function strayRectReadCount(): number {
  return strayRectReads;
}

export function resetStrayRectReads(): void {
  strayRectReads = 0;
}
