// The rect registry — the ONLY place in this app that may call
// getBoundingClientRect.
//
// Two problems it exists to solve:
//
// 1. LAYOUT THRASH. Every getBoundingClientRect forces the browser to flush
//    pending style and layout work. Interleaving reads with writes (read a card,
//    set a transform, read the next card…) turns one layout pass into N. A
//    6-card draw would do 12. `readAll` takes every key it needs and reads them
//    back to back with nothing in between, so the cost is exactly one flush.
//    `src/ui/anim/perf.ts` installs a dev-only monkeypatch that warns when
//    anything calls the DOM method outside a registry read window — the honest
//    enforcement of a rule that is otherwise just a comment.
//
// 2. RESOLUTION THAT NEVER FAILS. The flight layer is rect-to-rect, which is what
//    makes "move any card to any zone" (the Tier-3 tool) the DEFAULT path rather
//    than a pile of special cases. For that to hold, asking for the position of a
//    card that is not on screen must still return somewhere sensible. Three tiers,
//    in order: the card's own slot → its zone's anchor element → the viewport
//    centre. A hidden zone exposes only an anchor; a collapsed pod exposes only
//    an anchor; and the viewport centre is the floor that never fails. So
//    `resolve()` NEVER throws and NEVER returns null, and no caller needs a
//    null check that would be dead code 99.9% of the time and wrong the once.

import type { InstanceId, PlayerId, ZoneId } from '../../view/types';

/**
 * ⚠️ `plate:`, `pod:` and `stackitem:` exist so the targeting arrow can measure
 * a player and a stack object through the registry like everything else.
 * `beats.plateRectFor` shows the alternative — `querySelector` plus
 * `readElements` — and it is worse than it looks: `readElements` takes ELEMENTS,
 * so it bypasses the per-frame cache below entirely. One `querySelector` sweep is
 * fine; sixty anchors re-swept on every view commit is a full layout flush each
 * time, which is the exact cost this module exists to prevent.
 */
export type SlotKey =
  | `card:${InstanceId}`
  | `zone:${ZoneId}`
  | `plate:${PlayerId}`
  | `pod:${PlayerId}`
  | `stackitem:${string}`;

export function cardSlot(id: InstanceId): SlotKey {
  return `card:${id}`;
}
export function zoneSlot(id: ZoneId): SlotKey {
  return `zone:${id}`;
}
/** A seat's nameplate — the thing you point at to target a player. */
export function plateSlot(id: PlayerId): SlotKey {
  return `plate:${id}`;
}
/** A seat's whole area — the coarse drop target for "attack this player". */
export function podSlot(id: PlayerId): SlotKey {
  return `pod:${id}`;
}
/** One object on the stack, by `stackItemId`. */
export function stackItemSlot(id: string): SlotKey {
  return `stackitem:${id}`;
}

/** A plain object rather than a live DOMRect: the value must not change under us. */
export interface FrozenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const elements = new Map<SlotKey, HTMLElement>();

/**
 * Bumped by useTableMetrics on every resize. A clone whose captured rects predate
 * the current epoch is snapped to its destination instead of animating to a
 * position that has since moved — a 400 ms flight to a rect that shifted 300 px
 * looks far worse than an instant snap.
 */
let metricsEpoch = 0;

/** True only inside `readAll`. `perf.ts` reads this to police rect discipline. */
let reading = false;

/**
 * Per-frame read cache.
 *
 * ⚠️ THIS IS A PERFORMANCE FIX WITH A MEASUREMENT BEHIND IT, not a micro-opt.
 * `readAll` batches the rects a caller asks for in ONE go, but a group of beats
 * makes SEVERAL separate calls — the flourish wants the stack rect, a landing wants
 * the card's new rect, a damage punch wants the target's plate — and each call is
 * its own forced style-and-layout flush. After a view commit the whole table is
 * invalidated, so each flush re-lays-out the entire tree.
 *
 * Measured on a 4-player, 40-permanent board: exactly ONE long frame of 50–58 ms
 * per view commit, and the long-frame count tracked the commit count precisely
 * (2 commits → 2, 4 → 4). Committing the same view with NO beats produced ZERO long
 * frames and a 9 ms maximum — which is what proved the cost was in the beats' reads
 * rather than in React.
 *
 * The cache is cleared on the next animation frame and whenever the view commits
 * (`invalidateRects`), so a beat can never read across a layout change: within a
 * single frame nothing has painted, and transforms — the only thing beats write —
 * do not affect layout.
 */
let cache = new Map<SlotKey, FrozenRect | null>();
let cacheFrame: number | null = null;

function scheduleCacheClear(): void {
  if (cacheFrame !== null || typeof requestAnimationFrame === 'undefined') return;
  cacheFrame = requestAnimationFrame(() => {
    cacheFrame = null;
    cache.clear();
  });
}

/**
 * Drop the per-frame rect cache. The choreographer calls this immediately after
 * committing a view, so no beat can read a position from before the commit.
 */
export function invalidateRects(): void {
  cache.clear();
}

/**
 * Register a slot. Returns its own cleanup function, so it can be used directly
 * as a React 19 ref callback: `ref={(el) => register(key, el)}`. React 19 calls
 * the returned function on unmount, which removes the whole
 * `useEffect`/null-check dance the older ref contract required.
 */
export function register(key: SlotKey, el: HTMLElement | null): (() => void) | void {
  if (!el) return;
  elements.set(key, el);
  return () => {
    // Only delete if it is still OUR element. A remount can register the
    // replacement before React runs the old cleanup, and an unconditional
    // delete would then unregister the live slot — the card would resolve to
    // its zone anchor instead of its real position, which looks like a
    // mysteriously wrong flight destination rather than like a lifecycle bug.
    if (elements.get(key) === el) elements.delete(key);
  };
}

export function isRegistered(key: SlotKey): boolean {
  return elements.has(key);
}

/**
 * TIER 0 of the resolution ladder: "the player just let go of this card HERE".
 *
 * ⚠️ The ONLY writer is an input gesture, and it exists because of an ordering
 * fact in `beats.ts`: a group's source rects are read BEFORE the view commits, so
 * a card played by dragging would fly from the hand slot it still occupied — the
 * card would snap back into the fan and then fly out again, which reads as a
 * dropped frame rather than as the two separate truths it actually is.
 *
 * ⚠️ CONSUMED ON READ, and with a TTL. Both matter. An intent the host refuses
 * produces no flight at all, so an origin that outlived its drop would be spent
 * on the NEXT flight that card ever takes — a discard, ten turns later, flying
 * out of a battlefield slot nobody dropped it on. One use, one second.
 */
const dropOrigins = new Map<InstanceId, { rect: FrozenRect; until: number }>();
const DROP_ORIGIN_TTL_MS = 1000;

export function setDropOrigin(id: InstanceId, rect: FrozenRect): void {
  dropOrigins.set(id, { rect, until: performance.now() + DROP_ORIGIN_TTL_MS });
}

/** The drop origin for a card, if it has a live one. Removes it either way. */
export function takeDropOrigin(id: InstanceId): FrozenRect | null {
  const entry = dropOrigins.get(id);
  if (!entry) return null;
  dropOrigins.delete(id);
  return entry.until > performance.now() ? entry.rect : null;
}

export function clearDropOrigins(): void {
  dropOrigins.clear();
}

/**
 * The live element for a slot, for beats that animate a real card in place
 * (tap, thump, shake, death fade) rather than flying a clone.
 *
 * ⚠️ Do NOT call getBoundingClientRect on what this returns — that is what
 * `readAll` is for, and the dev-only monkeypatch in perf.ts will warn about it.
 * Imperative `animate(el, …)` on transform/opacity/filter is fine and is the
 * whole reason this accessor exists.
 */
export function elementFor(key: SlotKey): HTMLElement | null {
  return elements.get(key) ?? null;
}

export function registeredKeys(): SlotKey[] {
  return [...elements.keys()];
}

/** A rect is only usable if it has area — a `display: none` ancestor gives 0×0. */
function usable(r: DOMRect): boolean {
  return r.width > 0.5 && r.height > 0.5;
}

function freeze(r: DOMRect): FrozenRect {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * Read every key back to back, with zero interleaved style writes.
 * Keys with no live element, or whose element has no area, are absent from the
 * result — callers fall through to `resolve()`.
 */
export function readAll(keys: readonly SlotKey[]): Map<SlotKey, FrozenRect> {
  const out = new Map<SlotKey, FrozenRect>();
  reading = true;
  try {
    for (const key of keys) {
      const cached = cache.get(key);
      if (cached !== undefined) {
        if (cached !== null) out.set(key, cached);
        continue;
      }
      const el = elements.get(key);
      if (!el) {
        cache.set(key, null);
        continue;
      }
      const r = el.getBoundingClientRect();
      const frozen = usable(r) ? freeze(r) : null;
      cache.set(key, frozen);
      if (frozen) out.set(key, frozen);
    }
  } finally {
    reading = false;
  }
  scheduleCacheClear();
  return out;
}

export function read(key: SlotKey): FrozenRect | null {
  return readAll([key]).get(key) ?? null;
}

/**
 * Measure an arbitrary element inside a registry read window.
 *
 * For elements that are not slots — a band's own box, the document body — which
 * the layout battery has to check card containment against. Routed through here
 * rather than calling getBoundingClientRect at the call site so the dev-only
 * discipline monkeypatch in perf.ts does not have to make an exception it would
 * then have to trust.
 */
export function readElements(els: readonly (Element | null)[]): (FrozenRect | null)[] {
  reading = true;
  try {
    return els.map((el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
  } finally {
    reading = false;
  }
}

/** Centre of the viewport, sized like a mid-table card. The floor that never fails. */
function viewportCentre(): FrozenRect {
  const w = typeof window === 'undefined' ? 1920 : window.innerWidth;
  const h = typeof window === 'undefined' ? 1080 : window.innerHeight;
  const cardH = 148;
  const cardW = Math.round(cardH * (745 / 1040));
  return { left: (w - cardW) / 2, top: (h - cardH) / 2, width: cardW, height: cardH };
}

/**
 * Where is this card, as far as the flight layer is concerned?
 * card slot → zone anchor → viewport centre. NEVER throws, NEVER returns null.
 */
export function resolve(instanceId: InstanceId | null, zone: ZoneId | null): FrozenRect {
  const keys: SlotKey[] = [];
  if (instanceId) keys.push(cardSlot(instanceId));
  if (zone) keys.push(zoneSlot(zone));
  const found = readAll(keys);
  for (const key of keys) {
    const r = found.get(key);
    if (r) return r;
  }
  return viewportCentre();
}

/** Resolve a bare SlotKey, with the same never-fails contract. */
export function resolveKey(key: SlotKey): FrozenRect {
  return read(key) ?? viewportCentre();
}

export function isReading(): boolean {
  return reading;
}

export function currentMetricsEpoch(): number {
  return metricsEpoch;
}

export function bumpMetricsEpoch(): number {
  // A reflow makes every cached rect wrong.
  cache.clear();
  return ++metricsEpoch;
}

/** Test-only. Never call this from app code — React owns registration. */
export function _resetRegistry(): void {
  elements.clear();
  cache.clear();
  dropOrigins.clear();
  metricsEpoch = 0;
  reading = false;
}
