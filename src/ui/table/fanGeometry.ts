// Hand-fan geometry — PURE. Unit-tested.
//
// The hand is the ONE place cards overlap, and it is absolutely positioned with
// computed x/rotate/y rather than laid out by flexbox. That is deliberate: the
// hover choreography needs neighbours to part by an exact exponential falloff,
// which means the code has to own the numbers. (It is also why `layout` /
// `layoutId` would buy nothing here even if this app used them — we animate the
// computed values, not a layout change.)

export interface FanSlot {
  index: number;
  /** Left offset within the band, in px, before hover displacement. */
  x: number;
  /** Rotation in degrees. Negative on the left, positive on the right. */
  angle: number;
  /** Vertical droop, in px. The fan's edges sit lower than its middle. */
  y: number;
  /** Stacking order — later cards sit on top. */
  z: number;
}

export interface FanGeometry {
  slots: FanSlot[];
  pitch: number;
  totalWidth: number;
  /** 'fan' up to 32 cards; a chit scroller past that. */
  mode: 'fan' | 'list';
}

/** Neighbours part by this many px at distance 1 from the hovered card. */
export const PART_AMPLITUDE = 26;
/** Exponential falloff rate. 26·e^(−0.55·d) → 26, 15.0, 8.6, 5.0, 2.9 px. */
export const PART_FALLOFF = 0.55;
/** Hover lift, in px. */
export const HOVER_LIFT = 54;
export const HOVER_SCALE = 1.1;
/** Beyond this many cards the fan overflows even at minimum pitch. */
export const MAX_FAN_CARDS = 32;

const MIN_PITCH = 46;
const MAX_SWEEP_DEG = 30;
const DROOP_PX = 16;

/**
 * ⚠️ `transformOrigin: 50% 190%` — the pivot sits BELOW the card, which is what
 * makes a rotated row read as a fan held in a hand rather than as a set of
 * individually tilted rectangles. Rotating about the card's own centre looks
 * like a bug.
 */
export const FAN_TRANSFORM_ORIGIN = '50% 190%';

export function fanGeometry(opts: {
  count: number;
  bandWidth: number;
  cardW: number;
  pitchCap: number;
}): FanGeometry {
  const { count, bandWidth, cardW } = opts;
  const pitchCap = Math.max(MIN_PITCH + 1, opts.pitchCap);

  if (count <= 0) return { slots: [], pitch: 0, totalWidth: 0, mode: 'fan' };
  if (count === 1) {
    return {
      slots: [{ index: 0, x: (bandWidth - cardW) / 2, angle: 0, y: 0, z: 0 }],
      pitch: 0,
      totalWidth: cardW,
      mode: 'fan',
    };
  }

  const pitch = clamp((bandWidth - cardW) / (count - 1), MIN_PITCH, pitchCap);
  const totalWidth = pitch * (count - 1) + cardW;
  const startX = (bandWidth - totalWidth) / 2;

  // The sweep grows with the hand but caps at ±15°, so a 24-card hand fans as
  // widely as a 7-card one instead of curling into a spiral.
  const totalSweep = Math.min(MAX_SWEEP_DEG, count * 4.6);
  const angleStep = totalSweep / (count - 1);
  const maxAngle = totalSweep / 2;

  const slots: FanSlot[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i - (count - 1) / 2) * angleStep;
    // Quadratic droop: the edges of a held fan hang lower than its middle.
    const droop = maxAngle > 0 ? DROOP_PX * (angle / maxAngle) ** 2 : 0;
    slots.push({ index: i, x: startX + i * pitch, angle, y: droop, z: i });
  }

  return {
    slots,
    pitch,
    totalWidth,
    // Commander really does produce 30-card hands, so this is a specified mode
    // rather than an unreachable branch.
    mode: count > MAX_FAN_CARDS ? 'list' : 'fan',
  };
}

/**
 * How far card `index` is displaced horizontally by a hover on `hovered`.
 *
 * `26·e^(−0.55·d)` px, signed away from the hovered card. The exponential is what
 * makes the parting look like the cards are being pushed rather than like the
 * whole hand shifting: the immediate neighbour moves 26 px, the next 15, then 8.6,
 * 5.0, 2.9 — visible for three cards and gone by the fifth.
 */
export function partOffset(index: number, hovered: number | null): number {
  if (hovered === null || index === hovered) return 0;
  const d = Math.abs(index - hovered);
  return Math.sign(index - hovered) * PART_AMPLITUDE * Math.exp(-PART_FALLOFF * d);
}

/** The full transform a hand slot should carry, hover included. */
export interface HandCardPose {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  z: number;
}

export function handCardPose(slot: FanSlot, hovered: number | null): HandCardPose {
  const isHovered = hovered === slot.index;
  return {
    x: slot.x + partOffset(slot.index, hovered),
    // The lift is on top of the droop, so a hovered edge card rises to the same
    // height as a hovered middle one.
    y: isHovered ? slot.y - HOVER_LIFT : slot.y,
    // Straightening the hovered card is what makes it readable: a card you are
    // looking at should not be at 15°.
    rotate: isHovered ? 0 : slot.angle,
    scale: isHovered ? HOVER_SCALE : 1,
    z: isHovered ? 1000 : slot.z,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
