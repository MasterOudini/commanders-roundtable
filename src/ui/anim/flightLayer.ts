// The flight layer — a MODULE SINGLETON.
//
// Why a singleton rather than a hook or context: `choreographer.ts` is plain TS
// with no React in it, and it is the main caller. Same precedent as
// cartapriscus's engineSingleton. `FlightLayer.tsx` subscribes and renders; it
// owns no state of its own.
//
// ⚠️ WHY NOT `layoutId` / <LayoutGroup> — do not "simplify" this to it later:
//   (a) It animates the element in its NEW DOM parent, so `overflow: hidden` on
//       the hand or a band CLIPS the in-flight card, and it cannot be raised
//       above a sibling panel's stacking context.
//   (b) It matches sizes with `transform: scale()`, which distorts all ~20 card
//       sub-elements; un-distorting them needs `layout` on every child.
//   (c) `layout` owns the transform, so the mid-flight rotateY flip needs an
//       extra nested wrapper.
//   (d) It is render-driven, so 6 simultaneous flights cannot be sequenced,
//       throttled, coalesced or skipped — which makes the choreographer's whole
//       backpressure design impossible.
// And not the View Transitions API either: only one transition may run at a time
// (a second startViewTransition skips the first), while a Commander table
// routinely animates three things at once.
//
// So: exactly two mechanisms in this app. Declarative variants for beats INSIDE a
// zone (tap, lift, thump, fan reflow), and this layer for anything crossing
// zones. `fly()` is rect-to-rect, which is why arbitrary zone→zone — what the
// Tier-3 "move any card anywhere" tool needs — is the default path here rather
// than a special case.

import type { CardData } from '../../data/cardTypes';
import type { EaseName } from './tokens';
import { DUR, d } from './tokens';
import type { FrozenRect, SlotKey } from './rectRegistry';
import { currentMetricsEpoch, resolveKey } from './rectRegistry';

export type FaceMode = 'full' | 'chit' | 'back';
export type Landing = 'thump' | 'settle' | 'drop' | 'none';

export interface FlightSpec {
  /** Also the identity used by `cancel()` and by animStore.inFlight. */
  instanceId: string;
  /** Discarded before it starts if this is not the current epoch. */
  epoch: number;
  /**
   * The source rect. The choreographer passes an already-read rect, because the
   * source must be measured BEFORE the state write that removes the card from
   * its old zone. A SlotKey is accepted for direct callers (the #flight screen,
   * the Tier-3 tool) and resolved immediately.
   */
  from: FrozenRect | SlotKey;
  /**
   * The destination. A SlotKey here is resolved LATE — in the clone's
   * useLayoutEffect, after React has committed the destination slot — which is
   * what makes the landing pixel-exact.
   */
  to: FrozenRect | SlotKey;
  faceUpAtStart: boolean;
  faceUpAtEnd: boolean;
  /** 0 straight … 0.22 for a draw. Fraction of the flight distance. */
  arc: number;
  durationMs: number;
  ease?: EaseName;
  /** rotateZ start and end, in degrees. */
  spinFrom?: number;
  spinTo?: number;
  /** Mid-flight size bulge, relative to the destination size. See arc.scaleKeys. */
  peakScale?: number;
  /** oklch()/var() colour for the travelling drop-shadow. */
  glow?: string;
  landing?: Landing;
  faceMode?: FaceMode;
  z?: number;
  /** What to draw in the clone. `null` renders the card back. */
  card: CardData | null;
  faceIndex?: number;
}

export interface Clone {
  key: number;
  spec: FlightSpec;
  from: FrozenRect;
  /** Non-null once the clone has resolved its destination. */
  metricsEpoch: number;
  startedAt: number;
}

type Listener = () => void;

let nextKey = 1;
let epoch = 0;
let snapshot: Clone[] = [];

interface Record_ {
  clone: Clone;
  settle: () => void;
  settled: boolean;
  /** Set by cancel() before the clone has started animating. */
  cancelRequested: boolean;
  /** Installed by the clone component so cancel()/hold-FF can reach the animation. */
  onCancel: (() => void) | null;
  onSpeed: ((speed: number) => void) | null;
  reaper: number | null;
}

const records = new Map<string, Record_>();
const listeners = new Set<Listener>();
/** Speed applied to every clone started from now on (hold-to-fast-forward). */
let liveSpeed = 1;

function publish(): void {
  snapshot = [...records.values()].map((r) => r.clone);
  for (const l of listeners) l();
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getClones(): Clone[] {
  return snapshot;
}

export function activeCount(): number {
  return records.size;
}

/**
 * How many clones have EVER been created, monotone for the life of the page.
 *
 * ⚠️ `activeCount()` is a POINT sample and cannot answer "did anything fly?".
 * A clone that mounted and unmounted between two polls is invisible to it — and
 * the reduced-motion gate is exactly the case where ONE stray flight in a
 * 200-intent game is the entire bug. `nextKey` is incremented once per clone and
 * never decremented, so a counter read before and after a run cannot miss one.
 */
export function clonesCreated(): number {
  return nextKey - 1;
}

export function setEpoch(next: number): void {
  epoch = next;
}

export function currentEpoch(): number {
  return epoch;
}

function settle(id: string): void {
  const rec = records.get(id);
  if (!rec || rec.settled) return;
  rec.settled = true;
  if (rec.reaper !== null) window.clearTimeout(rec.reaper);
  records.delete(id);
  publish();
  rec.settle();
}

/**
 * Fly a card from one rect to another.
 *
 * Resolves on LAND or on CANCEL, and never rejects. That contract matters: the
 * choreographer awaits every beat, so a rejecting flight would need a try/catch
 * at every call site and one missing catch would wedge the queue.
 */
export function fly(spec: FlightSpec): Promise<void> {
  // Epoch guard. One check here kills every async race across a reconnect: a
  // beat built before the snapshot cannot start after it.
  if (spec.epoch !== epoch) return Promise.resolve();

  // A second flight for the same card supersedes the first (a coalescing miss,
  // or a re-cast of a card that just returned). Snap the old one home first.
  if (records.has(spec.instanceId)) cancel(spec.instanceId);

  const from = typeof spec.from === 'string' ? resolveKey(spec.from) : spec.from;

  return new Promise<void>((resolve) => {
    const clone: Clone = {
      key: nextKey++,
      spec,
      from,
      metricsEpoch: currentMetricsEpoch(),
      startedAt: performance.now(),
    };
    const rec: Record_ = {
      clone,
      settle: resolve,
      settled: false,
      cancelRequested: false,
      onCancel: null,
      onSpeed: null,
      reaper: null,
    };
    // ⚠️ Self-reap. If React never mounts the clone — FlightLayer unmounted, the
    // screen hidden, a thrown render — nothing else would ever resolve this
    // promise, and the choreographer would sit on it until its own beat timeout.
    // Belt and braces: the layer cleans up after itself too.
    rec.reaper = window.setTimeout(
      () => settle(spec.instanceId),
      Math.max(3000, spec.durationMs * 2 + 600),
    );
    records.set(spec.instanceId, rec);
    recordFlight(spec.instanceId, from);
    publish();
  });
}

/**
 * The last few flights, as (card, where it started).
 *
 * ⚠️ Kept for exactly the reason `clonesCreated` is kept: a flight that begins
 * and ends between two polls is invisible to any point sample, and "where did
 * this card fly FROM" is the question a drag-to-play assertion has to ask after
 * the fact. It is the flight's real source rect, not a re-derivation of it — the
 * same discipline as `combatPlans()`.
 */
const RECENT_FLIGHTS = 12;
const recent: { instanceId: string; from: FrozenRect }[] = [];

function recordFlight(instanceId: string, from: FrozenRect): void {
  recent.push({ instanceId, from });
  if (recent.length > RECENT_FLIGHTS) recent.shift();
}

export function recentFlights(): { instanceId: string; from: FrozenRect }[] {
  return recent.map((f) => ({ instanceId: f.instanceId, from: { ...f.from } }));
}

/** Snap a flight to its destination and resolve it. Safe to call for unknown ids. */
export function cancel(instanceId: string): void {
  const rec = records.get(instanceId);
  if (!rec) return;
  rec.cancelRequested = true;
  if (rec.onCancel) rec.onCancel();
  settle(instanceId);
}

export function cancelAll(): void {
  for (const id of [...records.keys()]) cancel(id);
}

/**
 * Hold-to-fast-forward. Setting `speed` on the live playback controls is why each
 * flight is ONE MotionValue: the whole flight — position, scale, flip, spin, glow
 * — scales with a single assignment instead of 6 re-timed animations.
 */
export function setSpeed(speed: number): void {
  liveSpeed = speed;
  for (const rec of records.values()) rec.onSpeed?.(speed);
}

export function getSpeed(): number {
  return liveSpeed;
}

/** Complete every live flight immediately, at its final pose. Esc / flush(). */
export function completeAll(): void {
  cancelAll();
}

// ── Internals used only by FlightLayer.tsx ──────────────────────────────────

export function _attach(
  instanceId: string,
  handlers: { onCancel: () => void; onSpeed: (s: number) => void },
): { cancelled: boolean } {
  const rec = records.get(instanceId);
  if (!rec) return { cancelled: true };
  rec.onCancel = handlers.onCancel;
  rec.onSpeed = handlers.onSpeed;
  return { cancelled: rec.cancelRequested };
}

export function _land(instanceId: string): void {
  settle(instanceId);
}

export function _resetForTests(): void {
  for (const rec of records.values()) {
    if (rec.reaper !== null) window.clearTimeout(rec.reaper);
  }
  records.clear();
  listeners.clear();
  snapshot = [];
  epoch = 0;
  liveSpeed = 1;
}

/** Default flight, used by the generic zone→zone beat and by the Tier-3 tool. */
export function genericFlight(
  instanceId: string,
  card: CardData | null,
  from: FrozenRect | SlotKey,
  to: FrozenRect | SlotKey,
  opts: Partial<FlightSpec> = {},
): FlightSpec {
  return {
    instanceId,
    epoch,
    from,
    to,
    card,
    faceUpAtStart: true,
    faceUpAtEnd: true,
    arc: 0.14,
    durationMs: d(380),
    ease: 'flight',
    landing: 'settle',
    faceMode: 'full',
    ...opts,
  };
}

export const FLIGHT_Z = 900;
export const FX_Z = 920;
/** Long enough to cover any beat; the layer reaps anything older regardless. */
export const MAX_FLIGHT_MS = DUR.castFlight * 3;
