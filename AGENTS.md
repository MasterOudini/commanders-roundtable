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

### After M5

- [x] **Spells that actually resolve (2026-07-27):** cast Lightning Bolt, aim it,
      and it takes three life — or marks three damage and lets the existing
      state-based action kill the creature. `src/data/effectParse.ts` (the closed
      vocabulary) · `src/engine/effects.ts` (specs → EVENTS, never a mutation) ·
      a non-combat `DamageDealt` sharing combat's reducer path · until-end-of-turn
      P/T at CR layer 7c, which did not exist before · the assisted offer in
      `PromptBar`. Decisions in **D90–D91**.

      **Measured, and the boundary is the point:** of 6,975 distinct
      Commander-legal instants and sorceries, **274 are understood completely**
      and resolve on their own; **1,300 are understood only in part** and NEVER
      run by themselves — the prompt bar offers the understood half as one logged,
      manual click and says the rest is the player's. `tier3.ts` says on every
      card which of the three it is.

      ⚠️ **The rule that shaped it: never half-execute.** The first cut used a
      loose target pattern and "understood" `Homing Lightning` and `Spell Blast`
      by their prefixes — both would have executed as a prefix and silently
      dropped the rest. Closing the vocabulary dropped measured coverage from
      10.4 % to 3.9 %, and that drop IS the feature.

      **Verified: 824 Vitest (13 new in `engine/effects.test.ts`) · 252/254
      battery · 500-seed fuzz gate green at 98,808 accepted intents / 1,149,974
      events with identical replay hashes.** The two battery failures are both the
      perf gate's frame counts, on the FIXTURE-driven path the engine never
      touches, with p50/p95 byte-identical to passing runs (D29/D29a).

      ⚠️ **Two latent bugs surfaced the moment resolution stopped being a no-op**
      (**D91**): `targetsStillLegal` admitted graveyard and exile for everything,
      so a Bolt aimed at a creature exiled in response still marked damage on an
      object off the battlefield; and a card's TYPE counted as a targeting kind in
      every zone, so a Grizzly Bears in a graveyard was still a legal "target
      creature". Both were real targeting bugs nobody could see while spells did
      nothing.

- [x] **Targeting, with an MTG-Arena arrow (2026-07-27):** click or drag a spell,
      an arrow follows the cursor from the card, and only legal targets are
      clickable — creatures, your own creatures, players, planeswalkers, cards in
      graveyards, objects on the stack. Works for **every** targeted spell and for
      activated abilities, which could not be used at all before this.
      `src/data/targetParse.ts` (the clause parser, and the Auras that target
      without saying "target") · `src/data/activatedParse.ts` ·
      `src/engine/targets.ts` (ONE legality rule, two adapters — D81) ·
      `src/engine/handlers.ts` (the `targets` cast stage, `ActivateAbility`) ·
      `src/ui/game/ArrowLayer.tsx` (the first SVG in this renderer, at the app
      root — D85) · `src/store/aimStore.ts` · `src/ui/game/AimVeil.tsx` (players
      and stack items joined the targetable set) · `src/ui/game/useAimGesture.ts`.
      Blocks work the same way: pick your creature, drag the arrow onto the
      attacker it stops — distinguished from a target arrow by a parry bar rather
      than by colour, and with the legal pairings shipped by the host because
      `canBlock` reads derived keywords no client can see. Decisions in
      **D79–D89**.

      **Coverage, pinned over the whole 113,559-card database (D80):** 20,840
      spell-level target specs, **17,330 read confidently** and 3,510 to honest
      free aim, plus 3,536 Aura `Enchant` clauses; 42,945 activated-ability lines,
      24,729 payable. A clause the parser cannot read still gets the arrow — it
      just does not pretend to know the rule, and `tier3.ts` says so on the card.

      **Verified: 253/254 battery · 809 Vitest (23 new in `engine/targets.test.ts`)
      · 500-seed fuzz gate green at 98,690 accepted intents / 1,147,463 events,
      with 1,444 target prompts and 645 declared.** The one battery failure is
      still the perf gate's long-frame count (D29/D29a): 7 long frames, p95
      8.5 ms, **0 stray rect reads**. Played by hand and screenshotted aiming a
      Bolt at a creature and at a player's plate, and blocking an Air Elemental
      with a Giant Spider.

      ⚠️ **Four pre-existing defects were fixed on the way past, none of them
      cosmetic.** (a) `PromptBar` hardcoded the attack defender, so nobody at a
      3–4 player table could choose whom they attacked (**D88**). (b)
      `session.previewCast` dropped its `targets` argument, so M5's ward surcharge
      could never reach the player approving the payment (**D87**). (c) The X cast
      stage emitted no `Awaiting` and could strand a card in the stack zone with a
      live `pendingCast` (**D84**). (d) `finishFromPending` never cleared the
      awaiting, which jammed the engine after the first staged cast — the fuzzer
      measured 6,070 prompts against 37 declarations with every other assertion
      green, and fixing it nearly doubled the gate's accepted intents (**D84**).

      ⚠️ Hexproof and shroud had been in the Tier-2 table since M1 and were read by
      **nothing**. Targeting is the first thing that enforces them, and only where
      PRINTED — a granted one needs a layer-6 script (**D82**).
- [x] **Drag a card out of your hand to play it (2026-07-27):** press a card in
      the fan, drag it onto your own side of the table, let go. A land goes
      straight down; a spell opens the same payment review a click opens, with
      the card left lying where you dropped it until you confirm or cancel.
      Clicking still does everything it did — this is a second gesture, not a
      replacement, and the keyboard path (1–9) is untouched.
      `src/store/dragStore.ts` (the phase machine: idle → dragging → released →
      returning) · `src/ui/table/useHandDrag.ts` (the gesture: 6 px threshold,
      window listeners, ONE drop-zone rect read per drag) ·
      `src/ui/table/DragLayer.tsx` (the held card, mounted at the APP root beside
      `FlightOverlay` and positioned by an imperative store subscription — no
      React commit per pointermove) · `PlayerPod` marks my pod `data-drop-zone`
      and lights it · `useEngineTable.dropCheck/onCardDrop` decide what a drop
      MEANS · `rectRegistry.setDropOrigin` + `flightLayer.recentFlights`.
      ⚠️ `src/ui/table/` still knows nothing about the engine: no drop callback,
      no drag — which is why fixture mode and the animation battery are unchanged.
      **Verified: 31 new battery checks (`battery-anim.cjs drag`), 14 new Vitest,
      224/225 battery · 768 Vitest · 115/115 probe.** The one battery failure is
      still the perf gate's long-frame count (D29/D29a): 6 long frames, **0 over
      33 ms**, p95 8.5 ms, **0 stray rect reads** — the drag writes one transform
      per pointermove and reads the drop zone's rect once per gesture. Played by
      hand and screenshotted in all three states. Decisions in **D73**.
      ⚠️ Noticed in passing, NOT caused by this work: the `table` section's layout
      sweep failed when it was the FIRST section to open the table screen — the
      real card pool resolved mid-sweep and rebuilt the fixture board at the React
      state's seat count, so 4 pods were measured against 2-seat metrics. Fixed
      separately; see **D74**.
- [x] **The tap is a full quarter turn (2026-07-27):** a tapped permanent turns
      90° to the right, the way it does on a real table, instead of the 20.5° lean
      M2 shipped. `Card` composes `translate(Δ, −Δ) rotate(90deg)` about the
      card's centre so the turned box lands on the slot's top-left corner and the
      layout box never moves; `packRow` reserves the turned footprint **per tapped
      slot** (`PackItem.tapped`, `PackedCard.footprintW/H`) so a row still never
      overlaps; `PermanentStack`'s wrapper is sized to that footprint, which is
      what the pile badges and `data-band-slot` hang off.
      ⚠️ The translate and the packer's footprint are the same number in two
      places — see **D75**, which also answers the spec's open Decision 4.
      Also `beats.uprightSource()`: a clone flies upright and takes its size from
      the source rect, so a dying ATTACKER (attackers are tapped) began its flight
      28 % too small until the turned box was stood up first.
- [x] **The untap reverses the turn (2026-07-27):** symmetric easing
      (`--crt-ease-in-out`, so untapping is the tap played backwards), the slot's
      column animated instead of teleporting 69 px mid-turn, and the row now WAITS
      for a card to straighten before it closes up — 37 px of measured overlap
      became 0 px at every frame. Getting there exposed a defect that had been in
      since M2: the tap transform and every BEAT were writing the same element's
      transform, with a CSS transition between them, which had been quietly
      flattening the token/counter pops and letting combat's `clearCombatPoses`
      WIPE the turn off a tapped attacker. The card is now two elements — see
      **D76** for the rule.
      Then the last case with nothing to animate: an untapping pile that MERGES
      back into an identical one has no slot to turn in, so the auto-stack
      grouping now lags the view by one turn (`mergeHold.ts`) — see **D77**, and
      read it before making anything else lag a view.
      And the mirror of it: a slot that mounts tapped — a pile SPLITTING, or a
      permanent entering the battlefield tapped — renders upright for one frame so
      the transition has somewhere to start (`Card.turnOnMount`, **D78**). The
      BAND decides which arrivals qualify: never during a `hardSyncFlash`, never
      in a band that had no cards a render ago, or a resync turns twenty cards in
      unison.
      **Verified: 19 battery checks in `battery-anim.cjs tap` (5 for the motion
      itself, 4 for the pile split and merge), 11 new Vitest, 242/243 battery ·
      782 Vitest · 115/115 probe, three clean full runs.** The one battery failure
      is still the perf gate's long-frame count (D29/D29a): 3–6 long frames,
      **1 over 33 ms**, p95 8.5 ms, **0 stray rect reads**.
- [x] **Import a deck by link — Moxfield, Archidekt, TappedOut (2026-07-27):**
      paste a deck's address, press **Fetch decklist**, and the list arrives in the
      same box a paste goes in — visible and editable before anything is saved.
      `electron/deckfetch.cjs` (a SECOND exact-host allowlist, https only, no
      credentials, no port, redirects re-validated, byte cap, idle timeout, rate
      limit; a `SITES` table of three adapters that each return the SAME Arena text
      the parser already reads) · `decks:fetchUrl` in `ipc.cjs` · `decks.fetchUrl`
      in `preload.cjs` + `bridge.d.ts` · `deckStore.importFromUrl` · the link row on
      the Decks screen. Decisions in **D92**; offline-first exception #5 above.
      ⚠️ The renderer still has NO network reach — it hands over a URL string and
      gets decklist TEXT back. Importing by link adds a download, not a second
      import path, and **not a second idea of what a commander is**: every site
      adapter's whole job is to produce `Commander` / `Deck` / `Sideboard` text.
      ⚠️ Each site says where the commander is DIFFERENTLY, and each rule is
      measured on six real decks: TappedOut hides it in the page's Arena export
      (its `?fmt=txt` does not mark it at all), Moxfield has an explicit
      `boards.commanders`, and Archidekt has user-named CATEGORIES — where the
      commander category can be renamed, so the fallback is its `isPremier` flag,
      bounded at two. Archidekt has no sideboard either: a category flagged
      `includedInDeck: false` is its maybeboard, and excluding those is what made
      six of six decks come to exactly 100.
      **Verified: 114/114 `battery-deckimport.cjs` (71 of them offline) · 833
      Vitest (9 new) · 124/124 probe (up from 115) · the 500-seed replay fuzz gate
      still green.** Driven through the real
      buttons in the live app, once per site: **100 of 100 cards resolved on all
      three**, 0 unreadable lines, the commander identified from the site's own
      structure, all three "Legal Commander deck". A Moxfield deck was saved as a
      real deck file and deleted again. Every failure path — a site we do not
      import from, a link that is not a deck, a deck that is not there — names the
      site and says what to do, and a good link after a bad one clears the error
      rather than stacking with it.
      ⚠️ **A real parser defect surfaced the moment two more sites were feeding
      it** (D92): `src/data/decklist.ts` accepted collector numbers of the shape
      `TSP-157` but not `C18-150` or `2023-8`, both of which are real and both of
      which appeared in the first deck fetched from each new site. A rejected
      collector number does not merely lose the printing — the trailing-group peel
      STOPS there, so `Harrow (PLST) C18-150` stayed glued together as the card's
      NAME and resolved to nothing. One card in each of two 100-card decks, which
      is exactly the kind of miss a smaller sample never shows.

- [x] **Play solo: choose the table before you sit down (2026-07-27):** a lobby of
      its own — how many players (2–4), which deck at each seat, start. Every seat
      can take any saved deck or a starter deck, and each row shows the commander
      and card count of what it is about to play, so a wrong pick is visible before
      the shuffle rather than at the table.
      `src/ui/screens/SoloScreen.tsx` · `src/store/soloStore.ts` (the choices
      outlive the screen — the second setup of a session is a rematch, and
      re-picking four decks to change one is friction) · `tableStore.tokens/stops`
      (handed over by whoever STARTS a game; the table no longer owns them) ·
      `useUi.goto()` · the table's two hardcoded "New solo game (4 seats)/(2
      seats)" buttons became one "Set up a solo game".
      ⚠️ No new game code: `startSolo({ seats, deckIds })` already took both. This
      is the UI that was missing, and the seat labels come from `seatName()` so the
      lobby cannot disagree with the table about who is sitting where.
      **Verified: 253/254 animation battery · 833 Vitest · 124/124 probe · fuzz gate
      green.** Driven through the real controls: a 2-seat game with Omnath and Kess
      and a 3-seat game with Kess, Omnath and a starter deck — right commanders in
      the right command zones, 92-card libraries, 40 life, awaiting mulligan; the
      lobby remembers the setup when you come back to it mid-game, and the
      Tier-3 token tool has all twelve tokens.
      ⚠️ **Two real defects found on the way, both older than this feature** —
      see **D93**. The fixture board rebuilt on top of a live game the first time
      the table was made visible (a 3-seat game became a 4-seat fixture board),
      reachable from the multiplayer lobby since M4; and navigating by `setScreen`
      alone desynced the hash the shell treats as the source of truth.

- [x] **Cast your commander by dragging it out of the command zone (2026-07-27):**
      press the commander in the CMD pile, drag it onto your side of the table,
      let go — the same payment review a spell from hand opens, commander tax
      included. Clicking it does the same thing, because the hand has both and a
      card you can drag but not click is a card people think is broken.
      ⚠️ **No new rules path, and no new gesture.** `useHandDrag` never knew where
      a card came from, and `dropCheck`/`onCardDrop` look actions up by card id in
      `legal`, never by zone — so the commander reuses both verbatim. What was
      missing was only the way to reach an action the engine has offered since M3;
      before this there was **no way to cast a commander at all**.
      `ZonePile.onTopPointerDown` · `PlayerPod` holds the second `useHandDrag`
      (safe: both refuse to start unless `useDrag.phase === 'idle'`) · the park
      watcher in `useEngineTable` now checks BOTH zones a drag can start from ·
      `drag.startPile` joins `drag.start` in the probe handles. Decisions in **D94**.
      **Verified: 253/254 animation battery · 833 Vitest · 124/124 probe.** Driven
      through the real gesture on the visible table: with no mana the ghost reads
      "Not enough mana for Kess, Dissident Mage" and the drop is refused; with mana
      it reads "Cast Kess, Dissident Mage", the pile empties while the card is in
      the air, the drop opens the payment review, and confirming resolves Kess onto
      the battlefield with the command zone empty and no ghost left behind.

- [x] **The import works out the commander, including the second one (2026-07-27):**
      a list with no `Commander` heading is now decided by the CARDS rather than by
      "line one, whatever it is" — and when the commander it finds brings Partner,
      Partner with, Friends forever, a Background or a Doctor's companion, it looks
      for the legal partner and takes both. `src/data/pickCommanders.ts` ·
      `pairsLegally` exported from `validate.ts` so the importer asks the VALIDATOR
      the pairing question instead of re-implementing it · detection moved AFTER
      name resolution in `deckStore.buildPreview`, because every question that
      decides it is a question about the card · the Decks screen SAYS what it chose
      and why. Decisions in **D95**.
      ⚠️ A `Commander` heading still wins — detection is only for lists that did
      not say. A Background is never the first commander. A `2 Rograkh` line puts
      one in the command zone and leaves the other for the singleton rule.
      **Verified: 844 Vitest (11 new) · 124/124 probe.** Measured on the user's own
      99-card Ardenn + Rograkh deck, stripped of its headings and sorted
      alphabetically — the shape TappedOut's plain export arrives in, with the
      first commander at line 3 behind `Accorder's Shield` and `Arcane Signet` and
      the second at line 56: both found, colour identity W+R, note reading "both
      have Partner", and the only remaining issue the deck's real one (99 cards).

- [x] **Equip by dragging (2026-07-27):** press an Equipment or Aura on your own
      battlefield, drag it onto a creature, let go. Clicking it does the same. It
      also MOVES: an already-attached Equipment can be dragged off its host onto
      another creature, which is most of what equipment does.
      ⚠️ **It is the targeting ARROW, not a card drag** — you are pointing at what
      the thing goes on, exactly like declaring a block. The veil "knows nothing
      about modes; it is handed a legal set", so this needed a legal set and a
      commit rather than a second hit-testing machine, and it inherits "only legal
      hosts are clickable" for free. `tableStore` gains an `attach` mode ·
      `GameLayer` computes the hosts · `aimCommit` submits `ManualAttach` ·
      `useEngineTable.onCardPointerDown` starts it and hands straight over to
      `useAimGesture`. Decisions in **D96**.
      ⚠️ **Still Tier 3, and the prompt says so.** `Equip {2}` has no colon, so the
      ingest never reads it as an activated ability and the engine cannot charge
      it. This moves the attachment and nothing else; the prompt bar carries
      "Moves it only — the equip cost and its timing are yours." Before this,
      `ManualAttach` was reachable from NOTHING.
      **Verified: 253/254 animation battery · 844 Vitest · 124/124 probe · fuzz
      gate green.** Driven with the real gesture on the user's own Ardenn/Rograkh
      deck: Swiftfoot Boots dragged onto Ardenn (1 legal host offered, the veil
      covering everything else), then dragged off Ardenn onto Rograkh — both
      logged, and the boots render tucked under whichever host they are on.
      ⚠️ Found the hard way: `Card` accepts no pointer props, only `onClick`, so a
      handler passed to it is silently dropped. The first cut built clean and did
      nothing; the press belongs on the slot wrapper.
      ⚠️ Its "the top commander only" caveat is GONE — D98 gave the command zone a
      slot per commander, so either partner can be picked up.

- [x] **See what is on a creature, and act on it (2026-07-27):** a permanent with
      anything attached grows a small TAB on its left edge — two plates and a
      count, drawn as the edges of the cards stacked behind it. Click it and a
      panel lists every Equipment, Aura and Fortification on that creature with
      **Move** (re-enters the D96 attach aim), **Take off** (`ManualAttach` to
      nothing) and **More…** (the existing card menu, so every manual tool is one
      click away rather than reimplemented).
      ⚠️ The tuck is a good picture and a bad affordance: 13 px of card edge with
      no name and nothing to click, so attaching something effectively hid it.
      ⚠️ The tab's press `stopPropagation()`s — the slot wrapper is what picks a
      permanent UP, so without it pressing the tab drags the creature. The panel
      reads the VIEW every render, so an attachment that moved or died leaves the
      list. Both actions are Tier 3 and the panel's footer says so.
      `tableStore.attachments` · `AttachmentsPanel` in `ManualTools.tsx` ·
      `PermanentStack` renders the tab · threaded to EVERY pod (an opponent's
      auras are worth reading; picking one up stays mine-only). Decisions in **D97**.
      **Verified: 253/254 animation battery · 844 Vitest · 124/124 probe.** Two
      Equipment attached to one commander, tab reading 2, panel listing both;
      Take off unattached and gave the card its own slot back, Move re-aimed it
      onto the other commander, both logged.
      ⚠️ It renders NOTHING in fixture mode — measured at 0 tabs across 36
      permanent slots — which is why the battery drives the same components it
      always did. A `tap`-section failure seen once mid-session did not reproduce
      (a different check failed the next run, and the section passed 12/12 alone):
      that is the documented settle-timing flakiness, not this.

- [x] **Zone order, and a slot per commander (2026-07-27):** the pile block reads
      top to bottom as **command → exile → library → graveyard**, and the command
      zone is a BOX of one slot per commander rather than a pile — one card for a
      single commander, two side by side for a partner pair, each individually
      clickable and draggable. `src/ui/table/CommandZone.tsx` (new; the zone anchor
      is the box, never a slot) · `PlayerPod` solves the sizes. Decisions in **D98**.
      ⚠️ **THE BLOCK'S WIDTH IS A FIXED BUDGET; the pile sizes are solved to fit
      inside it.** Adding a third column instead cost the battlefield ~60 px per pod
      and put THREE bands into scrolling — the fourth rung of the packing ladder,
      and a bar the battery holds. Caught by `battery-anim` and fixed by pinning the
      budget to what it always was (2 card-widths in two rows, 4 in one).
      **Revised the same day to the shape actually wanted:** command box, then
      library + graveyard side by side, then EXILE underneath them **lying on its
      side** (a quarter turn right, like a deck on a mat).
      ⚠️ The SLOT turns, not just the card — a pile in a wrapping block must
      RESERVE the landscape footprint. ⚠️ And ONLY the cards turn: the empty
      slot's label and the count badge stay in the upright outer box, because the
      first cut had them inside the rotated wrapper and `EX` read sideways.
      **Verified: 253/254 animation battery (12/12 in the layout section, 0 bands
      scrolling at 4 seats) · 844 Vitest · 124/124 probe.** Measured on a 4-seat
      game: command 91 px with two slots for the partner deck and one for each
      starter-deck opponent, library and graveyard 81 px each, exile 81×58
      landscape with upright text, and both partners pick up individually.

- [x] **You can see what phase it is, and whose turn (2026-07-28):** the phase
      strip is two rows — the five PHASES of a turn across the top, the twelve
      STEPS named underneath — instead of one 30 px row of two-letter codes, and
      the ACTIVE SEAT'S WHOLE POD lights brass. `PHASES` gained `step` and
      `group`; `PHASE_GROUPS` is derived from it at module scope so the two rows
      cannot disagree. `PHASE_H` 30 → 48, which is battlefield height spent on
      purpose. Decisions in **D99**.
      ⚠️ **The sliding marker had been covering the current step's label since
      M2** — same box, rendered later, and everything in the strip is positioned,
      so the one step you most need to read painted as a blank brass block. Both
      markers now render BEFORE the labels, with explicit z-indices.
      ⚠️ `PlayerPlate` computed `isActive` and rendered NOTHING with it. Brass,
      never the seat's identity gradient — the five colours keep their five
      places, and whose turn it is a UI state, not a fact about anyone's mana.
      ⚠️ **BRASS IS THE TURN; GREEN (`--color-crt-ok`) IS PRIORITY** — the chip,
      the nameplate ring and the prompt-bar text, all three. The ring was brass
      too, so a seat holding both showed one colour twice and answered neither
      question, and those come apart on every turn you cast into. Green is 4°
      from green mana and that is fine here for the same reason brass was not:
      none of the five places is HUD chrome. Copy is one vocabulary now —
      "YOU MAY ACT" / "CY TO ACT", not "YOUR PRIORITY" / "CY TO ACT".
      ⚠️ The right-hand control slot is a RESERVED 132 px, not sized to its
      contents: a caller-provided node has no width this component could know,
      and that reservation is what keeps the narrow-width fallback arithmetic
      rather than a stray `getBoundingClientRect`.
      **Verified: 844 Vitest · 124/124 probe · 253/254 animation battery**, swept
      at 1920/1500/1366/1280/1100 with no truncation and no overflow at any of
      them. The one battery failure is still the perf gate's long-frame count
      (D29/D29a): 7 long frames, **0 over 33 ms**, p95 8.50 ms, 0 stray rect
      reads. ⚠️ `metrics.test.ts`'s "clips more of the hand" case moved from
      hostH 895 to 910 — the taller bar moves that ladder rung to 901–925; the
      ladder's shape is unchanged.

- [x] **The log and the stack say WHOSE (2026-07-28):** the 2 px edge bar on a
      log row and a stack item is now the seat's **commander identity** instead
      of the card's — the same colours as the gradient under that player's
      nameplate. Decisions in **D100**.
      ⚠️ **No sixth place for the five colours.** That bar was already one of the
      sanctioned five; only what it is keyed to changed.
      ⚠️ Measured before the change: **20 of 20 visible log rows had no colour**,
      because most lines are not about a card (`Turn 5 — Ana.`, `Ana draws a
      card.`, `No blocks.`) and an empty identity resolves to `mtg-c`.
      ⚠️ `identityGradient(identity, deg)` in `cardTypes.ts` is the ONE answer to
      "what colour is this player" — `identityToken` collapses multicolour to
      gold, which cannot tell a Jeskai seat from an Esper one. `PlayerPlate`'s
      private copy is gone.
      ⚠️ **The engine now records who a line is about.** `Narrated` and
      `NarrationLine` gained `player`, and `narrated()`'s second parameter is
      REQUIRED and positional across all 50 call sites — an optional trailing one
      would let a site that did not think about it fall silently back to grey.
      `cause.player` is NOT enough (empty for everything the rules do alone) and
      `turn.activePlayer` is wrong the moment a spell resolves on someone else's
      turn. `null` means genuinely nobody: `No blocks.`, `The game is a draw.`
      **Verified: 844 Vitest · 124/124 probe · 253/254 animation battery · the
      500-seed replay fuzz gate green** — that gate matters here because
      `NarrationLine` is part of `GameState` and so of the state hash.

- [x] **The log reads in the second person (2026-07-28):** it said **"You draws a
      card."** — and "You plays Swamp.", "You casts Lightning Bolt.", "You keeps
      7." It now says "You draw a card." to the player who drew and "Ana draws a
      card." to everyone else, from ONE line of narration. Decisions in **D101**.
      ⚠️ **Two causes, and the grammar was the smaller one.** `SEAT_NAMES[0]` was
      the literal string `'You'`, in front of a third-person verb — but solo play
      is a HOTSEAT (D42) and `setViewer` rotates the one viewer across every seat,
      so the seat labelled "You" was routinely not the seat being played. **No
      seat is called "You" any more**; they are `Ana`, `Ben`, `Cy`, `Dee`, and the
      table already says which pod is yours by putting it at the bottom.
      ⚠️ **A line is not a string.** `src/engine/narrate.ts` — `narrated()` takes
      PARTS, and there is exactly one primitive: a fragment that reads one way
      normally and another way when the reader is the player it is about. A name,
      a possessive, both pronouns, a reflexive **and a verb** are all that one
      shape. `n`${who(state, ap)} ${vb(ap, 'draws', 'draw')} a card.``
      ⚠️ **NO ENGLISH MORPHOLOGY ANYWHERE** — both forms are written at the call
      site. A de-inflector gets `loses`→`los` and `goes`→`goe`, silently.
      ⚠️ **`project()` and `toViewEvents()` choose the person**, because both
      already take a `viewer` — projection IS the per-viewer boundary. `src/ui/`
      is UNCHANGED and still knows nothing about person, which is what makes this
      correct in multiplayer and across every hotseat seat change for free.
      ⚠️ **`NarrationLine.text` is DERIVED from the parts, never hand-written**,
      and stays the canonical third person: the NDJSON log, the state hash, a
      spectator. `render(parts, null) === text` is asserted over a whole game, and
      every existing sentence is byte-identical — which is what made the change
      provably grammar-only. The two deliberate exceptions both fixed a sentence
      that was ALREADY wrong: `Ana sets Ana to 37 life.` → `Ana sets themselves`,
      because the plain object form would have said `You set you to 37 life.`
      ⚠️ **`player` (D100) is the COLOUR, not the subject** — "Ana passed for Ben"
      is coloured Ben and its subject is Ana. Grammar comes from the parts alone.
      ⚠️ **The same defect was in the prompt bar**: six `awaiting` kinds had no
      viewer branch, so they read **"You is ordering blockers."** and **"You is
      choosing targets."** Fixed the way the other ten branches already worked.
      **Verified: 869 Vitest (19 new in `engine/narrate.test.ts`) · 124/124 probe
      · 253/254 animation battery · the 500-seed replay fuzz gate green** at
      98,808 accepted intents / 1,149,974 events with identical replay hashes —
      that gate matters because `parts` is part of `GameState` and so of the hash.
      Every template was driven through a real game and read in both persons.
      **Proven on two real apps over one LAN socket** — identical state hash
      `99ac4b12cdc1f946`, each in its own seat, host reading "You go first. / You
      keep 7. / Apps keeps 7. / Turn 1 — You. You skip your first draw." while the
      guest reads "Apps goes first. / Apps keeps 7. / You keep 7. / Turn 1 — Apps.
      They skip their first draw." from the same lines.
      ⚠️ **Found while running that gate, PRE-EXISTING, fixed separately** — see
      the next entry and **D102**.

- [x] **The two-instance sign-off answers "choose targets" again (2026-07-28):**
      `scripts/two-instance.cjs` was reporting **21/24** and had been since the
      targeting work landed. Back to **25/25** (the repair added a check of its
      own). Decisions in **D102**.
      ⚠️ **The apps were never wrong.** Both agreed on the identical state hash
      and each sat in its own seat; the game was stopped on
      `awaiting: 'chooseTargets'` with nobody answering. `simplestIntent` in
      `src/net/testing/script.ts` had no case for the prompt D79–D89 added, so it
      fell to `default: return null` and submitted nothing ever again. The `host
      t?` in the failing output was the driver having no answer.
      ⚠️ **48 net tests stayed green throughout, because `fixtureDeck`'s pool had
      no targeted spell** — ten creatures, an artifact and a land. `playFrom`
      could not reach the prompt it could not answer. The pool now includes
      `Lightning Bolt`. This is the SAME repair that pool's own comment records
      making once before (it used to be forty lands): **a fixture that cannot
      reach a code path is how that path rots.**
      ⚠️ **Targets are planned PER CLAUSE.** `validateTargets` runs
      `assignTargets`, a one-for-one matching, so "the first N legal choices" is
      rejected whenever two picks answer the same clause. `planTargets` fills each
      clause from its own legal set and never lets one object answer twice.
      ⚠️ **The answer must TERMINATE.** An unsatisfiable clause gets
      `CancelPendingCast`, not `null` — but cancelling alone turns the deadlock
      into a LIVELOCK, because `legalActions` never considers targets and would
      re-offer the same spell forever. So the cast filter also skips a spell whose
      targets cannot be planned, in the same shape as the `!a.hasX` filter beside
      it. Prevention and recovery, not either alone.
      ⚠️ **AND THE SIGN-OFF WAS STOPPING BEFORE IT PROVED ANYTHING.** With the
      driver fixed it passed 25/25 while its on-disk log held
      `2 LandPlayed, 2 MulliganKept` and nothing else: it played to turn 3, which
      BEGINS after two land drops and before either side has a main phase to
      spend them in, so the stack, the payment solver and the whole cast path had
      never run over the wire. It could not have caught the bug it had just been
      fixed for. The loop now plays until **a spell has been cast and RESOLVED
      and both apps show it**, on a deadline.
      ⚠️ **The exit condition IS the assertion.** A fixed "play to turn 6" would
      still pass on a game that cast nothing. Stopping on the resolution also
      keeps the run short — turn 3 on a fast shuffle, turn 7 on a slow one. And a
      RESOLVED spell rather than a cast one, because a spell only leaves the
      stack once its costs are paid and its targets accepted.
      ⚠️ Detection reads the log the PLAYER sees and matches both `\bcasts?\b`
      forms, because D101 writes the log from the reader's side. The two counts
      are sampled over sequential CDP round trips and **routinely differ by one**
      — that is probe skew, not lag; the hash check beside it is the one that
      must be exactly equal.
      **Verified: 869 Vitest (1 new) · two-instance 25/25 across four runs
      (12–22 intents, turn 3–7, 253 log lines against 193) · 33/33 `--offline` ·
      the 500-seed fuzz gate unchanged.** The new Vitest case was checked by
      DELETING the fix: it then fails `expected 0 to be greater than 0`, which
      also proves the pass comes from the new case rather than from the cast
      filter quietly skipping every targeted spell. A real run logged `SpellCast`
      twice plus a `TargetsChosen` — the targeting answer crossing a real socket.

- [x] **Found by playing, not by testing (2026-07-28):** a 35-turn 4-seat game by
      hand turned up two things every suite was green through. Decisions in **D104**.
      ⚠️ **The bar read "TURN 0" and lit UNTAP during the mulligan** — a step
      nobody was in, because `view.turn.phase` has a default the engine had not
      set yet. It now reads `MULLIGANS · BEN GOES FIRST` and marks NO step:
      both markers unmount and every label goes faint. `turnNumber < 1` is the
      signal and is safe because `emptyView()` starts at 1, so fixture mode
      cannot render as pre-game.
      ⚠️ **The layout sweep had only ever measured UNTAPPED boards**, which is
      the one state a real game is never in. A tapped slot reserves the
      landscape footprint (D75) — 127 px against 91 px — and at 4 seats /
      12 per seat that is **0 bands scrolling untapped against 2 bands and
      52 px over** once the opponents are two-thirds turned. The new block taps
      the OPPONENTS (my own band is 1514 px against their 421 px, so tapping
      mine proves nothing), REPORTS the overflow rather than asserting zero
      (scroll is rung 4 of the ladder, not a failure), and asserts what must
      hold in every tap state: nothing overlaps, nothing past the scroll extent.
      **Verified: 258/259 animation battery** (up from 253/254) **· 869 Vitest.**

- [x] **A played board fits (2026-07-28):** a 4-seat board with two thirds of the
      opponents tapped put **two bands into scroll, 52 px over**; the same board
      untapped fits. Now **0 bands, 0 px**. Decisions in **D105**.
      ⚠️ **The packer was never wrong.** Five slots — two upright at 69 px, three
      turned at 96 px — is 426 px of card in a 421 px band, which does not fit at
      ANY gap. It had already shrunk 100 → 96 and stopped, because
      `MIN_BAND_CARD_H` is 96 **and `CARD_MODE_MIN_HEIGHT.chit` was also 96**:
      two constants at the same value left the uniform-shrink rung with exactly
      zero room, in precisely the case it exists for.
      ⚠️ The chit cliff is now **88**, `SQUEEZE_FLOOR_H = 88` is what the PACKER
      gets, and `PlayerPod` still sizes the BAND from `minCardH` (96). Different
      questions: what every card is guaranteed, versus how far one over-full row
      may go before it scrolls. A squeeze costs 5 px, never a render mode —
      measured 24 chit / 7 full / **0 pile** in the bands afterwards.
      ⚠️ New **rung 3: spend the whitespace first** (row gap 8 → 4, cluster
      20 → 8, stepped only as far as needed), and `SCROLL_SLACK_PX = 2` because a
      **1 px** rounding residual was enough to set `overflow-x: auto` under a row
      whose cards are all fully visible.
      ⚠️ Two checks changed and neither was bent: `packRow.test.ts`'s "five
      turned cards must scroll" is now a fit (they were 2 px over), plus a new
      six-card case so rung 5 still has coverage; and the battery measures
      auto-stacking in **pixels** (2,146 unstacked vs 202 stacked) because the
      band COUNT stopped discriminating once small overflows were absorbed.
      ⚠️ **The perf gate degraded this session and it was not this change** —
      `git stash`, same protocol back to back: p50/p95/p99 8.3/16.7/41.6 with it
      against 8.3/16.7/41.7 without, 18 long frames against 17. Read the
      signature: **p50 and p95 unmoved with only the tail degraded is
      interference; a real render regression moves the median too.**
      **Verified: 869 Vitest · 17/17 table section · 257/259 full battery.**

- [x] **The relay has a battery (2026-07-28):** `scripts/battery-relay.cjs`,
      **15/15**. The one transport nothing else covered — `two-instance.cjs` is
      two real apps on a LAN socket and `src/net/net.test.ts` is a host plus four
      clients over `loopbackPair`; neither goes near `relay/`, which is how
      playing with friends over the internet actually works. Until this, the
      relay was checked only by `relay.node.test.ts` greping that it does not
      import `src/`.
      ⚠️ **It imports nothing from `src/`, and that is the point.** A relay that
      could see the engine would be a second source of truth, so a battery that
      needed the engine to talk to the relay would be proving the wrong thing.
      The frames are hand-built envelopes.
      Covers: room create/join, presence announced BY THE RELAY (not inferred
      from a `Hello` that may never arrive), an unknown body forwarded
      byte-for-byte, a frame addressed to one connId, **a frame addressed into
      ANOTHER room reaching nobody** (the only way a blind router could leak
      between two tables), `noSuchRoom` with an actionable message, `RelayPeerLeft`
      for a real member, and a relay restart where the host re-creates its
      ORIGINAL code while a code already in use is refused rather than swapped.
      ⚠️ Needs `npm i` in `relay/` (just `ws`); the script says so and exits 1
      if it is missing. It boots the relay IN-PROCESS on an ephemeral port via
      `startRelay()` — which is why that function returns its server.

- [x] **A planeswalker survives being played (2026-07-29):** it entered the
      battlefield and was in the graveyard on the same pump, because **nothing in
      the engine had ever written a `loyalty` counter** — `sba.ts` has read
      `counters['loyalty']` since M3 and `0 <= 0` always held. Battles were
      identical on `counters['defense']`. Decisions in **D107**.
      A permanent now enters with its PRINTED loyalty / defense (CR 306.5b,
      310.6) as a `CountersChanged` on the log, emitted from `applyReplacements`
      — because "enters with counters" IS a replacement effect (CR 614.1c), and
      because ten separate places emit a `CardsMoved` onto the battlefield and
      the rule had been forgotten at all ten.
      ⚠️ **An EVENT, never a reducer branch.** `apply` is pure in (state, event)
      alone and cannot look a printing up; counters are part of `GameState` and
      so of the state hash, so a reducer that reached for the oracle would be a
      live/replay divergence with no visible cause.
      ⚠️ **The corner box had been drawing the PRINTED number** under a comment
      promising the current one — harmless while no loyalty counter existed, and
      the moment one counted down it meant a planeswalker read `3` for the rest
      of its life. `Card` takes `loyalty`/`defense` as numbers now and highlights
      them when they differ from printed (invariant 10).
      ⚠️ **And there was no way to spend loyalty at all.** `tier3.ts` has said
      "use the counters tool" since M5; the card menu's only counter control was
      `+1/+1…`. It now carries `Loyalty N…` / `Defense N…`, keyed off the counter
      being present so it never shows on a creature.
      ⚠️ **The fuzz gate could not reach any of this and stayed green** — `DECK`
      had no planeswalker and no battle, the third instance of that failure in
      this repo (D102). It gains Grist, `Invasion of Ikoria`, and an
      entry-counter canary beside the targeting ones.
      **Verified: 879 Vitest** (10 new in `sba.test.ts`, **5 of which fail with
      the fix reverted**) **· the 500-seed fuzz gate green at 98,969 accepted
      intents / 1,148,707 events, with 228 permanents entering with counters ·
      258/259 animation battery.** The one failure is still the perf gate's
      long-frame count (D29/D29a): 8 long frames, **p50 8.3 ms / p95 8.50 ms,
      byte-identical to a passing run** — D106's interference signature.
      Played it: Grist entered at `{loyalty: 3}` and stayed, the menu offered
      `Loyalty 3…`, −2 left it alive at `1` in accent-hi, −1 more logged
      "Grist, the Hunger Tide dies."

- [x] **Transforming into a planeswalker survives it too (2026-07-29):** D107
      fixed the entry and said what it was not doing. This is that — **14
      Commander-legal cards** whose back face is a planeswalker, all reached
      through the Tier-3 Transform button, all landing on an empty counter map
      and binned by SBA 4 on the same pump. `withTransformCounters` sits beside
      `withEntryCounters` in the same funnel and answers the same CR clause from
      the other side. Decisions in **D108**.
      ⚠️ **SET TO N, NOT ADD N, and that is why it is a separate rule.**
      `CountersChanged` is a delta and the Transform button TOGGLES, so `+5` per
      flip leaves a flipped-away-and-back Jace on 10. The delta is computed
      against what the card is carrying right then. An ENTRY may assume 0
      (`clearBattlefieldFields` empties `counters`); a transform may assume
      nothing.
      ⚠️ **The trigger is the TRANSITION, not the destination.** A permanent that
      was already a planeswalker and still is gets nothing — `Arlinn Kord` and
      `Garruk Relentless` are planeswalkers on BOTH faces, and without that check
      flipping Arlinn to her back face and back would refill her loyalty. Those
      same two are the only planeswalker faces in the database with no printed
      loyalty at all, so a `null` must add nothing rather than 0.
      ⚠️ **No defense branch, measured:** **zero** cards have a non-Battle front
      face and a Battle back face, so "becomes a battle" is unreachable except by
      driving a Siege backwards. Same reasoning D107 used to give `TokenCreated`
      no branch.
      ⚠️ **The fuzz gate could not flip a card at all** — `manualIntentFor` had
      no `ManualFlipFace` case, so no seed could turn a permanent over however
      many faces it had. It gains one (AIMED at a two-faced permanent, or the
      canary fires by luck) plus Jace in `DECK` and a transform canary.
      ⚠️ **A manual case must never return `null`:** `runOne` treats that as "the
      game has nothing left to do" and BREAKS out of the seed. The first cut cost
      **37% of the gate's accepted intents (11,883 → 7,434 at 60 seeds)** and a
      third of its turns, which reads as a slower engine rather than as a fuzzer
      that stopped playing.
      ⚠️ **`src/ui/` is unchanged.** `PermanentStack` already passes
      `card.counters['loyalty']` straight through, so D107's corner box and
      `Loyalty N…` button pick a transformed planeswalker up for free.
      **Verified: 888 Vitest** (9 new in `sba.test.ts`) **· the 500-seed fuzz
      gate green at 98,694 accepted intents / 1,138,047 events / 9,118 turns,
      with 185 permanents entering with counters and 50 transforming into a
      planeswalker · 258/259 animation battery · `npm run build` clean.** The one
      battery failure is still the perf gate's long-frame count (D29/D29a): 9
      long frames, **p50 8.3 ms / p95 8.50 ms, byte-identical to a passing run**
      — D106's interference signature, on a path this engine-only change does not
      touch. Every guard checked by DELETING it:
      reverting the rule fails 4 of the 9, and the transition, zone and face-down
      guards each fail exactly their own case.
      Played it: Jace cast from the command zone for `{1}{U}`, transformed with
      the real card menu → `{loyalty: 5}`, corner reading `5`, menu offering
      `Loyalty 5…`; −2 left him at 3, flipping back kept the 3 inert on the
      creature face, flipping forward again gave **5, not 8**, and −5 logged
      "Jace, Telepath Unbound dies."

- [x] **Tap a permanent by pointing at it and pressing E (2026-07-29):** the thing
      a Commander player does most often cost a right-click, a menu and a button.
      `E` over the card does it now, in both directions — a tapped card
      straightens. `src/ui/game/useTapKey.ts` · called from `GameLayer` beside
      `useAimGesture` · the card menu's button says `Tap ᴇ`, because a key nobody
      is told about has not shipped (`SkipHint`'s lesson). Decisions in **D109**.
      ⚠️ **The SAME Tier-3 tool, not a new one** — it sends the very
      `ManualSetTapped` that button has always sent, so the wrench in the log, the
      second-person narration and the "anyone's permanent" scope are inherited
      rather than re-decided. Nothing in `src/ui/table/` changed.
      ⚠️ **A delegated `pointerover`, NOT `elementFromPoint`** — two of the three
      reasons `AimVeil` records for refusing it apply here unchanged, the sharper
      one being that `perf.ts` patches `getBoundingClientRect` alone, so an
      `elementFromPoint` habit would flush layout while keeping the meter at zero.
      The hover is MODULE state, never a store: it is read once per keypress and
      drives nothing that renders, and a store would commit the whole table on
      every pointer crossing (D21's 50–58 ms).
      ⚠️ Three guards: the key is ignored while an input has focus (**`e` is a
      character**, legal in every text field and in a number input as `1e5`); only
      in `idle` mode, so a stray letter cannot answer a question the table is
      asking; and battlefield-only — which **guards the LOG, not the state**, since
      `reducer.ts` already drops a tap outside the battlefield (CR 110.5b).
      ⚠️ **And that third guard's first check passed with the guard DELETED**,
      because the reducer was doing the work. It asserts on the EVENT COUNT now:
      99 → 99 with it, 99 → 102 without.
      **Verified: 43/43 `battery-anim.cjs engine`** (6 new) **· 888 Vitest ·
      124/124 probe · `npm run build` clean.** Both behavioural guards checked by
      deleting them — exactly their own two checks fail and nothing else moves.
      Played it against a live dev instance with **real** Chromium input rather
      than constructed events (`Input.dispatchMouseEvent` → a genuine
      `pointerover`, `Input.dispatchKeyEvent` → a genuine keydown), which is the
      one thing the battery cannot prove because it drives hover through the
      handle: pointer onto a Mountain → hovered `c24`, `e` → tapped, the card
      drawn at **90°** (D75), and the log reading 🔧 "You tap Mountain."

- [x] **A land that can make two colours asks which (2026-07-29):** clicking a
      mana source submitted `outputChoice: 0` of the first unconditional ability
      it found, under a comment saying the card menu offered the rest — **the
      card menu had no mana controls at all.** So a Tundra made white and only
      white, an Arcane Signet made the first colour of its controller's identity,
      and Cavern of Souls could not be clicked at all. Now **one option taps,
      more than one asks**: a panel beside the card with one button per thing it
      can add, drawn in mana-font glyphs. `src/ui/game/manaOptions.ts` (pure) ·
      `ManaChoice.tsx` · `tableStore.manaChoice` · `legal.ts` ·
      `mana.costStringOf`. Decisions in **D110**.
      ⚠️ **The legal action stopped reporting a COUNT.** `outputs: number` is the
      one thing a chooser cannot draw; it is `readonly string[]` now — `['{G}']`,
      `['{C}{C}']`, `['{W}','{U}',…] `— indexed so the position IS the
      `outputChoice` the intent names. Changing the TYPE rather than adding a
      second field is what turned its one stale consumer (the fuzzer's
      `Math.max(1, chosen.outputs)`) into a compile error instead of a `NaN`.
      ⚠️ **The count is per ABILITY; the question is per CARD.** A dual land is
      two abilities of one output each, an any-colour land one ability of five —
      only the flattened list says "this land can bring more than one thing",
      which is why `manaOptionsFor` exists.
      ⚠️ **Restricted mana is OFFERED, marked, not hidden.** The first cut let
      unconditional options hide conditional ones to avoid two buttons reading
      `{C}` above `{C}`; that solved the ambiguity by deleting Cavern of Souls,
      whose five colours are all conditional. Offer everything, dedupe by what it
      ADDS with the unconditional one winning the slot, and mark the rest with a
      **dashed edge** — by shape, never colour, since the five colours are inside
      these buttons.
      **Verified: 899 Vitest** (11 new) **· 51/51 `battery-anim.cjs engine`**
      (8 new) **· 271/273 full battery · the 500-seed fuzz gate green · 124/124
      probe · `npm run build` clean.** The two battery failures are still the perf
      gate's frame counts (D29/D29a): **p50 8.3 ms / p95 8.50 ms, byte-identical
      to a passing run**, which is D106's interference signature and not a render
      regression — the gate's scene is fixture-driven and never opens this panel.
      0 stray rect reads. Screenshotted live: Arcane Signet offering `{B}{R}{U}`
      under a Kess identity, picking `{U}` putting exactly U in the pool, a
      Mountain still tapping on one click with no dialog.
      ⚠️ **The battery check gets its OWN game, and runs last** — it must reach a
      seat with more than one colour, and doing that mid-section moved the board
      far enough that the convergence check reported a permanent missing.
      ⚠️ Two checks were repaired on the way, both **pre-existing and both
      passing for the wrong reason**: the convergence check tested "every
      permanent id is also a slot id", which is wrong the moment two identical
      permanents auto-stack (only the pile's representative is in the DOM) — it
      counts through `data-stack-count` now; and the E-tap log check read the
      log's LAST line, which an opponent drawing a card had already displaced
      once ("Cy draws a card."). It searches for the tap line instead.

- [x] **Shift-click to tap several lands at once (2026-07-29):** the same panel
      takes a BATCH — shift-click every source you want, answer each, tap them
      all together. A plain click is untouched, and a single land with a real
      choice still commits on the pick rather than growing a confirm step.
      `tableStore.manaChoice.cards` · `toggleManaChoice` · `ManaBatchRings` ·
      `Card`/`PermanentStack` `onClick` now forward the event. Decisions in
      **D111**.
      ⚠️ **One source and many are the SAME panel** — `cards` is a list even for
      a plain click, because "which mana does this bring" and "which mana do
      these five bring" are the same question at different lengths. A second
      panel for the batch is how two answers to "what does tapping mean" get
      built, which is the split D110 existed to close.
      ⚠️ **NOTHING taps until the batch is committed** — a land tapped mid-choice
      is a decision made for the player, and it moves the board under the panel.
      Committing sends one `TapForMana` per source; the engine has no "tap these
      five" intent and should not grow one.
      ⚠️ **The modifier is THREADED, not sniffed off a window listener** — the M2
      seam is unchanged ("there was a click, and here is what the browser said
      about it"), and the parameter is optional at every level so the many
      `onClick={() => f(id)}` handlers stay valid.
      ⚠️ **The rings are the feedback**, and `highlightedIds()` — which looked
      like the place for them — is **dead code that nothing imports**; adding the
      batch to it would have shipped a feature that renders nothing.
      ⚠️ **Every anchored panel had been drawing ~50 px low**, found while adding
      the rings: the anchor is a viewport rect, the positioned ancestor is the
      screen slot, and the difference is exactly the app header. All three —
      `ManaChoicePanel`, `CardMenu`, `AttachmentsPanel` — are `fixed` now. Card
      top 691 / panel top 691; measured with the fix reverted, the card menu and
      attachments panel open **53 px low** (653 against 600, 726 against 673).
      ⚠️ The clamps that keep a panel on screen are viewport arithmetic too, so
      the battery pins each panel against the components' OWN arithmetic rather
      than the raw click point — a menu right-clicked near the bottom of the
      table legitimately opens above the cursor. Before this there was **no check
      of any kind** on where an anchored panel opens.
      ⚠️ The batch works on RENDERED SLOTS: twelve identical Forests are one slot
      (D19), so shift-clicking a pile adds its representative — which is what the
      player can point at, and what the battery had to be taught after its first
      cut placed three permanents, two of which auto-stacked. **Lifted the same
      day — see the next entry.**

- [x] **A pile of lands taps one card at a time (2026-07-29):** twelve identical
      Forests are ONE slot (D19) and twelve things to tap. Both gestures give up
      one card per click now. `toggleManaChoice` takes the SLOT'S CARDS ·
      `PermanentStack` passes `packed.members` with the click. Decisions in
      **D112**.
      ⚠️ **Only one half was broken.** A plain click already worked — it taps the
      representative, grouping keys on tapped state, so the pile splits and the
      next click takes the next one. The battery pins that now because nothing
      did. A SHIFT-click could not get past one: the toggle was keyed on the card
      the slot names, and a slot names its representative, so every click named
      the same card and the second took it straight back out.
      ⚠️ **The slot is what gets toggled.** Add the first member not already in
      the batch; once the whole slot is in, the click CLEARS that slot — which
      for a one-card slot is exactly the toggle it always was. Escape still drops
      one at a time.
      ⚠️ **The members are HANDED OVER, never re-derived** — "identical" is
      `groupIdentical`'s rule, and a second copy of it upstairs would eventually
      disagree about what one slot contains. The hook then filters them through
      `legal`, never the view.
      ⚠️ One ring per SLOT, not per card: members 2..n have no `data-band-slot`,
      so a pile draws one ring. That is correct — the ring marks the thing you
      pointed at, and the panel carries the count.
      **Verified: 911 Vitest** (4 new) **· 65/65 `battery-anim.cjs engine`**
      (5 new) **· 285/287 full battery · 124/124 probe · `npm run build` clean.**
      The pile rule was checked by REVERTING it: both its checks fail (`0 rows
      over 2 shift-clicks`, `1/3 tapped`) and nothing else moves. The two battery
      failures are the perf gate's frame counts with **p50 8.3 ms / p95 8.50 ms
      byte-identical to a passing run** — D106's interference signature, with
      four other apps windowed.
      ⚠️ **Found by the revert, not the feature:** making a pile take one MORE of
      itself turned D111's batch check's remove-then-re-add step into two adds,
      emptying the panel under it. That block now places DISTINCT basics and
      requires `data-stack-count === 1`, because it is about batching SEPARATE
      sources — a check that silently depended on "no two of these are the same
      card" fails for reasons unrelated to what it tests.

- [x] **Tapping a card for the sake of tapping it (2026-07-29):** a left click
      did whatever the card could DO and offered no way to say "turn it and
      nothing else" — so turning a card by hand was reachable only from E (D109)
      and the right-click menu, and a left click on a creature did **nothing at
      all**. A source now offers `Tap only` beside every colour it can make, and
      a card with no mana ability opens the same panel with a single `Tap`.
      `manaOptions.canTapOnly` · `TAP_ONLY` · `view/types.onBattlefield`.
      Decisions in **D113**.
      ⚠️ **A different INTENT, so a different-looking button.** `Tap only` sends
      `ManualSetTapped` — the Tier-3 tool E and the menu already send — not a
      `TapForMana` with an empty output, which would be a lie about the rules. It
      is drawn in WORDS, not a glyph: every glyph in this panel means "this much
      mana goes in the pool", and one meaning "no mana" would read as a sixth pip
      (mana-font's `{T}` was the prettier wrong answer).
      ⚠️ **The one-option fast path was REMOVED the same day** — it tapped a
      basic land for its mana with no panel, which made `Tap only` unreachable on
      exactly the card it is wanted on, and D117 then removed the last workaround
      by routing E to the click. Every source asks now: one click for the mana,
      one for turning it, and the panel still commits on the PICK, so it is one
      extra click and never two.
      ⚠️ **It ASKS, it does not turn.** The branch is LAST in the click chain and
      catches every click that reached the end of the list; a stray click that
      silently turned a blocker is a decision made for the player. Measured: the
      click leaves the event count unmoved.
      ⚠️ **Mine, on the battlefield, untapped** — not an opponent's (a misclick
      would look like a play), not one already turned, not one in hand. The batch
      generalised with it: shift-click takes any permanent of mine, and the
      tap-only rows commit as ONE `ManualSetTapped` so the log reads "You tap 3
      permanents." with a single wrench.
      **Verified: 916 Vitest** (5 new) **· 71/71 `battery-anim.cjs engine`**
      (6 new) **· 292/293 full battery · 124/124 probe · `npm run build` clean.**
      The one battery failure is the perf gate's long-frame count at 7, inside
      the documented 3–9 range, p50 8.3 / p95 8.50 ms, and its "≤2 frames over
      33 ms" sub-check PASSING at 1.
      ⚠️ The headline check was a **green tick over nothing** at first —
      "a mana source offers Tap only beside every colour" reported `skipped — no
      multi-option source left untapped`, because every block above it had been
      tapping things. It places its own source now.

- [x] **The library: scry, surveil, mill, exile (2026-07-29):** clicking a
      library did **nothing**; it opens a menu now — `Scry…`, `Surveil…`,
      `Mill…`, `Exile…`, `Look…`, each taking a number — and scry/surveil open a
      panel of the cards face up, top first, one decision per card.
      `view.peek` · `project.ts` · `ManualStopPeeking` ·
      `ManualMoveTopOfLibrary` · `src/ui/game/LibraryPanels.tsx`. Decisions in
      **D114**.
      ⚠️ **`project.ts`'s "a library is a count, FULL STOP" now has exactly one
      exception, and the file's own header says so.** `view.peek` gives the
      viewer the ORDER of the top cards of their OWN library already
      `revealedTo` them — the contents have been in `cards` since M3, so the
      exception is the order alone, and it exists because a scry that shows three
      cards in a dictionary's order is not a scry. Bounded by three clauses: own
      library, revealed to this viewer, the run from the top.
      ⚠️ **Scry and surveil are the SAME peek** — the difference is what you do
      next, so the mode is UI state and every decision goes out as the
      `ManualMoveCard` the card menu already had. Each commits on the click and
      the row vanishes **because the move clears the reveal**, so what is left
      when you press Done is what stays on top, in its existing order.
      ⚠️ `ManualStopPeeking` exists because a peek has no natural end;
      `ManualMoveTopOfLibrary` because a client cannot NAME a library card, and
      peek-then-move would log "You look at the top 3" before every mill.
      ⚠️ **The fuzzer's leak test was passing because the path was
      unreachable** — it asserted no library card ever reaches a projection,
      which held only because nothing had peeked. It states the real boundary
      now (revealed to THAT viewer) and pins the order exception, with a peek
      canary beside the entry and transform ones: **381 peeks at 500 seeds**.
      **Verified: 924 Vitest** (8 new) **· 82/82 `battery-anim.cjs engine`**
      (11 new) **· 303/304 full battery · the 500-seed fuzz gate green at 98,660
      accepted intents / 1,139,033 events / 9,148 turns · 124/124 probe ·
      `npm run build` clean.** The one battery failure is the perf gate's
      long-frame count at **4, the lowest of the session, with 0 frames over
      33 ms**.
      ⚠️ **The Scry button itself was untested at first** — every check submitted
      `ManualPeekLibrary` directly, which leaves the panel in its default `look`
      mode, so scry and surveil were exercised by nothing. A check now clicks the
      real button, types into the real number dialog, and reads the mode back.

- [x] **Looking through a graveyard, and an exile pile (2026-07-29):** a pile
      renders only its TOP card, so every card under it was **unreachable** — you
      could not return the fifth card to hand or reanimate the tenth, and nothing
      said what was in there. Measured: **1 card drawn on the table, 8 of 8 in
      the browser.** Clicking either open pile now lists the lot face up, each
      card with Hand / Battlefield / Library top+bottom / Exile / Command, plus
      "Shuffle into library" and "Exile the lot". `ZoneBrowser.tsx` ·
      `ManualMoveZone` · `onZoneClick`. Decisions in **D115**.
      ⚠️ **A closed pile and an open one get different answers** — that is the
      whole distinction from D114. A library cannot be browsed (its order is the
      one thing projection strips), so it gets a menu of actions taking a number;
      an open pile gets the cards themselves.
      ⚠️ **Any player's, always to the OWNER's zone** — a graveyard is public and
      reaching into an opponent's is a real play, but a stolen creature goes to
      the graveyard of whoever owns it. Listed newest first, because the card you
      want is almost always the one that just died.
      ⚠️ `ManualMoveZone` is ONE intent because thirty cards leaving a graveyard
      is one thing a player did, and the shuffled `order` must cover the cards
      that just ARRIVED — `LibraryShuffled` sets the zone rather than permuting
      it, so shuffling the pre-move library would drop everything the same intent
      was putting in.
      **Verified: 929 Vitest** (5 new) **· 89/89 `battery-anim.cjs engine`**
      (7 new) **· 309/311 full battery · the 500-seed fuzz gate green at 98,581
      accepted intents / 1,142,579 events · 124/124 probe · `npm run build`
      clean.**
      ⚠️ **A run in the middle reported three EXTRA failures** — the hand-fan
      hover checks, sampled mid-reflow (trap 7), with `LoadPercentage` 63 and
      **Overwatch running**: D106's measured case. Same code at load 46 passes
      them with p50/p95 back to 8.3/8.50 ms. The tell was that p95 had DOUBLED to
      16.7, which is the one thing interference and a real regression do not
      share — when only the tail moves it is load, and when p95 moves, look.

- [x] **What a land offers: the partner bug, and every other land (2026-07-29):**
      reported as "Command Tower does not show my two colours". Two faults, one
      symptom. Decisions in **D116**.
      ⚠️ **A seat sat down with ONE commander's colours** — `host.ts` used
      `commanders[0]?.colorIdentity`, and a partner pair is two cards with one
      identity (CR 903.4), so an Ardenn + Rograkh deck played as mono-white or
      mono-red. The deck VALIDATOR had always computed the union, so the two
      halves of the app disagreed and the right one runs before the game starts.
      `unionIdentity` is the single answer now.
      ⚠️ The symptom was quieter than the fault because **tapping for mana writes
      no log line at all** — with one option the land tapped silently and
      correctly, which is exactly what "nothing happened" looks like.
      ⚠️ **Reflecting Pool produced NOTHING, and had since M1** — the pattern read
      "any COLOR" and the card says "any TYPE". Measured over the database:
      **12,500 Commander-legal lands · 4,270 offer more than one answer · 13
      printings still do not.** `anyColor.scope` gains `landsYou` and
      `landsOpponents`, resolved against the board like `identity` is against the
      commander, from CONCRETE outputs only — which is the recursion guard and
      the rule: two Reflecting Pools alone genuinely make no mana.
      ⚠️ **The first measurement was wrong about 20 of its 36 misses**: it counted
      "makes two colours" rather than "offers two answers", so Dimir Aqueduct
      (`{U}{B}`) and the filter lands were reported broken. They add both,
      always — nothing to choose.
      ⚠️ The boundary stayed one: "a GATE you control could produce" warns
      `mana:anyScopeUnread` and produces nothing, because widening it would offer
      mana the card cannot make (D90). The 13 are NAMED in the test.
      **Verified: 939 Vitest** (14 new) **· 87/87 engine section · 308/309 full
      battery · 500-seed fuzz green · 124/124 probe · build clean.** Pinned
      coverage numbers moved deliberately: `mana:noSymbols` 629 → 540, new
      `mana:anyScopeUnread` 16, `activated.manaAbility` 11,911 → 11,938.

- [x] **E does what clicking does (2026-07-29):** D109 gave `E` to "turn the card
      and nothing else", so pressing it on a land turned the land and made no
      mana — not what a player means by "tap this land". It routes to the same
      `onCardClick` a left click does. Decisions in **D117**.
      ⚠️ **The handler is passed IN, not imported** — it is a `useCallback` over
      live legality, mode and view, and a module copy would answer with the board
      as it was when the table mounted (the stale-binding trap). `useTapKey`
      moved to `TableScreen`, where `onCardClick` lives.
      ⚠️ Turn-it-and-nothing-else is still there: `Tap only` (D113) and the menu.
      ⚠️ **Still battlefield-only** — a click in the FAN casts, and a letter key
      that cast a spell because the cursor was over the hand is a misclick with a
      real cost. Two checks were DELETED rather than adapted because they
      described the old meaning; what replaced them asserts the POOL moved.

- [x] **Tapping a land says so (2026-07-29):** `tapForMana` emitted a tap and a
      pool change and **no narration at all** — which D116 named as the reason
      its own bug was invisible, since a land tapping correctly and a click doing
      nothing looked identical. `You tap Command Tower for {U}.` Decisions in
      **D118**.
      ⚠️ **Tier 1 — no wrench.** The engine did this; nobody hand-waved it, and
      keeping those apart is the log's whole job.
      ⚠️ It names the MANA, because "where did that `{U}` come from" is the
      question a log is scanned for.
      ⚠️ **Paying for a spell still writes ONE line** — `applyPlan` emits its own
      events and never routes through `tapForMana`, so auto-tapping five lands
      logs the cast alone. Only a land the PLAYER tapped writes a line, which is
      what bounds this to deliberate actions.
      **Verified: 941 Vitest** (2 new) **· 308/309 full battery · 500-seed fuzz
      green at 98,581 accepted intents and 1,161,398 events (up from 1,142,579 —
      +18,819 lines, with intents, turns and every replay hash unchanged) ·
      124/124 probe · build clean.**
      **Verified: 907 Vitest** (8 new — the first suite for `tableStore`) **·
      60/60 `battery-anim.cjs engine`** (9 new: 7 for the batch, driven with a
      real `MouseEvent` carrying `shiftKey: true` since `.click()` cannot carry a
      modifier and the modifier is the whole gesture, plus one each pinning where
      the card menu and the attachments panel open — both checked by REVERTING
      the fix) **· 279/280 full battery · 124/124 probe · `npm run build`
      clean.** The one battery failure is still the perf gate's
      long-frame count (D29/D29a): 9 long frames inside the documented 3–9 range,
      p95 inside its 18 ms bar, **2 frames over 33 ms — that sub-check now
      PASSES** where it failed in the previous run, on a fixture-driven scene
      neither change touches. 0 stray rect reads.
      Screenshotted live: Arcane Signet + Mountain + Swamp in one panel, the
      basics pre-answered as "only", "1 left" until the Signet is answered, three
      rings on the table, `Tap 3` putting `{U}{R}{B}` in the pool.

- [x] **The turn walks properly, and the hotseat says when it hands over
      (2026-07-29):** reported as the game "changing sides" mid-turn — you play a
      land as Ben, the board becomes Ana's, and Ben's turn walks into combat with
      somebody else's hand at the bottom. Two faults. Decisions in **D119**.
      ⚠️ **`shouldAutoPass` asked its questions in the wrong order.** "Could this
      player do anything at all" was the LAST clause, so `alwaysStop`,
      `stopWhenAnyoneCasts` and `stopBeforeCombatDamage` each stopped a player
      with an empty hand and no untapped land — two forced clicks per opponent's
      turn per player on the default stops, plus one every time anybody cast
      anything. It is the FIRST question now and every clause below it is a
      refinement, never an override; `mode: 'fullControl'` is the one thing that
      still stops everywhere, which is what its label promises.
      ⚠️ **And holding a play is a reason to be asked SOMEWHERE, not everywhere.**
      `stopWhenIHaveInstantSpeedPlay` had no notion of which step was worth
      stopping in, and "I hold a castable instant" is true for a whole turn
      cycle — one Mountain and one `{R}` instant stopped that player in main 1,
      begin combat, end of combat, main 2 and the end step of a turn they were
      not taking. `isStopWindow`: your own main phases, and somebody else's END
      step. Everything else that matters is already its own clause.
      ⚠️ **`meaningfulActions` gained an affordable `ActivateAbility`** in the
      same change, because it is now the WHOLE answer to "could you act" — a
      firebreathing blocker's pump is exactly what `stopBeforeCombatDamage`
      exists for. `TapForMana` stays out for the reason it always did.
      ⚠️ `src/ui/game/SeatHandoff.tsx` — "Ben → Ana / You are Ana now" over the
      table for 2.2 s, green because green is PRIORITY (D99). Fired from
      `session.onSeatHandoff`, which the AUTOMATIC switch alone raises: a banner
      over a seat button the player just pressed explains nothing.
      ⚠️ The stops panel's `ALWAYS STOP AT` is `ALSO STOP AT`, and its
      "Hold Ctrl to force a stop" line is gone — **nothing ever implemented it.**
      **Verified: 945 Vitest** (5 new, 1 replaced) **· 91/91 `battery-anim.cjs
      engine`** (2 new) **· 303/305 full battery · `npm run build` clean · the
      500-seed fuzz gate green, and ITS COUNTERS ARE THE FIX: 17,003 turns
      against 9,148 and 2,239,781 events against 1,161,398, from 5% FEWER
      accepted intents (93,565 against 98,581).** The same 200 intents per seed
      now play nearly twice the game.
      ⚠️ **Nine existing checks failed and not one was a rule** — every one was
      observing a moment that no longer exists, because combat, a cast and a
      whole turn now run through in a single submit when nobody can act. New
      harness rule: `holdEverywhere(game)` — a test that needs to OBSERVE an
      intermediate state must SAY so rather than lean on the stops of the day.
      ⚠️ **The renderer-console battery check fails in `drag` and `motion` with
      React's `Maximum update depth exceeded`, and it is NOT this work** —
      reproduced unchanged with `SeatHandoff` unmounted; eleven other sections
      pass the same check. Pre-existing, tracked separately.

- [x] **A resolved spell says whose it was (2026-07-29):** reported as "I played
      a card as Ben, and the effects got to Ana" — Ben cast Thrill of
      Possibility and ANA drew the two cards. Decisions in **D120**.
      ⚠️ **The assisted offer (D90) never knew whose spell it was.** It is raised
      from `StackResolved` on the ACTIVE SEAT'S client, and the hotseat follows
      priority (D42), so by the time a spell resolves the table has usually moved
      to whoever must respond. The event carried `card` and `targets` and no
      controller, `PromptBar`'s own comment said "if it was mine" while nothing
      checked it, and Apply submitted `ManualApplyEffect` with `player: viewer`.
      ⚠️ **Worse over the wire than in a hotseat:** a guest is always its own
      active seat, so EVERY player was offered every assisted spell anyone cast,
      each naming themselves honestly for somebody else's card.
      ⚠️ `StackResolved.controller` is now required, carried through
      `toViewEvents` and `session.onSpellResolved`. **The card cannot answer for
      it** — `clearBattlefieldFields` resets a moved card's `controller` to its
      OWNER (right per CR 108.4, useless here), and the stack object that knew is
      destroyed in the same reducer pass. `null` only on fizzle/counter, which
      carry no `instanceId` either.
      ⚠️ The offer is filtered on `localSeats()`, never `viewer`: one seat over
      the wire, every seat in a hotseat so it survives the D119 hand-off. When
      the caster is not on screen it says "For Ben, who cast it."
      ⚠️ **`ManualApplyEffect` stays as permissive as every other Tier-3 tool**,
      deliberately — a guard built on the card's OWNER would reject Kess casting
      from a graveyard and any stolen card. The UI naming the wrong player was
      the bug.
      **Verified: 946 Vitest** (1 new, **checked by BREAKING the fix** — emitting
      `state.turn.activePlayer` fails it with `expected 'p1' to be 'p2'`) **·
      303/305 full battery · fuzz gate unchanged · build clean.** Reproduced live
      with the user's own two decks through the real solo lobby: viewer pinned to
      Ana, Thrill cast by Ben → **Ben's hand 4→6 and library 92→90, Ana's 7 and
      91 unmoved**, logged "Ben applies the part of Thrill of Possibility…".

- [x] **M6.1 — A bot takes a seat (2026-07-29):** pick **Bot** on any opponent
      seat in the solo lobby and it plays: mulligans, plays lands, casts, attacks,
      blocks, and tries to win. `src/bot/` — `types.ts` (the `BotPort`, seven
      methods, each one an existing public `ClientSession` method) · `awaiting.ts`
      (**all 13 `Awaiting` kinds**, exhaustive) · `policy.ts` · `combat.ts` ·
      `targets.ts` (`planTargets`, MOVED here; `net/testing/script.ts` imports it)
      · `runner.ts` (the drain gate, the re-entrancy latch, the progress guard).
      `src/game/botSeat.ts` is the only impure file in the path — a clock and a
      cast, no decisions. Decisions in **D121**.
      ⚠️ **`src/bot/` holds the ENGINE's clock rule with the NET's import rule**,
      plus one neither other block needs: no runtime import of an engine module
      that takes a `GameState`. A bot is a client and there is no `GameState` to
      cheat with — invariant 3 made mechanical rather than aspirational.
      ⚠️ **The brief's §3 toolbox is unreachable from a seat.** `legalActions`,
      `shouldAutoPass`, `canAttack`, `canBlock` and `candidatesFromState` all take
      a `GameState`. What the bot uses is `ClientSnapshot.legal` off the wire and
      the legal choices carried inside `declareAttackers`/`declareBlockers`.
      ⚠️ **`decide()` returns `act | wait | fault`, never `Intent | null`** — that
      conflation is D102, and it cost this project three sign-off checks for weeks.
      A fourteenth `Awaiting` kind is a **compile error**.
      ⚠️ **`stopWhenIHaveInstantSpeedPlay` must stay ON**, and its name is the
      trap: it gates `isStopWindow` ENTIRELY, which includes your own main phases.
      Measured with it off — turn 88, 73 lands, 88 attacks, and **four spells
      cast**, with every other check green.
      **The pool, measured over the real database and pinned in
      `src/data/botPool.node.test.ts` — the first thing here that counts CARDS
      rather than faces: 1,405 of 31,692 distinct Commander-legal cards run
      completely (4.4%)** — 1,120 creatures, 148 instants, 67 sorceries, 48 lands,
      22 artifacts, and **0 enchantments, 0 planeswalkers, 0 battles**.
      ⚠️ **D90's 6,975 reproduces exactly; its 274 and 1,300 do NOT** (269 and
      1,359; 273 counting any face). **D116's 12,500 lands is a PRINTINGS count** —
      there are 1,114 distinct land names, and §2 of the M6 brief prints the two
      units side by side as if they matched.
      **The bot's deck is a LEGAL Commander deck**, unlike the starter deck (D43),
      and `validateCommanderDeck` says so in a test rather than a comment:
      **Jasmine Boreal**, chosen from 45 fully-executable legendary creatures, 99
      cards on a stated curve, no RNG anywhere.
      **Verified: 1,051 Vitest** (up from 946) **· 12/12 in a new `battery-anim.cjs
      bot` section · 91/91 `engine`, unchanged · 124/124 probe · build clean · the
      500-seed fuzz gate green at 92,778 accepted intents / 2,257,235 events /
      17,196 turns**, with `Dryad Arbor`, `Darksteel Citadel`, `Monstrous Growth`
      and `Akroma, Angel of Wrath` added to `DECK` for the shapes the bot's deck
      introduced. Played by hand through the real lobby buttons: turn 13, 1,517
      events, three bots with real boards, **the table never once followed a bot**.
      ⚠️ **Five pre-existing defects found and NOT fixed here** (D121 lists them):
      a permanent's triggered/static text is unenforced and unsaid; a payable
      non-mana ability charges its cost and runs nothing; `assignCombatDamage` has
      no answering intent at all; `orderAttackers` is unanswerable because
      `CardView.blocking` is singular; and the engine fixtures have no rot guard
      despite two comments claiming one.
      **All five are closed now** — 1 and 2 by D122, 3 and 4 by D125, 5 by D123. **The first two are now SAID (D122
      below) and the fifth is guarded (D123, last entry); the engine's behaviour
      is unchanged by either. Two remain open.**
- [x] **Half the card pool said nothing, and silence means "handled" (2026-07-29):**
      the two disclosure gaps at the top of D121's reportable list, closed as
      disclosures only — `legal.ts`, `handlers.ts` and `loop.ts` are untouched, and
      `engineComplete.ts` still refuses both classes for the bot's deck. A
      permanent's triggered and static text now says the app does not run it, and a
      payable non-mana activated ability now says the cost is charged and nothing
      follows. Decisions in **D122**.
      ⚠️ **ASKED OF `engineComplete.unaccountedLines()`, the same line accounting
      the bot's pool predicate uses** — the third time `tier3.ts` has refused to
      re-derive an answer a parser already gives, and what makes "a card the
      predicate accepts stays silent" true by construction. Asserted over 31,692
      cards rather than 82 fixtures: **0 engine-complete cards carry a note**.
      **Measured: 17,963 cards (56.7%) gain the ability-text note and 4,016 (12.7%)
      the charged-ability note.** All four starter commanders were in the silent
      half. A third gap — a mana line the engine runs only part of — was measured
      here at 339 silent cards and closed next.
- [x] **The app taps a Signet and never takes the {1} (2026-07-29):** the third
      disclosure, and the exact MIRROR of Krenko. `tapForMana` emits a tap and
      `ManaAdded` and stops: it takes no cost beyond the tap, checks no activation
      condition, tracks no once-per-turn limit, computes no board-dependent amount
      and applies no second sentence — so a `Rakdos Signet` hands over {B}{R}
      without its {1}, `Phyrexian Tower` makes {B}{B} with nothing sacrificed, and
      `Ancient Tomb` deals nobody the 2 damage on its own line. Now said as
      **`Part of its mana ability`**. Decisions in **D124**.
      ⚠️ **ONE note for four reasons, because `ManaProduction.conditional` ORs them
      together** — an activation cost beyond {T}, an activation condition, a spend
      restriction, an amount the engine cannot compute — **and records which for
      none.** Splitting it would have meant re-deriving the reason beside the parser
      that decided it.
      ⚠️ **It is the OPPOSITE statement to `Its mana ability`** (that one means the
      app will not tap it at all). One line can never raise both: a parser warning
      means no production for that line, and this note needs one.
      ⚠️ **`kind: 'mana'` requires an ACTIVATED line (CR 605.1a).**
      `parseManaProduction` matches "add" anywhere, so the first cut told **193
      cards** "the app taps it and adds the mana" about a TRIGGER — caught by
      `abilityText` falling 17,963 → 17,770, and it is back at 17,963 now.
      **Measured: 723 cards (2.3%) gain the mana note; 21,037 (66.4%) carry at
      least one of the three; 16,020 — 50.5% of the whole Commander-legal pool —
      said NOTHING AT ALL before and say something now.** Cards with no note at
      all: **17,824 → 1,804**, and **everything still silent (345) is a keyword line
      D68 chose not to name** — `residual === residualKeyword` is an assertion.
      ⚠️ **Two reportables, measured and NOT fixed** (D124): `parseManaProduction`
      reads reminder text and granted abilities as the card's OWN mana ability
      (**310 cards** — it never calls `scrub`, so Noggle Robber's Treasure reminder
      makes the Noggle a mana source), and `ManaChoice.tsx`'s "Dashed mana is
      restricted — the card says what it may be spent on" is true of a spend
      restriction and wrong for the other three reasons.
      **Verified: 1,077 Vitest / 5 skipped (27 new — 21 fixture-level, 6 over the
      real database in `src/data/tier3.node.test.ts`) · `tsc -b` clean ·
      `npm run build` clean · every `botPool.node.test.ts` number reproducing after
      the refactor.**

- [x] **The engine fixtures now have the guard they claimed to have (2026-07-29):**
      D121's reportable list, item 5. `scripts/make-engine-fixtures.cjs` said — in
      its own header and again in the header it writes into the generated
      `src/data/fixtures/engineCards.ts` — that `scripts/battery-carddb.cjs`
      cross-checks these records against the live database. **It never did.** `grep
      engineCards scripts/battery-carddb.cjs` finds nothing.
      `src/data/fixtures/engineCards.node.test.ts` is that guard, and both claim
      sites now name it. Decisions in **D123**.
      ⚠️ **The 15 checks that looked like coverage are D15b's, for a DIFFERENT set
      of fixtures** — the hand-written records in `src/data/validate.test.ts`. They
      touch ENGINE_CARDS at four cards (`Wastes`, `Thrasios`, `Grist`, `Shorikai`)
      because the validator and the engine happen to care about some of the same
      cards, and then only in the one field each pattern reads. Everything
      `src/engine/testing/harness.ts`, `src/net/testing/table.ts`, the fuzz gate
      and seven test files build on was unguarded.
      ⚠️ **The comparison is `JSON.stringify(record, null, 2)` — the exact bytes
      the generator writes — so what is asserted is that REGENERATING WOULD BE A
      NO-OP.** One comparison catches a rewording, a re-typed card, a legality
      change, a dropped field, a key-order change, and a hand edit of the file that
      says DO NOT EDIT BY HAND. A list of pinned patterns only ever covers what
      somebody thought to pin, which is how this gap survived beside 15 of them.
      ⚠️ **The generator's selection rule is reproduced from each fixture's OWN
      fields**, never from a second copy of its `WANTED` list — a copy is one more
      thing to keep in step, and a fixture added to one and not the other would be
      unguarded in exactly the way this fixes. A token is pinned by set + collector
      number, everything else takes the first non-token printing of that name, and
      the fixture's own `layout` says which rule it was taken under.
      ⚠️ **A `.node.test.ts` rather than the promised battery section, and forced
      rather than chosen** (`botPool.node.test.ts`'s reason): ENGINE_CARDS is
      TypeScript and there is no TS runner outside Vitest, so a `.cjs` could only
      read the generated file with a regex — a second reader of the generator's
      output beside the generator.
      **Verified: 1,077 Vitest / 5 skipped across 45 files** (4 new checks plus the
      loud-skip marker) **· `tsc -b` clean.** The engine, the parsers and the
      fixture DATA are untouched — three lines of header comment are the only edit
      to `engineCards.ts` — so the fuzz gate cannot move, and it ran at its default
      seed count inside the full suite.
      **Regeneration proved to be a no-op rather than argued to be:** the file was
      copied aside, the generator re-derived it from the live database ("Wrote 86
      cards"), and the result is **byte-identical, md5
      `9604c178269d1c3bdd7e4aa6c7b2255b` before and after** — so all 86 records
      still say exactly what the real cards say today.
      ⚠️ **Checked by BREAKING what it guards:** one word changed in `Monstrous
      Growth`'s fixture text (`until end of turn` → `until the end of turn`, the
      shape a real rewording takes) fails with `Monstrous Growth [por 173†] —
      faces[0].oracleText: "…" → "…"`, and **nothing else in the suite noticed the
      edit** — which is the rot, demonstrated on one card. The loud skip was
      checked too, with `CRT_DATA_DIR` pointed at a directory that does not exist:
      the four real checks report as skipped BY NAME and stderr says how to sync.

- [x] **Two prompts nothing could answer (2026-07-31):** D121's last two
      reportable items, both latent hangs of D102's exact shape and both invisible
      because **nothing raises either of them**, so no suite ever tried.
      Decisions in **D125**.
      ⚠️ **`assignCombatDamage` is DELETED from the `Awaiting` union**, with
      `GameOptions.manualCombatDamageAssignment`. It had no `AssignCombatDamage`
      intent, no handler and no button — `PromptBar` described it and rendered
      nothing — and only an option no screen could set would have raised it.
      Building it instead would have been half a feature: CR 510.1a–d assignment
      is a real decision only across two or more blockers, and the ORDER those
      blockers are taken in is `orderBlockers`, which has no producer either.
      D44 Q5 and the spec's §6.4 say so now instead of promising a seam.
      ⚠️ **`CardView.blocking` is a `readonly InstanceId[]`.** `orderAttackers`
      asks which attackers a blocker is blocking, in order — and `project.ts` was
      keeping `attackerOrder[0]`, so the one prompt whose answer IS that list could
      not be answered from a `PlayerView`. `GameState` has modelled it as an array
      since M3. The bot answers it now; the union is **12 kinds, all twelve
      answerable**, with no deliberate fault left in `src/bot/awaiting.ts`.
      ⚠️ **The order is load-bearing** (`assignBlockerDamage` divides power down
      it), the array is handed over BY REFERENCE with one shared `NOT_BLOCKING`
      for the rest, and `sameCardView` compares it BY CONTENTS — a reference
      compare would rebuild every blocker's view whenever anything in combat moved
      (D21). The fixture table takes the mirror rule: `declareBlockers` builds a
      new array rather than `push`ing, or a blocker never re-renders.
      ⚠️ **`packRow`'s auto-stack key needed the whole list**, not the first id:
      two creatures blocking different attackers must not group into one slot.
      **`src/engine/awaitingProducers.node.test.ts` — the map is asserted now.**
      It reads the union out of `state.ts`, scans every non-test source for a
      constructed `kind: '…'`, and pins **10 producers of 12 kinds**; the two
      without are NAMED, with a check that each still has an intent AND a handler
      — which is exactly what `assignCombatDamage` failed. Also: only
      `src/engine/` may construct a prompt, every produced kind names a real
      `file:line`, and every kind has a case in the bot.
      ⚠️ `testing/` and `fixtures/` are excluded from the scan on purpose — a
      harness that hand-builds a prompt proves nothing about what the engine
      raises in play.
      ⚠️ **AND THE THIRD ANSWERER HAD THE SAME DEFECT.**
      `testing/harness.ts`'s `simplestAnswer` — which `answer()` and the fuzzer's
      `default:` branch both run through — returned a bare `null` for
      `mulliganBottom`, `rewindVote`, `orderBlockers` and `orderAttackers`. The
      first two **have producers**, so they were live wedges; what hid them is
      that the 500-seed gate carries its OWN `mulliganBottom` case and never
      proposes a rewind, so the fallback was unreachable from the one thing that
      runs it constantly. `rewindVote` answers **decline** — one decline cancels
      the vote at any table size, and agreeing would HALF-EXECUTE a rewind, since
      unanimity only clears the awaiting while the re-fold is `Game.rewind` and
      not a reducer case. `state` is REQUIRED now rather than optional-with-a-
      warning. `src/engine/simplestAnswer.test.ts` reaches each prompt for real
      and SUBMITS every answer; restoring the nulls fails 5 of its 8.
      ⚠️ **And `simplestAnswer` returns `Intent`, not `Intent | null`.** Three
      more nulls hid in `x ? … : null` ternaries guarding prompts their producers
      make impossible; each answers now, so "the driver always has an answer" is
      a fact about the TYPE — a case added later that cannot think of one fails
      `tsc -b`. A malformed prompt gets an answer the handler REJECTS, and the
      handler's message names the malformed prompt where `no simple answer for
      prompt "…"` named the driver. `answer()` lost that branch entirely.
      **Verified: 1,092 Vitest / 5 skipped across 47 files** (6 in the producer
      test, 8 in `simplestAnswer.test.ts`, a multi-block projection case, and the
      bot suite now asserting all twelve ACT) **· `tsc -b` clean · `npm run build`
      clean ·
      129/129 in `battery-anim.cjs table combat bot engine` · the 500-seed replay
      fuzz gate green at 92,778 accepted intents / 2,257,235 events / 17,196
      turns** — it matters here because `GameOptions` is part of `GameState` and
      so of the state hash.
      ⚠️ **Those three counters are byte-identical to D121's, and that IS the
      assertion:** removing an option nothing read and widening a projection field
      must not change a single event. A move in any of them would mean this
      touched play.
      ⚠️ **Checked by breaking it, twice, both reverted:** a thirteenth variant in
      the union fails three checks and names `canaryThirteenth`; a producer removed
      from `loop.ts` fails two and names `orderTriggers`.

- [x] **M6.2 — It plays properly (2026-07-31):** an evaluation function, a combat
      solver that prices a whole attack rather than each attacker alone, and a
      tournament that puts a confidence interval on what any of it was worth.
      `src/bot/eval.ts` (`scorePosition`, `creatureValue`, `pressure` — in
      LIFE-EQUIVALENT points, so every weight can be argued about in words) ·
      `src/bot/random.ts` (level 0, the legal-random baseline) ·
      `src/bot/tournament.node.test.ts` + **`scripts/battery-bot.cjs`** ·
      `src/bot/decisions.test.ts` (the regression harness). Decisions in **D126**.
      **Measured over 500 games: level 1 beats level 0 82.8% [79.2%, 85.9%]**,
      0 draws, 21.7 turns/game, **135 decisions/second**, 0 faults — finishing on
      28.1 life against level 0's 0.1.
      ⚠️ **THE BRIEF'S ≥95% BAR IS NOT MET, and the reason is measured.**
      "Legal-random" with a creature deck is not a weak player: it plays a land
      nearly every turn, casts real creatures and attacks with ten a game, and its
      only true mistakes are never blocking and attacking at random. **And the
      losses are not mana screw** — level 1 ends with 7.5 lands in games it wins
      and 9.1 in games it loses; screw would show the opposite.
      ⚠️ **The attack is priced as a SET.** The first version priced each attacker
      against the defender's best blocker alone, so ONE creature vetoed a swing by
      five and the bot attacked barely more than a random one — 9.8 attackers a
      game against level 0's 12.3, winning 62.5%. A defender must SPEND their
      blockers; everything past that number connects. Now 14.6 a game.
      ⚠️ **Survival is a RULE, not a weight.** At 8 life against two 4/4s every
      trade scored ≤ 0, so the bot declined both blocks and died — a position a
      human answers instantly, invisible to the win rate and caught by the
      regression harness. Raising the chump multiplier fixes it and LOSES games
      (79% → 77%). Trades are priced; not dying is not a trade. Worth 4 points.
      ⚠️ **Three constants swept and baked in** — `CLOCK` 1/2/3 → 74/78/78%,
      `SAFETY` 0.25/0.5/0.75/1.0 → 76/79/79/77%, and a flat value for damage
      prevented 0/0.5/1.0/1.5 → **79/75/74/73%**. That last one reads like a bug
      fix and is a regression: the bot blocks instead of racing, and the race is
      what closes a game from 40 life.
      ⚠️ **The tuning knobs could not stay.** They were `process.env` reads, which
      `purity.node.test.ts` bans in `src/bot/` — so a knob left behind fails
      `tsc -b` rather than shipping as configuration nobody sets.
      ⚠️ **Wilson, not the normal approximation** (which claims [1.00, 1.00] at
      40/40), and every seed played TWICE, once from each side, because going
      first is a real advantage. A MIRROR match on a 40%-land deck: on
      `fixtureDeck`'s 60% each seat cast six spells in seventeen turns and the
      measurement read 62–67% [43%, 79%] — an instrument that could not see the
      thing it was pointed at.
      **Verified: 1,127 Vitest / 5 skipped across 49 files** (30 new, up from 1,097) **· `tsc -b`
      clean · `npm run build` clean · `battery-anim.cjs bot` 12/12 unchanged · the
      500-seed fuzz gate unmoved**, which is the right result for a change that
      adds nothing under `src/engine/`.

- [x] **M6.3 — The primitives (2026-07-31 measured, CLOSED 2026-08-05):** the M6
      brief's §6.1 says the measurement comes first and decides the order —
      *"Measure the unlock… That number is how you decide what to build next."*
      That measurement exists and is pinned; **no primitive is built yet.**
      `src/data/primitives.ts` + `src/data/primitives.node.test.ts`. Decisions in
      **D127**.
      **Over 31,692 distinct Commander-legal cards: 1,405 run completely, 30,287
      are blocked. 795 are scriptable with the engine exactly as it stands; the
      first four primitives take that to 8,286 — 10.4× — and all nineteen to
      16,736.**
      **The order, by cards waiting on it and NOTHING else:** `optional` 2,012 ·
      `layer6` 1,722 · `effect:counter` 1,441 · `effect:token` 1,123 ·
      `effect:sacrifice` 933 · `chooseFromZone` 755 · `duration` 674.
      ⚠️ **It is NOT the brief's list order.** `modal` and `delayed`, both named
      in §6.1, are worth **34** and **84** cards.
      ⚠️ **`optional` is first and is the cheapest thing on the list.**
      `TriggerDef.optional` has been in the script API since M3, `collectTriggers`
      copies it onto every `PendingTrigger`, and **nothing anywhere branches on
      it** — a "may" trigger fires unconditionally, which is half-execution in
      the one direction D90 forbids. What is missing is a prompt and an answer.
      ⚠️ **The brief's seven primitives were not the answer.** Classifying against
      §6.1's list alone left **68.7%** of blocked cards unclassified. Two families
      were missing and both are large: the EFFECT VOCABULARY (`effectParse` has
      eleven kinds and none of them is "create a token" or "put a counter", though
      both EVENTS have been on the log since M3/D107), and KEYWORD ABILITIES the
      engine does not run (Equip alone was 448 cards). Residue is 44.7% now and
      the largest remaining shape is 327 cards of 13,551 — a genuine long tail,
      which is M6.4's problem rather than a missing primitive.
      ⚠️ **SCRIPTABLE IS NOT EXECUTABLE, so M6.3's own done-when cannot be met by
      M6.3.** A primitive makes a card *possible* to script; the script is M6.4.
      `1,405` moves only when scripts land, so the two milestones are one arc.
      ⚠️ The classifier asks **`parseEffects`** whether a line is expressible —
      the same closed vocabulary the engine runs, never a second list. Third time
      this project has had to write that down (the Command Tower lesson, D122).
      **Verified: 4 checks over the real database, with the build-order figures
      and the 10.4× multiplication pinned as EXACT values** so the order cannot
      quietly stop being the right one · `tsc -b` clean.
      **The build has begun: `optional` (D128), layer 6's ability half (D129)
      and counter effects (D130) — see the three entries below.
      ⚠️ D129 found that this entry's "`derive.ts` runs 1/7b/7c/7d" was wrong:
      every layer has a live seam, and what layer 6 lacked was CR 613.7's ORDER.
      ⚠️ D129 and D130 both found the same thing one layer apart — **these rows
      are BUCKETS, not primitives.** `layer6`'s 1,722 is 1,108 ability grants
      plus 227 combat restrictions the engine has no seam for; `effect:counter`'s
      1,441 is 197 spells plus 981 cards that were never blocked at all, because
      `CountersChanged` already existed and the classifier's proxy cannot see
      what a SCRIPT can return. Split a row before building it.**

      ⚠️⚠️ **CLOSED ON A RESTATED CRITERION, AND THE RESTATEMENT IS THE HONEST
      PART (D157).** The M6 brief's done-when for this milestone is *"the number
      of completely-executable Commander-legal cards has MULTIPLIED and the fuzz
      gate is green with all of them in the pool."* `complete` went **1,405 →
      1,730 — ×1.23**, which is not a multiplication, and **it never could have
      been**: D127 measured on day one that scriptable is not executable, that a
      primitive makes a card *possible* to script, and that the script is M6.4.
      The bar was written for an arc, and M6.3 is the first half of it.

      What M6.3 is closed against instead, all measured:
      · **what a SCRIPT can express went 795 → 1,362** — and that second number
        is D153's correction of a figure that had been inflated to 3,463 by a
        pre-filter since D128, so the honest gain is smaller than this file
        claimed for twenty-four decisions;
      · **`complete` 1,405 → 1,730 (+325)**, every card of it through the effect
        VOCABULARY and the built-in replacements rather than through a script;
      · **the 500-seed replay fuzz gate green**, last at 456.9 s, with every
        script the gate registers also dealt in its deck — now asserted rather
        than remembered (D156);
      · **nothing in the layer system is described as unrepresentable any more.**
        D129 named three impossibilities, D151 removed the last of them, and what
        is left of CR 613 is three ordinary items with stated shapes.

      ⚠️ **THE MULTIPLICATION IS M6.4's, AND SAYING SO IS THE POINT.** Ticking
      this box on the original wording would have claimed a coverage number this
      milestone was never able to move.

- [x] **M6.3a — "You may" (2026-08-01):** the first primitive off D127's list,
      and the biggest by sole need (**2,012 cards**). A "may" trigger stops on
      resolution and asks its controller; the answer is honoured, and declining
      is a real outcome rather than a no-op. Decisions in **D128**.
      ⚠️ **The flag existed and nothing read it.** `TriggerDef.optional` has been
      in the script API since M3 and `collectTriggers` has copied it onto every
      `PendingTrigger` for as long — so a "may" trigger fired unconditionally,
      which is half-execution in the one direction D90 forbids: doing something
      the player never chose.
      `Awaiting` gains `optionalTrigger` (**12 kinds → 13**), `intents.ts` gains
      `AnswerOptionalTrigger`, `events.ts` gains `OptionalTriggerAnswered`
      (a marker, like `StateBasedActionsApplied`), and `loop.ts`'s `resolveTop`
      grows the one decision. **CR 603.1 — the choice is made ON RESOLUTION**, so
      the ability still goes on the stack, still takes its APNAP position and can
      still be responded to.
      ⚠️ **ONE RESOLUTION, TWO CALLERS.** `resolveAbility` is EXTRACTED, not
      copied: `resolveTop` calls it for every ability, `answerOptionalTrigger`
      calls it with the answer. Two copies of "leaves the stack, runs its script,
      narrates" would disagree about the order of those three, invisibly, until a
      card killed its own source.
      ⚠️ **All five D125-hardened places failed until updated, which is the guard
      working** — the union, the producer map (now **11 producers of 13 kinds**),
      `simplestAnswer`, the bot's exhaustive switch, the net driver — plus
      `PromptBar`'s viewer branch, written from the first line rather than found
      by playing (D101).
      ⚠️ **`simplestAnswer` declines and the bot accepts, on purpose.** Declining
      runs no script, so it is legal on any board and cannot make a rules test
      execute card text it did not ask for. The bot's accept is a POLICY, said to
      be one: a prompt carries a label and nothing else, and `src/bot/` may not
      import an engine module taking a `GameState`. It is unreachable today —
      the bot's pool has no card with an unrun triggered ability.
      ⚠️ **A player who is out of the game is never asked**, because their answer
      is not in doubt and CR 800.4a would have removed the object outright.
      **Proved on a real card:** `src/engine/testing/cardScripts.ts` registers
      `Ajani's Mantra` — `{1}{W}`, and its WHOLE printed text is the optional
      trigger, so the script runs every word of it (D90). It is the first real
      card text ever to run through the trigger bus; `turn.test.ts`'s fixture
      trigger resolves to `[]`. **Not shipped** — `EMPTY_REGISTRY` is still what
      the app runs.
      ⚠️ **THE FUZZ GATE HAD NEVER RUN THE TRIGGER BUS AT ALL.**
      `collectTriggers` short-circuits on `scripts.size === 0`, so in 500 seeds
      no `PendingTrigger` had existed, nothing had been APNAP-sorted, no ability
      had been drained onto the stack and `orderTriggers` — a prompt with a real
      producer — had never been raised. The gate builds a registry now, and
      answers the new prompt with a COIN FLIP rather than through
      `simplestAnswer`, or the accept half would go untaken in all 500 seeds.
      ⚠️ **Its first trigger canary was green over nothing:** counting every
      `AbilityPutOnStack` read **249 with an empty registry**, because that event
      also carries every ACTIVATED ability. Filtered on `obj.kind`, it is 0
      without the script and 1,198 with it.
      **Verified: 1,138 Vitest / 6 skipped across 51 files** (up from 1,126 / 6
      across 50) **· `tsc -b` clean · `npm run build` clean · the 500-seed replay
      fuzz gate green at 93,267 accepted intents / 2,290,878 events / 17,301
      turns — up 0.5%, 1.5% and 0.6% from D125's, with every replay hash matching
      — carrying 1,198 triggered abilities and 621 may-triggers taken / 566
      declined against 0 / 0 / 0 before · `battery-anim.cjs bot engine` 102/102 ·
      `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults ·
      `npx electron scripts/probe.cjs` 124/124 · registry cost measured at 1.6%.**
      ⚠️ **`1,405` DID NOT MOVE, and that is the correct result.** What a script
      CAN express went **795 → 2,915 (+2,120, 3.67×)**; what the engine RUNS is
      unchanged, because this wrote no card scripts into the product.
      `primitives.node.test.ts` asserts both in one test so the enabling figure
      can never be reported as coverage. Every classifier figure D127 pinned is
      byte-identical — only the new `BUILT` set moved.
      ⚠️ **The prompt is UNREACHABLE in the shipped app** (`host.ts` builds its
      `Game` with `EMPTY_REGISTRY`), so `PromptBar`'s branch and the net driver's
      case are covered by `tsc -b` and review, not by play. Acceptable only
      because `Awaiting` crosses the wire WHOLE (D61) with no per-kind code on
      either side. **M6.4 must drive this prompt through the real UI on the first
      "may" card it lands.**
      ⚠️ **Two reportables, measured and NOT fixed** (D128): a "dies" trigger
      cannot be written correctly at all — `collectTriggers` takes `before` but
      `readonlyCtx` builds the script context from `after` alone, so `matches`
      cannot see the board the card died on; and `collectTriggers` rebuilds
      `Object.keys(state.cards)` inside both of its loops, which is noise with
      one registered card and O(events × defs × cards) with a library.

- [x] **M6.3b — Layer 6 existed; what it lacked was an ORDER (2026-08-01):**
      the second primitive off D127's list, and the first thing it found is that
      the starting point was misread. Decisions in **D129**.
      ⚠️ **`derive.ts` has called `applyStatics(…, 'ability')` since M3**, and
      also for `type`, `color`, `cda`, `ptSet`, `ptModify` and `ptSwitch`. Layer
      6 was never missing; "runs layers 1, 7b, 7c, 7d" described what the layers
      had been USED for. What was missing is **CR 613.7 — the order**.
      ⚠️ **THE BATTLEFIELD ARRAY IS THE TIMESTAMP.** `addToZone` appends, so
      `state.zones.battlefield` is arrival order and a permanent that re-enters
      goes to the back — exactly CR 613.7c, which is why **no timestamp field was
      added to `GameState`**. That makes `zones.ts`'s order convention
      load-bearing for the layer system, which nothing said; it is asserted now.
      ⚠️ **The loop was nested the wrong way round**: defs outside, battlefield
      inside, so every source of the first-REGISTERED script applied before any
      source of the second. `Levitation` against `Gravity Sphere` was decided by
      the registry rather than by which enchantment entered last.
      ⚠️ **`StaticDef.appliesTo` takes the candidate's `chars` now**, because a
      static that asks `ctx.derive(candidate)` recurses forever — it is running
      inside that object's own derive. Measured as `RangeError: Maximum call
      stack size exceeded` on the first real script, whose only sin was asking
      "is this a creature". `chars` is also the better answer: it has layer 4
      applied where a printed type line does not.
      **Proved on the canonical pair** — `Levitation` ("Creatures you control
      have flying") and `Gravity Sphere` ("All creatures lose flying"), both
      single-sentence, and **neither proves anything alone**: two grants commute,
      so only a grant against a removal shows an order.
      ⚠️ **THIS IS WHAT D82 WAS WAITING FOR.** Hexproof and shroud have been
      enforced only where PRINTED since the targeting work, because "a granted
      one needs a layer-6 script" — and none had ever existed. **`combat.ts` is
      UNCHANGED**: it reads derived characteristics, so the grant arrives for
      free, asserted on the block prompt's own `legal` list.
      ⚠️ **CR 613.8 DEPENDENCY IS NOT BUILT, and 613.7d/e are not either** (a
      re-attached Aura and a face-down permanent keep their old position). The
      rule that follows is the brief's: a card whose correctness needs one of
      them is not registered. Removing a NON-KEYWORD ability has no
      representation at all — `MutableCharacteristics` models keywords — so
      `Humility` could not have been the demonstration card in any case.
      ⚠️ **`layer6` is NOT added to the report's `BUILT` set, and the reason is
      measured**: of the bucket's 1,722 cards, **1,108 are ability grants (built
      here), 253 anthems (layer 7c, since M3), 134 conditionals (already worked)
      — and 227 are COMBAT RESTRICTIONS**, CR 508/509, which `canAttack` and
      `canBlock` consult no static for. Ticking the bucket would claim 227 cards
      the engine cannot express. **A bucket is not a primitive**; the split is
      pinned, and doing it properly is M6.3c's first job.
      ⚠️ **The split was nearly measured with a SECOND COPY of the rule** — a
      scripted edit wrote every `\b` as a literal BACKSPACE, so all 1,722 cards
      fell into `other` while the classifier still filed them under `layer6`. The
      report asks `layer6Kind`, exported from `primitives.ts` and composed from
      the same constants `LAYER6` is built from. Fourth time (D122, D127).
      **Verified: 1,147 Vitest / 6 skipped across 52 files** (up from 1,126 / 6
      across 50 at the start of M6.3) **· `tsc -b` clean · `npm run build` clean
      · the 500-seed fuzz gate green at 92,986 accepted intents / 2,337,352
      events / 17,685 turns, every replay hash matching, carrying 1,329 triggered
      abilities and 577 layer-6 sources on a battlefield · `battery-anim.cjs bot
      engine` 102/102 · `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0
      faults · probe 124/124 · every D127 figure reproducing.**
      ⚠️ **It costs 64%, measured and attributed**: 60 seeds, same deck, games
      identical to within 0.03% of events — **33.6 s with the trigger script
      alone, 55.2 s with the two statics**. The cause is `applyStatics` scanning
      the whole battlefield once per object per layer per derive, O(N²) across an
      SBA sweep. **The first guess was wrong and is recorded as wrong**: making
      `makeScriptCtx` lazy recovers about 1%, and the comment claiming otherwise
      was corrected rather than deleted. Zero cost in the product, which ships
      `EMPTY_REGISTRY`; index the sources before M6.4 lands statics at scale.
      ⚠️ **Checked by reverting the loop nesting**: exactly the two ordering
      checks fail, one by its own message (`Levitation last — flying: expected
      false to be true`), and the other six pass because they do not depend on
      order.
      ⚠️ **One more Tier-1 gap found in passing: there is NO WORLD RULE** (CR
      704.5m). `sba.ts` never mentions the supertype, so any number of world
      permanents can coexist. Unrelated to layers; found by choosing `Gravity
      Sphere`.

- [x] **M6.3c — Counters: seven cards EXECUTED, and 981 that were never blocked
      (2026-08-01):** the third primitive off D127's list, `effect:counter`,
      worth 1,441 cards by sole need. **The first one to move the number that
      matters — and most of what it was supposed to be worth was not missing.**
      Decisions in **D130**.
      ⚠️ **Measured first (D129's lesson).** The 1,441 splits: **197 spells**
      (which need the effect VOCABULARY), **263 "enters with"** (a replacement),
      **221 activated + 760 triggered/static** — and those **981 WERE NEVER
      BLOCKED ON A PRIMITIVE.** `CountersChanged` has been on the log since D107
      and a `TriggerDef` returns `EventBody[]`, so a permanent that puts counters
      has been scriptable since M3. D127 filed them here because its proxy for
      "could a script express you" is `parseEffects` — the INGEST vocabulary for
      one-shot SPELLS, which refuses every permanent by construction.
      **Asserted, not argued:** `Ajani's Pridemate` is registered and driven with
      no vocabulary involved at all.
      ⚠️ **263 are blocked on a DEAD API.** `applyReplacements` fetches
      `scripts.replacements()`, checks the length, and returns `events` unchanged
      **either way** — a registered `ReplacementDef` has never run. D128's shape
      exactly. NOT fixed here: it belongs to `replacement` (418), and doing it
      properly needs CR 616's ordering prompt.
      **Built:** `putCounters` / `removeCounters` in `effectParse`'s closed
      vocabulary → the `CountersChanged` that already existed. Nothing was added
      to the log, the reducer or the state hash.
      ⚠️ **`CounterKind` is `'+1/+1' | '-1/-1'` and nothing else** — the two
      `derive.ts` sums at layer 7d. A charge or trample counter would be recorded
      on the card and applied by NOTHING, which is half-execution wearing a
      number (D90).
      ⚠️ **`Burst of Strength` is why the pattern is anchored**: "Put a +1/+1
      counter on target creature AND UNTAP IT" is ONE sentence, so the `assisted`
      rule never sees a second clause, and only the `$` stops the parser running
      two thirds of the card. It comes out `manual`, pinned.
      **1,405 → 1,412 cards now run COMPLETELY** — `Battlegrowth`, `Scar`,
      `Blight Rot`, `Common Bond`, `Honor`, `Instill Infection` and `Tuinvale
      Treefolk // Oaken Boon`. Also **auto 269 → 276, assisted 1,359 → 1,403**
      (44 more spells whose counter clause the prompt bar can now offer as one
      logged click), 115 faces out of "understood nothing", and scriptable
      795 → 845.
      ⚠️ **The seventh is an ADVENTURE**, which is why the pool's `creature`
      count moved for a spell change: `engineCompleteness` sums every face,
      `bucketOf` types by the first. It raised the right question — the app does
      not OFFER that half — and **27 engine-complete cards were already
      multi-face** with zero notes, so this adds one to a pre-existing silence
      rather than creating one. Measured before concluding.
      ⚠️ **The cumulative ladder moved at both ends and D127's 10.4× is 9.8×**:
      up at the start (50 more scriptable), DOWN at the end, because the seven
      that became complete left `blocked` and the ladder is drawn from blocked
      cards. **A falling total is the measurement working** — the pool a
      primitive could unlock shrinks every time one is executed.
      **Verified: 1,156 Vitest / 6 skipped across 53 files** (up from 1,147 / 52)
      **· `tsc -b` clean · `npm run build` clean · the 500-seed fuzz gate green
      at 92,630 accepted intents / 2,375,679 events / 18,051 turns, with 1,330
      +1/+1 or -1/-1 counters written by the RULES (0 before) and target prompts
      up 3,285 → 4,889 · `battery-anim.cjs bot engine` 102/102 ·
      `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults · probe
      124/124.**
      ⚠️ The fuzz canary is filtered on `cause.kind !== 'manual'` — the fuzzer's
      Tier-3 tools write `+1/+1` counters one manual intent in thirteen, so an
      unfiltered count would have been green since M3. D128's green-over-nothing,
      avoided by remembering it.
      ⚠️ **`battery-bot` is unchanged to the decimal by design** —
      `tournament.node.test.ts` plays a MIRROR deck, not `botDeck.ts`. But
      **`botDeck.ts` DID change and had to be regenerated**: the pool grew, so
      `Common Bond` displaced a card at mana value 3. Its two guards are semantic
      (in the pool, legal deck) and neither would have noticed — **a generated
      file with no "regenerating is a no-op" guard, which is D123's finding in a
      second file.**
      ⚠️ **Two more reportables** (D130): a triggered ability cannot choose a
      TARGET at all (`PendingTrigger` carries none, `drainTriggers` builds
      `targets: []`), so every targeted trigger is unscriptable; and D127's proxy
      over-reports every primitive whose EVENT already exists — **`effect:token`
      (1,123) is the same shape and should be split before it is built.**

- [x] **M6.3d — `effect:token` SPLIT, and D130's prediction was wrong
      (2026-08-01):** measured, not built. Decisions in **D131**.
      ⚠️ **The two events are NOT alike.** D130 predicted tokens would be the
      same shape as counters — an event that already exists, so several hundred
      cards already scriptable. `CountersChanged` takes a free-string `kind`;
      **`TokenCreated` requires an `oracleId` AND a `printingId`**, so a script
      must NAME one of 3,290 token printings — and nothing maps a printed
      description to one. The only token resolution in the app is `TOKEN_NAMES`
      in `buildGame.ts`: **twelve names, hand-written**, for the Tier-3 tool.
      **Both halves of the row are blocked on the same missing piece, and it is a
      resolver over card DATA rather than an engine primitive.**
      **The split of 1,123:** by owner **373 spells / 750 permanents**; by what
      is asked for **421 plain · 342 with abilities · 212 predefined artifact
      (Treasure, Food, Clue…) · 77 copies · 71 X** — `unclaimed` **0**, so the
      five buckets are the whole row.
      ⚠️ **77 belong to CR 707**, not here (M6.4-LIBRARY-SPEC §4.4).
      **Feasibility, measured against the data on disk:** 3,290 token printings /
      848 names; of 165 distinct plain descriptions **88 resolve uniquely, 3
      ambiguously, 74 to none** — 261 of 389 cards. **Every miss is a token that
      CARRIES TEXT** (`Angel 4/4 W "Flying"`, `Spider 1/2 G "Reach"`), which is
      why `withAbilities` is 342.
      ⚠️ **THE ABILITIES ARE IDENTITY, NOT DECORATION.** The database holds both
      `Angel 4/4 W "Flying"` and `Angel 4/4 W "Flying, vigilance"` — same P/T,
      colour and subtype, distinguished by nothing but their text. A resolver
      matching on P/T and type alone would create the WRONG token, silently, on a
      card that reads correctly.
      ⚠️ **373 spells is 1.9× the 197 counters was worth**, so the ceiling on
      `complete` is higher than D130's seven — but every one still needs the
      resolver first.
      **Verified: 1,157 Vitest / 6 skipped across 53 files · `tsc -b` clean ·
      build clean.** Both splits pinned, asked of `tokenKind` exported from
      `primitives.ts` rather than re-derived (D129's lesson). Nothing under
      `src/engine/` was touched, so the fuzz gate cannot move and was not re-run.
      ⚠️ **THE GENERAL LESSON, NOW THREE TIMES OVER:** D129 found `layer6` was a
      bucket containing a rules subsystem it had no seam for; D130 found
      `effect:counter` was a bucket containing 981 cards never blocked at all;
      D131 finds `effect:token` is a bucket whose two halves share one dependency
      nobody had named. **Split the row before building it** — the classifier
      answers "what does this SENTENCE need", which is not "what does this ENGINE
      lack".

- [x] **M6.3e — The token resolver (2026-08-01):** `src/data/tokenParse.ts` — a
      printed token description, and the printing it names. The piece D131 found
      both halves of `effect:token` blocked on. Decisions in **D132**.
      **Measured over the whole database: 586 of 1,180 token clauses are
      readable, 567 of those name exactly ONE printing (96.8%), 0 ambiguous, 19
      name no token at all — and 526 of the 1,123 cards have EVERY token line
      resolved**, which is the number that matters because a card is executable
      only if all of it is.
      ⚠️ **EVERY FAILURE IS A REFUSAL.** A description this module cannot read
      completely, or that names no token, or that names two, produces NOTHING.
      **Four things had to be right, and the first cut got all four wrong** — it
      resolved 53 clauses and called 328 ambiguous. Each fix came from reading a
      failure:
      ⚠️ **Ambiguity is counted by `oracleId`, not by PRINTING.** The plain 1/1
      white Soldier has **66 printings and one oracle id**; counting printings
      invented 328 ambiguities. Two oracle ids is a refusal. The printing chosen
      among reprints is deterministic (lowest scryfall id) or two players would
      disagree about a `printingId` on the wire.
      ⚠️ **The printing states its keywords with REMINDER TEXT** — the card says
      "with lifelink", the token prints `Lifelink (Damage dealt by…)`. Without
      scrubbing, every keyword token in the format misses.
      ⚠️ **A predefined token's ability is its OWN and the card never states it**
      — "create a Treasure token" against `{T}, Sacrifice this token: Add one
      mana of any color.` Its NAME is the whole identity.
      ⚠️ **AND THE ONE THAT CANNOT BE SEEN IN THE WORDS.** Callers hand this
      module text already through `scrub`, which blanks quoted text with SPACES
      OF THE SAME LENGTH — so `Dragon Egg`'s "…token with flying and \"{R}: …\""
      arrives as a token with flying and a run of spaces: a well-formed
      description of a DIFFERENT, real token. Matching it would put the wrong
      permanent on the battlefield on a card that reads correctly. The guard is
      `/\s{2,}/` — the gap is only visible in the spaces the quotes left.
      ⚠️ **The 19 misses are the DATABASE, not the parser**: a green Dog, a 2/3
      red Minotaur *with haste* where only the vanilla one was printed. Pinned
      under 5% so a parser that started inventing matches shows up here first.
      **Verified: 1,189 Vitest / 7 skipped across 55 files** (up from 1,157 / 53)
      **· `tsc -b` clean · build clean.** 28 checks against the three REAL token
      fixtures, 4 over the live database. Nothing under `src/engine/` was
      touched, so the fuzz gate cannot move and was not re-run.
      ⚠️ **NOTHING CALLS IT AT RUNTIME YET, and that needs a DECISION** — stated
      plainly because the last three entries were about seams nothing consumes.
      For a token spell to resolve by itself, `effectParse` must decide `auto`,
      and that needs the token corpus. **(A)** thread a token index into
      `parseFace` — nearly free at runtime, but `effectMode` stops being a
      property of the CARD and `tier3`/`engineComplete`/`botPool` would disagree
      with the engine (D122's exact failure); **(B)** resolve at DATABASE BUILD
      time and store the printing id on `CardData` — cleanest, like
      `colorIdentity` (D12a), but a schema change, a re-sync, 93 regenerated
      fixtures and a wider wire dictionary (D52); **(C)** never `auto`, only
      `assisted` — nothing can half-execute and no schema change, but `complete`
      does not move. **Recommended: (B) long-run, (C) as the first shippable
      step.** (A) buys the least and breaks the most.

- [x] **M6.3f — Tokens EXECUTE (2026-08-01):** the resolver got its consumer.
      **1,412 → 1,472 cards now run completely — +60, 8.6× what the counter
      vocabulary was worth.** Decisions in **D133**.
      ⚠️ **D132's option (B) as WRITTEN is not implementable**, and that is a
      structural fact rather than a change of mind: the card database is built by
      `electron/cardsvc-worker.cjs`, and **`electron/` never imports `src/`** — a
      grep proves it — so storing the printing id on `CardData` at ingest would
      need a SECOND COPY of `tokenParse.ts` in CommonJS. Five entries of this
      file already say why that is the one thing not to do.
      **So the resolution is baked into a GENERATED TS TABLE** —
      `src/data/tokenTable.ts`, 400 descriptions, 64 kB, the same idiom as
      `botDeck.ts`. Identical semantics (`effectMode` stays a property of the
      CARD), and none of (B)'s priced costs: no schema change, no re-sync, no
      wire growth. It carries the **regenerating-is-a-no-op guard** D130 caught
      `botDeck.ts` missing.
      ⚠️ **THE PART THAT COULD HAVE BEEN SILENTLY WRONG: a token whose printing
      the POOL does not hold is a BLANK.** `derive` cannot find it, so it becomes
      the inert unknown-printing object — a nameless 0/0 the SBA bins — and the
      spell resolves perfectly having produced nothing anybody can see. Three
      lifecycles had to carry it: solo's `loadTokens(seats)`, the host resolving
      a guest's token printings **inside the same awaited `.then` that seats the
      deck** (after it would race `start()`), and the FIXTURE — `SOLDIER_TOKEN`
      was pinned to `tmd1 1` where the table names `t40k 2★`. Same token at a
      real table; **not the same id, and the id is what the pool is keyed on.**
      **Also: spells `auto` 276 → 337, `assisted` 1,403 → 1,532, `effect:token`
      sole-need 1,123 → 796, scriptable 845 → 1,130.**
      ⚠️ **The resolver's OWN measurement fell — 1,123 → 796 cards, 586 → 244
      readable, 526 → 213 resolved — and that is it working.** The cards it
      resolves have left the blocked set for the completed one. D127's ladder is
      **7.3× where it was 10.4×** for the same reason at both ends. A headline
      that could only go up would be measuring effort.
      **Verified: 1,199 Vitest / 8 skipped across 57 files** (up from 1,189 / 55)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green at 92,254
      accepted intents / 2,413,154 events / 18,349 turns, with 782 tokens created
      by the RULES and all 782 nameable by the oracle · `battery-anim.cjs bot
      engine` 102/102 · `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0
      faults · probe 124/124.**
      ⚠️ **The fuzz canary counts tokens the ORACLE CAN NAME and asserts it
      EQUALS the number created.** `TokenCreated` fires whether or not the
      printing exists, so the count alone would go green on a board of blanks.
      ⚠️ **Three tests began timing out and it is NOT a regression.** At 57 files
      vitest's concurrency starves the slowest ones; measured in isolation they
      are 2.0 s, 2.4 s and 3.5 s against a 5 s default, and **the failing SET
      varied between runs** — D106's tell. `testTimeout` is 20 s now, to catch a
      HANG rather than referee CPU.
      ⚠️ **The bundle grew 813.7 kB → 876.6 kB** (+7.7%), which is the table —
      the price of (B), named rather than absorbed.

- [x] **M6.3g — "Enters tapped", and the replacement API that had never run
      (2026-08-01):** **1,472 → 1,577 cards run completely — +105, the largest
      single step of M6.3, and LANDS went 48 → 128.** Decisions in **D134**.
      ⚠️ **Split first, for the FOURTH time, and for the fourth time the row was
      not a primitive.** `replacement`'s 418 is **173 "enters tapped" · 133 other
      "instead" · 108 "if … would … instead" · 4 "as … enters"**. Only the first
      is a self-replacement with no choice, no ordering and no interaction — a
      property of the card, so a built-in rule beside D107's entry counters
      rather than a card script. **661 blocked cards carry the line, 517 of them
      LANDS**, and the bot pool's rejection tally had it fifth at 411.
      ⚠️ **THE ANCHOR IS THE WHOLE SAFETY PROPERTY.** The strict clause accepts
      538 lines and finishes **104 cards outright**, against the loose
      classifier's 173 — the difference is every card that CONTAINS the clause
      without being it: `enters tapped UNLESS you control two or more other
      lands` (31), `UNLESS you have two or more opponents` (10), `UNLESS a player
      has 13 or less life` (10), `enters tapped AND doesn't untap` (3). Tapping
      those and dropping the condition is strictly worse than doing nothing.
      `engineComplete` asks `replacementParse` rather than re-reading the text —
      the fourth time that rule has been written in that file.
      ⚠️ An EVENT in `applyReplacements`, never a reducer branch (D107's reason:
      `apply` cannot look a printing up, and `tapped` is in the state hash), and
      it lives in the funnel because TEN places move a card onto the battlefield.
      Asserted by a test that PLAYS the land rather than moving it with a tool.
      ⚠️ **AND THE REPLACEMENT API HAD NEVER RUN.** `applyReplacements` fetched
      `scripts.replacements()`, checked whether the list was empty, and returned
      `events` unchanged **either way** — so a registered `ReplacementDef` had
      never fired since M3. D130 and D131 both named it while measuring something
      else; `TriggerDef.optional`'s shape exactly (D128). It runs now, proved
      with `Hardened Scales` + `Branching Evolution`.
      ⚠️ **`used` is the termination argument AND the rule** — CR 614.5, an
      effect applies at most once to a given event. Without it Hardened Scales
      replaces its own output forever: its result matches its own condition. It
      does not return a wrong number; it does not return. `api.ts` asked for this
      guard in a comment and could not enforce it.
      ⚠️ **CR 616's CHOICE IS NOT BUILT, and it is said.** Two counters with both
      enchantments out is **six** one way and **five** the other, so the order is
      not a detail. Applied in BATTLEFIELD order (D129's timestamp order) —
      deterministic and replayable, and not the rule. A card whose correctness
      depends on choosing stays unregistered.
      ⚠️ **Four other rows went UP and it is not a regression**: `optional`
      2,012 → 2,033, `layer6` 1,722 → 1,734, `counter` 1,351 → 1,364, `token`
      796 → 804. A card blocked by replacement AND one other thing is now blocked
      by the other thing alone, so it moves into that row. The rows partition
      what is left, and finishing one feeds the others.
      **Verified: 1,215 Vitest / 8 skipped across 59 files** (up from 1,199 / 57)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green at 92,113
      accepted intents / 2,424,881 events / 18,374 turns, with **1,034 permanents
      entering tapped** and 826 tokens all nameable · `battery-anim.cjs bot
      engine` 102/102 · `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0
      faults · probe 124/124.**
      ⚠️ The canary counts a `PermanentsTapped` that FOLLOWS a `CardsMoved` —
      counting every tap would also count the untap step's mirror, every wrench
      and every land tapped for mana.
      ⚠️ **Three reportables** (D134): the other 245 sole-need cards need CR
      616's prompt; "enters tapped UNLESS …" is 60+ cards on four wordings, all
      board queries the engine could evaluate and the cheapest remaining slice;
      and `Grimgrin enters tapped AND doesn't untap` is the one shape joined by
      "and" rather than split by a full stop.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,577.** Then: CR 616's ordering prompt
      (unblocks 245), "enters tapped unless" (60+), or the `layer6` split (227).

- [x] **M6.3h — "Enters tapped UNLESS": seven board queries, and the one that is
      a PROMPT (2026-08-01):** D134 named this as the cheapest remaining slice at
      "60+ cards on four wordings". Measured properly it is **112 cards on 40
      distinct wordings**, and the measurement shaped the vocabulary rather than
      the other way round. **1,577 → 1,642 cards run completely — +65, and every
      one of them is a LAND (128 → 193, 17.3% of all 1,114 Commander-legal land
      names).** Decisions in **D135**.
      **The seven queries, and the cards behind each:** `otherLands` 26 ·
      `controlPermanent` ~48 (`a Forest` · `a Forest or a Plains` · `a basic
      land` · `a Mount or Vehicle` · `a legendary green creature`) · `basicLands`
      10 · `opponents` 10 · `anyPlayerLifeAtMost` 10 · `opponentsLands` 5 ·
      `otherLandsOfType` 5 — **104 of the 112**. Every one is a question about
      the board the engine answers with no input from anybody, which is what
      makes them buildable, and nothing is modelled speculatively: a shape the
      pool does not print is a shape no real card can test.
      ⚠️ **`As this land enters, you may pay 2 life. If you don't, it enters
      tapped.` IS A PROMPT — 20 cards on that exact wording, 37 across the
      shape — and it is REFUSED.** Reading it as a board query means the engine
      declines to pay, every time, silently: the player is never offered the
      choice the card gives them. That is D90 with a decision instead of an
      effect. `Godless Shrine` is a fixture, so the refusal is a test rather than
      an intention.
      ⚠️ **THE ENTERING LAND IS NOT ON THE BATTLEFIELD YET, and every "other
      lands" count depends on it.** `applyReplacements` runs on the state BEFORE
      its own event — the property `withTransformCounters` already relies on to
      see the old face — so counting the battlefield as it stands is exactly the
      "other" these cards mean. Nothing has to exclude the card itself, and a
      version that did would be wrong by one on every dual land in the format.
      ⚠️ **`selfRef` matches `This land` and NOT `this land`**, because every
      clause it was written for starts a sentence. The inverted wording says it
      mid-sentence — "If you control two or more other lands, **this land**
      enters tapped" — so the clause parsed as nothing and `Lair of the Hydra`
      came in UNTAPPED on every board: the failure that looks exactly like the
      feature working, because an untapped land is what you get when a rule does
      not fire. Fixed in `replacementParse` with a case-insensitive pass, not by
      changing `selfRef`, which `effectParse`'s whole vocabulary depends on.
      ⚠️ **The inverted wording is normalised at PARSE time, so there is ONE
      evaluator.** "enters tapped IF you control ≥2 other lands" is exactly
      "enters tapped UNLESS you control ≤1 other lands"; doing that flip in the
      engine would have meant a second place that knows what these clauses mean.
      Only `otherLands` prints this way (5 cards) — inverting anything else would
      be a guess, so anything else is refused.
      ⚠️ **`OracleFace.entersTapped` is ONE field (`EntersTapped | null`), not a
      boolean with a condition beside it.** "Enters tapped unless you control a
      Forest" is not `entersTapped: false`, and a caller that checked only the
      boolean would let it in untapped every time.
      ⚠️ Four other rows rose again for D134's reason — `optional` 2,033 → 2,037,
      `layer6` 1,734 → 1,736, `counter` 1,364 → 1,365, `token` 804 → 812: a card
      blocked by this AND one other thing is now blocked by the other alone.
      **Verified: 1,222 Vitest / 8 skipped across 59 files** (up from 1,215 / 8)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green at 91,657
      accepted intents / 2,412,366 events / 18,238 turns, with permanents
      entering tapped up 40% at 1,450** (`Sunpetal Grove` joins `DECK` beside
      `Haunted Ridge` so both answers are exercised as a real board fills up, and
      `Godless Shrine` joins as the one the parser must refuse) **·
      `battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40` 78.8%
      [68.6%, 86.3%], 0 faults · probe 124/124.** Tier-3 `abilityText` 17,634 →
      17,532 and cards with no note at all 1,983 → **2,048**; fixtures 101 → 105.
      ⚠️ **Three reportables** (D135): the 37 "you may pay N life" lands, the 4
      "as this land enters, choose a colour" cards and CR 616's ordering all
      converge on ONE missing piece — **a replacement effect that asks a
      question** — which is now the next thing worth building by weight of cards
      rather than by row; `Grimgrin enters tapped AND doesn't untap` (3 cards)
      needs untap restrictions rather than a wider parser; and "enters tapped
      with two charge counters" (10 cards) is two rules that both exist in one
      sentence nothing reads together.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,642.**

- [x] **M6.3i — A replacement effect that ASKS, and D135's reportable was wrong
      about it (2026-08-01):** D135 closed by naming "three rows converging on one
      missing piece — a replacement effect that asks a question". **Measured,
      they do not converge**, and the correction is the useful half of this entry:
      they are three prompts with three answer types and wildly different payoffs.
      **1,642 → 1,658 cards run completely (+16), lands 193 → 208.** Decisions in
      **D136**.
      **The split of "As ~ enters …" — 267 cards, 115 wordings, measured against
      `engineComplete`'s own leftover lines:** `choose` **162 cards / 6
      completable** · `other` 47/12 · `pay` **32/16** · `reveal` 19/15.
      ⚠️ **THE BIGGEST FAMILY IS WORTH SIX CARDS.** "As this enters, choose a
      creature type" (55) · "choose a color" (33) · "choose an opponent" (10) —
      and **172 of the other unaccounted lines on those cards read "the
      chosen"**. The answer only matters because a later ability consumes it, so
      building the question alone asks the player something that does nothing:
      a prompt as theatre, worse than the silence it replaced. It needs a
      `chosen` field on card state, which does not exist.
      ⚠️ **D135's "4 cards" for that family was `asEnters` counted over LANDS
      ONLY**, carried into a sentence about the whole database — and its "37" for
      the shape built here was cards CARRYING the line rather than cards it would
      finish. Two numbers, both reach reported as unlock, which is the exact error
      `primitives.node.test.ts` has two columns to prevent.
      ⚠️ **`payLife` is an `EntersTappedCondition`**, beside D135's seven board
      queries — not a second field and not a second parser, because "you may pay 2
      life, and if you don't it enters tapped" IS "enters tapped unless you pay 2
      life". It is the one member that is a QUESTION rather than a QUERY, so
      **`conditionHolds` EXCLUDES it from its parameter type**: a caller that
      forgets `isAskedCondition` fails `tsc -b` rather than tapping a land and
      never asking. Every wrong way to write that branch is silent — `false` is
      D135's refusal reintroduced as a bug, `true` lets the land in free.
      ⚠️ **THE PERMANENT HAS ALREADY ENTERED, UNTAPPED, while the prompt is up.**
      `applyReplacements` is pure `(state, events) → events` and cannot stop;
      suspending the fold would mean a CONTINUATION in `GameState`. So the entry
      happens, the question is asked, and the answer appends the payment or the
      tap. Nobody can act in the gap (an `Awaiting` blocks every intent), and a
      test that reads `tapped` before answering gets `false` every time.
      ⚠️ **A player who CANNOT pay is never asked** (CR 119.4), and the life is
      re-checked in the handler rather than trusted from a prompt written earlier.
      At exactly the price the payment is legal — `<`, not `<=` — because paying
      to 0 loses the game and that is the player's call.
      ⚠️ **The QUEUE is unreachable today and the test says so.** No intent
      produces a two-card battlefield move; it is built because a funnel is where
      that kind of gap hides (D128's dead `optional`, D134's dead
      `ReplacementDef`), and driven at `applyReplacements` and `handle` rather
      than claimed as end-to-end.
      ⚠️ **The FIRST prompt of M6.3 the bot can actually PRICE** — it carries a
      number, against a life total the bot reads off its own `PlayerView`, where
      `optionalTrigger`'s accept is a policy it cannot justify. Pays to a FLOOR of
      12 life, a floor and not a ratio. And reachable: the pool grew, so
      `botDeck.ts` regenerated with **`Temple Garden`** in it.
      **Verified: 1,233 Vitest / 8 skipped across 59 files** (up from 1,222 / 8)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green at 88,305
      accepted intents / 2,301,233 events / 17,345 turns with **491 paid life to
      enter untapped / 476 declined** · `battery-anim.cjs bot engine` 102/102 ·
      `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults · probe
      124/124.** Cards with no Tier-3 note 2,048 → **2,063**; fixtures 105 → 107.
      ⚠️ Intents, events and turns are all down ~4% and the prompt is why: it
      consumes one of each seed's 200 intents and blocks the rest until answered.
      ⚠️ **PLAYED BY HAND THROUGH THE REAL UI, which D128 could not be** — that
      prompt needs a registry and `EMPTY_REGISTRY` ships, so D128 left "M6.4 must
      drive this through the real UI" as a debt. This one needs only a real deck
      and a real `PlayLand`: the bar reads "Godless Shrine enters tapped unless
      you pay 2 life", **Pay 2 life** took 40 → 38 with the land upright, **Enter
      tapped** left 40 and tapped it, both logged.
      ⚠️ **Three reportables** (D136): `faceOf(printing, 0)` means **every MDFC
      BACK FACE is invisible** to this rule and to D134's and D135's — all 16
      printings of the 3-life wording — which needs the engine to know which face
      a permanent entered as; `chooseFromZone` now has TWO parsed families waiting
      on it (these 19 reveal lands plus D127's 1,625) and its answer type is also
      what CR 616's ordering needs, making it the best-value prompt left; and the
      `choose` family's 162 cards need a `chosen` field on card state, which is
      the primitive rather than the question.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,658.**

- [x] **M6.3j — Discarding, and the first prompt over a HIDDEN zone (2026-08-01):**
      `chooseFromZone` split for the seventh time running, built for its largest
      shape, and **1,658 → 1,665 cards run completely (+7)** — with the assisted
      count moving four times further. Decisions in **D137**.
      **The row is ONE regex with five alternatives and they are five rules:**
      `discard` 801 cards · `from your graveyard/hand to …` 675 · `look at the
      top N` 154 · `return a card from a graveyard` 9 · and `search library` —
      which matches **ZERO**, because `effect:search` is checked one rule earlier
      with a strictly broader pattern. Dead alternation in the classifier that
      decides the build order, there since D127.
      ⚠️ **AND DISCARD SPLIT AGAIN**, by what the clause IS: activated payload
      265 · trigger payload 239 · **plain one-shot EFFECT 221** · modal mode 44 ·
      additional cost 25 · keyword cost 18. Only the plain effect is a spell that
      resolves by itself. Of 825 lines, **717 let the DISCARDING player pick**.
      ⚠️ **THE PROMPT CARRIES NO CARD IDS, and that is the whole design.** Every
      other `Awaiting` variant names battlefield permanents or stack objects
      because the union crosses the wire WHOLE (D61); a hand is hidden, so
      listing candidates would post one player's hand to every client the moment
      they were asked to discard. It says only who, which zone and how many, and
      the client computes the rest from its own `PlayerView` — D125's rule met by
      construction. A test asserts the keys are exactly
      `count, kind, label, player, zone`.
      ⚠️ **The price is paid in the HANDLER**, which is the entire legality check
      because the prompt vouches for nothing: exact count, no DUPLICATE ids
      (`[c1, c1]` has length 2 and is one card), every id in that player's own
      hand. ⚠️ And **no prompt when there is no choice** (CR 701.8a) — an empty
      hand discards nothing, a hand no bigger than the count goes whole.
      ⚠️ **TWO WORDINGS REFUSED, each a different prompt:** `at random` (54
      lines) cannot be approximated because `effectEvents` has no RNG and
      randomness here comes only from the seeded generator; and `Target opponent
      reveals their hand. You choose a nonland card from it.` (53 lines, Duress /
      Thoughtseize) has the CASTER pick from a hand made public first. Both are
      fixtures, so both refusals are tests.
      ⚠️ **THE ROW SAID 801, SOLE-NEED SAID 404, THE PLAIN-EFFECT SUBSET SAID
      135, AND THE ANSWER IS 7.** Each is honest about a different question and
      only the last is cards the engine runs. D130's shape exactly (a 1,441-card
      row that paid 7), and the third time a "COMPLETE-if-built" estimate has
      overshot by two orders of magnitude — **measure the SENTENCE, not the row.**
      Spells `auto` 337 → **344**, `assisted` 1,532 → **1,564** (the bigger and
      better move), cards with no Tier-3 note 2,063 → **2,070**.
      **Verified: 1,244 Vitest / 8 skipped across 60 files** (up from 1,233 / 8)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green at 85,421
      accepted intents / 2,328,874 events / 17,721 turns with **240 discards
      chosen, 339 hand→graveyard moves** · `battery-anim.cjs bot engine` 102/102
      · `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults · probe
      124/124.** Fixtures 107 → 111. Played by hand through the real UI: the bar
      read "Ben is discarding 2." to Ana and "Mind Rot: click 2 cards in your
      hand to discard." to Ben, one ring after the first click, and the second
      click sent it — hand 7 → 5, graveyard 2, log "Ben discards 2 cards."
      ⚠️⚠️ **TWO BUGS WERE REPORTED THIS SESSION AND NEITHER EXISTED** (D137 has
      both in full). `botPool`'s numbers are NOT order-dependent — `auto` and
      `autoAnyFace` moved by different amounts, which puts the old value of one
      on the new value of the other, and `expect` throws on the first failure so
      the "second assertion disagrees" evidence was an assertion that never ran.
      Mind Rot does NOT resolve without discarding — the prompt goes to the
      TARGET, and the investigation had disabled the hotseat hand-off that shows
      it; then clicking `[data-hand-instance]` did nothing because that is the
      SLOT WRAPPER and the handler is on `[data-instance-id]` inside it.
      ⚠️ **AND THE REUSABLE ONE: `window.__crt.engine.view()` LAGS THE ENGINE BY
      ONE ANIMATION GROUP** — it can report "p1 has priority in main1" while the
      engine rejects a sorcery-speed cast as out of phase. Drive CDP verification
      off `submit()` results, never off the view.
      ⚠️ **AND THE ONE FIX THE FALSE ALARM EARNED: a clause whose target has
      gone now SAYS SO.** It was a bare `continue`, so the log read "Mind Rot
      resolves." and nothing else — correct per CR 608.2b, and indistinguishable
      from a broken effect, which is precisely why the non-bug above took four
      hours. It reads `Mind Rot — no legal target left for “…”` now. Not
      reachable by fizzling a single-target spell (that is countered on
      resolution and never enters `effectEvents`); it takes a cast naming no
      target. Checked by deleting it — exactly its own check fails.
      ⚠️ **It fired ZERO times in 500 seeds** and the gate came back
      byte-identical (85,421 intents / 2,328,874 events / 17,721 turns), so the
      branch is real, rare and covered only by the unit test. Said plainly
      because a fuzz canary here would have been green over nothing (D128).
      ⚠️ **Two reportables** (D137): `return a card from your graveyard` (675
      cards, 273 sole-need) is the same prompt shape over a PUBLIC zone, so it
      needs no hidden-information design and is the cheapest slice left; and
      `look at the top N` (154) already has half its machinery from D114's
      scry/surveil and needs only an EFFECT that raises it.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,665.**

- [x] **M6.3k — The graveyard return, and a target restriction nothing checked
      (2026-08-01):** D137 named this as the cheapest remaining slice, and it was
      — but the effect was not the interesting part. **Building it found that
      `targetAllowed` had never checked the ZONE or the CARD TYPE**, so
      `Raise Dead` ("Return target creature card from your graveyard to your
      hand") could take a **land** out of an **opponent's exile**.
      **1,665 → 1,684 cards run completely (+19)**, and **547 fewer target specs
      carry an unenforced restriction — 1,987 → 1,440**, which is 15× the size of
      the effect. Decisions in **D138**.
      **The eighth split:** 686 cards — 376 to a HAND, 312 to the BATTLEFIELD;
      and by clause, plain one-shot EFFECT 275 (150 sole-need) · trigger payload
      205 · activated payload 137 · modal mode 70. Measured by the SENTENCE
      before building rather than after (D137's lesson), the five whole-card
      forms are worth **36**.
      ⚠️ **THREE HOLES IN ONE CARD.** `TargetSpec.zones` had existed since the
      targeting work and was read by NOTHING — `TargetKind`'s own comment
      promised a narrowing that never happened. "from YOUR graveyard" was not
      read at all. And "creature card" sat in `unenforced`, the field
      `tier3.ts` prints as "the app will not check this".
      ⚠️ **`kinds` COULD NOT HAVE SAID IT** — in a graveyard every object is
      kind `card`, so "target creature card" and "target card" were the
      IDENTICAL spec. Fixed with a new field on both sides (`TargetSpec.cardTypes`,
      `TargetCandidate.types`), because the existing one was structurally
      incapable of carrying the answer.
      ⚠️ **THE TYPE ERROR FOUND BOTH ADAPTERS**, which is that file's whole
      design: a required `types` failed `tsc -b` in the host's three candidate
      builders and the client's. D53's shape holding — two producers, one
      predicate — and why there was no second copy to hunt for.
      ⚠️ The zone phrase is read in `readController`, BEFORE "you control",
      because a graveyard clause never says "control" and the plain reader would
      consume nothing. "a graveyard" stays `controller: null` — narrowing it to
      the caster would BLOCK a legal choice, the one direction `targetParse` may
      never be wrong in.
      ⚠️ **TWO EFFECT KINDS, NOT ONE WITH A FLAG.** A reanimated card becomes a
      PERMANENT, so it runs the whole entry funnel — loyalty counters (D107),
      enters-tapped (D134/D135), the pay-to-enter prompt (D136) — and none of
      that applies to a card going to a hand. The card goes to its OWNER, the
      permanent to the CASTER.
      ⚠️ **A `.+` IN THE PATTERN, CAUGHT BY ITS OWN TEST**: it swallowed
      "creature card WITH MANA VALUE 3 OR LESS", a restriction `TargetSpec` has
      no field for, so the spell would have reanimated anything at all. `GY_NOUN`
      is closed to the three nouns targeting can fully decide.
      ⚠️ **`moveTo` HARDCODES `from: battlefield`** — right for destroy/exile/
      bounce, wrong for a graveyard, and it left the card in BOTH zones.
      `assertInvariants` caught it by name.
      **Verified: 1,256 Vitest / 8 skipped across 61 files** (up from 1,245 / 8)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green at 510.75 s,
      byte-identical to D137's · `battery-anim.cjs bot engine` 102/102 ·
      `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults · probe
      124/124.** Fixtures 111 → 115; spells `auto` 344 → **364**, `assisted`
      1,564 → **1,610**; Tier-3 notes SHRANK (2,070 → 2,090 silent), which is the
      disclosure telling the truth for the first time in that direction.
      ⚠️⚠️ **AND A THIRD FALSE ALARM, CAUGHT THIS TIME BEFORE IT WAS REPORTED.**
      The gate took **860 s against its own 600 s timeout** on byte-identical
      games — which reads exactly like a 50% regression from the new
      per-candidate checks. It was not. Timed back to back at 60 seeds:
      **enforcement reverted 73.65 s, enforcement restored 69.83 s** — the
      restored run was FASTER. Overwatch was resident (14,701 s CPU) and my own
      Electron batteries were running concurrently with the gate;
      `battery-bot` reported **32 decisions/s against its usual 130**, which is
      the load showing up in a second instrument. D106 records this case,
      Overwatch included. **Never run the batteries and the 500-seed gate at the
      same time, and never read a wall-clock number from a loaded machine.**
      ⚠️ **Three reportables** (D138): `permanent card` is now the only common
      graveyard noun still `unenforced`, and giving it `cardTypes` is the
      cheapest follow-on; `TargetSpec` has NO NUMERIC RESTRICTION, so "with mana
      value 3 or less" (and every "with power N or less") is refused — one field
      plus one comparison would unlock the mana-value reanimators; and `look at
      the top N` (154 cards) still has half its machinery unused from D114.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,684.**

- [x] **M6.3l — The numeric restriction, and a cast the host took on trust
      (2026-08-01):** D138 called this one field plus one comparison. It is —
      **1,684 → 1,711 cards run completely (+27)** — and it turned up a second
      hole with nothing to do with numbers. Decisions in **D139**.
      ⚠️ **D138'S OWN REPORTABLE HAD THE MECHANISM WRONG, and the truth is
      worse.** It implied "with mana value 3 or less" sat in `unenforced` the way
      "creature card" did. Measured: **target specs whose `unenforced` names a
      numeric attribute — ZERO.** `Smite the Monstrous` parsed to
      `kinds:['creature'], confident:true, unenforced:[]`: the qualifier matched
      no noun entry, so it was **never recorded anywhere at all**. Not enforced,
      not disclaimed, not visible. The app would destroy a 1/1 with it, and
      `text` read "target creature" — the prompt bar quoting the player a rule
      the card does not have.
      **The closed vocabulary, shaped by what the database prints:** mana value
      504 lines / 490 cards · power 385 / 370 · toughness 33 / 33; `or less` 587
      · `or greater` 335. "converted mana cost" normalises to `manaValue`.
      ⚠️ **THE ORDER OF THE FIX IS THE FIX.** D138 refused to widen the effect
      vocabulary for this wording and was RIGHT: accepting the sentence while the
      restriction inside it went unchecked would have let a reanimation spell take
      anything. **Enforce first, admit the wording second** — the other way round
      is how a card that reads correctly runs incorrectly. Once `targetAllowed`
      checks it, one shared `QUALIFIER` widens both `TARGET` and `GY_NOUN`.
      ⚠️ **DERIVED, NOT PRINTED** (CR 613 settles characteristics before targeting
      legality): a pumped 2/2 really is a legal target for "power 4 or greater",
      and reading the printed value would REFUSE a legal choice. ⚠️ **A spell on
      the stack HAS a mana value** — 504 lines restrict on it (`Disdainful
      Stroke`) — where its power and toughness are genuinely absent. ⚠️ **And a
      missing number REFUSES**: the one place in `targets.ts` where absence
      narrows rather than widens, right because the spec is KNOWN.
      ⚠️ The qualifier is read in `readController`, which now **recurses** —
      "target creature with power 4 or greater YOU CONTROL" puts the number
      between the noun and the controller phrase, so a reader that looked for
      "you control" straight after the noun would drop BOTH.
      ⚠️⚠️ **THE SECOND HOLE: `CastSpell` WAS TAKEN AT ITS WORD.** `prepareCast`
      takes a `targets` list and uses it for exactly one thing — the ward
      surcharge — and **never calls `validateTargets`**. The two-stage path
      validates in `chooseTargets`; a cast that NAMED its own targets had no
      equivalent. Not reachable from this app's UI, but "the host decides
      legality" is what the whole net layer rests on (D53, D61, invariant 4), and
      a rule enforced only when the client asks nicely is not enforced. It is also
      the seam a test driver uses: D137's own test cast Mind Rot with an empty
      target list and the host allowed it. Closed, and that test retargeted.
      **Verified: 1,268 Vitest / 8 skipped across 62 files** (up from 1,256 / 8)
      **· `tsc -b` clean · build clean · the 500-seed fuzz gate green and
      byte-identical at 457.48 s · `battery-anim.cjs bot engine` 102/102 ·
      `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults at 135
      decisions/s · probe 124/124.** Fixtures 115 → 119; spells `auto` 364 →
      **394**, `assisted` 1,610 → **1,636**; `effect:auto` faces 2,067 →
      **2,170**; cards with no Tier-3 note 2,090 → **2,117**.
      ⚠️ **The gate ran 457 s here, 510 s for the identical games last time, and
      860 s for the run that triggered D138's phantom-slowdown hunt** — same
      machine, same work, three wall-clocks. A third data point for D106.
      ⚠️ **Two reportables** (D139): the restriction is read even where the EFFECT
      is not — `Eternal Isolation` stays Tier 3 but its aim veil is now honest,
      which is true for all ~890 cards carrying one of these phrases rather than
      only the 27 that became executable; and "with power N or less" on a clause
      that ALSO names a zone still loses the zone, because the graveyard branch of
      `readController` does not yet recurse the way the numeric one does.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,711.**

- [x] **M6.3m — Both qualifier readers now behave the same (2026-08-01):** a
      four-line symmetry fix, and the useful half is that **D139's reportable was
      wrong and measuring first is what caught it**. Decisions in **D140**.
      ⚠️ D139 said "a clause that names a zone AND a number loses the zone".
      Measured: the numeric branch it added RECURSES and is checked FIRST, so
      "with mana value 3 or less from your graveyard" already produced both. That
      reportable described a gap its own change had closed — written from reading
      the code instead of running it, the fourth claim this session to fail that
      way.
      ⚠️ **THE OTHER ORDER WAS GENUINELY BROKEN.** "target creature card IN YOUR
      GRAVEYARD with mana value 4 or less" read the zone and threw the number
      away, truncating `text` to match — the same silent widening D139 closed,
      surviving in the branch written first because the fix went to the new code
      and not to its neighbour. The graveyard branch RETURNED where the numeric
      one RECURSED.
      ⚠️ **ONE PRINTED CARD NEEDS IT** (`Too Evil to Stay Dead`) **and NO
      COVERAGE NUMBER MOVED** — it is a Teamwork sorcery with a conditional
      second target, far outside the effect vocabulary, so it stays Tier 3 and
      `complete` is unchanged at 1,711. What changed is its AIM VEIL. The
      justification is the asymmetry, not the card: two readers of the same kind
      of qualifier behaving differently is a bug waiting for the third one, and
      whichever branch it got written next to would have decided its behaviour.
      **Verified: 1,269 Vitest / 8 skipped across 62 files · `tsc -b` clean ·
      build clean · the 500-seed gate green and byte-identical for the fourth run
      running at 487.28 s.** Checked by reverting the recursion: exactly its own
      check fails and nothing else moves.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,711.**

- [x] **M6.3n — Look at the top N, and the sentence boundary that hid it
      (2026-08-01):** D137 called this half-built already. Right about the
      machinery, wrong about the hard part. **1,711 → 1,718 cards run completely
      (+7).** Decisions in **D141**.
      **The tenth split — 350 blocked cards:** trigger payload 149 · plain
      one-shot EFFECT 138 (97 whole-card) · activated 64. By destination: the
      BOTTOM 186 · bottom IN ANY ORDER 75 · the GRAVEYARD 54 · back in any order
      21. Only the plain effect resolves alone, and **only the destinations
      carrying no ORDER decision can be executed.**
      ⚠️ **TWO REFUSALS, TWO REASONS.** "In any order" (6 lines, `Dig Through
      Time`) is a SECOND decision the card gives the player and this offers only
      the first — executing it picks an order on their behalf. "In a random
      order" (2 lines) needs the seeded generator, which `effectEvents` does not
      have — D137's "discards at random", one card type along. Both are FIXTURES,
      so both refusals are real printings rather than assertions about strings.
      ⚠️ `the other` is admitted BECAUSE it is singular — one card left means no
      order to choose — and the build checks the arithmetic rather than being
      right by luck. A graveyard needs no qualifier at all, which is why it is
      the biggest form this takes.
      ⚠️⚠️ **THE SPLITTER RUNS BEFORE THE PARSER, AND THE FIRST CUT PARSED
      NOTHING.** `parseEffects` splits on the full stop and matches one rule per
      sentence; the card prints TWO sentences that are one effect, so a pattern
      spanning them could never match however it was written. `sentences()` now
      JOINS a `Look at the top N cards of your library.` head to what follows.
      ⚠️ **The join changes the CLAUSE COUNT, which is what decides `auto` versus
      `assisted`** — load-bearing in both directions: without it the card is two
      clauses of which zero are understood, and with a looser head it would glue
      an unrelated sentence on and turn an `assisted` card into a `manual` one.
      ⚠️ **THE PROMPT IS THE DISCARD PROMPT OVER A SECOND ZONE** and still ships
      no card ids: a library is hidden, and the client sees exactly what the rules
      revealed to it through `view.peek` (D114's one exception to "a library is a
      count"). The handler DERIVES the leftovers from the reveal, so the prompt
      carries only a count and a destination — putting the pool on it would post a
      library top to the wire (D61). The reveal is cleared on the answer.
      ⚠️ **ONE REAL BUG, CAUGHT BY ITS OWN TEST: the bottom is INDEX 0.**
      `addToZone` appends and `drawFromTop` takes from the end, so a move without
      `placement: 'bottom'` put the declined card straight back under the next
      draw — invisible to any test that only checked it had left the revealed set.
      ⚠️ **D137's pinned FIELD LIST failed the moment `rest` was added**, which is
      that check working: every new field on a prompt over a hidden zone gets
      looked at before it ships. `rest` is an enum naming a destination, so it
      cannot leak.
      **Verified: 1,280 Vitest / 8 skipped across 63 files** (up from 1,268 / 8)
      **· `tsc -b` clean · build clean · the 500-seed gate green and
      byte-identical for the FIFTH run running at 477.17 s · `battery-anim.cjs
      bot engine` 102/102 · `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0
      faults · probe 124/124.** Fixtures 119 → 123; spells `auto` 394 → **401**,
      `assisted` 1,636 → **1,641**; `effect:auto` faces 2,170 → **2,207**.
      ⚠️ **7 cards from a 350-card row — the fourth estimate to overshoot by two
      orders of magnitude**, and the reason is the same every time: a row counts
      cards CARRYING a clause, the sentence rules count cards whose WHOLE text is
      understood.
      ⚠️ **Three reportables** (D141): "in any order" is now the biggest single
      thing blocked here at **96 cards** and needs an ORDERING prompt, which would
      also serve CR 616's replacement ordering (unbuilt since D134); the trigger
      and activated halves are 213 cards needing card scripts, not a primitive;
      and `sentences()` now has a join list of ONE — past two or three entries the
      honest move is a two-pass parser rather than a widening list of heads.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,718.**

- [x] **M6.3o — The ordering prompt, and a "96 cards" that was four
      (2026-08-01):** D141 named "in any order" as the biggest thing left in its
      row at **96 cards**. Measured by SENTENCE before building — the eleventh
      split — it is **four**: `Impulse`, `Stock Up`, `Anticipate` (take M, order
      the rest to the bottom) and `Index` (order all N back on top). **1,718 →
      1,723 (+5).** Decisions in **D142**.
      ⚠️ **THE FIFTH ROW-LEVEL ESTIMATE TO OVERSHOOT BY TWO ORDERS OF MAGNITUDE**
      (D130, D137, D138, D141, this), and the cause is identical every time: a
      row counts cards CARRYING a clause; the sentence rules complete cards whose
      WHOLE text is understood. This is the first one where the corrected number
      was known BEFORE a line was written rather than after.
      Built anyway, and not for the four cards: **this is the prompt CR 616
      needs**, unbuilt since D134, and the shape every future "in any order" will
      use. The other 92 are trigger payloads needing card scripts (`Sage Owl` is
      8 lines / 6 whole on its own) or want the optional type-filtered reveal.
      ⚠️ **THE THIRD PROMPT IN A ROW THAT SHIPS NO CARD IDS** (D137's hand,
      D141's library, this). The client lists them from `view.peek`; putting them
      on the prompt would post a library top to every client (D61). Deliberately
      NOT `orderTriggers`, which DOES carry its list because the stack is public
      — same verb, opposite disclosure.
      ⚠️ **`Impulse` CHAINS TWO PROMPTS** — pick, then order — because they are
      separate decisions; the kept card moves as soon as it is chosen. `Index`
      skips the first: `take: 0` is a real printed form, not a degenerate case.
      And neither is raised when there is nothing to decide, since one card has
      one sequence.
      ⚠️ **THE BUG: BOTH ENDS REVERSE, AND ONLY ONE LOOKED LIKE IT.** The first
      cut reversed for the TOP only, reasoning about appending, and bottomed
      `Impulse`'s three cards in exactly the wrong order. Each placement puts the
      card it applies AT the named end — appending for the top, unshifting for the
      bottom — so the LAST card applied lands nearest it either way. Its own test
      caught it; nothing else would have, because the cards all arrive regardless.
      ⚠️ **`Dig Through Time` CHANGED SIDES** — D141 pinned it as a fixture that
      must be refused, and it is read now — while **`Drawn from Dreams` is still
      refused**: "in a RANDOM order" needs the seeded generator, and no prompt
      supplies one (D137).
      **Verified: 1,285 Vitest / 8 skipped across 63 files · `tsc -b` clean ·
      build clean · the 500-seed gate green and byte-identical for the SIXTH run
      running at 486.51 s · `battery-anim.cjs bot engine` 102/102 ·
      `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults · probe
      124/124.** Fixtures 123 → 125; spells `auto` 401 → **406**, `assisted`
      1,641 → **1,647**; `effect:auto` faces 2,207 → **2,240**.
      ⚠️⚠️ **THE UI IS PROMPT-BAR TEXT ONLY, and this is the first prompt in M6.3
      shipped without a working human control.** The bar says "click your N cards
      in the order you want them", and D114's peek panel lists them — but nothing
      records the click ORDER, so the prompt is answerable by the bot, the fuzzer
      and the net driver and NOT by a person at the table. Said plainly rather
      than left to be found by playing; it is the next thing to finish.
      ⚠️ **Two more reportables** (D142): CR 616's ordering now HAS its prompt and
      is still not built — D134 applies overlapping replacements in battlefield
      order and says it is not the player's choice, and this is the shape that
      choice needs; and `Sage Owl`'s 6 whole cards are one card script away, the
      effect being built already.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,723.**

- [x] **M6.3p — The ordering control, and a second prompt that had no control
      either (2026-08-01):** D142 shipped `orderCards` answerable by the bot, the
      fuzzer and the net driver but NOT by a person, and said so. This finishes
      it — and finding it found the same gap one prompt earlier. Decisions in
      **D143**.
      ⚠️ **D141's LIBRARY `chooseFromZone` HAD NO CONTROL EITHER, and that had
      not been noticed.** `useEngineTable`'s click branch checks
      `hand.includes(id)`, so clicking a peeked card did nothing; and the peek
      panel's own buttons (built for D114's Tier-3 tools) send `ManualMoveCard`,
      which under a live prompt BYPASSES the question the engine is waiting on
      AND writes a Tier-3 wrench for something the rules are doing.
      **The lesson is narrow and worth keeping: a prompt's ANSWERERS and its
      CONTROL are separate work, and "the driver can answer it" reads exactly
      like "it is finished".**
      ⚠️ **ONE CONTROL SERVES BOTH.** A live prompt takes the peek panel over —
      Tier-3 buttons go away, the card becomes clickable, clicking adds it to the
      answer. **Append, never toggle-into-a-set**: for a pick the sequence is
      incidental, for an ordering it IS the answer. `discardPick` is renamed
      `pickOrder`, which said "discard" while serving three prompts and "a set"
      while holding a sequence.
      ⚠️ **The badge is the POSITION, not a tick** — for an ordering the number is
      the whole answer. ⚠️ **No "Done" while a prompt is up**:
      `ManualStopPeeking` clears the reveal without answering, which is a wedge
      with a button on it. ⚠️ **And the bar names the right place** — D141's text
      said "in your HAND to discard" for a library peek, sending the player after
      a control that genuinely was not there.
      **Verified: 1,285 Vitest / 8 skipped across 63 files · `tsc -b` clean ·
      build clean · `battery-anim.cjs bot engine` 102/102 · probe 124/124.**
      ⚠️ **DRIVEN THROUGH THE REAL UI, AND THE ORDER IS CHECKED BY DRAWING.**
      `Index` revealed five, the panel counted "2/5 chosen" mid-pick, the fifth
      click submitted, and five draws came back in EXACTLY the clicked order —
      first-clicked drawn first. `Impulse` drove both stages, with the
      destination word changing from "top" to "bottom" between the two spells.
      ⚠️ **Two reportables** (D143): NO AUTOMATED CHECK COVERS THIS PANEL —
      `battery-anim.cjs`'s `engine` section drives real clicks and never opens a
      peek, which is how D142 shipped without a control and D141's went unnoticed
      for a slice; and `peekMode` is now half-dead, deciding only the Tier-3 copy
      while a prompt overrides both it and the buttons.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,723** (unchanged — this is a control,
      not a card).

- [x] **M6.3q — The check that would have caught two shipped gaps (2026-08-01):**
      D143's own reportable, closed. Six checks in `battery-anim.cjs engine`
      driving REAL CLICKS on the peek panel; the section is **91 → 97**.
      Decisions in **D144**.
      ⚠️ **THE ENGINE SEAM WAS NEVER THE PROBLEM.** `chooseFromZone` and
      `orderCards` both had unit tests and answers from the bot, the fuzzer and
      the net driver — and both were UNANSWERABLE BY A PERSON. From a suite that
      never clicks, that state is indistinguishable from finished.
      ⚠️ It SAVES ITS OWN DECK (`Index` is in no starter deck) and **deletes it
      in a `finally`, pass or fail** — D110's precedent for a block starting its
      own game, plus the cleanup rule, because a battery that leaves rubbish in
      the user's data directory is one people stop running.
      ⚠️ **THE ASSERTION THAT MATTERS IS THE DRAW ORDER.** Everything else is true
      whichever way round the sequence goes; only drawing the cards back proves
      the player's first click ended up on top.
      ⚠️ **VERIFIED BY BREAKING IT.** The card's `onClick` was removed — exactly
      the state D142 shipped — and three checks failed, the useful one reading
      `clicked c92,c85,c100,c88,c50 · drew c85,c88,c92,c50,c100`: the cards came
      back in LIBRARY order, which is what "the clicks did nothing" looks like
      from the other end.
      **Verified: `battery-anim.cjs bot engine` 108/108 · 1,285 Vitest / 8
      skipped across 63 files · `tsc -b` clean · build clean · probe 124/124.**
      ⚠️ It reports an honest SKIP for a shuffle that never deals an `Index`, but
      NOT for "panel never opened" — a skip that swallowed its own subject is
      D128's green-over-nothing.
      ⚠️ **Two reportables** (D144): D137's hand discard and D136's pay-to-enter
      are still uncovered here — both were driven by hand at the time, which is
      exactly what was true of the two this entry is about; and `peekMode`
      remains half-dead, now safe to collapse to a Tier-3-only concept.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,723** (unchanged — this is a check,
      not a card).

- [x] **M6.3r — The last two prompts get clicked, and two traps get encoded
      (2026-08-01):** D144's reportable, closed. D136's pay-to-enter and D137's
      hand discard were driven by hand when they shipped and covered by nothing
      since — the exact state the two prompts D144 wrote checks for had been in.
      Seven more checks; `engine` is **97 → 104**, `bot engine` **108 → 115**.
      Decisions in **D145**.
      ⚠️ **BOTH BRANCHES, IN TWO GAMES.** The shock land is paid for once and
      declined once, because a check that only paid would pass with the decline
      button wired to the same handler — the single most likely way this UI
      breaks. Proved by doing exactly that: rewiring decline to send `pay: true`
      fails `declining costs nothing and taps it` and nothing else moves.
      ⚠️ **TWO TRAPS THAT HAD ALREADY COST HOURS ARE NOW ENCODED.** (1) The
      discard prompt goes to the TARGET, so the caster's screen shows nothing to
      do — which sent D137's investigation into the engine for four hours on a
      working feature; the check drives both sides. (2) The click target is
      `[data-instance-id]`, NOT the `[data-hand-instance]` slot wrapper — a
      click on the parent fires nothing, and that was the other half of the same
      four hours.
      ⚠️ **AND A THIRD, FOUND WHILE WRITING IT: `startSolo` leaves the viewer
      wherever the turn order starts**, so p1's own hand comes back with
      `card: null` and a search by NAME through another seat's view reads as
      "the deck has no such card". It reported `no Godless Shrine reached hand`
      for a deck that was 20% Godless Shrine. `keep()` sets the viewer now.
      ⚠️ **The shock land is MOVED, not played** — a land drop needs it to be
      p1's turn, which `startSolo` does not guarantee, and moving it is the
      better test anyway: the prompt lives in `applyReplacements`, which D134 put
      there because TEN paths put a permanent onto the battlefield, so this proves
      the funnel catches one that is not the land drop.
      **Verified: `battery-anim.cjs bot engine` 115/115 · 1,285 Vitest / 8
      skipped across 63 files · `tsc -b` clean · build clean · probe 124/124.**
      Both blocks save their own decks and delete them in a `finally`, pass or
      fail — D144's rule, followed twice.
      ⚠️ **Two reportables** (D145): EVERY prompt built in M6.3 is now clicked by
      a machine except `optionalTrigger` (D128), which is unreachable in the
      shipped app at all (`host.ts` builds with `EMPTY_REGISTRY`) — that debt is
      the only one of its kind left, and these three blocks are the pattern to
      discharge it with; and the `engine` section is doing two jobs at 104 checks,
      worth splitting into its own prompt-UI section before the next slice.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,723** (unchanged — checks, not cards).

- [x] **M6.3s — The prompts get their own section, and the last unclickable prompt
      gets clicked (2026-08-02):** both of D145's reportables, closed in one pass.
      `engine` is **104 → 91** and a new `prompts` section holds **18**;
      `bot engine prompts` is **115 → 120**. Decisions in **D146**.
      ⚠️ **`optionalTrigger` WAS UNREACHABLE IN THE RUNNING APP, not merely
      uncovered.** It is raised only by a registered `TriggerDef` and `host.ts`
      built with `EMPTY_REGISTRY`, so no deck, no board and no sequence of clicks
      could produce it — D128's debt, open since. `HostOptions.scripts` is the
      seam: optional, defaulting to `EMPTY_REGISTRY`, passed by no screen, the
      same shape as `extraPool`. The battery passes the TEST registry through it
      and clicks the prompt.
      ⚠️ **NOTHING HERE SHIPS A CARD SCRIPT.** Landing scripts is still M6.4 and
      still owes the accounting this does not discharge: a card whose script runs
      must have its `tier3.ts` note go silent and `engineComplete` accept it, in
      the same commit. Deliberately NOT `options` — `GameOptions` is part of the
      state hash and a registry is a dependency.
      ⚠️⚠️ **THE VIEW-LAG TRAP COST THE FIRST TWO RUNS.**
      `window.__crt.engine.view()` lags the engine by one animation group (D137),
      and the group that STOPS the game is the last one — so with the bar reading
      "Ajani's Mantra — gain 1 life — this one is optional" and both buttons on
      screen, `view().awaiting` was `undefined` and stayed that way. The loop
      polled it and reported "the prompt never came up" about a prompt that was
      up, twice, including once after restarting vite on a stale-module-graph
      theory. **A lagging view catches up only while the game is FLOWING; at the
      moment it stops it stays wrong.** Detection is the DOM now, which is the
      better assertion anyway.
      ⚠️ **Both branches in ONE game** — the trigger fires every upkeep, so taking
      and declining are two turns rather than D145's two games, and **asking again
      next upkeep is itself an assertion**: a prompt answered once must not be
      spent. Nobody attacks, or p2's starter deck moves p1's life for reasons
      that have nothing to do with the trigger.
      ⚠️ **Split across several `js()` calls** because every CDP send has a hard
      30 s timeout and reaching the next upkeep is two turn cycles of real
      priority passing; one long expression reports a CDP timeout, which reads
      exactly like a wedged engine.
      **Verified: `battery-anim.cjs bot engine prompts` 120/120 · 1,285 Vitest /
      8 skipped across 63 files · `tsc -b` clean · build clean · probe 124/124.**
      Checked by breaking it: the decline button rewired to `accept: true` fails
      exactly `declining runs nothing at all — life +1` and nothing else moves.
      ⚠️ **EVERY PROMPT BUILT IN M6.3 IS NOW CLICKED BY A MACHINE** — all four of
      `optionalTrigger`, `entersChoice`, `chooseFromZone` and `orderCards`,
      through real clicks in a real Electron. **One reportable left from this arc:
      `peekMode` is still half-dead and safe to collapse to a Tier-3-only
      concept.**
      **M6.3 IN TOTAL: `complete` 1,405 → 1,723** (unchanged — checks, not cards).

- [x] **M6.3t — The pre-M6.4 list, worked (2026-08-02):** thirteen of the
      eighteen items on the "before M6.4" list, built and verified in one pass —
      three engine PRIMITIVES and ten correctness debts that had each been
      measured and left. Decisions in **D147**.
      ⚠️ **A TRIGGERED ABILITY CAN TARGET — 3,218 cards, the largest family
      measured in this arc.** `PendingTrigger` carried no targets, `TriggerDef`
      could not declare any, and `drainTriggers` built every stack object with
      `targets: []`. CR 603.3d: the object goes on the stack and the question is
      asked in one uninterruptible pass, so `resolve` — which already receives
      the `StackObject` — needed no change. CR 603.3d ALSO removes a trigger with
      no legal target, which is what stops the prompt being a wedge: a trigger has
      no `pendingCast` to cancel (D102's shape, prevented). CR 608.2b re-checks
      at resolution, against the DEF's specs — a permanent's printed `targets` is
      an empty list, so without that every restriction went unchecked.
      ⚠️ **A "DIES" TRIGGER CAN BE WRITTEN AT ALL (CR 603.10a).**
      `collectTriggers` took `before` and threw it away with `void before`, so a
      trigger on its own source's death was rejected twice — the zone check found
      it in a graveyard and `matches` got a board it had left. `looksBack` asks
      both of the old state, and **the flag has a break test in the suite**
      (D128's lesson: a flag nothing reads looks exactly like one that works).
      ⚠️ **COMBAT RESTRICTIONS HAVE A SEAM (227 cards).** D129 filed them under
      `layer6`; `canAttack`/`canBlock` consulted no static at all. `CombatDef` is
      deliberately NOT a layer — CR 613 settles CHARACTERISTICS and "can't block"
      is a rule about an ACTION. **Restrictions only**, measured 11:1 over
      requirements (1,138 "can't be blocked" · 393 "can't attack" · 320 "can't
      block" vs 123 "attacks if able" · 39 "must be blocked"), because a
      requirement is a property of the whole DECLARATION and cannot be checked one
      creature at a time. Asked LAST, so a script may only ever narrow.
      ⚠️ **`applyStatics` WAS O(N²) AND IS INDEXED** — D129 measured +64% with two
      statics and named this fix in its own comment. Same games, 60 seeds:
      **66 s / 59 s before, 42 s / 49 s after.** The index keeps BATTLEFIELD
      ORDER, which is CR 613.7c's timestamp and the whole of D129's fix.
      ⚠️⚠️ **310 CARDS WERE COUNTED AS MANA SOURCES FOR SOMEBODY ELSE'S ABILITY.**
      `parseManaProduction` never called `scrub`, so a Treasure's reminder text
      and any ability a card GRANTS in quotes read as its own. `strayMana`
      **310 → 0**. And the scrub exposed a deeper fault: `Braid of Fire`'s
      reminder says "unless you pay its upkeep cost", which was what marked the
      card conditional — remove the reminder and a cumulative upkeep started
      looking like a plain mana ability, with the disclosure going SILENT on it.
      The missing rule is CR 605.1a: **a mana ability is an ACTIVATED ability**,
      and the loop accepted a colon-less line. **Four real lands were offering
      mana they cannot make** — `Crumbling Vestige` and `Branch of Vitu-Ghazi`
      have their any-colour on a TRIGGER, `The World Tree` and `Riftstone Portal`
      GRANT it to other lands. `complete` **1,723 → 1,722**: `Glittermonger` was
      in the pool for a line it does not have.
      ⚠️ **THE WORLD RULE (CR 704.5m)**, found by D129 and unbuilt since. NOT a
      choice, unlike the legend rule beside it, and GLOBAL rather than
      per-controller.
      ⚠️ Nine smaller debts closed: `permanent card` enforced (unenforced specs
      **1,440 → 1,379**); `collectTriggers`'s per-loop `Object.keys` hoisted;
      **`botDeck.ts` got its regenerate-is-a-no-op guard AND FAILED IT
      IMMEDIATELY** — the committed deck had drifted, its header reading "722
      cards" against a live 742; `SHIPPED_SCRIPTS` is a named list with
      `shippedScripts.node.test.ts` enforcing the tier3/engineComplete accounting
      that had lived only in comments since D122, **with a teeth check over the
      TEST registry because the shipped list is empty**; `ManaChoice`'s "dashed
      mana is restricted" copy was wrong for three of its four cases; `peekMode`
      documented as Tier-3-only with `data-peek-mode` reporting `prompt`; and the
      entry rules read the card's own face — which changes nothing today because
      **an MDFC back face cannot reach the battlefield at all** (`castSpell` opens
      `const faceIndex = 0`), a bigger finding than D136's reportable.
      ⚠️ **AND RANDOMNESS IN `effectEvents` (the 14th item).** D137 refused "at
      random" with a REASON rather than a verdict — no RNG, and randomness here
      comes only from the seeded generator threaded through the log.
      `effectResult` returns the advanced generator beside its events, so
      `Hymn to Tourach` **changed sides** the way `Dig Through Time` did in D142:
      a refusal whose stated reason has been removed is not a rule. TWO entry
      points rather than one changed signature, because the RNG advances ONLY
      through a recorded `rngAfter` — a caller that dropped it would **replay to
      a different board than it played**, silently, and only for the cards that
      use randomness. The MANUAL path is threaded too, and it is the one that
      would have been missed: a card with an at-random clause AND an unread one
      is ASSISTED, so it arrives there rather than resolving alone. `complete`
      **1,722 → 1,725**; spells `auto` **406 → 409**.
      ⚠️ **AND THE CHOSEN COLOUR (the 15th item, CR 614.12).** D136 measured
      the "As this ~ enters, choose …" family at 162 cards and said the FIELD is
      the primitive, not the question — and that is exactly why only ONE of its
      three shapes is built. Measured: colour 52 · creature type 58 · opponent 12,
      and **almost none of them is the whole card** — the choice is always
      consumed by a later line. The COLOUR has a consumer the engine already has
      (`{T}: Add one mana of the chosen color`, which `parseManaProduction` has
      modelled as an `anyColor` scope since M1), so `chosen` is a fourth scope
      beside `identity` and `landsYou` — a set of one that lives on the permanent
      rather than the board. **`Sol Grail` is the whole card in two lines, with
      no card script anywhere.** Creature type and opponent are REFUSED: their
      consumers need M6.4, so asking today would store an answer nothing reads.
      `chosenColor`, not a general `chosen`, because a field with two members
      nothing populates is the same theatre with a wider type.
      ⚠️ **THE ONLY PROMPT IN M6.3 WHOSE ANSWER IS A FACT RATHER THAN AN ACTION** —
      remembered on the object, so it is in the state hash and on the log. Before
      it is answered the source offers NOTHING: not "any colour", not colourless,
      because five options would be the engine making the player's choice.
      `complete` **1,725 → 1,730**, and **`Coldsteel Heart` joined the BOT's
      deck**. D125's producer map caught the new kind on the first `tsc -b`, by
      name, in three files at once.
      **Verified: 65 test files, 1,317 Vitest / 9 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 323.8 s with SIX scripts
      registered (four before) · `battery-anim.cjs bot engine prompts` 120/120 ·
      `battery-bot.cjs --games 40` 7/7 · probe 124/124.** Fixtures 125 → 128.
      Two new fuzz canaries, both chosen because they cannot go green on
      somebody else's work.
      ⚠️ The `prompt(` grep caught a test helper named `prompt` for the SECOND
      time (D144 records the first). Renamed the helper, not the check.
      ⚠️ **THREE ITEMS NOT BUILT, each with a reason rather than a shrug** (D147):
      **CR 616's ordering needs a RESUMABLE FOLD** — `applyReplacements` is pure
      `(state, events) => events`, and D136's apply-then-ask is unavailable
      because the ORDER changes the outcome, so it means a continuation in
      `GameState`; **CR 613.8
      dependency** and removing a NON-KEYWORD ability (`MutableCharacteristics`
      models keywords, so `Humility` is unrepresentable); and the **two-pass parser
      is deferred ON PURPOSE** — D141 said "past two or three entries" and
      `sentences()`'s join list still has ONE.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** — and it went DOWN by one on
      the way (`Glittermonger`, which was never really there) before the
      at-random discard put three back and the chosen colour five more.

- [x] **M6.3u — CR 616, with the continuation (2026-08-02):** the last of the
      three architectural items D147 named, and the only one whose stated reason
      was "this needs a continuation in `GameState`". It has one. Decisions in
      **D148**.
      ⚠️ **IT WAS NEVER ON D127's LIST** — M6.3's build order measured seven
      primitives by cards-waiting; this came out of D134's bucket split as a
      reportable and was re-named as unbuilt by D142 and D147.
      ⚠️ **THE TRICK THAT WORKED TWICE DOES NOT WORK HERE.** D136 and D147 both
      prompt from inside the replacement funnel by letting the event happen and
      asking afterwards. Unavailable when the ORDER changes the outcome:
      `Hardened Scales` before `Branching Evolution` turns two counters into
      SIX, the other way FIVE. So the event is HELD, unapplied, and
      `applyReplacements`'s purity is bought back by moving the state into
      `GameState`.
      ⚠️ **THREE QUEUES, BECAUSE THE PIPELINE HAS THREE STAGES**, and collapsing
      any two is wrong invisibly: `siblings` shares CR 614.5's `used` (every
      level of one event's fan-out is still that event, which is why no stack of
      frames is needed), `rest` is this body's remaining built-in output with a
      fresh `used`, and `queued` is the raw rest of the batch — kept apart
      because **the built-ins are NOT idempotent**: re-running
      `withEntryCounters` over a `CardsMoved` it has seen adds a planeswalker's
      loyalty twice.
      ⚠️ `applyReplacements` is now the BUILT-INS AND NOTHING ELSE; card scripts
      moved to `runReplacementFunnel`, because a function returning
      `EventBody[]` has nowhere to put a question. **`Accept.funnelled`** is the
      one flag on the one path that needs it — without it the resumed events go
      through the funnel again, which the first test run reported as **"the
      ordering prompt never cleared"**.
      ⚠️ **TWO TESTS CHANGED SIDES** (D142's `Dig Through Time`, D147's
      `Hymn to Tourach`, now these): they asserted BATTLEFIELD ORDER — D134's
      deterministic fallback, shipped while saying plainly it was not the rule —
      and now assert that the PLAYER's answer decides it and that **both outcomes
      are reachable from one board**. ⚠️ The first cut of that test **silently
      fell back to battlefield order**, because it looked the option up by CARD
      NAME and `Hardened Scales` does not contain its own name in its own text;
      the label is the ability's PRINTED TEXT.
      ⚠️ **THE FUZZ GATE CANNOT REACH IT, MEASURED: 500 seeds, ZERO
      suspensions** — two replacements on one event needs both one-of
      enchantments plus a counter, three specific cards inside 200 random
      intents. The counter stays at `>= 0` with the number written down (D137's
      precedent). **The coverage is `battery-anim.cjs prompts` and it is
      stronger**: real clicks, both orders, two games, 6 one way and 5 the other
      — running at all because of the `HostOptions.scripts` seam D146 built.
      `prompts` 19 → 22, `bot engine prompts` **120 → 123**.
      ⚠️ **The battery's first run read 0 and it was the CHECK, not the engine**:
      `put()` submitted the move and slept, so the counter was set while the
      Grizzly Bears was still in HAND — the prompt still appeared (both
      replacements match on the CONTROLLER, not the zone) and
      `clearBattlefieldFields` wiped the counters as the card entered. It waits
      for `bf:p1` now.
      **Verified: 65 test files, 1,318 Vitest / 9 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 324.6 s · `battery-anim.cjs
      bot engine prompts` 123/123 · `battery-bot.cjs --games 40` 7/7 · probe
      124/124.** The gate matters beyond the canary: `pendingReplacement` is in
      the state hash and `ReplacementPending` is on the log, so a held event that
      replayed differently would show as a mismatch across 500 seeds.
      ⚠️ D125's producer map caught the new kind on the first `tsc -b`, by name,
      in three files at once. **Eighteen `Awaiting` kinds, sixteen with
      producers.**
      ⚠️ **`complete` DID NOT MOVE, and that is correct** — this is a rules
      primitive with no parser behind it. It makes a class of card SCRIPTABLE
      that could not be written before; scripts are M6.4.
      ⚠️ **TWO ITEMS LEFT on the pre-M6.4 list**: CR 613.8 dependency (and
      removing a non-keyword ability, which `MutableCharacteristics` cannot
      represent), and the two-pass parser — deferred by its own criterion, since
      `sentences()`'s join list still has ONE entry.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** (unchanged by this — a
      primitive, not a card).

- [x] **M6.3v — CR 613.8, and a correction (2026-08-02):** dependency in the
      layer system, and the second-to-last item on the pre-M6.4 list. Decisions
      in **D149**.
      ⚠️⚠️ **FIRST, THE CORRECTION: D148's "500 seeds, ZERO suspensions" WAS
      MEASURED ON A DECK WITHOUT THE CARDS.** The patch meant to add
      `Hardened Scales` and `Branching Evolution` to the fuzz `DECK` aborted on
      an unrelated MISS and wrote nothing, while a separate edit did register
      both SCRIPTS — so the gate ran with two replacement effects registered and
      no way to draw either. **With both dealt: 5 suspensions across 500 seeds.**
      The canary asserts it AT THE GATE SIZE ONLY, with the rate written beside
      it, because `> 0` at the 60-seed default is a coin flip and failed the
      first full run after it was switched on.
      ⚠️ The lesson is the PATCH SCRIPT: one that reports MISSES and exits
      without writing leaves the tree in a state where a later successful edit
      makes it look like everything landed.
      ⚠️ **THE REAL PAIR, and neither card shows the rule alone:** `Knighthood`
      ("Creatures you control have first strike") and `Kwende, Pride of Femeref`
      ("Creatures you control with first strike have double strike"), both layer
      6, both single-sentence. **Kwende READS A KEYWORD THAT KNIGHTHOOD GRANTS**,
      so which applies first decides whether Kwende applies AT ALL — in plain
      timestamp order with Kwende first, a vanilla creature ends with first
      strike and NO double strike, the card doing nothing silently on a board
      where it plainly should. Found by measuring what the format prints: 20
      lines scope a static on `with flying`, one each on vigilance, first strike,
      menace, defender and trample — and first strike is the only one whose
      partner is also a whole card in one line.
      ⚠️ **WHAT IS BUILT is 613.8a clause (b)'s first half — "what it applies
      to", for the object being derived** — which this engine can answer exactly:
      `appliesTo` is a predicate over `chars`, so "would B change A's answer" is
      one clone and one call. **NOT built: "the text or the EXISTENCE of the
      first effect"**, which needs an effect that removes another script's
      static; `MutableCharacteristics` models KEYWORDS, so `Humility` stays
      unrepresentable rather than merely unwritten (D129, D147, still true).
      ⚠️ **Clause (c) is satisfied BY CONSTRUCTION** — this runs within ONE layer
      and `'cda'` is its own layer, so the two effects are always both CDAs or
      neither. ⚠️ **613.8b's LOOP is handled**: when every remaining effect
      depends on another the rule stops applying and timestamp order resumes,
      which is also what makes it terminate. ⚠️ Timestamp is the SCAN order, so
      D129's fix stays the tie-break.
      ⚠️ **THE `printed()` GUARD EARNED ITS KEEP.** Kwende HAS double strike
      himself, so his text is TWO lines and the first is a keyword the engine
      already enforces; the guard threw on the first run with the real text in
      the message. The static claims the second line, `keywords` covers the
      first, and the whole card is accounted for between them.
      **Verified: 65 test files, 1,322 Vitest / 9 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 384.6 s ·
      `battery-anim.cjs bot engine prompts` 123/123 · probe 124/124.** Fixtures
      129 → 131.
      ⚠️ **Checked by breaking it, and the break test is IN the suite**: with
      `dependencyOrder` disabled exactly one check fails, naming the order —
      `double strike with Kwende, Pride of Femeref then Knighthood: expected
      false to be true`. The suite also asserts the WRONG answer explicitly
      (Kwende alone grants nothing), because a test of only the happy order would
      pass with the dependency code deleted.
      ⚠️ A 729 s run of the same gate FAILED on its own 600 s timeout and was NOT
      a regression — the only difference from the 394 s passing run before it was
      a `writeFileSync`. D106's signature, third time this session.
      ⚠️ **ONE ITEM LEFT on the pre-M6.4 list**, deferred by its own criterion:
      the two-pass parser. D141 said `sentences()`'s join list should become one
      "past two or three entries"; it still has ONE.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** (unchanged by this — a
      primitive, not a card).

- [x] **M6.3w — The two-pass effect parser, and the list is closed
      (2026-08-02):** the last of the eighteen pre-M6.4 items. Decisions in
      **D150**.
      ⚠️ **BUILT AT ONE ENTRY, ON REQUEST, AGAINST ITS OWN CRITERION** — D141
      said `sentences()`'s join list should become a two-pass parser "past two or
      three entries" and it never got a second one; D147 and D149 both deferred
      it for exactly that reason.
      ⚠️ **SO THE BAR IS THE REFACTOR BAR, AND IT IS MET: every pinned coverage
      number over the 31,692-card database is BYTE-IDENTICAL.** `auto` 409,
      `assisted` 1,650, `effect:auto` 2,263, `complete` 1,730, all fifteen of
      tier3's figures, the bot pool by type, the primitives ladder. A refactor
      with no card-count payoff has one honest success criterion and that is it —
      D123's "regenerating would be a no-op", applied to a parser.
      ⚠️ **THE PROPERTY THAT MAKES IT SAFE WAS ALREADY THERE: every rule is
      ANCHORED AT BOTH ENDS** (D90, so a prefix could never "understand"
      `Homing Lightning`). A one-sentence rule therefore CANNOT match a
      two-sentence window — so pass two can try wider windows first at no risk,
      and a rule wanting two sentences just writes a pattern spanning the full
      stop. **No head list, no per-rule declaration.** D141's constraint — "the
      splitter runs first, so a rule spanning the full stop could never match" —
      is what has gone away.
      ⚠️ The clause COUNT still comes from the same place as the numerator
      (`understood < clauses.length` decides `auto` vs `assisted`, and a joined
      pair is ONE clause), which is why pass two returns the groups rather than a
      flat sentence list. `MAX_SPAN` is a bound on the WINDOW, not a list of what
      may be joined: raising it needs no other change anywhere.
      ⚠️ **One real behavioural improvement, small and correct:** a window that
      matches nothing at any width leaves its FIRST sentence unmatched and
      advances by ONE, so the next sentence still gets its own chance. The join
      list consumed the pair unconditionally, so a head followed by an unreadable
      tail took the tail down with it.
      **Verified: 66 test files, 1,329 Vitest / 9 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 366.5 s ·
      `battery-anim.cjs bot engine prompts` 123/123 · `battery-bot.cjs --games
      40` 7/7 · probe 124/124.** Checked by breaking it: with the window pinned to
      one sentence exactly one check fails — `a rule written across a full stop
      still matches: expected 'manual' to be 'auto'` — and nothing else moves,
      which is also the proof that the window is all the rewrite added.
      ⚠️ **THE PRE-M6.4 LIST IS CLOSED.** All eighteen items are built or
      deliberately unbuilt with a stated reason: fifteen in D147, then CR 616
      (D148), CR 613.8 (D149) and this. What stays unrepresentable is named and
      unchanged — removing a NON-KEYWORD ability, because
      `MutableCharacteristics` models keywords, so `Humility` cannot be written
      rather than merely not having been.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** (unchanged by this — for a
      parser refactor that is the point rather than a disappointment).

- [x] **M6.3x — Losing a NON-KEYWORD ability (2026-08-03):** the thing five
      entries in a row named as unrepresentable — D129 found it, and D147, D148,
      D149 and D150 each closed by repeating it. Decisions in **D151**.
      ⚠️ **WHY IT WAS UNREPRESENTABLE:** keywords are a `Set` on the derived
      characteristics, and **every other ability — triggered, static,
      replacement, combat, activated — lives in the SCRIPT REGISTRY keyed by
      `oracleId`**, where no characteristic can reach it. So
      `chars.keywords.clear()` silences a creature's flying and leaves its ETB
      trigger, its mana ability and its "can't block" restriction running.
      ⚠️ **A FLAG, NOT A LIST — `chars.hasAbilities`** — because that is what the
      rule says: not "remove these abilities" but "have none". **`finish()` is
      the ONE place that turns it into consequences**, so a script never has to
      remember them: `keywords`, `protection` and `landwalk` (read by
      `canBlock`), `toxicAmount` (combat damage) and `producesMana` (the payment
      solver). Clearing only the keyword set leaves a Humility'd Akroma
      unblockable by red and a Humility'd Llanowar Elves tapping for green.
      ⚠️ **AND FOUR CONSULT SITES, because a source with no abilities is not a
      source** — trigger bus, static index, replacement funnel, combat seam —
      plus `legalActions`, which is the least obvious: the activated list comes
      off the ORACLE face, not the derived object, so without it a silenced
      permanent still offers every ability it prints.
      ⚠️ **TYPESCRIPT NAMED EVERY CONSTRUCTION SITE.** A required field failed
      `tsc -b` at all four places `MutableCharacteristics` is built, including
      the face-down 2/2 (CR 708.2) and the unknown-printing blank — which is the
      argument for required over optional: four defaults decided deliberately
      rather than inherited from `undefined`.
      ⚠️ **THE RECURSION GUARD:** asking "has this source lost its abilities"
      means deriving it, and deriving it runs the pass that asks — so **an
      ability-removal source is exempt from ability removal**, which breaks the
      loop by construction. Right for every printed card (`Humility` is an
      enchantment and never silences itself; two do not silence each other — both
      asserted). The case it cannot answer needs a layer-4 type change
      (`Opalescence`), modelled here only through the Tier-3 override.
      ⚠️ Proved on **`Humility`** itself, one line and therefore every word (D90)
      — **TWO STATICS BECAUSE IT IS TWO LAYERS**, 6 and 7b, which CR applies in
      that order however the sentence reads.
      **Verified: 66 test files, 1,336 Vitest / 9 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 432.8 s ·
      `battery-anim.cjs bot engine prompts` 123/123 · `battery-bot.cjs --games
      40` 7/7 · probe 124/124.** Fixtures 131 → 132.
      ⚠️ **Checked by breaking it, and FOUR checks fail — one per consequence**
      (`expected 5 to be +0` for keywords, `[ 'B', 'R' ]` for protection, the
      mana list, the registry ability). A single check would have passed with
      three of the five fields still leaking.
      ⚠️ A battery run showed three failures that did NOT reproduce — re-run
      123/123, all three rendered-slot and settle-state checks (the class D110
      and D115 record as load-sensitive), on a machine that had just finished a
      432 s fuzz gate. D106's signature, fourth time this session.
      ⚠️ **`complete` did not move**, expected for a rules primitive with no
      parser behind it. **AND THE LAST NAMED IMPOSSIBILITY IS GONE** — nothing in
      the layer system is now described as unrepresentable. What is left is
      ordinary work with a stated shape: CR 613.8's "what it DOES to the things
      it applies to", 613.7d/e's re-timestamping, and the dependency case needing
      layer-4 type changing.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730.**

- [x] **M6.3y — CR 613.8a clause (b), second half (2026-08-03):** D149 built
      "what it applies to" and named "what it DOES" as unbuilt. This is it, and
      the useful half is that **the obvious implementation is WRONG and was
      measured wrong rather than reasoned wrong**. Decisions in **D152**.
      ⚠️⚠️ **THE NAIVE READING BREAKS A CORRECT BEHAVIOUR.** Implemented as
      "A depends on B if applying B changes A's OUTPUT" — clone, apply B, apply A
      to both, compare deltas — the layer test failed two checks by name:
      `Levitation last — flying: expected false to be true`. `Gravity Sphere`
      ("all creatures lose flying") came out DEPENDING on `Levitation`, because
      without Levitation there is no flying to remove and with it there is. So
      Levitation applied first every time and the creature **never flew even when
      Levitation entered LAST** — the wrong MTG answer, breaking D129's timestamp
      pair.
      ⚠️ **ACTING ON A DIFFERENT STARTING STATE IS ORDERING, NOT DEPENDENCY.**
      Clause (b) is about the effect's own SPECIFICATION changing — "gains all
      abilities of that creature" does something different when that creature's
      abilities change; "loses flying" always does the same thing and only the
      board differs. **Nothing but the def can tell those apart**, because the
      difference is in what the sentence MEANS, not in what the function computes.
      ⚠️ So the def DECLARES it: `StaticDef.effectReads`. Opt-in, so the rule
      cannot fire where it would be wrong, and every existing script omits it and
      is unaffected. Compared BY VALUE, or every declared reader would depend on
      everything.
      ⚠️ **NO REAL CARD IN THIS VOCABULARY NEEDS IT, and that is stated rather
      than hidden**: every script in `cardScripts.ts` is a constant delta. The
      shape that needs it is "gains all abilities of target creature" — copy
      machinery (CR 707), which is M6.4. The mechanism is proved with a DECLARED
      reader built from the real `Knighthood` grant, with the undeclared negative
      asserted beside it.
      ⚠️ The reader is registered FIRST and enters the battlefield FIRST, so both
      registration and timestamp order would run it before the granter — a test
      where it happened to be last would pass with the mechanism deleted.
      **Verified: 66 test files, 1,338 Vitest / 9 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 453.0 s ·
      `battery-anim.cjs bot engine prompts` 123/123 · probe 124/124.**
      ⚠️ **WHAT IS LEFT OF CR 613 IS THREE NAMED, ORDINARY ITEMS — no
      impossibilities**: 613.7d/e's re-timestamping, the dependency case needing
      layer-4 type changing (`Opalescence` making an enchantment a creature so
      `Humility` can reach it), and the copy machinery that would give
      `effectReads` its first real card.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** (unchanged — a primitive, not
      a card; the fourth in a row).

- [x] **M6.3z — The BUILT set, re-measured (2026-08-03):** asked whether M6.3
      was finished, and the honest answer needed the primitives report to be
      true. It was not. Decisions in **D153**.
      ⚠️⚠️ **`optional` WAS TESTED BEFORE `expressible`, SO IT SWALLOWED
      EVERYTHING.** `primitiveFor` asked "does this line contain *you may*" ahead
      of the vocabulary check and every rule below it. Measured: of the **4,549
      lines** it caught that way, **169 — 3.7% — needed nothing but the yes/no**.
      The rest were lines like "you may search your library for a basic land
      card", whose library search was counted NOWHERE.
      ⚠️ **A PRE-FILTER DEFEATS `unlockedBy`**, which requires EVERY line of a
      card to be covered — D90's rule applied to a roadmap. `optional` is IN
      `BUILT`, so all 4,380 misfiled lines were counted as already handled: the
      report claimed **3,463** scriptable cards where the honest figure is
      **1,362**, an inflation of 2,101 live from D128 to now.
      ⚠️ **AND IT MOVED THE BUILD ORDER THIS FILE EXISTS TO DECIDE.** `optional`
      led D127's table at 2,012 by sole need — the headline that made it M6.3's
      first primitive. It is **96, the second SMALLEST row.** Building it first
      did no harm, and that is luck: the flag existed since M3 and the work was
      one prompt.
      ⚠️ The headline ladder is **10.4× → 9.8× → 5.1×** (1,263 → 6,386). Two
      causes, told apart: executing a primitive shrinks the pool, **and the rest
      of it was never there**. A falling total is the measurement working in BOTH
      directions.
      ⚠️⚠️ **MOST ROWS CAN NEVER BE TICKED, AND THAT IS STRUCTURAL** — now written
      where `BUILT` is defined. `expressible` runs BEFORE every rule, so a line
      in a row is by definition one the vocabulary could not read, and widening
      the vocabulary DRAINS the row instead of qualifying it. Pinned twice
      already as a fall: `effect:counter` 1,441 → 1,364 (D130), `effect:token`
      1,123 → 812 (D133). Only rows `parseEffects` cannot drain — `layer6`,
      `optional`, `keyword:*`, `costMod`, `replacement` — can ever be ticked.
      ⚠️ **`layer6` STAYS OUT AND D129's REASON IS NOW THE WRONG ONE**: it
      excluded the row over 227 combat RESTRICTIONS with no seam, and **D147 built
      that seam** — only 2 of its 689 restriction lines are still beyond the
      engine. The live reason: **1,855 of the row's 4,676 lines are grants that
      END**, and `GameState.untilEndOfTurn` carries POWER AND TOUGHNESS AND
      NOTHING ELSE — there is no temporary keyword grant in this engine at all.
      **958 of the 1,791 sole-need cards carry one**, asserted in the split test
      rather than written in a comment, because D129's reason lived in a comment
      and stayed there for twenty-four decisions after it stopped being true.
      **Verified: 66 test files, 1,341 Vitest / 9 skipped · `tsc -b` clean ·
      build clean.** ⚠️ **Checked by breaking it, and the break is unusually good
      evidence**: with the pre-filter put back, seven checks fail and **every one
      reproduces its OLD pinned number byte-for-byte** — `[1263, 3463, 5509,
      7302, 8432]`, `grant: 1119`, `spell: 313`. A pure reclassification, decided
      by one branch.
      ⚠️ **The engine gates were NOT re-run and that is safe**: `primitives.ts` is
      imported by two TEST files and nothing else — not by `src/engine/`,
      `src/bot/`, `src/ui/`, `electron/` or any script, and it is not in the
      bundle. D131's precedent.
      ⚠️ `tokenParse.node.test.ts` moved for the same reason seen from the other
      side (812 → 915 cards), and **the resolver did not change: 258/280 against
      225/244, 92.1% against 92.2%.**
      ⚠️⚠️ **AND THE INTEGRITY CHECK FOUND THE SAME CORRUPTION TWICE MORE, ONE
      OF IT ARCHITECTURAL.** A control-character scan over the whole repo found
      two files carrying literal BACKSPACE (0x08) where `\b` was meant —
      **D129's patch-script bug, which fixed the lines it noticed and never
      swept.** (1) `primitives.node.test.ts`'s `isLand` matched nothing, so
      `isLand` was FALSE for every card and the "tapped LANDS" figure printed 0;
      now `/\bLand\b/` and **asserted at 16**, because it was printed and never
      asserted — the same failure as `BUILT`, one file over. (2)
      **`src/engine/purity.node.test.ts` — THREE of them**: `new WebSocket`,
      `document.` and `window.`, the entire socket-and-DOM half of invariant 7.
      **Three architectural guards passing over nothing.**
      ⚠️ **INVISIBLE BY CONSTRUCTION** — a backspace renders as nothing, so the
      source reads correctly every time anyone looks at it. Only a scan for the
      character code finds it, and the only other hit in the repo is a form feed
      in Chromium's vendored LICENSES file.
      ⚠️ Repairing the regexes caught a failure immediately and it was in the
      CHECK: it read the RAW file, so `protocol.ts` explaining a "5-minute grace
      window." in prose registered as touching `window`. `stripComments` sits
      three screens up in the same file saying it is "what keeps the test about
      code rather than prose" — applied to the engine's checks, never to the net
      layer's. Both halves had to be wrong for the guard to be silent.
      ⚠️ **THE GOOD NEWS IS MEASURED: repaired and comment-stripped, all 103
      purity checks pass** — nothing had crept past while they were blind. And it
      discriminates: `window.location` appended to `protocol.ts` fails by name,
      and the file was put back by string surgery, never `git restore`.
      ⚠️ **Reportable:** the residue is at **49.5% against a 0.5 bar**, and
      `unclassified` at **7,779** by sole need is now the largest row by a factor
      of four — the honest next measurement. ⚠️ **AND A CONTROL-CHARACTER SCAN
      BELONGS IN THE GATES** rather than in a session's memory: three corrupted
      regexes across two files survived twenty-four decisions and one of them was
      an architectural invariant.
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** (unchanged — a measurement, not
      a primitive; the fifth in a row).

- [x] **M6.3aa — The control-character scan, in the gates (2026-08-03):** D153's
      closing reportable, built. `src/sourceIntegrity.node.test.ts` reads every
      text file in the repo and fails on any control character that is not tab,
      newline or carriage return. Decisions in **D154**, and it is **invariant 14**
      at the foot of this file.
      ⚠️ **INVISIBLE BY CONSTRUCTION IS THE WHOLE ARGUMENT.** A backspace renders
      as nothing, so the three corrupted regexes D153 found read correctly in an
      editor, a diff, a review and every tool that printed those files — including
      during the sessions that fixed neighbouring lines. A person being careful is
      not a control here.
      ⚠️ **It scans TEST files, deliberately** — the opposite of
      `purity.node.test.ts` two directories over, and measured rather than
      stylistic: all three instances were in tests, because a corrupt regex in
      product code fails loudly the first time it runs while a corrupt one in an
      ASSERTION just quietly stops asserting.
      ⚠️ `.electron-dist/` is excluded as a vendored Chromium tree whose LICENSES
      file legitimately carries a form feed — **the only other hit in the whole
      repository**, so it is one directory rather than a growing allowlist.
      ⚠️ **The failure says what to TYPE**: `file:line`, the hex code, and the
      escape it was meant to be, with `\b` named as "a REGEX WORD BOUNDARY, and
      the one that has bitten this repo three times" — plus the cause (a patch
      script through a shell heredoc) and the fix (write the script to a FILE).
      ⚠️ **The file that scans for control characters must not contain one, and it
      runs over itself** — its table is built with `String.fromCharCode(92)`.
      **Verified: 67 test files, 1,344 Vitest / 9 skipped** (up from 66 / 1,341,
      so it is in `npm run test` and therefore in every gate run rather than in a
      session's memory) **· `tsc -b` clean.**
      ⚠️ **A canary AND teeth**, because this is exactly the check that passes
      over nothing: a file-count canary above 100, and `offendingCodes` asserted
      in BOTH directions — it flags backspace, null, vertical tab, form feed and
      DEL, and leaves tab, CR and LF alone.
      ⚠️ **Checked end to end by planting a real one**: `src/zz_break.ts` holding
      the exact corruption from `primitives.node.test.ts` fails with
      `src\zz_break.ts:1 — 0x08 (meant: \b …)`. Removed with `unlink`, never
      `git restore`.
      ⚠️ Cost: the full suite ran 76.6 s against 73–83 s across the session's
      other runs — inside the noise (D106).
      **M6.3 IN TOTAL: `complete` 1,405 → 1,730** (unchanged — a gate, not a card).


### Before M6.4

- [x] **The pre-M6.4 list, worked (2026-08-05):** thirteen items, all closed.
      Decisions in **D155**, **D156** and **D157**.
      ⚠️⚠️ **THE MODAL DFC BACK FACE — Tier 1, in the shipped app (D155).**
      `castSpell` opened with `const faceIndex = 0` and `playLand` read
      `faceOf(oracleCard, 0)`, while `legalActions` had been OFFERING every
      castable face since M3 — so the back face of all **98** Commander-legal
      modal DFCs was listed, clickable and played as the FRONT face. The UI half
      is bigger: the click path took `legal.find(…)`, the first match, so the
      second half of **123 split cards and 134 adventures** went with it. **355
      cards with a half nobody could play.**
      ⚠️ It silently disabled three rules that were built, tested and shipped —
      D134’s "enters tapped", D135’s conditions and D136’s pay-to-enter prompt all
      read the entering card’s face, and no back face could reach any of them.
      ⚠️ The face rides on the `CardMove`, not on a separate event, and the
      FUNNEL forces that: `runReplacementFunnel` reads the state BEFORE the batch,
      so an earlier `FaceIndexSet` is invisible to it and a later one is too late.
      ⚠️ **THE FIXTURE POOL HAD NO `modal_dfc` AT ALL** — fifth time a fixture
      unable to reach a path is how the path rotted. Three real cards added; and
      a FACE CHOOSER, because the engine taking a face is not the feature (D143).
      ⚠️⚠️ **`EMPTY_REGISTRY` WAS A TRAP WITH A FUSE ON IT (D156)** — built from
      `SHIPPED_SCRIPTS`, so the constant named "empty" stops being empty the
      moment M6.4 lands anything, across **45 references in 20 files** meaning two
      different things. Split into `SHIPPED_REGISTRY` and `NO_SCRIPTS`. A real
      bug fell out: D135’s board queries derived with NO scripts, which is wrong
      the moment a static changes a type.
      ⚠️ **THE FUZZ-POOL RULE FINALLY HAS A GUARD** — every shipped script
      registered in the gate AND dealt in its DECK, the rule this repo has broken
      four times. Written while the list is empty, teeth pointed at `Humility`.
      ⚠️ **THE PIPELINE (D157):** `scripts/cardgen/` with select, verify and land,
      and **no `draft.cjs` on purpose** — a script that called a model would put a
      network dependency in the repo. Selection measured **1,263 scriptable
      cards**, the user’s own decks first.
      ⚠️ **THE CONFORMANCE CORPUS** — five known-hard interactions, every case
      asserting BOTH directions. Its first draft of case 5 was a green tick over
      nothing and the corpus’s own purpose caught it.
      ⚠️⚠️ **THE BIGGEST ROW WAS A BLACK BOX AND IS NOW SPLIT**: `unclassified`,
      7,779 cards, 18,208 lines → `activatedCost` 3,170 · `triggeredShell` 2,509
      · `damage` 1,328 · `exile` 1,263 · … · **`other` 5,422**. Naming a line
      does not make it expressible, so these are a secondary classification and
      never a `RULES` row. It replaced the residue bar that was at 49.5% against
      a hard 0.5: what is bounded now is the genuinely UNNAMED share, 29.8%.
      ⚠️ **CI CANNOT HOLD ALL FIVE GATES AND SAYS SO** — nine test files need the
      86 MB card database and SKIP without it, leaving a run green. CI holds
      types, build, integrity, the corpus, the unit suite and the 500-seed gate,
      prints what it could not check, and the count is pinned at nine.
      **Verified: 70 test files, 1,371 Vitest / 10 skipped · `tsc -b` clean ·
      build clean · the 500-seed fuzz gate green at 456.9 s ·
      `battery-anim.cjs prompts` 26/26 · fixtures 132 → 135.**
      ⚠️ **Two reportables:** `verify.cjs` has never run end to end because there
      is no batch to verify; and targeting still aims with the FRONT face’s specs,
      so a back-face spell that targets cannot be cast through the UI (it fails
      safe — the host rejects it).

### M6.4 (in progress)

- [x] **M6.4a — The first shipped batch (2026-08-05):** eight card scripts in
      `src/engine/scripts/cards/`, the first entries `SHIPPED_SCRIPTS` has ever
      held — `Soul Warden`, `Essence Warden`, `Radiant Fountain`, `Adventurer's
      Inn`, `Wall of Blossoms`, `Wall of Omens`, `Baleful Strix`, `Onulet` —
      and **1,738 of 31,692 Commander-legal cards now execute completely, up
      from 1,730.** Decisions in **D158**.
      ⚠️⚠️ **FOUR OF THE BATCH'S TWELVE ARE STRUCTURALLY UNLANDABLE.**
      `ActivatedDef` is a dead seam — `IndexedRegistry` never indexes it, the
      `ScriptRegistry` interface has no accessor for it, and `resolveAbility`'s
      only script lookup is triggers — and `tier3.ts`'s activated notes are an
      independent second lock. `Arcane Encyclopedia`, `Deserted Temple`,
      `Hedron Archive` and `War Room` stay disclaimed; the seam is the next
      engine work M6.4 needs. D15b caught the fifth card mid-plan: `Adventurer's
      Inn` was assumed activated and is `Radiant Fountain`'s trigger twin.
      ⚠️⚠️ **THE SILENCE MECHANISM DID NOT EXIST AND GATE 5 WAS UNPASSABLE
      WITHOUT IT.** `engineCompleteness`/`tier3NotesFor` were pure text parsers
      with no knowledge of `SHIPPED_SCRIPTS`. Built as `lineClaims` in
      `engineComplete.ts`: PER-LINE claims (D90 — a partial script can never
      silence an unimplemented line), matched `scrub(def.text).trim()` against
      the leftover, `activated` defs excluded structurally, keyed on the NAMED
      list so the teeth stay teeth. One chokepoint, so engineComplete, tier3,
      primitives, botPool and cardgenSelect moved together by construction.
      ⚠️⚠️ **THE FIRST TWO SIMULTANEOUS SAME-CONTROLLER SCRIPT TRIGGERS THIS
      ENGINE EVER PRODUCED LIVELOCKED IT** — two tokens under a Soul Warden hit
      pump's 10,000-iteration throw. `orderTriggers` had never been reached
      through the live loop by anything: the raise re-emitted forever (the
      drain runs before `advance()`'s awaiting check and had no re-raise guard;
      `advanceMulligan` has carried one since M3), and the ANSWER only
      reordered, so the next drain re-asked forever. Fixed with
      `stackPendingTriggers` — one implementation, two callers (D148's rule):
      the drain stacks every controller's group up to the first that owes a
      choice, then asks; the answer stacks the chosen order. The prefix rule
      also fixed latent APNAP wrongness (a single-trigger active player behind
      a prompted opponent would have stacked AFTER the answer — CR 603.3b
      reversed). Pinned by the three-warden test.
      ⚠️ **TOKENS ARE NOT MOVES**: a token enters via `TokenCreated`, never
      `CardsMoved`, and the bus dispatches on exact event kind — so one printed
      "Whenever another creature enters" line is TWO TriggerDefs, and the
      one-def variant's miss is a permanent break test. Granularity measured:
      every battlefield entry today is its own event, so per-event firing IS
      per-creature; a future batched-entry event would under-fire and the bus
      needs per-move firing first.
      ⚠️ The shipped `Onulet` replaced the testing copy and fixed its resolve on
      the way — `obj.controller` (who controlled it AS IT DIED, CR 603.3d), not
      the dead card's owner; a stolen Onulet pays the thief, pinned. One card,
      one script. `drawEvents` exported so the draw walls route through THE one
      draw rule, empty-library loss included.
      ⚠️ **`verify.cjs` RAN END TO END FOR THE FIRST TIME** (D157's reportable)
      and the orchestrator itself needed nothing: five gates spawned, failures
      aggregated, exit honest. Its first run recorded D106's fifth case — the
      500-seed gate at 1,014 s against a 600 s timeout with a AAA game
      (`Spider-Man2`) resident at LoadPercentage 100; alone on the idle machine
      the same gate is **426.0 s, faster than D157's 456.9 s** despite 5.3× the
      triggered abilities.
      **Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES
      PASSED on the idle machine: `tsc -b` clean · conformance green · coverage
      accounting green over the real database · 78 test files, 1,422 Vitest
      passed / 10 skipped (70 / 1,371 before) · the 500-seed replay fuzz gate
      green at 447.2 s in the full run, 426.0 s alone · `npm run build` clean ·
      probe 124/124 against the new build · `battery-anim.cjs bot engine
      prompts` 127/127** — with the gate's games carrying the
      batch: 500 seeds · 83,977 accepted intents · 2,592,922 events · 19,517
      turns · **7,067 triggered abilities (1,329 before)** · 640 tokens all
      nameable · 1,749 permanents entering tapped · every replay hash equal.
      Re-measured, every delta exactly the eight cards: `blocked` 29,954 ·
      `scriptableToday` 1,263 → 1,255 · ladder [1255, 1354, 3307, 5191, 6378] ·
      botPool creature 1,149 / land 211 · tier3 `abilityText` 17,498,
      `silentAfter` 2,149 · `botDeck.ts` regenerated (Adventurer's Inn joined;
      "reaching 754 cards") · fixtures 135 → 140 · `batch.json` re-emitted at
      total 1,255.
      ⚠️ **Checked by BREAKING it:** the hook disabled at one call site fails
      the coverage gate naming ALL EIGHT cards by their exact line; the one-def
      warden misses the token the real script catches; the livelock was
      observed live before the fix existed (the regression tests were born
      failing).
      ⚠️ **Reportables** (D158): the `ActivatedDef` seam; `ctx.random` is a stub
      at all three `ScriptCtx` sites while `api.ts` promises a seeded RNG — no
      random card may ship until wired; `collectTriggers` still scans every
      card id per (event × def) — fine at 426 s today, the first suspect when
      the library grows; `docs/DECISIONS.md` carried a truncated duplicate of
      D1–D147 as an 8,827-line prefix (D157's sort fallout) — repaired by byte
      surgery, 326 → 168 headings, tail byte-identical.

- [x] **M6.4b — The ActivatedDef seam, and the four cards it unblocks
      (2026-08-05):** **1,742 of 31,692 Commander-legal cards now execute
      completely, up from 1,738 — and §7's rung 1 is EMPTY: every card in the
      user's own saved decks runs.** Landed: `Arcane Encyclopedia`,
      `Deserted Temple`, `Hedron Archive`, `War Room`. Decisions in **D159**.
      ⚠️⚠️ **`ActivatedDef` WAS A DEAD FIELD AND IS NOW THE THIRD CONSULTED DEF
      KIND** — `resolveAbility` looks it up by `ref === obj.abilityRef`, the
      string `handlers.activateAbility` has written since M3; the engine still
      owns parse → offer → charge → stack. The interface SHRANK to its consult
      sites (`{ ref, text, resolve }`) — its first cut carried four fields
      nothing read, D158's disease in the seam's own type. The `ScriptCtx`
      construction is ONE site now (`scriptCtxFor`).
      ⚠️⚠️ **TWO COSTS BECAME CHARGEABLE:** `Sacrifice this <type>` — paid in
      the cost batch through an ordinary `CardsMoved`, dies-triggers and all,
      and **OFFERED ONLY WHEN THE GAME'S REGISTRY CARRIES THE DEF** (charging
      mana for nothing is D122's disclosed status quo; eating a permanent for
      nothing is not) — and War Room's `Pay life equal to the number of colors
      in your commanders' color identity`, the RULE parsed and the NUMBER read
      off `players[p].identity` at offer and activation (Kess pays 3, Krenko 1,
      one script, pinned). **~812 sacrifice-self cards are now each ONE DEF
      away — the widest single unlock M6.4 has.**
      ⚠️ **THE CLASSIFIER WAS BLIND TO LONG COSTS**: a `cost: effect` line with
      its colon past 60 characters read as a SENTENCE; a line that OPENS WITH A
      BRACE is a cost at any length now (War Room's is 82). Measured: +195 real
      ability lines over all printings; 45 cards' notes truer;
      `activated:nonManaCost` 13,581 → 10,372; `payable` 4,016 → 4,828 cards —
      all def-gated, and `silentAfter` moving by exactly the four landed cards
      is the proof no disclosure was lost.
      ⚠️ Two test traps encoded: a pool funded before `advanceUntil` empties at
      the step boundary (CR 500.4); an activated ability can resolve inside its
      own submit under default stops, so responding to it needs
      `holdEverywhere` first.
      **Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES
      PASSED in one invocation on the idle machine: `tsc -b` clean ·
      conformance green · coverage accounting green over the real database ·
      82 test files, 1,450 Vitest passed / 10 skipped (78 / 1,422 before) ·
      the 500-seed replay fuzz gate green at 382.8 s with 12 scripts
      registered and the activated-seam canary holding at gate size ·
      `npm run build` clean · probe 124/124 · `battery-anim.cjs bot engine
      prompts` 127/127.** D106's sixth case recorded on the way: identical
      games at 411.3 s idle and 760 s (a timeout) under a resident Overwatch.
      ⚠️ **Checked by BREAKING it:** tier3's activated silence disabled fails
      the coverage gate naming ALL FOUR cards by their printed costs; Hedron's
      def-gate break test ships in the suite; the claims kind-separation is a
      unit test; the fuzz gate gains the activated-seam canary (gate-size,
      like the dies-trigger one).
      ⚠️ **Reportables** (D159): a general sacrifice cost is a CHOOSER, not a
      price; computed life beyond the one phrase stays unpaid; `ctx.random` is
      still a stub; the tier3 baselines are parse-relative.

- [x] **M6.4c — The first batch at scale, and the day the zero pins flipped
      (2026-08-05):** **1,761 of 31,692 Commander-legal cards now execute
      completely, up from 1,742.** Nineteen scripts landed from `select.cjs`'s
      own 25 — the first batch taken at the pipeline's word — with the six
      refusals NAMED (three general-sacrifice choosers, the "modified"
      predicate, a script-raised discard prompt, and ⚠️ **an INSTANT:
      `select.cjs` hands out spells and `CardScript` has no spell seam — the
      selection can pick what the pipeline cannot land**, D160's headline
      reportable). Decisions in **D160**.
      **Five firsts in one batch:** a CAST-watching trigger (`Talrand` — a
      starter commander finally does what it says); SCRIPT-created tokens via
      `TOKEN_TABLE` with three new pinned token fixtures (Drake, Elf Warrior,
      Villain — real cards, never D133's blanks); a script bounce and an
      activated graveyard return; until-end-of-turn pumps through layer 7c
      with the SBA doing the killing; script damage built the way `damageTo`
      builds it, plus a player-targeted activated and a sacrifice-ONLY cost.
      ⚠️⚠️ **TWO ZERO PINS FLIPPED BY DESIGN**: `Ajani's Welcome` is the FIRST
      ENCHANTMENT the bot pool has ever held (the pin said "the day one
      becomes non-zero is a day worth noticing" — this is that day), and
      Talrand's tier3 note is silent (three starter commanders still say so).
      ⚠️ **THE BOT CHANGED ITS OWN COMMANDER**: regenerated from the widened
      pool, `botDeck.ts` dropped Jasmine Boreal (GW, 758 reachable) for **Adun
      Oakenshield (BGR, 48 executable legendaries, 976 reachable)** — the
      machine choosing the commander whose ability it can use. Nothing in the
      builder changed; the pool did.
      ⚠️ `Yotian Dissident` ships and forced the TEETH SWAP (`Humility` is the
      accounting gate's must-fail example now — both teeth on one name).
      Fixtures 144 → 164 · `SHIPPED_SCRIPTS` 12 → 31 · `batch.json` at 1,232 ·
      ladder [1232, 1331, 3284, 5168, 6355].
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 101
      test files, 1,542 Vitest passed / 10 skipped · the 500-seed gate green at
      375.1 s (fastest of the arc, 41 scripts registered) · build clean ·
      probe 124/124 · battery 127/127 with the bot on its NEW deck — after
      fixing the battery's own commander check to read the generated deck
      instead of pinning a name that was true for one era.**
      ⚠️ **Reportables** (D160): the spell-selection gap; a script cannot raise
      a prompt from `resolve` (blocks `Abyssal Horror`'s class); the "modified"
      predicate; the general-sacrifice chooser (D159, still the largest cost
      gap).

- [x] **M6.4d — Thirteen landed, a validation hole closed, and the selection
      taught to refuse (2026-08-05):** **1,774 of 31,692 Commander-legal cards
      now execute completely, up from 1,761.** Decisions in **D161**.
      ⚠️⚠️ **A HOST-SIDE VALIDATION HOLE, FOUND BY A NEGATIVE TEST — D139's,
      ONE INTENT OVER.** `ActivateAbility` with INLINE targets skipped target
      validation entirely (the prompt-stage path has validated since the
      targeting work); a hand-built intent could aim "target attacking
      creature" at a bystander. Closed with the prompt stage's own predicate
      and message. Found because `Angelic Page`'s test EXPECTED the refusal.
      ⚠️⚠️ **AND THE FIXED VALIDATION EXPOSED THE SECOND SELECTION/GATE
      MISMATCH**: "attacking"/"blocking" are UNENFORCED target clauses, so the
      coverage gate refuses those cards however their scripts read — and the
      selection had offered them, because `primitivesFor`'s needs cannot see
      spec refusals. `Angelic Page` and `Anointer of Champions` were PULLED,
      and `cardgenSelect` gained the two filters the drafts paid for: no
      spells (no spell seam, D160), no unread/unenforced target clauses. The
      OFFERABLE pool is 1,135 against the parsers' 1,219 — the 84-card gap is
      the dead weight every batch had been re-shuffling.
      **Four firsts:** script DESTROY with indestructible asked of the derived
      target (`Angel of Despair`; the break test is `Darksteel Myr` surviving
      what kills a Lion) · script EXILE on the first looks-back-AND-targets
      trigger (`Archon of Justice`) · the opponent-cast trigger (`Arasta`,
      Talrand's mirror — the token to the ability's controller, not the
      caster) · the repeatable token ability (`Ant Queen`, no tap, two
      activations two Insects). Plus a creature ping, `{T}: Draw`, two
      graveyard-return twins, -2/-0, three ETB-gain angels, a dies-gain.
      ⚠️ **Ten refusals named**: D160's six (recurrence now CLOSED by the
      filters) · `Amok` (random-discard cost) · `Ancestor's Prophet` and
      `Aphetto Grifter` (tap-N-untapped-creatures costs) · `Arc-Slogger`
      (exile-from-library cost — a new ledger class).
      Fixtures 181 (the pulled pair stay, waiting on combat-qualifier
      enforcement) · `SHIPPED_SCRIPTS` 31 → 44 · ladder [1219, 1318, 3271,
      5155, 6342] · botDeck: Adun reaches 982 from 49 legendaries.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 114
      test files, 1,598 Vitest passed / 10 skipped · the 500-seed gate green
      at 599.5 s against its 600 s timeout — a pass by half a second, said
      plainly: ⚠️ the `collectTriggers` per-oracle index (named since D158) is
      DUE before the next batch · build clean · probe 124/124 · battery
      127/127.**
      ⚠️ **Reportables** (D161): the collectTriggers index (now due);
      combat-qualifier targeting as the next targeting-layer widening (returns
      the pulled pair); the cost-class ledger (general-sacrifice chooser,
      random-discard, tap-N, exile-from-library); D160's spell-seam and
      script-raised-prompt items stand.

- [x] **M6.4e — The index that was due, and thirteen more (2026-08-05):**
      **1,787 of 31,692 Commander-legal cards now execute completely, up from
      1,774.** Decisions in **D162**.
      ⚠️⚠️ **THE collectTriggers INDEX LANDED, AND THE FIRST CUT WAS A MEASURED
      REGRESSION.** The per-oracle index named since D158 and declared due by
      D161's 599.5 s squeaker: three 60-seed legs on the idle machine,
      counters byte-identical across all three — **baseline scan 71.4 s; eager
      index 84.8 s (it built both sides' maps unconditionally per call, and
      most event batches match no def); lazy memos 61.5 s, 14% under the
      baseline.** An index that is not lazier than the scan it replaces is a
      second scan. The 500-seed gate is the at-scale proof: **394.4 s with 57
      scripts against 599.5 s with 44** — thirteen more scripts, 205 seconds
      faster, where D161 passed by half a second.
      **Four firsts in batch 5:** the first def on a COMBAT event (`Armasaur
      Guide` counts its controller's declared attackers — ≥3 asks for a
      target, 2 asks for nothing, both pinned); the first script TAP (`Auriok
      Transfixer`, the untap guard's mirror — a turned target gets no event);
      the first TARGETED self-sacrifice (`Ark of Blight` — Darksteel Citadel
      survives it and the Ark STAYS SPENT, the no-refund rule); the first
      enters-OR-dies double def (`Ashen Rider`, one printed line, two defs,
      the dies half looking back). Plus a second cast-watcher (`Argothian
      Enchantress`, enchantment spells), an enchantment-dies watcher
      (`Ashiok's Reaper`, looks back so a wipe still pays), three more ETB
      tokens (Wurm `trtr 11` and Thopter `tafc 12` pinned; Attended Knight
      reuses the `t40k 2★` Soldier), Radiant Fountain's shape on a land that
      ALSO enters tapped (`Asgardian Citadel` — the test asserts both halves),
      an ETB gain, an ETB enchantment destroy, an ETB land bounce.
      ⚠️ **Twelve refusals, ZERO new classes — and six of them are the
      general-sacrifice chooser alone** (Agent of Shauku, Ahriman, Akki
      Scrapchomper, Arms Dealer, Army Ants, Aura Fracture), which D162
      promotes to the single largest unlock in sight. The rest: Abyssal
      Horror (script-raised prompt), Akki Ember-Keeper ("modified"), Amok
      (random-discard), Ancestor's Prophet and Aphetto Grifter (tap-N),
      Arc-Slogger (exile-from-library).
      Fixtures 181 → 196 (11 tokens) · `SHIPPED_SCRIPTS` 44 → 57 · ladder
      [1206, 1305, 3258, 5142, 6329] · `batch.json` at 1,122 · botDeck: **Ark
      of Blight joined the bot's deck** (Adun reaches 985 from 982, Dreadbore
      displaced).
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 127
      test files, 1,671 Vitest passed / 10 skipped · the 500-seed gate green
      at 394.4 s (57 scripts registered) · build clean · probe 124/124 ·
      battery 127/127.**
      ⚠️ **Reportables** (D162): the general-sacrifice chooser (six-in-one-
      batch; an `Awaiting` from cost payment over a PUBLIC zone — cheaper than
      it looks); the rest of the cost ledger (random-discard + `ctx.random`,
      tap-N, exile-from-library); D160's spell seam and script-raised prompts;
      the "modified" predicate.

- [x] **M6.4f — The REFUSED ledger, and nine more (2026-08-05):** **1,796 of
      31,692 Commander-legal cards now execute completely, up from 1,787.**
      Decisions in **D163**.
      ⚠️⚠️ **TWELVE OF THE 25 SLOTS WERE D162's REFUSALS RE-OFFERED,
      VERBATIM** — the selection's D161 filters are parse questions and a
      cost-class refusal is a DRAFTER's verdict no parser row records. The
      third selection filter is a NAMED LEDGER (`REFUSED` in
      `cardgenSelect.node.test.ts`, name → class, sixteen entries) and it is
      **self-correcting by construction**: `select()` records any entry whose
      card now runs completely and a test fails NAMING it, so the day a class
      is built its stale entries cannot survive the suite. Offerable pool
      1,122 → **1,097** (9 landed + 16 refused, exact).
      **Four firsts in batch 6:** the first HYBRID activation cost a shipped
      def charges (`Azorius Locket`, {W/U}×4 paid in all-white — the parse
      pinned payable + sacrificesSelf); D139's numeric restriction exercised
      on the ACTIVATED path (`Aysen Bureaucrats` taps a 2/2 and is REFUSED a
      5/5 at activation, both pinned); the first repeatable no-tap draw on a
      creature (`Azure Mage`, twice in one turn); the -1/-1 ETB twin
      (`Baleful Ammit`, wrong-controller refusal pinned). Plus five twins of
      batch-5 shapes — and ZERO new token pins (Aviation Pioneer shares
      Aspiring Aeronaut's colorless Thopter entry and fixture).
      ⚠️ **Four fresh refusals, TWO NEW CLASSES:** `Axgard Artisan`
      (once-per-turn trigger memory — "for the first time each turn" has no
      per-turn state to read); **`Aya of Alexandria` (per-damage-entry
      trigger granularity — `CombatDamageDealt` batches every creature's
      damage into ONE event and the bus fires per event, so a per-creature
      damage trigger under-fires on multi-attacker turns: Soul Warden's
      granularity warning met in the wild)**; `Ayula's Influence`
      (discard-cost chooser, the hand-side sibling of the sacrifice chooser);
      `Azami, Lady of Scrolls` (tap-creatures cost, existing class).
      ⚠️ The Locket's own first run caught a counting bug: "draw two" is ONE
      `CardsMoved` of two moves, and the draw counter read events — 1 where
      two cards had arrived. It counts MOVES now.
      Fixtures 196 → 205 (tokens still 11) · `SHIPPED_SCRIPTS` 57 → 66 ·
      ladder [1197, 1296, 3249, 5133, 6320] · `batch.json` at 1,097 ·
      botDeck: Adun reaches 986.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 136
      test files, 1,720 Vitest passed / 10 skipped · the 500-seed gate green
      at 404.5 s (66 scripts registered) · build clean · probe 124/124 ·
      battery 127/127.**
      ⚠️ **Reportables** (D163): the general-sacrifice chooser now holds SIX
      ledger entries and stays the largest unlock in sight; the ledger's
      guard is one-directional (a stale entry fails by name, but a refusal
      never ENTERED is only caught by the batch that re-reads it);
      once-per-turn memory and per-damage-entry bus granularity join the
      engine-work list; the discard-cost chooser joins the cost ledger;
      D160's spell seam and script-raised prompts stand.

- [x] **M6.4g — Nineteen landed, and the allocator that handed out one id
      (2026-08-05):** **1,815 of 31,692 Commander-legal cards now execute
      completely, up from 1,796** — the biggest batch of the arc. Decisions in
      **D164**.
      ⚠️⚠️ **`ctx.ids.nextInstance` WAS A PURE READ OF THE UNAPPLIED STATE** —
      every call in one resolve returned the SAME id, so a script creating two
      tokens OVERWROTE the first and duplicated the zone entry. Found by the
      arc's first two-token resolves, and **the two tests read the corruption
      differently: Beetleback Chief's count-only assertion saw the duplicated
      battlefield entry as "2 Goblins" and PASSED; Blaze Commando's read 1 and
      failed** — the only reason anything was found. `effects.ts`'s
      `createToken` has kept its own advancing counter since D133; the script
      API beside it never got the same care. Fixed with per-ctx ADVANCING
      allocators at all three `ScriptCtx` sites — the first call is
      byte-identical to the old read, so every shipped script replays
      unchanged (the 500-seed gate's equal hashes prove it at scale). Both
      tests now assert the DISTINCT id set.
      **Five firsts:** the first HAND-zone def (`Bartered Cow`, one line, two
      zone-changes — `activeZones: ['hand']` + `looksBack`, exercised by the
      fuzz gate's cleanup discards for free); the first combat-damage trigger
      (`Belligerent Guest` — SELF-only, so per-event firing is per-instance,
      safe where D163 refused Aya); the first spell-damage watcher (`Blaze
      Commando` — `DamageDealt` fires once per resolving object, the card's
      own granularity); the first PHYREXIAN activation cost (`Blinding
      Souleater`, {W/P} pinned payable, paid in white); the first multi-token
      resolves (the pair that found the allocator). Plus fourteen on shipped
      shapes — including a mana-free self-sacrifice with a player target
      (`Bile Urchin`), the same printed text landed on two oracle ids
      (`Benalish Trapper` / `Blinding Mage`, each proven on its own), and a
      targeted until-end-of-turn debuff with cleanup asserted (`Blister
      Beetle`).
      ⚠️ **Six refusals, all IN THE LEDGER: the sacrifice-cost chooser now
      holds TEN entries** (Barrage of Expendables, Barrage Ogre, Barrin,
      Blazing Hellhound joined) **plus two NEW classes** — `Bearscape`
      (exile-from-graveyard cost) and `Black Cat` (a random effect while
      `ctx.random` is a stub — D158's reportable now BLOCKS a named card).
      Fixtures 205 → 232 (19 tokens, EIGHT new printings pinned) ·
      `SHIPPED_SCRIPTS` 66 → 85 · ladder [1178, 1277, 3230, 5114, 6301] ·
      `batch.json` at 1,072 · botDeck: Birthing Boughs in, Darksteel Ingot
      out (Adun reaches 994).
      ⚠️ **The first full-gate run failed on a RATE canary rotting on
      schedule** — D149's CR 616 `replacementChoices > 0` hit ZERO with every
      replay hash equal, because four batches of DECK growth had diluted the
      Hardened Scales + Branching Evolution pair out of the 60-card
      libraries (its own comment predicted it). Re-weighted to five copies
      each; and the batch reshaped the games — target prompts ~3,000 →
      39,866, accepted intents down ~30% — which future rate canaries must
      be read against.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 155
      test files, 1,818 Vitest passed / 10 skipped · the 500-seed gate green
      at 510.6 s (85 scripts; equal hashes are the allocator's at-scale
      proof) · build clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D164): the sacrifice-cost chooser at TEN entries is
      overdue; `ctx.random` wiring is bounded work with a named payoff (Black
      Cat's class); exile-from-graveyard joins the cost ledger; once-per-turn
      memory and per-damage-entry granularity stand.

- [x] **M6.4h — Twenty-two landed, the cleanest batch yet (2026-08-05):**
      **1,837 of 31,692 Commander-legal cards now execute completely, up from
      1,815** — the largest batch of the arc, and `SHIPPED_SCRIPTS` passed one
      hundred (85 → 107). Decisions in **D165**.
      ⚠️ **Only THREE refusals, and the ratio is the LEDGER working** — the
      D161 parse filters and D163's REFUSED ledger have drained the
      un-landable shapes out of the offer stream. The three: two more
      sacrifice-cost choosers (Blood Rites, Bog Naughty — **the class holds
      TWELVE of the ledger's 26 entries**) and one NEW class (Bolrac-Clan
      Crusher, remove-a-counter cost).
      **Five firsts:** the first ATTACHMENT trigger (`Bramble Elemental`
      watches `AttachmentChanged` for an Aura landing on ITSELF — two
      DISTINCT Saprolings via D164's allocator, attached-elsewhere negative
      pinned); the first FIXED life activation cost (`Book of Rass`, paid
      TWICE in one turn, life 40 → 38 → 36 asserted); the first
      enters-OR-LEAVES double def (`Brandywine Farmer` — a BOUNCE pays,
      leaves ≠ dies, pinned); the first SELF-INCLUSIVE controlled-creature
      watcher (`Bogwater Lumaret` — its own entry gains, beside `Boltwing
      Marauder` carrying the exclusion, both shapes pinned from both sides);
      the first SUBTYPE cast-watcher (`Briarknit Kami`, Spirit/Arcane).
      Plus `Bloodtallow Candle`'s -5/-5 killing a 2/2 THROUGH the SBA, two
      three-line sacrifice-draw lands, two more Cluestone/Locket pairs, and
      twelve twins of shipped shapes.
      Fixtures 232 → 255 (20 tokens, ONE new pin — Saproling `tddj 1`) ·
      ladder [1156, 1255, 3208, 5092, 6279] · `batch.json` at 1,047 ·
      botDeck: FIVE batch-8 cards joined (Adun reaches 1,012).
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 177
      test files, 1,932 Vitest passed / 10 skipped · the 500-seed gate green
      at 471.5 s (107 scripts) · build clean · probe 124/124 · battery
      127/127.** All 48 new per-card tests passed on their first run.
      ⚠️ **Reportables** (D165): the sacrifice-cost chooser at TWELVE entries
      is the arc's most overdue engine work; remove-counter cost joins the
      ledger; D164's items stand (`ctx.random`, exile-from-graveyard,
      once-per-turn memory, per-damage-entry granularity).

- [x] **M6.4i — Twenty-one landed, and two lessons the tests taught
      (2026-08-05):** **1,858 of 31,692 Commander-legal cards now execute
      completely, up from 1,837.** `SHIPPED_SCRIPTS` 107 → 128. Decisions in
      **D166**.
      **Three firsts:** the first SELF-attack triggers (`Burrenton
      Shield-Bearers` and `Cat-Owl` — Armasaur's event with an is-it-me
      filter, the granularity-safe shape; Cat-Owl attacks, targets ITSELF and
      straightens mid-combat); D135's conditional entry proven BOTH ways by a
      shipped script's own test (`Castle Ardenvale` — tapped with no Plains,
      untapped with one — which also carries the first token maker on a
      LAND); the pool's SECOND enchantment (`Captive Flame` — the D160
      zero-pin reads TWO, both names in its comment).
      ⚠️⚠️ **Two lessons from the tests, one a genuine footgun:**
      `g.state.cards[f(g)]` evaluates the member chain BEFORE the call, and
      an IMMUTABLE state makes that a silent time-travel read — D135's rule
      looked broken while working perfectly, settled by a probe in one run;
      and an UNATTACHED AURA is refused as a generic "target enchantment"
      (Pacifism vs "target artifact or enchantment"), recorded as a
      reportable because an Aura on the battlefield IS an enchantment.
      ⚠️ **Four refusals, ONE new class — the cheapest ever named:**
      `Brittle Effigy`'s exile-SELF cost is `sacrificesSelf` one event over
      (same recognition, same gate, exile instead of graveyard). Plus the
      sacrifice-chooser's THIRTEENTH entry (Carnage Altar),
      exile-from-graveyard (Cabal Surgeon), tap-creatures (Catapult Master).
      Fixtures 255 → 280 (24 tokens, FOUR new pins: Boar `tpca 14`, Dragon
      `tmm3 7`, Human `tfdn 3`, Map `tbig 7`) · ladder [1135, 1234, 3187,
      5071, 6258] · `batch.json` at 1,022 · botDeck: Captive Flame joins
      (Adun reaches 1,023).
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation: 198
      test files, 2,039 Vitest passed / 10 skipped · the 500-seed gate green
      at 568.2 s (128 scripts — ⚠️ 32 s of timeout margin left; a second
      index-scale pass is approaching due) · build clean · probe 124/124 ·
      battery 127/127.**
      ⚠️ **Reportables** (D166): the exile-self cost clears its class in an
      afternoon; the unattached-Aura targeting question (if it is a kind
      quirk, every Aura is invisible to scripted enchantment removal); the
      sacrifice-chooser at THIRTEEN of 30 ledger entries; prior items stand.

- [x] **M6.4j — Twenty landed, and the first upkeep trigger ships
      (2026-08-06):** **1,878 of 31,692 Commander-legal cards now execute
      completely, up from 1,858** — the first batch under the STANDING
      continuation, `SHIPPED_SCRIPTS` 128 → 148, the offerable pool under a
      thousand (997). Decisions in **D167**.
      **Two firsts and a third enchantment:** the first SHIPPED upkeep
      trigger (`Celestial Force` — `StepBegan`/'upkeep', EACH upkeep, no
      active-player filter; the test watches the opponent's upkeep pay too);
      the first targeted ETB TAP (`Chrome Prowler`, own-creature refusal
      pinned); `Centaur Glade` makes the D160 zero-pin read THREE. Plus a
      FREE self-sacrifice draw (`Commander's Sphere`), a leaves-only Food
      (`City Pigeon`), a dies multi-token with distinct-id teeth (`Conclave
      Cavalier`), a tap-ping (`Chandra's Magmutt`), and fourteen twins.
      FOUR new token pins (Centaur `trvr 10`, Elf Knight `trvr 15`,
      Phyrexian Goblin `tfdn 31`, artifact Soldier `totc 26`).
      ⚠️ **Five refusals, all in the ledger: the sacrifice-cost chooser at
      FIFTEEN of 35 entries** (Cephalid Scout, Claws of Gix joined), plus a
      discard-cost (Charging Strifeknight), a once-per-turn memory (Clarion
      Spirit — "your second spell each turn"), and a tap-permanents cost
      (Clock of Omens, the tap-creatures chooser's artifact sibling).
      Fixtures 280 → 304 (28 tokens) · ladder [1115, 1214, 3167, 5051,
      6238] · `batch.json` at 997 · botDeck: Centaur Glade joins (Adun
      reaches 1,032).
      ⚠️⚠️ **D166's PREDICTED WALL ARRIVED: the first gate run's fuzz TIMED
      OUT at 600 s.** A second bus pass (lazy per-call constructions +
      present-def memo) measured ~2% — the honest finding is the cost is the
      GAMES, not the bus — so the timeout is raised ONCE to 900 s with the
      history in its comment, and self-only def dispatch is the named next
      lever.
      **Verified on the re-run: `verify.cjs --full` — ALL FIVE GATES in one
      invocation: 218 test files, 2,139 Vitest passed / 10 skipped · the
      500-seed gate green at 589.6 s (148 scripts, 310 s inside the new
      ceiling) · build clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D167): the sacrifice-cost chooser at FIFTEEN
      (commissioned — D168 is next); the wall history lives in the gate's
      own comment; prior items stand.

- [x] **M6.4k — The sacrifice-cost chooser, and the panel that made every
      ability clickable (2026-08-06):** **1,881 of 31,692 Commander-legal cards
      now execute completely, up from 1,878** — the commissioned engine work
      between batches 10 and 11, and the REFUSED ledger's largest class
      (FIFTEEN entries) deleted the day it was built. Decisions in **D168**.
      ⚠️⚠️ **"Sacrifice a <predicate>" IS NOW A CHOICE THE ACTIVATION
      CARRIES** — `ActivateAbility.sacrifice` names the permanent. One grammar
      end to end: `activatedParse` reads the cost through `replacementParse`'s
      OWN `predicatesOf` ("a permanent" is the empty predicate; "another
      creature or artifact" one predicate per OR arm; an unreadable phrase
      stays refused), `legal.ts` offers only past the def gate AND only while
      a candidate exists (`sacrificeCandidatesFor` — DERIVED characteristics,
      battlefield order, the candidates riding the legal action), the host
      re-validates the pick with the same function (`needsSacrifice` /
      `illegalSacrifice`, both eating nothing), and the charge is paid in the
      cost batch beside D159's self-sacrifice, through the ordinary
      `CardsMoved`, narrated by WHAT DIED.
      ⚠️⚠️ **BUILDING THE UI HALF FOUND THERE WAS NO ACTIVATION UI AT ALL** —
      no renderer path consumed an `ActivateAbility`, so every def landed
      since D159 (~40 abilities) was reachable by the bot, the fuzzer and the
      batteries and by NOBODY at the table. D143's lesson at its largest.
      **The control is the card's own click panel**: ability rows under the
      mana options (`abilityOptionsFor`, pure), `startActivation` as the ONE
      router (sacrifice → veil pick; targets → targeting `next: 'submit'`;
      else submit), a `sacrifice` table mode whose veil re-reads candidates
      off the CURRENT legal action every commit, and the prompt bar naming
      the pick.
      ⚠️⚠️ **THE GATE'S FIRST RUN FOUND A REAL ENGINE HOLE (fuzz seed 305):**
      sacrificing an ATTACKING TOKEN deletes the instance (`TokensCeased`)
      while combat still names it — `attacker c877 does not exist`. Predates
      D168; invisible for seven batches because ordinary combat deaths
      auto-pass through end-of-combat's cleanup before any invariant check
      settles, while a chooser paid under a live awaiting freezes the stale
      state in view. **Fixed in the reducer: `TokensCeased` prunes combat in
      `RemovedFromCombat`'s exact shape.** Regression test stages the exact
      scenario; with the prune reverted it fails with the gate's own message.
      **Proof cards:** `Carnage Altar` (typed predicate; no-candidate-no-offer
      asserted from the offer side; wrong-kind and missing-pick rejects with
      the log unmoved), `Claws of Gix` (empty predicate; a LAND pays; the
      Claws pay their OWN cost and the ability still resolves — CR 113.7a),
      `Ahriman` (OR predicate + "another": candidates exclude the source,
      the artifact arm pays).
      ⚠️ **The parse moved the whole database and none of it is offered**:
      tier3 `payable` 4,777 → 5,266 (+489 cards), printings-level
      `nonManaCost` 10,372 → 8,572 against `payable` 28,133 → 29,933 — the
      same 1,800 lines, a perfect mirror. The def gate holds; `abilityText`
      unmoved; `silentAfter` +3 = exactly the landed cards.
      Fixtures 304 → 307 · `SHIPPED_SCRIPTS` 148 → 151 · ladder [1112, 1211,
      3164, 5048, 6235] · botPool creature 1,259 / artifact 47 · `batch.json`
      at **1,009** (997 − 3 landed + 15 ledger-freed) · botDeck: Adun reaches
      1,035.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      221 test files, 2,162 Vitest passed / 10 skipped · the 500-seed gate
      green at 569.6 s idle (151 scripts, 330 s inside the ceiling; the same
      gate also passed at 598.9 s UNDER a playing video stream — the first
      loaded run of the arc to finish inside the ceiling, D106) · build
      clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D168): the sacrifice+targets chain (unoffered today
      — no def ships both; the freed `Barrage of Expendables` class needs it);
      the other cost-chooser classes are each this decision one verb over
      (discard, tap-creatures/permanents, exile-from-graveyard,
      remove-counter); the ability rows have no battery click-check yet
      (D144's lesson — write it before the panel rots); prior items stand.

- [x] **M6.4l — Twenty-three landed on the staged chain, and the prompt that
      armed the arrow (2026-08-06):** **1,904 of 31,692 Commander-legal cards
      now execute completely, up from 1,881** — the largest batch of the arc
      (23 of 25), led by the REFUSED ledger giving its freed sacrifice-chooser
      cards back. Decisions in **D169**.
      ⚠️⚠️ **THE `chooseTargets` PROMPT HAD NO HUMAN CONTROL** — the bar has
      said "drag the arrow onto each one" since the targeting work and
      NOTHING ever armed the arrow, so a human whose own trigger asked for a
      target was WEDGED. Every targeted trigger since batch 5 was answerable
      by the bot, the fuzzer and the net driver and by nobody at the table —
      D143's lesson, THIRD instance. Fixed: targeting mode gains
      `next: 'answer'`, `TargetSource` gains `stack`, and the awaiting arms
      the arrow with the HOST's own specs; Escape re-arms because the game
      genuinely cannot proceed unanswered.
      ⚠️ **The staged chain proven end to end** (`Agent of Shauku`): the pick
      rides the intent, the target prompt stages, and the COST IS CHARGED ON
      THE ANSWER — CR 601.2's order made visible (the land still on the
      battlefield while the prompt is up). The ten sacrifice+target cards
      needed ZERO further engine work: D168 plus the existing staging compose.
      **Landed:** the ten chooser+target defs (every D168 predicate shape —
      typed, empty, OR, "another", and the first SUBTYPES: Arms Dealer's
      Goblin, Bog Naughty's Food — paired with pumps, indestructible-aware
      destroys, enchantment- and creature-source pings, a bounce, and Aura
      Fracture's NO-mana cost where the sacrifice IS the price) · the freed
      pair (Akki Scrapchomper, Cephalid Scout) · eleven fresh shapes
      (Contemplation's any-spell cast-watcher — **the enchantment pool reads
      SEVEN**; the islandwalk Squid and trample Dinosaur whose printings are
      distinct by nothing but their abilities, D131; Crimson Caravaneer's
      double-strike trigger firing once per sub-step with DISTINCT Junk ids,
      D164's teeth; the colour-filtered two-def Court Street Denizen whose
      white TOKEN counts; Crocodile of the Crossing's own-board ETB counter;
      Crenellated Wall, Courier's Capsule, Council of Advisors, Courier
      Griffin, Crustacean Commando's Mutagen).
      ⚠️ **Two refusals, both existing classes:** Coral Helm (random-discard
      cost), Corrupt Court Official (script-raised prompt).
      ⚠️ Two test lessons pinned: Arms Dealer is ITSELF a Goblin, so the
      wrong-kind negative must use a Goblin-less creature; and `put` may
      fetch from the opening HAND, so ETB draws are counted in LOG MOVES,
      never hand size.
      Fixtures 307 → 334 (32 tokens: Squid `tblc 17`, Dinosaur `txln 5`,
      Junk `tpip 15`, Mutagen `ttmt 9`) · `SHIPPED_SCRIPTS` 151 → 174 ·
      ladder [1089, 1188, 3141, 5025, 6212] · `batch.json` at 984 (exact) ·
      botDeck: Barrage of Expendables and Blood Rites join.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      244 test files, 2,264 Vitest passed / 10 skipped · the 500-seed gate
      green at 622.7 s (174 scripts, 277 s inside the ceiling; the wall grew
      ~53 s for 23 scripts — self-only def dispatch is the named lever when
      the trend closes the gap) · build clean · probe 124/124 · battery
      127/127.**
      ⚠️ **Reportables** (D169): the answer-mode arrow and D168's ability
      rows are battery-covered by nothing yet (D144's lesson, owed by two
      features); the remaining cost-chooser classes, `ctx.random`,
      once-per-turn memory, per-damage-entry granularity and the spell seam
      stand.

- [x] **M6.4n — Twenty-three again: the transform-watcher, the counterspell,
      and the tap-watcher (2026-08-06):** **1,927 of 31,692 Commander-legal
      cards now execute completely, up from 1,904.** Three event kinds
      consumed by a def for the first time. Decisions in **D170**.
      **The firsts:** `Cult of the Waxing Moon` watches `FaceIndexSet` with
      the filter on the DERIVED destination face (flipping back to the Human
      front pays nothing — both branches on one werewolf); `Daring
      Apprentice` counters a REAL held cast through the staged prompt — ⚠️
      its own first test caught an under-emit (`SpellCountered` alone
      strands the card in the stack zone; the def now routes the move
      through a newly exported `moveFromStack`, the `drawEvents` precedent);
      `Deeproot Pilgrimage` watches `PermanentsTapped`, whose per-event
      batching is EXACTLY the card's "one or more" wording — the shape D163
      refused for Aya, correct here by the printed rule, with the nontoken
      filter proven from both sides.
      **Also:** the first HISTORIC cast filter (D'Avenant Trapper, off the
      face actually cast); Forest and Zombie chooser predicates with
      wrong-kind rejects; an attack-untap; enchantment- and Merfolk-cast
      watchers; **the enchantment pool reads ELEVEN**; a dies-token on
      D165's Saproling pin.
      ⚠️ **Two refusals, both existing classes:** Curious Altisaur
      (per-damage-entry granularity — not self-only) and Deadbridge Shaman
      (script-raised prompt, the dies-twin).
      ⚠️ Pinned on the way: the engine's phases are
      `precombatMain`/`postcombatMain` — a `'main1'` predicate matches
      nothing and the advance runs the game to its deck-out end, reading as
      a gameOver reject three turns later.
      Fixtures 334 → 363 (35 tokens: Human Soldier `tthb 2`, hexproof
      Merfolk `txln 3`, Wolf `tlrw 10`; a werewolf, Forest body, Zombie and
      vanilla Merfolk join unscripted) · `SHIPPED_SCRIPTS` 174 → 197 ·
      ladder [1066, 1165, 3118, 5002, 6189] · `batch.json` at 959 (exact) ·
      botDeck: Dark Heart of the Wood joins.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      267 test files, 2,360 Vitest passed / 10 skipped · the 500-seed gate
      green at 1,148.7 s (197 scripts, 651 s inside the raised ceiling) ·
      build clean · probe 124/124 · battery 127/127 (both in an idle
      window — the new standing rule: gates wait for quiet, light work
      never does).**
      ⚠️⚠️ **THE FUZZ WALL ARRIVED AGAIN — D167's verdict, proven harder:**
      the first run failed ONLY its 900 s ceiling after COMPLETING all 500
      seeds with every hash equal at 1,162 s under desktop load; ~145 s per
      60 seeds projects ~900–1,200 s even idle on 2.84 M events / 24 K
      turns of genuinely richer games. Ceiling raised a second time
      (900 → 1,800 s) with the trend table in the gate's comment and the
      rule made explicit: raised only ever after a completed-and-equal run
      proves growth rather than a hang.
      ⚠️ **Reportables** (D170): the answer-mode arrow and ability rows
      still owe a battery click-check (three features deep); the
      cost-chooser classes, `ctx.random`, once-per-turn memory,
      per-damage-entry granularity and the spell seam stand.

- [x] **M6.4o — Twenty landed: the graveyard-exit watcher, the self-cast
      trigger, the chosenColor consumer, and the first script reanimation
      (2026-08-06):** **1,947 of 31,692 Commander-legal cards now execute
      completely, up from 1,927.** `SHIPPED_SCRIPTS` 197 → 217. Decisions in
      **D171**.
      **Five firsts:** `Desecrated Tomb` watches `CardsMoved` FROM the
      controller's graveyard with the mover typed off the ORACLE face (a
      graveyard card has no battlefield derivation), and the per-event batch
      IS the card's "one or more" wording; `Desolation Twin` triggers on its
      OWN cast from `activeZones: ['stack']` — the 10/10 arrives while the
      Twin is still a spell, and a Twin merely PUT onto the battlefield
      brings nothing; `Diamond Mare` is the first trigger CONSUMER of D147's
      `chosenColor` (line 0 is the engine's built-in prompt, the def claims
      only the watcher, and no answer means no match); `Deepwood Tantiv`
      watches `AttackerBecameBlocked` self-filtered (CR 509.1g's fire-once
      falls out of one event per declaration); `Doomed Necromancer` is the
      first script REANIMATION — D138's graveyard aim, CR 608.2b re-check,
      and an ordinary CardsMoved to the battlefield so the entry funnel runs
      on the returned permanent for free, with CR 601.2's charge-on-answer
      order pinned end to end.
      **Fifteen twins**, including Dimension X carrying Asgardian Citadel's
      EXACT printed text on a second oracle id (Benalish Trapper's
      precedent), the Dimir Cluestone/Locket pair, three dies-tokens on the
      new Goat/Zombie/old Treasure pins, a dies-trigger whose −2/−2 kills
      through the SBA, and Dispersing Orb — **the pool's TWELFTH
      enchantment**.
      ⚠️ **Five refusals, all existing ledger classes:** two discard-cost
      choosers (Deepwood Drummer, Devout Witness), a script-raised prompt
      (Dementia Bat), two tap-creatures costs (Devout Chaplain, Diversionary
      Tactics).
      Fixtures 363 → 387 (39 tokens: Bat `tlci 6`, Eldrazi `tcmm 1`, Goat
      `tncc 6`, Zombie `tc14 16`) · ladder [1046, 1145, 3098, 4982, 6169] ·
      `batch.json` at 934 (exact) · botDeck: Adun reaches 1,071.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      287 test files, 2,450 Vitest passed / 10 skipped · the 500-seed gate
      green at 1,258.6 s (217 scripts, 541 s inside the 1,800 s ceiling) ·
      build clean · probe 124/124 · battery 127/127 (gates held for an idle
      window per the standing rule; batch 14 classified in the hold).**
      ⚠️ **Reportables** (D171): the answer-mode arrow and ability rows owe
      a battery click-check (four features deep); the cost-chooser classes,
      `ctx.random`, once-per-turn memory, per-damage-entry granularity and
      the spell seam stand.

- [x] **M6.4p — Eighteen landed: the life-gain watcher, the cast-targets
      reader, and the enters-untapped filter (2026-08-06):** **1,965 of
      31,692 Commander-legal cards now execute completely, up from 1,947.**
      `SHIPPED_SCRIPTS` 217 → 235. Decisions in **D172**.
      **Three firsts:** `Drogskol Reaver` is the first def on `LifeChanged`
      (the filter is the delta's SIGN plus the controller; drawing does not
      gain life, so the loop closes itself — its own lifelink is the
      intended engine); `Druid of Horns` is the first cast-watcher reading
      the SPELL'S CHOSEN TARGETS off the `SpellCast` event's stack object
      (an Aura aimed elsewhere pays nothing, and a Tier-3 ATTACH without a
      cast pays nothing); `Dwarven Mine` is the first enters-UNTAPPED
      filter — D135's board query decides the tap, and the def reads its
      condition off the AFTER state, both halves proven from both sides.
      **Fifteen twins**, including `Driver of the Dead` — a dies-trigger
      REANIMATION with D139's numeric restriction enforced at the answer
      (mv 2 returns, mv 4 refused) — `Dragon Roost` as **the pool's
      THIRTEENTH enchantment** making two DISTINCT Dragons in one turn, and
      both new lands (`Dunes of the Dead`, `Dwarven Mine`) **joining the
      bot's deck** (Adun reaches 1,085).
      ⚠️ **Seven refusals, ONE new class:** `Dragon Broodmother`'s token
      carries DEVOUR — an as-enters choice on the CREATED permanent that
      nothing can raise (token entry choice). `Dromad Purebred` pins the
      RECEIVER side of per-damage-entry granularity (simultaneous sources
      batch into one event; the dealer side stays safe). Plus once-per-turn
      memory (Draugr Recruiter's Boast), exile-from-graveyard (Dread
      Rider), tap-permanents (Dune Diviner), tap-creatures (Dwarven
      Bloodboiler).
      Fixtures 387 → 410 (44 tokens: Spirit `tmm2 5`, Dragon `tkhm 11`,
      Hero `tfin 26`, Spider `tafr 7`, Dwarf `plst TELD-7`) · ladder
      [1028, 1127, 3080, 4964, 6151] · `batch.json` at 909 (exact).
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      305 test files, 2,530 Vitest passed / 10 skipped · the 500-seed gate
      green at 1,320.8 s (235 scripts, 479 s inside the 1,800 s ceiling) ·
      build clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D172): the answer-mode arrow and ability rows owe
      a battery click-check; the cost-chooser classes, `ctx.random`,
      once-per-turn memory, per-damage-entry granularity (four entries,
      both sides), token entry choice and the spell seam stand.

- [x] **M6.4q — The first zero-refusal sweep: all twenty-five landed
      (2026-08-06):** **1,990 of 31,692 Commander-legal cards now execute
      completely, up from 1,965.** `SHIPPED_SCRIPTS` 235 → 260. Decisions in
      **D173**.
      ⚠️ **A SWEEP, and the reason is the machinery**: eleven batches of
      D161 parse filters and the 36-entry REFUSED ledger have drained the
      un-landable shapes from the offer stream. Four cards carried
      engine-fact RISK at classification; all four facts were CHECKED
      before a line was written, and held.
      **Five firsts:** `Edgewall Innkeeper` filters casts on the printing's
      LAYOUT (`adventure`, cast face Creature — a real Tuinvale Treefolk
      cast in the test); `Eidolon of Inspiration` is the first
      beginning-of-combat targeted trigger (`StepBegan`/'beginCombat' +
      active-player filter; the Eidolon self-targets so CR 603.3d never
      removes it); `Elemental Bond` is the first power-threshold entry
      watcher (derived power ≥3, TWO defs per Soul Warden's token rule);
      `Emmara, Soul of the Accord` is the first becomes-tapped SELF watcher
      (`PermanentsTapped` covers every tap path, so one filter is the whole
      condition); `Emrakul's Influence` filters casts on MANA VALUE (D139's
      number) + Eldrazi + Creature.
      **Twenty twins**, including `Elvish Lyrist` on Druid Lyrist's exact
      text (Benalish precedent), `Elite Headhunter`'s hybrid
      another-or-artifact chooser that can never eat itself, and
      `Errant Doomsayers` reading TOUGHNESS where Ephara's Warden reads
      power. ⚠️ **FOUR enchantments in one batch — the pool reads
      SEVENTEEN**; **Emmara is the 51st fully-executable legendary**;
      Emrakul's Influence joined the bot's deck.
      Fixtures 410 → 440 (48 tokens: Goblin `tecl 6`, lifelink Soldier
      `tmom 2`, Eldrazi Horror `temn 1`, Gnome `tlci 16`) · ladder [1003,
      1102, 3055, 4939, 6126] · `batch.json` at 884 (exact — nothing
      refused).
      ⚠️ **The first full-gate run failed on the LAYER-6 CANARY rotting on
      schedule** — Levitation + Gravity Sphere at one copy each, diluted
      below one appearance in 60 seeds by four batches of DECK growth.
      Re-weighted to FIVE each (D149's fix, third instance of the class);
      the gate relaunched from the top.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      330 test files, 2,638 Vitest passed / 10 skipped · the 500-seed gate
      green at 1,396.4 s (260 scripts, 404 s inside the 1,800 s ceiling) ·
      build clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D173): the fuzz ceiling's headroom shrinks on
      schedule — self-only def dispatch (D169) is due before the trend
      closes it; the answer-mode arrow and ability rows owe a battery
      click-check; the cost-chooser classes, `ctx.random`, once-per-turn
      memory, per-damage-entry granularity, token entry choice and the
      spell seam stand.

- [x] **M6.4r — Twenty-three landed, and the 2,000 line is crossed
      (2026-08-06):** **2,013 of 31,692 Commander-legal cards now execute
      completely, up from 1,990** — the arc began at 1,730 sixteen batches
      ago. `SHIPPED_SCRIPTS` 260 → 283. Decisions in **D174**.
      **The headliner:** `Ertai, the Corrupted` composes D168's OR-predicate
      chooser with D170's counterspell pair through D169's staged chain —
      ZERO new engine work: a held cast dies to a sacrificed creature, a
      LAND is neither arm, and `Ertai, Wizard Adept` counters standing up.
      Both are LEGENDS — **the fully-executable legendary pool reads 53**.
      ⚠️ **One genuine fix found by its own test:** the infect ping
      (`Fallen Ferromancer`) hardcoded `applyAs: 'wither'`; combat.ts's own
      rule says infect versus a PLAYER is **poison** (CR 702.90b/c). The
      def branches per target kind now, both halves pinned.
      **Also:** the mv-4 any-spell Thopter spinner, the DECAYED-Zombie ETB
      (the token's own text tier3-disclosed on the token — the Blood
      precedent, so creating it is not half-execution), the artifact
      chooser paying with ITSELF (CR 113.7a), a NO-mana sacrifice cost
      (`Felidar Cub`), the any-enchantment-dies watcher, a self-inclusive
      targeted entry watcher in two defs, and two-token ETBs with
      distinct-id teeth.
      ⚠️ **Two refusals, both existing classes:** Ezio (per-damage-entry —
      a CLASS dealing combat damage widens Aya's dealer side) and Fearless
      Liberator (Boast, once-per-turn memory).
      Fixtures 440 → 465 (50 tokens: Faerie `tmoc 11`, decayed Zombie
      `tdrc 7`) · ladder [980, 1079, 3032, 4916, 6103] · `batch.json` at
      859 (exact).
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      353 test files, 2,736 Vitest passed / 10 skipped · the 500-seed gate
      green at 1,338.4 s (283 scripts, 462 s inside the 1,800 s ceiling) ·
      build clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D174): self-only def dispatch's due date is
      measured in batches; the answer-mode arrow and ability rows owe a
      battery click-check; the cost-chooser classes, `ctx.random`,
      once-per-turn memory, per-damage-entry granularity (five entries),
      token entry choice and the spell seam stand.

- [x] **M6.4s — Twenty-one landed: the first DiceRolled consumer, the
      nontoken dies watcher, and both twins in one batch (2026-08-08):**
      **2,034 of 31,692 Commander-legal cards now execute completely, up
      from 2,013.** `SHIPPED_SCRIPTS` 283 → 304 — past three hundred.
      Decisions in **D175**.
      **The firsts:** `Feywild Trickster` is the first def on `DiceRolled`
      — the Tier-3 dice tool's own event, on the log since M3 with no
      consumer; the per-event batching IS the card's "one or more"
      wording (Deeproot Pilgrimage's argument, D170), and the fuzz gate's
      manual-intent case already rolls dice, so the gate exercises it with
      no new machinery. `Field of Souls` is the first dies filter on
      `CardInstance.isToken` (Soul Warden's dies-mirror; both sides
      proven — a token dying pays nothing). `Fisk Tower` and `Foot
      Headquarters` carry ONE exact printed text on two new oracle ids —
      the first time BOTH twins of a text land in a single batch. Plus
      the first targeted script UNTAP (`Filigree Sages`, the tap def's
      mirror with the upright-target negative pinned).
      **Also:** a {7}{R} player-or-planeswalker burn; the chooser+staged
      chain on `Fodder Cannon`; `Flamekin Spitfire`'s any-target ping
      with the per-kind `applyAs` branch written at first cut (D174's
      lesson applied before a test could catch it); the THREE-line
      `Foggy Bottom Swamp` (mana a0, sac-draw #a1, enters tapped);
      `Foundry of the Consuls`' TWO Thopters with distinct-id teeth;
      ETB Food/Treasure/Clue makers; **the enchantment pool reads
      TWENTY-ONE** (Field of Souls + both Fonts). All 47 new per-card
      tests passed on their first run.
      ⚠️ **Four refusals, ONE new class:** `Floodbringer` and `Flooded
      Shoreline` name the RETURN-PERMANENT cost (the bounce-side sibling
      of the sacrifice chooser); plus once-per-turn memory (Firja) and a
      discard-cost chooser (Fodder Tosser). The ledger holds 42.
      Fixtures 465 → 488 (52 tokens: Faerie Dragon `tclb 6`, Clue
      `twho 21`) · ladder [959, 1058, 3011, 4895, 6082] · `batch.json`
      at 834 (exact) · botDeck: Foggy Bottom Swamp and Foundry of the
      Consuls join (Adun reaches 1,118).
      ⚠️ **The first full-gate run failed on the DIES canary rotting on
      schedule** — Onulet at ONE copy is the only card that canary
      counts, diluted to ZERO across 500 prompt-saturated seeds (every
      hash equal). Five copies now (D149's fix, FOURTH instance of the
      class); the gate relaunched from the top.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      374 test files, 2,825 Vitest passed / 10 skipped · the 500-seed
      gate green at 1,489.3 s (304 scripts, 311 s inside the 1,800 s
      ceiling) · build clean · probe 124/124 · battery 127/127.**
      ⚠️ **Reportables** (D175): self-only def dispatch stays the named
      fuzz lever; the answer-mode arrow and ability rows owe a battery
      click-check; the cost-chooser classes (now including
      RETURN-PERMANENT), `ctx.random`, once-per-turn memory,
      per-damage-entry granularity, token entry choice and the spell
      seam stand.

- [x] **M6.4t — Twenty-two landed: Glittermonger comes back, and three
      texts land as twins (2026-08-09):** **2,056 of 31,692 Commander-legal
      cards now execute completely, up from 2,034.** `SHIPPED_SCRIPTS`
      304 → 326. Decisions in **D176**.
      **The headliner is an arc closing:** `Glittermonger` — the card D147
      PULLED from the pool as a mana-ability misparse — returns as a real
      {T}-for-a-Treasure def through the ActivatedDef seam. What the
      parser was wrong to claim, a script now genuinely does.
      **Three texts land as twins in one batch** (each proven on its own
      oracle id): Gallant Citizen + Generous Stray carry ONE ETB-draw
      text and BOTH arrive here; Ghitu War Cry is Captive Flame's exact
      text; Gideon's Lawkeeper is the THIRD id on the Benalish Trapper /
      Blinding Mage tap line.
      **Filters proven by dropping them:** `Fugitive Druid` (Druid of
      Horns minus the caster filter — an OPPONENT's Aura cast at the
      Druid pays its controller, driven from the opponent's seat) and
      `Garrison Excavator` (Desecrated Tomb minus the mover's type — a
      LAND leaving the graveyard pays, Tomb's own negative case).
      **Also:** `Genghis Frog`, the first SUBTYPE-filtered self-inclusive
      entering watcher (two defs; its own Mutagen is an Artifact so the
      trigger cannot feed itself) and the 54th fully-executable legendary;
      `Gingerbread Cabin`, Dwarven Mine's enters-untapped filter on a
      FOREST count (`otherLandsOfType`'s second consumer, both halves both
      ways); the Lander on the Blood precedent; the untap actives one
      type over; **the enchantment pool reads TWENTY-TWO**. All 22 suites
      green on their first run — after one fixture-regen parse error (the
      Lander pin duplicated the token tool's existing const; the batch
      comment now says the Lander is REUSED).
      ⚠️ **Three refusals, all existing classes:** tap-permanents
      (Ghirapur Aether Grid), tap-creatures (Glare of Subdual),
      script-raised prompt (Gilt-Leaf Seer). The ledger holds 45.
      Fixtures 488 → 513 (55 tokens: Knight `tm21 4`, Gargoyle `tm10 8`,
      R/W Spirit `tsos 10`; Lander `teoe 6` reused) · ladder [937, 1036,
      2989, 4873, 6060] · `batch.json` at 809 (exact) · botDeck: Adun
      reaches 1,133 from 54 legendaries.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      396 test files, 2,924 Vitest passed / 10 skipped ·
      the 500-seed gate green at 1,423.1 s (326 scripts,
      377 s inside the 1,800 s ceiling) · build clean · probe
      124/124 · battery 127/127.**
      ⚠️ **Reportables** (D176): self-only def dispatch stays the named
      fuzz lever; the answer-mode arrow and ability rows owe a battery
      click-check; the cost-chooser classes, `ctx.random`, once-per-turn
      memory, per-damage-entry granularity, token entry choice and the
      spell seam stand.

- [x] **M6.4u — Twenty-one landed: the two-sentence resolve, and two new
      classes named by one Goblin page (2026-08-14):** **2,077 of 31,692
      Commander-legal cards now execute completely, up from 2,056.**
      `SHIPPED_SCRIPTS` 326 → 347. Decisions in **D177**.
      **The headliner:** `Gnottvold Slumbermound` is the first TWO-SENTENCE
      activated resolve — destroy target land AND make the Troll — and its
      test pins the rule that makes them two EFFECTS: against Darksteel
      Citadel the destruction stops at indestructible (CR 701.7b) and the
      Troll STILL arrives. Ark of Blight returns empty there and is right
      to; the Slumbermound may not.
      **Also:** the D168 chooser in three more shapes (Bombardment's
      mana-free creature pick on an enchantment ping; Sledder's GOBLIN
      subtype paying with ITSELF, CR 113.7a; Trenches' LAND predicate
      paying for two DISTINCT Goblin Soldiers) plus Rotwurm's {B} drain;
      targeted dies/ETB destroys through the trigger arrow; `Gnarlback
      Rhino` — the cast-targets reader with the caster filter KEPT, proven
      from the opponent's seat; `Gods' Eye, Gate to the Reikai`, the
      dies-token on a LAND; `Goldmeadow Harrier`, the FOURTH Benalish id;
      `Golgari Germination`'s controller-filtered nontoken watcher (its
      isToken negative proven by killing its own Saproling); and
      `Grandmother Sengir`, **the 55th fully-executable legendary**.
      **The enchantment pool reads TWENTY-FIVE.** All 21 suites — 50
      tests — green on their FIRST run; the three new token pins were
      mapped from TOKEN_TABLE's own printingIds BEFORE a line was written
      (the batch-18 lesson), and Goblin/Saproling were reused after
      checking they match.
      ⚠️ **Four refusals, TWO NEW classes, both named by one Goblin page:**
      `Goblin Warrens` (MULTI-SACRIFICE cost — D168's carrier names ONE
      permanent) and `Graf Mole` (SACRIFICE-EVENT DISCRIMINATOR — checked:
      `EventCause` has no sacrifice kind and `matches` receives the event
      BODY, so the watcher would over-fire on every death). Plus a
      discard-cost chooser (Goblin Picker) and Boast (Goldmaw Champion).
      The ledger holds 49.
      Fixtures 513 → 537 (58 tokens: Spirit `tema 1`, Goblin Soldier
      `tema 15`, Troll Warrior `tkhm 16`; Goblin `l12 1` + Saproling
      `tddj 1` reused) · ladder [916, 1015, 2968, 4852, 6039] ·
      `batch.json` at 784 (exact) · botDeck: Adun reaches 1,152 from 55
      legendaries.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      417 test files, 3,012 Vitest passed / 10 skipped ·
      the 500-seed gate green at 1,357.0 s (347 scripts,
      443 s inside the 1,800 s ceiling) · build clean · probe
      124/124 · battery 127/127.**
      ⚠️ **Reportables** (D177): the multi-sacrifice cost and the
      sacrifice-event discriminator join the engine-work list; self-only
      def dispatch stays the named fuzz lever; the answer-mode arrow and
      ability rows owe a battery click-check; the cost-chooser classes,
      `ctx.random`, once-per-turn memory, per-damage-entry granularity,
      token entry choice and the spell seam stand.

- [x] **M6.4v — Eighteen landed: Grave Titan, and three new classes in one
      letter (2026-08-14):** **2,095 of 31,692 Commander-legal cards now
      execute completely, up from 2,077.** `SHIPPED_SCRIPTS` 347 → 365.
      Decisions in **D178**.
      **The headliner:** `Grave Titan` — the first ENTERS-OR-ATTACKS pair:
      one printed line, two defs, each paying two DISTINCT Zombies; one
      test proves both arms in one game (two on entry, four after a real
      declared attack). `Haazda Vigilante` lands the same pair with D139's
      numeric spec; `Haazda Marshal` is the attacker-count filter with the
      self-among-them condition, both sides pinned.
      **Also:** Greed's life-cost draw (40 → 38 asserted); three sacrifice
      choosers incl. Gutless Ghoul paying with ITSELF (CR 113.7a); the
      Gruul Cluestone/Locket pair; dies-gains, dies-debuffs, targeted ETB
      pumps, the dies counter; Guarded Heir's two 3/3 Knights on a NEW
      pin. **The enchantment pool reads TWENTY-SIX.** All 18 suites — 41
      tests — green on their FIRST run: the THIRD consecutive
      first-run-clean batch.
      ⚠️ **Seven refusals, THREE NEW classes:** alternative activation
      cost (Granite Shard's "{3}, {T} or {R}, {T}"), ability-word
      activated cost (Half-Elf Monk's "Stunning Strike — {1}{W}, {T}:" —
      named as a parse-widening candidate), and graveyard-activated
      ability (Halo Scarab — the ability lives in a zone legal.ts never
      offers from). Plus exile-from-graveyard ×2, Boast, and a
      script-raised prompt. The ledger holds 56.
      Fixtures 537 → 556 (59 tokens: 3/3 Knight `tfdn 4`) · ladder [898,
      997, 2950, 4834, 6021] · `batch.json` at 759 (exact) · botDeck:
      Adun reaches 1,163 from 55 legendaries.
      ⚠️ **The first full-gate run failed on the MAY-TRIGGER canary rotting
      on schedule** — Ajani's Mantra at ONE copy is the only source either
      optional counter reads, diluted to ZERO at the 60-seed leg by DECK
      growth (every replay hash equal; the 500-seed leg itself green). Five
      copies now (D149's fix, EIGHTH instance of the class); the gate
      relaunched from the top.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      435 test files, 3,085 Vitest passed / 10 skipped ·
      the 500-seed gate green at 1,394.8 s (365 scripts,
      405 s inside the 1,800 s ceiling) · build clean · probe
      124/124 · battery 127/127.**
      ⚠️ **Reportables** (D178): the ability-word cost is the cheapest new
      class ever named (a scrub, not a seam); the cost-chooser classes,
      `ctx.random`, once-per-turn memory, per-damage-entry granularity,
      token entry choice, the spell seam, self-only def dispatch and the
      battery click-check debt stand.

- [x] **M6.4w — Twenty-one landed: the multicolored filter, and a draw
      nothing can watch (2026-08-14):** **2,116 of 31,692 Commander-legal
      cards now execute completely, up from 2,095.** `SHIPPED_SCRIPTS`
      365 → 386. Decisions in **D179**.
      **The headliners:** `Hero of Precinct One` is the first MULTICOLORED
      cast filter — the colour COUNT of the face actually cast, not the
      identity (a hybrid mono-colour card is not a multicolored SPELL),
      proven from both sides. `Harrier Griffin` is the first UPKEEP
      trigger that TARGETS (the prompt pinned to the CONTROLLER's turn);
      `Hatching Plans` is the enchantment that wants to die (the
      long-form dies wording, drawing three).
      **Also:** Heartwood Giant composes the Forest predicate with the
      staged chain; Herald of the Fair lands Haazda Officer's EXACT text
      on its own id; the controlled-entry watcher lands as TWINS (Healer
      of the Pride at 2, Hinterland Sanctifier at 1, each proven three
      ways); Headless Rider's nontoken-Zombie dies watcher is proven by
      killing its OWN token for nothing; Hoard Robber pays Treasure on
      connecting; two `#a1` sacrifice payoffs (Heart Warden paying with
      ITSELF); four ETB gains and a dies-gain pair. **The enchantment
      pool reads TWENTY-SEVEN.** All 21 suites — 51 tests — green on
      their FIRST run: the FOURTH consecutive first-run-clean batch.
      ⚠️ **Four refusals, THREE NEW classes for the second batch
      running:** token-predicate sacrifice cost (Hardened Tactician —
      predicatesOf models types, token-ness is an INSTANCE fact),
      put-counter cost (Hatchet Bully — the remove-counter chooser's
      other direction), and DRAW-EVENT DISCRIMINATOR (Horizon Chimera —
      drawFromTop emits a bare CardsMoved indistinguishable from an
      Impulse-take, and matches gets the BODY: Graf Mole one event over;
      a DrewCards marker unlocks the whole "whenever you draw" family).
      Plus a tap-creatures cost. The ledger holds 60.
      Fixtures 556 → 578 (60 tokens: Rabbit `tclb 4`; four pins REUSED
      after checking TOKEN_TABLE's printingIds) · ladder [877, 976,
      2929, 4813, 6000] · `batch.json` at 734 (exact) · botDeck: Adun
      reaches 1,174 from 55 legendaries.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      456 test files, 3,178 Vitest passed / 10 skipped ·
      the 500-seed gate green at 1,553.4 s (386 scripts,
      247 s inside the 1,800 s ceiling — self-only def dispatch is
      approaching due) · build clean · probe
      124/124 · battery 127/127.**
      ⚠️ **Reportables** (D179): the draw-event discriminator is the
      richest new class and the token-predicate the cheapest; the
      cost-chooser classes, D178's three, self-only def dispatch, the
      battery click-check debt, `ctx.random`, once-per-turn memory,
      per-damage-entry granularity, token entry choice and the spell
      seam stand.

- [x] **M6.4x — Twenty landed: attacks alone, four Hornets, and the Plains
      that is its own plural (2026-08-14):** **2,136 of 31,692
      Commander-legal cards now execute completely, up from 2,116.**
      `SHIPPED_SCRIPTS` 386 → 406 — past four hundred. Decisions in
      **D180**.
      ⚠️ **The headliner is a parser bug the batch's own test forced out:**
      `Idyllic Grange` counts "three or more other Plains" and D135's
      `otherLandsOfType` strips a trailing `s` — the capture read "Plain",
      a subtype NO land has, and the count read zero forever. PLAINS IS
      ITS OWN PLURAL, the only basic whose printed plural equals its
      subtype; every earlier consumer counted Forests/Mountains and was
      right, so the bug sat latent since D135 in the exact
      looks-like-working shape D135 warned about. Fixed in
      `replacementParse`, both halves proven both ways.
      **The firsts:** Imperial Subduer's ATTACKS-ALONE filter (exactly one
      declared attacker, the two-attacker negative pinned); Hornet Queen's
      FOUR deathtouch-flying Insects with distinct ids — the largest
      single token drop yet (NEW pin `tc21 17`); Ichor Wellspring's
      enters-OR-dies pair on an ARTIFACT, both arms drawn in one game.
      **Also:** Hurler Cyclops on the chooser+target chain ("another" —
      it can never eat itself); Insight paying only on an OPPONENT'S
      green cast; the owner's-hand bounce; the indestructible-checked
      entry destroy (Darksteel Myr survives); the entry untap; the
      activated targeted pump; the Sanctifier text's THIRD id. **The
      enchantment pool reads TWENTY-EIGHT.** 19 of 20 suites first-run
      green; the twentieth failed on the Plains bug, which is the test
      doing its job.
      ⚠️ **Five refusals, TWO NEW classes:** snow activation cost
      (Icebind Pillar — the engine has NO snow-source concept, and
      charging the {T} without the {S} is half-execution) and reveal-cost
      chooser (Illuminated Folio — a constrained pick over a hidden zone
      as a COST). Plus discard-cost, script-raised prompt, and Infernal
      Tribute — the token-predicate class holding both directions. The
      ledger holds 65.
      Fixtures 578 → 600 (62 tokens: two new Insect pins; three pins
      REUSED after checking TOKEN_TABLE) · ladder [857, 956, 2909, 4793,
      5980] · `batch.json` at 709 (exact) · botDeck: Adun reaches 1,185
      from 55 legendaries.
      ⚠️ **The first full-gate run failed on the CR 616 PAIR canary
      rotting on schedule** — a PAIR canary rots QUADRATICALLY (both cards
      must share one battlefield), and five copies each had decayed to a
      true rate of ~1–3 per 500. FIFTEEN copies of each now (~9× the
      compound rate; ninth rot instance, second re-weight of this canary —
      a third earns a canary-staples mechanism, not a fourth multiply);
      the gate relaunched from the top.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      476 test files, 3,266 Vitest passed / 10 skipped ·
      the 500-seed gate green at 1,774.5 s (406 scripts + the pair
      re-weight, **26 s inside the ceiling — THE WALL HAS ARRIVED:
      self-only def dispatch is DUE before batch 23**, the D162
      precedent) · build clean · probe
      124/124 · battery 127/127.**
      ⚠️ **Reportables** (D180): the snow cost is a bounded gap; the
      reveal-cost chooser joins the ledger; the draw-event discriminator
      stays the richest class; self-only def dispatch, the battery
      click-check debt, `ctx.random`, once-per-turn memory,
      per-damage-entry granularity, token entry choice and the spell seam
      stand.

- [x] **M6.4y — The lever that measured flat, and the third ceiling
      (2026-08-14):** no cards land here. The fuzz gate's ceiling rises
      1,800 s → 3,600 s on its stated criterion — D180's round 31
      COMPLETED all 500 seeds with every replay hash equal at 1,774.5 s,
      26 s under the old ceiling — and the lever named since D169 is
      RETIRED. Decisions in **D181**.
      ⚠️ **"Self-only def dispatch" was tried and measured FLAT.**
      Implemented as the candidate loop's reorder (`matches` before the
      `hasAbilities` derive — structurally identical by
      conjunction-commutes), a 60-seed idle leg moved 221.6 s → 222.3 s:
      zero. Behind D162's per-oracle index and D168's present-def memo
      the bus was already at the floor; D167's verdict — the cost is the
      GAMES, not the bus — re-confirmed at 406 scripts. The reorder was
      REVERTED the hour it was measured (D162's rule: a lever that does
      not move the number does not ship), and the standing reportable is
      STRUCK.
      ⚠️ The gate's trend table now runs 394 s @ 57 → 1,774.5 s @ 406,
      near-linear in scripts; 3,600 s restores ~2× headroom (~forty more
      batches), and a fourth raise needs the same completed-and-equal
      proof. If wall TIME itself ever becomes the problem, the levers
      are game-shaped (intents per seed, seed profile, shards) — each a
      gate-strength tradeoff to be priced, not assumed.
      **Verified: `npm run build` clean · the 60-seed fuzz leg green at
      ~222 s in BOTH orders (the A/B) · no engine behavior change in the
      committed tree (the experiment is reverted; the ceiling is test
      config).** The next batch's full gate exercises the new ceiling —
      D170's precedent for a ceiling raise riding its own commit.

- [x] **M6.4z — Twenty-two landed: attacks or blocks, and a four-id text
      family (2026-08-14):** **2,158 of 31,692 Commander-legal cards now
      execute completely, up from 2,136.** `SHIPPED_SCRIPTS` 406 → 428.
      Decisions in **D182**.
      **The headliner:** `Jedit Ojanen of Efrava` is the first
      ATTACKS-OR-BLOCKS pair — and the blocks arm is the FIRST
      `BlockersDeclared` consumer this engine has (the event carried its
      blocks since M3 with nothing watching). Both arms pay the
      forestwalk Cat Warrior; the blocks test drives a REAL scripted
      attack from the opponent's seat.
      **The families:** the +1/+1-counter targeted entry lands as a
      FOUR-ID text family (Ironpaw Aspirant, Ironshell Beetle, Jeong
      Jeong's Deserters, and Iron Bully behind a Menace header) — the
      largest yet; Jayemdae Tome carries Arcane Encyclopedia's exact text
      back to D159's first activated; the Izzet Cluestone/Locket pair is
      the fifth colour pair, Jeskai Banner the three-colour extension.
      **Also:** Intrepid Hero's tap-destroy behind D139's numeric floor
      (Grave Titan dies, Bears refused); Ivy Lane Denizen's
      colour-filtered controlled-entry watcher with a targeted counter;
      Izzet Chronarch's graveyard return; Jarvis's Hero-subtype
      cast-watcher — proven POSITIVE with Spider-Ham, Peter Porker, the
      first Hero-subtype fixture, queried from the DB rather than tested
      only by negation. **Three more legendaries — the pool reads 58.**
      All 22 suites — 48 tests — green on their FIRST run.
      ⚠️ **Three refusals, ONE new class:** last-drawn-card memory cost
      (Jandor's Ring — no per-turn draw identity exists; the draw-event
      discriminator's sibling, and a `DrewCards` event with the card id
      would unlock BOTH). Plus discard-cost and remove-counter. The
      ledger holds 68.
      Fixtures 600 → 625 (64 tokens: Ally `ttla 8`, Cat Warrior
      `tc18 15`; Saproling reused) · ladder [835, 934, 2887, 4771,
      5958] · `batch.json` at 684 (exact) · botDeck: Adun reaches 1,194
      from 58 legendaries.
      **Verified: `verify.cjs --full` — ALL FIVE GATES in one invocation:
      498 test files, 3,358 Vitest passed / 10 skipped ·
      the 500-seed gate green at 1,982.2 s (428 scripts,
      1,618 s inside the 3,600 s ceiling — the first run under
      D181's raise, and it would have BREACHED the old 1,800 s: the
      raise landed exactly on time) · build clean · probe 124/124 ·
      battery 127/127.**
      ⚠️ **Reportables** (D182): a `DrewCards` event with the card id
      unlocks both draw classes at once; the cost-chooser classes,
      `ctx.random`, once-per-turn memory, per-damage-entry granularity,
      token entry choice, the spell seam and the battery click-check
      debt stand.

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
