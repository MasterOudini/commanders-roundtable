# Commander's Roundtable — Online Commander (EDH) with automated rules

Play Magic: The Gathering — Commander with 2–4 friends over the internet, using
decks you built yourself, with **the app doing the rules bookkeeping** the way
MTG Arena does: shuffling, mulligans, turn structure, mana, casting, the stack,
combat, state-based actions, commander damage. It is deliberately **not** a
manual sandbox where players drag cards and track life by hand.

It is equally deliberately **not** a full rules engine for every Magic card —
that is a multi-year project on its own. Unique card text is not auto-enforced;
players read the card and use clean manual tools inside the automated shell.
See the tier model below.

Build spec: `C:\Users\apps\Desktop\commander-game-desktop-prompt.md` (product
authority). Non-obvious decisions and their reasons: `docs/DECISIONS.md` — **read
it before "fixing" anything that looks odd.**

Design documents, preserved in-repo so they survive any single session:

| File | What it is |
|---|---|
| `docs/specs/approved-plan.md` | The user-approved plan for all five milestones. |
| `docs/specs/ui-animation-spec.md` | Full M2 spec: motion tokens, per-beat transforms, choreographer, layout math. |
| `docs/specs/engine-net-spec.md` | Full M3/M4 spec: data model, event model, priority loop, mana solver, combat, wire protocol. |
| `docs/M2-HANDOFF.md` | Self-contained brief for starting M2 in a fresh session. Complete. |
| `docs/M3-HANDOFF.md` | Self-contained brief for M3. Complete. |
| `docs/M4-HANDOFF.md` | Self-contained brief for M4. Complete. |
| `docs/M5-HANDOFF.md` | Self-contained brief for M5. Complete. |
| `docs/M6-BOT-HANDOFF.md` | Self-contained brief for M6 — the bot opponent. **M6.1 and M6.2 are DONE (D121, D126); M6.3 is MEASURED (D127), with `optional` BUILT (D128), layer 6's ability half BUILT and ORDERED (D129), counter EFFECTS built (D130), TOKEN effects built on a baked resolver (D132/D133), "enters tapped" plus the revived replacement API (D134), its CONDITION on seven board queries (D135), the replacement effect that ASKS (D136), DISCARD on the first prompt over a hidden zone (D137), the graveyard return with the target restriction it exposed (D138), the numeric restriction (D139), the top-N look (D141), and the ordering prompt (D142) — together taking `complete` from **1,405 to 1,723**; M6.4–M6.5 are not started.** ⚠️ Its ≥95% bar for level 1 over level 0 was measured and MISSED at 82.8% [79.2%, 85.9%] — D126 says why, and the reason is the baseline rather than the bot. Read it before any work on solo AI: it states why "a bot that knows every card" is two projects, and which one is the long one. ⚠️ Its §3 table and §5 are written from the HOST's side and are wrong for a client-side bot in five rows — D121 lists them. |
| `docs/M6.4-LIBRARY-SPEC.md` | **The full-coverage spec: every one of the 31,692 Commander-legal cards inside the bot, including the genuinely hard ones. THE SCAFFOLDING IS BUILT; NO CARD IS SCRIPTED YET.** Sizes each class of hard card against the real database (cost modification 1,496 · replacement 1,154 · copy 980 · combat maximisation 645 · linked abilities 621 · rule-changing 166), says what each needs from the ENGINE rather than from a script, and names the cards that will never be automated. Read it before any card-scripting work. ⚠️ Its M6.4a done-when was AMENDED in D157: "every gate in §6 runs in CI" is not achievable — nine test files need the 86 MB card database and SKIP without it, leaving a run green — so CI holds gates 2/3/4 and `verify.cjs --full` holds 1 and 5. |
| `docs/M6.4-HANDOFF.md` | **Self-contained brief for starting M6.4 in a fresh session.** Where the numbers stand (1,730 of 31,692 complete; 1,263 blocked on a script alone), what the pre-M6.4 pass built to land into, the loop, the non-negotiable constraints, the traps this repo has already paid for, and the two open reportables. Start a card-scripting session here. |
| `docs/SCRYFALL.md` | What we take from Scryfall, the API obligations, and the two attribution strings the About screen must display verbatim. |
| `docs/INSTALL-AND-PLAY.md` | **For the friends, not for a developer.** Install, first-run sync, deck import, hosting, the firewall prompt, and what to do when it goes wrong. |

⚠️ The specs record the *design*; this file's **Milestone status** records what is
actually built, and `docs/DECISIONS.md` records where the implementation
deliberately diverged. Where they disagree, DECISIONS.md wins.

## Scope tiers — the most important thing to understand

| Tier | What it means | Examples |
|---|---|---|
| **1 — fully automatic** | The engine enforces it, always. | Shuffle, London mulligan, 40 life, every phase and step, untap, draw, priority, mana pools emptying, cost payment, commander tax, the stack resolving LIFO, combat damage, lethal damage, 0 life, 21 commander damage, legend rule, drawing from an empty library, zone visibility, **target declaration and legality** (D79–D82) |
| **2 — keyword automation** | Parsed from Scryfall `keywords[]` and enforced where it affects combat or casting. | flying, reach, trample, vigilance, haste, lifelink, deathtouch, first/double strike, menace, defender, indestructible, flash, hexproof, shroud, landwalk, fear, intimidate, skulk, shadow, horsemanship, **infect, wither, toxic** (M5), protection from a colour, and ward as a cast-time tax — mana **or** `ward—Pay N life` (M5) |
| **2.5 — parsed effects** (D90) | A spell whose text the ingest understands COMPLETELY resolves by itself. Measured: **274 of 6,975** Commander-legal instants/sorceries. | `Lightning Bolt`, `Shock`, `Negate`, `Mortify`, `Harmonize`, `Pull Under` — damage, destroy, exile, bounce, counter, pump, tap/untap, draw, gain/lose life |
| **2.5a — assisted** (D90) | A spell the ingest understands only IN PART never runs by itself. When it resolves the prompt bar offers the understood part as one logged, manual click and says the rest is yours. **1,300** spells. | `Beast Within` — "Destroy target permanent" is offered; "its controller creates a 3/3" is yours |
| **3 — manual with helpers** | NOT enforced, **and said so on the card** (`src/data/tier3.ts`, shown in the hover zoom — D68, D122, D124). The player reads the card and uses a tool. Measured: **21,037 of 31,692** Commander-legal cards carry a note. | Every other card ability — including every triggered and static ability on a permanent, any activated ability the engine charges but cannot run, and the half of a mana line that is not "add mana". Tools: move any card between any zones, create tokens, add/remove counters, adjust life/mana, tap/untap anything, reveal cards, roll dice, flip coins |

The engine is architected (event-driven, per-card script registry) so individual
cards can gain scripted automation later **without rewrites**. A script-less
card is literally zero registrations — nothing in the engine branches on "is
this card scripted".

## Stack + dev port

Electron 42 · Vite 8 · React 19 · TypeScript strict · zustand 5 · Tailwind 4
(`@tailwindcss/vite`) · `motion` 12 for animation · Canvas2D for particle FX.

Dev port **5280, strictPort**. 5281 is the relay (`relay/src/server.js`), 5282
the LAN host listener (`electron/lanServer.cjs`, bound only while a game runs).
Everything below 5280 belongs to the sibling apps (SphereMapper
5173/5174, realmscribe 5180, TerrainScribe 5183, script picker 5193, topoforge
5210, the static 52xx block, counterpoint 5240, Mundifex 5260/5261,
Cartapriscus 5273).

## Run / build / verify

```bash
npm run dev              # browser only (no IPC — window.crt is undefined, by design)
npm run test:fuzz        # the replay-equivalence fuzzer alone (CRT_FUZZ_SEEDS=500 for the gate)
npm run electron:dev     # Vite + Electron (terminal use)
npm run desktop          # what the desktop shortcut runs: scripts/dev-launcher.cjs
                         #   reuse-or-start on :5280; logs every launch to launch.log.
                         #   Keep the .bat pointed HERE, never at electron:dev.
npm run build            # tsc -b && vite build  → dist/
npm run test             # vitest (engine + net only; see Verifying below)
npm run electron:build   # NSIS installer → release/  (runs prepare-electron-dist first)
node scripts/make-icon.cjs                                      # regenerate build/icon.*
powershell -ExecutionPolicy Bypass -File create-shortcut.ps1     # desktop shortcut → DEV launcher
```

## Architecture

```
                          RELAY (relay/, Node + ws, on a VPS)
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
│ │ CHOREOGRAPHER → beats → React UI │ │   │ │ CHOREOGRAPHER → beats → React  │ │
│ └──────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ MAIN: card DB · art cache · decks ·  │   │                                    │
│       LAN listener · updater         │   │                                    │
└──────────────────────────────────────┘   └────────────────────────────────────┘
```

**The invariant everything rests on:** every state change — including all Tier-3
manual tools — goes through an event appended to the log. Nothing mutates state
off-log. That one property gives replay, reconnect, group rewind, the trigger
bus, and the animation cue stream for free. Never add a code path that changes
state without emitting an event.

Main-process modules:

| File | Responsibility |
|---|---|
| `electron/paths.cjs` | The single data root. ⚠️ Read the comment at the top before changing it. |
| `electron/window.cjs` | Window creation + the whole hardening battery (CSP, nav guard, permissions). Importable by the probe so it tests the real posture. |
| `electron/capability.cjs` | Capability-gated filesystem. Every path-taking handler goes through it. |
| `electron/ipc.cjs` | Every IPC channel, in one place. Shared with the probe. |
| `electron/jsonstore.cjs` | Atomic, BOM-free JSON read/write + schema coercion. |
| `electron/settings.cjs`, `winstate.cjs` | Schema-validated settings; window bounds with off-screen recovery. |
| `electron/updater.cjs` | electron-updater with the placeholder-owner skip. |
| `electron/scryfall.cjs` | The ONLY network access. Host allowlist, byte caps, idle timeout, rate limit, resumable download. Read its endpoint notes before changing a URL. |
| `electron/cardsvc.cjs` | Supervises the card-database worker: lazy start, ready-gated outbox, log ring, crash recovery. |
| `electron/cardsvc-worker.cjs` | The worker itself (utilityProcess). Also a headless CLI — ⚠️ see D13 for why its CLI block checks `!process.parentPort`. |
| `electron/cardimg.cjs` | The `cardimg://` privileged scheme serving cached art. |

## Conventions

- TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`);
  React function components; zustand for state; Tailwind 4 with `--crt-*` OKLCH
  design tokens in `src/index.css`.
- All interface copy in English, active voice, written from the user's side
  ("Cast Sol Ring", not "Submit"). Errors say what happened **and** what to do.
- `electron/preload.cjs` and `src/types/bridge.d.ts` are the SAME contract —
  change both together.
- `src/engine/` must not import React, Electron, Node, or zustand, and must not
  call `Date.now()`, `Math.random()`, or `performance.now()`. A Vitest regex test
  enforces this. Randomness comes only from the seeded PRNG threaded through the
  event log.
- The five MTG colours appear in exactly five places (mana pips, the 2 px edge
  bar on stack items and log rows, the flight glow, the mana pool wells, and the
  gradient underline on each seat's nameplate). The UI accent is brass —
  deliberately not one of the five, so an accent ring never reads as "red mana".
  Never tint a card; the printed art is the card's own job.

## CSS scoping (don't regress)

- ⚠️ **Never add an unlayered universal reset** (`* { margin: 0; padding: 0 }`).
  It outranks `@layer utilities` and silently zeroes every padding/margin
  utility in scope — it zeroed 111 Tailwind utilities across two sibling apps in
  this workspace. Resets go in `@layer base`, and nowhere else.
- ⚠️ **`@theme static` — do not drop the `static`.** Tailwind 4 tree-shakes theme
  variables, emitting only those it finds as literal text in source. Tokens we
  compose dynamically (`identityToken()` builds `var(--color-mtg-${letter})`) are
  therefore omitted, and an undefined var inside `color-mix()` makes the browser
  discard the **whole declaration** — cards silently lost both background and
  box-shadow, but only the single-colour ones. No error, no warning. See D12.
- ⚠️ `@theme` also becomes **`@theme inline`** the moment a token value references
  a scope-local CSS var. Plain `@theme` emits at `:root`, where a scoped var is
  undefined; the token resolves to empty and inherits down, so every `border-*`
  utility falls back to `currentColor` (white lines everywhere) and `bg-`/`text-`
  break with no error. Today every token is a literal, so `inline` is not needed —
  the comment in `src/index.css` says so; keep it accurate.
- ⚠️ `window.prompt()` / `confirm()` / `alert()` **throw in Electron**. Every
  text or number input needs a real dialog component. A probe greps for these.

## Offline-first policy — approved internet exceptions

This app must work fully offline for gameplay. Approved exceptions, and NOTHING
else:

1. **Scryfall bulk card data** (`api.scryfall.com`) — one-time download plus a
   manual "update card database" button. Streamed, resumable, host-pinned in the
   main process with a timeout and a byte cap. Gameplay never needs it again.
2. **Scryfall card images** (`cards.scryfall.io`) — fetched per imported deck,
   cached to disk permanently. ⚠️ Card art is Wizards of the Coast's copyright:
   it is **never bundled into the installer** and never relayed between players.
   Each player's app fetches its own copy. A packaging audit asserts no card art
   under `release/`.
3. **Relay WebSocket + LAN hosting** — a deliberate, documented deviation from
   "dev servers bind localhost only": the LAN listener binds the local network
   **only while the user has started a LAN game**, is token-gated, and closes
   with the game. The Vite dev server still binds localhost only.
   ⚠️ Built in M4. The renderer's `connect-src` is widened **per origin, never
   per scheme** — `electron/netallow.cjs` validates every address, refuses
   plaintext `ws://` to a public host, and keeps the list in settings. See D48;
   `scripts/probe.cjs` asserts it in both directions.
4. **electron-updater** GitHub-Releases check on launch — the standing
   workspace-wide exception. Dormant while `build.publish.owner` is `"OWNER"`.
5. **Deck import by link** (`tappedout.net`, `api2.moxfield.com`,
   `archidekt.com`) — user-approved 2026-07-27. One GET per press of "Fetch
   decklist", in MAIN behind `electron/deckfetch.cjs`'s own exact-host
   allowlist, and never on its own. ⚠️ A SECOND allowlist, deliberately not a
   widening of scryfall.cjs's: the image queue must not be able to reach a deck
   site, and the deck importer must not be able to reach Scryfall's CDN —
   `battery-deckimport.cjs` asserts both directions. ⚠️ A LINK host is not a
   FETCH host: `moxfield.com` is where a user's link points, `api2.moxfield.com`
   is where the GET goes, and only the second is in `ALLOWED_HOSTS`. The renderer
   still has no network reach; it hands over a URL string and gets decklist TEXT
   back, which goes through the same parser a paste does. See D92.

Scryfall requires a descriptive User-Agent, an explicit Accept header, and
≤10 requests/second. Attribution obligations are documented in `docs/SCRYFALL.md`.
No telemetry, ever.

## Verifying / debugging (hard-won)

Two tools, two clearly separated jobs.

**Vitest** — `src/engine/` and `src/net/` only. Pure functions, hundreds of
independent rules scenarios, `environment: 'node'` (the engine needing a DOM
would itself be a bug).

**Headless probe / CDP** — everything touching the shell. `preview_start` (the
preview MCP) does **not** work with the Electron apps in this workspace
("system cannot find the path specified"), so:

```bash
npm run build && npx electron scripts/probe.cjs      # shell/security/IPC, against dist/ with the PROD posture
npx electron scripts/probe.cjs --dev-csp             # same, dev CSP
node scripts/battery-carddb.cjs                      # folding, projection, index, queries (needs a synced DB)
node scripts/battery-images.cjs                      # art URLs, queue, real pacing + concurrency (~8 MB of traffic)
node scripts/battery-images.cjs --offline            #   pure-logic sections only, no network
node scripts/battery-deckimport.cjs                  # the deck-link URL guard + one real tappedout.net download
node scripts/battery-deckimport.cjs --offline        #   the guard and the parsing alone, no network
node electron/cardsvc-worker.cjs --sync               # download + build the card database
node electron/cardsvc-worker.cjs --sync --rebuild     #   re-transform from the local file (no re-download)
node electron/cardsvc-worker.cjs --reindex            #   rebuild only cards.idx, offline
node electron/cardsvc-worker.cjs --query "sol ring"   #   ad-hoc lookup
node scripts/battery-anim.cjs                         # THE ANIMATION BATTERY (M2 + M3 + M4 + M5)
node scripts/battery-anim.cjs flight table tap hand choreo beats hud fx combat engine bot drag net motion perf
node scripts/two-instance.cjs                         # M4 SIGN-OFF: two real apps, one LAN socket
node scripts/two-instance.cjs --keep                  #   leave both windows up to poke at
node scripts/two-instance.cjs --offline               # M5 OFFLINE AUDIT: the same, with DNS dark
npm run audit:bundle                                  # M5: what is actually inside release/
node scripts/install-proof.cjs [--uninstall]          # M5: install it, and ask it where its files are
node scripts/battery-relay.cjs                         # the RELAY: rooms, blind forwarding, restart
node scripts/battery-bot.cjs                           # M6.2: level 1 vs level 0, 60 games + a Wilson interval
node scripts/battery-bot.cjs --games 500               #   the gate: 1,000 games
node relay/src/server.js 5281                         # the standalone relay (needs `npm i` in relay/)
node scripts/make-engine-fixtures.cjs                 # regenerate src/data/fixtures/engineCards.ts
npx vitest run src/data/fixtures/engineCards.node.test.ts           #   …and the guard that all 86 still match the live DB (D123)
CRT_BOTPOOL_REPORT=1 npx vitest run src/data/botPool.node.test.ts   # M6.1: what the engine runs COMPLETELY, over the real DB
CRT_WRITE_BOT_DECK=1 npx vitest run src/data/botPool.node.test.ts   #   and regenerate src/data/botDeck.ts from it
CRT_TIER3_REPORT=1 npx vitest run src/data/tier3.node.test.ts       # D122/D124: what the app SAYS it will not do, over the real DB
CRT_PRIMITIVES_REPORT=1 npx vitest run src/data/primitives.node.test.ts  # M6.3/D127: what each missing engine primitive is worth
node scripts/battery-anim.cjs --keep                  #   leave Electron up to poke at
npx electron . --dev --remote-debugging-port=9223 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
node scripts/cdp.cjs "expression"                    # drive the live dev renderer
node scripts/screenshot.cjs out.png --wait 900       # visual proof
```

`scripts/battery-anim.cjs` spawns its own Electron (reusing vite if it is already
serving) because animation assertions need the DEV build's `window.__crt` handles
plus a real, unthrottled rAF clock — `scripts/probe.cjs` tests `dist/` under the
production posture, where dev handles do not exist at all. It **hard-reloads the page
before asserting anything**: see trap 6 below.

⚠️ Nine traps, each of which has already cost real debugging time here:

1. **Restart the Vite dev server before probing** after an edit session. With
   HMR active, app modules resolve as `file.ts?t=<stamp>`, so a probe's
   `await import('/src/…')` loads a **second** instance — you read a ghost
   zustand store and every assertion lies. Reach state through `window.__crt`
   handles instead.
2. **Launch with `--disable-backgrounding-occluded-windows
   --disable-renderer-backgrounding`.** An occluded window freezes rAF and
   throttles timers to 1 s, so an animation probe "hangs" in a way that looks
   exactly like a code regression.
3. **The debugger bypasses CSP.** Anything `Runtime.evaluate` runs — including a
   `<script>` it creates — is exempt from page CSP, so a probe that calls
   `eval()` itself reports "allowed" even when the real CSP forbids it. Measured
   in this project: blocked under a headless `file://` load, "allowed" under
   `--remote-debugging-port` with the *identical* CSP header. Read
   `window.__crt.csp` (measured by bundled code in `src/devHandles.ts`) instead.
4. **Never pass `replMode: true` to `Runtime.evaluate`.** It silently defeats
   `awaitPromise`: every promise-returning expression comes back as `{}`, which
   reads as "the assertion returned nothing" rather than as a client bug.
   `scripts/cdp.cjs` carries a comment to this effect — leave it there.

5. **The perf gate's tail is EXTERNAL LOAD until proven otherwise.** Measured
   today on one commit: a game running in the background gave 19 long frames and
   13 over 33 ms; closing it gave 7 and 0. **p50 and p95 did not move — 8.50 ms
   in both** — and that is the signature: a real render regression moves the
   median too, because the gate's scene does the same work every frame. Check
   `Get-Process | ? { $_.MainWindowTitle }` and `LoadPercentage` before
   suspecting the code, and use `git stash` to settle it in two runs when it is
   genuinely unclear. A reboot is the wrong instrument. See D106.
6. **A battery that reuses a long-lived vite can load a STALE module graph.**
   `battery-anim.cjs` reuses a vite that is already serving, and a vite alive across
   an edit session carries HMR state; a freshly spawned Electron then loaded an old
   module, so the copy of `rectRegistry` the beats had closed over was not the copy
   the live components had registered into. `elementFor()` returned null and every
   in-place beat quietly slept for its full duration — recorded as "90 frames, 1
   distinct matrix", which reads as "the beat does not animate". A clean reload made
   the same beat report 65 distinct matrices. The battery now does
   `Page.reload({ ignoreCache: true })` before its first assertion.
7. **Sample geometry only once the layout has SETTLED.** Unhiding the persistent
   table slot and any device-metrics override both reflow asynchronously (a
   `display: none` element measures 0×0, so the first real metrics pass happens on
   the ResizeObserver after it becomes visible). Sampling mid-reflow produced
   hand-fan offsets wrong by a smoothly increasing amount per slot — which reads
   exactly like a broken falloff formula rather than like a race.
   `waitForStableLayout()` polls `metricsEpoch` until it stops changing, and the
   assertions check the epoch did not move across the measurement.
   ⚠️ **The epoch is the SOLVE, not the transition.** A tap is a CSS transition
   on the turn element (D76), so slot footprints keep moving after the epoch has
   settled — and measuring in that window produces confident WRONG answers, not
   noise: it reported three overlaps in a band whose slots are 8 px apart, and
   reported tapping as removing a 30 px overflow when it adds 52 px. Anything
   asserting on footprints must poll the turned-count and every slot's
   `offsetLeft`/`offsetWidth` until they stop (`waitForTurnsSettled` in
   `battery-anim.cjs`). See D104.
8. **Measure the right box for anything rotated, and there are THREE of them.** A
   tapped card is a full quarter turn (D75), so a 101×141 card's client rect is
   141×101 — asserting no-overlap on client rects once reported a 6 px "overlap"
   between two correctly packed cards. Card SIZE is `offsetWidth`/`offsetHeight`
   (unchanged by any transform); the space a card OCCUPIES is its **slot wrapper**,
   which is never itself rotated and is sized to the real footprint; the client
   rect is only for asserting the rotation itself. For a fan card, use the
   **decomposed** transform matrix (`decomposeTransform` in `src/ui/anim/record.ts`).
   ⚠️ And decide "is it turned?" from the matrix ANGLE, never from
   `transform !== 'none'` — a beat that squashed or nudged a card leaves an
   identity matrix behind, and that reads as a card turned 90° while standing
   perfectly upright.
9. **Normalise a recorded track against the REQUESTED duration**, not the recorded
   window. A recording starts on the frame the clone first exists and stops when it
   unmounts, so dividing by the observed span inflated a measured flip time from 0.50
   to anywhere in 0.52–0.60 depending on frame alignment — which looks exactly like a
   mis-timed keyframe.

Also: **don't synthesize pointer drags.** If the real mouse is over the Electron
window, genuine and synthetic pointermoves interleave and corrupt the gesture.
Assert on store-injected state instead.

⚠️ The ONE exception, and only because it removes the failure mode rather than
accepting it: `window.__crt.table.drag` drives the hand-to-battlefield gesture
with real PointerEvents on **pointerId 787**, which no pointing device ever uses.
`useHandDrag` ignores every event whose id is not the one its press began with,
so the two streams cannot interleave. Do not copy the technique to a gesture that
has no such guard. Two things that cost time when screenshotting a live drag by
hand: `scripts/screenshot.cjs` captures the held card correctly but **ends the
drag behind it** (the capture blurs the window, and a blur is a cancel), so
anything after the screenshot has to start a new one; and a window that ends up
minimised reports `document.hidden === true`, which freezes rAF — every
`drag.*` handle then hangs on its `requestAnimationFrame` and `cdp.cjs` reports a
timeout that looks exactly like a wedged gesture. Restore the window first.

## Milestone status

- [x] Plan approved (2026-07-26)
- [x] **M1.1 Scaffold (2026-07-26):** Electron 42 + Vite 8 + React 19 + TS strict
      + Tailwind 4 + motion 12 + vitest. `npm run build` clean. Launcher verified
      in BOTH paths (fresh start, and reuse of a live :5280 without a second
      vite); single-instance lock confirmed. Prod + dev CSP verified: eval,
      `Function()`, external fetch and WebSocket all blocked; navigation guard
      blocks an external origin. 49/49 probe checks.
- [x] **M1.2 Data root / settings / window state (2026-07-26):** data root is
      `~/.commanders-roundtable` (D2); settings schema-validated with unknown-key
      and prototype-pollution drops; atomic BOM-free writes; window bounds with
      off-screen, undersized and garbage-file recovery all verified.
- [x] **M1.3 Capability gate (2026-07-26):** three allowlists, `resolveInsideDir`
      basename stripping, sibling-prefix and NUL-byte rejection verified. OS temp
      deliberately excluded (D3). Deck file I/O lands with M1.8, when decks exist.
- [x] **M1.4 `cardimg://` protocol + Card component (2026-07-26):** privileged
      scheme with sharded cache paths; 9-case traversal battery all refused
      (plain/encoded traversal, absolute path, unknown tier, non-uuid, extra
      segment, unknown host, bad face index); full-res 745×1040 load verified
      under the PRODUCTION CSP from `file://`; a miss returns 404 and notifies the
      download queue. `Card` in 4 modes + `SyntheticFace` + `CardZoomPanel` +
      `ManaCost`; 10 fixture layouts × 5 size bands = 60 cards, 0 aspect
      violations, 0 duplicate P/T, 274 mana glyphs rendering, no horizontal
      overflow. 63/63 probe checks. Found and fixed: D12 (`@theme static`).
- [x] **M1.5 Card-DB worker + Scryfall fetcher (2026-07-26):** `scryfall.cjs`
      exact-host allowlist (17/17 guard checks incl. suffix/prefix/subdomain
      attacks, embedded credentials, non-default port, non-https, garbage);
      `cardsvc-worker.cjs` in a utilityProcess with a headless CLI; `cardsvc.cjs`
      supervisor with a log ring, lazy start, ready-gated outbox and crash
      recovery (killed the worker, next request came back on a new pid).
      Real sync verified: 116,209 printings / 76,985,329 B in **2 requests**;
      truncated `.part` resumed fetching exactly the missing bytes to a
      byte-identical result; cancel keeps the `.part` and writes no meta; an
      already-present file costs **1** request. Card database screen shows it.
      75/75 probe checks. Found and fixed: D10a (use `jsonl_download_uri`),
      D13 (utilityProcess is `require.main`; ready-gate the outbox).
      Confirmed D2/D10b: no MSIX shadow copy of the download.
- [x] **M1.6 NDJSON transform + card index + query API (2026-07-26):**
      `cardfold.cjs` (one home for folding — the renderer never folds),
      `cardproject.cjs` (63 Scryfall fields → our CardData; art series skipped,
      layouts classified, colour identity taken from Scryfall not recomputed),
      `cardindex.cjs` (atomic build, offline rebuild, lazy maps, queries).
      Real data: **113,559 cards from 116,209 records** — the difference is
      exactly the 2,650 art-series cards, so the only ingest warning is the
      intentional one. Build 18.6 s, cold index load **255 ms**, p95 name lookup
      **0.14 ms**, hydrate 100 cards 2 ms. Verified: NDJSON line count and byte
      size match meta; offsets contiguous and spanning the file exactly; a
      corrupt index fails loudly then rebuilds from the NDJSON with **no
      network**; a build cancelled halfway leaves the previous database
      byte-identical and still queryable; a query with no database rejects with
      an actionable message. 106/106 battery + 77/77 probe checks.
      Found and fixed: D12a (lazy maps; `bucket[0]` is not the best printing),
      D12b (per-line listener + Promise — a 2× build slowdown behind a
      "cosmetic" warning), D12c (no card name has a ligature).
- [x] **M1.7 Image cache + per-deck art prefetch (2026-07-26):**
      `cardimages.cjs` — URLs derived from the card id (D14, no stored
      `image_uris`), art crops queued before full art, concurrency 6, exponential
      backoff, 404 → permanently dead, queue persisted and resumed on worker
      start. Rendering a card with no cached art is itself the fetch request
      (`cardimg` miss → batched enqueue). Verified with real downloads:
      **103 ms minimum gap at the wire with 5 requests concurrent** (measured by
      hooking `https.get`, not `download()` — see D14b), want-list fully present
      on disk with non-empty JPEG/PNG files, oversized enqueue refused, 404
      recorded as dead and skipped on re-queue, pending work surviving a restart.
      End to end: 10 real cards → 30 files / 18 MB cached, full art rendering at
      744×1040. 43/43 image battery, 106/106 card-DB battery, 77/77 probe.
      Found and fixed: D14a (stranded queue — two images that never downloaded),
      D14b (rate limiter not serialized across concurrent callers),
      D14c (fixture ids were invented → 18 guaranteed 404s).
- [x] **M1.8 Decklist parser + Commander validator (2026-07-26):**
      `src/data/decklist.ts` (pure text → entries; quantities in every form, set
      and collector number incl. bracketed and The List's `TSP-157`, Archidekt
      `[Ramp]{noPrice}`/`^tag^`, MTGO `SB:`, foil markers, section headers,
      line-start `//` as comment vs mid-line `//` as a face separator, BOM/CRLF/
      tabs, unreadable lines reported never dropped) · `src/data/validate.ts`
      (exactly 100, singleton with text-derived limits, commander eligibility and
      all four pairing mechanics, colour identity from Scryfall, ban list, soft
      gate) · `electron/decks.cjs` (id-only file I/O through the capability gate,
      field coercion both ways, delete moves to `decks/trash/`) · Decks screen
      with paste-import, per-line issues and the commander shown with real art.
      **129 Vitest tests** (65 parser + 64 validator) — the first Vitest suite in
      this workspace. Verified live against the real index: a 100-card Kess list
      validates clean; Farseek reports `{G}`; 9 Nazgûl pass and 10 fail; Golos is
      banned; `Sol Rng` suggests `Sol Ring`; Partner and Background pairs are
      legal; deck-id traversal returns null and junk fields are stripped.
      Found and fixed: D15 (strict CR reading rejects Shorikai, a real precon
      commander), D15a (Backgrounds flagged as illegal commanders), and a parser
      bug where a category claimed the set slot (the set is the LEFTMOST group).
- **M1 COMPLETE.** 370 checks green: 129 Vitest · 121 card-DB · 43 images · 77 probe.
- [x] **M2 The animated table (2026-07-26):** the full motion subsystem, driven by
      canned fixture scenarios with **no rules engine** — deliberately, so the feel
      could be judged before the rules exist.
      `src/ui/anim/` — motion tokens with a single scale gate (D16); `arc.ts` pure
      flight geometry; `rectRegistry.ts` (the only legal `getBoundingClientRect`
      caller, three-tier resolution, per-frame read cache D28); `flightLayer.ts`
      singleton + `FlightOverlay.tsx` clone renderer (portal + FLIP, **no
      `layoutId` anywhere**); `coalesce.ts` + `governor.ts` (pure, unit-tested);
      `choreographer.ts` (groups, lanes, speed governor, drain, watchdog, epochs,
      500 ms convergence reconciler); `beats.ts` (13 named beats); `combat.ts`
      (lunge + intercept geometry); `fx/FxCanvas.tsx` (SoA pool of 1200, self-
      parking rAF, DPR re-read per resize); `FxOverlay.tsx` (all FX text is DOM);
      `perf.ts` (rAF sampler + LoAF + rect-discipline counter).
      `src/ui/table/` — pure `metrics.ts` / `packRow.ts` / `fanGeometry.ts` with a
      documented resolution ladder; `GameTable` + `PlayerPod` (one component,
      mirrored) + bands + piles + stack + hand fan. `src/ui/hud/` — plate, life
      counter (MotionValue, retargeting), commander-damage matrix, mana pool, phase
      track, game log. `src/view/` — the M2↔M3 view contract plus the fixture table
      and 16 scenarios.
      **Verified: 646 checks, 645 green.** 285 Vitest · 121 card-DB · 89 probe ·
      26 images (offline) · 125 animation battery. The one failure is the perf
      gate's strict long-frame count (4 vs ≤2 over 5 s; p95 8.5 ms and only 1 frame
      over 33 ms) — recorded with its full measurement in D29.
      Found and fixed along the way: D21 (projection identity — every commit was a
      long frame), D22 (`motion` silently no-ops a multi-keyframe spring), D23
      (easing the driver put the face flip at 32% of the flight), D24 (the arc bowed
      the wrong way for half of all flights), D26 (double rounding pushed the last
      card in a row past its band), D27 (blur and clone chrome were the paint cost),
      D31 (an always-mounted screen defeated the card-DB lazy start).
- [x] **M3 The rules engine + solo play (2026-07-27):** a pure, deterministic,
      event-logged engine, the Tier-3 manual tools, group rewind, and the whole
      thing wired to the M2 table so a full 4-seat game plays solo.
      `src/engine/` — `rng.ts` (sfc32, rejection-sampled, state threaded through
      the log) · `hash.ts` (canonical JSON + a 64-bit state hash) ·
      `types/{ids,mana,oracle,state,events,intents}.ts` · `derive.ts` (CR layers
      1/7b/7d live; a script-less card is zero registrations) ·
      `scripts/{api,registry}.ts` (EMPTY_REGISTRY ships) · `zones.ts` ·
      `reducer.ts` (`apply` is pure in (state, event) alone and exhaustive) ·
      `invariants.ts` · `log.ts` (append-only, replay, NDJSON) · `setup.ts`
      (London mulligan) · `turn.ts` · `sba.ts` · `triggers.ts` (the single
      replacement funnel + APNAP bus) · `legal.ts` (one primitive for
      highlighting, auto-pass and confirmations) · `mana.ts` + `payment.ts`
      (three-tier solver; MCMF measured at **0.100 ms** on a 40-source board) ·
      `combat.ts` · `loop.ts` (`advance`/`pump`) · `handlers.ts` + `manual.ts` ·
      `project.ts` (the whole hidden-information boundary, identity-preserving
      per D21) · `viewEvents.ts` (engine events → the 21 M2 cues) · `game.ts`.
      `src/game/` — session, deck building, solo start. `src/ui/game/` —
      PromptBar, aim veil, payment review, stops panel, manual-tools drawer,
      card menu, real dialogs (no `window.prompt`).
      **Verified: 1,025 checks, 1,024 green.** 638 Vitest (353 of them new:
      296 engine + 57 ingest) · 121 card-DB · 89 probe · 26 images (offline) ·
      151 animation battery (now including a 27-check `engine` section). The one
      failure is still the perf gate's strict long-frame count (D29). ⚠️ Measured
      across four runs it is **3–9 long frames** rather than the single "4" D29
      recorded — the gate is noisy, and running the perf section ALONE is worse
      than running it after the full battery. p95 is unchanged at 8.5 ms. See D29a.
      **The gate is green:** the replay-equivalence fuzzer at 500 seeds × 200
      intents — 98,811 accepted intents, 1,165,201 events, 9,397 turns — with
      invariants after every intent and replay-hash equality per seed (D41).
      **Played solo, start to finish:** a 4-seat game, 45 turns, 5,393 events,
      32 attack declarations, 68 attackers, three players dead, Cy winning at 1
      life with 16/12/8 commander damage tracked per commander instance.
      Found and fixed along the way: D37 (`stopWhenAnyoneCasts` could never
      fire), D38 (a dying token looped `pump` forever), D47 (a prompting SBA
      re-asked itself forever), D45 (`data-card-id` is the printing id),
      D42/D43 (solo play is a hotseat; 49-card decks made every game a
      draw-out).
- [x] **M4 Multiplayer (2026-07-27):** the wire protocol, per-player view
      filtering over it, three transports, reconnect by snapshot, and the
      `relay/` package.
      `src/net/` — `protocol.ts` (the `Envelope` + three body unions +
      room codes) · `wire.ts` (the printing dictionary; a `CardData` crosses the
      wire once per client, D52) · `transport.ts` (`loopbackPair`, and the host's
      OWN player goes through one) · `socketTransport.ts` + `relayTransport.ts`
      (the room handshake, backoff, and a relay restart survived by re-creating
      the room with the same code) · `host.ts` (the only process that reduces) ·
      `client.ts` (patch, hash, and the payment solver on a `SolveInput` off the
      wire, D53) · `testing/` (a host + 4 clients in one process).
      `src/engine/` — `redact.ts` (the second half of the hidden-information
      boundary; it strips the SEED, D51) · `diffView.ts` (`diffView` /
      `applyPatch` / `viewHash`, identity-preserving on BOTH sides of the wire).
      `relay/` — 300 lines of router with zero game logic, its own package.json,
      deployable with `npm i && node src/server.js`.
      `electron/` — `netallow.cjs` (the per-origin `connect-src` allowlist, D48) ·
      `lanServer.cjs` (binds the network only while a LAN game runs, token-gated,
      D59) · `gamelog.cjs` (append-only NDJSON + `desync.log`).
      `src/game/` — `session.ts` rewritten over host-or-client with no change to
      what `src/ui/` consumes; `multiplayer.ts`; a Multiplayer screen.
      **Verified: 1,145 checks, 1,144 green.** 716 Vitest (78 new) · 121 card-DB ·
      26 images (offline) · 165 animation battery (now including a 15-check `net`
      section) · 97 probe (up from 89) · 20 two-instance. The one failure is
      still the perf gate's long-frame count (D29/D29a): 7 over 20 ms, **0 over
      33 ms**, p95 8.50 ms — inside the documented 3–9 range, and M4 adds nothing
      to the render path.
      **Played for real:** two Electron instances on this machine with separate
      data roots, hosting and joining over a LAN WebSocket — turn 3 reached on
      both sides, identical state hashes, the guest's socket dropped from under
      it and reconnected on its `resumeToken` with nothing typed, hashes equal
      again, and the on-disk NDJSON replaying to the live state.
      Found and fixed along the way: D50 (a resync storm — 4 GB in 20 s, and only
      a REAL socket could see it), D49 (one frame per group ran into the relay's
      rate limit and silently dropped a player's updates), D54 (an intent must be
      routed to the seat it names), D55 (M3's rewind vote had nothing to execute
      it), D57 (a rejoining guest took a new seat and left a ghost), D58 (a
      silently substituted room code), D59 (`EADDRINUSE` as an uncaught main
      exception), D60 (two games appending to one log file).
- [x] **M5 Ship (2026-07-27):** the Tier-2 coverage pass, reduced motion and
      skip, the remaining screens, the installer, and four audits that each
      measure a claim the project had only been making.
      `src/ui/screens/` — **Settings** (every key in the main-process schema has
      a control; the `connect-src` allowlist is shown, because a user who cannot
      see what their app may reach cannot audit it) and **About** (the two
      attribution strings from `docs/SCRYFALL.md` §4 verbatim, and the complete
      four-line list of what the app does on the internet). `docs/SCRYFALL.md`
      itself, referenced since M1 and written now.
      `src/ui/anim/reducedMotion.ts` — ONE reader of the media query (D65), a
      MODE input and never a fourth scale reader. `SkipHint` makes hold-Space and
      Esc discoverable, three milestones after they were wired (D66).
      `src/data/tier3.ts` — the other half of the Tier-2 decision: what the app
      will NOT do for a card, on the card, derived from the same parser so it
      cannot claim coverage the engine does not have.
      **Verified: 1,316 checks across nine suites, 1,315 green.** 754 Vitest
      (38 new) · 121 card-DB · 26 images (offline) · 195 animation battery
      (a new 31-check `motion` section) · 115 probe (up from 97) · 24
      two-instance (up from 20, now driven through the real buttons) · 32
      two-instance `--offline` · 36 bundle audit · 13 install proof. The one
      failure is still the perf gate's long-frame count (D29/D29a): 7 over 20 ms,
      **0 over 33 ms**, p95 8.50 ms — inside the documented 3–9 range, measured
      three times. The 500-seed replay-equivalence fuzzer is green with the new
      combat keywords.
      **Shipped:** a 103.2 MB NSIS installer, installed and launched, reading the
      same `~/.commanders-roundtable` a dev session writes, seeing all 113,559
      cards, with no MSIX shadow copy anywhere (D2/D10b, proven rather than
      predicted). Played a 37-turn solo game and a full two-instance LAN game
      with a dropped-and-restored socket **with hostname lookups dark**.
      Found and fixed along the way: D63 (digest mode bypassed `d()`, so "Off —
      instant" cost 140 ms per group), D64 (the stack flourish ran at full length
      in digest mode, costing 546 ms of convergence), D67 (two battery checks
      that asserted on luck), the Multiplayer screen being styled entirely with
      colour tokens that do not exist — so Tailwind emitted **none** of those
      utilities and the panels had no borders at all — **ward being documented as
      Tier 2 since M1 and enforced nowhere**, poison being a losing condition
      that appeared on no screen, and 14.1 MB of renderer-only packages shipping
      inside `app.asar`.

### After M5, and M6.4 (in progress)

The milestone history from M5 onward, including every M6.4 card-script
decision bullet (one per landing, D158 onward), lives in `docs/M6.4-LOG.md`.
It was moved out of this file on 2026-09-19: at 3.3 MB / 42,000 lines the
auto-loaded instructions file exceeded the agent context window on its own
(every compaction failed, then "Prompt is too long"). The docs applier
(`apply-docs-dNNN.cjs`) appends each new M6.4 bullet above the marker on the
log's last line, never here. Current numbers: the newest bullet of the log
and the table in `docs/M6.4-HANDOFF.md`; the design record is
`docs/DECISIONS.md`.

⚠️ **Never grow this file with per-decision text again.** Anything written
here is injected whole into every agent session that touches the repo.


⚠️ **One that protects the enforcement of every other one (D154):**
14. **No source file contains a control character.** Tab, newline and carriage
    return; nothing else below 32, and not DEL.
    `src/sourceIntegrity.node.test.ts` scans every text file in the repo on every
    `npm run test`. ⚠️ It exists because three regexes here were written with
    their `\b` as a literal BACKSPACE by a patch script and therefore matched
    nothing — `primitives.node.test.ts`'s `isLand`, and **`purity.node.test.ts`'s
    `new WebSocket`, `document.` and `window.`, which is the whole socket-and-DOM
    half of invariant 7 below, unenforced for twenty-four decisions.** ⚠️ A
    backspace RENDERS AS NOTHING, so the source reads correctly in an editor, a
    diff, a review and every tool that prints it: being careful is not a control,
    only the scan is. ⚠️ It deliberately scans TEST files, unlike
    `purity.node.test.ts` — all three instances were in tests, because a corrupt
    regex in product code fails loudly while a corrupt one in an assertion just
    stops asserting. ⚠️ And when writing a patch script, put it in a FILE and run
    `node <file>`: every instance got in through a shell heredoc eating the
    backslash.

⚠️ **Two invariants M2 established that M3 kept, and M4 must not break:**
1. `animStore` may only **hide** or **decorate** — it never holds card→zone truth.
   The DOM's zone membership is always the authoritative state, so the worst a
   dropped animation can do is leave a card invisible for a moment, and a reconciler
   clears that within 500 ms.
2. `project()` must **preserve referential identity** for unchanged cards, seats and
   zone arrays. See D21 — this is a performance requirement with a measurement
   behind it, not a style preference. `src/engine/project.ts` does it with a
   per-viewer `Projector` that must be kept alive across commits; constructing a
   fresh one per frame is exactly the bug D21 describes.

⚠️ **Two the tap established (D76, D77):**
12. **The auto-stack GROUPING may lag the view; nothing inside it may.** A merge
    that would erase a turned pile before it could straighten is held open for one
    turn (`mergeHold.ts`) — but only the SHAPE waits. Tap state, counters, P/T and
    zone membership are re-read from the live view every render, the hold drops
    the instant the band's cards change, and a card that left the battlefield is
    never held (that is a flight, and a held slot would race its own clone). See
    D77 before adding anything else that lags a view.

11. **The turn and the beats own DIFFERENT elements.** A card's root carries its
    layout box, its registry key and nothing else; `[data-card-turn]` carries the
    tap transform, its transition and the dimming filter. Every beat animates the
    ROOT through `elementFor()`, so putting a CSS `transition: transform` on it
    interpolates each of motion's writes and turns a beat into mush — measured as
    "peak 1.000 vs settle 1.000" on two pops that were plainly animating. Never
    give the root a transform, a filter or a transition. And read the TURN element
    for "is this tapped, and how big is it on screen": a child's transform does
    not grow its parent's box, so the root measures upright either way.

⚠️ **One the second-person log established (D101):**
13. **A narration line is PARTS; `text` is DERIVED from them; the PERSON is chosen
    at projection.** `narrated()` still takes a plain string, and must — a line
    whose subject is a card ("Lightning Bolt resolves.") reads the same to
    everyone. But the moment a line names a PLAYER it has to be built with `n` and
    the builders in `src/engine/narrate.ts`, or the log can only ever be third
    person and says "You draws a card." to the player who drew. Never hand-write
    `text`, and never let a second-person string into the engine: the engine does
    not know who is reading, `project()`/`toViewEvents()` do. A source guard in
    `purity.node.test.ts` catches the realistic regression (a `players[…].name`
    interpolated into a `narrated(\`…\`)`); it cannot catch every shape, so read
    D101 before adding a narration line.

⚠️ **Two that M5 established:**
9. **A category that is unenforced must be SAID.** `src/data/tier3.ts` tells the
   player, on the card, what the app will not do for them — derived from the same
   parser the ingest uses, so it cannot claim coverage the engine does not have,
   and silent for a card the engine handles completely. See D68, and **D122/D124
   for how badly it can be broken without anything failing**: a permanent's
   triggered and static text, a payable-but-unrun activated ability, and the half
   of a mana line that is not "add mana" were all three unsaid, so **16,020 of
   31,692 Commander-legal cards — 50.5% — said nothing at all**, which in this app
   means "handled". Ask this of anything that stops short of running a card — in
   BOTH directions, because the mana case was the engine doing part of a line and
   charging none of its cost — and never let a note be re-derived beside the parser
   that already answers it.
10. **Any losing condition the engine enforces has to be visible before it
    fires.** Poison had a state-based action from M3 and appeared on no screen
    until M5. Ask this of anything added to `sba.ts`.

⚠️ **Three more that M4 established:**
6. **The host's own player runs through a `loopbackPair`**, holding the same
   projected `PlayerView` a guest holds. There is no privileged path from
   `HostSession` to the host's UI, and no `if (isHost)` anywhere in `src/ui/`.
   That is also what lets a test run a host plus four clients in one process.
7. **`src/net/` holds the engine's purity line** minus the one thing a transport
   genuinely needs: a socket. No react, electron or zustand;
   `purity.node.test.ts` checks it per file, and only `socketTransport.ts`,
   `relayTransport.ts` and `devHandles.ts` may name a `WebSocket` or the DOM.
8. **Nothing under `relay/` may import `src/`.** `relay.node.test.ts` greps for
   it. A relay that could see the engine would become a second source of truth.

⚠️ **Three more that M3 established:**
3. `src/engine/` is PURE and DETERMINISTIC, enforced by
   `src/engine/purity.node.test.ts` — no react/electron/node/zustand imports, no
   `Date.now`/`Math.random`/`performance.now`, and nothing outside
   `src/{engine,data,view}`.
4. Nothing in `src/ui/` imports `GameState` or `src/engine/types/state` except
   for pure option types. The UI reads a `PlayerView` and calls
   `session.submit()`, exactly as a remote guest will in M4 — which is what makes
   "the host cannot see your hand" structural rather than disciplined.
5. Every state change goes through an event appended to the log — including all
   Tier-3 manual tools. Never add a code path that changes state without
   emitting one.

## Agent tooling map

- This file is the canonical project instructions; `CLAUDE.md` is a pointer to it.
- `.claude/launch.json` is Claude Code dev-server launch config; leave it in place.
- Workspace-wide rules (offline-first, Electron packaging, `---Done---`):
  `H:\Claude Apps\AGENTS.md`. Machine-wide: `~/AGENTS.md`.
- Claude Code auto-memory for this workspace:
  `C:\Users\apps\.claude\projects\H--Claude-Apps\memory\` (start at `MEMORY.md`).
  Plain markdown; any agent may read it.
