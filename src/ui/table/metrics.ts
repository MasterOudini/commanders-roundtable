// Table metrics — PURE. No DOM, no React. Unit-tested across 12 viewport ×
// seat-count combinations.
//
// ⚠️ WHY A JS SCALE FACTOR AND NOT `clamp()` / CONTAINER QUERIES.
// Card size drives the hand-fan geometry, the pile offsets, the row packing AND
// the flight layer's arc math — and the last of those is JavaScript that runs
// outside any element's layout context. A container query cannot feed
// `controlPoint()`. So one function computes every number, writes it to a store
// for JS AND stamps the same numbers as CSS custom properties for Tailwind
// arbitrary values. One source of truth, both worlds.
//
// ⚠️ AND WHY IT SOLVES FOR THE HOST'S REAL HEIGHT rather than the spec's 1080-px
// budget. The spec's vertical table (ui-animation-spec §3) assumes a 1920×1080
// FRAMELESS window. This app's window is not frameless — there is a native
// Windows title bar — and there is a 45 px app header above the table too, so the
// real host at "1080p maximised" is about 1003 px. Hard-coding 1080 would
// overflow by ~77 px and produce a page scrollbar, which is one of the things the
// layout battery explicitly forbids.

export type SeatCount = 2 | 3 | 4;

/** Printed card aspect ratio (63×88 mm ≈ Scryfall's 745×1040). */
export const CARD_ASPECT = 745 / 1040;

/** Card heights at scale 1, from ui-animation-spec §3. */
const IDEAL = {
  hand: 208,
  bf: 148,
  stack: 132,
  pile: 92,
  zoom: 620,
  /** 2-player is deliberately SYMMETRIC — that is what Arena does, and a bigger
   *  opponent than yourself reads worse than an equal one. */
  bfOpp: { 2: 148, 3: 132, 4: 116 } as Record<SeatCount, number>,
} as const;

/**
 * Hard floor for a card in a battlefield band or the hand. Below this the frame
 * is mostly border, `modeForHeight` switches to `chit`, and the board stops being
 * readable at a glance. The layout ladder gives up other things before this.
 */
export const MIN_BAND_CARD_H = 96;
/** A hand card must stay in `full` mode — it is the one you read most. */
export const MIN_HAND_CARD_H = 120;

/** Two rows: the five phases of a turn, and the twelve steps under them. */
const PHASE_H = 48;
const HEADER_H = 34;
/** Padding above+below a card inside its band. */
const BAND_PAD = 6;
const POD_INNER_GAP = 10;
const SECTION_GAP = 8;
export const ROW_GAP = 8;
/** Fraction of a hand card deliberately clipped below the viewport edge. */
const HAND_CLIP_MIN = 0.154;
const HAND_CLIP_MAX = 0.45;

/** Right rail: game log, manual tools (M3), phase detail. */
export const RAIL_W_EXPANDED = 272;
export const RAIL_W_COLLAPSED = 44;

export interface SeatBox {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TableMetrics {
  seatCount: SeatCount;
  hostW: number;
  hostH: number;
  /** Host width minus the right rail. */
  tableW: number;
  railW: number;
  railExpanded: boolean;

  cardH: { hand: number; bf: number; bfOpp: number; stack: number; pile: number; zoom: number };
  cardW: { hand: number; bf: number; bfOpp: number; stack: number; pile: number; zoom: number };

  /** How many battlefield bands each side shows. 1 = collapsed + expander. */
  oppBands: 1 | 2;
  myBands: 1 | 2;

  /** Row heights, top to bottom. They sum to ≤ hostH. */
  rows: { phase: number; oppStrip: number; middle: number; mySeat: number; hand: number };
  /** Opponent pod boxes, left to right, in table coordinates. */
  seats: SeatBox[];

  /** Uniform degrade factor actually applied. 1 = the full spec sizes fit. */
  scale: number;
  handClip: number;
  rowGap: number;
  /** Max horizontal pitch between hand cards. */
  fanPitchCap: number;
  /** Total required height at this configuration — for diagnostics. */
  requiredH: number;
  fits: boolean;
}

interface Config {
  oppBands: 1 | 2;
  myBands: 1 | 2;
  handClip: number;
}

/**
 * The resolution ladder, in order of what we are willing to give up.
 *
 * Cards never shrink below MIN_BAND_CARD_H, so when a viewport cannot hold the
 * scaled layout the deficit has to come from somewhere else. The order below is
 * a value judgement and worth stating: clip more of your own hand first (the top
 * of a hand card carries the name and cost, and the bottom carries nothing you
 * read), then fold the OPPONENTS' two bands into one with an expander, and only
 * as a last resort fold your own — your board is the one you act on every turn.
 */
const LADDER: Config[] = [
  { oppBands: 2, myBands: 2, handClip: HAND_CLIP_MIN },
  { oppBands: 2, myBands: 2, handClip: 0.3 },
  { oppBands: 1, myBands: 2, handClip: 0.3 },
  { oppBands: 1, myBands: 2, handClip: HAND_CLIP_MAX },
  { oppBands: 1, myBands: 1, handClip: HAND_CLIP_MAX },
];

function bandHeight(cardH: number): number {
  return cardH + BAND_PAD * 2;
}

function sideHeight(cardH: number, bands: 1 | 2): number {
  return HEADER_H + bands * bandHeight(cardH) + (bands - 1) * POD_INNER_GAP;
}

interface Solved {
  scale: number;
  cardH: TableMetrics['cardH'];
  rows: TableMetrics['rows'];
  requiredH: number;
}

function solveAt(scale: number, seatCount: SeatCount, cfg: Config): Solved {
  const hand = Math.round(IDEAL.hand * scale);
  const bf = Math.round(IDEAL.bf * scale);
  const bfOpp = Math.round(IDEAL.bfOpp[seatCount] * scale);
  const stack = Math.round(IDEAL.stack * scale);
  const pile = Math.round(IDEAL.pile * scale);

  const rows = {
    phase: PHASE_H,
    oppStrip: sideHeight(bfOpp, cfg.oppBands),
    middle: stack + 16,
    mySeat: sideHeight(bf, cfg.myBands),
    hand: Math.round(hand * (1 - cfg.handClip)),
  };
  const requiredH =
    rows.phase + rows.oppStrip + rows.middle + rows.mySeat + rows.hand + SECTION_GAP * 4;

  return {
    scale,
    cardH: { hand, bf, bfOpp, stack, pile, zoom: Math.round(IDEAL.zoom * Math.min(1, scale + 0.2)) },
    rows,
    requiredH,
  };
}

/** Does this solution respect the readability floors? */
function withinFloors(s: Solved): boolean {
  return (
    s.cardH.bf >= MIN_BAND_CARD_H &&
    s.cardH.bfOpp >= MIN_BAND_CARD_H &&
    s.cardH.hand >= MIN_HAND_CARD_H
  );
}

/**
 * Largest scale ≤ 1 that both fits `availH` and respects the floors.
 * Returns null when no scale in range can do both.
 */
function bestScale(availH: number, seatCount: SeatCount, cfg: Config): Solved | null {
  // Coarse-to-fine rather than a binary search: card heights are rounded to whole
  // pixels, so the fit predicate is a staircase and a bisection can land on a
  // step edge and report "no solution" one pixel from a valid one.
  let best: Solved | null = null;
  for (let i = 100; i >= 40; i--) {
    const s = solveAt(i / 100, seatCount, cfg);
    if (!withinFloors(s)) break; // floors only get worse as scale drops
    if (s.requiredH <= availH) {
      best = s;
      break;
    }
  }
  return best;
}

export function computeTableMetrics(opts: {
  hostW: number;
  hostH: number;
  seatCount: SeatCount;
  railExpanded?: boolean;
}): TableMetrics {
  const hostW = Math.max(320, Math.round(opts.hostW));
  const hostH = Math.max(240, Math.round(opts.hostH));
  const seatCount = opts.seatCount;
  const railExpanded = opts.railExpanded ?? true;
  const railW = railExpanded ? RAIL_W_EXPANDED : RAIL_W_COLLAPSED;
  const tableW = Math.max(320, hostW - railW);

  let chosen: Solved | null = null;
  let cfg: Config = LADDER[0]!;
  for (const candidate of LADDER) {
    const s = bestScale(hostH, seatCount, candidate);
    if (s) {
      chosen = s;
      cfg = candidate;
      break;
    }
  }

  // Nothing in the ladder fits. Take the most compact configuration at the floor
  // and report `fits: false`. ⚠️ The floors are NOT abandoned here: a card too
  // small to read is a worse outcome than a table that has to scroll internally,
  // and the alternative — silently rendering 70 px cards — is the kind of quiet
  // quality cut this project does not make.
  let fits = true;
  if (!chosen) {
    fits = false;
    cfg = LADDER[LADDER.length - 1]!;
    // The smallest scale that still respects every floor.
    let floorScale = 1;
    for (let i = 100; i >= 40; i--) {
      const s = solveAt(i / 100, seatCount, cfg);
      if (!withinFloors(s)) break;
      floorScale = i / 100;
    }
    chosen = solveAt(floorScale, seatCount, cfg);
  }

  const cardH = chosen.cardH;
  const w = (h: number) => Math.round(h * CARD_ASPECT);
  const cardW = {
    hand: w(cardH.hand),
    bf: w(cardH.bf),
    bfOpp: w(cardH.bfOpp),
    stack: w(cardH.stack),
    pile: w(cardH.pile),
    zoom: w(cardH.zoom),
  };

  const oppCount = seatCount - 1;
  const seats = layOutSeats(oppCount, tableW, chosen.rows.phase + SECTION_GAP, chosen.rows.oppStrip);

  return {
    seatCount,
    hostW,
    hostH,
    tableW,
    railW,
    railExpanded,
    cardH,
    cardW,
    oppBands: cfg.oppBands,
    myBands: cfg.myBands,
    rows: chosen.rows,
    seats,
    scale: chosen.scale,
    handClip: cfg.handClip,
    rowGap: ROW_GAP,
    // A hand card may overlap its neighbour, but never by more than 20% of its
    // width — past that the name strip of the covered card disappears.
    fanPitchCap: Math.round(cardW.hand * 0.8),
    requiredH: chosen.requiredH,
    fits,
  };
}

/**
 * Opponent pods, side by side, filling the table width.
 *
 * PURE and separate from `computeTableMetrics` because seat geometry is the one
 * piece of layout the flight layer reads directly (an attack lunge needs the
 * defending pod's centre), and it is the easiest thing to get subtly wrong.
 */
export function layOutSeats(
  oppCount: number,
  tableW: number,
  top: number,
  height: number,
  gap = SECTION_GAP,
): SeatBox[] {
  if (oppCount <= 0) return [];
  const totalGap = gap * (oppCount - 1);
  const width = Math.floor((tableW - totalGap) / oppCount);
  return Array.from({ length: oppCount }, (_, index) => ({
    index,
    left: index * (width + gap),
    top,
    width,
    height,
  }));
}

/** The CSS custom properties the table root carries, so Tailwind can use them. */
export function cssVarsFor(m: TableMetrics): Record<string, string> {
  return {
    '--card-h-hand': `${m.cardH.hand}px`,
    '--card-h-bf': `${m.cardH.bf}px`,
    '--card-h-bf-opp': `${m.cardH.bfOpp}px`,
    '--card-h-stack': `${m.cardH.stack}px`,
    '--card-h-pile': `${m.cardH.pile}px`,
    '--card-h-zoom': `${m.cardH.zoom}px`,
    '--card-w-hand': `${m.cardW.hand}px`,
    '--card-w-bf': `${m.cardW.bf}px`,
    '--card-w-bf-opp': `${m.cardW.bfOpp}px`,
    '--row-gap': `${m.rowGap}px`,
    '--table-w': `${m.tableW}px`,
    '--rail-w': `${m.railW}px`,
  };
}
