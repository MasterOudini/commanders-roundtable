// The script registry, pre-indexed so the trigger bus never scans the board.
//
// ⚠️ `SHIPPED_REGISTRY` is what v1 ships. Every method on it returns an empty
// array or undefined, which is exactly what makes the rest of the engine work
// with no `if (scripted)` anywhere.

import type { CardScript, CombatDef, ReplacementDef, SpellDef, StaticDef, TriggerDef } from './api';
import type { EventKind } from '../types/events';
import type { OracleId } from '../types/ids';
import { EPIC_CONFRONTATION_SCRIPT } from './cards/epicConfrontation';
import { ESSENCE_BACKLASH_SCRIPT } from './cards/essenceBacklash';
import { ESSENCE_DRAIN_SCRIPT } from './cards/essenceDrain';
import { ESSENCE_EXTRACTION_SCRIPT } from './cards/essenceExtraction';
import { ESSENCE_HARVEST_SCRIPT } from './cards/essenceHarvest';
import { ETERNAL_FLAME_SCRIPT } from './cards/eternalFlame';
import { EVACUATION_SCRIPT } from './cards/evacuation';
import { EVAPORATE_SCRIPT } from './cards/evaporate';
import { EXCOMMUNICATE_SCRIPT } from './cards/excommunicate';
import { EXOTIC_DISEASE_SCRIPT } from './cards/exoticDisease';
import { EXPONENTIAL_GROWTH_SCRIPT } from './cards/exponentialGrowth';
import { EXSANGUINATE_SCRIPT } from './cards/exsanguinate';
import { EXTINGUISH_ALL_HOPE_SCRIPT } from './cards/extinguishAllHope';
import { EARLY_HARVEST_SCRIPT } from './cards/earlyHarvest';
import { EARTH_TREMOR_SCRIPT } from './cards/earthTremor';
import { EARTHQUAKE_SCRIPT } from './cards/earthquake';
import { ECHOING_CALM_SCRIPT } from './cards/echoingCalm';
import { ECHOING_COURAGE_SCRIPT } from './cards/echoingCourage';
import { ECHOING_DECAY_SCRIPT } from './cards/echoingDecay';
import { ECHOING_RUIN_SCRIPT } from './cards/echoingRuin';
import { ELDRITCH_PACT_SCRIPT } from './cards/eldritchPact';
import { ELEGANT_PARLOR_SCRIPT } from './cards/elegantParlor';
import { ELVISH_HERDER_SCRIPT } from './cards/elvishHerder';
import { EMPTY_THE_CATACOMBS_SCRIPT } from './cards/emptyTheCatacombs';
import { END_HOSTILITIES_SCRIPT } from './cards/endHostilities';
import { END_THE_FESTIVITIES_SCRIPT } from './cards/endTheFestivities';
import { ENGULF_THE_SHORE_SCRIPT } from './cards/engulfTheShore';
import { ENRAGE_SCRIPT } from './cards/enrage';
import { DIVINE_OFFERING_SCRIPT } from './cards/divineOffering';
import { DOGPILE_SCRIPT } from './cards/dogpile';
import { DONATE_SCRIPT } from './cards/donate';
import { DOUBLE_TROUBLE_SCRIPT } from './cards/doubleTrouble';
import { DOUSE_IN_GLOOM_SCRIPT } from './cards/douseInGloom';
import { DRAG_DOWN_SCRIPT } from './cards/dragDown';
import { DRAG_TO_THE_BOTTOM_SCRIPT } from './cards/dragToTheBottom';
import { DRAMATIC_REVERSAL_SCRIPT } from './cards/dramaticReversal';
import { DROWN_IN_SORROW_SCRIPT } from './cards/drownInSorrow';
import { DRY_SPELL_SCRIPT } from './cards/drySpell';
import { DUST_TO_DUST_SCRIPT } from './cards/dustToDust';
import { DWARVEN_CATAPULT_SCRIPT } from './cards/dwarvenCatapult';
import { DESPOIL_SCRIPT } from './cards/despoil';
import { DESTROY_THE_EVIDENCE_SCRIPT } from './cards/destroyTheEvidence';
import { DESTRUCTIVE_REVELRY_SCRIPT } from './cards/destructiveRevelry';
import { DESYNCHRONIZATION_SCRIPT } from './cards/desynchronization';
import { DEVASTATE_SCRIPT } from './cards/devastate';
import { DEVASTATION_SCRIPT } from './cards/devastation';
import { DEVOUR_IN_SHADOW_SCRIPT } from './cards/devourInShadow';
import { DIMIR_INFORMANT_SCRIPT } from './cards/dimirInformant';
import { DINOTOMATON_SCRIPT } from './cards/dinotomaton';
import { DIRE_TACTICS_SCRIPT } from './cards/direTactics';
import { DIRESIGHT_SCRIPT } from './cards/diresight';
import { DISARM_SCRIPT } from './cards/disarm';
import { DISEMPOWER_SCRIPT } from './cards/disempower';
import { DISORDER_SCRIPT } from './cards/disorder';
import { DISPERSAL_SHIELD_SCRIPT } from './cards/dispersalShield';
import { DISPLACEMENT_WAVE_SCRIPT } from './cards/displacementWave';
import { DEBT_TO_THE_DEATHLESS_SCRIPT } from './cards/debtToTheDeathless';
import { DECIMATE_SCRIPT } from './cards/decimate';
import { DECLARATION_IN_STONE_SCRIPT } from './cards/declarationInStone';
import { DECONSTRUCT_SCRIPT } from './cards/deconstruct';
import { DEDUCE_SCRIPT } from './cards/deduce';
import { DEFIBRILLATING_CURRENT_SCRIPT } from './cards/defibrillatingCurrent';
import { DEFILE_SCRIPT } from './cards/defile';
import { DELETE_SCRIPT } from './cards/delete';
import { DELUGE_SCRIPT } from './cards/deluge';
import { DELUGE_OF_DOOM_SCRIPT } from './cards/delugeOfDoom';
import { DEMOLISH_SCRIPT } from './cards/demolish';
import { DEMONS_DUE_SCRIPT } from './cards/demonsDue';
import { DEPOPULATE_SCRIPT } from './cards/depopulate';
import { DEPRESSURIZE_SCRIPT } from './cards/depressurize';
import { DESECRATION_PLAGUE_SCRIPT } from './cards/desecrationPlague';
import { DESERT_SANDSTORM_SCRIPT } from './cards/desertSandstorm';
import { DESERTS_DUE_SCRIPT } from './cards/desertsDue';
import { DAKMOR_PLAGUE_SCRIPT } from './cards/dakmorPlague';
import { DAMNABLE_PACT_SCRIPT } from './cards/damnablePact';
import { DANGEROUS_WAGER_SCRIPT } from './cards/dangerousWager';
import { DARK_DEAL_SCRIPT } from './cards/darkDeal';
import { DARKSTEEL_PENDANT_SCRIPT } from './cards/darksteelPendant';
import { DAUTHI_EMBRACE_SCRIPT } from './cards/dauthiEmbrace';
import { DAUTHI_TRAPPER_SCRIPT } from './cards/dauthiTrapper';
import { DAY_OF_JUDGMENT_SCRIPT } from './cards/dayOfJudgment';
import { DEAD_OF_WINTER_SCRIPT } from './cards/deadOfWinter';
import { DEADLY_TEMPEST_SCRIPT } from './cards/deadlyTempest';
import { DEATH_BEGETS_LIFE_SCRIPT } from './cards/deathBegetsLife';
import { DEATH_GRASP_SCRIPT } from './cards/deathGrasp';
import { DEATH_WIND_SCRIPT } from './cards/deathWind';
import { DEATHS_CARESS_SCRIPT } from './cards/deathsCaress';
import { DEATHLESS_ANGEL_SCRIPT } from './cards/deathlessAngel';
import { CORRUPT_SCRIPT } from './cards/corrupt';
import { CORRUPTED_RESOLVE_SCRIPT } from './cards/corruptedResolve';
import { COSMIC_EPIPHANY_SCRIPT } from './cards/cosmicEpiphany';
import { COWER_IN_FEAR_SCRIPT } from './cards/cowerInFear';
import { CREEPING_CORROSION_SCRIPT } from './cards/creepingCorrosion';
import { CREEPING_MOLD_SCRIPT } from './cards/creepingMold';
import { CRIMSON_MAGE_SCRIPT } from './cards/crimsonMage';
import { CRUEL_BARGAIN_SCRIPT } from './cards/cruelBargain';
import { CRUEL_TRUTHS_SCRIPT } from './cards/cruelTruths';
import { CRUEL_WITNESS_SCRIPT } from './cards/cruelWitness';
import { CRUMBLE_SCRIPT } from './cards/crumble';
import { CRUSHING_DISAPPOINTMENT_SCRIPT } from './cards/crushingDisappointment';
import { CRYPT_INCURSION_SCRIPT } from './cards/cryptIncursion';
import { CRYSTAL_BALL_SCRIPT } from './cards/crystalBall';
import { CULLING_SUN_SCRIPT } from './cards/cullingSun';
import { CUT_ADEAL_SCRIPT } from './cards/cutADeal';
import { CLOUDSHIFT_SCRIPT } from './cards/cloudshift';
import { COLLECTIVE_UNCONSCIOUS_SCRIPT } from './cards/collectiveUnconscious';
import { COMBAT_PROFESSOR_SCRIPT } from './cards/combatProfessor';
import { COMMERCIAL_DISTRICT_SCRIPT } from './cards/commercialDistrict';
import { COMPLEAT_DEVOTION_SCRIPT } from './cards/compleatDevotion';
import { CONFRONT_THE_UNKNOWN_SCRIPT } from './cards/confrontTheUnknown';
import { CONGREGATE_SCRIPT } from './cards/congregate';
import { CONSIGN_TO_THE_PIT_SCRIPT } from './cards/consignToThePit';
import { CONSUME_THE_MEEK_SCRIPT } from './cards/consumeTheMeek';
import { CONSUMING_ASHES_SCRIPT } from './cards/consumingAshes';
import { CONSUMING_CORRUPTION_SCRIPT } from './cards/consumingCorruption';
import { CONTRABAND_KINGPIN_SCRIPT } from './cards/contrabandKingpin';
import { CORROSIVE_GALE_SCRIPT } from './cards/corrosiveGale';
import { CHANDRAS_FURY_SCRIPT } from './cards/chandrasFury';
import { CHANDRAS_OUTRAGE_SCRIPT } from './cards/chandrasOutrage';
import { CHANNEL_THE_SUNS_SCRIPT } from './cards/channelTheSuns';
import { CHAOTIC_BACKLASH_SCRIPT } from './cards/chaoticBacklash';
import { CHASM_DRAKE_SCRIPT } from './cards/chasmDrake';
import { CHILLING_TRAP_SCRIPT } from './cards/chillingTrap';
import { CHROME_CAT_SCRIPT } from './cards/chromeCat';
import { CHURNING_EDDY_SCRIPT } from './cards/churningEddy';
import { CINDER_CLOUD_SCRIPT } from './cards/cinderCloud';
import { CITYWATCH_SPHINX_SCRIPT } from './cards/citywatchSphinx';
import { CITYWIDE_BUST_SCRIPT } from './cards/citywideBust';
import { CLEANFALL_SCRIPT } from './cards/cleanfall';
import { CLEANSING_BEAM_SCRIPT } from './cards/cleansingBeam';
import { CLEAR_SHOT_SCRIPT } from './cards/clearShot';
import { CLEAR_THE_LAND_SCRIPT } from './cards/clearTheLand';
import { CLOUDKILL_SCRIPT } from './cards/cloudkill';
import { CLOUDREADER_SPHINX_SCRIPT } from './cards/cloudreaderSphinx';
import { BRONZE_WALRUS_SCRIPT } from './cards/bronzeWalrus';
import { BURDEN_OF_GREED_SCRIPT } from './cards/burdenOfGreed';
import { BURN_THE_IMPURE_SCRIPT } from './cards/burnTheImpure';
import { BURNING_CLOAK_SCRIPT } from './cards/burningCloak';
import { BURNING_FIELDS_SCRIPT } from './cards/burningFields';
import { CALAMITOUS_CAVE_IN_SCRIPT } from './cards/calamitousCaveIn';
import { CALL_TO_HEEL_SCRIPT } from './cards/callToHeel';
import { CALLER_OF_GALES_SCRIPT } from './cards/callerOfGales';
import { CALMING_VERSE_SCRIPT } from './cards/calmingVerse';
import { CARESS_OF_PHYREXIA_SCRIPT } from './cards/caressOfPhyrexia';
import { CASE_THE_JOINT_SCRIPT } from './cards/caseTheJoint';
import { CASTLE_VANTRESS_SCRIPT } from './cards/castleVantress';
import { CAVALRY_DRILLMASTER_SCRIPT } from './cards/cavalryDrillmaster';
import { CEREBRAL_DOWNLOAD_SCRIPT } from './cards/cerebralDownload';
import { CERTAIN_DEATH_SCRIPT } from './cards/certainDeath';
import { CHAIN_REACTION_SCRIPT } from './cards/chainReaction';
import { BOLTWAVE_SCRIPT } from './cards/boltwave';
import { BOON_OF_BOSEIJU_SCRIPT } from './cards/boonOfBoseiju';
import { BORROWING_ARROWS_SCRIPT } from './cards/borrowingArrows';
import { BORROWING_THE_EAST_WIND_SCRIPT } from './cards/borrowingTheEastWind';
import { BOULDERBORN_DRAGON_SCRIPT } from './cards/boulderbornDragon';
import { BOUNTIFUL_HARVEST_SCRIPT } from './cards/bountifulHarvest';
import { BRAINGEYSER_SCRIPT } from './cards/braingeyser';
import { BREAK_THE_SPELL_SCRIPT } from './cards/breakTheSpell';
import { BREATH_OF_MALFEGOR_SCRIPT } from './cards/breathOfMalfegor';
import { BREATH_WEAPON_SCRIPT } from './cards/breathWeapon';
import { BREATHE_YOUR_LAST_SCRIPT } from './cards/breatheYourLast';
import { BRIGHTFLAME_SCRIPT } from './cards/brightflame';
import { BRIGHTSTONE_RITUAL_SCRIPT } from './cards/brightstoneRitual';
import { BIORHYTHM_SCRIPT } from './cards/biorhythm';
import { BITE_DOWN_SCRIPT } from './cards/biteDown';
import { BLASTFIRE_BOLT_SCRIPT } from './cards/blastfireBolt';
import { BLAZE_SCRIPT } from './cards/blaze';
import { BLAZING_VOLLEY_SCRIPT } from './cards/blazingVolley';
import { BLESSED_REVERSAL_SCRIPT } from './cards/blessedReversal';
import { BLESSED_WIND_SCRIPT } from './cards/blessedWind';
import { BLINDING_LIGHT_SCRIPT } from './cards/blindingLight';
import { BLOOD_LUST_SCRIPT } from './cards/bloodLust';
import { BLOOD_MIST_SCRIPT } from './cards/bloodMist';
import { BLOOD_PACT_SCRIPT } from './cards/bloodPact';
import { BLOOD_TITHE_SCRIPT } from './cards/bloodTithe';
import { BLOODCURDLING_SCREAM_SCRIPT } from './cards/bloodcurdlingScream';
import { BLOODLUST_INCITER_SCRIPT } from './cards/bloodlustInciter';
import { BLOODTHORN_TAUNTER_SCRIPT } from './cards/bloodthornTaunter';
import { BLOSSOMING_WREATH_SCRIPT } from './cards/blossomingWreath';
import { BOIL_SCRIPT } from './cards/boil';
import { BOILING_SEAS_SCRIPT } from './cards/boilingSeas';
import { AXGARD_CAVALRY_SCRIPT } from './cards/axgardCavalry';
import { BACK_TO_NATURE_SCRIPT } from './cards/backToNature';
import { BAKIS_CURSE_SCRIPT } from './cards/bakisCurse';
import { BALANCE_OF_POWER_SCRIPT } from './cards/balanceOfPower';
import { BALEFUL_STARE_SCRIPT } from './cards/balefulStare';
import { BANISHMENT_DECREE_SCRIPT } from './cards/banishmentDecree';
import { BARRIER_OF_BONES_SCRIPT } from './cards/barrierOfBones';
import { BARRINS_UNMAKING_SCRIPT } from './cards/barrinsUnmaking';
import { BATTLE_HYMN_SCRIPT } from './cards/battleHymn';
import { BATTLE_RAMPART_SCRIPT } from './cards/battleRampart';
import { BATTLEFLIGHT_EAGLE_SCRIPT } from './cards/battleflightEagle';
import { BATTLESONG_BERSERKER_SCRIPT } from './cards/battlesongBerserker';
import { BEACON_BEHEMOTH_SCRIPT } from './cards/beaconBehemoth';
import { BEAST_HUNT_SCRIPT } from './cards/beastHunt';
import { BEWILDERING_BLIZZARD_SCRIPT } from './cards/bewilderingBlizzard';
import { BEYOND_THE_QUIET_SCRIPT } from './cards/beyondTheQuiet';
import { BILE_BLIGHT_SCRIPT } from './cards/bileBlight';
import { AUGURY_OWL_SCRIPT } from './cards/auguryOwl';
import { ARCHIVE_DRAGON_SCRIPT } from './cards/archiveDragon';
import { AUTOMATIC_LIBRARIAN_SCRIPT } from './cards/automaticLibrarian';
import { ARTIFICERS_ASSISTANT_SCRIPT } from './cards/artificersAssistant';
import { ATTENTIVE_SUNSCRIBE_SCRIPT } from './cards/attentiveSunscribe';
import { APPENDAGE_AMALGAM_SCRIPT } from './cards/appendageAmalgam';
import { ARMAGEDDON_SCRIPT } from './cards/armageddon';
import { AURA_BARBS_SCRIPT } from './cards/auraBarbs';
import { ASPECT_OF_HYDRA_SCRIPT } from './cards/aspectOfHydra';
import { ARMY_OF_ALLAH_SCRIPT } from './cards/armyOfAllah';
import { AUSPICIOUS_ARRIVAL_SCRIPT } from './cards/auspiciousArrival';
import { ASHEN_POWDER_SCRIPT } from './cards/ashenPowder';
import { ARBOREA_PEGASUS_SCRIPT } from './cards/arboreaPegasus';
import { APOCALYPSE_SCRIPT } from './cards/apocalypse';
import { ARMS_OF_HADAR_SCRIPT } from './cards/armsOfHadar';
import { AMBITIONS_COST_SCRIPT } from './cards/ambitionsCost';
import { ANCIENT_CRAVING_SCRIPT } from './cards/ancientCraving';
import { AGONIZING_SYPHON_SCRIPT } from './cards/agonizingSyphon';
import { ALABASTER_MAGE_SCRIPT } from './cards/alabasterMage';
import { AKKI_DRILLMASTER_SCRIPT } from './cards/akkiDrillmaster';
import { AETHERIZE_SCRIPT } from './cards/aetherize';
import { AIRBORNE_AID_SCRIPT } from './cards/airborneAid';
import { ANCHOR_TO_THE_AETHER_SCRIPT } from './cards/anchorToTheAether';
import { AMNESIA_SCRIPT } from './cards/amnesia';
import { AETHER_TRADEWINDS_SCRIPT } from './cards/aetherTradewinds';
import { ANARCHY_SCRIPT } from './cards/anarchy';
import { AGGRESSIVE_INSTINCT_SCRIPT } from './cards/aggressiveInstinct';
import { AMBUSCADE_SCRIPT } from './cards/ambuscade';
import { ANGELHEART_PROTECTOR_SCRIPT } from './cards/angelheartProtector';
import { ALPHA_BRAWL_SCRIPT } from './cards/alphaBrawl';
import { AN_HAVVA_INN_SCRIPT } from './cards/anHavvaInn';
import { ALLIED_STRATEGIES_SCRIPT } from './cards/alliedStrategies';
import { TERMINATE_SCRIPT } from './cards/terminate';
import { WRATH_OF_GOD_SCRIPT } from './cards/wrathOfGod';
import { WAVE_OF_RECKONING_SCRIPT } from './cards/waveOfReckoning';
import { SWORDS_TO_PLOWSHARES_SCRIPT } from './cards/swordsToPlowshares';
import { ETERNAL_ISOLATION_SCRIPT } from './cards/eternalIsolation';
import { ACID_RAIN_SCRIPT } from './cards/acidRain';
import { ACIDIC_SOIL_SCRIPT } from './cards/acidicSoil';
import { ACCUMULATED_KNOWLEDGE_SCRIPT } from './cards/accumulatedKnowledge';
import { GITAXIAN_PROBE_SCRIPT } from './cards/gitaxianProbe';
import { WHEEL_OF_FORTUNE_SCRIPT } from './cards/wheelOfFortune';
import { ACCELERATED_MUTATION_SCRIPT } from './cards/acceleratedMutation';
import { TEMPLE_OF_MALICE_SCRIPT } from './cards/templeOfMalice';
import { ZHALFIRIN_VOID_SCRIPT } from './cards/zhalfirinVoid';
import { ADVANCE_SCOUT_SCRIPT } from './cards/advanceScout';
import { SPEARBREAKER_BEHEMOTH_SCRIPT } from './cards/spearbreakerBehemoth';
import { DOOM_WHISPERER_SCRIPT } from './cards/doomWhisperer';
import { AIM_SYNTHOIDS_SCRIPT } from './cards/aimSynthoids';
import { DARK_RITUAL_SCRIPT } from './cards/darkRitual';
import { PYRETIC_RITUAL_SCRIPT } from './cards/pyreticRitual';
import { SEETHING_SONG_SCRIPT } from './cards/seethingSong';
import { MANA_GEYSER_SCRIPT } from './cards/manaGeyser';
import { INFERNAL_GRASP_SCRIPT } from './cards/infernalGrasp';
import { NIGHTS_WHISPER_SCRIPT } from './cards/nightsWhisper';
import { DAMNATION_SCRIPT } from './cards/damnation';
import { FUMIGATE_SCRIPT } from './cards/fumigate';
import { SLASH_THE_RANKS_SCRIPT } from './cards/slashTheRanks';
import { FELL_THE_MIGHTY_SCRIPT } from './cards/fellTheMighty';
import { SOLAR_BLAZE_SCRIPT } from './cards/solarBlaze';
import { PREY_UPON_SCRIPT } from './cards/preyUpon';
import { RABID_BITE_SCRIPT } from './cards/rabidBite';
import { CHANDRAS_IGNITION_SCRIPT } from './cards/chandrasIgnition';
import { SQUALL_LINE_SCRIPT } from './cards/squallLine';
import { RECKLESS_RAGE_SCRIPT } from './cards/recklessRage';
import { MAN_OWAR_SCRIPT } from './cards/manOWar';
import { MANDROID_SQUADRON_SCRIPT } from './cards/mandroidSquadron';
import { MANIC_VANDAL_SCRIPT } from './cards/manicVandal';
import { MARBLE_CHALICE_SCRIPT } from './cards/marbleChalice';
import { MARDU_BANNER_SCRIPT } from './cards/marduBanner';
import { MARTYR_OF_DUSK_SCRIPT } from './cards/martyrOfDusk';
import { MASTER_DECOY_SCRIPT } from './cards/masterDecoy';
import { MAUSOLEUM_GUARD_SCRIPT } from './cards/mausoleumGuard';
import { MAVREN_FEIN_DUSK_APOSTLE_SCRIPT } from './cards/mavrenFeinDuskApostle';
import { MAWCOR_SCRIPT } from './cards/mawcor';
import { MECHANIZED_NINJA_CAVALRY_SCRIPT } from './cards/mechanizedNinjaCavalry';
import { MEDITATION_POOLS_SCRIPT } from './cards/meditationPools';
import { MELTSTRIDER_EULOGIST_SCRIPT } from './cards/meltstriderEulogist';
import { MEMORIAL_TO_FOLLY_SCRIPT } from './cards/memorialToFolly';
import { MEMORIAL_TO_GENIUS_SCRIPT } from './cards/memorialToGenius';
import { MEMORIAL_TO_GLORY_SCRIPT } from './cards/memorialToGlory';
import { MEMORIAL_TO_WAR_SCRIPT } from './cards/memorialToWar';
import { MERCHANT_OF_SECRETS_SCRIPT } from './cards/merchantOfSecrets';
import { MERFOLK_SKYSCOUT_SCRIPT } from './cards/merfolkSkyscout';
import { MERIADOC_BRANDYBUCK_SCRIPT } from './cards/meriadocBrandybuck';
import { CHAR_SCRIPT } from './cards/char';
import { FRUITION_SCRIPT } from './cards/fruition';
import { HORIZON_CHIMERA_SCRIPT } from './cards/horizonChimera';
import { LIBRARY_LARCENIST_SCRIPT } from './cards/libraryLarcenist';
import { LIFECREED_DUO_SCRIPT } from './cards/lifecreedDuo';
import { LIVING_LIGHTNING_SCRIPT } from './cards/livingLightning';
import { LLANOWAR_VISIONARY_SCRIPT } from './cards/llanowarVisionary';
import { LONE_MISSIONARY_SCRIPT } from './cards/loneMissionary';
import { LONG_FENG_GRAND_SECRETARIAT_SCRIPT } from './cards/longFengGrandSecretariat';
import { LOS_DIABLOS_MISSILE_BASE_SCRIPT } from './cards/losDiablosMissileBase';
import { LOXODON_MYSTIC_SCRIPT } from './cards/loxodonMystic';
import { LUKE_CAGE_HERO_FOR_HIRE_SCRIPT } from './cards/lukeCageHeroForHire';
import { LUMINARCH_ASPIRANT_SCRIPT } from './cards/luminarchAspirant';
import { MAALFELD_TWINS_SCRIPT } from './cards/maalfeldTwins';
import { MADAME_HYDRA_SCRIPT } from './cards/madameHydra';
import { MAKESHIFT_MUNITIONS_SCRIPT } from './cards/makeshiftMunitions';
import { MALCATORS_WATCHER_SCRIPT } from './cards/malcatorsWatcher';
import { MALEVOLENT_AWAKENING_SCRIPT } from './cards/malevolentAwakening';
import { KELDON_NECROPOLIS_SCRIPT } from './cards/keldonNecropolis';
import { KEMBAS_SKYGUARD_SCRIPT } from './cards/kembasSkyguard';
import { KHALNI_GARDEN_SCRIPT } from './cards/khalniGarden';
import { KINDLY_CUSTOMER_SCRIPT } from './cards/kindlyCustomer';
import { KINGFISHER_SCRIPT } from './cards/kingfisher';
import { KINGPINS_ENFORCERS_SCRIPT } from './cards/kingpinsEnforcers';
import { KINSBAILE_SKIRMISHER_SCRIPT } from './cards/kinsbaileSkirmisher';
import { KNIGHT_OF_DOVES_SCRIPT } from './cards/knightOfDoves';
import { KNIGHT_OF_THE_NEW_COALITION_SCRIPT } from './cards/knightOfTheNewCoalition';
import { KNIGHTFISHER_SCRIPT } from './cards/knightfisher';
import { KOALA_SHEEP_SCRIPT } from './cards/koalaSheep';
import { KOR_CELEBRANT_SCRIPT } from './cards/korCelebrant';
import { KOR_LINE_SLINGER_SCRIPT } from './cards/korLineSlinger';
import { KUJAR_SEEDSCULPTOR_SCRIPT } from './cards/kujarSeedsculptor';
import { KYOSHI_VILLAGE_SCRIPT } from './cards/kyoshiVillage';
import { KYOSHI_WARRIORS_SCRIPT } from './cards/kyoshiWarriors';
import { LAW_RUNE_ENFORCER_SCRIPT } from './cards/lawRuneEnforcer';
import { LAWLESS_BROKER_SCRIPT } from './cards/lawlessBroker';
import { LETTER_OF_ACCEPTANCE_SCRIPT } from './cards/letterOfAcceptance';
import { LEY_DRUID_SCRIPT } from './cards/leyDruid';
import { JEWEL_THIEF_SCRIPT } from './cards/jewelThief';
import { JEWEL_EYED_COBRA_SCRIPT } from './cards/jewelEyedCobra';
import { JHOIRA_WEATHERLIGHT_CAPTAIN_SCRIPT } from './cards/jhoiraWeatherlightCaptain';
import { JORAGA_VISIONARY_SCRIPT } from './cards/joragaVisionary';
import { JUNGLE_BARRIER_SCRIPT } from './cards/jungleBarrier';
import { JUNGLE_HOLLOW_SCRIPT } from './cards/jungleHollow';
import { JUNGLEBORN_PIONEER_SCRIPT } from './cards/junglebornPioneer';
import { JUNIPER_ORDER_DRUID_SCRIPT } from './cards/juniperOrderDruid';
import { JUNKTOWN_SCRIPT } from './cards/junktown';
import { JWAR_ISLE_REFUGE_SCRIPT } from './cards/jwarIsleRefuge';
import { KABIRA_CROSSROADS_SCRIPT } from './cards/kabiraCrossroads';
import { KABUTO_MOTH_SCRIPT } from './cards/kabutoMoth';
import { KAMAHL_PIT_FIGHTER_SCRIPT } from './cards/kamahlPitFighter';
import { KAMI_OF_ANCIENT_LAW_SCRIPT } from './cards/kamiOfAncientLaw';
import { KAMI_OF_TWISTED_REFLECTION_SCRIPT } from './cards/kamiOfTwistedReflection';
import { KAPSHO_KITEFINS_SCRIPT } from './cards/kapshoKitefins';
import { KAVU_CLIMBER_SCRIPT } from './cards/kavuClimber';
import { KAZANDU_REFUGE_SCRIPT } from './cards/kazanduRefuge';
import { KEENING_APPARITION_SCRIPT } from './cards/keeningApparition';
import { KEENING_BANSHEE_SCRIPT } from './cards/keeningBanshee';
import { KEEPER_OF_FABLES_SCRIPT } from './cards/keeperOfFables';
import { INSPIRED_INSURGENT_SCRIPT } from './cards/inspiredInsurgent';
import { INSPIRING_CLERIC_SCRIPT } from './cards/inspiringCleric';
import { INTREPID_HERO_SCRIPT } from './cards/intrepidHero';
import { INVASION_REINFORCEMENTS_SCRIPT } from './cards/invasionReinforcements';
import { IRON_BULLY_SCRIPT } from './cards/ironBully';
import { IRONPAW_ASPIRANT_SCRIPT } from './cards/ironpawAspirant';
import { IRONSHELL_BEETLE_SCRIPT } from './cards/ironshellBeetle';
import { ITHILIEN_KINGFISHER_SCRIPT } from './cards/ithilienKingfisher';
import { IVY_LANE_DENIZEN_SCRIPT } from './cards/ivyLaneDenizen';
import { IZZET_CHRONARCH_SCRIPT } from './cards/izzetChronarch';
import { IZZET_CLUESTONE_SCRIPT } from './cards/izzetCluestone';
import { IZZET_LOCKET_SCRIPT } from './cards/izzetLocket';
import { JADE_MAGE_SCRIPT } from './cards/jadeMage';
import { JADECRAFT_ARTISAN_SCRIPT } from './cards/jadecraftArtisan';
import { JANDORS_SADDLEBAGS_SCRIPT } from './cards/jandorsSaddlebags';
import { JARVIS_EARTHS_MIGHTIEST_BUTLER_SCRIPT } from './cards/jarvisEarthsMightiestButler';
import { JAYEMDAE_TOME_SCRIPT } from './cards/jayemdaeTome';
import { JEDIT_OJANEN_OF_EFRAVA_SCRIPT } from './cards/jeditOjanenOfEfrava';
import { JEDITS_DRAGOONS_SCRIPT } from './cards/jeditsDragoons';
import { JEONG_JEONGS_DESERTERS_SCRIPT } from './cards/jeongJeongsDeserters';
import { JESKA_WARRIOR_ADEPT_SCRIPT } from './cards/jeskaWarriorAdept';
import { JESKAI_BANNER_SCRIPT } from './cards/jeskaiBanner';
import { HORNET_HARASSER_SCRIPT } from './cards/hornetHarasser';
import { HORNET_QUEEN_SCRIPT } from './cards/hornetQueen';
import { HOT_DOG_CART_SCRIPT } from './cards/hotDogCart';
import { HOWLING_GIANT_SCRIPT } from './cards/howlingGiant';
import { HUMBLING_ELDER_SCRIPT } from './cards/humblingElder';
import { HUNTED_WITNESS_SCRIPT } from './cards/huntedWitness';
import { HURLER_CYCLOPS_SCRIPT } from './cards/hurlerCyclops';
import { HYRAX_TOWER_SCOUT_SCRIPT } from './cards/hyraxTowerScout';
import { ICATIAN_PRIEST_SCRIPT } from './cards/icatianPriest';
import { ICERIDGE_SERPENT_SCRIPT } from './cards/iceridgeSerpent';
import { ICHOR_WELLSPRING_SCRIPT } from './cards/ichorWellspring';
import { IDYLLIC_GRANGE_SCRIPT } from './cards/idyllicGrange';
import { ILLEGITIMATE_BUSINESS_SCRIPT } from './cards/illegitimateBusiness';
import { ILLVOI_GALEBLADE_SCRIPT } from './cards/illvoiGaleblade';
import { IMPASSIONED_ORATOR_SCRIPT } from './cards/impassionedOrator';
import { IMPERIAL_SUBDUER_SCRIPT } from './cards/imperialSubduer';
import { INDRIK_STOMPHOWLER_SCRIPT } from './cards/indrikStomphowler';
import { INFECTIOUS_HOST_SCRIPT } from './cards/infectiousHost';
import { INFESTATION_SAGE_SCRIPT } from './cards/infestationSage';
import { INSIGHT_SCRIPT } from './cards/insight';
import { HARRIER_GRIFFIN_SCRIPT } from './cards/harrierGriffin';
import { HATCHING_PLANS_SCRIPT } from './cards/hatchingPlans';
import { HEAD_OF_THE_HOMESTEAD_SCRIPT } from './cards/headOfTheHomestead';
import { HEADLESS_RIDER_SCRIPT } from './cards/headlessRider';
import { HEALER_OF_THE_GLADE_SCRIPT } from './cards/healerOfTheGlade';
import { HEALER_OF_THE_PRIDE_SCRIPT } from './cards/healerOfThePride';
import { HEART_WARDEN_SCRIPT } from './cards/heartWarden';
import { HEARTWOOD_GIANT_SCRIPT } from './cards/heartwoodGiant';
import { HEAVY_INFANTRY_SCRIPT } from './cards/heavyInfantry';
import { HELLS_KITCHEN_SCRIPT } from './cards/hellsKitchen';
import { HELPFUL_HUNTER_SCRIPT } from './cards/helpfulHunter';
import { HERALD_OF_FAITH_SCRIPT } from './cards/heraldOfFaith';
import { HERALD_OF_THE_FAIR_SCRIPT } from './cards/heraldOfTheFair';
import { HERO_OF_PRECINCT_ONE_SCRIPT } from './cards/heroOfPrecinctOne';
import { HIGH_MARKET_SCRIPT } from './cards/highMarket';
import { HIGHLAND_GAME_SCRIPT } from './cards/highlandGame';
import { HILL_GIANT_HERDGORGER_SCRIPT } from './cards/hillGiantHerdgorger';
import { HINTERLAND_SANCTIFIER_SCRIPT } from './cards/hinterlandSanctifier';
import { HOARD_ROBBER_SCRIPT } from './cards/hoardRobber';
import { HOBBLING_ZOMBIE_SCRIPT } from './cards/hobblingZombie';
import { HONEY_MAMMOTH_SCRIPT } from './cards/honeyMammoth';
import { GRASPING_LONGNECK_SCRIPT } from './cards/graspingLongneck';
import { GRAVE_TITAN_SCRIPT } from './cards/graveTitan';
import { GRAYPELT_REFUGE_SCRIPT } from './cards/graypeltRefuge';
import { GREED_SCRIPT } from './cards/greed';
import { GRIM_BACKWOODS_SCRIPT } from './cards/grimBackwoods';
import { GRIM_PHYSICIAN_SCRIPT } from './cards/grimPhysician';
import { GRUUL_CLUESTONE_SCRIPT } from './cards/gruulCluestone';
import { GRUUL_LOCKET_SCRIPT } from './cards/gruulLocket';
import { GRYFF_VANGUARD_SCRIPT } from './cards/gryffVanguard';
import { GUARDED_HEIR_SCRIPT } from './cards/guardedHeir';
import { GUARDIAN_AUTOMATON_SCRIPT } from './cards/guardianAutomaton';
import { GUARDIAN_OF_PILGRIMS_SCRIPT } from './cards/guardianOfPilgrims';
import { GUTLESS_GHOUL_SCRIPT } from './cards/gutlessGhoul';
import { GUUL_DRAZ_MUCKLORD_SCRIPT } from './cards/guulDrazMucklord';
import { HAAZDA_MARSHAL_SCRIPT } from './cards/haazdaMarshal';
import { HAAZDA_OFFICER_SCRIPT } from './cards/haazdaOfficer';
import { HAAZDA_VIGILANTE_SCRIPT } from './cards/haazdaVigilante';
import { HAGRA_SHARPSHOOTER_SCRIPT } from './cards/hagraSharpshooter';
import { GNARLBACK_RHINO_SCRIPT } from './cards/gnarlbackRhino';
import { GNARLED_EFFIGY_SCRIPT } from './cards/gnarledEffigy';
import { GNOTTVOLD_SLUMBERMOUND_SCRIPT } from './cards/gnottvoldSlumbermound';
import { GOBLIN_ASSAULT_TEAM_SCRIPT } from './cards/goblinAssaultTeam';
import { GOBLIN_BOMBARDMENT_SCRIPT } from './cards/goblinBombardment';
import { GOBLIN_FIREBOMB_SCRIPT } from './cards/goblinFirebomb';
import { GOBLIN_FIRESLINGER_SCRIPT } from './cards/goblinFireslinger';
import { GOBLIN_GANG_LEADER_SCRIPT } from './cards/goblinGangLeader';
import { GOBLIN_GARDENER_SCRIPT } from './cards/goblinGardener';
import { GOBLIN_INSTIGATOR_SCRIPT } from './cards/goblinInstigator';
import { GOBLIN_REPLICA_SCRIPT } from './cards/goblinReplica';
import { GOBLIN_SETTLER_SCRIPT } from './cards/goblinSettler';
import { GOBLIN_SLEDDER_SCRIPT } from './cards/goblinSledder';
import { GOBLIN_TRENCHES_SCRIPT } from './cards/goblinTrenches';
import { GODS_EYE_GATE_TO_THE_REIKAI_SCRIPT } from './cards/godsEyeGateToTheReikai';
import { GOLDMEADOW_HARRIER_SCRIPT } from './cards/goldmeadowHarrier';
import { GOLGARI_CLUESTONE_SCRIPT } from './cards/golgariCluestone';
import { GOLGARI_GERMINATION_SCRIPT } from './cards/golgariGermination';
import { GOLGARI_LOCKET_SCRIPT } from './cards/golgariLocket';
import { GOLGARI_ROTWURM_SCRIPT } from './cards/golgariRotwurm';
import { GRANDMOTHER_SENGIR_SCRIPT } from './cards/grandmotherSengir';
import { FUGITIVE_DRUID_SCRIPT } from './cards/fugitiveDruid';
import { FUME_SPITTER_SCRIPT } from './cards/fumeSpitter';
import { FYNDHORN_BROWNIE_SCRIPT } from './cards/fyndhornBrownie';
import { GALACTIC_WAYFARER_SCRIPT } from './cards/galacticWayfarer';
import { GALLANT_CAVALRY_SCRIPT } from './cards/gallantCavalry';
import { GALLANT_CITIZEN_SCRIPT } from './cards/gallantCitizen';
import { GALVANIC_KEY_SCRIPT } from './cards/galvanicKey';
import { GARGOYLE_CASTLE_SCRIPT } from './cards/gargoyleCastle';
import { GARRISON_CAT_SCRIPT } from './cards/garrisonCat';
import { GARRISON_EXCAVATOR_SCRIPT } from './cards/garrisonExcavator';
import { GAVONY_TRAPPER_SCRIPT } from './cards/gavonyTrapper';
import { GENEROUS_STRAY_SCRIPT } from './cards/generousStray';
import { GENEROUS_VISITOR_SCRIPT } from './cards/generousVisitor';
import { GENGHIS_FROG_SCRIPT } from './cards/genghisFrog';
import { GHIRAPUR_GEARCRAFTER_SCRIPT } from './cards/ghirapurGearcrafter';
import { GHITU_WAR_CRY_SCRIPT } from './cards/ghituWarCry';
import { GHOST_WARDEN_SCRIPT } from './cards/ghostWarden';
import { GHOSTS_OF_THE_DAMNED_SCRIPT } from './cards/ghostsOfTheDamned';
import { GIDEONS_LAWKEEPER_SCRIPT } from './cards/gideonsLawkeeper';
import { GINGERBREAD_CABIN_SCRIPT } from './cards/gingerbreadCabin';
import { GLEAMING_BARRIER_SCRIPT } from './cards/gleamingBarrier';
import { GLITTERMONGER_SCRIPT } from './cards/glittermonger';
import { FEYWILD_TRICKSTER_SCRIPT } from './cards/feywildTrickster';
import { FIELD_OF_SOULS_SCRIPT } from './cards/fieldOfSouls';
import { FIERCE_WITCHSTALKER_SCRIPT } from './cards/fierceWitchstalker';
import { FILIGREE_CRAWLER_SCRIPT } from './cards/filigreeCrawler';
import { FILIGREE_SAGES_SCRIPT } from './cards/filigreeSages';
import { FIRE_SNAKE_SCRIPT } from './cards/fireSnake';
import { FISK_TOWER_SCRIPT } from './cards/fiskTower';
import { FLAMEKIN_GILDWEAVER_SCRIPT } from './cards/flamekinGildweaver';
import { FLAMEKIN_SPITFIRE_SCRIPT } from './cards/flamekinSpitfire';
import { FLAMEWAVE_INVOKER_SCRIPT } from './cards/flamewaveInvoker';
import { FLOWSTONE_OVERSEER_SCRIPT } from './cards/flowstoneOverseer';
import { FODDER_CANNON_SCRIPT } from './cards/fodderCannon';
import { FOGGY_BOTTOM_SWAMP_SCRIPT } from './cards/foggyBottomSwamp';
import { FONT_OF_FORTUNES_SCRIPT } from './cards/fontOfFortunes';
import { FONT_OF_VIGOR_SCRIPT } from './cards/fontOfVigor';
import { FOOT_HEADQUARTERS_SCRIPT } from './cards/footHeadquarters';
import { FORECASTING_FORTUNE_TELLER_SCRIPT } from './cards/forecastingFortuneTeller';
import { FOUNDRY_OF_THE_CONSULS_SCRIPT } from './cards/foundryOfTheConsuls';
import { FOUNTAIN_OF_YOUTH_SCRIPT } from './cards/fountainOfYouth';
import { FRIENDLY_GHOST_SCRIPT } from './cards/friendlyGhost';
import { FROSTBRIDGE_GUARD_SCRIPT } from './cards/frostbridgeGuard';
import { ERTAI_THE_CORRUPTED_SCRIPT } from './cards/ertaiTheCorrupted';
import { ERTAI_WIZARD_ADEPT_SCRIPT } from './cards/ertaiWizardAdept';
import { ETHERIUM_ASTROLABE_SCRIPT } from './cards/etheriumAstrolabe';
import { ETHERIUM_SPINNER_SCRIPT } from './cards/etheriumSpinner';
import { EXCLUSION_MAGE_SCRIPT } from './cards/exclusionMage';
import { EXPERIMENTAL_AVIATOR_SCRIPT } from './cards/experimentalAviator';
import { EXULTANT_CULTIST_SCRIPT } from './cards/exultantCultist';
import { EYEBLIGHT_ASSASSIN_SCRIPT } from './cards/eyeblightAssassin';
import { FAERIE_DUELIST_SCRIPT } from './cards/faerieDuelist';
import { FAERIE_FORMATION_SCRIPT } from './cards/faerieFormation';
import { FALCON_ABOMINATION_SCRIPT } from './cards/falconAbomination';
import { FALKENRATH_CELEBRANTS_SCRIPT } from './cards/falkenrathCelebrants';
import { FALLAJI_VANGUARD_SCRIPT } from './cards/fallajiVanguard';
import { FALLEN_FERROMANCER_SCRIPT } from './cards/fallenFerromancer';
import { FAN_BEARER_SCRIPT } from './cards/fanBearer';
import { FARBOG_BONEFLINGER_SCRIPT } from './cards/farbogBoneflinger';
import { FEATHERBRAINED_FILCHER_SCRIPT } from './cards/featherbrainedFilcher';
import { FELIDAR_CUB_SCRIPT } from './cards/felidarCub';
import { FEMEREF_ENCHANTRESS_SCRIPT } from './cards/femerefEnchantress';
import { FERAL_PROWLER_SCRIPT } from './cards/feralProwler';
import { FEROCIOUS_PUP_SCRIPT } from './cards/ferociousPup';
import { FESTERING_GOBLIN_SCRIPT } from './cards/festeringGoblin';
import { FEVERED_CONVULSIONS_SCRIPT } from './cards/feveredConvulsions';
import { EDGEWALL_INNKEEPER_SCRIPT } from './cards/edgewallInnkeeper';
import { EFFICIENT_CONSTRUCTION_SCRIPT } from './cards/efficientConstruction';
import { EIDOLON_OF_INSPIRATION_SCRIPT } from './cards/eidolonOfInspiration';
import { EIDOLON_OF_PHILOSOPHY_SCRIPT } from './cards/eidolonOfPhilosophy';
import { ELDER_AUNTIE_SCRIPT } from './cards/elderAuntie';
import { ELDERLEAF_MENTOR_SCRIPT } from './cards/elderleafMentor';
import { ELEMENTAL_BOND_SCRIPT } from './cards/elementalBond';
import { ELF_REPLICA_SCRIPT } from './cards/elfReplica';
import { ELGAUD_INQUISITOR_SCRIPT } from './cards/elgaudInquisitor';
import { ELITE_ARRESTER_SCRIPT } from './cards/eliteArrester';
import { ELITE_HEADHUNTER_SCRIPT } from './cards/eliteHeadhunter';
import { ELTURGARD_RANGER_SCRIPT } from './cards/elturgardRanger';
import { ELVEN_LYRE_SCRIPT } from './cards/elvenLyre';
import { ELVISH_HEXHUNTER_SCRIPT } from './cards/elvishHexhunter';
import { ELVISH_LYRIST_SCRIPT } from './cards/elvishLyrist';
import { ELVISH_SCRAPPER_SCRIPT } from './cards/elvishScrapper';
import { ELVISH_VISIONARY_SCRIPT } from './cards/elvishVisionary';
import { EMMARA_SOUL_OF_THE_ACCORD_SCRIPT } from './cards/emmaraSoulOfTheAccord';
import { EMRAKULS_INFLUENCE_SCRIPT } from './cards/emrakulsInfluence';
import { ENATU_GOLEM_SCRIPT } from './cards/enatuGolem';
import { ENCHANTRESSS_PRESENCE_SCRIPT } from './cards/enchantresssPresence';
import { ENLIGHTENED_MANIAC_SCRIPT } from './cards/enlightenedManiac';
import { ENVOY_OF_OKINEC_AHAU_SCRIPT } from './cards/envoyOfOkinecAhau';
import { EPHARAS_WARDEN_SCRIPT } from './cards/epharasWarden';
import { ERRANT_DOOMSAYERS_SCRIPT } from './cards/errantDoomsayers';
import { DOOMED_TRAVELER_SCRIPT } from './cards/doomedTraveler';
import { DRACONIC_DISCIPLE_SCRIPT } from './cards/draconicDisciple';
import { DRAGON_BLOOD_SCRIPT } from './cards/dragonBlood';
import { DRAGON_ROOST_SCRIPT } from './cards/dragonRoost';
import { DRAGON_TRAINER_SCRIPT } from './cards/dragonTrainer';
import { DRAGONLAIR_SPIDER_SCRIPT } from './cards/dragonlairSpider';
import { DRAGOONS_WYVERN_SCRIPT } from './cards/dragoonsWyvern';
import { DREAMSTONE_HEDRON_SCRIPT } from './cards/dreamstoneHedron';
import { DRIDER_SCRIPT } from './cards/drider';
import { DRIVER_OF_THE_DEAD_SCRIPT } from './cards/driverOfTheDead';
import { DROGSKOL_REAVER_SCRIPT } from './cards/drogskolReaver';
import { DRUID_LYRIST_SCRIPT } from './cards/druidLyrist';
import { DRUID_OF_HORNS_SCRIPT } from './cards/druidOfHorns';
import { DUNES_OF_THE_DEAD_SCRIPT } from './cards/dunesOfTheDead';
import { DWARVEN_CASTLE_GUARD_SCRIPT } from './cards/dwarvenCastleGuard';
import { DWARVEN_MINE_SCRIPT } from './cards/dwarvenMine';
import { EAGER_TRUFFLESNOUT_SCRIPT } from './cards/eagerTrufflesnout';
import { EARTHBLIGHTER_SCRIPT } from './cards/earthblighter';
import { DEEPWOOD_TANTIV_SCRIPT } from './cards/deepwoodTantiv';
import { DESECRATED_TOMB_SCRIPT } from './cards/desecratedTomb';
import { DESOLATION_TWIN_SCRIPT } from './cards/desolationTwin';
import { DIAMOND_MARE_SCRIPT } from './cards/diamondMare';
import { DOOMED_NECROMANCER_SCRIPT } from './cards/doomedNecromancer';
import { DERANGED_OUTCAST_SCRIPT } from './cards/derangedOutcast';
import { DESTRUCTIVE_DIGGER_SCRIPT } from './cards/destructiveDigger';
import { DEVOTEE_OF_STRENGTH_SCRIPT } from './cards/devoteeOfStrength';
import { DEVOUT_MONK_SCRIPT } from './cards/devoutMonk';
import { DIMENSION_X_SCRIPT } from './cards/dimensionX';
import { DIMIR_CLUESTONE_SCRIPT } from './cards/dimirCluestone';
import { DIMIR_LOCKET_SCRIPT } from './cards/dimirLocket';
import { DIRE_FLEET_HOARDER_SCRIPT } from './cards/direFleetHoarder';
import { DISCORDANT_PIPER_SCRIPT } from './cards/discordantPiper';
import { DISEASE_CARRIERS_SCRIPT } from './cards/diseaseCarriers';
import { DISMAL_BACKWATER_SCRIPT } from './cards/dismalBackwater';
import { DISPELLERS_CAPSULE_SCRIPT } from './cards/dispellersCapsule';
import { DISPERSING_ORB_SCRIPT } from './cards/dispersingOrb';
import { DOCKSIDE_CHEF_SCRIPT } from './cards/docksideChef';
import { DOOMED_DISSENTER_SCRIPT } from './cards/doomedDissenter';
import { CULT_OF_THE_WAXING_MOON_SCRIPT } from './cards/cultOfTheWaxingMoon';
import { CULTBRAND_CINDER_SCRIPT } from './cards/cultbrandCinder';
import { CUNNING_SPARKMAGE_SCRIPT } from './cards/cunningSparkmage';
import { D_AVENANT_TRAPPER_SCRIPT } from './cards/dAvenantTrapper';
import { DARING_APPRENTICE_SCRIPT } from './cards/daringApprentice';
import { DARK_HEART_OF_THE_WOOD_SCRIPT } from './cards/darkHeartOfTheWood';
import { DARKSLICK_DRAKE_SCRIPT } from './cards/darkslickDrake';
import { DAUNTLESS_AVEN_SCRIPT } from './cards/dauntlessAven';
import { DAUNTLESS_SURVIVOR_SCRIPT } from './cards/dauntlessSurvivor';
import { DAWNHART_GEIST_SCRIPT } from './cards/dawnhartGeist';
import { DAWNHART_REJUVENATOR_SCRIPT } from './cards/dawnhartRejuvenator';
import { DAWNING_ANGEL_SCRIPT } from './cards/dawningAngel';
import { DAYBREAK_CHARGER_SCRIPT } from './cards/daybreakCharger';
import { DAYBREAK_COMBATANTS_SCRIPT } from './cards/daybreakCombatants';
import { DAYSQUAD_MARSHAL_SCRIPT } from './cards/daysquadMarshal';
import { DAZZLING_ANGEL_SCRIPT } from './cards/dazzlingAngel';
import { DAZZLING_RAMPARTS_SCRIPT } from './cards/dazzlingRamparts';
import { DEADAPULT_SCRIPT } from './cards/deadapult';
import { DEADEYE_DUELIST_SCRIPT } from './cards/deadeyeDuelist';
import { DEATHBLOOM_THALLID_SCRIPT } from './cards/deathbloomThallid';
import { DEDICATED_MARTYR_SCRIPT } from './cards/dedicatedMartyr';
import { DEEPROOT_PILGRIMAGE_SCRIPT } from './cards/deeprootPilgrimage';
import { DEEPROOT_WATERS_SCRIPT } from './cards/deeprootWaters';
import { AGENT_OF_SHAUKU_SCRIPT } from './cards/agentOfShauku';
import { AKKI_SCRAPCHOMPER_SCRIPT } from './cards/akkiScrapchomper';
import { ARMS_DEALER_SCRIPT } from './cards/armsDealer';
import { ARMY_ANTS_SCRIPT } from './cards/armyAnts';
import { AURA_FRACTURE_SCRIPT } from './cards/auraFracture';
import { BARRAGE_OF_EXPENDABLES_SCRIPT } from './cards/barrageOfExpendables';
import { BARRAGE_OGRE_SCRIPT } from './cards/barrageOgre';
import { BARRIN_MASTER_WIZARD_SCRIPT } from './cards/barrinMasterWizard';
import { BLAZING_HELLHOUND_SCRIPT } from './cards/blazingHellhound';
import { BLOOD_RITES_SCRIPT } from './cards/bloodRites';
import { BOG_NAUGHTY_SCRIPT } from './cards/bogNaughty';
import { CEPHALID_SCOUT_SCRIPT } from './cards/cephalidScout';
import { CONTEMPLATION_SCRIPT } from './cards/contemplation';
import { CORAL_BARRIER_SCRIPT } from './cards/coralBarrier';
import { COUNCIL_OF_ADVISORS_SCRIPT } from './cards/councilOfAdvisors';
import { COURIER_GRIFFIN_SCRIPT } from './cards/courierGriffin';
import { COURIERS_CAPSULE_SCRIPT } from './cards/couriersCapsule';
import { COURT_STREET_DENIZEN_SCRIPT } from './cards/courtStreetDenizen';
import { CRENELLATED_WALL_SCRIPT } from './cards/crenellatedWall';
import { CRESTED_HERDCALLER_SCRIPT } from './cards/crestedHerdcaller';
import { CRIMSON_CARAVANEER_SCRIPT } from './cards/crimsonCaravaneer';
import { CROCODILE_OF_THE_CROSSING_SCRIPT } from './cards/crocodileOfTheCrossing';
import { CRUSTACEAN_COMMANDO_SCRIPT } from './cards/crustaceanCommando';
import { AHRIMAN_SCRIPT } from './cards/ahriman';
import { CARNAGE_ALTAR_SCRIPT } from './cards/carnageAltar';
import { CLAWS_OF_GIX_SCRIPT } from './cards/clawsOfGix';
import { CELESTIAL_FORCE_SCRIPT } from './cards/celestialForce';
import { CENTAUR_GLADE_SCRIPT } from './cards/centaurGlade';
import { CENTAUR_HEALER_SCRIPT } from './cards/centaurHealer';
import { CENTAUR_NURTURER_SCRIPT } from './cards/centaurNurturer';
import { CENTAURS_HERALD_SCRIPT } from './cards/centaursHerald';
import { CHANDRAS_MAGMUTT_SCRIPT } from './cards/chandrasMagmutt';
import { CHECKPOINT_OFFICER_SCRIPT } from './cards/checkpointOfficer';
import { CHILD_OF_THORNS_SCRIPT } from './cards/childOfThorns';
import { CHIMNEY_RABBLE_SCRIPT } from './cards/chimneyRabble';
import { CHROME_PROWLER_SCRIPT } from './cards/chromeProwler';
import { CITY_PIGEON_SCRIPT } from './cards/cityPigeon';
import { CLARION_CATHARS_SCRIPT } from './cards/clarionCathars';
import { CLOCKWORK_DRAWBRIDGE_SCRIPT } from './cards/clockworkDrawbridge';
import { CLOUDCHASER_EAGLE_SCRIPT } from './cards/cloudchaserEagle';
import { CLOUDKIN_SEER_SCRIPT } from './cards/cloudkinSeer';
import { COGWORK_WRESTLER_SCRIPT } from './cards/cogworkWrestler';
import { COMMANDERS_SPHERE_SCRIPT } from './cards/commandersSphere';
import { COMMON_CROOK_SCRIPT } from './cards/commonCrook';
import { CONCLAVE_CAVALIER_SCRIPT } from './cards/conclaveCavalier';
import { CONSCRIPTED_INFANTRY_SCRIPT } from './cards/conscriptedInfantry';
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
  EPIC_CONFRONTATION_SCRIPT,
  ESSENCE_BACKLASH_SCRIPT,
  ESSENCE_DRAIN_SCRIPT,
  ESSENCE_EXTRACTION_SCRIPT,
  ESSENCE_HARVEST_SCRIPT,
  ETERNAL_FLAME_SCRIPT,
  EVACUATION_SCRIPT,
  EVAPORATE_SCRIPT,
  EXCOMMUNICATE_SCRIPT,
  EXOTIC_DISEASE_SCRIPT,
  EXPONENTIAL_GROWTH_SCRIPT,
  EXSANGUINATE_SCRIPT,
  EXTINGUISH_ALL_HOPE_SCRIPT,
  EARLY_HARVEST_SCRIPT,
  EARTH_TREMOR_SCRIPT,
  EARTHQUAKE_SCRIPT,
  ECHOING_CALM_SCRIPT,
  ECHOING_COURAGE_SCRIPT,
  ECHOING_DECAY_SCRIPT,
  ECHOING_RUIN_SCRIPT,
  ELDRITCH_PACT_SCRIPT,
  ELEGANT_PARLOR_SCRIPT,
  ELVISH_HERDER_SCRIPT,
  EMPTY_THE_CATACOMBS_SCRIPT,
  END_HOSTILITIES_SCRIPT,
  END_THE_FESTIVITIES_SCRIPT,
  ENGULF_THE_SHORE_SCRIPT,
  ENRAGE_SCRIPT,
  DIVINE_OFFERING_SCRIPT,
  DOGPILE_SCRIPT,
  DONATE_SCRIPT,
  DOUBLE_TROUBLE_SCRIPT,
  DOUSE_IN_GLOOM_SCRIPT,
  DRAG_DOWN_SCRIPT,
  DRAG_TO_THE_BOTTOM_SCRIPT,
  DRAMATIC_REVERSAL_SCRIPT,
  DROWN_IN_SORROW_SCRIPT,
  DRY_SPELL_SCRIPT,
  DUST_TO_DUST_SCRIPT,
  DWARVEN_CATAPULT_SCRIPT,
  DESPOIL_SCRIPT,
  DESTROY_THE_EVIDENCE_SCRIPT,
  DESTRUCTIVE_REVELRY_SCRIPT,
  DESYNCHRONIZATION_SCRIPT,
  DEVASTATE_SCRIPT,
  DEVASTATION_SCRIPT,
  DEVOUR_IN_SHADOW_SCRIPT,
  DIMIR_INFORMANT_SCRIPT,
  DINOTOMATON_SCRIPT,
  DIRE_TACTICS_SCRIPT,
  DIRESIGHT_SCRIPT,
  DISARM_SCRIPT,
  DISEMPOWER_SCRIPT,
  DISORDER_SCRIPT,
  DISPERSAL_SHIELD_SCRIPT,
  DISPLACEMENT_WAVE_SCRIPT,
  DEBT_TO_THE_DEATHLESS_SCRIPT,
  DECIMATE_SCRIPT,
  DECLARATION_IN_STONE_SCRIPT,
  DECONSTRUCT_SCRIPT,
  DEDUCE_SCRIPT,
  DEFIBRILLATING_CURRENT_SCRIPT,
  DEFILE_SCRIPT,
  DELETE_SCRIPT,
  DELUGE_SCRIPT,
  DELUGE_OF_DOOM_SCRIPT,
  DEMOLISH_SCRIPT,
  DEMONS_DUE_SCRIPT,
  DEPOPULATE_SCRIPT,
  DEPRESSURIZE_SCRIPT,
  DESECRATION_PLAGUE_SCRIPT,
  DESERT_SANDSTORM_SCRIPT,
  DESERTS_DUE_SCRIPT,
  DAKMOR_PLAGUE_SCRIPT,
  DAMNABLE_PACT_SCRIPT,
  DANGEROUS_WAGER_SCRIPT,
  DARK_DEAL_SCRIPT,
  DARKSTEEL_PENDANT_SCRIPT,
  DAUTHI_EMBRACE_SCRIPT,
  DAUTHI_TRAPPER_SCRIPT,
  DAY_OF_JUDGMENT_SCRIPT,
  DEAD_OF_WINTER_SCRIPT,
  DEADLY_TEMPEST_SCRIPT,
  DEATH_BEGETS_LIFE_SCRIPT,
  DEATH_GRASP_SCRIPT,
  DEATH_WIND_SCRIPT,
  DEATHS_CARESS_SCRIPT,
  DEATHLESS_ANGEL_SCRIPT,
  CORRUPT_SCRIPT,
  CORRUPTED_RESOLVE_SCRIPT,
  COSMIC_EPIPHANY_SCRIPT,
  COWER_IN_FEAR_SCRIPT,
  CREEPING_CORROSION_SCRIPT,
  CREEPING_MOLD_SCRIPT,
  CRIMSON_MAGE_SCRIPT,
  CRUEL_BARGAIN_SCRIPT,
  CRUEL_TRUTHS_SCRIPT,
  CRUEL_WITNESS_SCRIPT,
  CRUMBLE_SCRIPT,
  CRUSHING_DISAPPOINTMENT_SCRIPT,
  CRYPT_INCURSION_SCRIPT,
  CRYSTAL_BALL_SCRIPT,
  CULLING_SUN_SCRIPT,
  CUT_ADEAL_SCRIPT,
  CLOUDSHIFT_SCRIPT,
  COLLECTIVE_UNCONSCIOUS_SCRIPT,
  COMBAT_PROFESSOR_SCRIPT,
  COMMERCIAL_DISTRICT_SCRIPT,
  COMPLEAT_DEVOTION_SCRIPT,
  CONFRONT_THE_UNKNOWN_SCRIPT,
  CONGREGATE_SCRIPT,
  CONSIGN_TO_THE_PIT_SCRIPT,
  CONSUME_THE_MEEK_SCRIPT,
  CONSUMING_ASHES_SCRIPT,
  CONSUMING_CORRUPTION_SCRIPT,
  CONTRABAND_KINGPIN_SCRIPT,
  CORROSIVE_GALE_SCRIPT,
  CHANDRAS_FURY_SCRIPT,
  CHANDRAS_OUTRAGE_SCRIPT,
  CHANNEL_THE_SUNS_SCRIPT,
  CHAOTIC_BACKLASH_SCRIPT,
  CHASM_DRAKE_SCRIPT,
  CHILLING_TRAP_SCRIPT,
  CHROME_CAT_SCRIPT,
  CHURNING_EDDY_SCRIPT,
  CINDER_CLOUD_SCRIPT,
  CITYWATCH_SPHINX_SCRIPT,
  CITYWIDE_BUST_SCRIPT,
  CLEANFALL_SCRIPT,
  CLEANSING_BEAM_SCRIPT,
  CLEAR_SHOT_SCRIPT,
  CLEAR_THE_LAND_SCRIPT,
  CLOUDKILL_SCRIPT,
  CLOUDREADER_SPHINX_SCRIPT,
  BRONZE_WALRUS_SCRIPT,
  BURDEN_OF_GREED_SCRIPT,
  BURN_THE_IMPURE_SCRIPT,
  BURNING_CLOAK_SCRIPT,
  BURNING_FIELDS_SCRIPT,
  CALAMITOUS_CAVE_IN_SCRIPT,
  CALL_TO_HEEL_SCRIPT,
  CALLER_OF_GALES_SCRIPT,
  CALMING_VERSE_SCRIPT,
  CARESS_OF_PHYREXIA_SCRIPT,
  CASE_THE_JOINT_SCRIPT,
  CASTLE_VANTRESS_SCRIPT,
  CAVALRY_DRILLMASTER_SCRIPT,
  CEREBRAL_DOWNLOAD_SCRIPT,
  CERTAIN_DEATH_SCRIPT,
  CHAIN_REACTION_SCRIPT,
  BOLTWAVE_SCRIPT,
  BOON_OF_BOSEIJU_SCRIPT,
  BORROWING_ARROWS_SCRIPT,
  BORROWING_THE_EAST_WIND_SCRIPT,
  BOULDERBORN_DRAGON_SCRIPT,
  BOUNTIFUL_HARVEST_SCRIPT,
  BRAINGEYSER_SCRIPT,
  BREAK_THE_SPELL_SCRIPT,
  BREATH_OF_MALFEGOR_SCRIPT,
  BREATH_WEAPON_SCRIPT,
  BREATHE_YOUR_LAST_SCRIPT,
  BRIGHTFLAME_SCRIPT,
  BRIGHTSTONE_RITUAL_SCRIPT,
  BIORHYTHM_SCRIPT,
  BITE_DOWN_SCRIPT,
  BLASTFIRE_BOLT_SCRIPT,
  BLAZE_SCRIPT,
  BLAZING_VOLLEY_SCRIPT,
  BLESSED_REVERSAL_SCRIPT,
  BLESSED_WIND_SCRIPT,
  BLINDING_LIGHT_SCRIPT,
  BLOOD_LUST_SCRIPT,
  BLOOD_MIST_SCRIPT,
  BLOOD_PACT_SCRIPT,
  BLOOD_TITHE_SCRIPT,
  BLOODCURDLING_SCREAM_SCRIPT,
  BLOODLUST_INCITER_SCRIPT,
  BLOODTHORN_TAUNTER_SCRIPT,
  BLOSSOMING_WREATH_SCRIPT,
  BOIL_SCRIPT,
  BOILING_SEAS_SCRIPT,
  AXGARD_CAVALRY_SCRIPT,
  BACK_TO_NATURE_SCRIPT,
  BAKIS_CURSE_SCRIPT,
  BALANCE_OF_POWER_SCRIPT,
  BALEFUL_STARE_SCRIPT,
  BANISHMENT_DECREE_SCRIPT,
  BARRIER_OF_BONES_SCRIPT,
  BARRINS_UNMAKING_SCRIPT,
  BATTLE_HYMN_SCRIPT,
  BATTLE_RAMPART_SCRIPT,
  BATTLEFLIGHT_EAGLE_SCRIPT,
  BATTLESONG_BERSERKER_SCRIPT,
  BEACON_BEHEMOTH_SCRIPT,
  BEAST_HUNT_SCRIPT,
  BEWILDERING_BLIZZARD_SCRIPT,
  BEYOND_THE_QUIET_SCRIPT,
  BILE_BLIGHT_SCRIPT,
  AUGURY_OWL_SCRIPT,
  ARCHIVE_DRAGON_SCRIPT,
  AUTOMATIC_LIBRARIAN_SCRIPT,
  ARTIFICERS_ASSISTANT_SCRIPT,
  ATTENTIVE_SUNSCRIBE_SCRIPT,
  APPENDAGE_AMALGAM_SCRIPT,
  ARMAGEDDON_SCRIPT,
  AURA_BARBS_SCRIPT,
  ASPECT_OF_HYDRA_SCRIPT,
  ARMY_OF_ALLAH_SCRIPT,
  AUSPICIOUS_ARRIVAL_SCRIPT,
  ASHEN_POWDER_SCRIPT,
  ARBOREA_PEGASUS_SCRIPT,
  APOCALYPSE_SCRIPT,
  ARMS_OF_HADAR_SCRIPT,
  AMBITIONS_COST_SCRIPT,
  ANCIENT_CRAVING_SCRIPT,
  AGONIZING_SYPHON_SCRIPT,
  ALABASTER_MAGE_SCRIPT,
  AKKI_DRILLMASTER_SCRIPT,
  AETHERIZE_SCRIPT,
  AIRBORNE_AID_SCRIPT,
  ANCHOR_TO_THE_AETHER_SCRIPT,
  AMNESIA_SCRIPT,
  AETHER_TRADEWINDS_SCRIPT,
  ANARCHY_SCRIPT,
  AGGRESSIVE_INSTINCT_SCRIPT,
  AMBUSCADE_SCRIPT,
  ANGELHEART_PROTECTOR_SCRIPT,
  ALPHA_BRAWL_SCRIPT,
  AN_HAVVA_INN_SCRIPT,
  ALLIED_STRATEGIES_SCRIPT,
  TERMINATE_SCRIPT,
  WRATH_OF_GOD_SCRIPT,
  WAVE_OF_RECKONING_SCRIPT,
  SWORDS_TO_PLOWSHARES_SCRIPT,
  ETERNAL_ISOLATION_SCRIPT,
  ACID_RAIN_SCRIPT,
  ACIDIC_SOIL_SCRIPT,
  ACCUMULATED_KNOWLEDGE_SCRIPT,
  GITAXIAN_PROBE_SCRIPT,
  WHEEL_OF_FORTUNE_SCRIPT,
  ACCELERATED_MUTATION_SCRIPT,
  TEMPLE_OF_MALICE_SCRIPT,
  ZHALFIRIN_VOID_SCRIPT,
  ADVANCE_SCOUT_SCRIPT,
  SPEARBREAKER_BEHEMOTH_SCRIPT,
  DOOM_WHISPERER_SCRIPT,
  AIM_SYNTHOIDS_SCRIPT,
  DARK_RITUAL_SCRIPT,
  PYRETIC_RITUAL_SCRIPT,
  SEETHING_SONG_SCRIPT,
  MANA_GEYSER_SCRIPT,
  INFERNAL_GRASP_SCRIPT,
  NIGHTS_WHISPER_SCRIPT,
  DAMNATION_SCRIPT,
  FUMIGATE_SCRIPT,
  SLASH_THE_RANKS_SCRIPT,
  FELL_THE_MIGHTY_SCRIPT,
  SOLAR_BLAZE_SCRIPT,
  PREY_UPON_SCRIPT,
  RABID_BITE_SCRIPT,
  CHANDRAS_IGNITION_SCRIPT,
  SQUALL_LINE_SCRIPT,
  RECKLESS_RAGE_SCRIPT,
  MAN_OWAR_SCRIPT,
  MANDROID_SQUADRON_SCRIPT,
  MANIC_VANDAL_SCRIPT,
  MARBLE_CHALICE_SCRIPT,
  MARDU_BANNER_SCRIPT,
  MARTYR_OF_DUSK_SCRIPT,
  MASTER_DECOY_SCRIPT,
  MAUSOLEUM_GUARD_SCRIPT,
  MAVREN_FEIN_DUSK_APOSTLE_SCRIPT,
  MAWCOR_SCRIPT,
  MECHANIZED_NINJA_CAVALRY_SCRIPT,
  MEDITATION_POOLS_SCRIPT,
  MELTSTRIDER_EULOGIST_SCRIPT,
  MEMORIAL_TO_FOLLY_SCRIPT,
  MEMORIAL_TO_GENIUS_SCRIPT,
  MEMORIAL_TO_GLORY_SCRIPT,
  MEMORIAL_TO_WAR_SCRIPT,
  MERCHANT_OF_SECRETS_SCRIPT,
  MERFOLK_SKYSCOUT_SCRIPT,
  MERIADOC_BRANDYBUCK_SCRIPT,
  // M6.4ae (D187–D190) — the engine unlocks' proof cards: the first two
  // SpellDefs (Char, Fruition) and the DrewCards × per-item fan-out
  // composition (Horizon Chimera).
  CHAR_SCRIPT,
  FRUITION_SCRIPT,
  HORIZON_CHIMERA_SCRIPT,
  LIBRARY_LARCENIST_SCRIPT,
  LIFECREED_DUO_SCRIPT,
  LIVING_LIGHTNING_SCRIPT,
  LLANOWAR_VISIONARY_SCRIPT,
  LONE_MISSIONARY_SCRIPT,
  LONG_FENG_GRAND_SECRETARIAT_SCRIPT,
  LOS_DIABLOS_MISSILE_BASE_SCRIPT,
  LOXODON_MYSTIC_SCRIPT,
  LUKE_CAGE_HERO_FOR_HIRE_SCRIPT,
  LUMINARCH_ASPIRANT_SCRIPT,
  MAALFELD_TWINS_SCRIPT,
  MADAME_HYDRA_SCRIPT,
  MAKESHIFT_MUNITIONS_SCRIPT,
  MALCATORS_WATCHER_SCRIPT,
  MALEVOLENT_AWAKENING_SCRIPT,
  KELDON_NECROPOLIS_SCRIPT,
  KEMBAS_SKYGUARD_SCRIPT,
  KHALNI_GARDEN_SCRIPT,
  KINDLY_CUSTOMER_SCRIPT,
  KINGFISHER_SCRIPT,
  KINGPINS_ENFORCERS_SCRIPT,
  KINSBAILE_SKIRMISHER_SCRIPT,
  KNIGHT_OF_DOVES_SCRIPT,
  KNIGHT_OF_THE_NEW_COALITION_SCRIPT,
  KNIGHTFISHER_SCRIPT,
  KOALA_SHEEP_SCRIPT,
  KOR_CELEBRANT_SCRIPT,
  KOR_LINE_SLINGER_SCRIPT,
  KUJAR_SEEDSCULPTOR_SCRIPT,
  KYOSHI_VILLAGE_SCRIPT,
  KYOSHI_WARRIORS_SCRIPT,
  LAW_RUNE_ENFORCER_SCRIPT,
  LAWLESS_BROKER_SCRIPT,
  LETTER_OF_ACCEPTANCE_SCRIPT,
  LEY_DRUID_SCRIPT,
  JEWEL_THIEF_SCRIPT,
  JEWEL_EYED_COBRA_SCRIPT,
  JHOIRA_WEATHERLIGHT_CAPTAIN_SCRIPT,
  JORAGA_VISIONARY_SCRIPT,
  JUNGLE_BARRIER_SCRIPT,
  JUNGLE_HOLLOW_SCRIPT,
  JUNGLEBORN_PIONEER_SCRIPT,
  JUNIPER_ORDER_DRUID_SCRIPT,
  JUNKTOWN_SCRIPT,
  JWAR_ISLE_REFUGE_SCRIPT,
  KABIRA_CROSSROADS_SCRIPT,
  KABUTO_MOTH_SCRIPT,
  KAMAHL_PIT_FIGHTER_SCRIPT,
  KAMI_OF_ANCIENT_LAW_SCRIPT,
  KAMI_OF_TWISTED_REFLECTION_SCRIPT,
  KAPSHO_KITEFINS_SCRIPT,
  KAVU_CLIMBER_SCRIPT,
  KAZANDU_REFUGE_SCRIPT,
  KEENING_APPARITION_SCRIPT,
  KEENING_BANSHEE_SCRIPT,
  KEEPER_OF_FABLES_SCRIPT,
  INSPIRED_INSURGENT_SCRIPT,
  INSPIRING_CLERIC_SCRIPT,
  INTREPID_HERO_SCRIPT,
  INVASION_REINFORCEMENTS_SCRIPT,
  IRON_BULLY_SCRIPT,
  IRONPAW_ASPIRANT_SCRIPT,
  IRONSHELL_BEETLE_SCRIPT,
  ITHILIEN_KINGFISHER_SCRIPT,
  IVY_LANE_DENIZEN_SCRIPT,
  IZZET_CHRONARCH_SCRIPT,
  IZZET_CLUESTONE_SCRIPT,
  IZZET_LOCKET_SCRIPT,
  JADE_MAGE_SCRIPT,
  JADECRAFT_ARTISAN_SCRIPT,
  JANDORS_SADDLEBAGS_SCRIPT,
  JARVIS_EARTHS_MIGHTIEST_BUTLER_SCRIPT,
  JAYEMDAE_TOME_SCRIPT,
  JEDIT_OJANEN_OF_EFRAVA_SCRIPT,
  JEDITS_DRAGOONS_SCRIPT,
  JEONG_JEONGS_DESERTERS_SCRIPT,
  JESKA_WARRIOR_ADEPT_SCRIPT,
  JESKAI_BANNER_SCRIPT,
  HORNET_HARASSER_SCRIPT,
  HORNET_QUEEN_SCRIPT,
  HOT_DOG_CART_SCRIPT,
  HOWLING_GIANT_SCRIPT,
  HUMBLING_ELDER_SCRIPT,
  HUNTED_WITNESS_SCRIPT,
  HURLER_CYCLOPS_SCRIPT,
  HYRAX_TOWER_SCOUT_SCRIPT,
  ICATIAN_PRIEST_SCRIPT,
  ICERIDGE_SERPENT_SCRIPT,
  ICHOR_WELLSPRING_SCRIPT,
  IDYLLIC_GRANGE_SCRIPT,
  ILLEGITIMATE_BUSINESS_SCRIPT,
  ILLVOI_GALEBLADE_SCRIPT,
  IMPASSIONED_ORATOR_SCRIPT,
  IMPERIAL_SUBDUER_SCRIPT,
  INDRIK_STOMPHOWLER_SCRIPT,
  INFECTIOUS_HOST_SCRIPT,
  INFESTATION_SAGE_SCRIPT,
  INSIGHT_SCRIPT,
  HARRIER_GRIFFIN_SCRIPT,
  HATCHING_PLANS_SCRIPT,
  HEAD_OF_THE_HOMESTEAD_SCRIPT,
  HEADLESS_RIDER_SCRIPT,
  HEALER_OF_THE_GLADE_SCRIPT,
  HEALER_OF_THE_PRIDE_SCRIPT,
  HEART_WARDEN_SCRIPT,
  HEARTWOOD_GIANT_SCRIPT,
  HEAVY_INFANTRY_SCRIPT,
  HELLS_KITCHEN_SCRIPT,
  HELPFUL_HUNTER_SCRIPT,
  HERALD_OF_FAITH_SCRIPT,
  HERALD_OF_THE_FAIR_SCRIPT,
  HERO_OF_PRECINCT_ONE_SCRIPT,
  HIGH_MARKET_SCRIPT,
  HIGHLAND_GAME_SCRIPT,
  HILL_GIANT_HERDGORGER_SCRIPT,
  HINTERLAND_SANCTIFIER_SCRIPT,
  HOARD_ROBBER_SCRIPT,
  HOBBLING_ZOMBIE_SCRIPT,
  HONEY_MAMMOTH_SCRIPT,
  GRASPING_LONGNECK_SCRIPT,
  GRAVE_TITAN_SCRIPT,
  GRAYPELT_REFUGE_SCRIPT,
  GREED_SCRIPT,
  GRIM_BACKWOODS_SCRIPT,
  GRIM_PHYSICIAN_SCRIPT,
  GRUUL_CLUESTONE_SCRIPT,
  GRUUL_LOCKET_SCRIPT,
  GRYFF_VANGUARD_SCRIPT,
  GUARDED_HEIR_SCRIPT,
  GUARDIAN_AUTOMATON_SCRIPT,
  GUARDIAN_OF_PILGRIMS_SCRIPT,
  GUTLESS_GHOUL_SCRIPT,
  GUUL_DRAZ_MUCKLORD_SCRIPT,
  HAAZDA_MARSHAL_SCRIPT,
  HAAZDA_OFFICER_SCRIPT,
  HAAZDA_VIGILANTE_SCRIPT,
  HAGRA_SHARPSHOOTER_SCRIPT,
  GNARLBACK_RHINO_SCRIPT,
  GNARLED_EFFIGY_SCRIPT,
  GNOTTVOLD_SLUMBERMOUND_SCRIPT,
  GOBLIN_ASSAULT_TEAM_SCRIPT,
  GOBLIN_BOMBARDMENT_SCRIPT,
  GOBLIN_FIREBOMB_SCRIPT,
  GOBLIN_FIRESLINGER_SCRIPT,
  GOBLIN_GANG_LEADER_SCRIPT,
  GOBLIN_GARDENER_SCRIPT,
  GOBLIN_INSTIGATOR_SCRIPT,
  GOBLIN_REPLICA_SCRIPT,
  GOBLIN_SETTLER_SCRIPT,
  GOBLIN_SLEDDER_SCRIPT,
  GOBLIN_TRENCHES_SCRIPT,
  GODS_EYE_GATE_TO_THE_REIKAI_SCRIPT,
  GOLDMEADOW_HARRIER_SCRIPT,
  GOLGARI_CLUESTONE_SCRIPT,
  GOLGARI_GERMINATION_SCRIPT,
  GOLGARI_LOCKET_SCRIPT,
  GOLGARI_ROTWURM_SCRIPT,
  GRANDMOTHER_SENGIR_SCRIPT,
  FUGITIVE_DRUID_SCRIPT,
  FUME_SPITTER_SCRIPT,
  FYNDHORN_BROWNIE_SCRIPT,
  GALACTIC_WAYFARER_SCRIPT,
  GALLANT_CAVALRY_SCRIPT,
  GALLANT_CITIZEN_SCRIPT,
  GALVANIC_KEY_SCRIPT,
  GARGOYLE_CASTLE_SCRIPT,
  GARRISON_CAT_SCRIPT,
  GARRISON_EXCAVATOR_SCRIPT,
  GAVONY_TRAPPER_SCRIPT,
  GENEROUS_STRAY_SCRIPT,
  GENEROUS_VISITOR_SCRIPT,
  GENGHIS_FROG_SCRIPT,
  GHIRAPUR_GEARCRAFTER_SCRIPT,
  GHITU_WAR_CRY_SCRIPT,
  GHOST_WARDEN_SCRIPT,
  GHOSTS_OF_THE_DAMNED_SCRIPT,
  GIDEONS_LAWKEEPER_SCRIPT,
  GINGERBREAD_CABIN_SCRIPT,
  GLEAMING_BARRIER_SCRIPT,
  GLITTERMONGER_SCRIPT,
  FEYWILD_TRICKSTER_SCRIPT,
  FIELD_OF_SOULS_SCRIPT,
  FIERCE_WITCHSTALKER_SCRIPT,
  FILIGREE_CRAWLER_SCRIPT,
  FILIGREE_SAGES_SCRIPT,
  FIRE_SNAKE_SCRIPT,
  FISK_TOWER_SCRIPT,
  FLAMEKIN_GILDWEAVER_SCRIPT,
  FLAMEKIN_SPITFIRE_SCRIPT,
  FLAMEWAVE_INVOKER_SCRIPT,
  FLOWSTONE_OVERSEER_SCRIPT,
  FODDER_CANNON_SCRIPT,
  FOGGY_BOTTOM_SWAMP_SCRIPT,
  FONT_OF_FORTUNES_SCRIPT,
  FONT_OF_VIGOR_SCRIPT,
  FOOT_HEADQUARTERS_SCRIPT,
  FORECASTING_FORTUNE_TELLER_SCRIPT,
  FOUNDRY_OF_THE_CONSULS_SCRIPT,
  FOUNTAIN_OF_YOUTH_SCRIPT,
  FRIENDLY_GHOST_SCRIPT,
  FROSTBRIDGE_GUARD_SCRIPT,
  ERTAI_THE_CORRUPTED_SCRIPT,
  ERTAI_WIZARD_ADEPT_SCRIPT,
  ETHERIUM_ASTROLABE_SCRIPT,
  ETHERIUM_SPINNER_SCRIPT,
  EXCLUSION_MAGE_SCRIPT,
  EXPERIMENTAL_AVIATOR_SCRIPT,
  EXULTANT_CULTIST_SCRIPT,
  EYEBLIGHT_ASSASSIN_SCRIPT,
  FAERIE_DUELIST_SCRIPT,
  FAERIE_FORMATION_SCRIPT,
  FALCON_ABOMINATION_SCRIPT,
  FALKENRATH_CELEBRANTS_SCRIPT,
  FALLAJI_VANGUARD_SCRIPT,
  FALLEN_FERROMANCER_SCRIPT,
  FAN_BEARER_SCRIPT,
  FARBOG_BONEFLINGER_SCRIPT,
  FEATHERBRAINED_FILCHER_SCRIPT,
  FELIDAR_CUB_SCRIPT,
  FEMEREF_ENCHANTRESS_SCRIPT,
  FERAL_PROWLER_SCRIPT,
  FEROCIOUS_PUP_SCRIPT,
  FESTERING_GOBLIN_SCRIPT,
  FEVERED_CONVULSIONS_SCRIPT,
  EDGEWALL_INNKEEPER_SCRIPT,
  EFFICIENT_CONSTRUCTION_SCRIPT,
  EIDOLON_OF_INSPIRATION_SCRIPT,
  EIDOLON_OF_PHILOSOPHY_SCRIPT,
  ELDER_AUNTIE_SCRIPT,
  ELDERLEAF_MENTOR_SCRIPT,
  ELEMENTAL_BOND_SCRIPT,
  ELF_REPLICA_SCRIPT,
  ELGAUD_INQUISITOR_SCRIPT,
  ELITE_ARRESTER_SCRIPT,
  ELITE_HEADHUNTER_SCRIPT,
  ELTURGARD_RANGER_SCRIPT,
  ELVEN_LYRE_SCRIPT,
  ELVISH_HEXHUNTER_SCRIPT,
  ELVISH_LYRIST_SCRIPT,
  ELVISH_SCRAPPER_SCRIPT,
  ELVISH_VISIONARY_SCRIPT,
  EMMARA_SOUL_OF_THE_ACCORD_SCRIPT,
  EMRAKULS_INFLUENCE_SCRIPT,
  ENATU_GOLEM_SCRIPT,
  ENCHANTRESSS_PRESENCE_SCRIPT,
  ENLIGHTENED_MANIAC_SCRIPT,
  ENVOY_OF_OKINEC_AHAU_SCRIPT,
  EPHARAS_WARDEN_SCRIPT,
  ERRANT_DOOMSAYERS_SCRIPT,
  DOOMED_TRAVELER_SCRIPT,
  DRACONIC_DISCIPLE_SCRIPT,
  DRAGON_BLOOD_SCRIPT,
  DRAGON_ROOST_SCRIPT,
  DRAGON_TRAINER_SCRIPT,
  DRAGONLAIR_SPIDER_SCRIPT,
  DRAGOONS_WYVERN_SCRIPT,
  DREAMSTONE_HEDRON_SCRIPT,
  DRIDER_SCRIPT,
  DRIVER_OF_THE_DEAD_SCRIPT,
  DROGSKOL_REAVER_SCRIPT,
  DRUID_LYRIST_SCRIPT,
  DRUID_OF_HORNS_SCRIPT,
  DUNES_OF_THE_DEAD_SCRIPT,
  DWARVEN_CASTLE_GUARD_SCRIPT,
  DWARVEN_MINE_SCRIPT,
  EAGER_TRUFFLESNOUT_SCRIPT,
  EARTHBLIGHTER_SCRIPT,
  DEEPWOOD_TANTIV_SCRIPT,
  DESECRATED_TOMB_SCRIPT,
  DESOLATION_TWIN_SCRIPT,
  DIAMOND_MARE_SCRIPT,
  DOOMED_NECROMANCER_SCRIPT,
  DERANGED_OUTCAST_SCRIPT,
  DESTRUCTIVE_DIGGER_SCRIPT,
  DEVOTEE_OF_STRENGTH_SCRIPT,
  DEVOUT_MONK_SCRIPT,
  DIMENSION_X_SCRIPT,
  DIMIR_CLUESTONE_SCRIPT,
  DIMIR_LOCKET_SCRIPT,
  DIRE_FLEET_HOARDER_SCRIPT,
  DISCORDANT_PIPER_SCRIPT,
  DISEASE_CARRIERS_SCRIPT,
  DISMAL_BACKWATER_SCRIPT,
  DISPELLERS_CAPSULE_SCRIPT,
  DISPERSING_ORB_SCRIPT,
  DOCKSIDE_CHEF_SCRIPT,
  DOOMED_DISSENTER_SCRIPT,
  CULT_OF_THE_WAXING_MOON_SCRIPT,
  CULTBRAND_CINDER_SCRIPT,
  CUNNING_SPARKMAGE_SCRIPT,
  D_AVENANT_TRAPPER_SCRIPT,
  DARING_APPRENTICE_SCRIPT,
  DARK_HEART_OF_THE_WOOD_SCRIPT,
  DARKSLICK_DRAKE_SCRIPT,
  DAUNTLESS_AVEN_SCRIPT,
  DAUNTLESS_SURVIVOR_SCRIPT,
  DAWNHART_GEIST_SCRIPT,
  DAWNHART_REJUVENATOR_SCRIPT,
  DAWNING_ANGEL_SCRIPT,
  DAYBREAK_CHARGER_SCRIPT,
  DAYBREAK_COMBATANTS_SCRIPT,
  DAYSQUAD_MARSHAL_SCRIPT,
  DAZZLING_ANGEL_SCRIPT,
  DAZZLING_RAMPARTS_SCRIPT,
  DEADAPULT_SCRIPT,
  DEADEYE_DUELIST_SCRIPT,
  DEATHBLOOM_THALLID_SCRIPT,
  DEDICATED_MARTYR_SCRIPT,
  DEEPROOT_PILGRIMAGE_SCRIPT,
  DEEPROOT_WATERS_SCRIPT,
  AGENT_OF_SHAUKU_SCRIPT,
  AKKI_SCRAPCHOMPER_SCRIPT,
  ARMS_DEALER_SCRIPT,
  ARMY_ANTS_SCRIPT,
  AURA_FRACTURE_SCRIPT,
  BARRAGE_OF_EXPENDABLES_SCRIPT,
  BARRAGE_OGRE_SCRIPT,
  BARRIN_MASTER_WIZARD_SCRIPT,
  BLAZING_HELLHOUND_SCRIPT,
  BLOOD_RITES_SCRIPT,
  BOG_NAUGHTY_SCRIPT,
  CEPHALID_SCOUT_SCRIPT,
  CONTEMPLATION_SCRIPT,
  CORAL_BARRIER_SCRIPT,
  COUNCIL_OF_ADVISORS_SCRIPT,
  COURIER_GRIFFIN_SCRIPT,
  COURIERS_CAPSULE_SCRIPT,
  COURT_STREET_DENIZEN_SCRIPT,
  CRENELLATED_WALL_SCRIPT,
  CRESTED_HERDCALLER_SCRIPT,
  CRIMSON_CARAVANEER_SCRIPT,
  CROCODILE_OF_THE_CROSSING_SCRIPT,
  CRUSTACEAN_COMMANDO_SCRIPT,
  AHRIMAN_SCRIPT,
  CARNAGE_ALTAR_SCRIPT,
  CLAWS_OF_GIX_SCRIPT,
  CELESTIAL_FORCE_SCRIPT,
  CENTAUR_GLADE_SCRIPT,
  CENTAUR_HEALER_SCRIPT,
  CENTAUR_NURTURER_SCRIPT,
  CENTAURS_HERALD_SCRIPT,
  CHANDRAS_MAGMUTT_SCRIPT,
  CHECKPOINT_OFFICER_SCRIPT,
  CHILD_OF_THORNS_SCRIPT,
  CHIMNEY_RABBLE_SCRIPT,
  CHROME_PROWLER_SCRIPT,
  CITY_PIGEON_SCRIPT,
  CLARION_CATHARS_SCRIPT,
  CLOCKWORK_DRAWBRIDGE_SCRIPT,
  CLOUDCHASER_EAGLE_SCRIPT,
  CLOUDKIN_SEER_SCRIPT,
  COGWORK_WRESTLER_SCRIPT,
  COMMANDERS_SPHERE_SCRIPT,
  COMMON_CROOK_SCRIPT,
  CONCLAVE_CAVALIER_SCRIPT,
  CONSCRIPTED_INFANTRY_SCRIPT,
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
