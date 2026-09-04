import { describe, expect, test } from 'vitest';
import * as fx from './fixtures/engineCards';
import { engineCompleteness, faceCompleteness, isEngineComplete, lineClaims } from './engineComplete';
import { tier3NotesFor } from './tier3';
import type { CardData } from './cardTypes';
import type { CardScript } from '../engine/scripts/api';
import type { OracleId } from '../engine/types/ids';

// ⚠️ The two lists below were WRITTEN by reading what the predicate actually
// said about all 82 fixtures and checking each card against its own oracle text
// — not by asserting what felt right. `botPool.node.test.ts` prints that report
// (`CRT_BOTPOOL_REPORT=1`); it lives there because only a `.node.test.ts` may
// read `process.env` in this project, and because the same run measures the
// whole database.
//
// Two cards in the INCOMPLETE list below were ACCEPTED by the first version of
// the predicate and are the reason it has the two rules it has: `Ancient Tomb`
// (a second sentence on a mana ability's line) and `Dark Ritual` (a spell whose
// "Add" is not an ability anything can tap).

/** Every word of these runs. A bot may be dealt them. */
const COMPLETE: readonly [string, CardData][] = [
  ['Plains', fx.PLAINS],
  ['Island', fx.ISLAND],
  ['Wastes', fx.WASTES],
  ['Snow-Covered Forest', fx.SNOW_COVERED_FOREST],
  ['Command Tower', fx.COMMAND_TOWER],
  ['Tundra', fx.TUNDRA],
  // ⚠️ Dark Ritual sat in INCOMPLETE below from M6.1 to M6.4ag with the note
  // 'a sorcery-speed "Add {B}{B}{B}" is not an ability anything taps' — true
  // of the PARSER then and still true of it now. What changed is the SEAM:
  // a SpellDef (D187) resolves the whole card, and wave 1 (D192) shipped
  // one. The pinned negative example becoming a positive is the coverage
  // number moving at fixture level.
  ['Dark Ritual', fx.DARK_RITUAL],
  // ⚠️ And two more pinned negatives became positives in D196 — Swords to
  // Plowshares ('the exile is understood; the life gain is not') and Wrath
  // of God ('destroy ALL, which the vocabulary does not read'). Both true of
  // the vocabulary to this day; both cards run through SpellDefs now.
  ['Swords to Plowshares', fx.SWORDS_TO_PLOWSHARES],
  ['Wrath of God', fx.WRATH_OF_GOD],
  // ⚠️ D116's two board-resolved scopes. `landsYou`/`landsOpponents` are
  // expanded at solve time exactly as `identity` is, so they are not
  // conditional and the bot may hold them.
  ['Reflecting Pool', fx.REFLECTING_POOL],
  ['Exotic Orchard', fx.EXOTIC_ORCHARD],
  ['Sol Ring', fx.SOL_RING],
  ['Arcane Signet', fx.ARCANE_SIGNET],
  ['Darksteel Myr', fx.DARKSTEEL_MYR],
  ['Llanowar Elves', fx.LLANOWAR_ELVES],
  ['Birds of Paradise', fx.BIRDS_OF_PARADISE],
  ['Grizzly Bears', fx.GRIZZLY_BEARS],
  ['Scathe Zombies', fx.SCATHE_ZOMBIES],
  ['Silvercoat Lion', fx.SILVERCOAT_LION],
  ['Air Elemental', fx.AIR_ELEMENTAL],
  ['Serra Angel', fx.SERRA_ANGEL],
  ['Giant Spider', fx.GIANT_SPIDER],
  ['Colossal Dreadmaw', fx.COLOSSAL_DREADMAW],
  ['Vampire Nighthawk', fx.VAMPIRE_NIGHTHAWK],
  ['Typhoid Rats', fx.TYPHOID_RATS],
  ['White Knight', fx.WHITE_KNIGHT],
  ['Boros Swiftblade', fx.BOROS_SWIFTBLADE],
  ['Boggart Brute', fx.BOGGART_BRUTE],
  ['Scaled Behemoth', fx.SCALED_BEHEMOTH],
  ['Raging Goblin', fx.RAGING_GOBLIN],
  ['Child of Night', fx.CHILD_OF_NIGHT],
  ['Bull Hippo', fx.BULL_HIPPO],
  ['Ambush Viper', fx.AMBUSH_VIPER],
  ['Priests of Norn', fx.PRIESTS_OF_NORN],
  ['Flensermite', fx.FLENSERMITE],
  ['Lightning Bolt', fx.LIGHTNING_BOLT],
  ['Counterspell', fx.COUNTERSPELL],
  // ⚠️ M6.4a (D158): the first cards accepted because a SHIPPED script claims
  // their ability line — the silence hook's CI-visible proof, since this file
  // needs no database. Both sat in INCOMPLETE below from the day it was
  // written; what moved them is `SHIPPED_SCRIPTS` gaining their scripts, not a
  // parser change.
  ['Wall of Omens', fx.WALL_OF_OMENS],
  ['Baleful Strix', fx.BALEFUL_STRIX],
  // ⚠️ M6.4b (D159): the four the ActivatedDef seam unblocked — accepted
  // because a SHIPPED activated def claims each `cost: effect` line, matched
  // by KIND (an activated line is claimable only by an activated def). Krenko
  // in INCOMPLETE below still refuses — payable, undef'd — which is exactly
  // the teeth this list needs.
  ['Arcane Encyclopedia', fx.ARCANE_ENCYCLOPEDIA],
  ['Deserted Temple', fx.DESERTED_TEMPLE],
  ['Hedron Archive', fx.HEDRON_ARCHIVE],
  ['War Room', fx.WAR_ROOM],
  // M6.4c (D160): batch 3's nineteen, accepted by their shipped defs — the
  // sentence half AND the activated half of the claims map both at work.
  ['Talrand, Sky Summoner', fx.TALRAND_SKY_SUMMONER],
  ['Yotian Dissident', fx.YOTIAN_DISSIDENT],
  ['A.I.M. Labs', fx.A_I_M_LABS],
  ['Abzan Banner', fx.ABZAN_BANNER],
  ['Acolyte of Xathrid', fx.ACOLYTE_OF_XATHRID],
  ['Adun Oakenshield', fx.ADUN_OAKENSHIELD],
  ['Aether Adept', fx.AETHER_ADEPT],
  ['Affa Guard Hound', fx.AFFA_GUARD_HOUND],
  ['Agents of HYDRA', fx.AGENTS_OF_HYDRA],
  ['Airship Engine Room', fx.AIRSHIP_ENGINE_ROOM],
  ["Ajani's Welcome", fx.AJANI_S_WELCOME],
  ['Akoum Refuge', fx.AKOUM_REFUGE],
  ['Akroan Jailer', fx.AKROAN_JAILER],
  ['Akroan Mastiff', fx.AKROAN_MASTIFF],
  ["Aladdin's Ring", fx.ALADDIN_S_RING],
  ["Alchemist's Apprentice", fx.ALCHEMIST_S_APPRENTICE],
  ['Amateur Hero', fx.AMATEUR_HERO],
  ['Ambassador Oak', fx.AMBASSADOR_OAK],
  ['Ambush Gigapede', fx.AMBUSH_GIGAPEDE],
  // M6.4d (D161): batch 4's thirteen. ⚠️ Angelic Page and Anointer of
  // Champions are NOT here — their "attacking"/"blocking" clauses are
  // unenforced target restrictions, so this predicate refuses them however
  // many scripts ship, which is exactly why they were pulled from the batch.
  ['Anaba Shaman', fx.ANABA_SHAMAN],
  ['Angel of Despair', fx.ANGEL_OF_DESPAIR],
  ['Angel of Mercy', fx.ANGEL_OF_MERCY],
  ['Anodet Lurker', fx.ANODET_LURKER],
  ['Ant Queen', fx.ANT_QUEEN],
  ['Aquus Steed', fx.AQUUS_STEED],
  ['Arashin Cleric', fx.ARASHIN_CLERIC],
  ['Arasta of the Endless Web', fx.ARASTA_OF_THE_ENDLESS_WEB],
  ['Arborback Stomper', fx.ARBORBACK_STOMPER],
  ['Archaeomancer', fx.ARCHAEOMANCER],
  ['Archivist', fx.ARCHIVIST],
  ['Archon of Justice', fx.ARCHON_OF_JUSTICE],
  ['Ardent Elementalist', fx.ARDENT_ELEMENTALIST],
  // M6.4e (D162) — batch 5.
  ['Argothian Enchantress', fx.ARGOTHIAN_ENCHANTRESS],
  ['Ark of Blight', fx.ARK_OF_BLIGHT],
  ['Armada Wurm', fx.ARMADA_WURM],
  ['Armasaur Guide', fx.ARMASAUR_GUIDE],
  ['Asgardian Citadel', fx.ASGARDIAN_CITADEL],
  ['Ashen Rider', fx.ASHEN_RIDER],
  ["Ashiok's Reaper", fx.ASHIOK_S_REAPER],
  ['Aspiring Aeronaut', fx.ASPIRING_AERONAUT],
  ['Attended Knight', fx.ATTENDED_KNIGHT],
  ['Auriok Transfixer', fx.AURIOK_TRANSFIXER],
  ['Aven Battle Priest', fx.AVEN_BATTLE_PRIEST],
  ['Aven Cloudchaser', fx.AVEN_CLOUDCHASER],
  ['Aven Fogbringer', fx.AVEN_FOGBRINGER],
  // M6.4f (D163) — batch 6.
  ['Aven of Enduring Hope', fx.AVEN_OF_ENDURING_HOPE],
  ['Avengers Hangar', fx.AVENGERS_HANGAR],
  ['Aviation Pioneer', fx.AVIATION_PIONEER],
  ['Aysen Bureaucrats', fx.AYSEN_BUREAUCRATS],
  ['Azorius Cluestone', fx.AZORIUS_CLUESTONE],
  ['Azorius Locket', fx.AZORIUS_LOCKET],
  ['Azure Mage', fx.AZURE_MAGE],
  ['Backup Agent', fx.BACKUP_AGENT],
  ['Baleful Ammit', fx.BALEFUL_AMMIT],
  // M6.4g (D164) — batch 7.
  ['Barbarian Riftcutter', fx.BARBARIAN_RIFTCUTTER],
  ['Bartered Cow', fx.BARTERED_COW],
  ['Beamsaw Prospector', fx.BEAMSAW_PROSPECTOR],
  ["Bear's Companion", fx.BEAR_S_COMPANION],
  ['Beast Whisperer', fx.BEAST_WHISPERER],
  ['Beetleback Chief', fx.BEETLEBACK_CHIEF],
  ['Belligerent Guest', fx.BELLIGERENT_GUEST],
  ['Benalish Heralds', fx.BENALISH_HERALDS],
  ['Benalish Trapper', fx.BENALISH_TRAPPER],
  ['Beskir Shieldmate', fx.BESKIR_SHIELDMATE],
  ['Bigfin Bouncer', fx.BIGFIN_BOUNCER],
  ['Bile Urchin', fx.BILE_URCHIN],
  ['Birnin Zana Plaza', fx.BIRNIN_ZANA_PLAZA],
  ['Birthing Boughs', fx.BIRTHING_BOUGHS],
  ['Blaze Commando', fx.BLAZE_COMMANDO],
  ['Blighted Cataract', fx.BLIGHTED_CATARACT],
  ['Blinding Mage', fx.BLINDING_MAGE],
  ['Blinding Souleater', fx.BLINDING_SOULEATER],
  ['Blister Beetle', fx.BLISTER_BEETLE],
  // M6.4h (D165) — batch 8.
  ['Blood Servitor', fx.BLOOD_SERVITOR],
  ['Bloodfell Caves', fx.BLOODFELL_CAVES],
  ['Bloodtallow Candle', fx.BLOODTALLOW_CANDLE],
  ['Blossom Dryad', fx.BLOSSOM_DRYAD],
  ['Blossoming Sands', fx.BLOSSOMING_SANDS],
  ['Bogardan Rager', fx.BOGARDAN_RAGER],
  ['Bogwater Lumaret', fx.BOGWATER_LUMARET],
  ['Boiling Rock Prison', fx.BOILING_ROCK_PRISON],
  ['Boltwing Marauder', fx.BOLTWING_MARAUDER],
  ['Bond Beetle', fx.BOND_BEETLE],
  ['Bone Pit Brute', fx.BONE_PIT_BRUTE],
  ['Book of Rass', fx.BOOK_OF_RASS],
  ['Boros Cluestone', fx.BOROS_CLUESTONE],
  ['Boros Locket', fx.BOROS_LOCKET],
  ['Botanical Plaza', fx.BOTANICAL_PLAZA],
  ['Bottle Gnomes', fx.BOTTLE_GNOMES],
  ['Braidwood Cup', fx.BRAIDWOOD_CUP],
  ['Bramble Elemental', fx.BRAMBLE_ELEMENTAL],
  ['Brandywine Farmer', fx.BRANDYWINE_FARMER],
  ['Brass Secretary', fx.BRASS_SECRETARY],
  ['Brazen Freebooter', fx.BRAZEN_FREEBOOTER],
  ['Briarknit Kami', fx.BRIARKNIT_KAMI],
  // M6.4i (D166) — batch 9.
  ['Briarpack Alpha', fx.BRIARPACK_ALPHA],
  ['Brindle Boar', fx.BRINDLE_BOAR],
  ['Brindle Shoat', fx.BRINDLE_SHOAT],
  ['Brinebarrow Intruder', fx.BRINEBARROW_INTRUDER],
  ['Brood Weaver', fx.BROOD_WEAVER],
  ['Broodmate Dragon', fx.BROODMATE_DRAGON],
  ['Bulwark Giant', fx.BULWARK_GIANT],
  ['Burrenton Shield-Bearers', fx.BURRENTON_SHIELD_BEARERS],
  ['Burrog Befuddler', fx.BURROG_BEFUDDLER],
  ['Buzz Bots', fx.BUZZ_BOTS],
  ['Cabal Trainee', fx.CABAL_TRAINEE],
  ['Cackling Imp', fx.CACKLING_IMP],
  ['Capashen Unicorn', fx.CAPASHEN_UNICORN],
  ['Captive Flame', fx.CAPTIVE_FLAME],
  ["Cartographer's Companion", fx.CARTOGRAPHER_S_COMPANION],
  ['Carven Caryatid', fx.CARVEN_CARYATID],
  ['Castle Ardenvale', fx.CASTLE_ARDENVALE],
  ['Cat-Owl', fx.CAT_OWL],
  ['Cathar Commando', fx.CATHAR_COMMANDO],
  ['Cathedral Sanctifier', fx.CATHEDRAL_SANCTIFIER],
  ['Caustic Caterpillar', fx.CAUSTIC_CATERPILLAR],
  // M6.4j (D167) — batch 10.
  ['Celestial Force', fx.CELESTIAL_FORCE],
  ['Centaur Glade', fx.CENTAUR_GLADE],
  ['Centaur Healer', fx.CENTAUR_HEALER],
  ['Centaur Nurturer', fx.CENTAUR_NURTURER],
  ["Centaur's Herald", fx.CENTAUR_S_HERALD],
  ["Chandra's Magmutt", fx.CHANDRA_S_MAGMUTT],
  ['Checkpoint Officer', fx.CHECKPOINT_OFFICER],
  ['Child of Thorns', fx.CHILD_OF_THORNS],
  ['Chimney Rabble', fx.CHIMNEY_RABBLE],
  ['Chrome Prowler', fx.CHROME_PROWLER],
  ['City Pigeon', fx.CITY_PIGEON],
  ['Clarion Cathars', fx.CLARION_CATHARS],
  ['Clockwork Drawbridge', fx.CLOCKWORK_DRAWBRIDGE],
  ['Cloudchaser Eagle', fx.CLOUDCHASER_EAGLE],
  ['Cloudkin Seer', fx.CLOUDKIN_SEER],
  ['Cogwork Wrestler', fx.COGWORK_WRESTLER],
  ["Commander's Sphere", fx.COMMANDER_S_SPHERE],
  ['Common Crook', fx.COMMON_CROOK],
  ['Conclave Cavalier', fx.CONCLAVE_CAVALIER],
  ['Conscripted Infantry', fx.CONSCRIPTED_INFANTRY],
  // D300: the static seam shipped 'Other permanents you control have indestructible'.
  ['Avacyn, Angel of Hope', fx.AVACYN_ANGEL_OF_HOPE],
];

/**
 * Each of these is rejected, and the reason is named. The reason matters more
 * than the verdict: every one is a DIFFERENT way for the engine to fall short,
 * and a change that started accepting any of them would be accepting a card the
 * bot cannot actually play.
 */
const INCOMPLETE: readonly [string, CardData, string][] = [
  ['Krenko, Mob Boss', fx.KRENKO_MOB_BOSS, 'a PAYABLE activated ability whose effect never happens'],
  ['Kess, Dissident Mage', fx.KESS_DISSIDENT_MAGE, 'a static ability, and there is no layer for it'],
  ['Pacifism', fx.PACIFISM, 'an Aura granting a restriction nothing enforces'],
  ['Lightning Greaves', fx.LIGHTNING_GREAVES, 'equip has no colon, so it is not even an ability line'],
  ['Tarmogoyf', fx.TARMOGOYF, 'a characteristic-defining ability'],
  ['Ancient Tomb', fx.ANCIENT_TOMB, 'the mana is fine; the 2 damage on the SAME LINE is not'],
  ['Boros Garrison', fx.BOROS_GARRISON, 'enters tapped, which applyReplacements does not do'],
  ['Cultivate', fx.CULTIVATE, 'a sorcery searching a library — outside the closed vocabulary'],
  ['Grist, the Hunger Tide', fx.GRIST_THE_HUNGER_TIDE, 'loyalty abilities'],
];

describe('engineCompleteness', () => {
  test('the fixture pool is present', () => {
    expect(fx.ENGINE_CARDS.length).toBeGreaterThan(50);
  });

  test.each(COMPLETE)('%s runs completely', (_name, card) => {
    expect(engineCompleteness(card).leftover).toEqual([]);
  });

  test.each(INCOMPLETE)('%s does not, because of %#', (_name, card) => {
    expect(isEngineComplete(card)).toBe(false);
  });

  test('a rejection names the line it could not account for', () => {
    // Boros Garrison since M6.4a — Wall of Omens, the original example, is now
    // COMPLETE (a shipped script runs its trigger). The Garrison's bounce
    // trigger is still nobody's, and it names itself the same way.
    const notes = engineCompleteness(fx.BOROS_GARRISON);
    expect(notes.complete).toBe(false);
    expect(notes.leftover.join(' ')).toMatch(/enters/i);
  });

  /**
   * ⚠️ THE SILENCE HOOK'S TEETH (D158): the claim is PER LINE and only for a
   * def kind the engine consults. Wall of Omens is complete because a shipped
   * TRIGGER carries its exact trigger line — its keyword line was already
   * Tier-2's — and a card whose leftover is anything else stays refused however
   * many scripts ship.
   */
  test('a shipped script accepts exactly its claimed line, and the keyword line stays Tier-2’s', () => {
    expect(engineCompleteness(fx.WALL_OF_OMENS).leftover).toEqual([]);
    expect(tier3NotesFor(fx.WALL_OF_OMENS)).toEqual([]);
    // Same shape, no script shipped → still refused, still naming the line.
    const garrison = engineCompleteness(fx.BOROS_GARRISON);
    expect(garrison.complete).toBe(false);
  });

  /**
   * ⚠️ THE INVARIANT THAT TIES THIS TO THE EXISTING DISCLOSURE. A card the app
   * tells the player it handles completely is exactly a card the bot may hold,
   * so nothing this accepts may carry a Tier-3 note. One direction only — the
   * converse is false and the module's footer says why.
   */
  test('everything accepted carries no Tier-3 note', () => {
    const wrong: string[] = [];
    for (const card of fx.ENGINE_CARDS) {
      if (!isEngineComplete(card)) continue;
      for (let i = 0; i < card.faces.length; i++) {
        const notes = tier3NotesFor(card, i);
        if (notes.length > 0) wrong.push(`${card.name}: ${notes.map((n) => n.what).join(', ')}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * ⚠️ A multi-face card has to clear EVERY face. Delver's back face is a 3/2
   * flier — fine on its own — behind a front face whose upkeep trigger nothing
   * runs, so the card as a whole is out.
   */
  test('a back face the engine cannot run rejects the whole card', () => {
    const delver = fx.DELVER_OF_SECRETS_INSECTILE_ABERRATION;
    expect(faceCompleteness(delver, 1).complete).toBe(true);
    expect(faceCompleteness(delver, 0).complete).toBe(false);
    expect(isEngineComplete(delver)).toBe(false);
  });

  test('a face that does not exist is not complete', () => {
    expect(faceCompleteness(fx.GRIZZLY_BEARS, 7).complete).toBe(false);
  });

  /**
   * ⚠️ A canary on the SHAPE of the answer, not on the number. If a parser
   * change ever made the predicate accept everything or nothing, every list
   * above could still pass while the module had stopped discriminating.
   */
  test('the fixtures split, and neither side is empty', () => {
    const runs = fx.ENGINE_CARDS.filter(isEngineComplete).length;
    expect(runs).toBeGreaterThan(20);
    expect(runs).toBeLessThan(fx.ENGINE_CARDS.length - 20);
  });
});

/**
 * The M6.4a silence hook (D158): which printed lines the shipped scripts claim.
 *
 * ⚠️ These drive `lineClaims` directly with FAKE scripts because the map the
 * module actually consults is built from `SHIPPED_SCRIPTS`, and testing through
 * that would need a card shipped from inside a unit test. The end-to-end proof
 * is the two fixtures in COMPLETE above that a shipped script moved there, plus
 * `shippedScripts.node.test.ts` over the whole database.
 */
describe('lineClaims', () => {
  const oid = (s: string) => s as OracleId;
  const trigger = (text: string) => ({
    abilityId: 'x',
    text,
    event: 'CardsMoved' as const,
    activeZones: ['battlefield' as const],
    optional: false,
    matches: () => false,
    label: () => '',
    resolve: () => [],
  });

  test('a trigger def claims its exact printed line, scrubbed and trimmed', () => {
    const script: CardScript = {
      oracleId: oid('o1'),
      name: 'Fake',
      triggers: [trigger('When this creature enters, draw a card. (Reminder text.)')],
    };
    const claims = lineClaims([script]);
    // ⚠️ `scrub` blanks the reminder IN PLACE with spaces, so the trim only
    // removes the trailing run — the claim is the line as `linesUnaccounted`
    // will see it, or the two sides could never match.
    expect(claims.get('o1')?.sentences.has('When this creature enters, draw a card.')).toBe(true);
  });

  /**
   * ⚠️ THE KIND SEPARATION (D159): an `ActivatedDef`'s claim lives in the
   * `activated` half and can never silence a SENTENCE — and a trigger's claim
   * can never silence a `cost: effect` line. Each def kind may only account
   * for the line shape the engine actually consults it for.
   */
  test('an `activated` def claims into the activated half, never the sentence half', () => {
    const script: CardScript = {
      oracleId: oid('o2'),
      name: 'Fake Archive',
      activated: [
        {
          ref: 'o2#a0',
          text: '{3}, {T}: Draw a card.',
          resolve: () => [],
        },
      ],
    };
    const claims = lineClaims([script]).get('o2');
    expect(claims?.activated.has('{3}, {T}: Draw a card.')).toBe(true);
    expect(claims?.sentences.has('{3}, {T}: Draw a card.')).toBe(false);
  });

  test('claims are per ORACLE ID, and shared texts dedupe within one card', () => {
    const a: CardScript = {
      oracleId: oid('o3'),
      name: 'Warden',
      triggers: [
        trigger('Whenever another creature enters, you gain 1 life.'),
        trigger('Whenever another creature enters, you gain 1 life.'),
      ],
    };
    const b: CardScript = { oracleId: oid('o4'), name: 'Other', triggers: [trigger('Something else.')] };
    const claims = lineClaims([a, b]);
    expect(claims.get('o3')?.sentences.size).toBe(1);
    expect(claims.get('o4')?.sentences.has('Something else.')).toBe(true);
    expect(claims.get('o4')?.sentences.has('Whenever another creature enters, you gain 1 life.')).toBe(false);
  });
});
