# Commander's Roundtable — Implementation Plan

## Context

You want a desktop app to play Magic: The Gathering — Commander with 2–4 friends over the
internet, using your own decks, where **the app does the rules bookkeeping** the way MTG Arena
does — not a manual sandbox where everyone drags cards and tracks life on paper. The deliverable
is an installable Windows EXE you can send to friends or host for download. Beyond the spec in
`C:\Users\apps\Desktop\commander-game-desktop-prompt.md`, you asked specifically for
**Arena-style animations when drawing cards and putting cards into zones** — that is treated
here as a first-class subsystem, not polish.

Two things in the source prompt collided with the mandatory workspace policy in
[AGENTS.md](AGENTS.md); both are now resolved by your decisions below.

### Decisions locked (this session)

| Decision | Answer |
|---|---|
| Runtime | **Electron** (workspace mandate; prompt's Tauri preference overridden). |
| Card data | **Scryfall bulk JSON + per-deck art prefetch**, cached to disk. Approved internet exception. |
| Multiplayer | **Relay (room codes) + direct-IP/LAN fallback.** Relay ships in-repo, deploy-ready. |
| Animation tech | **DOM + `motion` (framer-motion successor) + a Canvas2D FX layer.** No PixiJS. |
| Name | **Commander's Roundtable** → `H:\Claude Apps\commanders-roundtable`, tokens `--crt-*`, dev handle `window.__crt`, appId `com.commanders-roundtable.app`. |
| Delivery | **5 milestones, your sign-off between each.** |
| Testing | **Vitest for `src/engine/` + `src/net/`** (a workspace first, devDependency only). CDP probes for the shell. |
| Rewind | **Build group rewind** (propose → pod accepts → host re-folds the log). |

### Ports (5280–5282; everything below 5280 is taken by sibling apps)

`5280` Vite · `5281` relay in dev · `5282` LAN host listener (opens only while hosting a LAN game).

---

## Architecture

```
                          RELAY (relay/, Node + ws, on a VPS)
                     room registry · blind forwarding · zero game logic
                                    ▲            ▲
                            wss://  │            │  wss://
┌───────────────────────────────────┴──┐   ┌─────┴──────────────────────────────┐
│ HOST app                             │   │ GUEST app                          │
│ ┌──────────────────────────────────┐ │   │ ┌────────────────────────────────┐ │
│ │ src/engine/  PURE + DETERMINISTIC│ │   │ │ src/engine/ (present, IDLE)    │ │
│ │  handle(intent) → Event[]        │ │   │ │  used only for replay/rewind   │ │
│ │  apply(state, event) → state     │ │   │ └────────────────────────────────┘ │
│ │  append-only log (NDJSON on disk)│ │   │ ┌────────────────────────────────┐ │
│ │  project(state, playerId) → View │ │   │ │ PlayerView + redacted events   │ │
│ └───────────────┬──────────────────┘ │   │ └──────────────┬─────────────────┘ │
│  own PlayerView │  redacted events   │   │                │                   │
│ ┌───────────────▼──────────────────┐ │   │ ┌──────────────▼─────────────────┐ │
│ │ CHOREOGRAPHER → beats → React UI │ │   │ │ CHOREOGRAPHER → beats → React  │ │
│ └──────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ Electron main: card DB · images ·    │   │ (same binary — anyone can host)    │
│  decks · LAN listener · updater      │   │                                    │
└──────────────────────────────────────┘   └────────────────────────────────────┘
```

**The one invariant everything rests on:** every state change — including all Tier-3 manual
tools — goes through an event appended to the log. Nothing mutates state off-log. That single
property gives us replay, reconnect, rewind, the trigger bus, and the animation cue stream for free.

### Repo layout

```
commanders-roundtable/
  AGENTS.md  CLAUDE.md(pointer)  PRODUCT.md  docs/DECISIONS.md  docs/INSTALL-AND-PLAY.md
  electron/     main.cjs  window.cjs  preload.cjs  paths.cjs  settings.cjs
                cardsvc.cjs (card-DB worker supervisor)  scryfall.cjs (host-allowlisted fetch)
                cardimg.cjs (protocol.handle)  lanServer.cjs  decks.cjs  updater.cjs
  scripts/      dev-launcher.cjs  probe.cjs  make-icon.cjs
  src/engine/   types/{state,events,intents,views}.ts  rng.ts  hash.ts  ids.ts
                zones.ts  reducer.ts  characteristics.ts  keywords.ts  turn.ts  sba.ts
                triggers.ts  loop.ts  legalActions.ts  mana.ts  payment.ts  stack.ts
                combat.ts  project.ts  log.ts  scripts/{api,registry}.ts
                handlers/{setup,mulligan,priority,cast,mana,combat,manual,rewind}.ts
  src/net/      protocol.ts  host.ts  client.ts  lobby.ts
                transports/{loopback,relay,direct}.ts
  src/data/     oracle.ts  parseManaCost.ts  parseTypeLine.ts  decklist.ts  validate.ts
  src/ui/       anim/{rectRegistry,flightLayer,choreographer,tokens,beats,FxCanvas}.ts(x)
                table/{GameTable,PlayerSeat,OpponentSeat,BattlefieldBand,HandFan,
                       StackDisplay,ZonePile,PromptBar,ManualToolsPanel}.tsx
                card/{Card,CardZoomPanel,SyntheticFace,ManaCost,PowerToughness}.tsx
                hud/{PlayerPlate,LifeCounter,CommanderDamageMatrix,ManaPool,PhaseTrack,GameLog}.tsx
                screens/{Home,Decks,DeckImport,CardDatabase,Lobby,Settings}.tsx
  src/store/    gameStore.ts  promptStore.ts  animStore.ts  settingsStore.ts
  relay/        package.json  server.mjs  rooms.mjs  limits.mjs  README.md   ← separate package
  build/icon.ico   create-shortcut.ps1   start-commanders-roundtable.{bat,vbs}
```

`relay/` is its own npm package with its own `package.json`, excluded from `build.files` so it
never enters the installer. `src/engine/` must not import React, Electron, Node, or zustand —
a regex test enforces this (see Verification).

---

## Reuse, don't reinvent

| Need | Copy from |
|---|---|
| `package.json` scripts + whole `build:` block (incl. `electronDist: ".electron-dist"` EPERM workaround, NSIS desktop shortcut, `publish.owner: "OWNER"`) | [mundifex/package.json:9](mundifex/package.json:9) |
| `vite.config.ts` (`base:'./'`, `port: Number(process.env.PORT) \|\| 5280`, `strictPort`, `assetsInlineLimit:0`) | [mundifex/vite.config.ts](mundifex/vite.config.ts) |
| Window creation, per-env CSP, `will-navigate` origin check, `setWindowOpenHandler` deny, prod menu off, updater OWNER-skip | [mundifex/electron/main.cjs](mundifex/electron/main.cjs) |
| Capability-gated FS (`authorizedFiles`/`authorizedDirs`/`appWritableDirs`, `canReadPath`/`canWritePath`, `path.basename` stripping) + **SSRF host-allowlist fetch** (exact host, timeout, byte cap) — the Scryfall fetcher template | [cartapriscus/electron/main.cjs](cartapriscus/electron/main.cjs) |
| Long-lived worker supervisor: state machine, log ring, reuse-don't-own, tree-kill on quit | [mundifex/electron/engine.cjs](mundifex/electron/engine.cjs) |
| Streamed download + throttled progress + sha256 + redirects, and the `require.main === module` headless-CLI pattern | [mundifex/electron/setup.cjs](mundifex/electron/setup.cjs) |
| `scripts/dev-launcher.cjs` reuse-or-start + `launch.log` (port 5280) | [mundifex/scripts/dev-launcher.cjs](mundifex/scripts/dev-launcher.cjs) |
| Headless-Electron probe + offline-audit script | [ancient-script-picker/scripts/probe.cjs](ancient-script-picker/scripts/probe.cjs) |
| `AGENTS.md` 13-section template; `docs/DECISIONS.md` numbered format | [mundifex/AGENTS.md](mundifex/AGENTS.md), [cartapriscus/AGENTS.md](cartapriscus/AGENTS.md) |
| CSS keyframe/token idiom (`var(--dur)`, `var(--ease)`) | [cartapriscus/src/stages/mapper/index.css:367](cartapriscus/src/stages/mapper/index.css:367) |
| Dev-handle exposure pattern (`window.__mx` under `import.meta.env.DEV`) | [mundifex/src/App.tsx:41](mundifex/src/App.tsx:41) |

Versions to match the workspace: react/react-dom `^19.2.4`, zustand `^5.0.11`, tailwindcss +
`@tailwindcss/vite` `^4.2.1`, lucide-react `^1.21.0`, electron-updater `^6.8.3` (**dependency**),
electron `^42`, electron-builder `^26.8.1`, vite `^8`, typescript `~5.9.3`.
New here: **`motion@^12.42.2`** (successor to framer-motion; peer react `^18||^19`; import from
`motion/react`), `mana-font@^1.18.0` (SIL OFL, local woff2), `vitest` (dev), plus fontsource
packages. Add `"overrides": { "@types/react": "^19.2.14", "@types/react-dom": "^19.2.3" }` to
pre-empt Motion's duplicate-React-types TS failure.

---

## Engine core — the shapes that everything else is downstream of

**State layout: flat map + ordered id arrays.** `cards: Record<InstanceId, CardInstance>` plus
`zones.hand[playerId]: InstanceId[]`, `zones.library[playerId]: InstanceId[]`, etc. Chosen over
nested arrays because every zone change is then an id splice (cheap, easy to diff for the wire
patch) and a card is reachable in O(1) from any reference — the stack, combat, and attachments
all hold ids, not objects.

**Derived characteristics are computed, never stored.** `derive(state, id) → { power, toughness,
typeLine, colors, keywords, ... }` runs the CR layer pipeline, with only layers 1 (base), 7b
(counters), 7d (manual override) live in v1. Card scripts later add layers 6/7c with no call-site
changes. A per-pass `makeDeriveCache` keyed on `state.eventCount` keeps it cheap.

**Intents vs Events.** Clients send `Intent` (`CastSpell`, `TapPermanent`, `PassPriority`,
`DeclareAttackers`, `ManualMoveCard`, `ProposeRewind`, …). Only the host runs
`handle(state, intent, rng) → Event[] | Reject`, then folds with `apply(state, event) → state`.
Randomness enters **only** through a seeded PRNG whose `rngBefore`/`rngAfter` are recorded on
the event, so replay is bit-exact.

**The loop.** `pump()` iterates `advance()`, which does, in strict order: (1) state-based-action
pass, repeating until a pass yields nothing (CR 704.4); (2) trigger drain in APNAP order;
(3) return `[]` if blocked on human input; (4) turn-based actions for the step; (5) priority —
grant, or resolve the top of the stack, or end the step (emitting `ManaPoolEmptied`).
Steps 1→2→3 in that order is what makes CR 117.5 structural instead of a hand-rolled loop
someone forgets to call.

**Auto-pass ("stops") is what makes it feel like Arena.** `shouldAutoPass()` passes for you only
when you have no *meaningful* action — where `meaningfulActions` excludes tapping lands (else a
player with one untapped land never auto-passes) but never skips an available land drop. A
`[my turn | others' turns] × [10 steps]` toggle grid, `Ctrl` held to force a stop, and
`HoldPriority` as a one-shot.

**Mana auto-tap** is a three-tier solver: a necessary-condition filter (O(|S|·6), memoized —
this is what flags every card in hand as affordable), then a greedy "spend the least flexible
source first" pass (~95% of boards), then min-cost max-flow only when greedy fails
(V≤64, E≤340 → well under 1 ms). Conditional sources ("spend only on…") are excluded from
auto-tap but stay manually tappable — the Tier-2/Tier-3 boundary made explicit rather than
guessed. Commander tax folds `2 × commanderCastCount` into the generic requirement and the
counter increments *after* the cast completes.

**Casting is a resumable state machine in `GameState`, not UI state** (`PendingCast` with stages
`modes → targets → x → pay → ready`). That is the difference between "Bob dropped while choosing
targets" being recoverable and being fatal.

**Projection is the hidden-information boundary** — one file, `src/engine/project.ts`. Opponent
hands become `{id, hidden:true}` entries, libraries become counts, face-down permanents show a
sentinel oracle id to everyone but their controller, `legalActions` and `awaiting` payloads are
stripped for other players. Reconnect sends a **full snapshot**, not a log replay, plus a state
hash the client verifies.

Defaults adopted without further asking (all recorded in `docs/DECISIONS.md`): free first
mulligan **on**; CR 903.9a commander-to-command-zone = **ask, with "always do this"**; Tier-2
keywords include landwalk/fear/intimidate/skulk/shadow/horsemanship and ward-as-tax, while
phasing/changeling are out; combat damage auto-assigned with an opt-in "let me assign" stop; a
disconnected player the game is waiting on **pauses indefinitely** with a "pass for <name>"
button anyone can use (every such pass is a logged event); two commanders supported
(Partner / Partner with / Background / Friends forever / Doctor's companion, plus a one-entry
Grist override); log-format + oracle-snapshot mismatch on join is a **hard reject** — two players
on different Scryfall snapshots produce unfalsifiable rules disputes.

---

## The animation system (the differentiating ask)

**Mechanism: a portal flight layer with FLIP on a clone.** Not `layoutId`/`LayoutGroup` — that
animates the element in its *new* DOM parent, so `overflow:hidden` on the hand clips the
in-flight card, sizes match via `scale()` which distorts all ~20 card sub-elements, and it is
render-driven so it cannot be sequenced, coalesced, or skipped. Not View Transitions — only one
can run at a time and a Commander table routinely animates three things at once. **No `layoutId`
anywhere in this app.** Two mechanisms only: declarative variants for beats *inside* a zone
(tap, lift, thump, fan reflow), and the imperative flight layer for anything crossing zones.

Because it is rect-to-rect, **arbitrary zone→zone is the default path, not a special case** —
which is exactly what the Tier-3 "move any card anywhere" tool needs.

```ts
// src/ui/anim/rectRegistry.ts — the ONLY legal caller of getBoundingClientRect
resolve(cardId, zone): DOMRectReadOnly   // card slot → zone anchor → viewport centre; never throws
// src/ui/anim/flightLayer.ts — module singleton
fly(spec: FlightSpec): Promise<void>     // resolves on land OR cancel; never rejects
```

Every card slot registers `card:<instanceId>`; every zone registers `zone:<zoneId>` on an anchor
(pile top, hand-count chip). Three-tier resolution with a viewport-centre floor is why hidden
zones and collapsed pods need no special handling.

**Handoff is commit-then-fly:** read the source rect *before* the state write → mark `inFlight`
and commit → React renders the destination slot with `visibility:hidden` (it still occupies
layout, so destination geometry is final, and **the hand re-fans immediately while the card
flies** — exactly Arena) → read the destination rect in `useLayoutEffect` → start the clone →
on land, clear `inFlight` in the same frame the clone unmounts. One MotionValue and zero React
renders per flight; arc is a quadratic bezier bowed away from the nearest viewport edge.

**Motion tokens** live in `src/ui/anim/tokens.ts` and nothing hard-codes ms. Nothing exceeds
520 ms except the life counter; the settle always overshoots (`EASE.overshoot` peaks 1.56,
springs bounce 0.34–0.42); taps are 180 ms so the board never feels gummy.

Named beats, each a parameterisation of the generic flight: **draw** 420 ms, arc 0.22, stagger
60 ms, `rotateY 180→0` crossing 90° at the apex so the card flips face-up mid-flight, settling
with `SPRING.settle` overshoot · **hand hover** lift 54 px with neighbours parting by
`26·e^(−0.55·distance)` px, 90 ms open / 60 ms close intent delay · **cast** 100 ms lift → 520 ms
arc-to-stack with a travelling colour-identity glow, hand re-fanning concurrently → 360 ms stack
flourish (ring + 26-particle burst) · **resolve→battlefield** 300 ms accelerating down + 260 ms
`SPRING.thump` squash-and-rebound + dust · **land drop** a deliberately quiet 200 ms (lands happen
40× a game) · **tap** 180 ms spring rotate 20.5° with a low-centre pivot; untap-all sweeps the row
at 34 ms stagger · **attack lunge** 340 ms toward the defending pod with a canvas ribbon ·
**block intercept** 300 ms to a computed midpoint that keeps both cards visible · **damage punch**
480 ms DOM number, overshoot 1.34 then float up and out · **death** 440 ms desaturate-and-drop
→ 300 ms flight to the graveyard pile.

**The choreographer** (`src/ui/anim/choreographer.ts`) is the event→beat bridge and is where the
hard problems live. Events sharing an engine step form a group; groups run in order (LIFO stack
resolution must be *visible* in order); within a group, beats with disjoint resource keys run
concurrently and beats sharing a key serialize; the `card` lane caps at 6 concurrent flights.

- **Lag model:** a group's view commits to `gameStore` when that group *starts*, so state leads
  animation by at most one group (~500 ms), never by a whole batch. `promptStore` updates from
  the newest view **immediately** — whose priority it is can never lag.
- **Speed governor** on queued milliseconds: ≤600 → 1.0×; 600–1800 → lerp to 2.5×; >1800 → 3.0×
  plus coalescing; >4000 or >24 groups → **drain** (commit newest view, play 120 ms zone-flash
  digests, hard-sync).
- **Coalescing:** n draws → one staggered beat; n taps in a row → one row sweep; life changes
  **retarget** the running counter rather than queueing; damage to one target sums into one
  punch; and A→B→C for one card in a group flies **only the last hop** (cast → countered →
  graveyard should not fly to a stack you already know it left).
- **Failsafes so a dropped animation can never wedge the UI:** every beat is
  `Promise.race([run(), timeout(3×duration + 400)])`; a 250 ms watchdog drops to drain mode after
  2 s of no progress; the flight layer self-reaps clones older than 3 s; and an `epoch` counter
  discards any beat built before a reconnect.
- **Convergence guarantee:** `animStore` may only *hide* or *decorate* — it never holds
  card→zone truth. So the DOM's zone membership is always authoritative state, the worst failure
  is a card invisible for the flight duration, and a reconciler clears orphaned `inFlight`
  entries every 500 ms. The visual layer may lag by at most ~2 s and always converges.
- **Reconnect** calls `applySnapshot()`: reset the queue, cancel all flights, bump epoch, set
  state, one 240 ms table fade + "Resynced" toast. No animation.
- **Skip / speed:** settings `Cinematic 1.0× / Brisk 1.4× / Fast 2.2× / Off`; hold `Space` sets
  every live `AnimationPlaybackControls.speed = 4`; `Esc` flushes everything to its final pose.
  `prefers-reduced-motion`, speed `Off`, an inactive table, or drain mode all route to the same
  **digest mode** — no clones, a 140 ms fade plus outline pulse instead, and the game log carries
  the full narrative so no information is lost.

**FX layer: Canvas2D + rAF, not WebGL.** 1200 additive sprites at 1080p is nowhere near a
bottleneck on a 3060, and a second GPU context would compete with the compositor for nothing.
SoA pool (8 × `Float32Array(1200)` = 38 KB), one `globalCompositeOperation='lighter'` batch,
DPR re-read on every resize (Windows display scaling changes at runtime), and the loop **parks
itself** when idle. Per-card glow stays CSS `drop-shadow` so it travels with the flight clone
for free. **All FX text is DOM, never canvas** — which structurally satisfies this workspace's
tofu rule (no `document.fonts.load()` race can bake tofu into a texture).

**Card faces: full Scryfall `png` (745×1040) + a thin legibility chrome layer sized in CSS px.**
The printed image alone is unreadable below ~190 px and its printed P/T is *wrong* the moment a
+1/+1 counter lands; hand-drawing Arena-style frames means 15+ variants (sagas, classes, battles,
levelers, adventures) for months of work and a *less* faithful result. Chrome re-renders only
name strip, cost pips, **current** P/T, and a type glyph. Four modes off one `Card.tsx`: `full`
(H≥120), `chit` (96–120, `art_crop` filling the top 62% — strictly more information per pixel
than a shrunken full card), `back`, `pile`. Cold-cache fallback is a **`SyntheticFace`** — colour
identity gradient + name + cost + type line from the always-local oracle JSON, fully playable,
never a blank rectangle and never a spinner. Images load through a custom `cardimg://` protocol
registered in main (dodges CSP pain, arbitrary cache dir, clean 404s); we `await img.decode()`
then drop the reference so Chromium's own image cache handles eviction rather than us holding
1.2 GB of ImageBitmaps.

**Visual direction:** a deep desaturated blue-green table so the five saturated MTG colours read
cleanly on top, with a **brass accent that is deliberately not one of the five** so an accent
ring never reads as "red mana". The five colours are lightness-matched in OKLCH and appear in
exactly five places: mana pips, a 2 px edge bar on stack items and log rows, the flight glow,
the mana pool wells, and a gradient underline on each seat's nameplate (quietly the most useful
colour use in the app — it is how you tell four pods apart at a glance). Table surface is four
stacked CSS layers with zero image assets. Type: Alegreya (display/card names — stated plainly,
**MTG's Beleren is WotC-proprietary and not on fontsource**; Alegreya is the closest open
substitute and has real small caps), Alegreya SC, Inter, Crimson Pro for oracle text, JetBrains
Mono `tabular-nums` for every number, `mana-font` for symbols. All local packages, no CDN.

⚠️ Three workspace CSS footguns this app must not step in: resets go in `@layer base` only
(an unlayered `*{margin:0;padding:0}` silently zeroed 111 Tailwind spacing utilities here twice);
`@theme` must become `@theme inline` the moment a token value references a scope-local var
(otherwise every `border-*` falls back to `currentColor` — white lines everywhere); and
`window.prompt()` throws in Electron, so every text/number input is a real dialog component.

---

## Milestones

Each milestone ends runnable, with a verification battery, and stops for your sign-off.

### M1 — Foundation: shell, card database, decks

1. Scaffold + shell boots. `package.json`, vite/tsconfigs, `electron/main.cjs` + `window.cjs` +
   `preload.cjs`, launcher chain (`.lnk` → `.vbs` → `.bat` → `dev-launcher.cjs`),
   `create-shortcut.ps1`, icon, AGENTS/CLAUDE/PRODUCT/DECISIONS stubs.
   → `npm run build` clean; `npm run desktop` opens a window and `launch.log` shows reuse-or-start;
   CDP `!!window.commandersRoundtable`; `eval('1')` throws and `fetch('https://example.com')`
   rejects under the prod CSP.
2. Data root + settings + window state. **The cache lives at `C:\Users\apps\.commanders-roundtable\`,
   not `%LOCALAPPDATA%`** — the Claude desktop app is MSIX-containerized and virtualizes
   `%LOCALAPPDATA%` writes from an agent session, so a cache written while building would not be
   the directory your real app reads (mundifex hit exactly this, decision D15).
   → settings round-trip through CDP; the JSON file's first byte is `0x7B`, **not a BOM**;
   relaunch restores bounds; a bogus saved rect still lands on-screen.
3. Capability gate + deck file I/O. Port the three allowlists and `canReadPath`/`canWritePath`.
   → traversal attempts refused; grep `electron/` for any path-taking handler without a gate → zero hits.
4. `cardimg://` protocol + `Card.tsx` + `SyntheticFace` + zoom panel.
   → a known 745×1040 PNG loads to `[745,1040]`; traversal → 400/403; **the same load passes under
   the headless prod-CSP probe**; with an empty cache dir every card falls to a legible SyntheticFace.
5. Card-DB worker supervisor + Scryfall fetcher. `default_cards` bulk file (~550 MB on disk, every
   English printing — needed so a decklist's `(LTC) 264` resolves to the printing you asked for;
   `oracle_cards` is 4× smaller but loses printings and art variants, which conflicts with your
   never-reduce-fidelity rule). Streamed, atomic (temp + rename), resumable via `Range`,
   cancellable, host-pinned to `api.scryfall.com`/`cards.scryfall.io`, with the required
   User-Agent/Accept headers and ~10 req/s ceiling.
   → exactly 2 outbound requests per sync; kill mid-download → resumes at N bytes; cancel leaves
   the partial `.gz` and nothing else; `assertAllowedUrl('https://example.com/x')` rejects.
6. NDJSON + offset index build; query API (exact name, folded name, prefix, fuzzy, by id, by
   set+collector). Cold `loadIndex` under 500 ms; truncating the index rebuilds **with no network**.
7. Image queue + per-deck prefetch (`png` tier, ~0.9 MB/card ≈ 86 MB/deck, concurrency 6,
   ≥100 ms spacing, backoff, persisted queue that resumes next launch, DFC faces as `-0`/`-1`).
8. Decklist parser + Commander validator. Parser handles `1x`/`1 x`/trailing `x1`, `(LTC) 264`,
   `[LTC]`, Archidekt `[Ramp]{noPrice}`/`^tag^`, MTGO `SB:`, `*F*`/`*E*`, section headers,
   `//` as DFC separator vs line-start comment, and a Unicode fold (`Æ→AE` needs its own pass —
   NFKD leaves it intact) applied to both query and index keys. Validator: exactly 100; singleton
   with exceptions derived from card text rather than a hardcoded list ("A deck can have any
   number of…" → ∞, "up to N" → **Nazgûl 9, Seven Dwarves 7**); legal commander incl. the
   supported pairings; **colour identity from Scryfall's `color_identity` field, not hand-rolled
   symbol parsing** (Scryfall already implements CR 903.4 correctly across hybrid, phyrexian,
   colour indicators and DFC faces); banned list from `legalities.commander` with a
   `stale-card-data` warning past 30 days. Reporting is per-line and actionable, and legality is a
   **soft gate** — everything is reported, with a per-deck "house-ruled" override and a visible badge.
   → a ~60-line fixture battery and 12 fixture decks, including 9 Nazgûl passing and 10 failing.

**Sign-off:** you import your real decks, see accurate validation, and browse them with full-resolution art.

### M2 — The animated table (no rules engine yet)

Built against **canned fixture scenarios** so you approve the feel before any rules exist. This
ordering is deliberate: this workspace has two fully-built features that were reverted for looking
wrong on real data.

1. Tokens, shell, fonts, `MotionConfig`, dev `#tokens` gallery.
   → `document.fonts.check('700 16px "Alegreya Variable"')` is true (false means a fallback is
   silently rendering); a `p-1…p-8` ladder computes to 8 distinct values (the 111-utility canary);
   a `motion.div` mounts under the **production** CSP with zero CSP console entries.
2. Rect registry + flight layer + `fly()` — alone, on a two-box test screen, before anything else animates.
   → the promise resolves within duration ±80 ms; clones clean up; the transform matrix differs
   between consecutive rAFs; `cancel()` mid-flight still resolves; `fly()` to an **unregistered**
   key lands at the zone anchor (the arbitrary-zone failsafe).
3. Table metrics + seat layout + row packing + zone piles + static hand fan.
   → 12 combinations (1920×1080 / 1600×900 / 1280×800 × 2/3/4 seats) with a 40-permanent board:
   every card inside its band, no two cards in a row overlapping, no page scrollbar, every card ≥96 px.
   Identical permanents auto-stack (12 Forests → one `Forest ×12` pile) — load-bearing, a 4-player
   board does not fit at 1080p without it.
4. Hand-fan interaction. → assert offsets match `26·e^(−0.55·d)` within 0.5 px via
   `setHoveredHandIndex(3)`, no synthetic pointer events involved.
5. Choreographer skeleton + digest mode + governor + watchdog + epochs.
   → a 20-move burst in one tick converges exactly; `stats()` shows the rate climbing then drain
   mode; a snapshot fired mid-burst bumps epoch with zero clones and zero errors; an
   **injected hung beat** still drains the queue — that is the anti-wedge proof, do not skip it.
6. All named beats on a `#beats` screen, each recorded per-rAF.
   → endpoints match spec **and peak scale > settle scale** (the overshoot actually happened —
   a numeric assertion for "does it feel like Arena"); `draw`'s `rotateY` crosses 90° at t∈[0.45,0.55].
7. HUD: life counter (MotionValue), commander-damage matrix, mana pool, phase track, priority, log.
   → 40→33→31→45 at 80 ms gaps is monotone toward each target and **never returns to 40** (proves
   retarget, not restart).
8. FX canvas. → ≤1200 active; after 1.5 s `active===0` **and `rafHandle===null`** (it parked — a
   canvas rAF that never sleeps is a permanent 3% CPU tax); DPR correct across a runtime
   `deviceScaleFactor` change.
9. Combat choreography. → each attacker's displacement has a positive dot product with the vector
   toward its assigned pod; blockers land within 2 px of the computed intercept.
10. Perf gate: p95 ≤ 18 ms and ≤2 long frames over 5 s of 40 permanents + draw burst + damage volley.

**Sign-off:** you watch draws, casts, resolutions, combat and deaths play from scripts and tell me
whether it reads as Arena. Cheap to iterate here; expensive later.

### M3 — Engine + solo play

Vitest-verified throughout; the milestone ends with a real 4-seat game you play alone.

1. `rng` / `hash` / `ids` → known-answer vectors, unbiased draws, key-order-independent canonical JSON.
2. Types + **purity test**: no `react|electron|node:|fs|path|zustand` import and no `Date.now()`,
   `Math.random()`, `performance.now()` anywhere under `src/engine/`.
3. `src/data/` parsers → ~60 hand-picked cards; then the whole bulk file with zero throws, and the
   count of ingest warnings by category recorded in `DECISIONS.md` as the honest measure of Tier-2 coverage.
4. `derive()` + empty script registry → base P/T, counters, overrides, face-down 2/2, plus one
   fixture script proving a script is purely additive.
5. Zones + reducer + `assertInvariants` + `replay` → a card through all 7 zones; replay hash equals live hash.
6. Setup + London mulligan (11 scenarios).
7. Turn structure + SBAs + triggers + `pump`/`advance` + `legalActions` + auto-pass (17 scenarios);
   40 turns of pure passing without hitting the iteration cap.
8. Mana + payment + casting + stack + priority (18 scenarios) + a benchmark asserting the
   max-flow tier completes under 1 ms on a synthetic 40-source board.
9. Combat + commander damage (20 scenarios) — the 16-case keyword matrix is where the test table
   earns its cost, because this is exactly the surface that regresses silently.
10. Tier-3 manual tools + group rewind (8 scenarios), including "replay after a mixed
    automatic/manual game yields an identical hash".
11. Projection + `redactEvent` + view diffing + **the replay-equivalence fuzzer** (500 seeds ×
    200 random legal intents, asserting invariants after every event and replay-hash equality).
    **This is the gate — networking does not start until it is green**, because every networking
    bug becomes unfalsifiable if the engine itself is nondeterministic.
12. Wire the real engine to the M2 table; PromptBar, casting flow with auto-tap review, aim-veil
    targeting, stops policy panel, manual tools drawer + card context menu.
    → exactly the legal targets compute `pointer-events:auto` and everything else `none`;
    `Escape` backs out one step; a stops audit over a full turn cycle matches the configured set;
    **grep `src/` for `window.prompt|confirm|alert` → zero hits.**

**Sign-off:** you play a full 4-seat Commander game by yourself, start to finish, with animations.

### M4 — Multiplayer

1. Protocol + loopback transport + host/client/lobby (no sockets yet) → 4 loopback clients agree
   on view hashes after every update; disconnect/reconnect resyncs; duplicate intent ids ignored.
2. `relay/` package: bare `ws` (socket.io would add a client dependency to Electron main, custom
   framing, and long-poll fallback for nothing). `Map<roomCode, Room>`; 6-char codes from a
   32-char alphabet with `I L O 0 1` removed; 10-min-after-empty TTL; 256 KB payload cap;
   6 peers/room; per-peer token bucket; 25 s heartbeat; `msg` bodies forwarded **verbatim and
   never parsed**; no accounts, no persistence, no payload logging. Deploy: a systemd unit +
   a 3-line Caddyfile for automatic `wss://` TLS, binding loopback behind the proxy. ~16 KB/s per
   pod — the smallest VPS tier carries dozens.
   → a Vitest test boots the relay and plays a scripted 10-turn game over 4 real `ws` clients;
   rooms are isolated; killing and restarting the relay mid-game lets all four resync; and a grep
   assertion that nothing under `relay/` imports `src/engine`.
3. Direct-IP / LAN transport, token-gated, listener on 5282 that opens only while hosting and
   closes with the game.
4. Electron integration: NDJSON game log on disk, `window.__crt` dev handles, two Electron
   instances (with **different data dirs**, or the profiles collide) hosting and joining.

**Sign-off:** you and a friend play a real game over the relay, and one of you can drop and rejoin.

### M5 — Ship

Tier-2 keyword coverage pass; reduced-motion/speed/skip wiring verified by emulating
`prefers-reduced-motion` (zero clones ever created, state still converges, under 400 ms);
remaining screens with keyboard-only traversal; `npm run electron:build`; a bundle audit asserting
**no `relay/` inside `app.asar` and no card art anywhere under `release/`** (art must never ship —
it is Wizards' copyright, and each user's app fetches its own); install the built exe and confirm
it reads the *same* `C:\Users\apps\.commanders-roundtable` the dev app wrote (the MSIX proof);
a full offline audit with the network disconnected; and `docs/INSTALL-AND-PLAY.md` for your friends
covering the SmartScreen walkthrough, first-run card sync, deck import, hosting by room code vs
LAN, the Windows Firewall prompt (Private networks only), what works offline, and the Scryfall +
Wizards Fan Content attribution.

---

## Verification

Two tools, two clearly separated jobs — documented in the project's `AGENTS.md`.

**Vitest** (`environment: 'node'`, `include: ['src/**/*.test.ts']`, no globals) for
`src/engine/` + `src/net/`: ~120 scenario tests, the purity regex test, the replay-equivalence
fuzzer, and 3–5 **golden logs** from real playtests checked into `__fixtures__/golden/` whose
replay must reproduce a stored state hash — that is the net that catches an accidental rules
change, and when it legitimately changes, the diff forces a `DECISIONS.md` entry.

**CDP / headless Electron** for everything that touches the shell, because
`preview_start` does not work with the Electron apps in this workspace (ENOENT):
`npx electron . --dev --remote-debugging-port=9223` then `Runtime.evaluate`, or
`scripts/probe.cjs` with `BrowserWindow{show:false}` + `loadFile('dist/index.html')`.

⚠️ Three probe traps that have each cost a full debugging round here:
**restart Vite before probing** (HMR ghost modules hand a probe a *second* zustand store instance
and every assertion lies); launch with `--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding` (an occluded window freezes rAF and throttles timers, which
reads exactly like a code regression); and **assert on store-injected state, never synthetic
pointer drags** (interleaved real and synthetic pointermoves corrupt drag assertions when the
mouse is over the window).

---

## Documented internet exceptions (to be written into `commanders-roundtable/AGENTS.md`)

1. **Scryfall bulk card data** — one-time download + a manual "update card database" button.
   Pinned to `api.scryfall.com`; cached locally; gameplay never requires it afterwards.
2. **Scryfall card images** — fetched per imported deck from `cards.scryfall.io`, cached to disk
   permanently, **never bundled into the installer**.
3. **Relay WebSocket + LAN hosting** — an explicit, deliberate deviation from "dev servers bind
   localhost only": the LAN listener binds the local network **only while you have started a LAN
   game**, is token-gated, and closes with the game. The Vite dev server still binds localhost.
4. **electron-updater** — the standing workspace-wide exception, dormant while
   `build.publish.owner` is the `"OWNER"` placeholder.

## Things that will need you, not me

- A **relay host** (VPS + domain) if you want room-code joining. v1 ships with `relayUrl` empty
  and LAN/direct-IP as the default path, so the app is fully playable before any server exists —
  and `docs/INSTALL-AND-PLAY.md` documents the zero-infrastructure route (Tailscale + direct IP).
- `build.publish.owner` → your real GitHub account, before auto-update can work.
- Code signing, if you want to avoid the SmartScreen warning. `electron-updater` works unsigned
  (it verifies the SHA512 in `latest.yml`, not a signature), so this is cosmetic-but-real.
- Two consequences worth acknowledging rather than deciding: **art is never relayed** — each
  client fetches its own copy, so a guest with a cold cache sees full-text synthetic faces until
  its next online moment (mitigated by a pre-game "sync pod art" step); and the relay operator
  can see traffic volumes, though bodies stay opaque and optional AES-GCM over the envelope body
  is a later addition that touches neither engine nor relay routing.
