// D335 - THE LIGHT HALF OF THE REGISTRY: the interface, the indexed class,
// `createRegistry` and `NO_SCRIPTS`, with no card imports. registry.ts holds
// the shipped list and re-exports these, so importing THIS module builds a
// registry for a test or a game without loading the whole library - the cost
// that made every isolated card suite pay for all 4,000 cards.

import type { CardScript, CombatDef, ReplacementDef, SpellDef, StaticDef, TriggerDef } from './api';
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
  /** Continuous combat restrictions, CR 508.1c / 509.1b. */
  combat(): readonly { readonly script: CardScript; readonly def: CombatDef }[];
  /** Whole-spell resolution for a resolving instant or sorcery. See `SpellDef`. */
  spell(oracleId: OracleId): SpellDef | undefined;
  readonly size: number;
}

class IndexedRegistry implements ScriptRegistry {
  private readonly byOracle = new Map<OracleId, CardScript>();
  private readonly byEvent = new Map<EventKind, { script: CardScript; def: TriggerDef }[]>();
  private readonly byLayer = new Map<StaticDef['layer'], { script: CardScript; def: StaticDef }[]>();
  private readonly reps: { script: CardScript; def: ReplacementDef }[] = [];
  private readonly combats: { script: CardScript; def: CombatDef }[] = [];
  private readonly spells = new Map<OracleId, SpellDef>();

  constructor(scripts: readonly CardScript[]) {
    for (const script of scripts) {
      // ⚠️ A DUPLICATE ORACLE ID IS A CORRUPTED REGISTRY, NOT LAST-WRITE-WINS.
      // `byOracle.set` would keep only the second script while every per-def
      // index below APPENDS — so a twice-registered card DOUBLE-FIRES its
      // triggers while `get()` reports only one of them. Harmless while the
      // list is hand-curated; near-certain once generated family tables
      // produce membership. Refuse loudly at construction.
      if (this.byOracle.has(script.oracleId)) {
        throw new Error(
          `duplicate script for oracleId ${script.oracleId} (${script.name}) — ` +
            'a second registration would double-fire its defs. Remove one.',
        );
      }
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
      for (const def of script.combat ?? []) this.combats.push({ script, def });
      if (script.spell) this.spells.set(script.oracleId, script.spell);
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

  combat(): readonly { readonly script: CardScript; readonly def: CombatDef }[] {
    return this.combats;
  }

  spell(oracleId: OracleId): SpellDef | undefined {
    return this.spells.get(oracleId);
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

/**
 * **A REGISTRY WITH NO SCRIPTS, FOREVER** — for a test that wants the engine's
 * script-less behaviour. ⚠️ The HOST does NOT default to this — it defaults to
 * `SHIPPED_REGISTRY`, because omitting `HostOptions.scripts` has to mean
 * "whatever the app ships" and not "nothing", or landing a script would change
 * the library and not the game.
 *
 * ⚠️ Built from a literal `[]`, never from `SHIPPED_SCRIPTS`. That is the whole
 * distinction from `SHIPPED_REGISTRY` above and the reason both exist: a test
 * asserting "a script-less card is zero registrations" must keep asserting it
 * when the app ships a thousand scripts.
 */
export const NO_SCRIPTS: ScriptRegistry = new IndexedRegistry([]);
