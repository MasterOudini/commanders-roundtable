// The script registry, pre-indexed so the trigger bus never scans the board.
//
// ⚠️ `SHIPPED_REGISTRY` is what v1 ships. Every method on it returns an empty
// array or undefined, which is exactly what makes the rest of the engine work
// with no `if (scripted)` anywhere.

import type { CardScript, CombatDef, ReplacementDef, SpellDef, StaticDef, TriggerDef } from './api';
import type { EventKind } from '../types/events';
import type { OracleId } from '../types/ids';
import { TRAPFINDERS_TRICK_SCRIPT } from './cards/trapfindersTrick';
import { TRAVERSE_ETERNITY_SCRIPT } from './cards/traverseEternity';
import { TREASURE_DREDGER_SCRIPT } from './cards/treasureDredger';
import { TREASURE_HUNT_SCRIPT } from './cards/treasureHunt';
import { TREASURE_TROVE_SCRIPT } from './cards/treasureTrove';
import { TREETOP_FREEDOM_FIGHTERS_SCRIPT } from './cards/treetopFreedomFighters';
import { TREMOR_SCRIPT } from './cards/tremor';
import { TRIBAL_FLAMES_SCRIPT } from './cards/tribalFlames';
import { TRIP_NOOSE_SCRIPT } from './cards/tripNoose';
import { TRIUMPHANT_CHOMP_SCRIPT } from './cards/triumphantChomp';
import { TROPICAL_STORM_SCRIPT } from './cards/tropicalStorm';
import { TRUMPET_BLAST_SCRIPT } from './cards/trumpetBlast';
import { TSUNAMI_SCRIPT } from './cards/tsunami';
import { TUKATONGUE_THALLID_SCRIPT } from './cards/tukatongueThallid';
import { TUKNIR_DEATHLOCK_SCRIPT } from './cards/tuknirDeathlock';
import { TUNNEL_SURVEYOR_SCRIPT } from './cards/tunnelSurveyor';
import { TURA_KENNERUD_SKYKNIGHT_SCRIPT } from './cards/turaKennerudSkyknight';
import { TOLARIAN_WINDS_SCRIPT } from './cards/tolarianWinds';
import { TOMBFIRE_SCRIPT } from './cards/tombfire';
import { TOME_OF_THE_GUILDPACT_SCRIPT } from './cards/tomeOfTheGuildpact';
import { TOME_RAIDER_SCRIPT } from './cards/tomeRaider';
import { TORCH_FIEND_SCRIPT } from './cards/torchFiend';
import { TORCH_THE_WITNESS_SCRIPT } from './cards/torchTheWitness';
import { TORRENT_OF_FIRE_SCRIPT } from './cards/torrentOfFire';
import { TOUCAN_PUFFIN_SCRIPT } from './cards/toucanPuffin';
import { TOWER_OF_CALAMITIES_SCRIPT } from './cards/towerOfCalamities';
import { TOWER_OF_CHAMPIONS_SCRIPT } from './cards/towerOfChampions';
import { TOWER_OF_EONS_SCRIPT } from './cards/towerOfEons';
import { TOWER_OF_FORTUNES_SCRIPT } from './cards/towerOfFortunes';
import { TRAMWAY_STATION_SCRIPT } from './cards/tramwayStation';
import { TRANQUIL_COVE_SCRIPT } from './cards/tranquilCove';
import { TRANQUIL_DOMAIN_SCRIPT } from './cards/tranquilDomain';
import { TRANQUILITY_SCRIPT } from './cards/tranquility';
import { THRISS_NANTUKO_PRIMUS_SCRIPT } from './cards/thrissNantukoPrimus';
import { THUNDER_OF_HOOVES_SCRIPT } from './cards/thunderOfHooves';
import { THUNDERING_FALLS_SCRIPT } from './cards/thunderingFalls';
import { THUNDEROUS_SNAPPER_SCRIPT } from './cards/thunderousSnapper';
import { TIDE_SKIMMER_SCRIPT } from './cards/tideSkimmer';
import { TIDEPOOL_TURTLE_SCRIPT } from './cards/tidepoolTurtle';
import { TIDESPOUT_TYRANT_SCRIPT } from './cards/tidespoutTyrant';
import { TIDY_CONCLUSION_SCRIPT } from './cards/tidyConclusion';
import { TIMBERLAND_GUIDE_SCRIPT } from './cards/timberlandGuide';
import { TIME_EBB_SCRIPT } from './cards/timeEbb';
import { TIRELESS_MISSIONARIES_SCRIPT } from './cards/tirelessMissionaries';
import { TITANS_GRAVE_SCRIPT } from './cards/titansGrave';
import { TIVADARS_CRUSADE_SCRIPT } from './cards/tivadarsCrusade';
import { TOCASIAS_DIG_SITE_SCRIPT } from './cards/tocasiasDigSite';
import { TOIL_TO_RENOWN_SCRIPT } from './cards/toilToRenown';
import { THE_SURGICAL_BAY_SCRIPT } from './cards/theSurgicalBay';
import { THEFT_OF_DREAMS_SCRIPT } from './cards/theftOfDreams';
import { THEIR_NAME_IS_DEATH_SCRIPT } from './cards/theirNameIsDeath';
import { THEODEN_KING_OF_ROHAN_SCRIPT } from './cards/theodenKingOfRohan';
import { THERMOKARST_SCRIPT } from './cards/thermokarst';
import { THIEVING_MAGPIE_SCRIPT } from './cards/thievingMagpie';
import { THIEVING_OTTER_SCRIPT } from './cards/thievingOtter';
import { THINK_TANK_SCRIPT } from './cards/thinkTank';
import { THIRD_PATH_ICONOCLAST_SCRIPT } from './cards/thirdPathIconoclast';
import { THIRD_PATH_SAVANT_SCRIPT } from './cards/thirdPathSavant';
import { THOPTER_ARCHITECT_SCRIPT } from './cards/thopterArchitect';
import { THORNWIND_FAERIES_SCRIPT } from './cards/thornwindFaeries';
import { THORNWOOD_FALLS_SCRIPT } from './cards/thornwoodFalls';
import { THOUGHTWEFT_GAMBIT_SCRIPT } from './cards/thoughtweftGambit';
import { THOUGHTWEFT_LIEUTENANT_SCRIPT } from './cards/thoughtweftLieutenant';
import { THRAN_VIGIL_SCRIPT } from './cards/thranVigil';
import { THRASHING_BRONTODON_SCRIPT } from './cards/thrashingBrontodon';
import { THRAXODEMON_SCRIPT } from './cards/thraxodemon';
import { THREE_TREE_SCRIBE_SCRIPT } from './cards/threeTreeScribe';
import { TEMPORAL_SPRING_SCRIPT } from './cards/temporalSpring';
import { TEMUR_BANNER_SCRIPT } from './cards/temurBanner';
import { TENDERIZE_SCRIPT } from './cards/tenderize';
import { TENDRILS_OF_CORRUPTION_SCRIPT } from './cards/tendrilsOfCorruption';
import { TENTH_DISTRICT_GUARD_SCRIPT } from './cards/tenthDistrictGuard';
import { TERASHIS_GRASP_SCRIPT } from './cards/terashisGrasp';
import { TEROHS_FAITHFUL_SCRIPT } from './cards/terohsFaithful';
import { TERRITORIAL_HAMMERSKULL_SCRIPT } from './cards/territorialHammerskull';
import { TERROR_TIDE_SCRIPT } from './cards/terrorTide';
import { TESHAR_ANCESTORS_APOSTLE_SCRIPT } from './cards/tesharAncestorsApostle';
import { TESTAMENT_BEARER_SCRIPT } from './cards/testamentBearer';
import { TEYOS_LIGHTSHIELD_SCRIPT } from './cards/teyosLightshield';
import { THALAKOS_SEER_SCRIPT } from './cards/thalakosSeer';
import { THALLID_SOOTHSAYER_SCRIPT } from './cards/thallidSoothsayer';
import { THAUMATURGES_FAMILIAR_SCRIPT } from './cards/thaumaturgesFamiliar';
import { THAWBRINGER_SCRIPT } from './cards/thawbringer';
import { THE_AUTONOMOUS_FURNACE_SCRIPT } from './cards/theAutonomousFurnace';
import { THE_DROSS_PITS_SCRIPT } from './cards/theDrossPits';
import { THE_FAIR_BASILICA_SCRIPT } from './cards/theFairBasilica';
import { THE_HUNTER_MAZE_SCRIPT } from './cards/theHunterMaze';
import { TARPAN_SCRIPT } from './cards/tarpan';
import { TASHAS_HIDEOUS_LAUGHTER_SCRIPT } from './cards/tashasHideousLaughter';
import { TASTE_OF_BLOOD_SCRIPT } from './cards/tasteOfBlood';
import { TAXI_DRIVER_SCRIPT } from './cards/taxiDriver';
import { TCRI_BUILDING_SCRIPT } from './cards/tcriBuilding';
import { TEAM_TRANSMITTER_SCRIPT } from './cards/teamTransmitter';
import { TECTONIC_HAZARD_SCRIPT } from './cards/tectonicHazard';
import { TEETERING_PEAKS_SCRIPT } from './cards/teeteringPeaks';
import { TELEMIN_PERFORMANCE_SCRIPT } from './cards/teleminPerformance';
import { TELIM_TORS_DARTS_SCRIPT } from './cards/telimTorsDarts';
import { TEMPEST_OF_LIGHT_SCRIPT } from './cards/tempestOfLight';
import { TEMPLE_ACOLYTE_SCRIPT } from './cards/templeAcolyte';
import { TEMPLE_OF_ABANDON_SCRIPT } from './cards/templeOfAbandon';
import { TEMPLE_OF_DECEIT_SCRIPT } from './cards/templeOfDeceit';
import { TEMPLE_OF_ENLIGHTENMENT_SCRIPT } from './cards/templeOfEnlightenment';
import { TEMPLE_OF_EPIPHANY_SCRIPT } from './cards/templeOfEpiphany';
import { TEMPLE_OF_MALADY_SCRIPT } from './cards/templeOfMalady';
import { TEMPLE_OF_MYSTERY_SCRIPT } from './cards/templeOfMystery';
import { TEMPLE_OF_PLENTY_SCRIPT } from './cards/templeOfPlenty';
import { TEMPLE_OF_SILENCE_SCRIPT } from './cards/templeOfSilence';
import { TEMPLE_OF_TRIUMPH_SCRIPT } from './cards/templeOfTriumph';
import { TEMPORAL_ADEPT_SCRIPT } from './cards/temporalAdept';
import { TEMPORAL_EDDY_SCRIPT } from './cards/temporalEddy';
import { TEMPORAL_MACHINATIONS_SCRIPT } from './cards/temporalMachinations';
import { SWIFT_SILENCE_SCRIPT } from './cards/swiftSilence';
import { SWIFTWATER_CLIFFS_SCRIPT } from './cards/swiftwaterCliffs';
import { SWIRLING_SANDSTORM_SCRIPT } from './cards/swirlingSandstorm';
import { SYLVAN_BRUSHSTRIDER_SCRIPT } from './cards/sylvanBrushstrider';
import { SYLVAN_SAFEKEEPER_SCRIPT } from './cards/sylvanSafekeeper';
import { SYLVOK_REPLICA_SCRIPT } from './cards/sylvokReplica';
import { SYMBIOSIS_SCRIPT } from './cards/symbiosis';
import { SYMBIOTIC_BEAST_SCRIPT } from './cards/symbioticBeast';
import { SYMBIOTIC_ELF_SCRIPT } from './cards/symbioticElf';
import { SYMBIOTIC_WURM_SCRIPT } from './cards/symbioticWurm';
import { SYPHON_SOUL_SCRIPT } from './cards/syphonSoul';
import { TAIL_SLASH_SCRIPT } from './cards/tailSlash';
import { TAKE_HEART_SCRIPT } from './cards/takeHeart';
import { TAKE_INVENTORY_SCRIPT } from './cards/takeInventory';
import { TAKEN_BY_NIGHTMARES_SCRIPT } from './cards/takenByNightmares';
import { TANGLEBLOOM_SCRIPT } from './cards/tanglebloom';
import { TANGLESPAN_LOOKOUT_SCRIPT } from './cards/tanglespanLookout';
import { TANUFEL_RIMESPEAKER_SCRIPT } from './cards/tanufelRimespeaker';
import { TAR_PITCHER_SCRIPT } from './cards/tarPitcher';
import { SUFFOCATING_BLAST_SCRIPT } from './cards/suffocatingBlast';
import { SULTAI_ASCENDANCY_SCRIPT } from './cards/sultaiAscendancy';
import { SULTAI_BANNER_SCRIPT } from './cards/sultaiBanner';
import { SULTAI_FLAYER_SCRIPT } from './cards/sultaiFlayer';
import { SULTAI_SOOTHSAYER_SCRIPT } from './cards/sultaiSoothsayer';
import { SUMMIT_SENTINEL_SCRIPT } from './cards/summitSentinel';
import { SUN_BLESSED_PEAK_SCRIPT } from './cards/sunBlessedPeak';
import { SUNDER_SCRIPT } from './cards/sunder';
import { SUNDER_FROM_WITHIN_SCRIPT } from './cards/sunderFromWithin';
import { SUNHOME_FORTRESS_OF_THE_LEGION_SCRIPT } from './cards/sunhomeFortressOfTheLegion';
import { SUPERIOR_NUMBERS_SCRIPT } from './cards/superiorNumbers';
import { SUPPLY_LINE_CRANES_SCRIPT } from './cards/supplyLineCranes';
import { SURTR_FIERY_JOTUN_SCRIPT } from './cards/surtrFieryJotun';
import { SUSTENANCE_SCRIPT } from './cards/sustenance';
import { SWALLOWING_PLAGUE_SCRIPT } from './cards/swallowingPlague';
import { SWELTER_SCRIPT } from './cards/swelter';
import { SWIFT_KICK_SCRIPT } from './cards/swiftKick';
import { STRANDS_OF_NIGHT_SCRIPT } from './cards/strandsOfNight';
import { STREAM_OF_LIFE_SCRIPT } from './cards/streamOfLife';
import { STREAM_OF_UNCONSCIOUSNESS_SCRIPT } from './cards/streamOfUnconsciousness';
import { STRENGTH_OF_CEDARS_SCRIPT } from './cards/strengthOfCedars';
import { STRIP_BARE_SCRIPT } from './cards/stripBare';
import { STRIP_MINE_SCRIPT } from './cards/stripMine';
import { STRIPED_BEARS_SCRIPT } from './cards/stripedBears';
import { STROKE_OF_GENIUS_SCRIPT } from './cards/strokeOfGenius';
import { STRONGHOLD_DISCIPLINE_SCRIPT } from './cards/strongholdDiscipline';
import { STRUCTURAL_DISTORTION_SCRIPT } from './cards/structuralDistortion';
import { STUDENT_OF_OJUTAI_SCRIPT } from './cards/studentOfOjutai';
import { SUBJUGATE_THE_HOBBITS_SCRIPT } from './cards/subjugateTheHobbits';
import { SUBTERRANEAN_CAVERN_SCRIPT } from './cards/subterraneanCavern';
import { SUBURBAN_SANCTUARY_SCRIPT } from './cards/suburbanSanctuary';
import { SUCCUMB_TO_TEMPTATION_SCRIPT } from './cards/succumbToTemptation';
import { SUDDEN_IMPACT_SCRIPT } from './cards/suddenImpact';
import { SUDDEN_INSIGHT_SCRIPT } from './cards/suddenInsight';
import { STENCH_OF_DECAY_SCRIPT } from './cards/stenchOfDecay';
import { STENSIA_BLOODHALL_SCRIPT } from './cards/stensiaBloodhall';
import { STERLING_HOUND_SCRIPT } from './cards/sterlingHound';
import { STERN_DISMISSAL_SCRIPT } from './cards/sternDismissal';
import { STERN_PROCTOR_SCRIPT } from './cards/sternProctor';
import { STINGING_BARRIER_SCRIPT } from './cards/stingingBarrier';
import { STOLEN_GRAIN_SCRIPT } from './cards/stolenGrain';
import { STOMP_AND_HOWL_SCRIPT } from './cards/stompAndHowl';
import { STOMPING_SLABS_SCRIPT } from './cards/stompingSlabs';
import { STONE_HAVEN_MEDIC_SCRIPT } from './cards/stoneHavenMedic';
import { STONEBOUND_MENTOR_SCRIPT } from './cards/stoneboundMentor';
import { STONEFURY_SCRIPT } from './cards/stonefury';
import { STORM_SEEKER_SCRIPT } from './cards/stormSeeker';
import { STORM_SPIRIT_SCRIPT } from './cards/stormSpirit';
import { STORMS_WRATH_SCRIPT } from './cards/stormsWrath';
import { STORMCALLER_OF_KERANOS_SCRIPT } from './cards/stormcallerOfKeranos';
import { SQUALL_SCRIPT } from './cards/squall';
import { SQUALL_DRIFTER_SCRIPT } from './cards/squallDrifter';
import { STABBING_PAIN_SCRIPT } from './cards/stabbingPain';
import { STAFF_OF_THE_DEATH_MAGUS_SCRIPT } from './cards/staffOfTheDeathMagus';
import { STAFF_OF_THE_FLAME_MAGUS_SCRIPT } from './cards/staffOfTheFlameMagus';
import { STAFF_OF_THE_MIND_MAGUS_SCRIPT } from './cards/staffOfTheMindMagus';
import { STAFF_OF_THE_SUN_MAGUS_SCRIPT } from './cards/staffOfTheSunMagus';
import { STAFF_OF_THE_WILD_MAGUS_SCRIPT } from './cards/staffOfTheWildMagus';
import { STAFF_OF_ZEGON_SCRIPT } from './cards/staffOfZegon';
import { STAND_UNITED_SCRIPT } from './cards/standUnited';
import { STAR_OF_EXTINCTION_SCRIPT } from './cards/starOfExtinction';
import { STARFALL_SCRIPT } from './cards/starfall';
import { STARFIGHTER_PILOT_SCRIPT } from './cards/starfighterPilot';
import { STARGAZE_SCRIPT } from './cards/stargaze';
import { STARK_INDUSTRIES_SCRIPT } from './cards/starkIndustries';
import { STARK_INDUSTRIES_EXECUTIVE_SCRIPT } from './cards/starkIndustriesExecutive';
import { STARLIGHT_SCRIPT } from './cards/starlight';
import { STARLIGHT_INVOKER_SCRIPT } from './cards/starlightInvoker';
import { STARVED_RUSALKA_SCRIPT } from './cards/starvedRusalka';
import { STAUNCH_DEFENDERS_SCRIPT } from './cards/staunchDefenders';
import { STEADFAST_SENTRY_SCRIPT } from './cards/steadfastSentry';
import { STEALER_OF_SECRETS_SCRIPT } from './cards/stealerOfSecrets';
import { STEAM_BLAST_SCRIPT } from './cards/steamBlast';
import { SPINAL_CENTIPEDE_SCRIPT } from './cards/spinalCentipede';
import { SPINED_MEGALODON_SCRIPT } from './cards/spinedMegalodon';
import { SPINNING_WHEEL_SCRIPT } from './cards/spinningWheel';
import { SPIRALING_EMBERS_SCRIPT } from './cards/spiralingEmbers';
import { SPIRE_BARRAGE_SCRIPT } from './cards/spireBarrage';
import { SPIRE_OWL_SCRIPT } from './cards/spireOwl';
import { SPIRITED_COMPANION_SCRIPT } from './cards/spiritedCompanion';
import { SPIRITUAL_GUARDIAN_SCRIPT } from './cards/spiritualGuardian';
import { SPITE_OF_MOGIS_SCRIPT } from './cards/spiteOfMogis';
import { SPITEFUL_BLOW_SCRIPT } from './cards/spitefulBlow';
import { SPITTING_EARTH_SCRIPT } from './cards/spittingEarth';
import { SPLASH_PORTAL_SCRIPT } from './cards/splashPortal';
import { SPLATTER_GOBLIN_SCRIPT } from './cards/splatterGoblin';
import { SPOILS_OF_EVIL_SCRIPT } from './cards/spoilsOfEvil';
import { SPORE_CRAWLER_SCRIPT } from './cards/sporeCrawler';
import { SPREADING_ROT_SCRIPT } from './cards/spreadingRot';
import { SPRINGMANE_CERVIN_SCRIPT } from './cards/springmaneCervin';
import { SPROUTING_THRINAX_SCRIPT } from './cards/sproutingThrinax';
import { SPYGLASS_SIREN_SCRIPT } from './cards/spyglassSiren';
import { SOULS_FIRE_SCRIPT } from './cards/soulsFire';
import { SOULS_GRACE_SCRIPT } from './cards/soulsGrace';
import { SOULS_MAJESTY_SCRIPT } from './cards/soulsMajesty';
import { SOULKNIFE_SPY_SCRIPT } from './cards/soulknifeSpy';
import { SOULMENDER_SCRIPT } from './cards/soulmender';
import { SOULQUAKE_SCRIPT } from './cards/soulquake';
import { SOULREAPER_OF_MOGIS_SCRIPT } from './cards/soulreaperOfMogis';
import { SOULSCOUR_SCRIPT } from './cards/soulscour';
import { SOULSWORN_JURY_SCRIPT } from './cards/soulswornJury';
import { SOVEREIGNS_BITE_SCRIPT } from './cards/sovereignsBite';
import { SPARRING_CONSTRUCT_SCRIPT } from './cards/sparringConstruct';
import { SPARRING_MUMMY_SCRIPT } from './cards/sparringMummy';
import { SPECTACLE_SUMMIT_SCRIPT } from './cards/spectacleSummit';
import { SPECTRAL_SAILOR_SCRIPT } from './cards/spectralSailor';
import { SPELLKEEPER_WEIRD_SCRIPT } from './cards/spellkeeperWeird';
import { SPHINXS_REVELATION_SCRIPT } from './cards/sphinxsRevelation';
import { SPIDERWIG_BOGGART_SCRIPT } from './cards/spiderwigBoggart';
import { SLINKING_SKIRGE_SCRIPT } from './cards/slinkingSkirge';
import { SLITHERING_CRYPTID_SCRIPT } from './cards/slitheringCryptid';
import { SLIVER_QUEEN_SCRIPT } from './cards/sliverQueen';
import { SLOBAD_GOBLIN_TINKERER_SCRIPT } from './cards/slobadGoblinTinkerer';
import { SMASH_TO_SMITHEREENS_SCRIPT } from './cards/smashToSmithereens';
import { SMOKESPEW_INVOKER_SCRIPT } from './cards/smokespewInvoker';
import { SMOTHER_SCRIPT } from './cards/smother';
import { SNARLING_GOREHOUND_SCRIPT } from './cards/snarlingGorehound';
import { SOARING_SEACLIFF_SCRIPT } from './cards/soaringSeacliff';
import { SOKKA_LATERAL_STRATEGIST_SCRIPT } from './cards/sokkaLateralStrategist';
import { SOLKANAR_THE_SWAMP_KING_SCRIPT } from './cards/solkanarTheSwampKing';
import { SOLDIER_OF_THE_GREY_HOST_SCRIPT } from './cards/soldierOfTheGreyHost';
import { SONGS_OF_THE_DAMNED_SCRIPT } from './cards/songsOfTheDamned';
import { SOOTHING_BALM_SCRIPT } from './cards/soothingBalm';
import { SORINS_THIRST_SCRIPT } from './cards/sorinsThirst';
import { SORINS_VENGEANCE_SCRIPT } from './cards/sorinsVengeance';
import { SOUL_FEAST_SCRIPT } from './cards/soulFeast';
import { SINISTER_HIDEOUT_SCRIPT } from './cards/sinisterHideout';
import { SINISTER_STARFISH_SCRIPT } from './cards/sinisterStarfish';
import { SIP_OF_HEMLOCK_SCRIPT } from './cards/sipOfHemlock';
import { SIRENS_RUSE_SCRIPT } from './cards/sirensRuse';
import { SIZZLE_SCRIPT } from './cards/sizzle';
import { SKARRG_THE_RAGE_PITS_SCRIPT } from './cards/skarrgTheRagePits';
import { SKINRENDER_SCRIPT } from './cards/skinrender';
import { SKIRSDAG_CULTIST_SCRIPT } from './cards/skirsdagCultist';
import { SKIRSDAG_FLAYER_SCRIPT } from './cards/skirsdagFlayer';
import { SKRED_SCRIPT } from './cards/skred';
import { SKULDUGGERY_SCRIPT } from './cards/skulduggery';
import { SKULL_CATAPULT_SCRIPT } from './cards/skullCatapult';
import { SKYBEAST_TRACKER_SCRIPT } from './cards/skybeastTracker';
import { SKYBRIDGE_TOWERS_SCRIPT } from './cards/skybridgeTowers';
import { SKYCLAVE_CLERIC_SCRIPT } from './cards/skyclaveCleric';
import { SKYREAPING_SCRIPT } from './cards/skyreaping';
import { SKYSCANNER_SCRIPT } from './cards/skyscanner';
import { SLAGDRILL_SCRAPPER_SCRIPT } from './cards/slagdrillScrapper';
import { SLASH_OF_LIGHT_SCRIPT } from './cards/slashOfLight';
import { SLAYERS_STRONGHOLD_SCRIPT } from './cards/slayersStronghold';
import { SHORE_LURKER_SCRIPT } from './cards/shoreLurker';
import { SHOWER_OF_SPARKS_SCRIPT } from './cards/showerOfSparks';
import { SHRIVEL_SCRIPT } from './cards/shrivel';
import { SHU_GRAIN_CARAVAN_SCRIPT } from './cards/shuGrainCaravan';
import { SHU_SOLDIER_FARMERS_SCRIPT } from './cards/shuSoldierFarmers';
import { SICK_AND_TIRED_SCRIPT } from './cards/sickAndTired';
import { SIGIL_OF_THE_EMPTY_THRONE_SCRIPT } from './cards/sigilOfTheEmptyThrone';
import { SIGILED_SKINK_SCRIPT } from './cards/sigiledSkink';
import { SIGILED_STARFISH_SCRIPT } from './cards/sigiledStarfish';
import { SIGN_IN_BLOOD_SCRIPT } from './cards/signInBlood';
import { SILENT_ATTENDANT_SCRIPT } from './cards/silentAttendant';
import { SILVER_RAVEN_SCRIPT } from './cards/silverRaven';
import { SILVERBACK_SHAMAN_SCRIPT } from './cards/silverbackShaman';
import { SILVERCHASE_FOX_SCRIPT } from './cards/silverchaseFox';
import { SILVERQUILL_CAMPUS_SCRIPT } from './cards/silverquillCampus';
import { SIMIC_CLUESTONE_SCRIPT } from './cards/simicCluestone';
import { SIMIC_LOCKET_SCRIPT } from './cards/simicLocket';
import { SIMOON_SCRIPT } from './cards/simoon';
import { SERENE_OFFERING_SCRIPT } from './cards/sereneOffering';
import { SERPENTS_PASS_SCRIPT } from './cards/serpentsPass';
import { SERVO_SCHEMATIC_SCRIPT } from './cards/servoSchematic';
import { SHADEWING_LAUREATE_SCRIPT } from './cards/shadewingLaureate';
import { SHADOW_ALLEY_DENIZEN_SCRIPT } from './cards/shadowAlleyDenizen';
import { SHADOWFEED_SCRIPT } from './cards/shadowfeed';
import { SHADOWS_VERDICT_SCRIPT } from './cards/shadowsVerdict';
import { SHADOWSTORM_SCRIPT } from './cards/shadowstorm';
import { SHADOWY_BACKSTREET_SCRIPT } from './cards/shadowyBackstreet';
import { SHAMAN_OF_SPRING_SCRIPT } from './cards/shamanOfSpring';
import { SHAMBLING_GOBLIN_SCRIPT } from './cards/shamblingGoblin';
import { SHATTER_THE_SKY_SCRIPT } from './cards/shatterTheSky';
import { SHATTERED_ACOLYTE_SCRIPT } from './cards/shatteredAcolyte';
import { SHATTERSTORM_SCRIPT } from './cards/shatterstorm';
import { SHIELD_MATE_SCRIPT } from './cards/shieldMate';
import { SHIVAN_HELLKITE_SCRIPT } from './cards/shivanHellkite';
import { SHOPKEEPERS_BANE_SCRIPT } from './cards/shopkeepersBane';
import { SHORE_KEEPER_SCRIPT } from './cards/shoreKeeper';
import { SEASIDE_HAVEN_SCRIPT } from './cards/seasideHaven';
import { SECRET_RENDEZVOUS_SCRIPT } from './cards/secretRendezvous';
import { SEEDS_OF_INNOCENCE_SCRIPT } from './cards/seedsOfInnocence';
import { SEEKER_OF_SKYBREAK_SCRIPT } from './cards/seekerOfSkybreak';
import { SEER_OF_STOLEN_SIGHT_SCRIPT } from './cards/seerOfStolenSight';
import { SEERS_LANTERN_SCRIPT } from './cards/seersLantern';
import { SEISMIC_RUPTURE_SCRIPT } from './cards/seismicRupture';
import { SEISMIC_SHUDDER_SCRIPT } from './cards/seismicShudder';
import { SEISMIC_SPIKE_SCRIPT } from './cards/seismicSpike';
import { SEISMIC_STRIKE_SCRIPT } from './cards/seismicStrike';
import { SEISMIC_WAVE_SCRIPT } from './cards/seismicWave';
import { SEJIRI_REFUGE_SCRIPT } from './cards/sejiriRefuge';
import { SEK_KUAR_DEATHKEEPER_SCRIPT } from './cards/sekKuarDeathkeeper';
import { SELESNYA_CLUESTONE_SCRIPT } from './cards/selesnyaCluestone';
import { SELESNYA_LOCKET_SCRIPT } from './cards/selesnyaLocket';
import { SELLER_OF_SONGBIRDS_SCRIPT } from './cards/sellerOfSongbirds';
import { SENATE_GRIFFIN_SCRIPT } from './cards/senateGriffin';
import { SENTINEL_OF_THE_NAMELESS_CITY_SCRIPT } from './cards/sentinelOfTheNamelessCity';
import { SERENE_HEART_SCRIPT } from './cards/sereneHeart';
import { SCEPTER_OF_INSIGHT_SCRIPT } from './cards/scepterOfInsight';
import { SCORCH_THE_FIELDS_SCRIPT } from './cards/scorchTheFields';
import { SCORCHED_RUSALKA_SCRIPT } from './cards/scorchedRusalka';
import { SCOURED_BARRENS_SCRIPT } from './cards/scouredBarrens';
import { SCOURING_SANDS_SCRIPT } from './cards/scouringSands';
import { SCRAPHEAP_SCRIPT } from './cards/scrapheap';
import { SCRAPYARD_SALVO_SCRIPT } from './cards/scrapyardSalvo';
import { SCREAM_PUFF_SCRIPT } from './cards/screamPuff';
import { SCRIBE_OF_THE_MINDFUL_SCRIPT } from './cards/scribeOfTheMindful';
import { SCROLL_THIEF_SCRIPT } from './cards/scrollThief';
import { SEA_GATE_ORACLE_SCRIPT } from './cards/seaGateOracle';
import { SEAFLOOR_ORACLE_SCRIPT } from './cards/seafloorOracle';
import { SEAL_OF_CLEANSING_SCRIPT } from './cards/sealOfCleansing';
import { SEAL_OF_PRIMORDIUM_SCRIPT } from './cards/sealOfPrimordium';
import { SEAL_OF_REMOVAL_SCRIPT } from './cards/sealOfRemoval';
import { SEAL_OF_STRENGTH_SCRIPT } from './cards/sealOfStrength';
import { SEARCH_WARRANT_SCRIPT } from './cards/searchWarrant';
import { SEARCHLIGHT_COMPANION_SCRIPT } from './cards/searchlightCompanion';
import { SEARING_FLESH_SCRIPT } from './cards/searingFlesh';
import { SAILOR_OF_MEANS_SCRIPT } from './cards/sailorOfMeans';
import { SALTFIELD_RECLUSE_SCRIPT } from './cards/saltfieldRecluse';
import { SALVAGE_SCRIPT } from './cards/salvage';
import { SALVAGER_OF_SECRETS_SCRIPT } from './cards/salvagerOfSecrets';
import { SANDSTONE_BRIDGE_SCRIPT } from './cards/sandstoneBridge';
import { SANDSTORM_SCRIPT } from './cards/sandstorm';
import { SANGUIMANCY_SCRIPT } from './cards/sanguimancy';
import { SANITATION_AUTOMATON_SCRIPT } from './cards/sanitationAutomaton';
import { SARKHANS_RAGE_SCRIPT } from './cards/sarkhansRage';
import { SATYR_ENCHANTER_SCRIPT } from './cards/satyrEnchanter';
import { SATYR_GROVEDANCER_SCRIPT } from './cards/satyrGrovedancer';
import { SAVAGE_GORILLA_SCRIPT } from './cards/savageGorilla';
import { SAVAGE_MANSION_SCRIPT } from './cards/savageMansion';
import { SAVAGE_SMASH_SCRIPT } from './cards/savageSmash';
import { SAVAGE_SURGE_SCRIPT } from './cards/savageSurge';
import { SAVAGE_SWIPE_SCRIPT } from './cards/savageSwipe';
import { SAVAGE_TWISTER_SCRIPT } from './cards/savageTwister';
import { SAVANNAH_SAGE_SCRIPT } from './cards/savannahSage';
import { SCALDING_DEVIL_SCRIPT } from './cards/scaldingDevil';
import { SCAVENGER_FOLK_SCRIPT } from './cards/scavengerFolk';
import { SCEPTER_OF_DOMINANCE_SCRIPT } from './cards/scepterOfDominance';
import { RUBBLEBELT_BOAR_SCRIPT } from './cards/rubblebeltBoar';
import { RUGGED_HIGHLANDS_SCRIPT } from './cards/ruggedHighlands';
import { RUINATION_SCRIPT } from './cards/ruination';
import { RUINOUS_GREMLIN_SCRIPT } from './cards/ruinousGremlin';
import { RUINOUS_ULTIMATUM_SCRIPT } from './cards/ruinousUltimatum';
import { RUMBLING_ROCKSLIDE_SCRIPT } from './cards/rumblingRockslide';
import { RUMBLING_SENTRY_SCRIPT } from './cards/rumblingSentry';
import { RUMMAGING_WIZARD_SCRIPT } from './cards/rummagingWizard';
import { RUN_AGROUND_SCRIPT } from './cards/runAground';
import { RUNE_SEALED_WALL_SCRIPT } from './cards/runeSealedWall';
import { RUNEWING_SCRIPT } from './cards/runewing';
import { RUSH_OF_BLOOD_SCRIPT } from './cards/rushOfBlood';
import { RUSH_OF_KNOWLEDGE_SCRIPT } from './cards/rushOfKnowledge';
import { RUTHLESS_PREDATION_SCRIPT } from './cards/ruthlessPredation';
import { SHIELD_DEPLOYMENT_DRONE_SCRIPT } from './cards/shieldDeploymentDrone';
import { SACRED_ARMORY_SCRIPT } from './cards/sacredArmory';
import { SACRED_PREY_SCRIPT } from './cards/sacredPrey';
import { SAGE_AVEN_SCRIPT } from './cards/sageAven';
import { SAGE_OF_EPITYR_SCRIPT } from './cards/sageOfEpityr';
import { SAGE_OF_LAT_NAM_SCRIPT } from './cards/sageOfLatNam';
import { SAGE_OWL_SCRIPT } from './cards/sageOwl';
import { SAGES_ROW_SAVANT_SCRIPT } from './cards/sagesRowSavant';
import { RITE_OF_THE_DRAGONCALLER_SCRIPT } from './cards/riteOfTheDragoncaller';
import { RITUAL_OF_SOOT_SCRIPT } from './cards/ritualOfSoot';
import { RIVERS_REBUKE_SCRIPT } from './cards/riversRebuke';
import { ROAD_RAGE_SCRIPT } from './cards/roadRage';
import { ROAR_OF_RECLAMATION_SCRIPT } from './cards/roarOfReclamation';
import { ROC_EGG_SCRIPT } from './cards/rocEgg';
import { ROCKSLIDE_AMBUSH_SCRIPT } from './cards/rockslideAmbush';
import { ROCKY_REBUKE_SCRIPT } from './cards/rockyRebuke';
import { ROD_OF_RUIN_SCRIPT } from './cards/rodOfRuin';
import { ROILING_TERRAIN_SCRIPT } from './cards/roilingTerrain';
import { ROKUS_MASTERY_SCRIPT } from './cards/rokusMastery';
import { ROLLICK_OF_ABANDON_SCRIPT } from './cards/rollickOfAbandon';
import { ROLLING_EARTHQUAKE_SCRIPT } from './cards/rollingEarthquake';
import { RONOM_UNICORN_SCRIPT } from './cards/ronomUnicorn';
import { ROOFTOP_BYPASS_SCRIPT } from './cards/rooftopBypass';
import { ROOTWATER_HUNTER_SCRIPT } from './cards/rootwaterHunter';
import { ROTLUNG_REANIMATOR_SCRIPT } from './cards/rotlungReanimator';
import { ROTTENHEART_GHOUL_SCRIPT } from './cards/rottenheartGhoul';
import { ROVING_HARPER_SCRIPT } from './cards/rovingHarper';
import { RETRIBUTION_OF_THE_MEEK_SCRIPT } from './cards/retributionOfTheMeek';
import { REWARDS_OF_DIVERSITY_SCRIPT } from './cards/rewardsOfDiversity';
import { RHOX_ORACLE_SCRIPT } from './cards/rhoxOracle';
import { RIBBONS_OF_THE_REIKAI_SCRIPT } from './cards/ribbonsOfTheReikai';
import { RIGHTEOUS_CAUSE_SCRIPT } from './cards/righteousCause';
import { RIGHTEOUS_FURY_SCRIPT } from './cards/righteousFury';
import { RIMEFUR_REINDEER_SCRIPT } from './cards/rimefurReindeer';
import { RIPCHAIN_RAZORKIN_SCRIPT } from './cards/ripchainRazorkin';
import { RIPTIDE_SCRIPT } from './cards/riptide';
import { RIPTIDE_CRAB_SCRIPT } from './cards/riptideCrab';
import { RISE_OF_THE_DARK_REALMS_SCRIPT } from './cards/riseOfTheDarkRealms';
import { RISHADAN_DOCKHAND_SCRIPT } from './cards/rishadanDockhand';
import { RISHADAN_PORT_SCRIPT } from './cards/rishadanPort';
import { RISKY_RESEARCH_SCRIPT } from './cards/riskyResearch';
import { RISKY_SHORTCUT_SCRIPT } from './cards/riskyShortcut';
import { RITE_OF_FLAME_SCRIPT } from './cards/riteOfFlame';
import { RELIC_BARRIER_SCRIPT } from './cards/relicBarrier';
import { RELIQUARY_MONK_SCRIPT } from './cards/reliquaryMonk';
import { REMOVE_ENCHANTMENTS_SCRIPT } from './cards/removeEnchantments';
import { RENDING_FLAME_SCRIPT } from './cards/rendingFlame';
import { RENEWING_DAWN_SCRIPT } from './cards/renewingDawn';
import { RENOWNED_WEAVER_SCRIPT } from './cards/renownedWeaver';
import { REPAY_IN_KIND_SCRIPT } from './cards/repayInKind';
import { REPEL_SCRIPT } from './cards/repel';
import { REPENTANCE_SCRIPT } from './cards/repentance';
import { REPRISAL_SCRIPT } from './cards/reprisal';
import { REPUTABLE_MERCHANT_SCRIPT } from './cards/reputableMerchant';
import { REQUIEM_ANGEL_SCRIPT } from './cards/requiemAngel';
import { RESEARCH_THIEF_SCRIPT } from './cards/researchThief';
import { RESOLUTE_REINFORCEMENTS_SCRIPT } from './cards/resoluteReinforcements';
import { RESOLUTE_WATCHDOG_SCRIPT } from './cards/resoluteWatchdog';
import { RETRACT_SCRIPT } from './cards/retract';
import { RAZORFIN_HUNTER_SCRIPT } from './cards/razorfinHunter';
import { RAZORKIN_HORDECALLER_SCRIPT } from './cards/razorkinHordecaller';
import { REANIMATE_SCRIPT } from './cards/reanimate';
import { REBUKING_CEREMONY_SCRIPT } from './cards/rebukingCeremony';
import { RECKLESS_ASSAULT_SCRIPT } from './cards/recklessAssault';
import { RECKLESS_REVELER_SCRIPT } from './cards/recklessReveler';
import { RECLAIM_SCRIPT } from './cards/reclaim';
import { RECLAIMING_VINES_SCRIPT } from './cards/reclaimingVines';
import { REDCAP_THIEF_SCRIPT } from './cards/redcapThief';
import { REDUCE_TO_DREAMS_SCRIPT } from './cards/reduceToDreams';
import { REFUSE_TO_YIELD_SCRIPT } from './cards/refuseToYield';
import { REKI_THE_HISTORY_OF_KAMIGAWA_SCRIPT } from './cards/rekiTheHistoryOfKamigawa';
import { RAIN_OF_BLADES_SCRIPT } from './cards/rainOfBlades';
import { RAIN_OF_DAGGERS_SCRIPT } from './cards/rainOfDaggers';
import { RAIN_OF_EMBERS_SCRIPT } from './cards/rainOfEmbers';
import { RAIN_OF_SALT_SCRIPT } from './cards/rainOfSalt';
import { RAKDOS_CLUESTONE_SCRIPT } from './cards/rakdosCluestone';
import { RAKDOS_LOCKET_SCRIPT } from './cards/rakdosLocket';
import { RAKDOSS_RETURN_SCRIPT } from './cards/rakdossReturn';
import { RAKECLAW_GARGANTUAN_SCRIPT } from './cards/rakeclawGargantuan';
import { RAKKA_MAR_SCRIPT } from './cards/rakkaMar';
import { RALLY_SCRIPT } from './cards/rally';
import { RALLY_OF_WINGS_SCRIPT } from './cards/rallyOfWings';
import { RALLY_THE_RIGHTEOUS_SCRIPT } from './cards/rallyTheRighteous';
import { RAPACIOUS_DRAGON_SCRIPT } from './cards/rapaciousDragon';
import { RATHS_EDGE_SCRIPT } from './cards/rathsEdge';
import { RATHI_TRAPPER_SCRIPT } from './cards/rathiTrapper';
import { RAUCOUS_THEATER_SCRIPT } from './cards/raucousTheater';
import { RAVAGES_OF_WAR_SCRIPT } from './cards/ravagesOfWar';
import { RAVAGING_HORDE_SCRIPT } from './cards/ravagingHorde';
import { RAVENOUS_BALOTH_SCRIPT } from './cards/ravenousBaloth';
import { RAVENOUS_CHUPACABRA_SCRIPT } from './cards/ravenousChupacabra';
import { RAVENOUS_LINDWURM_SCRIPT } from './cards/ravenousLindwurm';
import { RAVENOUS_RATS_SCRIPT } from './cards/ravenousRats';
import { RAVNICA_AT_WAR_SCRIPT } from './cards/ravnicaAtWar';
import { PSYCHIC_BARRIER_SCRIPT } from './cards/psychicBarrier';
import { PUBLIC_EXECUTION_SCRIPT } from './cards/publicExecution';
import { PUNCTURE_BLAST_SCRIPT } from './cards/punctureBlast';
import { PUNISH_IGNORANCE_SCRIPT } from './cards/punishIgnorance';
import { PUNISH_THE_ENEMY_SCRIPT } from './cards/punishTheEnemy';
import { PURIFY_SCRIPT } from './cards/purify';
import { PURPLE_CRYSTAL_CRAB_SCRIPT } from './cards/purpleCrystalCrab';
import { PUTREFY_SCRIPT } from './cards/putrefy';
import { PYM_TECHNOLOGIES_SCRIPT } from './cards/pymTechnologies';
import { PYROCLASM_SCRIPT } from './cards/pyroclasm';
import { PYROCLASTIC_ELEMENTAL_SCRIPT } from './cards/pyroclasticElemental';
import { QUAGMIRE_DRUID_SCRIPT } from './cards/quagmireDruid';
import { QUANDRIX_CAMPUS_SCRIPT } from './cards/quandrixCampus';
import { RABID_GNAW_SCRIPT } from './cards/rabidGnaw';
import { RACERS_RING_SCRIPT } from './cards/racersRing';
import { RACK_AND_RUIN_SCRIPT } from './cards/rackAndRuin';
import { RADIATING_LIGHTNING_SCRIPT } from './cards/radiatingLightning';
import { RAGE_SCARRED_BERSERKER_SCRIPT } from './cards/rageScarredBerserker';
import { PRIDE_GUARDIAN_SCRIPT } from './cards/prideGuardian';
import { PRIDEFUL_PARENT_SCRIPT } from './cards/pridefulParent';
import { PRIEST_OF_IROAS_SCRIPT } from './cards/priestOfIroas';
import { PRIMAL_BELLOW_SCRIPT } from './cards/primalBellow';
import { PRIMEVAL_LIGHT_SCRIPT } from './cards/primevalLight';
import { PRIMORDIAL_PACHYDERM_SCRIPT } from './cards/primordialPachyderm';
import { PRISM_RING_SCRIPT } from './cards/prismRing';
import { PRISMARI_CAMPUS_SCRIPT } from './cards/prismariCampus';
import { PRIZED_STATUE_SCRIPT } from './cards/prizedStatue';
import { PRODIGAL_PYROMANCER_SCRIPT } from './cards/prodigalPyromancer';
import { PRODIGAL_SORCERER_SCRIPT } from './cards/prodigalSorcerer';
import { PROFANE_MEMENTO_SCRIPT } from './cards/profaneMemento';
import { PROFANE_PRAYERS_SCRIPT } from './cards/profanePrayers';
import { PROPHET_OF_THE_PEAK_SCRIPT } from './cards/prophetOfThePeak';
import { PROSPERITY_SCRIPT } from './cards/prosperity';
import { PROSPEROUS_PIRATES_SCRIPT } from './cards/prosperousPirates';
import { PROTECTOR_OF_GONDOR_SCRIPT } from './cards/protectorOfGondor';
import { PROVOKE_THE_TROLLS_SCRIPT } from './cards/provokeTheTrolls';
import { PSEUDODRAGON_FAMILIAR_SCRIPT } from './cards/pseudodragonFamiliar';
import { PSIONIC_BLAST_SCRIPT } from './cards/psionicBlast';
import { PLANAR_CLEANSING_SCRIPT } from './cards/planarCleansing';
import { PLANAR_DESPAIR_SCRIPT } from './cards/planarDespair';
import { PLAY_WITH_FIRE_SCRIPT } from './cards/playWithFire';
import { PLOW_UNDER_SCRIPT } from './cards/plowUnder';
import { PLUMECREED_ESCORT_SCRIPT } from './cards/plumecreedEscort';
import { PLUNDERING_PIRATE_SCRIPT } from './cards/plunderingPirate';
import { POISON_THE_WELL_SCRIPT } from './cards/poisonTheWell';
import { POLLUTED_DEAD_SCRIPT } from './cards/pollutedDead';
import { POND_PROPHET_SCRIPT } from './cards/pondProphet';
import { POUNCE_SCRIPT } from './cards/pounce';
import { PRECINCT_CAPTAIN_SCRIPT } from './cards/precinctCaptain';
import { PREENING_CHAMPION_SCRIPT } from './cards/preeningChampion';
import { PRESCIENT_CHIMERA_SCRIPT } from './cards/prescientChimera';
import { PRESENCE_OF_THE_WISE_SCRIPT } from './cards/presenceOfTheWise';
import { PRETENDING_POXBEARERS_SCRIPT } from './cards/pretendingPoxbearers';
import { PRICE_OF_PROGRESS_SCRIPT } from './cards/priceOfProgress';
import { PHYREXIAN_DEFILER_SCRIPT } from './cards/phyrexianDefiler';
import { PHYREXIAN_DENOUNCER_SCRIPT } from './cards/phyrexianDenouncer';
import { PHYREXIAN_RECLAMATION_SCRIPT } from './cards/phyrexianReclamation';
import { PHYREXIAN_VAULT_SCRIPT } from './cards/phyrexianVault';
import { PHYREXIAN_VIVISECTOR_SCRIPT } from './cards/phyrexianVivisector';
import { PIERCE_STRIDER_SCRIPT } from './cards/pierceStrider';
import { PIETY_SCRIPT } from './cards/piety';
import { PIGGY_BANK_SCRIPT } from './cards/piggyBank';
import { PILLAGE_SCRIPT } from './cards/pillage';
import { PILLARDROP_RESCUER_SCRIPT } from './cards/pillardropRescuer';
import { PINPOINT_AVALANCHE_SCRIPT } from './cards/pinpointAvalanche';
import { PIRANHA_MARSH_SCRIPT } from './cards/piranhaMarsh';
import { PITH_DRILLER_SCRIPT } from './cards/pithDriller';
import { PITILESS_PLUNDERER_SCRIPT } from './cards/pitilessPlunderer';
import { PIXIE_QUEEN_SCRIPT } from './cards/pixieQueen';
import { PLAGUE_WIND_SCRIPT } from './cards/plagueWind';
import { PLAGUED_RUSALKA_SCRIPT } from './cards/plaguedRusalka';
import { PLANAR_BIRTH_SCRIPT } from './cards/planarBirth';
import { PARCEL_MYR_SCRIPT } from './cards/parcelMyr';
import { PART_THE_VEIL_SCRIPT } from './cards/partTheVeil';
import { PARTING_THOUGHTS_SCRIPT } from './cards/partingThoughts';
import { PATH_OF_PEACE_SCRIPT } from './cards/pathOfPeace';
import { PATRON_OF_THE_ARTS_SCRIPT } from './cards/patronOfTheArts';
import { PEACE_AND_QUIET_SCRIPT } from './cards/peaceAndQuiet';
import { PEACE_STRIDER_SCRIPT } from './cards/peaceStrider';
import { PEACH_GARDEN_OATH_SCRIPT } from './cards/peachGardenOath';
import { PEEL_FROM_REALITY_SCRIPT } from './cards/peelFromReality';
import { PEER_INTO_THE_ABYSS_SCRIPT } from './cards/peerIntoTheAbyss';
import { PEER_PAST_THE_VEIL_SCRIPT } from './cards/peerPastTheVeil';
import { PENUMBRA_BOBCAT_SCRIPT } from './cards/penumbraBobcat';
import { PENUMBRA_SPIDER_SCRIPT } from './cards/penumbraSpider';
import { PENUMBRA_WURM_SCRIPT } from './cards/penumbraWurm';
import { PEPPERSMOKE_SCRIPT } from './cards/peppersmoke';
import { PERISH_SCRIPT } from './cards/perish';
import { PESTERED_WELLGUARD_SCRIPT } from './cards/pesteredWellguard';
import { PHARIKAS_CURE_SCRIPT } from './cards/pharikasCure';
import { PHYRESIS_OUTBREAK_SCRIPT } from './cards/phyresisOutbreak';
import { PHYREXIAS_CORE_SCRIPT } from './cards/phyrexiasCore';
import { PHYREXIAN_DEBASER_SCRIPT } from './cards/phyrexianDebaser';
import { ORZHOV_LOCKET_SCRIPT } from './cards/orzhovLocket';
import { OSCORP_RESEARCH_TEAM_SCRIPT } from './cards/oscorpResearchTeam';
import { OSTIARY_THRULL_SCRIPT } from './cards/ostiaryThrull';
import { OUTLAW_MEDIC_SCRIPT } from './cards/outlawMedic';
import { OUTNUMBER_SCRIPT } from './cards/outnumber';
import { OVERFLOWING_INSIGHT_SCRIPT } from './cards/overflowingInsight';
import { OVERGROWN_ESTATE_SCRIPT } from './cards/overgrownEstate';
import { OVERWHELMING_FORCES_SCRIPT } from './cards/overwhelmingForces';
import { OVERWHELMING_INSTINCT_SCRIPT } from './cards/overwhelmingInstinct';
import { OVERWHELMING_INTELLECT_SCRIPT } from './cards/overwhelmingIntellect';
import { OXIDDA_SCRAPMELTER_SCRIPT } from './cards/oxiddaScrapmelter';
import { OXIDIZE_SCRIPT } from './cards/oxidize';
import { OYOBI_WHO_SPLIT_THE_HEAVENS_SCRIPT } from './cards/oyobiWhoSplitTheHeavens';
import { PACIFICATION_ARRAY_SCRIPT } from './cards/pacificationArray';
import { PAINFUL_LESSON_SCRIPT } from './cards/painfulLesson';
import { PALACE_FAMILIAR_SCRIPT } from './cards/palaceFamiliar';
import { PALADIN_OF_THE_BLOODSTAINED_SCRIPT } from './cards/paladinOfTheBloodstained';
import { PARADOX_GARDENS_SCRIPT } from './cards/paradoxGardens';
import { PARALLECTRIC_FEEDBACK_SCRIPT } from './cards/parallectricFeedback';
import { PARASELENE_SCRIPT } from './cards/paraselene';
import { OLTEC_CLOUD_GUARD_SCRIPT } from './cards/oltecCloudGuard';
import { OMASHU_CITY_SCRIPT } from './cards/omashuCity';
import { OMENSPEAKER_SCRIPT } from './cards/omenspeaker';
import { OMINOUS_ASYLUM_SCRIPT } from './cards/ominousAsylum';
import { ONE_WITH_NOTHING_SCRIPT } from './cards/oneWithNothing';
import { ONE_WITH_THE_MACHINE_SCRIPT } from './cards/oneWithTheMachine';
import { ONSLAUGHT_SCRIPT } from './cards/onslaught';
import { ONYX_GOBLET_SCRIPT } from './cards/onyxGoblet';
import { ONYX_MAGE_SCRIPT } from './cards/onyxMage';
import { OPEN_THE_GRAVES_SCRIPT } from './cards/openTheGraves';
import { OPPORTUNITY_SCRIPT } from './cards/opportunity';
import { ORACLES_RESTORATION_SCRIPT } from './cards/oraclesRestoration';
import { ORC_SURESHOT_SCRIPT } from './cards/orcSureshot';
import { ORCISH_BLOODPAINTER_SCRIPT } from './cards/orcishBloodpainter';
import { ORCISH_MECHANICS_SCRIPT } from './cards/orcishMechanics';
import { ORCISH_VANDAL_SCRIPT } from './cards/orcishVandal';
import { ORNAMENTAL_COURAGE_SCRIPT } from './cards/ornamentalCourage';
import { ORNERY_KUDU_SCRIPT } from './cards/orneryKudu';
import { ORZHOV_CLUESTONE_SCRIPT } from './cards/orzhovCluestone';
import { NO_WITNESSES_SCRIPT } from './cards/noWitnesses';
import { NOBLE_STAND_SCRIPT } from './cards/nobleStand';
import { NOBLE_STEEDS_SCRIPT } from './cards/nobleSteeds';
import { NOCTURNAL_RAID_SCRIPT } from './cards/nocturnalRaid';
import { NOGGLE_ROBBER_SCRIPT } from './cards/noggleRobber';
import { NORTH_POLE_GATES_SCRIPT } from './cards/northPoleGates';
import { NOTION_RAIN_SCRIPT } from './cards/notionRain';
import { NOXIOUS_REVIVAL_SCRIPT } from './cards/noxiousRevival';
import { NURGLES_CONSCRIPTION_SCRIPT } from './cards/nurglesConscription';
import { NYX_FLEECE_RAM_SCRIPT } from './cards/nyxFleeceRam';
import { OASIS_GARDENER_SCRIPT } from './cards/oasisGardener';
import { OCTOPROPHET_SCRIPT } from './cards/octoprophet';
import { ODRICS_OUTRIDER_SCRIPT } from './cards/odricsOutrider';
import { OGGYAR_BATTLE_SEER_SCRIPT } from './cards/oggyarBattleSeer';
import { OGRE_ARSONIST_SCRIPT } from './cards/ogreArsonist';
import { OLIVIAS_WRATH_SCRIPT } from './cards/oliviasWrath';
import { NEBELGAST_HERALD_SCRIPT } from './cards/nebelgastHerald';
import { NEED_FOR_SPEED_SCRIPT } from './cards/needForSpeed';
import { NEEDLE_STORM_SCRIPT } from './cards/needleStorm';
import { NEFARIOUS_IMP_SCRIPT } from './cards/nefariousImp';
import { NEIGHBORHOOD_GUARDIAN_SCRIPT } from './cards/neighborhoodGuardian';
import { NETWORK_DISRUPTOR_SCRIPT } from './cards/networkDisruptor';
import { NEUROK_REPLICA_SCRIPT } from './cards/neurokReplica';
import { NEUTRALIZE_THE_GUARDS_SCRIPT } from './cards/neutralizeTheGuards';
import { NEW_BENALIA_SCRIPT } from './cards/newBenalia';
import { NEWS_HELICOPTER_SCRIPT } from './cards/newsHelicopter';
import { NIGHTHAWK_DARK_DEFENDER_SCRIPT } from './cards/nighthawkDarkDefender';
import { NIGHTMARISH_END_SCRIPT } from './cards/nightmarishEnd';
import { NIGHTVEIL_SPRITE_SCRIPT } from './cards/nightveilSprite';
import { NIM_REPLICA_SCRIPT } from './cards/nimReplica';
import { NIMBLE_INNOVATOR_SCRIPT } from './cards/nimbleInnovator';
import { NIMBLE_THOPTERIST_SCRIPT } from './cards/nimbleThopterist';
import { NIMBLEWRIGHT_SCHEMATIC_SCRIPT } from './cards/nimblewrightSchematic';
import { NIMRAISER_PALADIN_SCRIPT } from './cards/nimraiserPaladin';
import { NINE_TAIL_WHITE_FOX_SCRIPT } from './cards/nineTailWhiteFox';
import { MULTANIS_PRESENCE_SCRIPT } from './cards/multanisPresence';
import { MURMURING_MYSTIC_SCRIPT } from './cards/murmuringMystic';
import { MUSCLE_BURST_SCRIPT } from './cards/muscleBurst';
import { MUSE_DRAKE_SCRIPT } from './cards/museDrake';
import { MUTANT_TOWN_SCRIPT } from './cards/mutantTown';
import { MUTILATE_SCRIPT } from './cards/mutilate';
import { MYR_SCRAPLING_SCRIPT } from './cards/myrScrapling';
import { MYR_SIRE_SCRIPT } from './cards/myrSire';
import { MYSTIC_ARCHAEOLOGIST_SCRIPT } from './cards/mysticArchaeologist';
import { MYSTIC_REPEAL_SCRIPT } from './cards/mysticRepeal';
import { MYSTIC_SNAKE_SCRIPT } from './cards/mysticSnake';
import { NAGA_ORACLE_SCRIPT } from './cards/nagaOracle';
import { NANTUKO_DISCIPLE_SCRIPT } from './cards/nantukoDisciple';
import { NATURAL_OBSOLESCENCE_SCRIPT } from './cards/naturalObsolescence';
import { NATURAL_SPRING_SCRIPT } from './cards/naturalSpring';
import { NATURES_CLAIM_SCRIPT } from './cards/naturesClaim';
import { NATURES_RESURGENCE_SCRIPT } from './cards/naturesResurgence';
import { NATURES_RUIN_SCRIPT } from './cards/naturesRuin';
import { NAUSEA_SCRIPT } from './cards/nausea';
import { NEBELGAST_BEGUILER_SCRIPT } from './cards/nebelgastBeguiler';
import { MOB_JUSTICE_SCRIPT } from './cards/mobJustice';
import { MOBILIZE_SCRIPT } from './cards/mobilize';
import { MOGG_RAIDER_SCRIPT } from './cards/moggRaider';
import { MOLECULAR_MODIFIER_SCRIPT } from './cards/molecularModifier';
import { MOLTEN_RAIN_SCRIPT } from './cards/moltenRain';
import { MONK_REALIST_SCRIPT } from './cards/monkRealist';
import { MONUMENTAL_CORRUPTION_SCRIPT } from './cards/monumentalCorruption';
import { MOONFOLK_PUZZLEMAKER_SCRIPT } from './cards/moonfolkPuzzlemaker';
import { MOONLIT_WAKE_SCRIPT } from './cards/moonlitWake';
import { MOONRISE_CLERIC_SCRIPT } from './cards/moonriseCleric';
import { MORALE_SCRIPT } from './cards/morale';
import { MORNINGTIDE_SCRIPT } from './cards/morningtide';
import { MOSSBEARD_ANCIENT_SCRIPT } from './cards/mossbeardAncient';
import { MOSSTODON_SCRIPT } from './cards/mosstodon';
import { MOTHRIDER_PATROL_SCRIPT } from './cards/mothriderPatrol';
import { MUDHOLE_SCRIPT } from './cards/mudhole';
import { MULCH_SCRIPT } from './cards/mulch';
import { MULTANIS_DECREE_SCRIPT } from './cards/multanisDecree';
import { MIGHT_OF_THE_NEPHILIM_SCRIPT } from './cards/mightOfTheNephilim';
import { MILITARY_INTELLIGENCE_SCRIPT } from './cards/militaryIntelligence';
import { MIND_BURST_SCRIPT } from './cards/mindBurst';
import { MIND_FUNERAL_SCRIPT } from './cards/mindFuneral';
import { MIND_SPRING_SCRIPT } from './cards/mindSpring';
import { MIND_STONE_SCRIPT } from './cards/mindStone';
import { MINIONS_MURMURS_SCRIPT } from './cards/minionsMurmurs';
import { MINISTER_OF_IMPEDIMENTS_SCRIPT } from './cards/ministerOfImpediments';
import { MINTSTROSITY_SCRIPT } from './cards/mintstrosity';
import { MISFORTUNES_GAIN_SCRIPT } from './cards/misfortunesGain';
import { MIST_RAVEN_SCRIPT } from './cards/mistRaven';
import { MISTHIOSS_FURY_SCRIPT } from './cards/misthiossFury';
import { MISTY_PALMS_OASIS_SCRIPT } from './cards/mistyPalmsOasis';
import { MMMENON_UTHROS_EXILE_SCRIPT } from './cards/mmmenonUthrosExile';
import { MASSIVE_RAID_SCRIPT } from './cards/massiveRaid';
import { MASTER_THE_WAY_SCRIPT } from './cards/masterTheWay';
import { MASTERS_REBUKE_SCRIPT } from './cards/mastersRebuke';
import { MATHEMAGICS_SCRIPT } from './cards/mathemagics';
import { MELT_TERRAIN_SCRIPT } from './cards/meltTerrain';
import { MELTDOWN_SCRIPT } from './cards/meltdown';
import { MERCADIAS_DOWNFALL_SCRIPT } from './cards/mercadiasDownfall';
import { MESA_CAVALIER_SCRIPT } from './cards/mesaCavalier';
import { MESSENGER_DRAKE_SCRIPT } from './cards/messengerDrake';
import { MESSENGER_FALCONS_SCRIPT } from './cards/messengerFalcons';
import { METAL_FATIGUE_SCRIPT } from './cards/metalFatigue';
import { METICULOUS_ARCHIVE_SCRIPT } from './cards/meticulousArchive';
import { METROPOLIS_ANGEL_SCRIPT } from './cards/metropolisAngel';
import { MIGHT_OF_ALARA_SCRIPT } from './cards/mightOfAlara';
import { MIGHT_OF_THE_ANCESTORS_SCRIPT } from './cards/mightOfTheAncestors';
import { MIGHT_OF_THE_MASSES_SCRIPT } from './cards/mightOfTheMasses';
import { LUCID_DREAMS_SCRIPT } from './cards/lucidDreams';
import { LUNAR_INSIGHT_SCRIPT } from './cards/lunarInsight';
import { LUNGE_SCRIPT } from './cards/lunge';
import { LUSH_PORTICO_SCRIPT } from './cards/lushPortico';
import { LYS_ALANA_INFORMANT_SCRIPT } from './cards/lysAlanaInformant';
import { MAGMAQUAKE_SCRIPT } from './cards/magmaquake';
import { MAGNIFY_SCRIPT } from './cards/magnify';
import { MAKE_OBSOLETE_SCRIPT } from './cards/makeObsolete';
import { MANA_GEODE_SCRIPT } from './cards/manaGeode';
import { MANA_SHORT_SCRIPT } from './cards/manaShort';
import { MARROW_SHARDS_SCRIPT } from './cards/marrowShards';
import { MARSH_GAS_SCRIPT } from './cards/marshGas';
import { MARTYRS_CRY_SCRIPT } from './cards/martyrsCry';
import { MASS_APPEAL_SCRIPT } from './cards/massAppeal';
import { MASS_CALCIFY_SCRIPT } from './cards/massCalcify';
import { LAST_BREATH_SCRIPT } from './cards/lastBreath';
import { LAST_KISS_SCRIPT } from './cards/lastKiss';
import { LAVA_FLOW_SCRIPT } from './cards/lavaFlow';
import { LAVALANCHE_SCRIPT } from './cards/lavalanche';
import { LAY_BARE_SCRIPT } from './cards/layBare';
import { LEAVE_NO_TRACE_SCRIPT } from './cards/leaveNoTrace';
import { LEECHES_SCRIPT } from './cards/leeches';
import { LEGIONS_END_SCRIPT } from './cards/legionsEnd';
import { LIFE_BURST_SCRIPT } from './cards/lifeBurst';
import { LIGHTNING_HELIX_SCRIPT } from './cards/lightningHelix';
import { LITURGY_OF_BLOOD_SCRIPT } from './cards/liturgyOfBlood';
import { LOOMING_SPIRES_SCRIPT } from './cards/loomingSpires';
import { LOREHOLD_CAMPUS_SCRIPT } from './cards/loreholdCampus';
import { LOST_LEGION_SCRIPT } from './cards/lostLegion';
import { LOTHLORIEN_LOOKOUT_SCRIPT } from './cards/lothlorienLookout';
import { JOKULHAUPS_SCRIPT } from './cards/jokulhaups';
import { JOVIAL_EVIL_SCRIPT } from './cards/jovialEvil';
import { JOYOUS_RESPITE_SCRIPT } from './cards/joyousRespite';
import { JUDGMENT_BOLT_SCRIPT } from './cards/judgmentBolt';
import { JUSTICE_STRIKE_SCRIPT } from './cards/justiceStrike';
import { KAERVEKS_HEX_SCRIPT } from './cards/kaerveksHex';
import { KAMI_OF_THE_WANING_MOON_SCRIPT } from './cards/kamiOfTheWaningMoon';
import { KAYAS_WRATH_SCRIPT } from './cards/kayasWrath';
import { KEEN_GLIDEMASTER_SCRIPT } from './cards/keenGlidemaster';
import { KEEP_WATCH_SCRIPT } from './cards/keepWatch';
import { KIKUS_SHADOW_SCRIPT } from './cards/kikusShadow';
import { KINDLE_SCRIPT } from './cards/kindle';
import { KISHLA_VILLAGE_SCRIPT } from './cards/kishlaVillage';
import { KISS_OF_DEATH_SCRIPT } from './cards/kissOfDeath';
import { KISS_OF_THE_AMESHA_SCRIPT } from './cards/kissOfTheAmesha';
import { LANDBIND_RITUAL_SCRIPT } from './cards/landbindRitual';
import { LANGUISH_SCRIPT } from './cards/languish';
import { LAQUATUSS_CREATIVITY_SCRIPT } from './cards/laquatussCreativity';
import { INSPIRATION_SCRIPT } from './cards/inspiration';
import { INSPIRED_ULTIMATUM_SCRIPT } from './cards/inspiredUltimatum';
import { INSPIRIT_SCRIPT } from './cards/inspirit';
import { INTO_THE_CORE_SCRIPT } from './cards/intoTheCore';
import { INUNDATE_SCRIPT } from './cards/inundate';
import { INVIGORATING_FALLS_SCRIPT } from './cards/invigoratingFalls';
import { INVINCIBLE_HYMN_SCRIPT } from './cards/invincibleHymn';
import { INVOKE_THE_WINDS_SCRIPT } from './cards/invokeTheWinds';
import { IONIZE_SCRIPT } from './cards/ionize';
import { IRE_OF_KAMINARI_SCRIPT } from './cards/ireOfKaminari';
import { IRIDIAN_MAELSTROM_SCRIPT } from './cards/iridianMaelstrom';
import { IRON_LANCE_SCRIPT } from './cards/ironLance';
import { IRRADIATE_SCRIPT } from './cards/irradiate';
import { IXALLIS_KEEPER_SCRIPT } from './cards/ixallisKeeper';
import { JADED_RESPONSE_SCRIPT } from './cards/jadedResponse';
import { JAGGED_LIGHTNING_SCRIPT } from './cards/jaggedLightning';
import { HYSTERICAL_BLINDNESS_SCRIPT } from './cards/hystericalBlindness';
import { ICATIAN_SCOUT_SCRIPT } from './cards/icatianScout';
import { ICEQUAKE_SCRIPT } from './cards/icequake';
import { IDENTITY_CRISIS_SCRIPT } from './cards/identityCrisis';
import { IL_MHEG_PIXIE_SCRIPT } from './cards/ilMhegPixie';
import { ILLUMINATION_SCRIPT } from './cards/illumination';
import { IMMOLATING_GYRE_SCRIPT } from './cards/immolatingGyre';
import { IMPERIOUS_INKMAGE_SCRIPT } from './cards/imperiousInkmage';
import { IN_GARRUKS_WAKE_SCRIPT } from './cards/inGarruksWake';
import { INCANDESCENT_ARIA_SCRIPT } from './cards/incandescentAria';
import { INCITE_REBELLION_SCRIPT } from './cards/inciteRebellion';
import { INFECTIOUS_BITE_SCRIPT } from './cards/infectiousBite';
import { INFECTIOUS_INQUIRY_SCRIPT } from './cards/infectiousInquiry';
import { INFERNAL_CONTRACT_SCRIPT } from './cards/infernalContract';
import { INFERNO_SCRIPT } from './cards/inferno';
import { INFEST_SCRIPT } from './cards/infest';
import { INNER_CALM_OUTER_STRENGTH_SCRIPT } from './cards/innerCalmOuterStrength';
import { INNER_FIRE_SCRIPT } from './cards/innerFire';
import { INNER_STRUGGLE_SCRIPT } from './cards/innerStruggle';
import { INQUISITION_SCRIPT } from './cards/inquisition';
import { HOLY_LIGHT_SCRIPT } from './cards/holyLight';
import { HOMING_LIGHTNING_SCRIPT } from './cards/homingLightning';
import { HONOR_THE_FALLEN_SCRIPT } from './cards/honorTheFallen';
import { HOODWINK_SCRIPT } from './cards/hoodwink';
import { HOPE_AND_GLORY_SCRIPT } from './cards/hopeAndGlory';
import { HORIZON_SCHOLAR_SCRIPT } from './cards/horizonScholar';
import { HORRIFIC_ASSAULT_SCRIPT } from './cards/horrificAssault';
import { HOUR_OF_GLORY_SCRIPT } from './cards/hourOfGlory';
import { HOWL_FROM_BEYOND_SCRIPT } from './cards/howlFromBeyond';
import { HUATLIS_FINAL_STRIKE_SCRIPT } from './cards/huatlisFinalStrike';
import { HUBRIS_SCRIPT } from './cards/hubris';
import { HUNGER_OF_THE_NIM_SCRIPT } from './cards/hungerOfTheNim';
import { HUNGRY_FLAMES_SCRIPT } from './cards/hungryFlames';
import { HURKYLS_RECALL_SCRIPT } from './cards/hurkylsRecall';
import { HURRICANE_SCRIPT } from './cards/hurricane';
import { HYMN_OF_REBIRTH_SCRIPT } from './cards/hymnOfRebirth';
import { HARMLESS_OFFERING_SCRIPT } from './cards/harmlessOffering';
import { HARMONIC_CONVERGENCE_SCRIPT } from './cards/harmonicConvergence';
import { HARROWING_JOURNEY_SCRIPT } from './cards/harrowingJourney';
import { HARSH_SUSTENANCE_SCRIPT } from './cards/harshSustenance';
import { HEARTWARMING_REDEMPTION_SCRIPT } from './cards/heartwarmingRedemption';
import { HEAT_RAY_SCRIPT } from './cards/heatRay';
import { HEDGE_MAZE_SCRIPT } from './cards/hedgeMaze';
import { HELL_SWARM_SCRIPT } from './cards/hellSwarm';
import { HELLFIRE_SCRIPT } from './cards/hellfire';
import { HEROES_REUNION_SCRIPT } from './cards/heroesReunion';
import { HEX_SCRIPT } from './cards/hex';
import { HIBERNATION_SCRIPT } from './cards/hibernation';
import { HIDETSUGUS_SECOND_RITE_SCRIPT } from './cards/hidetsugusSecondRite';
import { HINT_OF_INSANITY_SCRIPT } from './cards/hintOfInsanity';
import { HOBBITS_STING_SCRIPT } from './cards/hobbitsSting';
import { HOLD_THE_LINE_SCRIPT } from './cards/holdTheLine';
import { GLISSAS_SCORN_SCRIPT } from './cards/glissasScorn';
import { GLISTENING_DELUGE_SCRIPT } from './cards/glisteningDeluge';
import { GOBLIN_MOTIVATOR_SCRIPT } from './cards/goblinMotivator';
import { GOBLIN_WAR_STRIKE_SCRIPT } from './cards/goblinWarStrike';
import { GOLDEN_RATIO_SCRIPT } from './cards/goldenRatio';
import { GRANULATE_SCRIPT } from './cards/granulate';
import { GREAT_DEFENDER_SCRIPT } from './cards/greatDefender';
import { GREY_HAVENS_NAVIGATOR_SCRIPT } from './cards/greyHavensNavigator';
import { GRIM_FLOWERING_SCRIPT } from './cards/grimFlowering';
import { GRIPTIDE_SCRIPT } from './cards/griptide';
import { GROUND_ASSAULT_SCRIPT } from './cards/groundAssault';
import { GROWTH_CYCLE_SCRIPT } from './cards/growthCycle';
import { GRUESOME_FATE_SCRIPT } from './cards/gruesomeFate';
import { GUAN_YUS_MARCH_SCRIPT } from './cards/guanYusMarch';
import { GUARDIAN_OF_SOLITUDE_SCRIPT } from './cards/guardianOfSolitude';
import { HAIL_STORM_SCRIPT } from './cards/hailStorm';
import { HALLOWED_BURIAL_SCRIPT } from './cards/hallowedBurial';
import { HARD_HITTING_QUESTION_SCRIPT } from './cards/hardHittingQuestion';
import { HARMATTAN_EFREET_SCRIPT } from './cards/harmattanEfreet';
import { FRANTIC_INVENTORY_SCRIPT } from './cards/franticInventory';
import { FYNDHORN_BOW_SCRIPT } from './cards/fyndhornBow';
import { GAEAS_MIGHT_SCRIPT } from './cards/gaeasMight';
import { GALADHRIM_GUIDE_SCRIPT } from './cards/galadhrimGuide';
import { GALE_FORCE_SCRIPT } from './cards/galeForce';
import { GALE_SWOOPER_SCRIPT } from './cards/galeSwooper';
import { GALVANIC_BOMBARDMENT_SCRIPT } from './cards/galvanicBombardment';
import { GATES_ABLAZE_SCRIPT } from './cards/gatesAblaze';
import { GAZE_OF_ADAMARO_SCRIPT } from './cards/gazeOfAdamaro';
import { GAZE_OF_GRANITE_SCRIPT } from './cards/gazeOfGranite';
import { GEIST_OF_THE_ARCHIVES_SCRIPT } from './cards/geistOfTheArchives';
import { GERRARDS_COMMAND_SCRIPT } from './cards/gerrardsCommand';
import { GERRARDS_WISDOM_SCRIPT } from './cards/gerrardsWisdom';
import { GHOULS_FEAST_SCRIPT } from './cards/ghoulsFeast';
import { GIANTS_IRE_SCRIPT } from './cards/giantsIre';
import { GLIDER_KIDS_SCRIPT } from './cards/gliderKids';
import { FLAMES_OF_THE_RAZE_BOAR_SCRIPT } from './cards/flamesOfTheRazeBoar';
import { FLASHFIRES_SCRIPT } from './cards/flashfires';
import { FLAY_ESSENCE_SCRIPT } from './cards/flayEssence';
import { FLESH_TO_DUST_SCRIPT } from './cards/fleshToDust';
import { FLICKER_OF_FATE_SCRIPT } from './cards/flickerOfFate';
import { FLOW_OF_IDEAS_SCRIPT } from './cards/flowOfIdeas';
import { FLOWSTONE_SLIDE_SCRIPT } from './cards/flowstoneSlide';
import { FLUNK_SCRIPT } from './cards/flunk';
import { FLYING_CARPET_SCRIPT } from './cards/flyingCarpet';
import { FORCED_MARCH_SCRIPT } from './cards/forcedMarch';
import { FORCED_RETREAT_SCRIPT } from './cards/forcedRetreat';
import { FORUM_OF_AMITY_SCRIPT } from './cards/forumOfAmity';
import { FOUL_PLAY_SCRIPT } from './cards/foulPlay';
import { FOUL_TONGUE_SHRIEK_SCRIPT } from './cards/foulTongueShriek';
import { FRACTURE_SCRIPT } from './cards/fracture';
import { FRACTURING_GUST_SCRIPT } from './cards/fracturingGust';
import { FRANTIC_FIREBOLT_SCRIPT } from './cards/franticFirebolt';
import { FEAST_OF_FLESH_SCRIPT } from './cards/feastOfFlesh';
import { FEED_THE_SWARM_SCRIPT } from './cards/feedTheSwarm';
import { FEEDBACK_BOLT_SCRIPT } from './cards/feedbackBolt';
import { FEEDING_FRENZY_SCRIPT } from './cards/feedingFrenzy';
import { FESTERGLOOM_SCRIPT } from './cards/festergloom';
import { FESTIVAL_OF_TROKIN_SCRIPT } from './cards/festivalOfTrokin';
import { FESTIVE_FUNERAL_SCRIPT } from './cards/festiveFuneral';
import { FIELDS_OF_STRIFE_SCRIPT } from './cards/fieldsOfStrife';
import { FIERY_CANNONADE_SCRIPT } from './cards/fieryCannonade';
import { FIGHT_TO_THE_DEATH_SCRIPT } from './cards/fightToTheDeath';
import { FILIGREE_FRACTURE_SCRIPT } from './cards/filigreeFracture';
import { FILTER_OUT_SCRIPT } from './cards/filterOut';
import { FINAL_JUDGMENT_SCRIPT } from './cards/finalJudgment';
import { FIRE_TEMPEST_SCRIPT } from './cards/fireTempest';
import { FIRST_VOLLEY_SCRIPT } from './cards/firstVolley';
import { FISSURE_SCRIPT } from './cards/fissure';
import { FLAME_BURST_SCRIPT } from './cards/flameBurst';
import { FLAME_RIFT_SCRIPT } from './cards/flameRift';
import { FLAME_SWEEP_SCRIPT } from './cards/flameSweep';
import { FLAME_WAVE_SCRIPT } from './cards/flameWave';
import { EXTINGUISH_THE_LIGHT_SCRIPT } from './cards/extinguishTheLight';
import { EYE_GOUGE_SCRIPT } from './cards/eyeGouge';
import { EYEBLIGHT_MASSACRE_SCRIPT } from './cards/eyeblightMassacre';
import { FADING_HOPE_SCRIPT } from './cards/fadingHope';
import { FAERIE_SEER_SCRIPT } from './cards/faerieSeer';
import { FALLOW_EARTH_SCRIPT } from './cards/fallowEarth';
import { FALSE_MOURNING_SCRIPT } from './cards/falseMourning';
import { FAMINE_SCRIPT } from './cards/famine';
import { FATED_CONFLAGRATION_SCRIPT } from './cards/fatedConflagration';
import { FATED_RETRIBUTION_SCRIPT } from './cards/fatedRetribution';
import { FATEFUL_ABSENCE_SCRIPT } from './cards/fatefulAbsence';
import { FATEFUL_SHOWDOWN_SCRIPT } from './cards/fatefulShowdown';
import { FAULT_LINE_SCRIPT } from './cards/faultLine';
import { FEAR_OF_SURVEILLANCE_SCRIPT } from './cards/fearOfSurveillance';
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
  TRAPFINDERS_TRICK_SCRIPT,
  TRAVERSE_ETERNITY_SCRIPT,
  TREASURE_DREDGER_SCRIPT,
  TREASURE_HUNT_SCRIPT,
  TREASURE_TROVE_SCRIPT,
  TREETOP_FREEDOM_FIGHTERS_SCRIPT,
  TREMOR_SCRIPT,
  TRIBAL_FLAMES_SCRIPT,
  TRIP_NOOSE_SCRIPT,
  TRIUMPHANT_CHOMP_SCRIPT,
  TROPICAL_STORM_SCRIPT,
  TRUMPET_BLAST_SCRIPT,
  TSUNAMI_SCRIPT,
  TUKATONGUE_THALLID_SCRIPT,
  TUKNIR_DEATHLOCK_SCRIPT,
  TUNNEL_SURVEYOR_SCRIPT,
  TURA_KENNERUD_SKYKNIGHT_SCRIPT,
  TOLARIAN_WINDS_SCRIPT,
  TOMBFIRE_SCRIPT,
  TOME_OF_THE_GUILDPACT_SCRIPT,
  TOME_RAIDER_SCRIPT,
  TORCH_FIEND_SCRIPT,
  TORCH_THE_WITNESS_SCRIPT,
  TORRENT_OF_FIRE_SCRIPT,
  TOUCAN_PUFFIN_SCRIPT,
  TOWER_OF_CALAMITIES_SCRIPT,
  TOWER_OF_CHAMPIONS_SCRIPT,
  TOWER_OF_EONS_SCRIPT,
  TOWER_OF_FORTUNES_SCRIPT,
  TRAMWAY_STATION_SCRIPT,
  TRANQUIL_COVE_SCRIPT,
  TRANQUIL_DOMAIN_SCRIPT,
  TRANQUILITY_SCRIPT,
  THRISS_NANTUKO_PRIMUS_SCRIPT,
  THUNDER_OF_HOOVES_SCRIPT,
  THUNDERING_FALLS_SCRIPT,
  THUNDEROUS_SNAPPER_SCRIPT,
  TIDE_SKIMMER_SCRIPT,
  TIDEPOOL_TURTLE_SCRIPT,
  TIDESPOUT_TYRANT_SCRIPT,
  TIDY_CONCLUSION_SCRIPT,
  TIMBERLAND_GUIDE_SCRIPT,
  TIME_EBB_SCRIPT,
  TIRELESS_MISSIONARIES_SCRIPT,
  TITANS_GRAVE_SCRIPT,
  TIVADARS_CRUSADE_SCRIPT,
  TOCASIAS_DIG_SITE_SCRIPT,
  TOIL_TO_RENOWN_SCRIPT,
  THE_SURGICAL_BAY_SCRIPT,
  THEFT_OF_DREAMS_SCRIPT,
  THEIR_NAME_IS_DEATH_SCRIPT,
  THEODEN_KING_OF_ROHAN_SCRIPT,
  THERMOKARST_SCRIPT,
  THIEVING_MAGPIE_SCRIPT,
  THIEVING_OTTER_SCRIPT,
  THINK_TANK_SCRIPT,
  THIRD_PATH_ICONOCLAST_SCRIPT,
  THIRD_PATH_SAVANT_SCRIPT,
  THOPTER_ARCHITECT_SCRIPT,
  THORNWIND_FAERIES_SCRIPT,
  THORNWOOD_FALLS_SCRIPT,
  THOUGHTWEFT_GAMBIT_SCRIPT,
  THOUGHTWEFT_LIEUTENANT_SCRIPT,
  THRAN_VIGIL_SCRIPT,
  THRASHING_BRONTODON_SCRIPT,
  THRAXODEMON_SCRIPT,
  THREE_TREE_SCRIBE_SCRIPT,
  TEMPORAL_SPRING_SCRIPT,
  TEMUR_BANNER_SCRIPT,
  TENDERIZE_SCRIPT,
  TENDRILS_OF_CORRUPTION_SCRIPT,
  TENTH_DISTRICT_GUARD_SCRIPT,
  TERASHIS_GRASP_SCRIPT,
  TEROHS_FAITHFUL_SCRIPT,
  TERRITORIAL_HAMMERSKULL_SCRIPT,
  TERROR_TIDE_SCRIPT,
  TESHAR_ANCESTORS_APOSTLE_SCRIPT,
  TESTAMENT_BEARER_SCRIPT,
  TEYOS_LIGHTSHIELD_SCRIPT,
  THALAKOS_SEER_SCRIPT,
  THALLID_SOOTHSAYER_SCRIPT,
  THAUMATURGES_FAMILIAR_SCRIPT,
  THAWBRINGER_SCRIPT,
  THE_AUTONOMOUS_FURNACE_SCRIPT,
  THE_DROSS_PITS_SCRIPT,
  THE_FAIR_BASILICA_SCRIPT,
  THE_HUNTER_MAZE_SCRIPT,
  TARPAN_SCRIPT,
  TASHAS_HIDEOUS_LAUGHTER_SCRIPT,
  TASTE_OF_BLOOD_SCRIPT,
  TAXI_DRIVER_SCRIPT,
  TCRI_BUILDING_SCRIPT,
  TEAM_TRANSMITTER_SCRIPT,
  TECTONIC_HAZARD_SCRIPT,
  TEETERING_PEAKS_SCRIPT,
  TELEMIN_PERFORMANCE_SCRIPT,
  TELIM_TORS_DARTS_SCRIPT,
  TEMPEST_OF_LIGHT_SCRIPT,
  TEMPLE_ACOLYTE_SCRIPT,
  TEMPLE_OF_ABANDON_SCRIPT,
  TEMPLE_OF_DECEIT_SCRIPT,
  TEMPLE_OF_ENLIGHTENMENT_SCRIPT,
  TEMPLE_OF_EPIPHANY_SCRIPT,
  TEMPLE_OF_MALADY_SCRIPT,
  TEMPLE_OF_MYSTERY_SCRIPT,
  TEMPLE_OF_PLENTY_SCRIPT,
  TEMPLE_OF_SILENCE_SCRIPT,
  TEMPLE_OF_TRIUMPH_SCRIPT,
  TEMPORAL_ADEPT_SCRIPT,
  TEMPORAL_EDDY_SCRIPT,
  TEMPORAL_MACHINATIONS_SCRIPT,
  SWIFT_SILENCE_SCRIPT,
  SWIFTWATER_CLIFFS_SCRIPT,
  SWIRLING_SANDSTORM_SCRIPT,
  SYLVAN_BRUSHSTRIDER_SCRIPT,
  SYLVAN_SAFEKEEPER_SCRIPT,
  SYLVOK_REPLICA_SCRIPT,
  SYMBIOSIS_SCRIPT,
  SYMBIOTIC_BEAST_SCRIPT,
  SYMBIOTIC_ELF_SCRIPT,
  SYMBIOTIC_WURM_SCRIPT,
  SYPHON_SOUL_SCRIPT,
  TAIL_SLASH_SCRIPT,
  TAKE_HEART_SCRIPT,
  TAKE_INVENTORY_SCRIPT,
  TAKEN_BY_NIGHTMARES_SCRIPT,
  TANGLEBLOOM_SCRIPT,
  TANGLESPAN_LOOKOUT_SCRIPT,
  TANUFEL_RIMESPEAKER_SCRIPT,
  TAR_PITCHER_SCRIPT,
  SUFFOCATING_BLAST_SCRIPT,
  SULTAI_ASCENDANCY_SCRIPT,
  SULTAI_BANNER_SCRIPT,
  SULTAI_FLAYER_SCRIPT,
  SULTAI_SOOTHSAYER_SCRIPT,
  SUMMIT_SENTINEL_SCRIPT,
  SUN_BLESSED_PEAK_SCRIPT,
  SUNDER_SCRIPT,
  SUNDER_FROM_WITHIN_SCRIPT,
  SUNHOME_FORTRESS_OF_THE_LEGION_SCRIPT,
  SUPERIOR_NUMBERS_SCRIPT,
  SUPPLY_LINE_CRANES_SCRIPT,
  SURTR_FIERY_JOTUN_SCRIPT,
  SUSTENANCE_SCRIPT,
  SWALLOWING_PLAGUE_SCRIPT,
  SWELTER_SCRIPT,
  SWIFT_KICK_SCRIPT,  STRANDS_OF_NIGHT_SCRIPT,
  STREAM_OF_LIFE_SCRIPT,
  STREAM_OF_UNCONSCIOUSNESS_SCRIPT,
  STRENGTH_OF_CEDARS_SCRIPT,
  STRIP_BARE_SCRIPT,
  STRIP_MINE_SCRIPT,
  STRIPED_BEARS_SCRIPT,
  STROKE_OF_GENIUS_SCRIPT,
  STRONGHOLD_DISCIPLINE_SCRIPT,
  STRUCTURAL_DISTORTION_SCRIPT,
  STUDENT_OF_OJUTAI_SCRIPT,
  SUBJUGATE_THE_HOBBITS_SCRIPT,
  SUBTERRANEAN_CAVERN_SCRIPT,
  SUBURBAN_SANCTUARY_SCRIPT,
  SUCCUMB_TO_TEMPTATION_SCRIPT,
  SUDDEN_IMPACT_SCRIPT,
  SUDDEN_INSIGHT_SCRIPT,
  STENCH_OF_DECAY_SCRIPT,
  STENSIA_BLOODHALL_SCRIPT,
  STERLING_HOUND_SCRIPT,
  STERN_DISMISSAL_SCRIPT,
  STERN_PROCTOR_SCRIPT,
  STINGING_BARRIER_SCRIPT,
  STOLEN_GRAIN_SCRIPT,
  STOMP_AND_HOWL_SCRIPT,
  STOMPING_SLABS_SCRIPT,
  STONE_HAVEN_MEDIC_SCRIPT,
  STONEBOUND_MENTOR_SCRIPT,
  STONEFURY_SCRIPT,
  STORM_SEEKER_SCRIPT,
  STORM_SPIRIT_SCRIPT,
  STORMS_WRATH_SCRIPT,
  STORMCALLER_OF_KERANOS_SCRIPT,
  SQUALL_SCRIPT,
  SQUALL_DRIFTER_SCRIPT,
  STABBING_PAIN_SCRIPT,
  STAFF_OF_THE_DEATH_MAGUS_SCRIPT,
  STAFF_OF_THE_FLAME_MAGUS_SCRIPT,
  STAFF_OF_THE_MIND_MAGUS_SCRIPT,
  STAFF_OF_THE_SUN_MAGUS_SCRIPT,
  STAFF_OF_THE_WILD_MAGUS_SCRIPT,
  STAFF_OF_ZEGON_SCRIPT,
  STAND_UNITED_SCRIPT,
  STAR_OF_EXTINCTION_SCRIPT,
  STARFALL_SCRIPT,
  STARFIGHTER_PILOT_SCRIPT,
  STARGAZE_SCRIPT,
  STARK_INDUSTRIES_SCRIPT,
  STARK_INDUSTRIES_EXECUTIVE_SCRIPT,
  STARLIGHT_SCRIPT,
  STARLIGHT_INVOKER_SCRIPT,
  STARVED_RUSALKA_SCRIPT,
  STAUNCH_DEFENDERS_SCRIPT,
  STEADFAST_SENTRY_SCRIPT,
  STEALER_OF_SECRETS_SCRIPT,
  STEAM_BLAST_SCRIPT,
  SPINAL_CENTIPEDE_SCRIPT,
  SPINED_MEGALODON_SCRIPT,
  SPINNING_WHEEL_SCRIPT,
  SPIRALING_EMBERS_SCRIPT,
  SPIRE_BARRAGE_SCRIPT,
  SPIRE_OWL_SCRIPT,
  SPIRITED_COMPANION_SCRIPT,
  SPIRITUAL_GUARDIAN_SCRIPT,
  SPITE_OF_MOGIS_SCRIPT,
  SPITEFUL_BLOW_SCRIPT,
  SPITTING_EARTH_SCRIPT,
  SPLASH_PORTAL_SCRIPT,
  SPLATTER_GOBLIN_SCRIPT,
  SPOILS_OF_EVIL_SCRIPT,
  SPORE_CRAWLER_SCRIPT,
  SPREADING_ROT_SCRIPT,
  SPRINGMANE_CERVIN_SCRIPT,
  SPROUTING_THRINAX_SCRIPT,
  SPYGLASS_SIREN_SCRIPT,
  SOULS_FIRE_SCRIPT,
  SOULS_GRACE_SCRIPT,
  SOULS_MAJESTY_SCRIPT,
  SOULKNIFE_SPY_SCRIPT,
  SOULMENDER_SCRIPT,
  SOULQUAKE_SCRIPT,
  SOULREAPER_OF_MOGIS_SCRIPT,
  SOULSCOUR_SCRIPT,
  SOULSWORN_JURY_SCRIPT,
  SOVEREIGNS_BITE_SCRIPT,
  SPARRING_CONSTRUCT_SCRIPT,
  SPARRING_MUMMY_SCRIPT,
  SPECTACLE_SUMMIT_SCRIPT,
  SPECTRAL_SAILOR_SCRIPT,
  SPELLKEEPER_WEIRD_SCRIPT,
  SPHINXS_REVELATION_SCRIPT,
  SPIDERWIG_BOGGART_SCRIPT,
  SLINKING_SKIRGE_SCRIPT,
  SLITHERING_CRYPTID_SCRIPT,
  SLIVER_QUEEN_SCRIPT,
  SLOBAD_GOBLIN_TINKERER_SCRIPT,
  SMASH_TO_SMITHEREENS_SCRIPT,
  SMOKESPEW_INVOKER_SCRIPT,
  SMOTHER_SCRIPT,
  SNARLING_GOREHOUND_SCRIPT,
  SOARING_SEACLIFF_SCRIPT,
  SOKKA_LATERAL_STRATEGIST_SCRIPT,
  SOLKANAR_THE_SWAMP_KING_SCRIPT,
  SOLDIER_OF_THE_GREY_HOST_SCRIPT,
  SONGS_OF_THE_DAMNED_SCRIPT,
  SOOTHING_BALM_SCRIPT,
  SORINS_THIRST_SCRIPT,
  SORINS_VENGEANCE_SCRIPT,
  SOUL_FEAST_SCRIPT,
  SINISTER_HIDEOUT_SCRIPT,
  SINISTER_STARFISH_SCRIPT,
  SIP_OF_HEMLOCK_SCRIPT,
  SIRENS_RUSE_SCRIPT,
  SIZZLE_SCRIPT,
  SKARRG_THE_RAGE_PITS_SCRIPT,
  SKINRENDER_SCRIPT,
  SKIRSDAG_CULTIST_SCRIPT,
  SKIRSDAG_FLAYER_SCRIPT,
  SKRED_SCRIPT,
  SKULDUGGERY_SCRIPT,
  SKULL_CATAPULT_SCRIPT,
  SKYBEAST_TRACKER_SCRIPT,
  SKYBRIDGE_TOWERS_SCRIPT,
  SKYCLAVE_CLERIC_SCRIPT,
  SKYREAPING_SCRIPT,
  SKYSCANNER_SCRIPT,
  SLAGDRILL_SCRAPPER_SCRIPT,
  SLASH_OF_LIGHT_SCRIPT,
  SLAYERS_STRONGHOLD_SCRIPT,
  SHORE_LURKER_SCRIPT,
  SHOWER_OF_SPARKS_SCRIPT,
  SHRIVEL_SCRIPT,
  SHU_GRAIN_CARAVAN_SCRIPT,
  SHU_SOLDIER_FARMERS_SCRIPT,
  SICK_AND_TIRED_SCRIPT,
  SIGIL_OF_THE_EMPTY_THRONE_SCRIPT,
  SIGILED_SKINK_SCRIPT,
  SIGILED_STARFISH_SCRIPT,
  SIGN_IN_BLOOD_SCRIPT,
  SILENT_ATTENDANT_SCRIPT,
  SILVER_RAVEN_SCRIPT,
  SILVERBACK_SHAMAN_SCRIPT,
  SILVERCHASE_FOX_SCRIPT,
  SILVERQUILL_CAMPUS_SCRIPT,
  SIMIC_CLUESTONE_SCRIPT,
  SIMIC_LOCKET_SCRIPT,
  SIMOON_SCRIPT,
  SERENE_OFFERING_SCRIPT,
  SERPENTS_PASS_SCRIPT,
  SERVO_SCHEMATIC_SCRIPT,
  SHADEWING_LAUREATE_SCRIPT,
  SHADOW_ALLEY_DENIZEN_SCRIPT,
  SHADOWFEED_SCRIPT,
  SHADOWS_VERDICT_SCRIPT,
  SHADOWSTORM_SCRIPT,
  SHADOWY_BACKSTREET_SCRIPT,
  SHAMAN_OF_SPRING_SCRIPT,
  SHAMBLING_GOBLIN_SCRIPT,
  SHATTER_THE_SKY_SCRIPT,
  SHATTERED_ACOLYTE_SCRIPT,
  SHATTERSTORM_SCRIPT,
  SHIELD_MATE_SCRIPT,
  SHIVAN_HELLKITE_SCRIPT,
  SHOPKEEPERS_BANE_SCRIPT,
  SHORE_KEEPER_SCRIPT,
  SEASIDE_HAVEN_SCRIPT,
  SECRET_RENDEZVOUS_SCRIPT,
  SEEDS_OF_INNOCENCE_SCRIPT,
  SEEKER_OF_SKYBREAK_SCRIPT,
  SEER_OF_STOLEN_SIGHT_SCRIPT,
  SEERS_LANTERN_SCRIPT,
  SEISMIC_RUPTURE_SCRIPT,
  SEISMIC_SHUDDER_SCRIPT,
  SEISMIC_SPIKE_SCRIPT,
  SEISMIC_STRIKE_SCRIPT,
  SEISMIC_WAVE_SCRIPT,
  SEJIRI_REFUGE_SCRIPT,
  SEK_KUAR_DEATHKEEPER_SCRIPT,
  SELESNYA_CLUESTONE_SCRIPT,
  SELESNYA_LOCKET_SCRIPT,
  SELLER_OF_SONGBIRDS_SCRIPT,
  SENATE_GRIFFIN_SCRIPT,
  SENTINEL_OF_THE_NAMELESS_CITY_SCRIPT,
  SERENE_HEART_SCRIPT,
  SCEPTER_OF_INSIGHT_SCRIPT,
  SCORCH_THE_FIELDS_SCRIPT,
  SCORCHED_RUSALKA_SCRIPT,
  SCOURED_BARRENS_SCRIPT,
  SCOURING_SANDS_SCRIPT,
  SCRAPHEAP_SCRIPT,
  SCRAPYARD_SALVO_SCRIPT,
  SCREAM_PUFF_SCRIPT,
  SCRIBE_OF_THE_MINDFUL_SCRIPT,
  SCROLL_THIEF_SCRIPT,
  SEA_GATE_ORACLE_SCRIPT,
  SEAFLOOR_ORACLE_SCRIPT,
  SEAL_OF_CLEANSING_SCRIPT,
  SEAL_OF_PRIMORDIUM_SCRIPT,
  SEAL_OF_REMOVAL_SCRIPT,
  SEAL_OF_STRENGTH_SCRIPT,
  SEARCH_WARRANT_SCRIPT,
  SEARCHLIGHT_COMPANION_SCRIPT,
  SEARING_FLESH_SCRIPT,
  SAILOR_OF_MEANS_SCRIPT,
  SALTFIELD_RECLUSE_SCRIPT,
  SALVAGE_SCRIPT,
  SALVAGER_OF_SECRETS_SCRIPT,
  SANDSTONE_BRIDGE_SCRIPT,
  SANDSTORM_SCRIPT,
  SANGUIMANCY_SCRIPT,
  SANITATION_AUTOMATON_SCRIPT,
  SARKHANS_RAGE_SCRIPT,
  SATYR_ENCHANTER_SCRIPT,
  SATYR_GROVEDANCER_SCRIPT,
  SAVAGE_GORILLA_SCRIPT,
  SAVAGE_MANSION_SCRIPT,
  SAVAGE_SMASH_SCRIPT,
  SAVAGE_SURGE_SCRIPT,
  SAVAGE_SWIPE_SCRIPT,
  SAVAGE_TWISTER_SCRIPT,
  SAVANNAH_SAGE_SCRIPT,
  SCALDING_DEVIL_SCRIPT,
  SCAVENGER_FOLK_SCRIPT,
  SCEPTER_OF_DOMINANCE_SCRIPT,
  RUBBLEBELT_BOAR_SCRIPT,
  RUGGED_HIGHLANDS_SCRIPT,
  RUINATION_SCRIPT,
  RUINOUS_GREMLIN_SCRIPT,
  RUINOUS_ULTIMATUM_SCRIPT,
  RUMBLING_ROCKSLIDE_SCRIPT,
  RUMBLING_SENTRY_SCRIPT,
  RUMMAGING_WIZARD_SCRIPT,
  RUN_AGROUND_SCRIPT,
  RUNE_SEALED_WALL_SCRIPT,
  RUNEWING_SCRIPT,
  RUSH_OF_BLOOD_SCRIPT,
  RUSH_OF_KNOWLEDGE_SCRIPT,
  RUTHLESS_PREDATION_SCRIPT,
  SHIELD_DEPLOYMENT_DRONE_SCRIPT,
  SACRED_ARMORY_SCRIPT,
  SACRED_PREY_SCRIPT,
  SAGE_AVEN_SCRIPT,
  SAGE_OF_EPITYR_SCRIPT,
  SAGE_OF_LAT_NAM_SCRIPT,
  SAGE_OWL_SCRIPT,
  SAGES_ROW_SAVANT_SCRIPT,
  RITE_OF_THE_DRAGONCALLER_SCRIPT,
  RITUAL_OF_SOOT_SCRIPT,
  RIVERS_REBUKE_SCRIPT,
  ROAD_RAGE_SCRIPT,
  ROAR_OF_RECLAMATION_SCRIPT,
  ROC_EGG_SCRIPT,
  ROCKSLIDE_AMBUSH_SCRIPT,
  ROCKY_REBUKE_SCRIPT,
  ROD_OF_RUIN_SCRIPT,
  ROILING_TERRAIN_SCRIPT,
  ROKUS_MASTERY_SCRIPT,
  ROLLICK_OF_ABANDON_SCRIPT,
  ROLLING_EARTHQUAKE_SCRIPT,
  RONOM_UNICORN_SCRIPT,
  ROOFTOP_BYPASS_SCRIPT,
  ROOTWATER_HUNTER_SCRIPT,
  ROTLUNG_REANIMATOR_SCRIPT,
  ROTTENHEART_GHOUL_SCRIPT,
  ROVING_HARPER_SCRIPT,
  RETRIBUTION_OF_THE_MEEK_SCRIPT,
  REWARDS_OF_DIVERSITY_SCRIPT,
  RHOX_ORACLE_SCRIPT,
  RIBBONS_OF_THE_REIKAI_SCRIPT,
  RIGHTEOUS_CAUSE_SCRIPT,
  RIGHTEOUS_FURY_SCRIPT,
  RIMEFUR_REINDEER_SCRIPT,
  RIPCHAIN_RAZORKIN_SCRIPT,
  RIPTIDE_SCRIPT,
  RIPTIDE_CRAB_SCRIPT,
  RISE_OF_THE_DARK_REALMS_SCRIPT,
  RISHADAN_DOCKHAND_SCRIPT,
  RISHADAN_PORT_SCRIPT,
  RISKY_RESEARCH_SCRIPT,
  RISKY_SHORTCUT_SCRIPT,
  RITE_OF_FLAME_SCRIPT,
  RELIC_BARRIER_SCRIPT,
  RELIQUARY_MONK_SCRIPT,
  REMOVE_ENCHANTMENTS_SCRIPT,
  RENDING_FLAME_SCRIPT,
  RENEWING_DAWN_SCRIPT,
  RENOWNED_WEAVER_SCRIPT,
  REPAY_IN_KIND_SCRIPT,
  REPEL_SCRIPT,
  REPENTANCE_SCRIPT,
  REPRISAL_SCRIPT,
  REPUTABLE_MERCHANT_SCRIPT,
  REQUIEM_ANGEL_SCRIPT,
  RESEARCH_THIEF_SCRIPT,
  RESOLUTE_REINFORCEMENTS_SCRIPT,
  RESOLUTE_WATCHDOG_SCRIPT,
  RETRACT_SCRIPT,
  RAZORFIN_HUNTER_SCRIPT,
  RAZORKIN_HORDECALLER_SCRIPT,
  REANIMATE_SCRIPT,
  REBUKING_CEREMONY_SCRIPT,
  RECKLESS_ASSAULT_SCRIPT,
  RECKLESS_REVELER_SCRIPT,
  RECLAIM_SCRIPT,
  RECLAIMING_VINES_SCRIPT,
  REDCAP_THIEF_SCRIPT,
  REDUCE_TO_DREAMS_SCRIPT,
  REFUSE_TO_YIELD_SCRIPT,
  REKI_THE_HISTORY_OF_KAMIGAWA_SCRIPT,
  RAIN_OF_BLADES_SCRIPT,
  RAIN_OF_DAGGERS_SCRIPT,
  RAIN_OF_EMBERS_SCRIPT,
  RAIN_OF_SALT_SCRIPT,
  RAKDOS_CLUESTONE_SCRIPT,
  RAKDOS_LOCKET_SCRIPT,
  RAKDOSS_RETURN_SCRIPT,
  RAKECLAW_GARGANTUAN_SCRIPT,
  RAKKA_MAR_SCRIPT,
  RALLY_SCRIPT,
  RALLY_OF_WINGS_SCRIPT,
  RALLY_THE_RIGHTEOUS_SCRIPT,
  RAPACIOUS_DRAGON_SCRIPT,
  RATHS_EDGE_SCRIPT,
  RATHI_TRAPPER_SCRIPT,
  RAUCOUS_THEATER_SCRIPT,
  RAVAGES_OF_WAR_SCRIPT,
  RAVAGING_HORDE_SCRIPT,
  RAVENOUS_BALOTH_SCRIPT,
  RAVENOUS_CHUPACABRA_SCRIPT,
  RAVENOUS_LINDWURM_SCRIPT,
  RAVENOUS_RATS_SCRIPT,
  RAVNICA_AT_WAR_SCRIPT,
  PSYCHIC_BARRIER_SCRIPT,
  PUBLIC_EXECUTION_SCRIPT,
  PUNCTURE_BLAST_SCRIPT,
  PUNISH_IGNORANCE_SCRIPT,
  PUNISH_THE_ENEMY_SCRIPT,
  PURIFY_SCRIPT,
  PURPLE_CRYSTAL_CRAB_SCRIPT,
  PUTREFY_SCRIPT,
  PYM_TECHNOLOGIES_SCRIPT,
  PYROCLASM_SCRIPT,
  PYROCLASTIC_ELEMENTAL_SCRIPT,
  QUAGMIRE_DRUID_SCRIPT,
  QUANDRIX_CAMPUS_SCRIPT,
  RABID_GNAW_SCRIPT,
  RACERS_RING_SCRIPT,
  RACK_AND_RUIN_SCRIPT,
  RADIATING_LIGHTNING_SCRIPT,
  RAGE_SCARRED_BERSERKER_SCRIPT,
  PRIDE_GUARDIAN_SCRIPT,
  PRIDEFUL_PARENT_SCRIPT,
  PRIEST_OF_IROAS_SCRIPT,
  PRIMAL_BELLOW_SCRIPT,
  PRIMEVAL_LIGHT_SCRIPT,
  PRIMORDIAL_PACHYDERM_SCRIPT,
  PRISM_RING_SCRIPT,
  PRISMARI_CAMPUS_SCRIPT,
  PRIZED_STATUE_SCRIPT,
  PRODIGAL_PYROMANCER_SCRIPT,
  PRODIGAL_SORCERER_SCRIPT,
  PROFANE_MEMENTO_SCRIPT,
  PROFANE_PRAYERS_SCRIPT,
  PROPHET_OF_THE_PEAK_SCRIPT,
  PROSPERITY_SCRIPT,
  PROSPEROUS_PIRATES_SCRIPT,
  PROTECTOR_OF_GONDOR_SCRIPT,
  PROVOKE_THE_TROLLS_SCRIPT,
  PSEUDODRAGON_FAMILIAR_SCRIPT,
  PSIONIC_BLAST_SCRIPT,
  PLANAR_CLEANSING_SCRIPT,
  PLANAR_DESPAIR_SCRIPT,
  PLAY_WITH_FIRE_SCRIPT,
  PLOW_UNDER_SCRIPT,
  PLUMECREED_ESCORT_SCRIPT,
  PLUNDERING_PIRATE_SCRIPT,
  POISON_THE_WELL_SCRIPT,
  POLLUTED_DEAD_SCRIPT,
  POND_PROPHET_SCRIPT,
  POUNCE_SCRIPT,
  PRECINCT_CAPTAIN_SCRIPT,
  PREENING_CHAMPION_SCRIPT,
  PRESCIENT_CHIMERA_SCRIPT,
  PRESENCE_OF_THE_WISE_SCRIPT,
  PRETENDING_POXBEARERS_SCRIPT,
  PRICE_OF_PROGRESS_SCRIPT,
  PHYREXIAN_DEFILER_SCRIPT,
  PHYREXIAN_DENOUNCER_SCRIPT,
  PHYREXIAN_RECLAMATION_SCRIPT,
  PHYREXIAN_VAULT_SCRIPT,
  PHYREXIAN_VIVISECTOR_SCRIPT,
  PIERCE_STRIDER_SCRIPT,
  PIETY_SCRIPT,
  PIGGY_BANK_SCRIPT,
  PILLAGE_SCRIPT,
  PILLARDROP_RESCUER_SCRIPT,
  PINPOINT_AVALANCHE_SCRIPT,
  PIRANHA_MARSH_SCRIPT,
  PITH_DRILLER_SCRIPT,
  PITILESS_PLUNDERER_SCRIPT,
  PIXIE_QUEEN_SCRIPT,
  PLAGUE_WIND_SCRIPT,
  PLAGUED_RUSALKA_SCRIPT,
  PLANAR_BIRTH_SCRIPT,
  PARCEL_MYR_SCRIPT,
  PART_THE_VEIL_SCRIPT,
  PARTING_THOUGHTS_SCRIPT,
  PATH_OF_PEACE_SCRIPT,
  PATRON_OF_THE_ARTS_SCRIPT,
  PEACE_AND_QUIET_SCRIPT,
  PEACE_STRIDER_SCRIPT,
  PEACH_GARDEN_OATH_SCRIPT,
  PEEL_FROM_REALITY_SCRIPT,
  PEER_INTO_THE_ABYSS_SCRIPT,
  PEER_PAST_THE_VEIL_SCRIPT,
  PENUMBRA_BOBCAT_SCRIPT,
  PENUMBRA_SPIDER_SCRIPT,
  PENUMBRA_WURM_SCRIPT,
  PEPPERSMOKE_SCRIPT,
  PERISH_SCRIPT,
  PESTERED_WELLGUARD_SCRIPT,
  PHARIKAS_CURE_SCRIPT,
  PHYRESIS_OUTBREAK_SCRIPT,
  PHYREXIAS_CORE_SCRIPT,
  PHYREXIAN_DEBASER_SCRIPT,
  ORZHOV_LOCKET_SCRIPT,
  OSCORP_RESEARCH_TEAM_SCRIPT,
  OSTIARY_THRULL_SCRIPT,
  OUTLAW_MEDIC_SCRIPT,
  OUTNUMBER_SCRIPT,
  OVERFLOWING_INSIGHT_SCRIPT,
  OVERGROWN_ESTATE_SCRIPT,
  OVERWHELMING_FORCES_SCRIPT,
  OVERWHELMING_INSTINCT_SCRIPT,
  OVERWHELMING_INTELLECT_SCRIPT,
  OXIDDA_SCRAPMELTER_SCRIPT,
  OXIDIZE_SCRIPT,
  OYOBI_WHO_SPLIT_THE_HEAVENS_SCRIPT,
  PACIFICATION_ARRAY_SCRIPT,
  PAINFUL_LESSON_SCRIPT,
  PALACE_FAMILIAR_SCRIPT,
  PALADIN_OF_THE_BLOODSTAINED_SCRIPT,
  PARADOX_GARDENS_SCRIPT,
  PARALLECTRIC_FEEDBACK_SCRIPT,
  PARASELENE_SCRIPT,
  OLTEC_CLOUD_GUARD_SCRIPT,
  OMASHU_CITY_SCRIPT,
  OMENSPEAKER_SCRIPT,
  OMINOUS_ASYLUM_SCRIPT,
  ONE_WITH_NOTHING_SCRIPT,
  ONE_WITH_THE_MACHINE_SCRIPT,
  ONSLAUGHT_SCRIPT,
  ONYX_GOBLET_SCRIPT,
  ONYX_MAGE_SCRIPT,
  OPEN_THE_GRAVES_SCRIPT,
  OPPORTUNITY_SCRIPT,
  ORACLES_RESTORATION_SCRIPT,
  ORC_SURESHOT_SCRIPT,
  ORCISH_BLOODPAINTER_SCRIPT,
  ORCISH_MECHANICS_SCRIPT,
  ORCISH_VANDAL_SCRIPT,
  ORNAMENTAL_COURAGE_SCRIPT,
  ORNERY_KUDU_SCRIPT,
  ORZHOV_CLUESTONE_SCRIPT,
  NO_WITNESSES_SCRIPT,
  NOBLE_STAND_SCRIPT,
  NOBLE_STEEDS_SCRIPT,
  NOCTURNAL_RAID_SCRIPT,
  NOGGLE_ROBBER_SCRIPT,
  NORTH_POLE_GATES_SCRIPT,
  NOTION_RAIN_SCRIPT,
  NOXIOUS_REVIVAL_SCRIPT,
  NURGLES_CONSCRIPTION_SCRIPT,
  NYX_FLEECE_RAM_SCRIPT,
  OASIS_GARDENER_SCRIPT,
  OCTOPROPHET_SCRIPT,
  ODRICS_OUTRIDER_SCRIPT,
  OGGYAR_BATTLE_SEER_SCRIPT,
  OGRE_ARSONIST_SCRIPT,
  OLIVIAS_WRATH_SCRIPT,
  NEBELGAST_HERALD_SCRIPT,
  NEED_FOR_SPEED_SCRIPT,
  NEEDLE_STORM_SCRIPT,
  NEFARIOUS_IMP_SCRIPT,
  NEIGHBORHOOD_GUARDIAN_SCRIPT,
  NETWORK_DISRUPTOR_SCRIPT,
  NEUROK_REPLICA_SCRIPT,
  NEUTRALIZE_THE_GUARDS_SCRIPT,
  NEW_BENALIA_SCRIPT,
  NEWS_HELICOPTER_SCRIPT,
  NIGHTHAWK_DARK_DEFENDER_SCRIPT,
  NIGHTMARISH_END_SCRIPT,
  NIGHTVEIL_SPRITE_SCRIPT,
  NIM_REPLICA_SCRIPT,
  NIMBLE_INNOVATOR_SCRIPT,
  NIMBLE_THOPTERIST_SCRIPT,
  NIMBLEWRIGHT_SCHEMATIC_SCRIPT,
  NIMRAISER_PALADIN_SCRIPT,
  NINE_TAIL_WHITE_FOX_SCRIPT,
  MULTANIS_PRESENCE_SCRIPT,
  MURMURING_MYSTIC_SCRIPT,
  MUSCLE_BURST_SCRIPT,
  MUSE_DRAKE_SCRIPT,
  MUTANT_TOWN_SCRIPT,
  MUTILATE_SCRIPT,
  MYR_SCRAPLING_SCRIPT,
  MYR_SIRE_SCRIPT,
  MYSTIC_ARCHAEOLOGIST_SCRIPT,
  MYSTIC_REPEAL_SCRIPT,
  MYSTIC_SNAKE_SCRIPT,
  NAGA_ORACLE_SCRIPT,
  NANTUKO_DISCIPLE_SCRIPT,
  NATURAL_OBSOLESCENCE_SCRIPT,
  NATURAL_SPRING_SCRIPT,
  NATURES_CLAIM_SCRIPT,
  NATURES_RESURGENCE_SCRIPT,
  NATURES_RUIN_SCRIPT,
  NAUSEA_SCRIPT,
  NEBELGAST_BEGUILER_SCRIPT,
  MOB_JUSTICE_SCRIPT,
  MOBILIZE_SCRIPT,
  MOGG_RAIDER_SCRIPT,
  MOLECULAR_MODIFIER_SCRIPT,
  MOLTEN_RAIN_SCRIPT,
  MONK_REALIST_SCRIPT,
  MONUMENTAL_CORRUPTION_SCRIPT,
  MOONFOLK_PUZZLEMAKER_SCRIPT,
  MOONLIT_WAKE_SCRIPT,
  MOONRISE_CLERIC_SCRIPT,
  MORALE_SCRIPT,
  MORNINGTIDE_SCRIPT,
  MOSSBEARD_ANCIENT_SCRIPT,
  MOSSTODON_SCRIPT,
  MOTHRIDER_PATROL_SCRIPT,
  MUDHOLE_SCRIPT,
  MULCH_SCRIPT,
  MULTANIS_DECREE_SCRIPT,
  MIGHT_OF_THE_NEPHILIM_SCRIPT,
  MILITARY_INTELLIGENCE_SCRIPT,
  MIND_BURST_SCRIPT,
  MIND_FUNERAL_SCRIPT,
  MIND_SPRING_SCRIPT,
  MIND_STONE_SCRIPT,
  MINIONS_MURMURS_SCRIPT,
  MINISTER_OF_IMPEDIMENTS_SCRIPT,
  MINTSTROSITY_SCRIPT,
  MISFORTUNES_GAIN_SCRIPT,
  MIST_RAVEN_SCRIPT,
  MISTHIOSS_FURY_SCRIPT,
  MISTY_PALMS_OASIS_SCRIPT,
  MMMENON_UTHROS_EXILE_SCRIPT,
  MASSIVE_RAID_SCRIPT,
  MASTER_THE_WAY_SCRIPT,
  MASTERS_REBUKE_SCRIPT,
  MATHEMAGICS_SCRIPT,
  MELT_TERRAIN_SCRIPT,
  MELTDOWN_SCRIPT,
  MERCADIAS_DOWNFALL_SCRIPT,
  MESA_CAVALIER_SCRIPT,
  MESSENGER_DRAKE_SCRIPT,
  MESSENGER_FALCONS_SCRIPT,
  METAL_FATIGUE_SCRIPT,
  METICULOUS_ARCHIVE_SCRIPT,
  METROPOLIS_ANGEL_SCRIPT,
  MIGHT_OF_ALARA_SCRIPT,
  MIGHT_OF_THE_ANCESTORS_SCRIPT,
  MIGHT_OF_THE_MASSES_SCRIPT,
  LUCID_DREAMS_SCRIPT,
  LUNAR_INSIGHT_SCRIPT,
  LUNGE_SCRIPT,
  LUSH_PORTICO_SCRIPT,
  LYS_ALANA_INFORMANT_SCRIPT,
  MAGMAQUAKE_SCRIPT,
  MAGNIFY_SCRIPT,
  MAKE_OBSOLETE_SCRIPT,
  MANA_GEODE_SCRIPT,
  MANA_SHORT_SCRIPT,
  MARROW_SHARDS_SCRIPT,
  MARSH_GAS_SCRIPT,
  MARTYRS_CRY_SCRIPT,
  MASS_APPEAL_SCRIPT,
  MASS_CALCIFY_SCRIPT,
  LAST_BREATH_SCRIPT,
  LAST_KISS_SCRIPT,
  LAVA_FLOW_SCRIPT,
  LAVALANCHE_SCRIPT,
  LAY_BARE_SCRIPT,
  LEAVE_NO_TRACE_SCRIPT,
  LEECHES_SCRIPT,
  LEGIONS_END_SCRIPT,
  LIFE_BURST_SCRIPT,
  LIGHTNING_HELIX_SCRIPT,
  LITURGY_OF_BLOOD_SCRIPT,
  LOOMING_SPIRES_SCRIPT,
  LOREHOLD_CAMPUS_SCRIPT,
  LOST_LEGION_SCRIPT,
  LOTHLORIEN_LOOKOUT_SCRIPT,
  JOKULHAUPS_SCRIPT,
  JOVIAL_EVIL_SCRIPT,
  JOYOUS_RESPITE_SCRIPT,
  JUDGMENT_BOLT_SCRIPT,
  JUSTICE_STRIKE_SCRIPT,
  KAERVEKS_HEX_SCRIPT,
  KAMI_OF_THE_WANING_MOON_SCRIPT,
  KAYAS_WRATH_SCRIPT,
  KEEN_GLIDEMASTER_SCRIPT,
  KEEP_WATCH_SCRIPT,
  KIKUS_SHADOW_SCRIPT,
  KINDLE_SCRIPT,
  KISHLA_VILLAGE_SCRIPT,
  KISS_OF_DEATH_SCRIPT,
  KISS_OF_THE_AMESHA_SCRIPT,
  LANDBIND_RITUAL_SCRIPT,
  LANGUISH_SCRIPT,
  LAQUATUSS_CREATIVITY_SCRIPT,
  INSPIRATION_SCRIPT,
  INSPIRED_ULTIMATUM_SCRIPT,
  INSPIRIT_SCRIPT,
  INTO_THE_CORE_SCRIPT,
  INUNDATE_SCRIPT,
  INVIGORATING_FALLS_SCRIPT,
  INVINCIBLE_HYMN_SCRIPT,
  INVOKE_THE_WINDS_SCRIPT,
  IONIZE_SCRIPT,
  IRE_OF_KAMINARI_SCRIPT,
  IRIDIAN_MAELSTROM_SCRIPT,
  IRON_LANCE_SCRIPT,
  IRRADIATE_SCRIPT,
  IXALLIS_KEEPER_SCRIPT,
  JADED_RESPONSE_SCRIPT,
  JAGGED_LIGHTNING_SCRIPT,
  HYSTERICAL_BLINDNESS_SCRIPT,
  ICATIAN_SCOUT_SCRIPT,
  ICEQUAKE_SCRIPT,
  IDENTITY_CRISIS_SCRIPT,
  IL_MHEG_PIXIE_SCRIPT,
  ILLUMINATION_SCRIPT,
  IMMOLATING_GYRE_SCRIPT,
  IMPERIOUS_INKMAGE_SCRIPT,
  IN_GARRUKS_WAKE_SCRIPT,
  INCANDESCENT_ARIA_SCRIPT,
  INCITE_REBELLION_SCRIPT,
  INFECTIOUS_BITE_SCRIPT,
  INFECTIOUS_INQUIRY_SCRIPT,
  INFERNAL_CONTRACT_SCRIPT,
  INFERNO_SCRIPT,
  INFEST_SCRIPT,
  INNER_CALM_OUTER_STRENGTH_SCRIPT,
  INNER_FIRE_SCRIPT,
  INNER_STRUGGLE_SCRIPT,
  INQUISITION_SCRIPT,
  HOLY_LIGHT_SCRIPT,
  HOMING_LIGHTNING_SCRIPT,
  HONOR_THE_FALLEN_SCRIPT,
  HOODWINK_SCRIPT,
  HOPE_AND_GLORY_SCRIPT,
  HORIZON_SCHOLAR_SCRIPT,
  HORRIFIC_ASSAULT_SCRIPT,
  HOUR_OF_GLORY_SCRIPT,
  HOWL_FROM_BEYOND_SCRIPT,
  HUATLIS_FINAL_STRIKE_SCRIPT,
  HUBRIS_SCRIPT,
  HUNGER_OF_THE_NIM_SCRIPT,
  HUNGRY_FLAMES_SCRIPT,
  HURKYLS_RECALL_SCRIPT,
  HURRICANE_SCRIPT,
  HYMN_OF_REBIRTH_SCRIPT,
  HARMLESS_OFFERING_SCRIPT,
  HARMONIC_CONVERGENCE_SCRIPT,
  HARROWING_JOURNEY_SCRIPT,
  HARSH_SUSTENANCE_SCRIPT,
  HEARTWARMING_REDEMPTION_SCRIPT,
  HEAT_RAY_SCRIPT,
  HEDGE_MAZE_SCRIPT,
  HELL_SWARM_SCRIPT,
  HELLFIRE_SCRIPT,
  HEROES_REUNION_SCRIPT,
  HEX_SCRIPT,
  HIBERNATION_SCRIPT,
  HIDETSUGUS_SECOND_RITE_SCRIPT,
  HINT_OF_INSANITY_SCRIPT,
  HOBBITS_STING_SCRIPT,
  HOLD_THE_LINE_SCRIPT,
  GLISSAS_SCORN_SCRIPT,
  GLISTENING_DELUGE_SCRIPT,
  GOBLIN_MOTIVATOR_SCRIPT,
  GOBLIN_WAR_STRIKE_SCRIPT,
  GOLDEN_RATIO_SCRIPT,
  GRANULATE_SCRIPT,
  GREAT_DEFENDER_SCRIPT,
  GREY_HAVENS_NAVIGATOR_SCRIPT,
  GRIM_FLOWERING_SCRIPT,
  GRIPTIDE_SCRIPT,
  GROUND_ASSAULT_SCRIPT,
  GROWTH_CYCLE_SCRIPT,
  GRUESOME_FATE_SCRIPT,
  GUAN_YUS_MARCH_SCRIPT,
  GUARDIAN_OF_SOLITUDE_SCRIPT,
  HAIL_STORM_SCRIPT,
  HALLOWED_BURIAL_SCRIPT,
  HARD_HITTING_QUESTION_SCRIPT,
  HARMATTAN_EFREET_SCRIPT,
  FRANTIC_INVENTORY_SCRIPT,
  FYNDHORN_BOW_SCRIPT,
  GAEAS_MIGHT_SCRIPT,
  GALADHRIM_GUIDE_SCRIPT,
  GALE_FORCE_SCRIPT,
  GALE_SWOOPER_SCRIPT,
  GALVANIC_BOMBARDMENT_SCRIPT,
  GATES_ABLAZE_SCRIPT,
  GAZE_OF_ADAMARO_SCRIPT,
  GAZE_OF_GRANITE_SCRIPT,
  GEIST_OF_THE_ARCHIVES_SCRIPT,
  GERRARDS_COMMAND_SCRIPT,
  GERRARDS_WISDOM_SCRIPT,
  GHOULS_FEAST_SCRIPT,
  GIANTS_IRE_SCRIPT,
  GLIDER_KIDS_SCRIPT,
  FLAMES_OF_THE_RAZE_BOAR_SCRIPT,
  FLASHFIRES_SCRIPT,
  FLAY_ESSENCE_SCRIPT,
  FLESH_TO_DUST_SCRIPT,
  FLICKER_OF_FATE_SCRIPT,
  FLOW_OF_IDEAS_SCRIPT,
  FLOWSTONE_SLIDE_SCRIPT,
  FLUNK_SCRIPT,
  FLYING_CARPET_SCRIPT,
  FORCED_MARCH_SCRIPT,
  FORCED_RETREAT_SCRIPT,
  FORUM_OF_AMITY_SCRIPT,
  FOUL_PLAY_SCRIPT,
  FOUL_TONGUE_SHRIEK_SCRIPT,
  FRACTURE_SCRIPT,
  FRACTURING_GUST_SCRIPT,
  FRANTIC_FIREBOLT_SCRIPT,
  FEAST_OF_FLESH_SCRIPT,
  FEED_THE_SWARM_SCRIPT,
  FEEDBACK_BOLT_SCRIPT,
  FEEDING_FRENZY_SCRIPT,
  FESTERGLOOM_SCRIPT,
  FESTIVAL_OF_TROKIN_SCRIPT,
  FESTIVE_FUNERAL_SCRIPT,
  FIELDS_OF_STRIFE_SCRIPT,
  FIERY_CANNONADE_SCRIPT,
  FIGHT_TO_THE_DEATH_SCRIPT,
  FILIGREE_FRACTURE_SCRIPT,
  FILTER_OUT_SCRIPT,
  FINAL_JUDGMENT_SCRIPT,
  FIRE_TEMPEST_SCRIPT,
  FIRST_VOLLEY_SCRIPT,
  FISSURE_SCRIPT,
  FLAME_BURST_SCRIPT,
  FLAME_RIFT_SCRIPT,
  FLAME_SWEEP_SCRIPT,
  FLAME_WAVE_SCRIPT,
  EXTINGUISH_THE_LIGHT_SCRIPT,
  EYE_GOUGE_SCRIPT,
  EYEBLIGHT_MASSACRE_SCRIPT,
  FADING_HOPE_SCRIPT,
  FAERIE_SEER_SCRIPT,
  FALLOW_EARTH_SCRIPT,
  FALSE_MOURNING_SCRIPT,
  FAMINE_SCRIPT,
  FATED_CONFLAGRATION_SCRIPT,
  FATED_RETRIBUTION_SCRIPT,
  FATEFUL_ABSENCE_SCRIPT,
  FATEFUL_SHOWDOWN_SCRIPT,
  FAULT_LINE_SCRIPT,
  FEAR_OF_SURVEILLANCE_SCRIPT,
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
