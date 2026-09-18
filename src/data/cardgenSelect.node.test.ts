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
  ['Axgard Artisan', 'once-per-turn trigger memory'],
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
  ["Lullmage's Familiar", 'kicker memory'],
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
  ['Sage of the Falls', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature or another non-Human creature you control enters'],
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
  ['Screeching Sliver', "a quoted ability grant (the granted mill is not the card's own line): All Slivers have \"{T}: Target player mills a card.\""],
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
  ['Dwarven Patrol', 'a filtered head outside the closed reader (a negated type outside the list: nonred): Whenever you cast a nonred spell, untap this creature.'],
  ['Fear of Infinity', 'trigger head not in the library: Whenever an enchantment you control enters and whenever you fully unlo'],
  ['Goblin Dirigible', 'a payment branch the suite cannot assert: untap'],
  ['Goblin War Wagon', 'a payment branch the suite cannot assert: untap'],
  ['Immobilizing Ink', 'a leftover line not among the printed lines: Enchanted creature has'],
  ['Park Heights Maverick', 'a filtered head outside the closed reader (an adjective outside the list: this): Whenever this creature deals combat damage to a player or di'],
  ['Plumes of Peace', 'ability-word activated line: Forecast — {W}{U}, Reveal this card from'],
  ['Rot Farm Skeleton', 'cost: Mill four cards'],
  ['Sinking Feeling', 'a leftover line not among the printed lines: Enchanted creature has'],
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
  ['Whispering Snitch', 'trigger head not in the library: Whenever you surveil for the first time each turn, this creature deals'],
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
  ['Snow Day', "a spell with a line outside the vocabulary: Tap up to two target creatures. Those creatures don't untap "],
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
  ["Crypt Sliver", "a quoted Sliver grant with a tribal target (the grant vocabulary reads no subtype target) (D479)"],
  ["Magma Sliver", "a quoted Sliver grant with a tribal target and an X pump (the grant vocabulary reads no subtype target) (D479)"],
  ["Poultice Sliver", "a quoted Sliver grant with a tribal target (the grant vocabulary reads no subtype target) (D479)"],
  ["Firewake Sliver", "a quoted Sliver grant with a tribal target and a sacrifice price (the grant vocabulary reads no subtype target) (D479)"],
  ["Thraben Exorcism", "an instant whose target list carries a keyword-qualified alternative (creature with disturb) - a hand SpellDef (D479)"],
  ["Tivadar of Thorn", "a filtered head no fixture satisfies (Tivadar) (D479)"],
  ["Attended Healer", "trigger head not in the library: Whenever you gain life for the first time each turn (D479)"],
  ["Balthor the Stout", "a tribal anthem outside the static vocabulary (Other Barbarian creatures get +1/+1) beside its tribal pump (D479)"],
  ["Private Eye", "a tribal anthem outside the static vocabulary (Other Detectives you control get +1/+1) (D479)"],
  ["Inside Source", "a token outside TOKEN_TABLE (the 2/2 white and blue Detective) (D479)"],
  ["Phylath, World Sculptor", "a counted noun with a supertype (a Plant token for each basic land you control) (D479)"],
  ['Curiosity', 'trigger head not in the library: Whenever enchanted creature deals damage to an opponent, you may draw '],
  ['Curious Cadaver', 'a sacrifice head no fixture the suite can sacrifice satisfies: a Clue'],
  ['Deathless Ancient', 'a graveyard return beside another cost piece'],
  ['Deathless Behemoth', 'cost: a sacrifice cost with no fixture the suite can put: Eldrazi Scions'],
  ['Deathless Knight', 'trigger head not in the library: When you gain life for the first time each turn, return this card from'],
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
  ['Commence the Endgame', 'a spell line outside the vocabulary (draw two, then amass Zombies X - the amass mechanic) beside its uncounterable line'],
  ['Fry', 'a spell line outside the vocabulary (5 damage to target creature or planeswalker that is white or blue - a colour qualifier on the target) beside its uncounterable line'],
  ['Martyr of Frost', 'an activated cost outside the reader (Reveal X blue cards from your hand)'],
  ['Obliterate', 'a spell line outside the vocabulary (destroy all artifacts, creatures, and lands - a three-type sweep that cannot be regenerated) beside its uncounterable line'],
  ['Raze to the Ground', 'a spell line outside the vocabulary (destroy target artifact, then draw if its mana value was 1 or less - a conditional draw on the destroyed card) beside its uncounterable line'],
  ['Thought Distortion', 'a spell line outside the vocabulary (reveal a hand, exile all noncreature nonland cards from hand and graveyard) beside its uncounterable line'],
  ['Wreak Havoc', 'a spell line outside the vocabulary (destroy target artifact or land) beside its uncounterable line'],
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
  ["Sorcerer's Broom", 'a payment under a sacrifice head whose fire funds the price (the lands the suite reads are not the ones spent) (D485)'],
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
  // D494 - the previous clause objects: the rows the select offered and the row maker refused, by its own reasons (the generated suite does not assert the new kinds yet).
  ['Apprentice Necromancer', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Balduvian Atrocity', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Balduvian Dead', 'a vocabulary effect the suite cannot assert: sacrificeObj (D494)'],
  ['Bloodsky Berserker', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Cogwork Assembler', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Deathknell Kami', 'a vocabulary effect the suite cannot assert: sacrificeObj (D494)'],
  ['Dragon Mask', 'a vocabulary effect the suite cannot assert: bounceObj (D494)'],
  ['Fearless Fledgling', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Felhide Spiritbinder', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Flickerwisp', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Galepowder Mage', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Glimmerpoint Stag', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Harried Dronesmith', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Kami of Industry', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Kiki-Jiki, Mirror Breaker', 'a vocabulary effect the suite cannot assert: sacrificeObj (D494)'],
  ['Lowland Oaf', 'a vocabulary effect the suite cannot assert: sacrificeObj (D494)'],
  ['Mistmeadow Vanisher', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Mistmeadow Witch', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Mogg Cannon', 'a vocabulary effect the suite cannot assert: destroyObj (D494)'],
  ['Mushroom Watchdogs', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Pacesetter Paragon', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Roon of the Hidden Realm', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['S.H.I.E.L.D. Flying Car', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Skybind', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Skyskipper Duo', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Splinter Twin', 'a quoted grant the suite cannot prove: a vocabulary effect the suite cannot assert: exileObj (D494)'],
  ['Stormsplitter', 'a vocabulary effect the suite cannot assert: exileObj (D494)'],
  ['Syndicate Trafficker', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Tempestra, Dame of Games', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Undercity Necrolisk', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ["Vito's Inquisitor", 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Wiccan, Rising Magician', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Angel of Condemnation', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Benthicore', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Dawn of the Dead', 'a vocabulary effect the suite cannot assert: exileObj (D494)'],
  ['Krovikan Elementalist', 'a vocabulary effect the suite cannot assert: sacrificeObj (D494)'],
  ['Mardu Monument', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Nemesis Trap', 'a spell with a line outside the vocabulary: Exile target attacking creature. Create a token that is a copy (D494)'],
  ['Orthion, Hero of Lavabrink', 'a vocabulary effect the suite cannot assert: grantObj (D494)'],
  ['Rakdos Guildmage', 'a vocabulary effect the suite cannot assert: exileObj (D494)'],
  ['The Fire Crystal', 'a vocabulary effect the suite cannot assert: sacrificeObj (D494)'],
  ['Touch the Spirit Realm', 'a vocabulary effect the suite cannot assert: returnObj (D494)'],
  ['Zektar Shrine Expedition', 'trigger payload not a pump: Put a quest counter on this enchantment. (D494)'],
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
  ['Seedglaive Mentor', 'trigger head not in the library (Whenever this creature becomes the target of a spell or ability you co)'],
  ['Shaleskin Bruiser', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +3/+0 until end of turn for each other attacking Beast.)'],
  ['Siegehorn Ceratops', 'a self payload on a creature the test damage kills (toughness 2)'],
  ['Spider-Mobile', 'trigger head not in the library (Whenever this Vehicle attacks or blocks, it gets +1/+1 until end of tu)'],
  ['Task Force', 'a heroic self pump beside the Giant Growth the test casts'],
  ['Teapot Slinger', 'trigger head not in the library (Whenever you expend 4, this creature deals 2 damage to each opponent.)'],
  ['Thrashing Frontliner', 'trigger head not in the library (Whenever this creature attacks a battle, it gets +1/+1 until end of tu)'],
  ['Thundering Sparkmage', 'a counted noun the suite cannot stage (party) (~ deals X damage to target creature or planeswalker, where X is the number of creatures...)'],
  ['Veteran Guardmouse', 'trigger head not in the library (Whenever this creature becomes the target of a spell or ability you co)'],
  ['Vile Deacon', 'a counted payload under a head whose arm sizes the board (attacks) (~ gets +X/+X until end of turn, where X is the number of Clerics on the battlefield.)'],
  ['Zephyr Spirit', "trigger head not in the library (When this creature blocks, return it to its owner's hand.)"],
  ['Additive Evolution', 'trigger payload not a pump (Create a 0/0 green and blue Fractal creature token. Put thre)'],
  ['Alpine Houndmaster', 'trigger payload not a pump (Search your library for a card named Alpine Watchdog and/or)'],
  ['Aurochs Herd', 'trigger payload not a pump (Search your library for an Aurochs card, reveal it, put it i)'],
  ['Bloodcrazed Hoplite', 'trigger head not in the library (Whenever a +1/+1 counter is put on this creature, remove a +1/+1 count)'],
  ['Dreadhorde Butcher', 'trigger head not in the library (Whenever this creature deals combat damage to a player or planeswalker)'],
  ['Duskworker', 'trigger payload not a pump (Regenerate it.)'],
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
  ['Emberheart Challenger', 'a trigger head outside the library (Valiant - becomes the target of a spell or ability you control for the first time each turn)'],
  ['Entity Tracker', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Erratic Apparition', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Forlorn Pseudamma', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['General Thunderbolt Ross', 'a scope read off the live combat (attacking creatures get +1/+0 - the suite must attack) under its Battalion head'],
  ['God-Favored General', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['Gremlin Tamer', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Kazandu Mammoth // Kazandu Valley', 'a modal double-faced layout beside its Landfall line'],
  ['Kraul Foragers', 'a board-sized life gain the suite cannot pin (for each creature card in your graveyard) under its Undergrowth head'],
  ['Mouse Trapper', 'a trigger head outside the library (Valiant - becomes the target of a spell or ability you control for the first time each turn)'],
  ['Optimistic Scavenger', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Pheres-Band Raiders', 'a payment branch the suite cannot assert (a token) under its Inspired head'],
  ['Poised Practitioner', 'a trigger payload outside both readers (a counter on this creature, then scry 1) under its Flurry head'],
  ['Radha, Coalition Warlord', 'a counted payload under a becomes-tapped head (the arm sizes the board) under its Domain head'],
  ['Skullsnap Nuisance', 'a trigger head outside the library (Eerie - whenever an enchantment you control enters and whenever you fully unlock a Room)'],
  ['Strength from the Fallen', 'a counted payload under a constellation head (the arm sizes the board)'],
  ['Whiskerquill Scribe', 'a trigger head outside the library (Valiant - becomes the target of a spell or ability you control for the first time each turn)'],
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
  ['Capricious Sliver', 'a leftover line not among the printed lines (a Sliver static the probe split) beside its permission line'],
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
  ['The Torment of Gollum', 'a hand reveal followed by a second sentence (amass Orcs 2) - the ask must be last (the prompt CONTINUATION seam)'],
  ['Toll of the Invasion', 'a hand reveal followed by a second sentence (amass Zombies 1) - the ask must be last (the prompt CONTINUATION seam)'],
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
  ['Birthday Escape', 'the Ring mechanic'],
  ['Blatant Thievery', 'cast-time computed target count'],
  ['Blazing Hope', 'computed target threshold'],
  ['Bleeding Edge', 'amass mechanic'],
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
  ['Bounty of Skemfar', 'script-raised prompt'],
  ['Brainsurge', 'script-raised prompt'],
  ['Brawl', 'temporary keyword/ability grant'],
  ['Breaking of the Fellowship', 'the Ring mechanic'],
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
  ['Claim the Precious', 'the Ring mechanic'],
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
  ['Decision Paralysis', 'up-to-N targeting'],
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
  ['Fold into Aether', 'opponent-chooses'],
  ['Foray of Orcs', 'amass mechanic'],
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
  ['Gravkill', 'subtype list alternative'],
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
  ['Lash Out', 'clash mechanic'],
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
  ['Pinion Feast', 'bolster tie choice'],
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
  ["Ranger's Firebrand", 'the Ring mechanic'],
  ["Rats' Feast", 'cast-time computed target count'],
  // D238 (M6.4ca)
  ['Ray of Ruin', 'subtype list alternative'],
  ['Reach of Shadows', 'color target qualifier unenforced'],
  ['Reality Ripple', 'phasing'],
  ['Reality Shift', 'face-down (morph family)'],
  ['Recross the Paths', 'clash mechanic'],
  ['Regenerate', 'its own name is its verb: selfRef spells the name ~ before any rule runs, so the sentence arrives as ~ target creature (D373)'],
  ['Reign of Terror', 'script-raised prompt'],
  ['Release the Ants', 'clash mechanic'],
  ['Relentless Advance', 'amass mechanic'],
  // D239 (M6.4cb)
  ['Relentless Pursuit', 'script-raised prompt'],
  ["Relic's Roar", 'until-end-of-turn base P/T set'],
  ['Reminisce', 'ctx.random'],
  ['Repel Calamity', 'spell target parse (numeric disjunction)'],
  ['Research the Deep', 'clash mechanic'],
  ['Resolute Strike', 'script-raised prompt'],
  ['Restore', 'spell target parse (graveyard noun)'],
  ['Retraced Image', 'script-raised prompt'],
  // D240 (M6.4cc)
  ['Return to Dust', 'up-to-N targeting'],
  ['Reviving Vapors', 'script-raised prompt'],
  ['Rewind', 'up-to-N targeting'],
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
  ['Slip On the Ring', 'the Ring mechanic'],
  ['Snap', 'up-to-N targeting'],
  ['Soul Diviner', 'remove-counter cost'],
  ['Soul Sear', 'temporary keyword/ability grant'],
  // D250 (M6.4cm)
  ['Soul Summons', 'face-down (morph family)'],
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
  ['Spring Cleaning', 'clash mechanic'],
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
  ['Sudden Storm', 'up-to-N targeting'],
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
  ['The Black Breath', 'the Ring'],
  ['The Lost and the Damned', 'cast-zone discriminator'],

  // D259 (M6.4cv) — ONE new class, found by a PROBE rather than by a test.
  // 'target nonland permanent' parses CONFIDENT to kinds:['permanent'] with
  // unenforced:['nonland'] — the negated type is DISCLOSED rather than
  // dropped, but disclosed is exactly what D161 refuses: the aim would let a
  // LAND be untapped by a card that forbids it (Angelic Page, verbatim).
  // Befoul holds the negated-COLOUR direction (D199) and Devout Decree the
  // positive colour one (D208); nobody had probed a negated TYPE.
  ['The Ring Goes South', 'the Ring'],
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
  ['Time Reversal', 'ctx.random stub'],
  ['Time Spiral', 'ctx.random stub'],
  ['Time Stop', 'end the turn'],
  // NEW: no turn-insertion machinery exists anywhere — `turn.ts` walks one
  // turn at a time and nothing can splice another in after it.
  ['Time Stretch', 'extra turns'],
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
  ['Vanguard Seraph', 'once-per-turn memory'],
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
  ['Widespread Brutality', 'amass mechanic'],
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
  ['Fire Nation Occupation', 'firebending mechanic'],
  ['Flamewright', 'keyword-predicate sacrifice cost'],
  ['Foil', 'cast-time alternative cost'],
  ['Force of Vigor', 'cast-time alternative cost'],
  ['Fowl Strike', 'hand-activated ability'],
  ['Garbage Fire', 'draft-matters'],
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
  ['Mordor Muster', 'amass mechanic'],
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
  ["Saruman's Trickery", 'amass mechanic'],
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
  ['Swarming of Moria', 'amass mechanic'],
  ['Sylvan Bounty', 'cycling mechanic'],
  ['Thunderblade Charge', 'free-cast permission'],
  ['Tidal Bore', 'cast-time alternative cost'],
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
  ['Enduring Victory', 'bolster tie choice'],
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
  ['Callous Dismissal', 'amass mechanic'],
  ['Soothing of Sméagol', 'the Ring mechanic'],
  ['Radiant Purge', 'list with adjective alternative'],
  ["Liliana's Defeat", 'list with adjective alternative'],
  ['Ohran Yeti', 'snow activation cost'],
  ['Null Brooch', 'discard-hand cost'],
  ['Unexplained Absence', 'cloak mechanic'],
  ['Unnerving Grasp', 'manifest dread mechanic'],
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
  ['Unwind', 'script-raised prompt'],
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
  ['Brand', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Essence Fracture', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Floodwaters', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Frostveil Ambush', 'a spell line outside the vocabulary (its cycling runs)'],

  ['Pest Control', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Rapid Decay', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Scarab Feast', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Spectacular Pileup', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Startling Development', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Trip Up', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Valiant Rescuer', 'trigger head outside the library (whenever you cycle another card for the first ti)'],
  ['Violent Impact', 'a spell line outside the vocabulary (its cycling runs)'],
  ['Volcanic Submersion', 'a spell line outside the vocabulary (its cycling runs)'],
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
  ['Echo of Eons', 'a spell line outside the vocabulary (its flashback runs)'],
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
  ['Seize the Day', 'a spell line outside the vocabulary (its flashback runs)'],
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
  ['Unnatural Endurance', 'a spell line outside the vocabulary (its devoid runs)'],
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
  ['Blinkmoth Infusion', 'a spell line outside the vocabulary (its reduction is priced)'],
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
  ['Mindlash Sliver', 'a quoted grant of a queued discard (All Slivers have ...) - the grant generator, not the mainline row maker'],
  ['Merchant of Venom', 'a sacrifice-EVENT head (whenever a player sacrifices a permanent) the library does not hold - CardMove.reason (D377) makes it expressible'],
  ['Failed Conversion', 'an attached static whose toughness pump kills the 2/2 Bears the suite enchants'],
  // D391 - proliferate: the four the selector offered after the wave that the row maker refused, by reason.
  ['Grateful Apparition', 'trigger head not in the library (combat damage to a player OR a planeswalker - the two-noun connect head)'],
  ['Guildpact Informant', 'trigger head not in the library (combat damage to a player OR a planeswalker - the two-noun connect head)'],
  ["Norn's Choirmaster", 'trigger head not in the library (a commander you control enters or attacks)'],
  // D392 - the referent subject: the three the selector offered after the wave that the row maker refused, by reason.
  ['Haunted Hellride', 'an attack head on a card with no creature body (an Aura that says whenever you attack)'],
  // D393 - threaten: the four the selector offered after the seam that the row maker refused, by reason.
  ['Chamber of Manipulation', 'a quoted grant of a threaten (Enchanted land has ...) - the grant generator, not the mainline row maker'],
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
  ['Will of the Naga', 'a spell line outside the row vocabulary beside its delve (tap up to two, then a skip-untap rider)'],
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
  ['Honor the God-Pharaoh', 'a spell line outside the row vocabulary beside its discard cost (draw two, amass Zombies 1)'],
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
  ['Ritual of the Machine', 'a spell line outside the row vocabulary beside its sacrifice cost (gain control of target nonartifact, nonblack creature - a permanent control change)'],
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
  ['Crush Dissent', 'a second line after the payment ask (an effect that asks must be LAST: D195)'],
  ['Reasonable Doubt', 'a second line after the payment ask (an effect that asks must be LAST: D195)'],
  ['Withdraw', 'a second target clause carrying its own payment'],
  ["Don't Make a Sound", 'a sentence after the payment ask (an effect that asks must be LAST: D195)'],
  ["Sage's Dousing", 'a sentence after the payment ask (an effect that asks must be LAST: D195)'],
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
  ['Dwarven Soldier', 'blocks-by predicate outside the vocabulary'],
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
  ["Cleric of Life's Bond", 'trigger head not in the library'],
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
  ['Vengeful Warchief', 'trigger head not in the library'],
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
  ['Compulsory Rest', 'a grant line beside a second line this generator does not emit: Enchanted creature can\'t attack or block. | Enchanted creature has'],
  ['Sticky Fingers', 'a grant line beside a second line this generator does not emit: Enchanted creature has menace and | When enchanted creature dies, draw a card.'],
  ['Dormant Sliver', 'a grant line beside a second line this generator does not emit: All Sliver creatures have defender. | All Slivers have'],
  ['Deconstruction Hammer', 'a BY-NAME sacrifice cost the engine does not charge: {3}, {T}, Sacrifice Deconstruction Hammer'],
  ['Lunarch Mantle', 'a CHOSEN sacrifice cost the scaffold does not stage: {1}, Sacrifice a permanent'],
  ['Harmonic Sliver', 'a head outside the library: When this permanent enters'],
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
    expect.soft(all.length).toBe(0);
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
