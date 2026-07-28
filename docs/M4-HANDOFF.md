# Session handoff — build M4 (multiplayer)

Paste this whole file as your opening prompt, or say
*"read `H:\Claude Apps\commanders-roundtable\docs\M4-HANDOFF.md` and build M4"*.

---

## Your task

Build **M4 — multiplayer** of Commander's Roundtable, at
`H:\Claude Apps\commanders-roundtable`.

M1 (shell, card database, decks), M2 (the animated table) and M3 (the rules
engine and solo play) are complete and verified. M4 is where the game leaves one
machine: the wire protocol, per-player view filtering over the wire, three
transports (loopback → relay → direct IP), reconnect by snapshot, and the
`relay/` package.

**The gate that governs M3 is already green** — the replay-equivalence fuzzer,
500 seeds × 200 intents, 1,165,201 events, all replaying to identical hashes.
That is what makes M4's bugs findable: a desync now means the *transport* is
wrong, because the engine provably is not.

Stop at the end of M4 and report. Do not start M5.

---

## Read these first

| File | Why |
|---|---|
| `AGENTS.md` | Canonical project instructions. Loaded automatically via `CLAUDE.md`. Read the ⚠️ sections properly — the trap list is now long and every item cost real time. |
| `docs/DECISIONS.md` | 47 numbered decisions with reasons. **Read before "fixing" anything that looks odd.** D21 and D37 are hard requirements on your code. |
| `docs/specs/engine-net-spec.md` | **§7 is the M4 design spec**: wire protocol, lobby flow, `project()`, `ViewPatch`, reconnect, why the relay has zero game logic. Your primary reference. §8.2 D is the networking test list. |
| `docs/specs/approved-plan.md` | The user-approved plan for all five milestones. |
| `docs/M3-HANDOFF.md` | The previous brief. Its trap list is carried forward below, but the original has more context on M1/M2. |
| `src/engine/game.ts` | The `Game` facade. `submit(intent) → {events, batches}`; `view(player)`; `hash()`; `rewind(n)`. M4 wraps this, it does not replace it. |
| `src/engine/project.ts` | **The entire hidden-information boundary.** A bug here leaks hands. Read the header comment before touching it. |
| `src/game/session.ts` | Today's single-process session. M4 splits this into host + client over a transport; the shape it exposes to `src/ui/` must not change. |
| `src/view/types.ts` | The M2↔M3 seam, still unchanged. `PlayerView` + 21 `EngineEvent` kinds. |
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
                          RELAY (relay/, Node + ws, on a VPS)   ← M4, YOUR JOB
                     room registry · blind forwarding · ZERO game logic
                                    ▲            ▲
                            wss://  │            │  wss://
┌───────────────────────────────────┴──┐   ┌─────┴──────────────────────────────┐
│ HOST app                             │   │ GUEST app  (same binary)           │
│ ┌──────────────────────────────────┐ │   │ ┌────────────────────────────────┐ │
│ │ src/engine/  PURE + DETERMINISTIC│ │   │ │ src/engine/ present but IDLE   │ │  ← M3 ✓
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

**Consequence for M4:** the host already produces exactly what a guest needs —
`Game.submit()` returns `{ events, batches }` where each batch is
`{ stepId, events: EngineEvent[], view: PlayerView }` for one viewer. Your job is
to move those over a wire, per player, without changing what `src/ui/` consumes.

### Stack and port

Electron 42 · Vite 8 · React 19 · TypeScript strict · zustand 5 · Tailwind 4
(`@tailwindcss/vite`) · `motion` 12.42.2 (import from `motion/react`) · Canvas2D
for particles · Vitest.

Dev port **5280, strictPort**. Everything below it belongs to sibling apps.
**5281 = dev relay, 5282 = LAN listener — both are yours to build.**

---

## What exists now

**1,025 checks, 1,024 green.** 638 Vitest · 121 card-DB battery · 89 Electron
probe · 26 images battery (offline; 43 with network) · 151 animation battery
(including a 27-check `engine` section that drives a real game over CDP).
The single failure is the perf gate's strict long-frame count — see D29 and
**D29a: it is noisy, 3–9 long frames across four runs, and running the `perf`
section alone is consistently worse than running it after the whole battery.**
p95 is 8.5 ms in every run. Do not read one run of it as a regression.

**Verify it all still works before you start:**

```bash
cd "H:\Claude Apps\commanders-roundtable"
npm run build && npx vitest run          # 638 tests (23 files)
npm run test:fuzz                        # the replay-equivalence fuzzer alone
npx electron scripts/probe.cjs           # 89 checks, against dist/ with the PROD posture
node scripts/battery-carddb.cjs          # 121 checks
node scripts/battery-images.cjs --offline # 26 checks
node scripts/battery-anim.cjs            # 151 checks (spawns its own Electron)
node scripts/battery-anim.cjs engine     # just the 27 M3 checks
```

If the card database is missing (fresh machine), run
`node electron/cardsvc-worker.cjs --sync` (~77 MB, one time).

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
| `scryfall.cjs` | **The ONLY network access today.** Host allowlist, byte caps, idle timeout, serialized rate limiter, resumable download. |
| `cardsvc.cjs` / `cardsvc-worker.cjs` | Card-database worker supervisor + worker. ⚠️ See D13. |
| `cardfold.cjs` / `cardproject.cjs` / `cardindex.cjs` | Name folding · Scryfall's 63 fields → `CardData` · index build and queries. |
| `cardimg.cjs` / `cardimages.cjs` | The `cardimg://` scheme · art URL derivation + download queue. |
| `decks.cjs` | Deck CRUD, id-only, capability-gated, coerced both ways. |

### Renderer (`src/`)

```
src/
  main.tsx  App.tsx  devHandles.ts  index.css  types/bridge.d.ts

  engine/                      ⚠️ PURE + DETERMINISTIC (purity.node.test.ts enforces it)
    rng.ts           (+test)   sfc32; rejection-sampled nextBelow; state threaded through the log
    hash.ts          (+test)   canonicalJson + a 64-bit state hash
    ids.ts→types/ids.ts        id aliases + deterministic allocation from state counters
    types/mana.ts              ManaPool · ManaCost · HybridOption (phyrexian is a `life` option, D33)
    types/oracle.ts            OracleCard/Face · the Tier-2 keyword list · DerivedCharacteristics
    types/state.ts             GameState · PlayerState · CardInstance · CombatState · PendingCast · Awaiting
    types/events.ts            the EventBody union — every state change is one of these
    types/intents.ts           the Intent union + RejectReason
    keywords.ts                Scryfall keyword strings → our union; landwalk from text
    oracle.ts                  OracleDb (keyed by PRINTING) + ingest
    derive.ts        (+test)   the CR layer pipeline; L1/7b/7d live; makeDeriveCache
    scripts/api.ts             CardScript surface — v1 registers NOTHING
    scripts/registry.ts        pre-indexed by event kind and layer; EMPTY_REGISTRY ships
    zones.ts                   immutable zone-array surgery (index 0 is the BOTTOM)
    reducer.ts       (+test)   apply(state, event) — pure in (state,event) alone, exhaustive
    invariants.ts              the structural checks the fuzzer runs after every intent
    log.ts                     commit · replay · replayPrefix · stateHash · NDJSON
    setup.ts                   newGame + London mulligan helpers
    turn.ts                    STEP_ORDER · nextStep · grantsPriority · skipsFirstDraw (CR 103.7)
    sba.ts                     CR 704, one simultaneous pass; checkGameOver
    triggers.ts                applyReplacements (ONE funnel) + the APNAP trigger bus
    legal.ts                   legalActions · meaningfulActions · shouldAutoPass
    mana.ts                    sources, PaymentProblem, hybrid enumeration
    payment.ts       (+bench)  three-tier solver; MCMF measured at 0.100 ms on 40 sources
    combat.ts                  canAttack · canBlock · damage assignment (the 16-case matrix)
    loop.ts                    advance() / pump() — the only places the engine stops
    handlers.ts                handle(state, intent) → Event[] | Reject
    manual.ts                  every Tier-3 tool, all logged
    project.ts       (+test)   ⚠️ THE HIDDEN-INFORMATION BOUNDARY. Identity-preserving (D21)
    viewEvents.ts              engine events → the 21 M2 animation cues
    game.ts                    the Game facade: state + log + pump + per-viewer batches + rewind
    testing/harness.ts         the scenario harness — every fixture goes through real events
    purity.node.test.ts        the architectural guard, written in step 2 on purpose
    fuzz.node.test.ts          ⚠️ THE GATE

  game/
    session.ts                 ⚠️ the ONE place engine and renderer meet. `Game` is private to it
    buildGame.ts               deck → seats; the 99-card starter (D43); token names
    solo.ts                    start a solo game from saved decks or starters

  ui/game/                     the M3 play surface
    PromptBar.tsx              what the game is waiting for + the buttons for it
    AimVeil.tsx                targeting; EXACTLY the legal targets are pointer-events: auto
    PaymentReview.tsx          what auto-tap will do, before it does it
    StopsPanel.tsx             the stops policy grid
    ManualTools.tsx            the Tier-3 drawer + the per-card context menu
    Dialogs.tsx                ⚠️ real number/text dialogs — window.prompt THROWS in Electron
    GameLayer.tsx              all of the above, over the M2 table
    useEngineTable.ts          what a click MEANS, given what the game is waiting for
    devHandles.ts              window.__crt.engine — how a probe drives a real game
    styles.ts                  literal Tailwind class strings (see trap 22)

  store/  view/  ui/anim/  ui/table/  ui/hud/  ui/card/  ui/screens/  data/
                               unchanged from M2 except tableStore.ts (new, UI-only state)
```

### What works right now

- Card database: **113,559 cards**. Deck import with per-line validation.
- **The table renders a real 4-player game with real Scryfall art**, driven by
  the engine: mulligans, land drops, casting with auto-tap review, the stack,
  combat with the full Tier-2 keyword matrix, commander damage, state-based
  actions, the legend rule, group rewind, and every Tier-3 tool.
- **A full 4-seat game plays solo, start to finish.** Measured: 45 turns, 5,393
  events, 32 attack declarations, 68 attackers, three players dead, the last
  standing at 1 life with 16/12/8 commander damage tracked per commander
  instance.
- The 16 M2 fixture scenarios still drive the same table; `FixtureTable` is
  alive as a test double.

---

## The seam — still the single most important thing

M2 consumes exactly this, and it has not changed:

```ts
// src/view/types.ts
choreographer.ingest(events: EngineEvent[], viewAfter: PlayerView): void
choreographer.applySnapshot(view: PlayerView): void        // reconnect / hard sync
```

M3 added `src/engine/viewEvents.ts`, which turns engine events into those 21
cues, and `src/engine/game.ts`, which groups them by `stepId` and pairs each
group with the view it produced. **M4 must not change either.** A guest gets
`(EngineEvent[], PlayerView)` off the wire and calls the same `ingest`.

---

## M4 spec — distilled. The decisions below are made; do not re-litigate them.

`docs/specs/engine-net-spec.md` §7 is the full reference. The essentials:

### D-NET-1: only the host reduces

Clients render a projected view plus **advisory** narration. They never run the
reducer on live play. That is why a redaction bug degrades an animation instead
of desyncing state, and it is why the guest's `src/engine/` is present but idle
(it is still used for replay and rewind).

### The wire protocol

`Envelope { v, room, from, to, seq, ack, body }`. **The relay reads only `v`,
`room` and `to`** — everything else is opaque bytes to it. `to` is a `ConnId`,
`'host'` or `'all'`.

`ClientToHost`: `Hello` · `SubmitDeck` · `SetReady` · `Intent` · `RequestResync`
· `Ping` · `ChatSend`.
`HostToClient`: `Welcome` · `LobbyUpdate` · `Snapshot` · `Update` ·
`IntentRejected` · `Presence` · `ChatPosted` · `Pong` · `Error`.
`RelayControl`: `RelayCreateRoom` / `RelayRoomCreated` / `RelayJoin` /
`RelayJoined` / `RelayPeerJoined` / `RelayPeerLeft` / `RelayError`.

Sequence numbers exist for exactly two jobs: detecting a gap after a reconnect on
a *new* socket, and idempotent intents (the host remembers the last `intentId`
per player, so a retried send cannot double-cast).

### Room codes

6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1) — 32⁶ ≈ 1.07 × 10⁹,
and unambiguous read aloud over voice chat, which is the actual use case. TTL
4 h; evicted 5 min after the host disconnects.

### `oracleVersion` mismatch is a hard reject

Two players on different Scryfall snapshots can disagree about oracle text, which
produces an unfalsifiable dispute mid-game. Compare at `Welcome`;
`Error{oracleMismatch}` on mismatch (spec Q13).

### `ViewPatch` is deliberately coarse

One key per `cards.<id>`, per `players.<id>`, per `zones.<zone>.<player>`, and
whole-value for `turn`, `priority`, `combat`, `stack`, `legalActions`,
`revealed`, `derived`. A typical update touches 1–4 cards ≈ 1 KB; a wrath ≈ 8 KB.
No JSON-Patch library, no OT, ~60 lines. If `patch.base !== client.eventCount`
the client sends `RequestResync` rather than guessing.

⚠️ **`diffView` must preserve referential identity on the client too** — the
patched view feeds the same `React.memo`'d components, so D21 applies on both
sides of the wire.

### Reconnect is a full snapshot, categorically

The client never runs the reducer, so a log would be useless to it; the log
contains hidden information, and redacting each historical event *as of its own
historical state* is strictly harder than projecting once from the present. A
snapshot is O(state) ≈ 150 KB and correct by construction.

`resumeToken` is `HMAC(gameId + playerId, hostSecret)`, not a bare player id — so
a reconnecting client cannot claim someone else's seat and thereby their hand.
Cheap, and worth doing even under friends-only trust, because the real threat is
two people clicking rejoin at once.

### Desync detection is recorded, not just repaired

Host computes `viewHash` after projection; client recomputes after applying each
patch. On mismatch: `RequestResync` → `Snapshot`, and BOTH sides append
`{eventCount, hostHash, clientHash, patch}` to `desync.log`. That is what turns
"the board looked wrong once" into a fixable bug report.

### The relay has zero game logic

Room registry + blind forwarding + presence, ~150 lines. The host is
authoritative *by decision*; a relay that understood the game would be a second
source of truth. Redaction happens host-side before transmission, so the relay
never needs to know what a hand is in order to avoid leaking one. Per-conn rate
limit (200 msg/s, 1 MB/msg) and a room cap of 4.

⚠️ **Nothing under `relay/` may import `src/engine`.** Assert it with a grep test.

### The anti-accidental-cheating invariant is already half-built

`src/game/session.ts` keeps `Game` private and exposes only `PlayerView` +
`submit()`. M4 must keep that shape while swapping the implementation for
host-or-client. **The host's own local player must run through
`loopbackTransport` — the same `ClientSession`, holding the same projected
view.** The host UI gets no privileged path to state, and as a bonus a test can
run four clients plus a host in one process and play a complete game.

### CSP

⚠️ Widening the production CSP's `connect-src` happens in M4 and **must be
recorded in DECISIONS.md with its reasoning**, including how a user-configurable
relay URL is reconciled with a static CSP header (D4 flagged this).

---

## Build order for M4, with verification per step

1. **`src/net/protocol.ts`** — the `Envelope`, the three body unions,
   `PROTOCOL_VERSION`, room-code generation and validation.
   → unit tests: a round-trip of every message kind; a room code never contains
   I/O/0/1; a version mismatch is detectable from `Envelope.v` alone.
2. **`redactEvent` + `diffView`** in `src/engine/`.
   → `LibraryShuffled.order` stripped for **everyone including the owner**;
   `DeckLoaded.cards` reduced to a count; `ManualPeekLibrary` results visible
   only to the peeker. `diffView(prev, next)` then `applyPatch` reproduces
   `project()` exactly — compare hashes over 500 random updates.
3. **`loopbackTransport` + `HostSession` + `ClientSession`.** Still no sockets.
   → the §8.2-D tests with 4 loopback clients: per-update hash agreement, patch
   fidelity, duplicate-`intentId` idempotence, a wrong `resumeToken` rejected,
   protocol-version mismatch → `Error`. **Plus: play a complete scripted game
   through four clients and assert each one's final `viewHash` equals a fresh
   `project()`.**
4. **Lobby** — create/join, deck submission, ready, seating, `oracleVersion`.
   → a guest that submits an unresolvable deck gets a per-line report, not a
   silent seat.
5. **`relay/` package + `relayTransport`.**
   → boot `relay/src/server.js` on 5281 in-process, connect 4 real `ws` clients,
   play a scripted 10-turn game end to end; assert room isolation, `to`-routing,
   presence, and that **killing and restarting the relay mid-game lets all four
   clients resync**. Plus the grep: nothing under `relay/` imports `src/engine`.
6. **Reconnect.** Kill client 3's socket mid-game, reconnect with the
   `resumeToken`, assert its post-`Snapshot` `viewHash` equals a fresh
   `project(state, p3)`.
   → and that the game **paused** while it was gone if it was waiting on them,
   with "pass for <name>" available to everyone (spec Q6, already in the engine
   as `PassForPlayer`).
7. **`electron/lanServer.cjs` + the preload bridge + NDJSON persistence.**
   → the LAN listener binds the local network **only** while a LAN game is
   running and closes with it; `games/<gameId>.ndjson` exists and `replay()` of
   it reproduces the live hash.
8. **CSP + the offline audit.** Widen `connect-src` deliberately, record it.
   → `scripts/probe.cjs`: no non-`file://` request except the Scryfall host and
   the configured relay/LAN origin.

Then **play a real game with a second instance on the same machine**
(`CRT_DATA_DIR` gives it its own profile — that is what D2 is for), drop one
client and rejoin, and report.

### Two things to add to the harness rather than invent from scratch

- **`scripts/battery-anim.cjs` has an `engine` section** (27 checks) that drives
  a real game over CDP through `window.__crt.engine`. Add a `net` section beside
  it rather than a new harness: it already handles spawning Electron with rAF
  throttling disabled, the hard reload, layout settling and the console-error
  filter. ⚠️ It must `goto(js, 'table')` first — see trap 32.
- **`src/engine/testing/harness.ts`** builds boards through real intents.
  Networking tests should use it for setup so a wire test never asserts against
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
    apart. Ask what layer the property lives at before instrumenting.
11. **Dev handles must never close over component state or setters.** A `goto()`
    that captured `setScreen` from a replaced HMR instance silently did nothing,
    and the probe reported "the screen has no cards" — indistinguishable from a
    render bug. Use refs or read-through functions.
12. **`preview_start` (the preview MCP) does not work** with the Electron apps in
    this workspace. Use `scripts/probe.cjs`, `scripts/battery-anim.cjs` and
    `scripts/cdp.cjs`.
13. **Don't trust a `.replace()` that you did not assert on.** Two silent no-op
    patches in M2 cost a debugging round each. In M3 a five-edit Python patch
    asserted on edit 3 and silently skipped edits 4 and 5 — the reducer kept a
    stale field and `stopWhenAnyoneCasts` stayed broken for another round. If you
    patch a file programmatically, `assert old in s` for **every** edit, and
    write the file only after all of them succeed.

### Animation and rendering

14. **`project()` must preserve referential identity.** D21. Without it every
    event costs a 50–83 ms long frame. Biggest single perf lever in the app. The
    `Projector` instance must live across commits.
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

### The engine (new from M3)

29. **A queue needs someone to restart it.** The art queue stranded twice; the
    choreographer re-checks for work in a `finally` after clearing `running`.
    `pump()` has the same shape. Your transport send queue will too.
30. **Inject the failure you are claiming to survive.** `injectHungBeat()` exists
    because a queue that cannot survive one hung beat will strand a real player.
    Build the equivalent for the socket: kill it mid-`Update` and assert resync.
31. **An SBA (or anything else) that asks a question must not re-ask it.**
    `advance()` runs the SBA pass before the awaiting check, on purpose (CR
    117.5), so a prompting SBA emits its prompt on every iteration —
    `pump()` hit its 10,000-iteration cap the moment a second Krenko landed.
    See D47.
32. **A `display: none` screen measures 0×0, so the packer drops every card.**
    Running the `engine` battery section without `goto(js, 'table')` first
    reported "the table did not render the land" and "0/0 legal targets" for a
    table that was simply not on screen. Navigate, override device metrics, then
    `waitForStableLayout`.
33. **`data-card-id` is the PRINTING id.** The instance id is on `data-band-slot`
    and `data-hand-instance`. See D45.
34. **`legalActions` is per-viewer, so solo play is a hotseat.** A script that
    locks the seat reads one player's options for everybody: the first automated
    playthrough produced a 171-turn game in which only one player ever played a
    land. See D42.
35. **Library size decides whether a game is testable.** 49-card decks made every
    solo game end by decking at turn 171 with all four players at 40 life. See
    D43.
36. **The choreographer commits a group's view when the group STARTS**, so
    `session.view()` can legitimately lag the engine by one group. A test that
    reads life totals from the view immediately after the engine says "finished"
    will see the second-to-last board. Read from the engine, or `settle()` first.
37. **The user's standing rule: never reduce resolution or fidelity to save
    memory or time.** 128 GB RAM and an RTX 3060. Always request Scryfall `png`
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
npm run test:fuzz        # the replay-equivalence gate alone
CRT_FUZZ_SEEDS=500 npx vitest run src/engine/fuzz.node.test.ts   # the full gate

npm run build && npx electron scripts/probe.cjs                  # shell, PROD posture
node scripts/battery-anim.cjs                                    # all sections
node scripts/battery-anim.cjs engine                             # the M3 section alone
node scripts/battery-anim.cjs --keep                             # leave it running

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
the animation maths, all of which are pure. CDP/headless probe for anything
touching Electron, the DOM, or real rendering.

**Extend the existing suites rather than replacing them** — all 1,025 checks must
stay green (1,024 passing; the one known failure is D29 and is documented).

### Driving a real game from a probe

```js
await window.__crt.engine.start(4)                  // a real 4-seat game
window.__crt.engine.state()                         // priority, awaiting, legal, hash
window.__crt.engine.submit({ t: 'PassPriority', player: 'p1' })
window.__crt.engine.setViewer('p2')                 // hotseat
window.__crt.engine.setAutoSwitch(false)            // stop it following the acting player
await window.__crt.engine.settle(8000)              // wait for the animation queue
window.__crt.engine.rewind(120)                     // group rewind
window.__crt.engine.view()                          // the projected PlayerView
```

---

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` (so optional fields need
  `...(x !== undefined ? { x } : {})` rather than `x: undefined`).
- ⚠️ **`*.node.test.ts` is type-checked by `tsconfig.node.json`, not
  `tsconfig.app.json`**, and is excluded from the latter. That is how the two
  tests that legitimately need `node:fs`/`process` (the purity scan and the bulk
  ingest) coexist with an app program whose `types` array is `["vite/client"]`.
  Adding `"node"` to the app types would put `process` and `Buffer` in scope for
  every renderer file — which is the mistake those tests exist to prevent.
- React function components; zustand for state; Tailwind 4 with `--crt-*` OKLCH
  tokens.
- All UI copy in English, active voice, **written from the user's side** ("Cast
  Sol Ring", not "Submit"). Errors say what happened **and** what to do.
- `electron/preload.cjs` and `src/types/bridge.d.ts` are the **same contract** —
  change both together.
- **`src/engine/` must not import React, Electron, Node or zustand, and must not
  call `Date.now()`, `Math.random()` or `performance.now()`.**
  `purity.node.test.ts` enforces it, per file. `src/net/` should hold the same
  line except where a transport genuinely needs a socket.
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
  rather than reasoning from the symptom. In M2 and M3 the majority of bugs were
  the opposite of what the symptom suggested: a "broken falloff formula" was a
  reflow, a "beat that does not animate" was a stale module graph, "the table did
  not render the land" was a hidden screen, and "the trigger never fired" was a
  sampler that only looked between intents.
- Report failures with the output. Say plainly what is done and what is not.
- Don't spawn subagents or run workflows unless asked.

## What comes after M4 — and your last task

⚠️ **This document is a brief for M4 only.** M5's reference material is in-repo
(`docs/specs/approved-plan.md`), but there is no milestone brief for it yet, on
purpose: a brief written today would guess at what M4 actually produces, and
every milestone so far has diverged from the spec in ways worth recording.

**So your final task, after M4 is verified and reported, is to write
`docs/M5-HANDOFF.md`** in the same shape as this file:

1. The task, and where to stop.
2. Read-these-first table (add anything new you created).
3. What the app is + architecture — lift these verbatim; they have not changed.
4. **What exists now** — update the file inventory and the verification totals.
   Be accurate; a stale inventory is worse than none.
5. The M5 spec, distilled. State the decisions, don't re-open them.
6. Build order with a verification per step.
7. **The traps** — carry this file's list forward, *plus* whatever M4 taught you.
   That list is the accumulated cost of every wrong turn so far. Never shorten it.
8. Conventions, working style, do-not.

Then tell the user the file exists and how to use it.

### The remaining milestone, in one line

| | What it delivers | Sign-off |
|---|---|---|
| **M5** | Tier-2 keyword coverage pass, reduced-motion/skip wiring, remaining screens, NSIS installer, bundle audit (**no `relay/` in `app.asar`, no card art anywhere under `release/`**), install-and-confirm-it-reads-the-same-data-root (the MSIX proof), full offline audit, and `docs/INSTALL-AND-PLAY.md` for the friends. | An installer the user can send to friends. |

## Do not

- Do not start M5. Stop at the end of M4, report, and write `docs/M5-HANDOFF.md`.
- Do not change `src/view/types.ts`'s existing shapes without also updating
  `coalesce.ts` and `beats.ts` — an event kind with no beat is silently invisible.
- Do not let `src/ui/` import `GameState` or `src/engine/types/state` (except
  pure option types). That boundary is the anti-cheating guarantee.
- Do not put game logic in `relay/`. It is a router.
- Do not use `layoutId`, PixiJS, or a WebGL FX layer.
- Do not put card→zone truth in `animStore`.
- Do not add an internet dependency beyond the approved list: Scryfall bulk data,
  Scryfall card art, the M4 relay/LAN transport, and electron-updater.
- Do not bundle card art into the repo or the installer — it is Wizards'
  copyright, fetched per-user at runtime.
- Do not weaken the capability gate or the SSRF host allowlist. Widening
  `connect-src` is the one deliberate exception, and it must be recorded.
