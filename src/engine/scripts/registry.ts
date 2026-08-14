// The script registry, pre-indexed so the trigger bus never scans the board.
//
// ⚠️ `SHIPPED_REGISTRY` is what v1 ships. Every method on it returns an empty
// array or undefined, which is exactly what makes the rest of the engine work
// with no `if (scripted)` anywhere.

import type { CardScript, CombatDef, ReplacementDef, StaticDef, TriggerDef } from './api';
import type { EventKind } from '../types/events';
import type { OracleId } from '../types/ids';
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
