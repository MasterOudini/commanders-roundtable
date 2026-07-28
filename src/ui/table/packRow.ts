// Battlefield grouping and row packing — PURE. Unit-tested.
//
// ⚠️ BATTLEFIELD ROWS NEVER OVERLAP. Arena does not overlap them either; it
// overlaps only the hand. A horizontal overlap hides the RIGHT edge of the
// covered card, which is exactly where the power/toughness badge lives — so an
// overlapping board costs you the one number you check most.
//
// That constraint is what makes auto-stacking load-bearing rather than a nicety.
// At 4 players a pod's inner row is ~510 px wide and an opponent card is 83 px, so
// a row holds FIVE cards. A real Commander board is 10 lands, 6 other
// noncreatures and 5 creatures. Without collapsing "12 Forests" into one
// `Forest ×12` pile, a 4-player board simply does not fit at 1080p — see D19.

import type { CardView, InstanceId, SupportCluster } from '../../view/types';

export interface PackItem {
  /** The card drawn on top. */
  instanceId: InstanceId;
  /** Every instance in this stack, including the top one. Length 1 when unstacked. */
  members: InstanceId[];
  /** How many of `members` are untapped, for the `7/12 untapped` sub-badge. */
  untapped: number;
  /**
   * Is this slot turned sideways? A pile is uniform in tap state by construction
   * — it is part of the grouping key — so one flag covers all of its members.
   *
   * ⚠️ A LAYOUT INPUT, not decoration. A tapped card is a full quarter turn, so
   * its footprint is the card's HEIGHT wide. Reserving only its width lands it on
   * top of its neighbour, and the one thing a battlefield row may never do is
   * overlap: the covered edge is exactly where the power/toughness badge lives.
   */
  tapped: boolean;
  /** Attachments tucked under the host; they grow the slot's height. */
  attachments: InstanceId[];
  cluster: SupportCluster;
}

export interface PackedCard extends PackItem {
  /** Left offset within the row, in px. */
  x: number;
  /** Extra height this slot needs for its attachment stack. */
  extraH: number;
  /**
   * The box this slot actually occupies on screen — the TURNED box when tapped,
   * anchored at the same top-left corner the untapped card would have used.
   *
   * ⚠️ Renderers must take these from here, like `cardH`/`cardW`, rather than
   * deriving them again from the height and the aspect ratio. Two roundings of
   * the same number are not the same number — see the note on `cardH`.
   */
  footprintW: number;
  footprintH: number;
}

export interface PackedRow {
  cards: PackedCard[];
  /** Uniform scale applied to card size, ∈ [0.83, 1]. */
  scale: number;
  /**
   * The EXACT rendered pixel size every card in this row must use.
   *
   * ⚠️ Renderers must use these, not `round(cardH * scale)` of their own. The
   * layout maths and the rendered element have to agree to the pixel: spacing
   * cards by `cardW * scale` while the component rounded the height and re-derived
   * the width from the aspect ratio put the last card in a row 2.7 px past its
   * band's right edge at 1440×900 with 3 seats. Two roundings of the same number
   * are not the same number.
   */
  cardH: number;
  cardW: number;
  /** Cards past the visible edge, reachable by scrolling. */
  overflow: number;
  /** Total laid-out width, for centring. */
  width: number;
  /** True when the row had to become horizontally scrollable. */
  scrolls: boolean;
}

/** The exact pixel size a card renders at, for a given band size and scale. */
function renderedSize(cardH: number, scale: number): { h: number; w: number } {
  const h = Math.max(1, Math.round(cardH * scale));
  return { h, w: Math.round(h * (745 / 1040)) };
}

/** Auto-stack floor: never squeeze a card below 83% or it stops matching its band. */
const MIN_ROW_SCALE = 0.83;
/** Attachment offset per tucked card, and how many are visible before a +N chip. */
export const ATTACH_OFFSET_Y = 13;
export const ATTACH_MAX_VISIBLE = 3;

/**
 * Group identical permanents into one pile.
 *
 * "Identical" is deliberately strict: same oracle id, same tapped state, same
 * counters, no attachments, same summoning sickness. Two Forests where one is
 * tapped are NOT identical, because collapsing them would hide the fact that you
 * have one untapped land left — which is a decision-relevant difference, not a
 * cosmetic one. A pile shows `7/12 untapped` for the same reason.
 */
export function groupIdentical(
  cards: CardView[],
  attachmentsOf: (id: InstanceId) => InstanceId[],
  enabled = true,
): PackItem[] {
  const items: PackItem[] = [];
  const byKey = new Map<string, PackItem>();

  for (const c of cards) {
    const attachments = attachmentsOf(c.instanceId);
    const cluster = clusterOf(c);
    const item: PackItem = {
      instanceId: c.instanceId,
      members: [c.instanceId],
      untapped: c.tapped ? 0 : 1,
      tapped: c.tapped,
      attachments,
      cluster,
    };

    if (!enabled || attachments.length > 0 || c.card === null) {
      items.push(item);
      continue;
    }

    const counters = Object.entries(c.counters)
      .filter(([, n]) => n !== 0)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, n]) => `${k}=${n}`)
      .join(',');
    const key = [
      c.card.oracleId,
      c.faceDown ? 'fd' : c.faceIndex,
      c.tapped ? 't' : 'u',
      c.summoningSick ? 's' : '-',
      c.damage,
      counters,
      c.attacking ?? '-',
      c.blocking ?? '-',
    ].join('|');

    const existing = byKey.get(key);
    if (existing) {
      existing.members.push(c.instanceId);
      if (!c.tapped) existing.untapped++;
    } else {
      byKey.set(key, item);
      items.push(item);
    }
  }

  return items;
}

function clusterOf(c: CardView): SupportCluster {
  const type = (c.card?.faces[c.faceIndex] ?? c.card?.faces[0])?.typeLine ?? '';
  if (/\bLand\b/.test(type)) return 'land';
  if (/\bEnchantment\b/.test(type)) return 'enchantment';
  return 'artifact';
}

/**
 * Lay out one row. The resolution ladder, applied in order:
 *
 *  1. Natural fit — pitch = cardW + gap, centred.
 *  2. (Auto-stacking has already happened, in `groupIdentical`.)
 *  3. Uniform shrink, scale ∈ [0.83, 1], floored so height ≥ minCardH.
 *  4. Horizontal scroll with a persistent `+N` chip.
 *
 * Step 4 is reached only by a genuinely enormous pod; the honest answer there is
 * the pod expander (click the header → full-width overlay), which is a feature
 * rather than a fallback.
 */
export function packRow(
  items: PackItem[],
  opts: {
    rowWidth: number;
    cardW: number;
    cardH: number;
    gap: number;
    minCardH: number;
    /** Extra gap between support clusters (lands | artifacts | enchantments). */
    clusterGap?: number;
  },
): PackedRow {
  const { rowWidth, cardW, cardH, gap, minCardH } = opts;
  const clusterGap = opts.clusterGap ?? 0;

  if (items.length === 0) {
    const zero = renderedSize(cardH, 1);
    return {
      cards: [],
      scale: 1,
      cardH: zero.h,
      cardW: zero.w,
      overflow: 0,
      width: 0,
      scrolls: false,
    };
  }

  const clusterBreaks = clusterGap > 0 ? countClusterBreaks(items) : 0;
  const fixed = (items.length - 1) * gap + clusterBreaks * clusterGap;
  /**
   * How wide this slot is on screen. A tapped card is turned a quarter turn to
   * the right, so it is as wide as a card is TALL — the row has to carry that
   * cost, because the alternative is a tapped land lying across its neighbour.
   */
  const footprint = (item: PackItem, size: { h: number; w: number }): number =>
    item.tapped ? size.h : size.w;
  /** Width of the whole row at a given scale, using the EXACT rendered sizes. */
  const widthAt = (scale: number) => {
    const size = renderedSize(cardH, scale);
    let sum = fixed;
    for (const item of items) sum += footprint(item, size);
    return sum;
  };

  // The smallest scale allowed by BOTH the 0.83 uniform-shrink floor and the
  // absolute minimum readable card height.
  const heightFloor = cardH > 0 ? minCardH / cardH : 1;
  const floor = Math.max(MIN_ROW_SCALE, Math.min(1, heightFloor));

  let scale = 1;
  if (widthAt(1) > rowWidth) {
    // Analytic estimate first, then step down until the EXACT rounded layout
    // fits. The step-down loop is what makes the result consistent with the
    // renderer: solving the continuous equation lands within a pixel, and a pixel
    // is the difference between fitting a band and overflowing it.
    let unscaled = 0;
    for (const item of items) unscaled += item.tapped ? cardH : cardW;
    const ideal = unscaled > 0 ? (rowWidth - fixed) / unscaled : 1;
    scale = Math.max(floor, Math.min(1, ideal));
    for (let i = 0; i < 60 && scale > floor && widthAt(scale) > rowWidth; i++) {
      scale = Math.max(floor, scale - 0.005);
    }
  }

  const rendered = renderedSize(cardH, scale);
  const total = widthAt(scale);
  const scrolls = total > rowWidth + 0.5;
  // A scrolling row starts at its left edge; a fitting row is centred, which is
  // what makes a 3-permanent board look deliberate instead of abandoned.
  let x = scrolls ? 0 : Math.max(0, (rowWidth - total) / 2);

  const cards: PackedCard[] = [];
  let prevCluster: SupportCluster | null = null;
  let overflow = 0;

  for (const item of items) {
    if (clusterGap > 0 && prevCluster !== null && item.cluster !== prevCluster) {
      x += clusterGap;
    }
    prevCluster = item.cluster;
    const fw = footprint(item, rendered);
    if (x + fw > rowWidth + 0.5) overflow++;
    cards.push({
      ...item,
      x,
      extraH: ATTACH_OFFSET_Y * Math.min(item.attachments.length, ATTACH_MAX_VISIBLE),
      footprintW: fw,
      // A turned card is as tall as a card is WIDE. It keeps the row's top edge,
      // so a row of half-tapped lands still reads as one line rather than as two.
      footprintH: item.tapped ? rendered.w : rendered.h,
    });
    x += fw + gap;
  }

  return {
    cards,
    scale,
    cardH: rendered.h,
    cardW: rendered.w,
    overflow,
    width: total,
    scrolls,
  };
}

function countClusterBreaks(items: PackItem[]): number {
  let breaks = 0;
  for (let i = 1; i < items.length; i++) {
    if (items[i]!.cluster !== items[i - 1]!.cluster) breaks++;
  }
  return breaks;
}

/** Support-band cluster order, left to right: lands are most numerous and most stacked. */
const CLUSTER_ORDER: Record<SupportCluster, number> = { land: 0, artifact: 1, enchantment: 2 };

export function sortByCluster(items: PackItem[]): PackItem[] {
  return [...items].sort((a, b) => CLUSTER_ORDER[a.cluster] - CLUSTER_ORDER[b.cluster]);
}
