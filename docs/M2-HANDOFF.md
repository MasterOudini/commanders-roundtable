# Session handoff — build M2 (the animated table)

Paste this whole file as your opening prompt, or say
*"read `H:\Claude Apps\commanders-roundtable\docs\M2-HANDOFF.md` and build M2"*.

---

## Your task

Build **M2 — the animated table** of Commander's Roundtable, at
`H:\Claude Apps\commanders-roundtable`.

M1 is complete and verified. M2 is the milestone the user cares most about: they
asked specifically for *"animations when drawing cards, putting cards inside them,
which are similar to MTG Arena, the game."* Treat the motion as a first-class
subsystem, not polish.

**M2 is deliberately built with NO rules engine.** The table is driven by canned
fixture scenarios so the user can judge whether the motion reads as Arena before
the engine exists. This ordering is intentional: this workspace has two
fully-built features that were reverted because they looked wrong on real data.
Getting a reaction now is far cheaper than after M3.

Stop at the end of M2 and report. Do not start M3.

---

## Read these first

| File | Why |
|---|---|
| `H:\Claude Apps\commanders-roundtable\AGENTS.md` | Canonical project instructions. Loaded automatically via `CLAUDE.md`. Read the ⚠️ sections properly. |
| `docs/DECISIONS.md` | 20+ numbered decisions with reasons. **Read before "fixing" anything that looks odd** — most entries exist because the obvious alternative was tried and failed. |
| `docs/specs/ui-animation-spec.md` | **The detailed M2 design spec.** Motion token table, per-beat transform specs with numbers, choreographer design, layout math, component tree. This is your primary reference. |
| `docs/specs/approved-plan.md` | The user-approved plan for all five milestones. |
| `docs/specs/engine-net-spec.md` | M3/M4 spec. Skim only — useful for knowing what shape the engine will have, so M2's interfaces fit it. |
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
│ │ src/engine/  PURE + DETERMINISTIC│ │   │ │ src/engine/ present but IDLE   │ │
│ │  handle(intent) → Event[]        │ │   │ │  (replay / rewind only)        │ │
│ │  apply(state, event) → state     │ │   │ └────────────────────────────────┘ │
│ │  append-only log (NDJSON on disk)│ │   │ ┌────────────────────────────────┐ │
│ │  project(state, playerId) → View │ │   │ │ PlayerView + redacted events   │ │
│ └───────────────┬──────────────────┘ │   │ └──────────────┬─────────────────┘ │
│  own PlayerView │  redacted events   │   │                │                   │
│ ┌───────────────▼──────────────────┐ │   │ ┌──────────────▼─────────────────┐ │
│ │ CHOREOGRAPHER → beats → React UI │ │   │ │ CHOREOGRAPHER → beats → React  │ │  ← M2
│ └──────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ MAIN: card DB · art cache · decks    │   │                                    │
└──────────────────────────────────────┘   └────────────────────────────────────┘
```

**The invariant everything rests on:** every state change — including all Tier-3
manual tools — goes through an event appended to the log. Nothing mutates state
off-log. That gives replay, reconnect, group rewind, the trigger bus, and the
animation cue stream for free. Never add a code path that changes state without
emitting an event.

**Consequence for M2:** the UI is driven by a *stream of engine events*, which is
a gift for animation — each event (`CardDrawn`, `CardMoved`, `SpellCast`,
`DamageDealt`, `LifeChanged`, `PermanentTapped`) is an animation cue. Your
choreographer consumes that stream. In M2 the stream comes from fixture
scenarios; in M3 the real engine replaces the fixture source with **no change to
the choreographer**. Design that seam cleanly.

### Stack and port

Electron 42 · Vite 8 · React 19 · TypeScript strict · zustand 5 · Tailwind 4
(`@tailwindcss/vite`) · **`motion` 12.42.2** (the framer-motion successor; import
from `motion/react`) · Canvas2D for particles · Vitest.

Dev port **5280, strictPort**. Everything below it belongs to sibling apps in this
workspace. 5281 = dev relay, 5282 = LAN listener (both M4).

---

## What already exists (M1, complete and verified)

**370 checks green: 129 Vitest · 121 card-DB battery · 43 images battery · 77 Electron probe.**

### Main process (`electron/`, all CommonJS `.cjs`)

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
  main.tsx                    exposeCspCanary() then mount
  App.tsx                     hash-based screen switch (no router — 8 screens, no deep links)
  devHandles.ts               window.__crt handles for CDP probes + the CSP canary
  index.css                   @theme static tokens, @layer base resets, keyframes
  styles/mana.generated.css   GENERATED — do not edit; see scripts/make-mana-css.cjs
  types/bridge.d.ts           ⚠️ SAME contract as electron/preload.cjs — change both together
  data/
    cardTypes.ts              CardData, CardFace, CardLayout, modeForHeight, identityToken, CARD_ASPECT
    deckTypes.ts              DeckEntry, DeckFile, ValidationIssue, ValidationReport, ResolvedEntry
    manaSymbols.ts            Scryfall cost string → mana-font classes
    decklist.ts  + .test.ts   parser (65 tests)
    validate.ts  + .test.ts   Commander legality (64 tests)
    fixtures/cards.ts         10 hand-written CardData covering every layout, REAL scryfall ids
  store/
    settingsStore.ts          + TIME_SCALE map for animation speed
    cardDbStore.ts            card DB + art queue status
    deckStore.ts              deck list, paste-import preview, validation
  ui/
    card/Card.tsx             4 render modes, chrome overlay, tap/sick/damage/pile states
    card/SyntheticFace.tsx    the cold-cache fallback — fully playable, never blank
    card/useCardImage.ts      4-step fallback chain (png → art_crop → synthetic)
    card/CardZoomPanel.tsx    hover zoom with full oracle text
    card/ManaCost.tsx         mana-font pips with an aria-label
    screens/HomeScreen.tsx        shell diagnostics
    screens/DecksScreen.tsx       deck list + paste-import + validation UI
    screens/CardDatabaseScreen.tsx  sync + art cache
    screens/CardFixtureScreen.tsx   dev `#cards` — every layout × 5 size bands
```

### What works right now

- Card database: **113,559 cards** from Scryfall `default_cards`. Cold index load
  255 ms, p95 name lookup 0.14 ms.
- Deck import: paste a Moxfield/Archidekt export → parsed, resolved, validated
  with per-line actionable errors, saved to disk, art prefetched.
- Card art: real Scryfall `png` (745×1040) cached locally, sharded by id.
- `Card` renders at 96/120/148/208/320 px with correct mode selection, and falls
  back to a legible typeset face when art is absent.

**Verify it still works before you start:**

```bash
cd "H:\Claude Apps\commanders-roundtable"
npm run build && npx vitest run
node scripts/battery-carddb.cjs
npx electron scripts/probe.cjs
```

If the card database is missing (fresh machine), run
`node electron/cardsvc-worker.cjs --sync` (~73 MB, one time).

---

## M2 spec — the animated table

`docs/specs/ui-animation-spec.md` is the full reference with every number. The
decisions below are already made; **do not re-litigate them.**

### The flight mechanism: portal overlay + FLIP on a clone

**Not `layoutId` / `LayoutGroup`.** It animates the element in its *new* DOM
parent, so `overflow:hidden` on the hand clips the in-flight card; it matches
sizes with `transform: scale()`, distorting all ~20 card sub-elements; and it is
render-driven, so it cannot be sequenced, coalesced or skipped — which makes the
whole backpressure design impossible.

**Not View Transitions.** Only one can run at a time; a Commander table routinely
animates three things at once.

**⚠️ No `layoutId` anywhere in this app.** Exactly two mechanisms:

- **Local beats** — declarative `animate`/variants on cards *inside* their zone
  (tap, lift, thump, fan reflow, hover, shimmer).
- **Zone→zone** — the imperative flight layer.

Because the flight layer is rect-to-rect, **arbitrary zone→zone is the default
path, not a special case** — which is exactly what the Tier-3 "move any card
anywhere" tool needs.

```ts
// src/ui/anim/rectRegistry.ts — the ONLY legal caller of getBoundingClientRect
type ZoneId  = `${'hand'|'bf'|'gy'|'exile'|'lib'|'cmd'}:${PlayerId}` | 'stack';
type SlotKey = `card:${string}` | `zone:${ZoneId}`;
register(key: SlotKey, el: HTMLElement): () => void   // React 19 cleanup-returning ref
readAll(keys: SlotKey[]): Map<SlotKey, DOMRectReadOnly>  // batched, no interleaved writes
resolve(cardId, zone): DOMRectReadOnly   // card slot → zone anchor → viewport centre; NEVER throws

// src/ui/anim/flightLayer.ts — module singleton
fly(spec: FlightSpec): Promise<void>   // resolves on land OR cancel; never rejects
cancel(instanceId): void               // snaps to destination, resolves
```

Every card slot registers `card:<instanceId>`; every zone registers
`zone:<zoneId>` on an anchor element (pile top, hand-count chip, library stack).
That three-tier resolution with a viewport-centre floor is why hidden zones and
collapsed pods need no special handling.

**Handoff is commit-then-fly** (this is the flash-free part):

1. Read the source rect **before** any state write (batched `readAll`).
2. Mark `inFlight` and commit the view.
3. React renders the destination slot with `visibility: hidden` — it still
   occupies layout, so destination geometry is final, and **the hand re-fans
   immediately while the card flies**, which is exactly Arena.
4. Read the destination rect in `useLayoutEffect`, start the clone.
5. On land, clear `inFlight` in the same frame the clone unmounts.

One MotionValue and zero React renders per flight. Arc is a quadratic bezier
bowed away from the nearest viewport edge. `perspective: 1400px` on the **layer**,
not per card — one shared vanishing point reads as a real table.

### Motion tokens (`src/ui/anim/tokens.ts`)

Nothing hard-codes ms; everything goes through `d(ms)` which divides by the
settings `timeScale`.

```
DUR:  microTap 120 · hoverLift 160 · tap 180 · zoomIn 140 · fanReflow 220
      landDrop 200 · landThump 260 · resolve 300 · blockSlide 300 · revealFlip 340
      attackLunge 340 · flourish 360 · draw 420 · deathDrop 440 · damagePunch 480
      castFlight 520 · lifeCount 520(formula) · podExpand 320 · diceRoll 700
STAGGER: draw 60 · fanArrive 28 · untapSweep 34 · attackers 50 · blockers 40 · stackSlideUp 40
EASE: out [.16,1,.30,1] · flight [.30,.05,.20,1] · overshoot [.34,1.56,.64,1] · impact [.20,.90,.10,1.02]
SPRING: tap{520,26,0.7} · settle{visualDuration .26, bounce .34} · lift{.16,.12}
        thump{.22,.42} · fan{.22,.10} · nudge{700,30,0.6}
```

Why these read as Arena: nothing exceeds 520 ms except the life counter; the
settle always overshoots; taps are 180 ms so the board never feels gummy.

### The beats

Full transform/opacity keyframes are in the spec. Summary:

- **draw** (library→hand) 420 ms, arc 0.22, stagger 60 (`min(60, 420/n)` so a
  7-card opening hand is 780 ms not 4 s), `rotateY 180→0` crossing 90° **at the
  apex** so the card flips face-up mid-flight, settling with overshoot. Opponent
  draws use `faceMode:'back'` to the hand-count chip, whose number nudges.
- **hand hover** lift 54 px, scale 1.10, rotate→0; neighbours part by
  `26·e^(−0.55·|i−h|)` px; 90 ms open / 60 ms close intent delay; zoom panel at
  180 ms sustained hover.
- **cast** 100 ms lift → 520 ms arc-to-stack (arc 0.18) with a travelling
  colour-identity glow; hand re-fans concurrently → 360 ms stack flourish (ring +
  26-particle burst).
- **resolve→battlefield** 300 ms accelerating down + 260 ms `SPRING.thump`
  squash-and-rebound + 14 dust particles.
- **land drop** a deliberately quiet 200 ms — lands happen 40× a game; no dust,
  no ring. That restraint is what keeps the table from feeling like a slot machine.
- **tap** 180 ms spring, rotate 20.5°, `transformOrigin: 50% 62%` (a real card
  pivots where your thumb holds it), brightness 0.78. Untap-all sweeps the row at
  34 ms stagger.
- **attack lunge** 340 ms toward the defending pod + a canvas ribbon.
- **block intercept** 300 ms to a computed midpoint that keeps both cards visible.
- **damage punch** 480 ms **DOM** number, overshoot 1.34, floats up and out.
- **death** 440 ms desaturate-and-drop → 300 ms flight to the graveyard pile.
- **token pop**, **reveal flip**, and **generic zone→zone** (arc 0.14, 380 ms) —
  every named beat above is a parameterisation of the generic one.

⚠️ **All FX text is DOM, never canvas.** That means the canvas never rasterizes a
glyph, which *structurally* satisfies this workspace's tofu rule — no
`document.fonts.load()` race can bake tofu into a texture. Put that in a comment
above `FxCanvas`.

### The choreographer (`src/ui/anim/choreographer.ts`)

The event→beat bridge, and where the hard problems live.

```ts
ingest(events, viewAfter)   // the ONLY entry point
applySnapshot(view)         // hard sync, bumps epoch
flush()                     // Esc: commit everything now
setTimeScale(n) · holdFastForward(on) · stats() · reset()
```

- Events sharing an engine step form a **group**. Groups run in order (LIFO stack
  resolution must be *visible* in order). Within a group, beats with disjoint
  resource `keys` run concurrently; beats sharing a key serialize. Lane caps:
  `card` ≤ **6** concurrent flights; `overlay`/`hud` unbounded.
- **Lag model:** a group's view commits to `gameStore` when that group *starts*,
  so state leads animation by at most one group (~500 ms), never a whole batch.
  `promptStore` updates from the newest view **immediately** — whose priority it
  is can never lag. That is what keeps input responsive.
- **Speed governor** on queued ms: ≤600 → 1.0× · 600–1800 → lerp to 2.5× ·
  >1800 → 3.0× + coalescing · >4000 or >24 groups → **drain** (commit newest view,
  120 ms zone-flash digests, hard-sync).
- **Coalescing:** n draws → one staggered beat · n taps in a row → one row sweep ·
  life changes **retarget** the running counter (never queue two) · damage to one
  target sums into one punch · **A→B→C for one card in a group flies only the last
  hop** (cast → countered → graveyard must not fly to a stack you already know it
  left).
- **Failsafes so a dropped animation can never wedge the UI:** every beat is
  `Promise.race([run(), timeout(3×duration + 400)])`; a 250 ms watchdog drops to
  drain after 2 s of no progress; the flight layer self-reaps clones older than
  3 s; an **`epoch`** counter discards any beat built before a reconnect.
- **Convergence guarantee:** `animStore` may only *hide* or *decorate* — it never
  holds card→zone truth. So the DOM's zone membership is always authoritative
  state, the worst failure is a card invisible for the flight duration, and a
  reconciler clears orphaned `inFlight` entries every 500 ms.
- **Reconnect** → `applySnapshot()`: reset queue, cancel all flights, bump epoch,
  set state, one 240 ms table fade + "Resynced" toast. No animation.
- **Skip/speed:** settings `Cinematic 1.0× / Brisk 1.4× / Fast 2.2× / Off`
  (already in `settingsStore.ts` as `TIME_SCALE`); hold **Space** sets every live
  `AnimationPlaybackControls.speed = 4`; **Esc** flushes to the final pose.
  `prefers-reduced-motion` ∥ speed Off ∥ inactive table ∥ drain all route to the
  same **digest mode** — no clones, a 140 ms fade + outline pulse instead. The
  game log carries the full narrative so no information is lost.

### FX canvas: Canvas2D + rAF, **not** WebGL

1200 additive 4–10 px sprites at 1080p on an RTX 3060 is nowhere near a
bottleneck; a second GPU context would compete with the compositor for nothing.
SoA pool (8 × `Float32Array(1200)` = 38 KB), one
`globalCompositeOperation='lighter'` batch, DPR **re-read on every resize**
(Windows display scaling changes at runtime), and the loop **parks itself**
(`cancelAnimationFrame`) when idle — a canvas rAF that never sleeps is a
permanent ~3 % CPU tax. Per-card glow stays CSS `drop-shadow` so it travels with
the flight clone for free.

### Layout

- Arena-style table: **my hand at the bottom, my battlefield above it, opponents'
  battlefields across the table**, plus a shared stack display.
- Always visible: each player's life total, a **commander-damage matrix**, mana
  pools, current phase, whose priority it is.
- **Scaling: a JS scale factor, not `clamp()`/container queries** — see the spec's
  §3 for the vertical budget at 1080p and the `packRow` resolution ladder.
- **Auto-stack identical permanents** (12 Forests → one `Forest ×12` pile). This
  is **load-bearing**: a 4-player board does not fit at 1080p without it.
- Minimum readable card height is 96 px (`modeForHeight` in `data/cardTypes.ts`
  already encodes the bands).

### Visual direction (already established in `src/index.css`)

Deep desaturated blue-green table so the five saturated MTG colours read on top,
with a **brass accent that is deliberately not one of the five** so an accent ring
never reads as "red mana". The five colours appear in exactly five places: mana
pips, a 2 px edge bar on stack items and log rows, the flight glow, the mana pool
wells, and a gradient underline on each seat's nameplate (that last one is how you
tell four pods apart at a glance). **Never tint a card** — the printed art is the
card's own job.

---

## Build order for M2, with verification per step

From the approved plan. Each step ends with a concrete check.

1. **Tokens, shell, fonts, `MotionConfig`, dev `#tokens` gallery.**
   → `document.fonts.check('700 16px "Alegreya Variable"')` is true (false means a
   fallback is silently rendering); a `p-1…p-8` ladder computes to 8 distinct
   values (the 111-utility canary); a `motion.div` mounts under the **production**
   CSP with zero CSP console entries.
2. **Rect registry + flight layer + `fly()`** — alone, on a two-box test screen,
   before anything else animates.
   → promise resolves within duration ±80 ms; clones clean up; the transform
   matrix differs between consecutive rAFs; `cancel()` mid-flight still resolves;
   `fly()` to an **unregistered** key lands at the zone anchor.
3. **Table metrics + seat layout + row packing + zone piles + static hand fan.**
   → 12 combinations (1920×1080 / 1600×900 / 1280×800 × 2/3/4 seats) with a
   40-permanent board: every card inside its band, no two cards in a row
   overlapping, no page scrollbar, every card ≥ 96 px.
4. **HandFan interaction.** → assert offsets match `26·e^(−0.55·d)` within 0.5 px
   via a store-injected hovered index — **no synthetic pointer events**.
5. **Choreographer skeleton + digest mode + governor + watchdog + epochs.**
   → a 20-move burst in one tick converges exactly; `stats()` shows the rate
   climbing then drain mode; a snapshot fired mid-burst bumps epoch with zero
   clones and zero errors; an **injected hung beat** still drains the queue —
   that is the anti-wedge proof, do not skip it.
6. **All named beats** on a `#beats` screen, each recorded per-rAF.
   → endpoints match spec **and peak scale > settle scale** (the overshoot
   actually happened — a numeric assertion for "does it feel like Arena");
   `draw`'s `rotateY` crosses 90° at t ∈ [0.45, 0.55].
7. **HUD:** `PlayerPlate`, `LifeCounter` (MotionValue, retargeting),
   `CommanderDamageMatrix`, `ManaPool`, `PhaseTrack`, `PriorityIndicator`, `GameLog`.
   → 40→33→31→45 at 80 ms gaps is monotone toward each target and **never returns
   to 40** (proves retarget, not restart).
8. **FX canvas.** → ≤1200 active; after 1.5 s `active === 0` **and
   `rafHandle === null`** (it parked); DPR correct across a runtime
   `deviceScaleFactor` change.
9. **Combat choreography.** → each attacker's displacement has a positive dot
   product with the vector toward its assigned pod; blockers land within 2 px of
   the computed intercept.
10. **Perf gate:** p95 ≤ 18 ms and ≤ 2 long frames over 5 s of 40 permanents +
    draw burst + damage volley, at 1920×1080.

Then **screenshot the table and hand it to the user for the feel judgement.** That
is the actual point of M2.

---

## ⚠️ Traps that will cost you time

Each of these has already cost real debugging time in this project or its siblings.

### Probing and verification

1. **Restart the Vite dev server before probing** after an edit session. With HMR
   active, modules resolve as `file.ts?t=<stamp>`, so a probe's
   `await import('/src/…')` loads a **second** instance — you read a ghost zustand
   store and every assertion lies. Reach state through `window.__crt` handles.
   *This bit me mid-session: a stable-looking "1 aspect violation" that vanished
   after a clean restart.*
2. **Launch with `--disable-backgrounding-occluded-windows
   --disable-renderer-backgrounding`.** An occluded window freezes rAF and
   throttles timers to 1 s, so an animation probe "hangs" in a way that looks
   exactly like a code regression. **This matters enormously for M2.**
3. **The debugger bypasses CSP.** Anything `Runtime.evaluate` runs — including a
   `<script>` it creates — is exempt. Measured: `eval()` blocked under a headless
   `file://` load, "allowed" under `--remote-debugging-port` with the *identical*
   CSP header. Read `window.__crt.csp`, measured by bundled code.
4. **Never pass `replMode: true` to `Runtime.evaluate`.** It silently defeats
   `awaitPromise` — every promise-returning expression comes back as `{}`, which
   reads as "the assertion returned nothing" rather than a client bug.
   `scripts/cdp.cjs` carries this comment; leave it there.
5. **Don't synthesize pointer drags.** If the real mouse is over the Electron
   window, genuine and synthetic pointermoves interleave and corrupt the gesture.
   Assert on store-injected state instead.
6. **Measure at the right layer.** A rate-limit check timestamped at the wrong
   layer reported ~1 ms gaps for a transport that was correctly paced 103 ms
   apart. Ask what layer the property actually lives at before instrumenting.
7. **Dev handles must never close over component state or setters.** A `goto()`
   that captured `setScreen` from a replaced HMR instance silently did nothing, and
   the probe reported "the screen has no cards" — indistinguishable from a render
   bug. Use refs or read-through functions. **You will add many handles in M2.**
8. **`preview_start` (the preview MCP) does not work** with the Electron apps in
   this workspace. Use `scripts/probe.cjs` and `scripts/cdp.cjs`.

### CSS (Tailwind 4)

9. **`@theme static` — do not drop the `static`.** Tailwind 4 tree-shakes theme
   variables, emitting only those it finds as literal text. Tokens composed
   dynamically (`identityToken()` builds `var(--color-mtg-${letter})`) are omitted,
   and an undefined var inside `color-mix()` makes the browser discard the **whole
   declaration** — cards silently lost background *and* box-shadow, but only the
   single-colour ones. No error, no warning. See D12.
10. **Never add an unlayered universal reset.** `* { margin:0; padding:0 }`
    outranks `@layer utilities` and silently zeroes every spacing utility — it
    zeroed 111 utilities across two sibling apps. Resets go in `@layer base`.
11. **`@theme` must become `@theme inline`** the moment a token value references a
    scope-local var, or every `border-*` falls back to `currentColor`.

### Electron / Node

12. **`window.prompt()` / `confirm()` / `alert()` throw in Electron.** Every text
    or number input needs a real dialog. A probe greps for these. **M2's Tier-3
    tools and any "name this token" flow will hit this.**
13. **Attach stream/event listeners once, outside loops.** A per-iteration
    `once('error')` accumulated 113k listeners; fixing it (and the per-line
    Promise) cut a build from 40.6 s to 18.6 s. A "cosmetic" Node warning was
    pointing at a 2× slowdown.
14. **`utilityProcess.fork` runs its target as `require.main`** — guard any
    dual-mode CLI block with `!process.parentPort`. See D13.

### General

15. **A queue needs someone to restart it.** Work stranded twice in the art queue
    (backoff timers firing after workers exited; enqueue racing the end of a run).
    **The choreographer has exactly this shape** — make sure a group arriving as
    the previous one finishes cannot strand.
16. **The user's standing rule: never reduce resolution or fidelity to save memory
    or time.** They have 128 GB RAM and an RTX 3060. Always request Scryfall `png`
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

**Two tools, two jobs:** Vitest for pure TS in `src/` (engine, net, data — and
now your animation math, which is pure and should be tested there). CDP/headless
probe for anything touching Electron, the DOM, or real rendering.

Add M2 assertions to `scripts/probe.cjs` where they concern the shell, and prefer
a new `scripts/battery-*.cjs` or a Vitest file for self-contained logic. **Extend
the existing suites rather than replacing them** — all 370 checks must stay green.

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
- `src/engine/` (M3) must not import React, Electron, Node or zustand, and must
  not call `Date.now()`, `Math.random()` or `performance.now()`. Keep M2 out of
  its way.
- Comments explain **why**, and carry the ⚠️ marker plus the concrete failure when
  documenting an invariant. Match the density of the existing files.
- Record any non-obvious decision in `docs/DECISIONS.md` with its reason, and
  update the "Milestone status" checklist in `AGENTS.md` when a step completes.
- End a fully-finished response with `---Done---` on its own line (workspace rule).

## Working style the user expects

- **Ask clarifying questions as clickable multiple choice** (the AskUserQuestion
  tool) — they prefer clicking to typing. Never a plain-prose question.
- Verify claims; don't assert them. When something looks wrong, **measure it**
  rather than reasoning from the symptom — several bugs this session were the
  opposite of what the symptom suggested.
- Report failures with the output. Say plainly what is done and what is not.
- Don't spawn subagents or run workflows unless asked.

## What comes after M2 — and your last task

⚠️ **This document is a brief for M2 only.** The reference material for the
remaining milestones is preserved in-repo (`docs/specs/approved-plan.md` has the
build order and verification for all five; `docs/specs/engine-net-spec.md` has the
full M3/M4 design), but there is no milestone brief for M3–M5 yet.

That is on purpose. A brief written today for M4 would be guessing at what M2 and
M3 actually produce, and every milestone so far has diverged from the spec in ways
worth recording — M1 alone changed the download endpoint (D10a), dropped the
streaming-JSON splitter the plan called for, and made the index maps lazy (D12a).
You will know what the choreographer really looks like; the plan only guesses.

**So your final task, after M2 is verified and reported, is to write
`docs/M3-HANDOFF.md`** in the same shape as this file:

1. The task, and where to stop.
2. Read-these-first table (add anything new you created).
3. What the app is + architecture — you can lift these sections verbatim; they
   have not changed and should not.
4. **What exists now** — update the file inventory and the verification totals.
   Be accurate; a stale inventory is worse than none.
5. The M3 spec, distilled from `docs/specs/engine-net-spec.md` the way this file
   distilled the UI spec: state the decisions, don't re-open them.
6. Build order with a verification per step.
7. **The traps** — carry this file's list forward, *plus* whatever M2 taught you.
   That list is the most valuable part of the handoff; it is the accumulated cost
   of every wrong turn so far. Never shorten it.
8. Conventions, working style, do-not.

Then tell the user the file exists and how to use it.

### The remaining milestones, in one line each

| | What it delivers | Sign-off |
|---|---|---|
| **M3** | The rules engine (pure, deterministic, event-logged) + Tier-3 manual tools + group rewind, wired to the M2 table. `src/engine/` must not import React/Electron/Node/zustand and must not call `Date.now()`/`Math.random()`/`performance.now()` — a Vitest regex test enforces it. **The replay-equivalence fuzzer is the gate: networking does not start until it is green**, because every networking bug becomes unfalsifiable if the engine is nondeterministic. | Play a full 4-seat game solo, start to finish, with animations. |
| **M4** | Multiplayer: wire protocol, per-player view filtering (`project()` is the entire hidden-information boundary — a bug there leaks hands), loopback → relay → direct-IP transports, reconnect via full snapshot, the `relay/` package. Widening the prod CSP's `connect-src` happens here and must be recorded in DECISIONS.md with its reasoning. | You and a friend play a real game over the relay; one of you drops and rejoins. |
| **M5** | Tier-2 keyword coverage pass, reduced-motion/skip wiring, remaining screens, NSIS installer, bundle audit (**no `relay/` in `app.asar`, no card art anywhere under `release/`**), install-and-confirm-it-reads-the-same-data-root (the MSIX proof), full offline audit, and `docs/INSTALL-AND-PLAY.md` for the friends. | An installer the user can send to friends. |

## Do not

- Do not start M3. Stop at the end of M2, report for the feel judgement, and write
  `docs/M3-HANDOFF.md`.
- Do not use `layoutId`, PixiJS, or a WebGL FX layer.
- Do not add an internet dependency. Approved exceptions are only: Scryfall bulk
  data, Scryfall card art, the M4 relay/LAN transport, and electron-updater.
- Do not bundle card art into the repo or the installer — it is Wizards'
  copyright, fetched per-user at runtime.
- Do not weaken the CSP, the capability gate, or the SSRF host allowlist.
