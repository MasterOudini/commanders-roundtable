import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { checkInvariants } from './invariants';
import { legalActions } from './legal';
import { project } from './project';
import { replay, stateHash } from './log';
import { nextBelow, seedRng, shuffle, type RngState } from './rng';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import {
  AJANIS_MANTRA,
  AJANIS_PRIDEMATE,
  GRAVITY_SPHERE_SCRIPT,
  LEVITATION_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  HARDENED_SCALES_SCRIPT,
  KNIGHTHOOD_SCRIPT,
  KWENDE_SCRIPT,
  HUMILITY_SCRIPT,
} from './testing/cardScripts';
// ⚠️ The SHIPPED scripts, not testing copies — M6.4a landed these eight, and
// the gate must exercise exactly what the app runs (one card, one script). The
// guard at the bottom of this file holds the rule in both halves: every entry
// of `SHIPPED_SCRIPTS` registered here AND dealt in `DECK`.
import { ONULET_SCRIPT } from './scripts/cards/onulet';
import { YOTIAN_DISSIDENT_SCRIPT } from './scripts/cards/yotianDissident';
import { SOUL_WARDEN_SCRIPT } from './scripts/cards/soulWarden';
import { ESSENCE_WARDEN_SCRIPT } from './scripts/cards/essenceWarden';
import { RADIANT_FOUNTAIN_SCRIPT } from './scripts/cards/radiantFountain';
import { ADVENTURERS_INN_SCRIPT } from './scripts/cards/adventurersInn';
import { WALL_OF_BLOSSOMS_SCRIPT } from './scripts/cards/wallOfBlossoms';
import { WALL_OF_OMENS_SCRIPT } from './scripts/cards/wallOfOmens';
import { BALEFUL_STRIX_SCRIPT } from './scripts/cards/balefulStrix';
import { ARCANE_ENCYCLOPEDIA_SCRIPT } from './scripts/cards/arcaneEncyclopedia';
import { DESERTED_TEMPLE_SCRIPT } from './scripts/cards/desertedTemple';
import { HEDRON_ARCHIVE_SCRIPT } from './scripts/cards/hedronArchive';
import { WAR_ROOM_SCRIPT } from './scripts/cards/warRoom';
import { TALRAND_SKY_SUMMONER_SCRIPT } from './scripts/cards/talrandSkySummoner';
import { AIM_LABS_SCRIPT } from './scripts/cards/aimLabs';
import { ABZAN_BANNER_SCRIPT } from './scripts/cards/abzanBanner';
import { ACOLYTE_OF_XATHRID_SCRIPT } from './scripts/cards/acolyteOfXathrid';
import { ADUN_OAKENSHIELD_SCRIPT } from './scripts/cards/adunOakenshield';
import { AETHER_ADEPT_SCRIPT } from './scripts/cards/aetherAdept';
import { AFFA_GUARD_HOUND_SCRIPT } from './scripts/cards/affaGuardHound';
import { AGENTS_OF_HYDRA_SCRIPT } from './scripts/cards/agentsOfHydra';
import { AIRSHIP_ENGINE_ROOM_SCRIPT } from './scripts/cards/airshipEngineRoom';
import { AJANIS_WELCOME_SCRIPT } from './scripts/cards/ajanisWelcome';
import { AKOUM_REFUGE_SCRIPT } from './scripts/cards/akoumRefuge';
import { AKROAN_JAILER_SCRIPT } from './scripts/cards/akroanJailer';
import { AKROAN_MASTIFF_SCRIPT } from './scripts/cards/akroanMastiff';
import { ALADDINS_RING_SCRIPT } from './scripts/cards/aladdinsRing';
import { ALCHEMISTS_APPRENTICE_SCRIPT } from './scripts/cards/alchemistsApprentice';
import { AMATEUR_HERO_SCRIPT } from './scripts/cards/amateurHero';
import { AMBASSADOR_OAK_SCRIPT } from './scripts/cards/ambassadorOak';
import { AMBUSH_GIGAPEDE_SCRIPT } from './scripts/cards/ambushGigapede';
import { ANABA_SHAMAN_SCRIPT } from './scripts/cards/anabaShaman';
import { ANGEL_OF_DESPAIR_SCRIPT } from './scripts/cards/angelOfDespair';
import { ANGEL_OF_MERCY_SCRIPT } from './scripts/cards/angelOfMercy';
import { ANODET_LURKER_SCRIPT } from './scripts/cards/anodetLurker';
import { ANT_QUEEN_SCRIPT } from './scripts/cards/antQueen';
import { AQUUS_STEED_SCRIPT } from './scripts/cards/aquusSteed';
import { ARASHIN_CLERIC_SCRIPT } from './scripts/cards/arashinCleric';
import { ARASTA_OF_THE_ENDLESS_WEB_SCRIPT } from './scripts/cards/arastaOfTheEndlessWeb';
import { ARBORBACK_STOMPER_SCRIPT } from './scripts/cards/arborbackStomper';
import { ARCHAEOMANCER_SCRIPT } from './scripts/cards/archaeomancer';
import { ARCHIVIST_SCRIPT } from './scripts/cards/archivist';
import { ARCHON_OF_JUSTICE_SCRIPT } from './scripts/cards/archonOfJustice';
import { ARDENT_ELEMENTALIST_SCRIPT } from './scripts/cards/ardentElementalist';
import { ARGOTHIAN_ENCHANTRESS_SCRIPT } from './scripts/cards/argothianEnchantress';
import { ARK_OF_BLIGHT_SCRIPT } from './scripts/cards/arkOfBlight';
import { ARMADA_WURM_SCRIPT } from './scripts/cards/armadaWurm';
import { ARMASAUR_GUIDE_SCRIPT } from './scripts/cards/armasaurGuide';
import { ASGARDIAN_CITADEL_SCRIPT } from './scripts/cards/asgardianCitadel';
import { ASHEN_RIDER_SCRIPT } from './scripts/cards/ashenRider';
import { ASHIOKS_REAPER_SCRIPT } from './scripts/cards/ashioksReaper';
import { ASPIRING_AERONAUT_SCRIPT } from './scripts/cards/aspiringAeronaut';
import { ATTENDED_KNIGHT_SCRIPT } from './scripts/cards/attendedKnight';
import { AURIOK_TRANSFIXER_SCRIPT } from './scripts/cards/auriokTransfixer';
import { AVEN_BATTLE_PRIEST_SCRIPT } from './scripts/cards/avenBattlePriest';
import { AVEN_CLOUDCHASER_SCRIPT } from './scripts/cards/avenCloudchaser';
import { AVEN_FOGBRINGER_SCRIPT } from './scripts/cards/avenFogbringer';
import { AVEN_OF_ENDURING_HOPE_SCRIPT } from './scripts/cards/avenOfEnduringHope';
import { AVENGERS_HANGAR_SCRIPT } from './scripts/cards/avengersHangar';
import { AVIATION_PIONEER_SCRIPT } from './scripts/cards/aviationPioneer';
import { AYSEN_BUREAUCRATS_SCRIPT } from './scripts/cards/aysenBureaucrats';
import { AZORIUS_CLUESTONE_SCRIPT } from './scripts/cards/azoriusCluestone';
import { AZORIUS_LOCKET_SCRIPT } from './scripts/cards/azoriusLocket';
import { AZURE_MAGE_SCRIPT } from './scripts/cards/azureMage';
import { BACKUP_AGENT_SCRIPT } from './scripts/cards/backupAgent';
import { BALEFUL_AMMIT_SCRIPT } from './scripts/cards/balefulAmmit';
import { BARBARIAN_RIFTCUTTER_SCRIPT } from './scripts/cards/barbarianRiftcutter';
import { BARTERED_COW_SCRIPT } from './scripts/cards/barteredCow';
import { BEAMSAW_PROSPECTOR_SCRIPT } from './scripts/cards/beamsawProspector';
import { BEARS_COMPANION_SCRIPT } from './scripts/cards/bearsCompanion';
import { BEAST_WHISPERER_SCRIPT } from './scripts/cards/beastWhisperer';
import { BEETLEBACK_CHIEF_SCRIPT } from './scripts/cards/beetlebackChief';
import { BELLIGERENT_GUEST_SCRIPT } from './scripts/cards/belligerentGuest';
import { BENALISH_HERALDS_SCRIPT } from './scripts/cards/benalishHeralds';
import { BENALISH_TRAPPER_SCRIPT } from './scripts/cards/benalishTrapper';
import { BESKIR_SHIELDMATE_SCRIPT } from './scripts/cards/beskirShieldmate';
import { BIGFIN_BOUNCER_SCRIPT } from './scripts/cards/bigfinBouncer';
import { BILE_URCHIN_SCRIPT } from './scripts/cards/bileUrchin';
import { BIRNIN_ZANA_PLAZA_SCRIPT } from './scripts/cards/birninZanaPlaza';
import { BIRTHING_BOUGHS_SCRIPT } from './scripts/cards/birthingBoughs';
import { BLAZE_COMMANDO_SCRIPT } from './scripts/cards/blazeCommando';
import { BLIGHTED_CATARACT_SCRIPT } from './scripts/cards/blightedCataract';
import { BLINDING_MAGE_SCRIPT } from './scripts/cards/blindingMage';
import { BLINDING_SOULEATER_SCRIPT } from './scripts/cards/blindingSouleater';
import { BLISTER_BEETLE_SCRIPT } from './scripts/cards/blisterBeetle';
import { BLOOD_SERVITOR_SCRIPT } from './scripts/cards/bloodServitor';
import { BLOODFELL_CAVES_SCRIPT } from './scripts/cards/bloodfellCaves';
import { BLOODTALLOW_CANDLE_SCRIPT } from './scripts/cards/bloodtallowCandle';
import { BLOSSOM_DRYAD_SCRIPT } from './scripts/cards/blossomDryad';
import { BLOSSOMING_SANDS_SCRIPT } from './scripts/cards/blossomingSands';
import { BOGARDAN_RAGER_SCRIPT } from './scripts/cards/bogardanRager';
import { BOGWATER_LUMARET_SCRIPT } from './scripts/cards/bogwaterLumaret';
import { BOILING_ROCK_PRISON_SCRIPT } from './scripts/cards/boilingRockPrison';
import { BOLTWING_MARAUDER_SCRIPT } from './scripts/cards/boltwingMarauder';
import { BOND_BEETLE_SCRIPT } from './scripts/cards/bondBeetle';
import { BONE_PIT_BRUTE_SCRIPT } from './scripts/cards/bonePitBrute';
import { BOOK_OF_RASS_SCRIPT } from './scripts/cards/bookOfRass';
import { BOROS_CLUESTONE_SCRIPT } from './scripts/cards/borosCluestone';
import { BOROS_LOCKET_SCRIPT } from './scripts/cards/borosLocket';
import { BOTANICAL_PLAZA_SCRIPT } from './scripts/cards/botanicalPlaza';
import { BOTTLE_GNOMES_SCRIPT } from './scripts/cards/bottleGnomes';
import { BRAIDWOOD_CUP_SCRIPT } from './scripts/cards/braidwoodCup';
import { BRAMBLE_ELEMENTAL_SCRIPT } from './scripts/cards/brambleElemental';
import { BRANDYWINE_FARMER_SCRIPT } from './scripts/cards/brandywineFarmer';
import { BRASS_SECRETARY_SCRIPT } from './scripts/cards/brassSecretary';
import { BRAZEN_FREEBOOTER_SCRIPT } from './scripts/cards/brazenFreebooter';
import { BRIARKNIT_KAMI_SCRIPT } from './scripts/cards/briarknitKami';
import { BRIARPACK_ALPHA_SCRIPT } from './scripts/cards/briarpackAlpha';
import { BRINDLE_BOAR_SCRIPT } from './scripts/cards/brindleBoar';
import { BRINDLE_SHOAT_SCRIPT } from './scripts/cards/brindleShoat';
import { BRINEBARROW_INTRUDER_SCRIPT } from './scripts/cards/brinebarrowIntruder';
import { BROOD_WEAVER_SCRIPT } from './scripts/cards/broodWeaver';
import { BROODMATE_DRAGON_SCRIPT } from './scripts/cards/broodmateDragon';
import { BULWARK_GIANT_SCRIPT } from './scripts/cards/bulwarkGiant';
import { BURRENTON_SHIELD_BEARERS_SCRIPT } from './scripts/cards/burrentonShieldBearers';
import { BURROG_BEFUDDLER_SCRIPT } from './scripts/cards/burrogBefuddler';
import { BUZZ_BOTS_SCRIPT } from './scripts/cards/buzzBots';
import { CABAL_TRAINEE_SCRIPT } from './scripts/cards/cabalTrainee';
import { CACKLING_IMP_SCRIPT } from './scripts/cards/cacklingImp';
import { CAPASHEN_UNICORN_SCRIPT } from './scripts/cards/capashenUnicorn';
import { CAPTIVE_FLAME_SCRIPT } from './scripts/cards/captiveFlame';
import { CARTOGRAPHERS_COMPANION_SCRIPT } from './scripts/cards/cartographersCompanion';
import { CARVEN_CARYATID_SCRIPT } from './scripts/cards/carvenCaryatid';
import { CASTLE_ARDENVALE_SCRIPT } from './scripts/cards/castleArdenvale';
import { CAT_OWL_SCRIPT } from './scripts/cards/catOwl';
import { CATHAR_COMMANDO_SCRIPT } from './scripts/cards/catharCommando';
import { CATHEDRAL_SANCTIFIER_SCRIPT } from './scripts/cards/cathedralSanctifier';
import { CAUSTIC_CATERPILLAR_SCRIPT } from './scripts/cards/causticCaterpillar';
import { CELESTIAL_FORCE_SCRIPT } from './scripts/cards/celestialForce';
import { CENTAUR_GLADE_SCRIPT } from './scripts/cards/centaurGlade';
import { CENTAUR_HEALER_SCRIPT } from './scripts/cards/centaurHealer';
import { CENTAUR_NURTURER_SCRIPT } from './scripts/cards/centaurNurturer';
import { CENTAURS_HERALD_SCRIPT } from './scripts/cards/centaursHerald';
import { CHANDRAS_MAGMUTT_SCRIPT } from './scripts/cards/chandrasMagmutt';
import { CHECKPOINT_OFFICER_SCRIPT } from './scripts/cards/checkpointOfficer';
import { CHILD_OF_THORNS_SCRIPT } from './scripts/cards/childOfThorns';
import { CHIMNEY_RABBLE_SCRIPT } from './scripts/cards/chimneyRabble';
import { CHROME_PROWLER_SCRIPT } from './scripts/cards/chromeProwler';
import { CITY_PIGEON_SCRIPT } from './scripts/cards/cityPigeon';
import { CLARION_CATHARS_SCRIPT } from './scripts/cards/clarionCathars';
import { CLOCKWORK_DRAWBRIDGE_SCRIPT } from './scripts/cards/clockworkDrawbridge';
import { CLOUDCHASER_EAGLE_SCRIPT } from './scripts/cards/cloudchaserEagle';
import { CLOUDKIN_SEER_SCRIPT } from './scripts/cards/cloudkinSeer';
import { COGWORK_WRESTLER_SCRIPT } from './scripts/cards/cogworkWrestler';
import { COMMANDERS_SPHERE_SCRIPT } from './scripts/cards/commandersSphere';
import { COMMON_CROOK_SCRIPT } from './scripts/cards/commonCrook';
import { CONCLAVE_CAVALIER_SCRIPT } from './scripts/cards/conclaveCavalier';
import { CONSCRIPTED_INFANTRY_SCRIPT } from './scripts/cards/conscriptedInfantry';
import { AHRIMAN_SCRIPT } from './scripts/cards/ahriman';
import { CARNAGE_ALTAR_SCRIPT } from './scripts/cards/carnageAltar';
import { CLAWS_OF_GIX_SCRIPT } from './scripts/cards/clawsOfGix';
import { AGENT_OF_SHAUKU_SCRIPT } from './scripts/cards/agentOfShauku';
import { AKKI_SCRAPCHOMPER_SCRIPT } from './scripts/cards/akkiScrapchomper';
import { ARMS_DEALER_SCRIPT } from './scripts/cards/armsDealer';
import { ARMY_ANTS_SCRIPT } from './scripts/cards/armyAnts';
import { AURA_FRACTURE_SCRIPT } from './scripts/cards/auraFracture';
import { BARRAGE_OF_EXPENDABLES_SCRIPT } from './scripts/cards/barrageOfExpendables';
import { BARRAGE_OGRE_SCRIPT } from './scripts/cards/barrageOgre';
import { BARRIN_MASTER_WIZARD_SCRIPT } from './scripts/cards/barrinMasterWizard';
import { BLAZING_HELLHOUND_SCRIPT } from './scripts/cards/blazingHellhound';
import { BLOOD_RITES_SCRIPT } from './scripts/cards/bloodRites';
import { BOG_NAUGHTY_SCRIPT } from './scripts/cards/bogNaughty';
import { CEPHALID_SCOUT_SCRIPT } from './scripts/cards/cephalidScout';
import { CONTEMPLATION_SCRIPT } from './scripts/cards/contemplation';
import { CORAL_BARRIER_SCRIPT } from './scripts/cards/coralBarrier';
import { COUNCIL_OF_ADVISORS_SCRIPT } from './scripts/cards/councilOfAdvisors';
import { COURIER_GRIFFIN_SCRIPT } from './scripts/cards/courierGriffin';
import { COURIERS_CAPSULE_SCRIPT } from './scripts/cards/couriersCapsule';
import { COURT_STREET_DENIZEN_SCRIPT } from './scripts/cards/courtStreetDenizen';
import { CRENELLATED_WALL_SCRIPT } from './scripts/cards/crenellatedWall';
import { CRESTED_HERDCALLER_SCRIPT } from './scripts/cards/crestedHerdcaller';
import { CRIMSON_CARAVANEER_SCRIPT } from './scripts/cards/crimsonCaravaneer';
import { CROCODILE_OF_THE_CROSSING_SCRIPT } from './scripts/cards/crocodileOfTheCrossing';
import { CRUSTACEAN_COMMANDO_SCRIPT } from './scripts/cards/crustaceanCommando';
import { CULT_OF_THE_WAXING_MOON_SCRIPT } from './scripts/cards/cultOfTheWaxingMoon';
import { CULTBRAND_CINDER_SCRIPT } from './scripts/cards/cultbrandCinder';
import { CUNNING_SPARKMAGE_SCRIPT } from './scripts/cards/cunningSparkmage';
import { D_AVENANT_TRAPPER_SCRIPT } from './scripts/cards/dAvenantTrapper';
import { DARING_APPRENTICE_SCRIPT } from './scripts/cards/daringApprentice';
import { DARK_HEART_OF_THE_WOOD_SCRIPT } from './scripts/cards/darkHeartOfTheWood';
import { DARKSLICK_DRAKE_SCRIPT } from './scripts/cards/darkslickDrake';
import { DAUNTLESS_AVEN_SCRIPT } from './scripts/cards/dauntlessAven';
import { DAUNTLESS_SURVIVOR_SCRIPT } from './scripts/cards/dauntlessSurvivor';
import { DAWNHART_GEIST_SCRIPT } from './scripts/cards/dawnhartGeist';
import { DAWNHART_REJUVENATOR_SCRIPT } from './scripts/cards/dawnhartRejuvenator';
import { DAWNING_ANGEL_SCRIPT } from './scripts/cards/dawningAngel';
import { DAYBREAK_CHARGER_SCRIPT } from './scripts/cards/daybreakCharger';
import { DAYBREAK_COMBATANTS_SCRIPT } from './scripts/cards/daybreakCombatants';
import { DAYSQUAD_MARSHAL_SCRIPT } from './scripts/cards/daysquadMarshal';
import { DAZZLING_ANGEL_SCRIPT } from './scripts/cards/dazzlingAngel';
import { DAZZLING_RAMPARTS_SCRIPT } from './scripts/cards/dazzlingRamparts';
import { DEADAPULT_SCRIPT } from './scripts/cards/deadapult';
import { DEADEYE_DUELIST_SCRIPT } from './scripts/cards/deadeyeDuelist';
import { DEATHBLOOM_THALLID_SCRIPT } from './scripts/cards/deathbloomThallid';
import { DEDICATED_MARTYR_SCRIPT } from './scripts/cards/dedicatedMartyr';
import { DEEPROOT_PILGRIMAGE_SCRIPT } from './scripts/cards/deeprootPilgrimage';
import { DEEPROOT_WATERS_SCRIPT } from './scripts/cards/deeprootWaters';
import { DEEPWOOD_TANTIV_SCRIPT } from './scripts/cards/deepwoodTantiv';
import { DERANGED_OUTCAST_SCRIPT } from './scripts/cards/derangedOutcast';
import { DESECRATED_TOMB_SCRIPT } from './scripts/cards/desecratedTomb';
import { DESOLATION_TWIN_SCRIPT } from './scripts/cards/desolationTwin';
import { DESTRUCTIVE_DIGGER_SCRIPT } from './scripts/cards/destructiveDigger';
import { DEVOTEE_OF_STRENGTH_SCRIPT } from './scripts/cards/devoteeOfStrength';
import { DEVOUT_MONK_SCRIPT } from './scripts/cards/devoutMonk';
import { DIAMOND_MARE_SCRIPT } from './scripts/cards/diamondMare';
import { DIMENSION_X_SCRIPT } from './scripts/cards/dimensionX';
import { DIMIR_CLUESTONE_SCRIPT } from './scripts/cards/dimirCluestone';
import { DIMIR_LOCKET_SCRIPT } from './scripts/cards/dimirLocket';
import { DIRE_FLEET_HOARDER_SCRIPT } from './scripts/cards/direFleetHoarder';
import { DISCORDANT_PIPER_SCRIPT } from './scripts/cards/discordantPiper';
import { DISEASE_CARRIERS_SCRIPT } from './scripts/cards/diseaseCarriers';
import { DISMAL_BACKWATER_SCRIPT } from './scripts/cards/dismalBackwater';
import { DISPELLERS_CAPSULE_SCRIPT } from './scripts/cards/dispellersCapsule';
import { DISPERSING_ORB_SCRIPT } from './scripts/cards/dispersingOrb';
import { DOCKSIDE_CHEF_SCRIPT } from './scripts/cards/docksideChef';
import { DOOMED_DISSENTER_SCRIPT } from './scripts/cards/doomedDissenter';
import { DOOMED_NECROMANCER_SCRIPT } from './scripts/cards/doomedNecromancer';
import { DOOMED_TRAVELER_SCRIPT } from './scripts/cards/doomedTraveler';
import { DRACONIC_DISCIPLE_SCRIPT } from './scripts/cards/draconicDisciple';
import { DRAGON_BLOOD_SCRIPT } from './scripts/cards/dragonBlood';
import { DRAGON_ROOST_SCRIPT } from './scripts/cards/dragonRoost';
import { DRAGON_TRAINER_SCRIPT } from './scripts/cards/dragonTrainer';
import { DRAGONLAIR_SPIDER_SCRIPT } from './scripts/cards/dragonlairSpider';
import { DRAGOONS_WYVERN_SCRIPT } from './scripts/cards/dragoonsWyvern';
import { DREAMSTONE_HEDRON_SCRIPT } from './scripts/cards/dreamstoneHedron';
import { DRIDER_SCRIPT } from './scripts/cards/drider';
import { DRIVER_OF_THE_DEAD_SCRIPT } from './scripts/cards/driverOfTheDead';
import { DROGSKOL_REAVER_SCRIPT } from './scripts/cards/drogskolReaver';
import { DRUID_LYRIST_SCRIPT } from './scripts/cards/druidLyrist';
import { DRUID_OF_HORNS_SCRIPT } from './scripts/cards/druidOfHorns';
import { DUNES_OF_THE_DEAD_SCRIPT } from './scripts/cards/dunesOfTheDead';
import { DWARVEN_CASTLE_GUARD_SCRIPT } from './scripts/cards/dwarvenCastleGuard';
import { DWARVEN_MINE_SCRIPT } from './scripts/cards/dwarvenMine';
import { EAGER_TRUFFLESNOUT_SCRIPT } from './scripts/cards/eagerTrufflesnout';
import { EARTHBLIGHTER_SCRIPT } from './scripts/cards/earthblighter';
import { deps, makeSpec, ORACLE, simplestAnswer } from './testing/harness';
import { zoneId } from '../view/types';
import type { GameEvent } from './types/events';
import type { Intent } from './types/intents';
import type { GameState } from './types/state';

// ⚠️ THE GATE. Networking does not start until this is green, because every
// networking bug becomes unfalsifiable if the engine itself is nondeterministic.
//
// One property test covers what a hundred hand-written scenarios cannot:
// reducer/handler agreement, `apply` totality, invariant preservation, PRNG
// self-consistency and the absence of hidden nondeterminism. A random-legal-
// player fuzzer over tens of thousands of intents finds crash bugs no scenario
// will, because it plays sequences nobody would think to write down.
//
// Scale: `CRT_FUZZ_SEEDS` (default 60 here, 500 in the full run — see
// `npm run test:fuzz`). Sixty seeds × 200 intents is ~9 s and catches
// essentially everything; the 500-seed run is the milestone gate and is
// recorded in DECISIONS.md with its measured numbers.

const SEEDS = Number(process.env.CRT_FUZZ_SEEDS ?? 60);
const INTENTS = Number(process.env.CRT_FUZZ_INTENTS ?? 200);

/**
 * A deck with enough variety that the fuzzer meets real decisions.
 *
 * ⚠️ A CARD MISSING FROM HERE IS A CODE PATH THIS GATE CANNOT REACH, and the
 * gate stays green the whole time it rots. It has now happened three times in
 * this repo: the net fixture pool was forty lands, then had no targeted spell
 * (D102) — and this list had no planeswalker and no battle, so the two SBAs that
 * read a `loyalty` or a `defense` counter ran against an empty counter map in
 * every one of 500 seeds. The two entries below are the only permanents in Magic
 * that arrive with counters already on them (CR 306.5b/310.6), which makes them
 * the only ones whose ENTRY changes the state hash.
 *
 * ⚠️ And Jace for the same reason one step along (D108): a permanent that
 * TRANSFORMS into a planeswalker is the other way loyalty counters get written,
 * and until he joined this list no card in the deck had a second face worth
 * turning over. He is here rather than any of the other 13 because `{1}{U}` is
 * cheap enough for the fuzzer to actually cast.
 */
const DECK = [
  'Forest', 'Island', 'Mountain', 'Plains', 'Swamp',
  'Command Tower', 'Sol Ring', 'Arcane Signet', 'Tundra', 'Boros Garrison',
  'Llanowar Elves', 'Birds of Paradise', 'Grizzly Bears', 'Serra Angel',
  'Giant Spider', 'Colossal Dreadmaw', 'Vampire Nighthawk', 'Typhoid Rats',
  'White Knight', 'Boros Swiftblade', 'Boggart Brute', 'Wall of Omens',
  'Raging Goblin', 'Child of Night', 'Ambush Viper', 'Baleful Strix',
  'Lightning Bolt', 'Counterspell', 'Cultivate', 'Swords to Plowshares',
  'Pacifism', 'Wrath of God', 'Brainstorm', 'Dark Ritual', 'Lightning Greaves',
  'Grist, the Hunger Tide', 'Invasion of Gobakhan // Lightshield Array',
  "Jace, Vryn's Prodigy // Jace, Telepath Unbound",
  // ⚠️ M6.1. The bot plays a deck built only from cards the engine runs
  // COMPLETELY, and four of its shapes had never been dealt here: a LAND
  // CREATURE (summoning-sick and tappable for mana at once), an ARTIFACT land,
  // a PUMP spell (one of the 11 effect kinds, and the gate had damage, counter,
  // exile and destroy but not this), and six enforced keywords plus protection
  // from two colours on one body. Same rule as the three additions above it:
  // a card missing from here is a code path this gate cannot reach.
  'Dryad Arbor', 'Darksteel Citadel', 'Monstrous Growth', 'Akroma, Angel of Wrath',
  // ⚠️ M6.3ab / D155 — a MODAL DFC, the layout this gate had never been dealt.
  // Its back face is a land that enters tapped, so it reaches the face path and
  // D134's rule on a back face at the same time.
  'Malakir Rebirth // Malakir Mire',
  // ⚠️ M6.3/D128. `Ajani's Mantra` is here for the same reason as every entry
  // above it, and this time the gap was total rather than partial: with
  // `NO_SCRIPTS` this gate had never run the TRIGGER BUS AT ALL.
  // `collectTriggers` returns `[]` on `scripts.size === 0`, so in 500 seeds no
  // `PendingTrigger` had ever existed, `orderTriggersApnap` had never sorted
  // anything, `drainTriggers` had never put an ability on the stack and
  // `orderTriggers` — a prompt with a real producer in `loop.ts` — had never
  // been raised. `SCRIPTS` below is what fixes that, and this card is what it
  // holds.
  "Ajani's Mantra",
  // ⚠️ M6.3/D129, and the same rule again one layer along: `applyStatics` had
  // never RUN in this gate either, for the same reason the trigger bus had not.
  // The pair is deliberate — `Levitation` grants flying and `Gravity Sphere`
  // takes it away, both in layer 6, so which entered last is the answer (CR
  // 613.7) and neither card alone would exercise the ordering.
  // ⚠️ `Gravity Sphere` is a WORLD enchantment and this engine has no world rule
  // (CR 704.5m), so four seats can hold four of them here where a real table
  // could not. Inert: nothing in the engine reads the supertype. Test-only.
  'Levitation', 'Gravity Sphere',
  // M6.3c/D130 — the counter EFFECT, on both sides of the boundary.
  // `Battlegrowth` and `Scar` are SPELLS that now resolve by themselves, so the
  // gate reaches `effectEvents` emitting `CountersChanged` for the first time;
  // Scar's `-1/-1` also reaches lethality through layer 7d and the state-based
  // action, which no other card here does. `Ajani's Pridemate` is the PERMANENT
  // side: it puts counters through a card script and needed none of the
  // vocabulary, which is the measurement correction D130 makes.
  'Battlegrowth', 'Scar', "Ajani's Pridemate",
  // ⚠️ M6.3f/D133 — the TOKEN effect. `Raise the Alarm` puts two real Soldiers
  // on the battlefield from a spell that resolves by itself, which reaches
  // `TokenCreated` from the RULES for the first time: the event has been on the
  // log since M3 and every one of them until now came from the Tier-3 tool.
  // ⚠️ The Soldier PRINTING has to be in the pool or the token derives to a
  // blank, and `makeSpec` builds the pool from `ENGINE_CARDS` — which is why the
  // fixture is pinned to the printing `TOKEN_TABLE` names, not to a pretty one.
  'Raise the Alarm',
  // ⚠️ M6.3g/D134 — CR 614.1c. `Orzhov Guildgate` is the unconditional "enters
  // tapped", so a land ARRIVES tapped from a real land drop for the first time;
  // `Haunted Ridge` is the same land one word longer ("unless you control two
  // or more other lands") and must NOT be tapped. Both in the deck, because a
  // rule that fires on everything and a rule that fires on the right things
  // look identical with only the positive case dealt.
  'Orzhov Guildgate', 'Haunted Ridge',
  // ⚠️ M6.3h/D135 — the CONDITION. `Sunpetal Grove` is a check-land ("unless
  // you control a Forest or a Plains") and `Haunted Ridge` above is now a
  // COUNT ("unless you control two or more other lands"), so both answers get
  // exercised as a real game's board fills up — which no single-state test can
  // do.
  'Sunpetal Grove',
  // ⚠️ M6.3i/D136 — the QUESTION. `Godless Shrine` was here as the card the
  // parser must REFUSE and is now the card that ASKS: "you may pay 2 life. If
  // you don't, it enters tapped." It is the only route this gate has to the
  // `entersChoice` prompt, and — unlike `optionalTrigger`, which needs a
  // registered script — it needs nothing but the land being played, so the
  // prompt is reachable in a game the shipped `NO_SCRIPTS` could run.
  // `The Black Gate` pays THREE, so a cost hardcoded to 2 cannot pass here
  // either.
  'Godless Shrine', 'The Black Gate',
  // ⚠️ M6.3j/D137 — DISCARD, and the choice it raises. `Mind Rot` is the only
  // route this gate has to `chooseFromZone`, and it needs no registry: a real
  // cast at a real player, which the fuzzer does constantly. `Hymn to Tourach`
  // is the card that must NOT resolve by itself ("at random", no RNG here), so
  // a parser that widened one word would show up as a spell the gate suddenly
  // started auto-resolving.
  'Mind Rot', 'Hymn to Tourach',
  // ⚠️ M6.3t/D147 — the two paths that did not exist before, and neither is
  // reachable without its card. `Yotian Dissident` is the only TARGETED
  // trigger: until D147 every stack object a trigger built carried
  // `targets: []`, so the prompt, the validation, `StackTargetsSet` and
  // CR 608.2b for an ability were all unreachable here. It triggers off
  // `Darksteel Citadel` above, which is already in the deck.
  // ⚠️ `Onulet` is the only trigger that LOOKS BACK IN TIME (CR 603.10a), and
  // it is the one whose absence would be invisible: a dies trigger that never
  // fires leaves NO trace, so every other counter in this gate is unmoved by
  // it being broken.
  'Yotian Dissident', 'Onulet',
  // ⚠️ M6.3u/D148 — the CR 616 PAIR. Two replacements applying to ONE event is
  // the only thing that suspends the funnel, so without both of these on one
  // battlefield the continuation, its three parked queues, the prompt and the
  // resume are unreachable from this gate entirely.
  // ⚠️ FIVE COPIES OF EACH, re-weighted in D164: the rate was measured at 5
  // per 500 seeds when this list held ~60 names and the pair sat in EVERY
  // 60-card library. The canary's own comment said the counter "will start
  // moving the day this deck changes" — it did, to ZERO, once four batches
  // had nearly doubled the list and diluted the pair out of the libraries.
  // Five copies make the pair reliably present AND reliably drawn, putting
  // the expected rate an order of magnitude above the assertion's floor
  // instead of a Poisson coin flip at it.
  'Hardened Scales', 'Hardened Scales', 'Hardened Scales', 'Hardened Scales',
  'Hardened Scales',
  'Branching Evolution', 'Branching Evolution', 'Branching Evolution',
  'Branching Evolution', 'Branching Evolution',
  // ⚠️ M6.3v/D149 — the CR 613.8 DEPENDENCY pair, and neither card reaches the
  // rule alone. `Kwende` reads a keyword that `Knighthood` grants, so which
  // applies first decides whether Kwende applies AT ALL — the only shape in
  // this engine's layer vocabulary where dependency is observable.
  'Knighthood', 'Kwende, Pride of Femeref',
  // ⚠️ M6.4a/D158 — the FIRST SHIPPED BATCH. Wall of Omens, Baleful Strix and
  // Onulet were dealt already; these five join so every shipped script is
  // exercised by the gate (the guard below holds both halves of that rule).
  // The two wardens matter beyond coverage: a creature entering while BOTH are
  // out is two simultaneous same-controller triggers — the exact shape whose
  // first ever occurrence livelocked `drainTriggers` (the re-raise the D158
  // rewrite guards against), so this gate now reaches the `orderTriggers`
  // prompt and its answer in real games.
  'Soul Warden', 'Essence Warden', 'Radiant Fountain', "Adventurer's Inn",
  'Wall of Blossoms',
  // ⚠️ M6.4c/D160 — batch 3's nineteen, every shipped script dealt (the D156
  // guard's rule). Talrand turns the gate's own spells into Drakes; the pumps,
  // bounces, returns and sacrifices all run inside real random games.
  'Talrand, Sky Summoner', 'A.I.M. Labs', 'Abzan Banner', 'Acolyte of Xathrid',
  'Adun Oakenshield', 'Aether Adept', 'Affa Guard Hound', 'Agents of HYDRA',
  'Airship Engine Room', "Ajani's Welcome", 'Akoum Refuge', 'Akroan Jailer',
  'Akroan Mastiff', "Aladdin's Ring", "Alchemist's Apprentice", 'Amateur Hero',
  'Ambassador Oak', 'Ambush Gigapede',
  // ⚠️ M6.4d/D161 — batch 4's thirteen, every shipped script dealt.
  'Anaba Shaman', 'Angel of Despair', 'Angel of Mercy', 'Anodet Lurker',
  'Ant Queen', 'Aquus Steed', 'Arashin Cleric', 'Arasta of the Endless Web',
  'Arborback Stomper', 'Archaeomancer', 'Archivist', 'Archon of Justice',
  'Ardent Elementalist',
  // M6.4e/D162 — batch 5: the first ATTACK-COUNT trigger (Armasaur Guide fires
  // only on ≥3-attacker declarations), a second cast-watcher (Argothian
  // Enchantress, enchantment spells), an enchantment-dies watcher (Ashiok's
  // Reaper), an enters-OR-dies double def (Ashen Rider), and two targeted
  // ActivatedDefs (Ark of Blight sacrifices ITSELF to kill a land; Auriok
  // Transfixer taps an artifact).
  'Argothian Enchantress', 'Ark of Blight', 'Armada Wurm', 'Armasaur Guide',
  'Asgardian Citadel', 'Ashen Rider', "Ashiok's Reaper", 'Aspiring Aeronaut',
  'Attended Knight', 'Auriok Transfixer', 'Aven Battle Priest',
  'Aven Cloudchaser', 'Aven Fogbringer',
  // M6.4f/D163 — batch 6: the first HYBRID activation cost (Azorius Locket),
  // a numeric-restricted activated target (Aysen Bureaucrats, power ≤2), a
  // repeatable no-tap draw (Azure Mage), the -1/-1 twin of the +1/+1 ETB
  // counter (Baleful Ammit), and twins of batch 5's gain/tapped-land/Thopter
  // shapes.
  'Aven of Enduring Hope', 'Avengers Hangar', 'Aviation Pioneer',
  'Aysen Bureaucrats', 'Azorius Cluestone', 'Azorius Locket', 'Azure Mage',
  'Backup Agent', 'Baleful Ammit',
  // M6.4g/D164 — batch 7: the first HAND-zone def (Bartered Cow fires on its
  // own discard — the cleanup discard exercises it for free), the first
  // combat-damage trigger (Belligerent Guest, self-only so per-event firing
  // is per-instance), the first spell-damage watcher (Blaze Commando), the
  // first PHYREXIAN activation cost (Blinding Souleater), and two multi-token
  // resolves that exist because ctx.ids.nextInstance used to hand out ONE id.
  'Barbarian Riftcutter', 'Bartered Cow', 'Beamsaw Prospector',
  "Bear's Companion", 'Beast Whisperer', 'Beetleback Chief',
  'Belligerent Guest', 'Benalish Heralds', 'Benalish Trapper',
  'Beskir Shieldmate', 'Bigfin Bouncer', 'Bile Urchin', 'Birnin Zana Plaza',
  'Birthing Boughs', 'Blaze Commando', 'Blighted Cataract', 'Blinding Mage',
  'Blinding Souleater', 'Blister Beetle',
  // M6.4h/D165 — batch 8: the first ATTACHMENT trigger (Bramble Elemental —
  // the fuzzer's ManualAttach intents exercise it), the first fixed-life
  // activation cost (Book of Rass), an enters-OR-LEAVES double def
  // (Brandywine Farmer — bounces pay too), and a self-inclusive
  // creatures-you-control gain (Bogwater Lumaret).
  'Blood Servitor', 'Bloodfell Caves', 'Bloodtallow Candle', 'Blossom Dryad',
  'Blossoming Sands', 'Bogardan Rager', 'Bogwater Lumaret',
  'Boiling Rock Prison', 'Boltwing Marauder', 'Bond Beetle', 'Bone Pit Brute',
  'Book of Rass', 'Boros Cluestone', 'Boros Locket', 'Botanical Plaza',
  'Bottle Gnomes', 'Braidwood Cup', 'Bramble Elemental', 'Brandywine Farmer',
  'Brass Secretary', 'Brazen Freebooter', 'Briarknit Kami',
  // M6.4i/D166 — batch 9: two SELF-attack triggers (Burrenton, Cat-Owl —
  // the fuzzer's random attacks exercise both), D135's conditional entry on
  // Castle Ardenvale (a Plains in the deck answers it both ways), and
  // eighteen twins of shipped shapes.
  'Briarpack Alpha', 'Brindle Boar', 'Brindle Shoat', 'Brinebarrow Intruder',
  'Brood Weaver', 'Broodmate Dragon', 'Bulwark Giant',
  'Burrenton Shield-Bearers', 'Burrog Befuddler', 'Buzz Bots',
  'Cabal Trainee', 'Cackling Imp', 'Capashen Unicorn', 'Captive Flame',
  "Cartographer's Companion", 'Carven Caryatid', 'Castle Ardenvale',
  'Cat-Owl', 'Cathar Commando', 'Cathedral Sanctifier', 'Caustic Caterpillar',
  // M6.4j/D167 — batch 10: the first shipped UPKEEP trigger (Celestial
  // Force, EACH upkeep — four firings per turn cycle at this table), a
  // targeted ETB TAP (Chrome Prowler), a leaves-only Food (City Pigeon), a
  // free self-sacrifice draw (Commander's Sphere), and a dies multi-token
  // (Conclave Cavalier).
  'Celestial Force', 'Centaur Glade', 'Centaur Healer', 'Centaur Nurturer',
  "Centaur's Herald", "Chandra's Magmutt", 'Checkpoint Officer',
  'Child of Thorns', 'Chimney Rabble', 'Chrome Prowler', 'City Pigeon',
  'Clarion Cathars', 'Clockwork Drawbridge', 'Cloudchaser Eagle',
  'Cloudkin Seer', 'Cogwork Wrestler', "Commander's Sphere", 'Common Crook',
  'Conclave Cavalier', 'Conscripted Infantry',
  // ⚠️ M6.4k/D168 — the sacrifice-cost CHOOSER's proof cards: the builder
  // names a candidate off the offer, so the gate exercises the pick, the
  // charge and the "another"/OR/empty predicates at scale.
  'Ahriman', 'Carnage Altar', 'Claws of Gix',
  // ⚠️ M6.4l/D169 — batch 11: the ten sacrifice+target defs ride the STAGED
  // chain (the builder picks the sacrifice, the driver answers the target
  // prompt), plus the freed chooser pair and eleven fresh shapes.
  'Agent of Shauku', 'Akki Scrapchomper', 'Arms Dealer', 'Army Ants',
  'Aura Fracture', 'Barrage of Expendables', 'Barrage Ogre',
  'Barrin, Master Wizard', 'Blazing Hellhound', 'Blood Rites', 'Bog Naughty',
  'Cephalid Scout', 'Contemplation', 'Coral Barrier', 'Council of Advisors',
  'Courier Griffin', "Courier's Capsule", 'Court Street Denizen',
  'Crenellated Wall', 'Crested Herdcaller', 'Crimson Caravaneer',
  'Crocodile of the Crossing', 'Crustacean Commando',
  // ⚠️ M6.4m/D170 — batch 12: the transform-watcher rides the werewolf, the
  // counterspell aims at real casts, the tap-watcher fires off the Merfolk,
  // and the subtype choosers eat their own bodies.
  'Cult of the Waxing Moon', 'Cultbrand Cinder', 'Cunning Sparkmage',
  "D'Avenant Trapper", 'Daring Apprentice', 'Dark Heart of the Wood',
  'Darkslick Drake', 'Dauntless Aven', 'Dauntless Survivor', 'Dawnhart Geist',
  'Dawnhart Rejuvenator', 'Dawning Angel', 'Daybreak Charger',
  'Daybreak Combatants', 'Daysquad Marshal', 'Dazzling Angel',
  'Dazzling Ramparts', 'Deadapult', 'Deadeye Duelist', 'Deathbloom Thallid',
  'Dedicated Martyr', 'Deeproot Pilgrimage', 'Deeproot Waters',
  'Duskwatch Recruiter // Krallenhorde Howler', 'Forest', 'Walking Corpse',
  'Merfolk of the Pearl Trident',
  // M6.4o/D171 — batch 13: the graveyard-exit watcher, the cast-of-itself
  // trigger, the chosenColor consumer, the becomes-blocked watcher, and the
  // first script REANIMATION (Doomed Necromancer's graveyard target).
  'Deepwood Tantiv', 'Deranged Outcast', 'Desecrated Tomb', 'Desolation Twin',
  'Destructive Digger', 'Devotee of Strength', 'Devout Monk', 'Diamond Mare',
  'Dimension X', 'Dimir Cluestone', 'Dimir Locket', 'Dire Fleet Hoarder',
  'Discordant Piper', 'Disease Carriers', 'Dismal Backwater',
  "Dispeller's Capsule", 'Dispersing Orb', 'Dockside Chef', 'Doomed Dissenter',
  'Doomed Necromancer',
  // M6.4p/D172 — batch 14: the LifeChanged consumer, the cast-targets
  // reader (Pacifism is already dealt for it to ride), and the
  // enters-untapped Mine behind the deck's Mountains.
  'Doomed Traveler', 'Draconic Disciple', 'Dragon Blood', 'Dragon Roost',
  'Dragon Trainer', 'Dragonlair Spider', "Dragoon's Wyvern",
  'Dreamstone Hedron', 'Drider', 'Driver of the Dead', 'Drogskol Reaver',
  'Druid Lyrist', 'Druid of Horns', 'Dunes of the Dead',
  'Dwarven Castle Guard', 'Dwarven Mine', 'Eager Trufflesnout',
  'Earthblighter',
  // ⚠️ M6.4b/D159 — the ACTIVATED batch, and each is a first for this gate:
  // `Arcane Encyclopedia` is the first script-resolved activated ability;
  // `Deserted Temple` the first TARGETED one (its untap re-checked at
  // resolution, CR 608.2b); `Hedron Archive` the first SELF-SACRIFICE cost —
  // a permanent paying itself into the graveyard at activation, dies-triggers
  // and all; `War Room` the first COMPUTED life cost, priced off each seat's
  // commander identity.
  'Arcane Encyclopedia', 'Deserted Temple', 'Hedron Archive', 'War Room',
];

/**
 * ⚠️ THE FIRST NON-EMPTY REGISTRY THIS GATE HAS EVER RUN, and it is what makes
 * the `optionalTrigger` prompt reachable at all: the prompt is raised only when
 * a `TriggerDef` says `optional`, and a `TriggerDef` only exists if something
 * registered one. A card in `DECK` with no script here would be a code path the
 * gate still could not reach — the failure D102, D107, D108 and D121 all record,
 * with an extra step.
 *
 * ⚠️ Since M6.4a this holds BOTH kinds: the testing scripts that exist to reach
 * engine seams (`Ajani's Mantra` for the optional prompt, the layer pairs), and
 * every SHIPPED script — because a shipped card missing from this registry is a
 * code path the gate cannot reach, which is the failure D102, D107, D108 and
 * D121 all record. The guard below asserts the shipped half mechanically.
 */
const SCRIPTS = createRegistry([
  AJANIS_MANTRA,
  AJANIS_PRIDEMATE,
  LEVITATION_SCRIPT,
  GRAVITY_SPHERE_SCRIPT,
  // M6.3t — the two paths D147 opened, both unreachable from this gate without
  // a script that uses them: `Yotian Dissident` is the only TARGETED trigger,
  // and `Onulet` the only one that LOOKS BACK IN TIME (CR 603.10a).
  YOTIAN_DISSIDENT_SCRIPT,
  ONULET_SCRIPT,
  // M6.4a/D158 — the rest of the first shipped batch (Onulet, one line up, is
  // the shipped module too).
  SOUL_WARDEN_SCRIPT,
  ESSENCE_WARDEN_SCRIPT,
  RADIANT_FOUNTAIN_SCRIPT,
  ADVENTURERS_INN_SCRIPT,
  WALL_OF_BLOSSOMS_SCRIPT,
  WALL_OF_OMENS_SCRIPT,
  BALEFUL_STRIX_SCRIPT,
  // M6.4b/D159 — the activated batch.
  ARCANE_ENCYCLOPEDIA_SCRIPT,
  DESERTED_TEMPLE_SCRIPT,
  HEDRON_ARCHIVE_SCRIPT,
  WAR_ROOM_SCRIPT,
  // M6.4c/D160 — batch 3, nineteen scripts. Firsts for this gate: a
  // CAST-watching trigger creating tokens (Talrand), script bounces and
  // graveyard returns, until-end-of-turn pumps, script damage, a
  // player-targeted activated, and three more self-sacrifices.
  TALRAND_SKY_SUMMONER_SCRIPT,
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
  // M6.4d/D161 — batch 4, thirteen scripts: script destroy (indestructible
  // asked of the derived target), the first looks-back-AND-targets trigger,
  // Arasta turning the gate's own spells into Spiders for the OTHER seat, a
  // repeatable token ability, and the Page/Anointer refusals that taught the
  // selection about unenforced target clauses.
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
  AVEN_OF_ENDURING_HOPE_SCRIPT,
  AVENGERS_HANGAR_SCRIPT,
  AVIATION_PIONEER_SCRIPT,
  AYSEN_BUREAUCRATS_SCRIPT,
  AZORIUS_CLUESTONE_SCRIPT,
  AZORIUS_LOCKET_SCRIPT,
  AZURE_MAGE_SCRIPT,
  BACKUP_AGENT_SCRIPT,
  BALEFUL_AMMIT_SCRIPT,
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
  AHRIMAN_SCRIPT,
  CARNAGE_ALTAR_SCRIPT,
  CLAWS_OF_GIX_SCRIPT,
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
  DEEPWOOD_TANTIV_SCRIPT,
  DERANGED_OUTCAST_SCRIPT,
  DESECRATED_TOMB_SCRIPT,
  DESOLATION_TWIN_SCRIPT,
  DESTRUCTIVE_DIGGER_SCRIPT,
  DEVOTEE_OF_STRENGTH_SCRIPT,
  DEVOUT_MONK_SCRIPT,
  DIAMOND_MARE_SCRIPT,
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
  DOOMED_NECROMANCER_SCRIPT,
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
  // M6.3u/D148 — the two whose ORDER a player now chooses (CR 616). Neither
  // reaches the rule alone: two replacements applying to ONE event is the only
  // thing that suspends the funnel, so without both of these the continuation,
  // its three parked queues, the prompt and the resume are unreachable here.
  HARDENED_SCALES_SCRIPT,
  BRANCHING_EVOLUTION_SCRIPT,
  // The CR 613.8 dependency pair (D149).
  KNIGHTHOOD_SCRIPT,
  KWENDE_SCRIPT,
]);

/** The two layer-6 sources, for the canary that says `applyStatics` ran. */
const LAYER6_ORACLES = new Set([LEVITATION_SCRIPT.oracleId, GRAVITY_SPHERE_SCRIPT.oracleId]);

/**
 * Every shipped `ActivatedDef` ref, for the canary that says the D159 seam ran
 * HERE — an ability charged by the engine and resolved by a script, in a real
 * fuzzed game rather than only in a unit test.
 */
const ACTIVATED_REFS = new Set(
  [ARCANE_ENCYCLOPEDIA_SCRIPT, DESERTED_TEMPLE_SCRIPT, HEDRON_ARCHIVE_SCRIPT, WAR_ROOM_SCRIPT].flatMap(
    (s) => (s.activated ?? []).map((d) => d.ref),
  ),
);

interface Picker {
  rng: RngState;
  below(n: number): number;
  pick<T>(xs: readonly T[]): T | undefined;
}

function picker(seed: string): Picker {
  const self: Picker = {
    rng: seedRng(seed),
    below(n: number) {
      const d = nextBelow(self.rng, Math.max(1, n));
      self.rng = d.next;
      return d.value;
    },
    pick<T>(xs: readonly T[]): T | undefined {
      if (xs.length === 0) return undefined;
      return xs[self.below(xs.length)];
    },
  };
  return self;
}

/** A Tier-3 tool, chosen 5% of the time — manual play must replay too. */
function manualIntentFor(state: GameState, p: Picker): Intent | null {
  const players = state.seating.filter((id) => !(state.players[id]?.hasLost ?? true));
  const player = p.pick(players);
  if (!player) return null;
  const battlefield = state.zones.battlefield;
  const anyCard = p.pick([...battlefield, ...(state.zones.hand[player] ?? [])]);
  switch (p.below(13)) {
    case 0:
      return { t: 'ManualSetLife', player, target: p.pick(players) ?? player, delta: p.below(7) - 3 };
    case 1:
      return anyCard
        ? { t: 'ManualSetCounter', player, card: anyCard, kind: '+1/+1', delta: 1 }
        : null;
    case 2:
      return { t: 'ManualAddMana', player, target: player, symbol: 'C', amount: 1 };
    case 3:
      return anyCard ? { t: 'ManualSetTapped', player, cards: [anyCard], tapped: true } : null;
    case 4:
      return { t: 'RollDice', player, sides: 6 };
    case 5:
      return { t: 'FlipCoin', player };
    case 6:
      return { t: 'ManualDraw', player, target: player, count: 1 };
    case 7:
      return anyCard
        ? {
            t: 'ManualMoveCard',
            player,
            card: anyCard,
            to: { kind: 'graveyard', player: state.cards[anyCard]?.owner ?? player },
          }
        : null;
    case 8: {
      // ⚠️ AIMED, not drawn from `anyCard` like its siblings. A flip picked out
      // of every card on the board and in a hand would land on the one card with
      // a second face a handful of times in 100,000 intents, and a canary that
      // fires by luck is the rot it exists to catch (D102) with an extra step.
      // Battlefield only, because that is the only place a transform can write a
      // loyalty counter — the `zone` guard in D108's rule is what the `in a hand`
      // case in `sba.test.ts` pins, and it does not need a fuzz seed too.
      const twoFaced = battlefield.filter((id) => {
        const c = state.cards[id];
        return c ? (ORACLE.byPrinting(c.printingId)?.faces.length ?? 1) > 1 : false;
      });
      const target = p.pick(twoFaced);
      // ⚠️ AND IT MUST NOT RETURN NULL. `runOne` reads a null intent as "this
      // game has nothing left to do" and BREAKS out of the seed, so a manual
      // case that usually has nothing to act on does not skip a beat — it ends
      // the run. Aiming the flip made "usually" the common case, and the first
      // cut cost 37% of the gate's accepted intents (11,883 → 7,434 at 60 seeds)
      // and a third of its turns. That reads as a slower engine, not as a
      // fuzzer that stopped playing. The dice are the one sibling that needs
      // nothing from the board.
      if (!target) return { t: 'RollDice', player, sides: 6 };
      return { t: 'ManualFlipFace', player, card: target };
    }
    // ── The library tools ─────────────────────────────────────────────────
    //
    // ⚠️ These three arrived together and the leak test below is why they had
    // to reach the fuzzer at all: it asserts that NO library card appears in
    // any projection, which was only true because nothing in this file had
    // ever peeked. An assertion that holds because the path is unreachable is
    // the rot D102 and D108 both name — so the fuzzer peeks now, and the leak
    // test asserts the real boundary instead.
    case 9:
      return { t: 'ManualPeekLibrary', player, count: 1 + p.below(3) };
    case 10:
      return { t: 'ManualStopPeeking', player };
    case 11:
      return {
        t: 'ManualMoveTopOfLibrary',
        player,
        target: p.pick(players) ?? player,
        count: 1 + p.below(3),
        to: p.below(2) === 0 ? 'graveyard' : 'exile',
      };
    // ⚠️ It REJECTS on an empty pile, which is most of the time early on — and
    // that is fine, unlike returning null: a rejection is counted and the seed
    // plays on, where a null ends the run (D108).
    case 12:
      return {
        t: 'ManualMoveZone',
        player,
        target: p.pick(players) ?? player,
        from: p.below(2) === 0 ? 'graveyard' : 'exile',
        to: p.below(2) === 0 ? 'library' : 'exile',
        shuffle: p.below(2) === 0,
      };
    default:
      return null;
  }
}

/** Answer whatever prompt is up, choosing randomly among the legal answers. */
function answerFor(state: GameState, p: Picker): Intent | null {
  const awaiting = state.priority.awaiting;
  if (!awaiting) return null;
  switch (awaiting.kind) {
    case 'mulligan': {
      const player = p.pick(awaiting.players);
      if (!player) return null;
      return { t: 'MulliganDecision', player, keep: p.below(4) > 0 };
    }
    case 'mulliganBottom': {
      const hand = [...(state.zones.hand[awaiting.player] ?? [])];
      const picked = shuffle(p.rng, hand);
      p.rng = picked.next;
      return { t: 'MulliganBottom', player: awaiting.player, cards: picked.value.slice(0, awaiting.count) };
    }
    case 'declareAttackers': {
      const attackers = state.zones.battlefield.filter(
        (id) => state.cards[id]?.controller === awaiting.player && !state.cards[id]?.tapped,
      );
      const defenders = state.seating.filter(
        (id) => id !== awaiting.player && !(state.players[id]?.hasLost ?? true),
      );
      const defender = p.pick(defenders);
      if (!defender || attackers.length === 0 || p.below(2) === 0) {
        return { t: 'DeclareAttackers', player: awaiting.player, attackers: [] };
      }
      // Declare a random subset; the handler rejects anything illegal, which is
      // itself a thing worth exercising.
      const chosen = attackers.filter(() => p.below(2) === 0);
      return {
        t: 'DeclareAttackers',
        player: awaiting.player,
        attackers: chosen.map((card) => ({ card, defender: { kind: 'player' as const, id: defender } })),
      };
    }
    case 'declareBlockers': {
      const player = awaiting.players.find((x) => !awaiting.submitted.includes(x));
      if (!player) return null;
      return { t: 'DeclareBlockers', player, blocks: [] };
    }
    /**
     * ⚠️ ITS OWN RANDOMISED CASE rather than the `simplestAnswer` fallthrough,
     * for the same reason `mulligan` has one. `simplestAnswer` always DECLINES —
     * that is its stated policy and the right one for a driver that must never
     * run card text a test did not ask for — so falling through would leave the
     * ACCEPT half of this primitive, the half that runs a card script, untaken
     * in all 500 seeds while the gate stayed green. A coin flip reaches both,
     * and the two canaries below assert it did.
     */
    case 'optionalTrigger':
      return {
        t: 'AnswerOptionalTrigger',
        player: awaiting.player,
        stackId: awaiting.stackId,
        accept: p.below(2) === 0,
      };
    /**
     * ⚠️ A COIN FLIP for the case above's reason, and here the declining half
     * is the one `simplestAnswer` would have left the gate stuck on: paying is
     * the answer that changes a life total, and a driver that never paid would
     * run 500 seeds without a single `LifeChanged` from this path while both
     * canaries stayed green on the taps alone.
     *
     * ⚠️ AND PAYING CAN BE REJECTED — `answerEntersChoice` re-checks the life
     * total — so the flip is guarded on what the player can afford. A rejected
     * intent is not a wedge here (`runOne` submits the next one), but it is a
     * seed that silently stopped testing the thing it was reached for.
     */
    /**
     * ⚠️ THE ONLY ANSWER IN THIS DRIVER THAT READS THE BOARD, because the
     * prompt ships no candidates (D137) — a hand is hidden, so listing it in an
     * `Awaiting` would post it to every client. The fuzzer picks RANDOMLY rather
     * than taking the first `count`, so the discard is not always the same
     * corner of the hand and a replay that depended on the order would diverge.
     */
    case 'chooseFromZone': {
      const hand = [...(state.zones.hand[awaiting.player] ?? [])];
      const picked: string[] = [];
      while (picked.length < awaiting.count && hand.length > 0) {
        picked.push(...hand.splice(p.below(hand.length), 1));
      }
      return { t: 'AnswerChooseFromZone', player: awaiting.player, cards: picked };
    }
    case 'entersChoice': {
      const life = state.players[awaiting.player]?.life ?? 0;
      return {
        t: 'AnswerEntersChoice',
        player: awaiting.player,
        source: awaiting.source,
        pay: life >= awaiting.life && p.below(2) === 0,
      };
    }
    default:
      return simplestAnswer(awaiting, state);
  }
}

function nextIntent(state: GameState, p: Picker): Intent | null {
  if (state.gamePhase === 'finished') return null;
  if (state.priority.awaiting) return answerFor(state, p);
  if (p.below(20) === 0) return manualIntentFor(state, p);
  const holder = state.priority.player;
  if (!holder) return null;
  const actions = legalActions(state, ORACLE, SCRIPTS, holder);
  const usable = actions.filter((a) => a.t !== 'CastSpell' || a.affordable);
  const chosen = p.pick(usable);
  if (!chosen) return { t: 'PassPriority', player: holder };
  switch (chosen.t) {
    case 'PlayLand':
      // ⚠️ THE FACE THE OFFER NAMES. Taking face 0 here is exactly the bug
      // D155 fixed one layer up, and it would leave the gate unable to reach a
      // modal DFC's land half however many were dealt.
      return { t: 'PlayLand', player: holder, card: chosen.card, faceIndex: chosen.faceIndex };
    case 'CastSpell':
      return { t: 'CastSpell', player: holder, card: chosen.card };
    case 'TapForMana':
      return {
        t: 'TapForMana',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
        outputChoice: p.below(Math.max(1, chosen.outputs.length)),
      };
    case 'PassPriority':
      return { t: 'PassPriority', player: holder };
    case 'ActivateAbility': {
      // ⚠️ D168: a sacrifice-cost ability arrives with its legal candidates on
      // the offer, and the intent must NAME one or the host rejects it — pick
      // at random so the chooser is exercised across the gate's games.
      const sacs = chosen.sacrificeCandidates;
      const sac = sacs && sacs.length > 0 ? sacs[p.below(sacs.length)] : undefined;
      return {
        t: 'ActivateAbility',
        player: holder,
        card: chosen.card,
        abilityIndex: chosen.abilityIndex,
        ...(sac !== undefined ? { sacrifice: sac } : {}),
      };
    }
  }
}

interface Run {
  readonly seed: number;
  readonly intents: number;
  readonly accepted: number;
  readonly events: number;
  readonly turns: number;
  readonly finished: boolean;
  readonly targetPrompts: number;
  readonly targetsChosen: number;
  /** Permanents that entered carrying loyalty or defense counters. */
  readonly enteredWithCounters: number;
  /** Permanents that BECAME a planeswalker and were given its loyalty. */
  readonly transformedIntoPlaneswalker: number;
  readonly peeked: number;
  /** Triggered abilities put on the stack — zero for the whole of M3–M6.2. */
  readonly triggersFired: number;
  readonly activatedRun: number;
  readonly optionalTaken: number;
  readonly optionalDeclined: number;
  /** Layer-6 sources that reached a battlefield — `applyStatics` had live work. */
  readonly layer6Sources: number;
  /** `+1/+1`/`-1/-1` counters written by a SPELL or a SCRIPT, never by a tool. */
  readonly ptCountersWritten: number;
  /** Tokens created by the RULES — every one before M6.3f came from a tool. */
  readonly tokensCreated: number;
  /** …and how many of them the oracle could actually name. */
  readonly tokensNamed: number;
  /** Permanents that arrived TAPPED because their own text says so (CR 614.1c). */
  readonly enteredTapped: number;
  readonly entersPaid: number;
  readonly entersDeclined: number;
  readonly discardsChosen: number;
  readonly cardsDiscarded: number;
  readonly triggerTargetsChosen: number;
  readonly triggersFizzled: number;
  readonly diesTriggers: number;
  readonly replacementChoices: number;
  /** Permanents that entered as a face other than the front one (CR 712). */
  readonly backFacesPlayed: number;
}

function runOne(seed: number): Run {
  const p = picker(`fuzz-${seed}`);
  const game = Game.create(makeSpec({ players: 4, seed: `fuzz-${seed}`, decks: [DECK, DECK, DECK, DECK], librarySize: 60 }), deps(SCRIPTS), {
    checkInvariants: false,
  });
  let accepted = 0;

  const check = (): void => {
    const problems = checkInvariants(game.state);
    if (problems.length > 0) {
      throw new Error(`seed ${seed} @ event ${game.state.eventCount}: ${problems.join('; ')}`);
    }
  };
  check();

  let targetPrompts = 0;
  for (let i = 0; i < INTENTS; i++) {
    if (game.state.priority.awaiting?.kind === 'chooseTargets') targetPrompts++;
    const intent = nextIntent(game.state, p);
    if (!intent) break;
    const result = game.submit(intent);
    if (result.ok) accepted++;
    // ⚠️ Checked after EVERY submitted intent, not at the end. Without this the
    // failure reads as "the state is corrupt somewhere in the last 40 000
    // events" instead of naming the intent that did it.
    check();
  }

  // The whole point: the same log, re-folded, is the same game.
  const replayed = replay(game.log, game.seed);
  if (stateHash(replayed) !== game.hash()) {
    throw new Error(`seed ${seed}: replay hash differs after ${game.log.length} events`);
  }

  // Every event's seq is dense from zero.
  game.log.forEach((e, i) => {
    if (e.seq !== i) throw new Error(`seed ${seed}: seq ${e.seq} at index ${i}`);
  });

  // PRNG self-consistency: an event that recorded an rng advance must have
  // recorded BOTH ends of it, and the state must have taken the recorded one.
  for (const e of game.log) {
    if (e.rngAfter === undefined) continue;
    if (e.rngBefore === undefined) throw new Error(`seed ${seed}: rngAfter with no rngBefore at ${e.seq}`);
  }

  return {
    seed,
    intents: INTENTS,
    accepted,
    events: game.log.length,
    turns: game.state.turn.turnNumber,
    finished: game.state.gamePhase === 'finished',
    targetPrompts,
    targetsChosen: game.log.filter((e) => e.body.t === 'TargetsChosen').length,
    // ⚠️ TWO rules write these kinds now, so counting them is no longer enough
    // to say which one ran — D108's transform rule writes `loyalty` exactly as
    // the entry rule does. They are told apart by the event they were appended
    // to: the funnel returns `[FaceIndexSet, CountersChanged]` for a transform,
    // so a loyalty change sitting immediately after a flip came from D108 and
    // anything else came from an entry. (The entry side cannot use the same
    // adjacency in reverse: `commanderZoneReplacement` can push an `AwaitingSet`
    // in between, so the counters do not always follow their `CardsMoved`.)
    enteredWithCounters: countersWritten(game.log, false),
    transformedIntoPlaneswalker: countersWritten(game.log, true),
    peeked: game.log.filter((e) => e.body.t === 'CardsRevealed').length,
    // ⚠️ `kind === 'triggered'`, not every `AbilityPutOnStack`. That event also
    // carries every ACTIVATED ability, and this counter read 249 with an EMPTY
    // registry when it did not filter — a canary that would have gone green over
    // a trigger bus that never ran once.
    triggersFired: game.log.filter(
      (e) => e.body.t === 'AbilityPutOnStack' && e.body.obj.kind === 'triggered',
    ).length,
    // ⚠️ Filtered to the SHIPPED refs, not `kind === 'activated'` alone — the
    // engine has stacked activated abilities since M3 and resolved them to
    // nothing; only one whose ref a def claims runs a script (D159), and that
    // is the new ground this canary exists for.
    activatedRun: game.log.filter(
      (e) =>
        e.body.t === 'AbilityPutOnStack' &&
        e.body.obj.kind === 'activated' &&
        ACTIVATED_REFS.has(e.body.obj.abilityRef ?? ''),
    ).length,
    optionalTaken: game.log.filter((e) => e.body.t === 'OptionalTriggerAnswered' && e.body.accept).length,
    optionalDeclined: game.log.filter((e) => e.body.t === 'OptionalTriggerAnswered' && !e.body.accept).length,
    // ⚠️ Layer 6 emits NO EVENT — it is a derivation, and `derive.ts`'s header
    // says characteristics are never stored. So the canary counts the SOURCES
    // arriving instead: an enchantment on a battlefield is `applyStatics` having
    // real work, which is the closest a log can get to "the layer ran".
    layer6Sources: game.log.filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.to.kind === 'battlefield' && LAYER6_ORACLES.has(game.state.cards[m.card]?.oracleId ?? ''),
        ),
    ).length,
    // ⚠️ `cause.kind !== 'manual'` is the whole assertion. The fuzzer's Tier-3
    // tools write `+1/+1` counters one manual intent in thirteen, so an
    // unfiltered count would have been green before this milestone existed —
    // the same green-over-nothing the trigger canary was caught by in D128.
    ptCountersWritten: game.log.filter(
      (e) =>
        e.body.t === 'CountersChanged' &&
        e.cause.kind !== 'manual' &&
        e.body.changes.some((c) => c.kind === '+1/+1' || c.kind === '-1/-1'),
    ).length,
    tokensCreated: game.log.filter((e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual').length,
    // ⚠️ THE CANARY THAT MATTERS, not the count above it. A token whose printing
    // the pool does not hold still produces a `TokenCreated` — it just derives
    // to the inert unknown-printing object, a nameless 0/0 the state-based
    // action bins on the next pass. Counting the EVENT would have gone green on
    // a game that created nothing anybody could see; this counts the ones the
    // oracle can name.
    tokensNamed: game.log.filter(
      (e) => e.body.t === 'TokenCreated' && e.cause.kind !== 'manual' && ORACLE.byPrinting(e.body.printingId) !== undefined,
    ).length,
    // ⚠️ The tap must follow the MOVE that caused it. Counting every
    // `PermanentsTapped` would also count the untap step's mirror, every Tier-3
    // wrench and every land tapped for mana — none of which is this rule.
    // ⚠️ BOTH ANSWERS COUNTED SEPARATELY, because either one alone can be zero
    // while the gate stays green. Paying is a `LifeChanged` and declining is a
    // `PermanentsTapped`, and both of those events happen constantly for
    // unrelated reasons — so the marker is the only thing that can tell this
    // path apart from a land tapped for mana, which is why it exists.
    // ⚠️ TWO NUMBERS AGAIN: the prompts ANSWERED, and the cards that actually
    // moved. A discard whose answer was rejected leaves the first rising and the
    // second flat, which is exactly the silent half-failure a single counter
    // would hide.
    discardsChosen: game.log.filter(
      (e) => e.body.t === 'Narrated' && /\bdiscard(?:s)? \d+ card/.test(e.body.text),
    ).length,
    cardsDiscarded: game.log.filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.cause.kind !== 'manual' &&
        e.body.moves.some((m) => m.from.kind === 'hand' && m.to.kind === 'graveyard'),
    ).length,
    // ⚠️ THE TARGETED-TRIGGER COUNTERS. `StackTargetsSet` is written by this
    // path and NOTHING else, so unlike `TargetsChosen` (which a spell also
    // writes) it cannot go green on somebody else's work.
    triggerTargetsChosen: game.log.filter((e) => e.body.t === 'StackTargetsSet').length,
    // ⚠️ `ReplacementPending` is written by the CR 616 suspension and NOTHING
    // else, so unlike a counter over 'was a replacement applied' it cannot go
    // green on the single-effect path that has worked since D134.
    replacementChoices: game.log.filter((e) => e.body.t === 'ReplacementPending').length,
    // CR 608.2b for a TRIGGER — a distinct sentence from the spell fizzle, so
    // the two cannot be confused for each other.
    triggersFizzled: game.log.filter(
      (e) => e.body.t === 'Narrated' && /does not resolve \(CR 608\.2b\)/.test(e.body.text),
    ).length,
    // ⚠️ COUNTED BY THE ABILITY, not by the life: `Onulet` gains 2 life and so
    // does nothing else in `DECK`, but a canary that watched a life total would
    // be one card away from going green over the wrong thing.
    diesTriggers: game.log.filter(
      (e) => e.body.t === 'AbilityPutOnStack' && /^Onulet —/.test(e.body.obj.label),
    ).length,
    entersPaid: game.log.filter((e) => e.body.t === 'EntersChoiceAnswered' && e.body.pay).length,
    entersDeclined: game.log.filter((e) => e.body.t === 'EntersChoiceAnswered' && !e.body.pay).length,
    // ⚠️ A MOVE that names a face — the one mechanism D155 rests on. Counting
    // `FaceIndexSet` instead would count TRANSFORMS, which is a different rule.
    backFacesPlayed: game.log.filter(
      (e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => (m.faceIndex ?? 0) !== 0),
    ).length,
    enteredTapped: game.log.filter(
      (e, i) => e.body.t === 'PermanentsTapped' && game.log[i - 1]?.body.t === 'CardsMoved',
    ).length,
  };
}

function countersWritten(log: readonly GameEvent[], viaTransform: boolean): number {
  return log.filter((e, i) => {
    if (e.body.t !== 'CountersChanged') return false;
    const relevant = e.body.changes.some(
      (c) => (c.kind === 'loyalty' || c.kind === 'defense') && c.delta > 0,
    );
    if (!relevant) return false;
    return (log[i - 1]?.body.t === 'FaceIndexSet') === viaTransform;
  }).length;
}

/**
 * ⚠️⚠️ **EVERY SHIPPED SCRIPT MUST BE IN THIS GATE’S POOL** — M6.4-LIBRARY-SPEC
 * §6 gate 3, and the rule this repo has broken FOUR times (D102, D107, D108,
 * D121). A card missing from `DECK` is a code path the fuzzer cannot reach, and
 * the gate stays green the whole time that path rots.
 *
 * ⚠️ It is written NOW, while `SHIPPED_SCRIPTS` is empty and the check is
 * vacuous, for the reason `shippedScripts.node.test.ts` gives about itself: the
 * rule has lived in comments since D102 and comments are what got broken. M6.4
 * lands scripts in batches, and a batch that forgets this is indistinguishable
 * from a batch that did it right.
 *
 * ⚠️ Two halves, because either alone is satisfiable while the path stays dead:
 * the script has to be REGISTERED here (or the trigger bus never sees it) and
 * its card has to be DEALT here (or nothing ever puts it on a battlefield).
 */
describe('the fuzz pool covers every shipped script', () => {
  test('every shipped script is registered in this gate', () => {
    const missing = SHIPPED_SCRIPTS.filter((s) => !SCRIPTS.get(s.oracleId)).map((s) => s.name);
    expect(missing).toEqual([]);
  });

  test('and its card is dealt in DECK', () => {
    const dealt = new Set(DECK);
    const missing = SHIPPED_SCRIPTS.filter((s) => !dealt.has(s.name)).map((s) => s.name);
    expect(missing).toEqual([]);
  });

  /**
   * ⚠️ THE TEETH, because both checks above pass over an empty list — D128’s
   * green-over-nothing, which this repo has now written down five times. The
   * TEST registry is the right thing to point them at: those scripts are
   * deliberately not shipped, and `AJANIS_MANTRA` IS dealt while
   * `KNIGHTHOOD_SCRIPT`’s card is not, so one half fires and the other does not.
   */
  test('and the checks have teeth', () => {
    const dealt = new Set(DECK);
    expect(SCRIPTS.get(AJANIS_MANTRA.oracleId)).toBeDefined();
    expect(dealt.has(AJANIS_MANTRA.name)).toBe(true);
    // ⚠️ A script whose card this gate does NOT deal — the failure the second
    // check exists to catch, on a real one. `Humility` is registered nowhere and
    // dealt nowhere, which is exactly the state a forgotten batch would leave a
    // shipped script in. (The first card I reached for, `Kwende`, IS dealt — the
    // gate is already correct about every script it registers, which is the
    // point of the two checks above and the reason this one needed a real miss.)
    expect(dealt.has(HUMILITY_SCRIPT.name)).toBe(false);
  });
});
describe('replay-equivalence fuzzer — THE GATE', () => {
  test(
    `${SEEDS} seeds × ${INTENTS} random legal intents replay to an identical hash`,
    () => {
      const runs: Run[] = [];
      for (let seed = 0; seed < SEEDS; seed++) runs.push(runOne(seed));

      const totals = runs.reduce(
        (a, r) => ({
          accepted: a.accepted + r.accepted,
          events: a.events + r.events,
          turns: a.turns + r.turns,
          finished: a.finished + (r.finished ? 1 : 0),
          targetPrompts: a.targetPrompts + r.targetPrompts,
          targetsChosen: a.targetsChosen + r.targetsChosen,
          enteredWithCounters: a.enteredWithCounters + r.enteredWithCounters,
          transformedIntoPlaneswalker: a.transformedIntoPlaneswalker + r.transformedIntoPlaneswalker,
          peeked: a.peeked + r.peeked,
          triggersFired: a.triggersFired + r.triggersFired,
          activatedRun: a.activatedRun + r.activatedRun,
          optionalTaken: a.optionalTaken + r.optionalTaken,
          optionalDeclined: a.optionalDeclined + r.optionalDeclined,
          layer6Sources: a.layer6Sources + r.layer6Sources,
          ptCountersWritten: a.ptCountersWritten + r.ptCountersWritten,
          tokensCreated: a.tokensCreated + r.tokensCreated,
          tokensNamed: a.tokensNamed + r.tokensNamed,
          enteredTapped: a.enteredTapped + r.enteredTapped,
          entersPaid: a.entersPaid + r.entersPaid,
          discardsChosen: a.discardsChosen + r.discardsChosen,
          cardsDiscarded: a.cardsDiscarded + r.cardsDiscarded,
          triggerTargetsChosen: a.triggerTargetsChosen + r.triggerTargetsChosen,
          triggersFizzled: a.triggersFizzled + r.triggersFizzled,
          diesTriggers: a.diesTriggers + r.diesTriggers,
          replacementChoices: a.replacementChoices + r.replacementChoices,
          entersDeclined: a.entersDeclined + r.entersDeclined,
        }),
        {
          accepted: 0,
          events: 0,
          turns: 0,
          finished: 0,
          targetPrompts: 0,
          targetsChosen: 0,
          enteredWithCounters: 0,
          transformedIntoPlaneswalker: 0,
          peeked: 0,
          triggersFired: 0,
          activatedRun: 0,
          optionalTaken: 0,
          optionalDeclined: 0,
          layer6Sources: 0,
          ptCountersWritten: 0,
          tokensCreated: 0,
          tokensNamed: 0,
          enteredTapped: 0,
          entersPaid: 0,
          discardsChosen: 0,
          cardsDiscarded: 0,
          triggerTargetsChosen: 0,
          triggersFizzled: 0,
          diesTriggers: 0,
          replacementChoices: 0,
          entersDeclined: 0,
        },
      );
      // eslint-disable-next-line no-console
      console.log(
        `fuzz: ${SEEDS} seeds · ${totals.accepted} accepted intents · ${totals.events} events · ` +
          `${totals.turns} turns · ${totals.finished} games finished · ` +
          `${totals.targetPrompts} target prompts · ${totals.targetsChosen} declared · ` +
          `${totals.enteredWithCounters} entered with counters · ` +
          `${totals.transformedIntoPlaneswalker} transformed into a planeswalker · ` +
          `${totals.peeked} library peeks · ` +
          `${totals.triggersFired} triggered abilities · ` +
          `${totals.activatedRun} activated abilities resolved by script · ` +
          `${totals.optionalTaken} may-triggers taken / ${totals.optionalDeclined} declined · ` +
          `${totals.layer6Sources} layer-6 sources on a battlefield · ` +
          `${totals.ptCountersWritten} +1/+1 or -1/-1 counters written by the rules · ` +
          `${totals.tokensCreated} tokens created by the rules (${totals.tokensNamed} the oracle can name) · ` +
          `${totals.enteredTapped} permanents entered tapped · ` +
          `${totals.entersPaid} paid life to enter untapped / ${totals.entersDeclined} declined · ` +
          `${totals.discardsChosen} discards chosen, ${totals.cardsDiscarded} moves of hand→graveyard`,
      );

      // A fuzzer that silently did nothing would pass. These are the canaries.
      expect(totals.accepted).toBeGreaterThan(SEEDS * 50);
      expect(totals.events).toBeGreaterThan(SEEDS * 300);
      expect(totals.turns).toBeGreaterThan(SEEDS * 2);
      // ⚠️ TARGETING PATH CANARIES. Without these, a regression that stopped
      // emitting the prompt — or a harness that answered every one by
      // cancelling — leaves the whole gate green while the feature is dead.
      expect(totals.targetPrompts).toBeGreaterThan(SEEDS);
      expect(totals.targetsChosen).toBeGreaterThan(SEEDS);
      // ⚠️ THE ENTRY-COUNTER CANARY. The hash equality above is only evidence
      // about a rule the run actually EXERCISED, and until Grist and the Siege
      // joined `DECK` this gate could not put a planeswalker on a battlefield at
      // all. Deliberately `> 0` rather than a rate: it is asserting the path is
      // reachable, and the fuzzer has to draw and afford a 3-drop to get there.
      expect(totals.enteredWithCounters).toBeGreaterThan(0);
      // ⚠️ THE TRANSFORM CANARY, and it needed a new INTENT as well as a new
      // card: `manualIntentFor` had no `ManualFlipFace` case at all, so no seed
      // could turn a permanent over however many faces it had. Same `> 0`
      // reasoning as the entry canary above — it asserts the path is reachable,
      // and getting there means drawing Jace, affording him, resolving him, and
      // then rolling the one manual tool in nine that flips.
      // ⚠️ **AT THE GATE SIZE ONLY, and D155 is what moved it there** — D149's
      // precedent, now for the second canary. Adding one modal DFC to `DECK`
      // diluted every other card enough that this path stopped being reached at
      // the 60-seed default while staying comfortable at 500: measured 0 at 60
      // and green at 500 on the same commit. A `> 0` that is a coin flip at the
      // default is a check that fails for reasons unrelated to what it tests.
      if (SEEDS >= 500) expect(totals.transformedIntoPlaneswalker).toBeGreaterThan(0);
      // ⚠️ THE PEEK CANARY. The leak test above now asserts a BOUNDARY —
      // a library card may reach a projection only when it is revealed to
      // that viewer — and an assertion about a boundary nothing crosses is
      // the same green-over-nothing this file has been caught by twice.
      expect(totals.peeked).toBeGreaterThan(0);
      // ⚠️ THE TRIGGER-BUS CANARY, and it is new ground rather than a widening.
      // Until D128 this gate ran `NO_SCRIPTS`, so `collectTriggers`
      // short-circuited on `scripts.size === 0` in every one of 500 seeds and
      // the whole bus — collect, APNAP sort, drain, `AbilityPutOnStack` — was
      // unreachable from the one thing that runs the engine ten thousand times
      // a night.
      expect(totals.triggersFired).toBeGreaterThan(0);
      // ⚠️ THE ACTIVATED-SEAM CANARY (D159). The engine has stacked activated
      // abilities since M3 — the counter is filtered to the SHIPPED refs, so
      // it counts only an ability a def RESOLVED, which is the new ground.
      // Gate-size only, like the dies-trigger canary: reaching one takes
      // drawing the artifact or land, playing it, affording the activation and
      // the fuzzer choosing it, which is a coin flip across 60 arbitrary seeds.
      if (SEEDS >= 500) expect(totals.activatedRun).toBeGreaterThan(0);
      // ⚠️ BOTH ANSWERS, separately. One canary over "was the prompt raised"
      // would stay green with a driver that only ever declined, and declining
      // runs no script at all — so the accept path, which is the entire point of
      // the primitive, would be exercised by nothing. Deliberately `> 0` rather
      // than a rate, like the entry-counter canary: getting here means drawing
      // Ajani's Mantra, affording `{1}{W}`, resolving it, and surviving to an
      // upkeep of your own.
      expect(totals.optionalTaken).toBeGreaterThan(0);
      expect(totals.optionalDeclined).toBeGreaterThan(0);
      // ⚠️ THE LAYER-6 CANARY. `applyStatics` short-circuits on an empty def
      // list, so before D129 it had never run its body here either — and unlike
      // the trigger bus, layer 6 writes NO EVENT to assert on. This counts the
      // sources arriving, which is what gives the layer live work.
      expect(totals.layer6Sources).toBeGreaterThan(0);
      // ⚠️ THE COUNTER-EFFECT CANARY. `CountersChanged` has been on the log
      // since D107, so the EVENT was always reachable — what was not is the
      // rules writing one: a spell resolving through `effectEvents`, or a card
      // script returning one. Filtered against `manual` for exactly that reason.
      expect(totals.ptCountersWritten).toBeGreaterThan(0);
      // ⚠️ THE TOKEN CANARY, and it asserts the NAMED count rather than the
      // event count — see `tokensNamed`. Equality between the two is the real
      // property: every token the rules created was a card the oracle knew.
      expect(totals.tokensNamed).toBeGreaterThan(0);
      expect(totals.tokensNamed).toBe(totals.tokensCreated);
      // ⚠️ THE ENTERS-TAPPED CANARY. Ten places move a card onto the
      // battlefield and the rule lives in the replacement funnel so it catches
      // all ten; a gate that never played one of these lands would be green on
      // a rule that fired nowhere.
      expect(totals.enteredTapped).toBeGreaterThan(0);
      // ⚠️ THE ENTERS-CHOICE CANARY, and it is TWO numbers for the reason the
      // may-trigger canary is two: a driver that only ever declined would leave
      // the paying half — the half that costs life and can be REJECTED —
      // untaken in all 500 seeds, and the tap count above would rise anyway.
      expect(totals.entersPaid).toBeGreaterThan(0);
      expect(totals.entersDeclined).toBeGreaterThan(0);
      // ⚠️ THE DISCARD CANARY. `CardsMoved` hand→graveyard also happens at
      // cleanup for a hand over seven, so the count alone would have been green
      // since M3; the narration counter is the one that only this path writes.
      expect(totals.discardsChosen).toBeGreaterThan(0);
      expect(totals.cardsDiscarded).toBeGreaterThan(0);
      // ⚠️ THE TARGETED-TRIGGER CANARY. Before D147 `drainTriggers` built every
      // stack object with `targets: []`, so this whole path — the prompt, the
      // validation, `StackTargetsSet`, and CR 608.2b for an ability — did not
      // exist. A gate that never played a Yotian Dissident would be green on it.
      expect(totals.triggerTargetsChosen).toBeGreaterThan(0);
      // ⚠️ THE LOOK-BACK CANARY, and it is the one that would have been green
      // over nothing in the most misleading way: a dies trigger that never
      // fires leaves NO trace at all, so every other counter here is unmoved by
      // it being broken. Counting the ability reaching the stack is the only
      // evidence that CR 603.10a ran.
      // ⚠️ **AT THE GATE SIZE, for D155's reason and D149's precedent.** Adding
      // one card to `DECK` does not merely dilute it — it RE-ROLLS every seed's
      // game, because the deck list feeds the shuffle. So a canary that is rare
      // at the 60-seed default is a coin flip on which 60 arbitrary games come
      // up, and this one and the Jace transform both went to 0 at 60 while the
      // 500-seed gate stayed green on the same commit.
      if (SEEDS >= 500) expect(totals.diesTriggers).toBeGreaterThan(0);
      // ⚠️ THE CR 616 CANARY. The funnel suspends only when TWO replacements
      // apply to one event, which needs both cards on one battlefield and a
      // counter being put — so this is the one number that says the
      // continuation, its three parked queues and the resume all ran in a real
      // game rather than only in a unit test.
      // ⚠️ **NOT ASSERTED > 0, AND MEASURED RATHER THAN ASSUMED: 500 seeds
      // reach it ZERO times.** CR 616 suspends only when TWO replacements apply
      // to ONE event, which needs both one-of enchantments cast onto the same
      // battlefield AND a +1/+1 counter put afterwards — three specific cards
      // inside 200 random intents. Asserting a positive here would be a flaky
      // gate; asserting nothing and saying so is D137's precedent for the
      // "no legal target" narration, which also fired zero times.
      //
      // ⚠️ THE COVERAGE IS ELSEWHERE AND IS STRONGER: `battery-anim.cjs prompts`
      // drives both branches with REAL CLICKS in a real Electron, through the
      // `HostOptions.scripts` seam D146 built. The counter stays because it is
      // free and will start moving the day this deck changes.
      // ⚠️ **AT THE GATE SIZE ONLY, and the rate is why: MEASURED at 5 across
      // 500 seeds.** Two replacements applying to ONE event needs both one-of
      // enchantments cast onto the same battlefield and a +1/+1 counter after —
      // roughly one seed in a hundred. Asserting it at the 60-seed default would
      // be a coin-flip gate; asserting it at 500 and saying the rate is the
      // honest form. `battery-anim.cjs prompts` covers both branches with real
      // clicks either way, which is the coverage that does not depend on luck.
      if (SEEDS >= 500) expect(totals.replacementChoices).toBeGreaterThan(0);
    },
    // ⚠️ A HANG CATCHER, NOT A PERF REFEREE (D133's testTimeout rule). The
    // wall grows with the arc's whole point — more scripts mean richer games
    // mean more events — and it crossed 600 s at 148 scripts (D167). A
    // second bus pass (lazy construction + present-def memo) measured ~2% at
    // 60 seeds, which is the proof the cost is the GAMES, not the bus.
    // History: 394 s @ 57 · 471 s @ 107 · 568 s @ 128 · timeout @ 148 ·
    // 589.6 s @ 148 · 622.7 s @ 174 · timeout @ 197 (D170 — the run
    // COMPLETED all 500 seeds with every hash equal at 1,162 s under desktop
    // load; ~145 s per 60 seeds projects ~900–1,200 s, straddling the old
    // ceiling even idle, on 2.84 M events / 24 K turns of genuinely richer
    // games). Raised twice now, and only ever after a completed-and-equal
    // run proved the wall was growth rather than a hang. Self-only def
    // dispatch remains the named lever if WALL TIME itself (not the
    // ceiling) becomes the problem.
    1_800_000,
  );

  test('a fuzzed game never leaks a library into any projection', () => {
    const p = picker('leak');
    const game = Game.create(
      makeSpec({ players: 4, seed: 'leak', decks: [DECK, DECK, DECK, DECK], librarySize: 60 }),
      deps(SCRIPTS),
      { checkInvariants: false },
    );
    for (let i = 0; i < 300; i++) {
      const intent = nextIntent(game.state, p);
      if (!intent) break;
      game.submit(intent);
    }
    for (const viewer of game.state.seating) {
      const view = project(game.state, ORACLE, game.deps.scripts, viewer);
      const libraries = new Set(game.state.seating.flatMap((x) => [...(game.state.zones.library[x] ?? [])]));
      // ⚠️ THE BOUNDARY, not a blanket ban. A library card may appear in a
      // projection for exactly one reason — it has been revealed to THIS viewer,
      // which is what a peek is and has been since M3. This assertion used to
      // read "no library card, ever", and it passed only because nothing in this
      // file could peek; the fuzzer does now, so it says what it means.
      for (const id of Object.keys(view.cards)) {
        if (!libraries.has(id)) continue;
        expect(
          game.state.cards[id]?.revealedTo.includes(viewer),
          `${viewer} can see library card ${id} without it being revealed to them`,
        ).toBe(true);
      }
      // ⚠️ And the ORDER exception is bounded the same way: `peek` is only ever
      // my OWN library, only cards revealed to me, and only the run from the top
      // — the three clauses that stop it becoming "the client knows the deck".
      const ownLibrary = game.state.zones.library[viewer] ?? [];
      for (const [i, id] of view.peek.entries()) {
        expect(ownLibrary.includes(id), `${viewer} peeked at a card not in their library`).toBe(true);
        expect(game.state.cards[id]?.revealedTo.includes(viewer)).toBe(true);
        expect(ownLibrary[ownLibrary.length - 1 - i], `peek is not the top run, in order`).toBe(id);
      }
      for (const other of game.state.seating) {
        expect(view.zones[zoneId('lib', other)]).toBeUndefined();
        if (other === viewer) continue;
        for (const id of view.zones[zoneId('hand', other)] ?? []) {
          expect(view.cards[id]?.card, `${viewer} can see ${other}'s ${id}`).toBeNull();
        }
      }
    }
  });

  test('a fuzzed game rewinds to any point and still replays', () => {
    const p = picker('rewind');
    const game = Game.create(
      makeSpec({ players: 4, seed: 'rewind', decks: [DECK, DECK, DECK, DECK], librarySize: 60 }),
      deps(SCRIPTS),
      { checkInvariants: false },
    );
    const marks: number[] = [];
    for (let i = 0; i < 200; i++) {
      const intent = nextIntent(game.state, p);
      if (!intent) break;
      game.submit(intent);
      if (i % 40 === 0) marks.push(game.log.length);
    }
    for (const mark of marks.reverse()) {
      expect(game.rewind(mark)).toBe(true);
      expect(checkInvariants(game.state)).toEqual([]);
      expect(stateHash(replay(game.log, game.seed))).toBe(game.hash());
    }
  });
});
