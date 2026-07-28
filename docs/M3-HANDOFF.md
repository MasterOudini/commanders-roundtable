# Session handoff — build M3 (the rules engine + solo play)

Paste this whole file as your opening prompt, or say
*"read `H:\Claude Apps\commanders-roundtable\docs\M3-HANDOFF.md` and build M3"*.

---

## Your task

Build **M3 — the rules engine and solo play** of Commander's Roundtable, at
`H:\Claude Apps\commanders-roundtable`.

M1 (shell, card database, decks) and M2 (the animated table) are complete and
verified. M3 is where the app becomes a game: a pure, deterministic, event-logged
rules engine, the Tier-3 manual tools, group rewind, and the whole thing wired to
the M2 table so a full 4-seat Commander game can be played solo, start to finish,
with animations.

**The gate that governs the whole milestone:** the replay-equivalence fuzzer.
Networking does not start until it is green, because every networking bug becomes
unfalsifiable if the engine itself is nondeterministic.

Stop at the end of M3 and report. Do not start M4.

---

## Read these first

| File | Why |
|---|---|
| `AGENTS.md` | Canonical project instructions. Loaded automatically via `CLAUDE.md`. Read the ⚠️ sections properly — the trap list there is now eight items and every one of them cost real time. |
| `docs/DECISIONS.md` | 31 numbered decisions with reasons. **Read before "fixing" anything that looks odd** — most entries exist because the obvious alternative was tried and failed. **D21 is a hard requirement on your code.** |
| `docs/specs/engine-net-spec.md` | **The detailed M3/M4 design spec.** Data model, event model, priority loop, mana solver, combat, projection. Your primary reference. |
| `docs/specs/approved-plan.md` | The user-approved plan for all five milestones. |
| `docs/specs/ui-animation-spec.md` | The M2 spec. Skim §4.6–4.7 only: it tells you what the choreographer expects from your event stream. |
| `docs/M2-HANDOFF.md` | The previous brief. Useful for context on why M2 was built before the engine. |
| `src/view/types.ts` | **The contract you have to satisfy.** This is the shape `project()` must produce and the event union the choreographer already consumes. |
| `H:\Claude Apps\AGENTS.md` | Workspace-wide mandatory policy (offline-first, Electron packaging, `---Done---`). |

Also relevant: workspace auto-memory at
`C:\Users\apps\.claude\projects\H--Claude-Apps\memory\` (start at `MEMORY.md`).

---

## What the app is

A **desktop app for playing Magic: The Gathering — Commander (EDH) online with
2–4 friends**, using decks the user built themselves. It plays like MTG Arena:
**the app does the rules bookkeeping automatically** — shuffling, mulligans, turn
structure, mana, casting, the stack, combat, state-based actions, commander
damage. It is deliberately **not** a manual sandbox where players drag cards and
track life by hand.

It is equally deliberately **not** a full rules engine for every Magic card.
Three tiers:

| Tier | Meaning | Examples |
|---|---|---|
| **1 — fully automatic** | The engine always enforces it. | Shuffle, London mulligan, 40 life, every phase/step, untap, draw, priority, mana pools emptying, cost payment, commander tax, the stack resolving LIFO, combat damage, lethal damage, 0 life, 21 commander damage, legend rule, zone visibility |
| **2 — keyword automation** | Parsed from Scryfall `keywords[]`, enforced where it affects combat or casting. | flying, reach, trample, vigilance, haste, lifelink, deathtouch, first/double strike, menace, defender, indestructible, flash, landwalk, ward-as-tax |
| **3 — manual with helpers** | NOT enforced. The player reads the card and uses a tool. | Every unique card ability. Tools: move any card between any zones, create tokens, add/remove counters, adjust life/mana, tap/untap, reveal, dice, coins |

Deliverable is a Windows NSIS `.exe` the user sends to friends. Personal,
non-commercial. Trust model: friends only — protecting against a cheating host is
explicitly out of scope.

---

## Architecture

```
                          RELAY (relay/, Node + ws, on a VPS)   ← M4, not built
                     room registry · blind forwarding · ZERO game logic
                                    ▲            ▲
                            wss://  │            │  wss://
┌───────────────────────────────────┴──┐   ┌─────┴──────────────────────────────┐
│ HOST app                             │   │ GUEST app  (same binary)           │
│ ┌──────────────────────────────────┐ │   │ ┌────────────────────────────────┐ │
│ │ src/engine/  PURE + DETERMINISTIC│ │   │ │ src/engine/ present but IDLE   │ │  ← M3
│ │  handle(intent) → Event[]        │ │   │ │  (replay / rewind only)        │ │
│ │  apply(state, event) → state     │ │   │ └────────────────────────────────┘ │
│ │  append-only log (NDJSON on disk)│ │   │ ┌────────────────────────────────┐ │
│ │  project(state, playerId) → View │ │   │ │ PlayerView + redacted events   │ │
│ └───────────────┬──────────────────┘ │   │ └──────────────┬─────────────────┘ │
│  own PlayerView │  redacted events   │   │                │                   │
│ ┌───────────────▼──────────────────┐ │   │ ┌──────────────▼─────────────────┐ │
│ │ CHOREOGRAPHER → beats → React UI │ │   │ │ CHOREOGRAPHER → beats → React  │ │  ← M2 ✓
│ └──────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ MAIN: card DB · art cache · decks    │   │                                    │
└──────────────────────────────────────┘   └────────────────────────────────────┘
```

**The invariant everything rests on:** every state change — including all Tier-3
manual tools — goes through an event appended to the log. Nothing mutates state
off-log. That gives replay, reconnect, group rewind, the trigger bus, and the
animation cue stream for free. Never add a code path that changes state without
emitting an event.

**Consequence for M3:** the animation layer already exists and already consumes a
stream of events. Your job is to replace the fixture source with the real engine
**without changing a line of the choreographer.** That seam is
`src/view/types.ts`; see "The seam" below.

### Stack and port

Electron 42 · Vite 8 · React 19 · TypeScript strict · zustand 5 · Tailwind 4
(`@tailwindcss/vite`) · `motion` 12.42.2 (import from `motion/react`) · Canvas2D
for particles · Vitest.

Dev port **5280, strictPort**. Everything below it belongs to sibling apps in this
workspace. 5281 = dev relay, 5282 = LAN listener (both M4).

---

## What already exists

**646 checks, 645 green.** 285 Vitest · 121 card-DB battery · 89 Electron probe ·
26 images battery (offline; 43 with network) · 125 animation battery. The single
failure is the perf gate's strict long-frame count — see D29, it is recorded with
its full measurement, not hidden.

**Verify it all still works before you start:**

```bash
cd "H:\Claude Apps\commanders-roundtable"
npm run build && npx vitest run          # 285 tests
npx electron scripts/probe.cjs           # 89 checks, against dist/ with the PROD posture
node scripts/battery-carddb.cjs          # 121 checks
node scripts/battery-images.cjs --offline # 26 checks
node scripts/battery-anim.cjs            # 125 checks (spawns its own Electron)
```

If the card database is missing (fresh machine), run
`node electron/cardsvc-worker.cjs --sync` (~73 MB, one time).

### Main process (`electron/`, all CommonJS `.cjs`) — unchanged since M1

| File | Responsibility |
|---|---|
| `paths.cjs` | The single data root: `~/.commanders-roundtable`. ⚠️ Read its header comment before changing it. |
| `window.cjs` | Window creation + all hardening (CSP, nav guard, permissions). Importable by the probe so it tests the real posture. |
| `capability.cjs` | Capability-gated filesystem. Every path-taking handler goes through it. |
| `ipc.cjs` | Every IPC channel in one place. Shared with the probe. |
| `jsonstore.cjs` | Atomic, BOM-free JSON read/write + schema coercion. |
| `settings.cjs`, `winstate.cjs` | Schema-validated settings; window bounds with off-screen recovery. |
| `updater.cjs` | electron-updater with the placeholder-owner skip. |
| `scryfall.cjs` | **The ONLY network access.** Host allowlist, byte caps, idle timeout, serialized rate limiter, resumable download. |
| `cardsvc.cjs` | Supervises the card-database worker: lazy start, ready-gated outbox, log ring, crash recovery. |
| `cardsvc-worker.cjs` | The worker (utilityProcess). Also a headless CLI. ⚠️ See D13. |
| `cardfold.cjs` | Name folding. Single source of truth — the renderer never folds. |
| `cardproject.cjs` | Scryfall's 63 fields → our `CardData`. |
| `cardindex.cjs` | Index build / offline rebuild / lazy maps / queries. |
| `cardimg.cjs` | The `cardimg://` privileged scheme serving cached art. |
| `cardimages.cjs` | Art URL derivation + the download queue. |
| `decks.cjs` | Deck CRUD, id-only, capability-gated, coerced both ways. |

### Renderer (`src/`)

```
src/
  main.tsx                     exposeCspCanary() then mount
  App.tsx                      hash + uiStore screen switch; PERSISTENT slots (table never
                               unmounts); MotionRoot; FxCanvas → FlightOverlay → FxOverlay;
                               Space = hold-fast-forward, Esc = flush
  devHandles.ts                window.__crt handles for CDP probes + the CSP canary
  index.css                    @theme static tokens, @layer base resets, keyframes
  styles/mana.generated.css    GENERATED — do not edit; see scripts/make-mana-css.cjs
  types/bridge.d.ts            ⚠️ SAME contract as electron/preload.cjs — change both together

  view/                        ⚠️ THE M2↔M3 SEAM
    types.ts                   PlayerView, CardView, SeatView, StackItemView, LogEntry,
                               EngineEvent (21 kinds), ZoneId, PHASES, bandFor, emptyView
    fixtures/table.ts          FixtureTable — M2's stand-in for the engine. NOT an engine.
                               ⚠️ Its view() preserves referential identity; see D21.
    fixtures/scenarios.ts      16 named scenarios, each returning (events, viewAfter) batches

  store/
    settingsStore.ts           + TIME_SCALE map for animation speed
    cardDbStore.ts             card DB + art queue status
    deckStore.ts               deck list, paste-import preview, validation
    gameStore.ts               view · epoch · commits · applyView · applySnapshot
    animStore.ts               ⚠️ may only HIDE or DECORATE — never card→zone truth
    layoutStore.ts             metrics + metricsEpoch (bumped only when something MOVES)
    handStore.ts               hovered hand index (store-injected, so it is assertable)
    uiStore.ts                 screen · tableLive · tableVisible

  ui/anim/                     THE MOTION SUBSYSTEM
    tokens.ts        (+test)   DUR/EASE/SPRING/STAGGER, d()/ds(), setAnimScale. ⚠️ D22.
    arc.ts           (+test)   PURE flight geometry: controlPoint, easedPathKeys, scaleKeys,
                               flipKeys, cubicBezierEase. ⚠️ D17, D23, D24.
    rectRegistry.ts            The ONLY legal getBoundingClientRect caller. register (React 19
                               cleanup ref) · readAll · readElements · resolve (card → zone
                               anchor → viewport centre, never throws) · per-frame cache (D28)
    flightLayer.ts             Module singleton: fly() / cancel() / cancelAll() / setSpeed().
                               Resolves on land OR cancel, never rejects. Self-reaps at 3 s.
    FlightOverlay.tsx          Clone renderer. perspective on the LAYER. ⚠️ D18 for the name.
    record.ts                  Per-rAF transform recorder + decomposeTransform + summarize
    coalesce.ts      (+test)   PURE event → BeatIntent, with the multi-hop collapse rule
    governor.ts                PURE speed governor + effectiveMode (4 triggers, 1 digest path)
    choreographer.ts           ingest · applySnapshot · flush · holdFastForward · stats ·
                               reset · injectHungBeat. Groups, lanes, beat timeouts, 250 ms
                               watchdog, 500 ms convergence reconciler, epochs.
    beats.ts                   All 13 named beats. Source rects read at BUILD (pre-commit).
    combat.ts        (+test)   PURE lunge/intercept geometry + the animations
    FxOverlay.tsx              Floating numbers + digest pulses. ⚠️ ALL FX TEXT IS DOM.
    fx/FxCanvas.tsx            Canvas2D, SoA pool of 1200, self-parking rAF, DPR per resize
    fx/fxBus.ts                burst/ring sink; a no-op when no canvas is mounted
    perf.ts                    rAF sampler + LoAF observer + rect-discipline monkeypatch
    MotionRoot.tsx             One MotionConfig, reducedMotion="user"

  ui/table/
    metrics.ts       (+test)   PURE. computeTableMetrics + the resolution ladder + SeatBoxes
    packRow.ts       (+test)   PURE. groupIdentical (auto-stack, D19) + packRow (owns the
                               exact rendered px, D26)
    fanGeometry.ts   (+test)   PURE. fanGeometry + partOffset (D25) + handCardPose
    useTableMetrics.ts         One rAF-coalesced ResizeObserver → store + CSS vars
    GameTable.tsx              Absolutely-positioned rows from metrics.rows
    TableSurface.tsx           Four static CSS layers, zero image assets
    PlayerPod.tsx              ONE component for my seat and an opponent's, mirrored
    BattlefieldBand.tsx        Grouping + packing + the untap row sweep
    PermanentStack.tsx         One slot: a card, or a pile with ×N and n/N untapped
    ZonePile.tsx               gy/exile/lib/cmd. ⚠️ Registers an anchor even when EMPTY.
    StackDisplay.tsx           LIFO column, newest on top, compresses past 5
    HandFan.tsx                Fan + hover intent (90 ms in / 60 ms out) + 1–9 keys

  ui/hud/                      PlayerPlate · LifeCounter (MotionValue, retargets) ·
                               CommanderDamageMatrix · ManaPool · PhaseTrack +
                               PriorityIndicator · GameLog (windowed, aria-live)

  ui/card/                     Card (4 modes, memoised, chrome/registerSlot/inFlight props) ·
                               SyntheticFace · useCardImage (memoised probes) ·
                               CardZoomPanel · ManaCost

  ui/screens/                  HomeScreen · DecksScreen · CardDatabaseScreen ·
                               TableScreen (persistent) · CardFixtureScreen (#cards) ·
                               TokenGalleryScreen (#tokens) · FlightTestScreen (#flight) ·
                               BeatsScreen (#beats)

  data/                        cardTypes · deckTypes · manaSymbols · decklist (+test) ·
                               validate (+test) · fixtures/cards
```

### What works right now

- Card database: **113,559 cards** from Scryfall `default_cards`. Cold index load
  255 ms, p95 name lookup 0.14 ms.
- Deck import: paste a Moxfield/Archidekt export → parsed, resolved, validated with
  per-line actionable errors, saved to disk, art prefetched.
- **The table renders a 4-player board with real Scryfall art**, seats at 2/3/4,
  auto-stacked piles, a hand fan with hover parting, a phase track, a game log.
- **The whole motion subsystem is live and verified**: card flights with mid-flight
  face flips, casts, resolutions with a thump, quiet land drops, staggered untap
  sweeps, damage numbers, deaths, tokens, reveals, attack lunges and block
  intercepts, particles.
- Driven by **16 fixture scenarios** on the `#table` dev panel (click `dev`), and
  through `window.__crt.table.run(id, { gapMs })`.

---

## The seam — the single most important thing to get right

M2 consumes exactly this, and it must not change:

```ts
// src/view/types.ts
choreographer.ingest(events: EngineEvent[], viewAfter: PlayerView): void
choreographer.applySnapshot(view: PlayerView): void        // reconnect / hard sync
```

- Events sharing a **`stepId`** are ONE group. Groups animate in order (LIFO stack
  resolution has to be *visible* in order); inside a group, beats with disjoint
  resource keys overlap. **So: emit one `stepId` per unit of engine work.** Getting
  this wrong is the difference between a table that reads as a sequence of events
  and one that reads as everything happening at once.
- A group's view commits when that group *starts*, so state leads animation by at
  most one group. Your engine does not need to know or care.
- `EngineEvent` has 21 kinds and the choreographer already maps every one of them
  to a beat. **Emit these shapes.** If you need a new event kind, add it to
  `src/view/types.ts` AND to `coalesce.ts` AND to `beats.ts` — a kind with no beat
  is silently invisible.
- Hiddenness is the **absence of data**: `CardView.card === null`. Never a flag.
  A component physically cannot leak what it was never given.
- ⚠️ **`project()` MUST preserve referential identity** for unchanged cards, seats
  and zone arrays. This is D21, and it is a measured performance requirement:
  without it every single event costs a ~50–83 ms long frame because the whole
  table restyles. `FixtureTable.view()` shows exactly how (field-by-field compare,
  reuse the previous object). Copy that pattern.

Replacing the source is then: build a real `PlayerView` + `EngineEvent[]`, call
`ingest`, delete nothing in `src/ui/`.

---

## M3 spec — distilled. The decisions below are made; do not re-litigate them.

`docs/specs/engine-net-spec.md` is the full reference. The essentials:

### State layout

**Flat map + ordered id arrays.** `cards: Record<InstanceId, CardInstance>` plus
`zones.hand[playerId]: InstanceId[]`, `zones.library[playerId]: InstanceId[]`, etc.
Chosen over nested arrays because every zone change is then an id splice (cheap,
easy to diff for the M4 wire patch) and a card is reachable in O(1) from any
reference — the stack, combat and attachments all hold ids, never objects.

**Derived characteristics are computed, never stored.** `derive(state, id)` runs the
CR layer pipeline with only layers 1 (base), 7b (counters) and 7d (manual override)
live in v1. Card scripts later add 6/7c with no call-site changes. A per-pass
`makeDeriveCache` keyed on `state.eventCount` keeps it cheap.

### Intents vs Events

Clients send `Intent` (`CastSpell`, `TapPermanent`, `PassPriority`,
`DeclareAttackers`, `ManualMoveCard`, `ProposeRewind`, …). Only the host runs
`handle(state, intent, rng) → Event[] | Reject`, then folds with
`apply(state, event) → state`. Randomness enters **only** through a seeded PRNG
whose `rngBefore`/`rngAfter` are recorded on the event, so replay is bit-exact.

### The loop

`pump()` iterates `advance()`, which does, in strict order:
1. a state-based-action pass, repeating until a pass yields nothing (CR 704.4);
2. a trigger drain in APNAP order;
3. return `[]` if blocked on human input;
4. turn-based actions for the step;
5. priority — grant, or resolve the top of the stack, or end the step (emitting
   `ManaPoolEmptied`).

Steps 1→2→3 in that order is what makes CR 117.5 structural rather than a
hand-rolled loop someone forgets to call.

### Auto-pass ("stops") is what makes it feel like Arena

`shouldAutoPass()` passes for you only when you have no *meaningful* action, where
`meaningfulActions` excludes tapping lands (else a player with one untapped land
never auto-passes) but never skips an available land drop. A
`[my turn | others' turns] × [10 steps]` toggle grid, `Ctrl` held to force a stop,
and `HoldPriority` as a one-shot.

### Mana auto-tap is a three-tier solver

A necessary-condition filter (O(|S|·6), memoized — this is what flags every card in
hand as affordable), then a greedy "spend the least flexible source first" pass
(~95% of boards), then min-cost max-flow only when greedy fails (V≤64, E≤340 → well
under 1 ms). Conditional sources ("spend only on…") are excluded from auto-tap but
stay manually tappable — the Tier-2/Tier-3 boundary made explicit rather than
guessed. Commander tax folds `2 × commanderCastCount` into the generic requirement,
and the counter increments *after* the cast completes.

### Casting is a resumable state machine in `GameState`, not UI state

`PendingCast` with stages `modes → targets → x → pay → ready`. That is the
difference between "Bob dropped while choosing targets" being recoverable and being
fatal.

### Projection is the entire hidden-information boundary

One file, `src/engine/project.ts`. Opponent hands become `{ id, hidden: true }`
entries, libraries become counts, face-down permanents show a sentinel oracle id to
everyone but their controller, and `legalActions`/`awaiting` payloads are stripped
for other players. **A bug here leaks hands.** Reconnect sends a full snapshot, not
a log replay, plus a state hash the client verifies.

### Defaults already adopted (all recorded in DECISIONS.md when you implement them)

Free first mulligan **on**; CR 903.9a commander-to-command-zone = **ask, with
"always do this"**; Tier-2 keywords include landwalk/fear/intimidate/skulk/shadow/
horsemanship and ward-as-tax, while phasing and changeling are out; combat damage
auto-assigned with an opt-in "let me assign" stop; a disconnected player the game is
waiting on **pauses indefinitely** with a "pass for &lt;name&gt;" button anyone can
use (every such pass is a logged event); two commanders supported (Partner /
Partner with / Background / Friends forever / Doctor's companion, plus the one-entry
Grist override); restricted mana ignored in v1 (marked `conditional`, excluded from
auto-tap); CR 103.7 encoded as written (only a two-player game skips the first
draw); real instance ids for opponent hands (friends-only trust model).

---

## Build order for M3, with verification per step

From the approved plan and spec §9. Steps 1–11 are Vitest; 12 crosses into the DOM.

1. **`rng` / `hash` / `ids`.**
   → known-answer vectors; `nextBelow` unbiased over 10⁶ draws; `canonicalJson`
   key-order independent.
2. **Types + the purity test.** All of `src/engine/types/*`, `oracle.ts`,
   `keywords.ts`. No logic yet.
   → `tsc -b` clean; **a Vitest regex test asserting nothing under `src/engine/`
   imports `react|electron|node:|fs|path|zustand` and nothing calls `Date.now()`,
   `Math.random()` or `performance.now()`.** Write this test in step 2, not step 11
   — it is worth nothing after the fact.
3. **`src/data/` ingest.** `parseManaCost`, `parseTypeLine`, `parseKeywords`,
   `parseProtection`, `parseManaProduction`, `oracleIndex`.
   → ~60 hand-picked cards (basics, Command Tower, Sol Ring, an MDFC, a split, a
   `{2/W}` hybrid, a phyrexian card, `protection from red`, `ward {2}`,
   `plainswalk`, a `*`-P/T card). Then the **whole bulk file** with zero throws, and
   record the count of ingest warnings by category in `DECISIONS.md` — that number
   is the honest measure of Tier-2 coverage.
4. **`derive()` + an empty script registry.** Layers 1/7b/7d only.
   → base P/T; `+1/+1` counters; `ptOverride`; face-down = 2/2 colourless; a
   `*`-P/T card is 0/0 without a script. Plus **one fixture card script** proving a
   script is purely additive and that a script-less card is zero registrations.
5. **Zones + reducer + `assertInvariants` + `log.replay`.**
   → a card through all 7 zones, asserting battlefield-only fields reset,
   attachments detach, and invariants hold after each; `replay(log)` hash equals the
   live hash.
6. **Setup + London mulligan.** → 11 scenarios.
7. **Turn structure + SBAs + triggers + `pump`/`advance` + `legalActions` +
   auto-pass.** → 17 scenarios; a 4-player game runs **40 turns of nothing but
   passes** without hitting the iteration cap; a fixture trigger fires on
   `StepBegan{upkeep}` and lands on the stack in APNAP order.
8. **Mana + payment + casting + stack + priority.** → 18 scenarios, plus a
   **benchmark** asserting the max-flow tier completes in under 1 ms on a synthetic
   40-source board (the complexity bound measured, not asserted).
9. **Combat + commander damage.** → 20 scenarios. The **16-case keyword matrix** is
   where the test table earns its cost: this is exactly the surface that regresses
   silently.
10. **Tier-3 manual tools + group rewind.** → 8 scenarios, including "replay after a
    mixed automatic/manual game yields an identical hash".
11. **`project` + `redactEvent` + view diffing + THE REPLAY-EQUIVALENCE FUZZER.**
    500 seeds × 200 random legal intents, asserting invariants after every event and
    replay-hash equality.
    → **This is the gate. Networking does not start until it is green.**
    Also assert: an opponent's hand projects to `card: null` for every entry, and a
    library projects to a count — grep the projected JSON for any oracle id that
    belongs to a hidden card.
12. **Wire the real engine to the M2 table.** `PromptBar`, the casting flow with
    auto-tap review, aim-veil targeting, the stops policy panel, the manual-tools
    drawer and the card context menu.
    → exactly the legal targets compute `pointer-events: auto` and everything else
    `none`; `Escape` backs out one step; a stops audit over a full turn cycle matches
    the configured set; **grep `src/` for `window.prompt|window.confirm|window.alert`
    → zero hits**; and `node scripts/battery-anim.cjs` **still passes**, driven by
    the real engine instead of fixtures.

Then **play a full 4-seat game solo, start to finish, and report.**

### Two things to add to the harness rather than invent from scratch

- **`scripts/battery-anim.cjs` is your integration harness.** Add an `engine`
  section to it. It already handles spawning Electron with rAF throttling disabled,
  the hard reload, layout settling, and the console-error filter.
- **The fixture scenarios are your regression net.** Once the engine drives the
  table, `window.__crt.table.run('combat4p')` should still converge — but now
  through real rules. Keep `FixtureTable` alive as a test double; do not delete it.

---

## ⚠️ Traps that will cost you time

Every one of these has already cost real debugging time in this project or its
siblings. **Never shorten this list.**

### Probing and verification

1. **Restart the Vite dev server before probing** after an edit session. With HMR
   active, modules resolve as `file.ts?t=<stamp>`, so a probe's
   `await import('/src/…')` loads a **second** instance — you read a ghost zustand
   store and every assertion lies. Reach state through `window.__crt` handles.
2. **A battery that reuses a long-lived vite can load a STALE module graph.** M2's
   own lesson: a freshly spawned Electron loaded an old module, so the copy of
   `rectRegistry` the beats had closed over was not the copy the live components had
   registered into. `elementFor()` returned null and every in-place beat quietly
   slept — recorded as "90 frames, 1 distinct matrix", which reads as "the beat does
   not animate". A clean reload made the same beat report 65 distinct matrices.
   `battery-anim.cjs` now does `Page.reload({ ignoreCache: true })` first. Keep it.
3. **Launch with `--disable-backgrounding-occluded-windows
   --disable-renderer-backgrounding`.** An occluded window freezes rAF and throttles
   timers to 1 s, so an animation probe "hangs" in a way that looks exactly like a
   code regression.
4. **The debugger bypasses CSP.** Anything `Runtime.evaluate` runs — including a
   `<script>` it creates — is exempt. Measured: `eval()` blocked under a headless
   `file://` load, "allowed" under `--remote-debugging-port` with the *identical*
   CSP header. Read `window.__crt.csp`, measured by bundled code.
5. **Never pass `replMode: true` to `Runtime.evaluate`.** It silently defeats
   `awaitPromise` — every promise-returning expression comes back as `{}`, which
   reads as "the assertion returned nothing" rather than a client bug.
6. **Don't synthesize pointer drags.** If the real mouse is over the Electron
   window, genuine and synthetic pointermoves interleave and corrupt the gesture.
   Assert on store-injected state instead — `useHandHover` exists for exactly this.
7. **Wait for the layout to SETTLE before sampling geometry.** Unhiding the
   persistent table slot and any device-metrics override both reflow asynchronously
   (a `display: none` element measures 0×0). Sampling mid-reflow produced hand-fan
   offsets wrong by a smoothly increasing amount per slot — which reads exactly like
   a broken falloff formula rather than like a race. Use `waitForStableLayout()` and
   assert `metricsEpoch` did not move across the measurement.
8. **Measure LAYOUT boxes, not client rects, for anything rotated.** A tapped card
   is rotated 20.5° and `getBoundingClientRect` returns its enlarged axis-aligned
   box — a 101×141 card measures 144 px wide. Asserting no-overlap on client rects
   reported a 6 px "overlap" between two correctly packed cards. Use
   `offsetWidth`/`offsetHeight`, or `decomposeTransform` for a rotated fan card.
9. **Normalise a recorded animation track against the REQUESTED duration**, not the
   observed window. A recording starts on the frame the clone first exists and stops
   when it unmounts, so dividing by the observed span inflated a measured flip time
   from 0.50 to anywhere in 0.52–0.60 depending on frame alignment.
10. **Measure at the right layer.** A rate-limit check timestamped at the wrong layer
    reported ~1 ms gaps for a transport that was correctly paced 103 ms apart. Ask
    what layer the property actually lives at before instrumenting.
11. **Dev handles must never close over component state or setters.** A `goto()` that
    captured `setScreen` from a replaced HMR instance silently did nothing, and the
    probe reported "the screen has no cards" — indistinguishable from a render bug.
    Use refs or read-through functions.
12. **`preview_start` (the preview MCP) does not work** with the Electron apps in
    this workspace. Use `scripts/probe.cjs`, `scripts/battery-anim.cjs` and
    `scripts/cdp.cjs`.
13. **Don't trust a `.replace()` that you did not assert on.** Two silent
    no-op patches in M2 cost a debugging round each: a signature change that never
    applied, so a later line referenced an undefined parameter. If you patch a file
    programmatically, `assert old in s`.

### Animation and rendering (new from M2)

14. **`project()` must preserve referential identity.** D21. Without it every event
    costs a 50–83 ms long frame. This is the biggest single perf lever in the app.
15. **`motion` silently no-ops a multi-keyframe array with a spring transition.**
    D22. `animate(el, { scale: [1, 1.06, 1] }, SPRING.nudge)` does nothing, with no
    error. Use `{ duration, ease }` for there-and-back.
16. **Don't ease the driving MotionValue if keyframe times are meant to be
    wall-clock.** D23. Easing the driver put the mid-flight face flip at 32% of the
    flight instead of 50%.
17. **`filter: blur` and `backdrop-filter` are not cheap.** D27. One
    `backdrop-blur` per card meant ~50 backdrop filters on a 4-player board; four
    simultaneous badge blurs cost 5 long frames and a 108 ms maximum.
18. **An always-mounted screen must not do work until it is looked at.** D31. The
    table's mount effect forked the card-DB worker at app startup and defeated its
    lazy start. Gate on visibility.
19. **`animStore` may only HIDE or DECORATE.** Never put card→zone truth in it. That
    invariant is why the worst possible animation failure is a card invisible for a
    moment rather than a desync.
20. **Two files differing only in case break `tsc` on Windows.** D18. `flightLayer.ts`
    + `FlightLayer.tsx` is a TS1149 error and the resolved import depends on
    compilation order.

### CSS (Tailwind 4)

21. **`@theme static` — do not drop the `static`.** Tailwind 4 tree-shakes theme
    variables, emitting only those it finds as literal text. Tokens composed
    dynamically (`identityToken()` builds `var(--color-mtg-${letter})`) are omitted,
    and an undefined var inside `color-mix()` makes the browser discard the **whole
    declaration** — cards silently lost background *and* box-shadow, but only the
    single-colour ones. No error, no warning. See D12.
22. **A Tailwind class composed at runtime is never emitted at all.** `p-${n}` does
    not exist in the output. Write utility names literally. (This bit the 111-utility
    canary itself, which would have reported a false alarm forever.)
23. **Never add an unlayered universal reset.** `* { margin:0; padding:0 }` outranks
    `@layer utilities` and silently zeroes every spacing utility — it zeroed 111
    utilities across two sibling apps. Resets go in `@layer base`.
24. **`@theme` must become `@theme inline`** the moment a token value references a
    scope-local var, or every `border-*` falls back to `currentColor`.

### Electron / Node

25. **`window.prompt()` / `confirm()` / `alert()` throw in Electron.** Every text or
    number input needs a real dialog. A probe greps for these. **M3's Tier-3 tools
    and any "name this token" flow will hit this.**
26. **Attach stream/event listeners once, outside loops.** A per-iteration
    `once('error')` accumulated 113k listeners; fixing it (and the per-line Promise)
    cut a build from 40.6 s to 18.6 s. A "cosmetic" Node warning was pointing at a
    2× slowdown.
27. **`utilityProcess.fork` runs its target as `require.main`** — guard any dual-mode
    CLI block with `!process.parentPort`. See D13.
28. **Electron logs `sandboxed_renderer.bundle.js script failed to run` whenever
    `--remote-debugging-port` is attached.** It is Electron's own bundle throwing in
    the DevTools frame, which has no preload. `battery-anim.cjs` filters console
    errors by **origin** (whole stack inside `node:electron/js2c`) and separately
    asserts that the preload bridge is intact and IPC round-trips — so the message is
    dismissed on evidence, not on wording.

### General

29. **A queue needs someone to restart it.** Work stranded twice in the art queue
    (backoff timers firing after workers exited; enqueue racing the end of a run).
    The choreographer has exactly this shape and re-checks for work in a `finally`
    **after** clearing its `running` flag. Your `pump()` will have it too.
30. **Inject the failure you are claiming to survive.** `injectHungBeat()` exists
    because a queue that cannot survive one hung beat will eventually strand a real
    player with no way out but a reload, and the failure would be unreproducible.
    Build the equivalent for the engine loop.
31. **The user's standing rule: never reduce resolution or fidelity to save memory or
    time.** They have 128 GB RAM and an RTX 3060. Always request Scryfall `png`
    (745×1040). Use workers/parallelism for speed, never a quality cut.

---

## Verification commands

```bash
cd "H:\Claude Apps\commanders-roundtable"

npm run dev              # browser only (window.crt is undefined, by design)
npm run electron:dev     # Vite + Electron
npm run desktop          # what the desktop shortcut runs (reuse-or-start, launch.log)
npm run build            # tsc -b && vite build
npm run test             # vitest (src/**/*.test.ts)

# headless probe against dist/ with the PRODUCTION posture
npm run build && npx electron scripts/probe.cjs

# the animation / integration battery (spawns its own Electron)
node scripts/battery-anim.cjs
node scripts/battery-anim.cjs flight table hand choreo beats hud fx combat perf
node scripts/battery-anim.cjs --keep     # leave it running to poke at

# live renderer
npx electron . --dev --remote-debugging-port=9223 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
node scripts/cdp.cjs "expression"
node scripts/screenshot.cjs out.png --wait 900 [--full]

# card data / art
node scripts/battery-carddb.cjs
node scripts/battery-images.cjs [--offline]
node electron/cardsvc-worker.cjs --sync | --status | --reindex | --query "sol ring"
```

**Two tools, two jobs.** Vitest for pure TS in `src/` — the engine, net, data, and
now the animation maths, all of which are pure. CDP/headless probe for anything
touching Electron, the DOM, or real rendering.

**Extend the existing suites rather than replacing them** — all 646 checks must stay
green (645 passing; the one known failure is D29 and is documented).

---

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` (so optional fields need
  `...(x !== undefined ? { x } : {})` rather than `x: undefined`).
- React function components; zustand for state; Tailwind 4 with `--crt-*` OKLCH
  tokens.
- All UI copy in English, active voice, **written from the user's side** ("Cast
  Sol Ring", not "Submit"). Errors say what happened **and** what to do.
- `electron/preload.cjs` and `src/types/bridge.d.ts` are the **same contract** —
  change both together.
- **`src/engine/` must not import React, Electron, Node or zustand, and must not
  call `Date.now()`, `Math.random()` or `performance.now()`.** Write the regex test
  that enforces this in step 2.
- Nothing outside `src/ui/anim/tokens.ts` may hard-code a millisecond value for a
  beat; everything goes through `d(ms)`.
- Comments explain **why**, and carry the ⚠️ marker plus the concrete failure when
  documenting an invariant. Match the density of the existing files — they are
  dense on purpose, and every ⚠️ in them is a bug that actually happened.
- Record any non-obvious decision in `docs/DECISIONS.md` with its reason, and update
  the "Milestone status" checklist in `AGENTS.md` when a step completes.
- End a fully-finished response with `---Done---` on its own line (workspace rule).

## Working style the user expects

- **Ask clarifying questions as clickable multiple choice** (the AskUserQuestion
  tool) — they prefer clicking to typing. Never a plain-prose question.
- Verify claims; don't assert them. When something looks wrong, **measure it** rather
  than reasoning from the symptom. In M2 the majority of bugs were the opposite of
  what the symptom suggested: a "broken falloff formula" was a reflow, a "beat that
  does not animate" was a stale module graph, and "React is too slow" was one missing
  object-identity check.
- Report failures with the output. Say plainly what is done and what is not.
- Don't spawn subagents or run workflows unless asked.

## What comes after M3 — and your last task

⚠️ **This document is a brief for M3 only.** The reference material for M4 and M5 is
preserved in-repo (`docs/specs/engine-net-spec.md` §7 has the full wire protocol,
projection and relay design; `docs/specs/approved-plan.md` has the build order and
sign-off for all five milestones), but there is no milestone brief for M4–M5 yet.

That is on purpose. A brief written today for M4 would be guessing at what M3
actually produces, and every milestone so far has diverged from the spec in ways
worth recording — M1 changed the download endpoint (D10a) and made the index maps
lazy (D12a); M2 changed the scale basis (D17), the flight-ease location (D23), the
arc's sign rule (D24) and found that projection identity was the dominant perf
factor (D21). You will know what the engine really looks like; the plan only guesses.

**So your final task, after M3 is verified and reported, is to write
`docs/M4-HANDOFF.md`** in the same shape as this file:

1. The task, and where to stop.
2. Read-these-first table (add anything new you created).
3. What the app is + architecture — lift these verbatim; they have not changed.
4. **What exists now** — update the file inventory and the verification totals. Be
   accurate; a stale inventory is worse than none.
5. The M4 spec, distilled from `docs/specs/engine-net-spec.md` §7 the way this file
   distilled the engine sections. State the decisions, don't re-open them.
6. Build order with a verification per step.
7. **The traps** — carry this file's list forward, *plus* whatever M3 taught you.
   That list is the most valuable part of the handoff; it is the accumulated cost of
   every wrong turn so far. Never shorten it.
8. Conventions, working style, do-not.

Then tell the user the file exists and how to use it.

### The remaining milestones, in one line each

| | What it delivers | Sign-off |
|---|---|---|
| **M4** | Multiplayer: wire protocol, per-player view filtering (`project()` is the entire hidden-information boundary — a bug there leaks hands), loopback → relay → direct-IP transports, reconnect via full snapshot, the `relay/` package. Widening the prod CSP's `connect-src` happens here and must be recorded in DECISIONS.md with its reasoning. | You and a friend play a real game over the relay; one of you drops and rejoins. |
| **M5** | Tier-2 keyword coverage pass, reduced-motion/skip wiring, remaining screens, NSIS installer, bundle audit (**no `relay/` in `app.asar`, no card art anywhere under `release/`**), install-and-confirm-it-reads-the-same-data-root (the MSIX proof), full offline audit, and `docs/INSTALL-AND-PLAY.md` for the friends. | An installer the user can send to friends. |

## Do not

- Do not start M4. Stop at the end of M3, report, and write `docs/M4-HANDOFF.md`.
- Do not start networking before the replay-equivalence fuzzer is green.
- Do not change `src/view/types.ts`'s existing shapes without also updating
  `coalesce.ts` and `beats.ts` — an event kind with no beat is silently invisible.
- Do not use `layoutId`, PixiJS, or a WebGL FX layer.
- Do not put card→zone truth in `animStore`.
- Do not add an internet dependency. Approved exceptions are only: Scryfall bulk
  data, Scryfall card art, the M4 relay/LAN transport, and electron-updater.
- Do not bundle card art into the repo or the installer — it is Wizards' copyright,
  fetched per-user at runtime.
- Do not weaken the CSP, the capability gate, or the SSRF host allowlist.
