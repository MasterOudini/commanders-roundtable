// The script registry, pre-indexed so the trigger bus never scans the board.
//
// ⚠️ `SHIPPED_REGISTRY` is what v1 ships. Every method on it returns an empty
// array or undefined, which is exactly what makes the rest of the engine work
// with no `if (scripted)` anywhere.

import type { CardScript, CombatDef, ReplacementDef, StaticDef, TriggerDef } from './api';
import type { EventKind } from '../types/events';
import type { OracleId } from '../types/ids';
import { TALRAND_SKY_SUMMONER_SCRIPT } from './cards/talrandSkySummoner';
import { YOTIAN_DISSIDENT_SCRIPT } from './cards/yotianDissident';
import { AIM_LABS_SCRIPT } from './cards/aimLabs';
import { ABZAN_BANNER_SCRIPT } from './cards/abzanBanner';
import { ACOLYTE_OF_XATHRID_SCRIPT } from './cards/acolyteOfXathrid';
import { ADUN_OAKENSHIELD_SCRIPT } from './cards/adunOakenshield';
import { AETHER_ADEPT_SCRIPT } from './cards/aetherAdept';
import { AFFA_GUARD_HOUND_SCRIPT } from './cards/affaGuardHound';
import { AGENTS_OF_HYDRA_SCRIPT } from './cards/agentsOfHydra';
import { AIRSHIP_ENGINE_ROOM_SCRIPT } from './cards/airshipEngineRoom';
import { AJANIS_WELCOME_SCRIPT } from './cards/ajanisWelcome';
import { AKOUM_REFUGE_SCRIPT } from './cards/akoumRefuge';
import { AKROAN_JAILER_SCRIPT } from './cards/akroanJailer';
import { AKROAN_MASTIFF_SCRIPT } from './cards/akroanMastiff';
import { ALADDINS_RING_SCRIPT } from './cards/aladdinsRing';
import { ALCHEMISTS_APPRENTICE_SCRIPT } from './cards/alchemistsApprentice';
import { AMATEUR_HERO_SCRIPT } from './cards/amateurHero';
import { AMBASSADOR_OAK_SCRIPT } from './cards/ambassadorOak';
import { AMBUSH_GIGAPEDE_SCRIPT } from './cards/ambushGigapede';
import { ARCANE_ENCYCLOPEDIA_SCRIPT } from './cards/arcaneEncyclopedia';
import { DESERTED_TEMPLE_SCRIPT } from './cards/desertedTemple';
import { HEDRON_ARCHIVE_SCRIPT } from './cards/hedronArchive';
import { WAR_ROOM_SCRIPT } from './cards/warRoom';
import { SOUL_WARDEN_SCRIPT } from './cards/soulWarden';
import { ESSENCE_WARDEN_SCRIPT } from './cards/essenceWarden';
import { RADIANT_FOUNTAIN_SCRIPT } from './cards/radiantFountain';
import { ADVENTURERS_INN_SCRIPT } from './cards/adventurersInn';
import { WALL_OF_BLOSSOMS_SCRIPT } from './cards/wallOfBlossoms';
import { WALL_OF_OMENS_SCRIPT } from './cards/wallOfOmens';
import { BALEFUL_STRIX_SCRIPT } from './cards/balefulStrix';
import { ONULET_SCRIPT } from './cards/onulet';

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
  readonly size: number;
}

class IndexedRegistry implements ScriptRegistry {
  private readonly byOracle = new Map<OracleId, CardScript>();
  private readonly byEvent = new Map<EventKind, { script: CardScript; def: TriggerDef }[]>();
  private readonly byLayer = new Map<StaticDef['layer'], { script: CardScript; def: StaticDef }[]>();
  private readonly reps: { script: CardScript; def: ReplacementDef }[] = [];
  private readonly combats: { script: CardScript; def: CombatDef }[] = [];

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
      for (const def of script.combat ?? []) this.combats.push({ script, def });
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
 * **THE CARD SCRIPTS THE APP SHIPS.** Empty today; M6.4 fills it.
 *
 * ⚠️ **A NAMED LIST, NOT AN INLINE `[]`, AND THAT IS THE WHOLE POINT.** Adding a
 * script here has an accounting obligation that until D147 lived only in
 * comments: the moment a card's script runs, that card's `tier3.ts` note must go
 * silent and `engineComplete` must accept it, in the same commit
 * (M6.4-LIBRARY-SPEC §6.5). Otherwise the app runs a card while telling the
 * player it will not — or, worse, runs PART of one silently, which is D90's rule
 * and D122's measured failure in the other direction, where 16,020 cards said
 * nothing at all and silence in this app means "handled".
 *
 * `shippedScripts.node.test.ts` asserts exactly that, over this list, against
 * the real card database. With the list empty the assertion is vacuous — so the
 * same file proves the check has TEETH by running it over the test registry,
 * whose scripts deliberately violate it.
 */
export const SHIPPED_SCRIPTS: readonly CardScript[] = [
  TALRAND_SKY_SUMMONER_SCRIPT,
  YOTIAN_DISSIDENT_SCRIPT,
  AIM_LABS_SCRIPT,
  ABZAN_BANNER_SCRIPT,
  ACOLYTE_OF_XATHRID_SCRIPT,
  ADUN_OAKENSHIELD_SCRIPT,
  AETHER_ADEPT_SCRIPT,
  AFFA_GUARD_HOUND_SCRIPT,
  AGENTS_OF_HYDRA_SCRIPT,
  AIRSHIP_ENGINE_ROOM_SCRIPT,
  AJANIS_WELCOME_SCRIPT,
  AKOUM_REFUGE_SCRIPT,
  AKROAN_JAILER_SCRIPT,
  AKROAN_MASTIFF_SCRIPT,
  ALADDINS_RING_SCRIPT,
  ALCHEMISTS_APPRENTICE_SCRIPT,
  AMATEUR_HERO_SCRIPT,
  AMBASSADOR_OAK_SCRIPT,
  AMBUSH_GIGAPEDE_SCRIPT,
  ARCANE_ENCYCLOPEDIA_SCRIPT,
  DESERTED_TEMPLE_SCRIPT,
  HEDRON_ARCHIVE_SCRIPT,
  WAR_ROOM_SCRIPT,
  SOUL_WARDEN_SCRIPT,
  ESSENCE_WARDEN_SCRIPT,
  RADIANT_FOUNTAIN_SCRIPT,
  ADVENTURERS_INN_SCRIPT,
  WALL_OF_BLOSSOMS_SCRIPT,
  WALL_OF_OMENS_SCRIPT,
  BALEFUL_STRIX_SCRIPT,
  ONULET_SCRIPT,
];

/**
 * **WHAT THE APP SHIPS** — `SHIPPED_SCRIPTS`, indexed. Every card is Tier 3
 * unless a script here says otherwise.
 *
 * ⚠️⚠️ **THIS WAS CALLED `EMPTY_REGISTRY` UNTIL D156, AND THE NAME WAS A TRAP
 * WITH A FUSE ON IT.** It is built FROM `SHIPPED_SCRIPTS`, so the constant named
 * "empty" stops being empty the moment M6.4 lands its first script — and it was
 * used for two different things across 46 references in 20 files. Product code
 * meant "what ships"; **eight test files meant "a registry with no scripts at
 * all"**, and those would have silently started running card scripts, changing
 * what they were testing without changing a line of their own source.
 *
 * The split is the fix, and it had to happen BEFORE the first script lands
 * rather than after: `NO_SCRIPTS` is genuinely empty and always will be.
 */
export const SHIPPED_REGISTRY: ScriptRegistry = new IndexedRegistry(SHIPPED_SCRIPTS);

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
