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
| **3 — manual with helpers** | NOT enforced, **and said so on the card** (`src/data/tier3.ts`, shown in the hover zoom — D68). The player reads the card and uses a tool. | Every other card ability. Tools: move any card between any zones, create tokens, add/remove counters, adjust life/mana, tap/untap anything, reveal cards, roll dice, flip coins |

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
node scripts/battery-anim.cjs flight table tap hand choreo beats hud fx combat engine drag net motion perf
node scripts/two-instance.cjs                         # M4 SIGN-OFF: two real apps, one LAN socket
node scripts/two-instance.cjs --keep                  #   leave both windows up to poke at
node scripts/two-instance.cjs --offline               # M5 OFFLINE AUDIT: the same, with DNS dark
npm run audit:bundle                                  # M5: what is actually inside release/
node scripts/install-proof.cjs [--uninstall]          # M5: install it, and ask it where its files are
node scripts/battery-relay.cjs                         # the RELAY: rooms, blind forwarding, restart
node relay/src/server.js 5281                         # the standalone relay (needs `npm i` in relay/)
node scripts/make-engine-fixtures.cjs                 # regenerate src/data/fixtures/engineCards.ts
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
   and silent for a card the engine handles completely. See D68.
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
