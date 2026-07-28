// The FX emitter surface. A tiny bus so beats can request particles without
// knowing whether a canvas is mounted.
//
// ⚠️ Emitting with no canvas attached is a silent no-op, deliberately. Beats run on
// the table screen, on the #beats dev screen, and (in digest mode) not at all; a
// beat that threw or warned because the FX layer happened not to be mounted would
// turn a cosmetic absence into a broken queue. The canvas is decoration; the beat
// is the contract.

export interface BurstSpec {
  x: number;
  y: number;
  /** Number of particles. Clamped by the pool. */
  count: number;
  /** px/s. */
  speedMin: number;
  speedMax: number;
  /** ms. */
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
  /** OKLCH hue angle, matched to the card's colour identity. */
  hue: number;
  /** Restrict the emission to a cone, in radians. Omit for a full circle. */
  direction?: number;
  spread?: number;
  /** px/s² downward. Dust falls; sparks do not. */
  gravity?: number;
}

export interface RingSpec {
  x: number;
  y: number;
  fromRadius: number;
  toRadius: number;
  durationMs: number;
  hue: number;
}

export interface FxSink {
  burst(spec: BurstSpec): void;
  ring(spec: RingSpec): void;
  stats(): { active: number; rafHandle: number | null; dpr: number; w: number; h: number };
  clear(): void;
}

let sink: FxSink | null = null;

export function attachFx(next: FxSink | null): void {
  sink = next;
}

export function burst(spec: BurstSpec): void {
  sink?.burst(spec);
}

export function ring(spec: RingSpec): void {
  sink?.ring(spec);
}

export function fxStats(): { active: number; rafHandle: number | null; dpr: number; w: number; h: number } {
  return sink?.stats() ?? { active: 0, rafHandle: null, dpr: 0, w: 0, h: 0 };
}

export function fxClear(): void {
  sink?.clear();
}

export function fxAttached(): boolean {
  return sink !== null;
}

/** OKLCH hue angles matching the five colours in index.css, for particle tinting. */
export const HUE = {
  w: 92,
  u: 245,
  b: 300,
  r: 32,
  g: 148,
  c: 250,
  m: 85,
  /** Brass, for accent bursts that must not read as a colour of mana. */
  accent: 78,
  danger: 24,
  cmd: 300,
  /** Warm dust, for a land entering. */
  dust: 40,
} as const;

export function hueForIdentity(identity: readonly string[]): number {
  if (identity.length === 0) return HUE.c;
  if (identity.length > 1) return HUE.m;
  const letter = identity[0]!.toLowerCase() as keyof typeof HUE;
  return HUE[letter] ?? HUE.c;
}
