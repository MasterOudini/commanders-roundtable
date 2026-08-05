# M6 — The bot: a formidable solo opponent that knows the whole format

**Self-contained brief for starting M6 in a fresh session.** Written 2026-07-29.

> **Read first, in this order:** `AGENTS.md` (the whole file, especially the
> scope-tier table and the nine verification traps), then `docs/DECISIONS.md`
> — at minimum **D42/D43** (solo is a hotseat), **D68**, **D79–D91** (targeting
> and the tier model), **D102** (a driver with no answer stops the game
> forever), **D107/D108**, and **D119/D120** (priority, the hotseat hand-off,
> and who a resolved spell belongs to). Do not start writing code until you have
> read them. Several of the traps below cost real debugging time already and
> every one of them is reachable from this work.

---

## 1. What you are building

Play solo against a **bot** — an opponent that sits in a seat, holds a real
hand, plays lands, casts spells, attacks, blocks, responds at instant speed and
tries to win. Not a scripted demo and not a dummy that passes: an opponent worth
beating.

The user's words: *"I want that bot to encompass all of the current legal cards
in Commander. I know it will take a long time, but I know it's also possible.
And I wanted that bot would play with the knowledge of all the cards and would
play like a formidable opponent."*

Two decisions are already made, by the user, and they shape everything below:

1. **Card knowledge is acquired at BUILD time and shipped as deterministic
   code.** An LLM may be used as a code-generation tool during development to
   draft per-card scripts; those scripts are reviewed, tested against real
   Scryfall text and compiled into the app. **The running game never touches a
   network and never calls a model.** Determinism, replay, rewind and the fuzz
   gate all survive intact.
2. **The first shippable bot plays only cards the engine can execute
   completely.** It never fakes, approximates or silently skips card text. Its
   deck pool widens as the engine's coverage widens, until it is the format.

---

## 2. The honest problem, stated once

**A bot can only play what the engine can execute.** This app deliberately does
not execute most cards — that is the scope-tier model in `AGENTS.md`, and it is
load-bearing, not an accident. Measured today:

| Thing | Number |
|---|---|
| Cards in the database | 113,559 printings |
| Commander-legal instants + sorceries | 6,975 distinct |
| …the engine resolves **completely** (Tier 2.5) | **274** |
| …the engine understands **in part** (Tier 2.5a, never self-executes) | 1,300 |
| Commander-legal lands | 12,500, of which 4,270 offer a choice |
| Spell-level target specs parsed | 20,840, 17,330 read confidently |
| Activated-ability lines parsed | 42,945, 24,729 payable |
| **Per-card scripts registered in `EMPTY_REGISTRY`** | **0** |

So "a bot that knows every card" is **two projects stacked**, and conflating
them is the single biggest way to fail at this:

- **Project A — the player.** Decision-making: what to play, when, what to
  attack with, what to block, what to hold up, when to respond. This can start
  today, over the subset the engine already runs, and is where "formidable"
  is won or lost.
- **Project B — the library.** Making the engine execute the format. This is
  the long one. It is *not* mostly about writing 20,000 scripts; it is first
  about giving the engine the **decision primitives** those scripts need to be
  written in terms of (see §6).

Ship Project A over a small, honest pool. Grow Project B underneath it. The bot
gets stronger and broader on two independent tracks, and neither blocks the
other.

---

## 3. What already exists — do not rebuild any of it

Read these before designing anything. Most of the bot's hard problems are
already solved by the engine.

| You need | It already exists | Where |
|---|---|---|
| "What can this player legally do right now?" | `legalActions(state, oracle, scripts, player)` — the one primitive that drives highlighting, auto-pass and confirmations | `src/engine/legal.ts` |
| "Is this worth stopping for?" | `meaningfulActions`, `shouldAutoPass`, `isStopWindow` (D119) | `src/engine/legal.ts` |
| "Can this creature attack / block that one?" | `canAttack`, `canBlock`, `legalDefenders`, `assignBlockerDamage`, `resolveCombatDamage` | `src/engine/combat.ts` |
| "How do I pay for this?" | Three-tier mana solver, MCMF, **measured at 0.100 ms on a 40-source board** | `src/engine/mana.ts`, `payment.ts` |
| "What may this spell target?" | `candidatesFromState`, `targetAllowed`, one legality rule with two adapters (D81) | `src/engine/targets.ts` |
| "Apply a move and get a new state" | `handle(intent) → Event[]`, `apply(state, event) → state`, `advance`/`pump` | `src/engine/handlers.ts`, `reducer.ts`, `loop.ts` |
| "Are these two positions the same?" | Canonical JSON + a 64-bit state hash | `src/engine/hash.ts` |
| "What can this seat see?" | `project(state, viewer) → PlayerView` — the whole hidden-information boundary | `src/engine/project.ts` |
| A seat that is not a human | **Every seat is already a `ClientSession` over a `loopbackPair`** | `src/game/session.ts:269`, `src/net/transport.ts` |
| A trivial baseline driver | `simplestIntent(session, snapshot)` | `src/net/testing/script.ts` |
| A harness that plays thousands of games | The replay-equivalence fuzzer, 500 seeds × 200 intents | `src/engine/fuzz.node.test.ts` |
| The per-card automation surface | `CardScript` / `TriggerDef` / `StaticDef` / `ReplacementDef` / `ActivatedDef`, pre-indexed | `src/engine/scripts/api.ts`, `registry.ts` |

⚠️ **The script registry is a complete, designed extension point with zero
registrations.** Read the header comment in `scripts/api.ts`. Nothing in the
engine branches on "is this card scripted" — the *absence* of registrations is
the answer, and that is exactly what makes Project B a pure addition rather
than a rewrite. Scripts **return events**; they are never handed a mutation API;
`ctx.random` is a seeded scratch RNG so even a coin-flip card replays bit-exactly.

---

## 4. Invariants you may not break

These are not style preferences. Each has a measurement or an outage behind it.

1. **`src/engine/` stays pure and deterministic.** No React/Electron/Node/zustand,
   no `Date.now`/`Math.random`/`performance.now`. `src/engine/purity.node.test.ts`
   enforces it per file. **The bot does not go in `src/engine/`.**
2. **Every state change goes through an event on the append-only log.** The bot
   submits *intents*, exactly as the UI does. It never mutates anything.
3. **The bot plays from a `PlayerView`, never from `GameState`.** This is not
   politeness — it is structural, because a bot seat is a `ClientSession` and a
   client never holds a `GameState`. A bot that read the host's state would be
   cheating *and* would break the one boundary `project()` exists to hold.
4. **Determinism.** Any randomness the bot uses is seeded and threaded, or the
   game stops replaying and rewind, reconnect and the fuzz gate all die with it.
   Prefer no randomness at all outside a deliberate "vary my play" knob.
5. **Never half-execute (D90).** The rule that shaped the tier model. A bot that
   plays a card the engine understands in part is the worst possible actor: it
   commits the player to a board state nobody can audit. If the engine cannot
   run a card completely, the bot must not have it in its deck.
6. **The renderer's frame budget is real.** The perf gate holds p95 ≤ 18 ms.
   Search must not run on the render thread — see §5.
7. **Answer every prompt, and terminate (D102).** A driver with no case for an
   `Awaiting` returns `null` and the game stops forever with no error. And
   "cancel" alone converts a deadlock into a *livelock*, because `legalActions`
   will re-offer the same move. Prevention *and* recovery, never one alone.
8. **Offline-first.** Nothing in the shipped app may reach the network for the
   bot. Ever.

---

## 5. Architecture — where the bot lives

**A bot is a client.** `session.startLocal` already builds one `ClientSession`
per seat over a `loopbackPair`, including the human's (M4 invariant 6: there is
no privileged path from the host to any UI). A bot seat is the same object with
its decisions coming from code instead of from a pointer.

```
src/bot/
  types.ts        BotConfig, Difficulty, BotDecision
  seat.ts         drives one ClientSession: view + awaiting → intent
  policy/
    greedy.ts     the level-1 heuristic player
    search.ts     the level-3 lookahead (only once greedy is beaten)
  eval/
    position.ts   PURE: PlayerView → score. The heart of "formidable".
    combat.ts     attack/block solver, reusing engine combat predicates
  knowledge/
    cards.ts      per-card play hints derived from the parsed fields
  worker/         the utilityProcess entry point (see below)
```

- `src/bot/` obeys the **same purity rule as `src/net/`**: no React, no
  Electron, no zustand. Add it to `purity.node.test.ts`'s per-file check. This
  is what lets the entire bot be unit-tested in the node environment and driven
  headlessly at scale.
- **Where it runs.** Start on the main thread with a hard per-decision time
  budget (measure it). The moment search costs more than a few milliseconds,
  move it into a `utilityProcess` modelled exactly on `electron/cardsvc.cjs` +
  `cardsvc-worker.cjs` — that pattern already handles lazy start, a ready-gated
  outbox, a log ring and crash recovery. Do not invent a second supervisor.
- **Pacing.** A bot that answers instantly makes the table unreadable — the
  choreographer needs its beats to land. Give the bot a configurable
  "thinking" floor and let it act on the choreographer's drain, the way
  `maybeSwitchSeat` does. Fast is not the goal; legible is.

### Integration points you must get right

- **`session.maybeSwitchSeat` must never hand the table to a bot seat.**
  It follows `whoIsNeeded()`, which returns whoever holds priority — which will
  routinely be the bot. Add a set of bot-controlled seats that the hotseat
  switch and the D119 hand-off banner both skip. Getting this wrong makes the
  table flip to the bot's board every time it responds to anything.
- **Stops.** A bot seat should not be running the human auto-pass policy at all.
  Give it `mode: 'fullControl'` and let its own policy decide every window, or
  it will be auto-passed out of decisions it wanted to make.
- **The assisted offer (D120).** It is filtered on `localSeats()`, which in a
  solo game includes the bot's seat. A bot must answer its own offers and the
  human must never be shown one for the bot's spell.
- **The solo lobby** (`src/ui/screens/SoloScreen.tsx`, `src/store/soloStore.ts`)
  gains a per-seat "Human / Bot" control plus a difficulty picker. Seat names
  come from `seatName()` — do not let the lobby and the table disagree.
- **The log** must make it obvious a bot acted, without the wrench: the wrench
  means "a human hand-waved a rule" and the bot is not doing that.

---

## 6. Project B — making the engine know the format

This is the long track. Do it in this order; the order is the whole point.

### 6.1 Primitives before scripts

You cannot script twenty thousand cards until the engine can express what they
do. Before generating anything, **enumerate the missing decision primitives and
build them**, because a script can only be written in terms of what exists.
Known gaps, from reading the engine today:

- **Layer 6 (granted abilities) does not exist.** `derive.ts` runs layers 1,
  7b, 7c and 7d. D82 records that hexproof and shroud are enforced only where
  *printed*, because a granted keyword needs layer 6. Enormous numbers of cards
  need this.
- **Choosing from a zone.** There is no `Awaiting` for "choose a card in your
  hand to discard", "search your library for a land", "choose a creature in a
  graveyard". Discard, tutor, reanimate and rummage are all blocked on it.
- **Modes and choices.** No "choose one —", no "choose a color", no "name a
  card", no "choose a creature type". `chooseX` and `chooseTargets` are the
  only cast-time stages.
- **Optional triggers and "may".** `TriggerDef.optional` exists in the API and
  nothing consumes it.
- **Delayed and conditional triggers** ("at the beginning of the next end
  step", "when this dies").
- **Continuous effects with duration** beyond `untilEndOfTurn`.
- **Cost modification** (cost reducers, additional costs like Thrill of
  Possibility's discard — currently unenforced).

Each primitive is a small, testable engine change with its own decision entry.
Each one unlocks hundreds to thousands of cards. **Measure the unlock**: for
every primitive, report how many Commander-legal cards become executable
because of it. That number is how you decide what to build next.

### 6.2 The generation pipeline

Once primitives exist, scale card coverage with an offline pipeline. Suggested
shape — refine it, but keep every property listed:

```
scripts/cardgen/
  select.cjs      pick the next batch of cards to attempt
  draft.cjs       LLM drafts a CardScript for each (DEV ONLY, never shipped)
  verify.cjs      compile, lint, run generated tests, run the fuzz canary
  land.cjs        write accepted scripts into src/engine/scripts/cards/
```

Required properties:

- **The output is ordinary reviewed TypeScript** that ships in the bundle.
  The model is a tool, like a code generator. Nothing at runtime knows it existed.
- **Every generated script arrives with tests written against the REAL Scryfall
  oracle text** from the card database, not against a paraphrase.
  `scripts/make-engine-fixtures.cjs` is how fixtures are produced; extend it.
- **A script that cannot be verified is not landed.** A wrong script is
  strictly worse than no script (that is D90's rule applied to automation): a
  missing card is honest and visible, a wrong one silently corrupts games.
- **The 500-seed fuzz gate runs on every batch**, with the new cards seeded into
  the fuzz deck. D102 and D107 both record the same failure — the gate stayed
  green because the fixture pool could not reach the code path. Every batch adds
  its cards to the pool, or the batch is untested by construction.
- **Report coverage as a measured number every batch**, in the style this repo
  already uses: *"X of Y Commander-legal cards now execute completely, up from Z."*
- **Order by what gets played, not by card id.** Covering the top few thousand
  played cards is worth more than the whole tail. Popularity data is an internet
  dependency: **stop and ask the user before fetching any**, per the offline
  policy. A defensible offline proxy in the meantime: the cards in the user's
  own saved decks, plus every card in the fuzz deck, plus format staples that
  can be derived from what is already on disk.

⚠️ **Do not let the generator touch `src/engine/` itself.** It writes card
scripts and their tests. The engine's primitives are hand-written, reviewed
work — that is where correctness for *every* card is decided.

---

## 7. Project A — making it formidable

Build the ladder in order and **prove each rung beats the one below it** before
starting the next. Every rung is a real difficulty setting the user can pick.

- **Level 0 — Legal-random.** Already exists (the fuzzer). It is the baseline,
  not a product. Every later level must beat it ≥ 95% of the time.
- **Level 1 — Greedy heuristic.** Curve out, play a land every turn, cast the
  best thing affordable, attack when the trade is profitable, block to survive,
  hold up instants only when it has one worth holding. This is most of the
  distance to "feels like a real opponent" and it is cheap. Get it right before
  anything clever.
- **Level 2 — One-ply with an evaluation function.** Enumerate `legalActions`,
  apply each through the real engine, score the resulting position, take the
  best. The engine is pure with a 64-bit hash, so this is straightforward and
  memoisable. **Measure the cost of one `pump` per node before committing.**
- **Level 3 — Depth-limited search over hidden information.** Determinize the
  opponent's hidden zones by sampling, search, average. ISMCTS is the honest
  name for it. Only attempt this once level 2 is measurably beating level 1, and
  only if the node cost measured at level 2 makes it affordable.

**The evaluation function is where the strength lives** — more than the search.
Start with material, board presence, life, card advantage, mana development,
commander damage clocks and evasion, and *tune it by playing*, not by taste.

### Measuring "formidable" — the definition of done

Do not claim strength; measure it, the way every other number in this repo is
measured.

- `scripts/battery-bot.cjs`: headless bot-vs-bot tournaments, seeded, thousands
  of games, reporting win rate, average game length, turns per game and
  decisions-per-second per level.
- **Every level must beat the level below it with a win rate whose confidence
  interval excludes 50%.** Report the interval, not just the rate.
- **Regression harness:** a fixed set of seeded positions with a known best
  move, asserted per level. A bot that gets weaker must fail a test.
- **Games must replay.** A bot game's NDJSON log must replay to the same state
  hash, exactly as a human game does. This is the check that catches
  non-determinism creeping in through the policy.
- **Played by hand, and reported honestly:** the user plays it and says whether
  it felt like an opponent. That is the only test that matters in the end, and
  it is the last one, not the first.

---

## 8. Traps specific to this work

1. **A missing prompt case is a silent hang, not an error.** D102: the
   two-instance sign-off reported 21/24 for weeks because `simplestIntent` had
   no case for `chooseTargets` and returned `null`. Your bot must have a case
   for **every** `Awaiting` kind in `src/engine/types/state.ts` — **twelve** as
   of D125: `mulligan`, `mulliganBottom`, `declareAttackers`, `declareBlockers`,
   `orderBlockers`, `orderAttackers`, `orderTriggers`, `chooseLegendKeep`,
   `commanderZoneChoice`, `chooseX`, `chooseTargets`, `rewindVote` — and a loud,
   logged fallback for any kind added later.
   ⚠️ This list said `assignCombatDamage` too, and **that variant is gone**: it
   had no answering intent, so "have a case for it" was advice nothing could
   follow. `src/engine/awaitingProducers.node.test.ts` now asserts the whole map
   — which kinds can be raised (10 of the 12), which are dormant, and that every
   one of them has an intent and a handler. Read it rather than a list in prose.
2. **Cancelling is not answering.** An unsatisfiable choice needs both a way
   out *and* a filter that stops the same move being re-offered, or the game
   livelocks. D102 again.
3. **A fixture that cannot reach a code path is how that path rots.** Recorded
   three separate times in this repo (D102, D107, D108). Whatever pool the bot
   plays from must contain the cards that exercise the features you just added.
4. **The perf gate's tail is external load until proven otherwise (D106).** If
   p50 and p95 are unmoved and only the tail degraded, it is interference. A
   real regression moves the median.
5. **Restart Vite before probing** after an edit session (trap 1), and reach
   state through `window.__crt` handles rather than importing app modules.
6. **`preview_start` does not work with the Electron apps in this workspace.**
   Drive the live renderer with `npx electron . --dev --remote-debugging-port=9223`
   plus `scripts/cdp.cjs`, and screenshot with `scripts/screenshot.cjs`.
7. **Do not use `git stash` or `git restore` to bisect.** The working tree
   carries a large amount of uncommitted work from previous sessions. Bisect by
   temporarily disabling code and restoring it.
8. **There is a known, pre-existing React `Maximum update depth exceeded`** in
   the battery's `drag` and `motion` sections. It is not yours; do not let it
   mask a real one you introduce.

---

## 9. Suggested milestones

Each ships something playable and each ends with measured numbers in
`AGENTS.md` and a decision entry in `docs/DECISIONS.md`.

- **M6.1 — A bot takes a seat.** `src/bot/` scaffolding, a `BotSeat` driving a
  `ClientSession`, an answer for every `Awaiting`, the hotseat/hand-off/stops
  integration, the solo lobby control. Strength: level 0–1. **Done when** a
  full solo game plays start to finish against it with no hangs, the log
  replays to the same hash, and the table never flips to the bot's seat.
- **M6.2 — It plays properly.** The evaluation function, the combat solver, the
  greedy policy tuned. `scripts/battery-bot.cjs` and the tournament harness.
  **Done when** level 1 beats level 0 ≥ 95% over thousands of seeded games.
- **M6.3 — The primitives.** Layer 6, choose-from-zone, modes, optional
  triggers, delayed triggers, cost modification. Each with its measured unlock
  count. **Done when** the number of completely-executable Commander-legal
  cards has multiplied and the fuzz gate is green with all of them in the pool.
- **M6.4 - The library.** The generation pipeline, batched, verified, landed.
  **Done when** coverage is reported as a real fraction of the format and the
  bot's deck pool is no longer the limiting factor.
  
  > FULLY SPECIFIED IN `docs/M6.4-LIBRARY-SPEC.md`, and that spec supersedes
  > this bullet and most of section 6.2. This section under-counts the work:
  > it treats the library as a generation problem, and the measurement in
  > D127 plus the class sizes in the spec show that roughly half of it is
  > ENGINE work no script can substitute for - full CR 613 layers with
  > dependency, CR 601.2f cost modification against the mana solver, CR 616
  > replacement ordering as a player choice, CR 707 copiable values, and the
  > CR 508.1d combat maximisation rule, which changes what the host has to
  > ship in the declare-blockers prompt.
- **M6.5 — Formidable.** Level 2, then level 3 if the measurements justify it.
  Difficulty settings surfaced. **Done when** the user says it is hard to beat.

---

## 10. Your first session

Do not write bot code first. In order:

1. Read `AGENTS.md` and the decisions listed at the top of this file.
2. **Measure the real starting point** with the existing tooling, and write the
   numbers down: how many Commander-legal cards execute completely today; how
   many are assisted; how many are manual; what a legal deck built only from the
   executable pool actually looks like. `node electron/cardsvc-worker.cjs
   --query`, `scripts/battery-carddb.cjs` and the ingest counters in the tests
   are where those numbers come from. **Do not trust the numbers in §2 of this
   file — reproduce them.**
3. Build the smallest honest deck the bot can legally play from that pool, and
   say plainly whether it is a real Commander deck or a pile.
4. Then start M6.1.

Report what you measure, including when it is worse than this brief assumes.
