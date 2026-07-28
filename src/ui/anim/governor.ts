// The speed governor — PURE. Unit-tested.
//
// The problem it solves: a Commander turn can produce a burst of events in one
// tick. A cascade, a mass-removal spell, twelve triggers, a mill of thirty cards.
// Playing every one of those at cinematic speed means the table narrates for
// fifteen seconds while the player cannot act, which is the single worst thing an
// automated shell can do — Arena's own reputation problem.
//
// So the queue's own depth sets the playback rate. Small burst: full speed, every
// beat visible. Medium burst: speed up smoothly, so the acceleration itself reads
// as "a lot just happened". Large burst: coalesce, then give up on animating and
// DRAIN — commit the newest state at once and play 120 ms zone flashes so the
// player can still see WHERE things went, with the game log carrying the detail.
//
// ⚠️ The thresholds are on QUEUED MILLISECONDS, not on event count. Twenty taps
// (180 ms each, coalesced to one sweep) and two casts (520 ms each) are wildly
// different amounts of waiting for the same event count.

export type Mode = 'full' | 'digest' | 'drain';

export interface GovernorDecision {
  /** Divide every duration by this. 1 = cinematic. */
  rate: number;
  /** True once the queue is too deep to animate at all. */
  drain: boolean;
  /** Coalescing is only worth its complexity once the queue is genuinely deep. */
  coalesceHard: boolean;
}

export const GOVERNOR = {
  /** Below this, never speed up: a single cast must always look like a cast. */
  fullMs: 600,
  /** Above this, run at the maximum rate and coalesce aggressively. */
  hardMs: 1800,
  /** Above this, stop animating and drain. */
  drainMs: 4000,
  /** Or above this many queued groups, regardless of their duration. */
  drainGroups: 24,
  maxRate: 3,
  /** The rate reached at `hardMs` by the smooth ramp. */
  rampTopRate: 2.5,
} as const;

export function governorFor(pendingMs: number, groupCount: number): GovernorDecision {
  if (pendingMs > GOVERNOR.drainMs || groupCount > GOVERNOR.drainGroups) {
    return { rate: GOVERNOR.maxRate, drain: true, coalesceHard: true };
  }
  if (pendingMs > GOVERNOR.hardMs) {
    return { rate: GOVERNOR.maxRate, drain: false, coalesceHard: true };
  }
  if (pendingMs <= GOVERNOR.fullMs) {
    return { rate: 1, drain: false, coalesceHard: false };
  }
  // Smooth ramp, so the acceleration is itself legible rather than a gear change.
  const t = (pendingMs - GOVERNOR.fullMs) / (GOVERNOR.hardMs - GOVERNOR.fullMs);
  return {
    rate: 1 + (GOVERNOR.rampTopRate - 1) * t,
    drain: false,
    coalesceHard: false,
  };
}

/**
 * The effective animation mode.
 *
 * ⚠️ FOUR triggers, ONE implementation. Reduced motion, animation speed Off, the
 * table not being the visible screen, and the governor draining all route to the
 * same digest path. Writing four code paths for "don't animate" is how three of
 * them end up subtly different, and the one nobody tests is the one a real player
 * hits. The log carries the full narrative in every case, so digest mode loses
 * no information — which is what makes it a safe destination rather than a
 * degraded one.
 */
export function effectiveMode(opts: {
  reducedMotion: boolean;
  speedOff: boolean;
  tableVisible: boolean;
  drain: boolean;
}): Mode {
  if (opts.reducedMotion || opts.speedOff || !opts.tableVisible || opts.drain) return 'digest';
  return 'full';
}
