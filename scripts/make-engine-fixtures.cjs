#!/usr/bin/env node
// Regenerate `src/data/fixtures/engineCards.ts` from the real card database.
//
// ⚠️ GENERATED, not hand-written, and that is the point. D15b established the
// rule the hard way: the validator's rules key off EXACT wording ("A deck can
// have up to nine cards named"), so a paraphrased fixture tests the fixture
// rather than the card, and keeps passing forever after Scryfall rewords
// something. The engine has the same exposure — `parseManaProduction` reads
// oracle text, and Tundra's text being literally `({T}: Add {W} or {U}.)`
// changed the parser's design.
//
// So: every fixture here is a verbatim `CardData` record, copied byte for byte
// out of ~/.commanders-roundtable/cards/cards.ndjson, and
// `src/data/fixtures/engineCards.node.test.ts` re-reads every one of them from
// that same file and asserts the committed record is still byte-identical —
// naming the card and the field that moved when it is not.
//
// ⚠️ This comment, and the header written below, used to say
// `scripts/battery-carddb.cjs` did that cross-check. IT DID NOT, and never named
// this file: that battery's "Validator assumptions" section is D15b's guard for
// `src/data/validate.test.ts`'s hand-written fixtures, and its 15 checks overlap
// these records at four cards. Everything the engine tests, the net tests and
// the fuzz gate build on was unguarded until 2026-07-29 (D123).
//
// Regenerate with:
//
//     node scripts/make-engine-fixtures.cjs
//
// Requires a synced card database. The generated file is committed, so tests
// run on a machine that has never synced.

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { dataRoot } = require('../electron/paths.cjs');

/**
 * name → optional { set, cn } to pin a printing.
 *
 * Pinning matters only where printings differ in a way the engine can see;
 * everything else takes the first printing encountered, which is stable because
 * the NDJSON order is stable.
 */
const WANTED = [
  // basics + lands
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Forest',
  'Command Tower', 'Tundra', 'Ancient Tomb', 'Boros Garrison', 'Gemstone Mine',
  'Reflecting Pool', 'Exotic Orchard', 'Cavern of Souls', 'Bojuka Bog',
  // artifacts
  'Sol Ring', 'Arcane Signet', 'Mox Diamond', 'Lightning Greaves', 'Darksteel Myr',
  // mana creatures
  'Llanowar Elves', 'Birds of Paradise', 'Bloom Tender',
  // keyword creatures — one per Tier-2 keyword the combat matrix exercises
  'Grizzly Bears', 'Scathe Zombies', 'Silvercoat Lion',
  'Air Elemental', 'Serra Angel', 'Giant Spider', 'Colossal Dreadmaw',
  'Vampire Nighthawk', 'Typhoid Rats', 'White Knight', 'Boros Swiftblade',
  'Boggart Brute', 'Wall of Omens', 'Scaled Behemoth', 'Kor Firewalker',
  'Raging Goblin', 'Child of Night', 'Bull Hippo', 'Ambush Viper',
  'Baleful Strix', 'Tarmogoyf', 'Spearbreaker Behemoth',
  // M5's Tier-2 promotions (D68): infect, wither, toxic and a life ward.
  // Flensermite is the important one — infect AND lifelink on one body is the
  // whole of CR 702.90b, which says life gain keys off the damage being DEALT
  // and not off how it was applied.
  'Priests of Norn', 'Rot Wolf', 'Flensermite',
  'Twinblade Slasher', 'Tyrranax Rex', 'Bloated Contaminator',
  'Sedgemoor Witch',
  // odd shapes the parser has to survive
  'Delver of Secrets // Insectile Aberration', 'Figure of Destiny',
  'Gitaxian Probe', 'Fire // Ice', 'Wear // Tear', 'Shorikai, Genesis Engine',
  // spells
  'Lightning Bolt', 'Counterspell', 'Cultivate', 'Swords to Plowshares',
  'Pacifism', 'Wrath of God', 'Brainstorm', 'Dark Ritual',
  // commanders
  'Kess, Dissident Mage', 'Krenko, Mob Boss', 'Talrand, Sky Summoner',
  'Yeva, Nature\'s Herald', 'Thrasios, Triton Hero', 'Tymna the Weaver',
  'Grist, the Hunger Tide', 'Avacyn, Angel of Hope',
  // The two permanent types that enter with counters on them (CR 306.5b/310.6).
  // Grist above is the planeswalker; this is the only battle in the fixtures,
  // and without it the defense half of that rule has nothing to test against.
  'Invasion of Gobakhan // Lightshield Array',
  // Permanents that BECOME a planeswalker (D108). One card per measured branch
  // of that rule, and none of the three is interchangeable with another:
  //   · Jace is the plain case — a creature front, a planeswalker back, printed
  //     loyalty 5. It is also the only one of the three that is CHEAP ({1}{U}),
  //     which is what lets the fuzzer afford it.
  //   · Arlinn is a planeswalker on BOTH faces, and her back face is one of the
  //     only two planeswalker faces in the database with no printed loyalty at
  //     all. She is the card that makes "was it already a planeswalker" and "a
  //     null loyalty adds nothing" load-bearing rather than asserted.
  //   · Invasion of New Phyrexia is the only one of the 14 whose front face
  //     already carries counters — a Siege with defense 6 that becomes a
  //     planeswalker with loyalty 4 — so it is the only way to test that the
  //     counters of the OTHER kind are left where they are.
  "Jace, Vryn's Prodigy // Jace, Telepath Unbound",
  'Arlinn Kord // Arlinn, Embraced by the Moon',
  'Invasion of New Phyrexia // Teferi Akosa of Zhalfir',
  // M6.1 — card SHAPES the bot's curated deck introduced that nothing here had.
  // Not "some cards from the bot deck": the deck is 99 cards and most of them
  // are shapes already covered (a vanilla body, a basic, a mana rock). These
  // four are the ones the fuzz gate genuinely could not reach before.
  //   · Dryad Arbor is a LAND CREATURE — summoning-sick, tappable for mana, and
  //     a creature for every rule that reads the battlefield. Nothing else here
  //     is both.
  //   · Darksteel Citadel is an ARTIFACT land, which is two permanent types on
  //     one card in a way `Tree of Tales` and friends make common in the pool.
  //   · Monstrous Growth is a PUMP spell, and pump is one of the 11 effect kinds
  //     `effectParse` reads. The pool has 148 executable instants and the fuzz
  //     deck had damage, counter, exile and destroy — not this one.
  //   · Akroma is six enforced keywords plus protection from two colours on one
  //     body, which is the densest Tier-2 combat object in the format.
  'Dryad Arbor',
  'Darksteel Citadel',
  'Monstrous Growth',
  'Akroma, Angel of Wrath',
  // M6.3 — the first card in these fixtures that exists for a "MAY" TRIGGER
  // (D128). `Ajani's Mantra` is `{1}{W}` and its WHOLE printed text is "At the
  // beginning of your upkeep, you may gain 1 life." — so a script for it runs
  // every word of the card (D90) rather than most of one, which is what makes
  // it a fair proof that the primitive works rather than a fixture shaped to fit
  // it. Chosen over the other 275 single-sentence "may" cards for three measured
  // reasons: the effect is inside `effectParse`'s existing vocabulary, so no
  // second primitive is needed to demonstrate this one; the trigger keys on
  // `StepBegan`, which fires twelve times a turn instead of on every
  // `CardsMoved`, so the fuzz gate's trigger bus stays cheap; and it is bounded
  // at once per upkeep per copy, so a 4-seat game cannot drown in prompts.
  // It is also an ENCHANTMENT — the type D121 measured the engine running
  // exactly ZERO of.
  "Ajani's Mantra",
  // M6.3 — the CR 613.7 TIMESTAMP PAIR (D129), and the two cards that make
  // layer 6 observable. `Levitation` grants flying to your creatures,
  // `Gravity Sphere` takes it off everyone's, both in layer 6 — so which one
  // entered the battlefield LAST is the whole answer, and neither card can
  // demonstrate that alone. Both are single-sentence, so a script for either
  // runs every word of it (D90).
  // ⚠️ `Gravity Sphere` is a WORLD enchantment and this engine has no world rule
  // (CR 704.5m) — a pre-existing Tier-1 gap, named in D129, and inert with one
  // world permanent on the board. It is registered in tests only.
  'Levitation',
  'Gravity Sphere',
  // M6.3c — the counter EFFECT (D130). Four cards, and each is here for a
  // different half of the boundary:
  //   · `Battlegrowth` "Put a +1/+1 counter on target creature." — a whole
  //     spell inside the vocabulary, so it resolves by ITSELF with no script.
  //   · `Scar` is the same sentence with `-1/-1`, and it can KILL: layer 7d
  //     makes a 1/1 into a 0/0 and the state-based action bins it, which is the
  //     only way a counter effect reaches lethality (D90 — the SBA's job).
  //   · `Burst of Strength` is "Put a +1/+1 counter on target creature AND
  //     UNTAP IT." — ONE sentence, so the assisted rule never sees a second
  //     clause, and only the anchored `$` stops the parser executing two thirds
  //     of the card. It must come out `manual`, and that is a test.
  //   · `Ajani's Pridemate` "Whenever you gain life, put a +1/+1 counter on
  //     this creature." — a PERMANENT, to show a card script can already emit
  //     `CountersChanged` without any of the above, which is the measurement
  //     correction at the heart of D130.
  'Battlegrowth',
  'Scar',
  'Burst of Strength',
  "Ajani's Pridemate",
  // M6.3f — the token EFFECT (D133). `Raise the Alarm` makes TWO of one token,
  // `Servo Exhibition` makes a colourless ARTIFACT creature token (two card
  // types, and no colour word to read), and `Slime Molding` is `X/X` — the
  // negative case the resolver must refuse rather than guess a size for.
  'Raise the Alarm',
  'Servo Exhibition',
  'Slime Molding',
  // M6.3g — CR 614.1c, "enters tapped" (D134), and the pair is the whole point.
  // `Orzhov Guildgate` is the unconditional clause and the app now runs the
  // WHOLE card; `Haunted Ridge` is the same land one word longer — "enters
  // tapped UNLESS you control two or more other lands" — and must NOT be
  // accepted. Tapping it and dropping the condition would be strictly worse
  // than doing nothing, because the player never sees the choice they were owed.
  'Orzhov Guildgate',
  'Haunted Ridge',
  // M6.3g — the two cards that bring the REPLACEMENT API back to life (D134),
  // and they have to be a pair. Both replace the same `CountersChanged` D130
  // built, and together they are the textbook CR 616 case: two counters become
  // SIX with Hardened Scales applied first and FIVE the other way round, so the
  // order is not a detail. Scales is also the card that proves the recursion
  // guard — its own output matches its own condition.
  'Hardened Scales',
  'Branching Evolution',
  // M6.3h — the CONDITION on "enters tapped" (D135). One card per shape the
  // vocabulary reads, plus the one it must refuse:
  //   · `Sunpetal Grove` — "unless you control a Forest or a Plains", the
  //     check-land wording and the biggest group.
  //   · `Neglected Manor` — "unless a player has 13 or less life", a query about
  //     somebody other than the controller.
  //   · `Lair of the Hydra` — the INVERTED wording, "If you control two or more
  //     other lands, this land enters tapped", which normalises to the same
  //     query with its polarity flipped.
  //   · `Godless Shrine` — "you may pay 2 life. If you don't, it enters tapped."
  //     D135 REFUSED IT and D136 reads it, which is the one fixture in this file
  //     that has changed sides. The refusal was right while there was nowhere to
  //     ask: an engine that silently declined to pay makes the player's decision
  //     for them. `Awaiting.entersChoice` is that somewhere.
  'Sunpetal Grove',
  'Neglected Manor',
  'Lair of the Hydra',
  'Godless Shrine',

  // ── modal DFCs — D155 ──────────────────────────────────────────────────────
  // ⚠️ THE FIXTURE POOL HAD NO `modal_dfc` AT ALL (121 normal, 2 split, 4 token,
  // 5 transform), which is why `castSpell`'s hardcoded `faceIndex = 0` survived
  // every suite: a fixture that cannot reach a code path is how that path rots
  // (D102, and this is the fifth time).
  //
  // One per shape the back face can take:
  //   · `Malakir Mire`           — a plain land that ENTERS TAPPED (D134).
  //   · `Agadeem, the Undercrypt` — a land that ASKS for 3 life (D136), the very
  //     rule D136's reportable said no back face could ever reach.
  //   · `Sword of the Realms`    — a permanent SPELL, so it goes hand → stack →
  //     battlefield and proves the face survives both moves.
  'Malakir Rebirth // Malakir Mire',
  "Agadeem's Awakening // Agadeem, the Undercrypt",
  'Halvar, God of Battle // Sword of the Realms',
  // M6.3i — the PROMPT (D136), and both of these exist to stop it going wrong.
  //   · `The Black Gate` pays THREE life, and it is here because every other
  //     card of this shape whose first face is a land pays two. A cost read off
  //     the card and a cost hardcoded to 2 are indistinguishable on a fixture
  //     set where every card says 2 — and the database prints both (21 printings
  //     at 2, 16 at 3).
  //   · `Multiversal Passage` CONTAINS the clause and must be REFUSED: "As this
  //     land enters, choose a basic land type. Then you may pay 2 life. If you
  //     don't, it enters tapped." Reading it would take 2 life from the player
  //     and drop the choice that decides what the land taps for — half-execution
  //     with a real cost attached, which is the failure the anchors exist for.
  'The Black Gate',
  'Multiversal Passage',
  // M6.3j — DISCARD, and the choice that comes with it (D137).
  //   · `Mind Rot` — "Target player discards two cards." The whole card, and the
  //     one that raises `chooseFromZone`.
  //   · `Mental Vapors` — the same sentence at ONE card, so the singular/plural
  //     of the pattern is exercised by a real printing rather than by a guess.
  //   · `Hymn to Tourach` — "…two cards AT RANDOM", 54 lines across the format,
  //     and it must be REFUSED: `effectEvents` has no RNG, and randomness in
  //     this engine comes only from the seeded generator threaded through the
  //     log. Executing it as a chosen discard hands the player a decision the
  //     card does not give them.
  //   · `Duress` — "Target opponent reveals their hand. You choose a nonland
  //     card from it. That player discards that card." 53 lines where the CASTER
  //     picks, from a hand made public. A different chooser and a different
  //     prompt; also REFUSED.
  'Mind Rot',
  'Mental Vapors',
  'Hymn to Tourach',
  'Duress',
  // M6.3k — the GRAVEYARD RETURN (D138). Two destinations, and two cards that
  // prove the newly-enforced target is narrowed by the right amount:
  //   · `Raise Dead` — "Return target creature card from your graveyard to your
  //     hand." 16 lines, 12 whole cards. THE card that exposed the hole: its
  //     spec was `kinds:['card'], zones:[], unenforced:['creature card']`, and
  //     nothing checked zones or types — so it could take a LAND out of an
  //     OPPONENT'S EXILE.
  //   · `Zombify` — the same sentence to the BATTLEFIELD. A separate effect
  //     kind, because the card arrives as a permanent rather than in a hand.
  //   · `Regrowth` — "target card", naming no type at all, so the enforcement
  //     must not over-narrow: it legitimately takes anything in the graveyard.
  //   · `Relearn` — "target instant or sorcery card", the DISJUNCTION: either
  //     type qualifies, and the check must be "any of", never "all of".
  'Raise Dead',
  'Zombify',
  'Regrowth',
  'Relearn',
  // M6.3l — the NUMERIC restriction (D139). Three attributes, both comparators,
  // on three different kinds of object:
  //   · `Smite the Monstrous` — "Destroy target creature with power 4 or
  //     greater." THE card that exposed the hole. It parsed to
  //     `kinds:['creature'], confident:true, unenforced:[]` — the qualifier
  //     matched no noun entry, so it was never recorded ANYWHERE, and the app
  //     would destroy a 1/1 with it while `tier3.ts` said nothing at all.
  //   · `Eternal Isolation` — "power 4 or greater" again, exiling rather than
  //     destroying, so the restriction is exercised on a second effect kind.
  //   · `Disdainful Stroke` — "Counter target spell with mana value 4 or
  //     greater." A STACK object, which is why the stack candidate carries a
  //     real mana value where its power and toughness are null.
  //   · `Unearth` — "mana value 3 or less": the OTHER comparator, reanimating,
  //     and the exact card D138 had to turn away for want of this field.
  'Smite the Monstrous',
  'Eternal Isolation',
  'Disdainful Stroke',
  'Unearth',
  // M6.3n — LOOK AT THE TOP N (D141). The two forms that carry no order
  // decision, and the two that do and must be refused:
  //   · `Forbidden Alchemy` — "…Put one of them into your hand and the rest
  //     into your GRAVEYARD." A graveyard is ordered but nobody chooses that
  //     order, so the whole question never arises — which is why this is the
  //     biggest form the vocabulary can take.
  //   · `Sleight of Hand` — "…Put one of them into your hand and THE OTHER on
  //     the bottom of your library." Singular: exactly one card is left, so
  //     there is no order to choose.
  //   · `Dig Through Time` — "…and the rest on the bottom of your library IN
  //     ANY ORDER." REFUSED: that is a second decision the card gives the
  //     player and this does not offer.
  //   · `Drawn from Dreams` — "…IN A RANDOM order." REFUSED: `effectEvents` has
  //     no RNG, exactly as for "discards at random" (D137).
  'Forbidden Alchemy',
  'Sleight of Hand',
  'Dig Through Time',
  'Drawn from Dreams',
  // M6.3o — the ORDERING prompt (D142). `Dig Through Time` above CHANGES SIDES
  // here: D141 refused it because there was nowhere to ask for the sequence, and
  // there is now. `Drawn from Dreams` stays refused — "in a RANDOM order" needs
  // the seeded generator, which no prompt supplies.
  //   · `Impulse` — take one of four, order the other three to the bottom. The
  //     whole card, so it is the one that becomes executable.
  //   · `Index` — take NOTHING and re-stack all five on top. A different
  //     sentence, not a special case: it has no "put N into your hand" clause.
  'Impulse',
  'Index',
  // M6.3t — the first card in these fixtures with a TARGETED TRIGGER (D147).
  // "Whenever an artifact you control enters, put a +1/+1 counter on target
  // creature you control." — one sentence, so a script for it runs every word
  // (D90), and it was chosen over the other 3,217 cards with a targeted trigger
  // for two measured reasons.
  //   · Its EFFECT already exists: `CountersChanged` has been on the log since
  //     D107, so this proves the targeting primitive rather than smuggling in a
  //     second one (D130's rule).
  //   · Its target is RESTRICTED — "you control" — where the commonest wording
  //     ("target creature", 926 lines) is not. An unrestricted clause would pass
  //     with `targetAllowed` never consulted, which is a green tick over
  //     nothing: the restriction is the only part a test can see enforced.
  // Its trigger condition needs an artifact, and `Darksteel Citadel` above is
  // one — an artifact LAND, so one card entering answers both halves.
  'Yotian Dissident',
  // M6.3t — the first DIES trigger (D147), and it is the case that could not be
  // written at all. "When this creature dies, you gain 2 life." triggers on its
  // OWN death, so by the time the bus runs the card is in a graveyard: the zone
  // check rejects its own source and `matches` is handed a board it has already
  // left. `collectTriggers` took `before` as a parameter and threw it away with
  // `void before` — CR 603.10a's look-back existed nowhere.
  // ⚠️ Its effect is `LifeChanged`, which has been on the log since M3, so this
  // proves the look-back and not a second primitive (D130's rule).
  'Onulet',
  // M6.3t — the first COMBAT RESTRICTION (D147). "This creature can't block."
  // is the whole card, so a script for it runs every word (D90), and it is the
  // shape D129 filed 227 cards under `layer6` for, before finding that
  // `canAttack` and `canBlock` consulted no static at all.
  // ⚠️ CHOSEN OVER "can't attack" DELIBERATELY: `canAttack` already refuses a
  // creature for six built-in reasons, so a test could pass with the new seam
  // never consulted. Nothing else in these fixtures stops a 2/2 blocking.
  'Spineless Thug',
  // M6.3t — the CHOSEN COLOUR (D147), and the card that makes the field pay for
  // itself. Sol Grail is TWO LINES and both of them are now run: 'As this
  // artifact enters, choose a color.' raises the prompt, and '{T}: Add one mana
  // of the chosen color.' is a mana ability scoped to the answer. So it is the
  // whole card, with no card script anywhere — which is what separates the
  // colour shape of that sentence from the creature-type and opponent shapes,
  // whose consumers do need one.
  'Sol Grail',
  // M6.3v — the CR 613.8 DEPENDENCY PAIR (D149), and neither card shows it
  // alone. Both are LAYER 6 and both are single-sentence, so a script for
  // either runs every word (D90):
  //   · Knighthood — 'Creatures you control have first strike.'
  //   · Kwende, Pride of Femeref — 'Creatures you control with first strike
  //     have double strike.'
  // Kwende DEPENDS on Knighthood: whether it applies to a creature is decided
  // by whether Knighthood has already granted first strike. In plain timestamp
  // order with Kwende first, a vanilla creature ends with first strike and NO
  // double strike — the card doing nothing, silently, on a board where it
  // plainly should. That is the whole of why CR 613.8 exists.
  'Knighthood',
  'Kwende, Pride of Femeref',
  // M6.3x — the card that was UNREPRESENTABLE (D151). 'All creatures lose all
  // abilities and have base power and toughness 1/1.' — one line, so a script
  // runs every word (D90), and it is two layers on one card: 6 (lose
  // abilities) and 7b (base P/T), both of which this engine has.
  // ⚠️ Named as unrepresentable by D129, D147, D148, D149 and D150 in turn:
  // `MutableCharacteristics` modelled KEYWORDS, and every other ability lives
  // in the script registry keyed by oracleId, so 'lose all abilities' had
  // nowhere to be written. It does now.
  'Humility',
  // M6.4a — the FIRST SHIPPED BATCH (D158). Eight cards from batch.json, all
  // trigger-shaped, all from the user's own decks or the fuzz pool (§7 rung 1
  // and 2). Wall of Omens, Baleful Strix and Onulet were fixtures already; the
  // five below join so their scripts' `printed()` guards and per-card tests run
  // against DB-guarded records rather than paraphrases (D15b).
  // ⚠️ The four ACTIVATED cards of the same batch (Arcane Encyclopedia,
  // Deserted Temple, Hedron Archive, War Room) are NOT here: `ActivatedDef` is
  // a dead seam — the registry never indexes it and `resolveAbility` consults
  // triggers only — so no script can make them run (D158's reportable).
  'Soul Warden',
  'Essence Warden',
  'Radiant Fountain',
  "Adventurer's Inn",
  'Wall of Blossoms',
  // M6.4b — the ACTIVATED batch (D159), the four cards D158 named as
  // structurally unlandable until the `ActivatedDef` seam existed. Two also
  // prove the new cost machinery: `Hedron Archive` is the self-sacrifice cost,
  // `War Room` the computed commanders'-colors life cost.
  'Arcane Encyclopedia',
  'Deserted Temple',
  'Hedron Archive',
  'War Room',
  // M6.4c — batch 3 (D160): 19 landed of select.cjs's 25 (the 6 deferred are
  // named in D160 — general sacrifice choosers, the `modified` predicate, a
  // script-raised discard prompt, and an INSTANT the script API has no seam
  // for). Talrand and Yotian Dissident were fixtures already.
  'A.I.M. Labs',
  'Abzan Banner',
  'Acolyte of Xathrid',
  'Adun Oakenshield',
  'Aether Adept',
  'Affa Guard Hound',
  'Agents of HYDRA',
  'Airship Engine Room',
  "Ajani's Welcome",
  'Akoum Refuge',
  'Akroan Jailer',
  'Akroan Mastiff',
  "Aladdin's Ring",
  "Alchemist's Apprentice",
  'Amateur Hero',
  'Ambassador Oak',
  'Ambush Gigapede',
  // M6.4d — batch 4 (D161): 15 landed of select.cjs's 25; the ten refusals
  // are D160's six again (the selection gap) plus Amok (random-discard cost),
  // Ancestor's Prophet and Aphetto Grifter (tap-N-creatures costs) and
  // Arc-Slogger (an exile-from-library cost).
  'Anaba Shaman',
  'Angel of Despair',
  'Angel of Mercy',
  'Angelic Page',
  'Anodet Lurker',
  'Anointer of Champions',
  'Ant Queen',
  'Aquus Steed',
  'Arashin Cleric',
  'Arasta of the Endless Web',
  'Arborback Stomper',
  'Archaeomancer',
  'Archivist',
  'Archon of Justice',
  'Ardent Elementalist',
  // M6.4e — batch 5 (D162): 13 landed of select.cjs's 25; the twelve refusals
  // are six general-sacrifice costs (Agent of Shauku, Ahriman, Akki
  // Scrapchomper, Arms Dealer, Army Ants, Aura Fracture), Abyssal Horror (a
  // script cannot raise the target player's discard prompt), Akki Ember-Keeper
  // (the "modified" predicate), Amok (random-discard cost), Ancestor's Prophet
  // and Aphetto Grifter (tap-N-creatures costs), Arc-Slogger (exile-from-library
  // cost).
  'Argothian Enchantress',
  'Ark of Blight',
  'Armada Wurm',
  'Armasaur Guide',
  'Asgardian Citadel',
  'Ashen Rider',
  "Ashiok's Reaper",
  'Aspiring Aeronaut',
  'Attended Knight',
  'Auriok Transfixer',
  'Aven Battle Priest',
  'Aven Cloudchaser',
  'Aven Fogbringer',
  // M6.4f — batch 6 (D163): 9 landed of select.cjs's 25. Twelve slots were
  // batch 5's refusals re-offered (the selection cannot see cost-class
  // refusals — the REFUSED ledger in cardgenSelect fixes that from here on),
  // and four fresh refusals: Axgard Artisan (once-per-turn trigger memory),
  // Aya of Alexandria (CombatDamageDealt batches all creatures' damage into
  // one event, so a per-creature trigger under-fires), Ayula's Influence
  // (discard-as-cost chooser), Azami (tap-a-Wizard cost).
  'Aven of Enduring Hope',
  'Avengers Hangar',
  'Aviation Pioneer',
  'Aysen Bureaucrats',
  'Azorius Cluestone',
  'Azorius Locket',
  'Azure Mage',
  'Backup Agent',
  'Baleful Ammit',
  // M6.4g — batch 7 (D164): 19 landed of select.cjs's 25; the six refusals
  // are four sacrifice-cost choosers (Barrage of Expendables, Barrage Ogre,
  // Barrin, Blazing Hellhound) and two NEW ledger classes — Bearscape
  // (exile-from-graveyard cost) and Black Cat (a random EFFECT while
  // ctx.random is a stub).
  'Barbarian Riftcutter',
  'Bartered Cow',
  'Beamsaw Prospector',
  "Bear's Companion",
  'Beast Whisperer',
  'Beetleback Chief',
  'Belligerent Guest',
  'Benalish Heralds',
  'Benalish Trapper',
  'Beskir Shieldmate',
  'Bigfin Bouncer',
  'Bile Urchin',
  'Birnin Zana Plaza',
  'Birthing Boughs',
  'Blaze Commando',
  'Blighted Cataract',
  'Blinding Mage',
  'Blinding Souleater',
  'Blister Beetle',
  // M6.4h — batch 8 (D165): 22 landed of select.cjs's 25; the three refusals
  // are two sacrifice-cost choosers (Blood Rites, Bog Naughty) and one NEW
  // ledger class — Bolrac-Clan Crusher (remove-a-counter cost).
  'Blood Servitor',
  'Bloodfell Caves',
  'Bloodtallow Candle',
  'Blossom Dryad',
  'Blossoming Sands',
  'Bogardan Rager',
  'Bogwater Lumaret',
  'Boiling Rock Prison',
  'Boltwing Marauder',
  'Bond Beetle',
  'Bone Pit Brute',
  'Book of Rass',
  'Boros Cluestone',
  'Boros Locket',
  'Botanical Plaza',
  'Bottle Gnomes',
  'Braidwood Cup',
  'Bramble Elemental',
  'Brandywine Farmer',
  'Brass Secretary',
  'Brazen Freebooter',
  'Briarknit Kami',
  // M6.4i — batch 9 (D166): 21 landed of select.cjs's 25; the four refusals
  // are Brittle Effigy (a NEW exile-SELF cost class — sacrificesSelf one
  // event over, cheap to build), Cabal Surgeon (exile-from-graveyard cost),
  // Carnage Altar (sacrifice-cost chooser) and Catapult Master
  // (tap-creatures cost).
  'Briarpack Alpha',
  'Brindle Boar',
  'Brindle Shoat',
  'Brinebarrow Intruder',
  'Brood Weaver',
  'Broodmate Dragon',
  'Bulwark Giant',
  'Burrenton Shield-Bearers',
  'Burrog Befuddler',
  'Buzz Bots',
  'Cabal Trainee',
  'Cackling Imp',
  'Capashen Unicorn',
  'Captive Flame',
  "Cartographer's Companion",
  'Carven Caryatid',
  'Castle Ardenvale',
  'Cat-Owl',
  'Cathar Commando',
  'Cathedral Sanctifier',
  'Caustic Caterpillar',
  // M6.4j — batch 10 (D167): 20 landed of select.cjs's 25; the five refusals
  // are two sacrifice-cost choosers (Cephalid Scout, Claws of Gix), a
  // discard-cost chooser (Charging Strifeknight), a once-per-turn memory
  // (Clarion Spirit — "your second spell each turn") and a tap-permanents
  // cost (Clock of Omens).
  'Celestial Force',
  'Centaur Glade',
  'Centaur Healer',
  'Centaur Nurturer',
  "Centaur's Herald",
  "Chandra's Magmutt",
  'Checkpoint Officer',
  'Child of Thorns',
  'Chimney Rabble',
  'Chrome Prowler',
  'City Pigeon',
  'Clarion Cathars',
  'Clockwork Drawbridge',
  'Cloudchaser Eagle',
  'Cloudkin Seer',
  'Cogwork Wrestler',
  "Commander's Sphere",
  'Common Crook',
  'Conclave Cavalier',
  'Conscripted Infantry',
  // D168 — the sacrifice-cost chooser's proof cards, pulled from the REFUSED
  // ledger the day the class was built.
  'Ahriman',
  'Carnage Altar',
  'Claws of Gix',
  // Batch 11 (D169) — ten freed chooser+target cards, two chooser-direct,
  // and eleven fresh shapes.
  'Agent of Shauku',
  'Akki Scrapchomper',
  'Arms Dealer',
  'Army Ants',
  'Aura Fracture',
  'Barrage of Expendables',
  'Barrage Ogre',
  'Barrin, Master Wizard',
  'Blazing Hellhound',
  'Blood Rites',
  'Bog Naughty',
  'Cephalid Scout',
  'Contemplation',
  'Coral Barrier',
  'Council of Advisors',
  'Courier Griffin',
  "Courier's Capsule",
  'Court Street Denizen',
  'Crenellated Wall',
  'Crested Herdcaller',
  'Crimson Caravaneer',
  'Crocodile of the Crossing',
  'Crustacean Commando',
  // Batch 12 (D170) — twenty-three landable: the first transform-watcher and
  // script counterspell, three more subtype chooser costs, and twins.
  'Cult of the Waxing Moon',
  'Cultbrand Cinder',
  'Cunning Sparkmage',
  "D'Avenant Trapper",
  'Daring Apprentice',
  'Dark Heart of the Wood',
  'Darkslick Drake',
  'Dauntless Aven',
  'Dauntless Survivor',
  'Dawnhart Geist',
  'Dawnhart Rejuvenator',
  'Dawning Angel',
  'Daybreak Charger',
  'Daybreak Combatants',
  'Daysquad Marshal',
  'Dazzling Angel',
  'Dazzling Ramparts',
  'Deadapult',
  'Deadeye Duelist',
  'Deathbloom Thallid',
  'Dedicated Martyr',
  'Deeproot Pilgrimage',
  'Deeproot Waters',
  // A TRANSFORM card whose back face is a non-Human creature — the board
  // Cult of the Waxing Moon's test flips. Not itself scripted.
  'Duskwatch Recruiter // Krallenhorde Howler',
  // Batch-12 test bodies, none scripted: a vanilla Zombie for Deadapult's
  // predicate and a vanilla nontoken Merfolk for the Deeproot pair. (The
  // Forest Dark Heart of the Wood's test sacrifices is already a fixture.)
  'Walking Corpse',
  'Merfolk of the Pearl Trident',
  // Batch 13 (D171) — twenty landable: the becomes-blocked, graveyard-exit
  // and cast-of-itself watchers, the first chosenColor trigger consumer,
  // the first script reanimation, and twins.
  'Deepwood Tantiv',
  'Deranged Outcast',
  'Desecrated Tomb',
  'Desolation Twin',
  'Destructive Digger',
  'Devotee of Strength',
  'Devout Monk',
  'Diamond Mare',
  'Dimension X',
  'Dimir Cluestone',
  'Dimir Locket',
  'Dire Fleet Hoarder',
  'Discordant Piper',
  'Disease Carriers',
  'Dismal Backwater',
  "Dispeller's Capsule",
  'Dispersing Orb',
  'Dockside Chef',
  'Doomed Dissenter',
  'Doomed Necromancer',
];

/** Tokens, pinned by set+collector number because names collide wildly. */
const WANTED_TOKENS = [
  // ⚠️ **PINNED TO THE PRINTING `TOKEN_TABLE` NAMES**, not to a pretty one.
  // M6.3f resolves "create two 1/1 white Soldier creature tokens" to an exact
  // `printingId` at build time (D133), and the engine's oracle is built from the
  // game's POOL — so a fixture holding a DIFFERENT Soldier reprint would make
  // `Raise the Alarm` create a card the test oracle has never heard of, and
  // `derive` would return the inert unknown-printing object: a blank 0/0 the
  // state-based action bins. Same token either way at a real table; not the same
  // id, and the id is what the pool is keyed on.
  { name: 'Soldier', set: 't40k', cn: '2★', key: 'SOLDIER_TOKEN' },
  { name: 'Servo', set: 'tdft', cn: '8', key: 'SERVO_TOKEN' },
  { name: 'Treasure', set: 'trna', cn: '12', key: 'TREASURE_TOKEN' },
  { name: 'Beast', set: 'tclb', cn: '38', key: 'BEAST_TOKEN' },
  // M6.4c (D160) — the first SCRIPT-created tokens. Each is the exact printing
  // its card's `TOKEN_TABLE` entry names, for D133's reason above.
  { name: 'Drake', set: 'tc20', cn: '8', key: 'DRAKE_TOKEN' },
  { name: 'Elf Warrior', set: 'tltc', cn: '11', key: 'ELF_WARRIOR_TOKEN' },
  { name: 'Villain', set: 'tmsh', cn: '9', key: 'VILLAIN_TOKEN' },
  // M6.4d (D161).
  { name: 'Insect', set: 'tsoi', cn: '7', key: 'INSECT_TOKEN' },
  { name: 'Spider', set: 'tmh1', cn: '14', key: 'SPIDER_TOKEN' },
  // M6.4e (D162).
  { name: 'Wurm', set: 'trtr', cn: '11', key: 'WURM_TOKEN' },
  { name: 'Thopter', set: 'tafc', cn: '12', key: 'THOPTER_TOKEN' },
  // Batch 13 (D171).
  { name: 'Bat', set: 'tlci', cn: '6', key: 'BAT_TOKEN' },
  { name: 'Eldrazi', set: 'tcmm', cn: '1', key: 'ELDRAZI_TOKEN' },
  { name: 'Goat', set: 'tncc', cn: '6', key: 'GOAT_TOKEN' },
  { name: 'Zombie', set: 'tc14', cn: '16', key: 'ZOMBIE_TOKEN' },
  // Batch 12 (D170).
  { name: 'Human Soldier', set: 'tthb', cn: '2', key: 'HUMAN_SOLDIER_TOKEN' },
  { name: 'Merfolk', set: 'txln', cn: '3', key: 'MERFOLK_TOKEN' },
  { name: 'Wolf', set: 'tlrw', cn: '10', key: 'WOLF_TOKEN' },
  // Batch 11 (D169).
  { name: 'Squid', set: 'tblc', cn: '17', key: 'SQUID_TOKEN' },
  { name: 'Dinosaur', set: 'txln', cn: '5', key: 'DINOSAUR_TOKEN' },
  { name: 'Junk', set: 'tpip', cn: '15', key: 'JUNK_TOKEN' },
  { name: 'Mutagen', set: 'ttmt', cn: '9', key: 'MUTAGEN_TOKEN' },
  // M6.4j (D167).
  { name: 'Centaur', set: 'trvr', cn: '10', key: 'CENTAUR_TOKEN' },
  { name: 'Elf Knight', set: 'trvr', cn: '15', key: 'ELF_KNIGHT_TOKEN' },
  { name: 'Phyrexian Goblin', set: 'tfdn', cn: '31', key: 'PHYREXIAN_GOBLIN_TOKEN' },
  { name: 'Soldier', set: 'totc', cn: '26', key: 'SOLDIER_ARTIFACT_TOKEN' },
  // M6.4i (D166).
  { name: 'Boar', set: 'tpca', cn: '14', key: 'BOAR_TOKEN' },
  { name: 'Dragon', set: 'tmm3', cn: '7', key: 'DRAGON_TOKEN' },
  { name: 'Human', set: 'tfdn', cn: '3', key: 'HUMAN_TOKEN' },
  { name: 'Map', set: 'tbig', cn: '7', key: 'MAP_TOKEN' },
  // M6.4h (D165).
  { name: 'Saproling', set: 'tddj', cn: '1', key: 'SAPROLING_TOKEN' },
  // M6.4g (D164).
  { name: 'Bear', set: 'ttla', cn: '12', key: 'BEAR_44_TOKEN' },
  { name: 'Blood', set: 'tbig', cn: '2', key: 'BLOOD_TOKEN' },
  { name: 'Food', set: 'tunf', cn: '10', key: 'FOOD_TOKEN' },
  { name: 'Goblin', set: 'l12', cn: '1', key: 'GOBLIN_TOKEN' },
  { name: 'Human Warrior', set: 'tkhm', cn: '3', key: 'HUMAN_WARRIOR_TOKEN' },
  { name: 'Lander', set: 'teoe', cn: '6', key: 'LANDER_TOKEN' },
  { name: 'Shapeshifter', set: 'tmh1', cn: '1', key: 'SHAPESHIFTER_TOKEN' },
  { name: 'Soldier', set: 'tonc', cn: '17', key: 'SOLDIER_RW_TOKEN' },
];

function constName(name) {
  return name
    .replace(/\/\//g, ' ')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

async function main() {
  const ndjson = path.join(dataRoot(), 'cards', 'cards.ndjson');
  if (!fs.existsSync(ndjson)) {
    console.error(`No card database at ${ndjson}.\nRun: node electron/cardsvc-worker.cjs --sync`);
    process.exit(1);
  }

  const wantNames = new Set(WANTED);
  const found = new Map();
  const foundTokens = new Map();

  const rl = readline.createInterface({ input: fs.createReadStream(ndjson), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    let card;
    try {
      card = JSON.parse(line);
    } catch {
      continue;
    }
    if (wantNames.has(card.name) && !found.has(card.name) && card.layout !== 'token') {
      found.set(card.name, card);
    }
    for (const t of WANTED_TOKENS) {
      if (foundTokens.has(t.key)) continue;
      if (card.name === t.name && card.setCode === t.set && card.collectorNumber === t.cn) {
        foundTokens.set(t.key, card);
      }
    }
  }

  const missing = WANTED.filter((n) => !found.has(n));
  const missingTokens = WANTED_TOKENS.filter((t) => !foundTokens.has(t.key));
  if (missing.length || missingTokens.length) {
    console.error('Missing:', [...missing, ...missingTokens.map((t) => `${t.name} (${t.set} ${t.cn})`)].join(', '));
    process.exit(1);
  }

  const lines = [];
  lines.push('// ⚠️ GENERATED by scripts/make-engine-fixtures.cjs — DO NOT EDIT BY HAND.');
  lines.push('//');
  lines.push('// Verbatim `CardData` records from the real Scryfall data, so the engine tests');
  lines.push('// exercise the same text the app will. Hand-editing a value here silently');
  lines.push('// turns a rules test into a test of the edit — the D15b failure mode.');
  lines.push('// Regenerate with `node scripts/make-engine-fixtures.cjs` (needs a synced DB).');
  lines.push('//');
  lines.push('// `engineCards.node.test.ts`, beside this file, re-reads every record here from');
  lines.push('// the live database and asserts it is byte-identical — so a Scryfall rewording,');
  lines.push('// or a hand edit, fails there rather than rotting silently here.');
  lines.push('');
  lines.push("import type { CardData } from '../cardTypes';");
  lines.push('');

  const exported = [];
  for (const name of WANTED) {
    const card = found.get(name);
    const id = constName(name);
    exported.push(id);
    lines.push(`export const ${id}: CardData = ${JSON.stringify(card, null, 2)};`);
    lines.push('');
  }
  for (const t of WANTED_TOKENS) {
    const card = foundTokens.get(t.key);
    exported.push(t.key);
    lines.push(`export const ${t.key}: CardData = ${JSON.stringify(card, null, 2)};`);
    lines.push('');
  }

  lines.push('/** Every fixture card, for building an OracleDb in a test. */');
  lines.push('export const ENGINE_CARDS: CardData[] = [');
  for (const id of exported) lines.push(`  ${id},`);
  lines.push('];');
  lines.push('');

  const out = path.join(__dirname, '..', 'src', 'data', 'fixtures', 'engineCards.ts');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`Wrote ${exported.length} cards → ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
