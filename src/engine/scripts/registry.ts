// The script registry, pre-indexed so the trigger bus never scans the board.
//
// ⚠️ `EMPTY_REGISTRY` is what v1 ships. Every method on it returns an empty
// array or undefined, which is exactly what makes the rest of the engine work
// with no `if (scripted)` anywhere.

import type { CardScript, ReplacementDef, StaticDef, TriggerDef } from './api';
import type { EventKind } from '../types/events';
import type { OracleId } from '../types/ids';

export interface ScriptRegistry {
  get(oracleId: OracleId): CardScript | undefined;
  /**
   * Triggers that could fire on this event kind.
   *
   * Indexed by `TriggerDef.event` so the cost is O(#candidate triggers) rather
   * than O(#permanents × #triggers). With 84 permanents on a 4-player board and
   * an event fired for every damage mark, the difference is the difference
   * between a combat step and a frame drop.
   */
  triggersFor(event: EventKind): readonly { readonly script: CardScript; readonly def: TriggerDef }[];
  staticsFor(layer: StaticDef['layer']): readonly { readonly script: CardScript; readonly def: StaticDef }[];
  replacements(): readonly { readonly script: CardScript; readonly def: ReplacementDef }[];
  readonly size: number;
}

class IndexedRegistry implements ScriptRegistry {
  private readonly byOracle = new Map<OracleId, CardScript>();
  private readonly byEvent = new Map<EventKind, { script: CardScript; def: TriggerDef }[]>();
  private readonly byLayer = new Map<StaticDef['layer'], { script: CardScript; def: StaticDef }[]>();
  private readonly reps: { script: CardScript; def: ReplacementDef }[] = [];

  constructor(scripts: readonly CardScript[]) {
    for (const script of scripts) {
      this.byOracle.set(script.oracleId, script);
      for (const def of script.triggers ?? []) {
        const list = this.byEvent.get(def.event) ?? [];
        list.push({ script, def });
        this.byEvent.set(def.event, list);
      }
      for (const def of script.statics ?? []) {
        const list = this.byLayer.get(def.layer) ?? [];
        list.push({ script, def });
        this.byLayer.set(def.layer, list);
      }
      for (const def of script.replacements ?? []) this.reps.push({ script, def });
    }
  }

  get(oracleId: OracleId): CardScript | undefined {
    return this.byOracle.get(oracleId);
  }

  triggersFor(event: EventKind): readonly { readonly script: CardScript; readonly def: TriggerDef }[] {
    return this.byEvent.get(event) ?? EMPTY_LIST;
  }

  staticsFor(layer: StaticDef['layer']): readonly { readonly script: CardScript; readonly def: StaticDef }[] {
    return this.byLayer.get(layer) ?? EMPTY_LIST;
  }

  replacements(): readonly { readonly script: CardScript; readonly def: ReplacementDef }[] {
    return this.reps;
  }

  get size(): number {
    return this.byOracle.size;
  }
}

/** Shared, so an empty lookup allocates nothing on a hot path. */
const EMPTY_LIST: readonly never[] = [];

export function createRegistry(scripts: readonly CardScript[]): ScriptRegistry {
  return new IndexedRegistry(scripts);
}

/** What v1 ships. Every card is Tier 3 unless a script says otherwise. */
export const EMPTY_REGISTRY: ScriptRegistry = new IndexedRegistry([]);
