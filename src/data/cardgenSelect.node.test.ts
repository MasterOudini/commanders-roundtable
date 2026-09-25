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
  // D360 - the optional-search wave: the seventeen of 95 the row maker refused, each by the
  // reason it gave. Five are one cause (a sacrifice cost whose predicate is a COLOUR, which the
  // fixture derivation has no card for), two are a search naming two other cards, and five are
  // cards whose leftover the probe reports differently from the printed line.
  ["Angel's Herald", 'colour-predicate sacrifice cost (no derived fixture)'],
  ["Behemoth's Herald", 'colour-predicate sacrifice cost (no derived fixture)'],
  ["Demon's Herald", 'colour-predicate sacrifice cost (no derived fixture)'],
  ["Dragon's Herald", 'colour-predicate sacrifice cost (no derived fixture)'],
  ["Sphinx's Herald", 'colour-predicate sacrifice cost (no derived fixture)'],
  ['Bogbrew Witch', 'a search naming two other cards'],
  ['Dragonstorm Forecaster', 'a search naming two other cards'],
  ['Sword of the Animist', 'an attack head on a card with no creature body'],
  ['Flagstones of Trokair', 'a row the test cannot cast: no mana cost'],
  ['Krosan Tusker', 'cycling trigger head'],
  ['Goblin Engineer', 'a graveyard clause whose every fixture the suite already deals'],
  ['Land Grant', 'a spell line outside the vocabulary'],
  ['Mycosynth Wellspring', 'leftover reported differently from the printed line'],
  ['Zur the Enchanter', 'leftover reported differently from the printed line'],
  ['Heaped Harvest', 'leftover reported differently from the printed line'],
  // ⚠️ The 'sacrifice-cost chooser' class — FIFTEEN entries at its peak, the
  // ledger's largest — was BUILT in D168 (`ActivateAbility.sacrifice`) and its
  // entries deleted the same day, so those cards re-enter the offer stream.
  // A script cannot raise ANOTHER player's prompt from resolve (D160).
  // The "modified" predicate (D160).
  ['Akki Ember-Keeper', 'modified predicate'],
  // Random-discard cost — and `ctx.random` is still a stub (D161).
  // Tap-N-untapped-creatures costs (D161).
  // Exile-from-library cost (D161).
  ['Arc-Slogger', 'exile-from-library cost'],
  // "For the first time each turn" needs per-turn trigger memory the engine
  // does not hold (D163).
  // `CombatDamageDealt` batches EVERY creature's damage into one event and
  // the bus fires per event, so a per-creature damage trigger under-fires on
  // multi-attacker turns (D163).
  // Discard-a-card-as-cost chooser — the hand-side sibling of the sacrifice
  // chooser (D163).
  // Batch 7 (D164).
  // Exile-N-cards-from-your-graveyard as a COST is a chooser over a public
  // zone nothing charges yet — the graveyard sibling of the sacrifice
  // chooser (D164).
  // "…discards a card AT RANDOM" as an EFFECT — `ctx.random` is a stub at
  // every ScriptCtx site (D158), so no random card may ship until it is
  // wired to the seeded generator (D164).
  ['Black Cat', 'ctx.random stub'],
  // Batch 8 (D165).
  // Remove-a-+1/+1-counter-from-a-creature-you-control as a COST is a
  // chooser over counter state nothing charges yet (D165).
  // Batch 9 (D166).
  // "Exile this artifact" as a cost — sacrificesSelf ONE EVENT OVER
  // (CardsMoved to exile instead of graveyard); named cheap, not built yet.
  ['Brittle Effigy', 'exile-self cost'],
  // Batch 10 (D167).
  // "Your second spell each turn" is Axgard's per-turn trigger memory one
  // count over (D167).
  // Tap-two-untapped-ARTIFACTS as a cost — the tap-creatures chooser's
  // artifact sibling (D167).
  // Batch 11 (D169).
  // "target opponent discards a card" from a trigger's resolve is the
  // script-raised prompt class (D160) — the caster's script asking ANOTHER
  // player's hidden-zone question.
  // Batch 12 (D170).
  // "Whenever a Dinosaur you control deals combat damage" — NOT self-only,
  // so `CombatDamageDealt`'s per-event batching under-fires it on
  // multi-Dinosaur turns (Aya's class, D163).
  // A dies-trigger raising the TARGET OPPONENT's discard prompt (D160's
  // class, Corrupt Court Official's dies-twin).
  // M6.4o (D171) — batch 13's five refusals, all existing classes.
  // "{4}{B}, Sacrifice this creature: Target player discards two cards" —
  // the resolve must raise the target's chooseFromZone, which a script
  // cannot do (D160's class).
  // M6.4p (D172) — batch 14's seven refusals. Dragon Broodmother is a NEW
  // class: its token carries DEVOUR, an as-enters sacrifice choice on the
  // created permanent that nothing can raise. Dromad Purebred is the
  // RECEIVER side of Aya's class — two simultaneous sources are two damage
  // instances batched into one event, so per-event firing under-fires.
  ['Dragonborn Champion', 'per-damage-entry trigger granularity'],
  // M6.4r (D174) — batch 16's two refusals. Ezio watches a CLASS of
  // creatures deal combat damage, so two simultaneous Assassins are two
  // instances batched into one event (Aya's class, dealer side widened).
  // M6.4s (D175) — batch 17's four refusals. Floodbringer and Flooded
  // Shoreline open a NEW class: "Return a land you control to its owner's
  // hand" as an ACTIVATION COST — the chooser one verb over from
  // sacrifice, with the bounce-cost machinery unbuilt.

  // Batch 18 (D176) — all three existing classes.
  // Batch 19 (D177) — TWO NEW classes. Multi-sacrifice: D168's
  // `ActivateAbility.sacrifice` names ONE permanent, so "Sacrifice two
  // Goblins" has no carrier. Sacrifice-event discriminator: `EventCause`
  // has no sacrifice kind AND `matches` receives the event BODY, so a
  // "whenever you sacrifice" watcher would over-fire on every death.
  ['Graf Mole', 'sacrifice-event discriminator'],
  // Batch 20 (D178) — THREE new classes. Alternative cost: "{3}, {T} or
  // {R}, {T}:" has no carrier and a def would charge one reading of an
  // ambiguous price. Ability-word cost: the em-dash label sits inside the
  // cost string ("Stunning Strike — {1}{W}, {T}") — a parse-widening
  // candidate. Graveyard-activated: the ability itself lives in the
  // graveyard, and legal.ts offers battlefield abilities only.
  ['Granite Shard', 'alternative activation cost'],
  ['Half-Elf Monk', 'ability-word activated cost'],
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
  ['Illuminated Folio', 'reveal-cost chooser'],
  // Batch 23 (D182): two existing classes and ONE new one. `Jandor's Ring`
  // pays by discarding "the last card you drew this turn" — the engine
  // tracks no per-turn draw identity at all (the draw-event discriminator's
  // sibling: there is not even a draw EVENT, let alone a memory of which
  // card came last).
  ['Ion Storm', 'remove-counter cost'],
  ["Jandor's Ring", 'last-drawn-card memory cost'],
  // Batch 24 (D183): three existing classes and ONE new one. `Jolly
  // Gerbils` triggers "whenever you give a gift" — the engine has no gift
  // concept anywhere (a cast-time promise on gift-carrying spells; nothing
  // raises, records or fulfils one).
  ['Jolly Gerbils', 'gift mechanic'],
  // Batch 25 (D184): five refusals, ZERO new classes — every one an
  // existing named gap, which is the ledger's drainage doing its job.
  // Batch 26 (D185): FOUR new classes. `Lullmage's Familiar` needs kicker
  // (a cast-time additional-cost choice nothing records); `Lurking
  // Chupacabra` needs explore; `Magmaw` sacrifices "a NONLAND permanent"
  // and predicatesOf has no type negation (the token-predicate's sibling);
  // and Lifeblood/Lifetap/Linden fail on GRANULARITY — per-item wording
  // (each Mountain that taps, each white attacker) against a batched event
  // a resolve cannot see into, which is Aya of Alexandria's D163 refusal on
  // taps and attack declarations.
  // D431 - the caster's own sacrifice offered 6 more the row maker refuses (a queued sacrifice of two, a fodder the suite
  // cannot put, a search payload, a quoted grant) or that no row reaches (a spell whose ask is not last) - by reason.
  ['Lotus Field', 'a queued sacrifice of more than one: Sacrifice two lands.'],
  ['Puppet Conjurer', 'a queued sacrifice with no fodder the suite can put: Homunculu'],
  // D470 - the stun counter is the engine's now (and the vocabulary puts it), and the mirror offered four the row maker
  // refused: a block proof beside a payload that taps the opponent's blocker, two multi-face layouts, a tap head the
  // library lacks.
  ['Gilded Scuttler', "a block proof beside a payload that taps the opponent's blocker (the entry taps and stuns the Cyclops; the declare-blockers prompt is skipped with no untapped blocker): This creature can't be blocked. + When this creature enters, tap target creature an opponent controls and put a stun counter on it."],
  ['Invasion of Kamigawa // Rooftop Saboteurs', 'multi-face or unusual layout (a battle with a stun-counter face)'],
  ['Meat Locker // Drowned Diner', 'multi-face or unusual layout (a Room whose door taps and stuns)'],
  ['Solitary Sanctuary', 'trigger head not in the library (you tap an untapped creature an opponent controls): Whenever you tap an untapped creature an opponent controls, put a +1/+1 counter on target creature you control.'],
  // D465 - the chosen creature type is the engine's now, and the mirror offered two the row maker refused: a compound
  // enters-or-attacks head over a filtered subject, a sacrifice cost whose predicate names the chosen type.
  ['Kindred Discovery', 'a compound enters-or-attacks head over a filtered subject the library lacks (a creature you control of the chosen type enters or attacks): Whenever a creature you control of the chosen type enters or attacks, draw a card.'],
  ['Doom Cannon', 'a sacrifice cost over the chosen type no fixture the suite can put satisfies (the cost chooser reads no chosenType): {3}, {T}, Sacrifice a creature of the chosen type: This artifact deals 3 damage to any target.'],
  // D463 - mobilize is the engine's now, and the mirror offered one the row maker refused: a compound dies head
  // (this creature or another creature you control) the library lacks.
  // D462 - ninjutsu is the engine's now, and the mirror offered two the row maker refused: filtered combat-damage heads
  // (a Ninja you control; one or more Ninja or Rogue creatures) the library lacks.
  // D460 - disguise is the engine's now, and the mirror offered six the row maker refused: a token outside the table, the
  // compound head `enters or is turned face up` the library lacks, a subtype anthem outside the scope vocabulary, a surveil
  // beside a life gain.
  ['Museum Nightwatch', 'a token outside TOKEN_TABLE: Detective|2/2|WU|Creature|'],
  ['Basilica Stalker', 'a trigger payload outside the vocabulary (a surveil beside a life gain): You gain 1 life and surveil 1.'],
  // D459 - fabricate is the engine's now, and the mirror offered one the row maker refused: a compound subject
  // (creature or artifact) the filtered-head reader does not split.
  ['Marionette Apprentice', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever another creature or artifact you control is put into a graveyard from the battlefield'],
  // D453 - the control Auras are the engine's now, and the mirror offered two the row maker refused: an additional
  // chooser cost the cast arm cannot pay, an intervening if the armed board already meets (the wide run's reason).
  ['Grafted Identity', 'an additional cost with a chooser verb the cast arm cannot pay: As an additional cost to cast this spell, sacrifice a creature.'],
  ['Mark of the Oni', 'an intervening if the armed board already meets (not this wave): you control no Demons'],
  // D450 - vanishing and fading are the engine's now, and the mirror offered four the row maker refused: a two-head
  // line, a possessive filter, and two vanishing-1 cards the suite's own walk would kill before the fire (the wide run's reason).
  ['Crack in Time', "trigger head not in the library: When this enchantment enters and at the beginning of your first main phase, tap all creatures you don't control."],
  ['Dreamtide Whale', 'a filtered head outside the closed reader (an adjective outside the list: their): Whenever a player casts their second spell each turn, proliferate.'],
  ['Lavacore Elemental', "a vanishing count the suite walk removes (1 against 1 upkeep ticks): the card dies at its controller's first upkeep before the combat-damage head fires"],
  ['Soultether Golem', "a vanishing count the suite walk removes (1 against 1 upkeep ticks): the card dies at its controller's first upkeep before another creature enters"],
  // D449 - evoke and dash are the engine's now, and the mirror offered four the row maker refused: two up-to-two
  // clauses no fixture serves, a typed attack head outside the library, a token outside TOKEN_TABLE (the wide run's reason).
  ["Kolaghan, the Storm's Fury", 'trigger head not in the library: Whenever a Dragon you control attacks, creatures you control get +1/+0 until end of turn.'],
  ['Riders of Rohan', 'a token outside TOKEN_TABLE: Human Knight|2/2|R|Creature|trample,haste'],
  // D448 - unearth is the engine's now, and the mirror offered three the row maker refused: an ability-word activated
  // line, a search-to-graveyard payload and a combat-damage head that also sacrifices (the wide run's reason).
  ['Chronomancer', 'ability-word activated line: Atomic Transmutation — {1}, {T}, Sacrifice another artifact: Draw a card.'],
  ['Kathari Bomber', 'trigger head not in the library: When this creature deals combat damage to a player, create two 1/1 red Goblin creature tokens and sacrifice this creature.'],
  // D442 - the printed maximum hand size is the engine's now, and the mirror offered two the row maker refused: a
  // token-combat head outside the library and a hand-sized life gain no suite can stage (the wide run's reason).
  ['Curiosity Crafter', 'trigger head not in the library: Whenever a creature token you control deals combat damage to a player,'],
  ["Venser's Journal", 'a counted noun the suite cannot stage (cardsInHand): You gain 1 life for each card in your hand.'],
  // D441 - the enters-or-dies head splits into two defs now, and one pair's counter payload is read absolutely by the
  // dies arm (the wide run's reason).
  ['Hunting Moa', 'an enters-or-dies pair whose counter payload the dies arm reads absolutely (the etb half counts too)'],
  // D440 - and the mirror offered two the row maker refused: a second-spell head and a Construct search (the wide run's
  // reason).
  ['Arcbound Tracker', 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast a spell other than your first spell each t'],
  // D440 - modular's entry counters are the engine's now, and the four Arcbounds beside a self-counter or self-pump row
  // read N too many against the printed base (the wide run's reason).
  ['Arcbound Crusher', 'an entry-counter keyword beside the row (the suite reads the printed base, not the counters it enters with)'],
  ['Arcbound Ravager', 'an entry-counter keyword beside the row (the suite reads the printed base, not the counters it enters with)'],
  ['Arcbound Whelp', 'an entry-counter keyword beside the row (the suite reads the printed base, not the counters it enters with)'],
  ['Arcbound Slith', 'an entry-counter keyword beside the row (the suite reads the printed base, not the counters it enters with)'],
  // D439 - and the mirror offered 15 the row maker refused - the enters-or-dies heads, an anthem beside a mass pump, a
  // counted loss beside a cost piece, the pay-or-scry riders (the wide run's reason).
  ['Dream Beavers', 'trigger payload not a pump: Each opponent loses 1 life and you gain 1 life. Scry 1.'],
  ['Hunting Moa', 'a filtered head outside the closed reader (an adjective outside the list: this): When this creature enters or dies, put a +1/+1 counter on ta'],
  ['Inner Sanctum', 'a line that is neither an activated ability nor a library trigger: Prevent all damage that would be dealt to creatures you control.'],
  ['Rotwidow Pack', 'a counted payload beside a cost piece that leaves a fixture behind: Each opponent loses 1 life for each Spider you control.'],
  ['Slitherwisp', 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast another spell that has flash, you draw a c'],
  ['Bubbling Cauldron', 'cost: a sacrifice cost with no fixture the suite can put: creature named Festering Newt'],
  ['Corroding Dragonstorm', 'trigger payload not a pump: Each opponent loses 2 life and you gain 2 life. Surveil 2.'],
  ['Fyndhorn Pollen', 'an anthem beside a mass pump (the Eel reads both)'],
  ['Illusions of Grandeur', 'a filtered head outside the closed reader (an adjective outside the list: this): When this enchantment leaves the battlefield, you lose 20 li'],
  ['Juju Bubble', 'trigger head not in the library: When you play a card, sacrifice this artifact.'],
  // D439 - the upkeep prices made the echo cards rowable, and one of them aims its enters and its leaves damage at the
  // suite's one Cyclops (the wide run's reason).
  ['Firemaw Kavu', "an enters damage that kills the leaves payload's only fixture (the suite stages one Cyclops; the echo is paid, the fixture is dead)"],
  // D437 - and once each-damage counted too, the mirror offered one counted self-damage the row maker does not read.
  // (the wide run's reason).
  ['Black Market Tycoon', 'trigger payload not a pump: ~ deals 2 damage to you for each Treasure you control (a counted self-damage the row maker does not read)'],
  // D437 - the spell's X made the counted mill a multipliable kind, and the mirror offered 5 counted mills the suite
  // cannot stage (a keyword refinement, a head whose arm sizes the board, a Locus with no witness) - by the wide run's reason.
  ['Coral Colony', 'a counted noun with a refinement the suite cannot stage: Target player mills X cards, where X is the number of creatures you control with defender.'],
  ['Doorkeeper', 'a counted noun with a refinement the suite cannot stage: Target player mills X cards, where X is the number of creatures you control with defender.'],
  ['Halimar Excavator', 'a counted payload under a head whose arm sizes the board (selfOrAnotherAllyEnters): Target player mills X cards, where X is the number of Allies you control.'],
  ['Master Pakku', 'a counted payload under a head whose arm sizes the board (becomesTapped): Target player mills X cards, where X is the number of Lesson cards in your graveyard.'],
  ['Trenchpost', 'a counted noun with no witness the suite can put: Target player mills a card for each Locus you control.'],
  // D436 - the graveyard-card target's mirror offered 6 the row maker refuses (a two-card clause, a persist body, two
  // filtered heads, two heads outside the library) - each by the wide run's reason.
  ['Deadeye Tracker', "a vocabulary clause the suite has no fixture for: a counted clause (2..2) - Exile two target cards from an opponent's graveyard"],
  ['Grazing Kelpie', 'a self-sacrifice on a creature that returns (persist / undying)'],
  ['Grixis Sojourners', 'a filtered head outside the closed reader (an adjective outside the list: you): When you cycle this card and when this creature dies, you may exile target card from a graveyard.'],
  ['Dutiful Knowledge Seeker', 'trigger head not in the library: Whenever one or more cards are put into a library from anywhere, put a +1/+1 counter on this creature.'],
  ['Restless Cottage', 'trigger head not in the library: Whenever this land attacks, create a Food token and exile up to one target card from a graveyard.'],
  ['General Kudro of Drannith', "a filtered head outside the closed reader (an adjective outside the list: or): Whenever General Kudro or another Human you control enters, exile target card from an opponent's graveyard."],
  // D435 - the if-you-do pair's mirror offered 8 the row maker refuses (a Blight cost, four heads outside the library, two
  // filtered heads, a two-faced printing) - each by the wide run's reason.
  ['Baral, Chief of Compliance', 'trigger head not in the library: Whenever a spell or ability you control counters a spell, you may draw a card. If you do, discard a card.'],
  ['Gristle Glutton', 'cost: Blight 1'],
  ['Projektor Inspector', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another Detective you control enters and whenever a Detective you control is turned face up'],
  ["Smuggler's Copter", 'trigger head not in the library: Whenever this Vehicle attacks or blocks, you may draw a card. If you do, discard a card.'],
  ['Izzet Keyrune', 'trigger head not in the library: Whenever this artifact deals combat damage to a player, you may draw a card. If you do, discard a card.'],
  ["Smuggler's Copter // Smuggler's Copter", 'multi-face or unusual layout'],
  ['Wharf Infiltrator', 'trigger head not in the library: Whenever you discard a creature card, you may pay {2}. If you do, create a 3/2 colorless Eldrazi Horror creature token.'],
  // D434 - the mill vocabulary's mirror offered 15 more the row maker refuses (a meld card, a mill as a payment's branch,
  // three quoted grants, four heads outside the library, two filtered heads, a Clue sacrifice head, a cycling trigger on
  // a spell, two loyalty faces) - each by the wide run's reason.
  ['Argoth, Sanctum of Nature', 'multi-face or unusual layout (a meld card)'],
  ['Drowner Initiate', 'a payment branch the suite cannot assert: mill (a graveyard count under a payment)'],
  ['Scrabbling Skullcrab', 'trigger head not in the library: Eerie - Whenever an enchantment you control enters and whenever you fully unlock a Room, target player mills two cards.'],
  ['Enigma Eidolon', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Fleeting Memories', 'a sacrifice head no fixture the suite can sacrifice satisfies: a Clue'],
  ['Fractured Sanity', 'a spell whose cycling trigger the engine does not run (When you cycle this card, each opponent mills four cards.)'],
  ['Restless Reef', 'trigger head not in the library: Whenever this land attacks, target player mills four cards.'],
  // D434 - the mill vocabulary: the 63 the wide run rowed once a mill could be the caster's own, aimed at a player or
  // over a player scope; 62 landed and this 1 is refused by reason (two heads of one card interact - the enters loot's
  // draw fires the draw head, and the suite answers one prompt where two are raised).
  ["Teferi's Tutelage", 'two heads of one card interact (the loot draw fires the draw head; the suite answers one prompt where two are raised)'],
  // D433 - the targeted and scoped draws offered two more the row maker refuses (a second-card draw head outside the
  // library; a spell with an airbend beside its draw-then-discard).
  ['Faerie Mastermind', 'trigger head not in the library: Whenever an opponent draws their second card each turn, you draw a car'],
  ['Whirlwind Technique', 'a spell with a line outside the vocabulary (airbend) beside its draw-then-discard'],
  // D433 - the draw-step heads: the 34 the wide run rowed once each player's draw step and your own were heads, an
  // additional card read as a draw, and a draw could be aimed at a player or over a player scope; 32 landed and these 2
  // are refused by reason (two heads of one card on the same draw step - the extra draw fires the draw head twice).
  ['Spiteful Visions', 'two heads of one card on the same draw step (the extra draw fires the draw head twice)'],
  ['Nekusar, the Mindrazer', 'two heads of one card on the same draw step (the extra draw fires the draw head twice)'],
  // D429 - the wide run is the offer: 112 rows the row maker read over the whole leftover that the classifier never
  ['Ob Nixilis, the Hate-Twisted', 'planeswalker loyalty ability'],
  // D432 - the draw heads: the 28 the wide run rowed once an opponent's or a player's draw was a head naming its player,
  // they / them were the referent and a token could be a payment's branch; 23 landed and these 5 are refused by reason
  // (the Inspired untap-step payments whose fire walks past the prompt; a token branch under a cast head).
  ['Aerie Worshippers', 'a payment under an untap-step head (the fire walks past the prompt)'],
  ['Forlorn Pseudamma', 'a payment under an untap-step head (the fire walks past the prompt)'],
  ['Pheres-Band Raiders', 'a payment under an untap-step head (the fire walks past the prompt)'],
  ['Skywise Teachings', 'a token pay branch under a cast head (the board baseline counts the cast)'],
  ['God-Favored General', 'a payment under an untap-step head (the fire walks past the prompt)'],
  // D429 - the wide run is the offer: 112 rows the row maker read over the whole leftover that the classifier never
  // caster could sacrifice a permanent of their choice; 49 landed and these 3 are refused by reason (an optional trigger
  // whose payload asks - two prompts; two asking payloads under one head - two queues the suite cannot order).
  ['Tazeem Raptor', 'an optional trigger whose payload asks (two prompts)'],
  ['Marsh Crocodile', 'two asking payloads under one head (two queues the suite cannot order)'],
  ['Razing Snidd', 'two asking payloads under one head (two queues the suite cannot order)'],
  // D429 - the wide run is the offer: 112 rows the row maker read over the whole leftover that the classifier never
  // count; 42 landed and these 4 are refused by reason (an anthem beside another statics block - one block per module;
  // a germ token beside a counted attached pump; two counted shrinks whose baseline count kills the creature).
  ['Vampirism', 'an anthem beside another statics block (one statics block per module)'],
  ["Kemba's Banner", 'a germ token beside a counted attached pump (the germ proof reads the token at 2/2)'],
  ['Grim Strider', 'a counted shrink the suite baseline kills (the opening seven, the board)'],
  ['Dread Slag', 'a counted shrink the suite baseline kills (the opening seven, the board)'],
  // D430 - the classifier's counted mirror offered 8 more, each on a card whose OTHER line the row maker refuses - by the
  // wide run's reason (a power CDA on a Vehicle, an attack head on a non-creature, a filtered head's adjective, a cost,
  // a search payload).
  ['Brotherhood Vertibird', 'a power CDA on a non-creature'],
  ['Adaptive Omnitool', 'an attack head on a card with no creature body: equippedCreatureAttacks'],
  ['Exuberant Fuseling', 'a filtered head outside the closed reader (an adjective outside the list: this): When this creature enters and whenever another creature or a'],
  ["Geralf's Masterpiece", 'cost: Discard three cards'],
  ['Pride Sovereign', 'cost: Exert this creature'],
  // D428 - the triggering player: the 4 the selector offered once a payload could name the player its head named,
  // offered (its mirror's drift since D424, plus the subjectless life gain); 99 landed, 9 failed their suites
  // on generator shapes the wave's multi-line combinations reached first (an enrage fight's damage baseline, a rampage
  // fire that ends the game, a modal enters-or-attacks counter read twice, a dead source's power, an Aura's untap-skip
  // the suite could not find, a fight suite naming a helper never imported, a cant-attack-unless walk), and 4 were
  // rowed on the TOKEN printing that shares their name (the wide dump's first record; the disclaim check named them).
  ['Pheres-Band Brawler', 'a fight suite naming onBoard the module never imports'],
  ['Territorial Allosaurus', 'a fight suite naming onBoard the module never imports'],
  ['Thirst', 'an attached untap-skip on an Aura the suite could not find on the enchanted creature'],
  ['Chromium', 'a rampage suite whose fire ends the game (a 7/6 flier attacking into the block)'],
  ['Apex Altisaur', 'an enrage fight whose damage the suite counts against the wrong baseline (the two damage heads)'],
  ['Intrepid Rabbit', 'an Offspring keyword line outside the row library (the wide dump read the token printing)'],
  ['Juri, Master of the Revue', 'a dies payload reading the dead source power (last known information)'],
  ['Starscape Cleric', 'an Offspring keyword line outside the row library (the wide dump read the token printing)'],
  ['Galadriel, Gift-Giver', 'a modal enters-or-attacks head whose counter the suite reads twice'],
  ['Vodalian Serpent', 'a cant-attack-unless suite walking past its own declare-attackers step'],
  ['Coruscation Mage', 'an Offspring keyword line outside the row library (the wide dump read the token printing)'],
  ['Sinuous Striker', 'an Eternalize keyword line outside the row library (the wide dump read the token printing)'],
  ['Melancholy', 'an attached untap-skip on an Aura the suite could not find on the enchanted creature'],
  // D429 - the classifier's static mirror (`ROW_STATICS`: can't be blocked / can't block / attacks each combat / the
  // untap-step skip / can't be countered) offered 32 more, each on a card whose OTHER line the row maker refuses - by
  // the wide run's reason (an Aura on a non-creature, a head outside the library, a filtered head's adjective, an untap
  // payment branch, an ability-word line, a cost the suite cannot fund).
  ['Confessor', 'a discard head by any player, which no card in the pool exercises: Whenever a player discards a card, you may gain 1 life.'],
  ['Dehydration', 'an Aura that enchants something other than a creature'],
  ['Entangling Vines', 'an Aura that enchants something other than a creature'],
  ['Glimmerdust Nap', 'an Aura that enchants something other than a creature'],
  ['Paradise Plume', 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever a player casts a spell of the chosen color, you may'],
  ['Perimeter Captain', 'trigger head not in the library: Whenever a creature you control with defender blocks, you may gain 2 l'],
  ['Sanctimony', 'trigger head not in the library: Whenever an opponent taps a Mountain for mana, you may gain 1 life.'],
  ['Shattered Angel', "a filtered enters head on an opponent's board"],
  ['Brass Gnat', 'a payment branch the suite cannot assert: untap'],
  ['Brass Man', 'a payment branch the suite cannot assert: untap'],
  ['Dormant Gomazoa', 'trigger head not in the library: Whenever you become the target of a spell, you may untap this creature'],
  ['Fear of Infinity', 'trigger head not in the library: Whenever an enchantment you control enters and whenever you fully unlo'],
  ['Goblin Dirigible', 'a payment branch the suite cannot assert: untap'],
  ['Goblin War Wagon', 'a payment branch the suite cannot assert: untap'],
  ['Park Heights Maverick', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature deals combat damage to a player or di'],
  ['Plumes of Peace', 'ability-word activated line: Forecast — {W}{U}, Reveal this card from'],
  ['Rot Farm Skeleton', 'cost: Mill four cards'],
  ['Spectral Prison', 'trigger head not in the library: When enchanted creature becomes the target of a spell, sacrifice this '],
  ['Stirge', 'ability-word activated line: Blood Drain — {1}{B}, Pay 1 life, Sacrif'],
  ['Surrak, Elusive Hunter', 'trigger head not in the library: Whenever a creature you control or a creature spell you control become'],
  ['Veilborn Ghoul', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Bloodghast', 'trigger payload not a pump: Return this card from your graveyard to the battlefield.'],
  ['Elaborate Firecannon', 'a payment branch the suite cannot assert: untap'],
  ['Falkenrath Forebear', 'cost: a sacrifice cost with no fixture the suite can put: Blood tokens'],
  ['Niv-Mizzet, Parun', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever a player casts an instant or sorcery spell, you dra'],
  ['Toski, Bearer of Secrets', 'a must-attacker beside a head whose test attacks with another creature'],
  // D428 - the triggering player: the 4 the selector offered once a payload could name the player its head named,
  // that the row maker refused by reason (a referent discard AT RANDOM 3 - the vocabulary refuses randomness under
  // a def, the standing rule; an attached static whose toughness pump kills the 2/2 Bears 1).
  ['Bottomless Pit', 'a player referent payload the vocabulary does not read: Target player discards a card at random.'],
  ['Hypnotic Specter', 'a player referent payload the vocabulary does not read: Target player discards a card at random.'],
  ['Rakdos Ringleader', 'a player referent payload the vocabulary does not read: Target player discards a card at random.'],
  ['Stab Wound', 'an attached static whose toughness pump kills the 2/2 Bears'],
  // D427 - the scoped shield: the 15 the selector offered once the shield read a source and a recipient set, that
  // the row maker refused by reason (a combat shield with no target the suite cannot prove 8 - it must attack; a
  // combat-only scoped shield the suite cannot prove 4 - the same; a combat-role clause 2; a cost 1) - the spells the
  // seam reads whole never enter the pool (the generator rows no spell).
  ['Frontline Strategist', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage non-Soldier creatures would deal this turn.'],
  ['Hidden Retreat', 'cost: Put a card from your hand on top of your library'],
  ['Horn of Deafening', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage that would be dealt by target creature this turn.'],
  ['Kor Haven', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage that would be dealt by target attacking creature this turn.'],
  ['Lady Evangela', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage that would be dealt by target creature this turn.'],
  ['Maze of Ith', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by that creature this turn.'],
  ['Maze of Shadows', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by that creature this turn.'],
  ['Resistance Fighter', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage target creature would deal this turn.'],
  ['Safeguard', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage that would be dealt by target creature this turn.'],
  ['Songstitcher', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage that would be dealt this turn by target attacking creature with flying.'],
  ['Cephalid Illusionist', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by target creature you control this turn.'],
  ['Shieldmage Elder', 'a shield with no target the suite cannot prove (it must attack): Prevent all damage target creature would deal this turn.'],
  ['Soratami Cloud Chariot', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by target creature you control this turn.'],
  // D426 - the conjunction: the 53 the selector offered once `X and Y.` read as two clauses that the row maker
  // refused by reason (a filtered head's adjective 11, a payload outside both readers 11, a head outside the library 9,
  // a queued discard the scaffold hand may not hold 4, a static line 4), the generator's two (a hand-size condition
  // beside a hand fixture, a tap cost beside a vocabulary self bounce); eight stale spell rows the guard named deleted.
  ['Wildgrowth Walker', 'trigger head not in the library: Whenever a creature you control explores, put a +1/+1 counter on this '],
  ['Al Bhed Salvagers', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another creature or artifact you c'],
  ['Archivist of Oghma', 'trigger head not in the library: Whenever an opponent searches their library, you gain 1 life and draw '],
  ['Arnyn, Deathbloom Botanist', 'a filtered head outside the closed reader (an adjective outside the list: you): Whenever a creature you control with power or toughness 1 or'],
  ['Attunement', 'a queued discard the scaffold hand may not hold: Discard four cards.'],
  ['Axelrod Gunnarson', 'a filtered head outside the closed reader (an adjective outside the list: dealt): Whenever a creature dealt damage by ~ this turn dies, you ga'],
  ['Battlewise Hoplite', 'trigger payload not a pump: Put a +1/+1 counter on this creature, then scry 1.'],
  ['Bazaar of Baghdad', 'a queued discard the scaffold hand may not hold: Discard three cards.'],
  ['Bazaar Trademage', 'a queued discard the scaffold hand may not hold: Discard three cards.'],
  ['Black Widow, Agile Avenger', 'trigger head not in the library: Whenever an opponent draws their second card each turn, put a +1/+1 co'],
  ['Bold Biochemist', 'a line that is neither an activated ability nor a library trigger: Power-up — {5}{U}: Put a +1/+1 counter on this creature and draw two c'],
  ['Burning Prophet', 'trigger payload not a pump: ~ gets +1/+0 until end of turn, then scry 1.'],
  ['Compassionate Healer', 'trigger payload not a pump: You gain 1 life and scry 1.'],
  ['Cyclopean Snare', 'a tap cost beside a vocabulary self bounce (the suite reads the tap after the return)'],
  ['Geyser Leaper', 'a line that is neither an activated ability nor a library trigger: Waterbend {4}: Draw a card, then discard a card.'],
  ['Hard Cover', 'a leftover line not among the printed lines: Enchanted creature gets +0/+2 and has'],
  ['Holy Cow', 'trigger payload not a pump: You gain 2 life and scry 1.'],
  ['Invasion of Dominaria // Serra Faithkeeper', 'multi-face or unusual layout'],
  ['Kraven the Hunter', 'a filtered head outside the closed reader (a qualifier outside the keyword list: the greatest power among creatures that player controls): Whenever a creature an opponent controls with the greatest p'],
  ['Lotho, Corrupt Shirriff', 'a filtered head outside the closed reader (an adjective outside the list: their): Whenever a player casts their second spell each turn, you lo'],
  ['Magus of the Bazaar', 'a queued discard the scaffold hand may not hold: Discard three cards.'],
  ['Pet Avengers', 'a line that is neither an activated ability nor a library trigger: Power-up — {6}{G}: Put a +1/+1 counter on this creature and create a 3'],
  ['Ragnarok, Divine Deliverance', 'multi-face or unusual layout'],
  ['Samite Herbalist', 'trigger payload not a pump: You gain 1 life and scry 1.'],
  ['Serum Visionary', 'trigger payload not a pump: Draw a card, then scry 2.'],
  ['Sphinx of Magosi', 'effect not a row kind: Draw a card, then put a +1/+1 counter on ~.'],
  ['Tenth District Legionnaire', 'trigger payload not a pump: Put a +1/+1 counter on this creature, then scry 1.'],
  ['Thrasher Brute', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another Warrior your team controls'],
  ['Trelasarra, Moon Dancer', 'trigger payload not a pump: Put a +1/+1 counter on ~ and scry 1.'],
  ['Ultron Drone', 'a line that is neither an activated ability nor a library trigger: Power-up — {6}: Put two +1/+1 counters on this creature and create a 2'],
  ['Valgavoth, Harrower of Souls', 'trigger head not in the library: Whenever an opponent loses life for the first time during each of thei'],
  ['Wakandan Tusker', 'trigger payload not a pump: You gain 1 life and scry 1.'],
  ['Boomer Scrapper', 'a leaves head whose subject is a token the arm cannot make: a token you control'],
  ['Carrot Cake', 'trigger head not in the library: When this artifact enters and when you sacrifice it, create a 1/1 whit'],
  ['Disinformation Campaign', "trigger head not in the library: Whenever you surveil, return this enchantment to its owner's hand."],
  ["Dovin's Acuity", 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast an instant spell during your main phase, y'],
  ['Entropic Eidolon', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Fleshtaker', 'trigger payload not a pump: You gain 1 life and scry 1.'],
  ['HYDRA Infiltration', 'an attack head on a card with no creature body: aCreatureAttacksAlone'],
  ['Market Gnome', "trigger head not in the library: When this creature is exiled from the battlefield while you're activat"],
  ['Nihilistic Glee', 'a hand-size condition beside a hand fixture (the generator cannot stage both)'],
  ['Ravenous Squirrel', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you sacrifice an artifact or creature, put a +1/+1 '],
  ['Serum Sovereign', 'effect not a row kind: Draw a card, then scry 2.'],
  ['Slimefoot, the Stowaway', 'a filtered head no fixture satisfies: a Saproling you control'],
  ['Syr Vondam, Sunstar Exemplar', 'trigger head not in the library: Whenever another creature you control dies or is put into exile, put a'],
  ['Trial of Knowledge', 'a filtered head no fixture satisfies: a Cartouche you control'],
  // D425 - the sacrificed self, the you scope and the opponent-or-planeswalker noun: the 21 the selector offered once
  // those read that the row maker refused by reason (a combat-role clause the suite has no fixture for 6, a payment
  // branch the suite cannot assert - damageEach under unless-you-pay 3, a filtered head's adjective 2), and the six its
  // port named (damage equal to its power from a sacrificed source - the dead-source gap, D421, one shape over).
  ['City of Brass', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this land becomes tapped, it deals 1 damage to you.'],
  ['Aerie Ouphes', 'a self-sacrifice on a creature that returns (persist / undying)'],
  ['Flame Elemental', 'damage equal to its power from a sacrificed source (last known information): the executor deals 0 from the graveyard (D425)'],
  ['Force of Nature', 'a payment branch the suite cannot assert: damageEach'],
  ['Ghitu Fire-Eater', 'damage equal to its power from a sacrificed source (last known information): the executor deals 0 from the graveyard (D425)'],
  ['Hasran Ogress', 'a payment branch the suite cannot assert: damageEach'],
  ['Heartfire Immolator', 'damage equal to its power from a sacrificed source (last known information): the executor deals 0 from the graveyard (D425)'],
  ['War-Torch Goblin', 'a vocabulary clause the suite has no fixture for: a combat-role clause'],
  ['Cinder Shade', 'damage equal to its power from a sacrificed source (last known information): the executor deals 0 from the graveyard (D425)'],
  ['Minion of Tevesh Szat', 'a payment branch the suite cannot assert: damageEach'],
  ['Minotaur Illusionist', 'damage equal to its power from a sacrificed source (last known information): the executor deals 0 from the graveyard (D425)'],
  ['Skarrgan Skybreaker', 'damage equal to its power from a sacrificed source (last known information): the executor deals 0 from the graveyard (D425)'],
  // D424 - the classifier reads as the row maker reads: the 184 the selector offered once the optional trigger, the
  // row kinds the vocabulary lacks, the attached keywords, the named self head and the activation restriction read,
  // that the row maker refused by reason (a head outside its library 54, a filtered head's adjective 32, a payload
  // outside both readers 28, an activated effect outside the row kinds 21, a cost 11), and the eight its port named.
  ['Runic Armasaur', 'trigger head not in the library: Whenever an opponent activates an ability of a creature or land that i'],
  ['Rot Wolf', 'a filtered head outside the closed reader (an adjective outside the list: dealt): Whenever a creature dealt damage by ~ this turn dies, you ma'],
  ['Adaptive Gemguard', 'cost: a tap cost with no fixture the suite can put: artifacts and/or creatures'],
  ['Amulet of Unmaking', 'cost: Exile this artifact'],
  ['Angelic Benediction', 'an attack head on a card with no creature body: aCreatureAttacksAlone'],
  ['Balemurk Leech', 'trigger head not in the library: Whenever an enchantment you control enters and whenever you fully unlo'],
  ['Bant Sojourners', 'a filtered head outside the closed reader (an adjective outside the list: you): When you cycle this card and when this creature dies, you ma'],
  ['Basilisk Gate', 'effect not a row kind: Target creature gets +X/+X until end of turn, where X is the number of Gates you control.'],
  ['Bone Dragon', 'cost: Exile seven other cards from your graveyard'],
  ['Bred for the Hunt', 'trigger head not in the library: Whenever a creature you control with a +1/+1 counter on it deals comba'],
  ["Chandra's Phoenix", 'trigger head not in the library: Whenever an opponent is dealt damage by a red instant or sorcery spell'],
  ['Charisma Bobblehead', 'effect not a row kind: Create X 1/1 white Soldier creature tokens, where X is the number of Bobbleheads you control.'],
  ['Compost', 'a put-into-graveyard head from anywhere with a filter no zone can answer: a black card'],
  ['Corpse Cur', 'trigger payload not a pump: Return target creature card with infect from your graveyard '],
  ["Cosi's Trickster", 'trigger head not in the library: Whenever an opponent shuffles their library, you may put a +1/+1 count'],
  ['Cruel Celebrant', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another creature or planeswalker y'],
  ['Curator of Mysteries', "a scry under the cycle-or-discard head: the cycling's own draw moves the library count the suite pins (D424)"],
  // D478 - the search row restored: the two the mirror offers that the wave cannot row.
  ['Shefet Monitor', 'an asking payload under the cycle head (the cycling ability sits under the trigger; the settle answers the ask) (D478)'],
  ['Krosan Tusker', 'an asking payload under the cycle head (the cycling ability sits under the trigger; the settle answers the ask) (D478)'],
  ['Explore the Underdark', 'a sorcery whose second sentence takes the initiative (a hand SpellDef, not the wave; the dungeon is not in the engine) (D478)'],
  // D482 - the player's sacrifice: the three the mirror offers that the wave cannot row.
  ['Abyssal Gorestalker', 'a queued sacrifice of more than one under an ETB head (the suite stages one fodder per player) (D482)'],
  ['Custodi Lich', 'trigger head not in the library: Whenever you become the monarch (D482)'],
  ['Trial of Ambition', 'a filtered head no fixture satisfies: a Cartouche you control (D482)'],
  // D483 - the two-zone search: the one the mirror offers that the wave cannot row.
  ['The First Doctor', 'a filtered cast head outside the closed reader (a spell with cascade) beside its two-zone search (D483)'],
  // D484 - the prompt continuation: the five the mirror offers that the wave cannot row.
  ['Surtland Frostpyre', 'a scry beside a sweep in one payload (the suite answers no scry; the continuation runs it) (D484)'],
  ['Greedy Freebooter', 'a scry beside a token in one payload (the suite answers no scry; the continuation runs it) (D484)'],
  ['Keen Buccaneer', 'a self counter behind a loot in one payload (the row maker asks the vocabulary in its ~ form, the probe keyed the printed one) (D484)'],
  ['Ninja of the Hand', 'an ability-word activated line (Power-up) beside its discard-then-draw head (D484)'],
  ['Siren of the Silent Song', 'a mill beside a queued discard in one payload (the suite counts the graveyard delta of the mill alone) (D484)'],
  // D479 - the tribal target: the twenty-three the mirror offers that the wave cannot row.
  ["Alpha Kavu", "a tribal target with no vanilla fixture of its subtype (Kavu) (D479)"],
  ["Coastal Drake", "a tribal target with no vanilla fixture of its subtype (Kavu) (D479)"],
  ["Ezekiel Sims, Spider-Totem", "a tribal target with no vanilla fixture of its subtype (Spider) (D479)"],
  ["Lady Spider, Maybelle Reilly", "a tribal target with no vanilla fixture of its subtype (Spider) (D479)"],
  ["Halo Hunter", "a tribal target with no vanilla fixture of its subtype (Angel) (D479)"],
  ["Nezumi Shadow-Watcher", "a tribal target with no vanilla fixture of its subtype (Ninja) (D479)"],
  ["Higure, the Still Wind", "a tribal target with no vanilla fixture of its subtype (Ninja) (D479)"],
  ["One-Clown Band", "a tribal target with no vanilla fixture of its subtype (Robot) (D479)"],
  ["Villainous Hideout", "a tribal target with no vanilla fixture of its subtype (Villain) (D479)"],
  ["Blinkmoth Nexus", "a tribal target with no vanilla fixture of its subtype (Blinkmoth) (D479)"],
  ["Isao, Enlightened Bushi", "a tribal target with no vanilla fixture of its subtype (Samurai) (D479)"],
  ["Greenside Watcher", "a tribal target on a land subtype the suite has no still fixture for (Gate - every Gate enters tapped) (D479)"],
  ["Thraben Exorcism", "an instant whose target list carries a keyword-qualified alternative (creature with disturb) - a hand SpellDef (D479)"],
  ["Tivadar of Thorn", "a filtered head no fixture satisfies (Tivadar) (D479)"],
  ["Balthor the Stout", "a tribal anthem outside the static vocabulary (Other Barbarian creatures get +1/+1) beside its tribal pump (D479)"],
  ["Private Eye", "a tribal anthem outside the static vocabulary (Other Detectives you control get +1/+1) (D479)"],
  ["Inside Source", "a token outside TOKEN_TABLE (the 2/2 white and blue Detective) (D479)"],
  ["Phylath, World Sculptor", "a counted noun with a supertype (a Plant token for each basic land you control) (D479)"],
  ['Curiosity', 'trigger head not in the library: Whenever enchanted creature deals damage to an opponent, you may draw '],
  ['Curious Cadaver', 'a sacrifice head no fixture the suite can sacrifice satisfies: a Clue'],
  ['Deathless Ancient', 'a graveyard return beside another cost piece'],
  ['Deathless Behemoth', 'cost: a sacrifice cost with no fixture the suite can put: Eldrazi Scions'],
  ['Dungeon Crawler', 'trigger head not in the library: Whenever you complete a dungeon, you may return this card from your gr'],
  ['Enduring Scalelord', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on another creature you co'],
  ['Eyes of the Wisent', 'an opponent-cast head with a timing rider (during your turn) the arm cannot stage: the game ends before the fire (D424)'],
  ['Fathom Mage', 'trigger head not in the library: Whenever a +1/+1 counter is put on this creature, you may draw a card.'],
  ['Fear', 'an Aura that enchants something other than a creature'],
  ['Fishliver Oil', 'an Aura that enchants something other than a creature'],
  ['Flourishing Defenses', 'trigger head not in the library: Whenever a -1/-1 counter is put on a creature, you may create a 1/1 gr'],
  ['Frilled Mystic', 'a vocabulary effect the suite cannot assert: counter'],
  ['Gangrenous Goliath', 'a graveyard return beside another cost piece'],
  ['Glen Elendra Pranksters', "a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast a spell during an opponent's turn, you may"],
  ['Goldfury Strider', 'cost: a tap cost with no fixture the suite can put: artifacts and/or creatures'],
  ['Gravity Negator', "a payment branch the suite cannot assert beside its another-target line (the ask is not the payment's) (D424)"],
  ['Great Hall of Starnheim', 'cost: Sacrifice this land and a creature you control'],
  ['Guildscorn Ward', 'a protection quality the derive does not read (protection from multicolored) (D424)'],
  ['Gwendlyn Di Corci', 'effect not a row kind: Target player discards a card at random.'],
  ['Heidar, Rimewind Master', 'activation condition: if you control four or more snow permanents'],
  ['Herd Baloth', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on this creature, you may '],
  ['Holy Mantle', 'a protection quality the derive does not read (protection from creatures) (D424)'],
  ['Infiltration Lens', 'trigger head not in the library: Whenever equipped creature becomes blocked by a creature, you may draw'],
  ['Invisible Woman, Sue Storm', 'trigger head not in the library: Whenever you put one or more +1/+1 counters on one or more other Heroe'],
  ['Isperia, Supreme Judge', 'trigger head not in the library: Whenever a creature attacks you or a planeswalker you control, you may'],
  ['Keen Sense', 'trigger head not in the library: Whenever enchanted creature deals damage to an opponent, you may draw '],
  ['Kithkin Mourncaller', 'a filtered head outside the closed reader (an adjective outside the list: attacking): Whenever an attacking Kithkin or Elf is put into your gravey'],
  ['Kothophed, Soul Hoarder', 'a filtered head outside the closed reader (an adjective outside the list: permanent): Whenever a permanent owned by another player is put into a g'],
  ['Mazirek, Kraul Death Priest', 'trigger head not in the library: Whenever a player sacrifices another permanent, put a +1/+1 counter on'],
  ['Mephitic Draught', 'a filtered head outside the closed reader (an adjective outside the list: this): When this artifact enters or is put into a graveyard from th'],
  ['Midnight Scavengers', 'multi-face or unusual layout'],
  ['Mirkwood Bats', 'trigger head not in the library: Whenever you create or sacrifice a token, each opponent loses 1 life.'],
  ["Mirri's Guile", 'trigger payload not a pump: Look at the top three cards of your library, then put them b'],
  ['Mister Fantastic, Reed Richards', 'trigger head not in the library: Whenever one or more tokens you control enter, you may draw a card.'],
  ['Mold Adder', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever an opponent casts a blue or black spell, you may pu'],
  ['Mortician Beetle', 'trigger head not in the library: Whenever a player sacrifices a creature, you may put a +1/+1 counter o'],
  ["Nadier's Nightblade", 'a leaves head whose subject is a token the arm cannot make: a token you control'],
  ['Naya Sojourners', 'a filtered head outside the closed reader (an adjective outside the list: you): When you cycle this card and when this creature dies, you ma'],
  ['Ophidian Eye', 'trigger head not in the library: Whenever enchanted creature deals damage to an opponent, you may draw '],
  ['Oracle of Dust', "cost: Put a card an opponent owns from exile into that player's graveyard"],
  ['Ovalchase Daredevil', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Priest of the Haunted Edge', 'effect not a row kind: Target creature gets -X/-X until end of turn, where X is the number of snow lands you control.'],
  ['Pugnacious Hammerskull', "trigger head not in the library: Whenever this creature attacks while you don't control another Dinosau"],
  ['Regeneration', 'an Aura that enchants something other than a creature'],
  ['Reparations', 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever an opponent casts a spell that targets you or a cre'],
  ['Sanctum Seeker', 'trigger head not in the library: Whenever a Vampire you control attacks, each opponent loses 1 life and'],
  ['Scheming Aspirant', 'trigger head not in the library: Whenever you proliferate, each opponent loses 2 life and you gain 2 li'],
  ['Scurry Oak', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on this creature, you may '],
  ['Setessan Starbreaker', 'trigger payload not a pump: Destroy target Aura.'],
  ["Shapers' Sanctuary", 'trigger head not in the library: Whenever a creature you control becomes the target of a spell or abili'],
  ['Sharuum the Hegemon', 'a filtered head no fixture satisfies: Sharuum'],
  ['Skemfar Avenger', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever another nontoken Elf or Berserker you control dies,'],
  ['Skyfire Phoenix', 'a filtered head outside the closed reader (an adjective outside the list: your): When you cast your commander, return this card from your gra'],
  ['Snake Pit', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever an opponent casts a blue or black spell, you may cr'],
  ['Sneaky Snacker', 'trigger head not in the library: When you draw your third card in a turn, return this card from your gr'],
  ['Spirit Mantle', 'a protection quality the derive does not read (protection from creatures) (D424)'],
  ['Squee, Goblin Nabob', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Stinging Cave Crawler', 'a line that is neither an activated ability nor a library trigger: Descend 4 — Whenever this creature attacks, if there are four or more '],
  ['Stone Docent', 'effect not a row kind: You gain 2 life. Surveil 1.'],
  ['Strength Bobblehead', 'effect not a row kind: Put X +1/+1 counters on target creature, where X is the number of Bobbleheads you control.'],
  ['Sunshot Militia', 'cost: a tap cost with no fixture the suite can put: artifacts and/or creatures'],
  ['Sylvan Echoes', 'trigger head not in the library: Whenever you clash and win, you may draw a card.'],
  ['Tomebound Lich', 'trigger head not in the library: Whenever this creature enters or deals combat damage to a player, draw'],
  ['Unblinking Bleb', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another permanent is turned face u'],
  ['Urborg Mindsucker', 'effect not a row kind: Target opponent discards a card at random.'],
  ['Verdant Eidolon', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Voidwing Hybrid', 'trigger head not in the library: When you proliferate, return this card from your graveyard to your han'],
  ['Windreader Sphinx', 'trigger head not in the library: Whenever a creature with flying attacks, you may draw a card.'],
  ['Yathan Tombguard', 'trigger head not in the library: Whenever a creature you control with a counter on it deals combat dama'],
  ['Afterburner Expert', 'ability-word activated line: Exhaust — {2}{G}{G}: Put two +1/+1 count'],
  ['Aurora Eidolon', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Baku Altar', 'trigger payload not a pump: Put a ki counter on this artifact.'],
  ["Bladewing's Thrall", 'trigger payload not a pump: Return this card from your graveyard to the battlefield.'],
  ['Blasting Station', "an untap under the any-creature-enters head beside its sacrifice-cost ping: the suite's game ends before the fire (D424)"],
  ['Carapace', 'an enchanted-creature payload after sacrificing the Aura (last known information)'],
  ['Chimeric Egg', 'trigger payload not a pump: Put a charge counter on this artifact.'],
  ['Crawling Sensation', 'trigger head not in the library: Whenever one or more land cards are put into your graveyard from anywh'],
  ['Devourer of Memory', 'trigger head not in the library: Whenever one or more cards are put into your graveyard from your libra'],
  ['Dogged Detective', 'trigger head not in the library: Whenever an opponent draws their second card each turn, you may return'],
  ["Dragon's Hoard", 'trigger payload not a pump: Put a gold counter on this artifact.'],
  ['Dreadhound', 'trigger head not in the library: Whenever a creature dies or a creature card is put into a graveyard fr'],
  ["Evershrike's Gift", 'cost: Blight 2'],
  ['Garza Zol, Plague Queen', 'a filtered head outside the closed reader (an adjective outside the list: dealt): Whenever a creature dealt damage by ~ this turn dies, put a '],
  ['Golem Foundry', 'trigger payload not a pump: Put a charge counter on this artifact.'],
  ['Hapatra, Vizier of Poisons', 'trigger head not in the library: Whenever you put one or more -1/-1 counters on a creature, create a 1/'],
  ['Hoofprints of the Stag', 'trigger payload not a pump: Put a hoofprint counter on this enchantment.'],
  ['Invasion of Moag // Bloomwielder Dryads', 'multi-face or unusual layout'],
  ['Ior Ruin Expedition', 'trigger payload not a pump: Put a quest counter on this enchantment.'],
  ['Kelpie Guide', 'activation condition: if you control eight or more lands'],
  ['Khalni Heart Expedition', 'trigger payload not a pump: Put a quest counter on this enchantment.'],
  ['Kheru Bloodsucker', 'a filtered head outside the closed reader (an adjective outside the list: you): Whenever a creature you control with toughness 4 or greater '],
  ['Kyscu Drake', 'cost: Sacrifice this creature and a creature named Spitting Drake'],
  ['Lullmage Mentor', 'trigger head not in the library: Whenever a spell or ability you control counters a spell, you may crea'],
  ['Merfolk Pupil', 'a graveyard activation whose payload reads the card on the battlefield: loot'],
  ['Midnight Entourage', 'a line that is neither an activated ability nor a library trigger: Other Aetherborn you control get +1/+1.'],
  ['Nakia, Wakandan Operative', 'a filtered head outside the closed reader (an adjective outside the list: your): Whenever your commander enters, you become the monarch.'],
  ['Nomad Decoy', 'effect not a row kind: Tap two target creatures.'],
  ['Nucklavee', 'trigger payload not a pump: Return target red sorcery card from your graveyard to your h'],
  ['Nyx Weaver', 'cost: Exile this creature'],
  ['Olivia, Opulent Outlaw', 'trigger head not in the library: Whenever one or more outlaws you control deal combat damage to a playe'],
  ['Preacher of the Schism', 'trigger head not in the library: Whenever this creature attacks the player with the most life or tied f'],
  ['Purple Pentapus', 'a graveyard return beside another cost piece'],
  ['Quest for the Gemblades', 'trigger head not in the library: Whenever a creature you control deals combat damage to a creature, you'],
  ['Quest for the Gravelord', 'trigger payload not a pump: Put a quest counter on this enchantment.'],
  ['Sandstorm Eidolon', 'trigger payload not a pump: Return this card from your graveyard to your hand.'],
  ['Screams from Within', 'trigger payload not a pump: Return this card from your graveyard to the battlefield.'],
  ['Serum Tank', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this artifact or another artifact enters, put a cha'],
  ['Shipwreck Sifters', 'trigger head not in the library: Whenever you discard a Spirit card or a card with disturb, put a +1/+1'],
  ['Sidisi, Brood Tyrant', 'trigger head not in the library: Whenever one or more creature cards are put into your graveyard from y'],
  ['Silversmote Ghoul', 'trigger payload not a pump: Return this card from your graveyard to the battlefield tapp'],
  ['Skola Grovedancer', 'a put-into-graveyard head from anywhere with a filter no zone can answer: a land card'],
  ["Sleeper's Robe", 'trigger head not in the library: Whenever enchanted creature deals combat damage to an opponent, you ma'],
  ['Soul Stair Expedition', 'trigger payload not a pump: Put a quest counter on this enchantment.'],
  ['Spore Flower', 'a shield with no target the suite cannot prove (it must attack): Prevent all combat damage that would be dealt this turn.'],
  ['Stamina', 'an enchanted-creature payload after sacrificing the Aura (last known information)'],
  ['Stocking the Pantry', 'trigger head not in the library: Whenever you put one or more +1/+1 counters on a creature you control,'],
  ['Sunspring Expedition', 'trigger payload not a pump: Put a quest counter on this enchantment.'],
  ['Temporal Isolation', 'a line that is neither an activated ability nor a library trigger: Prevent all damage that would be dealt by enchanted creature.'],
  ['Tenured Inkcaster', 'trigger head not in the library: Whenever a creature you control with a +1/+1 counter on it attacks, ea'],
  ['Thrull Retainer', 'an enchanted-creature payload after sacrificing the Aura (last known information)'],
  ['Ultron the Annihilator', 'trigger head not in the library: Whenever Ultron enters or attacks, create a 2/2 colorless Robot Villai'],
  ['Unquestioned Authority', 'a protection quality the derive does not read (protection from creatures) (D424)'],
  ['Vat of Rebirth', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever another artifact or creature you control is put int'],
  ['Vela the Night-Clad', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever Vela or another creature you control leaves the bat'],
  ['Vraska Joins Up', 'trigger head not in the library: Whenever a legendary creature you control deals combat damage to a pla'],
  ['Charforger', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever another creature or artifact you control is put int'],
  ['Glass-Cast Heart', 'trigger head not in the library: Whenever one or more Vampires you control attack, create a Blood token'],
  ['Lead Pipe', 'a filtered head outside the closed reader (an adjective outside the list: equipped): Whenever equipped creature dies, each opponent loses 1 life.'],
  ['Staff of the Storyteller', 'trigger head not in the library: Whenever you create one or more creature tokens, put a story counter o'],
  ['Unshakable Tail', 'trigger head not in the library: When this creature enters and at the beginning of your upkeep, surveil'],
  // D422 - the counterspell family reads: the 11 the selector offered once the uncounterable line was the face's own,
  // that the row maker refused, by reason (spells whose OTHER line the vocabulary does not read - the generator rows no
  // spell; the conditional uncounterables - Spell mastery, an X of 5 or more - stay properties the face does not carry).
  ['Fry', 'a spell line outside the vocabulary (5 damage to target creature or planeswalker that is white or blue - a colour qualifier on the target) beside its uncounterable line'],
  ['Martyr of Frost', 'an activated cost outside the reader (Reveal X blue cards from your hand)'],
  ['Obliterate', 'a spell line outside the vocabulary (destroy all artifacts, creatures, and lands - a three-type sweep that cannot be regenerated) beside its uncounterable line'],
  ['Raze to the Ground', 'a spell line outside the vocabulary (destroy target artifact, then draw if its mana value was 1 or less - a conditional draw on the destroyed card) beside its uncounterable line'],
  ['Thought Distortion', 'a spell line outside the vocabulary (reveal a hand, exile all noncreature nonland cards from hand and graveyard) beside its uncounterable line'],
  ['Banefire', 'a spell line outside the vocabulary (X damage to any target, uncounterable and unpreventable if X is 5 or more - a conditional property)'],
  ['Exquisite Firecraft', 'a spell line outside the vocabulary (Spell mastery - uncounterable on a graveyard count, a conditional property)'],
  // D421 - the self subject reads: the 67 the selector offered once the classifier read a payload's self subject
  // (this creature deals, it gets, on this creature) as the vocabulary does, that the row maker refused, by reason
  // (the counted payloads under attack heads and the trigger heads outside the library among them).
  ['Akroan Hoplite', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +X/+0 until end of turn, where X is the number of attacking creatures you control.)'],
  ['Angelic Captain', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+1 until end of turn for each other attacking Ally.)'],
  ['Bag End Porter', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +X/+X until end of turn, where X is the number of legendary creatures you control.)'],
  ['Brazen Blademaster', 'a while-you-control condition outside the closed reader (an adjective outside the list (two: two or more artifacts)'],
  ['Brazen Dwarf', 'trigger head not in the library (Whenever you roll one or more dice, this creature deals 1 damage to ea)'],
  ['Bull Aurochs', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+0 until end of turn for each other attacking Aurochs.)'],
  ['Burning Vengeance', 'a filtered head outside the closed reader (an adjective outside the list (spell: Whenever you cast a spell from your graveyard, this enchantm)'],
  ["Cenn's Heir", 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+1 until end of turn for each other attacking Kithkin.)'],
  ['Cleaving Skyrider', 'a counted noun with a refinement the suite cannot stage (~ deals X damage to any target, where X is the number of attacking creatures.)'],
  ['Close Quarters', 'trigger head not in the library (Whenever a creature you control becomes blocked, this enchantment deal)'],
  ['Cybermat', 'a counted payload under a head whose arm sizes the board (attacksNotBlocked) (~ gets +X/+0 until end of turn, where X is the number of attacking artifact creatures.)'],
  ['Dire Fleet Captain', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+1 until end of turn for each other attacking Pirate.)'],
  ['Dreamstalker Manticore', "a filtered head outside the closed reader (an adjective outside the list (your: Whenever you cast your first spell during each opponent's tu)"],
  ['Elite Javelineer', 'a vocabulary clause the suite has no fixture for (a combat-role clause)'],
  ['Firefist Adept', 'a counted noun with no witness the suite can put (~ deals X damage to target creature an opponent controls, where X is the number of Wiza...)'],
  ['Firespitter Whelp', 'a filtered head outside the closed reader (an adjective outside the list (or: Whenever you cast a noncreature or Dragon spell, this creatu)'],
  ['Fungusaur', 'a self payload on a creature the test damage kills (toughness 2)'],
  ['Furnace Celebration', 'a payment under a sacrifice head whose fire funds the price (the lands the suite reads are not the ones spent)'],
  // D485 - the token copy: the one the wave cannot row.
  ['Copy Catchers', 'a trigger head outside the library (Whenever you surveil) beside its token copy (D485)'],
  // D487 - the spell copy: the three the seam made offerable and the wave cannot row.
  ['Dualcaster Mage', 'a copy-spell body under a head: the suite cannot stage a spell on the stack to copy nor answer the copy new-targets question (D487)'],
  ['Sigil Tracer', 'a copy-spell body under a head: the suite cannot stage a spell on the stack to copy nor answer the copy new-targets question (D487)'],
  ['Uyo, Silent Prophet', 'a copy-spell body under a head: the suite cannot stage a spell on the stack to copy nor answer the copy new-targets question (D487)'],
  // D488 - populate: the eight the seam made offerable and the wave cannot row.
  ['Growing Ranks', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Life Finds a Way', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Selesnya Eulogist', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Song of the Worldsoul', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Muster the Departed', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Nesting Dovehawk', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Vitu-Ghazi Guildmage', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  ['Xavier Sal, Infested Captain', 'a populate under a head: the suite cannot stage a creature token to copy nor assert the copy (D488)'],
  // D489 - suspend: the four the seam made offerable and the row maker refused.
  ['Ith, High Arcanist', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by that creature this turn. (D489)'],
  ['Nantuko Shaman', 'an intervening if the armed board already meets (not this wave): you control no tapped lands (D489)'],
  ['Watcher of Hours', "trigger head not in the library (a tick in exile, D489): Whenever you remove a time counter from this card while it's exiled, surveil 1."],
  ['Dinosaurs on a Spaceship', "trigger head not in the library (a tick in exile, D489): Whenever a time counter is removed from this card while it's exiled, create a 2/2 red and white Dinosaur creature token with flying and haste."],
  // D491 - the from-hand free cast: the four the seam made offerable and the row maker refused.
  ['Maelstrom Archangel', 'a from-hand grant under a head: the suite cannot stage a hand and answer the chooser (castFromHand, D491)'],
  ['Omnispell Adept', 'a from-hand grant under a head: the suite cannot stage a hand and answer the chooser (castFromHand, D491)'],
  ['Wildfire Eternal', 'a from-hand grant under a head: the suite cannot stage a hand and answer the chooser (castFromHand, D491)'],
  ['Yue, the Moon Spirit', 'a line that is neither an activated ability nor a library trigger: Waterbend {5}, {T}: You may cast a noncreature spell from your hand without paying its mana cost. (D491)'],
  // D543 - double counters: `Double the number of ... counters on ...` is the engine's now (the vocabulary's verb); what stays is a doubling card the row maker refuses for another line.
  ['Sisterhood of Karn', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast (D543)'],
  ['Sazh Katzroy', 'the row maker: a doubling of the previous clause\'s object (not this wave): Double the number of +1/+1 counters on t (D543)'],
  ['She-Hulk, Attorney-at-Law', 'the row maker: a line that is neither an activated ability nor a library trigger: Power-up — {6}{G/W}: Put a +1/+1 counter on ~. Then double the number of +1/+1 counters on each creature you control. (D543)'],
  // D542 - the pairing keywords: a Partner, Friends forever, Background or Doctor pairing line is the engine's now (deck construction the validator enforces); what stays is a partner commander the row maker refuses for another line.
  ['Miara, Thorn of the Glade', 'the row maker: two payment prompts on one row (the payer lands are shared) (D542)'],
  ['Splinter, the Mentor', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: ~): Whenever ~ or another nontoken creature you control leaves the battlefield, create a Mutagen token. (D542)'],
  ['Leela, Sevateem Warrior', 'the row maker: trigger head not in the library: Whenever an opponent draws a card except the first one they draw in each of their draw steps, put a +1/+1 counter on ~. (D542)'],
  ['Alora, Merry Thief', 'the row maker: a combat-role clause under a head whose declaration is not self attacking (the co-attacker rides an (D542)'],
  ['Alharu, Solemn Ritualist', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: you): Whenever a nontoken creature you control with a +1/+1 counter on it dies, create a 1/1 white Spirit creature token with flying. (D542)'],
  ['Kraum, Ludevic\'s Opus', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: their): Whenever an opponent casts their second spell each turn, draw a card. (D542)'],
  ['Brinelin, the Moon Kraken', 'the row maker: trigger head not in the library: When ~ enters and whenever you cast a spell with mana value 6 or greater, you may return target nonland permanent to its owner\'s hand. (D542)'],
  ['Graham O\'Brien', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast (D542)'],
  ['Rose Noble', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast a Doctor spell or creature spell with doctor\'s companion, draw a card. (D542)'],
  ['Francisco, Fowl Marauder', 'the row maker: trigger head not in the library: Whenever one or more Pirates you control deal damage to a player, ~ explores. (D542)'],
  ['Yoshimaru, Ever Faithful', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: legendary): Whenever another legendary permanent you control enters, put a +1/+1 counter on ~. (D542)'],
  ['Joel, Resolute Survivor', 'the row maker: a filtered head no fixture satisfies: a creature token (D542)'],
  ['Keskit, the Flesh Sculptor', 'the row maker: cost: a sacrifice cost with no fixture the suite can put: artifacts and/or creatures (D542)'],
  // D541 - madness: the Madness line is the engine's now (the discard's exile, the trigger's cast for the madness cost); what stays is a madness spell whose other sentence the vocabulary does not read.
  ['Circular Logic', 'a spell with a line outside the vocabulary: Counter target spell unless its controller pays {1} for each card in your graveyard - a counter-unless-pays priced by a count (D541)'],
  // D540 - foretell: the Foretell line is the engine's now (the special action, the cast from exile); what stays is a foretell spell whose other sentence the vocabulary does not read, and a permanent the row maker refuses for another line.
  ['Battle Mammoth', 'the row maker: trigger head not in the library: Whenever a permanent you control becomes the target of a spell or ability an opponent controls, you may draw a card. (D540)'],
  ['Sozin\'s Comet', 'a spell with a line outside the vocabulary: Each creature you control gains firebending 5 until end of turn - a firebending grant (D540)'],
  ['Lifestream\'s Blessing', 'a spell with a line outside the vocabulary: Draw X cards, where X is the greatest power among creatures you controlled as you cast this spell. If this spell was cast from exile, you gain twice X life - a count fixed at the cast, and a cast-from-exile gate (D540)'],
  ['Spectral Deluge', 'a spell with a line outside the vocabulary: Return each creature your opponents control with toughness X or less to its owner\'s hand, where X is the number of Islands you control - a mass bounce under a counted toughness (D540)'],
  ['Poison the Cup', 'a spell with a line outside the vocabulary: Destroy target creature. If this spell was foretold, scry 2 - a foretold gate (D540)'],
  ['Tales of the Ancestors', 'a spell with a line outside the vocabulary: Each player with fewer cards in hand than the player with the most cards in hand draws cards equal to the difference - a per-player count against the most (D540)'],
  // D539 - learn: `Learn.` is the engine's now (the optional rummage - no cards outside the game); what stays is a learn card the row maker refuses for another line, and Retriever Phoenix's `if you would learn` replacement.
  ['Dream Strix', 'the row maker: trigger head not in the library: When this creature becomes the target of a spell, sacrifice it. (D539)'],
  ['Sparring Regimen', 'the row maker: a combat-role clause under a head whose declaration is not self attacking (the co-attacker rides an attack head alone) - Whenever you attack, put a +1/+1 counter on target attacking creature (D539)'],
  // D538 - rebound: the Rebound line is the engine's now (the resolution's exile, the upkeep's free cast); what stays is a rebound spell whose other sentence the vocabulary does not read.
  ['Ephemerate', 'a spell with a line outside the vocabulary: Exile target creature you control, then return it to the battlefield under its owner\'s control - a flicker (D538)'],
  ['Survival Cache', 'a spell with a line outside the vocabulary: Then if you have more life than an opponent, draw a card - a life comparison after the gain (D538)'],
  ['Blessed Reincarnation', 'a spell with a line outside the vocabulary: That player reveals cards from the top of their library until a creature card is revealed - a reveal-until for the exiled creature (D538)'],
  ['Recurring Insight', 'a spell with a line outside the vocabulary: Draw cards equal to the number of cards in target opponent\'s hand - a count off a target\'s hand (D538)'],
  // D537 - retrace and jump-start: the keyword line is the engine's now (a graveyard cast for the mana cost and a discard); what stays is a retrace or jump-start spell whose other sentence the vocabulary does not read.
  ['Reality Scramble', 'a spell with a line outside the vocabulary: Put target permanent you own on the bottom of your library. Reveal cards from the top of your library until you reveal a card that shares a card type - a reveal-until by a shared type (D537)'],
  ['Beacon Bolt', 'a spell with a line outside the vocabulary: Beacon Bolt deals damage to target creature equal to the total number of instant and sorcery cards you own in exile and in your graveyard - a count over two zones (D537)'],
  ['Risk Factor', 'a spell with a line outside the vocabulary: Target opponent may have Risk Factor deal 4 damage to them. If that player doesn\'t, you draw three cards - an opponent\'s punisher choice (D537)'],
  ['Decaying Time Loop', 'a spell with a line outside the vocabulary: Discard all the cards in your hand, then draw that many cards - a that-many draw after a discard (D537)'],
  ['Glamerdye', 'a spell with a line outside the vocabulary: Change the text of target spell or permanent by replacing all instances of one color word with another - a text change (D537)'],
  ['Start the TARDIS', 'a spell with a line outside the vocabulary: You may planeswalk - the planar die (D537)'],
  ['Sonic Assault', 'a spell with a line outside the vocabulary: Sonic Assault deals 2 damage to that creature\'s controller - the target\'s controller as a referent (D537)'],
  // D536 - storm: the Storm line is the engine's now on an instant or a sorcery (the keyword table's cast trigger, the copies with new targets); what stays is a storm spell whose other sentence the vocabulary does not read, and a permanent spell's storm (its copies would be tokens).
  ['Galvanic Relay', 'a spell with a line outside the vocabulary: Exile the top card of your library. During your next turn, you may play that card. - a play permission during the next turn (D536)'],
  // D535 - buyback: the Buyback line is the engine's now (charged at cast, the resolved spell back to its owner's hand); what stays is a buyback spell whose other sentence the vocabulary does not read.
  ['Worthy Cause', 'a spell with a line outside the vocabulary: You gain life equal to the sacrificed creature\'s toughness. - the additional cost\'s creature read after it is gone (last known information) (D535)'],
  ['Verdant Touch', 'a spell with a line outside the vocabulary: Target land becomes a 2/2 creature that\'s still a land. - an animated land with no duration (D535)'],
  ['Whim of Volrath', 'a spell with a line outside the vocabulary: Change the text of target permanent by replacing all instances of one color word with another - a text change (D535)'],
  // D534 - coin flip: the caster's flip and its won and lost branches are the engine's now; what stays is a flip by another player or by each player, several flips, a head that watches flips, and every flip line whose card the row maker refuses for another line.
  ["Puppet's Verdict", 'the row maker: a spell with a line outside the vocabulary: Flip a coin. If you win the flip, destroy all creatures with (D534)'],
  ['Chaotic Strike', 'the row maker: a spell with a line outside the vocabulary: Cast this spell only during combat after blockers are declar (D534)'],
  ['Krark, the Thumbless', 'the row maker: trigger payload not a pump: Flip a coin. If you lose the flip, return that spell to its (D534)'],
  ['Game of Chaos', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ["Sorcerer's Strongbox", 'the row maker: effect not a row kind: Flip a coin. If you win the flip, sacrifice this artifact and draw three cards. (D534)'],
  ['Ral, Monsoon Mage // Ral, Leyline Prodigy', 'a flip line under a shape the row maker never reached (`Whenever you cast an instant or sorcery spell during your tu`) (D534)'],
  ['Setzer, Wandering Gambler', 'the row maker: trigger payload not a pump: Create The Blackjack, a legendary 3/3 colorless Vehicle arti (D534)'],
  ['Chaotic Goo', 'the row maker: trigger payload not a pump: Flip a coin. If you win the flip, put a +1/+1 counter on thi (D534)'],
  ['Edgar, King of Figaro', 'the row maker: a line that is neither an activated ability nor a library trigger: Two-Headed Coin — The first time you flip one or more coins each tur (D534)'],
  ['Mogg Assassin', 'the row maker: effect not a row kind: You choose target creature an opponent controls, and that opponent chooses target creature. Flip a coin. If you (D534)'],
  ['Ral Zarek, Guest Lecturer', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Goblin Assassin', 'a flip by another player or by each player (`each player flips a coin`) - the rule reads the caster\'s own flip (D534)'],
  ['Negative Zone Portal', 'the row maker: effect not a row kind: Exile target card from an opponent\'s graveyard. If it\'s a creature card, draw a card. (D534)'],
  ['Goblin Psychopath', 'the row maker: trigger payload not a pump: Flip a coin. If you lose the flip, the next time it would de (D534)'],
  ['Rakdos, the Showstopper', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ["Squee's Revenge", 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Zndrsplt, Eye of Wisdom', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ["Yusri, Fortune's Flame", 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Mijae Djinn', 'the row maker: trigger payload not a pump: Flip a coin. If you lose the flip, remove this creature from (D534)'],
  ['Mutalith Vortex Beast', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Crooked Scales', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, destroy target creature an opponent controls. If you lose the flip, destroy ta (D534)'],
  ['Goblin Traprunner', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Goblin Kaboomist', 'the row maker: a leftover line not among the printed lines: At the beginning of your upkeep, create a colorles (D534)'],
  ['Ral Zarek', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Tide of War', 'the row maker: trigger head not in the library: Whenever one or more creatures block, flip a coin. If you win the flip (D534)'],
  ['Two-Headed Giant', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Odds // Ends', 'the row maker: multi-face or unusual layout (D534)'],
  ['Skittish Valesk', 'the row maker: trigger payload not a pump: Flip a coin. If you lose the flip, turn this creature face d (D534)'],
  ['Goblin Archaeologist', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, destroy target artifact and untap this creature. If you lose the flip, sacrifi (D534)'],
  ['Frenetic Efreet', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, this creature phases out. If you lose the flip, sacrifice this creature. (D534)'],
  ['Plasma Caster', 'the row maker: an attack head on a card with no creature body: equippedCreatureAttacks (D534)'],
  ['Volatile Rig', 'the row maker: trigger payload not a pump: Flip a coin. If you lose the flip, it deals 4 damage to each (D534)'],
  ['Mirror March', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Bottle of Suleiman', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, create a 5/5 colorless Djinn artifact creature token with flying. If you lose (D534)'],
  ['Goblin Artisans', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, draw a card. If you lose the flip, counter target artifact spell you control t (D534)'],
  ['Tavern Scoundrel', 'the row maker: trigger head not in the library: Whenever you win a coin flip, create two Treasure tokens. (D534)'],
  ['Breeches, the Blastmaker', 'the row maker: trigger payload not a pump: You may sacrifice an artifact. If you do, flip a coin. When (D534)'],
  ['Planar Chaos', 'a flip by another player or by each player (`each player flips a coin`) - the rule reads the caster\'s own flip (D534)'],
  ['Crazed Firecat', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Krark, the Thumbless // Krark, the Thumbless', 'the row maker: multi-face or unusual layout (D534)'],
  ['Boompile', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, destroy all nonland permanents. (D534)'],
  ['Fiery Gambit', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Aleatory', 'the row maker: a spell with a line outside the vocabulary: Cast this spell only during combat after blockers are declar (D534)'],
  ['Creepy Doll', 'the row maker: trigger payload not a pump: Flip a coin. If you win the flip, destroy that creature. (D534)'],
  ["Krark's Thumb", 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Ydwen Efreet', 'the row maker: trigger payload not a pump: Flip a coin. If you lose the flip, remove this creature from (D534)'],
  ['Wirefly Hive', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, create a 2/2 colorless Insect artifact creature token with flying named Wirefl (D534)'],
  ['Okaun, Eye of Chaos // Okaun, Eye of Chaos', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Invert Polarity', 'the row maker: a spell with a line outside the vocabulary: Choose target spell, then flip a coin. If you win the flip, (D534)'],
  ['Goblin Lyre', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, this artifact deals damage to target opponent or planeswalker equal to the num (D534)'],
  ['Orcish Captain', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, target Orc creature gets +2/+0 until end of turn. If you lose the flip, it get (D534)'],
  ['Karplusan Minotaur', 'the row maker: a line that is neither an activated ability nor a library trigger: Cumulative upkeep—Flip a coin. (D534)'],
  ['Goblin Bomb', 'the row maker: trigger payload not a pump: Flip a coin. If you win the flip, put a fuse counter on this (D534)'],
  ["Krark's Thumb // Krark's Thumb", 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Goblin Kites', 'the row maker: effect not a row kind: Target creature you control with toughness 2 or less gains flying until end of turn. Flip a coin at the beginnin (D534)'],
  ['Impulsive Maneuvers', 'the row maker: trigger head not in the library: Whenever a creature attacks, flip a coin. If you win the flip, the nex (D534)'],
  ['Molten Sentry', 'the row maker: a line that is neither an activated ability nor a library trigger: As this creature enters, flip a coin. If the coin comes up heads, th (D534)'],
  ['Goblin Festival', 'the row maker: effect not a row kind: ~ deals 1 damage to any target. Flip a coin. If you lose the flip, choose one of your opponents. That player gai (D534)'],
  ['Goblin Bangchuckers', 'the row maker: effect not a row kind: Flip a coin. If you win the flip, this creature deals 2 damage to any target. If you lose the flip, this creatur (D534)'],
  ['Fickle Efreet', 'the row maker: trigger payload not a pump: Flip a coin at end of combat. If you lose the flip, an oppon (D534)'],
  ['Fighting Chance', 'the row maker: a spell with a line outside the vocabulary: For each blocking creature, flip a coin. If you win the flip (D534)'],
  ['Okaun, Eye of Chaos', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Zndrsplt, Eye of Wisdom // Zndrsplt, Eye of Wisdom', 'several flips (`Flip three coins. For each flip you win, ...`, `until you lose a flip`) - the rule reads one flip (D534)'],
  ['Desperate Gambit', 'the row maker: a spell with a line outside the vocabulary: Choose a source you control and flip a coin. If you win the (D534)'],
  // D533 - monstrosity and adapt: `Monstrosity N`, the monstrous mark, its head and condition, and `Adapt N` are the engine's now; what stays is an X amount, a cost-reduction sentence on the activation, a compound or shortened-name head, the counters-put head beside adapt, and every line whose card the row maker refuses for another line.
  ['Pteramander', 'a cost-reduction sentence on the activation (`This ability costs {1} less to activate for each ...`) - the row maker reads no activation discount (D533)'],
  ['Grim Giganotosaurus', 'a cost-reduction sentence on the activation (`This ability costs {1} less to activate for each ...`) - the row maker reads no activation discount (D533)'],
  ['Incubation Druid', 'the row maker: effect not a row kind: Add one mana of any type that a land you control could produce. If this creature has a +1/+1 counter on it, add (D533)'],
  ['Fetid Gargantua', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Growth-Chamber Guardian', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Sealock Monster', 'the row maker: trigger payload not a pump: Target land becomes an Island in addition to its other types (D533)'],
  ['Emperor of Bones', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Jetpack Death Seltzer', 'the row maker: a line that is neither an activated ability nor a library trigger: {TK}{TK} — Trample (D533)'],
  ['Alpha Deathclaw', 'a compound head (`When ~ enters or becomes monstrous`) - the library holds the two heads apart (D533)'],
  ['Domesticated Hydra', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Stoneshock Giant', 'the row maker: trigger payload not a pump: Creatures without flying your opponents control can\'t block (D533)'],
  ['Scuttlegator', 'the row maker: a conditional body outside the static vocabulary: ~ can attack as though it didn\'t have defender (D533)'],
  ['Nemesis of Mortals', 'a cost-reduction sentence on the activation (`This ability costs {1} less to activate for each ...`) - the row maker reads no activation discount (D533)'],
  ['Vitality Hunter', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Shipbreaker Kraken', 'the row maker: a condition outside the closed vocabulary: you control this creature (D533)'],
  ['Polukranos, World Eater', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Stormbreath Dragon', 'the row maker: trigger payload not a pump: ~ deals damage to each opponent equal to the number of cards (D533)'],
  ['Clay Golem', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Etherium Pteramander', 'a cost-reduction sentence on the activation (`This ability costs {1} less to activate for each ...`) - the row maker reads no activation discount (D533)'],
  ["Kalemne's Captain", 'the row maker: trigger payload not a pump: Exile all artifacts and enchantments. (D533)'],
  ['Protector of the Wastes', 'a compound head (`When ~ enters or becomes monstrous`) - the library holds the two heads apart (D533)'],
  ['Colossus of Akros', 'the row maker: a conditional body outside the static vocabulary: ~ has trample and can attack as though it didn\'t h (D533)'],
  ['Ember Swallower', 'the row maker: a queued sacrifice of more than one: Each player sacrifices three lands of their choice. (D533)'],
  ['Hundred-Handed One', 'the row maker: a conditional body outside the static vocabulary: ~ has reach and can block an additional ninety-nin (D533)'],
  ['Hydra Broodmaster', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Evolution Witness', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Death Kiss', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Maester Seymour', 'an X amount on the keyword action (`Monstrosity X` / `Adapt X`) - the activation\'s X is not read (D533)'],
  ['Basking Broodscale', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Temperamental Oozewagg', 'the row maker: a line that is neither an activated ability nor a library trigger: Modified creatures you control have trample. (D533)'],
  ['Jetfire, Ingenious Scientist // Jetfire, Air Guardian', 'the row maker: multi-face or unusual layout (D533)'],
  ['Benthic Biomancer', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Polis Crusher', 'the row maker: a player referent payload the vocabulary does not read: If this creature is monstrous, destroy target enchantment ta (D533)'],
  ['Swarmborn Giant', 'the row maker: trigger head not in the library: When you\'re dealt combat damage, sacrifice this creature. (D533)'],
  ['Arbor Colossus', 'the row maker: trigger payload not a pump: Destroy target creature with flying an opponent controls. (D533)'],
  ['Trollbred Guardian', 'the row maker: a line that is neither an activated ability nor a library trigger: Each creature you control with a +1/+1 counter on it has trample. (D533)'],
  ['Zegana, Utopian Speaker', 'the row maker: an intervening if outside the closed reader: you control another creature with a +1/+1 counter on it (D533)'],
  ['Dreamdrinker Vampire', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Hydra Trainer', 'the row maker: trigger payload not a pump: Target creature gets +X/+X until end of turn, where X is the (D533)'],
  ['Cursed Wombat', 'the row maker: a line that is neither an activated ability nor a library trigger: Permanents you control have "Whenever one or more +1/+1 counters are (D533)'],
  ['Unruly Krasis', 'the row maker: trigger payload not a pump: Have the base power and toughness of another target creature (D533)'],
  ['Giggling Skitterspike', 'the row maker: trigger payload not a pump: Blocks, or becomes the target of a spell, it deals damage eq (D533)'],
  ['Hythonia the Cruel', 'a becomes-monstrous head under the card\'s shortened name (`When Hythonia becomes monstrous`) - the self reference is not read (D533)'],
  ['Expanding Ooze', 'the row maker: trigger payload not a pump: Put a +1/+1 counter on target modified creature you control. (D533)'],
  ['Wildfire Cerberus', 'the row maker: trigger payload not a pump: ~ deals 2 damage to each opponent and each creature they con (D533)'],
  ['Knighted Myr', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Sharktocrab', 'the counters-put head beside the adaptation (`Whenever one or more +1/+1 counters are put on ~`) - a head the library does not hold (D533)'],
  ['Skatewing Spy', 'the row maker: a line that is neither an activated ability nor a library trigger: Each creature you control with a +1/+1 counter on it has flying. (D533)'],
  // D532 - control's other forms: the compound threaten, control given to a target player or opponent, and owners taking back what they own are the engine's now; what stays is a control given to a player the rule does not name, the source given by a bare `it`, the owners' form the suite cannot stage, a give-away over a scope, and every give-away line whose card the row maker refuses for another line.
  ['Custody Battle', 'the row maker: a payment branch the suite cannot assert: giveControl (a quoted grant the scrub had hidden from the residue script) (D532)'],
  ['Karona, False God', 'the row maker: a player referent payload the vocabulary does not read: Target player untaps ~ and gains control of it. (D532)'],
  ['Coveted Falcon', 'the row maker: trigger payload not a pump: Gain control of target permanent you own but don\'t control. (D532)'],
  ['Homeward Path', 'owners take back what they own (`each player gains control of all ... they own`) - the engine runs it, but the suite cannot stage a permanent under a (D532)'],
  ['Sky Swallower', 'a control given over every object of a scope (`target opponent gains control of all other permanents you control`) - the rule gives one object (D532)'],
  ['Stiltzkin, Moogle Merchant', 'the row maker: effect not a row kind: Target opponent gains control of another target permanent you control. If they do, you draw a card. (D532)'],
  ['Wishclaw Talisman', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Order of Succession', 'the row maker: a spell with a line outside the vocabulary: Choose left or right. Starting with you and proceeding in th (D532)'],
  ['Rohgahh of Kher Keep', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Aminatou, the Fateshifter', 'a control given over every object of a scope (`target opponent gains control of all other permanents you control`) - the rule gives one object (D532)'],
  ['Jon Irenicus, Shattered One', 'the row maker: a leftover line not among the printed lines: At the beginning of your end step, target opponent (D532)'],
  ['Khârn the Betrayer', 'the row maker: a line that is neither an activated ability nor a library trigger: Berzerker — ~ attacks or blocks each combat if able. (D532)'],
  ['Crown of Doom', 'the row maker: trigger head not in the library: Whenever a creature attacks you or a planeswalker you control, it gets (D532)'],
  ['Bill Ferny, Bree Swindler', 'the row maker: a mode payload: Target opponent gains control of target Horse you control. I (D532)'],
  ['Brooding Saurian', 'owners take back what they own (`each player gains control of all ... they own`) - the engine runs it, but the suite cannot stage a permanent under a (D532)'],
  ['Scrambleverse', 'a control given over every object of a scope (`target opponent gains control of all other permanents you control`) - the rule gives one object (D532)'],
  ['Rogue Skycaptain', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Zidane, Tantalus Thief', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Blim, Comedic Genius', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Akroan Horse', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Zedruu the Greathearted', 'the row maker: trigger payload not a pump: You gain X life and draw X cards, where X is the number of p (D532)'],
  ['Measure of Wickedness', 'the row maker: a put-into-graveyard head from anywhere with a filter no zone can answer: another card (D532)'],
  ['Trostani Discordant', 'owners take back what they own (`each player gains control of all ... they own`) - the engine runs it, but the suite cannot stage a permanent under a (D532)'],
  ['Alicia Masters, Skilled Sculptor', 'owners take back what they own (`each player gains control of all ... they own`) - the engine runs it, but the suite cannot stage a permanent under a (D532)'],
  ['Witch Engine', 'the row maker: effect not a row kind: Add {B}{B}{B}{B}. Target opponent gains control of this creature. (D532)'],
  ['Sleeper Agent', 'the source given by a bare `it` (`target opponent gains control of it`) - the rule reads `~` / `this creature`, and a bare `it` may be another object (D532)'],
  ['Rainbow Vale', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Discerning Financier', 'a control given to a player the rule does not name (`that player / an opponent gains control of`) - the rule reads a target player or opponent only (D532)'],
  ['Fractured Loyalty', 'the row maker: trigger head not in the library: Whenever enchanted creature becomes the target of a spell or ability, (D532)'],
  ['Goblin Cadets', 'the source given by a bare `it` (`target opponent gains control of it`) - the rule reads `~` / `this creature`, and a bare `it` may be another object (D532)'],
  ['Yes Man, Personal Securitron', 'the row maker: effect not a row kind: Target opponent gains control of ~. When they do, you draw two cards and put a quest counter on ~. (D532)'],
  ['Jinxed Choker', 'the row maker: trigger payload not a pump: Target opponent gains control of this artifact and puts a ch (D532)'],
  ['Herald of Leshrac', 'a control given over every object of a scope (`target opponent gains control of all other permanents you control`) - the rule gives one object (D532)'],
  ['Inniaz, the Gale Force', 'the row maker: effect not a row kind: Attacking creatures with flying get +1/+1 until end of turn. (D532)'],
  ['Domineering Will', 'a give-away line under a shape the row maker never reached (`Target player gains control of up to three target nonattacki`) (D532)'],
  ['Avarice Amulet', 'the row maker: a leftover line not among the printed lines: Equipped creature gets +2/+0 and has vigilance and (D532)'],
  ['Chaos Lord', 'the row maker: trigger payload not a pump: Target opponent gains control of this creature if the number (D532)'],
  ['Treacherous Pit-Dweller', 'the source given by a bare `it` (`target opponent gains control of it`) - the rule reads `~` / `this creature`, and a bare `it` may be another object (D532)'],
  // D531 - control with a duration and the exchange: control taken for good, control held while the source stays or stays yours, and the exchange of the source or a target with another target are the engine's now; what stays is a control given to another player, a duration outside those two, a control over every object of a scope, an exchange of two targets under one phrase, a target per opponent, and every control line whose card the row maker refuses for another line.
  ['Admiral Beckett Brass', 'the row maker: trigger payload not a pump: Gain control of target nonland permanent controlled by a pla (D531)'],
  ['Oko, Thief of Crowns', 'the row maker: effect not a row kind: Target artifact or creature loses all abilities and becomes a green Elk creature with base power and toughness 3 (D531)'],
  ['The Wretched', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Seize the Spotlight', 'the row maker: a spell with a line outside the vocabulary: Each opponent chooses fame or fortune. For each player who c (D531)'],
  ['Unexpected Request', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Rowan, Fearless Sparkmage', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Guardian Beast', 'the row maker: a conditional body outside the static vocabulary: noncreature artifacts you control can\'t be enchant (D531)'],
  ['Sorin of House Markov // Sorin, Ravenous Neonate', 'the row maker: multi-face or unusual layout (D531)'],
  ['Coveted Jewel', 'the row maker: trigger head not in the library: Whenever one or more creatures an opponent controls attack you and are (D531)'],
  ['Agent of Treachery', 'the row maker: an intervening if outside the closed reader: you control three or more permanents you don\'t own (D531)'],
  ['Karrthus, Tyrant of Jund', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Tevesh Szat, Doom of Fools', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Rootwater Matriarch', 'a control duration outside the two the engine reads (`for as long as` + that creature is enchanted) (D531)'],
  ['The Nipton Lottery', 'the row maker: a spell with a line outside the vocabulary: Choose a creature at random. You gain control of that creatu (D531)'],
  ['Midnight Crusader Shuttle', 'the row maker: an attack head on a card with no creature body: vehicleAttacks (D531)'],
  ['Risky Move', 'the row maker: a player referent payload the vocabulary does not read: Target player gains control of this enchantment. (D531)'],
  ['Mark of Mutiny', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Put a +1/ (D531)'],
  ['Hellkite Tyrant', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Treasure Nabber', 'the row maker: trigger head not in the library: Whenever an opponent taps an artifact for mana, gain control of that a (D531)'],
  ['Willow Satyr', 'a control duration outside the two the engine reads (`for as long as` + you control ~ and ~ remains tapped) (D531)'],
  ['Shifting Borders', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Turf War', 'the row maker: trigger payload not a pump: For each player, put a contested counter on target land that (D531)'],
  ['Aethersnatch', 'the row maker: a spell with a line outside the vocabulary: Gain control of target spell. You may choose new targets for (D531)'],
  ['Stolen Uniform', 'the row maker: a spell with a line outside the vocabulary: Choose target creature you control and target Equipment. Gai (D531)'],
  ['Pyreswipe Hawk', 'the row maker: trigger payload not a pump: ~ gets +X/+0 until end of turn, where X is the greatest mana (D531)'],
  ['Rags // Riches', 'the row maker: multi-face or unusual layout (D531)'],
  ['Flayer of Loyalties', 'the row maker: trigger payload not a pump: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Aura Thief', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Nicol Bolas, Planeswalker', 'the row maker: effect not a row kind: ~ deals 7 damage to target player or planeswalker. That player or that planeswalker\'s controller discards seven (D531)'],
  ['Evangelize', 'a spell with a line outside the vocabulary: Gain control of target creature of an opponent\'s choice they control. - its Buyback line is the engine\'s (D535)'],
  ['Grip of Phyresis', 'the row maker: a spell with a line outside the vocabulary: Gain control of target Equipment, then create a 0/0 black Ph (D531)'],
  ['Captivating Vampire', 'the row maker: effect not a row kind: Gain control of target creature. It becomes a Vampire in addition to its other types. (D531)'],
  ['Dack Fayden', 'the row maker: effect not a row kind: You get an emblem with "Whenever you cast a spell that targets one or more permanents, gain control of those per (D531)'],
  ['Jeering Instigator', 'the row maker: trigger payload not a pump: If it\'s your turn, gain control of another target creature u (D531)'],
  ['Yuffie, Materia Hunter', 'the row maker: trigger payload not a pump: Gain control of target noncreature artifact for as long as y (D531)'],
  ['Possession Engine', 'a control duration outside the two the engine reads (`for as long as` + you control this Vehicle. That creature can\'t atta) (D531)'],
  ['Crown of Empires', 'the row maker: effect not a row kind: Tap target creature. Gain control of that creature instead if you control artifacts named Scepter of Empires and (D531)'],
  ['Contested War Zone', 'the row maker: trigger head not in the library: Whenever a creature deals combat damage to you, that creature\'s contro (D531)'],
  ['Vedalken Shackles', 'a control duration outside the two the engine reads (`for as long as` + ~ remains tapped) (D531)'],
  ['Tahngarth, First Mate', 'the row maker: trigger head not in the library: Whenever an opponent attacks with one or more creatures, if ~ is tappe (D531)'],
  ['Coercive Recruiter', 'the row maker: trigger payload not a pump: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Shield Broker', 'a control duration outside the two the engine reads (`for as long as` + it has a shield counter on it) (D531)'],
  ['Opportunistic Dragon', 'the row maker: trigger payload not a pump: Choose target Human or artifact an opponent controls. For as (D531)'],
  ['Cultural Exchange', 'the row maker: a spell with a line outside the vocabulary: Choose any number of creatures target player controls. Choos (D531)'],
  ['Dominus of Fealty', 'the row maker: trigger payload not a pump: Gain control of target permanent until end of turn. If you d (D531)'],
  ['Thrull Champion', 'the row maker: a line that is neither an activated ability nor a library trigger: Thrull creatures get +1/+1. (D531)'],
  ['Mob Rule', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Witch Hunt', 'the row maker: a line that is neither an activated ability nor a library trigger: Players can\'t gain life. (D531)'],
  ['Preacher', 'the row maker: a line that is neither an activated ability nor a library trigger: You may choose not to untap this creature during your untap step. (D531)'],
  ['Ghazbán Ogre', 'the row maker: an intervening if outside the closed reader: a player has more life than each other player (D531)'],
  ['Sokenzan Renegade', 'the row maker: an intervening if outside the closed reader: a player has more cards in hand than each other player (D531)'],
  ['Crag Saurian', 'the row maker: trigger head not in the library: Whenever a source deals damage to this creature, that source\'s control (D531)'],
  ['Cunning Bandit // Azamuki, Treachery Incarnate', 'the row maker: multi-face or unusual layout (D531)'],
  ['Drooling Ogre', 'the row maker: trigger payload not a pump: That player gains control of this creature. (D531)'],
  ['Shifting Grift', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Dominating Vampire', 'the row maker: trigger payload not a pump: Gain control of target creature with mana value less than or (D531)'],
  ['Reins of Power', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Geyadrone Dihada', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Word of Seizing', 'the row maker: a spell with a line outside the vocabulary: Split second (As long as this spell is on the stack, players (D531)'],
  ['Emrakul, the World Anew', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Willbreaker', 'the row maker: trigger head not in the library: Whenever a creature an opponent controls becomes the target of a spell (D531)'],
  ['Memnarch', 'the row maker: effect not a row kind: Target permanent becomes an artifact in addition to its other types. (D531)'],
  ['Twist Allegiance', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Expropriate', 'the row maker: a spell with a line outside the vocabulary: Council\'s dilemma — Starting with you, each player votes for (D531)'],
  ["Legacy's Allure", 'a control line under a shape the row maker never reached (`Sacrifice ~: Gain control of target creature with power less`) (D531)'],
  ['Rubinia Soulsinger', 'a control duration outside the two the engine reads (`for as long as` + you control ~ and ~ remains tapped) (D531)'],
  ['Kain, Traitorous Dragoon', 'the row maker: trigger payload not a pump: That player gains control of ~. If they do, you draw that ma (D531)'],
  ['Catch // Release', 'the row maker: multi-face or unusual layout (D531)'],
  ['Systems Override', 'the row maker: a spell with a line outside the vocabulary: Gain control of target artifact or creature until end of tur (D531)'],
  ['Juxtapose', 'the row maker: a spell with a line outside the vocabulary: You and target player exchange control of the creature you e (D531)'],
  ['Assault Suit', 'the row maker: an attached static body outside the vocabulary: gets +2/+2, has haste, can\'t attack you or planesw (D531)'],
  ['Varchild, Betrayer of Kjeldor', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Riptide Entrancer', 'the row maker: a player referent payload the vocabulary does not read: You may sacrifice it. If you do, gain control of target crea (D531)'],
  ['Welcome to the Fold', 'a spell with a line outside the vocabulary: If this spell\'s madness cost was paid, instead gain control of that creature if its toughness is X or less - a madness-paid gate (D541; D531 named the Madness line, which reads since D541)'],
  ['Skyfire Kirin', 'the row maker: trigger payload not a pump: Gain control of target creature with that spell\'s mana value (D531)'],
  ['Volatile Stormdrake', 'the row maker: a line that is neither an activated ability nor a library trigger: Flying, hexproof from activated and triggered abilities (D531)'],
  ['Insurrection', 'the row maker: a spell with a line outside the vocabulary: Untap all creatures and gain control of them until end of tu (D531)'],
  ['Emrakul, the Promised End', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ costs {1} less to cast for each card type among cards in your grav (D531)'],
  ['Swooping Pteranodon', 'the row maker: trigger payload not a pump: Gain control of target creature an opponent controls until e (D531)'],
  ['Wild Dogs', 'the row maker: an intervening if outside the closed reader: a player has more life than each other player (D531)'],
  ['Mutinous Massacre', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Ashiok, Sculptor of Fears', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Disharmony', 'the row maker: a spell with a line outside the vocabulary: Cast this spell only during combat before blockers are decla (D531)'],
  ['Twisted Fealty', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Gilt-Leaf Archdruid', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ["Bucknard's Everfull Purse", 'the row maker: effect not a row kind: Roll a d4 and create a number of Treasure tokens equal to the result. The player to your right gains control of (D531)'],
  ["Blue Sun's Twilight", 'a control line under a shape the row maker never reached (`Gain control of target creature with mana value X or less. I`) (D531)'],
  ['Magus of the Unseen', 'the row maker: effect not a row kind: Untap target artifact an opponent controls and gain control of it until end of turn. It gains haste until end of (D531)'],
  ['Awaken the Sleeper', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Merieke Ri Berit', 'the row maker: effect not a row kind: Gain control of target creature for as long as you control ~. When ~ leaves the battlefield or becomes untapped, (D531)'],
  ['Hithlain Rope', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ can\'t be sacrificed. (D531)'],
  ['Cytoplast Manipulator', 'a control line under a shape the row maker never reached (`{U}, {T}: Gain control of target creature with a +1/+1 count`) (D531)'],
  ['Oft-Nabbed Goat', 'the row maker: effect not a row kind: Draw a card. Gain control of this creature and put a -1/-1 counter on it. Only your opponents may activate this (D531)'],
  ['Temporary Insanity', 'a control line under a shape the row maker never reached (`Untap target creature with power less than the number of car`) (D531)'],
  ['Traitorous Instinct', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Ray of Command', 'the row maker: a spell with a line outside the vocabulary: Untap target creature an opponent controls and gain control (D531)'],
  ['Commandeer', 'the row maker: a spell with a line outside the vocabulary: Gain control of target noncreature spell. You may choose new (D531)'],
  ['Nihiloor', 'the row maker: trigger payload not a pump: For each opponent, tap up to one untapped creature you contr (D531)'],
  ['Mass Mutiny', 'a control change with a target per opponent (`For each opponent, gain control of up to one target ...`) - a target group per player the reader does no (D531)'],
  ['Scarwood Bandits', 'the row maker: effect not a row kind: Unless an opponent pays {2}, gain control of target artifact for as long as this creature remains on the battlef (D531)'],
  ['Seasinger', 'a control duration outside the two the engine reads (`for as long as` + you control ~ and ~ remains tapped) (D531)'],
  ['Price of Loyalty', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Frenzied Fugue', 'the row maker: trigger head not in the library: When this Aura enters and at the beginning of your upkeep, gain contro (D531)'],
  ['Yasova Dragonclaw', 'the row maker: trigger payload not a pump: You may pay {1}{U/R}{U/R}. If you do, gain control of target (D531)'],
  ['Call for Aid', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Elrond of the White Council', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Wild Mammoth', 'the row maker: an intervening if outside the closed reader: a player controls more creatures than each other player (D531)'],
  ['Flash Conscription', 'the row maker: a spell with a line outside the vocabulary: Untap target creature and gain control of it until end of tu (D531)'],
  ['Besmirch', 'the row maker: a spell with a line outside the vocabulary: Until end of turn, gain control of target creature and it ga (D531)'],
  ['Gauntlets of Chaos', 'the row maker: effect not a row kind: Exchange control of target artifact, creature, or land you control and target permanent an opponent controls tha (D531)'],
  ['Djinn of Infinite Deceits', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Olivia Voldaren', 'the row maker: effect not a row kind: ~ deals 1 damage to another target creature. That creature becomes a Vampire in addition to its other types. Put (D531)'],
  ['Grab the Reins', 'a control line under a shape the row maker never reached (`• Until end of turn, you gain control of target creature and`) (D531)'],
  ["Loki's Scepter", 'the row maker: trigger payload not a pump: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Switcheroo', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Role Reversal', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Goatnap', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Siren of the Fanged Coast', 'the row maker: a line that is neither an activated ability nor a library trigger: Tribute 3 (D531)'],
  ['Tentative Connection', 'the row maker: a spell with a line outside the vocabulary: This spell costs {3} less to cast if you control a creature (D531)'],
  ['Firbolg Flutist', 'the row maker: trigger payload not a pump: Gain control of target creature you don\'t control until end (D531)'],
  ['Tibalt, the Fiend-Blooded', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['The Beast, Deathless Prince', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ enters tapped with six stun counters on it. (D531)'],
  ['Charisma', 'a control duration outside the two the engine reads (`for as long as` + this Aura remains on the battlefield) (D531)'],
  ['Legerdemain', 'the row maker: a spell with a line outside the vocabulary: Exchange control of target artifact or creature and another (D531)'],
  ['Vislor Turlough', 'a control duration outside the two the engine reads (`for as long as` + they control it) (D531)'],
  ["Kitsune, Dragon's Daughter", 'the row maker: a filtered head outside the closed reader (an adjective outside the list: ~): Whenever ~ enters or deals combat damage to a player, you (D531)'],
  ['Empress Galina', 'the row maker: a vocabulary clause the suite has no fixture for: no fixture for target legendary permanent (D531)'],
  ['Spinal Embrace', 'the row maker: a spell with a line outside the vocabulary: Cast this spell only during combat. (D531)'],
  ['Press into Service', 'the row maker: a spell with a line outside the vocabulary: Support 2. (Put a +1/+1 counter on each of up to two target (D531)'],
  ['Infernal Captor', 'the row maker: a line that is neither an activated ability nor a library trigger: Exploit (D531)'],
  ['Edea, Possessed Sorceress', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: you): Whenever a creature you control but don\'t own dies, ret (D531)'],
  ['Pumpkin Bombs', 'the row maker: effect not a row kind: Draw three cards, then put a fuse counter on this artifact. It deals damage equal to the number of fuse counters (D531)'],
  ['Contested Game Ball', 'the row maker: trigger head not in the library: Whenever you\'re dealt combat damage, the attacking player gains contro (D531)'],
  ["Giant's Grasp", 'a control duration outside the two the engine reads (`for as long as` + this Aura remains on the battlefield) (D531)'],
  ['Might Makes Right', 'the row maker: an intervening if outside the closed reader: you control each creature on the battlefield with the greate (D531)'],
  ['Iroh, Tea Master', 'the row maker: trigger payload not a pump: Have target opponent gain control of target permanent you co (D531)'],
  ['Goatnapper', 'the row maker: trigger payload not a pump: Untap target Goat and gain control of it until end of turn. (D531)'],
  ['Helm of Possession', 'a control duration outside the two the engine reads (`for as long as` + you control ~ and ~ remains tapped) (D531)'],
  ["Chef's Kiss", 'a control line under a shape the row maker never reached (`Gain control of target spell that targets only a single perm`) (D531)'],
  ['Stilt-Man, Towering Terror', 'the row maker: a leftover line not among the printed lines: Whenever one or more Villains you control deal com (D531)'],
  ['Reptilian Recruiter', 'the row maker: trigger payload not a pump: Choose target creature. If that creature\'s power is 2 or les (D531)'],
  ["Puca's Mischief", 'the row maker: trigger payload not a pump: Exchange control of target nonland permanent you control and (D531)'],
  ['Orcish Squatters', 'the row maker: trigger payload not a pump: Gain control of target land defending player controls for as (D531)'],
  ['Kellogg, Dangerous Mind', 'the row maker: cost: Sacrifice five Treasures (D531)'],
  ['Angrath, the Flame-Chained', 'the row maker: effect not a row kind: Gain control of target creature until end of turn. Untap it. It gains haste until end of turn. Sacrifice it at t (D531)'],
  ['Power of Persuasion', 'the row maker: a spell with a line outside the vocabulary: Choose target creature an opponent controls, then roll a d20 (D531)'],
  ['Gilded Drake', 'the row maker: trigger payload not a pump: Exchange control of this creature and up to one target creat (D531)'],
  ['Mascot Interception', 'a control line under a shape the row maker never reached (`Gain control of target creature until end of turn. Untap tha`) (D531)'],
  ['Old Man of the Sea', 'a control duration outside the two the engine reads (`for as long as` + ~ remains tapped and that creature\'s power remains) (D531)'],
  ['Hot Pursuit', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Caught Red-Handed', 'the row maker: a spell with a line outside the vocabulary: This spell can\'t be countered. (This includes by the ward ab (D531)'],
  ['Harness by Force', 'the row maker: a spell with a line outside the vocabulary: Strive — This spell costs {2}{R} more to cast for each targe (D531)'],
  ['Loxodon Peacekeeper', 'the row maker: trigger payload not a pump: The player with the lowest life total gains control of this (D531)'],
  ['Confusion in the Ranks', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: artifact,): Whenever an artifact, creature, or enchantment en (D531)'],
  ['Slicer, Hired Muscle // Slicer, High-Speed Antagonist', 'the row maker: multi-face or unusual layout (D531)'],
  ['Sudden Substitution', 'the row maker: a spell with a line outside the vocabulary: Split second (As long as this spell is on the stack, players (D531)'],
  ['Starke of Rath', 'the row maker: effect not a row kind: Destroy target artifact or creature. That permanent\'s controller gains control of Starke. (D531)'],
  ['Conjured Currency', 'the row maker: trigger payload not a pump: Exchange control of this enchantment and target permanent yo (D531)'],
  ['Molten Primordial', 'a control change with a target per opponent (`For each opponent, gain control of up to one target ...`) - a target group per player the reader does no (D531)'],
  ['Traitorous Greed', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Alexios, Deimos of Kosmos', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ attacks each combat if able, can\'t be sacrificed, and can\'t attack (D531)'],
  ['Thalakos Deceiver', 'the row maker: a payment branch the suite cannot assert: control (D531)'],
  ['Bond of Passion', 'a control line under a shape the row maker never reached (`Gain control of target creature until end of turn. Untap tha`) (D531)'],
  ['Callous Oppressor', 'a control duration outside the two the engine reads (`for as long as` + ~ remains tapped) (D531)'],
  ['Loki, God of Lies', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast a spell that targets only a single (D531)'],
  ['Infernal Denizen', 'the row maker: trigger payload not a pump: Sacrifice two Swamps. If you can\'t, tap this creature, and a (D531)'],
  ['Eriette, the Beguiler', 'a control duration outside the two the engine reads (`for as long as` + that Aura is attached to it) (D531)'],
  ["Sakashima's Will", 'a control line under a shape the row maker never reached (`• Target opponent chooses a creature they control. You gain `) (D531)'],
  ['Hideous Taskmaster', 'a control change with a target per opponent (`For each opponent, gain control of up to one target ...`) - a target group per player the reader does no (D531)'],
  ['Peer Pressure', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Tolarian Entrancer', 'the row maker: an item referent payload the suite does not stage: control (D531)'],
  ['Sibling Rivalry', 'the row maker: a spell with a line outside the vocabulary: Gain control of target artifact or creature until end of tur (D531)'],
  ['Broadcast Takeover', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Wellspring', 'the row maker: trigger payload not a pump: Gain control of enchanted land until end of turn. (D531)'],
  ['Take for a Ride', 'the row maker: a spell with a line outside the vocabulary: Take for a Ride has flash as long as you\'ve committed a crim (D531)'],
  ["Lullmage's Domination", 'a control line under a shape the row maker never reached (`Gain control of target creature with mana value X.`) (D531)'],
  ['Daring Thief', 'the row maker: trigger payload not a pump: Exchange control of target nonland permanent you control and (D531)'],
  ['Emberwilde Djinn', 'the row maker: a player referent payload the vocabulary does not read: Target player may pay {R}{R} or 2 life. If the player does, (D531)'],
  ["Jabari's Influence", 'the row maker: a spell with a line outside the vocabulary: Cast this spell only after combat. (D531)'],
  ['Spawnbroker', 'the row maker: trigger payload not a pump: Exchange control of target creature you control and target c (D531)'],
  ['Dihada, Binder of Wills', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Eldrazi Obligator', 'the row maker: trigger payload not a pump: You may pay {1}{C}. If you do, gain control of target creatu (D531)'],
  ['Kukemssa Pirates', 'the row maker: trigger payload not a pump: Gain control of target artifact defending player controls. I (D531)'],
  ['Tezzeret, Master of Metal', 'a control change over every object of a scope (`gain control of all ...`) - the rule reads one target (D531)'],
  ['Shackles of Treachery', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Act of Authority', 'the row maker: trigger payload not a pump: You may exile target artifact or enchantment. If you do, its (D531)'],
  ['Beguiler of Wills', 'a control line under a shape the row maker never reached (`{T}: Gain control of target creature with power less than or`) (D531)'],
  ['Simic Manipulator', 'a control line under a shape the row maker never reached (`{T}, Remove one or more +1/+1 counters from ~: Gain control `) (D531)'],
  ['Thoughtbound Primoc', 'the row maker: an intervening if outside the closed reader: a player controls more Wizards than each other player (D531)'],
  ['Furnace Reins', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D531)'],
  ['Shifting Loyalties', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Hivis of the Scale', 'a control duration outside the two the engine reads (`for as long as` + you control Hivis and Hivis remains tapped) (D531)'],
  ['Ogre Geargrabber', 'the row maker: trigger payload not a pump: Gain control of target Equipment an opponent controls until (D531)'],
  ['Visions of Duplicity', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Souvenir Snatcher', 'the row maker: multi-face or unusual layout (D531)'],
  ['Modify Memory', 'an exchange of two targets under one phrase (`exchange control of two target creatures`) - the rule reads `A and target B` (D531)'],
  ['Perplexing Chimera', 'the row maker: trigger payload not a pump: Exchange control of this creature and that spell. If you do, (D531)'],
  // D530 - the kicker's other costs: the two-kicker face (the cast naming which) and the kicker paid by a cost that is not mana are the engine's now; what stays is the named kicker under an enters-with, a cast trigger or a spell clause, the heads that watch for a kicked spell and the kicked riders outside the vocabulary.
  ['Urborg Lhurgoyf', 'the row maker: a line that is neither an activated ability nor a library trigger: As this creature enters, mill three cards for each time it was kicke (D530)'],
  ['Bog Down', 'the row maker: a spell with a line outside the vocabulary: Target player discards two cards. If this spell was kicked, (D530)'],
  ['Primal Growth', 'the row maker: a spell with a line outside the vocabulary: Search your library for a basic land card, put that card ont (D530)'],
  ['Stronghold Arena', 'the row maker: a counted noun the suite cannot stage (kicked): You gain 3 life for each time it was kicked. (D530)'],
  ['Vodalian Mindsinger', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ enters with two +1/+1 counters on it for each time it was kicked. (D530)'],
  ['Necravolver', 'an enters-with under a NAMED kicker (`If this creature was kicked with its {X} kicker, it enters with ...` - the replacement reads the kick, not which (D530)'],
  ['Blood Tribute', 'the row maker: a spell with a line outside the vocabulary: Target opponent loses half their life, rounded up. If this s (D530)'],
  ['Degavolver', 'an enters-with under a NAMED kicker (`If this creature was kicked with its {X} kicker, it enters with ...` - the replacement reads the kick, not which (D530)'],
  ['Temporal Firestorm', 'a kicker line under a shape the row maker never reached (`Choose up to X creatures and/or planeswalkers you control, w`) (D530)'],
  ['Rakavolver', 'an enters-with under a NAMED kicker (`If this creature was kicked with its {X} kicker, it enters with ...` - the replacement reads the kick, not which (D530)'],
  ['Goblin Barrage', 'the row maker: a spell with a line outside the vocabulary: Goblin Barrage deals 4 damage to target creature. If this sp (D530)'],
  ['Anavolver', 'an enters-with under a NAMED kicker (`If this creature was kicked with its {X} kicker, it enters with ...` - the replacement reads the kick, not which (D530)'],
  ['Cetavolver', 'an enters-with under a NAMED kicker (`If this creature was kicked with its {X} kicker, it enters with ...` - the replacement reads the kick, not which (D530)'],
  ['Wastescape Battlemage', 'a cast trigger gated on the named kicker (the gate reads the permanent the spell is not yet; not this wave) (D530)'],
  ['Falling Timber', 'the row maker: a spell with a line outside the vocabulary: Prevent all combat damage target creature would deal this tu (D530)'],
  ['Stormscape Battlemage', 'the row maker: trigger payload not a pump: Destroy target nonblack creature. That creature can\'t be reg (D530)'],
  ['Nightscape Battlemage', 'the row maker: trigger payload not a pump: Return up to two target nonblack creatures to their owners\' (D530)'],
  ['Arctic Merfolk', 'the row maker: a kicked condition on a card whose Kicker line the row cannot pay (two kickers, or none) (D530)'],
  ['Pollen Remedy', 'a kicker line under a shape the row maker never reached (`Prevent the next 3 damage that would be dealt this turn to a`) (D530)'],
  ["Dralnu's Pet", 'the row maker: a line that is neither an activated ability nor a library trigger: If this creature was kicked, it enters with flying and with X +1/+1 (D530)'],
  ['Illuminate', 'a spell clause gated on the named kicker (`If this spell was kicked with its {X} kicker` - the executor reads the kick, not which; not this wave) (D530)'],
  ['Magma Burst', 'a kicker line under a shape the row maker never reached (`Magma Burst deals 3 damage to any target. If this spell was `) (D530)'],
  ['Ana Battlemage', 'the row maker: trigger payload not a pump: Tap target untapped creature and that creature deals damage (D530)'],
  ['Chocobo Kick', 'the row maker: a spell with a line outside the vocabulary: Target creature you control deals damage equal to its power (D530)'],
  // D529 - the kick counted: the multikicker's counters per kick and the keyword a kicked creature enters with are the rows' now; what stays is the double kicker, the kicker paid by a cost that is not mana, the heads that watch for a kicked spell and the kicked riders outside the vocabulary.
  ['Battlewing Mystic', 'the row maker: trigger payload not a pump: Discard your hand, then draw two cards. (D529)'],
  ['Shatterskull Charger', 'the row maker: an intervening if outside the closed reader: this creature doesn\'t have a +1/+1 counter on it (D529)'],
  ['Timely Interference', 'the row maker: a spell with a line outside the vocabulary: Target creature gets -1/-0 until end of turn. If this spell (D529)'],
  ['Everflowing Chalice', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ enters with a charge counter on it for each time it was kicked. (D529)'],
  ['Rumbling Aftershocks', 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ['Skyclave Shade', 'the row maker: an intervening if outside the closed reader: this card is in your graveyard and it\'s your turn (D529)'],
  ["Orim's Chant", 'the row maker: a spell with a line outside the vocabulary: Target player can\'t cast spells this turn. If this spell was (D529)'],
  ['Verazol, the Split Current', 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ["Bloodchief's Thirst", 'the row maker: a spell with a line outside the vocabulary: Destroy target creature or planeswalker with mana value 2 or (D529)'],
  ['Verdeloth the Ancient', 'the row maker: a line that is neither an activated ability nor a library trigger: Saproling creatures and other Treefolk creatures get +1/+1. (D529)'],
  ['Comet Storm', 'the row maker: a spell with a line outside the vocabulary: Choose any target, then choose another target for each time (D529)'],
  ['Thieving Skydiver', 'the row maker: a line that is neither an activated ability nor a library trigger: Kicker {X}. X can\'t be 0. (D529)'],
  ['Marsh Casualties', 'the row maker: a spell with a line outside the vocabulary: Creatures target player controls get -1/-1 until end of turn (D529)'],
  ['Prohibit', 'the row maker: a spell with a line outside the vocabulary: Counter target spell if its mana value is 2 or less. If this (D529)'],
  ['Josu Vess, Lich Knight', 'the row maker: trigger payload not a pump: Create eight 2/2 black Zombie Knight creature tokens with me (D529)'],
  ['Blood Beckoning', 'the row maker: a spell with a line outside the vocabulary: Return target creature card from your graveyard to your hand (D529)'],
  ['Tajuru Paragon', 'the row maker: a line that is neither an activated ability nor a library trigger: ~ is also a Cleric, Rogue, Warrior, and Wizard. (D529)'],
  ['In Thrall to the Pit', 'the row maker: a spell with a line outside the vocabulary: Gain control of target creature until end of turn. Untap tha (D529)'],
  ['Waste Management', 'the row maker: a spell with a line outside the vocabulary: Exile up to two target cards from a single graveyard. If thi (D529)'],
  ['Breath of Darigaaz', 'the row maker: a spell with a line outside the vocabulary: Breath of Darigaaz deals 1 damage to each creature without f (D529)'],
  ['Maddening Cacophony', 'the row maker: a spell with a line outside the vocabulary: Each opponent mills eight cards. If this spell was kicked, i (D529)'],
  ['Deathforge Shaman', 'the row maker: trigger payload not a pump: ~ deals damage to target player or planeswalker equal to twi (D529)'],
  ['Hallar, the Firefletcher', 'a cast head gated on the spell being kicked (`if that spell was kicked`) - a cast filter the reader does not hold (D529)'],
  ["Marshal's Anthem", 'the row maker: trigger payload not a pump: Return up to X target creature cards from your graveyard to (D529)'],
  ['Verix Bladewing', 'the row maker: trigger payload not a pump: Create Karox Bladewing, a legendary 4/4 red Dragon creature (D529)'],
  ['Pixie Illusionist', 'the row maker: effect not a row kind: Target land you control becomes the basic land type of your choice until end of turn. (D529)'],
  ['Sea Gate Stormcaller', 'the row maker: trigger payload not a pump: Copy the next instant or sorcery spell with mana value 2 or (D529)'],
  ['The Five Doctors', 'the row maker: a spell with a line outside the vocabulary: Search your library and/or graveyard for up to five Doctor c (D529)'],
  ["Galadriel's Dismissal", 'the row maker: a spell with a line outside the vocabulary: Target creature phases out. If this spell was kicked, each c (D529)'],
  ['Bubble Snare', 'the row maker: an intervening if on a head the suite does not fire twice: etb (D529)'],
  ['Tear Asunder', 'the row maker: a spell with a line outside the vocabulary: Exile target artifact or enchantment. If this spell was kick (D529)'],
  ['Strength of the Tajuru', 'the row maker: a spell with a line outside the vocabulary: Choose target creature, then choose another target creature (D529)'],
  ['Voidpouncer', 'the row maker: a line that is neither an activated ability nor a library trigger: If this creature was kicked, it enters with two +1/+1 counters and a (D529)'],
  ['Skyclave Relic', 'the row maker: trigger payload not a pump: Create two tapped tokens that are copies of this artifact. (D529)'],
  ['Vines of Vastwood', 'the row maker: a spell with a line outside the vocabulary: Target creature can\'t be the target of spells or abilities y (D529)'],
  ['Consult the Star Charts', 'the row maker: a spell with a line outside the vocabulary: Look at the top X cards of your library, where X is the numb (D529)'],
  ['Inscription of Insight', 'a kicker line under a shape the row maker never reached (`Choose one. If this spell was kicked, choose any number inst`) (D529)'],
  ['Scorching Lava', 'the row maker: a spell with a line outside the vocabulary: Scorching Lava deals 2 damage to any target. If this spell w (D529)'],
  ['Dauntless Unity', 'the row maker: a spell with a line outside the vocabulary: Creatures you control get +1/+1 until end of turn. If this s (D529)'],
  ['Canopy Surge', 'the row maker: a spell with a line outside the vocabulary: Canopy Surge deals 1 damage to each creature with flying and (D529)'],
  ['Desolation Giant', 'the row maker: trigger payload not a pump: Destroy all other creatures you control. If it was kicked, d (D529)'],
  ['Tide Shaper', 'the row maker: a condition outside the closed vocabulary: this creature remains on the battlefield (D529)'],
  ['Bloodstone Goblin', 'a cast head gated on the spell being kicked (`if that spell was kicked`) - a cast filter the reader does not hold (D529)'],
  ['Bloodhusk Ritualist', 'the row maker: trigger payload not a pump: Target opponent discards a card for each time it was kicked. (D529)'],
  ['Scourge of the Skyclaves', 'the row maker: trigger payload not a pump: If it was kicked, each player loses half their life, rounded (D529)'],
  ['Myriad Construct', 'the row maker: a line that is neither an activated ability nor a library trigger: If this creature was kicked, it enters with a +1/+1 counter on it fo (D529)'],
  ['Savage Offensive', 'the row maker: a spell with a line outside the vocabulary: Creatures you control gain first strike until end of turn. I (D529)'],
  ['Sowing Mycospawn', 'the row maker: trigger payload not a pump: If it was kicked, exile target land. (D529)'],
  ['Depth Defiler', 'the row maker: trigger payload not a pump: Choose one. If it was kicked, choose both instead. (D529)'],
  ["Urza's Rage", 'the row maker: a spell with a line outside the vocabulary: This spell can\'t be countered. (D529)'],
  ['Elemental Appeal', 'the row maker: a spell with a line outside the vocabulary: Create a 7/1 red Elemental creature token with trample and h (D529)'],
  ['Kangee, Aerie Keeper', 'the row maker: trigger payload not a pump: Put X feather counters on ~. (D529)'],
  ['Desolation Angel', 'the row maker: trigger payload not a pump: Destroy all lands you control. If it was kicked, destroy all (D529)'],
  ['Shell Shield', 'the row maker: a spell with a line outside the vocabulary: Target creature you control gets +0/+3 until end of turn. If (D529)'],
  ['Slinn Voda, the Rising Deep', 'the row maker: trigger payload not a pump: Return all creatures to their owners\' hands except for Merfo (D529)'],
  ['Waterspout Elemental', 'the row maker: trigger payload not a pump: Return all other creatures to their owners\' hands and you sk (D529)'],
  ['Grow from the Ashes', 'the row maker: a spell with a line outside the vocabulary: Search your library for a basic land card, put it onto the b (D529)'],
  ['Prison Barricade', 'the row maker: a line that is neither an activated ability nor a library trigger: If this creature was kicked, it enters with a +1/+1 counter on it an (D529)'],
  ['Gnarlid Colony', 'the row maker: a line that is neither an activated ability nor a library trigger: Each creature you control with a +1/+1 counter on it has trample. (D529)'],
  ['Heroic Charge', 'the row maker: a spell with a line outside the vocabulary: Creatures you control get +2/+1 until end of turn. If this s (D529)'],
  ['Coralhelm Chronicler', 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ["Minamo's Meddling", 'the row maker: a spell with a line outside the vocabulary: Counter target spell. That spell\'s controller reveals their (D529)'],
  ["Ertai's Trickery", 'the row maker: a spell with a line outside the vocabulary: Counter target spell if it was kicked. (D529)'],
  ['Inscription of Ruin', 'a kicker line under a shape the row maker never reached (`Choose one. If this spell was kicked, choose any number inst`) (D529)'],
  ['Voyager Drake', 'the row maker: trigger payload not a pump: Up to X target creatures gain flying until end of turn, wher (D529)'],
  ['Jace, Mirror Mage', 'the row maker: trigger payload not a pump: Create a token that\'s a copy of ~, except it\'s not legendary (D529)'],
  ['Cinderclasm', 'the row maker: a spell with a line outside the vocabulary: Cinderclasm deals 1 damage to each creature. If it was kicke (D529)'],
  ["Orim's Touch", 'the row maker: a spell with a line outside the vocabulary: Prevent the next 2 damage that would be dealt to any target (D529)'],
  ["Vampire's Bite", 'the row maker: a spell with a line outside the vocabulary: Target creature gets +3/+0 until end of turn. If this spell (D529)'],
  ['Ravaging Riftwurm', 'the row maker: a line that is neither an activated ability nor a library trigger: If this creature was kicked, it enters with three additional time co (D529)'],
  ["Aang's Journey", 'the row maker: a spell with a line outside the vocabulary: Search your library for a basic land card. If this spell was (D529)'],
  ['Elfhame Druid', 'the row maker: effect not a row kind: Add {G}{G}. Spend this mana only to cast kicked spells. (D529)'],
  ['Bold Defense', 'the row maker: a spell with a line outside the vocabulary: Creatures you control get +1/+1 until end of turn. If this s (D529)'],
  ['Expel the Unworthy', 'the row maker: a spell with a line outside the vocabulary: Choose target creature with mana value 3 or less. If this sp (D529)'],
  ['Special Move', 'the row maker: a spell with a line outside the vocabulary: Choose two — (D529)'],
  ['Sprouting Goblin', 'the row maker: trigger payload not a pump: Search your library for a land card with a basic land type, (D529)'],
  ['Throne of Makindi', 'the row maker: effect not a row kind: Put a charge counter on this land. (D529)'],
  ['Hypnotic Cloud', 'the row maker: a spell with a line outside the vocabulary: Target player discards a card. If this spell was kicked, tha (D529)'],
  ['Joraga Warcaller', 'the row maker: a scoped continuous body outside the vocabulary: get +1/+1 for each +1/+1 counter on this creature. (D529)'],
  ['Monstrous War-Leech', 'the row maker: a line that is neither an activated ability nor a library trigger: As this creature enters, if it was kicked, mill four cards. (D529)'],
  ['Fight with Fire', 'a kicker line under a shape the row maker never reached (`Fight with Fire deals 5 damage to target creature. If this s`) (D529)'],
  ['Skizzik', 'the row maker: an intervening if outside the closed reader: this creature wasn\'t kicked (D529)'],
  ['Vine Gecko', 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ['Reclaim the Wastes', 'the row maker: a spell with a line outside the vocabulary: Search your library for a basic land card, reveal it, put it (D529)'],
  ['Saproling Infestation', 'the row maker: trigger head not in the library: Whenever a player kicks a spell, you create a 1/1 green Saproling crea (D529)'],
  ['Strength of Night', 'the row maker: a spell with a line outside the vocabulary: Creatures you control get +1/+1 until end of turn. If this s (D529)'],
  ['Zethi, Arcane Blademaster', 'the row maker: trigger payload not a pump: Exile up to X target instant cards from your graveyard, wher (D529)'],
  ['Inscription of Abundance', 'a kicker line under a shape the row maker never reached (`Choose one. If this spell was kicked, choose any number inst`) (D529)'],
  ['Moss-Pit Skeleton', 'the row maker: trigger head not in the library: Whenever one or more +1/+1 counters are put on a creature you control, (D529)'],
  ['Emblazoned Golem', 'the row maker: a line that is neither an activated ability nor a library trigger: Spend only colored mana on X. No more than one mana of each color ma (D529)'],
  ['Wicker Picker', 'the row maker: a line that is neither an activated ability nor a library trigger: Creature spells you cast have sticker kicker {1}. (D529)'],
  ['Field Research', 'the row maker: a spell with a line outside the vocabulary: Draw two cards. If this spell was kicked, draw three cards i (D529)'],
  ["Warhost's Frenzy", 'the row maker: a spell with a line outside the vocabulary: Creatures you control get +2/+0 until end of turn. If this s (D529)'],
  ['Gigantiform', 'the row maker: an attached static body outside the vocabulary: has base power and toughness 8/8 and has trample. (D529)'],
  ['Aggressive Sabotage', 'the row maker: a spell with a line outside the vocabulary: Target player discards two cards. If this spell was kicked, (D529)'],
  ['Merfolk Falconer', 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ["Zuko's Conviction", 'the row maker: a spell with a line outside the vocabulary: Return target creature card from your graveyard to your hand (D529)'],
  ['Vigorous Charge', 'the row maker: a spell with a line outside the vocabulary: Target creature gains trample until end of turn. Whenever th (D529)'],
  ["Jet's Brainwashing", 'the row maker: a spell with a line outside the vocabulary: Target creature can\'t block this turn. If this spell was kic (D529)'],
  ["Lullmage's Familiar", 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ['Grunn, the Lonely King', 'the row maker: trigger payload not a pump: Double its power and toughness until end of turn. (D529)'],
  ['Choking Miasma', 'the row maker: a spell with a line outside the vocabulary: If this spell was kicked, put a +1/+1 counter on a creature (D529)'],
  ["Rona's Vortex", 'the row maker: a spell with a line outside the vocabulary: Return target creature or planeswalker you don\'t control to (D529)'],
  ['Batroc the Leaper', 'the row maker: a line that is neither an activated ability nor a library trigger: Batroc enters with a +1/+1 counter on him for each time he was kicke (D529)'],
  ['Thicket Elemental', 'the row maker: trigger payload not a pump: Reveal cards from the top of your library until you reveal a (D529)'],
  ['Overload', 'the row maker: a spell with a line outside the vocabulary: Destroy target artifact if its mana value is 2 or less. If t (D529)'],
  ['Taunting Arbormage', 'the row maker: trigger payload not a pump: All creatures able to block target creature this turn do so. (D529)'],
  ['Unstable Footing', 'the row maker: a spell with a line outside the vocabulary: Damage can\'t be prevented this turn. If this spell was kicke (D529)'],
  ['Sphinx of Lost Truths', 'the row maker: trigger payload not a pump: Draw three cards. Then if it wasn\'t kicked, discard three ca (D529)'],
  ['Mega Flare', 'a kicker line under a shape the row maker never reached (`If this spell was kicked, create a 6/6 red Dragon creature t`) (D529)'],
  ['Volshe Tideturner', 'the row maker: effect not a row kind: Add {U}. Spend this mana only to cast an instant or sorcery spell or a kicked spell. (D529)'],
  ['Wild Onslaught', 'the row maker: a spell with a line outside the vocabulary: Put a +1/+1 counter on each creature you control. If this sp (D529)'],
  ["Sheoldred's Restoration", 'the row maker: a spell with a line outside the vocabulary: Return target creature card from your graveyard to the battl (D529)'],
  ['Stall for Time', 'the row maker: a spell with a line outside the vocabulary: Tap up to two target creatures. If this spell was kicked, pu (D529)'],
  ['Divine Resilience', 'the row maker: a spell with a line outside the vocabulary: Target creature you control gains indestructible until end o (D529)'],
  ['Sadistic Sacrament', 'the row maker: a spell with a line outside the vocabulary: Search target player\'s library for up to three cards, exile (D529)'],
  ['Murasa Sproutling', 'the row maker: trigger payload not a pump: Return target card with a kicker ability from your graveyard (D529)'],
  ['Risen Riptide', 'a head that watches for a kicked spell (`Whenever you cast a kicked spell`) - a cast filter the reader does not hold (D529)'],
  ['Firebending Lesson', 'the row maker: a spell with a line outside the vocabulary: Firebending Lesson deals 2 damage to target creature. If thi (D529)'],
  ['Skyclave Sentinel', 'the row maker: a conditional body outside the static vocabulary: ~ can attack as though it didn\'t have defender (D529)'],
  // D528 - sagas: the lore counter at the entry and each own precombat main, the chapter told as the count reaches it and the sacrifice after the final one are the engine's now; what stays is the chapter BODIES outside the vocabulary, the transforming Sagas, the heads that watch a Saga and the lore-counter verbs.
  ["Historian's Boon", 'the row maker: a filtered head outside the closed reader (an adjective outside the list: this): Whenever this enchantment or another nontoken enchantment yo (D528)'],
  ['The Restoration of Eiganjo // Architect of Restoration', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Search for Glory', 'the row maker: a spell with a line outside the vocabulary: Search your library for a snow permanent card, a legendary c (D528)'],
  ['Eivor, Wolf-Kissed', 'the row maker: a player referent payload the vocabulary does not read: You mill that many cards. You may put a Saga card and/or a l (D528)'],
  ['Satsuki, the Living Lore', 'a lore-counter verb (`{T}: Put a lore counter on each Saga you control. `) - the count moves, the chapters follow; the verb is outside the vocabulary (D528)'],
  ["Jecht, Reluctant Guardian // Braska's Final Aeon", 'the row maker: multi-face or unusual layout (D528)'],
  ['City of Death', 'the row maker: a line that is neither an activated ability nor a library trigger: II, III, IV, V, VI — Create a token that\'s a copy of target non-Saga (D528)'],
  ['The Flux', 'the row maker: a line that is neither an activated ability nor a library trigger: VI — Add six {R}. (D528)'],
  ['Blink', 'the row maker: trigger payload not a pump: Choose target creature. Its owner shuffles it into their lib (D528)'],
  ["Firja's Retribution", 'the row maker: a token outside TOKEN_TABLE: Angel Warrior|4/4|W|Creature|flying,vigilance (D528)'],
  ['The Coming of Galactus', 'the row maker: a leftover line not among the printed lines: IV — Create Galactus, a legendary 16/16 black Elde (D528)'],
  ["Joshua, Phoenix's Dominant // Phoenix, Warden of Fire", 'the row maker: multi-face or unusual layout (D528)'],
  ['Fall of Gil-galad', 'the row maker: a leftover line not among the printed lines: III — Until end of turn, target creature you contr (D528)'],
  ['The War Games', 'the row maker: a condition outside the closed vocabulary: ~ remains on the battlefield (D528)'],
  ['The Bears of Littjara', 'the row maker: trigger payload not a pump: Any number of target Shapeshifter creatures you control have (D528)'],
  ['The Eldest Reborn', 'the row maker: trigger payload not a pump: Put target creature or planeswalker card from a graveyard on (D528)'],
  ['The Phasing of Zhalfir', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Phyrexian Scriptures', 'the row maker: trigger payload not a pump: Put a +1/+1 counter on up to one target creature. That creat (D528)'],
  ['Vault 112: Sadistic Simulation', 'the row maker: trigger payload not a pump: Pay any amount of {E}. If you paid one or more {E} this way, (D528)'],
  ['Fable of the Mirror-Breaker // Reflection of Kiki-Jiki', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Ascent of the Worthy', 'the row maker: trigger payload not a pump: Choose a creature you control. Until your next turn, all dam (D528)'],
  ['The Elder Dragon War', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Terra, Magical Adept // Esper Terra', 'the row maker: multi-face or unusual layout (D528)'],
  ['Three Blind Mice', 'the row maker: trigger payload not a pump: Create a token that\'s a copy of target token you control. (D528)'],
  ['The Mending of Dominaria', 'the row maker: trigger payload not a pump: Mill two cards, then you may return a creature card from you (D528)'],
  ['Battle at the Helvault', 'the row maker: trigger payload not a pump: For each player, exile up to one target non-Saga, nonland pe (D528)'],
  ['The Curse of Fenric', 'the row maker: trigger payload not a pump: For each player, destroy up to one target creature that play (D528)'],
  ["The Apprentice's Folly", 'the row maker: trigger payload not a pump: Choose target nontoken creature you control that doesn\'t hav (D528)'],
  ['The First Eruption', 'the row maker: trigger payload not a pump: Add {R}{R}. (D528)'],
  ['Vault 21: House Gambit', 'the row maker: trigger payload not a pump: Reveal up to five nonland cards from your hand. For each of (D528)'],
  ['Esper Origins // Summon: Esper Maduin', 'the row maker: multi-face or unusual layout (D528)'],
  ['Love Song of Night and Day', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Urza Assembles the Titans', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Boseiju Reaches Skyward // Branch of Boseiju', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Armor Wars', 'the row maker: trigger payload not a pump: Draw a card for each artifact you control. If you do, each o (D528)'],
  ['Trial of a Time Lord', 'the row maker: a vocabulary clause the suite has no fixture for: no fixture for target nontoken creature an opponent controls (D528)'],
  ['The Flame of Keld', 'the row maker: trigger payload not a pump: Discard your hand. (D528)'],
  ['Summon: Primal Odin', 'the row maker: a leftover line not among the printed lines: II — Zantetsuken — This creature gains (D528)'],
  ['Awaken the Honored Dead', 'the row maker: trigger payload not a pump: Discard a card. When you do, return target creature or land (D528)'],
  ['Vault 12: The Necropolis', 'the row maker: trigger payload not a pump: Each player gets three rad counters. (D528)'],
  ["Tribute to Horobi // Echo of Death's Wail", 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Origin of the Hidden Ones', 'the row maker: trigger payload not a pump: Whenever an Assassin you control attacks this turn, create a (D528)'],
  ['The Rise of Sozin // Fire Lord Sozin', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Jin-Gitaxias // The Great Synthesis', 'the row maker: multi-face or unusual layout (D528)'],
  ['Myth Realized', 'the row maker: trigger payload not a pump: Put a lore counter on this enchantment. (D528)'],
  ['The Mirari Conjecture', 'the row maker: trigger payload not a pump: Until end of turn, whenever you cast an instant or sorcery s (D528)'],
  ['Niko Defies Destiny', 'the row maker: trigger payload not a pump: You gain 2 life for each foretold card you own in exile. (D528)'],
  ['Urabrask // The Great Work', 'the row maker: multi-face or unusual layout (D528)'],
  ['The World Spell', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Roar of Endless Song', 'the row maker: trigger payload not a pump: Double the power and toughness of each creature you control (D528)'],
  ['Hidetsugu Consumes All // Vessel of the All-Consuming', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Sheoldred // The True Scriptures', 'the row maker: multi-face or unusual layout (D528)'],
  ['Origin of Spider-Man', 'the row maker: trigger payload not a pump: Put a +1/+1 counter on target creature you control. It becom (D528)'],
  ['The Caves of Androzani', 'the row maker: trigger payload not a pump: For each non-Saga permanent, choose a counter on it. You may (D528)'],
  ['Nightmares and Daydreams', 'the row maker: trigger payload not a pump: Until your next turn, whenever you cast an instant or sorcer (D528)'],
  ["Urza's Saga", 'the row maker: a leftover line not among the printed lines: I — This Saga gains (D528)'],
  ['Ajani Fells the Godsire', 'the row maker: trigger payload not a pump: Create a 2/1 white Cat Warrior creature token, then put a vi (D528)'],
  ['The Girl in the Fireplace', 'the row maker: a leftover line not among the printed lines: I — Create a 1/1 white Human Noble creature token (D528)'],
  ['Summon: Titan', 'the row maker: trigger payload not a pump: Return all land cards from your graveyard to the battlefield (D528)'],
  ['Rite of Belzenlok', 'the row maker: a leftover line not among the printed lines: III — Create a 6/6 black Demon creature token with (D528)'],
  ["Jill, Shiva's Dominant // Shiva, Warden of Ice", 'the row maker: multi-face or unusual layout (D528)'],
  ['Chong and Lily, Nomads', 'the row maker: trigger head not in the library: Whenever one or more Bards you control attack, choose one — (D528)'],
  ['Summon: Leviathan', 'the row maker: trigger payload not a pump: Return each creature that isn\'t a Kraken, Leviathan, Merfolk (D528)'],
  ['Guru Pathik', 'the row maker: a filtered head no fixture satisfies: a Lesson (D528)'],
  ['The Binding of the Titans', 'the row maker: trigger payload not a pump: Exile up to two target cards from graveyards. For each creat (D528)'],
  ['Keldon Warcaller', 'a lore-counter verb (`Whenever this creature attacks, put a lore counter`) - the count moves, the chapters follow; the verb is outside the vocabulary (D528)'],
  ["Kardur's Vicious Return", 'the row maker: trigger payload not a pump: Sacrifice a creature. When you do, ~ deals 3 damage to any t (D528)'],
  ["The Dragon-Kami Reborn // Dragon-Kami's Egg", 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Summon: G.F. Ifrit', 'the row maker: trigger payload not a pump: Add {R}. (D528)'],
  ['Sigurd, Jarl of Ravensthorpe', 'a lore-counter verb (`Boast — {1}: Put a lore counter on target Saga you`) - the count moves, the chapters follow; the verb is outside the vocabulary (D528)'],
  ['Birth of the Imperium', 'the row maker: a token outside TOKEN_TABLE: Astartes Warrior|2/2|W|Creature|vigilance for each opponent you have (D528)'],
  ['The Antiquities War', 'the row maker: trigger payload not a pump: Artifacts you control become artifact creatures with base po (D528)'],
  ["The Huntsman's Redemption", 'the row maker: trigger payload not a pump: You may sacrifice a creature. If you do, search your library (D528)'],
  ['Long List of the Ents', 'the row maker: a line that is neither an activated ability nor a library trigger: I, II, III, IV, V, VI — Note a creature type that hasn\'t been noted (D528)'],
  ['The Creation of Avacyn', 'the row maker: trigger payload not a pump: Search your library for a card, exile it face down, then shu (D528)'],
  ['Day of the Moon', 'the row maker: trigger payload not a pump: Choose a creature card name, then goad all creatures with a (D528)'],
  ['Kumano Faces Kakkazan // Etching of Kumano', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['The Akroan War', 'the row maker: a condition outside the closed vocabulary: ~ remains on the battlefield (D528)'],
  ['Vorinclex // The Grand Evolution', 'the row maker: multi-face or unusual layout (D528)'],
  ['Jugan Defends the Temple // Remnant of the Rising Star', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Scroll of the Masters', 'the row maker: trigger payload not a pump: Put a lore counter on this artifact. (D528)'],
  ['Tom Bombadil', 'a head that watches a Saga\'s final chapter (`Whenever the final chapter ability of a Saga you control resolves`) - the SagaSacrificed marker exists, t (D528)'],
  ['Kiora Bests the Sea God', 'the row maker: trigger payload not a pump: Tap all nonland permanents target opponent controls. They do (D528)'],
  ['An Unearthly Child', 'the row maker: trigger payload not a pump: Reveal cards from the top of your library until you reveal a (D528)'],
  ['Inventive Iteration // Living Breakthrough', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Ballad of the Black Flag', 'the row maker: trigger payload not a pump: Mill three cards. You may put a historic card from among the (D528)'],
  ['Founding the Third Path', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['The Clone Saga', 'the row maker: trigger payload not a pump: When you next cast a creature spell this turn, copy it, exce (D528)'],
  ['Tale of Tinúviel', 'the row maker: a condition outside the closed vocabulary: you control ~ (D528)'],
  ['The Aesir Escape Valhalla', 'the row maker: trigger payload not a pump: Exile a permanent card from your graveyard. You gain life eq (D528)'],
  ['The First Iroan Games', 'the row maker: trigger payload not a pump: If you control a creature with power 4 or greater, draw two (D528)'],
  ['Narci, Fable Singer', 'a head that watches a Saga\'s final chapter (`Whenever the final chapter ability of a Saga you control resolves`) - the SagaSacrificed marker exists, t (D528)'],
  ['The Bloodsky Massacre', 'the row maker: trigger payload not a pump: Whenever a Berserker attacks this turn, you draw a card and (D528)'],
  ['Song of Eärendil', 'the row maker: trigger payload not a pump: Scry 2, then draw two cards. (D528)'],
  ['The Super Hero Civil War', 'the row maker: a condition outside the closed vocabulary: ~ remains on the battlefield (D528)'],
  ['Vault 87: Forced Evolution', 'the row maker: a condition outside the closed vocabulary: you control ~ (D528)'],
  ['Summon: Shiva', 'the row maker: trigger payload not a pump: Draw a card for each tapped creature your opponents control. (D528)'],
  ['Triumph of Gerrard', 'the row maker: trigger payload not a pump: Put a +1/+1 counter on target creature you control with the (D528)'],
  ['Waking the Trolls', 'the row maker: trigger payload not a pump: Put target land card from a graveyard onto the battlefield u (D528)'],
  ["Vault 11: Voter's Dilemma", 'the row maker: trigger payload not a pump: For each opponent, you create a 1/1 white Human Soldier crea (D528)'],
  ["Elspeth's Nightmare", 'the row maker: trigger payload not a pump: Exile target opponent\'s graveyard. (D528)'],
  ['Vault 75: Middle School', 'the row maker: trigger payload not a pump: Exile all creatures with power 4 or greater. (D528)'],
  ['Fall of the Thran', 'the row maker: a scope with no witness the suite can put: Destroy all lands. (D528)'],
  ['Summon: Good King Mog XII', 'the row maker: trigger payload not a pump: Whenever you cast a noncreature spell this turn, create a to (D528)'],
  ['Yotia Declares War', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Avengers: Under Siege', 'the row maker: trigger payload not a pump: ~ deals 2 damage to each non-Villain creature and each oppon (D528)'],
  ['Huatli, Poet of Unity // Roar of the Fifth People', 'the row maker: multi-face or unusual layout (D528)'],
  ['Forging the Tyrite Sword', 'the row maker: trigger payload not a pump: Search your library for a card named Halvar, God of Battle o (D528)'],
  ["Medomai's Prophecy", 'the row maker: trigger payload not a pump: Choose a card name. (D528)'],
  ['The Cruelty of Gix', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Showdown of the Skalds', 'the row maker: trigger payload not a pump: Whenever you cast a spell this turn, put a +1/+1 counter on (D528)'],
  ['Rediscover the Way', 'the row maker: trigger payload not a pump: Whenever you cast a noncreature spell this turn, target crea (D528)'],
  ['Elesh Norn // The Argent Etchings', 'the row maker: multi-face or unusual layout (D528)'],
  ['Summon: Fenrir', 'the row maker: trigger payload not a pump: When you next cast a creature spell this turn, that creature (D528)'],
  ['Barbara Wright', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ["Clive, Ifrit's Dominant // Ifrit, Warden of Inferno", 'the row maker: multi-face or unusual layout (D528)'],
  ['Summon: Knights of Round', 'the row maker: trigger payload not a pump: Other creatures you control get +2/+2 until end of turn. Put (D528)'],
  ['Heaven Sent', 'the row maker: trigger payload not a pump: ~ deals 1 damage to each opponent. Then if an opponent has 0 (D528)'],
  ["The Witch's Vanity", 'the row maker: trigger payload not a pump: Create a Wicked Role token attached to target creature you c (D528)'],
  ['The Legend of Kyoshi // Avatar Kyoshi', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['The Three Seasons', 'the row maker: a vocabulary clause the suite has no fixture for: no graveyard fixture for up to two target snow permanent cards from your graveyard (D528)'],
  ["Braids's Frightful Return", 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['The Triumph of Anax', 'the row maker: trigger payload not a pump: Until end of turn, target creature gains trample and gets +X (D528)'],
  ['The Legend of Roku // Avatar Roku', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ["The Trickster-God's Heist", 'the row maker: trigger payload not a pump: Exchange control of two target creatures. (D528)'],
  ['The Hunger Tide Rises', 'the row maker: trigger payload not a pump: Sacrifice any number of creatures. Search your library and/o (D528)'],
  ['Teachings of the Kirin // Kirin-Touched Orochi', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ["King Narfi's Betrayal", 'the row maker: trigger payload not a pump: Each player mills four cards. Then you may exile a creature (D528)'],
  ['The Fall of Lord Konda // Fragment of Konda', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ["The Long Reach of Night // Animus of Night's Reach", 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Okiba Reckoner Raid // Nezumi Road Captain', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Storyweave', 'a lore-counter verb (`• Put two lore counters on target Saga you control`) - the count moves, the chapters follow; the verb is outside the vocabulary (D528)'],
  ['The Cave of Two Lovers', 'the row maker: trigger payload not a pump: Earthbend 3. (D528)'],
  ["Tales of Master Seshiro // Seshiro's Living Legacy", 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['The Night of the Doctor', 'the row maker: trigger payload not a pump: Return target legendary creature card from your graveyard to (D528)'],
  ['World War Hulk', 'the row maker: trigger payload not a pump: The next red or green creature spell you cast this turn can (D528)'],
  ['The Shattered States Era // Nameless Conqueror', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Ian Chesterton', 'the row maker: a line that is neither an activated ability nor a library trigger: Science Teacher — Each Saga spell you cast has replicate. The replic (D528)'],
  ['Thunder of Unity', 'the row maker: trigger payload not a pump: Whenever a creature you control enters this turn, each oppon (D528)'],
  ['Age of Ultron', 'the row maker: trigger payload not a pump: For each opponent, destroy up to one target nonartifact crea (D528)'],
  ["The Brothers' War", 'the row maker: trigger payload not a pump: Create two tapped Powerstone tokens. (D528)'],
  ["The Raven's Warning", 'the row maker: trigger payload not a pump: Whenever one or more creatures you control with flying deal (D528)'],
  ['Summon: Brynhildr', 'the row maker: trigger payload not a pump: Exile the top card of your library. During any turn you put (D528)'],
  ['Revival of the Ancestors', 'the row maker: trigger payload not a pump: Distribute three +1/+1 counters among one, two, or three tar (D528)'],
  ['Elspeth Conquers Death', 'the row maker: trigger payload not a pump: Noncreature spells your opponents cast cost {2} more to cast (D528)'],
  ['Summon: G.F. Cerberus', 'the row maker: trigger payload not a pump: When you next cast an instant or sorcery spell this turn, co (D528)'],
  ['Summon: Bahamut', 'the row maker: trigger payload not a pump: ~ deals damage equal to the total mana value of other perman (D528)'],
  ['The Tale of Tamiyo', 'the row maker: trigger payload not a pump: Mill two cards. If two cards that share a card type were mil (D528)'],
  ['Kang Dynasty', 'the row maker: trigger payload not a pump: For each opponent, tap up to one target creature that player (D528)'],
  ['The Legend of Kuruk // Avatar Kuruk', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Crystal Fragments // Summon: Alexander', 'the row maker: multi-face or unusual layout (D528)'],
  ['Garnet, Princess of Alexandria', 'the row maker: trigger payload not a pump: Remove a lore counter from each of any number of Sagas you c (D528)'],
  ['Battle of Frost and Fire', 'the row maker: trigger payload not a pump: ~ deals 4 damage to each non-Giant creature and each planesw (D528)'],
  ['Battle for Bretagard', 'the row maker: trigger payload not a pump: Choose any number of artifact tokens and/or creature tokens (D528)'],
  ['Origin of Captain America', 'the row maker: a leftover line not among the printed lines: II — Create a colorless Equipment artifact token n (D528)'],
  ['The First Tyrannic War', 'the row maker: trigger payload not a pump: Put a creature card from your hand onto the battlefield. If (D528)'],
  ['The Parting of the Ways', 'the row maker: trigger payload not a pump: Exile the top five cards of your library. For each nonland c (D528)'],
  ['Tymaret Calls the Dead', 'the row maker: a mill beside an effect whose graveyard delta the suite does not count: payOptional (D528)'],
  ['The Death of Gwen Stacy', 'the row maker: trigger payload not a pump: Each player may discard a card. Each player who doesn\'t lose (D528)'],
  ['Oath of the Grey Host', 'the row maker: trigger payload not a pump: You and target opponent each create a Food token. (D528)'],
  ['Death in Heaven', 'the row maker: trigger payload not a pump: Target player mills two cards, then exiles their graveyard. (D528)'],
  ['Genesis of the Daleks', 'the row maker: trigger payload not a pump: Create a 3/3 black Dalek artifact creature token with menace (D528)'],
  ['The War in Heaven', 'the row maker: trigger payload not a pump: Choose up to three target creature cards with total mana val (D528)'],
  ['Welcome to . . . // Jurassic Park', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['The Last Ronin', 'the row maker: trigger payload not a pump: Mill four cards. When you do, return target creature card fr (D528)'],
  ['Vault 101: Birthday Party', 'the row maker: trigger payload not a pump: Create a 1/1 white Human Soldier creature token and a Food t (D528)'],
  ["Michiko's Reign of Truth // Portrait of Michiko", 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Era of Enlightenment // Hand of Enlightenment', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Clash of the Eikons', 'a lore-counter verb (`• Remove a lore counter from target Saga you contr`) - the count moves, the chapters follow; the verb is outside the vocabulary (D528)'],
  ['Summon: Magus Sisters', 'the row maker: trigger payload not a pump: Choose one at random — (D528)'],
  ['Origin of Black Widow', 'the row maker: trigger payload not a pump: Each opponent loses 1 life for each creature card in their g (D528)'],
  ['Maximum Carnage', 'the row maker: trigger payload not a pump: Until your next turn, each creature attacks each combat if a (D528)'],
  ['Summon: Esper Valigarmanda', 'the row maker: trigger payload not a pump: Exile an instant or sorcery card from each graveyard. (D528)'],
  ['Invasion of the Giants', 'the row maker: trigger payload not a pump: Draw a card. Then you may reveal a Giant card from your hand (D528)'],
  ['Harald Unites the Elves', 'the row maker: trigger payload not a pump: Mill three cards. You may put an Elf or Tyvar card from your (D528)'],
  ['Summon: Esper Ramuh', 'the row maker: trigger payload not a pump: ~ deals damage equal to the number of noncreature, nonland c (D528)'],
  ['Fall of the First Civilization', 'the row maker: trigger payload not a pump: You and target opponent each draw two cards. (D528)'],
  ['Origin of Iron Man', 'the row maker: a condition outside the closed vocabulary: ~ remains on the battlefield (D528)'],
  ['Origin of the Avengers', 'the row maker: trigger payload not a pump: Put a Hero creature card with mana value 3 or less from your (D528)'],
  ['Befriending the Moths // Imperial Moth', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ["Dion, Bahamut's Dominant // Bahamut, Warden of Light", 'the row maker: multi-face or unusual layout (D528)'],
  ['The Sea Devils', 'the row maker: trigger payload not a pump: Until end of turn, whenever a Salamander deals combat damage (D528)'],
  ["Kraven's Last Hunt", 'the row maker: trigger payload not a pump: Mill five cards. When you do, ~ deals damage equal to the gr (D528)'],
  ['Welcome to Sweettooth', 'the row maker: trigger payload not a pump: Put X +1/+1 counters on target creature you control, where X (D528)'],
  ['The Cloning of Shredder', 'the row maker: trigger payload not a pump: Exile target creature card from your graveyard. Create a tok (D528)'],
  ['The Legend of Yangchen // Avatar Yangchen', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['The Day of the Doctor', 'the row maker: a condition outside the closed vocabulary: ~ remains on the battlefield. Put the rest of those exiled c (D528)'],
  ['Rydia, Summoner of Mist', 'a Saga line under a shape the row maker never reached (`Summon — {X}, {T}: Return target Saga card with mana value X`) (D528)'],
  ['The Bath Song', 'the row maker: trigger payload not a pump: Shuffle any number of target cards from your graveyard into (D528)'],
  ["Vault 13: Dweller's Journey", 'the row maker: trigger payload not a pump: For each player, exile up to one other target enchantment or (D528)'],
  ['Song of Freyalise', 'the row maker: a leftover line not among the printed lines: I, II — Until your next turn, creatures you contro (D528)'],
  ['Summon: Kujata', 'the row maker: trigger payload not a pump: Discard a card, then draw two cards. When you discard a card (D528)'],
  ['Korvold and the Noble Thief', 'the row maker: trigger payload not a pump: Exile the top three cards of target opponent\'s library. You (D528)'],
  ['The Eleventh Hour', 'the row maker: trigger payload not a pump: Create a Food token and a 1/1 white Human creature token wit (D528)'],
  ["Gadwick's First Duel", 'the row maker: trigger payload not a pump: Create a Cursed Role token attached to up to one target crea (D528)'],
  ['Leaves from the Vine', 'the row maker: trigger payload not a pump: Draw a card if there\'s a creature or Lesson card in your gra (D528)'],
  ['Origin of Thor', 'the row maker: trigger payload not a pump: Whenever you cast a spell this turn, put a +1/+1 counter on (D528)'],
  ['Of Herbs and Stewed Rabbit', 'the row maker: a counted payload under a head whose arm sizes the board (chapter): Create a 1/1 white Halfling creature token for each Food you contro (D528)'],
  ['The Horus Heresy', 'the row maker: a condition outside the closed vocabulary: ~ remains on the battlefield (D528)'],
  ['Summon: Valefor', 'the row maker: trigger payload not a pump: Each opponent chooses a creature with the greatest mana valu (D528)'],
  ['Summon: Yojimbo', 'the row maker: trigger payload not a pump: Exile target artifact, enchantment, or tapped creature an op (D528)'],
  ['Arni Slays the Troll', 'the row maker: trigger payload not a pump: Add {R}. Put two +1/+1 counters on up to one target creature (D528)'],
  ['Fall of the Impostor', 'the row maker: trigger payload not a pump: Exile a creature with the greatest power among creatures tar (D528)'],
  ['The Princess Takes Flight', 'the row maker: trigger payload not a pump: Return the exiled card to the battlefield under its owner\'s (D528)'],
  ['Time of Ice', 'the row maker: a condition outside the closed vocabulary: you control ~ (D528)'],
  ['Fugitive of the Judoon', 'the row maker: trigger payload not a pump: Create a 1/1 white Human creature token with ward {2} and a (D528)'],
  ['The Weatherseed Treaty', 'read ahead (CR 714.2d - the chapter chosen as it enters) (D528)'],
  ['Summon: Primal Garuda', 'the row maker: trigger payload not a pump: ~ deals 4 damage to target tapped creature an opponent contr (D528)'],
  ['Behold the Unspeakable // Vision of the Unspeakable', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ["Azusa's Many Journeys // Likeness of the Seeker", 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Ral and the Implicit Maze', 'the row maker: trigger payload not a pump: ~ deals 2 damage to each creature and planeswalker your oppo (D528)'],
  ['The Revelations of Ezio', 'the row maker: trigger payload not a pump: Whenever an Assassin you control attacks this turn, put a +1 (D528)'],
  ['The Modern Age // Vector Glider', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Tamiyo Meets the Story Circle', 'the row maker: trigger payload not a pump: Until your next turn, whenever a creature attacks you or a p (D528)'],
  ["Chainer's Torment", 'the row maker: trigger payload not a pump: Create an X/X black Nightmare Horror creature token, where X (D528)'],
  ['Life of Toshiro Umezawa // Memory of Toshiro', 'a Saga that transforms (two faces - the layout the row maker refuses) (D528)'],
  ['Mind Unbound', 'the row maker: trigger payload not a pump: Put a lore counter on this enchantment, then draw a card for (D528)'],
  // D527 - clash: the two placements and the verdict are the engine's now; what stays is the heads that watch for a clash, the defending-player form, the Otherwise half and the riders beside it.
  ['Mana Clash', 'the row maker: a spell with a line outside the vocabulary: You and target opponent each flip a coin. Mana Clash deals 1'],
  ['Recross the Paths', 'the row maker: a spell with a line outside the vocabulary: Reveal cards from the top of your library until you reveal a (D527)'],
  ['Entangling Trap', 'a head that watches for a clash (`Whenever you clash, tap target creature an opponen`) outside the library (D527)'],
  ["Hoarder's Greed", 'a clash that repeats on a win (`You lose 2 life and draw two cards, then clash wit`) (D527)'],
  ['Whirlpool Whelm', 'an `instead` rider with a may and a referent to the bounced card (`Clash with an opponent, then return target creatur`) (D527)'],
  ['Scattering Stroke', 'the row maker: a spell with a line outside the vocabulary: Counter target spell. Clash with an opponent. If you win, at (D527)'],
  ['Gilt-Leaf Ambush', 'the row maker: a spell with a line outside the vocabulary: Create two 1/1 green Elf Warrior creature tokens. Clash with (D527)'],
  ['Pollen Lullaby', 'the row maker: a spell with a line outside the vocabulary: Prevent all combat damage that would be dealt this turn. Cla (D527)'],
  ['Captivating Glance', 'the `Otherwise` half of the verdict (`At the beginning of your end step, clash with an o`): a gate on the negation the parser does not read (D527)'],
  ['Redeem the Lost', 'the row maker: a spell with a line outside the vocabulary: Target creature you control gains protection from the color (D527)'],
  ['Pulling Teeth', 'the `Otherwise` half of the verdict (`Clash with an opponent. If you win, target player `): a gate on the negation the parser does not read (D527)'],
  ['Broken Ambitions', 'the row maker: a spell with a line outside the vocabulary: Counter target spell unless its controller pays {X}. Clash w (D527)'],
  ['Lash Out', 'the row maker: a spell with a line outside the vocabulary: Lash Out deals 3 damage to target creature. Clash with an op (D527)'],
  ['Revive the Fallen', 'the row maker: a spell with a line outside the vocabulary: Return target creature card from a graveyard to its owner\'s (D527)'],
  ['Marvo, Deep Operative', 'a clash with the DEFENDING player (the head\'s player, not a chosen opponent) - not this wave (D527)'],
  ['Woodland Guidance', 'the row maker: a spell with a line outside the vocabulary: Return target card from your graveyard to your hand. Clash w (D527)'],
  ['Sentry Oak', 'the row maker: trigger payload not a pump: Clash with an opponent. If you win, this creature gets +2/+0 (D527)'],
  ['Rebellion of the Flamekin', 'a head that watches for a clash (`Whenever you clash, you may pay {1}. If you do, cr`) outside the library (D527)'],
  ['Weed Strangle', 'the row maker: a spell with a line outside the vocabulary: Destroy target creature. Clash with an opponent. If you win, (D527)'],
  ['Spring Cleaning', 'the row maker: a spell with a line outside the vocabulary: Destroy target enchantment. Clash with an opponent. If you w (D527)'],
  ['Fire Juggler', 'the row maker: trigger payload not a pump: Clash with an opponent. If you win, this creature deals 4 da (D527)'],
  ["Nath's Elite", 'the row maker: a line that is neither an activated ability nor a library trigger: All creatures able to block this creature do so. (D527)'],
  ['Fistful of Force', 'the row maker: a spell with a line outside the vocabulary: Target creature gets +2/+2 until end of turn. Clash with an (D527)'],
  // D526 - manifest: the top card face down as a 2/2 and the dread are the engine's now; what stays is the rider on the card the clause MADE, the repeats, the piles and the heads.
  ['Wildcall', 'a rider on the manifested card (`Manifest the top card of your library, then put X +1/+1 coun`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Cloudform', 'the row maker: trigger payload not a pump: ~ becomes an Aura with enchant creature. Manifest the top ca (D526)'],
  ['Fierce Invocation', 'a rider on the manifested card (`Manifest the top card of your library, then put two +1/+1 co`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Arbiter of the Ideal', 'the row maker: trigger payload not a pump: Reveal the top card of your library. If it\'s an artifact, cr (D526)'],
  ['Rageform', 'the row maker: trigger payload not a pump: ~ becomes an Aura with enchant creature. Manifest the top ca (D526)'],
  ['Dissection Tools', 'a rider on the manifested card (`When this Equipment enters, manifest dread, then attach this`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Kozilek, the Broken Reality', 'a counted manifest (`When you cast this spell, up to two target players`) (D526)'],
  ['Ticket Booth // Tunnel of Hate', 'the row maker: multi-face or unusual layout (D526)'],
  ['Thieving Amalgam', 'the row maker: a player referent payload the vocabulary does not read: You manifest the top card of target player\'s library. (D526)'],
  ['Under the Skin', 'the row maker: a spell with a line outside the vocabulary: Manifest dread. (Look at the top two cards of your library. (D526)'],
  ['Hauntwoods Shrieker', 'a manifest line under a shape the row maker never reached (`Whenever this creature attacks, manifest dread.`) (D526)'],
  ['Experimental Lab // Staff Room', 'a rider on the manifested card (`When you unlock this door, manifest dread, then put two +1/+`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Mastery of the Unseen', 'the row maker: a board-sized life gain the suite cannot pin: You gain 1 life for each creature you control. (D526)'],
  ['Formless Nurturing', 'a rider on the manifested card (`Manifest the top card of your library, then put a +1/+1 coun`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Ghastly Conscription', 'a manifest of a shuffled pile (`Exile all creature cards from target player\'s grav`) (D526)'],
  ['Jeskai Infiltrator', 'a manifest of a shuffled pile (`When this creature deals combat damage to a player`) (D526)'],
  ['The Kami War // O-Kagachi Made Manifest', 'a name, not the verb (`O-Kagachi Made Manifest is all colors`) (D526)'],
  ['Conductive Machete', 'a rider on the manifested card (`When this Equipment enters, manifest dread, then attach this`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Primordial Mist', 'the row maker: cost: Exile a face-down permanent you control face up (D526)'],
  ['Whisperwood Elemental', 'the row maker: a leftover line not among the printed lines: Sacrifice this creature: Until end of turn, face-u (D526)'],
  ['Moldering Gym // Weight Room', 'a rider on the manifested card (`When you unlock this door, manifest dread, then put three +1`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Temur War Shaman', 'the row maker: trigger payload not a pump: If it\'s a creature, you may have it fight target creature yo (D526)'],
  ['Underwater Tunnel // Slimy Aquarium', 'a rider on the manifested card (`When you unlock this door, manifest dread, then put a +1/+1 `): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Zimone, Mystery Unraveler', 'the face-up verb (`turn a permanent you control face up`) outside the vocabulary (D526)'],
  ['Defiant Survivor', 'the row maker: trigger payload not a pump: If this creature is tapped, manifest dread. (D526)'],
  ["Valgavoth's Onslaught", 'a dread repeated (`Manifest dread X times, then put X +1/+1 counters `): one ask per dread, chained - not this wave (D526)'],
  ['Lightform', 'the row maker: trigger payload not a pump: ~ becomes an Aura with enchant creature. Manifest the top ca (D526)'],
  ['Unidentified Hovership', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: this): When this Vehicle leaves the battlefield, the exiled c (D526)'],
  ["Ugin's Mastery", 'the row maker: trigger head not in the library: Whenever you attack with creatures with total power 6 or greater, you (D526)'],
  ['Glitch Interpreter', 'the row maker: an intervening if outside the closed reader: you control no face-down permanents (D526)'],
  ['Abhorrent Oculus', 'the row maker: a line that is neither an activated ability nor a library trigger: As an additional cost to cast this spell, exile six cards from your (D526)'],
  ['They Came from the Pipes', 'a dread repeated (`When this enchantment enters, manifest dread twice`): one ask per dread, chained - not this wave (D526)'],
  ['Growing Dread', 'the row maker: trigger head not in the library: Whenever you turn a permanent face up, put a +1/+1 counter on it. (D526)'],
  ['Write into Being', 'a rider on the manifested card (`Look at the top two cards of your library. Manifest one of t`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Turn Inside Out', 'the row maker: a spell with a line outside the vocabulary: Target creature gets +3/+0 until end of turn. When it dies t (D526)'],
  ['Paranormal Analyst', 'a head that watches for a manifest dread (`Whenever you manifest dread`) outside the library (D526)'],
  ['Qarsi Deceiver', 'a spend restriction naming the manifest flip (`pay a mana cost to turn a manifested creature face up`) (D526)'],
  ['Arashin War Beast', 'the row maker: trigger head not in the library: Whenever this creature deals combat damage to one or more blocking cre (D526)'],
  ['Threats Around Every Corner', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: face-down): Whenever a face-down permanent you control enters (D526)'],
  ['Curator Beastie', 'the row maker: a line that is neither an activated ability nor a library trigger: Colorless creatures you control enter with two additional +1/+1 coun (D526)'],
  ['Guardian of the Forgotten', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: modified): Whenever a modified creature you control dies, man (D526)'],
  ['Omarthis, Ghostfire Initiate', 'a counted manifest (`When Omarthis dies, manifest a number of cards fro`) (D526)'],
  ['Stay Hidden, Stay Silent', 'the row maker: effect not a row kind: Shuffle enchanted creature into its owner\'s library, then manifest dread. (D526)'],
  ['Cryptic Pursuit', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell from your (D526)'],
  ['Fear of Impostors', 'the row maker: a vocabulary effect the suite cannot assert: counter (D526)'],
  ["Killer's Mask", 'a rider on the manifested card (`When this Equipment enters, manifest dread, then attach this`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Cursed Windbreaker', 'a rider on the manifested card (`When this Equipment enters, manifest dread, then attach this`): a referent to a card the clause MADE, which the vocab (D526)'],
  ['Disturbing Mirth', 'the row maker: a filtered head outside the closed reader (an adjective outside the list: this): When you sacrifice this enchantment, manifest dread. (D526)'],
  // D525 - cascade: the keyword is the engine's now; what stays is every line that GRANTS it to spells, watches for it, or rides it.
  ['Quandrix, the Proof', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Instant and sorcery sp (D525)'],
  ['The First Sliver', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Sliver spells you cast (D525)'],
  ['Wild-Magic Sorcerer', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`The first spell you ca (D525)'],
  ['Averna, the Chaos Bloom', 'a rider on the cascade itself (`As you cascade, you may put a land card from among`) (D525)'],
  ['Rain of Riches', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`The first spell you ca (D525)'],
  ['Abaddon the Despoiler', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Mark of Chaos Ascendan (D525)'],
  ['Flamekin Herald', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Commander spells you c (D525)'],
  ['Smoldering Stagecoach', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Whenever this Vehicle (D525)'],
  ['Aurora Phoenix', 'a head that watches for a cast spell with cascade (`Whenever you cast a spell with cascade, return thi`) (D525)'],
  ['Maelstrom Nexus', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`The first spell you ca (D525)'],
  ['Wildsear, Scouring Maw', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Enchantment spells you (D525)'],
  ['Yidris, Maelstrom Wielder', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Whenever Yidris deals (D525)'],
  ['Bloodbraid Marauder', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Delirium — This spell (D525)'],
  ['TARDIS', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Whenever this Vehicle (D525)'],
  ['Dark Apostle', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Gift of Chaos — {3}, { (D525)'],
  ['Imoti, Celebrant of Bounty', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Spells you cast with m (D525)'],
  ['Sloppity Bilepiper', 'a static or effect that GRANTS cascade to spells - a spell keyword the derive does not carry for a spell it is not printed on (`Jolly Gutpipes — {2}, (D525)'],
  // D524 - the gate inside a payload: the gates the suite can now ARM left these behind - a fact only the CAST can remember, a coin flip, and a gate whose own recipe fires the row trigger.
  ['Flame Discharge', 'a CAST-TIME fact the gate cannot ask at resolution (`you controlled a modified creature as you cast this spell`): the cast has to remember it, as the (D524)'],
  ['Scute Swarm', 'a payload gate whose recipe fires the row\'s own trigger (the permanents the gate needs are the very enters the head watches) (D524) (D524)'],
  // D523 - the gated clause: the riders whose CONDITION the closed union still does not read (the cast-time facts, the predicates just outside it).
  ["Sevinne's Reclamation", 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Molten-Core Maestro', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Leinore, Autumn Sovereign', 'a predicate outside the closed condition union (`you control three or more creatures with different powers`) (D523)'],
  ["Witch's Oven", 'a predicate outside the closed condition union (`the sacrificed creature\'s toughness was 4 or greater`) (D523)'],
  ['Scavenging Ooze', 'a cast-time fact outside the union (`it was a creature card`) (D523)'],
  ['Clear the Stage', 'a predicate outside the closed condition union (`you control a creature with power 4 or greater`) (D523)'],
  ['From Father to Son', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Increasing Devotion', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Tellah, Great Sage', 'a cast-time fact outside the union (`four or more mana was spent to cast that spell`) (D523)'],
  ['Finneas, Ace Archer', 'a predicate outside the closed condition union (`creatures you control have total power 10 or greater`) (D523)'],
  ['Purging Scythe', 'a predicate outside the closed condition union (`two or more creatures are tied for least toughness`) (D523)'],
  ['Soul Search', 'a predicate outside the closed condition union (`the card\'s mana value is 1 or less`) (D523)'],
  ['Increasing Confusion', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Sunpearl Kirin', 'a cast-time fact outside the union (`it was a token`) (D523)'],
  ['Sold Out', 'a cast-time fact outside the union (`it was dealt damage this turn`) (D523)'],
  ['Strider, Ranger of the North', 'a predicate outside the closed condition union (`that creature has power 4 or greater`) (D523)'],
  ['Zaffai, Thunder Conductor', 'a predicate outside the closed condition union (`that spell\'s mana value is 5 or greater`) (D523)'],
  ['See the Truth', 'a cast-time fact outside the union (`this spell was cast from anywhere other than your hand`) (D523)'],
  ['Hit the Mother Lode', 'a predicate outside the closed condition union (`the discovered card\'s mana value is less than 10`) (D523)'],
  ['Expressive Firedancer', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Demonlord Belzenlok', 'a predicate outside the closed condition union (`the card\'s mana value is 4 or greater`) (D523)'],
  ['Ignite the Future', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Duel for Dominance', 'a predicate outside the closed condition union (`you control three or more creatures with different powers`) (D523)'],
  ['Increasing Savagery', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Increasing Vengeance', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ["Evil's Thrall", 'a predicate outside the closed condition union (`you control a Villain with greater mana value than that crea`) (D523)'],
  ['Nibelheim Aflame', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Ilysian Caryatid', 'a predicate outside the closed condition union (`you control a creature with power 4 or greater`) (D523)'],
  ['Otterball Antics', 'a cast-time fact outside the union (`this spell was cast from anywhere other than your hand`) (D523)'],
  ['Exhibition Tidecaller', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Rescue, Pepper Potts', 'a cast-time fact outside the union (`it was an artifact`) (D523)'],
  ['Misfortune Teller', 'a cast-time fact outside the union (`it was a creature card`) (D523)'],
  ['Turntimber Symbiosis // Turntimber, Serpentine Wood', 'a predicate outside the closed condition union (`that card has mana value 3 or less`) (D523)'],
  ['Betor, Kin to All', 'a predicate outside the closed condition union (`creatures you control have total toughness 20 or greater`) (D523)'],
  ['Anchor to Reality', 'a predicate outside the closed condition union (`it has mana value less than the sacrificed permanent\'s mana `) (D523)'],
  ['Thunderdrum Soloist', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Break Out', 'a predicate outside the closed condition union (`that card has mana value 2 or less`) (D523)'],
  ['Dance with Calamity', 'a predicate outside the closed condition union (`the total mana value of the cards exiled this way is 13 or l`) (D523)'],
  ['Carrion Locust', 'a cast-time fact outside the union (`it was a creature card`) (D523)'],
  ['Antiquities on the Loose', 'a cast-time fact outside the union (`this spell was cast from anywhere other than your hand`) (D523)'],
  ['Prismari Pianist', 'a predicate outside the closed condition union (`that spell\'s mana value is 5 or greater`) (D523)'],
  ['Glorious Gale', 'a cast-time fact outside the union (`it was a legendary spell`) (D523)'],
  ['Increasing Ambition', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Carnivorous Canopy', 'a predicate outside the closed condition union (`that permanent\'s mana value was 3 or less`) (D523)'],
  ['Raze to the Ground', 'a predicate outside the closed condition union (`its mana value was 1 or less`) (D523)'],
  ['Colorstorm Stallion', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Herald of Ilharg', 'a predicate outside the closed condition union (`that spell has mana value 5 or greater`) (D523)'],
  ['Entish Restoration', 'a predicate outside the closed condition union (`you control a creature with power 4 or greater`) (D523)'],
  ['Secrets of the Key', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Tackle Artist', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['The Final Days', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ["Undercity's Embrace", 'a predicate outside the closed condition union (`you control a creature with power 4 or greater`) (D523)'],
  ['Gore Vassal', 'a predicate outside the closed condition union (`that creature\'s toughness is 1 or greater`) (D523)'],
  ['Elemental Mascot', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Reject Imperfection', 'a predicate outside the closed condition union (`that spell\'s mana value was 3 or less`) (D523)'],
  ['Ruthless Negotiation', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Spectacular Skywhale', 'a cast-time fact outside the union (`five or more mana was spent to cast that spell`) (D523)'],
  ['Raucous Audience', 'a predicate outside the closed condition union (`you control a creature with power 4 or greater`) (D523)'],
  ['Seedship Impact', 'a predicate outside the closed condition union (`its mana value was 2 or less`) (D523)'],
  ['Serum Snare', 'a predicate outside the closed condition union (`that permanent had mana value 3 or less`) (D523)'],
  ['Prismari Apprentice', 'a predicate outside the closed condition union (`that spell has mana value 5 or greater`) (D523)'],
  ['Brackish Blunder', 'a cast-time fact outside the union (`it was tapped`) (D523)'],
  ['Retrieve the Esper', 'a cast-time fact outside the union (`this spell was cast from a graveyard`) (D523)'],
  ['Zephyr Sentinel', 'a cast-time fact outside the union (`it was a Soldier`) (D523)'],
  ['Tainted Treats', 'a predicate outside the closed condition union (`its mana value was 4 or less`) (D523)'],
  // D522 - the monarch: the family's rows the wave refused, by its own reasons.
  ['Crown of Gondor', 'equipped creature attacks without an Equip line the engine charges (D522)'],
  ['Fealty to the Realm', 'a line that is neither an activated ability nor a library trigger: The monarch controls enchanted creature. (D522)'],
  ['Keeper of Keys', 'trigger payload not a pump: Creatures you control can\'t be blocked this turn. (D522)'],
  ['Queen Marchesa', 'a token outside TOKEN_TABLE: Assassin|1/1|B|Creature|deathtouch,haste (D522)'],
  ["Marchesa's Decree", 'trigger head not in the library: Whenever a creature attacks you or a planeswalker you control, that cr (D522)'],
  ['Forth Eorlingas!', 'the spell\'s X on the token count and a combat-damage reflexive head (`Whenever one or more creatures you control deal combat damage to one or more pla (D522)'],
  ['Jared Carthalion, True Heir', 'trigger payload not a pump: Target opponent becomes the monarch. You can\'t become the mo (D522)'],
  ['Queen Mother Ramonda', 'a conditional body outside the static vocabulary: creatures with power 2 or less can\'t attack you (D522)'],
  ['Court of Vantress', 'trigger payload not a pump: Choose up to one other target enchantment or artifact. If yo (D522)'],
  ['Crown-Hunter Hireling', 'a line that is neither an activated ability nor a library trigger: ~ can\'t attack unless defending player is the monarch. (D522)'],
  ['Fight for the Throne', 'a fight after a counter with a reflexive death trigger (`When the creature an opponent controls dies this turn, if you control your commander, you bec (D522)'],
  ['Court of Ire', 'trigger payload not a pump: This enchantment deals 2 damage to any target. If you\'re the (D522)'],
  ['Faramir, Steward of Gondor', 'a filtered head outside the closed reader (an adjective outside the list: legendary): Whenever a legendary creature you control with mana value 4 (D522)'],
  ['Heart-Shaped Herb', 'a line that is neither an activated ability nor a library trigger: If a source an opponent controls would deal damage to you, prevent 1 o (D522)'],
  ['Court of Bounty', 'trigger payload not a pump: Put a land card from your hand onto the battlefield. If you\' (D522)'],
  ['Emberwilde Captain', 'trigger head not in the library: Whenever an opponent attacks you while you\'re the monarch, this creatu (D522)'],
  ['Okoye, Mighty and Adored', 'trigger payload not a pump: Put a +1/+1 counter on target creature. Whenever that creatu (D522)'],
  ['Oath of Eorl', 'the row maker: a token outside TOKEN_TABLE: Human Knight|2/2|R|Creature|trample,haste (D528)'],
  ['Protector of the Crown', 'a line that is neither an activated ability nor a library trigger: All damage that would be dealt to you is dealt to this creature instea (D522)'],
  ['Regal Behemoth', 'trigger head not in the library: Whenever you tap a land for mana while you\'re the monarch, add an addi (D522)'],
  ["M'Baku, Jabari Chieftain", 'an intervening if the armed board already meets (not this wave): there is no monarch (D522)'],
  ['Champions of Minas Tirith', 'trigger head not in the library: At the beginning of combat on each opponent\'s turn, if you\'re the mona (D522)'],
  ['Court of Locthwain', 'a condition outside the closed vocabulary: it remains exiled, and mana of any type can be spent to cast (D522)'],
  ["T'Chaka, Venerable King", 'trigger payload not a pump: Mill three cards, then you may put an artifact or land card (D522)'],
  ['Fall from Favor', 'trigger payload not a pump: Tap enchanted creature and you become the monarch. (D522)'],
  ['Palace Jailer', 'trigger payload not a pump: Exile target creature an opponent controls until an opponent (D522)'],
  ['Archon of Coronation', 'a conditional body outside the static vocabulary: damage doesn\'t cause you to lose life (D522)'],
  ['Court of Cunning', 'trigger payload not a pump: Any number of target players each mill two cards. If you\'re (D522)'],
  ['Court of Embereth', 'trigger payload not a pump: Create a 3/1 red Knight creature token. Then if you\'re the m (D522)'],
  ['Entourage of Trest', 'a conditional combat restriction (not this wave): blockCapacity (D522)'],
  ['Archivist of Gondor', 'trigger head not in the library: When your commander deals combat damage to a player, if there is no mo (D522)'],
  ['Court of Ardenvale', 'trigger payload not a pump: Return target permanent card with mana value 3 or less from (D522)'],
  ['Dawnglade Regent', 'a conditional body outside the static vocabulary: permanents you control have hexproof (D522)'],
  ['Court of Ambition', 'trigger payload not a pump: Each opponent loses 3 life unless they discard a card. If yo (D522)'],
  ['Coin of Fate', 'effect not a row kind: An opponent chooses one of the exiled cards. You put that card on the bottom of your library and return the other to the battle (D522)'],
  ["King Solomon's Frogs", 'an intervening if outside the closed reader: you cast it (D522)'],
  ['Starscream, Power Hungry // Starscream, Seeker Leader', 'multi-face or unusual layout (D522)'],
  ['Court of Garenbrig', 'trigger payload not a pump: Distribute two +1/+1 counters among up to two target creatur (D522)'],
  ['Canal Courier', 'trigger head not in the library: Whenever this creature and another creature attack different players, (D522)'],
  ['Azure Fleet Admiral', 'a blocker predicate outside the closed reader (an adjective outside the list: creatures): creatures the monarch controls (D522)'],
  ['Garland, Royal Kidnapper', 'a condition outside the closed vocabulary: they\'re the monarch (D522)'],
  ['The Spear of Bashenga', 'an intervening if the armed board already meets (not this wave): there is no monarch (D522)'],
  ['Knights of the Black Rose', 'trigger head not in the library: Whenever an opponent becomes the monarch, if you were the monarch as t (D522)'],
  ["Inventors' Fair", 'the row\'s other ability arms the intervening if this one must break (its activation condition needs three artifacts on the board, so the upkeep trigge (D522)'],
  ['Thopter Spy Network', 'the row\'s other ability arms the intervening if this one must break (the artifact its own trigger makes satisfies the artifact count before the proof can show it unmet) (D522)'],
  // D521 - the Ring tempts you: the family's rows the wave refused, by its own reasons.
  ['Faramir, Field Commander', 'an intervening if outside the closed reader: a creature died under your control this turn (D521)'],
  ['Witch-king of Angmar', 'trigger head not in the library: Whenever one or more creatures deal combat damage to you, each opponen (D521)'],
  ['Slip On the Ring', 'a flicker under your control (`Exile target creature you own, then return it to the battlefield under your control`) beside the temptation (D521)'],
  ['Rangers of Ithilien', 'a condition outside the closed vocabulary: you control this creature. Then the Ring tempts you (D521)'],
  ['Breaking of the Fellowship', 'a creature dealing damage equal to its power to another target creature its controller controls (a bite between an opponent\'s own) beside the temptati (D521)'],
  ['Sméagol, Helpful Guide', 'an intervening if outside the closed reader: a creature died under your control this turn (D521)'],
  ['Gandalf, Friend of the Shire', 'a line that is neither an activated ability nor a library trigger: You may cast sorcery spells as though they had flash. (D521)'],
  ['Aragorn, Company Leader', 'trigger payload not a pump: If you chose a creature other than ~ as your Ring-bearer, pu (D521)'],
  ['There and Back Again', 'the row maker: a condition outside the closed vocabulary: you control ~. The Ring tempts you (D528)'],
  ['Nazgûl', 'a line that is neither an activated ability nor a library trigger: A deck can have up to nine cards named ~. (D521)'],
  ['Samwise the Stouthearted', 'a filtered head no fixture satisfies: Samwise (D521)'],
  ['Scroll of Isildur', 'the row maker: a condition outside the closed vocabulary: you control ~. The Ring tempts you (D528)'],
  ["Gollum's Bite", 'a graveyard activation on an instant (`{3}{B}, Exile this card from your graveyard: The Ring tempts you. Activate only as a sorcery`) (D521)'],
  ['The Ring Goes South', 'the temptation before a reveal-until-X-lands (`where X is the number of legendary creatures you control`) - the ask is not the sentence\'s last (D521)'],
  ['Boromir, Warden of the Tower', 'trigger payload not a pump: If no mana was spent to cast it, counter that spell. (D521)'],
  ['Sauron, the Necromancer', 'trigger payload not a pump: Exile target creature card from your graveyard. Create a tap (D521)'],
  ['Lord of the Nazgûl', 'a line that is neither an activated ability nor a library trigger: Wraiths you control have protection from Ring-bearers. (D521)'],
  ['Ringwraiths', 'trigger payload not a pump: Target creature an opponent controls gets -3/-3 until end of (D521)'],
  ['Elrond, Lord of Rivendell', 'trigger payload not a pump: Scry 1. If this is the second time this ability has resolved (D521)'],
  ['Frodo, Adventurous Hobbit', 'a line that is neither an activated ability nor a library trigger: Partner with Sam, Loyal Attendant (D521)'],
  ['Call of the Ring', 'trigger head not in the library: Whenever you choose a creature as your Ring-bearer, you may pay 2 life (D521)'],
  ['Ringsight', 'the temptation before a search for a card sharing a color with a legendary creature you control - the ask is not the sentence\'s last (D521)'],
  ['Frodo Baggins', 'a filtered head outside the closed reader (an adjective outside the list: ~): Whenever ~ or another legendary creature you control enters, (D521)'],
  ['Galadriel of Lothlórien', 'trigger payload not a pump: If you chose a creature other than Galadriel as your Ring-be (D521)'],
  ['In the Darkness Bind Them', 'the row maker: trigger payload not a pump: For each opponent, gain control of up to one target creature (D528)'],
  ['Galadriel, Elven-Queen', 'an intervening if outside the closed reader: another Elf entered the battlefield under your control this (D521)'],
  ['Dúnedain Rangers', 'an intervening if outside the closed reader: you don\'t control a Ring-bearer (D521)'],
  ['One Ring to Rule Them All', 'the row maker: trigger payload not a pump: The Ring tempts you, then each player mills cards equal to y (D528)'],
  ["Sauron's Ransom", 'an opponent\'s pile split (`separate them into a face-down pile and a face-up pile`) beside the temptation (D521)'],
  ['Glorious Gale', 'a conditional temptation after a counter (`If it was a legendary spell, the Ring tempts you`) (D521)'],
  ['Dreadful as the Storm', 'a base power and toughness set (`has base power and toughness 5/5 until end of turn`) beside the temptation (D521)'],
  ['Horses of the Bruinen', 'an up-to-two bounce beside a scry and the temptation (an ask after an ask) (D521)'],
  // D520 - amass: the family's rows the wave refused, by its own reasons.
  ['Sauron, the Dark Lord', 'a line that is neither an activated ability nor a library trigger: Ward—Sacrifice a legendary artifact or legendary creature. (D520)'],
  ['Gríma Wormtongue', 'a line that is neither an activated ability nor a library trigger: Your opponents can\'t gain life. (D520)'],
  ['Dreadhorde Invasion', 'trigger head not in the library: Whenever a Zombie token you control with power 6 or greater attacks, i (D520)'],
  ['Book of Mazarbul', 'multi-face or unusual layout (D520)'],
  ['Shagrat, Loot Bearer', 'trigger payload not a pump: Attach up to one target Equipment to it. Then amass Orcs X, (D520)'],
  ['Gleaming Overseer', 'a line that is neither an activated ability nor a library trigger: Zombie tokens you control have hexproof and menace. (D520)'],
  ['Orcish Bowmasters', 'trigger head not in the library: When this creature enters and whenever an opponent draws a card except (D520)'],
  ['Sauron, Lord of the Rings', 'trigger payload not a pump: Amass Orcs 5, mill five cards, then return a creature card f (D520)'],
  ['Corsairs of Umbar', 'effect not a row kind: Target Goblin, Orc, or Pirate can\'t be blocked this turn. (D520)'],
  ['The Mouth of Sauron', 'trigger payload not a pump: Target player mills three cards. Then amass Orcs X, where X (D520)'],
  ['Warg Rider', 'a line that is neither an activated ability nor a library trigger: Other Orcs and Goblins you control have menace. (D520)'],
  ['Mindless Conscription', 'trigger head not in the library: When this enchantment enters and whenever you draw your third card eac (D520)'],
  ['Lazotep Sliver', 'a scoped continuous body outside the vocabulary: have afflict 2. (D520)'],
  ['Surrounded by Orcs', 'the amassed Army\'s power as X (`Amass Orcs 3, then target player mills X cards, where X is the amassed Army\'s power`) (D520)'],
  ['Commence the Endgame', 'the counted amass under a `, then` compound (`Draw two cards, then amass Zombies X, where X is the number of cards in your hand`) beside its uncounter (D520)'],
  ['Fall of Cair Andros', 'trigger head not in the library: Whenever a creature an opponent controls is dealt excess noncombat dam (D520)'],
  ['Vizier of the Scorpion', 'a line that is neither an activated ability nor a library trigger: Zombie tokens you control have deathtouch. (D520)'],
  ['Assault on Osgiliath', 'the spell\'s X on the amass and a `, then` mass grant (`Amass Orcs X, then Goblins and Orcs you control gain double strike and haste until end of turn` (D520)'],
  ['Lazotep Chancellor', 'trigger payload not a pump: You may pay {1}. If you do, amass Zombies 2. (D520)'],
  ['Lazotep Plating', 'a player-and-permanents hexproof grant beside the amass (`You and permanents you control gain hexproof until end of turn`) (D520)'],
  ['Barad-dûr', 'cost: an X on an activated line (D520)'],
  ['Moria Scavenger', 'effect not a row kind: Draw a card. If the discarded card was a creature card, amass Orcs 1. (D520)'],
  ['Foray of Orcs', 'a reflexive trigger on the amass (`Amass Orcs 2. When you do, ~ deals X damage to target creature an opponent controls, where X is the amassed Army\'s (D520)'],
  ['Enter the God-Eternals', 'damage with a life gain equal to it and a mill beside the amass (`~ deals 4 damage to target creature and you gain life equal to the damage dealt this (D520)'],
  ['Gothmog, Morgul Lieutenant', 'a line that is neither an activated ability nor a library trigger: Creature tokens you control have deathtouch. (D520)'],
  ['Grishnákh, Brash Instigator', 'trigger payload not a pump: Amass Orcs 2. When you do, until end of turn, gain control o (D520)'],
  ['Saruman, the White Hand', 'trigger payload not a pump: Amass Orcs X, where X is that spell\'s mana value. (D520)'],
  ['Orcish Medicine', 'a keyword choice on a target (`your choice of lifelink or indestructible`) beside the amass (D520)'],
  ['Summons of Saruman', 'the spell\'s X on the amass, a mill of X and a free cast from among the milled (`You may cast an instant or sorcery spell with mana value X or less fro (D520)'],
  ['Treason of Isengard', 'a graveyard-to-library-top put of an up-to-one target instant or sorcery card beside the amass (D520)'],
  ['Dreadhorde Twins', 'a line that is neither an activated ability nor a library trigger: Zombie tokens you control have trample. (D520)'],
  ['March from the Black Gate', 'trigger head not in the library: When this enchantment enters and whenever an Army you control attacks, (D520)'],
  ['Invade the City', 'the counted amass (`Amass Zombies X, where X is the number of instant and sorcery cards in your graveyard`) (D520)'],
  ['Widespread Brutality', 'the amassed Army as a damage source (`Amass Zombies 2, then the Army you amassed deals damage equal to its power to each non-Army creature`) (D520)'],
  ['Eternal Skylord', 'a line that is neither an activated ability nor a library trigger: Zombie tokens you control have flying. (D520)'],
  // D519 - energy: the family's rows the wave refused, by its own reasons.
  ['Aethertorch Renegade', 'cost: Pay eight {E} (D519)'],
  ['Aether Spike', 'a spell with a line outside the vocabulary: Choose target spell. You get {E}{E} (two energy counters (D519)'],
  ['Die Young', 'a spell with a line outside the vocabulary: Choose target creature. You get {E}{E} (two energy count (D519)'],
  ['Territorial Aetherkite', 'trigger payload not a pump: You get {E}{E}. Then you may pay one or more {E}. When you d (D519)'],
  ['Synth Eradicator', 'trigger payload not a pump: Exile the top card of your library. You may get {E}{E}. If y (D519)'],
  ['Lightning Runner', 'trigger payload not a pump: You get {E}{E}, then you may pay eight {E}. If you pay, unta (D519)'],
  ['Wrath of the Skies', 'a spell with a line outside the vocabulary: You get X {E} (energy counters), then you may pay any am (D519)'],
  ['The Motherlode, Excavator', 'trigger payload not a pump: Choose target opponent. You get an amount of {E} equal to th (D519)'],
  ['Amped Raptor', 'trigger payload not a pump: You get {E}{E}. Then if you cast it from your hand, exile ca (D519)'],
  ['Voltaic Brawler', 'trigger payload not a pump: You may pay {E}. If you do, it gets +1/+1 and gains trample (D519)'],
  ['Electrozoa', 'trigger payload not a pump: Tap this creature unless you pay {E}. (D519)'],
  ['Brotherhood Scribe', 'trigger head not in the library: Whenever you get one or more {E}, creatures you control get +1/+1 u (D519)'],
  ['Wheel of Potential', 'a spell with a line outside the vocabulary: You get {E}{E}{E} (three energy counters), then you may (D519)'],
  ['Fabrication Module', 'trigger head not in the library: Whenever you get one or more {E}, put a +1/+1 counter on target cre (D519)'],
  ['Aethersquall Ancient', 'cost: Pay eight {E} (D519)'],
  ['Robobrain War Mind', 'trigger payload not a pump: You get an amount of {E} equal to the number of artifact cre (D519)'],
  ["Woodweaver's Puzzleknot", 'trigger payload not a pump: You gain 3 life and get {E}{E}{E}. (D519)'],
  ['Hexgold Slith', 'trigger payload not a pump: You may pay {E}{E}. If you do, it gains first strike until e (D519)'],
  ["Gonti's Aether Heart", 'cost: Pay eight {E} (D519)'],
  ['Guide of Souls', 'trigger payload not a pump: You gain 1 life and get {E}. (D519)'],
  ['Razorfield Ripper', 'trigger head not in the library: Whenever this creature or equipped creature attacks, you get {E}, t (D519)'],
  ['Aetherstream Leopard', 'trigger payload not a pump: You may pay {E}. If you do, it gets +2/+0 until end of turn. (D519)'],
  ['Glint-Sleeve Siphoner', 'trigger payload not a pump: You may pay {E}{E}. If you do, you draw a card and you lose (D519)'],
  ['Galvanic Discharge', 'a spell with a line outside the vocabulary: Choose target creature or planeswalker. You get {E}{E}{E (D519)'],
  ['Aetherwind Basker', 'trigger payload not a pump: You get {E} for each creature you control. (D519)'],
  ['Architect of the Untamed', 'cost: Pay eight {E} (D519)'],
  ['Salvation Colossus', 'a line that is neither an activated ability nor a library trigger: Unearth—Pay eight {E}. (D519)'],
  ['Aethertide Whale', 'trigger payload not a pump: You get six {E}. (D519)'],
  ['Stone Idol Generator', 'trigger head not in the library: Whenever a creature you control attacks, you get {E}. (D519)'],
  ['Izzet Generatorium', 'a line that is neither an activated ability nor a library trigger: If you would get one or more {E}, (D519)'],
  ['Live Fast', 'a spell with a line outside the vocabulary: You draw two cards, lose 2 life, and get {E}{E} (two ene (D519)'],
  ['Assaultron Dominator', 'trigger head not in the library: Whenever an artifact creature you control attacks, you may pay {E}. (D519)'],
  ['Empyreal Voyager', 'trigger payload not a pump: You get that many {E}. (D519)'],
  ['Greenbelt Rampager', 'trigger payload not a pump: Pay {E}{E}. If you can\'t, return this creature to its owner\' (D519)'],
  ['Reservoir Walker', 'trigger payload not a pump: You gain 3 life and get {E}{E}{E}. (D519)'],
  ['Riddle Gate Gargoyle', 'trigger payload not a pump: You may pay {E}{E}. When you do, target creature you control (D519)'],
  ['Reiterating Bolt', 'a spell with a line outside the vocabulary: Replicate—Pay {E}{E}{E}. (When you cast this spell, copy (D519)'],
  ['Behemoth of Vault 0', 'trigger payload not a pump: You may pay an amount of {E} equal to target nonland permane (D519)'],
  ['Chthonian Nightmare', 'an activated line the engine does not index: Pay X {E}, Sacrifice a creature, Return this encha (D519)'],
  ['Electrosiphon', 'a spell with a line outside the vocabulary: Counter target spell. You get an amount of {E} (energy c (D519)'],
  ['Confiscation Coup', 'a spell with a line outside the vocabulary: Choose target artifact or creature. You get {E}{E}{E}{E} (D519)'],
  ['Cyclops Superconductor', 'trigger payload not a pump: You may pay {E}{E}{E}. When you do, this creature deals dama (D519)'],
  ['Localized Destruction', 'a spell with a line outside the vocabulary: You get {E} (an energy counter), then you may pay one or (D519)'],
  ['Riparian Tiger', 'trigger payload not a pump: You may pay {E}{E}. If you do, it gets +2/+2 until end of tu (D519)'],
  ['Aetherstorm Roc', 'trigger payload not a pump: You may pay {E}{E}. If you do, put a +1/+1 counter on it and (D519)'],
  ['Roil Cartographer', 'cost: Pay six {E} (D519)'],
  ["Glassblower's Puzzleknot", 'trigger payload not a pump: Scry 2, then you get {E}{E}. (D519)'],
  ['Peema Aether-Seer', 'trigger payload not a pump: You get an amount of {E} equal to the greatest power among c (D519)'],
  ['Aurora Shifter', 'trigger payload not a pump: You get that many {E}. (D519)'],
  ['Sphinx of the Revelation', 'trigger payload not a pump: You get that many {E}. (D519)'],
  ['Aether Refinery', 'a line that is neither an activated ability nor a library trigger: If you would get one or more {E}, (D519)'],
  ['Nissa, Worldsoul Speaker', 'a line that is neither an activated ability nor a library trigger: You may pay eight {E} rather than (D519)'],
  ['Rampaging Aetherhood', 'trigger payload not a pump: You get an amount of {E} equal to this creature\'s power. The (D519)'],
  ['Voltstorm Angel', 'trigger payload not a pump: You may pay {E}{E}. When you do, choose one — (D519)'],
  ['Peema Trailblazer', 'trigger payload not a pump: You get that many {E}. (D519)'],
  ['Aetherflux Conduit', 'trigger payload not a pump: You get an amount of {E} equal to the amount of mana spent t (D519)'],
  ['Harnessed Lightning', 'a spell with a line outside the vocabulary: Choose target creature. You get {E}{E}{E} (three energy (D519)'],
  ['Pia Nalaar, Chief Mechanic', 'trigger payload not a pump: You may pay one or more {E}. If you do, create an X/X colorl (D519)'],
  // D518 - the granted offer's costs: the family's rows the wave refused, by its own reasons.
  ['Cautery Sliver', 'a quoted body outside the vocabulary: Prevent the next 1 damage that would be dealt to target play (D518)'],
  ['Animal Boneyard', 'a quoted body outside the vocabulary: You gain life equal to the sacrificed creature\'s toughness. (D518)'],
  ['Sinking Feeling', 'a quoted cost the host cannot pay the suite way: {1}, Put a -1/-1 counter on this creature (D518)'],
  ['Mindlash Sliver', 'a quoted body outside the vocabulary: Each player discards a card. (D518)'],
  ['Mindwhip Sliver', 'a quoted body outside the vocabulary: Target player discards a card at random. Activate only as a (D518)'],
  // D517 - the scoped quoted grants: the family's rows the wave refused, by its own reasons.
  ['Far Traveler', 'trigger payload not a pump: Exile up to one target tapped creature you control, then ret (D517)'],
  ['Haunted One', 'trigger payload not a pump: ~ and other creatures you control that share a creature type (D517)'],
  ['Shameless Charlatan', 'a quoted body outside the vocabulary: ~ becomes a copy of another target creature. (D517)'],
  ['Popular Entertainer', 'trigger payload not a pump: Goad target creature that player controls. (D517)'],
  ['Passionate Archaeologist', 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast (D517)'],
  ['Noble Heritage', 'trigger head not in the library: When ~ enters and at the beginning of your upkeep, each player may (D517)'],
  ['Inspiring Leader', 'a quoted grant that is not an activated ability: Creature tokens you control get +2/+2. (D517)'],
  ['Scion of Halaster', 'a quoted grant that is not an activated ability: The first time you would draw a card each turn, in (D517)'],
  ['Veteran Soldier', 'trigger head not in the library: Whenever ~ attacks a player, if no opponent has more life than that (D517)'],
  ['Tavern Brawler', 'trigger payload not a pump: Exile the top card of your library. ~ gets +X/+0 until end o (D517)'],
  ['Hardy Outlander', 'trigger head not in the library: Whenever ~ attacks a player, if no opponent has more life than that (D517)'],
  ['Dragon Cultist', 'an intervening if outside the closed reader: a source you controlled dealt 5 or more damage this tur (D517)'],
  ['Cloakwood Hermit', 'an intervening if outside the closed reader: a creature card was put into your graveyard from anywhe (D517)'],
  ['Guild Artisan', 'trigger head not in the library: Whenever ~ attacks a player, if no opponent has more life than that (D517)'],
  ['Agent of the Iron Throne', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever an artifact (D517)'],
  ['Sword Coast Sailor', 'trigger head not in the library: Whenever ~ attacks a player, if no opponent has more life than that (D517)'],
  ['Folk Hero', 'a filtered head outside the closed reader (an adjective outside the list: spell): Whenever you cast (D517)'],
  ['Dungeon Delver', 'a quoted grant that is not an activated ability: Room abilities of dungeons you own trigger an addi (D517)'],
  ['Feywild Visitor', 'trigger payload not a pump: You create a 1/1 blue Faerie Dragon creature token with flyi (D517)'],
  ['Acolyte of Bahamut', 'a quoted grant that is not an activated ability: The first Dragon spell you cast each turn costs {2 (D517)'],
  ['Master Chef', 'a leftover line not among the printed lines: Commander creatures you own have (D517)'],
  ['Agent of the Shadow Thieves', 'trigger head not in the library: Whenever ~ attacks a player, if no opponent has more life than that (D517)'],
  ['Frenetic Sliver', 'a quoted body outside the vocabulary: If this permanent is on the battlefield, flip a coin. If you (D517)'],
  ['Plague Sliver', 'a granted step head the row\'s own card also carries (two fires): At the beginning of your upkeep, th (D517)'],
  ['Opaline Sliver', 'trigger head not in the library: Whenever ~ becomes the target of a spell an opponent controls, you (D517)'],
  ['Mistform Sliver', 'a quoted body outside the vocabulary: ~ becomes the creature type of your choice in addition to it (D517)'],
  ['Dementia Sliver', 'a quoted body outside the vocabulary: Choose a card name. Target opponent reveals a card at random (D517)'],
  ['Mesmeric Sliver', 'trigger payload not a pump: Fateseal 1. (D517)'],
  ['Spiteful Sliver', 'a granted damage-taken head under a scope (the block recipe is the row card\'s; not this wave): isDea (D517)'],
  ['Taunting Sliver', 'trigger payload not a pump: Goad target creature an opponent controls. (D517)'],
  ['Regal Sliver', 'trigger payload not a pump: Slivers you control get +1/+1 until end of turn if you\'re th (D517)'],
  ['Psionic Sliver', 'a quoted body outside the vocabulary: ~ deals 2 damage to any target and 3 damage to itself. (D517)'],
  ['Vampiric Sliver', 'a filtered head outside the closed reader (an adjective outside the list: dealt): Whenever a creatur (D517)'],
  ['Fungus Sliver', 'a self payload on a creature the test damage kills: toughness 2 (D517)'],
  ['Dionus, Elvish Archdruid', 'trigger payload not a pump: Untap it and put a +1/+1 counter on ~. (D517)'],
  ['Breath of Dreams', 'a quoted grant that is not an activated ability: Cumulative upkeep {1}. (D517)'],
  ['Magma Sliver', 'a counted payload under a scoped grant (the scope\'s own members are counted; not this wave): Target (D517)'],
  // D516 - the item under a filtered head and the card that died: the family's remainder, by its own reason.
  ['Stalking Vengeance', 'a payload acting on a creature that died (a card in the graveyard; not this wave): Target creature deals damage equal to its power to any target (D516)'],
  // D515 - the stat family's remainder: the cards the wave refused, by its own reasons.
  // D514 - the object's stat as last known: the cards of the family the row maker refused, by its own reasons.
  ['Grim Feast', 'trigger payload not a pump: You gain life equal to its toughness. (D514)'],
  ["Trostani, Selesnya's Voice", 'a vocabulary effect the suite cannot assert: populate (D514)'],
  ['Righteous Valkyrie', 'a condition outside the closed vocabulary: you have at least 7 life more than your starting life tot (D514)'],
  ['Death Watch', 'trigger payload not a pump: Its controller loses life equal to its power and you gain li (D514)'],
  ['Noxious Gearhulk', 'trigger payload not a pump: Destroy another target creature. If a creature is destroyed (D514)'],
  ['Paladin of Atonement', 'trigger payload not a pump: If you lost life last turn, put a +1/+1 counter on ~. (D514)'],
  ['Abattoir Ghoul', 'a filtered head outside the closed reader (an adjective outside the list: dealt): Whenever a creatur (D514)'],
  ['Garruk, Apex Predator', 'a vocabulary clause the suite has no fixture for: a battle clause (D514)'],
  // D513 - the first-time-each-turn head: the cards of the family the row maker refused, by its own reasons.
  ['Whiskervale Forerunner', 'trigger payload not a pump: Look at the top five cards of your library. You may reveal a (D513)'],
  ['Jetting Glasskite', 'trigger payload not a pump: Counter that spell or ability. (D513)'],
  ['Shimmering Glasskite', 'trigger payload not a pump: Counter that spell or ability. (D513)'],
  ['Deathless Knight', 'trigger head not in the library: When you gain life, return this card from your graveyard to your ha (D513)'],
  ['Veteran Guardmouse', 'trigger payload not a pump: ~ gets +1/+0 and gains first strike until end of turn. Scry (D513)'],
  ['Scourge of the Throne', 'an intervening if outside the closed reader: it\'s attacking the player with the most life or tied fo (D513)'],
  ['Erdwal Illuminator', 'trigger head not in the library: Whenever you investigate, investigate an additional time. (D513)'],
  ['Valiant Rescuer', 'a first-time-each-turn head with no turn record to read (not this wave): youCycle (D513)'],
  ['Axgard Artisan', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on this creature, creat (D513)'],
  ['Raphael, Tag Team Tough', 'a mass verb over a scope the suite has no witness for (not this wave): Untap all attacking creatures (D513)'],
  ['Whispering Snitch', 'trigger head not in the library: Whenever you surveil, this creature deals 1 damage to each opponent (D513)'],
  ['Leech Collector // Bloodletting', 'multi-face or unusual layout (D513)'],
  ['Mindlink Mech', 'trigger head not in the library: Whenever this Vehicle becomes crewed, until end of turn, this Vehic (D513)'],
  // D512 - the additional combat phase: the rows the select offered and the row maker refused, by its own reasons.
  ['Éomer, Marshal of Rohan', 'a filtered head outside the closed reader (an adjective outside the list: attacking): Whenever one or more other attacking legendary creatures you (D512)'],
  ['Full Throttle', 'a spell with a line outside the vocabulary: After this main phase, there are two additional combat phase (D512)'],
  // D511 - bolster: the rows the select offered and the row maker refused, by its own reasons.
  ['Anafenza, Kin-Tree Spirit', 'a bolster under a head the staged creature would fire: anotherCreatureEnters (D511)'],
  ['Dromoka, the Eternal', 'trigger head not in the library: Whenever a Dragon you control attacks, bolster 2. (D511)'],
  // D510 - the untap choice, the mass can't-block and the wheel: the rows the select offered and the row maker refused, by its own reasons.
  ['Midnight Clock', 'trigger payload not a pump: Put an hour counter on this artifact. (D510)'],
  // D509 - the controller word on every target noun: the rows the select offered and the row maker refused, by its own reasons.
  ['Avalanche Caller', 'a vocabulary clause the suite has no fixture for: no fixture for Target snow land you control (D509)'],
  ['Dual Casting', 'a quoted body outside the vocabulary: Copy target instant or sorcery spell you control. You may ch (D509)'],
  ['Ebony Horse', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by that creature this (D509)'],
  ['Elvish Scout', 'a combat-only scoped shield the suite cannot prove (it must attack): Prevent all combat damage that would be dealt to and dealt by it this turn. (D509)'],
  ['Hope-Ender Coatl', 'a payment whose payer the suite cannot name: targetPlayer (D509)'],
  ['Masked Vandal', 'a payment branch the suite cannot assert: exile (D509)'],
  ['Mobile Garrison', 'an attack head on a card with no creature body: vehicleAttacks (D509)'],
  ['Rootha, Mercurial Artist', 'a vocabulary effect the suite cannot assert: copySpell (D509)'],
  ['Sea Drake', 'a vocabulary clause the suite has no fixture for: a counted clause (2..2) (D509)'],
  ["Silvanus's Invoker", 'ability-word activated line: Conjure Elemental — {8}: Untap target la (D509)'],
  ['Witch Enchanter // Witch-Blessed Meadow', 'multi-face or unusual layout (D509)'],
  ['Fey Steed', 'trigger head not in the library: Whenever a creature or planeswalker you control becomes the target of (D509)'],
  ['Geistblast', 'a spell with a line outside the vocabulary: Geistblast deals 2 damage to any target. (D509)'],
  ['Mirrorpool', 'a vocabulary effect the suite cannot assert: copySpell (D509)'],
  ['Naru Meha, Master Wizard', 'a vocabulary effect the suite cannot assert: copySpell (D509)'],
  ['Nivix Guildmage', 'a vocabulary effect the suite cannot assert: copySpell (D509)'],
  // D508 - the hand put: the rows the select offered and the row maker refused, by its own reasons.
  ['Burgeoning', 'trigger head not in the library: Whenever an opponent plays a land, you may put a land card from your h (D508)'],
  ['Nicanzil, Current Conductor', 'trigger head not in the library: Whenever a creature you control explores a land card, you may put a la (D508)'],
  // D506 - the witnesses the scopes lacked: the mass-verb rows still refused, by the row maker's and the generator's own reasons.
  ['Aragorn and Arwen, Wed', 'a counted payload under a head whose arm sizes the board (entersOrAttacks): You gain 1 life for each other creature you control. (D506)'],
  ['Iron Monger, Sadistic Tycoon', 'trigger head not in the library: Whenever a creature you control connives, put a +1/+1 counter on each (D506)'],
  ['Lo and Li, Royal Advisors', 'trigger head not in the library: Whenever an opponent discards a card or mills one or more cards, put a (D506)'],
  ['Sky Hussar', 'ability-word activated line: Forecast — Tap two untapped white and/or (D506)'],
  ['Camellia, the Seedmiser', 'a filtered head outside the closed reader (an adjective outside the list: one): Whenever you sacrifice one or more Foods, create a 1/1 green (D506)'],
  ['Kumena, Tyrant of Orazca', 'a tap cost of the scope subtype beside a tribal mass counter (the tappers and the yes fixture are one name) (D506)'],
  ['Hylda of the Icy Crown', 'trigger head not in the library: Whenever you tap an untapped creature an opponent controls, you may pa (D506)'],
  ['Urtet, Remnant of Memnarch', 'a timing condition on a late-entering row (D506)'],
  // D505 - the mass verbs over a scope: the rows the select offered and the row maker refused, by its own reasons.
  // D504 - the previous object's controller: the rows the select offered and the row maker refused, by its own reasons.
  ['Commander Sofia Daguerre', 'trigger payload not a pump: Destroy up to one target legendary permanent. That permanent (D504)'],
  ['Gallows at Willow Hill', 'a clause done by the previous object\'s controller on the opponent\'s side the suite cannot read (a token, a discard; not this wave): Its controller cre (D504)'],
  ['Cavalier of Dawn', 'a clause done by the previous object\'s controller on the opponent\'s side the suite cannot read (a token, a discard; not this wave): Its controller cre (D504)'],
  ['Ovinomancer', 'a clause done by the previous object\'s controller on the opponent\'s side the suite cannot read (a token, a discard; not this wave): That creature\'s co (D504)'],
  // D503 - the flavour words and the three mirrors: the rows the select offered and the row maker refused, by its own reasons.
  ['Additive Evolution', 'a counter on the token the clause before made (the object verb; not this wave): Create a 0/0 green and blue Fractal creature token. Put three +1/+1 co (D503)'],
  ['Canoptek Spyder', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever another nontoken artifact creature or Vehicle you c (D503)'],
  ['Canoptek Tomb Sentinel', 'trigger head not in the library: When this creature enters from a graveyard, exile up to one target non (D503)'],
  ['Cloakwood Swarmkeeper', 'trigger head not in the library: Whenever one or more tokens you control enter, put a +1/+1 counter on (D503)'],
  ['Deep Gnome Terramancer', 'trigger head not in the library: Whenever one or more lands enter under an opponent\'s control without b (D503)'],
  ['Dragon Egg', 'a leftover line not among the printed lines: When this creature dies, create a 2/2 red Dragon c (D503)'],
  ['Drownyard Lurker', 'a filtered head outside the closed reader (an adjective outside the list: or): When you cast or cycle ~, create a 0/1 colorless Eldrazi Spa (D503)'],
  ['Eldrazi Repurposer', 'a filtered head outside the closed reader (an adjective outside the list: this): When you cast this spell and when this creature dies, create (D503)'],
  ["G'raha Tia", 'a filtered head outside the closed reader (an adjective outside the list: creatures): Whenever one or more other creatures and/or artifacts you co (D503)'],
  ['Goliath Truck', 'a combat-role clause under a head whose declaration is not self attacking (the co-attacker rides an attack head alone): Put two +1/+1 counters on anot (D503)'],
  ['Graduation Day', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Hraesvelgr of the First Brood', 'trigger head not in the library: When Hraesvelgr enters and whenever you cast a noncreature spell, targ (D503)'],
  ['Inkling Mascot', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Inkshape Demonstrator', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Kor Castigator', 'a blocker predicate no fixture satisfies: Eldrazi Scions (D503)'],
  ['Lecturing Scornmage', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Melancholic Poet', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Necron Deathmark', 'trigger payload not a pump: Destroy up to one target creature and target player mills th (D503)'],
  ['Ominous Roost', 'a leftover line not among the printed lines: When this enchantment enters and whenever you cast (D503)'],
  ['Psychomancer', 'trigger head not in the library: Whenever this creature or another nontoken artifact you control is put (D503)'],
  ['Rehearsed Debater', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Station Monitor', 'a leftover line not among the printed lines: Whenever you cast your second spell each turn, cre (D503)'],
  ['Stirring Hopesinger', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['The Red Terror', 'trigger head not in the library: Whenever a red source you control deals damage to one or more permanen (D503)'],
  ['Triarch Praetorian', 'trigger head not in the library: When this creature enters from a graveyard, you draw two cards and you (D503)'],
  ['Tyranid Harridan', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another Tyranid you control deals (D503)'],
  ['Void Attendant', 'cost: Put a card an opponent owns from exile into that player\'s graveyard (D503)'],
  ['Warped Tusker', 'a filtered head outside the closed reader (an adjective outside the list: or): When you cast or cycle ~, create a 0/1 colorless Eldrazi Spa (D503)'],
  ['Astrid Peth', 'a sacrifice head no fixture the suite can sacrifice satisfies: a Clue or Food (D503)'],
  ['Commissar Severina Raine', 'trigger payload not a pump: Each opponent loses X life, where X is the number of other a (D503)'],
  ["Conciliator's Duelist", 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast an instant or sorcery spell that targets a (D503)'],
  ['Death Tyrant', 'a filtered head outside the closed reader (an adjective outside the list: attacking): Whenever an attacking creature you control or a blocking cre (D503)'],
  ['Drowner of Hope', 'cost: a sacrifice cost with no fixture the suite can put: Eldrazi Scion (D503)'],
  ['Experimental Confectioner', 'a sacrifice head no fixture the suite can sacrifice satisfies: a Food (D503)'],
  ['Marneus Calgar', 'trigger head not in the library: Whenever one or more tokens you control enter, draw a card. (D503)'],
  ['Prosper, Tome-Bound', 'trigger head not in the library: Whenever you play a card from exile, create a Treasure token. (D503)'],
  ['Rakish Crew', 'a filtered head outside the closed reader (a noun outside the list: outlaw): Whenever an outlaw you control dies, each opponent loses 1 l (D503)'],
  ['Shadow of the Goblin', 'trigger head not in the library: Whenever you play a land or cast a spell from anywhere other than your (D503)'],
  ['Shield Mare', 'trigger head not in the library: When this creature enters or becomes the target of a spell or ability (D503)'],
  ['Vindictive Mob', 'a blocker predicate no fixture satisfies: Saprolings (D503)'],
  ['Writhing Chrysalis', 'a sacrifice head no fixture the suite can sacrifice satisfies: another Eldrazi (D503)'],
  ['Surge Mare', 'a self damage head on a creature with no printed power: dealsDamageOpponent (D503)'],
  // D502 - the extra turn: the rows the select offered and the row maker refused, by its own reasons.
  ['Time Sieve', 'cost: Sacrifice five artifacts (D502)'],
  ['Temporal Extortion', 'a spell with a line outside the vocabulary: When you cast this spell, any player may pay half their life (D502)'],
  ['Temporal Mastery', 'a spell with a line outside the vocabulary: Take an extra turn after this one. Exile Temporal Mastery. (D502)'],
  // D501 - the spell's own fate: the rows the select offered and the row maker refused, by its own reasons.
  ['Morgul-Knife Wound', 'a payment branch the suite cannot assert: exileSelf (D501)'],
  ['The Balrog, Flame of Udûn', 'a filtered head outside the closed reader (an adjective outside the list: legendary): When a legendary creature an opponent controls dies, put ~ o (D501)'],
  // D500 - the object verbs: the rows the select offered and the row maker refused, by its own reasons.
  ['Essence of Antiquity', 'an object verb after a clause whose objects the suite does not enumerate (a scoped clause; not this wave): Untap them. (D500)'],
  ['Jeskai Ascendancy', 'an object verb after a clause whose objects the suite does not enumerate (a scoped clause; not this wave): Untap those creatures. (D500)'],
  ['Popular Egotist', 'a sacrifice head beside a cost that sacrifices, with a payload the assert cannot carry: vocab (D500)'],
  ['Dream Trawler', 'a late-entering row (a draw or step head) beside a head the suite fires by attacking on turn 3: summoning sick that turn (not this wave) (D500)'],
  // D499 - the blocks-by predicates: the rows the select offered and the row maker refused, by its own reasons.
  ['Cockatrice', 'a becomes-blocked head on a flier (the suite has no flying blocker) (D499)'],
  // D498 - the classifier catches up: the rows the select offered (the mirrors) and the row maker refused, by its own reasons.
  ['Ayula, Queen Among Bears', 'a mode whose fixture the suite already puts on p1 (the generator skipped the row: every fixture for Target Bear you control is a name the suite already puts) (D498)'],
  ['Black Market Connections', 'a mode payload: Create a Treasure token. You lose 1 life. (D498)'],
  ["Sorcerer's Broom", 'a payment under a sacrifice head whose fire funds the price (the lands the suite reads are not the ones spent) (D485) (D498)'],
  ['Chittering Host', 'multi-face or unusual layout (D498)'],
  ['Freestrider Lookout', 'trigger head not in the library: Whenever you commit a crime, look at the top five cards of your librar (D498)'],
  ['Phyrexian Slayer', 'a becomes-blocked head on a flier (the suite has no flying blocker) (D498)'],
  ['Ishkanah, Grafwidow', 'a counted noun with no witness the suite can put: Target opponent loses 1 life for each Spider you control. (D498)'],
  ['Damage Control Crew', 'a mode payload: Return target card with mana value 4 or greater from your gr (D498)'],
  ['Flash Thompson, Spider-Fan', 'a modal line that chooses more than one mode (1..2) (D498)'],
  ['Gorbag of Minas Morgul', 'trigger payload not a pump: Sacrifice it. When you do, choose one — (D498)'],
  ['Immard, the Stormcleaver', 'trigger payload not a pump: Put a charge counter on it or remove one from it. When you r (D498)'],
  ['Oltec Archaeologists', 'a mode whose payload asks (scry) - the continuation seam (D498)'],
  ['Etherwrought Page', 'a mode whose payload asks (scry) - the continuation seam (D498)'],
  ["Fangkeeper's Familiar", 'a mode payload: You gain 3 life and surveil 3. (D498)'],
  ['Momo, Playful Pet', 'a mode whose payload asks (scry) - the continuation seam (D498)'],
  ['Rankle, Master of Pranks', 'a modal line that chooses more than one mode (0..3) (D498)'],
  ['Silverback Elder', 'a mode whose look needs a staged keep (the modal fire stages nothing) (D498)'],
  // D497 - the end-of-combat step: the rows the select offered and the row maker refused, by its own reasons.
  ['Sawtooth Ogre', 'a delayed damage on the item (the combat damage muddies the read): ~ deals 1 damage to target creature at end of combat. (D497)'],
  ['Silent Assassin', 'a delayed targeted payload beside a clause with no fixture: vocab clause without a fixture: a combat-role clause (D497)'],
  ['Vebulid', 'a delayed self clause under a block head the combat kills the card in (toughness 0) (D497)'],
  // D496 - the item referent: the rows the select offered and the row maker refused, by its own reasons.
  ['Angelic Exaltation', 'a counted payload under a head whose arm sizes the board (aCreatureAttacksAlone): Target creature gets +X/+X until end of turn, where X is the number (D496)'],
  ['Electropotence', 'an item referent beside another target clause: You may pay {2}{R}. If you do, target creature deals damage (D496)'],
  ['Thoughtweft Imbuer', 'a counted payload under a head whose arm sizes the board (aCreatureAttacksAlone): Target creature gets +X/+X until end of turn, where X is the number (D496)'],
  ['Warstorm Surge', 'an item referent beside another target clause: Target creature deals damage equal to its power to any targe (D496)'],
  ["Derelict Attic // Widow's Walk", 'multi-face or unusual layout (D496)'],
  // D495 - the object rows: the rows the select offered (D494 ledgered them for the generator) and the row maker still refused, by its own reasons.
  ['Felhide Spiritbinder', 'trigger payload not a pump: You may pay {1}{R}. If you do, create a token that\'s a copy (D495)'],
  ['Harried Dronesmith', 'a delayed object clause under a head the suite fires past turn 3 (not this wave): combatOnYourTurn (D495)'],
  ['Mistmeadow Vanisher', 'an object clause beside a clause with no fixture: vocab clause without a fixture: no fixture for up to one target nonland, nontoken permanent (D495)'],
  ['Wiccan, Rising Magician', 'an object clause beside a clause with no fixture: vocab clause without a fixture: no fixture for another target nonland, nontoken permanent (D495)'],
  ['Angel of Condemnation', 'cost: Exert this creature (D495)'],
  ['Dawn of the Dead', 'a delayed object clause under a head the suite fires past turn 3 (not this wave): upkeep (D495)'],
  ['Nemesis Trap', 'a spell with a line outside the vocabulary: Exile target attacking creature. Create a token that\'s a cop (D495)'],
  ['Zektar Shrine Expedition', 'trigger payload not a pump: Put a quest counter on this enchantment. (D495)'],
  // D493 - the look grammar: the rows the select offered and the row maker refused, by its own reasons.
  ['Fecund Greenshell', 'a filtered head outside the closed reader (a qualifier outside the keyword list: toughness greater than its power): Whenever this creature or another (D493)'],
  ['Wandering Mind', 'a look with a negated noun the suite has no fixture for: Look at the top six cards of your library. You may reveal a (D493)'],
  ["Explorer's Scope", 'an attack head on a card with no creature body: equippedCreatureAttacks (D493)'],
  ["Nymris, Oona's Trickster", 'a filtered head outside the closed reader (an adjective outside the list: your): Whenever you cast your first spell during each opponent\'s tu (D493)'],
  ["Raiders' Karve", 'an attack head on a card with no creature body: vehicleAttacks (D493)'],
  ['Adéwalé, Breaker of Chains', 'a combat-damage head no attack-capable fixture satisfies: a Vehicle you control (D493)'],
  // D492 - the once-per-turn trigger: the rider cards the row maker refused, by its own reasons.
  ['Exemplar of Light', 'trigger head not in the library: Whenever you put one or more +1/+1 counters on this creature, draw a c (D492)'],
  ['Chance-Met Elves', 'trigger head not in the library: Whenever you scry, put a +1/+1 counter on this creature. This ability (D492)'],
  ['Cloaked Cadet', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on one or more Humans you (D492)'],
  ['Deepmuck Desperado', 'trigger head not in the library: Whenever you commit a crime, each opponent mills three cards. This abi (D492)'],
  ['Dusk Legion Duelist', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on this creature, draw a c (D492)'],
  ["Fang, Fearless l'Cie", 'multi-face or unusual layout (D492)'],
  ['Forge Boss', 'a filtered head outside the closed reader (an adjective outside the list: one): Whenever you sacrifice one or more other creatures, this cre (D492)'],
  ['Generous Pup', 'trigger head not in the library: Whenever one or more +1/+1 counters are put on this creature, put a +1 (D492)'],
  ['Hardbristle Bandit', 'trigger head not in the library: Whenever you commit a crime, untap this creature. This ability trigger (D492)'],
  ['Harnesser of Storms', 'a filtered head outside the closed reader (an adjective outside the list: or): Whenever you cast a noncreature or Otter spell, you may exil (D492)'],
  ['Kingpin, Wilson Fisk', 'a filtered head outside the closed reader (an adjective outside the list: ~): Whenever you sacrifice ~ or another creature, create two Tre (D492)'],
  ['Kishla Skimmer', 'trigger head not in the library: Whenever a card leaves your graveyard, draw a card. This ability trigg (D492)'],
  ['Knight of Wundagore', 'trigger head not in the library: Whenever you put a +1/+1 counter on another creature, put a +1/+1 coun (D492)'],
  ['Loki, God of Mischief', 'trigger head not in the library: Whenever a player or permanent becomes the target of an ability you co (D492)'],
  ['Marauding Sphinx', 'trigger head not in the library: Whenever you commit a crime, surveil 2. This ability triggers only onc (D492)'],
  ['Mikey & Leo, Chaos & Order', 'trigger head not in the library: Whenever you put a counter on a creature you control, draw a card. Thi (D492)'],
  ['Nimrodel Watcher', 'trigger head not in the library: Whenever you scry, this creature gets +1/+0 until end of turn and can\' (D492)'],
  ['Raven of Fell Omens', 'trigger head not in the library: Whenever you commit a crime, each opponent loses 1 life and you gain 1 (D492)'],
  ['Stick, Fearless Mentor', 'trigger head not in the library: Whenever a source you control deals damage to you, exile the top card (D492)'],
  ["Stonebinder's Familiar", 'trigger head not in the library: Whenever one or more cards are put into exile, put a +1/+1 counter on (D492)'],
  ['True Identity', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this enchantment or another permanent you control i (D492)'],
  ['Anje, Maid of Dishonor', 'trigger head not in the library: Whenever ~ and/or one or more other Vampires you control enter, create (D492)'],
  ["Bandit's Haul", 'trigger head not in the library: Whenever you commit a crime, put a loot counter on this artifact. This (D492)'],
  ['Baron Bertram Graywater', 'a filtered head no fixture satisfies: a token you control (D492)'],
  ['Blood Hustler', 'trigger head not in the library: Whenever you commit a crime, put a +1/+1 counter on this creature. Thi (D492)'],
  ['Blood Hypnotist', 'a filtered head outside the closed reader (an adjective outside the list: one): Whenever you sacrifice one or more Blood tokens, target crea (D492)'],
  ['Crawling Infestation', 'trigger head not in the library: Whenever one or more creature cards are put into your graveyard from a (D492)'],
  ['Defiled Crypt // Cadaver Lab', 'multi-face or unusual layout (D492)'],
  ['Hostile Investigator', 'trigger head not in the library: Whenever one or more players discard one or more cards, investigate. T (D492)'],
  ['Ms. Marvel, Elastic Ally', 'a filtered head outside the closed reader (a qualifier outside the keyword list: power greater than its base power): Whenever a creature you control w (D492)'],
  ['Oni-Cult Anvil', 'a filtered head outside the closed reader (an adjective outside the list: one): Whenever one or more artifacts you control leave the battlef (D492)'],
  ['Sharae of Numbing Depths', 'a filtered head no fixture satisfies: Sharae (D492)'],
  ['Goblin Piledriver', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +2/+0 until end of turn for each other attacking Goblin.)'],
  ['Grotag Bug-Catcher', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+0 until end of turn for each creature in your party.)'],
  ['Hand That Feeds', 'trigger head not in the library (Whenever this creature attacks while there are four or more card types)'],
  ['Hearthborn Battler', 'a filtered head outside the closed reader (an adjective outside the list (their: Whenever a player casts their second spell each turn, this c)'],
  ['HYDRA Assault Robot', 'a filtered head outside the closed reader (an adjective outside the list (and/or: Whenever another Villain and/or artifact you control enters,)'],
  ['Illuminator Virtuoso', 'trigger head not in the library (Whenever this creature becomes the target of a spell you control, it c)'],
  ['Iron-Fist Pulverizer', 'trigger payload not a pump (~ deals 2 damage to target opponent. Scry 1.)'],
  ['Kavu Mauler', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+1 until end of turn for each other attacking Kavu.)'],
  ['Keral Keep Disciples', 'trigger head not in the library (Whenever you activate a loyalty ability of a Chandra planeswalker, thi)'],
  ['Knotvine Paladin', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+1 until end of turn for each untapped creature you control.)'],
  ['Knowledge and Power', 'trigger head not in the library (Whenever you scry, you may pay {2}. If you do, this enchantment deals)'],
  ['Lavakin Brawler', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+0 until end of turn for each Elemental you control.)'],
  ['Leyline Phantom', "trigger head not in the library (When this creature deals combat damage, return it to its owner's hand.)"],
  ['Mayhem Devil', 'trigger head not in the library (Whenever a player sacrifices a permanent, this creature deals 1 damage)'],
  ['Mischievous Chimera', "a filtered head outside the closed reader (an adjective outside the list (your: Whenever you cast your first spell during each opponent's tu)"],
  ['Mysterious Egg', 'trigger head not in the library (Whenever this creature mutates, put a +1/+1 counter on it.)'],
  ['Rampaging Classmate', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +1/+0 until end of turn for each other attacking creature.)'],
  ['Renegade Freighter', 'an attack head on a card with no creature body (vehicleAttacks)'],
  ['Saprazzan Raider', "trigger head not in the library (When this creature becomes blocked, return it to its owner's hand.)"],
  ["Sarkhan's Whelp", 'trigger head not in the library (Whenever you activate an ability of a Sarkhan planeswalker, this creat)'],
  ['Shaleskin Bruiser', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +3/+0 until end of turn for each other attacking Beast.)'],
  ['Siegehorn Ceratops', 'a self payload on a creature the test damage kills (toughness 2)'],
  ['Spider-Mobile', 'trigger head not in the library (Whenever this Vehicle attacks or blocks, it gets +1/+1 until end of tu)'],
  ['Task Force', 'a heroic self pump beside the Giant Growth the test casts'],
  ['Teapot Slinger', 'trigger head not in the library (Whenever you expend 4, this creature deals 2 damage to each opponent.)'],
  ['Thrashing Frontliner', 'trigger head not in the library (Whenever this creature attacks a battle, it gets +1/+1 until end of tu)'],
  ['Thundering Sparkmage', 'a counted noun the suite cannot stage (party) (~ deals X damage to target creature or planeswalker, where X is the number of creatures...)'],
  ['Vile Deacon', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +X/+X until end of turn, where X is the number of Clerics on the battlefield.)'],
  ['Alpine Houndmaster', 'trigger payload not a pump (Search your library for a card named Alpine Watchdog and/or)'],
  ['Aurochs Herd', 'trigger payload not a pump (Search your library for an Aurochs card, reveal it, put it i)'],
  ['Bloodcrazed Hoplite', 'trigger head not in the library (Whenever a +1/+1 counter is put on this creature, remove a +1/+1 count)'],
  ['Dreadhorde Butcher', 'trigger head not in the library (Whenever this creature deals combat damage to a player or planeswalker)'],
  ['Fallen Ideal', 'a leftover line not among the printed lines (Enchanted creature has flying and)'],
  ['Fireblade Charger', 'damage from a source that has died (last known information) (the executor deals 0 from the graveyard)'],
  ['Goblin Fireleaper', 'damage from a source that has died (last known information) (the executor deals 0 from the graveyard)'],
  ['Infernal Phantom', 'trigger head not in the library (Whenever an enchantment you control enters and whenever you fully unlo)'],
  ['Last Laugh', 'a filtered head outside the closed reader (an adjective outside the list (permanent: Whenever a permanent other than this enchantment is put into)'],
  ['Magmatic Galleon', 'trigger head not in the library (Whenever one or more creatures your opponents control are dealt excess)'],
  ['Nettle Guard', 'trigger head not in the library (Whenever this creature becomes the target of a spell or ability you co)'],
  ['Recon Craft Theta', 'trigger payload not a pump (Create a 0/0 blue Alien creature token. Put a +1/+1 counter)'],
  ['Scourge of Valkas', 'a filtered head outside the closed reader (an adjective outside the list (this: Whenever this creature or another Dragon you control enters,)'],
  ['Trial of Zeal', 'a filtered head no fixture satisfies (a Cartouche you control)'],
  // D420 - the ability word reads: the 27 the selector offered once the classifier read past a true ability word
  // (Landfall, Magecraft, Constellation, Heroic, Inspired, Eerie, Valiant, Battalion, Domain, Undergrowth) that the row
  // maker refused, by reason (the Eerie and Valiant heads outside the library among them).
  ['Aerie Worshippers', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['Akroan Line Breaker', 'a heroic self pump beside the Giant Growth the test casts'],
  ['Briar Hydra', 'a counted payload under a combat-damage head (the arm sizes the board) beside its Landfall line'],
  ['Cult Healer', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Dashing Bloodsucker', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Entity Tracker', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Erratic Apparition', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Forlorn Pseudamma', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['General Thunderbolt Ross', 'a scope read off the live combat (attacking creatures get +1/+0 - the suite must attack) under its Battalion head'],
  ['God-Favored General', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['Gremlin Tamer', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Kazandu Mammoth // Kazandu Valley', 'a modal double-faced layout beside its Landfall line'],
  ['Kraul Foragers', 'a board-sized life gain the suite cannot pin (for each creature card in your graveyard) under its Undergrowth head'],
  ['Optimistic Scavenger', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Pheres-Band Raiders', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['Poised Practitioner', 'a trigger payload outside both readers (a counter on this creature, then scry 1) under its Flurry head'],
  ['Radha, Coalition Warlord', 'a counted payload under a becomes-tapped head (the arm sizes the board) under its Domain head'],
  ['Skullsnap Nuisance', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Strength from the Fallen', 'a counted payload under a constellation head (the arm sizes the board)'],
  ["Archon of Sun's Grace", 'a line that is neither an activated ability nor a library trigger (Pegasus creatures you control have lifelink) beside its Constellation line'],
  ['Molderhulk', 'a line that is neither an activated ability nor a library trigger (Undergrowth - a cost reduction per creature card in your graveyard)'],
  ['Omnath, Locus of Rage', 'a token outside TOKEN_TABLE (a 5/5 red and green Elemental) under its Landfall head'],
  ['Tireless Tracker', 'a sacrifice head no fixture the suite can sacrifice satisfies (a Clue) beside its Landfall line'],
  // D419 - the board condition reads: the 9 the selector offered once `if you control <noun>` read under the enters and
  // refire heads that the row maker refused, by reason (a `no <noun>` condition the armed board meets from the start,
  // and the Descend ability word).
  ['Coati Scavenger', 'an ability-word line the row maker does not split (Descend 4) beside its board-condition line'],
  ['Malamet Veteran', 'an ability-word line the row maker does not split (Descend 4) beside its board-condition line'],
  ['Glimmervoid', 'a board condition the armed board already meets (you control no artifacts: the fire cannot break it, not this wave)'],
  ['Keldon Berserker', 'a board condition the armed board already meets (you control no untapped lands: not this wave)'],
  ["Martyr's Soul", 'a board condition the armed board already meets (you control no tapped lands: not this wave)'],
  ['Stenchskipper', 'a board condition the armed board already meets (you control no Goblins: not this wave)'],
  ['Thran Quarry', 'a board condition the armed board already meets (you control no creatures: not this wave)'],
  ['Well of Discovery', 'a board condition the armed board already meets (you control no untapped lands: not this wave)'],
  ['Well of Life', 'a board condition the armed board already meets (you control no untapped lands: not this wave)'],
  // D418 - the count expression reads: the 44 the selector offered once `for each <noun>` / `where X is the number of` read
  // that the row maker refused, by reason (the counted suite stages a witness for a plain permanent or graveyard noun
  // only: the refinements, the party, the hand, the kicks, the deaths, the domain and the attack heads wait).
  ['Lightkeeper of Emeria', 'a counted suite that kicks (for each time it was kicked) beside its counted line'],
  ['Alert Heedbonder', 'a counted noun with a keyword refinement (creature you control with vigilance) the suite cannot stage'],
  ['Ancestor Dragon', 'a trigger head outside the library (whenever one or more creatures you control attack) beside its counted line'],
  ['Archway Angel', 'a counted noun with no witness fixture (Gate) beside its counted line'],
  ['Armorcraft Judge', 'a counted noun with a counter refinement (creature you control with a +1/+1 counter on it) the suite cannot stage'],
  ['Atlas, Sizable Stooge', 'a counted payload under an attacks-or-blocks head (the arm sizes the board) beside its counted line'],
  ['Aven Gagglemaster', 'a counted noun with a keyword refinement (creature you control with flying) the suite cannot stage'],
  ['Cleric of the Forward Order', 'a counted noun with a name refinement (creature you control named ~) the suite cannot stage'],
  ["Drana's Silencer", 'a counted party noun (creatures in your party) the suite cannot stage'],
  ['Escaped Experiment', 'a counted payload under an attacks head (the arm sizes the board) beside its counted line'],
  ['Glimmerpost', 'a counted noun with no witness fixture (Locus) beside its counted line'],
  ['Honden of Cleansing Fire', 'a counted noun with no witness fixture (Shrine) beside its counted line'],
  ["Honden of Life's Web", 'a counted noun with no witness fixture (Shrine) beside its counted line'],
  ['Honden of Seeing Winds', 'a counted noun with no witness fixture (Shrine) beside its counted line'],
  ['Intelligence Bobblehead', 'a counted noun with no witness fixture (Bobblehead) beside its counted line'],
  ['Kabira Outrider', 'a counted party noun (creatures in your party) the suite cannot stage'],
  ['Khabál Ghoul', 'a counted deaths noun (creature that died this turn) the suite cannot stage'],
  ['Kitsune Loreweaver', 'a counted hand noun (cards in your hand) the suite cannot stage'],
  ['Lys Alana Scarblade', 'an activated cost outside the reader (Discard an Elf card) beside its counted line'],
  ['Mahadi, Emporium Master', 'a counted deaths noun (creature that died this turn) the suite cannot stage'],
  ['Marshal of the Lost', 'a counted payload under a you-attack head (the arm sizes the board) beside its counted line'],
  ['Oboro Envoy', 'a counted hand noun beside a discard cost (the hand the count reads is the hand the cost emptied)'],
  ["Orim's Prayer", 'a trigger head outside the library (whenever one or more creatures attack you) beside its counted line'],
  ['Power Armor', 'a counted basic-land-types noun (Domain) the suite cannot stage'],
  ['Pygmy Kavu', 'a counted noun with a colour and an opponents controller (black creature your opponents control) the suite cannot stage'],
  ['Regal Force', 'a counted noun with a colour (green creature you control) the suite cannot stage'],
  ['Riptide Director', 'a counted noun with no witness fixture (Wizard) beside its counted line'],
  ['Sanctum of Shattered Heights', 'an activated cost outside the reader (Discard a land card or Shrine card) beside its counted line'],
  ['Shepherd of Heroes', 'a counted party noun (creatures in your party) the suite cannot stage'],
  ['Slate of Ancestry', 'an activated cost outside the reader (Discard your hand) beside its counted line'],
  ['Sokenzan Spellblade', 'a counted hand noun (cards in your hand) the suite cannot stage'],
  ['Sophic Centaur', 'a counted hand noun beside a discard cost (the hand the count reads is the hand the cost emptied)'],
  ['Undead Servant', 'a counted graveyard name (card named ~ in your graveyard) the suite does not stage'],
  ['Viridian Lorebearers', 'a counted noun with an opponents controller (artifacts your opponents control) the suite cannot stage'],
  ['Wandering Goblins', 'a counted basic-land-types noun (Domain) the suite cannot stage'],
  ['Wolfbriar Elemental', 'a counted suite that kicks (for each time it was kicked) beside its counted line'],
  ['Brawn, Amadeus Cho', 'a line that is neither an activated ability nor a library trigger (Power-up, an ability word) beside its counted line'],
  ['Demonic Lore', 'a counted hand noun (cards in your hand) the suite cannot stage'],
  ['Dwynen, Gilt-Leaf Daen', 'a counted payload under an attacks head (attacking Elf you control) beside its anthem'],
  ['Horn of Gondor', 'a counted payload beside another ability that puts a permanent (the enters token joins the count)'],
  ['Marrow-Gnawer', 'a line that is neither an activated ability nor a library trigger (All Rats have fear) beside its counted line'],
  ['The Spirit Oasis', 'a counted noun with no witness fixture (Shrine) beside its Shrine-enters trigger'],
  ['Wingmate Roc', 'a counted payload under an attacks head (attacking creature) beside its raid trigger'],
  // D417 - the play permission reads: the 16 the selector offered once `exile the top card ... you may play it` read
  // that the row maker refused, by reason (seven trigger heads outside the library among them).
  ['Armory Paladin', 'a filtered head outside the closed reader (whenever you cast an Aura or Equipment spell) beside its permission line'],
  ['Molly Hayes, Runaway', 'a line that is neither an activated ability nor a library trigger (Power-up, an ability word) beside its permission line'],
  ['Ob Nixilis, Captive Kingpin', 'a trigger head outside the library (whenever one or more opponents each lose exactly 1 life) beside its permission line'],
  ['Tempered in Solitude', 'an attack head on a card with no creature body (whenever a creature you control attacks alone) beside its permission line'],
  ['Araña, Heart of the Spider', 'a vocabulary clause the suite has no fixture for (a combat-role clause) beside its permission line'],
  ['Faldorn, Dread Wolf Herald', 'a filtered head outside the closed reader (whenever you cast a spell from exile or a land you control enters from exile) beside its permission line'],
  ['Kami of Celebration', 'a trigger head outside the library (whenever a modified creature you control attacks) beside its permission line'],
  ['Laelia, the Blade Reforged', 'a trigger head outside the library (whenever one or more cards are put into exile from your library) beside its permission line'],
  ['Spinneret and Spiderling', 'a trigger head outside the library (whenever you attack with two or more Spiders) beside its permission line'],
  ['Syr Carah, the Bold', 'a trigger head outside the library (whenever ~ or an instant or sorcery spell you control deals damage to a player) beside its permission line'],
  // D416 - the hand reveal and choose reads: the 4 the selector offered once the reveal-and-choose sentences read
  // that the row maker refused, by reason (all four print a sentence after the ask).
  // D415 - the verb price at resolution reads: the 18 the selector offered once `you may <verb>. If you do` and
  // `unless you <verb>` read that the row maker refused, by reason (seven payment branches the suite cannot assert among them).
  ['Akki Ronin', 'a trigger head outside the library (whenever a Samurai or Warrior you control attacks alone) beside its verb-price line'],
  ['Bloodmist Infiltrator', 'a payment branch the suite cannot assert (cantBeBlocked) beside its verb-price line'],
  ['Giott, King of the Dwarves', 'a filtered head outside the closed reader (whenever ~ or another Dwarf you control enters) beside its verb-price line'],
  ['Gravelgill Scoundrel', 'a payment branch the suite cannot assert (cantBeBlocked) beside its verb-price line'],
  ['Master Skald', 'a payment branch the suite cannot assert (returnFromGraveyard) beside its verb-price line'],
  ['Wasp of the Bitter End', 'a filtered head no fixture satisfies (a Bolas planeswalker spell) beside its verb-price line'],
  ['Withercrown', 'a leftover line not among the printed lines (an Aura static the probe split) beside its verb-price line'],
  ['Biblioplex Kraken', 'a payment branch the suite cannot assert (cantBeBlocked) beside its verb-price line'],
  ['Hecatomb', 'an enters price the harness declines while the activated line is armed (sacrifice it unless you sacrifice four creatures)'],
  ['High-Society Hunter', 'the dies fodder lands in the opening seven beside the price fixture (the D398 hazard)'],
  ['Invasion of Mercadia // Kyren Flamewright', 'multi-face or unusual layout (a battle)'],
  ['Provisions Merchant', 'a payment branch the suite cannot assert (massPump) beside its verb-price line'],
  ['Restless Vents', 'a trigger head outside the library (whenever this land attacks - the animated land) beside its verb-price line'],
  ['Sacred Mesa', 'a verb price the suite has no fixture for (sacrifice a Pegasus)'],
  ['Veronica, Dissident Scribe', 'a trigger head outside the library (whenever you discard one or more nonland cards for the first time each turn) beside its verb-price line'],
  ['Yuma, Proud Protector', 'a put-into-graveyard head from anywhere with a filter no zone can answer (a Desert card) beside its verb-price line'],
  // D414 - the another qualifier is enforced: the 23 the selector offered once `another target` read that the row
  // maker refused, by reason (seven combat-role clauses the suite cannot stage among them).
  ["Bessie, the Doctor's Roadster", 'a clause the suite has no fixture for (another target legendary creature) beside its attack head'],
  ['Flensing Raptor', 'a clause the suite has no fixture for (another target creature you control with toxic) beside its enters head'],
  ['Rime Tender', 'a clause the suite has no fixture for (another target snow permanent) beside its activation'],
  ['Carrion Thrash', 'a payment branch the suite cannot assert (returnFromGraveyard) beside its another-target line'],
  ['Dour Port-Mage', 'a filtered head outside the closed reader (whenever one or more creatures you control leave without dying) beside its untap line'],
  ['Matterbending Mage', 'a filtered head outside the closed reader (whenever you cast a spell) beside its another-target line'],
  ['Nobody', "a trigger payload outside the row kinds (return up to one other target artifact you control to its owner's hand - an up-to-one bounce)"],
  ['Defiant Greatmaw', 'a trigger head outside the library (whenever you put one or more -1/-1 counters on this creature) beside its another-target line'],
  ['Restless Ridgeline', 'a trigger head outside the library (whenever this land attacks - the animated land) beside its another-target line'],
  ['Forensic Researcher', 'a cost the engine does not charge (collect evidence 3) beside its another-target line'],
  ['North Pole Patrol', 'a keyword-worded activation (Waterbend {3}, {T}: tap target creature) beside its another-target line'],
  // D412 - connive is the engine's own (CR 701.50): the one the selector offered once the connive sentences read
  // that the row maker refused, by reason.
  ['Ledger Shredder', 'a filtered head outside the closed reader (whenever a player casts their second spell each turn - an any-player second-spell head) beside its connive'],
  // D411 - the untap skip is the engine's own: the two the selector offered once the freeze sentences read
  // that the row maker refused, by reason.
  ['Ojutai, Soul of Winter', 'a trigger head outside the library (whenever a Dragon you control attacks) beside its untap skip'],
  // D410 - typecycling is the engine's own (CR 702.29b): the seven the selector offered once the typed
  // cycling lines read whose OTHER line the row maker refused, by reason.
  ['Giant Koi', 'a keyword-worded activation (Waterbend {3}: ~ cannot be blocked this turn) beside its typecycling'],
  ['Fall to Earth', 'a spell line outside the vocabulary (exile target creature; each player gains 3 life - a per-player gain) beside its typecycling'],
  ['Step Through', 'a spell line outside the vocabulary (return two target creatures to their owners hands - a counted bounce) beside its typecycling'],
  ['Sylvan Reclamation', 'a spell line outside the vocabulary (exile up to two target artifacts and/or enchantments - the and/or noun) beside its typecycling'],
  ['Treacherous Terrain', 'a spell line outside the vocabulary (damage to each opponent equal to the number of lands that player controls - a computed amount) beside its typecycling'],
  ['World-Weary', 'an attached static whose toughness pump kills the 2/2 Bears (the suite has no fixture for it) beside its typecycling'],
  // D409 - explore is the engine's own (CR 701.42); what this row waits on is the HEAD.
  ['Lurking Chupacabra', 'an explores head (whenever a creature you control explores) outside the head library - the engine explores since D409, the row maker has no head for it'],
  ['Linden, the Steadfast Queen', 'per-tap-entry trigger granularity'],
  // Batch 27 (D186), five refusals and TWO new classes. Matoya names the
  // SCRY/SURVEIL EVENT DISCRIMINATOR: no event marks a scry — the peek is a
  // Tier-3 reveal and scry/surveil are UI MODES on it (D114), so "whenever
  // you scry or surveil" has nothing to watch. Merrow Grimeblotter names the
  // {Q} UNTAP-SYMBOL ACTIVATION COST: the source must be tapped and untaps
  // as the price, which no parse reads and no charge path pays. Meloku is
  // the return-permanent cost's third entry (D175's class).
  ['Matoya, Archon Elder', 'scry-surveil event discriminator'],
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
  ['Day of Black Sun', 'temporary keyword/ability grant'],
  ['Stinging Study', 'script-raised prompt'],
  // ⚠️ Bedevil DRAINED in D199: the noun-list widening added its Oxford
  // compound to both parsers (Icy Manipulator's own idiom), so its whole
  // text is one admitted destroy — a vocabulary card, no script anywhere.
  // Aftershock and Atraxa's Fall stay: their lists were never the (only)
  // blocker.
  // Batch M6.4ak (D196) — eight refusals, THREE new classes. About Face
  // needs an until-end-of-turn power/toughness SWITCH, which the carrier
  // does not hold (it carries deltas and keywords — a switch is neither);
  // Abnormal Endurance GRANTS A QUOTED TRIGGERED ABILITY for the turn,
  // which is the temporary-grant class beyond keywords entirely; The Grey
  // Havens' second mana ability is CONDITIONAL PRODUCTION (any color among
  // legendary creatures in graveyards) — a mana ability cannot be an
  // ActivatedDef (CR 605: it does not use the stack), so the parse gap is
  // the card's real blocker. The rest are standing classes.
  ['About Face', 'until-end-of-turn power/toughness switch'],
  ['The Last Agni Kai', 'rule-changing (mana persistence)'],
  ["Animist's Awakening", 'ctx.random'],
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
  ["Aminatou's Augury", 'play-from-exile permission'],
  ['Amass the Components', 'script-raised prompt'],
  ['Aether Burst', 'cast-time computed target count'],
  ['Allied Assault', 'up-to-N targeting'],
  // D198
  ['Animate Land', 'UEOT type change with P/T set'],
  ['Approach of the Second Sun', 'game-history memory'],
  ["Atraxa's Fall", 'list qualifier binds one alternative'],
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
  ['Blatant Thievery', 'cast-time computed target count'],
  ['Blazing Hope', 'computed target threshold'],
  ['Blot Out', 'opponent-chooses'],
  // D201 — Bontu's wrath rider needs a skip-untap carrier the state does
  // not hold; Boon of Erebos REGENERATES (the engine has no regeneration —
  // the Damnation tripwire's subject, now a named refusal class); Bounce
  // Off's 'creature or Vehicle' is a subtype compound the spec cannot
  // enforce (Vehicle is not a card type); Brainsurge picks hand cards back
  // onto the library top (Brainstorm's prompt); Breaking Point offers every
  // player a choice.
  ["Bontu's Last Reckoning", 'untap restriction'],
  ['Bounty of Skemfar', 'script-raised prompt'],
  ['Brainsurge', 'script-raised prompt'],
  ['Brawl', 'temporary keyword/ability grant'],
  ['Breaking Point', 'script-raised prompt'],
  ['Brilliant Ultimatum', 'opponent-chooses'],
  ['Broken Dam', 'spell target parse (counted list)'],
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
  ['Chaoslace', 'UEOT color change'],
  ['Chaotic Transformation', 'up-to-N targeting'],
  ['Chronostutter', 'library position placement'],
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
  ['Conduct Electricity', 'up-to-N targeting'],
  ['Contaminated Drink', 'rad counters'],
  ['Contest of Claws', 'discover mechanic'],
  // D205 — Cosmic Hunger probed: 'another target creature, planeswalker,
  // or battle' is the second-clause shape (the family's SEVENTH card);
  // Cut Down probed: the SUM qualifier ('total power and toughness 5 or
  // less') parses confident with the bound silently DROPPED — landing it
  // would destroy a 10/10; Crash Landing needs the keyword LOSS direction
  // the carrier does not hold; Cracked Earth Technique animates a land
  // with counters and a delayed return.
  ['Counterintelligence', 'spell target parse (counted list)'],
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
  ['Dawnglow Infusion', 'mana-spent memory'],
  ["Day's Undoing", 'end the turn'],
  ['Dead Reckoning', 'script-raised prompt'],
  ['Death or Glory', 'opponent-chooses'],
  ['Deathlace', 'color change (indefinite)'],
  // D207 — Deny the Witch counters ACTIVATED AND TRIGGERED ABILITIES on
  // the stack, a target kind and an un-cast the engine has no seam for;
  // Debt of Loyalty regenerates AND changes control off the regeneration;
  // Defensive Maneuvers takes a creature type of the caster's choice at
  // resolution; Decision Paralysis adds a skip-untap rider to its up-to-N.
  ['Debt of Loyalty', 'regeneration'],
  ['Decompose', 'up-to-N targeting'],
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
  ['Dragonclaw Strike', 'up-to-N targeting'],
  ['Drain Power', 'opponent-chooses'],
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
  ['Essence Filter', 'script-raised prompt'],
  ['Eureka', 'opponent-chooses'],
  ['Exert Influence', 'converge (cast-time mana-color memory)'],
  ['Exhaustion', 'untap restriction'],
  ['Exhume', 'opponent-chooses'],
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
  ['Fold into Aether', 'opponent-chooses'],
  ["Fortune's Favor", 'opponent-chooses'],
  ['Fractalize', 'until-end-of-turn base P/T set'],
  // D215 — Full Flowering populates (CR 707 copy machinery, a NEW class);
  // Ghostly Flicker's 'two target artifacts, creatures, and/or lands you
  // control' parses confident to min2/max2 kinds ['artifact'] controller
  // 'any' — a DOUBLE silent narrowing (probed); Geosurge's mana is
  // spend-restricted (The Grey Havens' pool-metadata gap); Fumble's
  // reattach-to-another is the caster's pick.
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
  ['Goblin Game', 'physical item choice'],
  ['Graven Lore', 'mana-spent memory'],
  ['Gravkill', 'subtype list alternative'],
  // D217 — Hoarder's Greed CLASHES (reveal + each player's top/bottom
  // choice + compare + a repeat loop, a NEW class); 'one or two target
  // creatures' still parses confident exactly-2 (the D212 hazard, so
  // Hearts on Fire waits with Fancy Footwork); Heartwood Shard is
  // Granite Shard's cycle-mate; Heaven's Gate is Chaoslace's class with
  // the up-to hazard on top.
  ['Hearts on Fire', 'spell target parse (numeric disjunction)'],
  ['Heartwood Shard', 'alternative activation cost'],
  ['Heated Argument', 'script-raised prompt'],
  ["Heaven's Gate", 'UEOT color change'],
  ['Hellish Rebuke', 'temporary game-wide trigger'],
  ['Hex Magic', 'play-from-exile permission'],
  ['High Tide', 'temporary game-wide trigger'],
  // D218 — Honor's Reward BOLSTERS (the least-toughness tie is the
  // caster's pick — Defensive Maneuvers' precedent); Hour of
  // Devastation is the LOSE direction of the temp-grant carrier (Day of
  // Black Sun's class); Hypothesizzle's may-discard rider and the
  // bolster tie are the script-prompt seam's 13th and 14th entries.
  ['Hostile Takeover', 'until-end-of-turn base P/T set'],
  ['Hour of Devastation', 'temporary keyword/ability grant'],
  ['Humble', 'until-end-of-turn base P/T set'],
  ['Hurl into History', 'discover mechanic'],
  ['Hurl Through Hell', 'play-from-exile permission'],

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
  // D222 — Lava Storm's attacking-or-blocking arm is an un-templated
  // modal (Essence Filter's shape); Leeching Bite's mid-sentence
  // 'Another target' is D204's PROBED negative; Lost in Space hands
  // the top-or-bottom pick to the card's OWNER.
  ['Lava Storm', 'script-raised prompt'],
  ['Lay Down Arms', 'computed target threshold'],
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
  ['Madcap Experiment', 'ctx.random'],
  ["Mages' Contest", 'bidding mechanic'],
  ['Magical Hack', 'text-changing effect (CR 612)'],
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
  ['Mental Misstep', 'spell target parse (numeric exact)'],
  ['Merciless Repurposing', 'incubate mechanic'],
  ['Metamorphose', 'script-raised prompt'],
  ['Meteor Storm', 'ctx.random'],
  // D225 — Minamo's Meddling reads SPLICE memory (the kicker family's
  // cast-time rider); Mind Grind's printed 'X can't be 0' is a cast-time
  // restriction the engine cannot enforce — claiming the line unenforced
  // would be the D122 silent-coverage lie; Minds Aglow's Join forces is a
  // multiplayer payment prompt chain.
  ['Mind Bend', 'text-changing effect (CR 612)'],
  ['Mind Bomb', 'script-raised prompt'],
  ['Mind Grind', 'cast-permission condition'],
  ['Minds Aglow', 'script-raised prompt'],
  ['Misinformation', 'up-to-N targeting'],
  ['Misleading Motes', 'script-raised prompt'],
  ['Misstep', 'untap restriction'],
  // D226 — Mnemonic Nexus SHUFFLES from a resolve (the RNG stub); Molder
  // is the numeric-EXACT family's third card ('with mana value X' is an
  // equality the parser silently drops); Most Valuable Slayer's 'target
  // attacking creature' is Malamet Brawler's class's second card.
  ['Mnemonic Nexus', 'ctx.random'],
  ['Molder', 'spell target parse (numeric exact)'],
  ['Moonlace', 'color change (indefinite)'],
  ['Most Valuable Slayer', 'combat target qualifier unenforced'],
  // D227 — BOTH parse refusals are PROBED (d227\probe-out.json): Mystic
  // Denial's 'creature or sorcery spell' parses CONFIDENT to a
  // battlefield CREATURE (the typed-spell compound hole — the aim would
  // offer permanents for a counterspell), and Mutiny's 'another target
  // creature that player controls' is silently DROPPED; Muse Vortex also
  // bottoms in a random order (the RNG stub).
  ['Muse Vortex', 'play-from-exile permission'],
  ['Mutiny', 'spell target parse (second clause)'],
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
  ['Nullify', 'subtype list alternative'],
  ["O'aka, Traveling Merchant", 'remove-counter cost'],
  ["Oketra's Last Mercy", 'untap restriction'],
  // D230 — Ominous Sphinx names the DISCARD-EVENT DISCRIMINATOR: a
  // discard is a bare hand-to-graveyard CardsMoved indistinguishable from
  // a Tier-3 move (Graf Mole's sacrifice shape and Horizon Chimera's old
  // draw shape, one verb over; the cycling half has nothing to watch at
  // all). Open the Vaults returns AURAS, whose enchant-target choice is a
  // prompt.
  ['Open the Vaults', 'script-raised prompt'],
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
  // D233 (M6.4bv)
  ['Pieces of the Puzzle', 'script-raised prompt'],
  ['Piracy', 'tap-permission grant'],
  // D234 (M6.4bw)
  ['Polymorph', 'ctx.random'],
  ["Polymorphist's Jest", 'until-end-of-turn base P/T set'],
  ['Portcullis Vine', 'keyword-predicate sacrifice cost'],
  ['Portent of Calamity', 'script-raised prompt'],
  ['Powerleech', 'activation-event discriminator'],
  ['Press the Enemy', 'script-raised prompt'],
  ['Presumed Dead', 'temporary non-keyword ability grant'],
  // D235 (M6.4bx)
  ['Primal Surge', 'script-raised prompt'],
  ['Prismatic Lace', 'color change (indefinite)'],
  ['Prying Questions', 'script-raised prompt'],
  // D236 (M6.4by)
  ['Psychic Trance', 'temporary non-keyword ability grant'],
  ['Pulse of the Fields', 'spell relocates itself on resolution'],
  ['Pulse of the Forge', 'spell relocates itself on resolution'],
  ['Purelace', 'color change (indefinite)'],
  ['Purge', 'list with adjective alternative'],
  ['Radiant Flames', 'converge (cast-time mana-color memory)'],
  ['Radiant Strike', 'list with adjective alternative'],
  // D237 (M6.4bz)
  ["Rats' Feast", 'cast-time computed target count'],
  // D238 (M6.4ca)
  ['Ray of Ruin', 'subtype list alternative'],
  ['Reach of Shadows', 'color target qualifier unenforced'],
  ['Reality Ripple', 'phasing'],
  ['Regenerate', 'its own name is its verb: selfRef spells the name ~ before any rule runs, so the sentence arrives as ~ target creature (D373)'],
  ['Reign of Terror', 'script-raised prompt'],
  // D239 (M6.4cb)
  ['Relentless Pursuit', 'script-raised prompt'],
  ["Relic's Roar", 'until-end-of-turn base P/T set'],
  ['Reminisce', 'ctx.random'],
  ['Repel Calamity', 'spell target parse (numeric disjunction)'],
  ['Resolute Strike', 'script-raised prompt'],
  ['Restore', 'spell target parse (graveyard noun)'],
  ['Retraced Image', 'script-raised prompt'],
  // D240 (M6.4cc)
  ['Return to Dust', 'up-to-N targeting'],
  ['Reviving Vapors', 'script-raised prompt'],
  ['Ribbons of Night', 'mana-spent memory'],
  ['Riding the Dilu Horse', 'indefinite continuous effect'],
  ['Rise from the Grave', 'indefinite continuous effect'],
  // D241 (M6.4cd)
  ['Roiling Waters', 'up-to-N targeting'],
  ['Rolling Spoil', 'mana-spent memory'],
  ['Rookie Mistake', 'spell target parse (second clause)'],
  ['Roughshod Duo', 'expend mechanic'],
  // D242 (M6.4ce)
  ['Royal Herbalist', 'exile-from-library cost'],
  // D243 (M6.4cf)
  ['Sanguine Sacrament', 'spell relocates itself on resolution'],
  ['Sanity Gnawers', 'ctx.random'],
  ['Scarblade Elite', 'exile-from-graveyard cost'],
  // D244 (M6.4cg)
  ["Sea God's Revenge", 'plural-controller target qualifier unenforced'],
  ["Sea God's Scorn", 'list with and/or'],
  ["Sea Kings' Blessing", 'UEOT color change'],
  ['Searing Blood', 'delayed trigger'],
  // D245 (M6.4ch)
  ['Secrets of the Dead', 'cast-zone discriminator'],
  ['Selective Snare', 'cast-time computed target count'],
  // D246 (M6.4ci)
  ['Serpentine Ambush', 'until-end-of-turn base P/T set'],
  ["Shade's Breath", 'temporary non-keyword ability grant'],
  // D247 (M6.4cj)
  ['Shoving Match', 'temporary non-keyword ability grant'],
  ['Show and Tell', 'script-raised prompt'],
  ['Silverfur Partisan', 'becomes-targeted trigger'],
  ['Singe', 'UEOT color change'],
  // D248 (M6.4ck)
  ['Sinister Concoction', 'discard-cost chooser'],
  ['Sleep', 'untap restriction'],
  ['Sleight of Mind', 'text-changing effect (CR 612)'],
  // D249 (M6.4cl)
  ['Soul Diviner', 'remove-counter cost'],
  ['Soul Sear', 'temporary keyword/ability grant'],
  // D250 (M6.4cm)
  ['Spell Blast', 'spell target parse (numeric exact)'],
  ['Spell Snare', 'spell target parse (numeric exact)'],
  ['Spellshift', 'script-raised prompt'],
  ['Sphinx of the Chimes', 'discard-cost chooser'],
  ["Sphinx's Decree", 'cast restriction effect'],
  ['Spin into Myth', 'fateseal mechanic'],
  // D251 (M6.4cn)
  ['Spinning Wheel Kick', 'cast-time computed target count'],
  ['Spirit en-Dal', 'ability-word activated cost'],
  ['Spoils of the Hunt', 'mana-spent memory'],
  // D252 (M6.4co)
  ['Square Up', 'until-end-of-turn base P/T set'],
  // D253 (M6.4cp) — Step Right Up opens an ATTRACTION DECK, a zone this
  // engine has no concept of; Steward of Solidarity's EXERT is an
  // activation cost carrying a delayed untap restriction, and neither
  // half exists. Stern Scolding was PROBED: 'creature spell with power
  // or toughness 2 or less' parses CONFIDENT with `numeric` NULL — the
  // bound is silently dropped, Repel Calamity's exact hole.
  ['Step Right Up', 'attraction mechanic'],
  ['Stern Scolding', 'spell target parse (numeric disjunction)'],
  ['Steward of Solidarity', 'exert cost'],
  ['Stifle', 'ability countering'],
  ['Stolen Goods', 'play-from-exile permission'],
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
  ['Stream of Acid', 'list with adjective alternative'],
  ['Stream of Consciousness', 'up-to-N targeting'],
  ['Struggle for Sanity', 'opponent-chooses'],
  ['Sudden Setback', 'opponent-chooses'],
  // D255 (M6.4cr) — Suffer the Past was PROBED: 'X target cards' parses
  // confident:FALSE with min 0 / max 99, a computed target COUNT. Worth
  // noting that select.cjs's filter does NOT screen on `confident` (it
  // checks kinds and unenforced only), so the card was still offered.
  ['Suffer the Past', 'cast-time computed target count'],
  ['Summary Dismissal', 'ability countering'],
  ['Sunfall', 'incubate mechanic'],
  ['Supernatural Stamina', 'quoted-ability temporary grant'],
  ['Suppress', 'delayed trigger'],
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
  ['The Lost and the Damned', 'cast-zone discriminator'],

  // D259 (M6.4cv) — ONE new class, found by a PROBE rather than by a test.
  // 'target nonland permanent' parses CONFIDENT to kinds:['permanent'] with
  // unenforced:['nonland'] — the negated type is DISCLOSED rather than
  // dropped, but disclosed is exactly what D161 refuses: the aim would let a
  // LAND be untapped by a card that forbids it (Angelic Page, verbatim).
  // Befoul holds the negated-COLOUR direction (D199) and Devout Decree the
  // positive colour one (D208); nobody had probed a negated TYPE.
  ['Thoughtlace', 'indefinite color change'],

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
  ['Time and Tide', 'phasing'],
  ['Time Stop', 'end the turn'],
  // NEW: no turn-insertion machinery exists anywhere — `turn.ts` walks one
  // turn at a time and nothing can splice another in after it.
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
  ['Too Greedily, Too Deep', 'post-entry computed value'],
  ['Topple', 'computed target threshold'],
  ['Touch of Darkness', 'until-end-of-turn color change'],
  ['Track Down', 'script-raised prompt'],
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
  ['Undying Evil', 'quoted-ability temporary grant'],
  ['Undying Malice', 'quoted-ability temporary grant'],
  ['Unleash the Inferno', 'delayed trigger'],
  ['Unlucky Drop', 'script-raised prompt'],
  ['Unravel', 'mana-spent memory'],
  ['Unsubstantiate', 'mixed stack/permanent noun list'],

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
  ['Vega, the Watcher', 'cast-zone discriminator'],
  ['Vertigo', 'temporary keyword loss'],
  ['Vex', 'script-raised prompt'],

  // D266 (M6.4dc) — ZERO new classes, and the leanest batch of the arc:
  // 24 of 25 landed. The one refusal is a cost verb, not a rules hole.
  //
  // ⚠️ `Voice of the Woods` pays "Tap five untapped Elves you control" —
  // D168’s chooser has no tap-creatures verb, and it is a COUNTED,
  // subtype-restricted tap at that. Nothing else about the card is hard: the
  // 7/7 trample Elemental is an ordinary token line waiting on the cost.

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
  ['Wavebreak Hippocamp', 'once-per-turn trigger memory'],
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
  ['Wild Magic Surge', 'ctx.random'],
  ['Winds of Change', 'ctx.random'],
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
  ['Zero Point Ballad', 'script-raised prompt'],
  ["Zoyowa's Justice", 'discover mechanic'],
  // D358 - the wave the library search opened landed 69 of 84; these fifteen are what the row
  // maker refused, each by the reason it gave.
  ['Everbark Shaman', 'exile-from-graveyard cost (typed)'],
  ['Magus of the Order', 'multi-sacrifice cost'],
  ['Dark Petition', 'spell mastery'],
  ["New Generation's Technique", 'cast-time alternative cost'],
  ['Profane Tutor', 'suspend mechanic'],
  ["Roamer's Routine", 'cast-time alternative cost'],
  ['Search for Tomorrow', 'suspend mechanic'],
  ["Splinter's Technique", 'cast-time alternative cost'],
  ['The Masters of Evil', 'scoped anthem beside a search'],
  ['Magda, Brazen Outlaw', 'a leftover the probe reports differently from the printed line'],
  // D356 - the protection seam made these two offerable: their protection line reads now, and
  // what is left is a trigger head the row library does not carry.
  ['Spectrum Sentinel', "an opponent's nonbasic land entering"],

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
  ['Ancestral Vision', 'suspend mechanic'],
  ['Apex of Power', 'play-from-exile permission'],
  ['Aphotic Wisps', 'UEOT color change'],
  ['Argent Mutation', 'UEOT type change'],
  ['Arwen Undómiel', 'scry-surveil event discriminator'],
  ["Baral's Expertise", 'up-to-N targeting'],
  ["Benefactor's Draught", 'delayed trigger'],
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
  ['Cat Collector', 'once-per-turn trigger memory'],
  ['Cerulean Wisps', 'UEOT color change'],
  ['Channeled Dragonfire', 'harmonize mechanic'],
  ['Chivalric Alliance', 'discard-cost chooser'],
  ['Clear the Mind', 'ctx.random'],
  ['Clutch of the Undercity', 'transmute mechanic'],
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
  ['Crystal Spray', 'text-changing effect (CR 612)'],
  ['Dark Dabbling', 'regeneration'],
  ['Dash Hopes', 'opponent-chooses'],
  ['Death Spark', 'graveyard-order condition'],
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
  ['Exterminatus', 'temporary keyword/ability grant'],
  ['Fire Nation Occupation', 'firebending mechanic'],
  ['Flamewright', 'keyword-predicate sacrifice cost'],
  ['Foil', 'cast-time alternative cost'],
  ['Force of Vigor', 'cast-time alternative cost'],
  ['Fowl Strike', 'hand-activated ability'],
  ['Garbage Fire', 'draft-matters'],
  ['Ghostfire', 'color-defining static'],
  ['Gluttonous Guest', 'sacrifice-event discriminator'],
  ['Grim Harvest', 'recover mechanic'],

  // D276 (M6.4dm) — the G/H/I/J residue; ONE new class.
  //
  // ⚠️ Historian's Boon's second line fires off a SAGA's final chapter — the engine HAS Sagas since D528 (CR 714);
  // its entry stands under D528 with the row maker's reason for its FIRST line (a filtered head).
  // ⚠️ Two exile-SELF costs (Hanged Executioner, Inquisitive Puppet) join
  // Brittle Effigy's class; Jan Jansen's 'a noncreature artifact' is Magmaw's
  // negated-type sacrifice predicate; Inaction Injunction DETAINS (Lyev
  // Decree's class). Icy Blast taps X targets (cast-time computed count).
  ['Guerrilla Tactics', 'discard-event discriminator'],
  ['Hanged Executioner', 'exile-self cost'],
  ['Heroes Remembered', 'suspend mechanic'],
  ['Hunting Triad', 'hand-activated ability'],
  ['Hypergenesis', 'suspend mechanic'],
  ['Icefall', 'recover mechanic'],
  ['Icy Blast', 'cast-time computed target count'],
  ["Illusionist's Stratagem", 'up-to-N targeting'],
  ['Impossible Inferno', 'play-from-exile permission'],
  ['Inaction Injunction', 'detain mechanic'],
  ['Inquisitive Puppet', 'exile-self cost'],
  ['Inside Out', 'until-end-of-turn power/toughness switch'],
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
  ['Krovikan Rot', 'recover mechanic'],
  ['Lantern Flare', 'cleave mechanic'],
  ["Laquatus's Disdain", 'cast-zone discriminator'],
  ['Learn from the Past', 'ctx.random'],
  ['Lethargy Trap', 'cast-time alternative cost'],
  ['Mammoth Bellow', 'harmonize mechanic'],
  ['Manamorphose', 'script-raised prompt'],
  ['Metrognome', 'discard-event discriminator'],
  ['Mind Transfer Protocol', 'until-end-of-turn type change with P/T set'],
  ['Mindstab', 'suspend mechanic'],

  // D278 (M6.4do) — the M/N/O/P residue; ZERO new classes, and the leanest
  // refusal count since D257 (11 of 25).
  //
  // ⚠️ Nighthaze grants SWAMPWALK until end of turn — landwalk is not on
  // effectParse's grantable list, so it files with the temporary grants.
  // ⚠️ Olórin's Searing Light makes each OPPONENT pick among tied greatest
  // powers: opponent-chooses.
  ['Muddle the Mixture', 'transmute mechanic'],
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
  ['Providence', 'opening-hand reveal'],
  ['Psychic Purge', 'discard-event discriminator'],
  ['Quickchange', 'script-raised prompt'],
  ['Rally for the Throne', 'mana-spent memory'],
  ["Raphael's Technique", 'cast-time alternative cost'],
  ['Rat King, Pale Piper', 'token-predicate sacrifice cost'],
  ['Reality Anchor', 'temporary keyword/ability grant'],
  ['Reforge the Soul', 'miracle mechanic'],
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
  ['Sadistic Slash', 'mayhem mechanic'],
  ['Scrollshift', 'up-to-N targeting'],
  ['Searing Barrage', 'mana-spent memory'],
  ['Send to Sleep', 'up-to-N targeting'],
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
  ['Skyscribing', 'hand-activated ability'],
  ['Snakeform', 'until-end-of-turn type change with P/T set'],
  ['SP//dr, Piloted by Peni', 'modified predicate'],
  ['Spiritualize', 'temporary game-wide trigger'],
  ['Starfall Invocation', 'gift mechanic'],
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
  ['Surgical Suite // Hospital Room', 'room mechanic'],
  ['Sylvan Bounty', 'cycling mechanic'],
  ['Thunderblade Charge', 'free-cast permission'],
  ['Tidal Bore', 'cast-time alternative cost'],
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

  ['Wash Away', 'cleave mechanic'],
  ['Wheel of Fate', 'suspend mechanic'],
  ['Wild Ride', 'harmonize mechanic'],
  ['Winged Portent', 'cleave mechanic'],
  ['Zenith Festival', 'play-from-exile permission'],
  ['Zhalfirin Shapecraft', 'until-end-of-turn base P/T set'],
  ['Baleful Mastery', 'cast-time alternative cost'],
  ['Code of Constraint', 'untap restriction'],
  ['Escape Detection', 'freerunning mechanic'],

  // D290 (M6.4ea) — the 22 cards D289's keyword seam made offerable: 18
  // landed, four refused.
  //
  // ⚠️ `Bamboo Grove Archer` is a Channel — "{4}{G}, Discard this card:" is
  // an ability activated from the HAND, which the engine's activated seam
  // (battlefield only) does not offer. The class exists; it joins it.
  //
  // ⚠️ `Landroval`, `Roc Charger` and `Trusted Pegasus` all say "target
  // ATTACKING creature without flying": the noun table reads "attacking
  // creature" with `unenforced: ['attacking']`, and no shipped script
  // targets one — the validator has no combat-role field. D289 enforced the
  // KEYWORD half; the combat-role half is the next qualifier seam (a
  // `TargetCandidate.attacking`/`blocking` pair read off `state.combat`).

  // D292 (M6.4ec) — the 54 cards D291's combat-role seam made offerable: 38
  // landed, sixteen refused.
  //
  // ⚠️ Eleven are BLOODRUSH — "{cost}, Discard this card: target attacking
  // creature gets +N/+N" is an ability activated from the HAND, the Channel
  // shape D290 refused for Bamboo Grove Archer; they join that class.
  // ⚠️ The two Traps offer an alternative cost at cast time ("you may pay {W}
  // rather than pay this spell's mana cost") — the cast-time class.
  // ⚠️ `Enduring Victory` bolsters (a least-toughness tie is the controller's
  // choice — a script-raised prompt); `Dissension in the Ranks` says
  // "another target blocking creature" (the "another" split, d292/design.md);
  // `Sandstone Deadfall` sacrifices "two lands and this artifact" (the
  // multi-sacrifice cost).
  ['Pitfall Trap', 'cast-time alternative cost'],
  ['Slingbow Trap', 'cast-time alternative cost'],
  ['Sandstone Deadfall', 'multi-sacrifice cost'],
  // ⚠️ `Lieutenant Kirtar` sacrifices ITSELF BY NAME ("Sacrifice Lieutenant
  // Kirtar:"); the cost reader prices "Sacrifice this creature" and not the
  // printed-name form, so the ability is never offered - measured at the port.

  // D295 (M6.4eg) — the 137 cards D294's adjective seam made offerable: the
  // activated/triggered families landed from one table, the spells by hand or
  // by a parser sentence, and these refused for a stated structural reason.
  //
  // ⚠️ Five offer an alternative cost at cast time (Fierce Guardianship,
  // Snuff Out, Spinning Darkness, cleave, spell mastery); two are forecast
  // (an ability activated from the HAND); four let the OWNER or an OPPONENT
  // choose (top-or-bottom, "of an opponent's choice"); one grants play-from-
  // exile; amass, the Ring, cloak, manifest dread, incubate and airbend are
  // mechanics the engine does not have; two restrict ONE alternative of a
  // list ("black creature or black planeswalker" — the per-alternative seam);
  // Ohran Yeti pays {S}; Null Brooch discards a whole HAND as a cost; Squirming
  // Emergence bounds its target by a COUNT the parser cannot read; two spells
  // SET characteristics (a Frog/Octopus, an artifact creature with P/T = MV);
  // Unexpectedly Absent places a card at an INDEX inside a library. Four
  // spells count X targets and Repeal reads X into a qualifier (cast-time
  // numbers); two remember the colours of mana spent (converge); two grant a
  // QUOTED ability; Rhino's Rampage has a reflexive trigger; Venser's
  // Diffusion lists "suspended card"; Premature Burial needs the turn a
  // permanent entered; Lunatic Pandora sacrifices itself BY NAME; Unwind
  // untaps "up to three lands" of the caster's choosing.
  ['Spinning Darkness', 'cast-time alternative cost'],
  ["Alchemist's Retrieval", 'cast-time alternative cost'],
  ['Swift Reckoning', 'cast-time alternative cost'],
  ['Govern the Guildless', 'hand-activated ability'],
  ['Piercing Rays', 'hand-activated ability'],
  ['Volcanic Offering', 'opponent-chooses'],
  ['Desynchronize', 'opponent-chooses'],
  ['Run Out of Town', 'opponent-chooses'],
  ['Vanish from Sight', 'opponent-chooses'],
  ['Suspend Aggression', 'play-from-exile permission'],
  ['Radiant Purge', 'list with adjective alternative'],
  ["Liliana's Defeat", 'list with adjective alternative'],
  ['Ohran Yeti', 'snow activation cost'],
  ['Null Brooch', 'discard-hand cost'],
  ['Unexplained Absence', 'cloak mechanic'],
  ['Excise the Imperfect', 'incubate mechanic'],
  ['Airbending Lesson', 'airbend mechanic'],
  ['Squirming Emergence', 'spell target parse (computed numeric bound)'],
  ['Mercurial Transformation', 'characteristic-setting effect'],
  ["Karn's Touch", 'characteristic-setting effect'],
  ['Unexpectedly Absent', 'library position placement'],
  ['Distorting Wake', 'cast-time computed target count'],
  ['Gridlock', 'cast-time computed target count'],
  ['Dregs of Sorrow', 'cast-time computed target count'],
  ['Avalanche', 'cast-time computed target count'],
  ['Prismatic Ending', 'converge (cast-time mana-color memory)'],
  ['Mythos of Nethroi', 'converge (cast-time mana-color memory)'],
  ['Banishing Knack', 'quoted-ability temporary grant'],
  ['Retraction Helix', 'quoted-ability temporary grant'],
  ["Rhino's Rampage", 'reflexive trigger'],
  ['Repeal', 'cast-time X in target qualifier'],
  ["Venser's Diffusion", 'unparseable list alternative (suspended card)'],
  ['Premature Burial', 'entry-turn memory'],
  // ...and of the 29 cards the four D295 sentences made offerable in turn,
  // five: a becomes-targeted trigger, a delayed trigger ("this turn"), a cost
  // of HALF a life total, an exile-from-graveyard cost, a two-part sacrifice.
  ["Mage Hunters' Onslaught", 'delayed trigger'],
  ['Murderous Betrayal', 'pay-half-life cost'],
  ['Zombie Assassin', 'exile-from-graveyard cost'],
  ['Viscerid Drone', 'multi-sacrifice cost'],

  // D297 (M6.4eh) — the list/subtype seam made 27 cards offerable: 24 landed
  // (14 table rows, 10 spells); two re-attach an Aura to a permanent of the
  // caster's choosing (a script-raised prompt), one destroys X Mountains.
  ['Enchantment Alteration', 'script-raised prompt'],
  ['Aura Graft', 'script-raised prompt'],
  ['Volcanic Eruption', 'cast-time computed target count'],

  // D298 (M6.4ei) — the graveyard-return slot made 33 cards offerable: 31 landed
  // (23 table rows, 5 by hand, 3 whole after the adjective comma); one triggers
  // on attacking ALONE (a combat condition the bus does not read), one
  // sacrifices THREE creatures as a cost.
  ['Ironsoul Enforcer', 'attacks-alone trigger'],
  ['Turntimber Sower', 'multi-sacrifice cost'],

  // D299 (M6.4ej) — the counted-targets seam made 32 cards offerable: 25 landed
  // (21 table rows, 4 by hand); one activates from the graveyard, one triggers
  // on EXPEND, two are Rooms with doors, one is a forecast ability activated
  // from the hand, one exerts as a cost, one reads poison counters as it is cast.
  ['Trailtracker Scout', 'expend trigger'],
  ['Bottomless Pool // Locker Room', 'Room doors'],
  ['Grand Entryway // Elegant Rotunda', 'Room doors'],
  ['Proclamation of Rebirth', 'forecast (hand-activated ability)'],
  ['Hope Tender', 'exert cost'],
  ['Geth\'s Summons', 'cast-time poison condition (corrupted)'],

  // D300 (M6.4ek) — the static seam made the pure anthems and grants offerable
  // (table rows, token-making rows, hand modules for the combined defs); one is a
  // planeswalker (loyalty abilities are not charged), one a battle, one scries
  // from a trigger (a script cannot raise the scry prompt).
  ['Samut, Tyrant Smasher', 'planeswalker loyalty ability'],
  ['Invasion of Belenon // Belenon War Anthem', 'battle (siege, defeat, transform)'],

  // D301 (M6.4el) — the one-shot seam offered the activated self / mass pumps;
  // the classifier cannot see a COST, so the ones no table row can charge are
  // refused by name (snow mana, the {Q} symbol, a random discard, a graveyard
  // activation, a counter removed, a two-type sacrifice), with the four whose
  // second line the engine cannot run and one adventure.
  ['Diamond Faerie', 'snow mana cost'],
  ['Duergar Mine-Captain', 'untap-symbol cost'],
  ['Rift Elemental', 'remove-counter cost'],
  ['Orc General', 'multi-type sacrifice cost'],
  ['Oakhame Ranger // Bring Back', 'adventure (two faces)'],
  ['Goro-Goro and Satoru', 'entered-this-turn combat-damage trigger'],

  // D301 part B — the pool the classifier offered beyond the probe: the trigger
  // heads the generator library does not read yet, the token-beside-pump
  // combinations, the costs no row charges, the alternative-cost spells, the
  // hand-activated abilities and the planeswalkers.
  ['Harbin, Vanguard Aviator', 'trigger head outside the library'],
  ['Wildfire Elemental', 'trigger head outside the library'],
  ['Invasion Tactics', 'trigger head outside the library'],
  ['Saradoc, Master of Buckland', 'trigger head outside the library'],
  ['Steeling Stance', 'forecast (hand-activated ability)'],
  ['Swell of Courage', 'reinforce (hand-activated ability)'],
  ['Thalia\'s Geistcaller', 'trigger head outside the library'],
  ['Garruk Wildspeaker', 'planeswalker loyalty ability'],
  ['Garruk Wildspeaker // Garruk Wildspeaker', 'planeswalker loyalty ability'],
  ['Myrkul\'s Invoker', 'ability-word cost'],
  ['Sanctum Spirit', 'historic discard cost'],

  // D302 (M6.4em) — the triggered one-shot pool: the heads outside the library,
  // the keywords outside the grantable map, the costs no row charges.

  // D303 (M6.4en) — the counter one-shot pool: the or-typed sacrifice costs,
  // an exile-from-graveyard cost, a conditional enters-tapped replacement.

  // D303 (M6.4en) — the counter one-shot pool: the heads outside the library,
  // the per-item counters on an entering object, the costs no row charges.
  ['Daybreak Coronet', 'an Aura line outside the row shapes (Enchant creature with another Aura attached to i)'],
  ['Contaminated Bond', 'an Aura line outside the row shapes (Whenever enchanted creature attacks or blocks, i)'],
  ['Luminous Wake', 'an Aura line outside the row shapes (Whenever enchanted creature attacks or blocks, y)'],
  ['Viridian Harvest', 'an Aura line outside the row shapes (Enchant artifact)'],
  ['Mists of Littjara', 'an Aura line outside the row shapes (Enchant creature or Vehicle)'],
  ['Sinister Possession', 'an Aura line outside the row shapes (Whenever enchanted creature attacks or blocks, i)'],
  ['Betrayal', 'an Aura line outside the row shapes (Whenever enchanted creature becomes tapped, you )'],
  ['Valor of the Worthy', 'an Aura line outside the row shapes (When enchanted creature leaves the battlefield, )'],
  ['Glasswing Grace // Age-Graced Chapel', 'multi-face card'],
  ['Fate Foretold', 'an Aura line outside the row shapes (When enchanted creature dies, its controller dra)'],
  ['Corrupted Roots', 'an Aura line outside the row shapes (Enchant Forest or Plains)'],
  ['Favor of the Woods', 'an Aura line outside the row shapes (Whenever enchanted creature blocks, you gain N l)'],

  // D303 (M6.4en) — the counter one-shot pool: the heads outside the library,
  // the per-item counters on an entering object, the costs no row charges.
  ['Giant\'s Skewer', 'an Equipment line outside the row shapes (Whenever equipped creature deals combat damage t)'],
  ['Beamtown Beatstick', 'an Equipment line outside the row shapes (Whenever equipped creature deals combat damage t)'],
  ['Goggles of Night', 'an Equipment trigger payload outside the row kinds (scry N, then draw a card.)'],

  // D306 (M6.4eq) — the cycling pool: the cyclers whose other text the engine
  // cannot run yet - their cycling does (a spell outside the vocabulary, the
  // when-you-cycle triggers, a cycle-or-discard head).
  ['Akroma\'s Vengeance', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Essence Fracture', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Floodwaters', 'a spell line outside the vocabulary (its cycling runs)'],

  ['Pest Control', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Rapid Decay', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Scarab Feast', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Spectacular Pileup', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Startling Development', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Trip Up', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Death Pulse', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Decree of Annihilation', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Decree of Pain', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Deem Worthy', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Dirge of Dread', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Dismantling Wave', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Primal Boost', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Renewed Faith', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Resounding Roar', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Resounding Scream', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Resounding Silence', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Resounding Thunder', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Resounding Wave', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Slice and Dice', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Solar Blast', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],
  ['Stir the Sands', 'a when-you-cycle trigger (its cycling runs; a head over the cycling event next)'],

  // D307 (M6.4er) — the flashback pool: the flashback spells whose other
  // sentences the vocabulary does not read yet - their flashback runs.
  ['Alter Reality', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Bulk Up', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Calibrated Blast', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Canopy Claws', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Ignite the Future', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Kaleidoscorch', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Krosan Reclamation', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Lidless Gaze', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Memory\'s Journey', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Molten Note', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Momentary Blink', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Past in Flames', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Recoup', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Rite of Harmony', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Rockalanche', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Ruthless Negotiation', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Saving Grasp', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Sever the Bloodline', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Shattered Perception', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Snort', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Solstice Revelations', 'a spell line outside the vocabulary (its flashback runs)'],
  ['Traitor\'s Clutch', 'a spell line outside the vocabulary (its flashback runs)'],

  // D308 (M6.4es) — the keyword-trigger pool: the carriers whose other
  // lines the vocabulary does not read yet - their keyword trigger runs.
  ['Glen Elendra Archmage', 'a creature line outside the vocabulary (its persist runs)'],
  ['Pinnacle Monk // Mystic Peak', 'a creature line outside the vocabulary (its prowess runs)'],
  ['Pollywog Prodigy', 'a creature line outside the vocabulary (its evolve runs)'],
  ['Ray Fillet, Wave Warrior', 'a creature line outside the vocabulary (its evolve runs)'],
  ['River Kelpie', 'a creature line outside the vocabulary (its persist runs)'],

  // D309 (M6.4et) — the morph pool: the morph creatures whose other
  // lines the vocabulary does not read yet - their morph runs.
  ['Stratus Dancer', 'a turned-face-up trigger (its morph runs; a head over FaceDownSet next)'],
  ['Venomspout Brackus', 'an activated line outside the vocabulary (its morph runs)'],
  ['Voidmage Apprentice', 'a turned-face-up trigger (its morph runs; a head over FaceDownSet next)'],
  ['Voidmage Prodigy', 'an activated line outside the vocabulary (its morph runs)'],

  // D310 (M6.4eu) — the changeling / devoid pool: the carriers whose other
  // lines the vocabulary does not read yet - their changeling or devoid runs.
  ['Blades of Velis Vel', 'a spell line outside the vocabulary (its changeling runs)'],
  ['Cryptic Cruiser', 'a creature line outside the vocabulary (its devoid runs)'],
  ['Ego Erasure', 'a spell line outside the vocabulary (its changeling runs)'],
  ['Gladewalker Ritualist', 'a creature line outside the vocabulary (its changeling runs)'],
  ['Grip of Desolation', 'a spell line outside the vocabulary (its devoid runs)'],
  ['Nameless Inversion', 'a spell line outside the vocabulary (its changeling runs)'],
  ['Shields of Velis Vel', 'a spell line outside the vocabulary (its changeling runs)'],
  ['Witness the End', 'a spell line outside the vocabulary (its devoid runs)'],
  ['Kozilek\'s Return', 'a spell line outside the vocabulary (its devoid runs)'],
  ['Ugin\'s Binding', 'a spell line outside the vocabulary (its devoid runs)'],

  // D311 (M6.4ev) — the crew pool: the Vehicles whose other
  // lines the vocabulary does not read yet - their crew runs.
  ['Fire Nation Warship', 'a Vehicle line outside the vocabulary (its crew runs)'],
  ['Rangers\' Aetherhive', 'a Vehicle line outside the vocabulary (its crew runs)'],
  ['Silent Submersible', 'a combat trigger outside the vocabulary (its crew runs)'],

  // D312 (M6.4ew) — the cost-reduction pool: the carriers whose other
  // lines the vocabulary does not read yet - their reduction is priced.
  ['Allies at Last', 'a spell line outside the vocabulary (its reduction is priced)'],
  ['Millicent, Restless Revenant', 'a permanent line outside the vocabulary (its reduction is priced)'],
  ['Neonate\'s Rush', 'a spell line outside the vocabulary (its reduction is priced)'],
  ['Polliwallop', 'a spell line outside the vocabulary (its reduction is priced)'],
  ['Rebel Salvo', 'a spell line outside the vocabulary (its reduction is priced)'],
  ['Visions of Villainy', 'a spell line outside the vocabulary (its reduction is priced)'],
  ['Voyage Home', 'a spell line outside the vocabulary (its reduction is priced)'],
  ['The Circle of Loyalty', 'a permanent line outside the vocabulary (its reduction is priced)'],

  // D325 (M6.4fj) - the two cards the mana-ability seam made offerable that the row
  // maker still refuses: a tap-a-Gate cost, a two-type destroy.

  // D327 (M6.4fl) - the sacrifice-a-token cost the engine does not charge: its chooser reads
  // types, subtypes and colours, and a token is none of them.

  // D344 (M6.4gc) - the two rows the vocabulary generator refuses by name after its first port:
  // a self-sacrifice on a creature that returns, and an attached static that empties the suite's Bears.
  ['Kithkin Spellduster', 'a self-sacrifice on a creature that returns (persist) - the suite cannot assert its grave'],
  // D389 - the eight the look-with-a-filter seam made OFFERABLE and the row maker or the engine refused, by reason.
  ['Horn of the Mark', 'trigger head not in the library (an attacker COUNT: two or more creatures you control attack a player)'],
  ['Search for Dagger', 'trigger head not in the library (your commander enters or attacks)'],
  ['Siona, Captain of the Pyleas', 'trigger head not in the library (an Aura you control becomes attached to a creature you control)'],
  ['Foul Emissary', 'trigger head not in the library (sacrificed while casting a spell with emerge)'],
  ['Once Upon a Time', 'cast-time alternative cost (the first spell of the game is cast free)'],
  ["Visionary's Dance", 'hand-activated ability (channel-shaped: {2}, Discard this card)'],
  ['Creative Outburst', 'hand-activated ability (channel-shaped: {U/R}{U/R}, Discard this card)'],
  // D390 - the player queue's wave: the four the selector offered that the row maker refused, by reason.
  ['Merchant of Venom', 'a sacrifice-EVENT head (whenever a player sacrifices a permanent) the library does not hold - CardMove.reason (D377) makes it expressible'],
  ['Failed Conversion', 'an attached static whose toughness pump kills the 2/2 Bears the suite enchants'],
  // D391 - proliferate: the four the selector offered after the wave that the row maker refused, by reason.
  ['Grateful Apparition', 'trigger head not in the library (combat damage to a player OR a planeswalker - the two-noun connect head)'],
  ['Guildpact Informant', 'trigger head not in the library (combat damage to a player OR a planeswalker - the two-noun connect head)'],
  ["Norn's Choirmaster", 'trigger head not in the library (a commander you control enters or attacks)'],
  // D392 - the referent subject: the three the selector offered after the wave that the row maker refused, by reason.
  ['Haunted Hellride', 'an attack head on a card with no creature body (an Aura that says whenever you attack)'],
  // D393 - threaten: the four the selector offered after the seam that the row maker refused, by reason.
  // D394 - the can't-block restriction: the seven the selector offered after the seam that the row maker refused, by reason.
  ['Frenzied Goblin', 'a paid trigger payload (Pay {R}. If you do, target creature can not block this turn.) - the head arm takes one pump'],
  ['Intimidator Initiate', 'a paid trigger payload (Pay {1}. If you do, target creature can not block this turn.) - the head arm takes one pump'],
  // D395 - the animate family: the four the selector offered after the seam that the row maker refused, by reason.
  ['Balduvian Conjurer', 'a target the suite has no fixture for (target snow land)'],
  ['Hostile Desert', 'an activation cost the engine cannot charge (exile a land card from your graveyard)'],
  ['Restless Anchorage', 'trigger head not in the library (whenever this land attacks - the animated land as the attacker)'],
  ['Restless Bivouac', 'trigger head not in the library (whenever this land attacks - the animated land as the attacker)'],
  // D396 - bite and fight: the seven the selector offered after the seam that the row maker refused, by reason.
  ["Sinstriker's Will", 'a quoted grant of a bite on an enchanted creature (Enchanted creature has ...) - the grant generator, not the mainline row maker'],
  ['Surestrike Trident', 'a quoted grant of a bite on an equipped creature (Equipped creature has first strike and ...) - the grant generator, not the mainline row maker'],
  ['Legolas, Master Archer', 'a filtered cast head outside the closed reader (whenever you cast a spell that targets ...)'],
  ['Markov Enforcer', 'a compound head (whenever this creature or another Vampire enters) outside the closed reader'],

  // D397 - spend-restricted mana: the two the selector offered after the seam that the row maker refused, by reason.
  ['Renowned Weaponsmith', 'a search payload naming two cards by NAME (Heart-Piercer Bow or Vial of Dragonfire) - the search predicate reads types, subtypes and one name'],
  // D397 - the one card the three legendary any-colour scopes made offerable, refused by the row maker.
  ['Plaza of Heroes', 'a cost the engine does not charge (cost: Exile this land) beside the any-colour scopes the seam built - the row maker refuses the exile-self cost'],

  // D398 - this-turn conditions: the four the selector offered after the seam (an enters-with line the
  // classifier had never offered, or a card whose other line the turn record made readable) that the
  // row maker refused, by reason.
  ['Patrolling Peacemaker', 'a crime head (whenever an opponent commits a crime) outside the head library - the turn record keeps no crime'],
  ['Pentavus', 'a sacrifice cost whose fodder is its own Pentavite token - no fixture the suite can put down'],
  ['Spike Weaver', 'a combat-damage prevention shield with no target (prevent all combat damage this turn) the suite cannot prove without an attack'],
  ['Swarm Shambler', 'a becomes-the-target head filtered by a +1/+1 counter on the targeted creature - outside the head library'],

  // D399 - the temporary unblockable grant: the six the selector offered after the seam that the
  // row maker refused, by reason (none of them the grant itself).
  ['Merfolk Cave-Diver', 'an explores head (whenever a creature you control explores) outside the head library - the engine has no explore'],
  ['Guild Thief', 'an ability-word activated line (Cunning Action) - the row maker refuses ability words on an activated line'],
  ['Key to the City', 'a filtered head (whenever this artifact becomes untapped) outside the closed reader - untapped is not a head the library holds'],
  ['Ghostly Pilferer', 'a trigger payload that is a may-pay-then-draw (pay {2}, if you do, draw a card) - the vocabulary reads neither the optional cost nor the conditional'],

  // D400 - the intervening if under the refire heads: the five the selector offered after the
  // classifier widening that the row maker refused, by reason (none of them the condition itself).
  ['Valkyrie Harbinger', 'a token outside TOKEN_TABLE (a 4/4 white Angel with flying and vigilance) under the conditioned end-step head'],
  ['Canonized in Blood', 'a token outside TOKEN_TABLE (a 4/3 white and black Vampire Demon with flying) under the conditioned end-step head'],

  // D401 - the conditional statics: the nine the selector offered after the classifier admitted
  // them that the row maker refused (or the draft pulled), by reason.
  ['Blackbloom Rogue // Blackbloom Bog', 'a modal double-faced card offered for its front face (multi-face layout)'],
  ['Crew Captain', 'a static gated by the source entering this turn (it entered this turn) - the suite cannot stage the entry turn as the broken state'],
  ['Twinblade Paladin', 'a life condition beside a gain-life head on the same card - the stage that meets the condition is a life gain the head answers with a counter (a draft-time pull)'],

  // D402 - the delayed trigger: the eleven spells the classifier offered once their cantrip line
  // (draw a card at the beginning of the next turn's upkeep) read, each refused for its OTHER line.
  ['Clairvoyance', 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (look at target player hand)'],
  ['Formation', 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (banding)'],
  ['Jinx', 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (a land becomes a basic land type of your choice)'],
  ['Jolt', 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (you may tap or untap target permanent)'],
  ['Prophecy', 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (reveal the top card of target opponent library, a land untaps)'],
  ['Soul Rend', 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (destroy target creature if it is white)'],
  ["Telim'Tor's Edict", 'a spell line outside the SpellDef vocabulary beside its delayed cantrip (exile target permanent you own or control)'],

  // D403 - kicker: the fourteen the selector offered once the Kicker line and the kicked conditions read
  // that the row maker refused, by reason (the nine spells for their other lines - this generator rows
  // no spell but a mass pump; the rest by name).
  ['Agonizing Demise', 'a spell line outside the row vocabulary beside its kicked clause (the generator rows no spell but a mass pump)'],
  ['Fires of Victory', 'a spell line outside the row vocabulary beside its kicked clause (damage equal to the cards in hand)'],
  ['Jilt', 'a spell line outside the row vocabulary beside its kicked clause (a bounce and a kicked damage)'],
  ["Orim's Thunder", 'a spell line outside the row vocabulary beside its kicked clause (a destroy and a kicked damage equal to the mana value)'],
  ['Tribute to Urborg', 'a spell line outside the row vocabulary beside its kicked clause (-2/-2 and a kicked extra)'],
  ['Hunting Wilds', 'a spell line outside the row vocabulary beside its kicked clause (a search onto the battlefield, the kicked untap and animation)'],
  ['Molten Disaster', 'a spell line outside the row vocabulary beside its kicked clause (X damage to each creature without flying; split second if kicked)'],
  ['Protect the Negotiators', 'a spell line outside the row vocabulary beside its kicked clause (a counter unless pays; a kicked mass pump)'],
  ['Keldon Strike Team', 'a static gated by the source entering this turn (as long as this creature entered this turn) the suite cannot stage as the broken state, beside its kicked enters head'],
  ['Roost of Drakes', 'a filtered cast head (whenever you cast a kicked spell) outside the closed reader - kicked is not an adjective the filter reads'],
  ['Tourach, Dread Cantor', 'a trigger payload the vocabulary refuses (target opponent discards two cards at random - randomness a def cannot thread) under a kicked enters head'],

  // D404 - the board-granted cost reduction: the two the selector offered once the engine priced a
  // `spells you cast cost {N} less` line that the row maker refused, by reason.
  ['Gargos, Vicious Watcher', 'a trigger head not in the library (whenever a creature you control becomes the target of a spell) beside its fight'],
  ['Valeria Richards, Precocious', 'a filtered cast head outside the closed reader (your first noncreature spell each turn - a once-per-turn count the filter does not read)'],

  // D405 - convoke / improvise / delve: the nineteen the selector offered once the keyword line was the
  // engine's that the row maker refused, by reason (fifteen spells for their other line - this generator
  // rows no spell but a mass pump; the rest by name).
  ['Appeal to Eirdu', 'a spell line outside the row vocabulary beside its convoke (one or two target creatures each get +2/+1)'],
  ['Calamity of Cinders', 'a spell line outside the row vocabulary beside its convoke (6 damage to each untapped creature)'],
  ['Endless Obedience', 'a spell line outside the row vocabulary beside its convoke (a creature card from a graveyard onto the battlefield)'],
  ['Everything Comes to Dust', 'a spell line outside the row vocabulary beside its convoke (exile all creatures except those sharing a type with a convoker - a convoke referent)'],
  ['Hour of Reckoning', 'a spell line outside the row vocabulary beside its convoke (destroy all nontoken creatures)'],
  ['Lethal Scheme', 'a spell line outside the row vocabulary beside its convoke (a destroy, then each convoker connives - a convoke referent)'],
  ['Organic Extinction', 'a spell line outside the row vocabulary beside its improvise (destroy all nonartifact creatures)'],
  ['Rite of Undoing', 'a spell line outside the row vocabulary beside its delve (two bounces, one of each side)'],
  ['Temporal Cleansing', 'a spell line outside the row vocabulary beside its convoke (a library placement the owner chooses)'],
  ['Bennie Bracks, Zoologist', 'an intervening if outside the closed reader (if you created a token this turn) under an each-end-step head, beside its convoke'],
  ['Conclave Phalanx', 'a board-sized life gain the suite cannot pin (1 life for each creature you control) under an enters head, beside its convoke'],
  ['Kasla, the Broken Halo', 'a filtered cast head outside the closed reader (whenever you cast a spell with convoke) beside its convoke'],
  ['Merrow Skyswimmer', 'a token outside TOKEN_TABLE (a 1/1 white and blue Merfolk) under an enters head, beside its convoke'],

  // D406 - the additional cost at cast: the thirty-five the selector offered once the cost line was the
  // engine's that the row maker refused, by reason (thirty-four spells for their other line - this
  // generator rows no spell but a mass pump, and most read the SACRIFICED permanent's power, toughness or
  // mana value, a referent the vocabulary does not carry; one creature for a battle clause).
  ['Burnt Offering', "a spell line outside the row vocabulary beside its sacrifice cost (X mana of {B} and/or {R}, X the sacrificed creature's mana value)"],
  ['Call for Blood', "a spell line outside the row vocabulary beside its sacrifice cost (-X/-X, X the sacrificed creature's power)"],
  ['Corpse Explosion', "a spell line outside the row vocabulary beside its exile-from-graveyard cost (damage equal to the exiled card's power to each creature)"],
  ['Corpse Lunge', "a spell line outside the row vocabulary beside its exile-from-graveyard cost (damage equal to the exiled card's power)"],
  ['Culling the Weak', 'a spell line outside the row vocabulary beside its sacrifice cost (Add {B}{B}{B}{B} - a mana spell)'],
  ['Embrace Oblivion', 'a spell line outside the row vocabulary beside its sacrifice cost (destroy target creature or Spacecraft)'],
  ['Endemic Plague', 'a spell line outside the row vocabulary beside its sacrifice cost (destroy all creatures sharing a type with the sacrificed one)'],
  ['Final Strike', "a spell line outside the row vocabulary beside its sacrifice cost (damage equal to the sacrificed creature's power to an opponent)"],
  ['Fling', "a spell line outside the row vocabulary beside its sacrifice cost (damage equal to the sacrificed creature's power)"],
  ['Fodder Launch', 'a spell line outside the row vocabulary beside its sacrifice cost (-5/-5 and 5 damage to its controller)'],
  ['Foundry Helix', 'a spell line outside the row vocabulary beside its sacrifice cost (4 damage, life if the sacrificed permanent was an artifact)'],
  ['Fumarole', 'a spell line outside the row vocabulary beside its life cost (destroy target creature AND target land - two targets of two kinds)'],
  ['Grab the Prize', 'a spell line outside the row vocabulary beside its discard cost (draw two, a Treasure if the discarded card was not a land - a discard referent)'],
  ['Hellish Sideswipe', 'a spell line outside the row vocabulary beside its sacrifice cost (destroy target creature or Vehicle, then a sacrificed-permanent referent)'],
  ['Ichor Explosion', "a spell line outside the row vocabulary beside its sacrifice cost (all creatures get -X/-X, X the sacrificed creature's power)"],
  ['Infernal Plunge', 'a spell line outside the row vocabulary beside its sacrifice cost (Add {R}{R}{R} - a mana spell)'],
  ["Life's Legacy", "a spell line outside the row vocabulary beside its sacrifice cost (draw cards equal to the sacrificed creature's power)"],
  ['Metamorphosis', "a spell line outside the row vocabulary beside its sacrifice cost (X mana of one colour, X one plus the sacrificed creature's mana value)"],
  ['Mind Extraction', 'a spell line outside the row vocabulary beside its sacrifice cost (a reveal and a discard of a colour the sacrificed creature shared)'],
  ['Momentous Fall', "a spell line outside the row vocabulary beside its sacrifice cost (draw and gain life by the sacrificed creature's power and toughness)"],
  ['Morbid Curiosity', "a spell line outside the row vocabulary beside its sacrifice cost (draw cards equal to the sacrificed permanent's mana value)"],
  ['New Blood', 'a spell line outside the row vocabulary beside its tap cost (gain control of target creature and change its text)'],
  ['Pyrrhic Blast', "a spell line outside the row vocabulary beside its sacrifice cost (damage equal to the sacrificed creature's power, then a draw)"],
  ["Reckoner's Bargain", "a spell line outside the row vocabulary beside its sacrifice cost (life equal to the sacrificed permanent's mana value, then a draw)"],
  ['Rite of Consumption', "a spell line outside the row vocabulary beside its sacrifice cost (damage equal to the sacrificed creature's power, that much life)"],
  ['Sacrifice', "a spell line outside the row vocabulary beside its sacrifice cost (Add {B} equal to the sacrificed creature's mana value - a mana spell)"],
  ['Severed Strands', "a spell line outside the row vocabulary beside its sacrifice cost (life equal to the sacrificed creature's toughness, then a destroy)"],
  ['Thud', "a spell line outside the row vocabulary beside its sacrifice cost (damage equal to the sacrificed creature's power)"],
  ['Tormented Thoughts', "a spell line outside the row vocabulary beside its sacrifice cost (a discard equal to the sacrificed creature's power)"],
  ['Ultimate Nullification', 'a spell line outside the row vocabulary beside its sacrifice cost (exile all creatures and graveyards, then a library placement)'],
  ["Sazacap's Brew", 'a gift line beside its discard cost (Gift a tapped Fish) outside the row vocabulary'],
  ['Sparkhunter Masticore', 'a vocabulary clause the suite has no fixture for (a battle clause) beside its discard cost'],

  // D407 - the linked exile: the one the selector offered once the until-leaves rider read that the row
  // maker refused, by reason.
  ['Circle of Confinement', 'a filtered head outside the closed reader (whenever a creature with the same name as the exiled card enters - a name the filter does not read) beside its linked exile'],
  // D408 - the alternative cost at cast: the three the selector offered once the alternative line read whose
  // spell body the row maker refused, by reason (the alternative itself reads on every one).
  ['Mind Swords', 'a spell line outside the vocabulary (each player exiles two cards from their hand - a per-player hand exile) beside its alternative cost'],

  // D347 (M6.4gf) - the four sacrifice costs the derived fixture offered and the ENGINE refuses:
  // `predicatesOf` places a colour, a supertype, a card type or a capitalised subtype, and a
  // lowercase word it cannot place refuses the whole cost. The row maker mirrors it now.
  ['Infernal Tribute', 'a sacrifice cost naming a predicate the engine cannot place (a nontoken permanent)'],
  ['Magmaw', 'a sacrifice cost naming a predicate the engine cannot place (a nonland permanent)'],
  ['Malevolent Noble', 'a sacrifice cost whose alternative carries another (an artifact or another creature)'],
  ['Thopter Foundry', 'a sacrifice cost naming a predicate the engine cannot place (a nontoken artifact)'],

  // D354 (M6.4gm) - the nine the tribal-lord scope made offerable that the row maker refuses, by
  // four causes, none of them the scope grammar itself.
  ['Aeronaut Admiral', 'a scoped anthem over a NON-CREATURE subtype (Vehicles) - the static applies to creatures'],
  ['Darling of the Masses', 'a scoped anthem over Citizens - no inert Citizen in the format to prove it on'],
  ['Thelonite Hermit', 'a scoped anthem over Saprolings - no inert Saproling in the format, and a turned-face-up head'],
  ['Attuma, Atlantean Warlord', 'a trigger head outside the library (one or more Merfolk you control attack a player)'],
  ['Pia Nalaar, Consul of Revival', 'a trigger head outside the library (you play a land or cast a spell FROM EXILE)'],

  // D362 (M6.4gu) - the two of D361's thirteen the row maker refuses, each for a COST the
  // engine does not charge rather than a shape the wave chose to skip.
  ['Knight of the Last Breath', 'a sacrifice cost naming a predicate the engine cannot place (another nontoken creature)'],

  // D363 (M6.4gv) - what the remove-counter CHOOSER still refuses, and every one is
  // about a counter KIND the engine cannot represent (`CounterKind` is +1/+1 and
  // -1/-1, D130) rather than about the chooser itself.
  ['Soul Diviner', 'a remove-counter cost naming no KIND and a noun list (an artifact, creature, land, or planeswalker)'],
  ['Ion Storm', 'a remove-counter cost naming a KIND LIST, one of them a charge counter the engine cannot represent'],
  ['Fain, the Broker', 'a remove-counter cost naming no KIND - the engine has +1/+1 and -1/-1 and cannot enumerate the rest'],
  ["O'aka, Traveling Merchant", 'a remove-counter cost naming no KIND, over a predicate the engine cannot place (a nonland permanent)'],
  ['Rift Elemental', 'a remove-counter cost over a TIME counter and a suspended card - two things the engine has neither of'],

  // D370 (M6.4hc) - THE PAYMENT WAVE: of the 157 D369 left offerable, forty landed and these
  // 117 did not, each by the reason the row maker or the candidate probe gave. Fifty-two are a
  // trigger HEAD the row library does not hold and twenty-three a payload outside both readers -
  // generator gaps, not engine ones - and the rest are the payment shapes D369 named as refused:
  // an X price, a computed price, a sentence or a line after the ask (an effect that ASKS must be
  // LAST, D195), a per-item payment, a typed-spell compound clause.
  ['Essence Vortex', 'a computed life payment price'],
  ['Concerted Defense', 'a computed payment price (pays N for each ...)'],
  ['Countervailing Winds', 'a computed payment price (pays N for each ...)'],
  ['Evasive Action', 'a computed payment price (pays N for each ...)'],
  ["Ixidor's Will", 'a computed payment price (pays N for each ...)'],
  ['Oppressive Will', 'a computed payment price (pays N for each ...)'],
  ['Override', 'a computed payment price (pays N for each ...)'],
  ["Rakshasa's Disdain", 'a computed payment price (pays N for each ...)'],
  ['Rune Snag', 'a computed payment price (pays N for each ...)'],
  ['Spell Stutter', 'a computed payment price (pays N for each ...)'],
  ['Spell Syphon', 'a computed payment price (pays N for each ...)'],
  ['Skywise Teachings', 'a payload outside both readers (Pay {1}{U}. If you do, create a 2/2 blue Djin)'],
  ['Eternal Taskmaster', 'a payload outside both readers (Pay {2}{B}. If you do, return target creature)'],
  ['Veinwitch Coven', 'a payload outside both readers (Pay {B}. If you do, return target creature ca)'],
  ["Lifecrafter's Bestiary", 'a payload outside both readers (Pay {G}. If you do, draw a card.)'],
  ['Shu Yun, the Silent Tempest', 'a payload outside both readers (Pay {R/W}{R/W}. If you do, target creature ga)'],
  ['Breeding Pit', 'a payment row beside a second step-head trigger that fires during the walk'],
  ['Cut the Tethers', 'a per-item payment (one question per object)'],
  ['Whirlwind Denial', 'a per-item payment (one question per object)'],
  ['Calculated Dismissal', 'a second line after the payment ask (an effect that asks must be LAST: D195)'],
  ['Reasonable Doubt', 'a second line after the payment ask (an effect that asks must be LAST: D195)'],
  ['Withdraw', 'a second target clause carrying its own payment'],
  ["Don't Make a Sound", 'a sentence after the payment ask (an effect that asks must be LAST: D195)'],
  ['Silumgar Spell-Eater', 'a spell clause under a trigger head: the scaffold casts the opponent`s spell for an activa'],
  ['Illusionary Armor', 'a trigger head outside the row library (When enchanted creature becomes the target of a sp)'],
  ['Treacherous Blessing', 'a trigger head outside the row library (When this enchantment becomes the target of a spel)'],
  ['Krovod Haunch', 'a trigger head outside the row library (When this Equipment is put into a graveyard from t)'],
  ['Endangered Armodon', 'a trigger head outside the row library (When you control a creature with toughness 2 or le)'],
  ['Goblins of the Flarg', 'a trigger head outside the row library (When you control a Dwarf)'],
  ['Covetous Dragon', 'a trigger head outside the row library (When you control no artifacts)'],
  ['Tethered Griffin', 'a trigger head outside the row library (When you control no enchantments)'],
  ['Skeleton Ship', 'a trigger head outside the row library (When you control no Islands)'],
  ['Synod Centurion', 'a trigger head outside the row library (When you control no other artifacts)'],
  ['Emperor Crocodile', 'a trigger head outside the row library (When you control no other creatures)'],
  ['Lurebound Scarecrow', 'a trigger head outside the row library (When you control no permanents of the chosen color)'],
  ['Barbarian Outcast', 'a trigger head outside the row library (When you control no Swamps)'],
  ['City of Traitors', 'a trigger head outside the row library (When you play another land)'],
  ['Jedit Ojanen, Mercenary', 'a trigger head outside the row library (Whenever ~ or another legendary creature you contr)'],
  ['Symmetry Matrix', 'a trigger head outside the row library (Whenever a creature you control with power equal t)'],
  ['Pedantic Learning', 'a trigger head outside the row library (Whenever a land card is put into your graveyard fr)'],
  ['Azorius Aethermage', 'a trigger head outside the row library (Whenever a permanent is returned to your hand)'],
  ['Onyx Talisman', 'a trigger head outside the row library (Whenever a player casts a black spell)'],
  ['Lapis Lazuli Talisman', 'a trigger head outside the row library (Whenever a player casts a blue spell)'],
  ['Malachite Talisman', 'a trigger head outside the row library (Whenever a player casts a green spell)'],
  ['Hematite Talisman', 'a trigger head outside the row library (Whenever a player casts a red spell)'],
  ['Jeweled Torque', 'a trigger head outside the row library (Whenever a player casts a spell of the chosen colo)'],
  ['Nacre Talisman', 'a trigger head outside the row library (Whenever a player casts a white spell)'],
  ['Spirit Cairn', 'a trigger head outside the row library (Whenever a player discards a card)'],
  ['Voracious Tome-Skimmer', "a trigger head outside the row library (Whenever you cast a spell during an opponent's tur)"],
  ['Lunar Mystic', 'a trigger head outside the row library (Whenever you cast an instant spell)'],
  ['Kels, Fight Fixer', 'a trigger head outside the row library (Whenever you sacrifice a creature)'],
  ['Assimilate Essence', 'a typed-spell COMPOUND clause the aim layer does not read'],
  ['Scatter Ray', 'a typed-spell COMPOUND clause the aim layer does not read'],
  ['Spectral Interference', 'a typed-spell COMPOUND clause the aim layer does not read'],
  ['Ghost-Lit Warder', 'ability-word activated: Channel — {3}{U}, Discard this'],
  ['Mindswipe', 'an X payment price (the parser refuses one: D369)'],
  ['Power Sink', 'an X payment price (the parser refuses one: D369)'],
  ['Rethink', 'an X payment price (the parser refuses one: D369)'],
  ['Spell Rupture', 'an X payment price (the parser refuses one: D369)'],
  ["Thassa's Rebuff", 'an X payment price (the parser refuses one: D369)'],
  ['Crystal Shard', 'cost: {T} or {U}'],

  // D371 (M6.4hd) - THE GRANT VOCABULARY: of the 26 the widened reader made offerable, 23
  // landed and these three did not, each for a SCOPE the suite cannot prove rather than a
  // shape the wave skipped.
  ["Rashel, Fist of Torm", 'a grant scoped to AURAS you control - every scope the generator reads is over creatures'],
  ["Righteous War", 'two scoped anthems over different colours: one board cannot carry both proofs'],

  // D372 (M6.4he) - THE GRANTED MANA ABILITY: of the twelve quoted mana grants, eleven landed and
  // this one did not, for a restriction on the MANA rather than for anything about the grant.
  ["Leyline Immersion", 'a granted MANA ability whose amount ("five mana in any combination of colors") the mana parser cannot read - its spend restriction (mana only for spells) is read and enforced since D397'],
  // D374 - THE FILTERED TRIGGER HEAD: of the 224 D373 made offerable the row maker took 60 and
  // refused these 164, each by the reason it gave. Ninety-three are a head the library still does
  // not hold in any base; seventeen are a filtered head whose SUBJECT the closed reader cannot
  // place; ten are a regenerate payload the suite cannot assert yet.
  ['Leashling', 'a cost the engine does not charge'],
  ['Necratog', 'a cost the engine does not charge'],
  ['Nivmagus Elemental', 'a cost the engine does not charge'],
  ['Zombie Scavengers', 'a cost the engine does not charge'],
  ['Angelic Protector', 'a heroic self pump beside the Giant Growth the test casts'],
  ['Retrofitter Foundry', 'a sacrifice cost with no fixture the suite can put'],
  ['Honor-Worn Shaku', 'a tap cost with no fixture the suite can put'],
  ['Mold Folk', 'ability-word activated line'],
  ['Consumptive Goo', 'effect outside the row kinds'],
  ['Trophy Hunter', 'effect outside the row kinds'],
  ['Arena Trickster', 'filtered head: a determiner outside the closed reader'],
  ['Blood Cultist', 'filtered head: an adjective outside the closed reader'],
  ['Brineborn Cutthroat', 'filtered head: an adjective outside the closed reader'],
  ['Colleen Wing, Street Samurai', 'filtered head: an adjective outside the closed reader'],
  ['Decorated Champion', 'filtered head: an adjective outside the closed reader'],
  ['Diamond Knight', 'filtered head: an adjective outside the closed reader'],
  ['Garenbrig Squire', 'filtered head: an adjective outside the closed reader'],
  ['Hawkeye, Bowslinger', 'filtered head: an adjective outside the closed reader'],
  ['Judge Magister Gabranth', 'filtered head: an adjective outside the closed reader'],
  ['Mockingbird, Ace Agent', 'filtered head: an adjective outside the closed reader'],
  ['Predator Ooze', 'filtered head: an adjective outside the closed reader'],
  ['Rising Populace', 'filtered head: an adjective outside the closed reader'],
  ['Sengir Bats', 'filtered head: an adjective outside the closed reader'],
  ['Sengir Vampire', 'filtered head: an adjective outside the closed reader'],
  ['Vampiric Dragon', 'filtered head: an adjective outside the closed reader'],
  ['Wandermare', 'filtered head: an adjective outside the closed reader'],
  ['Witchstalker', 'filtered head: an adjective outside the closed reader'],
  ['Kurgadon', 'filtered head: no fixture satisfies the filter'],
  ['Trial of Solidarity', 'filtered head: no fixture satisfies the filter'],
  ['Trial of Strength', 'filtered head: no fixture satisfies the filter'],
  ['Aerial Doombot', 'neither an activated ability nor a library trigger'],
  ['Brave Brawler', 'neither an activated ability nor a library trigger'],
  ['Kavu Monarch', 'neither an activated ability nor a library trigger'],
  ['Merchant of Truth', 'neither an activated ability nor a library trigger'],
  ['Namora, the Sea Queen', 'neither an activated ability nor a library trigger'],
  ['Serpent Specialist', 'neither an activated ability nor a library trigger'],
  ['She-Hulk, Jade Defender', 'neither an activated ability nor a library trigger'],
  ['Unliving Legionnaire', 'neither an activated ability nor a library trigger'],
  ['Volcanic Villain', 'neither an activated ability nor a library trigger'],
  ['Bakersbane Duo', 'trigger head not in the library'],
  ['Bark-Knuckle Boxer', 'trigger head not in the library'],
  ['Ceaseless Searblades', 'trigger head not in the library'],
  ["Chandra's Pyreling", 'trigger head not in the library'],
  ["Chandra's Spitfire", 'trigger head not in the library'],
  ['Crackdown Construct', 'trigger head not in the library'],
  ['Cryptid Inspector', 'compound trigger head'],
  ['Dimir Spybug', 'trigger head not in the library'],
  ['Dirtcowl Wurm', 'trigger head not in the library'],
  ['Flamespeaker Adept', 'trigger head not in the library'],
  ['Frenzied Raider', 'trigger head not in the library'],
  ['Innocent Bystander', 'trigger head not in the library'],
  ['Junkblade Bruiser', 'trigger head not in the library'],
  ['Kazarov, Sengir Pureblood', 'trigger head not in the library'],
  ['Lightless Evangel', 'a filtered head whose subject names two types with an or'],
  ['Marvel Boy, Noh-Varr', 'compound trigger head'],
  ['Meddling Youths', 'trigger head not in the library'],
  ['Overzealous Muscle', 'trigger head not in the library'],
  ['Paired Tactician', 'trigger head not in the library'],
  ['Pangosaur', 'trigger head not in the library'],
  ['Psychic Frog', 'trigger head not in the library'],
  ['Resolute Veggiesaur', 'trigger head not in the library'],
  ['Search the Premises', 'trigger head not in the library'],
  ['Seasoned Consultant', 'trigger head not in the library'],
  ['Seasoned Warrenguard', 'while-you-control condition on a token'],
  ['Territorial Gorger', 'trigger head not in the library'],
  ['The Thing, Ben Grimm', 'trigger head not in the library'],
  ['Twilight Drover', 'leaves head token subject'],
  ['Ulvenwald Mysteries', 'a sacrifice head whose token the engine cannot spend'],
  ['Wandertale Mentor', 'trigger head not in the library'],
  ['Crystal Seer', 'trigger payload outside both readers'],
  ['Justice, Vance Astrovik', 'trigger payload outside both readers'],
  ['Alms', 'exile-the-top-of-your-graveyard cost'],
  ['Clinging Mists', 'a spell line outside the vocabulary'],
  ['Dawnstrider', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Eiganjo Castle', 'a vocabulary clause the suite has no fixture for: target legendary creature'],
  ['Glacial Crevasses', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Kami of False Hope', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Kitsune Healer', 'a vocabulary clause the suite has no fixture for: target legendary creature'],
  ['Knight-Captain of Eos', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Leery Fogbeast', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Pearl Shard', 'alternative activation cost'],
  ['Spore Frog', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Sunstone', 'a prevention shield with no target (the suite must attack to prove it)'],
  ['Tangle', 'a spell line outside the vocabulary'],

  // D383 (M6.4hp) - the scoped board effect: the cards the seam made offerable that the row
  // maker refused, each with the reason it gave.
  ['Ancestor\'s Chosen', 'a board-sized life gain the suite cannot pin: You gain 1 life for each card in your graveyard.'],
  ['Angel of Renewal', 'a board-sized life gain the suite cannot pin: You gain 1 life for each creature you control.'],
  ['Bhaal\'s Invoker', 'ability-word activated line: Scorching Ray — {8}: ~ deals 4 damage to'],
  ['Blighted Steppe', 'a board-sized life gain the suite cannot pin: You gain 2 life for each creature you control.'],
  ['Dwarven Priest', 'a board-sized life gain the suite cannot pin: You gain 1 life for each creature you control.'],
  ['Intruding Soulrager', 'cost: a sacrifice cost with no fixture the suite can put: Room'],
  ['Iroh, Firebending Instructor', 'a scope read off the live combat (the suite must attack): Attacking creatures get +1/+1 until end of turn.'],
  ['Nova Cleric', 'a scope with no witness the suite can put: Destroy all enchantments.'],
  ['Pianna, Nomad Captain', 'a scope read off the live combat (the suite must attack): Attacking creatures get +1/+1 until end of turn.'],
  ['Sting-Slinger', 'cost: Blight 1'],
  ['Whirling Catapult', 'cost: Exile the top two cards of your library'],
  ['Tegwyll\'s Scouring', 'a spell with a line outside the vocabulary: You may cast this spell as though it had flash by tapping th'],

  // D384 (M6.4hq) - the quoted grant: the cards the classifier widening made offerable that the row
  // maker refused, each with the reason it gave.
  ['Wrench', 'a grant line beside a second line this generator does not emit: Equipped creature gets +1/+1 and has vigilance and | {2}, Sacrifice this Equipme'],
  ['Sticky Fingers', 'a grant line beside a second line this generator does not emit: Enchanted creature has menace and | When enchanted creature dies, draw a card.'],
  ['Deconstruction Hammer', 'a BY-NAME sacrifice cost the engine does not charge: {3}, {T}, Sacrifice Deconstruction Hammer'],
  ['Consecrated by Blood', 'a CHOSEN sacrifice cost the scaffold does not stage: Sacrifice two other creatures'],
  ['Quilled Sliver', 'a combat-role clause the scaffold cannot aim at: target attacking or blocking creature'],
  ['Ninja\'s Kunai', 'a BY-NAME sacrifice cost the engine does not charge: {1}, {T}, Sacrifice Ninja\'s Kunai'],
  ['Leonin Bola', 'an effect the scaffold cannot assert: tap'],
  ['Heartseeker', 'an effect the scaffold cannot assert: destroy'],
  ['Trusty Boomerang', 'an effect the scaffold cannot assert: tap'],

  // D385 (M6.4hr) - the continuous prevention effect (CR 615): the cards the classifier widening made
  // offerable that the row maker refused, each with the reason it gave.
  ['Well-Laid Plans', 'a prevention line outside the grammar: Prevent all damage that would be dealt to a creature by another creature if they'],
  ['Goblin Furrier', 'a recipient no fixture provides: a snow creature'],
  ['Tresserhorn Skyknight', 'a source no fixture provides: a creature with first strike'],
  ['Desert Nomads', 'a source no fixture provides: a Desert that deals damage'],

  // D385 (M6.4hr) - the continuous prevention effect (CR 615): the cards the classifier widening made
  // offerable that the row maker refused, each with the reason it gave.
  ['Demonic Torment', 'a prevention line beside an attached combat restriction on one Aura - the prevention generator carries one def per row and the Aura rows carry the attached static; what the pair needs is ONE generator that emits both (D384\'s two-line shape)'],
  ['Ghostly Possession', 'a prevention line beside an attached keyword grant on one Aura - the prevention generator carries one def per row and the Aura rows carry the attached static; what the pair needs is ONE generator that emits both (D384\'s two-line shape)'],
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
    // D289 refilled this pool with 22 cards the ledger never saw; D290 landed
    // 18 of them and ledgered the other 4, so it is empty again — and a
    // non-empty pool from here means either a new seam paid out or a ledger
    // entry went stale.
    // D295 landed or ledgered all 137 D294 offerables - and the 29 its own four
    // sentences made offerable in turn. The pool is measured at zero.
    // ⚠️ D357 - NON-ZERO ON PURPOSE. The library search widened what a script can express, so
    // the offer stream refilled with 84 cards whose search line now reads and whose remaining
    // work is a row: the fetchlands, Evolving Wilds, Sakura-Tribe Elder, Wood Elves and their
    // kin. They are OFFERED, not refused, so they belong here and not in the ledger - the
    // D289/D291 shape, where a seam leaves its wave to the decision after it.
    // ⚠️ D358 landed 69 of D357's 84 and ledgered the other fifteen by name, so the pool is
    // back to zero - the shape every wave decision ends in.
    // ⚠️ D360 - BACK TO ZERO, and that is what a WAVE does. D359 was a SEAM and left 95 cards
    // offerable on purpose; this decision rowed 78 of them and ledgered the other seventeen by
    // name, each with the reason the row maker gave. The tell that the two kinds are the right
    // way round is the SCRIPTABLE number: a seam raises it (1,050 -> 1,145) because a sentence
    // the vocabulary can read is a card a row can take, and a wave lowers it (1,145 -> 1,067)
    // because a card a row has taken is one no row can take again.
    // ⚠️ D361 - NON-ZERO ON PURPOSE, and the scriptable number says so again: this is a
    // SEAM (1,067 -> 1,080). Seven keywords joined the native trigger table, which landed
    // the 31 cards whose ONLY remaining piece was the keyword line and left THIRTEEN more
    // whose keyword line now reads and whose other line is an ordinary row - Burr Grafter,
    // Eternal of Harsh Truths, Frontline Devastator, Hopeful Initiate, Knight of the Last
    // Breath, Marchesa's Infiltrator, Merciless Eternal, Pus Kami, Rural Recruit, Scuttling
    // Death, Sludge Crawler, Torens Fist of the Angels, Seraph of the Scales. They are
    // OFFERED rather than refused, so they belong here and not in the ledger.
    // ⚠️ D362 - BACK TO ZERO, and that is what a WAVE does. It rowed ELEVEN of D361's
    // thirteen and ledgered the other two by name, each for a COST the engine does not
    // charge. The tell that the two kinds are the right way round is the SCRIPTABLE
    // number again: D361 the seam RAISED it 1,067 -> 1,080, and this wave LOWERS it
    // 1,080 -> 1,069.
    // ⚠️ D363 - ZERO again, and this decision is BOTH shapes at once: the chooser is a
    // SEAM (it makes a cost chargeable) and its own rows are the WAVE (they take the
    // cards that cost was blocking). The scriptable number falls 1,069 -> 1,063
    // because the wave outweighs the seam.
    // D369 - the payment prompt made 157 cards OFFERABLE (their pay line reads; the rest is a row): the seam leaves its wave to the decision after it (D289, D357).
    // D372 - ZERO still: the granted MANA ability landed its eleven BY NAME (the classifier never
    // offered a quoted grant, and does not now), so the pool neither filled nor drained.
    // D371 - ZERO again, and this decision is BOTH shapes at once (D363): the reader widening is a
    // SEAM (26 cards it had never offered) and its own rows are the WAVE (23 of them).
    // D370 - BACK TO ZERO, and that is what a WAVE does: forty landed and the other 117 are in the
    // ledger above by name, each with the reason the row maker or the probe gave.
    // D374 - BACK TO ZERO, and that is what a WAVE does. D373's self-aimed subject made 224
    // printed permanents offerable; the FILTERED TRIGGER HEAD (a head the library does not hold,
    // read as a BASE head plus a filter on its subject) rowed 60 of them, and the other 164 are
    // in the ledger above by name. The tell is the scriptable number, the other way this time:
    // a seam RAISES it and a wave LOWERS it, 1,393 -> 1,333.
    // D382 - BACK TO ZERO, and that is what a WAVE does: the PREVENTION SHIELD (CR 615) made 50
    // cards offerable, 35 landed as rows and the other 15 are in the ledger above by name, each
    // with the reason the row maker gave. The tell is the scriptable number the other way:
    // a seam RAISES it (1,263 -> 1,313) and a wave LOWERS it.
    // D384 - BACK TO ZERO again, and BOTH shapes in one decision (D363): the classifier learning
    // to READ A QUOTED GRANT is the SEAM - it made 24 cards offerable where the pool had been
    // empty, because `scrub` blanks a quoted body and every reader in `primitiveFor` was looking
    // at the blank - and the five rows that landed are the WAVE. The other 19 are in the ledger
    // above by name, each with the reason the row maker or the generator gave.
    // D383 - BACK TO ZERO, which is what a WAVE does: the SCOPED BOARD EFFECT made 39 cards
    // offerable, 27 landed as rows and the other 12 are in the ledger above by name, each with
    // the reason the row maker gave. ⚠️ And the ledger corrected ITSELF on the same sweep:
    // SEVENTEEN rows held under `a spell line outside the vocabulary` since D306/D307 were named
    // STALE by the guard below, because the seam reads their bodies and they now run with no
    // script at all. The tell is the scriptable number, which a seam RAISES and a wave LOWERS.
    // D385 - BACK TO ZERO, BOTH shapes in one decision again (D363): the classifier reading a
    // CONTINUOUS prevention line is the SEAM (scriptableToday 1,290 -> 1,321 before the wave), the 26
    // rows are the WAVE (-> 1,295), and the six that stay are in the ledger above by name - four the
    // row maker refused for a fixture it cannot stage, two a prevention line beside an attached static.
    // D536 - DOWN BY SEVEN, which is what a seam does when it COMPLETES cards the select was offering: the Cascade line
    // left the spell text and seven cascade SPELLS (Deny Reality, Violent Outburst, Forceful Denial, Bituminous Blast,
    // Natural Reclamation, Demonic Dread, Captured Sunlight) run with no script at all; the one storm spell the seam made
    // offerable (Galvanic Relay) is in the ledger above by name.
    expect.soft(all.length).toBe(18);
    // Everything emitted needs a script and nothing else — the property the
    // whole pipeline downstream depends on.
    expect.soft(all.every((c) => c.lines > 0)).toBe(true);
  }, 600_000);

  test('the ordering puts the user’s own cards first', () => {
    const rungs = all.map((c) => c.rung);
    expect.soft([...rungs].sort((a, b) => a - b)).toEqual(rungs);
  });

  test('the REFUSED ledger holds only cards still waiting on their named gap', () => {
    // A name here means: delete that ledger entry — its class was built.
    expect.soft(staleRefusals).toEqual([]);
    // And nothing refused leaks into the ranking.
    const offered = new Set(all.map((c) => c.name));
    for (const name of REFUSED.keys()) expect.soft(offered.has(name)).toBe(false);
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
    expect.soft(existsSync(EMIT)).toBe(true);
  });
});

/** ⚠️ Loud, so a machine with no card database cannot look like a passing run. */
describe.skipIf(HAVE_DB)('the next batch to script', () => {
  test('SKIPPED — no card database', () => {
    // eslint-disable-next-line no-console
    console.warn(`No card database at ${NDJSON}. Run: node electron/cardsvc-worker.cjs --sync`);
    expect.soft(HAVE_DB).toBe(false);
  });
});
