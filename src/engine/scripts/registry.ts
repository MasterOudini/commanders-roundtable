// The script registry, pre-indexed so the trigger bus never scans the board.
//
// ⚠️ `SHIPPED_REGISTRY` is what v1 ships. Every method on it returns an empty
// array or undefined, which is exactly what makes the rest of the engine work
// with no `if (scripted)` anywhere.

import type { CardScript, CombatDef, ReplacementDef, StaticDef, TriggerDef } from './api';
import type { EventKind } from '../types/events';
import type { OracleId } from '../types/ids';
import { BRIARPACK_ALPHA_SCRIPT } from './cards/briarpackAlpha';
import { BRINDLE_BOAR_SCRIPT } from './cards/brindleBoar';
import { BRINDLE_SHOAT_SCRIPT } from './cards/brindleShoat';
import { BRINEBARROW_INTRUDER_SCRIPT } from './cards/brinebarrowIntruder';
import { BROOD_WEAVER_SCRIPT } from './cards/broodWeaver';
import { BROODMATE_DRAGON_SCRIPT } from './cards/broodmateDragon';
import { BULWARK_GIANT_SCRIPT } from './cards/bulwarkGiant';
import { BURRENTON_SHIELD_BEARERS_SCRIPT } from './cards/burrentonShieldBearers';
import { BURROG_BEFUDDLER_SCRIPT } from './cards/burrogBefuddler';
import { BUZZ_BOTS_SCRIPT } from './cards/buzzBots';
import { CABAL_TRAINEE_SCRIPT } from './cards/cabalTrainee';
import { CACKLING_IMP_SCRIPT } from './cards/cacklingImp';
import { CAPASHEN_UNICORN_SCRIPT } from './cards/capashenUnicorn';
import { CAPTIVE_FLAME_SCRIPT } from './cards/captiveFlame';
import { CARTOGRAPHERS_COMPANION_SCRIPT } from './cards/cartographersCompanion';
import { CARVEN_CARYATID_SCRIPT } from './cards/carvenCaryatid';
import { CASTLE_ARDENVALE_SCRIPT } from './cards/castleArdenvale';
import { CAT_OWL_SCRIPT } from './cards/catOwl';
import { CATHAR_COMMANDO_SCRIPT } from './cards/catharCommando';
import { CATHEDRAL_SANCTIFIER_SCRIPT } from './cards/cathedralSanctifier';
import { CAUSTIC_CATERPILLAR_SCRIPT } from './cards/causticCaterpillar';
import { BLOOD_SERVITOR_SCRIPT } from './cards/bloodServitor';
import { BLOODFELL_CAVES_SCRIPT } from './cards/bloodfellCaves';
import { BLOODTALLOW_CANDLE_SCRIPT } from './cards/bloodtallowCandle';
import { BLOSSOM_DRYAD_SCRIPT } from './cards/blossomDryad';
import { BLOSSOMING_SANDS_SCRIPT } from './cards/blossomingSands';
import { BOGARDAN_RAGER_SCRIPT } from './cards/bogardanRager';
import { BOGWATER_LUMARET_SCRIPT } from './cards/bogwaterLumaret';
import { BOILING_ROCK_PRISON_SCRIPT } from './cards/boilingRockPrison';
import { BOLTWING_MARAUDER_SCRIPT } from './cards/boltwingMarauder';
import { BOND_BEETLE_SCRIPT } from './cards/bondBeetle';
import { BONE_PIT_BRUTE_SCRIPT } from './cards/bonePitBrute';
import { BOOK_OF_RASS_SCRIPT } from './cards/bookOfRass';
import { BOROS_CLUESTONE_SCRIPT } from './cards/borosCluestone';
import { BOROS_LOCKET_SCRIPT } from './cards/borosLocket';
import { BOTANICAL_PLAZA_SCRIPT } from './cards/botanicalPlaza';
import { BOTTLE_GNOMES_SCRIPT } from './cards/bottleGnomes';
import { BRAIDWOOD_CUP_SCRIPT } from './cards/braidwoodCup';
import { BRAMBLE_ELEMENTAL_SCRIPT } from './cards/brambleElemental';
import { BRANDYWINE_FARMER_SCRIPT } from './cards/brandywineFarmer';
import { BRASS_SECRETARY_SCRIPT } from './cards/brassSecretary';
import { BRAZEN_FREEBOOTER_SCRIPT } from './cards/brazenFreebooter';
import { BRIARKNIT_KAMI_SCRIPT } from './cards/briarknitKami';
import { BARBARIAN_RIFTCUTTER_SCRIPT } from './cards/barbarianRiftcutter';
import { BARTERED_COW_SCRIPT } from './cards/barteredCow';
import { BEAMSAW_PROSPECTOR_SCRIPT } from './cards/beamsawProspector';
import { BEARS_COMPANION_SCRIPT } from './cards/bearsCompanion';
import { BEAST_WHISPERER_SCRIPT } from './cards/beastWhisperer';
import { BEETLEBACK_CHIEF_SCRIPT } from './cards/beetlebackChief';
import { BELLIGERENT_GUEST_SCRIPT } from './cards/belligerentGuest';
import { BENALISH_HERALDS_SCRIPT } from './cards/benalishHeralds';
import { BENALISH_TRAPPER_SCRIPT } from './cards/benalishTrapper';
import { BESKIR_SHIELDMATE_SCRIPT } from './cards/beskirShieldmate';
import { BIGFIN_BOUNCER_SCRIPT } from './cards/bigfinBouncer';
import { BILE_URCHIN_SCRIPT } from './cards/bileUrchin';
import { BIRNIN_ZANA_PLAZA_SCRIPT } from './cards/birninZanaPlaza';
import { BIRTHING_BOUGHS_SCRIPT } from './cards/birthingBoughs';
import { BLAZE_COMMANDO_SCRIPT } from './cards/blazeCommando';
import { BLIGHTED_CATARACT_SCRIPT } from './cards/blightedCataract';
import { BLINDING_MAGE_SCRIPT } from './cards/blindingMage';
import { BLINDING_SOULEATER_SCRIPT } from './cards/blindingSouleater';
import { BLISTER_BEETLE_SCRIPT } from './cards/blisterBeetle';
import { AVEN_OF_ENDURING_HOPE_SCRIPT } from './cards/avenOfEnduringHope';
import { AVENGERS_HANGAR_SCRIPT } from './cards/avengersHangar';
import { AVIATION_PIONEER_SCRIPT } from './cards/aviationPioneer';
import { AYSEN_BUREAUCRATS_SCRIPT } from './cards/aysenBureaucrats';
import { AZORIUS_CLUESTONE_SCRIPT } from './cards/azoriusCluestone';
import { AZORIUS_LOCKET_SCRIPT } from './cards/azoriusLocket';
import { AZURE_MAGE_SCRIPT } from './cards/azureMage';
import { BACKUP_AGENT_SCRIPT } from './cards/backupAgent';
import { BALEFUL_AMMIT_SCRIPT } from './cards/balefulAmmit';
import { ARGOTHIAN_ENCHANTRESS_SCRIPT } from './cards/argothianEnchantress';
import { ARK_OF_BLIGHT_SCRIPT } from './cards/arkOfBlight';
import { ARMADA_WURM_SCRIPT } from './cards/armadaWurm';
import { ARMASAUR_GUIDE_SCRIPT } from './cards/armasaurGuide';
import { ASGARDIAN_CITADEL_SCRIPT } from './cards/asgardianCitadel';
import { ASHEN_RIDER_SCRIPT } from './cards/ashenRider';
import { ASHIOKS_REAPER_SCRIPT } from './cards/ashioksReaper';
import { ASPIRING_AERONAUT_SCRIPT } from './cards/aspiringAeronaut';
import { ATTENDED_KNIGHT_SCRIPT } from './cards/attendedKnight';
import { AURIOK_TRANSFIXER_SCRIPT } from './cards/auriokTransfixer';
import { AVEN_BATTLE_PRIEST_SCRIPT } from './cards/avenBattlePriest';
import { AVEN_CLOUDCHASER_SCRIPT } from './cards/avenCloudchaser';
import { AVEN_FOGBRINGER_SCRIPT } from './cards/avenFogbringer';
import { ANABA_SHAMAN_SCRIPT } from './cards/anabaShaman';
import { ANGEL_OF_DESPAIR_SCRIPT } from './cards/angelOfDespair';
import { ANGEL_OF_MERCY_SCRIPT } from './cards/angelOfMercy';
import { ANODET_LURKER_SCRIPT } from './cards/anodetLurker';
import { ANT_QUEEN_SCRIPT } from './cards/antQueen';
import { AQUUS_STEED_SCRIPT } from './cards/aquusSteed';
import { ARASHIN_CLERIC_SCRIPT } from './cards/arashinCleric';
import { ARASTA_OF_THE_ENDLESS_WEB_SCRIPT } from './cards/arastaOfTheEndlessWeb';
import { ARBORBACK_STOMPER_SCRIPT } from './cards/arborbackStomper';
import { ARCHAEOMANCER_SCRIPT } from './cards/archaeomancer';
import { ARCHIVIST_SCRIPT } from './cards/archivist';
import { ARCHON_OF_JUSTICE_SCRIPT } from './cards/archonOfJustice';
import { ARDENT_ELEMENTALIST_SCRIPT } from './cards/ardentElementalist';
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
  BRIARPACK_ALPHA_SCRIPT,
  BRINDLE_BOAR_SCRIPT,
  BRINDLE_SHOAT_SCRIPT,
  BRINEBARROW_INTRUDER_SCRIPT,
  BROOD_WEAVER_SCRIPT,
  BROODMATE_DRAGON_SCRIPT,
  BULWARK_GIANT_SCRIPT,
  BURRENTON_SHIELD_BEARERS_SCRIPT,
  BURROG_BEFUDDLER_SCRIPT,
  BUZZ_BOTS_SCRIPT,
  CABAL_TRAINEE_SCRIPT,
  CACKLING_IMP_SCRIPT,
  CAPASHEN_UNICORN_SCRIPT,
  CAPTIVE_FLAME_SCRIPT,
  CARTOGRAPHERS_COMPANION_SCRIPT,
  CARVEN_CARYATID_SCRIPT,
  CASTLE_ARDENVALE_SCRIPT,
  CAT_OWL_SCRIPT,
  CATHAR_COMMANDO_SCRIPT,
  CATHEDRAL_SANCTIFIER_SCRIPT,
  CAUSTIC_CATERPILLAR_SCRIPT,
  BLOOD_SERVITOR_SCRIPT,
  BLOODFELL_CAVES_SCRIPT,
  BLOODTALLOW_CANDLE_SCRIPT,
  BLOSSOM_DRYAD_SCRIPT,
  BLOSSOMING_SANDS_SCRIPT,
  BOGARDAN_RAGER_SCRIPT,
  BOGWATER_LUMARET_SCRIPT,
  BOILING_ROCK_PRISON_SCRIPT,
  BOLTWING_MARAUDER_SCRIPT,
  BOND_BEETLE_SCRIPT,
  BONE_PIT_BRUTE_SCRIPT,
  BOOK_OF_RASS_SCRIPT,
  BOROS_CLUESTONE_SCRIPT,
  BOROS_LOCKET_SCRIPT,
  BOTANICAL_PLAZA_SCRIPT,
  BOTTLE_GNOMES_SCRIPT,
  BRAIDWOOD_CUP_SCRIPT,
  BRAMBLE_ELEMENTAL_SCRIPT,
  BRANDYWINE_FARMER_SCRIPT,
  BRASS_SECRETARY_SCRIPT,
  BRAZEN_FREEBOOTER_SCRIPT,
  BRIARKNIT_KAMI_SCRIPT,
  BARBARIAN_RIFTCUTTER_SCRIPT,
  BARTERED_COW_SCRIPT,
  BEAMSAW_PROSPECTOR_SCRIPT,
  BEARS_COMPANION_SCRIPT,
  BEAST_WHISPERER_SCRIPT,
  BEETLEBACK_CHIEF_SCRIPT,
  BELLIGERENT_GUEST_SCRIPT,
  BENALISH_HERALDS_SCRIPT,
  BENALISH_TRAPPER_SCRIPT,
  BESKIR_SHIELDMATE_SCRIPT,
  BIGFIN_BOUNCER_SCRIPT,
  BILE_URCHIN_SCRIPT,
  BIRNIN_ZANA_PLAZA_SCRIPT,
  BIRTHING_BOUGHS_SCRIPT,
  BLAZE_COMMANDO_SCRIPT,
  BLIGHTED_CATARACT_SCRIPT,
  BLINDING_MAGE_SCRIPT,
  BLINDING_SOULEATER_SCRIPT,
  BLISTER_BEETLE_SCRIPT,
  AVEN_OF_ENDURING_HOPE_SCRIPT,
  AVENGERS_HANGAR_SCRIPT,
  AVIATION_PIONEER_SCRIPT,
  AYSEN_BUREAUCRATS_SCRIPT,
  AZORIUS_CLUESTONE_SCRIPT,
  AZORIUS_LOCKET_SCRIPT,
  AZURE_MAGE_SCRIPT,
  BACKUP_AGENT_SCRIPT,
  BALEFUL_AMMIT_SCRIPT,
  ARGOTHIAN_ENCHANTRESS_SCRIPT,
  ARK_OF_BLIGHT_SCRIPT,
  ARMADA_WURM_SCRIPT,
  ARMASAUR_GUIDE_SCRIPT,
  ASGARDIAN_CITADEL_SCRIPT,
  ASHEN_RIDER_SCRIPT,
  ASHIOKS_REAPER_SCRIPT,
  ASPIRING_AERONAUT_SCRIPT,
  ATTENDED_KNIGHT_SCRIPT,
  AURIOK_TRANSFIXER_SCRIPT,
  AVEN_BATTLE_PRIEST_SCRIPT,
  AVEN_CLOUDCHASER_SCRIPT,
  AVEN_FOGBRINGER_SCRIPT,
  ANABA_SHAMAN_SCRIPT,
  ANGEL_OF_DESPAIR_SCRIPT,
  ANGEL_OF_MERCY_SCRIPT,
  ANODET_LURKER_SCRIPT,
  ANT_QUEEN_SCRIPT,
  AQUUS_STEED_SCRIPT,
  ARASHIN_CLERIC_SCRIPT,
  ARASTA_OF_THE_ENDLESS_WEB_SCRIPT,
  ARBORBACK_STOMPER_SCRIPT,
  ARCHAEOMANCER_SCRIPT,
  ARCHIVIST_SCRIPT,
  ARCHON_OF_JUSTICE_SCRIPT,
  ARDENT_ELEMENTALIST_SCRIPT,
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
