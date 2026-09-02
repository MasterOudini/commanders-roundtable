// WHICH CARDS THE NEXT BATCH SHOULD SCRIPT — M6.4-LIBRARY-SPEC §7. See D157.
//
// ⚠️ **IT IS A `.node.test.ts` AND THAT IS FORCED, NOT CHOSEN.** Selection has to
// ask `engineCompleteness` and `primitivesFor` which cards are blocked on a
// script alone, and those are TypeScript. `scripts/` is CommonJS and cannot
// import them — the same wall D133 hit when the token table could not be built
// at ingest, and the answer is the same: run the TS through vitest rather than
// keep a second copy of it in CJS. `scripts/cardgen/select.cjs` is the wrapper.
//
// ⚠️ **THE ORDERING IS THE SPEC'S, AND ITS FIRST RUNG IS THE USER'S OWN DECKS.**
// §7: popularity data is an internet dependency and the offline policy applies —
// **stop and ask before fetching any.** So the proxy is what is already on disk:
//   1. cards in the user's saved decks (`~/.commanders-roundtable/decks/`),
//   2. cards in the fuzz `DECK` and the `ENGINE_CARDS` fixtures,
//   3. everything else that is blocked on a script alone,
// and within each rung, cheapest first — fewest unaccounted lines.
//
// ⚠️ It emits only cards whose sole need is `scriptable`. A card that also needs
// a PRIMITIVE cannot be scripted however easy its text looks, and offering one to
// a drafter is how a batch produces something that cannot pass verification.
//
// Run it:
//   node scripts/cardgen/select.cjs [count]

import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { describe, expect, test } from 'vitest';
import type { CardData } from './cardTypes';
import { engineCompleteness, unaccountedLines } from './engineComplete';
import { parseFace } from './oracleParse';
import { primitivesFor } from './primitives';
import { ENGINE_CARDS } from './fixtures/engineCards';

const DATA_DIR = process.env.CRT_DATA_DIR ?? join(homedir(), '.commanders-roundtable');
const NDJSON = join(DATA_DIR, 'cards', 'cards.ndjson');
const HAVE_DB = existsSync(NDJSON);
const EMIT = process.env.CRT_CARDGEN_OUT;
const WANT = Number(process.env.CRT_CARDGEN_COUNT ?? 200);

/** Card names in the user's saved decks — rung 1. */
function deckNames(): Set<string> {
  const out = new Set<string>();
  const dir = join(DATA_DIR, 'decks');
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    try {
      const deck = JSON.parse(readFileSync(join(dir, entry), 'utf8')) as {
        commanders?: { name?: string }[];
        main?: { name?: string }[];
      };
      for (const line of [...(deck.commanders ?? []), ...(deck.main ?? [])]) {
        if (line.name) out.add(line.name);
      }
    } catch {
      // A deck file we cannot read is not a reason to fail selection.
    }
  }
  return out;
}

/** Card names the fuzz gate and the fixtures already carry — rung 2. */
function poolNames(): Set<string> {
  const out = new Set<string>(ENGINE_CARDS.map((c) => c.name));
  const fuzz = join(process.cwd(), 'src', 'engine', 'fuzz.node.test.ts');
  if (existsSync(fuzz)) {
    // ⚠️ Read as TEXT rather than imported: importing a `.node.test.ts` from
    // another test file runs its describes. The names are string literals in a
    // `DECK` array and that is all this needs from them.
    const src = readFileSync(fuzz, 'utf8');
    const deck = /const DECK = \[([\s\S]*?)\n\];/.exec(src)?.[1] ?? '';
    for (const m of deck.matchAll(/'([^']+)'|"([^"]+)"/g)) out.add(m[1] ?? m[2] ?? '');
  }
  return out;
}

interface Candidate {
  readonly name: string;
  readonly oracleId: string;
  readonly rung: 1 | 2 | 3;
  /** Unaccounted lines — the cheapest-first tie-break within a rung. */
  readonly lines: number;
}

/**
 * ⚠️ THE THIRD SELECTION FILTER, AND UNLIKE THE TWO PARSE FILTERS IT IS A
 * NAMED LEDGER — each entry is a card a drafter HELD and refused for a
 * machinery gap the needs column has no row for. Twelve of batch 6's 25
 * slots were batch 5's refusals re-offered (D162's dozen, verbatim); half a
 * batch of re-classification per batch is the tax this table ends.
 *
 * ⚠️ SELF-CORRECTING BY CONSTRUCTION: `select()` records any entry whose card
 * has become COMPLETE, and a test fails naming it — so the day a class is
 * built and its cards land, the stale entries cannot survive the suite. The
 * class strings exist so that day is findable with grep.
 */
const REFUSED: ReadonlyMap<string, string> = new Map([
  // ⚠️ The 'sacrifice-cost chooser' class — FIFTEEN entries at its peak, the
  // ledger's largest — was BUILT in D168 (`ActivateAbility.sacrifice`) and its
  // entries deleted the same day, so those cards re-enter the offer stream.
  // A script cannot raise ANOTHER player's prompt from resolve (D160).
  ['Abyssal Horror', 'script-raised prompt'],
  // The "modified" predicate (D160).
  ['Akki Ember-Keeper', 'modified predicate'],
  // Random-discard cost — and `ctx.random` is still a stub (D161).
  ['Amok', 'random-discard cost'],
  // Tap-N-untapped-creatures costs (D161).
  ["Ancestor's Prophet", 'tap-creatures cost'],
  ['Aphetto Grifter', 'tap-creatures cost'],
  ['Azami, Lady of Scrolls', 'tap-creatures cost'],
  // Exile-from-library cost (D161).
  ['Arc-Slogger', 'exile-from-library cost'],
  // "For the first time each turn" needs per-turn trigger memory the engine
  // does not hold (D163).
  ['Axgard Artisan', 'once-per-turn trigger memory'],
  // `CombatDamageDealt` batches EVERY creature's damage into one event and
  // the bus fires per event, so a per-creature damage trigger under-fires on
  // multi-attacker turns (D163).
  ['Aya of Alexandria', 'per-damage-entry trigger granularity'],
  // Discard-a-card-as-cost chooser — the hand-side sibling of the sacrifice
  // chooser (D163).
  ["Ayula's Influence", 'discard-cost chooser'],
  // Batch 7 (D164).
  // Exile-N-cards-from-your-graveyard as a COST is a chooser over a public
  // zone nothing charges yet — the graveyard sibling of the sacrifice
  // chooser (D164).
  ['Bearscape', 'exile-from-graveyard cost'],
  // "…discards a card AT RANDOM" as an EFFECT — `ctx.random` is a stub at
  // every ScriptCtx site (D158), so no random card may ship until it is
  // wired to the seeded generator (D164).
  ['Black Cat', 'ctx.random stub'],
  // Batch 8 (D165).
  // Remove-a-+1/+1-counter-from-a-creature-you-control as a COST is a
  // chooser over counter state nothing charges yet (D165).
  ['Bolrac-Clan Crusher', 'remove-counter cost'],
  // Batch 9 (D166).
  // "Exile this artifact" as a cost — sacrificesSelf ONE EVENT OVER
  // (CardsMoved to exile instead of graveyard); named cheap, not built yet.
  ['Brittle Effigy', 'exile-self cost'],
  ['Cabal Surgeon', 'exile-from-graveyard cost'],
  ['Catapult Master', 'tap-creatures cost'],
  // Batch 10 (D167).
  ['Charging Strifeknight', 'discard-cost chooser'],
  // "Your second spell each turn" is Axgard's per-turn trigger memory one
  // count over (D167).
  ['Clarion Spirit', 'once-per-turn trigger memory'],
  // Tap-two-untapped-ARTIFACTS as a cost — the tap-creatures chooser's
  // artifact sibling (D167).
  ['Clock of Omens', 'tap-permanents cost'],
  // Batch 11 (D169).
  ['Coral Helm', 'random-discard cost'],
  // "target opponent discards a card" from a trigger's resolve is the
  // script-raised prompt class (D160) — the caster's script asking ANOTHER
  // player's hidden-zone question.
  ['Corrupt Court Official', 'script-raised prompt'],
  // Batch 12 (D170).
  // "Whenever a Dinosaur you control deals combat damage" — NOT self-only,
  // so `CombatDamageDealt`'s per-event batching under-fires it on
  // multi-Dinosaur turns (Aya's class, D163).
  ['Curious Altisaur', 'per-damage-entry trigger granularity'],
  // A dies-trigger raising the TARGET OPPONENT's discard prompt (D160's
  // class, Corrupt Court Official's dies-twin).
  ['Deadbridge Shaman', 'script-raised prompt'],
  // M6.4o (D171) — batch 13's five refusals, all existing classes.
  ['Deepwood Drummer', 'discard-cost chooser'],
  // "{4}{B}, Sacrifice this creature: Target player discards two cards" —
  // the resolve must raise the target's chooseFromZone, which a script
  // cannot do (D160's class).
  ['Dementia Bat', 'script-raised prompt'],
  ['Devout Chaplain', 'tap-creatures cost'],
  ['Devout Witness', 'discard-cost chooser'],
  ['Diversionary Tactics', 'tap-creatures cost'],
  // M6.4p (D172) — batch 14's seven refusals. Dragon Broodmother is a NEW
  // class: its token carries DEVOUR, an as-enters sacrifice choice on the
  // created permanent that nothing can raise. Dromad Purebred is the
  // RECEIVER side of Aya's class — two simultaneous sources are two damage
  // instances batched into one event, so per-event firing under-fires.
  ['Dragon Broodmother', 'token entry choice (devour)'],
  ['Dragonborn Champion', 'per-damage-entry trigger granularity'],
  ['Draugr Recruiter', 'once-per-turn trigger memory'],
  ['Dread Rider', 'exile-from-graveyard cost'],
  ['Dromad Purebred', 'per-damage-entry trigger granularity'],
  ['Dune Diviner', 'tap-permanents cost'],
  ['Dwarven Bloodboiler', 'tap-creatures cost'],
  // M6.4r (D174) — batch 16's two refusals. Ezio watches a CLASS of
  // creatures deal combat damage, so two simultaneous Assassins are two
  // instances batched into one event (Aya's class, dealer side widened).
  ['Ezio, Blade of Vengeance', 'per-damage-entry trigger granularity'],
  ['Fearless Liberator', 'once-per-turn trigger memory'],
  // M6.4s (D175) — batch 17's four refusals. Floodbringer and Flooded
  // Shoreline open a NEW class: "Return a land you control to its owner's
  // hand" as an ACTIVATION COST — the chooser one verb over from
  // sacrifice, with the bounce-cost machinery unbuilt.
  ['Firja, Judge of Valor', 'once-per-turn trigger memory'],
  ['Floodbringer', 'return-permanent cost'],
  ['Flooded Shoreline', 'return-permanent cost'],
  ['Fodder Tosser', 'discard-cost chooser'],
  // Batch 18 (D176) — all three existing classes.
  ['Ghirapur Aether Grid', 'tap-permanents cost'],
  ['Gilt-Leaf Seer', 'script-raised prompt'],
  ['Glare of Subdual', 'tap-creatures cost'],
  // Batch 19 (D177) — TWO NEW classes. Multi-sacrifice: D168's
  // `ActivateAbility.sacrifice` names ONE permanent, so "Sacrifice two
  // Goblins" has no carrier. Sacrifice-event discriminator: `EventCause`
  // has no sacrifice kind AND `matches` receives the event BODY, so a
  // "whenever you sacrifice" watcher would over-fire on every death.
  ['Goblin Picker', 'discard-cost chooser'],
  ['Goblin Warrens', 'multi-sacrifice cost'],
  ['Goldmaw Champion', 'once-per-turn trigger memory'],
  ['Graf Mole', 'sacrifice-event discriminator'],
  // Batch 20 (D178) — THREE new classes. Alternative cost: "{3}, {T} or
  // {R}, {T}:" has no carrier and a def would charge one reading of an
  // ambiguous price. Ability-word cost: the em-dash label sits inside the
  // cost string ("Stunning Strike — {1}{W}, {T}") — a parse-widening
  // candidate. Graveyard-activated: the ability itself lives in the
  // graveyard, and legal.ts offers battlefield abilities only.
  ['Granite Shard', 'alternative activation cost'],
  ['Great Arashin City', 'exile-from-graveyard cost'],
  ['Grim Lavamancer', 'exile-from-graveyard cost'],
  ['Hagi Mob', 'once-per-turn trigger memory'],
  ['Half-Elf Monk', 'ability-word activated cost'],
  ['Halimar Depths', 'script-raised prompt'],
  ['Halo Scarab', 'graveyard-activated ability'],
  // Batch 21 (D179): one existing class and THREE new ones. `Hardened
  // Tactician` pays with "a token" — predicatesOf models card types and
  // subtypes, and token-ness is neither (isToken lives on the INSTANCE), so
  // the D168 carrier cannot read the predicate. `Hatchet Bully` PUTS a -1/-1
  // counter on a chosen creature as a cost — a cost-chooser in the other
  // direction from Bolrac-Clan's remove-counter. `Horizon Chimera` watches
  // "whenever you draw" and there is no draw to watch: drawFromTop emits a
  // bare CardsMoved library→hand, indistinguishable from an Impulse-take or
  // a manual wrench move, and `matches` receives the event BODY — the
  // sacrifice-event discriminator (Graf Mole, D177) one event over.
  ['Hand of Justice', 'tap-creatures cost'],
  ['Hardened Tactician', 'token-predicate sacrifice cost'],
  ['Hatchet Bully', 'put-counter cost'],
  // (Horizon Chimera's draw-event-discriminator entry DRAINED here when
  // D189's `DrewCards` + D190's per-item fan-out shipped it — the
  // stale-refusal guard working as designed.)
  // Batch 22 (D180): three existing classes and TWO new ones. `Icebind
  // Pillar` pays {S} — the engine has NO snow-source concept anywhere in
  // payment or mana, so charging the {T} without the {S} would be
  // half-execution. `Illuminated Folio` pays by REVEALING two cards from
  // hand that share a colour — the discard-cost chooser's shape over a
  // hidden zone plus a constraint the prompt would have to validate.
  // `Infernal Tribute` is Hardened Tactician's NONTOKEN mirror.
  ['Icatian Crier', 'discard-cost chooser'],
  ['Icebind Pillar', 'snow activation cost'],
  ['Illuminated Folio', 'reveal-cost chooser'],
  ['Infernal Tribute', 'token-predicate sacrifice cost'],
  ['Inkfathom Divers', 'script-raised prompt'],
  // Batch 23 (D182): two existing classes and ONE new one. `Jandor's Ring`
  // pays by discarding "the last card you drew this turn" — the engine
  // tracks no per-turn draw identity at all (the draw-event discriminator's
  // sibling: there is not even a draw EVENT, let alone a memory of which
  // card came last).
  ['Insolent Neonate', 'discard-cost chooser'],
  ['Ion Storm', 'remove-counter cost'],
  ["Jandor's Ring", 'last-drawn-card memory cost'],
  // Batch 24 (D183): three existing classes and ONE new one. `Jolly
  // Gerbils` triggers "whenever you give a gift" — the engine has no gift
  // concept anywhere (a cast-time promise on gift-carrying spells; nothing
  // raises, records or fulfils one).
  ['Jolly Gerbils', 'gift mechanic'],
  ['Jori En, Ruin Diver', 'once-per-turn trigger memory'],
  ['Keeper of the Nine Gales', 'tap-creatures cost'],
  ['Keldon Arsonist', 'multi-sacrifice cost'],
  // Batch 25 (D184): five refusals, ZERO new classes — every one an
  // existing named gap, which is the ledger's drainage doing its job.
  ['Kessig Wolfrider', 'exile-from-graveyard cost'],
  ['Korozda Gorgon', 'remove-counter cost'],
  ['Krark-Clan Engineers', 'multi-sacrifice cost'],
  ['Kris Mage', 'discard-cost chooser'],
  ['Kyren Negotiations', 'tap-creatures cost'],
  // Batch 26 (D185): FOUR new classes. `Lullmage's Familiar` needs kicker
  // (a cast-time additional-cost choice nothing records); `Lurking
  // Chupacabra` needs explore; `Magmaw` sacrifices "a NONLAND permanent"
  // and predicatesOf has no type negation (the token-predicate's sibling);
  // and Lifeblood/Lifetap/Linden fail on GRANULARITY — per-item wording
  // (each Mountain that taps, each white attacker) against a batched event
  // a resolve cannot see into, which is Aya of Alexandria's D163 refusal on
  // taps and attack declarations.
  ["Lullmage's Familiar", 'kicker memory'],
  ['Lurking Chupacabra', 'explore mechanic'],
  ['Magmaw', 'negated-type sacrifice predicate'],
  ['Lifeblood', 'per-tap-entry trigger granularity'],
  ['Lifetap', 'per-tap-entry trigger granularity'],
  ['Linden, the Steadfast Queen', 'per-tap-entry trigger granularity'],
  ['Lyla, Holographic Assistant', 'draw-event discriminator'],
  ['Mad Prophet', 'discard-cost chooser'],
  ['Mad Ratter', 'draw-event discriminator'],
  ['Mage il-Vec', 'random-discard cost'],
  // Batch 27 (D186), five refusals and TWO new classes. Matoya names the
  // SCRY/SURVEIL EVENT DISCRIMINATOR: no event marks a scry — the peek is a
  // Tier-3 reveal and scry/surveil are UI MODES on it (D114), so "whenever
  // you scry or surveil" has nothing to watch. Merrow Grimeblotter names the
  // {Q} UNTAP-SYMBOL ACTIVATION COST: the source must be tapped and untaps
  // as the price, which no parse reads and no charge path pays. Meloku is
  // the return-permanent cost's third entry (D175's class).
  ['Masked Meower', 'discard-cost chooser'],
  ['Matoya, Archon Elder', 'scry-surveil event discriminator'],
  ['Meloku the Clouded Mirror', 'return-permanent cost'],
  ['Mental Discipline', 'discard-cost chooser'],
  ['Merrow Grimeblotter', 'untap-symbol activation cost'],
  // Wave 1 / M6.4ag (D192) — the first SpellDef batch's nine refusals.
  // Brainstorm, the scry cantrips, Electrodominance and Stinging Study all
  // need a resolve that can ASK (hand choice + ordering, scry decisions, a
  // free cast, a which-commander pick under partners); Chaos Warp's
  // shuffle needs the seeded rng (ctx.random, a stub since D158); Day of
  // Black Sun's 'loses all abilities until end of turn' needs the
  // temporary-grant carrier `untilEndOfTurn` does not have (D153 — it
  // holds P/T and nothing else), and destroying WITHOUT the ability loss
  // wrongly spares ability-indestructible creatures. ⚠️ Bedevil and Fall
  // of the Hammer are DRAFT-TIME pulls, tsc-green modules deleted on their
  // own failing tests: targetParse reads 'A or B' but not the OXFORD list
  // ('artifact, creature, or planeswalker' claimed as 'target artifact' —
  // a silent NARROWING), and reads Reckless Rage's repeated-verb second
  // clause but not a mid-sentence 'to another target creature' ('takes at
  // most one target'). Both are the D187 reportable — SpellDef targets
  // widening past the parser — now with two named cards waiting on it.
  ['Brainstorm', 'script-raised prompt'],
  ['Chaos Warp', 'ctx.random'],
  ['Read the Bones', 'script-raised prompt'],
  ['Electrodominance', 'script-raised prompt'],
  ['Day of Black Sun', 'temporary keyword/ability grant'],
  ['Stinging Study', 'script-raised prompt'],
  // ⚠️ Bedevil DRAINED in D199: the noun-list widening added its Oxford
  // compound to both parsers (Icy Manipulator's own idiom), so its whole
  // text is one admitted destroy — a vocabulary card, no script anywhere.
  // Aftershock and Atraxa's Fall stay: their lists were never the (only)
  // blocker.
  ['Fall of the Hammer', 'spell target parse (second clause)'],
  // Batch M6.4ak (D196) — eight refusals, THREE new classes. About Face
  // needs an until-end-of-turn power/toughness SWITCH, which the carrier
  // does not hold (it carries deltas and keywords — a switch is neither);
  // Abnormal Endurance GRANTS A QUOTED TRIGGERED ABILITY for the turn,
  // which is the temporary-grant class beyond keywords entirely; The Grey
  // Havens' second mana ability is CONDITIONAL PRODUCTION (any color among
  // legendary creatures in graveyards) — a mana ability cannot be an
  // ActivatedDef (CR 605: it does not use the stack), so the parse gap is
  // the card's real blocker. The rest are standing classes.
  ['Deadly Rollick', 'cast-time alternative cost'],
  ['About Face', 'until-end-of-turn power/toughness switch'],
  ['The Last Agni Kai', 'rule-changing (mana persistence)'],
  ['Act on Impulse', 'play-from-exile permission'],
  ["Animist's Awakening", 'ctx.random'],
  ['The Grey Havens', 'conditional mana production'],
  ['Towering Viewpoint', 'ability-word activated cost'],
  ['Abnormal Endurance', 'temporary non-keyword ability grant'],
  // Batch M6.4al (D197) — eight refusals, TWO new classes found by the
  // DRAFTS themselves. ⚠️ Aerial Predation's test proved 'with flying' is
  // SILENTLY UNENFORCED at the aim — the D139 shape for KEYWORD qualifiers
  // (the qualifier matches no noun entry, so it is recorded nowhere): its
  // tsc-green module was DELETED on its own failing negative, and the
  // keyword-qualifier widening is the named engine work. Allied Assault
  // names UP-TO-N targeting (the prompt machinery has no under-answer);
  // Aether Burst is its cast-time-computed sibling.
  ['Allure of the Unknown', 'opponent-chooses'],
  ['Aetherspouts', 'script-raised prompt'],
  ['Aftershock', 'spell target parse (noun list)'],
  ["Aminatou's Augury", 'play-from-exile permission'],
  ['Amass the Components', 'script-raised prompt'],
  ['Aether Burst', 'cast-time computed target count'],
  ['Allied Assault', 'up-to-N targeting'],
  ['Aerial Predation', 'keyword target qualifier unenforced'],
  // D198
  ['Animate Land', 'UEOT type change with P/T set'],
  ['Approach of the Second Sun', 'game-history memory'],
  ["Atraxa's Fall", 'spell target parse (noun list)'],
  ['Assert Perfection', 'up-to-N targeting'],
  ["Archaic's Agony", 'converge (cast-time mana-color memory)'],
  ['Arcane Omens', 'converge (cast-time mana-color memory)'],
  ["Ashnod's Intervention", 'temporary non-keyword ability grant'],
  ['Artificial Evolution', 'text-changing effect (CR 612)'],
  // D199 — Bar the Gate needs the DUNGEON subsystem (no venture concept
  // anywhere in the engine); Befoul's compound carries a NEGATED COLOR
  // ('nonblack creature') that TargetSpec has no field for — enforcing the
  // kinds while dropping the color would destroy a black creature the card
  // cannot touch; Betrayal at the Vault's 'each of two other target
  // creatures' parses to max 1 (a COUNTED list, probed) — a silent
  // narrowing; Biomantic Mastery's mid-sentence 'another target player' is
  // Fall of the Hammer's shape one kind over.
  ['Balloon Peddler', 'discard-cost chooser'],
  ['Band Together', 'up-to-N targeting'],
  ['Bar the Gate', 'dungeon/venture mechanic'],
  ['Befoul', 'negated-color target qualifier'],
  ['Bend or Break', 'opponent-chooses'],
  ['Benefaction of Rhonas', 'script-raised prompt'],
  ['Betrayal at the Vault', 'spell target parse (counted list)'],
  ['Biomantic Mastery', 'spell target parse (second clause)'],
  // D200 — Blazing Hope's threshold is COMPUTED at cast time ("power
  // greater than or equal to your life total"): probed, the qualifier is
  // silently DROPPED (spec 'target creature', unenforced []), so landing
  // it would exile a 1/1 at 40 life — D139's shape with a computed bound.
  // Birthday Escape needs the Ring (no tempted-by-the-Ring concept
  // anywhere); Bleeding Edge needs AMASS (counter + type change + a
  // conditional token in one word).
  ['Bionic Blow', 'up-to-N targeting'],
  ['Birthday Escape', 'the Ring mechanic'],
  ['Blatant Thievery', 'cast-time computed target count'],
  ['Blazing Hope', 'computed target threshold'],
  ['Bleeding Edge', 'amass mechanic'],
  ['Blood Feud', 'spell target parse (second clause)'],
  ['Blot Out', 'opponent-chooses'],
  // D201 — Bontu's wrath rider needs a skip-untap carrier the state does
  // not hold; Boon of Erebos REGENERATES (the engine has no regeneration —
  // the Damnation tripwire's subject, now a named refusal class); Bounce
  // Off's 'creature or Vehicle' is a subtype compound the spec cannot
  // enforce (Vehicle is not a card type); Brainsurge picks hand cards back
  // onto the library top (Brainstorm's prompt); Breaking Point offers every
  // player a choice.
  ["Bontu's Last Reckoning", 'untap restriction'],
  ['Boon of Erebos', 'regeneration'],
  ['Bounce Off', 'spell target parse (noun list)'],
  ['Bounty of Skemfar', 'script-raised prompt'],
  ['Brainsurge', 'script-raised prompt'],
  ['Brawl', 'temporary keyword/ability grant'],
  ['Breaking of the Fellowship', 'the Ring mechanic'],
  ['Breaking Point', 'script-raised prompt'],
  ['Brilliant Ultimatum', 'opponent-chooses'],
  ['Broken Dam', 'spell target parse (counted list)'],
  ['Broken Wings', 'keyword target qualifier unenforced'],
  ['Boneyard Parley', 'opponent-chooses'],
  // D202 — Cerebral Eruption RETURNS ITSELF to hand mid-resolution when a
  // land is revealed: resolveTop moves a resolved spell to the graveyard
  // unconditionally after the def, so a def cannot redirect the card's own
  // exit — a NEW structural class.
  ['Browbeat', 'script-raised prompt'],
  ['Bubbling Muck', 'temporary keyword/ability grant'],
  ["Builder's Bane", 'cast-time computed target count'],
  ['Burning of Xinye', 'script-raised prompt'],
  ['By Force', 'cast-time computed target count'],
  ['Cankerous Thirst', 'converge (cast-time mana-color memory)'],
  ['Catastrophe', 'modal choice'],
  ['Cerebral Eruption', 'spell relocates itself on resolution'],
  // D203 — Chaoslace SETS a color for the turn (no UEOT color carrier);
  // Chronostutter inserts SECOND FROM THE TOP (the move event knows only
  // top and bottom).
  ["Chandra's Revolution", 'untap restriction'],
  ['Chaoslace', 'UEOT color change'],
  ['Chaotic Transformation', 'up-to-N targeting'],
  ['Chelonian Tackle', 'up-to-N targeting'],
  ['Chronostutter', 'library position placement'],
  ['Claim the Precious', 'the Ring mechanic'],
  ['Clash of Titans', 'spell target parse (second clause)'],
  ['Clear a Path', 'keyword target qualifier unenforced'],
  // D204 — Coalition Victory WINS the game (no win event; a win is not
  // "every opponent loses" until the reasons enum says so); Contaminated
  // Drink pays in RAD counters (no rad concept anywhere); Contest of Claws
  // DISCOVERS (library iteration + a cast-or-hand choice).
  ['Coalition Victory', 'win-the-game effect'],
  ['Collected Conjuring', 'play-from-exile permission'],
  ['Collision of Realms', 'ctx.random'],
  ['Combo Attack', 'spell target parse (counted list)'],
  ["Commander's Insight", 'game-history memory'],
  ['Commando Raid', 'temporary keyword/ability grant'],
  ['Commune with Lava', 'play-from-exile permission'],
  ['Commune with the Gods', 'script-raised prompt'],
  ['Conduct Electricity', 'up-to-N targeting'],
  ['Consume Strength', 'spell target parse (second clause)'],
  ['Contaminated Drink', 'rad counters'],
  ['Contest of Claws', 'discover mechanic'],
  // D205 — Cosmic Hunger probed: 'another target creature, planeswalker,
  // or battle' is the second-clause shape (the family's SEVENTH card);
  // Cut Down probed: the SUM qualifier ('total power and toughness 5 or
  // less') parses confident with the bound silently DROPPED — landing it
  // would destroy a 10/10; Crash Landing needs the keyword LOSS direction
  // the carrier does not hold; Cracked Earth Technique animates a land
  // with counters and a delayed return.
  ['Cosmic Hunger', 'spell target parse (second clause)'],
  ['Counterintelligence', 'spell target parse (counted list)'],
  ['Counterlash', 'play-from-exile permission'],
  ['Counterpoint', 'play-from-exile permission'],
  ['Cracked Earth Technique', 'land animation (type change)'],
  ['Crash Landing', 'temporary keyword/ability grant'],
  ['Culling Ritual', 'script-raised prompt'],
  ['Curfew', 'opponent-chooses'],
  ['Cut Down', 'computed target threshold'],
  // D206 — Cyber Conversion turns the target FACE DOWN (the morph family's
  // hidden-identity machinery, spec 4.7); Dawnglow Infusion reads WHICH
  // mana was spent to cast it, a fact the cast records nowhere; Day's
  // Undoing ENDS THE TURN (CR 727 — the structural tail beside extra
  // turns); Deadshot's mid-sentence 'another target creature' is the
  // second-clause family's EIGHTH card; Deathlace is Chaoslace's family
  // without the UEOT bound — and it can aim at a SPELL's color, a second
  // gap.
  ['Cyber Conversion', 'face-down (morph family)'],
  ['Daring Demolition', 'spell target parse (noun list)'],
  ['Dawnglow Infusion', 'mana-spent memory'],
  ["Day's Undoing", 'end the turn'],
  ['Dead Reckoning', 'script-raised prompt'],
  ['Deadshot', 'spell target parse (second clause)'],
  ['Death or Glory', 'opponent-chooses'],
  ['Death Ward', 'regeneration'],
  ['Deathlace', 'color change (indefinite)'],
  // D207 — Deny the Witch counters ACTIVATED AND TRIGGERED ABILITIES on
  // the stack, a target kind and an un-cast the engine has no seam for;
  // Debt of Loyalty regenerates AND changes control off the regeneration;
  // Defensive Maneuvers takes a creature type of the caster's choice at
  // resolution; Decision Paralysis adds a skip-untap rider to its up-to-N.
  ['Debt of Loyalty', 'regeneration'],
  ['Decision Paralysis', 'up-to-N targeting'],
  ['Decompose', 'up-to-N targeting'],
  ['Defenestrate', 'keyword target qualifier unenforced'],
  ['Defensive Maneuvers', 'script-raised prompt'],
  ['Defiling Tears', 'temporary non-keyword ability grant'],
  ['Demonic Gifts', 'temporary non-keyword ability grant'],
  ['Deny the Witch', 'ability countering'],
  // D208 — Devout Decree's "that's black or red" is the POSITIVE color
  // qualifier (Befoul holds the negated direction) and it is silently
  // unenforced; Diminish SETS base P/T (untilEndOfTurn carries deltas and
  // keywords, never a base); Disrupt Decorum GOADS (no goad concept
  // anywhere); Detonate and Disembowel bound their target's mana value at
  // X — a cast-variable threshold the spec cannot carry.
  ['Detonate', 'computed target threshold'],
  ['Devout Decree', 'color target qualifier unenforced'],
  ['Diminish', 'until-end-of-turn base P/T set'],
  ['Diminishing Returns', 'opponent-chooses'],
  ['Disallow', 'ability countering'],
  ['Disembowel', 'computed target threshold'],
  ['Displace', 'up-to-N targeting'],
  ['Disrupt Decorum', 'goad mechanic'],
  ['Divine Gambit', 'opponent-chooses'],
  // D209 — the up-to-N family absorbs FIVE in one batch (its heaviest
  // showing); Drain Power forces the TARGET to activate mana abilities of
  // their own choosing; Dream Cache picks two hand cards back onto the
  // library (Brainstorm's prompt); Dryad's Caress is mana-spent memory's
  // second card.
  ['Do or Die', 'opponent-chooses'],
  ['Dominate', 'computed target threshold'],
  ["Donatello's Science Lesson", 'up-to-N targeting'],
  ['Dragonclaw Strike', 'up-to-N targeting'],
  ['Drain Power', 'opponent-chooses'],
  ['Dreadful as the Storm', 'the Ring mechanic'],
  ['Dream Cache', 'script-raised prompt'],
  ['Dream Harvest', 'play-from-exile permission'],
  ["Dryad's Caress", 'mana-spent memory'],
  ['Dwarven Song', 'UEOT color change'],
  // D210 — Eliminate the Impossible clears SUSPECTED (no suspect concept
  // anywhere); Empty City Ruse SKIPS combat phases (no skip-phase
  // concept); Elven Farsight's may-reveal rides AFTER the scry ask (Read
  // the Bones' shape); Enshrined Memories bottoms revealed cards in an
  // order the caster picks — orderCards raised from a resolve; End of the
  // Hunt's greatest-MV can TIE and the opponent breaks it.
  ['Dwell on the Past', 'up-to-N targeting'],
  ['Earth Rumble', 'land animation (type change)'],
  ['Eaten by Spiders', 'keyword target qualifier unenforced'],
  ['Eliminate the Impossible', 'suspect mechanic'],
  ['Elven Farsight', 'script-raised prompt'],
  ['Empty City Ruse', 'phase skipping'],
  ['End of the Hunt', 'opponent-chooses'],
  ['Endless Detour', 'opponent-chooses'],
  ['Enshrined Memories', 'script-raised prompt'],
  // D211 — Essence Filter's destroy-all OR destroy-nonwhite is a
  // resolution choice the modal regex missed; Exorcise's power qualifier
  // binds to the CREATURE arm only (a per-arm qualifier no spec can
  // carry); Ethereal Ambush MANIFESTS (the morph family's face-down
  // machinery); Ertai's Trickery reads whether the spell WAS KICKED.
  ['Ensnared by the Mara', 'opponent-chooses'],
  ['Entrancing Melody', 'computed target threshold'],
  ['Epic Experiment', 'play-from-exile permission'],
  ["Ertai's Trickery", 'kicker memory'],
  ['Essence Filter', 'script-raised prompt'],
  ['Ethereal Ambush', 'face-down (morph family)'],
  ['Eureka', 'opponent-chooses'],
  ['Exert Influence', 'converge (cast-time mana-color memory)'],
  ['Exhaustion', 'untap restriction'],
  ['Exhume', 'opponent-chooses'],
  ['Exorcise', 'spell target parse (noun list)'],
  ['Extinction', 'script-raised prompt'],
  // D212 — Eye Spy is a may-choice over the TARGET's library (the scry
  // machinery is single-library); Faerie Fencing reads the board AS YOU
  // CAST; False Cure floats an until-EOT triggered ability on the GAME;
  // Fate Transfer moves counters of kinds CounterKind cannot carry
  // (+1/+1 and -1/-1 are the whole vocabulary — the rest would drop
  // silently); Fancy Footwork PROBED: 'one or two target creatures'
  // parses confident to exactly-two — the range is silently narrowed, the
  // up-to family's parse hazard met in the wild.
  ['Eye Spy', 'script-raised prompt'],
  ['Fact or Fiction', 'opponent-chooses'],
  ['Faerie Fencing', 'game-history memory'],
  ['Fake Your Own Death', 'temporary non-keyword ability grant'],
  ['False Cure', 'temporary game-wide trigger'],
  ['False Peace', 'phase skipping'],
  ['Fancy Footwork', 'spell target parse (numeric disjunction)'],
  ['Fate Transfer', 'arbitrary counter kinds'],
  ['Fateful Handoff', 'script-raised prompt'],
  ['Fathom Trawl', 'script-raised prompt'],
  ['Fatigue', 'phase skipping'],
  // D213 — Feast of Succession makes the caster the MONARCH (no monarch
  // concept anywhere); Finishing Move hands out {TK} tickets and a
  // STICKER (no sticker concept either); Fire Prophecy may-puts a hand
  // card on the bottom (Brainstorm's prompt).
  ['Feast of Succession', 'monarch mechanic'],
  ['Feign Death', 'temporary non-keyword ability grant'],
  ['Finishing Move', 'sticker mechanic'],
  ['Fire Prophecy', 'script-raised prompt'],
  ['Firespout', 'mana-spent memory'],
  // D214 — Flashback grants a graveyard-cast permission (the same
  // permission family as play-from-exile); Flatline and Fractalize SET
  // base P/T; Forced Landing's 'with flying' is the silent keyword
  // qualifier; Fold into Aether and Fortune's Favor hand the choice to
  // the opponent.
  ['Flashback', 'play-from-exile permission'],
  ['Flatline', 'until-end-of-turn base P/T set'],
  ['Flowstone Channeler', 'discard-cost chooser'],
  ['Fold into Aether', 'opponent-chooses'],
  ['Foray of Orcs', 'amass mechanic'],
  ['Forced Landing', 'keyword target qualifier unenforced'],
  ["Fortune's Favor", 'opponent-chooses'],
  ['Fractalize', 'until-end-of-turn base P/T set'],
  // D215 — Full Flowering populates (CR 707 copy machinery, a NEW class);
  // Ghostly Flicker's 'two target artifacts, creatures, and/or lands you
  // control' parses confident to min2/max2 kinds ['artifact'] controller
  // 'any' — a DOUBLE silent narrowing (probed); Geosurge's mana is
  // spend-restricted (The Grey Havens' pool-metadata gap); Fumble's
  // reattach-to-another is the caster's pick.
  ['Frost Breath', 'up-to-N targeting'],
  ['Full Flowering', 'copy effect (populate)'],
  ['Fumble', 'script-raised prompt'],
  ["Galuf's Final Act", 'temporary non-keyword ability grant'],
  ['Geosurge', 'conditional mana production'],
  ['Ghostly Flicker', 'spell target parse (counted list)'],
  ['Gift of Tusks', 'until-end-of-turn base P/T set'],
  ['Glimpse of Nature', 'temporary game-wide trigger'],
  ['Glimpse the Sun God', 'cast-time computed target count'],
  // D216 — Glistening Dawn incubates (an Incubator DFC token carrying
  // counters, a NEW class); Goblin Game has players hide PHYSICAL items
  // (a NEW class, and the structural end of the list); Gravkill's
  // 'creature or Spacecraft' probes to a confident creature-only spec —
  // the subtype member silently dropped, and a SUBTYPE compound needs
  // TargetSpec machinery, not a compound row; Graven Lore scries by the
  // {S} spent (Firespout's mana-spent memory).
  ['Glistening Dawn', 'incubate mechanic'],
  ['Glorious Gale', 'the Ring mechanic'],
  ['Goblin Game', 'physical item choice'],
  ['Graven Lore', 'mana-spent memory'],
  ['Gravkill', 'spell target parse (noun list)'],
  ['Grisly Salvage', 'script-raised prompt'],
  // D217 — Hoarder's Greed CLASHES (reveal + each player's top/bottom
  // choice + compare + a repeat loop, a NEW class); 'one or two target
  // creatures' still parses confident exactly-2 (the D212 hazard, so
  // Hearts on Fire waits with Fancy Footwork); Heartwood Shard is
  // Granite Shard's cycle-mate; Heaven's Gate is Chaoslace's class with
  // the up-to hazard on top.
  ['Heal the Scars', 'regeneration'],
  ['Hearts on Fire', 'spell target parse (numeric disjunction)'],
  ['Heartwood Shard', 'alternative activation cost'],
  ['Heated Argument', 'script-raised prompt'],
  ["Heaven's Gate", 'UEOT color change'],
  ['Hellish Rebuke', 'temporary game-wide trigger'],
  ['Hex Magic', 'play-from-exile permission'],
  ['High Tide', 'temporary game-wide trigger'],
  ["Hoarder's Greed", 'clash mechanic'],
  // D218 — Honor's Reward BOLSTERS (the least-toughness tie is the
  // caster's pick — Defensive Maneuvers' precedent); Hour of
  // Devastation is the LOSE direction of the temp-grant carrier (Day of
  // Black Sun's class); Hypothesizzle's may-discard rider and the
  // bolster tie are the script-prompt seam's 13th and 14th entries.
  ["Honor's Reward", 'script-raised prompt'],
  ['Horses of the Bruinen', 'the Ring mechanic'],
  ['Hostile Takeover', 'until-end-of-turn base P/T set'],
  ['Hour of Devastation', 'temporary keyword/ability grant'],
  ['Humble', 'until-end-of-turn base P/T set'],
  ['Hurl into History', 'discover mechanic'],
  ['Hurl Through Hell', 'play-from-exile permission'],
  ['Hydroform', 'land animation'],
  ['Hypothesizzle', 'script-raised prompt'],
  // D219 — Illicit Auction runs a life-BIDDING loop for control of the
  // creature (a NEW class, and a genuinely multi-player prompt cycle);
  // Ill-Gotten Gains and Imposing Grandeur hand EVERY player a choice.
  ['Ill-Gotten Gains', 'script-raised prompt'],
  ['Illicit Auction', 'bidding mechanic'],
  ['Imposing Grandeur', 'script-raised prompt'],
  ['In the Presence of Ages', 'script-raised prompt'],
  ['Incite Hysteria', 'quoted-ability temporary grant'],
  // D220 — Ironhoof Boar CHANNELS (an activated cost paid from HAND, a
  // zone legal.ts never offers from — Halo Scarab's gap one zone over,
  // a NEW class); Isildur's Fateful Strike is a LEGENDARY INSTANT
  // (castable only behind a legendary body — a cast permission nothing
  // checks, NEW); Joint Assault reads soulbond pairing (no paired
  // state exists, NEW); Isolate PROBED — 'with mana value 1' parses
  // confident with the EXACT-value qualifier silently dropped (D139
  // built or-less/or-greater only), the numeric family's fourth hole.
  ['Interpret the Signs', 'script-raised prompt'],
  ['Invade the City', 'amass mechanic'],
  ['Ironhoof Boar', 'hand-activated ability'],
  ["Isildur's Fateful Strike", 'cast-permission condition'],
  ['Isolate', 'spell target parse (numeric exact)'],
  ['Isolation at Orthanc', 'library position placement'],
  ['Joint Assault', 'soulbond pairing'],
  // D221 — Kaervek's Purge and Killing Glare bind their numeric
  // qualifier to the CAST X (Blazing Hope's computed threshold); Lair
  // Delve's rest goes to the bottom IN ANY ORDER — a real ordering
  // choice (D141's rule), so it waits with the script prompts.
  ["Kaervek's Purge", 'computed target threshold'],
  ["Kami's Flare", 'modified predicate'],
  ["Kefnet's Last Word", 'untap restriction'],
  ['Killing Glare', 'computed target threshold'],
  ["Kruphix's Insight", 'script-raised prompt'],
  ['Lair Delve', 'script-raised prompt'],
  ['Larder Zombie', 'tap-creatures cost'],
  // D222 — Lava Storm's attacking-or-blocking arm is an un-templated
  // modal (Essence Filter's shape); Leeching Bite's mid-sentence
  // 'Another target' is D204's PROBED negative; Lost in Space hands
  // the top-or-bottom pick to the card's OWNER.
  ['Lash Out', 'clash mechanic'],
  ['Lava Storm', 'script-raised prompt'],
  ['Lay Down Arms', 'computed target threshold'],
  ['Leaf Arrow', 'keyword target qualifier unenforced'],
  ['Leeching Bite', 'spell target parse (second clause)'],
  ['Lethal Exploit', 'modified predicate'],
  ['Lifelace', 'color change (indefinite)'],
  ['Light of Judgment', 'up-to-N targeting'],
  ['Lost in Space', 'script-raised prompt'],
  // D223 — Lyev Decree DETAINS (an until-your-next-turn restriction
  // bundle, a NEW class); Malamet Brawler's 'target attacking creature'
  // is the D161 Angelic Page pull finally ledgered (combat qualifiers
  // are still unenforced at the aim, a NEW class); Make Your Move's
  // trailing 'power 4 or greater' binds to the CREATURE arm only — a
  // per-arm qualifier no spec can carry (Exorcise's shape).
  ['Lyev Decree', 'detain mechanic'],
  ["Mabel's Mettle", 'up-to-N targeting'],
  ['Madcap Experiment', 'ctx.random'],
  ["Mages' Contest", 'bidding mechanic'],
  ['Magical Hack', 'text-changing effect (CR 612)'],
  ['Make Your Move', 'spell target parse (noun list)'],
  ['Malamet Brawler', 'combat target qualifier unenforced'],
  ['Malicious Advice', 'cast-time computed target count'],
  ['Mana Vapors', 'untap restriction'],
  ['Manhole Missile', 'script-raised prompt'],
  // D224 — Meditate SKIPS A WHOLE TURN (Empty City Ruse's flag family);
  // Mental Misstep is D220's numeric-EXACT hole verbatim ('mana value 1');
  // Meteor Storm's activation cost discards at random (the RNG stub and the
  // discard-cost chooser in one printed line).
  ['Mass Manipulation', 'cast-time computed target count'],
  ['Meditate', 'phase skipping'],
  ['Memory Plunder', 'play-from-exile permission'],
  ['Mending Touch', 'regeneration'],
  ['Mental Misstep', 'spell target parse (numeric exact)'],
  ['Merciless Repurposing', 'incubate mechanic'],
  ['Merfolk Falconer', 'kicker memory'],
  ['Metamorphose', 'script-raised prompt'],
  ['Meteor Storm', 'ctx.random'],
  // D225 — Minamo's Meddling reads SPLICE memory (the kicker family's
  // cast-time rider); Mind Grind's printed 'X can't be 0' is a cast-time
  // restriction the engine cannot enforce — claiming the line unenforced
  // would be the D122 silent-coverage lie; Minds Aglow's Join forces is a
  // multiplayer payment prompt chain.
  ["Minamo's Meddling", 'kicker memory'],
  ['Mind Bend', 'text-changing effect (CR 612)'],
  ['Mind Bomb', 'script-raised prompt'],
  ['Mind Grind', 'cast-permission condition'],
  ['Minds Aglow', 'script-raised prompt'],
  ['Mines of Moria', 'exile-from-graveyard cost'],
  ['Mischievous Mystic', 'once-per-turn trigger memory'],
  ['Misinformation', 'up-to-N targeting'],
  ['Misleading Motes', 'script-raised prompt'],
  ['Misstep', 'untap restriction'],
  // D226 — Mnemonic Nexus SHUFFLES from a resolve (the RNG stub); Molder
  // is the numeric-EXACT family's third card ('with mana value X' is an
  // equality the parser silently drops); Most Valuable Slayer's 'target
  // attacking creature' is Malamet Brawler's class's second card.
  ['Mnemonic Nexus', 'ctx.random'],
  ['Molder', 'spell target parse (numeric exact)'],
  ['Molten Vortex', 'discard-cost chooser'],
  ['Moonlace', 'color change (indefinite)'],
  ['Moorland Haunt', 'exile-from-graveyard cost'],
  ['Morbius the Living Vampire', 'graveyard-activated ability'],
  ['Most Valuable Slayer', 'combat target qualifier unenforced'],
  // D227 — BOTH parse refusals are PROBED (d227\probe-out.json): Mystic
  // Denial's 'creature or sorcery spell' parses CONFIDENT to a
  // battlefield CREATURE (the typed-spell compound hole — the aim would
  // offer permanents for a counterspell), and Mutiny's 'another target
  // creature that player controls' is silently DROPPED; Muse Vortex also
  // bottoms in a random order (the RNG stub).
  ['Muse Vortex', 'play-from-exile permission'],
  ['Mutiny', 'spell target parse (second clause)'],
  ['Mystic Denial', 'spell target parse (noun list)'],
  ['Natural Affinity', 'land animation'],
  // D228 — Necromantic Selection EXILES ITSELF mid-resolution (Cerebral
  // Eruption's class) and reanimates with a type-change; Nissa's
  // Revelation puts a computed effect AFTER the scry ask (D195: an effect
  // after an ask is dropped — Read the Bones' shape); Nivix Barrier's
  // 'target attacking creature' is the combat-qualifier class's THIRD
  // card.
  ['Necromantic Selection', 'spell relocates itself on resolution'],
  ['Night Soil', 'exile-from-graveyard cost'],
  ['Nightcreep', 'UEOT color change'],
  ["Nissa's Revelation", 'script-raised prompt'],
  ['Nivix Barrier', 'combat target qualifier unenforced'],
  ['Nix', 'mana-spent memory'],
  // D229 — Nullify's 'creature or Aura spell' is Mystic Denial's PROBED
  // typed-spell compound hole verbatim; Ogre Shaman's cost discards at
  // random (the RNG stub, Meteor Storm's shape); Noxious Grasp's "that's
  // green or white" is Devout Decree's class.
  ['Not Dead After All', 'quoted-ability temporary grant'],
  ['Noxious Grasp', 'color target qualifier unenforced'],
  ['Nuclear Fallout', 'rad counters'],
  ['Nullify', 'spell target parse (noun list)'],
  ['Nullmage Shepherd', 'tap-creatures cost'],
  ["O'aka, Traveling Merchant", 'remove-counter cost'],
  ['Oboro Breezecaller', 'return-permanent cost'],
  ['Ogre Shaman', 'ctx.random'],
  ["Oketra's Last Mercy", 'untap restriction'],
  // D230 — Ominous Sphinx names the DISCARD-EVENT DISCRIMINATOR: a
  // discard is a bare hand-to-graveyard CardsMoved indistinguishable from
  // a Tier-3 move (Graf Mole's sacrifice shape and Horizon Chimera's old
  // draw shape, one verb over; the cycling half has nothing to watch at
  // all). Open the Vaults returns AURAS, whose enchant-target choice is a
  // prompt.
  ['Ominous Sphinx', 'discard-event discriminator'],
  ['Ondu War Cleric', 'tap-creatures cost'],
  ['Open the Vaults', 'script-raised prompt'],
  ['Order of Whiteclay', 'untap-symbol activation cost'],
  ["Oread of Mountain's Blaze", 'discard-cost chooser'],
  ['Organ Grinder', 'exile-from-graveyard cost'],
  // D231 — Oust puts the creature SECOND from the top (Chronostutter's
  // class: the move event knows top and bottom only); Over the Top's mass
  // battlefield put includes AURAS whose enchant choice is a prompt (Open
  // the Vaults' reasoning); Ovinize also strips abilities but the
  // base-P/T SET is the blocker.
  ['Oust', 'library position placement'],
  ['Over the Top', 'script-raised prompt'],
  ['Ovinize', 'until-end-of-turn base P/T set'],
  ["Pain's Reward", 'bidding mechanic'],
  ['Painful Truths', 'converge (cast-time mana-color memory)'],
  // D232 (M6.4bu)
  ['Part Water', 'cast-time computed target count'],
  ['Patrol Signaler', 'untap-symbol activation cost'],
  ['Peace of Mind', 'discard-cost chooser'],
  ['Pegasus Refuge', 'discard-cost chooser'],
  // D233 (M6.4bv)
  ['Pieces of the Puzzle', 'script-raised prompt'],
  ['Pierce the Sky', 'keyword target qualifier unenforced'],
  ['Pinion Feast', 'keyword target qualifier unenforced'],
  ['Piracy', 'tap-permission grant'],
  ['Pistus Strike', 'keyword target qualifier unenforced'],
  ['Pit Fight', 'spell target parse (second clause)'],
  ['Plague Witch', 'discard-cost chooser'],
  // D234 (M6.4bw)
  ['Plummet', 'keyword target qualifier unenforced'],
  ['Polymorph', 'ctx.random'],
  ["Polymorphist's Jest", 'until-end-of-turn base P/T set'],
  ['Portcullis Vine', 'keyword-predicate sacrifice cost'],
  ['Portent of Calamity', 'script-raised prompt'],
  ['Powerleech', 'activation-event discriminator'],
  ['Press the Enemy', 'script-raised prompt'],
  ['Presumed Dead', 'temporary non-keyword ability grant'],
  // D235 (M6.4bx)
  ['Primal Might', 'up-to-N targeting'],
  ['Primal Surge', 'script-raised prompt'],
  ['Prince Imrahil the Fair', 'once-per-turn trigger memory'],
  ['Prismatic Lace', 'color change (indefinite)'],
  ['Prying Questions', 'script-raised prompt'],
  // D236 (M6.4by)
  ['Psychic Trance', 'temporary non-keyword ability grant'],
  ['Pulse of the Fields', 'spell relocates itself on resolution'],
  ['Pulse of the Forge', 'spell relocates itself on resolution'],
  ['Purelace', 'color change (indefinite)'],
  ['Purge', 'spell target parse (noun list)'],
  ['Radiant Flames', 'converge (cast-time mana-color memory)'],
  ['Radiant Strike', 'spell target parse (noun list)'],
  // D237 (M6.4bz)
  ["Ranger's Firebrand", 'the Ring mechanic'],
  ["Rats' Feast", 'cast-time computed target count'],
  // D238 (M6.4ca)
  ['Ray of Ruin', 'spell target parse (noun list)'],
  ['Reach of Shadows', 'color target qualifier unenforced'],
  ['Reality Ripple', 'phasing'],
  ['Reality Shift', 'face-down (morph family)'],
  ['Reckless Impulse', 'play-from-exile permission'],
  ['Recross the Paths', 'clash mechanic'],
  ['Regenerate', 'regeneration'],
  ['Reign of Terror', 'script-raised prompt'],
  ['Reinterpret', 'script-raised prompt'],
  ['Reknit', 'regeneration'],
  ['Release the Ants', 'clash mechanic'],
  ['Relentless Advance', 'amass mechanic'],
  // D239 (M6.4cb)
  ['Relentless Pursuit', 'script-raised prompt'],
  ['Relic Crush', 'up-to-N targeting'],
  ["Relic's Roar", 'until-end-of-turn base P/T set'],
  ['Reminisce', 'ctx.random'],
  ['Repel Calamity', 'spell target parse (numeric disjunction)'],
  ['Research the Deep', 'clash mechanic'],
  ['Resolute Strike', 'script-raised prompt'],
  ['Restore', 'spell target parse (graveyard noun)'],
  ['Retraced Image', 'script-raised prompt'],
  // D240 (M6.4cc)
  ['Return to Dust', 'up-to-N targeting'],
  ['Return to the Earth', 'spell target parse (noun list)'],
  ['Revelsong Horn', 'tap-creatures cost'],
  ['Reviving Vapors', 'script-raised prompt'],
  ['Rewind', 'up-to-N targeting'],
  ['Ribbons of Night', 'mana-spent memory'],
  ['Ridged Kusite', 'discard-cost chooser'],
  ['Riding the Dilu Horse', 'indefinite continuous effect'],
  ['Rise from the Grave', 'indefinite continuous effect'],
  // D241 (M6.4cd)
  ['Rites of Reaping', 'spell target parse (second clause)'],
  ['Roast', 'keyword target qualifier unenforced'],
  ['Roiling Waters', 'up-to-N targeting'],
  ['Rolling Spoil', 'mana-spent memory'],
  ['Rookie Mistake', 'spell target parse (second clause)'],
  ['Roughshod Duo', 'expend mechanic'],
  // D242 (M6.4ce)
  ['Royal Herbalist', 'exile-from-library cost'],
  ['Rummaging Goblin', 'discard-cost chooser'],
  ["Sagittars' Volley", 'keyword target qualifier unenforced'],
  // D243 (M6.4cf)
  ['Sandsower', 'tap-creatures cost'],
  ['Sanguine Sacrament', 'spell relocates itself on resolution'],
  ['Sanity Gnawers', 'ctx.random'],
  ['Scarblade Elite', 'exile-from-graveyard cost'],
  // D244 (M6.4cg)
  ['Schismotivate', 'spell target parse (second clause)'],
  ['Scout the Borders', 'script-raised prompt'],
  ["Sea God's Revenge", 'plural-controller target qualifier unenforced'],
  ["Sea God's Scorn", 'spell target parse (noun list)'],
  ["Sea Kings' Blessing", 'UEOT color change'],
  ['Searing Blood', 'delayed trigger'],
  // D245 (M6.4ch)
  ['Secrets of the Dead', 'cast-zone discriminator'],
  ['Seismic Assault', 'discard-cost chooser'],
  ['Seismic Mage', 'discard-cost chooser'],
  ['Selective Snare', 'cast-time computed target count'],
  ['Selesnya Evangel', 'tap-creatures cost'],
  ['Selhoff Entomber', 'discard-cost chooser'],
  // D246 (M6.4ci)
  ['Serpentine Ambush', 'until-end-of-turn base P/T set'],
  ["Shade's Breath", 'temporary non-keyword ability grant'],
  ['Shattered Wings', 'spell target parse (noun list)'],
  ["Shinen of Flight's Wings", 'hand-activated ability'],
  ["Shinen of Fury's Fire", 'hand-activated ability'],
  ["Shinen of Stars' Light", 'hand-activated ability'],
  ['Shoot Down', 'spell target parse (noun list)'],
  // D247 (M6.4cj)
  ['Shoving Match', 'temporary non-keyword ability grant'],
  ['Show and Tell', 'script-raised prompt'],
  ['Shower of Arrows', 'spell target parse (noun list)'],
  ['Shredding Winds', 'keyword target qualifier unenforced'],
  ['Silkbind Faerie', 'untap-symbol activation cost'],
  ['Silverfur Partisan', 'becomes-targeted trigger'],
  ['Singe', 'UEOT color change'],
  // D248 (M6.4ck)
  ['Sinister Concoction', 'discard-cost chooser'],
  ['Skaab Wrangler', 'tap-creatures cost'],
  ['Sleep', 'untap restriction'],
  ['Sleight of Mind', 'text-changing effect (CR 612)'],
  ['Slimy Dualleech', 'spell target parse (numeric after controller)'],
  // D249 (M6.4cl)
  ['Slip On the Ring', 'the Ring mechanic'],
  ['Snap', 'up-to-N targeting'],
  ['Snare Tactician', 'cycling mechanic'],
  ['Soratami Mirror-Mage', 'return-permanent cost'],
  ['Soratami Rainshaper', 'return-permanent cost'],
  ['Soul Diviner', 'remove-counter cost'],
  ['Soul Sear', 'temporary keyword/ability grant'],
  ['Soul Shepherd', 'exile-from-graveyard cost'],
  // D250 (M6.4cm)
  ['Soul Summons', 'face-down (morph family)'],
  ['Spawnbinder Mage', 'ability-word activated cost'],
  ['Spell Blast', 'spell target parse (numeric exact)'],
  ['Spell Snare', 'spell target parse (numeric exact)'],
  ['Spellshift', 'script-raised prompt'],
  ['Sphinx of the Chimes', 'discard-cost chooser'],
  ["Sphinx's Decree", 'cast restriction effect'],
  ['Spin into Myth', 'fateseal mechanic'],
  // D251 (M6.4cn)
  ['Spin Out', 'spell target parse (noun list)'],
  ['Spinning Wheel Kick', 'cast-time computed target count'],
  ['Spirit en-Dal', 'ability-word activated cost'],
  ['Spoils of the Hunt', 'mana-spent memory'],
  ['Spring Cleaning', 'clash mechanic'],
  ['Spurred Wolverine', 'tap-creatures cost'],
  // D252 (M6.4co)
  ['Square Up', 'until-end-of-turn base P/T set'],
  ['Steal Strength', 'spell target parse (second clause)'],
  // D253 (M6.4cp) — Step Right Up opens an ATTRACTION DECK, a zone this
  // engine has no concept of; Steward of Solidarity's EXERT is an
  // activation cost carrying a delayed untap restriction, and neither
  // half exists. Stern Scolding was PROBED: 'creature spell with power
  // or toughness 2 or less' parses CONFIDENT with `numeric` NULL — the
  // bound is silently dropped, Repel Calamity's exact hole.
  ['Step Right Up', 'attraction mechanic'],
  ['Stern Constable', 'discard-cost chooser'],
  ['Stern Scolding', 'spell target parse (numeric disjunction)'],
  ['Steward of Solidarity', 'exert cost'],
  ['Stifle', 'ability countering'],
  ['Stolen Goods', 'play-from-exile permission'],
  ['Stonerise Spirit', 'exile-from-graveyard cost'],
  ['Stormbind', 'random-discard cost'],
  ['Stormchaser Drake', 'becomes-targeted trigger'],
  // D254 (M6.4cq) — Stream of Acid was PROBED: 'target land or nonblack
  // creature' HALVES to a confident bare 'target land', dropping the
  // negated-colour arm without a trace.
  //
  // ⚠️ Storyteller Pixie was DRAFTED, tested and PULLED. Its oracle is
  // exactly right (layout `adventure`, face 0 Creature, face 1 Sorcery)
  // and the cast of the Adventure half is ACCEPTED — but no `SpellCast`
  // event is ever logged for it, so a watcher has nothing to match on.
  // The class names what was measured, not a guess at the cause.
  ['Storyteller Pixie', 'adventure-half cast unobserved'],
  ['Strategic Betrayal', 'opponent-chooses'],
  ['Stream of Acid', 'spell target parse (noun list)'],
  ['Stream of Consciousness', 'up-to-N targeting'],
  ['Stronghold Biologist', 'discard-cost chooser'],
  ['Struggle for Sanity', 'opponent-chooses'],
  ['Sudden Setback', 'opponent-chooses'],
  ['Sudden Storm', 'up-to-N targeting'],
  // D255 (M6.4cr) — Suffer the Past was PROBED: 'X target cards' parses
  // confident:FALSE with min 0 / max 99, a computed target COUNT. Worth
  // noting that select.cjs's filter does NOT screen on `confident` (it
  // checks kinds and unenforced only), so the card was still offered.
  ['Suffer the Past', 'cast-time computed target count'],
  ['Summary Dismissal', 'ability countering'],
  ['Sundering Growth', 'copy effect (populate)'],
  ['Sunfall', 'incubate mechanic'],
  ['Supernatural Stamina', 'quoted-ability temporary grant'],
  ['Suppress', 'delayed trigger'],
  ['Survivor of Korlis', 'graveyard-activated ability'],
  ['Sway of the Stars', 'ctx.random stub'],

  // D256 (M6.4cs) — ⚠️ up-to-N takes THREE more here and is comfortably the
  // ledger's heaviest class. The counted-spec machinery (min/max, proven at
  // 2 in D255's Swelter and at 6 in D217's Hex) is already half of its
  // enforcement; what is missing is the CHOOSER that lets a player name
  // fewer targets than the maximum.
  ['Sylvan Paradise', 'UEOT color change'],
  // NEW: "your party" is a board census over up-to-one-each of Cleric,
  // Rogue, Warrior and Wizard. No party concept exists anywhere in the
  // engine, and approximating it would miscount the damage on every board.
  ['Synchronized Spellcraft', 'party mechanic'],
  ['Take into Custody', 'untap restriction'],
  ['Tandem Takedown', 'up-to-N targeting'],

  // D257 (M6.4ct) — ONE refusal in twenty-five, the leanest classification
  // of the arc. The TEMPLE CYCLE is why: nine lands of one printed shape cost
  // one script and refuse nothing.
  // 'During target player's next turn' is a DELAYED trigger (CR 603.7) with an
  // attack REQUIREMENT inside it — two unbuilt things in one sentence.
  ['Taunt', 'delayed trigger'],

  // D258 (M6.4cu) — ZERO new classes, and THREE of the five are up-to-N.
  // That class took three in D256 as well: it is now far and away the
  // ledger's heaviest, and its CHOOSER is the single most overdue piece of
  // named engine work in the arc. The counted-spec machinery is already half
  // of its enforcement, proven at 2 (D255) and at 6 (D217); what is missing
  // is letting a player name FEWER targets than the maximum.
  ['Temporary Truce', 'up-to-N targeting'],
  ['Tempted by the Oriq', 'up-to-N targeting'],
  ['The Black Breath', 'the Ring'],
  ['The Lost and the Damned', 'cast-zone discriminator'],

  // D259 (M6.4cv) — ONE new class, found by a PROBE rather than by a test.
  // 'target nonland permanent' parses CONFIDENT to kinds:['permanent'] with
  // unenforced:['nonland'] — the negated type is DISCLOSED rather than
  // dropped, but disclosed is exactly what D161 refuses: the aim would let a
  // LAND be untapped by a card that forbids it (Angelic Page, verbatim).
  // Befoul holds the negated-COLOUR direction (D199) and Devout Decree the
  // positive colour one (D208); nobody had probed a negated TYPE.
  ['Thistledown Players', 'negated-type target qualifier'],
  ['The Ring Goes South', 'the Ring'],
  ['The Shire', 'tap-creatures cost'],
  ['Thopter Foundry', 'token-predicate sacrifice cost'],
  ['Thoughtlace', 'indefinite color change'],
  ['Thraben Standard Bearer', 'discard-cost chooser'],

  // D260 (M6.4cw) — the most refusal-heavy batch since D238, and the reason
  // is the letter rather than the pipeline: the "Time" cards are almost all
  // STRUCTURAL (extra turns, ending the turn, phasing) and three of them are
  // wheels that SHUFFLE.
  //
  // ⚠️ The three wheels are refused for ONE measured reason. Time Reversal,
  // Time Spiral and Timetwister each say "shuffles their hand and graveyard
  // into their library", and `LibraryShuffled` SETS the zone rather than
  // permuting it (D115) — so a script must SUPPLY a permutation, which needs
  // `ctx.random`, still a stub at all three ScriptCtx sites (D158). The
  // wheels this arc HAS landed (Dark Deal D206, Peer Past the Veil D232,
  // Heartwarming Redemption D217) all discard and draw without a shuffle,
  // which is exactly why they were landable and these are not.
  // ⚠️ Timetwister is the honest one: its parenthetical puts it in its
  // owner's graveyard, which IS `resolveTop`'s normal exit — so it is refused
  // for the SHUFFLE alone, not for D202's self-relocation.
  //
  // ⚠️ Tidal Surge is refused TWICE over — "up to three target creatures"
  // AND "without flying" (D197's keyword qualifier). It is ledgered under
  // up-to-N, which is still the heaviest class in this table.
  ['Tidal Surge', 'keyword target qualifier unenforced'],
  ['Time and Tide', 'phasing'],
  ['Time Reversal', 'ctx.random stub'],
  ['Time Spiral', 'ctx.random stub'],
  ['Time Stop', 'end the turn'],
  // NEW: no turn-insertion machinery exists anywhere — `turn.ts` walks one
  // turn at a time and nothing can splice another in after it.
  ['Time Stretch', 'extra turns'],
  ['Time Wipe', 'script-raised prompt'],
  ['Timetwister', 'ctx.random stub'],
  ["Titan's Revenge", 'clash mechanic'],
  ['Together as One', 'converge'],

  // D261 (M6.4cx) — ONE new class, and it is the same missing piece seen from
  // two sides.
  //
  // ⚠️ `Too Greedily, Too Deep` reanimates a creature and then has it deal
  // damage EQUAL TO ITS POWER. That power is the DERIVED power of a card that
  // is not on the battlefield yet when the resolve runs: `ScriptCtx` is
  // `{state, oracle, derive, options, ids, query, random}` and exposes NO
  // reducer, so **a resolve cannot see its own effects.** Deriving the card in
  // the graveyard gives base P/T and misses any anthem, which is silently
  // wrong exactly when another card is on the board — D255's failure mode with
  // better manners. NEW class 'post-entry computed value'.
  // ⚠️ `Track Down` wants the same door from the prompt side: 'Scry 3, then
  // reveal the top card — if it is a creature or land, draw' needs a rider
  // evaluated AFTER the answer, and `thenDraw` is a fixed number. D195's
  // handler folds a SCRATCH state for its own rider; a script has no such
  // door. Ledgered under script-raised prompt, but it is the same engine item.
  //
  // ⚠️ Two refusals were settled by a PROBE rather than by a test. Topple's
  // 'creature with the greatest power among creatures on the battlefield'
  // comes back one confident spec with `unenforced: []` — the qualifier is
  // SILENTLY DROPPED, which is the worse of the two directions and D200's
  // Blazing Hope shape. And Touch of Darkness's 'One or more target creatures'
  // parses min 1 / max 1, so the spell would take exactly one target where the
  // card allows many — a second measured reason beside the colour change.
  ['Toils of Night and Day', 'script-raised prompt'],
  ['Tolarian Sentinel', 'discard-cost chooser'],
  ['Too Greedily, Too Deep', 'post-entry computed value'],
  ['Topple', 'computed target threshold'],
  ['Tortured Existence', 'discard-cost chooser'],
  ['Touch of Darkness', 'until-end-of-turn color change'],
  ['Track Down', 'script-raised prompt'],
  ['Tradewind Rider', 'tap-creatures cost'],
  ['Transmogrify', 'ctx.random stub'],

  // D262 (M6.4cy) — ZERO new classes, and the probe's best finding is a
  // CORRECTION to the heaviest class in this table.
  //
  // ⚠️⚠️ **UP-TO-N IS NOT UNIFORMLY BROKEN.** `Trickster's Stratagem`'s "up to
  // one target creature you control" parses **min 0 / max 1 with the
  // controller ENFORCED** — correctly, in full. But `Trick Shot`'s "up to one
  // other target creature token" comes back **min 1 / max 1** with the
  // token-ness gone: it would REQUIRE a second target and accept a nontoken.
  // So this class is a set of PARSE FAILURES rather than one missing feature —
  // D212's Fancy Footwork read "one or two" as exactly-two, D261's Touch of
  // Darkness read "one or more" as exactly-one, and this reads "up to one"
  // right. **Probe each wording; do not assume the class.** The chooser is
  // still owed for the forms that DO parse.
  //
  // ⚠️ The qualifier-drop tally is now three batches deep, and the two
  // directions are not equally safe: D259's Thistledown Players DISCLOSED its
  // negated type (`unenforced: [...]`, which D161's filter can refuse), while
  // D261's Topple and this batch's Trip Wire drop theirs SILENTLY. Only a
  // probe sees the silent kind.
  // ⚠️ Trip Wire could not have been proven positively in any case: measured,
  // NO fixture creature has horsemanship — only two shipped spells mention it.
  ['Transmutation', 'until-end-of-turn power/toughness switch'],
  ['Tribal Unity', 'script-raised prompt'],
  ['Trick Shot', 'up-to-N targeting'],
  ["Trickster's Stratagem", 'library position placement'],
  ['Trip Wire', 'keyword target qualifier'],
  ["Trostani's Judgment", 'copy effect (populate)'],
  ['Truce', 'script-raised prompt'],
  ['Tundra Fumarole', 'mana-spent memory'],

  // D263 (M6.4cz) — FOUR refusals, the leanest since D257's one, and ZERO new
  // classes. The U- page is almost all shapes the arc has already built.
  //
  // ⚠️ Twiddle is refused for its CHOICE alone. Its aim PROBED clean: the
  // TRIPLE compound 'target artifact, creature, or land' comes back one
  // confident spec with all three kinds ENFORCED — the Icy noun-list idiom
  // (D199/D214) holding at three members. Worth keeping beside D216's
  // subtype-member compound, which HALVES: a list of card TYPES reads, a list
  // naming a SUBTYPE does not. What refuses Twiddle is 'You MAY tap or
  // untap' — a per-target choice, D261's Toils of Night and Day exactly.
  ['Turn to Frog', 'until-end-of-turn type change with P/T set'],
  ['Twiddle', 'script-raised prompt'],
  ["Tymora's Invoker", 'ability-word activated cost'],
  ['Ultima', 'end the turn'],

  // D264 (M6.4da) — TWO new classes, one of them a THIRD compound shape.
  //
  // ⚠️⚠️ `Unsubstantiate`'s "target spell or creature" comes back
  // `kinds: ['spell']` with `unenforced: []` — the CREATURE arm is SILENTLY
  // DROPPED. That completes a three-case picture, and only one case reads:
  //   · a list of card TYPES           → READS  (D263 Twiddle, three members)
  //   · a list naming a SUBTYPE        → HALVES (D216 Gravkill)
  //   · a MIXED stack + permanent list → HALVES (this)
  // The third is its own shape and is a PARSER gap rather than a missing
  // field: `TargetSpec.kinds` can already hold 'spell' AND 'creature'. The
  // subtype case cannot be fixed that cheaply — it needs a new field first.
  //
  // ⚠️ Undying Evil and Undying Malice are the SAME gap wearing two faces.
  // Malice grants a QUOTED triggered ability (D196's Abnormal Endurance);
  // Evil grants the KEYWORD `undying`, which is shorthand for that same
  // ability. MEASURED: `undying` is in neither the Tier-2 Keyword union nor
  // D194's GRANTABLE map (twenty keywords, all combat or targeting
  // properties). One missing carrier, not two — so one class name.
  ['Undertaker', 'discard-cost chooser'],
  ['Undying Evil', 'quoted-ability temporary grant'],
  ['Undying Malice', 'quoted-ability temporary grant'],
  ['Unleash the Inferno', 'delayed trigger'],
  ['Unlucky Drop', 'script-raised prompt'],
  ['Unravel', 'mana-spent memory'],
  ['Unstable Experiment', 'connive mechanic'],
  ['Unsubstantiate', 'mixed stack/permanent noun list'],
  ['Unwanted Remake', 'face-down (morph)'],

  // D265 (M6.4db) — ZERO new classes, and one refusal is the THIRD witness
  // for the aim layer's most dangerous shape.
  //
  // ⚠️ `Vertigo`'s "target creature with flying" comes back
  // `kinds: ['creature']` with `unenforced: []` — the keyword qualifier is
  // SILENTLY DROPPED, exactly as in D261's Topple and D262's Trip Wire.
  // THREE witnesses in five batches makes this the best-evidenced single gap
  // in the aim layer: a disclosed qualifier (D259's Thistledown) can be
  // refused by D161's filter on its own, but a dropped one is invisible to
  // everything except a probe. ⚠️ Vertigo is refused twice over anyway — it
  // also REMOVES a keyword until end of turn, and D194's carrier has no lose
  // direction.
  ["Urza's Ruinous Blast", 'cast-permission condition'],
  ['Usher of the Fallen', 'once-per-turn memory'],
  ['Vanguard Seraph', 'once-per-turn memory'],
  ['Vault Robber', 'exile-from-graveyard cost'],
  ['Vega, the Watcher', 'cast-zone discriminator'],
  ['Vertigo', 'keyword target qualifier'],
  ['Vex', 'script-raised prompt'],

  // D266 (M6.4dc) — ZERO new classes, and the leanest batch of the arc:
  // 24 of 25 landed. The one refusal is a cost verb, not a rules hole.
  //
  // ⚠️ `Voice of the Woods` pays "Tap five untapped Elves you control" —
  // D168’s chooser has no tap-creatures verb, and it is a COUNTED,
  // subtype-restricted tap at that. Nothing else about the card is hard: the
  // 7/7 trample Elemental is an ordinary token line waiting on the cost.
  ['Voice of the Woods', 'tap-creatures cost'],

  // D267 (M6.4dd) — ZERO new classes, and ZERO probes owed: every shape in
  // the batch already had a shipped precedent, which is what a mature aim
  // layer looks like on a page of ordinary cards.
  //
  // ⚠️ LEDGER HYGIENE, noticed here and worth paying the next time this file
  // is opened for its own sake: `ctx.random` and `ctx.random stub` are ONE
  // gap under TWO names. Mnemonic Nexus and Reminisce sit under the first,
  // Sway of the Stars and Timetwister under the second, and all four wait on
  // the same unwired RNG. Warp World below joins the larger name.
  ['Voidslime', 'ability countering'],
  ['Volcanic Spite', 'script-raised prompt'],
  ['Waltz of Rage', 'play-from-exile permission'],
  ['Wanderbrine Trapper', 'tap-creatures cost'],
  ['Warp World', 'ctx.random'],

  // D268 (M6.4de) — ZERO new classes.
  //
  // ⚠️ The probe that came with this batch is worth reading beside D265:
  // `Whalebone Glider`'s "target creature with power 3 or less" comes back
  // with a STRUCTURED `numeric: {attr:"power", cmp:"atMost", value:3}` and
  // `unenforced: []` — DISCLOSED AND ENFORCED — while a KEYWORD qualifier is
  // silently dropped (D261 Topple, D262 Trip Wire, D265 Vertigo). The aim
  // layer is NOT uniformly weak on qualifiers; it is weak on exactly one
  // kind, and that narrows the repair considerably.
  //
  // ⚠️ And `Waterwhirl` measured "up to TWO target creatures" at min 0 /
  // max 2, so up-to-N parses in the PLURAL as well as the singular (D266).
  // Most of this ledger class is plural; the chooser is owed only for the
  // forms that genuinely fail to parse.
  ["Warriors' Lesson", 'quoted-ability temporary grant'],
  ['Wash Out', 'script-raised prompt'],
  ['Waterfront Bouncer', 'discard-cost chooser'],
  ['Wavebreak Hippocamp', 'once-per-turn trigger memory'],
  ['Weed Strangle', 'clash mechanic'],
  ['West Coast Expansion', 'script-raised prompt'],

  // D269 (M6.4df) — ZERO new classes, and the batch where the
  // keyword-qualifier gap finally has a PRICE.
  //
  // ⚠️⚠️ `Wing Snare` is a four-word destroy and `Wing Puncture` is a fight
  // with a filter. Both are refused for one reason: "target creature WITH
  // FLYING" comes back from the aim layer as a bare `text: "target
  // creature"` with `unenforced: []` — the qualifier gone, nothing recorded.
  // That is five distinct cards across five batches now (D261 Topple, D262
  // Trip Wire, D265 Vertigo, and these two).
  //
  // ⚠️ And the CONTRAST was measured in the same probe run: "with power 3 or
  // less" returns a STRUCTURED `numeric:{attr,cmp,value}`. The aim layer is
  // NOT weak on qualifiers generally — it is weak on the KEYWORD ones, and
  // either ENFORCING or merely DISCLOSING them would land both these cards
  // (D161s filter can refuse a disclosed qualifier on its own).
  //
  // ⚠️ Batch-mates `Whirlwind` and `Windstorm` read the SAME keyword
  // RESOLVE-side and land fine. Same word, two fates, and the difference is
  // only whether it sits in a target noun.
  ['Whisper, Blood Liturgist', 'multi-sacrifice cost'],
  ['Widespread Brutality', 'amass mechanic'],
  ['Wild Magic Surge', 'ctx.random'],
  ['Winds of Change', 'ctx.random'],
  ['Wing Puncture', 'keyword target qualifier'],
  ['Wing Snare', 'keyword target qualifier'],
  ['Winter Blast', 'cast-time computed target count'],

  // D270 (M6.4dg) — TWO NEW CLASSES, the first since D265, and a finding
  // about the LARGEST class that changes how it should be read.
  //
  // ⚠️ `script-raised prompt` (75 entries) SPLITS IN TWO once you read the
  // engine instead of the class name. `chooseFromZone` IS raisable straight
  // from a spell resolve — Laquatus’s Creativity (D221), Mind Burst, Rakdos’s
  // Return, Ravenous Rats and Rottenheart Ghoul all do it — so "discard N" /
  // "choose N from a zone" cards LAND TODAY (Wistful Thinking, this batch).
  // `chooseColor` EXISTS as an Awaiting kind with its own AnswerChooseColor
  // intent, but is raised ONLY by the engine’s ETB path, gated on a face’s
  // `choosesColorOnEntry` (triggers.ts ~1041): a RESOLVE cannot reach it. So
  // a colour or TYPE choice stays refused (Witch’s Vengeance below), and
  // D268’s Wash Out was refused CORRECTLY — checked, because the existence
  // of chooseColor made it look like a miss. The class is therefore "asks
  // that exist but only the engine may raise" PLUS "asks that do not exist",
  // and the first half is one door, not a prompt system. Re-read the 75
  // entries against that split before estimating the work.
  //
  // ⚠️ Worldsoul’s Rage is refused for a DIFFERENT reason than the class
  // name suggests: chooseFromZone takes ONE zone, and the card chooses from
  // hand AND graveyard at once.
  //
  // ⚠️ `day/night tracking`: nothing in state.ts tracks it. `control-a-player`:
  // decision ownership for a whole turn is a feature, not a script. Both are
  // honest first entries.
  ["Witch's Vengeance", 'script-raised prompt'],
  ['Wolf Strike', 'day/night tracking'],
  ['Word of Binding', 'cast-time computed target count'],
  ["Worldsoul's Rage", 'script-raised prompt'],
  ['Worst Fears', 'control-a-player'],
  ['Wrap in Vigor', 'regeneration'],
  ["Wrenn's Resolve", 'play-from-exile permission'],

  // D271 (M6.4dh) — the END of the alphabet (W/Y/Z), ONE new class.
  //
  // ⚠️ `mutate mechanic`: nothing in the engine stacks a mutating creature
  // or fires "whenever this creature mutates". An honest first entry.
  //
  // ⚠️ Zero Point Ballad is refused for the CHOICE, not the wipe: "return a
  // creature card put into a graveyard THIS WAY" picks among a subset the
  // resolve itself just created — a resolve cannot see its own effects, and
  // chooseFromZone has no way to say "only the ones I just binned".
  ["Yawgmoth's Vile Offering", 'cast-permission condition'],
  ['Zagoth Mamba', 'mutate mechanic'],
  ['Zenith Seeker', 'discard-event discriminator'],
  ['Zero Point Ballad', 'script-raised prompt'],
  ['Zombie Infestation', 'discard-cost chooser'],
  ["Zoyowa's Justice", 'discover mechanic'],
  ['Zulaport Chainmage', 'tap-creatures cost'],

  // D272 (M6.4di) — the alphabet WRAPS to A; TWO new classes.
  //
  // ⚠️ `suspend mechanic`: tier3.ts lists Suspend as UNENFORCED — no time
  // counters, no upkeep removal, no free cast. Ancestral Vision has no mana
  // cost at all, so without suspend the bot could never cast it.
  // ⚠️ `UEOT type change`: Argent Mutation adds a TYPE until end of turn;
  // untilEndOfTurn carries P/T and keywords only. The colour sibling is
  // `UEOT color change` (Aphotic Wisps, below).
  // ⚠️ Absorb Vis is refused for Basic landcycling, not its spell — the
  // engine has no cycling at all (Snare Tactician's class).
  // ⚠️ Aven Fateshaper wants an ORDERING prompt (look at four, put them
  // back in any order): scryChoice would let the player BOTTOM them, which
  // the card does not — the 'does not exist at all' half of the class (D270).
  // ⚠️ Arrester's Admonition LANDS: Addendum needs no cast-time memory — a
  // phase cannot end while the stack is non-empty (CR 500.2), so the resolve
  // simply reads the phase it is in.
  ['Abeyance', 'cast restriction effect'],
  ['Abolish', 'cast-time alternative cost'],
  ['Absorb Vis', 'cycling mechanic'],
  ['Ancestral Vision', 'suspend mechanic'],
  ['Apex of Power', 'play-from-exile permission'],
  ['Aphotic Wisps', 'UEOT color change'],
  ['Argent Mutation', 'UEOT type change'],
  ['Arwen Undómiel', 'scry-surveil event discriminator'],
  ['Aven Fateshaper', 'script-raised prompt'],
  ["Baral's Expertise", 'up-to-N targeting'],
  ["Benefactor's Draught", 'delayed trigger'],
  ['Blazing Crescendo', 'play-from-exile permission'],
  ['Blazing Shoal', 'cast-time alternative cost'],

  // D273 (M6.4dj) — the B/C residue; FOUR new classes, all keywords the
  // engine does not enforce yet select.cjs still offers: miracle, transmute
  // (two cards), harmonize, recover. Each blocks a card whose OTHER lines
  // would land today (D90: never half-execute).
  //
  // ⚠️ Clear the Mind shuffles a graveyard into a library — a SHUFFLE is
  // randomness, and the spell seam does not thread rngAfter (api.ts): the
  // ctx.random class, not a prompt.
  // ⚠️ Chivalric Alliance: "whenever you attack with two or more creatures"
  // WOULD land (AttackersDeclared batches its attackers, a count is a match
  // question) — its discard-cost line is what refuses it.
  ['Blooming Blast', 'gift mechanic'],
  ['Bonfire of the Damned', 'miracle mechanic'],
  ['Brainspoil', 'transmute mechanic'],
  ['Bramble Wurm', 'graveyard-activated ability'],
  ['Cabal Patriarch', 'exile-from-graveyard cost'],
  ['Cat Collector', 'once-per-turn trigger memory'],
  ['Cave-In', 'cast-time alternative cost'],
  ['Cerulean Wisps', 'UEOT color change'],
  ['Channeled Dragonfire', 'harmonize mechanic'],
  ['Chivalric Alliance', 'discard-cost chooser'],
  ['Clear the Mind', 'ctx.random'],
  ['Clutch of the Undercity', 'transmute mechanic'],
  ['Colossal Skyturtle', 'hand-activated ability'],
  ['Compulsion', 'discard-cost chooser'],
  ['Controvert', 'recover mechanic'],
  ["Council's Deliberation", 'scry-surveil event discriminator'],
  ['Crackleburr', 'tap-creatures cost'],

  // D274 (M6.4dk) — the C/D/E residue; THREE new classes. Freerunning and
  // Mayhem are alternative/graveyard casts the engine does not enforce;
  // Death Spark reads the ORDER of a graveyard ("a creature card directly
  // above it"), which no zone in state.ts tracks as a stack of cards.
  //
  // ⚠️ Crystal Spray is a text-changing effect (CR 612); Crippling Chill is
  // the untap restriction; Dash Hopes is opponent-chooses on a CAST trigger.
  ['Crashing Footfalls', 'suspend mechanic'],
  ['Crippling Chill', 'untap restriction'],
  ['Crookclaw Elder', 'tap-creatures cost'],
  ['Crystal Spray', 'text-changing effect (CR 612)'],
  ['Dark Dabbling', 'regeneration'],
  ['Dash Hopes', 'opponent-chooses'],
  ['Death Spark', 'graveyard-order condition'],
  ['Deceive the Messenger', 'amass mechanic'],
  ['Devastation Tide', 'miracle mechanic'],
  ['Disrupting Shoal', 'cast-time alternative cost'],
  ['Distract the Guards', 'freerunning mechanic'],
  ['Divine Congregation', 'suspend mechanic'],
  ['Dizzy Spell', 'transmute mechanic'],
  ['Eagle Vision', 'freerunning mechanic'],
  ['Earthbrawn', 'hand-activated ability'],
  ["Electro's Bolt", 'mayhem mechanic'],
  ['Elemental Masterpiece', 'hand-activated ability'],

  // D275 (M6.4dl) — the E/F/G residue; THREE new classes.
  //
  // ⚠️ Four FREE-SPELL alternative costs in one batch (Ensnare, Foil, Force
  // of Vigor, Force of Will) — the cast-time alternative cost class keeps
  // growing and now holds the format's most-played counterspell.
  // ⚠️ Exterminatus needs the keyword LOSS direction (indestructible, until
  // end of turn) — filed with Crash Landing under the temporary grant class,
  // whose comment already names the direction as missing.
  // ⚠️ Fire Nation Occupation's Soldier token carries FIREBENDING, a keyword
  // the engine has no notion of; the card would make tokens that half-work.
  // ⚠️ Garbage Fire is a DRAFT-MATTERS card: outside a draft its noted number
  // is nothing, and the engine has no draft.
  // ⚠️ Ghostfire "is colorless" — a characteristic-defining static on a
  // SPELL, which no StaticDef has ever applied from the stack.
  ['Ensnare', 'cast-time alternative cost'],
  ['Exterminatus', 'temporary keyword/ability grant'],
  ['Fiery Fall', 'cycling mechanic'],
  ['Fire Nation Occupation', 'firebending mechanic'],
  ['Flamewright', 'keyword-predicate sacrifice cost'],
  ['Foil', 'cast-time alternative cost'],
  ['Force of Vigor', 'cast-time alternative cost'],
  ['Force of Will', 'cast-time alternative cost'],
  ['Fowl Strike', 'hand-activated ability'],
  ['Garbage Fire', 'draft-matters'],
  ['Ghost-Lit Nourisher', 'hand-activated ability'],
  ['Ghost-Lit Redeemer', 'hand-activated ability'],
  ['Ghostfire', 'color-defining static'],
  ['Gluttonous Guest', 'sacrifice-event discriminator'],
  ["Gollum's Bite", 'the Ring mechanic'],
  ['Grim Harvest', 'recover mechanic'],

  // D276 (M6.4dm) — the G/H/I/J residue; ONE new class.
  //
  // ⚠️ Historian's Boon's second line fires off a SAGA's final chapter — the
  // engine has no Sagas, no lore counters, no chapters: an honest first entry.
  // ⚠️ Two exile-SELF costs (Hanged Executioner, Inquisitive Puppet) join
  // Brittle Effigy's class; Jan Jansen's 'a noncreature artifact' is Magmaw's
  // negated-type sacrifice predicate; Inaction Injunction DETAINS (Lyev
  // Decree's class). Icy Blast taps X targets (cast-time computed count).
  ['Guerrilla Tactics', 'discard-event discriminator'],
  ['Gush', 'cast-time alternative cost'],
  ['Hanged Executioner', 'exile-self cost'],
  ['Heroes Remembered', 'suspend mechanic'],
  ["Historian's Boon", 'saga chapter trigger'],
  ['Hunting Triad', 'hand-activated ability'],
  ['Hypergenesis', 'suspend mechanic'],
  ['Icefall', 'recover mechanic'],
  ['Icy Blast', 'cast-time computed target count'],
  ["Illusionist's Stratagem", 'up-to-N targeting'],
  ['Impossible Inferno', 'play-from-exile permission'],
  ['Inaction Injunction', 'detain mechanic'],
  ['Inquisitive Puppet', 'exile-self cost'],
  ['Inside Out', 'until-end-of-turn power/toughness switch'],
  ['Inspired Tinkering', 'play-from-exile permission'],
  ['Invigorate', 'cast-time alternative cost'],
  ['Jan Jansen, Chaos Crafter', 'negated-type sacrifice predicate'],

  // D277 (M6.4dn) — the J/K/L/M residue; TWO new classes.
  //
  // ⚠️ Kiora, Behemoth Beckoner is the FIRST planeswalker the pool offered:
  // its loyalty ability (−1: untap) is an activation shape the engine has
  // never charged (botPool pins planeswalkers at zero). Lantern Flare is
  // CLEAVE — a bracketed-text alternative cost.
  // ⚠️ Manamorphose adds two mana "in any combination of colors": a colour
  // choice a resolve cannot raise (D270 — chooseColor is engine-only).
  // ⚠️ Three conditional FREE casts (Lethargy Trap, Massacre, Mogg Salvage)
  // join the cast-time alternative cost class after D275's four.
  ["Katara's Reversal", 'up-to-N targeting'],
  ['Kiora, Behemoth Beckoner', 'planeswalker loyalty ability'],
  ['Krovikan Rot', 'recover mechanic'],
  ['Lantern Flare', 'cleave mechanic'],
  ["Laquatus's Disdain", 'cast-zone discriminator'],
  ['Learn from the Past', 'ctx.random'],
  ['Lethargy Trap', 'cast-time alternative cost'],
  ['Mammoth Bellow', 'harmonize mechanic'],
  ['Manamorphose', 'script-raised prompt'],
  ['Massacre', 'cast-time alternative cost'],
  ['Mental Journey', 'cycling mechanic'],
  ['Metrognome', 'discard-event discriminator'],
  ['Mind Transfer Protocol', 'until-end-of-turn type change with P/T set'],
  ['Mindstab', 'suspend mechanic'],
  ["Mjölnir's Might", 'play-from-exile permission'],
  ['Mnemonic Sphere', 'hand-activated ability'],
  ['Mogg Salvage', 'cast-time alternative cost'],

  // D278 (M6.4do) — the M/N/O/P residue; ZERO new classes, and the leanest
  // refusal count since D257 (11 of 25).
  //
  // ⚠️ Nighthaze grants SWAMPWALK until end of turn — landwalk is not on
  // effectParse's grantable list, so it files with the temporary grants.
  // ⚠️ Olórin's Searing Light makes each OPPONENT pick among tied greatest
  // powers: opponent-chooses.
  ['Mordor Muster', 'amass mechanic'],
  ['Muddle the Mixture', 'transmute mechanic'],
  ['Narcissism', 'discard-cost chooser'],
  ['Nighthaze', 'temporary keyword/ability grant'],
  ['Niveous Wisps', 'UEOT color change'],
  ['Nocturnal Hunger', 'gift mechanic'],
  ['Nourishing Shoal', 'cast-time alternative cost'],
  ["Olórin's Searing Light", 'opponent-chooses'],
  ['Open the Way', 'ctx.random'],
  ['Path of Peril', 'cleave mechanic'],
  ['Phthisis', 'suspend mechanic'],

  // D279 (M6.4dp) — the P/Q/R residue; TWO new classes.
  //
  // ⚠️ Plan the Heist PLOTS (exile from hand, cast free on a later turn) —
  // an alternative cast from exile the engine has no notion of. Providence
  // is revealed from the OPENING HAND, before any turn: no hook exists.
  // ⚠️ Raphael's Technique's SNEAK is an alternative cost with a combat
  // condition — it files with the cast-time alternative costs, the ninth
  // free-spell refusal in four batches. Rat King's "Sacrifice a token" is
  // Hardened Tactician's line (token-predicate sacrifice cost).
  ['Plan the Heist', 'plot mechanic'],
  ['Plunder', 'suspend mechanic'],
  ['Prosperous Partnership', 'tap-creatures cost'],
  ['Providence', 'opening-hand reveal'],
  ['Psychic Purge', 'discard-event discriminator'],
  ['Quickchange', 'script-raised prompt'],
  ['Rally for the Throne', 'mana-spent memory'],
  ["Raphael's Technique", 'cast-time alternative cost'],
  ['Rat King, Pale Piper', 'token-predicate sacrifice cost'],
  ['Ray Fillet, Man Ray', 'remove-counter cost'],
  ['Reality Anchor', 'temporary keyword/ability grant'],
  ['Reforge the Soul', 'miracle mechanic'],
  ['Refresh', 'regeneration'],
  ['Refreshing Rain', 'cast-time alternative cost'],
  ['Resize', 'recover mechanic'],
  ['Restart Sequence', 'freerunning mechanic'],
  ['Reverent Silence', 'cast-time alternative cost'],

  // D280 (M6.4dq) — the R/S residue; ONE new class.
  //
  // ⚠️ Rishkar's Expertise ends with 'you may cast a spell ... without paying
  // its mana cost' — a FREE-CAST PERMISSION the resolve cannot grant (the
  // cast stage owns costs). Baral's Expertise (D272) was refused for its
  // up-to-N half first; the permission half now has its own name.
  // ⚠️ Three MULTI-sacrifice costs in one batch (Ruthless Knave, Sai, Savvy
  // Hunter: 'Sacrifice three Treasures / two artifacts / two Foods') — the
  // chooser takes exactly one permanent.
  ['Rift Bolt', 'suspend mechanic'],
  ["Rishkar's Expertise", 'free-cast permission'],
  ["Roilmage's Trick", 'converge (cast-time mana-color memory)'],
  ['Rouse', 'cast-time alternative cost'],
  ['Ruthless Knave', 'multi-sacrifice cost'],
  ['Sadistic Slash', 'mayhem mechanic'],
  ['Sai, Master Thopterist', 'multi-sacrifice cost'],
  ["Saruman's Trickery", 'amass mechanic'],
  ['Savvy Hunter', 'multi-sacrifice cost'],
  ['Scrollshift', 'up-to-N targeting'],
  ['Searing Barrage', 'mana-spent memory'],
  ['Send to Sleep', 'up-to-N targeting'],
  ['Shapers of Nature', 'remove-counter cost'],
  ['Shimmering Mirage', 'script-raised prompt'],
  ['Shivan Meteor', 'suspend mechanic'],
  ['Shred Memory', 'transmute mechanic'],
  ['Sickening Shoal', 'cast-time alternative cost'],

  // D281 (M6.4dr) — the S residue; ONE new class.
  //
  // ⚠️ Skullport Merchant's price is 'another creature OR a Treasure' — a
  // compound the sacrifice chooser cannot express (one noun per cost).
  // ⚠️ Silver Scrutiny may be cast AS THOUGH IT HAD FLASH when X is small:
  // a cast-timing permission, the cast stage's business.
  ['Silver Scrutiny', 'cast-permission condition'],
  ['Skullmead Cauldron', 'discard-cost chooser'],
  ['Skullport Merchant', 'compound sacrifice predicate'],
  ['Skyscribing', 'hand-activated ability'],
  ['Skystrike Officer', 'tap-creatures cost'],
  ['Snakeform', 'until-end-of-turn type change with P/T set'],
  ['Snapback', 'cast-time alternative cost'],
  ['Soul of Zendikar', 'graveyard-activated ability'],
  ['Soul Spike', 'cast-time alternative cost'],
  ['SP//dr, Piloted by Peni', 'modified predicate'],
  ['Spiritualize', 'temporary game-wide trigger'],
  ["Sram's Expertise", 'free-cast permission'],
  ['Starfall Invocation', 'gift mechanic'],
  ['Submerge', 'cast-time alternative cost'],
  ['Suit Up', 'until-end-of-turn type change with P/T set'],
  ["Sun's Bounty", 'recover mechanic'],

  // D282 (M6.4ds) — the S/T residue; ONE new class.
  //
  // ⚠️ Surgical Suite // Hospital Room is a ROOM: two doors on one
  // enchantment, each unlocked for its own cost as a sorcery, each half
  // live only while unlocked — a permanent with a per-face lock the engine
  // has no state for.
  // ⚠️ Twitch and Tidal Bore let the caster CHOOSE tap or untap at
  // resolution (script-raised prompt); Tidal Bore is refused for its
  // alternative cost first.
  ['Sunscour', 'cast-time alternative cost'],
  ['Surgical Suite // Hospital Room', 'room mechanic'],
  ['Swarming of Moria', 'amass mechanic'],
  ['Sylvan Bounty', 'cycling mechanic'],
  ['Teysa, Orzhov Scion', 'multi-sacrifice cost'],
  ['The Underworld Cookbook', 'discard-cost chooser'],
  ['Thunderblade Charge', 'free-cast permission'],
  ['Thwart', 'cast-time alternative cost'],
  ['Tidal Bore', 'cast-time alternative cost'],
  ['Traumatic Visions', 'cycling mechanic'],
  ['Treason of Isengard', 'amass mechanic'],
  ['Twisted Image', 'until-end-of-turn power/toughness switch'],
  ['Twitch', 'script-raised prompt'],

  // D283 (M6.4dt) — the U-Z residue plus the tail of the offline order; the
  // LAST batch the order can offer. ZERO new classes: every wall here was
  // already named. Four Harmonize spells in one batch; three Cleave/
  // Freerunning alternative costs beside Baleful Mastery.
  ['Unending Whisper', 'harmonize mechanic'],
  ['Unexplained Vision', 'mana-spent memory'],
  ["Ureni's Rebuff", 'harmonize mechanic'],
  ['Verdant Rebirth', 'quoted-ability temporary grant'],
  ['Viridescent Wisps', 'UEOT color change'],
  ['Vivify', 'until-end-of-turn type change with P/T set'],
  ['Wash Away', 'cleave mechanic'],
  ['Wheel of Fate', 'suspend mechanic'],
  ['Wild Ride', 'harmonize mechanic'],
  ['Winged Portent', 'cleave mechanic'],
  ["Yahenni's Expertise", 'free-cast permission'],
  ['Zenith Festival', 'play-from-exile permission'],
  ['Zhalfirin Shapecraft', 'until-end-of-turn base P/T set'],
  ['Baleful Mastery', 'cast-time alternative cost'],
  ['Code of Constraint', 'untap restriction'],
  ['Dissection Practice', 'up-to-N targeting'],
  ['Escape Detection', 'freerunning mechanic'],
  ['Fountainport', 'token-predicate sacrifice cost'],
]);

/** Filled by `select()`: REFUSED entries whose card now runs completely. */
const staleRefusals: string[] = [];

async function select(): Promise<Candidate[]> {
  const decks = deckNames();
  const pool = poolNames();
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const rl = createInterface({ input: createReadStream(NDJSON), crlfDelay: Infinity });
  for await (const raw of rl) {
    if (raw === '') continue;
    let card: CardData;
    try {
      card = JSON.parse(raw) as CardData;
    } catch {
      continue;
    }
    if (card.commanderLegality !== 'legal') continue;
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    const complete = engineCompleteness(card).complete;
    if (REFUSED.has(card.name)) {
      // A refused card that now runs completely is a STALE ledger entry — its
      // class was built and the entry must go; the guard test names it.
      if (complete) staleRefusals.push(card.name);
      continue;
    }
    // Already run completely — there is nothing for a script to add.
    if (complete) continue;

    const p = primitivesFor(card);
    // ⚠️ SOLE NEED `scriptable`, nothing else. A card that also waits on a
    // primitive is not draftable today whatever its text looks like.
    if (p.needs.size !== 1 || !p.needs.has('scriptable')) continue;

    // ⚠️ SHAPES THE NEEDS COLUMN CANNOT SEE, found by handing them to a
    // drafter (D160, D161). A target spec with an UNREAD or UNENFORCED clause
    // fails `faceCompleteness` whatever a script claims, so the gate would
    // refuse the landed card ("attacking or blocking" cost a batch two
    // drafts). Asked of the parsers that decide them, never re-read here.
    //
    // ⚠️ SPELLS ARE OFFERABLE SINCE D187 — `SpellDef` exists and the seam in
    // `resolveTop` runs a whole-spell script, so the D161 "no spells" filter
    // is GONE. What stays refused is a MULTI-FACE card with a spell face:
    // SpellDef v1 is single-faced (no face-keyed ref yet), so a split or
    // adventure half would land on the wrong face — D187's own reportable.
    let landable = true;
    for (let i = 0; i < card.faces.length; i++) {
      const face = parseFace(card, i);
      if (!face.isPermanent && card.faces.length > 1) landable = false;
      const specs = [...face.targets, ...face.activated.flatMap((a) => a.targets)];
      if (specs.some((s) => s.kinds.length === 0 || s.unenforced.length > 0)) landable = false;
    }
    if (!landable) continue;

    let lines = 0;
    for (let i = 0; i < card.faces.length; i++) lines += unaccountedLines(card, i).length;
    const rung: 1 | 2 | 3 = decks.has(card.name) ? 1 : pool.has(card.name) ? 2 : 3;
    out.push({ name: card.name, oracleId: card.oracleId, rung, lines });
  }

  out.sort((a, b) => a.rung - b.rung || a.lines - b.lines || a.name.localeCompare(b.name));
  return out;
}

describe.skipIf(!HAVE_DB)('the next batch to script', () => {
  let all: Candidate[] = [];

  test('reads the whole database and ranks what is scriptable', async () => {
    all = await select();
    // ⚠️ D283 (M6.4dt) EMPTIED THE OFFLINE ORDER: every scriptable-today card
    // has shipped or sits in the REFUSED ledger, so the pool measures ZERO.
    // Phase 1's engine seams drain ledger classes back into this pool; the
    // pin moves the moment the first one lands. Until then a non-empty pool
    // here would mean a ledger entry went stale unnoticed.
    expect(all.length).toBe(0);
    // Everything emitted needs a script and nothing else — the property the
    // whole pipeline downstream depends on.
    expect(all.every((c) => c.lines > 0)).toBe(true);
  }, 600_000);

  test('the ordering puts the user’s own cards first', () => {
    const rungs = all.map((c) => c.rung);
    expect([...rungs].sort((a, b) => a - b)).toEqual(rungs);
  });

  test('the REFUSED ledger holds only cards still waiting on their named gap', () => {
    // A name here means: delete that ledger entry — its class was built.
    expect(staleRefusals).toEqual([]);
    // And nothing refused leaks into the ranking.
    const offered = new Set(all.map((c) => c.name));
    for (const name of REFUSED.keys()) expect(offered.has(name)).toBe(false);
  });

  test('and writes the batch when asked', () => {
    if (!EMIT) return;
    const batch = all.slice(0, WANT);
    writeFileSync(
      EMIT,
      JSON.stringify(
        {
          generated: 'scripts/cardgen/select.cjs',
          total: all.length,
          batch: batch.length,
          byRung: { 1: all.filter((c) => c.rung === 1).length, 2: all.filter((c) => c.rung === 2).length, 3: all.filter((c) => c.rung === 3).length },
          cards: batch,
        },
        null,
        2,
      ),
      'utf8',
    );
    expect(existsSync(EMIT)).toBe(true);
  });
});

/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('the next batch to script', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect(HAVE_DB).toBe(false);
  });
});
