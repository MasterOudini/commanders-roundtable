// The per-card script surface. **v1 ships zero scripts.**
//
// ⚠️ The property this file exists to guarantee: a script-less card is
// LITERALLY ZERO REGISTRATIONS. `registry.get(oracleId)` returns undefined,
// `derive()` runs L1/L7b/L7d only, the trigger bus iterates an empty candidate
// list, and `legalActions` offers only the intrinsic actions. Nothing in the
// engine branches on "is this card scripted" — the ABSENCE of registrations is
// the answer. That is what makes adding a script later a pure addition rather
// than a rewrite, and it is why the surface is defined now, while it costs
// nothing, instead of being retrofitted around whatever the first script needs.
//
// ⚠️ Scripts RETURN EVENTS. They are never handed a mutation API. A script is a
// pure function of (state, self, object) whose output is fully reproducible
// from the log, and `ctx.random` is backed by a scratch RNG the loop seeded
// from `state.rng` — so even a coin-flip card replays bit-exactly.

import type { ColorLetter } from '../../data/cardTypes';
import type { EventBody, EventKind } from '../types/events';
import type { AbilityRef, InstanceId, OracleId, PlayerId, ZoneKind } from '../types/ids';
import type { DerivedCharacteristics, Keyword, OracleDb, ParsedTypeLine, Protection } from '../types/oracle';
import type { GameOptions, GameState, StackObject } from '../types/state';

/** The mutable form a static ability edits. Copied out of `derive()`'s workspace. */
export interface MutableCharacteristics {
  name: string;
  typeLine: ParsedTypeLine;
  colors: ColorLetter[];
  power: number | null;
  toughness: number | null;
  loyalty: number | null;
  defense: number | null;
  keywords: Set<Keyword>;
  protection: Protection;
  landwalk: string[];
  /** `Toxic N`. Layer 6 can grant the keyword; this is the amount that came with it. */
  toxicAmount: number;
}

export type DeriveFn = (id: InstanceId) => DerivedCharacteristics;

export interface EngineQueries {
  /** Battlefield permanents controlled by a player, in board order. */
  permanentsOf(player: PlayerId): readonly InstanceId[];
  controllerOf(id: InstanceId): PlayerId | null;
  isOnBattlefield(id: InstanceId): boolean;
}

export interface ScriptCtx {
  readonly state: GameState;
  readonly oracle: OracleDb;
  readonly derive: DeriveFn;
  readonly options: GameOptions;
  /** Deterministic: seeded from state counters, never from a global. */
  readonly ids: { nextInstance(): InstanceId; nextStack(): string };
  readonly query: EngineQueries;
  /** The loop threads the resulting rngAfter onto the emitted event. */
  readonly random: { below(n: number): number; shuffled<T>(xs: readonly T[]): readonly T[] };
}

export interface TriggerDef {
  readonly abilityId: string;
  readonly text: string;
  /** Pre-indexed by the registry, so the bus is O(#candidates), not O(#permanents). */
  readonly event: EventKind;
  readonly activeZones: readonly ZoneKind[];
  readonly optional: boolean;
  matches(ctx: ScriptCtx, self: InstanceId, ev: EventBody): boolean;
  label(ctx: ScriptCtx, self: InstanceId, ev: EventBody): string;
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
}

export interface StaticDef {
  readonly abilityId: string;
  readonly text: string;
  readonly layer: 'type' | 'color' | 'ability' | 'cda' | 'ptSet' | 'ptModify' | 'ptSwitch';
  readonly activeZones: readonly ZoneKind[];
  appliesTo(ctx: ScriptCtx, self: InstanceId, candidate: InstanceId): boolean;
  modify(chars: MutableCharacteristics, ctx: ScriptCtx, self: InstanceId, candidate: InstanceId): void;
}

export interface ReplacementDef {
  readonly abilityId: string;
  readonly text: string;
  readonly activeZones: readonly ZoneKind[];
  applies(ctx: ScriptCtx, self: InstanceId, ev: EventBody): boolean;
  /** `[]` prevents the event entirely. Must not re-trigger itself. */
  replace(ctx: ScriptCtx, self: InstanceId, ev: EventBody): readonly EventBody[];
}

export interface ActivatedDef {
  readonly abilityId: string;
  readonly text: string;
  readonly ref: AbilityRef;
  readonly activeZones: readonly ZoneKind[];
  readonly isManaAbility: boolean;
  canActivate(ctx: ScriptCtx, self: InstanceId): boolean;
  resolve(ctx: ScriptCtx, self: InstanceId, obj: StackObject): readonly EventBody[];
}

export interface CardScript {
  readonly oracleId: OracleId;
  readonly name: string;
  readonly triggers?: readonly TriggerDef[];
  readonly statics?: readonly StaticDef[];
  readonly replacements?: readonly ReplacementDef[];
  readonly activated?: readonly ActivatedDef[];
}
