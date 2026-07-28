// The choreographer — the event→beat bridge, and where the hard problems live.
//
// It is plain TS with no React, so the flight layer and animStore are reached as
// module singletons. `ingest()` is the ONLY entry point for normal play.
//
// ── THE LAG MODEL ────────────────────────────────────────────────────────────
// A group's view commits to gameStore when that group STARTS animating, so state
// leads the animation by at most one group (~500 ms) rather than by a whole burst.
// The animation layer is ALLOWED to lag — it must, or the hand cannot re-fan while
// a card is still flying, which is the single most Arena-like thing about the
// table. What it is not allowed to do is gate input: every interactive surface
// reads gameStore, so clicks stay live mid-flight, and legality is checked
// host-side so acting on a one-group-stale view is safe.
//
// ── THE CONVERGENCE GUARANTEE ────────────────────────────────────────────────
// animStore may only HIDE or DECORATE; it never holds card→zone truth. Therefore
// the DOM's zone membership is always the authoritative state, the worst possible
// failure is a card being invisible for a beat's duration, and a 500 ms reconciler
// clears any orphaned `inFlight` entry. There is no failure mode here that a
// reload is needed to escape.
//
// ── WHY A QUEUE NEEDS SOMEONE TO RESTART IT ──────────────────────────────────
// ⚠️ Work stranded TWICE in this project's art queue: once because a retry timer
// fired after the workers had exited, once because an enqueue landed in the window
// between the last worker returning and `running` going false. The pump below has
// exactly that shape, so it re-checks for work in a `finally` AFTER clearing
// `running`, and `ingest` also kicks it. Either path alone leaves a hole.

import { useAnim } from '../../store/animStore';
import { useGame } from '../../store/gameStore';
import { useSettings, TIME_SCALE } from '../../store/settingsStore';
import { useUi } from '../../store/uiStore';
import type { EngineEvent, InstanceId, PlayerView } from '../../view/types';
import { buildGroup, type Beat, type Lane } from './beats';
import { coalesceWithControllers } from './coalesce';
import { effectiveMode, governorFor, type Mode } from './governor';
import { activeCount, cancelAll, completeAll, setEpoch, setSpeed } from './flightLayer';
import { invalidateRects } from './rectRegistry';
import { prefersReducedMotion } from './reducedMotion';
import { setAnimScale } from './tokens';
import { DUR } from './tokens';

/** `card` is capped because six cards in flight is already a busy table; the HUD
 *  and overlay lanes are unbounded because numbers and particles are cheap AND
 *  because the HUD must never be made to wait. */
const LANE_CAP: Record<Lane, number> = { card: 6, overlay: Infinity, hud: Infinity };

/** A beat that has not finished in 3× its own duration is not going to. */
const BEAT_TIMEOUT_SLACK_MS = 400;
/** No progress for this long → drain, whatever the queue thinks. */
const WATCHDOG_STALL_MS = 2000;
const WATCHDOG_TICK_MS = 250;
const RECONCILE_TICK_MS = 500;

interface Group {
  id: number;
  epoch: number;
  view: PlayerView;
  events: EngineEvent[];
  /** Estimated cost, for the governor. Computed at ingest, before scaling. */
  estimatedMs: number;
}

let nextGroupId = 1;
let queue: Group[] = [];
let running = false;
let epoch = 0;
let lastProgressAt = performance.now();
let holdFF = false;
let forcedDrain = false;
let watchdog: number | null = null;
let reconciler: number | null = null;
let liveBeats = 0;
let beatsRun = 0;
let beatsTimedOut = 0;
let currentMode: Mode = 'full';
/** Test hook: a beat that never settles, to prove the queue cannot wedge. */
let injectHung = false;

function timeout(ms: number): Promise<'timeout'> {
  return new Promise((r) => setTimeout(() => r('timeout'), ms));
}

// ── "is the table busy animating" ─────────────────────────────────────────────
//
// ⚠️ This exists so the skip affordance can be shown EXACTLY while skipping would
// help, and not as permanent chrome. Hold-Space and Esc were wired in M2 and were
// undiscoverable for three milestones: a feature nobody is told about has not
// shipped. A hint that is always on screen is worse than none — it becomes
// furniture and stops being read — so it is bound to the one condition that makes
// it true.
//
// Published as a plain subscription rather than through a zustand store because
// this module is deliberately React-free, and because `useSyncExternalStore` wants
// exactly this shape. It only fires on a CHANGE, so a burst of thirty groups
// costs two notifications, not thirty.

type BusyListener = () => void;
const busyListeners = new Set<BusyListener>();
let busySnapshot = false;

function publishBusy(): void {
  const next = queue.length > 0 || liveBeats > 0 || running;
  if (next === busySnapshot) return;
  busySnapshot = next;
  for (const l of busyListeners) l();
}

export function subscribeBusy(listener: BusyListener): () => void {
  busyListeners.add(listener);
  return () => busyListeners.delete(listener);
}

/** True while there is queued or running animation work. */
export function isBusy(): boolean {
  return busySnapshot;
}

/** Rough cost of a group, used only to decide the playback rate. */
function estimate(events: EngineEvent[]): number {
  let ms = 0;
  const seenDraw = new Set<string>();
  for (const e of events) {
    switch (e.t) {
      case 'CardDrawn':
        // Draws coalesce, so only the first one costs a full beat.
        ms += seenDraw.has(e.player) ? 60 : DUR.draw;
        seenDraw.add(e.player);
        break;
      case 'SpellCast':
        ms += DUR.castFlight;
        break;
      case 'StackResolved':
        ms += DUR.resolve + DUR.landThump;
        break;
      case 'CardMoved':
        ms += 380;
        break;
      case 'PermanentDied':
        ms += DUR.deathDrop + DUR.resolve;
        break;
      case 'DamageDealt':
        ms += DUR.damagePunch;
        break;
      case 'PermanentTapped':
      case 'PermanentUntapped':
        ms += 34;
        break;
      case 'TokenCreated':
      case 'CardRevealed':
        ms += DUR.revealFlip;
        break;
      default:
        // HUD-only events cost nothing: they never queue a beat.
        break;
    }
  }
  return ms;
}

function pendingMs(): number {
  let ms = 0;
  for (const g of queue) ms += g.estimatedMs;
  return ms;
}

function decide(): { rate: number; mode: Mode } {
  const gov = governorFor(pendingMs(), queue.length);
  const settings = useSettings.getState().settings;
  const speedScale = TIME_SCALE[settings.animationSpeed];
  const ui = useUi.getState();
  // ⚠️ Read EVERY group, never cached at module load. The OS preference can be
  // toggled mid-game, and a value captured once would leave a player who just
  // asked for reduced motion still watching cards fly until they restart.
  const reducedMotion = prefersReducedMotion();

  const mode = effectiveMode({
    reducedMotion,
    speedOff: speedScale === Infinity,
    // A table that is not the visible screen keeps CONSUMING and COMMITTING; it
    // just stops flying clones. It must never pause, or the view diverges.
    tableVisible: ui.tableVisible || !ui.tableLive,
    drain: gov.drain || forcedDrain,
  });

  // The effective scale is the product of three independent inputs, which is
  // exactly why `d()` takes its scale from here rather than reading the settings
  // store itself.
  const finite = Number.isFinite(speedScale) ? speedScale : 1;
  const rate = finite * gov.rate * (holdFF ? 4 : 1);
  return { rate, mode };
}

async function runBeat(beat: Beat): Promise<void> {
  if (beat.epochAtBuild !== undefined && beat.epochAtBuild !== epoch) return;
  liveBeats++;
  publishBusy();
  try {
    // ⚠️ Every beat is raced against a timeout. A beat that hangs — a dropped
    // animation callback, an element that vanished, a promise that never settles —
    // must not stop the queue. On timeout we warn, force progress, and continue.
    const result = injectHung
      ? await Promise.race([new Promise<void>(() => {}), timeout(beat.durationMs * 3 + BEAT_TIMEOUT_SLACK_MS)])
      : await Promise.race([
          beat.run().catch((err: unknown) => {
            if (import.meta.env.DEV) console.warn(`[choreographer] beat ${beat.id} threw`, err);
          }),
          timeout(beat.durationMs * 3 + BEAT_TIMEOUT_SLACK_MS),
        ]);
    if (result === 'timeout') {
      beatsTimedOut++;
      if (import.meta.env.DEV) {
        console.warn(`[choreographer] beat ${beat.id} timed out after ${beat.durationMs * 3 + BEAT_TIMEOUT_SLACK_MS}ms`);
      }
    }
  } finally {
    liveBeats--;
    beatsRun++;
    lastProgressAt = performance.now();
    publishBusy();
  }
}

/**
 * Run one group. Beats with disjoint keys run concurrently; beats sharing a key
 * serialize; the `card` lane is capped.
 */
async function runGroup(beats: Beat[]): Promise<void> {
  const pending = [...beats];
  const busyKeys = new Set<string>();
  const laneCount: Record<Lane, number> = { card: 0, overlay: 0, hud: 0 };
  const inFlightPromises = new Set<Promise<void>>();

  while (pending.length > 0 || inFlightPromises.size > 0) {
    let startedAny = false;
    for (let i = 0; i < pending.length; i++) {
      const beat = pending[i]!;
      if (beat.keys.some((k) => busyKeys.has(k))) continue;
      if (laneCount[beat.lane] >= LANE_CAP[beat.lane]) continue;

      pending.splice(i, 1);
      i--;
      for (const k of beat.keys) busyKeys.add(k);
      laneCount[beat.lane]++;
      startedAny = true;

      const p = runBeat(beat).finally(() => {
        for (const k of beat.keys) busyKeys.delete(k);
        laneCount[beat.lane]--;
        inFlightPromises.delete(p);
      });
      inFlightPromises.add(p);
    }

    if (inFlightPromises.size === 0) {
      // Nothing running and nothing startable. Only reachable if a beat's keys
      // conflict with themselves; bail rather than spin forever.
      if (!startedAny) break;
      continue;
    }
    await Promise.race(inFlightPromises);
  }
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  publishBusy();
  try {
    while (queue.length > 0) {
      const group = queue.shift()!;
      if (group.epoch !== epoch) continue; // built before a hard sync

      const { rate, mode } = decide();
      currentMode = mode;
      setAnimScale(rate);
      setSpeed(holdFF ? 4 : 1);

      if (mode === 'digest' && (forcedDrain || governorFor(pendingMs(), queue.length).drain)) {
        // DRAIN: commit the newest view we have and stop animating. The log carries
        // the narrative, so nothing is lost — only the motion is skipped.
        const newest = queue.length > 0 ? queue[queue.length - 1]!.view : group.view;
        queue = [];
        useGame.getState().applyView(newest);
        useAnim.getState().clear();
        cancelAll();
        forcedDrain = false;
        lastProgressAt = performance.now();
        continue;
      }

      // ⚠️ Build BEFORE the commit: source rects belong to the old view.
      const before = useGame.getState().view;
      const intents = coalesceWithControllers(
        group.events,
        (id) => before.cards[id]?.controller ?? group.view.cards[id]?.controller,
      );
      const built = buildGroup(intents, {
        epoch,
        before,
        after: group.view,
        digest: mode === 'digest',
      });
      for (const beat of built.beats) beat.epochAtBuild = epoch;

      // Commit-then-fly: hide the flying cards, commit, then run.
      useAnim.getState().markInFlight(built.inFlight);
      useGame.getState().applyView(group.view);
      // The rects captured during build belong to the PREVIOUS view. Drop them so
      // no beat can read a pre-commit position — see the note on the cache in
      // rectRegistry.
      invalidateRects();
      lastProgressAt = performance.now();

      try {
        await runGroup(built.beats);
      } finally {
        // Always clear, even if a beat threw: a card left hidden forever is the
        // one failure the convergence guarantee exists to prevent.
        useAnim.getState().clearInFlight(built.inFlight);
      }
    }
  } finally {
    running = false;
    publishBusy();
    // ⚠️ The restart hole. A group that arrived while the loop was draining its
    // last item would find `running` still true and return early, and nothing
    // would ever pick it up. Re-check AFTER clearing the flag.
    if (queue.length > 0) queueMicrotask(() => void pump());
  }
}

function startTimers(): void {
  if (typeof window === 'undefined') return;
  if (watchdog === null) {
    watchdog = window.setInterval(() => {
      if (queue.length === 0 && liveBeats === 0) {
        lastProgressAt = performance.now();
        return;
      }
      if (performance.now() - lastProgressAt > WATCHDOG_STALL_MS) {
        // Something is stuck. Drop to drain rather than sit there: the player is
        // waiting on a table that has stopped telling them anything.
        if (import.meta.env.DEV) console.warn('[choreographer] stalled — draining');
        forcedDrain = true;
        lastProgressAt = performance.now();
        void pump();
      }
    }, WATCHDOG_TICK_MS);
  }
  if (reconciler === null) {
    reconciler = window.setInterval(() => {
      // The convergence sweep. Any `inFlight` id with no live clone has lost its
      // beat somewhere; clear it so the card becomes visible again.
      if (activeCount() === 0 && useAnim.getState().inFlight.size > 0 && liveBeats === 0) {
        useAnim.getState().reconcile(new Set());
      }
    }, RECONCILE_TICK_MS);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface ChoreographerStats {
  queuedGroups: number;
  pendingMs: number;
  rate: number;
  mode: Mode;
  epoch: number;
  liveBeats: number;
  beatsRun: number;
  beatsTimedOut: number;
  activeFlights: number;
  inFlight: number;
  running: boolean;
}

/** The ONLY entry point for normal play. */
export function ingest(events: EngineEvent[], viewAfter: PlayerView): void {
  startTimers();
  queue.push({
    id: nextGroupId++,
    epoch,
    view: viewAfter,
    events,
    estimatedMs: estimate(events),
  });
  publishBusy();
  void pump();
}

/**
 * Hard sync — reconnect, snapshot, a fresh board.
 *
 * ⚠️ Bumping the epoch is what makes this safe. Every queued group and every built
 * beat records the epoch it belongs to and is discarded if it no longer matches, so
 * ONE counter kills every in-flight async race across a resync. Without it, a beat
 * built for the pre-reconnect world would land a card in a zone the new snapshot
 * says it is not in.
 */
export function applySnapshot(view: PlayerView): void {
  queue = [];
  epoch++;
  setEpoch(epoch);
  cancelAll();
  useAnim.getState().clear();
  useGame.getState().applySnapshot(view);
  forcedDrain = false;
  lastProgressAt = performance.now();
  publishBusy();

  // One 240 ms table fade, so a resync is visible without being an animation.
  useAnim.getState().setHardSyncFlash(true);
  if (typeof window !== 'undefined') {
    window.setTimeout(() => useAnim.getState().setHardSyncFlash(false), DUR.hardSync);
  }
}

/** Esc: commit everything queued NOW, at its final pose. */
export function flush(): void {
  const last = queue[queue.length - 1];
  queue = [];
  completeAll();
  if (last) useGame.getState().applyView(last.view);
  useAnim.getState().clear();
  lastProgressAt = performance.now();
  publishBusy();
}

/** Hold Space. Sets `speed` on every live flight, not just future ones. */
export function holdFastForward(on: boolean): void {
  holdFF = on;
  setSpeed(on ? 4 : 1);
}

export function stats(): ChoreographerStats {
  const gov = governorFor(pendingMs(), queue.length);
  return {
    queuedGroups: queue.length,
    pendingMs: pendingMs(),
    rate: decide().rate,
    mode: gov.drain || forcedDrain ? 'drain' : currentMode,
    epoch,
    liveBeats,
    beatsRun,
    beatsTimedOut,
    activeFlights: activeCount(),
    inFlight: useAnim.getState().inFlight.size,
    running,
  };
}

export function reset(): void {
  queue = [];
  epoch++;
  setEpoch(epoch);
  cancelAll();
  useAnim.getState().clear();
  holdFF = false;
  forcedDrain = false;
  injectHung = false;
  beatsRun = 0;
  beatsTimedOut = 0;
  lastProgressAt = performance.now();
  publishBusy();
}

/**
 * Test hook: make the NEXT group's beats never settle.
 *
 * ⚠️ This is the anti-wedge proof and it must not be deleted. A queue that cannot
 * survive one hung beat will eventually strand a real player behind an animation
 * that never finished, with no way out but a reload — and the failure would be
 * unreproducible. Injecting the failure on purpose is the only way to know the
 * timeout path works.
 */
export function injectHungBeat(on = true): void {
  injectHung = on;
}

/** Currently-hidden ids, for the convergence assertion. */
export function inFlightIds(): InstanceId[] {
  return [...useAnim.getState().inFlight];
}

export function currentEpoch(): number {
  return epoch;
}
