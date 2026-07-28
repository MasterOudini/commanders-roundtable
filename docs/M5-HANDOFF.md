# Session handoff — build M5 (ship)

Paste this whole file as your opening prompt, or say
*"read `H:\Claude Apps\commanders-roundtable\docs\M5-HANDOFF.md` and build M5"*.

---

## Your task

Build **M5 — ship** of Commander's Roundtable, at
`H:\Claude Apps\commanders-roundtable`.

M1 (shell, card database, decks), M2 (the animated table), M3 (the rules engine
and solo play) and M4 (multiplayer) are complete and verified. M5 is the last
one: the Tier-2 keyword coverage pass, reduced-motion and skip wiring, the
remaining screens, the NSIS installer, the bundle audit, the offline audit, and
`docs/INSTALL-AND-PLAY.md` for the friends.

**The two gates that govern the milestones below you are green.** The
replay-equivalence fuzzer (500 seeds × 200 intents, 1,165,201 events, identical
hashes per seed) governs M3. The two-instance LAN playtest governs M4: two real
Electron processes, separate data roots, a real WebSocket, turn 3 on both sides,
identical state hashes, a socket dropped and auto-reconnected, and the on-disk
NDJSON replaying to the live state. That is what makes M5's bugs findable — a
problem now is packaging, motion or copy, because the engine and the wire
provably are not.

**Stop at the end of M5 and report.** M5 is the last milestone; when it is done
the deliverable is an installer the user can send to friends.

---

## Read these first

| File | Why |
|---|---|
| `AGENTS.md` | Canonical project instructions. Loaded automatically via `CLAUDE.md`. Read the ⚠️ sections properly — the trap list is now very long and every item cost real time. |
| `docs/DECISIONS.md` | **62 numbered decisions with reasons. Read before "fixing" anything that looks odd.** D21, D37, D48, D49, D50 and D54 are hard requirements on your code. |
| `docs/specs/approved-plan.md` | The user-approved plan for all five milestones. M5's scope is defined there. |
| `docs/specs/engine-net-spec.md` | §7 is the M4 design; §8.4 lists the offline-policy exceptions M5 must audit. |
| `docs/M4-HANDOFF.md` | The previous brief. Its trap list is carried forward below; the original has more context on M1–M3. |
| `docs/SCRYFALL.md` | The attribution obligations the installer and the About screen have to honour. |
| `src/data/oracleParse.ts` | **The entire Tier-2 boundary.** A fact it does not parse is a fact the engine does not enforce. D32 measures exactly what it misses today — that measurement is your M5 starting point. |
| `src/ui/anim/tokens.ts` | `d(ms)` and the single scale gate. Reduced motion and "skip" both land here. |
| `electron/window.cjs` · `electron/netallow.cjs` | The whole hardening posture, including M4's deliberate `connect-src` widening (D48). |
| `H:\Claude Apps\AGENTS.md` | Workspace-wide mandatory policy (offline-first, Electron packaging, `---Done---`). |

Also relevant: workspace auto-memory at
`C:\Users\apps\.claude\projects\H--Claude-Apps\memory\` (start at `MEMORY.md`).

---

## What the app is

*(Unchanged since M1. Lifted verbatim, because it has not moved.)*

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

*(Unchanged. Every box below is now built.)*

```
                          RELAY (relay/, Node + ws, on a VPS)   ← M4 ✓
                     room registry · blind forwarding · ZERO game logic
                                    ▲            ▲
                            wss://  │            │  wss://
┌───────────────────────────────────┴──┐   ┌─────┴──────────────────────────────┐
│ HOST app                             │   │ GUEST app  (same binary)           │
│ ┌──────────────────────────────────┐ │   │ ┌────────────────────────────────┐ │
│ │ src/engine/  PURE + DETERMINISTIC│ │   │ │ src/engine/ present but IDLE   │ │  ← M3 ✓
│ │  handle(intent) → Event[]        │ │   │ │  (replay, rewind, and the      │ │
│ │  apply(state, event) → state     │ │   │ │   payment solver — D53)        │ │
│ │  append-only log (NDJSON on disk)│ │   │ └────────────────────────────────┘ │
│ │  project(state, playerId) → View │ │   │ ┌────────────────────────────────┐ │
│ └───────────────┬──────────────────┘ │   │ │ PlayerView + redacted events   │ │  ← M4 ✓
│  own PlayerView │  redacted events   │   │ └──────────────┬─────────────────┘ │
│  (through a loopbackPair, like      │   │                │                   │
│   everybody else — spec §7.6)        │   │                │                   │
│ ┌───────────────▼──────────────────┐ │   │ ┌──────────────▼─────────────────┐ │
│ │ CHOREOGRAPHER → beats → React UI │ │   │ │ CHOREOGRAPHER → beats → React  │ │  ← M2 ✓
│ └──────────────────────────────────┘ │   │ └────────────────────────────────┘ │
│ MAIN: card DB · art cache · decks ·  │   │                                    │
│       LAN listener · game log        │   │                                    │
└──────────────────────────────────────┘   └────────────────────────────────────┘
```

**The invariant everything rests on:** every state change — including all Tier-3
manual tools and M4's presence changes — goes through an event appended to the
log. Nothing mutates state off-log. That gives replay, reconnect, group rewind,
the trigger bus, and the animation cue stream for free. Never add a code path
that changes state without emitting an event.

### Stack and ports

Electron 42 · Vite 8 · React 19 · TypeScript strict · zustand 5 · Tailwind 4
(`@tailwindcss/vite`) · `motion` 12.42.2 (import from `motion/react`) · Canvas2D
for particles · `ws` 8 (main process + `relay/` only) · Vitest.

Dev port **5280, strictPort**. **5281 = the relay, 5282 = the LAN listener** —
both built. Everything below 5280 belongs to sibling apps.

---

## What exists now

**1,145 checks, 1,144 green.** 716 Vitest (28 files) · 121 card-DB battery · 26
images battery (offline; 43 with network) · 165 animation battery (including a
27-check `engine` section and a 15-check `net` section) · 97 Electron probe · 20
two-instance LAN playtest.

The single failure is the perf gate's strict long-frame count — see D29 and
**D29a: it is noisy, measured 3–9 long frames across five runs, and running the
`perf` section alone is consistently worse than running it after the whole
battery.** The last full run was 7 long frames over 20 ms, **0 over 33 ms**, p95
8.50 ms. Do not read one run of it as a regression. M4 added nothing to the
render path.

**Verify it all still works before you start:**

```bash
cd "H:\Claude Apps\commanders-roundtable"
npm run build && npx vitest run          # 716 tests (28 files)
npm run test:fuzz                        # the replay-equivalence fuzzer alone
npm run test:net                         # the M4 suites alone (loopback + real sockets)
npx electron scripts/probe.cjs           # 97 checks, against dist/ with the PROD posture
node scripts/battery-carddb.cjs          # 121 checks
node scripts/battery-images.cjs --offline # 26 checks
node scripts/battery-anim.cjs            # 165 checks (spawns its own Electron)
node scripts/battery-anim.cjs engine net # just the M3 + M4 sections
node scripts/two-instance.cjs            # 20 checks — TWO real apps over a LAN socket
```

If the card database is missing (fresh machine), run
`node electron/cardsvc-worker.cjs --sync` (~77 MB, one time).

### Main process (`electron/`, all CommonJS `.cjs`)

| File | Responsibility |
|---|---|
| `paths.cjs` | The single data root: `~/.commanders-roundtable`. ⚠️ Read its header before changing it. |
| `window.cjs` | Window creation + all hardening (CSP, nav guard, permissions). ⚠️ `connect-src` is now computed per document load from `netallow.cjs` — D48. |
| `capability.cjs` | Capability-gated filesystem. Every path-taking handler goes through it. |
| `ipc.cjs` | Every IPC channel in one place. Shared with the probe. |
| `jsonstore.cjs` | Atomic, BOM-free JSON read/write + schema coercion. |
| `settings.cjs`, `winstate.cjs` | Schema-validated settings (now including `allowedOrigins`); window bounds with off-screen recovery. |
| `updater.cjs` | electron-updater with the placeholder-owner skip. |
| `scryfall.cjs` | Host allowlist, byte caps, idle timeout, serialized rate limiter, resumable download. |
| `cardsvc.cjs` / `cardsvc-worker.cjs` | Card-database worker supervisor + worker. ⚠️ See D13. |
| `cardfold.cjs` / `cardproject.cjs` / `cardindex.cjs` | Name folding · Scryfall's 63 fields → `CardData` · index build and queries. |
| `cardimg.cjs` / `cardimages.cjs` | The `cardimg://` scheme · art URL derivation + download queue. |
| `decks.cjs` | Deck CRUD, id-only, capability-gated, coerced both ways. |
| **`netallow.cjs`** | **NEW (M4).** Which `ws://`/`wss://` origins the renderer may reach. Per origin, never per scheme. ⚠️ D48. |
| **`lanServer.cjs`** | **NEW (M4).** A one-room, token-gated relay bound to the local network only while a LAN game runs. ⚠️ D59. |
| **`gamelog.cjs`** | **NEW (M4).** Append-only `games/<gameId>.ndjson` + `desync.log`. ⚠️ D60. |

### Renderer (`src/`)

```
src/
  main.tsx  App.tsx  devHandles.ts  index.css  types/bridge.d.ts

  engine/                      ⚠️ PURE + DETERMINISTIC (purity.node.test.ts enforces it)
    rng.ts · hash.ts · ids.ts · types/{mana,oracle,state,events,intents}.ts
    keywords.ts · oracle.ts · derive.ts · scripts/{api,registry}.ts
    zones.ts · reducer.ts · invariants.ts · log.ts · setup.ts · turn.ts
    sba.ts · triggers.ts · legal.ts · mana.ts · payment.ts · combat.ts
    loop.ts · handlers.ts · manual.ts
    project.ts       (+test)   ⚠️ THE HIDDEN-INFORMATION BOUNDARY (what you may SEE)
    redact.ts        (+test)   ⚠️ NEW (M4): the other half (what you may be TOLD)
    diffView.ts      (+test)   ⚠️ NEW (M4): diffView · applyPatch · viewHash
    viewEvents.ts              engine events → the 21 M2 animation cues
    game.ts                    the Game facade; now projects PER VIEWER
    testing/harness.ts · purity.node.test.ts · fuzz.node.test.ts  ⚠️ THE GATE

  net/                         ⚠️ NEW (M4). Same purity line as the engine, minus a socket
    protocol.ts      (+test)   Envelope · ClientToHost/HostToClient/RelayControl · room codes
    wire.ts                    the printing dictionary; CardData crosses once per client (D52)
    transport.ts               the Transport interface + loopbackPair
    socketTransport.ts         a real WebSocket, with backoff and a send queue
    relayTransport.ts          the room handshake; survives a relay restart
    host.ts                    ⚠️ THE ONLY PROCESS THAT REDUCES
    client.ts                  patch → view → choreographer; the payment solver (D53)
    devHandles.ts              window.__crt.net / .mp — how a probe drives two apps
    testing/{table,script}.ts  a host + N clients in one process
    net.test.ts                the §8.2-D list, over loopback
    relay.node.test.ts         the same sessions over REAL sockets ⚠️ where D50 was found

  game/
    session.ts                 ⚠️ the ONE place engine and renderer meet. Host-or-client.
    multiplayer.ts             host / join over LAN or a relay
    buildGame.ts · solo.ts

  ui/game/                     the M3 play surface (unchanged shapes)
  ui/screens/MultiplayerScreen.tsx   NEW (M4), deliberately plain — M5 finishes it
  store/  view/  ui/anim/  ui/table/  ui/hud/  ui/card/  data/

relay/                         ⚠️ NEW (M4). Its own package. NEVER imports src/
  package.json  src/server.js  src/server.d.ts
```

### What works right now

- Card database: **113,559 cards**. Deck import with per-line validation.
- **A full 4-seat game plays solo, start to finish** — and solo is now four
  clients over four loopback pairs against a real host (D54), so it is the same
  code path a networked game takes.
- **Two people on two machines can play.** Host over the LAN or over a relay,
  join with a six-character code, reconnect automatically when a socket dies,
  and rewind by unanimous vote.
- The 16 M2 fixture scenarios still drive the same table; `FixtureTable` is
  alive as a test double.

---

## The seam — still the single most important thing

M2 consumes exactly this, and after three milestones it has not changed:

```ts
// src/view/types.ts
choreographer.ingest(events: EngineEvent[], viewAfter: PlayerView): void
choreographer.applySnapshot(view: PlayerView): void        // reconnect / hard sync
```

M3 added `viewEvents.ts` and `game.ts`; M4 put a socket in the middle and changed
neither. A guest gets `(EngineEvent[], PlayerView)` off the wire — one call per
GROUP, in order (D49) — and calls the same `ingest`. **M5 must not change it
either.** Reduced motion and "skip" belong in the choreographer and in
`tokens.ts`, not in the contract.

---

## M5 spec — distilled. The decisions below are made; do not re-litigate them.

### 1. Tier-2 keyword coverage pass

D32 already measured what `src/data/oracleParse.ts` cannot parse, across the
whole database: 24,826 `keywords:noneTier2`, 783 `typeLine:unknownType`, 677
`protection:unenforced`, 629 `mana:noSymbols`, 208 `ward:nonManaCost`, 102
`mana:variableAmount`, and a long tail. **Start from that table, not from a
fresh survey.** The job is to decide, per category, whether it is Tier 2 (parse
and enforce it) or Tier 3 (say so in the UI), and to move the numbers
deliberately. Any change to the parser must re-run
`src/data/oracleParse.node.test.ts`, which runs the whole database through it —
and the pinned counts in D32 must be updated in DECISIONS.md when they move.

⚠️ The intrinsic land-type pass is not optional. Scryfall's oracle text for the
original dual lands is the empty string, so a text-only parser reports that
Tundra taps for nothing.

### 2. Reduced motion and skip

`prefers-reduced-motion` and the `animationSpeed: 'off'` setting both route the
choreographer to digest mode — it keeps consuming events and committing state
and simply stops flying clones. ⚠️ **It must never PAUSE**: a paused
choreographer diverges from the log, and after M4 that means diverging from
three other people. `d(ms)` takes its scale from the choreographer, not from the
settings store (D16), and the effective scale is the product of three
independent inputs — do not add a fourth reader.

### 3. Remaining screens

Settings (there is a store and a schema but no screen), About/attribution
(`docs/SCRYFALL.md` states the obligation), and finishing
`MultiplayerScreen.tsx`, which is deliberately plain. ⚠️ Every failure message on
that screen already says what to do; keep that property. "Could not connect" is
the one thing it must never say, because a bad room code, a wrong scheme, an
unreachable relay and a mismatched card database are four different problems.

### 4. The NSIS installer

`npm run electron:build` already exists and produces `release/`. What M5 owes is
that it *works*: a desktop shortcut by default, the app icon, electron-updater
configured against a real GitHub repo (`build.publish.owner` is still
`"OWNER"`, which is what keeps the updater dormant — see `updater.cjs`).

### 5. The bundle audit

⚠️ **No `relay/` in `app.asar`.** `build.files` is an allowlist (`dist/**`,
`electron/**`, `build/icon.*`), so it should already be excluded — assert it
rather than assuming it. `relay/node_modules` in particular must never ship.

⚠️ **No card art anywhere under `release/`.** Card art is Wizards of the Coast's
copyright; it is fetched per-user at runtime and cached in the data root.

Also worth asserting: no `src/net/testing/`, no `*.test.ts`, no
`src/data/fixtures/engineCards.ts` (2,500 lines of fixture card data) in the
packaged output.

### 6. The install-and-confirm-the-data-root proof (the MSIX proof)

D2 and D10b are the reason this exists. Install the built `.exe`, launch the
installed app, and confirm it reads `~/.commanders-roundtable` — the SAME
directory a dev session writes — with no shadow copy under
`%LOCALAPPDATA%\Packages`. If that is wrong, a user installs the app and it
looks empty and re-downloads 550 MB.

### 7. The full offline audit

The approved exceptions are exactly four: Scryfall bulk data, Scryfall card art,
the M4 relay/LAN transport, and electron-updater. `scripts/probe.cjs` already
asserts the CSP in both directions (D48). M5 owes the packaged equivalent: pull
the network cable, start a game, and confirm everything but art works.

### 8. `docs/INSTALL-AND-PLAY.md`

For the friends, not for a developer. Install, sync the card database once,
import a deck, host or join, and what to do when it goes wrong. ⚠️ It has to
explain the **join key** for LAN games (D59) and the fact that the host's app
must stay open, because those are the two things people will get stuck on.

---

## Build order for M5, with verification per step

1. **Settings + About screens.** → the probe asserts both render under the
   production CSP and that the Scryfall attribution string is present.
2. **Reduced motion + skip.** → a battery section that sets
   `prefers-reduced-motion` via `Emulation.setEmulatedMedia`, drives a real game,
   and asserts zero flight clones mount while `viewHash` still advances every
   intent. ⚠️ Assert the state kept moving, not just that nothing animated.
3. **Tier-2 coverage pass.** → `oracleParse.node.test.ts` over the whole
   database, with the D32 counts updated to whatever they become, plus new
   scenario tests in `src/engine/` for each newly enforced keyword.
4. **Finish the Multiplayer screen.** → `node scripts/two-instance.cjs` still
   20/20, driven through the real buttons rather than the `mp` dev handles.
5. **NSIS build + bundle audit.** → a script that opens `release/**/app.asar`
   and asserts the exclusions above by listing its contents.
6. **Install-and-run proof.** → install, launch, read `app.info().dataRoot`,
   and search `%LOCALAPPDATA%\Packages` for a shadow copy.
7. **Offline audit.** → disconnect, play a full solo game and a LAN game between
   two instances, and assert nothing but art degrades.
8. **`docs/INSTALL-AND-PLAY.md`.**

### Add to the harness rather than inventing from scratch

- **`scripts/battery-anim.cjs`** has `engine` (27 checks) and `net` (15 checks)
  sections that drive real games over CDP. Add a `motion` section beside them.
  ⚠️ It must `goto(js, 'table')` first — see trap 32.
- **`scripts/two-instance.cjs`** already spawns two real Electron instances with
  separate data roots and a shared card database (via a directory junction).
  Extend it rather than writing a third harness.
- **`src/engine/testing/harness.ts`** and **`src/net/testing/`** build boards and
  tables through real intents. Use them for setup so a test never asserts against
  a board the engine could not produce.

---

## ⚠️ Traps that will cost you time

Every one of these has already cost real debugging time in this project or its
siblings. **Never shorten this list.**

### Probing and verification

1. **Restart the Vite dev server before probing** after an edit session. With HMR
   active, modules resolve as `file.ts?t=<stamp>`, so a probe's
   `await import('/src/…')` loads a **second** instance — you read a ghost
   zustand store and every assertion lies. Reach state through `window.__crt`.
2. **A battery that reuses a long-lived vite can load a STALE module graph.** A
   freshly spawned Electron loaded an old module, so the copy of `rectRegistry`
   the beats had closed over was not the copy the live components had registered
   into. `elementFor()` returned null and every in-place beat quietly slept —
   recorded as "90 frames, 1 distinct matrix", which reads as "the beat does not
   animate". `battery-anim.cjs` now does `Page.reload({ ignoreCache: true })`
   first. Keep it.
3. **Launch with `--disable-backgrounding-occluded-windows
   --disable-renderer-backgrounding`.** An occluded window freezes rAF and
   throttles timers to 1 s, so an animation probe "hangs" in a way that looks
   exactly like a code regression.
4. **The debugger bypasses CSP.** Anything `Runtime.evaluate` runs — including a
   `<script>` it creates — is exempt. Measured: `eval()` blocked under a headless
   `file://` load, "allowed" under `--remote-debugging-port` with the *identical*
   CSP header. Read `window.__crt.csp`, measured by bundled code.
5. **Never pass `replMode: true` to `Runtime.evaluate`.** It silently defeats
   `awaitPromise` — every promise-returning expression comes back as `{}`, which
   reads as "the assertion returned nothing" rather than a client bug.
6. **Don't synthesize pointer drags.** If the real mouse is over the Electron
   window, genuine and synthetic pointermoves interleave and corrupt the gesture.
   Assert on store-injected state instead.
7. **Wait for the layout to SETTLE before sampling geometry.** Unhiding the
   persistent table slot and any device-metrics override both reflow
   asynchronously (a `display: none` element measures 0×0). Sampling mid-reflow
   produced hand-fan offsets wrong by a smoothly increasing amount per slot —
   which reads exactly like a broken falloff formula rather than like a race.
   Use `waitForStableLayout()` and assert `metricsEpoch` did not move.
8. **Measure LAYOUT boxes, not client rects, for anything rotated.** A tapped card
   is rotated 20.5° and `getBoundingClientRect` returns its enlarged axis-aligned
   box — a 101×141 card measures 144 px wide. Use `offsetWidth`/`offsetHeight`,
   or `decomposeTransform` for a rotated fan card.
9. **Normalise a recorded animation track against the REQUESTED duration**, not
   the observed window. A recording starts on the frame the clone first exists
   and stops when it unmounts, so dividing by the observed span inflated a
   measured flip time from 0.50 to anywhere in 0.52–0.60.
10. **Measure at the right layer.** A rate-limit check timestamped at the wrong
    layer reported ~1 ms gaps for a transport that was correctly paced 103 ms
    apart. Ask what layer the property lives at before instrumenting. ⚠️ M4 hit
    this again from the other side: a CSP-blocked WebSocket does **not** throw
    from the constructor in Chromium — it fires the same `error` event a dead
    port fires, so "the constructor threw" cannot tell a security posture from an
    unplugged cable. Listen for `securitypolicyviolation` and read the directive.
11. **Dev handles must never close over component state or setters.** A `goto()`
    that captured `setScreen` from a replaced HMR instance silently did nothing,
    and the probe reported "the screen has no cards" — indistinguishable from a
    render bug. Use refs or read-through functions.
12. **`preview_start` (the preview MCP) does not work** with the Electron apps in
    this workspace. Use `scripts/probe.cjs`, `scripts/battery-anim.cjs`,
    `scripts/two-instance.cjs` and `scripts/cdp.cjs`.
13. **Don't trust a `.replace()` that you did not assert on.** Two silent no-op
    patches in M2 cost a debugging round each. In M3 a five-edit Python patch
    asserted on edit 3 and silently skipped edits 4 and 5 — the reducer kept a
    stale field and `stopWhenAnyoneCasts` stayed broken for another round. If you
    patch a file programmatically, `assert old in s` for **every** edit, and
    write the file only after all of them succeed.

### Animation and rendering

14. **`project()` must preserve referential identity.** D21. Without it every
    event costs a 50–83 ms long frame. Biggest single perf lever in the app. The
    `Projector` instance must live across commits — **and after M4 the same rule
    binds `applyPatch` on the client**, which only ever replaces the keys a patch
    names for exactly this reason.
15. **`motion` silently no-ops a multi-keyframe array with a spring transition.**
    D22. Use `{ duration, ease }` for there-and-back.
16. **Don't ease the driving MotionValue if keyframe times are meant to be
    wall-clock.** D23. Easing the driver put the mid-flight face flip at 32%.
17. **`filter: blur` and `backdrop-filter` are not cheap.** D27.
18. **An always-mounted screen must not do work until it is looked at.** D31.
19. **`animStore` may only HIDE or DECORATE.** Never card→zone truth.
20. **Two files differing only in case break `tsc` on Windows.** D18.

### CSS (Tailwind 4)

21. **`@theme static` — do not drop the `static`.** D12. An undefined var inside
    `color-mix()` makes the browser discard the **whole declaration**.
22. **A Tailwind class composed at runtime is never emitted at all.** `p-${n}`
    does not exist in the output. Write utility names literally — `src/ui/game/
    styles.ts` keeps whole class lists in literal constants for this reason.
23. **Never add an unlayered universal reset.** It outranks `@layer utilities`.
24. **`@theme` must become `@theme inline`** the moment a token value references
    a scope-local var.

### Electron / Node

25. **`window.prompt()` / `confirm()` / `alert()` throw in Electron.** Every text
    or number input needs a real dialog — `src/ui/game/Dialogs.tsx`. The
    `engine` battery section greps `src/` for them **with comments stripped**; a
    naive grep flags the files that explain the rule and trains everyone to
    ignore the check.
26. **Attach stream/event listeners once, outside loops.** A per-iteration
    `once('error')` accumulated 113k listeners; fixing it cut a build from 40.6 s
    to 18.6 s.
27. **`utilityProcess.fork` runs its target as `require.main`** — guard any
    dual-mode CLI block with `!process.parentPort`. See D13.
28. **Electron logs `sandboxed_renderer.bundle.js script failed to run` whenever
    `--remote-debugging-port` is attached.** Filter console errors by **origin**,
    and dismiss it on evidence (the preload bridge round-trips) rather than on
    wording.

### The engine

29. **A queue needs someone to restart it.** The art queue stranded twice; the
    choreographer re-checks for work in a `finally` after clearing `running`.
    `pump()` has the same shape, and so do M4's host inbox and socket outbox.
30. **Inject the failure you are claiming to survive.** `injectHungBeat()` exists
    because a queue that cannot survive one hung beat will strand a real player.
    M4's equivalents: `RelayLink.dropSocket()` and killing the relay mid-game in
    `relay.node.test.ts`. Build the next one the same way.
31. **An SBA (or anything else) that asks a question must not re-ask it.**
    `advance()` runs the SBA pass before the awaiting check, on purpose (CR
    117.5), so a prompting SBA emits its prompt on every iteration —
    `pump()` hit its 10,000-iteration cap the moment a second Krenko landed.
    See D47.
32. **A `display: none` screen measures 0×0, so the packer drops every card.**
    Running the `engine` or `net` battery section without `goto(js, 'table')`
    first reported "the table did not render the land" and "0/0 legal targets"
    for a table that was simply not on screen. Navigate, override device metrics,
    then `waitForStableLayout`.
33. **`data-card-id` is the PRINTING id.** The instance id is on `data-band-slot`
    and `data-hand-instance`. See D45.
34. **`legalActions` is per-viewer, so solo play is a hotseat.** A script that
    locks the seat reads one player's options for everybody: the first automated
    playthrough produced a 171-turn game in which only one player ever played a
    land. See D42.
35. **Library size decides whether a game is testable.** 49-card decks made every
    solo game end by decking at turn 171 with all four players at 40 life. See
    D43. ⚠️ The same trap in a different coat bit M4: a fixture deck of forty
    BASIC LANDS produced a "complete game" that never cast anything, never
    attacked and never killed anybody — so it exercised a third of the projection
    and none of the parts where a patch is likely to be wrong.
36. **The choreographer commits a group's view when the group STARTS**, so
    `session.view()` can legitimately lag the engine by one group. A test that
    reads life totals from the view immediately after the engine says "finished"
    will see the second-to-last board. Read from the session snapshot, or
    `settle()` first.
37. **The user's standing rule: never reduce resolution or fidelity to save
    memory or time.** 128 GB RAM and an RTX 3060. Always request Scryfall `png`
    (745×1040). Use workers/parallelism for speed, never a quality cut.

### The wire (new from M4)

38. **A loopback test cannot find an in-flight bug, by construction.** The whole
    class of "a frame overtook another frame" is invisible when delivery is a
    function call. D50 — a resync storm that exhausted a 4 GB heap in twenty
    seconds — was found only by `relay.node.test.ts`, which runs the same
    sessions over real sockets. Keep both; they are not redundant.
39. **Over an async transport, "everyone is synced" is not "my intent landed".**
    A test loop that submitted whenever every client's `eventCount` matched the
    host's re-submitted the same intent thousands of times without ever yielding
    the event loop, because the host had not processed the first one yet.
    ⚠️ **Yield after every submit, unconditionally.** Out of memory in 20 s.
40. **A per-connection rate limit counts the HOST's whole table.** The host
    carries every remote player's traffic on one socket, so anything measured
    "per player" is multiplied by three there. D49: one frame per group per
    player ran into the relay's 200 msg/s cap and the excess was dropped
    silently — one player stuck eleven events behind, no error anywhere.
41. **An unhandled `error` on a `net.Server` is an UNCAUGHT EXCEPTION**, which in
    Electron means a modal "A JavaScript error occurred in the main process" and
    a dead app. Use `on`, not `once`, and make it survive being resolved. D59.
42. **`child.kill()` on Windows does not kill Electron.** It signals the launcher
    and leaves the main process — and its listening sockets — alive, so the next
    run dies on `EADDRINUSE`. Use `taskkill /PID <pid> /T /F`.
43. **An append-only log needs a unique id per GAME, not per seed.** Two games
    sharing an id share a file, and the second is appended to the first,
    producing a log that replays to neither. D60.
44. **An intent must be routed to the seat it NAMES, not to the seat being
    watched.** The hotseat viewer is routinely one step behind the seat that has
    to act. The host is right to refuse; picking the right client is the caller's
    job. D54 — this turned 27/27 into 17/27 and every failure read as "the game
    never leaves the mulligan".
45. **A room code must come from ONE place.** The relay mints it; the LAN
    listener mints it; nobody else invents one. A literal `LANGAME` was seven
    characters and failed the join form's own validation, and a silently
    substituted code leaves the host holding one nobody else was told (D58).

---

## Verification commands

```bash
cd "H:\Claude Apps\commanders-roundtable"

npm run dev              # browser only (window.crt is undefined, by design)
npm run electron:dev     # Vite + Electron
npm run desktop          # what the desktop shortcut runs (reuse-or-start, launch.log)
npm run build            # tsc -b && vite build
npm run test             # vitest (src/**/*.test.ts)
npm run test:fuzz        # the replay-equivalence gate alone
npm run test:net         # the M4 suites alone
npm run relay            # the standalone relay on :5281 (needs `npm i` in relay/)
npm run two-instance     # TWO real apps over a LAN socket
CRT_FUZZ_SEEDS=500 npx vitest run src/engine/fuzz.node.test.ts   # the full gate

npm run build && npx electron scripts/probe.cjs                  # shell, PROD posture
node scripts/battery-anim.cjs                                    # all sections
node scripts/battery-anim.cjs engine net                         # the M3 + M4 sections
node scripts/battery-anim.cjs --keep                             # leave it running
node scripts/two-instance.cjs --keep                             # leave both apps up

npx electron . --dev --remote-debugging-port=9223 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
node scripts/cdp.cjs "expression"
node scripts/screenshot.cjs out.png --wait 900 [--full]

node scripts/battery-carddb.cjs
node scripts/battery-images.cjs [--offline]
node scripts/make-engine-fixtures.cjs      # regenerate the verbatim card fixtures
node electron/cardsvc-worker.cjs --sync | --status | --reindex | --query "sol ring"
```

**Two tools, two jobs.** Vitest for pure TS in `src/` — the engine, net, data and
the animation maths. CDP/headless probe for anything touching Electron, the DOM,
real rendering or a real socket.

**Extend the existing suites rather than replacing them** — all 1,145 checks must
stay green (1,144 passing; the one known failure is D29 and is documented).

### Driving a real game from a probe

```js
await window.__crt.engine.start(4)                  // a real 4-seat solo game
window.__crt.engine.state()                         // priority, awaiting, legal, hash
window.__crt.engine.submit({ t: 'PassPriority', player: 'p1' })
window.__crt.engine.setViewer('p2')                 // hotseat
await window.__crt.engine.settle(8000)              // wait for the animation queue
window.__crt.engine.rewind(120)                     // proposes + votes; the host re-folds

window.__crt.net.state()                            // the session, over the wire
await window.__crt.net.lanRoundTrip()               // a real socket to our own LAN listener
await window.__crt.net.verifyLog()                  // replay the NDJSON, compare hashes
window.__crt.net.dropSocket()                       // inject the failure (trap 30)
await window.__crt.mp.host({ mode: 'lan' })         // what the button does
await window.__crt.mp.join({ url, code, token })
window.__crt.mp.step()                              // one legal action, if it is our turn
```

---

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` (so optional fields need
  `...(x !== undefined ? { x } : {})` rather than `x: undefined`).
- ⚠️ **`*.node.test.ts` is type-checked by `tsconfig.node.json`, not
  `tsconfig.app.json`**, and is excluded from the latter. That is how the tests
  that legitimately need `node:fs`/`process`/`ws` coexist with an app program
  whose `types` array is `["vite/client"]`. Adding `"node"` to the app types
  would put `process` and `Buffer` in scope for every renderer file — which is
  the mistake those tests exist to prevent.
- React function components; zustand for state; Tailwind 4 with `--crt-*` OKLCH
  tokens.
- All UI copy in English, active voice, **written from the user's side** ("Cast
  Sol Ring", not "Submit"). Errors say what happened **and** what to do.
- `electron/preload.cjs` and `src/types/bridge.d.ts` are the **same contract** —
  change both together.
- **`src/engine/` must not import React, Electron, Node or zustand, and must not
  call `Date.now()`, `Math.random()` or `performance.now()`.**
  `purity.node.test.ts` enforces it, per file. **`src/net/` holds the same line
  except that `socketTransport.ts`, `relayTransport.ts` and `devHandles.ts` may
  name a `WebSocket` or the DOM** — also enforced, in the same file.
- **Nothing under `relay/` may import `src/`.** `relay.node.test.ts` greps for it.
- Nothing outside `src/ui/anim/tokens.ts` may hard-code a millisecond value for a
  beat; everything goes through `d(ms)`.
- Comments explain **why**, and carry the ⚠️ marker plus the concrete failure when
  documenting an invariant. Match the density of the existing files — they are
  dense on purpose, and every ⚠️ in them is a bug that actually happened.
- Record any non-obvious decision in `docs/DECISIONS.md` with its reason, and
  update the "Milestone status" checklist in `AGENTS.md` when a step completes.
- End a fully-finished response with `---Done---` on its own line (workspace rule).

## Working style the user expects

- **Ask clarifying questions as clickable multiple choice** (the AskUserQuestion
  tool) — they prefer clicking to typing. Never a plain-prose question.
- Verify claims; don't assert them. When something looks wrong, **measure it**
  rather than reasoning from the symptom. Across M2–M4 the majority of bugs were
  the opposite of what the symptom suggested: a "broken falloff formula" was a
  reflow, a "beat that does not animate" was a stale module graph, "the table did
  not render the land" was a hidden screen, "the trigger never fired" was a
  sampler that only looked between intents, "the game never leaves the mulligan"
  was an intent sent down the wrong client, and "a memory leak in the transport"
  was the test's own loop never yielding.
- Report failures with the output. Say plainly what is done and what is not.
- Don't spawn subagents or run workflows unless asked.

## What comes after M5

Nothing. M5 is the last milestone; when it signs off, the user has an installer
they can send to their friends. If work continues past it, write the next brief
in this same shape — the trap list above is the accumulated cost of every wrong
turn across four milestones, and it must be carried forward, never shortened.

## Do not

- Do not change `src/view/types.ts`'s existing shapes without also updating
  `coalesce.ts` and `beats.ts` — an event kind with no beat is silently invisible.
- Do not let `src/ui/` import `GameState`, `src/engine/types/state` or a
  `HostSession` (except pure option types). That boundary is the anti-cheating
  guarantee, and after M4 it is structural: the host's own player holds a
  projected `PlayerView` obtained over a `loopbackPair`, exactly like a guest's.
- Do not put game logic in `relay/`. It is a router.
- Do not widen `connect-src` to a scheme (`wss:`). Per origin, through
  `electron/netallow.cjs`. See D48.
- Do not use `layoutId`, PixiJS, or a WebGL FX layer.
- Do not put card→zone truth in `animStore`.
- Do not add an internet dependency beyond the approved list: Scryfall bulk data,
  Scryfall card art, the relay/LAN transport, and electron-updater.
- Do not bundle card art into the repo or the installer — it is Wizards'
  copyright, fetched per-user at runtime.
- Do not weaken the capability gate or the SSRF host allowlist.
