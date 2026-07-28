// The targeting arrow's geometry. Pure — no DOM, no React, no motion.
//
// Everything here is arithmetic on frozen rects, so the arrow layer can recompute
// a whole path on every pointermove without reading the DOM at all. That is the
// property that lets it write one `d` attribute per move and read ZERO rects.

import { bezierAt, centerOf, controlPoint, type Pt, type RectLike, type Viewport } from './arc';

export type { Pt, RectLike, Viewport };
export { centerOf };

/**
 * ⚠️ NOT routed through `d()`, and deliberately — the same argument
 * `DragLayer.RETURN_MS` already carries. `d()` reads the choreographer's scale
 * gate, which belongs to the animation group it is currently building (D16). An
 * aim arrow is an INPUT AFFORDANCE, not a beat: it is in no group, it cannot be
 * fast-forwarded, and scaling it by a governor that is throttling animation
 * backpressure would make the player's own cursor feel broken under load.
 * Reduced motion is honoured as a MODE — no easing at all — which is what
 * `reducedMotion.ts` is for.
 */
export const AIM_SNAP_MS = 90;
/** Shallower than the draw beat's 0.22: an aim is a pointer, not a throw. */
export const AIM_ARC = 0.14;
/** Magnetism outside a target's rect, so a fast flick still lands. */
export const AIM_SLOP_PX = 12;
/** How far short of the target's edge the head stops, so the art stays readable. */
const EDGE_INSET = 3;

/** `M x y Q cx cy tx ty` — the one string the layer writes per move. */
export function quadPath(from: Pt, ctrl: Pt, to: Pt): string {
  return `M ${r(from.x)} ${r(from.y)} Q ${r(ctrl.x)} ${r(ctrl.y)} ${r(to.x)} ${r(to.y)}`;
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The bow, with the one case `controlPoint` cannot decide.
 *
 * ⚠️ `arc.controlPoint` signs the bow by projecting the perpendicular onto the
 * direction of the viewport centre. For an aim from my hand at the bottom-centre
 * to an opponent's pod at the top-centre — which is the single most common aim in
 * the game — the midpoint IS the viewport centre, that dot product is ~0, and the
 * sign flips on sub-pixel cursor noise. The arrow snaps between bowing left and
 * bowing right as the mouse drifts one pixel.
 *
 * ⚠️ This DELEGATES rather than editing `controlPoint`, which is unit-tested and
 * used by every flight in the app. An input affordance does not get to change how
 * cards fly.
 */
export function aimControl(from: Pt, to: Pt, arc: number, vp: Viewport): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= 0.5) {
    const nx = -dy / dist;
    const ny = dx / dist;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const dot = nx * (vp.w / 2 - mid.x) + ny * (vp.h / 2 - mid.y);
    if (Math.abs(dot) < 1) {
      // The tie. Bow screen-right, always, so it cannot flicker.
      const off = arc * dist;
      return { x: mid.x + nx * off, y: mid.y + ny * off };
    }
  }
  return controlPoint(from, to, arc, vp);
}

/** Tangent at the tip, in degrees, for the arrowhead's `rotate()`. */
export function headAngle(from: Pt, ctrl: Pt, to: Pt): number {
  const near = bezierAt(from, ctrl, to, 0.98);
  const dx = to.x - near.x;
  const dy = to.y - near.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Where the arrow should MEET a rect: the point on its edge along the incoming
 * direction, inset a few pixels.
 *
 * A head buried under the target's art is a head nobody reads — the same reason
 * `combat.interceptPoint` stops well short of the card it is blocking.
 */
export function edgePoint(rect: RectLike, incoming: Pt): Pt {
  const c = centerOf(rect);
  const dx = c.x - incoming.x;
  const dy = c.y - incoming.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return c;
  const hw = Math.max(1, rect.width / 2 - EDGE_INSET);
  const hh = Math.max(1, rect.height / 2 - EDGE_INSET);
  // Scale the incoming direction until it touches the box, then step back.
  const scale = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
  return { x: c.x - dx * scale, y: c.y - dy * scale };
}

/**
 * Perpendicular offset for the Nth of M arrows leaving one source, so two
 * arrows to two targets do not overlay near the shared tail. Mirrors the intent
 * of `combat.blockerSide`.
 */
export function fanOffset(index: number, total: number): number {
  if (total <= 1) return 0;
  const span = 26;
  return (index - (total - 1) / 2) * (span / Math.max(1, total - 1)) * (total - 1);
}

export interface Anchor {
  readonly key: string;
  readonly rect: RectLike;
}

/**
 * What is under this point?
 *
 * ⚠️ LAST MATCH WINS. Rects genuinely overlap — a tapped card's footprint, a
 * pile's offset plates — and an AABB sweep has no notion of paint order. The
 * bands all use the same z-index and rely on DOM order, so later-in-DOM is
 * painted on top; taking the last match is the same tie-break the browser makes.
 */
export function hitTest(point: Pt, anchors: readonly Anchor[], slop: number): string | null {
  let found: string | null = null;
  for (const a of anchors) {
    const { left, top, width, height } = a.rect;
    if (
      point.x >= left - slop &&
      point.x <= left + width + slop &&
      point.y >= top - slop &&
      point.y <= top + height + slop
    ) {
      found = a.key;
    }
  }
  return found;
}
