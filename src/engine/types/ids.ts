// Identifier aliases and the deterministic id allocator.
//
// ⚠️ Plain string aliases, deliberately NOT branded types. The spec sketched
// `Brand<string, 'InstanceId'>`, but `src/view/types.ts` — the M2 seam, which
// must not change — declares `InstanceId = string`, and a branded id would need
// a cast at every single boundary between the engine and the projection. The
// safety a brand buys is real but small here (all ids are opaque and never
// arithmetic), and paying for it in ~200 casts through the hottest, most
// safety-critical file in the app (`project.ts`) is a bad trade.
//
// ⚠️ Ids come from COUNTERS IN STATE, never from a global or a timestamp. That
// is what makes them reproducible under replay: the 41st card instance created
// in a replayed game is `c41`, exactly as it was live.

export type PlayerId = string;
export type InstanceId = string;
export type StackId = string;
/** Scryfall oracle id — the identity of a *card*, shared by all its printings. */
export type OracleId = string;
/** Scryfall id — the identity of one *printing*. Decides which art is shown. */
export type PrintingId = string;
/**
 * Stable across printings, which is the point. Two producers, two suffixes:
 * an ACTIVATED ability is `${oracleId}#a${abilityIndex}` (handlers.ts, and the
 * `ref` an `ActivatedDef` must carry), a TRIGGERED one is
 * `${oracleId}#${abilityId}` (triggers.ts, the def's own id) — which is why a
 * trigger's `abilityId` may never match /^a\d+$/ (D158/D159).
 */
export type AbilityRef = string;

export type ZoneKind =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'
  | 'stack';

/** `player` is null only for the stack and the (shared) battlefield array. */
export interface ZoneRef {
  readonly kind: ZoneKind;
  readonly player: PlayerId | null;
}

export function zoneRef(kind: ZoneKind, player: PlayerId | null): ZoneRef {
  return { kind, player };
}

export function sameZone(a: ZoneRef, b: ZoneRef): boolean {
  return a.kind === b.kind && a.player === b.player;
}

/** The counters that make id allocation deterministic. Lives in `GameState`. */
export interface IdCounters {
  readonly instance: number;
  readonly stack: number;
  readonly logLine: number;
}

export const EMPTY_COUNTERS: IdCounters = { instance: 0, stack: 0, logLine: 0 };

export function instanceIdAt(n: number): InstanceId {
  return `c${n}`;
}

export function stackIdAt(n: number): StackId {
  return `s${n}`;
}

/**
 * Allocate `count` instance ids from the counters, returning the ids and the
 * advanced counters. Callers never touch `counters.instance` directly, so a
 * handler cannot silently skip an id and desync a replay.
 */
export function allocInstanceIds(
  counters: IdCounters,
  count: number,
): { ids: InstanceId[]; counters: IdCounters } {
  const ids: InstanceId[] = [];
  for (let i = 0; i < count; i++) ids.push(instanceIdAt(counters.instance + i + 1));
  return { ids, counters: { ...counters, instance: counters.instance + count } };
}

export function allocStackId(counters: IdCounters): { id: StackId; counters: IdCounters } {
  const next = counters.stack + 1;
  return { id: stackIdAt(next), counters: { ...counters, stack: next } };
}
