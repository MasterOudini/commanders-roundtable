# Decisions

Numbered, newest at the bottom, each with its reason. **Read this before
"fixing" anything that looks odd** — most entries exist because the obvious
alternative was tried, or because a probe caught something.

---

## D1 — Electron, not Tauri

The source spec preferred Tauri (Rust shell + React). `H:\Claude Apps\AGENTS.md`
makes Electron **mandatory** for every app in this workspace, names
`electron-updater` as the required updater, and requires an NSIS `.exe`. Mundifex
already recorded Electron-over-Tauri as its own D2. Choosing Tauri would have
meant amending the workspace policy rather than taking a project exception.

Confirmed with the user 2026-07-26. Cost: a ~120 MB installer instead of ~10 MB.
Benefit: the entire proven scaffolding of five sibling apps — hardening posture,
capability gate, dev launcher, EPERM workaround, probe harness — ports directly.

## D2 — The data root is `~/.commanders-roundtable`, not `%APPDATA%`

⚠️ Load-bearing. The Claude desktop app is MSIX-containerized, so `%APPDATA%` and
`%LOCALAPPDATA%` writes made from an agent session are **virtualized** into
`…\Packages\Claude_…\LocalCache\…`. A card database or image cache written while
developing would therefore not be the directory the user's real app reads — the
app would look empty and re-download ~550 MB.

Mundifex hit exactly this and moved its runtime to a profile-root dotfolder for
the same reason (its D15). `electron/paths.cjs` calls
`app.setPath('userData', …)` before `app.whenReady()`, so Chromium's own profile
lands there too.

`CRT_DATA_DIR` overrides it. That is not a convenience: it is what lets two
Electron instances host and join on one machine without sharing a profile (they
would otherwise collide on `settings.json`, the deck index and the image queue),
and it is what gives the probe a throwaway root.

## D3 — The OS temp directory is NOT renderer-writable

cartapriscus includes `app.getPath('temp')` in its app-writable allowlist because
its export pipeline stages files there. This app writes nothing outside its data
root, and temp is a shared world-writable location where a stray write can land
beside another program's files.

A probe caught the cost of allowing it: with temp writable, *every* "outside the
data root is refused" assertion passed vacuously, because the test paths were
themselves under temp. Removing it made four assertions meaningful and tightened
the gate. Don't add it back without a concrete need.

## D4 — `connect-src 'self'` — the renderer has no network reach

Every outbound call this app makes (Scryfall bulk data, card art) happens in the
**main** process behind an exact-host allowlist with a timeout and a byte cap.
The renderer therefore needs no network permission at all, which is the tightest
possible posture and is verified by the probe (external `fetch` and `WebSocket`
both blocked).

M4 will widen this deliberately for the multiplayer transport, and must record
why here when it does — including how a user-configurable relay URL is reconciled
with a static CSP.

## D5 — No `'unsafe-eval'` in either mode

Unlike the Pixi-based sibling apps (which need `pixi.js/unsafe-eval` as their
first import), every renderer dependency here is pure JS, so `sandbox: true`
stays on and eval stays dead in dev *and* production.

⚠️ Verifying this is subtler than it looks. **The debugger bypasses page CSP**:
anything `Runtime.evaluate` runs — including a `<script>` element it creates — is
exempt. Measured here: `eval()` blocked under a headless `file://` load, but
"allowed" under `--remote-debugging-port=9223` with the *identical* CSP header.
The fix is `src/devHandles.ts`, which measures it from inside the bundle and
exposes the result at `window.__crt.csp`. Never let a probe test this by calling
`eval()` itself.

## D6 — `scripts/probe.cjs` imports the app's real modules

The probe calls the actual `installSecurity()`, `registerIpc()` and
`guardContents()` from `electron/`, rather than reimplementing handlers. A probe
that reimplements the thing it checks is testing the probe. This is why IPC
registration lives in `electron/ipc.cjs` instead of inside `main.cjs`.

## D7 — Never pass `replMode: true` to `Runtime.evaluate`

It silently defeats `awaitPromise`: every promise-returning expression comes back
as `{}`. That reads as "the assertion returned nothing" rather than as a client
bug, and it cost a debugging round here before the cause was found. The comment
in `scripts/cdp.cjs` says so — leave it there.

## D8 — Vitest for the engine; CDP probes for the shell

Vitest is a workspace first, and the workspace has a standing simplicity rule, so
this needed justification. A rules engine is the single most test-shaped artifact
in this codebase: pure functions, no DOM, hundreds of small independent
scenarios, and a correctness bar where "looks right on screen" is worthless.
"21 commander damage is a loss" has to be *knowable*.

Zero shipping risk (devDependency; `build.files` is an allowlist that excludes
it), near-zero config cost (reuses `vite.config.ts` and the existing tsconfig).
CDP probes remain the right tool for Electron boot, IPC, CSP and packaging, and
are hopeless for 200 rules scenarios at a 3-second boot each.

`defineConfig` is imported from `vitest/config`, not `vite`, so the `test` block
type-checks under `tsc -b`.

## D9 — Group rewind is in scope for v1

Because the engine deliberately does not enforce unique card text (Tier 3), the
pod *will* reach states someone wants to back out of. The append-only event log
makes rewind nearly free: re-fold the log to a chosen point. Confirmed with the
user 2026-07-26. Untangling a bad combat by hand across four boards is the
alternative, and it is genuinely tedious.

## D10 — `default_cards`, not `oracle_cards`

`oracle_cards` is roughly 4× smaller but carries one entry per card *name*, losing
printings and art variants. Decklists exported from Moxfield and Archidekt name
specific printings (`1 Sol Ring (LTC) 264`), and the user's standing rule is never
to reduce fidelity to save space. So: `default_cards` (~550 MB on disk), every
English printing, with the specific printing you asked for.

## D10a — Download `jsonl_download_uri`, not `download_uri`

Measured against Scryfall on 2026-07-26. Each bulk dataset is published twice, and
the two representations behave very differently. For `default_cards`:

| | `download_uri` (`.json`) | `jsonl_download_uri` (`.jsonl.gz`) |
|---|---|---|
| plain GET | 200, `Content-Encoding: gzip`, **~200 MB** on the wire, **no** `Content-Length`, **no** `Accept-Ranges` | 200, a genuine `.gz` file (`1f 8b` magic), **76,985,138 B**, exact `Content-Length`, `Accept-Ranges: bytes` |
| any `Range` | 206 — but the CDN **decompresses**, so `Content-Range` is over the 620,655,865-byte identity form. Resuming costs 3× the bytes | 206 with `Content-Range` over the **compressed** bytes — genuinely resumable |
| format | one big pretty-printed JSON array | one card object per line |

So the `.jsonl.gz` variant wins on every axis at once: a third of the bytes, an
exact progress total, real resume, and line-delimited records — which means the
transform needs a line splitter rather than a streaming-JSON parser. The
brace-depth splitter the plan called for is not needed at all.

⚠️ Do not "simplify" this to `download_uri` because the field name looks more
canonical. Re-measure before changing it.

Also measured: the manifest carries **no checksum** of any kind (no hash/md5/sha
field). Integrity is therefore "does it inflate cleanly, and is the record count
plausible" — a real check, since a truncated gzip fails to inflate rather than
yielding partial garbage. `MIN_PLAUSIBLE_CARDS` guards against writing meta for a
file that is technically valid but far too small.

Verified end to end: fresh download 76,985,329 B / 116,209 cards in **2 requests**
(one manifest, one download); a `.part` truncated to 20,971,520 B resumed and
fetched exactly the missing 56,013,809 B plus the 4,417-byte manifest, producing a
byte-identical result and the same 116,209 record count; cancel keeps the `.part`
and writes no meta; a second sync with the file already present makes **1**
request and downloads 4,417 bytes.

## D10b — The data root is genuinely not virtualized

D2 predicted that a profile-root dotfolder escapes MSIX virtualization. Now
confirmed rather than assumed: after an agent-session download, the 77 MB file is
visible at `C:\Users\apps\.commanders-roundtable\downloads\…` from a separate
PowerShell process, and a recursive search of `%LOCALAPPDATA%\Packages` for
`*.jsonl.gz` finds no shadow copy.

## D11 — Full Scryfall `png` art plus our own legibility chrome

Neither extreme works. The printed card image alone is unreadable below ~190 px
(the name is ~7 px tall at hand size) and its printed power/toughness is *wrong*
the moment a +1/+1 counter lands. Re-drawing Arena-style frames means 15+ variants
(sagas, classes, battles, levelers, prototypes, adventures) — months of work to
end up *less* faithful than the real card.

So: the real `png` (745×1040, Scryfall's maximum) as the face, plus a thin chrome
layer sized in CSS px that re-renders only the four things you must read at a
glance — name strip, cost pips, **current** P/T, and a type glyph.

Cold cache falls back to a `SyntheticFace` (colour-identity gradient + name +
cost + type line from the always-local oracle data), which is fully playable.
⚠️ Never a blank rectangle and never a spinner on a card.

Corollary, learned the hard way: **only the chrome layer draws a card's numbers.**
`SyntheticFace` renders no power/toughness, loyalty or defense. Having both draw
it put two identical elements at the same coordinates — invisible at hand size,
an obvious overlap in the zoom panel — and it meant the printed value could be
shown where the current one was needed.

## D12 — `@theme static` is load-bearing

⚠️ Do not "simplify" `src/index.css` back to a plain `@theme`.

Tailwind 4 **tree-shakes theme variables**: it emits only those it finds as
literal text when scanning source. Some of ours are reached by interpolation —
`identityToken()` builds `` `var(--color-mtg-${letter})` `` at runtime — so the
scanner never sees `--color-mtg-r` and silently omits it.

The resulting failure is genuinely nasty. An undefined var inside `color-mix()`
makes the value invalid, and the browser then discards the **entire
declaration** — so a card lost both its `background` and its `box-shadow`.
Single-colour cards rendered with no silhouette at all, while colourless and
multicolour cards (whose tokens `--color-mtg-c` / `--color-mtg-m` *do* appear
literally in `identityToken`) looked perfect. No console error, no build warning,
and the symptom pointed at the card component rather than at the stylesheet.

`static` emits every declared token unconditionally, for a few hundred bytes of
CSS. This is the third distinct Tailwind-4 token footgun this workspace has hit
(after the unlayered universal reset and the `@theme` vs `@theme inline`
scope-local-var trap) — all three are recorded in `AGENTS.md`.

## D12a — Lazy index maps, and no eager printing sort

The card index is 10.1 MB of parallel primitive arrays covering 113,559
printings. Building every derived map at load cost **514 ms**, over the 500 ms
cold-start budget. Measured breakdown: read 52 · `JSON.parse` 104 · `byName` 100 ·
`byId` 76 · `bySetCn` 111 · bucket sort 71.

So only `byName` is eager — every lookup needs it. `byId` (used by `byScryfallId`
and `hydrate`), `bySetCn` (only when a decklist names an exact printing, and the
most expensive of the three at 113k composite string keys) and `byFrontFace` (only
reached when a name misses) are built on first use. Printing order is **not**
sorted at load either: `byName` needs one best printing, so a linear minimum over
a ~5-entry bucket beats sorting 20,683 buckets up front; full ordering is sorted
on demand and cached per bucket.

Cold load is now **255 ms**, and p95 name lookup is 0.14 ms.

⚠️ Consequence to remember: buckets are **unsorted**, so `bucket[0]` is NOT the
preferred printing. Always go through `bestIndex()` or `orderedBucket()`. Two
search functions had this wrong and would have surfaced arbitrary printings.

## D12b — Attach stream error handlers once, outside the write loop

The transform's per-line write helper did `out.once('error', reject)` on every
call, accumulating one listener per record — 113k of them, announced only as a
`MaxListenersExceededWarning` at 11. It also allocated a Promise per line.

Fixing it (one `error` listener, and awaiting only when `write()` signals
backpressure) cut the build from **40.6 s to 18.6 s**. The listener count was
never the real cost; the per-line Promise was. Worth remembering that a
"cosmetic" Node warning was pointing at a 2× slowdown.

## D12c — Zero card names contain a ligature

Measured on the 2026-07-26 release: **no** card name contains `Æ`, `Œ`, `Ø` or
similar. Wizards renamed Æther → Aether in oracle text and Scryfall carries
current oracle names, so the card is literally `Aether Vial`.

The fold's ligature handling is therefore for **input tolerance** — an old
decklist export, or someone typing the printed spelling of an old card — not for
matching a stored name. 100 names *do* carry diacritics (Gríma, Éomer, Dúnedain,
Palantír, Lim-Dûl, Šlemr), and those are what the fold really earns its keep on.
A battery assertion that expected the ligature in the stored name was wrong in the
opposite direction and has been corrected to assert both spellings resolve to the
same card.

## D14 — Image URLs are derived from the card id, not stored

Measured 2026-07-26. Scryfall's CDN paths are fully predictable:

```
https://cards.scryfall.io/<tier>/<face>/<id[0]>/<id[1]>/<id>.<ext>
```

No `?<timestamp>` cache-buster is required. `png` → `.png`, everything else
`.jpg`. A `back` image exists exactly when the card has per-face images (our
`singleImage: false`) and 404s otherwise — verified across transform, modal_dfc
and split layouts.

So the projection does not carry `image_uris`, which would have added ~34 MB to
the NDJSON for 113k cards to store information we can compute.

Measured sizes, which drive the two-pass strategy: `png` 0.8–1.7 MB,
`art_crop` ~40 KB. The queue therefore fetches **every art crop first** — a few MB,
and cards become recognisable in seconds through the existing `chit` render mode —
then upgrades to full art in a second pass. `useCardImage`'s fallback chain
already handles the in-between state, so this needed no new rendering code.

## D14a — A queue needs someone to restart it

Two ways work could strand in the art queue, both observed:

1. A failed item is re-queued by a **backoff timer** that fires long after the
   workers have exited.
2. `enqueue` lands in the window between the last worker returning and `running`
   going false.

Either leaves the queue non-empty with `running: false` and nothing to drain it —
seen as two images that simply never downloaded. `scheduleDrain()` now runs after
any completed pass that leaves work behind, and from the backoff timer. The delay
breaks a tight loop when everything remaining is in backoff, and the timer is
`unref`'d so a pending drain never holds the worker process open.

## D14b — The rate limiter had to be serialized

The naive gate —

```js
const wait = MIN - (Date.now() - lastRequestAt);
if (wait > 0) await sleep(wait);
lastRequestAt = Date.now();
```

— is correct for one caller and silently wrong for several: six concurrent image
downloads all read the same `lastRequestAt`, all compute `wait <= 0`, and all fire
at once. Zero spacing. That was invisible while only the sequential bulk sync used
it, and the prefetch queue would have hammered Scryfall's courtesy limit.
`rateLimit()` now chains through a promise so each caller waits for the previous
one's slot.

⚠️ Verifying this needs care about **which layer you measure**. Timestamping
`scryfall.download()` reports ~1 ms gaps even when pacing is correct, because all
six workers enter `download()` together and then serialize *inside* it on the
gate. Only the wire tells the truth — `scripts/battery-images.cjs` hooks
`https.get`, and measures a 103 ms minimum gap with 5 requests concurrent.

## D14c — Fixtures use real Scryfall ids

`src/data/fixtures/cards.ts` originally carried invented UUIDs. Because rendering
a card is what requests its art, the fixture screen generated **18 guaranteed
404s** on every cold cache — all correctly recorded as permanently dead, but all
pointless traffic. The ids are now real (and Scryfall ids are stable, so they do
not rot), which also makes the fixture screen a truthful test: it exercises the
same art path a real deck does. `7a8b4f93-…` (Symbol Torture Test) stays synthetic
on purpose — it is not a real card, and its two dead entries are the expected
result.

## D15 — Commander eligibility cannot be decided from type line and text

⚠️ This one is a limitation, stated honestly rather than papered over.

CR 903.3 says a commander must be a legendary creature or a card saying it can be
your commander. Implementing exactly that produces **false errors on real decks**.
Measured against the 2026-07-26 data:

- 40 cards say "can be your commander" (33 of them legendary non-creatures —
  Minsc & Boo, Elminster, The Grand Calcutron). A reliable signal.
- **Shorikai, Genesis Engine** is a real precon face commander. Its oracle text
  says nothing about being a commander and its type line is
  `Legendary Artifact — Vehicle` — not a creature. The strict rule rejects it.
- **Grist, the Hunger Tide** reads `Legendary Planeswalker` and is legal by
  rules-committee ruling. It needs a name override (`COMMANDER_OVERRIDES`), kept
  deliberately as a one-entry allowlist rather than a general escape hatch.

So `commanderEligibility()` returns three values:

| | when | severity |
|---|---|---|
| `yes` | legendary creature · says so · legendary Vehicle/Spacecraft · override | — |
| `unknown` | legendary, but none of the above | **warning** |
| `no` | not legendary at all | **error** |

`no` is the only unambiguous case (someone marked Sol Ring as their commander).
`unknown` says so in plain words and lets the pod decide — which fits the soft-gate
design and never blocks a legal deck we simply cannot verify.

## D15a — A Background is judged as part of its pair

Backgrounds (`Legendary Enchantment — Background`) are never commanders on their
own: they are the *second* commander alongside a "Choose a Background" creature.
Checking each commander in isolation reported *"Raised by Giants cannot be a
commander"* for a perfectly legal Wilson + Raised by Giants deck. Eligibility is
now evaluated with the pairing in view, and a card excused by a valid pairing is
not flagged. Same treatment for a Doctor's companion.

## D15b — Validator fixtures carry verbatim oracle text, cross-checked

`src/data/validate.test.ts` uses hand-written `CardData` fixtures because the
tests must stay pure and offline. But the rules key off **exact wording** ("A deck
can have up to nine cards named"), so a paraphrased fixture would test the fixture
rather than the card, and would keep passing forever after Scryfall reworded
something.

Every fixture's oracle text and type line is therefore copied verbatim from the
real data, and `scripts/battery-carddb.cjs` asserts the real cards still say it —
15 cross-checks covering Nazgûl/Seven Dwarves/Relentless Rats limits, the four
pairing mechanics, Grist's and Shorikai's type lines, Wastes and Snow-Covered
basics, and that Golos is still banned. If Scryfall changes a wording, that battery
fails instead of the unit tests silently rotting.

## D13 — A utilityProcess worker is `require.main`, so guard its CLI block

`electron/cardsvc-worker.cjs` is runnable two ways: supervised by
`electron/cardsvc.cjs` via `utilityProcess.fork`, and headless from a shell for
verification (`--sync`, `--status`) — the same dual-mode pattern as
`mundifex/electron/setup.cjs`.

⚠️ `utilityProcess.fork` runs the file as the **entry module**, so
`require.main === module` is TRUE inside the forked worker too. The CLI block
reassigns `emit` to render a terminal progress bar; with `stdio: 'ignore'` that
sent every reply into nothing. The worker announced `ready` (emitted before the
CLI block ran) and then timed out on its first real request — which reads exactly
like a hung child, not like a logging mistake.

The guard is `require.main === module && !process.parentPort`. Any future
dual-mode worker in this project needs the same check.

---

# M2 — the animated table

## D16 — `d(ms)` takes its scale from the choreographer, not from the settings store

`ui-animation-spec.md` §4.4 writes `d()` as reading
`useSettings.getState().timeScale`. `src/ui/anim/tokens.ts` instead keeps a
module-local scale that `setAnimScale()` writes.

Two reasons. The effective scale is the **product of three independent inputs** —
the user's speed setting, the speed governor's backpressure rate, and
hold-to-fast-forward — and only the choreographer knows all three; reading one of
them inside `d()` would silently ignore the other two. And importing a zustand
store into the animation-maths module would mean every unit test of that maths
needed a store instance.

## D17 — A flight clone is rendered at the DESTINATION size

The spec quotes scale keyframes in two different bases: `draw` ends at 1.00
(destination basis) while `cast` ends at 0.635 and annotates it "132/208" (source
basis). Mixing bases lands each beat a pixel or two off its slot, by a different
amount per beat, which is unfalsifiable by eye.

So the clone is **always** rendered at the destination size. `scaleKeys()` forces
the first keyframe to `fromH/toH` (so it starts exactly covering the source) and
the last to exactly `1` (so it lands pixel-perfect). Beats choose only the
mid-flight bulge — which is not decoration: a card that grows slightly crossing
the middle of the table reads as passing nearer the viewer, and `peak > settle` is
the numeric signature the beats battery asserts on.

## D18 — `FlightOverlay.tsx`, not `FlightLayer.tsx`

The spec's file list names both `FlightLayer.tsx` (the renderer) and
`flightLayer.ts` (the singleton). Those two cannot coexist on Windows or macOS:
`tsc` fails with TS1149, and which one an import resolves to depends on the order
the compiler saw them. The renderer is `FlightOverlay.tsx` — also more accurate,
since it *is* the portal overlay.

The same collision hit `handFan.ts` vs `HandFan.tsx`; the pure geometry module is
`fanGeometry.ts`.

## D19 — Auto-stacking is load-bearing, but not in the way the spec claims

The spec says auto-stacking is what makes a 4-player board fit at 1080p. Measured,
that is half true, and the honest version is more useful.

At 4 players a pod's inner row is ~420 px and an opponent card is 83 px, so a row
holds **5 cards**. On a real 21-permanents-per-seat board (the spec's own figure:
10 lands + 6 other noncreatures + 5 creatures) auto-stacking collapses the
duplicated lands and removes **43% of the slots** — 84 → 48, measured. What it does
**not** do is make that board fit without scrolling: six *distinct* creatures
cannot fit a five-slot band however the lands are collapsed. Which is exactly why
the packing ladder has horizontal scroll (rung 4) and the pod expander (rung 5)
below it.

So the battery asserts the measured slot reduction, and that fewer bands overflow
with stacking than without — rather than a binary "it fits" that is not true.

## D20 — The cast beat has no 100 ms pre-lift

The spec's cast beat begins with a 100 ms lift of the card **in the hand**, before
the flight. That has to run before the state commit, which would gate the commit on
an animation and break the lag model (a group's view commits when the group
*starts*).

The lift belongs to the **input affordance**, not to the engine event: in M3,
clicking a card to cast it lifts it locally while the intent is in flight to the
host — more responsive, and more honest about what the lift means. The arc plus the
early size swell carry the "thrown from the hand" read on their own.

## D21 — `project()` MUST preserve referential identity — a hard requirement on M3

⚠️ **The single largest performance finding in M2.** Before the fixture's `view()`
reused unchanged objects, **every view commit produced exactly one long frame**, and
its duration scaled with the board: 33 ms at 2 permanents per seat, 58 ms at 10,
83 ms at 20. The long-frame *count* tracked the commit count precisely — even for
pure phase changes that animate nothing at all. Committing a shallow *copy* of the
same view produced zero long frames and a 9 ms maximum, which is what proved the
cost was not React's reconciliation but that every `CardView` was a fresh object, so
`React.memo` on `Card` could never match and all ~50 cards re-rendered and restyled.

`FixtureTable.view()` now caches and reuses `CardView`, `SeatView` and each zone's
id array when nothing about them changed — field by field, because a shallow object
compare is precisely what fails here. Result: 0 long frames, and the cost stopped
scaling with board size.

**`src/engine/project.ts` must do the same.** It is not an optimisation there
either: a projection that rebuilds every object makes the whole table restyle on
every event.

## D22 — Springs are for two-value transitions only

`motion` silently produces **no animation at all** when a multi-keyframe array is
paired with a spring transition. `animate(el, { scale: [1, 1.06, 1] },
SPRING.nudge)` leaves the element's transform constant, with no error and no
warning. The beats battery caught two of these as "76 frames, 1 distinct matrix",
which reads as "this beat does nothing" rather than as "wrong transition type".

There-and-back bumps use `{ duration: ds(…), ease: EASE.overshoot }` or
`EASE.impact`. The warning is on `SPRING` in `tokens.ts`.

## D23 — The driving MotionValue is LINEAR in time

The first implementation eased the single progress value with `EASE.flight` and gave
every property keyframe times on that value. So a keyframe "at 0.5" actually
happened at **32%** of the elapsed time, and the mid-flight face flip finished while
the card was still two thirds of the way across. The battery caught it: `rotateY
crosses 90° at t=0.318`.

The driver is now linear, and `easedPathKeys()` samples the bezier at eased
parameters instead. One MotionValue still drives the whole flight, every keyframe
time now means wall-clock time, and the flip crosses 90° at t = 0.50 ± 0.02.

## D24 — The arc bows toward the viewport centre

The spec sketches `sign = mid.y > viewportH/2 ? +1 : −1`. That is wrong for half of
all flights: the perpendicular `(−dy, dx)` flips with the direction of travel, so a
fixed sign bows a right-going flight up and a left-going one down. An opponent's
draw arced off the top of the screen while mine arced correctly.

Projecting the perpendicular onto the direction of the viewport centre expresses the
same intent in a form that cannot invert, and needs no special case for
near-vertical flights. Unit-tested in both directions and reversed.

## D25 — The hand-fan formula, not the spec's tabulation

`ui-animation-spec` §4.5 gives the formula `26·e^(−0.55·|i−h|)` and annotates it
"→ 26, 15.0, 8.6, 5.0, 2.9 px". Those disagree: the list is the formula evaluated at
d = 0…4, and d = 0 is the hovered card, which by definition does not move. Real
displacements start at d = 1, where the immediate neighbour moves **15.0 px**. The
formula is the contract (and the M2 handoff's verification agrees with it); only the
tabulation is off by one.

## D26 — `packRow` owns the exact rendered pixel size

The packer spaced cards by `cardW * scale` while `PermanentStack` rounded the height
and re-derived the width from the aspect ratio. Two roundings of the same number are
not the same number, and the last card in a row sat 2.7 px past its band's right
edge at 1440×900 with 3 seats. `PackedRow` now carries `cardH`/`cardW`, and the
renderer must use them rather than recomputing.

## D27 — No `filter: blur` on the damage badge, and no chrome on a flight clone

Both are measured paint costs, not taste.

- The spec's 3-frame blur entrance on the floating number cost **5 long frames with
  a 108 ms maximum** during a damage volley, because a volley creates three or four
  badges at once and each blur forces a filter region and a per-frame repaint. The
  overshoot and the fade already carry the punch.
- A flight clone rendered **two full `Card`s with all their chrome**; mounting one
  cost ~25 ms, and a six-card draw ~50 ms. Clones now pass `chrome={false}` and only
  mount the reverse face when the flight actually flips. Nobody reads a name strip
  on a card that is mid-flight for 420 ms.

Also removed: `backdrop-blur` on the card name strip, which meant one backdrop
filter **per card** — around 50 on a 4-player board, each forcing a readback of the
region beneath it.

## D28 — A per-frame rect cache in the registry

`readAll` batches the keys one caller asks for, but a group of beats makes several
separate calls (the flourish wants the stack rect, a landing wants the card's new
rect, a damage punch wants the target's plate), and each is its own forced
style-and-layout flush over a freshly invalidated table. Reads are now cached until
the next animation frame, and the choreographer calls `invalidateRects()`
immediately after each commit so no beat can read a pre-commit position.

## D29 — The perf gate's long-frame count is NOT met, and is reported honestly

Final measurement, 5 s at 1920×1080, 40-permanent board plus a draw burst, damage
volley, tap sweep, cast-resolve and death chain:

```
579 frames · 115.7 fps · p50 8.3 ms · p95 8.5 ms · p99 16.8 ms · max 41.7 ms
p95 ≤ 18 ms                                 PASS  (8.50 ms)
≤ 2 frames over 20 ms                       FAIL  (4)
≤ 2 frames over 33 ms (60 Hz equivalent)    PASS  (1)
stray getBoundingClientRect calls           PASS  (0)
```

Down from 16 long frames, p99 91.6 ms and a 108 ms maximum before D21/D27/D28. The
four remaining are one at the very first sampled frame as the burst kicks off, plus
three 25 ms frames. The spec's target is "60 fps (16.67 ms)" and its > 20 ms
threshold is one frame of slack at 60 Hz; this renderer runs at ~115 fps, where a
25 ms frame misses two of its own 8.7 ms deadlines but would not have dropped a
frame at 60 Hz. The battery reports **both** numbers so the gate is not quietly
re-scoped to whichever one passes.

The remaining cost is clone mounting during a multi-card draw. The next lever, if it
turns out to matter, is a pooled clone renderer that reuses elements rather than
mounting fresh ones.

## D30 — Dev screens stay reachable in a production bundle

`#tokens`, `#flight` and `#beats` are hidden from the nav in a production build but
still render if the hash is set. That is deliberate: it is what lets
`scripts/probe.cjs` assert the **production** CSP against a real `motion.div`, a
real font check and a real `@theme static` token sweep. A packaged app has no URL
bar, so they are unreachable in practice. M5's bundle audit can decide whether to
strip them.

## D31 — An always-mounted screen must not do work until it is looked at

The table screen is always mounted (it must never unmount — it owns the
choreographer queue and, from M4, the socket). Fetching its card pool in a mount
effect therefore fired a card-database request during app **startup** and forked the
card-DB worker before anything had asked for a card, defeating the supervisor's lazy
start. The shell probe caught it: `worker is not started before the first request`
began failing with `state=ready`.

The fetch is now gated on the table actually being the visible screen. Any future
work added to a persistent screen needs the same gate.

Related, found in the same session: the supervisor must **queue requests until the
`ready` handshake**. `postMessage` on a freshly forked utilityProcess is dropped,
so the first `status` call after a lazy start silently returned nothing. There is
now an outbox that flushes on `ready` and is cleared on exit (flushing it into a
replacement worker would double-run the request).

---

# M3 — the rules engine and solo play

## D32 — The measured Tier-2 coverage of the ingest

`src/data/oracleParse.ts` is the entire Tier-2 boundary: a fact it does not
parse is a fact the engine does not enforce. So the honest way to state coverage
is to run the whole card database through it and count what it could not
understand. Measured on the 2026-07-26 data — **113,559 cards / 116,073 faces,
zero throws, 1.4 s**:

| count | category | what it means |
|---|---|---|
| 24,826 | `keywords:noneTier2` | the card has keywords, none of which we automate (Crew, Cycling, Kicker…) |
| 783 | `typeLine:unknownType` | a type word not in our list — almost all Un-set and Attraction types |
| 677 | `protection:unenforced` | `protection from creatures` / `from Dragons`; only colours and "everything" are enforced |
| 629 | `mana:noSymbols` | an "Add" line whose amount we cannot model (Reflecting Pool, Bloom Tender) |
| 208 | `ward:nonManaCost` | `ward—Pay 3 life`; only a mana ward is taxed |
| 102 | `mana:variableAmount` | "add X mana", "for each…" |
| 18 | `mana:unknownSymbolInAbility` | |
| 10 | `mana:noUsableOutput` | |
| 2 | `manaCost:unknownSymbol` | |
| 1 | `manaCost:halfMana` | Un-set `{HW}` |

⚠️ **These are the M3 numbers, kept for the record. M5 re-measured and moved
them — see D68 below for the current table and the reasoning.** The live values
are pinned in `src/data/oracleParse.node.test.ts`, so the two cannot drift apart
without a test failing.

Also measured and asserted: **every** land with a basic land type produces mana,
and exactly **17** faces have an empty type line — all layout `other`, all
Commander-illegal (the second halves of Un-set minigame cards). Both numbers are
pinned so a change is visible rather than silent.

⚠️ The intrinsic land-type pass is not optional. Scryfall's oracle text for the
original dual lands is the **empty string** — Tundra's ability comes from CR
305.6, not from its text — so a text-only parser reports that Tundra taps for
nothing and the affordability filter greys out half a real deck's hand.

## D33 — Phyrexian is a hybrid whose other half is life

The spec sketched `PaymentProblem.phyrexian: Color[]` alongside `hybrids`.
`{W/P}` and `{W/U}` are the same shape of decision — "satisfy this symbol one of
these ways" — so unifying them gives the solver, the payment review and the
validator ONE code path each instead of two that must be kept in agreement.
`HybridOption` gained a `life` variant; nothing else changed.

## D34 — The Tier-3 P/T override sets the BASE, before counters

The spec put the manual override at layer 7d, i.e. after counters. Implemented
that way, a creature with a `4/4` override and a `+1/+1` counter is a 4/4 and
the counter tool silently does nothing — which reads as a broken counter tool,
not as a layer decision. What a player means when they type `4/4` into the
manual tool is "its base is 4/4 now" (the wording most cards use). It is applied
at the start of layer 7b, and counters add on top.

## D35 — The view reports the MAXIMUM commander damage per opponent, not the sum

State keys commander damage by the commander's **instance id**, which is what
makes a partner pair track separately for the 21 threshold at zero cost. The
seat plate shows one number per opponent, so `project()` takes the maximum
across that opponent's commanders. Summing would show 21 when neither half has
dealt lethal — a number that looks like a loss and is not one.

## D36 — HoldPriority lasts until you pass, not for exactly one action

The spec makes it a one-shot: hold, act once, flag clears. Implemented that way,
a player who holds priority, casts a spell and then has nothing else affordable
is auto-passed instantly — the exact situation the toggle exists to prevent, and
the button looks broken. It is a toggle in the UI, so it behaves like one:
auto-pass is suppressed until that player actually passes.

## D37 — "Someone cast something" is a monotone counter, not a stack size

⚠️ `PriorityState.stackSizeAtLastGrant` could never work. It is written by
`PriorityGranted` and read by `shouldAutoPass` in the same breath, so
`stack.length > stackSizeAtLastGrant` is always false — `stopWhenAnyoneCasts`
never fired and every spell resolved without anyone being offered a response.

Replaced by `stackAdds` (how many objects have EVER gone on the stack) plus
`seenStackAdds[player]`, recorded when that player passes. A stack SIZE also
cannot distinguish "a spell resolved and another was cast" from "nothing
happened" — both leave the stack one object deep — which a monotone counter can.

The caster's own `seenStackAdds` is bumped by `SpellCast`, so nobody is stopped
to respond to their own spell.

## D38 — A token ceasing to exist is a REMOVAL, not a move

Modelling CR 704.5d as `CardsMoved` to exile made the next SBA pass see the
token in exile and move it to exile again, forever: `pump()` hit its
10,000-iteration cap on the first token that died. `TokensCeased` deletes the
instance outright. The two-step (graveyard first, so a "dies" trigger can see
it, then removal on the next pass) is preserved and is precisely why `pump()`
must loop rather than run one SBA pass.

## D39 — With no attackers, the blocker and damage steps are skipped

CR still runs them; they have nothing to do. Skipping them removes three
pointless priority rounds per turn, which on a four-player table is twelve
clicks nobody wants. Similarly, a player with **no legal block** is
auto-submitted with an empty declaration rather than prompted — otherwise the
whole table waits on someone whose only creature is tapped.

⚠️ The same logic means the declare-attackers prompt does not appear when you
control nothing that can attack. A test that asserts "the game prompts for
attackers" must put a creature on the board first, or it passes for the wrong
reason (this one first failed for one).

## D40 — Snow is folded into generic; restricted mana stays out of v1

Spec Q8 says ignore restricted mana in v1. `{S}` therefore becomes "one mana of
anything", which is over-permissive (a deck with no snow permanents can cast a
snow spell) and is the honest trade: refusing to pay `{S}` at all would make
those cards uncastable. Conditional sources ("Spend this mana only on…", or any
activation cost beyond `{T}`) are excluded from auto-tap and stay manually
tappable — the Tier-2/Tier-3 line stated rather than guessed.

## D41 — The replay-equivalence fuzzer, measured

The gate that governs the milestone. **500 seeds × 200 random legal intents:
98,811 accepted intents, 1,165,201 events, 9,397 turns, 97 s**, with
`assertInvariants` run after *every* submitted intent and
`stateHash(replay(log)) === stateHash(live)` asserted per seed. Green.

It found three real bugs no hand-written scenario had: the Tier-3 tap tool
leaving a card tapped in a hand, the cast-window invariant failure (a card is on
the stack from CR 601.2a, before the `StackObject` that names it exists), and a
stale projection identity cache after a rewind.

`npm run test:fuzz` runs it; `CRT_FUZZ_SEEDS` controls the count, and the
in-suite default is 60 seeds (~13 s) so the ordinary `npm test` stays fast.

## D42 — Solo play is a HOTSEAT, because `legalActions` is per-viewer

`legalActions` is computed for ONE player, deliberately: computing it for
everyone would leak the contents and affordability of every hand, and that is
the whole point of `project()`. Solo play therefore has to move the viewer to
whoever is acting. `session.setAutoSwitch` does that, **deferred until the
choreographer has drained** — a seat change is a hard sync (`applySnapshot`
bumps the epoch and discards queued beats), so switching the instant the engine
stops would cut off the animation of the move that just happened.

The first automated playthrough locked the seat and then reported a 171-turn
game in which only one player ever played a land. The engine was right; the
script was reading one player's legal actions for everybody.

## D43 — The starter deck is 99 cards

Seats with no imported deck get a generated deck. At 49 cards a solo game ended
with all four players **decking out on turn 171 at 40 life each** — a correct
finish and a useless test. At 99 the same script produces a real game: 45 turns,
5,393 events, 32 attack declarations, 68 attackers, and a winner at 1 life.
Library size is what decides whether a game lasts long enough to have a board.

It is deliberately **not** a legal Commander deck (it repeats spells), and the
lobby says so. Pretending it passes the validator would be a lie.

## D44 — The spec's open questions, as implemented

| # | Question | Implemented |
|---|---|---|
| Q2 | Free first mulligan | **On** by default; `GameOptions.freeFirstMulligan` |
| Q3 | CR 903.9a commander to the command zone | **`'ask'`**, with "always do this"; QUEUED, so a wrath that bins a partner pair asks about both |
| Q4 | Which Tier-2 keywords | flying, reach, trample, vigilance, haste, lifelink, deathtouch, first/double strike, menace, defender, indestructible, flash, fear, intimidate, skulk, shadow, horsemanship, hexproof, shroud, plus landwalk, protection-from-colour and ward-as-tax. **Phasing and changeling are out** |
| Q5 | Combat damage assignment | **Automatic.** ⚠️ It had `options.manualCombatDamageAssignment` as "the seam, unused in v1" — **the option and the `assignCombatDamage` prompt it would have raised are GONE (D125)**: nothing could set the option and no intent could answer the prompt, so the seam was a latent hang rather than a seam |
| Q6 | A disconnected player | **Pauses indefinitely**; `PassForPlayer` is available to anyone and every use is a logged, manual-marked event |
| Q7 | Group rewind | **Built.** Unanimous vote among living players; re-folds a log prefix |
| Q9 | CR 103.7 | Encoded as written, and the first turn's log line says which clause applied |
| Q12 | Two commanders | Supported; per-instance damage makes it free |

## D45 — `data-card-id` is the PRINTING id, not the instance id

⚠️ Cost a debugging round in step 12. `Card.tsx` sets
`data-card-id={card.scryfallId}` — two copies of Sol Ring share it. The
**instance** id lives on the slot wrappers: `data-band-slot` (battlefield) and
`data-hand-instance` (hand). The aim veil, the card context menu and the
battery's DOM assertions all query those. Using `data-card-id` made the veil
find zero targets and report "0/0 legal", which reads as "there is nothing to
target" rather than "the selector is wrong".

## D46 — Granting priority and deciding what to do with it are two iterations

`advance()` emits `PriorityGranted` and nothing else; the NEXT iteration sees the
granted state and either auto-passes or stops. Deciding both in one batch means
`shouldAutoPass` runs against a state that does not yet say who has priority —
and `legalActions` checks exactly that, so it returns an empty list and every
player auto-passes always. The split also gives "a player just cast something and
still holds priority" (CR 117.3c) the same code path instead of its own branch.

## D47 — An SBA that asks a question must not re-ask it

`advance()` runs the state-based-action pass BEFORE the awaiting check, because
CR 117.5 requires that order. So an SBA that emits a prompt emits it again on
every single iteration: the legend rule hit `pump()`'s 10,000-iteration cap the
moment a second Krenko landed. `findLegendChoice` therefore skips a group whose
prompt is already on screen. Any future prompting SBA needs the same guard.

## D29a — The perf gate's long-frame count is NOISY, and D29 under-reported that

D29 recorded a single run: 4 long frames over 20 ms, 1 over 33 ms, p95 8.50 ms.
Re-measured four times during M3 on the same machine and the same scene:

| run | frames > 20 ms | frames > 33 ms | p95 |
|---|---|---|---|
| full battery | 3 | 0 | 8.50 ms |
| full battery | 7 | 1 | 8.50 ms |
| `perf` alone | 8 | 3 | 8.50 ms |
| `perf` alone | 9 | 2 | 8.50 ms |

So the honest statement is **3–9**, not 4, and running the section ALONE is
consistently worse than running it after the rest of the battery — a cold
renderer has not yet warmed its clone pool, its decoded-image cache or its JIT.
p95 does not move at all across any of them, which is the number that actually
describes how the table feels.

⚠️ Do not read a single run of this gate as a regression or an improvement.
M3 changed nothing in the render path; it added an engine that does not run
during the perf scene at all. If this number is ever used to justify work,
measure it at least three times, in the same context, and quote the range.

---

# M4 — multiplayer

## D48 — `connect-src` is widened PER ORIGIN, never per scheme

⚠️ The one deliberate weakening of D4, and the shape of it matters more than the
fact of it.

`connect-src 'self' wss:` would have been one character of work and would have
let a compromised renderer post anywhere on the internet — which is exactly the
posture D4 existed to protect. What ships instead is
`connect-src 'self' <the relay the user configured> <the LAN address they typed>`
and nothing else. `electron/netallow.cjs` owns the decision:

| | accepted | why |
|---|---|---|
| `wss://anything` | yes | the user's own relay, on the internet, is the point |
| `ws://` on a private address | yes | `10.*`, `192.168.*`, `172.16–31.*`, `169.254.*`, loopback — direct LAN play, where demanding a certificate would make the feature unusable |
| `ws://` on a public address | **no** | somebody's game traffic in the clear; the fix is `wss://` and the message says so |
| anything else | **no** | including `https://`, which people will type |

**How a user-configurable relay is reconciled with a static header** (the
question D4 left open): the header is not static — it is computed on every
document load from a validated list in settings. Adding a new address therefore
costs exactly one reload, once, and the app says so in words rather than handing
the renderer a socket the browser will silently refuse. `net.allowOrigin()`
returns `added: true` to mean "reload first", and every entry point checks it.

Why not proxy the socket through main, keeping `connect-src 'self'`? Because a
game frame would then cross two IPC hops per direction on the hot path, and the
thing being protected — "the renderer cannot reach an arbitrary host" — is
already achieved by an origin allowlist that main alone can write.

Verified in both directions, which is what keeps the check honest: the probe
asserts an unconfigured origin is `blocked` **and** that the LAN origin
`reached-network`. A CSP that blocked everything would pass the first assertion
alone while making multiplayer impossible.

## D49 — one `Update` frame per INTENT, with the groups kept separate inside it

⚠️ A bug fix, not an optimisation, and the way it was found is the useful part.

A single intent produces about 13.5 groups (one `advance()` each), and the host
carries every remote player's traffic over ONE relay socket. A frame per group
per player is therefore ~40 frames per intent on one connection — which runs
straight into the relay's 200 msg/s per-connection cap. The relay drops the
excess and replies `rateLimited`; the *symptom* is one player quietly stuck
eleven events behind, with no error anywhere and three players who look fine.

`Update` now carries `groups: UpdateGroup[]`, each with its own patch and its own
cues. The client applies them in order and calls `choreographer.ingest` once per
group, so the M2 seam is untouched: a group's view is still committed when that
group's animation starts. Collapsing the groups into one patch would commit the
final board before the first beat ran.

`session` and `viewHash` ride once per FRAME rather than once per group. That is
also measured: `legalActions` runs the mana solver over every castable card, and
hashing a view canonicalises the whole thing — together they were **78% of the
host's per-intent time** (38.4 ms for four players, down to 13.0 ms). Checking
where the engine STOPPED still catches a bad patch within one intent, because
patches compose.

## D50 — three cases for `Update.base`, not two

⚠️ Collapsing "stale" into "gap" costs 4 GB of memory in twenty seconds.

```
base === ours  → apply
base <  ours   → STALE: a Snapshot overtook it in flight. Drop it, silently.
base >  ours   → a genuine gap. Ask for a snapshot, once.
```

The first implementation had two cases (`!==` → resync) and produced a **resync
storm**: the client asks for a snapshot, the frames already in the pipe arrive
behind it, each one looks like a gap, each one asks for another snapshot, and
each snapshot is ~100 KB × four clients. Measured on the real-socket test: out of
memory at the 4 GB V8 heap limit within twenty seconds of the game starting.

⚠️ **The loopback tests could never have found this**, because on a loopback pair
nothing is ever in flight. That is the whole argument for `relay.node.test.ts`
existing at all: same sessions, same protocol, real sockets.

`requestResync` also refuses to ask twice for the same event count — a `Snapshot`
clears the pending flag, so without that guard a board that genuinely cannot be
reconciled would ask forever instead of failing visibly.

## D51 — `redactEvent` takes no `GameState`, and it redacts the SEED

Spec §7.3 signs it `redactEvent(ev, viewer, after)`. Every rule is decidable from
the event and the viewer alone, and a parameter nobody reads is an invitation for
a caller to pass the state from the wrong side of the batch — a bug that would
look exactly like a redaction failure. It goes back in the day a rule needs the
resulting board, and not before.

Added beyond the spec's list: **`GameCreated.seed` is stripped for everyone.**
The seed reconstructs every shuffle the game will ever perform, so a client that
had it plus a decklist could compute the order of its opponents' libraries — the
most valuable secret in the game, and one no amount of care in `project()` would
have protected.

Also stripped, and not in the spec: a `CardsMoved` move whose **both** endpoints
are a library. That names an instance id inside a zone the viewer cannot see
into — bottoming after a mulligan, a Tier-3 "put on the bottom", the card-by-card
moves a shuffle performs.

⚠️ `redactBatch` must never drop a `Narrated`. `toViewEvents` locates each
rendered log line by counting the `Narrated` events in the batch it was handed
and indexing back from the end of `state.narration`; dropping one silently shifts
every line in that group onto the wrong text.

## D52 — the `PlayerView` crosses the wire with printing IDS, not card data

`PlayerView` inlines `CardData` because M2's table renders straight from it, and
that shape must not change. But a `CardData` is ~2 KB — name, type line, full
oracle text, artist, legalities, every face — so sending it inline would make a
one-card update 2 KB instead of 120 bytes and a snapshot ten times larger, for
data the receiving app already has on disk.

Each printing therefore crosses the wire exactly ONCE per client, in a
dictionary carried by `Snapshot` and `Update`, and the client rehydrates before
anything sees a `PlayerView`. `viewHash` is computed over the same reduction,
which makes it cheap enough to run on every intent.

⚠️ **This is the concrete reason `oracleVersion` is a hard reject** (spec Q13).
The dictionary is the only channel by which a client learns a card it does not
already have, so both ends must agree about what a printing id MEANS.

## D53 — the payment solver runs on the CLIENT, on a `SolveInput` off the wire

`previewCast` has to be synchronous: it is called from a `useMemo` and from
`highlightedIds()`, and making it asynchronous would put a round trip between
clicking a card and seeing what auto-tap proposes.

`SolveInput` was already decoupled from `GameState` (see the comment in
`payment.ts`), so the host ships it in `SessionState` and the client runs the
**identical** solver on the **identical** input. There is no second
implementation to drift, which matters because the one thing an auto-tapper must
never do is let a player approve one payment and be charged another. The
commander tax comes from the matching `CastSpell` legal action rather than being
recomputed, for the same reason.

Consequence worth stating: a guest's `src/engine/` is idle *except* for the
payment solver and replay. That is a widening of D-NET-1's "present but idle",
and it is safe because the solver produces a *proposal* the host re-validates.

## D54 — solo play is four clients over four loopback pairs

The M3 hotseat moved one `Game.viewer` between seats. M4 replaces it with one
`ClientSession` per seat, each on its own `loopbackPair` to a real `HostSession`
— which means solo play and networked play are literally the same code path,
with the sockets removed.

Two things fall out that were previously matters of discipline:

- **The hotseat cannot show you a seat you have not switched to.** Each client
  holds only its own projection.
- **An intent is routed to the seat it names.** A hotseat viewer is often one
  step ahead of the seat that has to act (the mulligan prompt moves to p2 while
  the table still shows p1), and sending p2's decision down p1's client is
  refused by the host with "you can only act for your own seat". The host is
  right; picking the correct client is the hotseat's job. This cost a debugging
  round: the M3 `engine` battery went from 27/27 to 17/27 and every failure read
  as "the game never leaves the mulligan".

Cost: four projections per group instead of one. Measured at 13.0 ms per intent
for four players, against a game where a human acts every few seconds.

## D55 — the group-rewind vote now actually rewinds

M3 built the vote (D9/Q7) and left nothing to execute it: `voteRewind` emits the
votes and clears the prompt, but the rewind itself is `Game.rewind`, which is
deliberately not a reducer case — a reducer that could move BACKWARDS would break
the append-only invariant everything rests on. So something above the engine has
to notice the vote passed, and before M4 nothing did.

The host does it, and then sends every client a `Snapshot`: a patch cannot
express "go backwards", and a snapshot is the same repair reconnect uses. The
M3 battery's "rewinding actually shortens the active log" check was passing
vacuously before; it now measures 506 → 253 events.

## D56 — `resumeToken` is a keyed 64-bit tag, not HMAC-SHA256

Spec §7.5 says HMAC. The honest version: what this defends against is two friends
clicking "rejoin" at the same moment and one of them landing in the other's seat
— and thereby seeing their hand. Taking a seat deliberately means guessing 64
bits over a socket, with no oracle and no offline attack surface, because the
host secret is 128 bits from `crypto.getRandomValues` and never leaves the
process. `crypto.subtle` would make verification asynchronous and therefore
`Hello` asynchronous, for a margin that does not matter under a friends-only
trust model in which a cheating HOST is already out of scope.

## D57 — a disconnected LOBBY seat is reclaimed by name

Before the game starts, a `Hello` with no resume token whose player name matches
a seat whose socket has gone away reseats that player instead of creating a new
one.

Without it, a guest who closes the app and joins again takes a NEW seat and
leaves a ghost: it holds one of the four slots, shows as disconnected forever,
and makes `start()` refuse with "Bo is not ready yet" about somebody who is
sitting right there. Matching on a name is safe **here and only here** — a lobby
contains no hidden information, the trust model is friends-only, and the moment
the game starts the `resumeToken` is the only way back in.

## D58 — the relay refuses an explicit room code rather than substituting one

`RelayCreateRoom{code}` exists so a host whose relay restarted can come back on
the code its three friends are still looking at. The first version silently
replaced an unusable code with a random one — which leaves the host holding a
code nobody else was told, and every guest failing with `noSuchRoom` forever. It
looks like a broken relay and is actually a typo. It now answers `badRequest`
(malformed) or `roomTaken` (in use), and the host's link reclaims the host slot
on `roomTaken` and retries the whole socket on `noSuchRoom` — the one transient
case, which is what a relay restart looks like from a guest.

Cost one debugging round when a test asked for a code containing an `I`, which is
not in the alphabet.

## D59 — the LAN listener is its own implementation, and it is token-gated

`electron/lanServer.cjs` speaks the same protocol as `relay/src/server.js` and
shares no code with it. The relay is deployed on its own to a VPS with
`npm i && node src/server.js`, and M5's bundle audit requires that `relay/` never
reach `app.asar` — so importing it would either break the audit or force the
relay to grow a build step. The LAN case is genuinely smaller: one room, no
registry, no TTL, and a lifetime tied to a game.

⚠️ It is **token-gated**, which the internet relay is not. A six-character code
read aloud is fine on the internet, where an attacker must also find the relay
and guess the code before it expires; on a shared local network — a flat, a hall
of residence, a coffee shop — anyone can see the listener. The host's screen
shows 128 bits that a guest must present.

⚠️ Its `error` handler is `on`, not `once`, and it survives being resolved. An
unhandled `error` on a `net.Server` is an **uncaught exception**, which in
Electron means a modal "A JavaScript error occurred in the main process" and a
dead app. Observed exactly that way: a previous run's window was killed without
running `before-quit`, its listener kept port 5282, and the next run crashed on
`EADDRINUSE` instead of saying the port was busy.

Its room code is also a real six-character code from the same unambiguous
alphabet as the relay's. A literal `LANGAME` was seven characters and failed the
join form's own validation — a LAN code is read aloud exactly like a relay code,
so it has to BE one.

## D60 — a game id is unique per GAME, not per seed

`games/<gameId>.ndjson` is append-only, so two games sharing an id share a FILE —
and the second is appended to the first, producing a log that replays to neither.
The net battery caught it: a fixed probe seed produced a 2,582-line file after
several runs whose replay hash matched nothing. The id is now
`g-<seed>-<random>`; the seed still determines the game, the id only names the
file.

## D61 — `Awaiting` crosses the wire whole

Spec §7.3 rule 9 says an `awaiting` that names another player should be reduced
to `{kind, player}` with its payload stripped. Measured against the implemented
union, **every field in every variant is a public game object**: battlefield ids
for the legend rule, graveyard cards for the commander-zone queue, stack ids for
targeting, player lists for mulligans and blocks. There is nothing to strip, and
inventing a parallel redacted type would add a boundary that protects nothing.

⚠️ That is a statement about today's union, not a principle. A future variant
that carried, say, "choose a card from your hand" WOULD need redacting.
`net.test.ts` pins the seat-visibility assertions that would catch it, and this
entry is the note that has to be re-read when a variant is added.

## D62 — the host broadcasts N directed frames rather than one `to: 'all'`

`seq` is per-sender-per-recipient and monotone, which is what makes a gap
detectable after a reconnect on a new socket. A shared broadcast frame cannot
carry a different `seq` for each recipient, so allowing one would quietly break
the only thing `seq` is for. A room holds at most four players, so "four small
frames" costs nothing worth having. The relay still implements `'all'` — it is
part of the protocol and is tested there — the host simply does not use it.

---

# M5 — ship

## D63 — digest mode goes through `d()`, like every other beat

⚠️ A rule violation with a measurable cost, found by the M5 motion battery and
worth recording because the rule it broke is stated twice in the codebase.

`tokens.ts` says nothing outside it may hard-code a millisecond value for a beat,
because a hard-coded duration "cannot be sped up, slowed down, fast-forwarded or
skipped, and the choreographer's speed governor silently stops working for it".
`digestPulse` in `beats.ts` was the one beat that did it — `sleep(DUR.digest)`
rather than `sleep(d(DUR.digest))` — and every consequence in that sentence was
true of it:

- **`animationSpeed: 'off'` was not instant.** The Settings screen labels it
  "Off — instant, no card flights". Every other beat scaled to 0 ms (the scale is
  `Infinity`, and `d()` maps that to 0), but the digest pulse stayed at a flat
  140 ms **per group**. A five-group intent therefore took 700 ms to reach its
  final board for a user who had explicitly asked for instant.
- The governor could not accelerate a deep queue of digest groups, and
  hold-to-fast-forward did nothing in digest mode.

One character of fix. The reason it survived three milestones is that digest mode
had no gate of its own until M5 — nothing measured convergence time, so a
consistently-too-slow path looked identical to a correct one.

## D64 — the stack flourish is a DIGEST pulse in digest mode, not a 360 ms one

Found by the same gate, and the more interesting of the two.

`DUR.digest` is documented as "digest mode's whole vocabulary: one fade, no
clone". The flourish beat honoured half of that — it skipped the particle ring
and burst — and then still ran `await sleep(d(DUR.flourish))`, 360 ms, which made
it by a wide margin the longest thing in a mode that is supposed to contain one
140 ms fade.

⚠️ The cost is not cosmetic, because **a group's view commits when the group
starts**. The next group cannot begin until this beat finishes, so a 360 ms
flourish is 360 ms during which the board does not advance. Measured on the M5
motion battery, under `prefers-reduced-motion`:

| scenario | groups | converged before | after |
|---|---|---|---|
| drawBurst | 1 | 41 ms | 40 ms |
| **castResolve** | 2 | **546 ms** | **311 ms** |
| deathChain | 2 | 170 ms | 167 ms |
| damageVolley | 3 | 26 ms | 25 ms |

The approved plan's reduced-motion target is that the state converges in under
400 ms; `castResolve` was the only scenario that missed it, and the flourish was
the entire reason.

⚠️ Convergence is measured on the **committed board**, not on the queue. The
first version of the check timed `run()` + `settle()` and reported 2,679 ms for
four scenarios — which reads as "reduced motion is slow" and is measuring the
decorative pulses draining long after the board is already correct. What a player
experiences is when the board is right, and that is what the gate now polls for.

## D65 — the reduced-motion media query is read in ONE place

`src/ui/anim/reducedMotion.ts`. The choreographer decides the animation mode from
it; the Settings screen uses it to tell the user their OS has overridden their
speed choice. Two copies of `matchMedia('(prefers-reduced-motion: reduce)')`
would eventually disagree, and the visible symptom would be a Settings screen
reading "Cinematic" over a table that plays nothing — i.e. the setting looking
broken when it is being correctly overridden.

⚠️ It is a **mode** input, not a scale input. D16 fixes the effective animation
scale as the product of exactly three things, and `d(ms)` reads it from the
choreographer alone. Reduced motion does not make beats faster; it routes them to
digest, where there is nothing to scale. Adding it as a fourth multiplier would
double-apply with speed `off` (`Infinity` × anything) and is precisely the fourth
reader D16 forbids.

⚠️ It is read on **every group**, never cached at module load: the OS preference
can be toggled mid-game, and a value captured once would leave a player who just
asked for reduced motion watching cards fly until they restarted.

## D66 — the skip affordance is shown only while the table is busy

Hold-Space and Esc were wired in M2 and were undiscoverable for three milestones.
A feature nobody is told about has not shipped, and M5 is the ship milestone.

`SkipHint` is bound to a new `subscribeBusy`/`isBusy` pair on the choreographer
rather than to a poll, and it is deliberately **not** permanent chrome: a hint
that is always on screen becomes furniture within a minute and stops being read.
It also hides itself entirely under reduced motion or speed `off`, because there
are no card flights to hurry and offering to speed up something already instant
is the kind of small lie that makes a whole interface feel untrustworthy.

## D67 — two battery checks were asserting on luck, and now are not

Both failed in a full run and passed standalone with the SAME seed, which is the
signature of a test whose premise is timing rather than behaviour.

1. **"a land can be played through the real engine."** A land is sorcery-speed,
   so only the player with priority in their own main phase is ever offered
   `PlayLand`, and `legalActions` is computed for the viewer alone (D42). Which
   seat is being watched depends on when the choreographer last drained. A
   seven-card opening hand with no land is a perfectly legal hand — the engine is
   not wrong to offer nothing, and reading that as a failure tests the deck. The
   check now passes priority until somebody IS offered a land, which is what a
   real table does, and fails only if nobody can across several turns.

2. **"the skip hint agrees with the choreographer."** Sampling `busy()` and the
   DOM attribute on every tick reported 3 disagreements in 50 samples. Those were
   not a wiring bug: the attribute is written by a React render, so between the
   store notification and the commit there is a frame in which the two
   legitimately differ. Asserting they agree on every tick asserts that React is
   synchronous, and would have failed intermittently forever. The check now
   samples only where `busy` is unambiguous, after a committed frame.

⚠️ The second attempt at (2) was wrong in the opposite direction and is the more
useful lesson: it submitted **thirty** intents to guarantee a deep queue, which at
~13 groups per intent is ~390 queued — far past the governor's `drainGroups: 24`.
Drain mode then commits the newest view and empties the queue **without running a
beat**, so the table went from thirty intents to idle inside one frame and
reported `beatsRun: 0`. The governor was doing exactly its job; the test was
asking a question that made it impossible to observe.

## D68 — the M5 Tier-2 coverage pass, per category

The M5 brief asks for a decision **per category** — Tier 2 (parse and enforce
it) or Tier 3 (say so) — and for the numbers to move deliberately. Here is the
decision, the measurement, and what it cost.

### The numbers, before and after

| category | M3 | M5 | what changed |
|---|---:|---:|---|
| `keywords:noneTier2` | 24,826 | **23,555** | a measurement bug fixed, plus three new keywords |
| `typeLine:unknownType` | 783 | **729** | `Stickers` is a real type line |
| `protection:unenforced` | 677 | 677 | **Tier 3**, unchanged and now said out loud |
| `mana:noSymbols` | 629 | 629 | **Tier 3**, unchanged |
| `ward:nonManaCost` | 208 | **151** | `ward—Pay N life` is now enforced |
| `mana:variableAmount` | 102 | 102 | **Tier 3**, unchanged |
| `mana:unknownSymbolInAbility` | 18 | 18 | |
| `mana:noUsableOutput` | 10 | 10 | |
| `manaCost:unknownSymbol` | 2 | 2 | |
| `manaCost:halfMana` | 1 | 1 | Un-set `{HW}` |

Newly enforced, counted live by the same test: **96** infect faces, **46**
wither, **89** toxic, **630** mana wards, **57** life wards.

### ⚠️ `keywords:noneTier2` was measuring the wrong thing

The single largest correction, and it was not a coverage change at all.

The warning fired from `parseKeywords` on "no keyword STRING canonicalised" —
but **landwalk, protection and ward are Tier-2 facts that deliberately do not
come from the keyword array.** Scryfall reports them as bare `"Landwalk"` /
`"Protection"` / `"Ward"` without saying *which*, and the which is the whole
rule, so all three are parsed from text into their own fields. A Swampwalk
creature was therefore counted as "we automate nothing about this card" while
the engine was in fact enforcing its evasion.

The check moved to `parseFace`, which is the only place that can see every
field, and now asks the honest question: did this face produce **any** Tier-2
fact? That is worth more than the 1,271 it removed, because the inflated number
was pointing the next milestone at work that was already done.

### Promoted to Tier 2

**infect, wither, toxic.** All three change what combat damage *does*, which is
squarely inside "enforced where it affects combat", and all three were cheap
because every primitive already existed and only the Tier-3 manual tools could
reach them: `player.poison`, the poison state-based action at
`options.poisonThreshold` (there since M3), and `-1/-1` counters.

- Infect **replaces**: poison counters to a player, −1/−1 counters to a creature.
- Wither replaces only against creatures; against a player it is ordinary damage.
- Toxic N **adds** poison alongside normal damage. Additive, not a replacement.

⚠️ Modelled as an `applyAs` flag on one `ResolvedDamage` record rather than as a
second event, because CR 702.90b makes lifelink pay out even when the damage
became counters — life gain keys off the damage being *dealt*, not off how it
was applied. "Deal 0 damage, then add counters" would have silently broken that.

⚠️ **`SeatView.poison` was added at the same time, and the gap it closed is the
more embarrassing half.** The poison SBA has existed since M3 and the Tier-3
tool could already set poison — and poison was projected nowhere, so a player
could be killed by a number that appeared nowhere on screen. Any losing
condition the engine enforces has to be visible before it fires.

**`ward—Pay N life`.** 61 faces. It is a *tax*: fixed price, no choice, no
target, so the engine charges it exactly as it charges a mana ward. The rest of
the 208 stay Tier 3 and are still counted, because `ward—Discard a card` and
`ward—Sacrifice a creature` are decisions rather than prices, and half-enforcing
those would be worse than not enforcing them. `ward—Pay life equal to this
creature's power` is refused deliberately: a ward charged at the wrong price is
exactly the "confidently wrong" failure the tier line exists to prevent.

### ⚠️ Ward was documented as Tier 2 and was enforced NOWHERE

The worst thing this pass found. Ward has been in the Tier-2 table in
`AGENTS.md` since M1 and in D44/Q4 as "ward as a cast-time tax"; `parseWard` has
produced a `wardCost` since M3; and **not one line of the engine read it.** The
tier table is the document players are asked to trust about what the app does
for them, and it was making a promise the code did not keep — which is worse
than an honest gap, because nobody checks a keyword they have been told is
handled.

It is now charged in `prepareCast`, through `buildPaymentProblem`'s existing
`additional` and `additionalLife` parameters, which turned out to be exactly the
right shape already.

⚠️ Only an **opponent's** permanents ward. Charging yourself for targeting your
own warded creature is a rules bug players feel immediately, and it is the
easiest thing to get wrong when the tax is computed from "the targets" rather
than "the targets an opponent controls".

⚠️ The surcharge is in `previewCast` on the **client** as well as in the host's
charge, and the arithmetic is shared (`wardTaxFrom` in `mana.ts`). D53: the one
thing an auto-tapper must never do is let a player approve one payment and be
charged another. Only the *lookup* differs — the host reads a `GameState`, the
client reads a `PlayerView` — and the sum is never duplicated.

⚠️ A ward inside **double quotes** is an ability the card grants to something
else, not one it has. Two faces in the database read `You get an emblem with
"Knights you control get +1/+0 and have ward {2}"`, and without the guard
Teferi himself was warded — an extra {2} that no card anywhere says he has.

### Left at Tier 3, deliberately

- **`protection:unenforced` (677).** Measured, the clauses are dominated by
  *granted* protection with a choice — "protection from the color of your
  choice until end of turn" (103), "from the chosen color" (46) — which is an
  effect, not a static ability, and needs machinery v1 does not have. The rest
  are protection from a card type or a creature type. Enforcing those properly
  means all four of DEBT against a source whose characteristics have to be read
  at four different moments; enforcing them partly is precisely what the
  "half-enforced is worse than unenforced" rule forbids. Colours and
  "everything" stay enforced; the rest is now **said in the UI** rather than
  being silently absent.
- **`mana:noSymbols` (629) and `mana:variableAmount` (102).** Reflecting Pool
  and Bloom Tender need to read the board to know what they make. The source
  stays manually tappable, which is the Tier-2/Tier-3 line working as designed.
- **`typeLine:unknownType` (729).** `Card`, `Summon`, `Event` and `Boss` on
  Un-set and Portal oddities that can never reach a Commander deck. The count is
  not the assertion worth making — "no Commander-**legal** card carries a type
  word we do not know" is, and it is now a test. Getting there needed one real
  fix: `Stickers` (plural) is the genuine printed type line of an Unfinity
  sticker sheet, it was the only unknown type on cards Scryfall reports as
  legal, and there were 54 of them. Battle and Spacecraft were both added since
  2023, so this assertion is what notices the next new card type.
- **The remaining 23,555.** Equip, Enchant, Cycling, Flashback, Kicker, Morph,
  Crew and a tail of 885 distinct keyword strings, most of them ability words
  Scryfall tags on a single card. This is the Tier-3 boundary doing its job, and
  it is not a defect to be driven to zero — it is the reason the app exists in
  the shape it does.

## D69 — the packaged app shipped 14 MB of renderer packages it never loads

Found by `scripts/audit-bundle.cjs`, which is the argument for writing the audit
at all: `build.files` is an allowlist, so "none of this can happen" was a
reasonable thing to believe and it was wrong.

electron-builder always bundles the main process's production `dependencies`,
and **every renderer package was listed there** — react, react-dom, motion,
zustand, lucide-react, tailwindcss, the five font packages, mana-font — even
though Vite had already bundled all of them into `dist/assets/index-*.js`.
Measured: **6,689 of the archive's 6,760 entries** were `node_modules`, with
`lucide-react` alone contributing 4,056 files, plus two native binaries
(`@tailwindcss/oxide-win32-x64-msvc`, `lightningcss-win32-x64-msvc`) whose only
job is to build CSS.

Grepping every non-relative `require()` in `electron/` gives the true runtime
list: Node builtins, `electron`, `electron-updater` and `ws`. Moving everything
else to `devDependencies` changed nothing about how the app runs and took the
installer from **112.5 MiB to 98.4 MiB**.

⚠️ The audit does NOT assert "no node_modules in app.asar" — that was the first
version and it is wrong, because electron-updater's own tree legitimately ships.
It asserts that no *renderer-only* package is present, that the tree is small,
and that the two packages main really needs ARE present. A "must not contain"
check needs its "must contain" twin or an empty archive passes everything.

## D70 — the offline audit pulls the cable for ONE PROCESS, not for the machine

`scripts/offline-shim.cjs`, loaded through `NODE_OPTIONS=--require` into the
spawned instances only. The alternatives were all worse: disconnecting the user's
adapter, editing the hosts file (administrator rights), or adding a test-only
network kill switch to production code — which would then be a kill switch that
ships.

The injected failure is `getaddrinfo ENOTFOUND`, which is exactly what
`electron/scryfall.cjs` sees with no network, so nothing is a nicer or nastier
error than the real thing.

⚠️ **Only NAMES are blocked, never IP literals.** The first version blocked
anything that was not loopback or RFC 1918, which included `0.0.0.0` — the
address `lanServer.cjs` binds to. An unhandled DNS error in the main process is
an UNCAUGHT EXCEPTION, so the audit produced the modal "A JavaScript error
occurred in the main process" and killed the app it was auditing (trap 41, D59).
It was also just wrong about what offline means: a machine with no internet
resolves an IP literal perfectly well, because there is no DNS to do.

⚠️ `NODE_OPTIONS` is split on WHITESPACE before it is parsed, and every path in
this workspace contains one — `--require H:\Claude Apps\…` fails with
`Cannot find module 'H:\Claude'`. Quoting inside the variable does not survive
the shell reliably. The shim is copied to a space-free directory at run time.

**Measured green:** a 37-turn 4-seat solo game (3,735 events, 0 cards missing)
and a full two-instance LAN game including a dropped and auto-restored socket,
with hostname lookups dark. The only thing that failed was downloading art that
was not already cached — and it failed in 3 ms rather than hanging.

## D71 — the install proof, and why the obvious version of it is wrong twice

`scripts/install-proof.cjs` installs the real installer, launches the real
installed binary, and asks it through the preload bridge where its data root is.
D2 chose a profile-root dotfolder and D10b confirmed a *download* was not
virtualized; neither proved the thing a user actually depends on, which is that
the INSTALLED build reads the same folder the dev build wrote.

**Result:** `C:\Users\apps\.commanders-roundtable`, 113,559 cards and 2 decks
visible to the packaged app, no shadow copy anywhere under
`%LOCALAPPDATA%\Packages`, and a desktop shortcut on disk.

Two things the first attempt got wrong, both of which reported a catastrophe that
had not happened:

- ⚠️ **The install directory is named after the package NAME, the executable
  after `productName`.** `…\Programs\commanders-roundtable\Commander's
  Roundtable.exe`. Guessing the folder gave "the app was installed: FAIL" on an
  installer that had exited 0 and worked perfectly. Discover it; do not guess it.
- ⚠️ **A debuggable page is not a loaded page.** Evaluating `window.crt.app.info()`
  the moment a CDP target appears gives "Cannot read properties of undefined
  (reading 'app')" — which reads as "the preload bridge is missing from the
  packaged build", i.e. exactly the packaging catastrophe the script exists to
  detect. Wait for the bridge.

---

⚠️ **Two invariants M5 established:**

9. **A category that is unenforced must be SAID.** `src/data/tier3.ts` is derived
   from the same parser the ingest uses, so it cannot claim coverage the engine
   does not have, and it is silent for a card the engine handles completely. A
   Tier-3 gap that is unstated is indistinguishable, from the player's side, from
   a Tier-2 feature that is broken.
10. **Any losing condition the engine enforces has to be visible before it
    fires.** Poison had an SBA from M3 and a manual tool, and was projected
    nowhere — a player could be killed by a number that appeared on no screen.
    `SeatView.poison` and the plate badge closed it. The same question is worth
    asking of anything added to `sba.ts`.

## D72 — the installer overwrites the developer's desktop shortcut

⚠️ Small, invisible, and it silently breaks a standing workspace rule.

The NSIS installer creates `Commander's Roundtable.lnk` on the desktop, and
`create-shortcut.ps1` creates a shortcut with the **same name** pointing at the
dev launcher. So running the install proof on a development machine repoints the
developer's own shortcut at the packaged build — which then goes stale the moment
anything is edited, which is precisely what `~/AGENTS.md` forbids: *"shortcuts
must always launch the latest code; never point them at packaged `release/*.exe`
builds."*

Nothing breaks loudly. The app just stops reflecting the code, and the next
person to notice does so by debugging a fix that "did not apply".

`scripts/install-proof.cjs` now says so at the end of every run, with the
one-line command that puts it back. Renaming either shortcut would remove the
collision, but the installer's name is the one a friend should see on their
desktop, and the dev shortcut's name is what the workspace convention expects —
so the collision is documented rather than designed away.

## D73 — a card is played by dragging it, and the drop is only an INPUT

Cards can now be put down by dragging them out of the hand and dropping them on
your own side of the table. Four decisions inside that, each of which had an
obvious-looking alternative.

**1. A drop plays exactly what a click plays.** The drop does not get its own
path into the engine: it finds the same `PlayLand` / `CastSpell` in the same
`legal` array the click handler uses, and a spell still opens the payment review
before anything is cast. Two answers to "what does playing this card do" is how
you end up approving one payment and being charged another — the thing the
auto-tapper must never do (D53). What the gesture contributes is a rect, not a
rule.

**2. `src/ui/table/` still does not know an engine exists.** `HandFan` reports
"this card was let go over your side of the table, at this rect" through a
callback, and asks a second callback whether the drop is allowed and what the
ghost should say. Both are absent in fixture mode, and the hand then does not
drag at all — the M2↔M3 seam holds, and the animation battery keeps driving the
same components through scenarios that have no notion of playing a card.

**3. The flight starts where you let go — TIER 0 of the rect ladder.** A group's
source rects are read BEFORE its view commits (`beats.ts`), so a dragged card
would fly from the hand slot it has not visibly occupied since the drag began:
the card snaps back into the fan and flies out again, which reads as a dropped
frame rather than as two separate truths. `setDropOrigin` hands the drop rect to
the flight layer, ahead of the card's own slot. It is **consumed on read and
expires after a second** — an intent the host refuses produces no flight at all,
and an origin that outlived its drop would be spent on that card's NEXT flight,
a discard ten turns later starting from a battlefield slot nobody dropped it on.
Measured: with the hand-off, both the land drop and the confirmed cast start
within 0.0 px of the ghost.

**4. Refusal is signalled by SHAPE, not by colour.** The first version bordered a
refusing pod in `--color-crt-warn`, which is 4° of hue from `--color-crt-accent`
— at a glance it read as a slightly different yes. Red was not an option either:
on this table red is damage. The pod's edge goes **dashed** instead, the ghost
dims, and the reason is written under the card — "Not enough mana for Grave
Titan.", "Ana has priority.", "You can't play Island right now." — all of it read
off `legal` and the view, never from a rule re-derived in the UI. A dashed edge
cannot be confused with the lit one, and it survives a colour-blind viewer.

Two smaller things that are load-bearing:

- **The ghost is parked, not returned, while a payment is approved.** Dropping a
  spell leaves the card lying where you put it until you confirm or cancel — the
  gesture said "this goes on the table", so the table is where it waits. Exactly
  three things end a park: the card leaving the hand (a flight owns it now, and
  that is detected on the view COMMIT rather than by polling, or the ghost and
  the clone are both on screen for a frame), the review closing without casting,
  and a 900 ms floor under an intent the host refused.
- **The gesture uses window listeners and a pointerId guard, not pointer
  capture.** The source card is hidden the moment the drag opens and can be
  re-keyed by a re-fan underneath it; capture on an element that changes under
  you drops the rest of the gesture and the card sticks to the cursor. The
  pointerId guard is also what lets the battery drive a REAL drag: AGENTS.md
  forbids synthetic pointer drags because genuine and synthetic pointermoves
  interleave, and an id no device ever uses (787) makes that interleaving
  structurally impossible rather than merely unlikely.

## D74 — `table.setup()` is a REQUEST the component must honour, not a suggestion

Same family as D67: a battery check that asserted on luck. `battery-anim.cjs table`
failed on its own and passed as part of a full run, with the same seed — and the
failure text gave it away, naming pods `p2`/`p3`/`p4` under a label that said `2p`.
Three opponents is not a 2-seat table, so the sweep was measuring a board it had
not asked for.

Two separate defects were hiding behind that, and only the first one is a race.

### 1. The pool resolving mid-sweep rebuilt the board

`TableScreen` fetches the real card pool the first time the table becomes VISIBLE.
When that promise resolved it called `setPool`, which re-ran

```ts
useEffect(() => { build({ seatCount }); }, [build, seatCount, pool]);
```

— rebuilding at the React state's seat count (4) and, because the effect passed no
other options, at the component's DEFAULT 14 permanents. The battery had asked for
2 seats and 10 permanents through `window.__crt.table.setup(...)`, which wrote a
ref the effect did not read. Measured: a bare rebuild turned a 2-seat, 14-slot
board into a 4-seat, 36-slot one. The reported ~2.7 px overflow was never a layout
bug; it was 4 pods being measured against metrics solved a moment earlier.

Running `flight` first hid it completely — that section opens the table screen
earlier, so the pool had already resolved and nothing rebuilt mid-sweep.

⚠️ Fixing only the seat count would have left the same lie in a smaller size: the
rebuild would still have quietly substituted 14 permanents for the 10 requested.
The whole request is remembered, not the part that happened to be visible in the
failure message.

### 2. The seat axis of that sweep had never been tested at all

The deeper one, and it was NOT order-dependent — it was equally wrong in the run
that passed. `setup({ seatCount: n })` moved the fixture board only. The metrics
are solved from the React state (`GameTable` → `useTableMetrics`), which no handle
touched, so measuring `table.metrics()` after `setup(2)`, `setup(3)` and `setup(4)`
reported `seatCount: 4` every time, with three seat boxes every time. All twelve
"viewport × seat" combinations were laid out inside a 4-seat solve, for as long as
the check has existed.

`table.seatCount()` could not reveal this either, because `seatRef.current =
seatCount` ran on **every render** and reset the handle's own write: it read back
4 immediately after `setup({ seatCount: 2 })`. A ref assigned during render is a
mirror of state, never an override of it.

### The fix

The last request is held whole in `requestRef` (seats, permanents, hand size),
`build()` takes no arguments and builds exactly that, and `setup()` drives the
React `seatCount` state so the metrics follow the board. A later pool-driven
rebuild then reproduces the requested board with better art instead of a different
board. The battery needed no change, which is the point — the check no longer
depends on section order.

⚠️ The effect's early return is not an optimisation. `setup()` has already built
the board synchronously, so rebuilding on the resulting state change would fire a
SECOND hard sync a tick later — a new epoch that discards whatever beats the caller
queued in between. It skips only when the seats AND the pool object are both
unchanged, so any real change still rebuilds.

### Measured

| | before | after |
|---|---|---|
| `battery-anim.cjs table` | 11/12, 3 phantom overflows | **12/12** |
| `battery-anim.cjs flight table` | 42/42 | **42/42** |
| band cards measured, either order | 202 (only the lucky order ran) | **204, identical in both** |
| `metrics().seatCount` after `setup(2/3/4)` | 4, 4, 4 | **2, 3, 4** |
| seat boxes solved after `setup(2/3/4)` | 3, 3, 3 | **1, 2, 3** |

Both orders now produce the same measurements, not merely the same verdict. The
card count moved 202 → 204 because the 2- and 3-seat layouts are finally being
solved as 2- and 3-seat layouts; they pass. Full battery: 224/225, the only
failure being the perf long-frame gate that D29/D29a documents as not met.

⚠️ One residual, stated rather than papered over: a slow card database can still
change which PRINTINGS are on the table partway through the sweep. It can no
longer change the board's SHAPE, and every assertion in the sweep is a shape
invariant (inside its band, no overlap, above the readability floor), so art can
no longer decide a pass or a fail.

## D75 — the tap is a FULL quarter turn, and the row packer pays for it

The spec's Decision 4 offered `20.5°` (tidy rows, its recommendation) or `90°`
(paper-accurate, "forces the row packer to reserve `max(w,h)` per slot"). M2 took
20.5°. The user asked for 90° — the way a card is actually turned on a table — so
the packer now pays the price the spec predicted, with two refinements that make
the bill much smaller than `max(w,h)` per slot.

**1. Only a TAPPED slot costs anything.** `PackItem` carries `tapped`, and a
tapped slot reserves the card's HEIGHT where an upright one reserves its width.
Reserving the turned box for every slot — the spec's version — would cost every
row 40 % of its capacity permanently, and at 4 players a pod's row is ~510 px
wide, which is exactly the constraint that made auto-stacking load-bearing (D19).
Measured on that row: 5 upright opponent cards fit at full size, 4 turned ones
fit at full size, 5 turned ones shrink and then scroll. The cost lands on the
board that is actually using it.

That the row RESIZES on a tap is not new, and this is why it is affordable: tap
state is already part of the auto-stacking key, so tapping one of twelve Forests
has always split the pile and re-packed the row. The quarter turn adds (h − w) px
to a movement that was already happening.

**2. The turn is anchored on the slot's top-left corner, not the card's centre.**
`transform: translate(Δ, −Δ) rotate(90deg)` with Δ = (h − w) / 2 and the pivot at
the card's centre. Rotating about the centre alone leaves the painted box hanging
Δ px off the left of the slot and Δ px below its top; the translate slides it back
so a turned card occupies exactly `h × w` **from the same corner the upright card
used**. Three things follow, and all three are why it is done this way:

- the card's layout box never moves, so tapping is a pure transform — no reflow,
  no jump, and the transition is one continuous turn;
- the slot wrapper can be sized to the footprint, so the pile badges, the `×N`
  chip and `data-band-slot` all sit on the card you can actually see;
- rows keep a single top edge, so a half-tapped row of lands still reads as one
  line rather than two.

⚠️ The translate and `packRow`'s footprint are the same number in two places.
Change one and the other is wrong — a turned card would either overhang its slot
or float inside it.

**3. The pivot moved from `50% 62%` to the centre.** The old low-centre origin
("a real card pivots about where your thumb holds it") is a 20.5° lean's pivot; a
quarter turn about 62 % swings the card up and out of its row. The landing squash
and the damage flinch animate the same element, so they now squash symmetrically
rather than toward the bottom — a couple of pixels on a 6 % scale, and the tap
happens 40× a game while a landing happens a handful of times.

**What it cost in verification.** Three assertions that looked like geometry bugs
and were not, all now handled in the battery's `tap` section:

- a slot wrapper still at its 0.9 arrival scale makes every rect under it 0.9× —
  a turned card "measures" 125×90 instead of 139×100. `waitForStableLayout`
  cannot see this (it watches the metrics epoch, not motion), so `settleBoard()`
  waits for the arrival scale to reach 1 and for two identical geometry samples.
- "turned" must be read from the matrix ANGLE. A beat that squashed a card leaves
  an identity matrix on it, and `transform !== 'none'` calls that a quarter turn.
- the choreographer's queue draining is not the CSS transition finishing: the
  untap sweep staggers by 34 ms per card, so the beat completes while the last
  card is still coming back upright. The check polls the DOM and reports the VIEW
  separately — state left tapped is a bug, pixels mid-turn are not.

**4. A flight from a turned card stands the source box up first.** A clone is
always upright and takes its starting SIZE from the source rect — which for a
tapped card is the card lying on its side, so a dying attacker began its flight
28 % too small and grew on the way to the graveyard. `uprightSource()` swaps the
box about the same centre, gated on the card actually being tapped rather than on
the rect being wider than tall: an opponent's hand anchor is a COUNT CHIP, wide
and short, and swapping that would send every one of their draws somewhere else.

Still on the table, not done: the clone does not carry the turn INTO the flight,
so a tapped card straightens the instant it leaves its slot. At 20.5° nobody could
see it; at 90° it is a visible snap, softened only by the death beat having
already faded the card to 35 % opacity. Doing it properly means a turn keyframe in
the flight spec, which is a change to a tuned subsystem for one frame of polish.

Not offered as a setting, though the spec suggested one either way: nobody has
asked to play with a lean, and a settings key that no one turns is a schema entry,
a control, and a second layout path to keep correct forever.

## D76 — the untap is the tap backwards, and the card needs TWO elements for that

"Make the untap reverse the turn smoothly" turned out to be three separate
defects wearing one coat, and the third one had been there since M2.

**1. The row teleported.** A slot's column was a plain `left`, so the commit that
started a turn also moved every neighbour instantly. Recorded per frame on a real
untap: the slot jumped **69 px to the right while the card was still lying flat**,
and only then did the card unroll — a sideways move and a turn read as two
unrelated events. The column is now an animated `x` on the slot wrapper, using
`SPRING.fan` — the same spring, and the same idea, as neighbours parting in the
hand fan.

**2. The two directions were not mirror images.** A tap opens the gap WHILE the
card turns into it, and that is right: the room is there before the card needs it,
and a full sweep never overlaps by a pixel. An untap did the same thing backwards
— the row closed on the commit, over cards still lying flat, for a measured 37 px
of overlap lasting ~350 ms. A battlefield row is never allowed to overlap (D19),
so the row now WAITS: `BattlefieldBand` delays the slide by the turn's duration
whenever a slot's footprint SHRANK, plus the sweep's 34 ms-per-card tail when a
coalesced untap-all is running. Straighten the cards, then tidy the row — which is
also what it looks like on a table. Re-measured: **0 px at every frame.**

⚠️ A window RESIZE is not a re-pack. Every column changes when the table changes
size, and springing fifty cards across it is both wrong (the cards did not move,
the table did) and expensive on the frame that is already re-laying-out the
screen. The metrics epoch — the same signal the flight layer uses to snap a clone
rather than fly it to a rect that has moved — makes that case instant.

**3. The turn and the beats were fighting over one element, and had been all
along.** The tap transform lived on the card's root, with a CSS
`transition: transform` on it. Every BEAT animates that same root through
`elementFor()` — a lunge, a landing squash, a damage flinch — by writing its
transform, and the CSS transition then interpolated every one of those writes.

The old expo-out easing hid it: `cubic-bezier(0.16, 1, 0.3, 1)` covers 60 % of its
distance in the first frame, so the smoothing was nearly invisible. Switching to a
symmetric ease-in-out — which the reverse needs, or the untap is a different
gesture from the tap — made it obvious at once: the token and counter pops
flattened to **peak 1.000 vs settle 1.000** (no overshoot at all), and the reveal
never crossed 90°. Worse and quieter: combat's `clearCombatPoses` animates that
root to identity, which with the tap living there **wiped the turn off a tapped
attacker** and left it standing upright while the engine still had it tapped.

So the card is now two elements, and this is a rule rather than a detail:

- the **root** carries the layout box, the registry key, the a11y and the
  handlers, and NO transform, filter or transition. It belongs to the beats.
- **`[data-card-turn]`** carries the tap: the transform, its transition, the
  dimming filter, and the sweep's `transition-delay`. It belongs to the tap.

Two systems, two elements. With them separated the beats measure right again
(token peak 1.210 vs settle 1.000), a tapped attacker stays tapped through combat,
and the turn can have the easing it actually wants.

⚠️ Anything asking "is this card turned, and how big is it on screen" must read
`[data-card-turn]`, not the root: the root's border box is upright even when the
card is lying flat, because a child's transform does not grow its parent's box.
`table.geometry()` reports `rotated` from that element's own `data-card-turn`
attribute rather than from a computed transform, so a beat mid-flight on the root
can never be mistaken for a tapped card.

**Measured, one card, one row, through a full round trip:** tap 0° → 90° over
~170 ms as its slot slides 470 → 517 alongside it; untap 90° → 0° over ~175 ms
with the slot held at 520; the row closes 520 → 557 only afterwards. The battery's
`tap` section asserts the shape of all three — a turn with ≥5 intermediate angles
rather than a snap, no single-frame slot move over 10 px, nothing closing while a
card is past 45°, and zero overlap at every frame of a sweep.

Still not animated, and still honest about it: a tapped card that merges back into
an identical PILE has no slot of its own to turn — the group re-forms and the
turned stack is simply gone. Tap state is part of the auto-stacking key (D19), so
the merge is a re-grouping rather than a movement, and animating it means an exit
animation for a slot that no longer corresponds to any state.

## D77 — the auto-stack GROUPING may lag the view; nothing inside it may

The last case where the quarter turn never played, and the reason it was the
hardest: nothing was animating wrong, because there was nothing on screen to
animate.

Tap state is part of the auto-stacking key (D19) — five tapped Forests are a
different pile from the seven untapped ones, because "how many can I still tap"
is the question a pile has to answer. So untapping them does not MOVE a card, it
RE-GROUPS: the turned pile stops existing, React unmounts its slot, and the card
that should have straightened is simply gone. Easing cannot fix a missing
element.

Whether it happened at all depended on zone order, which is worth stating because
it made the bug look intermittent: `groupIdentical` names a pile after the first
of its cards in zone order, so if the tapped copy happened to come first, the
merged pile inherited ITS slot and the turn played fine. Tap the last copy
instead and the slot vanished. Same board, same gesture, two different outcomes.

**The grouping now lags the view by exactly one turn when a merge would erase a
turned pile** (`mergeHold.ts`). For those 180 ms both piles are still drawn, their
cards straighten in place, and only then do they become one. Measured on a live
game, a Mountain tapped out of a pile of three: its slot survives the untap,
turns 90° → 0° over 20 distinct angles, and the pile becomes ×3 one frame later.

Three properties keep that safe, and all three are the point:

1. **Only the SHAPE lags.** Zone membership, tap state, counters and P/T all keep
   coming straight from the view; `refreshTapState` re-reads tap state onto the
   held items every render. A held pile whose cards have untapped reports itself
   untapped, so it takes an upright footprint and the row starts closing on the
   same frame the turn starts — the grouping is the only thing waiting. What is
   held is the same question the auto-stack toggle answers: one stack or two.
2. **It drops the moment the cards change.** Any difference in WHICH cards are in
   the band — a permanent entering, a creature dying mid-turn — releases the hold
   on that render. A hold is a lag, never a lie.
3. **A card that LEFT the battlefield is never held.** `mergedAwayPiles` requires
   the vanished pile's top card to still be a member of another pile. A destroyed
   permanent is the flight layer's job, and a held slot would be a ghost racing
   its own clone to the graveyard.

The hold is decided during render rather than in an effect, deliberately: an
effect runs after the frame that already dropped the pile, which is one frame of
the merged board — exactly the pop being fixed.

**Not animated, and deliberately:** the merge itself. When the hold releases, the
absorbed stack disappears as the survivor's count ticks up and the row closes over
it. Sliding it into the survivor first was tried on paper and rejected: two piles
deliberately overlapping is the one thing a battlefield row may never do (D19),
and a merge that looks like a packing bug is worse than a clean cut. The row
closing on the same frame carries the read.

**Not fixed, and stated rather than hidden:** the TAP direction of the same case.
A pile that splits mounts its new tapped slot with the card already turned — a CSS
transition does not run on an element's first style — so the split pops where the
merge now turns. The same is true of any permanent that ENTERS the battlefield
tapped (Cultivate does it every game). Both need an element to mount upright and
turn on the next frame, which is a different mechanism from this one, and one that
must not fire on a bulk rebuild or a hard sync where twenty tapped cards would all
turn at once for no reason.

## D78 — mounting upright so the turn has somewhere to start

The last case where the quarter turn did not play, and the smallest: a CSS
transition has nothing to move from on an element's FIRST style, so a card that
mounts tapped is simply tapped. No turn, however good the easing.

That is two real situations, and one of them happens every game:

- a pile that SPLITS when you tap one copy of it — the tapped copy gets a brand
  new slot, which mounts already turned. The mirror of D77's merge, in the
  direction D77 did not fix.
- a permanent that ENTERS the battlefield tapped. Nothing in the engine emits
  that yet (Cultivate is Tier 3, so today it is a manual move and then a tap,
  which animates fine), but a scripted card will, and the fixture table already
  does.

`Card` takes `turnOnMount`: render upright for one frame, then turn. One frame,
and it is the frame the card is arriving on anyway.

**⚠️ It waits to be ON SCREEN, not just mounted.** A permanent entering the
battlefield mounts while its flight clone is still travelling, with the real slot
painting nothing (`inFlight`). Turning on mount would spend the entire animation
behind a hidden element and the card would land already turned — the same bug one
step further along. So the turn waits for `inFlight` to clear, which is the
landing.

**⚠️ The BAND decides, not the card**, because "did this arrive on its own?" is a
question about the board and not about a card. Two guards, each for a case that
really happens:

- **`hardSyncFlash`** — the choreographer sets it for every wholesale board
  replacement: a fixture rebuild, a reconnect snapshot, the start of a game.
  Without it, a resync would turn twenty tapped cards in unison, which reads as
  the table having a seizure rather than as anything about any card.
- **the band had cards a render ago.** A band whose component is brand new is a
  viewer switch or a first paint. Every slot in it is "new", and none of them
  arrived.

Both are cheap and both are load-bearing: the battery's static checks run
immediately after a `setup()` and assert every tapped card is at exactly 90°, so
a guard that failed would show up as a board caught mid-turn rather than as a
subtle mood.

Verified in the `tap` section, on the same pile it uses for the merge: tapping one
copy gives it its own slot, whose recorded track starts at 0° and passes through
14 frames of intermediate angles — where before it was one frame at 90°.

## D79 — `TargetSpec`, and why free aim is `kinds: []` with `min: 0`

Casting Lightning Bolt asked nothing, because nothing read a card's text to
discover that it targets. The plumbing had been there since M3 — `TargetChoice`,
a `targets` cast stage, an `Awaiting.chooseTargets`, `StackObject.targets` all the
way into `StackItemView` — and every piece of it was unreachable.

`TargetSpec` (`src/engine/types/oracle.ts`) is the missing fact, and it hangs off
`OracleFace` because that file's own rule says a fact not on `OracleFace` is not
enforced. It carries `min`/`max`, the acceptable `kinds`, a `controller`
restriction, the clause **verbatim** for the prompt, a `confident` flag, and the
adjectives it deliberately did not check.

**The governing asymmetry**, and every judgement call in `targetParse.ts` follows
from it: an unread restriction may only ever ALLOW an illegal choice, never BLOCK
a legal one. Narrowing `target nonblack creature` to `creature` lets you point at
something the card forbids — annoying, and the player's own read of the card
catches it. Getting the KIND wrong, or inventing a requirement, makes a legal play
impossible and the app simply looks broken.

So an unread clause becomes `kinds: []` — free aim — and free aim means **accept
anything**, checked in exactly one branch of `targetAllowed`. `min` is 0 there, so
a clause the parser could not read can never make a spell uncastable.

⚠️ The CR restrictions are checked BEFORE the free-aim early-out. "The engine does
not know what this card can target" never means "the engine forgets shroud
exists".

⚠️ The one place `min` is not 0 on a free spec is an Aura whose subtype we cannot
read (`Enchant Zombie`), which genuinely does require exactly one target. That is
satisfiable on any board, because there is always a living player to point at. The
pinned invariant is therefore "no free spec demands more than one", not "none
demands any" — see `oracleParse.node.test.ts`.

## D80 — The parser's measured coverage, and what it declines to read

Pinned in `oracleParse.node.test.ts` over the whole 113,559-card database, the same
way D32 pins the Tier-2 numbers, and moved by a data refresh exactly the way those
are:

| | |
|---|---:|
| faces with at least one spell-level clause | **19,757** |
| target specs produced (spell level) | **20,840** |
| — read confidently | **17,330** |
| — fell to free aim | **3,510** |
| — Aura `Enchant` clauses | **3,536** |
| — carrying an unenforced adjective | **1,987** |
| activated-ability lines | **42,945** |
| — payable by the engine | **24,729** |
| — mana abilities (never activated) | **11,911** |
| — containing a target clause | **11,031** |
| `target:unparsedClause` | 1,459 |
| `target:modalUnion` | 2,751 |
| `target:unparsedCount` | 549 |
| `target:unparsedEnchant` | 14 |
| `activated:nonManaCost` | 13,581 |
| `activated:loyalty` | 4,635 |

⚠️ **Coverage is measured in BOTH directions.** The warning tally alone can be
driven to zero by a refactor that quietly routes every clause to free aim while
every pinned number still "matches"; the positive counters are what catch that.

What it declines to read, deliberately: divided damage (`Arc Lightning`),
restrictions past the head noun (`nonblack`, `tapped`, `with power 3 or less` —
recorded verbatim and said on the card), creature subtypes, modal spells (one free
spec for the whole face, because `PendingCast.modes` exists and nothing sets it,
so a union would demand four targets for a card that needs one), `X target
creatures` (X is not known at parse time), and triggered-ability clauses (parsed
and discarded — no trigger reaches the stack with targets without a card script,
and `EMPTY_REGISTRY` ships; asking a player to aim an ETB the app never executes
is theatre).

## D81 — One targeting rule, two adapters

`src/engine/targets.ts` holds `targetAllowed` and nothing else decides legality.
The host builds `TargetCandidate`s from `GameState` + `derive()`; the client builds
them from a `PlayerView` + its printing pool. Same record, same predicate. That is
D53's shape — `suggestPayment` on the client, `validatePlan` on the host, one
solver — applied to targeting, and two copies of "can this be targeted" would drift
in the way a player feels immediately: the host rejecting a target the veil had
just lit up green.

⚠️ `TargetCandidate.zone` is its OWN token, deliberately not `ZoneKind`. There are
**two** `ZoneKind`s in this codebase with different values — `'battlefield'` in
`engine/types/ids.ts`, `'bf'` in `view/types.ts` — so a predicate typed against
"ZoneKind" would compile against whichever one the importer meant and silently
disagree between host and guest.

The client reads **printed** keywords (its `CardView` carries none) while the host
reads **derived** ones. With zero card scripts those are the same; where they ever
differ the host wins and its rejection is shown, which is the staleness contract
`suggestPayment`/`validatePlan` already lives under.

## D82 — Hexproof and shroud were Tier-2 on paper and enforced nowhere

Both have been in the AGENTS.md Tier-2 table since M1, and until this change they
appeared only in `keywords.ts`'s canonicalisation and the `oracle.ts` list — **read
by nothing**. That is the same gap D68 found for ward, found the same way: by
asking what actually consumes a parsed fact.

Targeting is the first thing in the app that can enforce them, and it now does:

- **shroud stops everyone**, including the controller (CR 702.18b);
- **hexproof stops OPPONENTS only** (CR 702.11b) — the printed reminder text says
  "spells or abilities your opponents control", and reading it as "nobody" would
  stop a player pumping their own hexproof creature;
- **protection from a colour** blocks targeting by a source of that colour
  (CR 702.16b).

⚠️ The residual gap, which `tier3.ts` says on the card: only the **printed**
keyword is enforced. A granted one needs a layer-6 continuous effect and
`EMPTY_REGISTRY` ships, so Lightning Greaves does nothing.

## D83 — Activated abilities: what the engine will charge, and what it will not

An ability is offered only when the engine can pay its whole cost — mana and
`{T}`/`{Q}`. Measured: 24,729 of 42,945 ability lines qualify; 13,581 carry a
non-mana cost and 4,635 are loyalty. `Sacrifice this creature`, `Pay 2 life` and
`Discard a card` are decisions rather than prices, exactly the distinction D68 drew
for ward, so they stay Tier 3 and are named on the card.

⚠️ `isManaAbility` is **asked of `parseManaProduction`**, matched by line index
(`ManaProduction.line`), never re-guessed. A mana ability leaking into
`ActivateAbility` would put `{T}: Add {G}` on the stack — which CR 605 says never
happens — and a real ability misclassified as mana would vanish from the action
list entirely. This is the Command Tower lesson `tier3.ts` already carries.

⚠️ **The source card does not move.** `finishAbility` is its own function rather
than a branch in `finishFromPending` because the two differ at every step that
touches a card: no `CardsMoved` in or out, `AbilityPutOnStack` with `card: null`
and `source` set, and the tap paid in the SAME batch (CR 602.2b — costs are paid on
activation). Getting that wrong deletes or duplicates a permanent, and
`checkInvariants` cannot catch it because it skips stack-zone cards.

⚠️ `legalActions` uses `affordable()`, not `suggestPayment()`. Building a full
payment plan per ability took the 40-source solver benchmark from under 1 ms to
1.3 ms, and `legalActions` runs on every priority grant; the plan is only ever
needed once, when the player commits.

## D84 — Every stage that stops must emit an `Awaiting`, and the two bugs that proved it

`Awaiting` is the only prompt channel that crosses the wire — `GameState` never
does, and `PlayerView` carries no `pendingCast` — so a stage that halts without
setting one is invisible to every client, **including the host's own UI**, which
runs through a `loopbackPair` like everybody else. It is also what makes
`advance()` stop instead of falling through to `priority()`.

Two measured failures:

1. **The X stage had no `Awaiting` and could strand a cast.** `castSpell` returned
   `CardsMoved` + `CastBegan` and nothing else, so `advance()` never stopped, the
   caster could auto-pass, and the card was left in the stack *zone* with a live
   `pendingCast` and no `StackObject` — which `checkInvariants` cannot see, because
   it skips stack-zone cards. The UI had worked around it by always sending
   `xValue` up front. There is now an `Awaiting.chooseX`.
2. **`finishFromPending` did not CLEAR the awaiting**, so after the first successful
   cast the prompt stayed up while `pendingCast` was gone, and every later answer
   came back "You are not casting anything." The fuzzer measured it exactly:
   **6,070 target prompts against 37 declarations**, with every other assertion
   green — and it was jamming the whole engine, not just targeting. Fixing it took
   the 500-seed gate from 51,086 accepted intents to 98,690.

That second one is why the fuzzer now carries **targeting path canaries**
(`targetPrompts` and `targetsChosen` must both exceed the seed count). A regression
that stops emitting the prompt, or a harness that answers every one by cancelling,
is otherwise indistinguishable from a green run.

⚠️ D61 says `Awaiting` crosses the wire whole because every field in every variant
is a public game object, and that it "has to be re-read when a variant is added".
It was. `chooseTargets` now carries `specs`, `source`, `label` and `forKind`; all of
it is card text and public object ids, so the conclusion holds unchanged.

## D85 — The targeting arrow: SVG, at the app root, refusing by shape

The first `<svg>` in this renderer, and it is mounted at the APP ROOT beside
`DragLayer` for three independent reasons rather than the usual one:

1. a `position: fixed` element loses the viewport as containing block under any
   transformed or filtered ancestor;
2. **stronger, and already in the code:** `PlayerPod` sets `contain: layout paint`,
   which establishes a containing block for fixed descendants **and clips them** —
   an arrow drawn inside a pod would be positioned against that pod and scissored
   at its edge;
3. an arrow's whole job is to cross between pods.

**SVG over Canvas2D** because it is directly assertable:
`querySelector('[data-aim-arrow]').getAttribute('d')` returns exactly the path that
was painted, so the battery measures the arrow rather than a store value that ought
to equal it. `FxCanvas` exists because 1200 particles in the DOM is absurd; eight
paths on a canvas is the opposite mistake.

⚠️ **Refusal is signalled by SHAPE, never colour** — a dashed stroke when the cursor
is over nothing legal. `--color-crt-warn` and `--color-crt-accent` are 4° apart in
hue, so a warn-coloured arrow reads as "a slightly different yes", and red on this
table already means damage. Same rule `PlayerPod`'s dashed refusal border follows.
The five MTG colours appear nowhere in the feature.

⚠️ **`AIM_SNAP_MS`, `AIM_ARC` and `AIM_SLOP_PX` are not routed through `d()`** — the
same exception `DragLayer.RETURN_MS` already carries. `d()` reads the
choreographer's scale gate, which belongs to the group it is currently building
(D16); an aim arrow is an INPUT AFFORDANCE, in no group, and scaling it by a
governor that is throttling animation backpressure would make the player's own
cursor feel broken under load. Reduced motion is honoured as a MODE.

⚠️ **The arrow always draws under reduced motion.** It is how a player sees what a
spell is aimed at; only the dash-march and the ring pulse stop.

⚠️ `aimControl` delegates to `arc.controlPoint` and adds ONE tie-break.
`controlPoint` signs the bow by projecting onto the direction of the viewport
centre, and for an aim from the hand (bottom-centre) to an opponent's pod
(top-centre) — the single most common aim in the game — the midpoint IS that
centre, the dot product is ~0, and the sign flips on sub-pixel cursor noise.
`controlPoint` itself is untouched: every flight in the app uses it, and an input
affordance does not get to change how cards fly.

## D86 — Hit-testing is a frozen rect sweep, not `elementFromPoint`

The veil already measures every anchor once per aim; the move handler then
hit-tests by arithmetic over that snapshot and reads **zero** rects per
pointermove.

`elementFromPoint` would have been worse in a way that does not show up on a meter:
`perf.ts` patches `getBoundingClientRect` only, so an `elementFromPoint` per move
would force the same style-and-layout flush while keeping the stray-read counter at
zero — making the rect-discipline rule *less* true while appearing to uphold it.
(It also returns the veil while the veil is up.)

⚠️ **Last match wins.** Rects genuinely overlap — a tapped card's footprint, a
pile's offset plates — and an AABB sweep has no notion of paint order. The bands
rely on DOM order, so later-in-DOM is painted on top; taking the last match is the
same tie-break the browser makes.

⚠️ **The hover lift is `scale` on the VEIL BUTTON, never on the card.** A `Card`
root may carry no transform, filter or transition (D76 — that element belongs to
the beats), and a per-card prop would also defeat `Card`'s memo, worth a measured
50–58 ms per commit on a 4-player board. The sweep uses the UNSCALED rect, so
presentation and hit-testing cannot disagree.

⚠️ `SlotKey` gained `plate:`, `pod:` and `stackitem:` rather than using
`beats.plateRectFor`'s `querySelector` + `readElements` pattern: `readElements`
takes ELEMENTS, so it bypasses the registry's per-frame cache entirely, and ~60
anchors re-swept per view commit is a full layout flush each time.

## D87 — Targets before payment, and the two things that fixed themselves

The cast flow is now click → **aim** → payment → cast, which is CR 601.2c before
601.2f. Three consequences, two of them repairs:

1. **The ward surcharge became reachable for the first time.**
   `ClientSession.previewCast` has priced a ward from the chosen targets since M5,
   and `session.previewCast(cardId, xValue)` silently dropped the third argument —
   so the one cost in this app that depends on what you are pointing at could never
   reach the player who has to approve it.
2. **Backing out is purely local.** Nothing has been sent when you press Escape, so
   there is no `pendingCast` to cancel and no round trip. Had targeting come after
   the cast, Escape would have had to submit an intent and wait.
3. ⚠️ **It introduced a bug that had to be fixed with it:** the parked-ghost timer
   re-armed only while `mode.kind === 'payment'`, so a spell dragged out of hand
   flew home 900 ms into target selection, while the veil was still up. Visible only
   if you dragged rather than clicked. `castCardOf` now covers both stages, and the
   battery's drag section asserts it.

⚠️ The battery used to hand-construct a `TableMode.targeting` object. When the mode
gained fields it kept passing the old shape, the prompt bar threw, React unmounted
the table, and **four unrelated checks failed** while reporting a feature bug that
was really a shape mismatch. It now drives `engine.aim.begin(card)` and never knows
the store's shape.

## D88 — You can finally choose whom you attack

`PromptBar` computed `const defender = seats.find((s) => s.id !== viewer)` and sent
it for **every** attacker, so at a 3–4 player table you could not choose whom you
were attacking at all — while `Intent.DeclareAttackers` had carried a per-attacker
`DefenderRef` since M3 and `combat.legalDefenders` had handled planeswalkers and
battles all along. Only the UI was throwing it away.

`TableMode.attackers` now holds `{card, defender}[]` plus a `defaultDefender`, the
prompt bar offers a chip per living opponent, and re-picking a chip re-points every
attacker already armed — so changing your mind costs one click rather than five.
The default is the player on your left (`seatOrder[1]`; `seatOrder` is documented
"clockwise around the table, starting at me"), which is the convention at a real
table.

`Awaiting.declareAttackers` was widened to carry the legal attackers and legal
defenders, because a client cannot compute them: both need a `GameState` no client
holds.

## D89 — Blocker arrows, and why the host ships the pairing matrix

Blocking is the same veil and the same arrow layer as targeting, with a different
legal set and two stages: pick one of your creatures, then pick what it blocks.

⚠️ **`Awaiting.declareBlockers` now carries the legal PAIRINGS**, for the same
reason `declareAttackers` carries its choices (D88): a client cannot compute them.
"Can this creature block that attacker" runs through `canBlock`, which reads
DERIVED keywords — flying, reach, menace, fear, intimidate, skulk, shadow,
horsemanship, protection — off a `GameState` no client holds. The matrix was
already being calculated in `blockPrompt` to decide who to prompt at all;
returning it instead of throwing it away is what makes an honest veil possible,
and a veil that lit up an illegal block would be worse than no veil.

Every id in it is a battlefield permanent, so it is public and D61 holds.

⚠️ The matrix is carried FORWARD unchanged as each defending player submits.
Declaring blocks is one turn-based action with no priority in the middle, so
nothing between two submissions can legally change it.

**The veil stopped knowing about modes.** It is handed `active`, a legal set, the
ids already picked and an `onPick` — which is what lets ONE measurable overlay
serve both "aim a spell" and "choose a blocker" instead of two overlays that
drift apart the day one of them gains a rule. `onVeilPick` is the single place
that decides what a pick means, so a click on the card and a click on the veil's
hit area cannot end up doing different things, and the arrow is started and
cleared in one place.

⚠️ **A block link is distinguished from a target link by SHAPE — a perpendicular
parry bar across the arrowhead — never by colour.** Same rule as the dashed
refusal (D85): hue on this table is already carrying the five MTG colours and the
damage red, and an arrow that means something different has to survive being
looked at quickly.

⚠️ `escape()` resets the aim when it drops a pending blocker. The arrow's tail is
pinned to that creature, so dropping one without the other leaves an arrow glued
to the cursor with nothing at the far end.

Verified: the pairing itself in `engine/targets.test.ts` (a Giant Spider may block
a flier, a Grizzly Bears has no row at all, and the defender's own flier may) —
and the wiring in the battery's `engine` section, which asserts the veil comes up,
that a declared block draws its own quadratic path, and that the parry bar is
present. The battery deliberately uses any two RENDERED cards rather than a legal
pair: legality needs a `GameState` the renderer never sees, and picking only from
my own board made the check skip on the battery's one-permanent table and test
nothing at all.

## D90 — Spells that actually resolve, and the `assisted` tier that exists to stop them lying

The app now executes some card text. That is a change to the thing AGENTS.md's
tier table promises, so the numbers and the boundary both matter.

**Measured over the Commander-legal pool** (distinct cards, instants and
sorceries only): **6,975 spells; 274 understood completely; 1,300 understood in
part.** Across all faces including reprints, the ingest counts 1,614 `auto`,
4,148 `assisted`, 18,569 `manual` — pinned in `oracleParse.node.test.ts`.

**The rule everything below follows: never half-execute a card.** A face is
`auto` only when EVERY sentence of it is understood. `Beast Within` is "Destroy
target permanent." plus "Its controller creates a 3/3 green Beast creature
token." — destroying the permanent and silently skipping the token is strictly
worse than doing nothing, because the player has no reason to check and no way to
see what was missed. Those 1,300 become `assisted`: when one resolves, the prompt
bar offers the part the app understood as a one-click action, logged with the
wrench like every Tier-3 tool, and says in as many words that the rest is theirs.

⚠️ **The closed vocabulary is what makes that rule hold, and it was not the first
design.** The first cut used `[a-z ]+` for a target phrase and "understood"
`Homing Lightning` ("deals 4 damage to target creature AND each other creature
with the same name as that creature") and `Spell Blast` ("counter target spell
WITH MANA VALUE X"). Both matched on their prefix, and both would have executed
as a prefix. A closed noun list cannot do that — anything outside it simply is
not understood — and the measured "coverage" fell from 10.4 % to 3.9 % when the
vocabulary was closed. That drop is the design working.

⚠️ **The assisted path runs the SAME `effectEvents` the automatic path runs.**
There is no second implementation of "deal 3 damage", so the two cannot drift.
What differs is only who decided.

**Two engine primitives had to exist first.**

1. **A non-combat `DamageDealt`**, carrying the same `ResolvedDamage` payload as
   `CombatDamageDealt` and applied by the same extracted reducer helper — so
   infect, wither, deathtouch, lifelink and the commander tally cannot behave
   differently depending on where the damage came from. It maps to the same
   `DamageDealt` VIEW event, so three damage from a Bolt punches a card exactly
   as three from an attacker does.
2. **Until-end-of-turn P/T** (CR layer 7c), which did not exist at all: a list on
   `GameState`, an event that appends, `derive` summing it at 7c — after the
   base-setting 7b and BEFORE counters, which is what makes a Giant Growth on a
   creature with a +1/+1 counter read +4/+4 rather than swallowing one — and
   `UntilEndOfTurnEnded` at cleanup (CR 514.2).

⚠️ **The effect runs BEFORE the card moves.** A spell is still on the stack while
it resolves (CR 608.2), and a Bolt already in the graveyard has no source for its
damage.

⚠️ **Lethality is still the SBA's job.** The effect only marks damage; the
existing state-based action kills the creature. A second implementation of
"is this lethal" would eventually disagree with combat.

⚠️ `isCommanderDamage` is FALSE for spell damage even from a commander. CR 903.10a
counts only COMBAT damage toward the 21, and counting a Bolt would kill people
early in a way that is impossible to argue with after the fact.

## D91 — Two bugs that only became visible once spells did something

Both were latent for as long as resolution was a no-op, and both were caught the
same way: by a test that expected a spell to do nothing and got an invariant
violation instead.

1. **`targetsStillLegal` checked only the ZONE**, and admitted graveyard and
   exile for everything. Harmless while a resolving spell did nothing; the moment
   it dealt damage, a Bolt aimed at a creature that had been exiled in response
   still resolved and marked damage on an object outside the battlefield —
   `checkInvariants` caught it as "has damage outside the battlefield". It now
   runs the SAME `targetAllowed` predicate declaration runs, against the spell's
   own parsed clauses, which is what D81 promised and this is the fix that
   delivers. A target that changed zones is a new object (CR 400.7) and is never
   still legal.

2. **A card's TYPE counted as a targeting kind in every zone.** A Grizzly Bears in
   a graveyard was still a "creature", so `target creature` accepted it — which
   is how the Bolt above found an exiled card legal in the first place. A card
   type only makes something a creature/artifact/… while it is ON THE
   BATTLEFIELD; in a graveyard it is a creature CARD, which is a different clause.
   Fixed in both `candidatesFromState` and the client's `candidatesFromView`,
   which must agree exactly or the veil lights up something the host will reject.

Neither was a targeting bug anyone could see before; both were real and both
would have shipped.

## D92 — Importing a deck by link: three sites, one text format

The link box takes a Moxfield, Archidekt or TappedOut deck URL and downloads the
list. Everything about it was decided by measurement rather than by preference
(2026-07-27).

**0. Every site adapter returns TEXT, in the Arena shape the parser already
read.** Not a DeckFile, not entries, not a "normalised deck" — a string with
`Commander` / `Deck` / `Sideboard` headings. That is the whole reason three
sites cost roughly one site's worth of code, and it is why there is exactly one
place in this app that decides what a decklist means. A fourth site is a
function returning a string.

⚠️ **Each site says where the commander is DIFFERENTLY, and that is the only
part worth arguing about.** Get it wrong and the import is silently a 100-card
pile with no general. So each rule below was checked against six real decks, not
one.

**1. The `?fmt=txt` export cannot say what the commander is.** It serves a clean
`1 Card Name` list — alphabetical, the commander somewhere in the middle of it,
unmarked. `?fmt=dek` is byte-identical. `?fmt=multiverse` returned 90 empty
names, `?fmt=markdown` a title with no cards, and `?fmt=cod` / `?fmt=doc` are
not implemented at all — both serve the deck page.

So we fetch the DECK PAGE and lift the MTG Arena export out of
`<textarea id="mtga-textarea">`, which was present on every deck measured
(Commander, Modern, Pioneer) and carries the whole thing:

```
About
Name Verrak's Worst Nightmare | V-SOS

Commander
1x Verrak, Warped Sengir (DMC) 16

Deck
1x Angel of the Ruins (EOC) 63
```

Sections, quantities, set codes, collector numbers, and the deck's own name — a
format `src/data/decklist.ts` already read in full before any of this existed.
The cost is 160–660 KB per import instead of 2 KB, and a dependency on a page
template. `?fmt=txt` is kept as the fallback for the day that template changes:
the cards still import, `commanderKnown` comes back false, and the screen says
which card is the commander has to be chosen by hand.

⚠️ The `About` header is DROPPED, not parsed. `About` and `Name Whatever` are
perfectly good card lines as far as a decklist parser is concerned, and would
import as two cards resolving to nothing.

**1a. MOXFIELD says it outright.** `https://api2.moxfield.com/v3/decks/all/<publicId>`
returns 460 KB–1.4 MB of JSON with an explicit `boards.commanders`, populated on
6 of 6 commander decks measured including two partner pairs. `/download?format=txt`
is not a thing (HTTP 400: "The value 'txt' is not valid for Format"). We take
`commanders`, `mainboard` and `sideboard` and nothing else: `maybeboard` is cards
the deck is CONSIDERING — one measured deck had 197 — and companions, tokens,
stickers, attractions and the rest are not cards in a Commander deck. A section
this app would ignore anyway is noise in the box the user is asked to check.

⚠️ Moxfield's API is undocumented and unversioned by contract. It answered a
request that identifies this app by name, and it may stop doing so at any time.
That is why the failure path says "paste the list instead" rather than pretending
— and why we do NOT impersonate a browser to get around it.

**1b. ARCHIDEKT has neither boards nor a fixed name for the commander.**
`https://archidekt.com/api/decks/<id>/` returns ~190–360 KB with `cards[]` and
user-named `categories[]`. Two rules, both measured on 6 of 6 decks:

- **A category with `includedInDeck: false` is not in the deck.** That is where
  the Maybeboard lives. Excluding those entries is what made every measured deck
  come to exactly 100 — including them made none of them.
- **The commander is the category named "Commander" — unless the user renamed
  it.** One of the six had called it "Turn 2 ramp". The renamed one still carried
  Archidekt's own `isPremier` flag, so that is the fallback, **bounded at two**:
  a premier category is only reliably the commander when it holds a legal number
  of them, and past that we have misread a category. No commander at all is a
  visible problem the screen already handles; a wrong one is not.

**2. A link names a DECK, not a URL.** `parseDeckUrl` reads the deck id out of
the path and REBUILDS every address from it; the string the user pasted is never
fetched. A query string, a fragment, `/primer`, `/edit/`, a port and any embedded
credentials are all gone by construction — the last two are still refused out
loud, because a deck link out of an address bar never carries them, and quietly
fetching something other than what was pasted is the worse answer.

⚠️ **A LINK host is not a FETCH host.** `moxfield.com` is where the user's link
points; `api2.moxfield.com` is where the GET goes, because this module says so
and not because the link said so. `ALLOWED_HOSTS` holds only what we fetch, and
the battery asserts the link hosts are NOT in it.

⚠️ **`deckfetch.cjs` has its OWN allowlist rather than widening scryfall.cjs's.**
Two exact allowlists, each owning its own call sites, so the image queue cannot
reach a deck site and the deck importer cannot reach Scryfall's CDN.
`battery-deckimport.cjs` asserts both directions; if either check ever passes,
the modules have grown into each other.

⚠️ TappedOut's set codes are its own, not always Scryfall's — `(000)`, `(GRV)`.
That is harmless and must stay harmless: `cardindex.byName` falls through to
name resolution when a set + collector number matches nothing, so the card
resolves to its best printing instead of failing. The measured import of a real
100-card list resolved 100 of 100 with those codes present.

**3. The defect two more sites found immediately.** `src/data/decklist.ts` read
collector numbers with `/^[A-Za-z]{0,4}-?\d+[A-Za-z★]?$/` — which accepts
`TSP-157` and rejects `C18-150` (a List reprint) and `2023-8` (a media promo).
Both are real, and one of each appeared in the FIRST deck fetched from each of
the two new sites.

⚠️ **A rejected collector number does not merely lose the printing.** The
trailing-group peel stops at the first thing it cannot read, so the set group is
never peeled either and `Harrow (PLST) C18-150` stays glued together as the
card's NAME — which resolves to no card at all. One line in each of two 100-card
decks, reported honestly as "no card named …" and impossible to act on.

The pattern is now "alphanumeric runs joined by hyphens, containing at least one
digit". ⚠️ The digit is what keeps `(ltc) Ramp` from reading as a collector
number, and the existing guard — only accept a bare trailing token when a
bracketed group sits immediately before it — is what keeps `Fury Sliver 157` a
card name. There were also TWO copies of the pattern, one extracting the
candidate and one testing it, and only the tester was documented; the extractor
now takes the last token and lets the tester judge it.

This is the M1.8 parser, 65 tests old and exercised by every paste since — and
no paste had happened to carry one of those printings. It took a second data
source to find, which is the argument for measuring a new one against real decks
rather than a fixture.

## D93 — The fixture board may never be built while a game is running

Setting up a solo game moved off the table screen and onto a lobby of its own
(seat count, a deck per seat, start). That is a small feature, and it exposed a
defect that had been reachable since M4.

`TableScreen` keeps two sources for the same `useGame` view — the M2 fixture
scenarios and the M3 engine — and switches on `engineRunning`. The FIXTURE side
rebuilds whenever its card pool changes, and the pool is fetched the first time
the table becomes **visible** (deliberately: an always-mounted screen must not
fork the card-database worker at launch, which the shell probe asserts).

So the sequence is:

1. Start a game from a screen that is not the table.
2. Navigate to the table. It becomes visible for the first time.
3. The pool fetch fires, `pool` changes, the build effect runs…
4. …and `choreographer.applySnapshot(fixtureView)` lands **on top of the live
   game**.

Measured: a 3-seat solo game with Kess and Omnath at the table became a 4-seat
fixture board between the start and the first frame. Silently — both are valid
`PlayerView`s, the engine kept running underneath, and the only symptom was
"I asked for three players and got four".

⚠️ **The engine owns the view whenever it is running.** The build effect returns
early on `engineRunning`, and the pool fetch does too. `engineRunning` is in both
dependency arrays, so ending a game rebuilds the fixtures — which is the mode the
table should fall back to. The dev handle `table.setup()` is deliberately NOT
guarded: the animation battery drives fixtures directly and knows what it is
asking for.

⚠️ This was reachable from the multiplayer lobby since M4 by the same route, and
nobody hit it because the table screen is usually visited before a game starts.

**And the other half of the same bug: navigating by store alone.** `App.tsx` says
the hash is the source of truth and the store mirrors it. A screen that called
`setScreen('table')` left the two disagreeing — the table was on screen while the
hash still read `#solo`, so a reload came back to the lobby of a game already in
progress. `useUi.goto()` sets both, and must: assigning an UNCHANGED hash fires no
`hashchange` at all, so the listener alone cannot be relied on either.

## D94 — The commander is dragged out of the command zone, like any other card

Casting your commander had no gesture at all: the command-zone pile had no click
handler and no drag, and the prompt bar only ever COUNTED affordable casts
without listing them. The engine had offered the action since M3 — `legal.ts`
walks `state.zones.command[player]` and prices the tax — so what was missing was
purely the way to reach it.

**It is the same gesture and the same drop handler the hand uses.** `useHandDrag`
never knew where a card came from — it takes `{instanceId, card, faceIndex}` —
and `dropCheck`/`onCardDrop` look actions up by card id in `legal`, never by
zone. So the commander needed no new rules path, and there is still exactly one
answer to "what does playing this card do": a drop opens the same payment review
a click does, commander tax and all.

⚠️ **Two instances of `useHandDrag` now exist** — the hand fan's and the pod's.
That is safe because both refuse to begin while `useDrag.phase !== 'idle'`, so
only one card is ever in the air. Do not "simplify" this into a shared singleton
without keeping that guard.

⚠️ **The ghost is sized to the PILE, not the battlefield card.** Picking up a
44 px pile card and finding a 130 px card under the cursor reads as having
grabbed something else entirely.

⚠️ **The park watcher had to learn the second zone.** A dropped card is hidden at
its source and drawn by the drag layer, and something must always put it back;
the watcher cleared the ghost when the card left the HAND. A commander leaves the
COMMAND zone, so its ghost stayed parked until the 900 ms floor swept it up —
the real card and the ghost on screen together, which reads as the commander
having been duplicated. It now checks both zones a drag can start from.

**Partners: the top card, and only the top card.** A pile draws one face, and
dragging anything else out of it would be dragging a card the player cannot see.
With two commanders that means casting them in the order they are stacked —
which is at least the order the pile shows.

Verified by driving the real gesture through the probe's pointerId-787 handles
(`drag.startPile`, the pile counterpart of `drag.start`): with no mana the ghost
says "Not enough mana for Kess, Dissident Mage" and the drop is refused; with
mana it reads "Cast Kess, Dissident Mage", the drop opens the payment review, and
confirming puts Kess on the battlefield with the command zone empty and no ghost
left behind.

## D95 — A list with no Commander heading is worked out from the CARDS

"Treat the first card as the commander" was a checkbox that promoted line one,
whatever line one happened to be. It shipped in M1.8 and it is wrong in two ways
that only show up on real lists:

1. **An alphabetical list has a card, not a commander, at the top.** TappedOut's
   plain export — which is also our own `?fmt=txt` fallback (D92) — is sorted by
   name, so the rule made `Accorder's Shield` the commander of a deck whose
   actual commander sat 55 lines further down.
2. **It could only ever promote ONE.** A Partner pair lost its second commander
   into the deck, and the deck then failed validation for a reason the player did
   not cause.

`pickCommanders` replaces it: candidates are the cards that could legally BE a
commander, the primary is the first one that proves it (`commanderEligibility`
`'yes'` beats merely-legendary), and if that card brings a pairing mechanic the
list is searched for a legal partner.

⚠️ **It runs AFTER name resolution, not during parsing.** Every question that
decides it — is this legal as a commander, does it have Partner, is that a
Background that matches — is a question about the CARD. The old rule ran on
parsed text because that was all it needed to count to one.

⚠️ **The pairing decision is `pairsLegally`, the predicate the VALIDATOR uses.**
Not a second copy of the rules living in the importer. A detected pair the
validator would then reject is worse than no detection at all, and two
implementations of Partner / Partner with / Background / Friends forever /
Doctor would drift.

⚠️ **A Background is never the FIRST commander.** It is legendary, so it passes
eligibility on its own, and leading with one produces a deck that fails for a
reason the player did not cause. It can only ever be the second.

⚠️ **A `Commander` heading always wins.** The file said so; detection is for
lists that did not.

⚠️ **And it is never silent.** The screen says which cards it chose and why —
"both have Partner" — because a commander nobody typed is exactly the thing a
player needs told. The note carries the fix too: add a heading to choose
differently.

A commander entry is ONE card. A list with `2 Rograkh` puts one in the command
zone and leaves the other in the deck for the singleton rule to report, rather
than deleting a card the player wrote down.

## D96 — Equipping is an AIM, and it is still Tier 3

Dragging an Equipment onto a creature is the gesture people expect, and until now
there was no way to attach anything at all: `ManualAttach` existed in the engine
and was reachable from nothing.

**It is the targeting arrow, not a card drag.** Press an Equipment or Aura on my
battlefield, drag, and the arrow comes out of it while the veil dims everything
that is not a legal host. Two reasons, and the second decided it:

1. It IS a targeting gesture — you are pointing at what the thing goes on, not
   moving a card into a zone. Blocks already work exactly this way.
2. The veil "knows nothing about MODES: it is handed a legal set". So attaching
   needed a legal set and a commit, not a second hit-testing machine — and it
   inherits the property that only legal hosts are clickable, which a ghost drag
   onto a card would have had to reinvent.

⚠️ **It stays Tier 3, and the prompt says so.** `Equip {2}` has no colon, so
`activatedParse.ts` never reads it as an activated ability and the engine cannot
charge it — by design, and for the same reason ward-by-sacrifice stayed manual.
So this moves the attachment and nothing else: the cost and the sorcery-speed
timing remain the player's, and the prompt bar carries "Moves it only — the
equip cost and its timing are yours." Offering a button labelled "Equip" would
claim an enforcement that does not exist.

⚠️ **An attachment must be pick-up-able too.** An Equipment that can be attached
once and never moved is worse than one that cannot be attached at all — moving
it is most of what equipment does. An attached card renders inside its HOST's
slot, so its press handler `stopPropagation()`s: without that the press bubbles
to the host's wrapper and picks up the creature instead.

⚠️ **`Card` takes no pointer props — only `onClick`.** A handler passed to it is
silently dropped, which is exactly how the first cut of this shipped doing
nothing at all: the wiring was complete, the build was clean, and pressing an
Equipment produced no mode. The press belongs on the SLOT wrapper, which is also
where `data-band-slot` lives and what a real press bubbles to.

Legal hosts are my permanents, minus the attachment itself and minus what it is
already on — creatures only for an Equipment, anything for an Aura or a
Fortification. Decided from the type line, which is all a Tier-3 tool needs: the
narrower list exists so the veil does not offer a Forest to a sword.

## D97 — What is on a creature needs a way in

An attachment renders tucked behind its host, offset 13 px (`ATTACH_OFFSET_Y`).
That is the right PICTURE — an Equipment in its own row slot loses the one thing
you need to know about it — and it is a bad AFFORDANCE: a sliver of card edge
carrying no name, no type line, and nothing to click. Attach something and it
effectively disappears.

So the host grows a TAB on its left edge: two thin plates and a count, drawn to
read as the edges of the cards stacked behind it. Clicking it opens a panel
listing every attachment with what can be done to each.

⚠️ **The tab's press must `stopPropagation`.** The slot wrapper is the element
that picks a permanent UP (D96), so without it, pressing the tab starts dragging
the creature the tab belongs to.

⚠️ **The panel reads the VIEW every render, never a list captured when it
opened.** An attachment that moved or died while the panel was up has to leave
it; a snapshot would keep offering "Take off" for a card that is in a graveyard.

⚠️ **`Move` and `Take off` are the same Tier-3 tools the drag is** — `Move`
re-enters the D96 attach aim, `Take off` is a `ManualAttach` to nothing — and the
panel says so in a footer: neither charges an equip cost. `More…` hands the card
to the existing `CardMenu`, so everything the manual tools can do to any card is
one click away rather than reimplemented here.

The tab renders on EVERY pod, not just mine: what an opponent has enchanted is
worth reading, and reading it changes nothing. Picking an attachment up stays
mine-only.

⚠️ **It renders nothing in fixture mode**, because the handler comes from the
engine layer and fixture mode passes none — measured at 0 tabs across 36
permanent slots. That is what keeps the animation battery driving exactly the
components it always did.

## D98 — Command, exile, library, graveyard — and one slot per commander

The four zone piles used to sit in a 2×2 grid ordered library, graveyard, exile,
command. They now read top to bottom as **command → exile → library →
graveyard**, which is the order asked for and the order a player reaches for:
the commander is the card you look at every turn, the graveyard the one you look
at least.

**The command zone is a BOX of one slot per commander, not a pile.** Every other
zone is a stack whose top card is the only one that matters; a command zone is
not. A partner pair is two cards that are both always there and both castable, so
drawing one with a "2" badge hid half of it — and only the top one could be
picked up, which is the caveat D96 had to write down. One slot each fixes both:
either commander can be dragged out, in any order.

⚠️ **The zone anchor is the BOX, not a slot.** `rectRegistry` resolves one anchor
per zone; registering per commander would let the last one rendered win, so a
card flying "to the command zone" would land on whichever slot rendered second.

⚠️ **THE BLOCK'S WIDTH IS A FIXED BUDGET and the pile sizes are solved to fit
inside it — never the other way round.** Re-ordering these zones by simply adding
a third column cost the battlefield about 60 px per pod and put THREE bands into
scrolling, which is the fourth rung of the packing ladder and a bar the battery
holds. The budget is what it always was: two card-widths when the block is two
rows tall, four when it is one. The commanders keep the full pile height (they
are what you read every turn) and the three zones below share the same width
three-across; in a short pod everything shares one row.

Measured after the fix: 0 bands scrolling at 4 seats, block width 128 px, command
slots 91 px tall and the three zones 52 px, order `cmd, exile, lib, gy`.

⚠️ The reference this came from is a tall vertical rail, which our pod is not —
a pod is a wide horizontal strip and four stacked piles would not fit its height.
The ORDER is reproduced; the shape is a command box over a row of three.

**Revised the same day, to the shape actually wanted:** command box, then
library + graveyard side by side, then **exile underneath them lying on its
side** — a quarter turn to the right, the way a deck sits on a real mat.

⚠️ **The SLOT turns, not just the card.** `Card`'s own tap transform (D75) keeps
the layout box portrait on purpose, which is right for a battlefield row and
wrong for a pile in a wrapping block: the slot has to RESERVE the landscape
footprint or the next item overlaps it. The turn is the same
`translate(h, 0) rotate(90deg)` about the top-left that D75 works out.

⚠️ **ONLY THE CARDS TURN.** The empty slot's label and the count badge live in
the OUTER, upright box — the first cut had them inside the rotated wrapper, so
`EX` read sideways. A sideways pile is a deck lying on the mat, not a screen
tipped over, and text you have to tilt your head for is a bug with an
explanation. It is also why the placeholder is rendered against the outer box:
an empty exile should be the landscape shape it actually occupies.

⚠️ Sideways only when the block is STACKED. Lying the exile down makes it ~1.4
slots wide, which does not fit a pod that already has to put everything in one
row — and a pile overflowing its block is worse than an upright one.

The three rows are solved against the HEIGHT, and the turned pile is what makes
them fit: `cmd + zone + (zone × 0.716) + 3 labels + 2 gaps ≤ contentH`. Measured
at 4 seats: command 91 px, library and graveyard 81 px each (bigger than the
three-across row they replaced), exile 81 × 58 landscape, 0 bands scrolling.

## D99 — The phase bar says which phase, and the table says whose turn

Twelve equal cells of two-letter code — `UN UP DR M1 BC DA DB CD EC M2 EN CL` at
9 px — in a 30 px strip. Nobody learns that `EC` is end of combat and `EN` is the
end step, and nothing on the strip said that five of those twelve are one phase.

It is now two rows: the five **phases** of a turn across the top (CR 500.1),
the twelve **steps** beneath them, both marked. `PHASE_GROUPS` is derived from
`PHASES` at module scope rather than written out twice, so the two rows cannot
disagree about which steps belong to which phase.

⚠️ **THE MARKER WAS COVERING THE ONE LABEL THAT MATTERS.** The sliding brass
element was rendered AFTER the cells; everything in the strip is positioned, so
tree order alone decided what painted on top, and the marker sat exactly on the
current cell — 122 px wide over a 123 px marker, measured. The active step's
text was `text-crt-on-accent` (dark, meant to be read ON the brass) painted
*underneath* it, so the current step rendered as a solid brass block with
nothing in it. Both markers are now rendered BEFORE the labels with explicit
`z-0`/`z-10`, and the comment in the file says why.

⚠️ **The two rows are two grids with the SAME 12-column template and no gap**,
not two flex rows. A group header spans its `span` columns, so the phase
boundaries land exactly on step boundaries — measured at 1920: step edges 200,
312, 425, 537, 650… and group edges 200, 537, 650, 1212, 1324, which is steps
0/3/4/9/10 exactly. It is also what keeps `left: index × 100/12 %` honest for
the marker; a gap would make the cells narrower than a twelfth and the marker
would drift a pixel per step.

⚠️ **`RIGHT_W` is RESERVED, not measured.** The right-hand control slot holds a
caller-provided node — the table screen's "End game" (75 px) or "Set up a solo
game" (127 px) — and this component cannot know its width. Fixing it at 132 px
does two jobs: the step cells stop resizing when the button's label changes, and
`compact` below stays arithmetic instead of becoming a `getBoundingClientRect`
in a codebase where `rectRegistry` is the only legal caller of that. `GAP` and
`PAD_R` are constants applied through the style, so the arithmetic and the
layout cannot drift apart.

⚠️ **At the minimum window the names genuinely do not fit, and the fallback must
not be the old cryptic strip.** Min window is 1100×720 → tableW 828 → 38 px per
step column. `short` comes back for the cells, the phase headers lose their
letter-spacing, and the **full name of the current step moves into the status
block** — "CY TO ACT · DECLARE ATTACKERS". Above the threshold the track says it
and repeating it would be noise. `MIN_NAME_W = 64` is measured, not guessed: the
widest step name is "Attackers" at 53 px in Alegreya SC 11 px plus 8 px of cell
padding. Swept at 1920/1500/1366/1280/1100 — no truncation, no overflow at any
of them.

⚠️ **`PHASE_H` 30 → 48 comes out of the battlefield**, and that was the explicit
trade. It also moves a LADDER RUNG: `metrics.test.ts`'s "clips more of the hand"
case was pinned at hostH 895, which used to sit inside the rung and now sits one
below it. The rung is 901–925 with the taller bar; the test moved to 910, the
middle of it. That number tracks the fixed chrome above the table and has no
meaning of its own — the assertion is about the ladder's shape, which is
unchanged.

### Whose turn it is, in colour

`PlayerPlate` computed `isActive` and rendered **nothing** with it. The plate
showed a ring for priority and never said whose TURN it was — two different
questions, and the second is the one you ask first.

The active seat's whole pod now lights brass: a lit border, a 1 px inner ring
and a 52 px inner wash, plus the name in `accent-hi` and a filled `TURN` badge
on the plate. One seat out of four lit is readable without looking at anything.

⚠️ **Brass, NOT the seat's own identity gradient.** The five MTG colours appear
in exactly five places (see the note in `PlayerPlate`), and whose turn it is a
UI state, not a fact about anyone's mana — a pod glowing green would read as a
board full of Forests. The same brass lights the turn owner's name in the phase
bar, which is what makes the two signals unable to disagree.

⚠️ **A drag still wins the pod's edge.** `dropOk`/`dropRefused`/`dragging` are
tested before `activeTurn`, because a card in the air is the more urgent
question; the turn's edge simply rejoins underneath when the drag ends. A lost
seat is never lit.

The two floating buttons that used to sit at `left-1/2 top-2` moved INTO the bar
— they were landing squarely on the track and covering two steps, one of which
was the current one often enough to matter.

### And who can ACT, in a different colour

Lighting the active seat brass immediately created a second problem: the
nameplate's priority ring was ALSO brass. A seat with both — which is most of
any turn — showed one colour twice and therefore answered neither question. You
could not tell "it is Ana's turn" from "Ana can act", and those come apart
constantly: on your own turn an opponent holds priority every time you cast
something.

**Priority is green** (`--color-crt-ok`, 152°) against the turn's brass (78°),
in all three places it is said:

| Where | Mine | Someone else's |
|---|---|---|
| Phase-bar chip | filled green, `YOU MAY ACT` | green-tinted outline, `CY TO ACT` |
| Nameplate ring | 1 px green inset ring | same ring, on their plate |
| Prompt-bar text | green | default |

⚠️ **Green is 4° from green MANA, and the rule it bends is the five-colours-in-
five-places one.** It holds because none of those five places is any of these:
this is HUD chrome and a nameplate ring — never a card, never a pip, never a
mana well. The reason the rule exists is that an accent ON A CARD must not read
as "this has red mana"; nothing here is on a card. Brass was rejected for
exactly the same class of reason one step earlier.

⚠️ **The prompt bar goes green ONLY for the plain priority case**, not for an
`awaiting` that happens to be mine. An awaiting already names the action in a
button right beside the text ("Choose attackers", "Keep"); spending the colour
there would spend it on the case that needs it least, and would leave the two
loudest states looking identical.

⚠️ **"YOU MAY ACT" / "CY TO ACT" is one vocabulary.** The pair was "YOUR
PRIORITY" / "CY TO ACT", which asks a new player to work out that those are the
same fact about two different people. The rules term still appears in the prompt
bar and the log, where there is room to teach it.

⚠️ The DEV panel toggle moved to `top-[92px]`. At `top-[54px]` it cleared the
taller bar and landed on the leftmost opponent's NAME — the one thing on a plate
that cannot be worked out from anything else. Caught only by cropping a plate at
6× to check the ring, which is the argument for looking at the pixels.

**Verified: 844 Vitest · 124/124 probe · 253/254 animation battery**, run in
full again after the colour split. The one battery failure is the perf gate's
long-frame count (D29/D29a): 7 and 9 long frames across the two runs, p95
8.50 ms on both, 0 stray rect reads — inside the documented 3–9 range, and none
of this is in the render path the gate exercises.

## D100 — The log and the stack are coloured by WHO, not by what

The 2 px edge bar on a log row and a stack item was the CARD's colour identity.
On the stack that is redundant — the card's face is right there, in its own
frame, saying what colour it is. In the log it was worse than redundant: most
lines are not about a card at all. `Turn 5 — Ana.`, `Ana draws a card.`,
`Ben keeps 7.`, `No blocks.` all carry an empty identity, so they resolved to
`--color-mtg-c` and the log read as a grey wall. Measured on a fresh 4-seat
game: **20 of 20 visible rows had no colour.**

The question a four-player log is actually scanned for is *who did that*, and it
was the one thing the colour did not answer. Both bars are now the seat's
**commander identity** — the same colours as the gradient under that player's
nameplate, so a row and the pod it refers to match.

⚠️ **This adds NO sixth place for the five MTG colours.** The edge bar on stack
items and log rows was already one of the sanctioned five; only what it is keyed
to changed. The other four are untouched.

⚠️ **`identityGradient`, not `identityToken`.** `identityToken` collapses every
multicolour identity to one gold, which is correct for a card (a gold pip is a
real thing on a real card) and useless for a seat: a Jeskai deck and an Esper
deck would be the same swatch and the colour would identify nobody. The gradient
keeps each seat's own stops. It also cannot be a `border-left` — a border takes
no gradient — so both bars are positioned elements. `PlayerPlate`'s private copy
of the same function is gone; two answers to "what colour is this player" would
drift, and a log row disagreeing with the pod it points at is worse than no
colour at all.

⚠️ **The bar stays the PLAYER's on a Tier-3 row.** Manual entries already carry
three signals — wrench glyph, warn text, warn wash — and that is the trust
feature D68 and M3 built. Spending the bar on it as well would cost the only
thing on the row that says whose action it was.

### The engine had to learn who a line is about

`NarrationLine` recorded `text`, `identity` and `manual`, and no player. Three
cheaper sources were considered and all three are wrong:

- **`cause.player`** — empty for everything the rules do on their own, which is
  precisely the turn markers, draws and resolutions that make up most of the log.
- **`state.turn.activePlayer`** — right for turn structure, wrong the moment a
  spell resolves on somebody else's turn.
- **Parsing the text** — the line names the player, but a name is not an id, two
  seats can share a name, and a log that colours itself by string matching is a
  bug waiting for the first player called "Turn".

So `Narrated` carries `player` and the 50 `narrated()` call sites each say whose
line it is. ⚠️ **The parameter is REQUIRED and positional, second**, not an
optional trailing one — an optional parameter would have let every site that did
not think about it default silently back to a grey row, which is the state this
replaced. `null` is reserved for lines that genuinely belong to nobody:
`No blocks.` (declared by everyone being attacked, at once) and
`The game is a draw.` A win belongs to the winner.

⚠️ **Two lines do NOT belong to the player who clicked**, and the compiler could
never have caught either: "*X* draws N cards" from the Tier-3 draw tool belongs
to the player who drew, not to whoever pressed it, and "passed for *Y*, who is
disconnected" is about *Y*. Both are the sentence's subject rather than the
intent's actor — which is the rule the other 48 follow too, they just happen to
coincide there.

**Verified: 844 Vitest · 124/124 probe · 253/254 animation battery · the
500-seed replay-equivalence fuzz gate green** — the one that matters here,
because `NarrationLine` is part of `GameState` and therefore of the state hash.
Driven in the live app: 20 of 20 log rows coloured across four seats (Ana red,
Ben blue, Cy green, a UBR commander violet-to-blue), a Tier-3 row keeping its
wrench and warn wash with the player's bar intact, and a Lightning Bolt on the
stack carrying its controller's gradient rather than its own red. The one
battery failure is still the perf gate's long-frame count (D29/D29a): 4 long
frames, **0 over 33 ms**, p95 8.5 ms.

## D101 — The log reads in the second person, and the engine still does not know who "you" is

The log said **"You draws a card."** — and "You plays Swamp.", "You casts
Lightning Bolt.", "You keeps 7.", "You moves Mountain to the battlefield." It had
said so since M3; D100's colour bar only made the log legible enough that people
started reading it.

⚠️ **Two causes, and the grammar was the smaller one.** `SEAT_NAMES[0]` was
literally the string `'You'` (`src/game/buildGame.ts`), and every narration
template in `src/engine/` is third-person and interpolates the seat's name — so
seat 0's name landed in front of a third-person verb. But solo play is a
**hotseat** (D42): `session.setViewer` rotates the one viewer across every seat as
the game asks each of them to act, so the seat labelled "You" is routinely *not*
the seat you are currently playing. Naming a seat "You" could not have been made
to work; it had to stop.

**A seat has a name. Whether that seat is YOU is a question about the reader**,
and it is answered where the reader is known. The four seats are `Ana`, `Ben`,
`Cy`, `Dee` — the table already says which pod is yours by putting it at the
bottom.

### A line is not a string

⚠️ **The engine must stay viewer-agnostic.** One narration is projected to every
seat, and in multiplayer each client sees a different seat as itself, so a
second-person sentence cannot be baked into the engine. But the renderer cannot
be handed a finished sentence either: `src/ui/` would have to find the subject in
it and de-inflect an English verb.

So `narrated()` takes **parts**, and there is exactly one primitive — a fragment
that reads one way normally and another way when the reader is the player it is
about:

```ts
narrated(n`${who(state, ap)} ${vb(ap, 'draws', 'draw')} a card.`, ap)
//  me = null → "Ana draws a card."      me = ap → "You draw a card."
```

`{ lit }` or `{ of, third, second }`, and that second shape covers a name
(`who`), a possessive (`whose`), the pronouns (`their`, `they`), a reflexive
(`themself`) **and a verb** (`vb`) — one type, not five, because they are all
"this reads `third`, or `second` when the reader is `of`".

⚠️ **NO ENGLISH MORPHOLOGY ANYWHERE.** Both forms are written out at the call
site. A de-inflector gets `loses`→`los`, `goes`→`goe` and `dies`→`dy`, and it
fails silently — nobody notices until a player reads one. Two words at the call
site cannot be wrong.

⚠️ **`vb` names the player it agrees with rather than inferring it from the
nearest preceding part.** Inference is right almost always, and "almost always"
in `Ana passed for Ben, who is disconnected` is a verb agreeing with the wrong
seat. That line is also why grammar could not reuse D100's `player` field:
`player` is the **colour** and is Ben, while the **subject** is Ana. They come
apart, and a renderer keying grammar off the colour would have got it backwards.

### Where the person is chosen

`project()` and `toViewEvents()` — **both already take a `viewer`**, because
projection is the per-viewer hidden-information boundary. Each renders the parts
again for its reader. `src/ui/` is unchanged: `GameLog` reads `view.log[].text`
and still knows nothing about person, which is what makes this correct in
multiplayer and across every hotseat seat change for free.

⚠️ **`NarrationLine.text` is DERIVED from the parts and never written by hand.**
It stays the canonical third person — the NDJSON log on disk, the state hash, a
spectator. Two hand-written renderings of one sentence would drift, and the drift
would be a log that disagrees with itself. `render(parts, null) === text` is
asserted over a whole game.

⚠️ **The third-person text does not move.** Every existing sentence renders
byte-identically, which is what made the change provably grammar-only — and it is
why the vocabulary has both `their` ("their"/"your") and `whose` ("Ana's"/"your")
rather than one possessive: collapsing them would have rewritten
`Ana cannot draw — their library is empty.`

**Two exceptions, both forced, both fixing a sentence that was already wrong.** A
Tier-3 tool used on yourself produced `Ana sets Ana to 37 life.` and
`Ana shuffles Ana's library.`; the plain object form would have turned those into
`You set you to 37 life.`, trading one broken sentence for another. `whoElse` /
`whoseElse` pick the reflexive when the subject and the object are the same
player, so both persons read correctly: `Ana sets themselves to 37 life.` /
`You set yourself to 37 life.`

⚠️ Capitalisation is **one positional rule** in `render` — start of output, or
after `. `, `! `, `? `, `— `, `: ` — not a flag on 50 call sites, which is a thing
50 sites can each get wrong. It has to apply to the third person too: `they()` is
stored lowercase and `…first draw. They skip…` needs the capital in both persons.

⚠️ `project()` caches the rendered row **by line id** (a narration line is
immutable once appended). Without it the log costs 200 string joins per commit
instead of a field read, on the path D21 measured. Reusing the `LogEntry` objects
also brings the log inside D21's identity rule, which the old `narration.map`
never was.

### The same defect was in the prompt bar

Six `awaiting` kinds in `PromptBar.describe` had **no viewer branch** —
`orderBlockers`, `orderAttackers`, `orderTriggers`, `assignCombatDamage`,
`chooseTargets`, `rewindVote` — so they read **"You is ordering blockers."** and
**"You is choosing targets."** Same cause, different surface. Every other branch
in that switch already asked whether the seat was the reader's; these now do too.

**Verified: 869 Vitest (19 new in `engine/narrate.test.ts`) · 124/124 probe ·
253/254 animation battery · the 500-seed replay-equivalence fuzz gate green** at
98,808 accepted intents / 1,149,974 events with identical replay hashes — the
gate that matters here, because `parts` is part of `GameState` and therefore of
the state hash. Every template was driven through a real game and read in both
persons. The one battery failure is still the perf gate's long-frame count
(D29/D29a): 8 long frames, **1 over 33 ms**, p95 8.50 ms, **0 stray rect reads**.

**Proven on two real apps over one LAN socket**, which is the claim that could not
be tested any other way. Identical state hash `99ac4b12cdc1f946` on both sides,
each in its own seat, from the SAME engine narration:

| host, seat p1 | guest, seat p2 |
|---|---|
| **You go first.** 40 life each. | **Apps goes first.** 40 life each. |
| **You keep 7.** | Apps keep**s** 7. |
| Apps keep**s** 7. | **You keep 7.** |
| Turn 1 — **You. You skip your** first draw (CR 103.7b). | Turn 1 — Apps. **They skip their** first draw (CR 103.7b). |
| Apps **draws** a card. | **You draw** a card. |
| Apps **plays** Mountain. | **You play** Mountain. |

Both seats are named "Apps" there — the multiplayer path takes
`settings.playerName`, and both instances defaulted to the OS user. Which is its
own argument for keying person and colour on the seat ID rather than on a name.

⚠️ **Found while running the gate, PRE-EXISTING, and fixed separately in D102.**
`scripts/two-instance.cjs` was reporting 21/24, and the `?` in the three failing
checks was the test script having nothing to submit — not the two apps
disagreeing. They agree exactly, as the hash above shows.

## D102 — The test driver could not answer "choose targets", and nothing could see it

`scripts/two-instance.cjs` — the M4 sign-off, two real apps over one LAN socket —
was reporting **21/24**, and had been since the targeting work landed. Three
checks failed with `host t?`, which reads like the host being unreachable.

It was not. Both apps agreed on the identical state hash and each sat in its own
seat; the GAME was simply stopped, on `awaiting: "chooseTargets"`, with nobody
answering. `src/net/testing/script.ts`'s `simplestIntent` — the driver both this
script and the `src/net` suite play through — had no case for that prompt, so it
fell to `default: return null` and submitted nothing ever again. D79–D89 added
the prompt; the driver was never taught it.

⚠️ **48 net tests stayed green through all of it, because the fixture deck
contained no targeted spell.** `fixtureDeck`'s pool is ten creatures, an artifact
and a land — not one of them targets anything, so `playFrom` could never raise
the prompt it had no answer for. The pool now includes `Lightning Bolt`, which is
the same repair its own comment already records making once: the first version
dealt forty lands and tested nothing but land drops. **A pool that cannot reach a
code path is how that path rots**, and the cost here was a broken sign-off script
that CI could not explain.

### Targets are chosen PER CLAUSE, not "the first N legal"

`validateTargets` does not merely check that every choice is legal somewhere — it
runs `assignTargets`, a one-for-one matching of choices to clauses. A flat "first
N of the union" list fails it whenever two picks both answer clause A and leave
clause B empty. So `planTargets` fills each clause from its OWN legal set
(`session.legalTargetsFor([spec], source)`, one spec at a time) and tracks what is
taken, because the same object may not answer twice. `spec.min` is what a clause
REQUIRES; an optional clause has min 0 and is left empty, which is the minimal
legal answer and the one the prompt bar's "cast with no targets" button sends.

⚠️ **The answer had to be TERMINATING, not merely present.** A spell whose
required clause has no legal object gets `CancelPendingCast` rather than `null` —
returning null is the wedge this case exists to remove. But cancelling alone
turns a deadlock into a **livelock**: `legalActions` does not consider targets at
all (it offers Swords to Plowshares against an empty board), so the driver would
cast, be asked, cancel, and cast the same card again forever — which fails the
same three checks, for a reason that looks identical from outside. So the cast
FILTER also skips a spell whose targets cannot be planned, in the same shape as
the `!a.hasX` filter already beside it. Prevention and recovery, not either one.

**Verified: 869 Vitest · `two-instance.cjs` 25/25 · 33/33 `--offline` · the
500-seed fuzz gate unchanged** at 98,808 accepted intents / 1,149,974 events.

### The sign-off was stopping one step before it proved anything

⚠️ **Going green was not the same as being exercised.** With the driver fixed,
`two-instance.cjs` passed 25/25 — and its on-disk log held
`2 LandPlayed, 2 MulliganKept` and NOTHING ELSE. It played until turn 3, and turn
3 begins after two land drops and before either side has a main phase to spend
them in, so the stack, the payment solver and the whole cast path had never once
run over the wire. The script could not have caught the bug it had just been
fixed for.

So the loop now plays until **a spell has been cast and RESOLVED and both apps
show it**, bounded by a deadline. Two consequences worth keeping:

- **The exit condition IS the assertion.** A fixed "play to turn 6" would still
  pass on a game that cast nothing, which is exactly the failure being replaced.
  Stopping the moment both logs show a resolution also keeps the run short — it
  ends at turn 3 on a fast shuffle and played to turn 7 on a slow one.
- **A RESOLVED spell, not a cast one.** A spell only leaves the stack after its
  costs are paid and, if it targets, after the host accepted its targets — so the
  signal proves the round trip rather than the intent.

The detection reads the LOG THE PLAYER SEES (`[data-log-id]` rows), matching both
`\bcasts?\b` forms because D101 writes the log from the reader's side: the caster
reads "You cast Sol Ring." and everyone else "Apps casts Sol Ring."

⚠️ **The two counts differ by one routinely, and that is the probe, not the
game.** They are sampled over two sequential CDP round trips, so the app read
second has often seen one more resolution. The hash check immediately after
compares both at one point and must be exactly equal. Do not "fix" the asymmetry
by comparing the counts to each other.

⚠️ **Deliberately "a spell", not "a targeted spell".** Whether a Lightning Bolt is
castable depends on the shuffle and the seat's colours, so requiring one would
trade a real assertion for a flaky one. In practice it happens anyway — a run
logged `SpellCast` twice plus a `TargetsChosen`, so the fix above really did
cross the socket between two processes — but the deterministic coverage stays in
`net.test.ts`.

**Measured across four runs plus `--offline`:** 25/25 every time, 12–22 intents,
turn 3 to turn 7, 253 log lines against the 193 the turn-3 loop wrote.

⚠️ **The new test was checked by removing the fix.** `net.test.ts`'s "a scripted
game casts a TARGETED spell and answers the prompt" asserts a Lightning Bolt both
CASTS and RESOLVES — a spell cannot reach the stack unless the host accepted its
targets, so it proves the round trip rather than tolerating it. With the
`chooseTargets` case deleted it fails `expected 0 to be greater than 0`, which
also confirms the pass comes from the case and not from the cast filter quietly
skipping every targeted spell.

## D103 — The installer's filename is pinned, because the update feed hard-codes it

`electron-builder` was left to name the installer, so it produced
`Commander's Roundtable Setup 0.2.0.exe` from `productName` — while the
`latest.yml` it generated alongside pointed at
`commanders-roundtable-setup-0.2.0.exe`. electron-updater URL-sanitises the name
it writes into the feed (lowercase, hyphens, no apostrophe); the artifact keeps
the pretty one. Two names for one file.

That is invisible until the first auto-update. GitHub then applies a THIRD
transformation — an uploaded asset's spaces become dots — so the release would
have carried `Commander's.Roundtable.Setup.0.2.0.exe` while every installed copy
asked the feed for `commanders-roundtable-setup-0.2.0.exe` and got a 404. The
app would report "no update available" forever, which is indistinguishable from
being up to date.

`build.artifactName` is now `${name}-setup-${version}.${ext}`, which is already
the sanitised form, so the built file, the feed and the uploaded asset are one
string that survives all three transformations.

⚠️ **`package.json` cannot carry the explanation.** electron-builder validates
its `build` block against a schema that rejects unknown keys, so a `_note`
sibling to `artifactName` is not a comment — it is a hard build failure:
`configuration.-artifactNameNote is an invalid additional property`. That is why
this reasoning lives here instead.

⚠️ **`latest.yml` and the `.blockmap` are release ASSETS, not build leftovers.**
The updater reads `latest.yml` to learn what the newest version is, and the
blockmap is what makes an update a differential download rather than another
103 MB. A release with only the `.exe` attached looks complete and silently
disables auto-update.

**Verified: 36/36 bundle audit**, including the check that the feed owner is a
real account — which had been pointing at `meesamooman`, a GitHub account that
returns 404.

## D104 — "TURN 0", and the tapped board the layout sweep never measured

Two things found by playing a 35-turn game by hand rather than by running the
suites.

### The bar claimed a step that nobody was in

Before the first `TurnBegan` the phase bar read **TURN 0** and lit **UNTAP**,
while all four players were still keeping or mulliganing. The step it marked was
not a fact about the game — `view.turn.phase` has a default and the engine had
not set one yet — so the track was confidently pointing at a step nobody was in.

It now reads `MULLIGANS · BEN GOES FIRST`, and **no step or group is marked at
all**: both markers are unmounted and every label sits at `text-crt-faint`. A
track that marks nothing is honest; a track that marks the wrong thing teaches
the player something false about a game they are still learning.

⚠️ `turn.turnNumber < 1` is the signal, and it is safe precisely because
`emptyView()` starts at **1** — the fixture path can never render as pre-game,
so the M2 scenarios are untouched.

### The layout sweep had only ever measured untapped boards

`battery-anim.cjs`'s table section builds boards up to 21 permanents a seat and
asserts nothing overlaps and no band scrolls. Every one of those boards is
**entirely untapped**, which is the one state a real game is never in.

A tapped permanent's slot reserves the landscape footprint (D75) — measured 127 px
against 91 px — so the packing is genuinely different once cards have been tapped
for mana or sent to attack. Measured at 4 seats, 12 per seat: **0 bands scrolling
untapped, against 2 bands and 52 px of overflow** with two thirds of the
opponents' boards turned. The new block covers that.

⚠️ **It taps the OPPONENTS.** My own band is the full table width — 1514 px
against an opponent box's 421 px — and no realistic board exhausts it. A case
that tapped my own board would have passed while proving nothing, which is what
the first draft of this block did.

⚠️ **The overflow is REPORTED, not asserted at zero.** Horizontal scroll is rung
4 of the packing ladder and the deliberate answer to a board that cannot fit, so
"no band scrolls" is not a bar a played board has to clear. What is asserted is
what must hold in every tap state: **nothing overlaps**, and **nothing sits past
the scroll extent** — a card the player can neither see nor scroll to is lost,
which is the failure scrolling exists to prevent.

### ⚠️ The trap that produced two false results in a row

Trap 6 says to sample geometry only once the layout has settled.
`waitForStableLayout` watches the metrics EPOCH, which settles as soon as the
solve is done — but a tap is a CSS transition on the turn element (D76), so slot
footprints keep moving after the epoch stops. Measuring in that window did not
produce noise, it produced **confident wrong answers, twice**:

1. Three overlaps reported in `p2:support` — the same slots measure 8 px apart
   once settled.
2. Tapping reported as REMOVING a 30 px overflow, i.e. the exact opposite of the
   52 px it actually adds. That reading was believed long enough to be written
   into a comment as fact before a hand measurement contradicted it.

`waitForTurnsSettled()` polls the turned-count and every slot's
`offsetLeft`/`offsetWidth` until both stop changing. **Any assertion about
footprints has to wait for the transition, not the solve.**

**Verified: 258/259 animation battery** (up from 253/254; five new checks) ·
869 Vitest · the one failure is still the perf gate's long-frame count
(D29/D29a).

## D105 — A played board fits: the shrink rung was dead in the case it exists for

A 4-seat board with two thirds of the opponents' permanents tapped put **two
bands into horizontal scroll, 52 px over**. The same board untapped fits with
room to spare.

### It was not a packing bug

Measured on the worst band: five slots — two upright at 69 px and three turned at
96 px — is **426 px of card in a 421 px band**. The gaps came to 52 px. So the
row did not fit *at any gap*, and the packer had already shrunk cards from 100 px
to 96 px and stopped. It was behaving correctly.

It stopped at 96 because `MIN_BAND_CARD_H` is 96 **and
`CARD_MODE_MIN_HEIGHT.chit` was also 96**. The table solves every band card down
to the first number; the packer may not squeeze below it; and one pixel below the
second a card stops being a card and becomes a `pile`. Two constants set to the
same value left rung 3 — uniform shrink — with **exactly zero room, in precisely
the situation it exists to handle**.

### What gives, and what does not

The trade was put to the user with the arithmetic. Chosen: spend a little card
size, never a render mode.

1. **`CARD_MODE_MIN_HEIGHT.chit` 96 → 88.** Headroom, so a squeezed card is still
   drawn with its name, cost and P/T. Nothing renders at 88–95 px unless a row is
   genuinely over-full.
2. **`SQUEEZE_FLOOR_H = 88`** in `metrics.ts`, passed to the packer instead of
   `MIN_BAND_CARD_H`. ⚠️ `PlayerPod` still sizes the BAND from `minCardH` (96) —
   only the packer's floor moved. They are different questions: what every card
   is guaranteed, versus how far ONE over-full row may go before it scrolls.
3. **A new rung 3: spend the whitespace first.** Row gap 8 → 4 and cluster gap
   20 → 8, stepped down only as far as the row actually needs. Whitespace is the
   cheapest thing in a row; card size is not.
4. **`SCROLL_SLACK_PX = 2`.** Card heights round to whole pixels and the width is
   derived from the height, so the squeeze lands within a pixel of the target
   rather than on it — and a **1 px** residual was enough to set
   `overflow-x: auto` and put a real scrollbar under a row whose cards are all
   fully visible. The pod already leaves 8 px between a band and the pile block,
   which absorbs it. The per-card `overflow` count keeps its own tighter
   threshold: this decides whether a row gets a scrollbar, never whether a card
   is reported as past the edge.

**Result, measured on the same board: 2 bands and 52 px over → 0 bands, 0 px.**
Squeezed cards land at 92 px. Band render modes: **24 chit, 7 full, and zero
`pile`** — the 8 pile-mode cards on screen are the library/graveyard/exile piles
at 62–79 px, which is what they have always been.

### ⚠️ Two checks changed, and neither was bent to make the build green

**`packRow.test.ts`** asserted that five turned cards MUST scroll. They no longer
do: at the 0.83 floor they are 480 px of card, and the row's four 8 px gaps took
it to 512 in a 510 px row — two pixels. Rung 3 brings the gaps to 4 px and the
row to 496, at the same card size it was going to scroll at. The test now asserts
the fit, the tightened pitch, that the squeeze stayed above the chit cliff, and
that SIX turned cards still scroll — rung 5 has to keep existing.

**`battery-anim.cjs`** measured auto-stacking's value as "fewer bands overflow".
Rung 3 absorbs small overflows entirely, so both sides landed on the same band
count while the real pressure differed by an order of magnitude. It now measures
**pixels**: 2,146 px of overflow unstacked against 202 px stacked. A more
sensitive measure of the same claim, not a weaker one.

### ⚠️ The perf gate got worse, and it was NOT this

The gate degraded during this session — 12–18 long frames against the documented
3–9, and p99 up from 25 ms to 41 ms. `git stash` made that answerable instead of
arguable. Same protocol, back to back:

| | with the change | stashed |
|---|---|---|
| p50 / p95 / p99 | 8.3 / 16.7 / 41.6 ms | 8.3 / 16.7 / 41.7 ms |
| long frames | 18 | 17 |
| over 33 ms | 11 | 12 |

Identical, and marginally worse without it. Machine state after a session of
builds, installs and battery runs — and `perf` run ALONE is the worse protocol
anyway (D29a). The signature to read: **p50 and p95 unmoved with only the tail
degraded is interference; a real render regression moves the median too.**

**Verified: 869 Vitest · 17/17 table section · 257/259 full battery** (both
failures the D29/D29a perf gate).

## D106 — How to tell the perf gate's noise from a regression

D29a established that the long-frame count is noisy and that the honest range is
3–9. It did not say how to tell that noise from a real regression, and a session
spent most of a day not knowing.

Measured today, same machine, same scene, same commit:

| | a game running | machine quiet |
|---|---|---|
| p50 | 8.3 ms | 8.3 ms |
| p95 | 8.50 ms | 8.50 ms |
| frames > 20 ms | 19 | **7** |
| frames > 33 ms | 13 | **0** |
| p99 | 50.1 ms | **24.9 ms** |

The game was Overwatch, at 10.3 GB resident with the CPU at 79%. Closing it and
changing nothing else moved the gate from two failures to its single documented
one — and `<= 2 frames over 33 ms` went from failing at 13 to passing at 0.

⚠️ **THE SIGNATURE. p50 and p95 unmoved while only the tail degrades is
EXTERNAL LOAD. A real render regression moves the median too** — it has to,
because the gate's scene does the same work every frame. p95 sat at exactly
8.50 ms through every run today, including the worst ones, which was the tell
from the beginning.

Before suspecting the code, spend ten seconds on:

```powershell
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, WorkingSet64
(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
```

⚠️ And when the answer is genuinely not obvious, `git stash` settles it in two
runs rather than by argument: measure the working tree, stash, measure again,
pop. Done today over a layout change (D105) — 18 long frames with it against 17
without, p50/p95/p99 identical — which ruled the change out before the real
cause was found.

⚠️ A reboot is the wrong instrument. RAM was 91.5 GB free of 128 GB and uptime
14.6 hours; there was nothing to clear. The cost would have been a running game,
109 browser tabs and an open editor, for a number that a single `taskkill` fixed.

## D107 — A planeswalker died the moment it landed, because nothing ever wrote a loyalty counter

`sba.ts` has checked "planeswalker at 0 loyalty" and "battle at 0 defense" since
M3. It reads `card.counters['loyalty']` and `card.counters['defense']` — and
across the whole engine, **nothing had ever written either one**. A repo-wide
grep for `'loyalty'` found the read in `sba.ts` and `loyalty: face.baseLoyalty`
in `derive.ts`, which is a derived characteristic, not a counter. So every
planeswalker that reached the battlefield reached it with an empty counter map,
`0 <= 0` held on the same pump, and it was in the graveyard before it could be
looked at. Battles were identical.

**A planeswalker enters with loyalty counters equal to its PRINTED loyalty
(CR 306.5b), a battle with defense counters equal to its printed defense
(CR 310.6), and "enters with counters" is a REPLACEMENT EFFECT (CR 614.1c).**
That last clause decided where the fix goes.

### It belongs in the funnel, not at the entry sites

Ten places emit a `CardsMoved` onto the battlefield: a cast resolving, a land
drop, `effects.ts`, the loop, four Tier-3 manual tools. Adding counters at each
of them is precisely the "some candidates twice, others never" failure
`applyReplacements` exists to prevent, and it is not hypothetical — the rule had
already been forgotten at all ten. `withEntryCounters` runs once, on the funnel's
output, immediately after the commander-zone rule and reading ITS rewritten
moves rather than the original event.

### It has to be an EVENT

The obvious-looking home is the reducer's `CardsMoved` case, and it is the wrong
one: `apply` is pure in (state, event) alone and cannot look a printing up.
Counters are part of `GameState` and therefore of the state hash, so a reducer
that reached for the oracle would be a live/replay divergence surfacing 200
events later with no visible cause. The rule emits a `CountersChanged` — the
event that already exists, with the reducer case that already works — appended
after the move it belongs to. Invariant 5 holds with nothing new added to it.

⚠️ **The PRINTED value, off the oracle face, not `derive()`'s.** CR says printed,
and the pre-move state would answer the wrong question anyway: `layerOne` only
treats a face-down permanent as a typeless 2/2 once its zone IS the battlefield,
so deriving in the funnel would hand a face-down planeswalker its loyalty.
`move.faceDown` is checked directly instead.

⚠️ **Face 0 is always right**, because `clearBattlefieldFields` resets
`faceIndex` on every entry — a card cannot arrive showing its back. The delta is
exact for the same reason: that function also empties `counters`, so a
planeswalker's second trip to the battlefield gives 3 again and not 6.

### Measured over the whole database, so the boundary is stated rather than guessed

| | count |
|---|---|
| Commander-legal planeswalkers (front face) | **289** |
| …with a numeric printed loyalty | **288** |
| Commander-legal battles | **36** |
| …with a numeric printed defense | **36** |
| Printed loyalty on a non-planeswalker face | **0** |
| Printed defense on a non-battle face | **0** |
| Planeswalker or battle TOKENS | **0** |

`Nissa, Steward of Elements` is the single exception, printing `X`, and it gets
nothing — the same honest answer `derive()` already gives a `*`-power creature
(it is visibly wrong on the board and a Tier-3 override fixes it) rather than a
number nobody can trace. Zero tokens is why `TokenCreated` needs no branch. And
because a printed loyalty appears on no non-planeswalker face anywhere, the type
check in the rule never disagrees with the number — it is there so this rule and
SBA 4 answer "is this a planeswalker" the same way rather than two ways.

⚠️ **Not handled: a permanent that TRANSFORMS into a planeswalker.** 14
Commander-legal cards (`Jace, Vryn's Prodigy`, `Nissa, Vastwood Seer`, …), all
reached through the Tier-3 Transform button, all needing set-to-N semantics this
delta-based event does not have — flipping back and forth would stack loyalty.
They still land on an empty counter map and die, exactly as every planeswalker
used to. **→ Done in D108**, which is where the set-to-N reasoning ended up; the
paragraph above is left as written because the boundary it drew is why D108 is a
second rule rather than a flag on this one.

### The corner box was showing the printed number

`Card.tsx` drew `face.loyalty ?? face.defense` — the printed string — under a
comment promising "the CURRENT one (counters, continuous effects) not the
printed one". Harmless while no loyalty counter existed; the moment the engine
started counting one down it meant a planeswalker read **3** for the rest of its
life while the SBA was two clicks from binning it. `Card` now takes `loyalty` and
`defense` as numbers (not the counters record — it is memoised and exists ~50
times on a board), and the corner turns `accent-hi` when the current value
differs from printed, the same reading P/T already gets. This is invariant 10:
a losing condition the engine enforces has to be visible before it fires.

### And there was no way to spend loyalty at all

`tier3.ts` has said "Its loyalty abilities — use the counters tool and apply the
effect yourself" since M5, and it was right that a loyalty ability is Tier 3 (no
colon, so `activatedParse` never reads one). But the card menu's only counter
control was `+1/+1…`. The tool it named did not exist for the counter it named.
The menu now carries a `Loyalty N…`/`Defense N…` button, keyed off the counter
actually being present so it never appears on a creature.

### ⚠️ The fuzz gate could not reach any of this, and stayed green for it

`fuzz.node.test.ts`'s `DECK` had no planeswalker and no battle, so 500 seeds ×
200 intents ran both SBAs against an empty counter map every single time. This
is the third instance in this repo of the same thing — the net fixture pool was
forty lands, then had no targeted spell (D102) — so the deck gains Grist and
`Invasion of Ikoria`, and the gate gains an **entry-counter canary** beside the
targeting ones. A hash equality is only evidence about a rule the run actually
exercised.

**Verified: 879 Vitest** (10 new in `sba.test.ts`, **5 of which fail with the
fix reverted**) **· the 500-seed fuzz gate green at 98,969 accepted intents /
1,148,707 events / 9,230 turns, with 228 permanents entering with counters ·
258/259 animation battery · `npm run build` clean.** The one battery failure is
still the perf gate's long-frame count (D29/D29a): 8 long frames, 1 over 33 ms,
**p50 8.3 ms and p95 8.50 ms — byte-identical to a passing run**, which is
D106's interference signature and not a render regression.

**Played it.** A real 2-seat solo game from a real imported deck: Grist entered
the battlefield with `{loyalty: 3}` and stayed there, the corner read `3`, the
card menu offered `Loyalty 3…`, removing 2 left it alive at `1` in accent-hi
with "You remove 2 loyalty counters from Grist, the Hunger Tide." in the log,
and removing the last one produced "Grist, the Hunger Tide dies."

## D108 — And a permanent that TRANSFORMS into a planeswalker

D107 gave a planeswalker its loyalty on the way IN, and said in as many words
what it was not doing. This is that: **14 Commander-legal cards** whose front
face is not a planeswalker and whose back face is — `Jace, Vryn's Prodigy`,
`Nissa, Vastwood Seer`, `Kytheon, Hero of Akros`, `Valki, God of Lies`, … — all
reached through the Tier-3 Transform button, all landing on an empty counter map,
all binned by SBA 4 on the same pump. D107's bug, one step along, and the same
symptom: the card was in the graveyard before anyone could look at it.

### The same rule, so the same funnel

`withTransformCounters` sits beside `withEntryCounters` in `applyReplacements`
and answers the same CR clause from the other side. The funnel is the one place
that sees every event with the oracle in hand, which is what both halves need;
and `FaceIndexSet` is emitted by exactly one intent, so unlike the ten entry
sites there was never a temptation to write it at the call site.

⚠️ It reads `state.cards[…].faceIndex` for the OLD face and `ev.faceIndex` for
the new one. The funnel runs on the state BEFORE its event is applied — which is
what makes a transition readable here at all, and is the same property D107 leans
on to know a card's pre-move zone.

### ⚠️ SET TO N, NOT ADD N — the whole reason it is a separate rule

`CountersChanged` is a DELTA and the Transform button TOGGLES. `+5` on every flip
leaves a flipped-away-and-back Jace on 10, and on 15 after another round trip.
The delta is computed against what the card is carrying at that instant
(`printed − current`), so the planeswalker face always lands on exactly its
printed number however it got there. An ENTRY can assume the current value is 0,
because `clearBattlefieldFields` empties `counters`; a transform can assume
nothing, and that difference is not expressible as a flag on the entry rule.

### ⚠️ The trigger is the TRANSITION, not the destination

"Becomes a planeswalker" is a change of state, so a permanent that was already
one and still is gets nothing. Two Commander-legal cards are planeswalkers on
BOTH faces — `Arlinn Kord // Arlinn, Embraced by the Moon` and `Garruk Relentless
// Garruk, the Veil-Cursed` — and without this check, flipping Arlinn to her back
face and back would refill her from 1 to 3. Free loyalty, on the wrong side of
the rules, from a button whose whole job is to be honest.

CR 701.28 turns the card over and does nothing to what is sitting on it: a
permanent keeps its counters across a transform. That is also why a flipped-back
Jace still shows the 3 he had spent down to, inert on a creature face.

⚠️ And those same two cards are the only planeswalker faces in the database with
**no printed loyalty at all**, so a `null` has to mean "add nothing" rather than
0 — a delta computed against 0 would strip the counters they are carrying.
Either guard alone would cover both cards today; both are here because they
answer different questions and the next set can print one that needs only one.

### Measured, so the boundary is stated rather than guessed

| | count |
|---|---|
| Commander-legal, front face not a planeswalker, back face one | **14** |
| …with a numeric printed loyalty on the back face | **14** (2–7) |
| …`transform` / `modal_dfc` | 12 / 2 |
| …whose front face is a Battle | 1 (`Invasion of New Phyrexia`) |
| Cards with a non-Battle front face and a Battle back face | **0** |
| Planeswalker faces DB-wide with no printed loyalty | **2** (Arlinn, Garruk) |

⚠️ **No defense branch, and the zero is the reason.** A Siege transforms INTO
something else, never into a battle, so "becomes a battle" is reachable only by
driving a Siege backwards with the Tier-3 button — where leaving its counters
alone is both what CR 701.28 says and the un-surprising answer. Same shape as
D107's reason for giving `TokenCreated` no branch: zero cards, zero code.

⚠️ All 14 arrive on face 0 and are flipped by hand, including `Nicol Bolas, the
Ravager`, whose own ability returns it to the battlefield transformed —
`clearBattlefieldFields` resets `faceIndex` on entry, so nothing can arrive
already showing its back. The two `modal_dfc` cards are not transforming cards in
real Magic at all; in this app the Transform button is how their back face is
reached, because `ManualFlipFace` keys off `faces.length >= 2` and not on layout.

### Where it diverges from CR, deliberately

Read literally, a permanent that becomes a planeswalker a SECOND time *gets*
printed-loyalty more counters on top of whatever it kept. Set-to-N gives it
exactly the printed number instead. **None of the 14 can transform back in real
Magic** — every one is a one-way transform — so the divergence is only reachable
by driving a one-way transform backwards with a manual tool, and the alternative
is a Jace sitting on 10.

### ⚠️ The fuzz gate could not turn a card over at all

D107 added an entry-counter canary and recorded why. The same hole was one layer
down: `manualIntentFor` had **no `ManualFlipFace` case**, so no seed could flip
anything however many faces it had, and `DECK` had no card with a second face
worth turning. Both are fixed, and the canary is `> 0` for the same reason
D107's is — it asserts the path is reachable, not a rate.

⚠️ **The flip is AIMED at a two-faced permanent, not drawn from `anyCard` like
its siblings.** Picked at random it would land on the one card that matters a
handful of times in 100,000 intents, and a canary that fires by luck is the rot
it exists to catch with an extra step.

⚠️ **And a manual case must never return `null`.** `runOne` reads a null intent
as "this game has nothing left to do" and BREAKS out of the seed. Aiming the flip
made "nothing to flip" the common case, and the first cut cost **37% of the
gate's accepted intents (11,883 → 7,434 at 60 seeds) and a third of its turns** —
which reads as a slower engine, not as a fuzzer that quietly stopped playing. It
falls back to the dice, the one sibling that needs nothing from the board.
⚠️ Cases 1, 3 and 7 have the same latent shape; they are left alone because
`anyCard` is undefined only when a player's hand AND the whole battlefield are
empty, which after mulligans essentially never happens.

⚠️ **D107's entry counter had to be narrowed on the way past.** Its comment said
"only the ENTRY rule writes these two kinds", and that stopped being true the
moment this rule shipped. They are told apart by the event they were appended to:
a loyalty change immediately after a `FaceIndexSet` came from here, anything else
from an entry. The entry side cannot use the same adjacency in reverse —
`commanderZoneReplacement` can push an `AwaitingSet` between a `CardsMoved` and
its counters.

### One thing the brief for this work had wrong

It recorded that "two of the 14 back faces have no printed loyalty", naming
Arlinn's and Garruk's. Measured: **all 14 print a numeric loyalty**, and Arlinn
and Garruk are back faces of cards whose FRONT is already a planeswalker, so
neither is one of the 14 at all. The correction matters because it moves those
two cards from "the null case inside the scope" to "the both-faces case just
outside it" — which is what made the transition guard necessary rather than
merely tidy.

### Nothing in `src/ui/` changed

D107 already made the corner box read the counter rather than the printed number
and gave the card menu a `Loyalty N…` button keyed off the counter being present.
`PermanentStack` passes `card.counters['loyalty']` straight through, so a
transformed planeswalker gets both for free. D107's note that "a planeswalker on
the battlefield always has at least one loyalty counter, because SBA 4 bins it
the instant it does not" is more true after this, not less.

**Verified: 888 Vitest** (9 new in `sba.test.ts`) **· the 500-seed fuzz gate
green at 98,694 accepted intents / 1,138,047 events / 9,118 turns, with 185
permanents entering with counters and 50 transforming into a planeswalker ·
258/259 animation battery · `npm run build` clean.** The one battery failure is
still the perf gate's long-frame count (D29/D29a): 9 long frames, 2 over 33 ms,
**p50 8.3 ms and p95 8.50 ms — byte-identical to a passing run**, which is
D106's interference signature and not a render regression, on a path this
engine-only change does not touch. 0 stray rect reads.
Every guard was checked by DELETING it: reverting the
rule fails 4 of the 9, removing the transition guard fails Arlinn alone, removing
the zone guard fails the in-a-hand case alone, and removing the face-down guard
fails the face-down case alone. The transform canary reports 0 with the rule
reverted.

**Played it.** A real 2-seat solo game from a real saved deck (Jace as the
commander, 99 Islands): cast from the command zone for `{1}{U}`, resolved as a
creature with no counters, and the card menu offered `Transform` and no loyalty
control. One click and he was `Jace, Telepath Unbound`, still on the battlefield,
`{loyalty: 5}`, the corner reading **5**, the menu now offering `Loyalty 5…`.
Removing 2 left him at 3; flipping back to the creature kept the 3 sitting there
inert; flipping forward again gave **5, not 8**. Removing all 5 produced
"Jace, Telepath Unbound dies." and a card in the graveyard.

## D109 — Tap by pointing at a card and pressing E

Turning a permanent is the thing a Commander player does most often, and until
now it cost a right-click, a menu, and a button. `E` over the card does it
instead, and does it in both directions: a tapped card straightens.

⚠️ **It is the SAME Tier-3 tool, not a new one.** The key sends the very
`ManualSetTapped` the card menu's Tap/Untap button has always sent, so the
wrench in the log, the second-person narration and the "anyone's permanent"
scope are inherited rather than re-decided. A shortcut that reached a different
code path would be a second answer to "what does tapping mean", which is the
mistake `onCardDrop` exists not to make (D73).

⚠️ **Any permanent on the battlefield, mine or not** — the menu's rule, and it is
the right one: a large share of the format says "tap target creature", and a
manual tool that could only touch my own board would send the player back to the
menu for the other half of the cases. The log says who did it and marks it manual.

### ⚠️ A delegated `pointerover`, NOT `elementFromPoint`

`AimVeil` records why it refuses `elementFromPoint` for its own hit test, and two
of its three reasons apply here unchanged: it forces a hit test against current
layout, flushing style and layout if anything is dirty; and it is an UNMEASURED
escape hatch, because `perf.ts` patches `getBoundingClientRect` alone — an
`elementFromPoint` habit would do the same damage while keeping the meter at zero.
One bubbled event and a `closest()` call read no geometry at all.

Leaving a card needs no handler of its own: `pointerover` fires on whatever is
entered NEXT, including the table behind the card, so `closest` returning null is
what clears the hover. The only extra listener is `blur`, for the pointer leaving
the window without entering anything.

⚠️ **The hover is MODULE STATE, not a store.** It is read exactly once per
keypress and drives nothing that renders. In a store it would commit the whole
table on every pointer crossing, and `Card` is the leaf that exists 50 times whose
memo is worth a measured 50–58 ms per commit (D21). Nothing highlights on hover
for the same reason; the card turning is the feedback.

### Three guards, and what each is really for

1. **`e` is a CHARACTER.** It is legal in every text field in the app and inside a
   number input as well (`1e5`), so the handler ignores the key while an
   `INPUT`/`TEXTAREA`/`SELECT` or a contenteditable has focus. Without it the
   shortcut eats keystrokes out of the deck-import box and the Tier-3 number
   dialogs.
2. **Idle mode only.** Mid-aim, mid-payment or mid-declaration the table is asking
   a question and a stray letter must not quietly answer a different one — the
   taps a payment review is proposing are exactly the ones this would fight over.
   The veil covers the cards during targeting anyway, so the hover is null there;
   this is the guard for the modes that have no veil.
3. **Battlefield only — and it guards the LOG, not the state.** `reducer.ts`
   already ignores a tap on a card outside the battlefield (CR 110.5b, added when
   the fuzzer pointed the permissive Tier-3 tool at a hand), so without this guard
   a hand card still would not turn. What it would do is append "You tap Island."
   as a manual line about something that did not happen — and a log a pod uses to
   tell the automated from the hand-waved cannot carry entries for actions the
   engine discarded.

⚠️ **That third one is also a lesson about the CHECK.** The first version of its
battery check asserted the hand card was still untapped — and it **passed with the
guard deleted**, because the reducer was doing the work. It asserts on the event
count now: 99 → 99 with the guard, 99 → **102** without it. A guard's check that
cannot fail when the guard is removed is not a check.

### Verified

**43/43 in `battery-anim.cjs engine`** (6 new), driving the real path: the hover
goes through `engine.tap.hover` — the same writer the real `pointerover` listener
calls, for the reason the aim handles give — and the KEYPRESS is a real dispatched
`KeyboardEvent`, which is the one interaction a probe can safely dispatch for real
(no synthetic-pointer interleaving). Hover is re-read immediately before each
press, so a real mouse resting over the window can change WHICH card the check is
about but cannot make it lie about the one it names.

Both behavioural guards were checked by DELETING them: exactly their own two
checks fail, and nothing else moves. `npm run build` clean.

## D110 — A land that can make two colours asks which

Clicking a mana source submitted `outputChoice: 0` of the first unconditional
ability it found, and a comment said the card menu offered the rest. **The card
menu had no mana controls at all.** So for four milestones a Tundra made white
and only white, an Arcane Signet made the first colour of its controller's
identity and only that, and Cavern of Souls — every ability conditional — could
not be clicked at all. CR 106.1 makes the choice the player's; the app was making
it for them, and hiding that it had.

Now: **one option taps, more than one asks.** A small panel opens beside the card
with one button per thing it can add, drawn in mana-font glyphs.

### The legal action had to stop reporting a COUNT

`LegalAction.TapForMana` carried `outputs: number`, which is the one thing a
chooser cannot draw — "this land has 2 outputs" is not a button. It carries
`outputs: readonly string[]` now: `['{G}']`, `['{C}{C}']`,
`['{W}','{U}','{B}','{R}','{G}']`, indexed so the position IS the `outputChoice`
the intent names.

⚠️ **Strings, not pools.** `costStringOf` writes WUBRG-then-C, and the answer
travels: into every `TapForMana` action, over the wire to every guest, and
straight into `<ManaCost>`, which reads exactly this shape. Six numeric keys per
output, per source, per frame would be the same fact in a form nothing at either
end wants.

⚠️ **Changing the field's TYPE rather than adding a second one was the point.**
The one consumer of the old count — the fuzzer's
`p.below(Math.max(1, chosen.outputs))` — became a compile error instead of
silently reading `NaN`.

### ⚠️ The count is per ABILITY; the question is per CARD

A dual land is **two abilities of one output each**; an any-colour land is **one
ability of five**. Both are "this land can bring more than one thing" to a
player, and neither action alone says so — reading one action's output count
answers a question nobody asked. `manaOptionsFor` flattens every `TapForMana`
for a card and is where the whole feature actually lives.

### ⚠️ Restricted mana is OFFERED, marked, not hidden

A conditional ability is one whose mana the engine cannot promise is spendable
("Spend this mana only to cast a creature spell"), so the SOLVER may not choose
it — but the player may. Cavern of Souls settles it: one unconditional `{C}` and
five restricted colours. Offering only the unconditional half would leave every
colour the card exists for unreachable, which is exactly what shipped.

The first cut had unconditional options HIDE conditional ones, to avoid two
buttons reading `{C}` above `{C}` and behaving differently. That solved the
ambiguity by deleting Cavern. The rule now is: offer everything, dedupe by what
it ADDS with the unconditional one winning the slot, and mark the restricted ones
with a **dashed edge** — by shape, never colour, because the five colours are
inside these buttons and a coloured border would read as a sixth pip.

### Where it lives

`manaOptionsFor` is pure and sits in its own module with no React, no store and
no session, so it is tested the way `packRow` and `coalesce` are rather than only
through a running app. The panel holds the CARD and where to draw, never the
options — those are re-read from `legal` every render, because a source that gets
tapped, bounced or killed while the panel is open must stop offering what it can
no longer make. The anchor comes from `rectRegistry`, the only legal caller of
`getBoundingClientRect`: a click gives no coordinates here, since `PermanentStack`
forwards an instance id and nothing else, and threading pointer coords through it
would put a layout concern into the M2 table.

### Verified

**899 Vitest** (11 new: 9 in `ui/game/manaOptions.test.ts`, 2 in
`engine/mana.test.ts` pinning Forest `['{G}']`, Sol Ring `['{C}{C}']`, Tundra
`{W}`/`{U}` across two abilities, and Command Tower's three colours under a Kess
identity) **· 51/51 `battery-anim.cjs engine`** (8 new) **· 271/273 full battery ·
the 500-seed replay fuzz gate green · 124/124 probe · `npm run build` clean.**
The two battery failures are the perf gate's frame counts (D29/D29a), with p50
8.3 ms and p95 8.50 ms byte-identical to a passing run — D106's interference
signature, on a fixture-driven scene that never opens this panel.

⚠️ **The battery check gets its OWN game, and runs last.** It has to reach a seat
whose identity has more than one colour — the section's viewer is the mono-red
starter seat, which has nothing to choose between — and getting there means
passing priority and drawing. Doing that in the middle of the shared game moved
the board far enough that the convergence check reported a permanent missing from
the DOM: two Mountains had auto-stacked into one slot. A check that needs a
different game should start one.

⚠️ Two smaller traps on the way. The probe's `state()` handle projected
`TapForMana` down to four fields and dropped `outputs`, which reported
`outputs is not iterable` — a handle showing less than the app has, reading as an
engine bug. And **`\b` inside a Node template literal is a BACKSPACE**, not a
word boundary, so a type-line regex written `/\b(Land|Artifact)\b/` in injected
code silently matches nothing; the battery escapes it `\b`.

## D111 — Shift-click to tap several lands at once

D110 made a land that can bring two things ask which. This makes that panel take
a BATCH: shift-click every source you want, answer each one, tap them all at
once. A plain click is untouched — one land still taps, and a single land with a
real choice still commits on the pick rather than growing a confirm step.

### ⚠️ One source and many are the SAME panel

`manaChoice.cards` is a list even when a plain click put one card in it. "Which
mana does this bring" and "which mana do these five bring" are the same question
at different lengths, and a second panel for the batch is how two answers to
"what does tapping mean" get built — the very split D110 was written to close.

The single-card fast path is a branch inside the panel, not a second panel:
with one row, picking a mana submits immediately; with more, picking records the
answer and the footer button commits. A land that used to take two clicks still
takes two.

### ⚠️ NOTHING taps until the batch is committed

A land tapped while the player is still choosing is a decision made for them, and
worse, it changes the board under the panel: the row re-packs, the pile splits,
and the rings move while you are pointing at them. The battery asserts zero taps
both while the batch is being built and after every source has been answered.

Committing sends **one `TapForMana` per source**, in the order they were picked
up. The engine has no "tap these five" intent and should not grow one: each tap
is its own rules action, its own event on the log, and any one of them may be
refused without taking the others down with it.

### ⚠️ The modifier is THREADED, not sniffed

`Card.onClick` and `PermanentStack.onClick` now hand over the event. That keeps
the M2 seam exactly where it was — "there was a click, and here is what the
browser said about it" is input, not meaning, the same seam `onPointerDown`
already keeps — and it is the alternative to reading `shiftKey` off a global
window listener, which is how one click ends up meaning different things in two
places. The parameter is OPTIONAL at every level so the many
`onClick={() => f(id)}` handlers in the hand, the command zone and the fixture
table stay valid; TypeScript checked that, and the two call sites that needed
widening said so.

### ⚠️ The rings are the feedback

Without them a shift-click that landed and one that missed look identical: the
panel gains a row either way, but a row is a name in a list, not the card you are
pointing at. `ManaBatchRings` measures through `readElements` on the same inputs
`AimVeil` re-measures on — the selection, the layout epoch, the view.

⚠️ `highlightedIds()` in `useEngineTable.ts` looked like the place for this and
is **dead code — nothing imports it.** Adding the batch to it would have shipped
a feature that renders nothing.

### ⚠️ And the panel was 49 px low, on every card

Fixed while adding the rings, because a ring drawn from a viewport rect made it
obvious. The anchor is a card's rect — viewport coordinates — while the panel's
positioned ancestor is the screen slot, which starts BELOW the app header. The
panel is `position: fixed` now (nothing between it and the document creates a
containing block; `PlayerPod`'s `contain: layout paint` is not an ancestor of the
overlay), and measures card-top 691 against panel-top 691.

⚠️ `CardMenu` and `AttachmentsPanel` place themselves the same way — from
`clientX`/`clientY` and from a tab's `getBoundingClientRect` — and carried the
same offset. They were left alone in the first cut on the grounds that a menu
near the cursor reads as fine, and **fixed immediately afterwards on request**:
all three are `fixed` now. Measured with the fix reverted, both open **53 px
low** (`653` against a wanted `600`, `726` against `673`); with it, both land
exactly.

⚠️ The clamps that keep a panel on screen are viewport arithmetic too
(`Math.min(y, window.innerHeight - 300)`), so under `absolute` they were being
compared against a container-space number — the offset made them fire early or
late as well as drawing the panel low. That is why the battery check asserts
against the components' OWN arithmetic, clamps included, rather than against the
raw click point: a menu right-clicked near the bottom of the table legitimately
opens above the cursor, and a check that did not know that would fail on correct
behaviour.

### The batch works on RENDERED SLOTS

Twelve identical Forests are one slot (D19), so shift-clicking a pile adds its
representative — one land, not twelve. That is what the player can point at, and
it is what the battery had to be taught: its first cut placed three permanents,
two of which auto-stacked, and reported "a chosen source has no rendered slot"
for a board that was drawn correctly.

### Verified

**907 Vitest** (8 new in `src/store/tableStore.test.ts`, the first suite for that
store — batch add/remove, the panel not moving as it grows, and Escape unwinding
one source at a time) **· 60/60 `battery-anim.cjs engine`** (9 new: 7 for the
batch, driven with a real `MouseEvent` carrying `shiftKey: true` since a plain
`.click()` cannot carry a modifier and the modifier is the whole gesture, plus
one each pinning where the card menu and the attachments panel open) **· 124/124
probe · `npm run build` clean.**

⚠️ **Both anchoring checks were verified by REVERTING the fix**: with
`absolute` back, each fails by 53 px and nothing else moves. Before this there
was no check of any kind on where an anchored panel opens, which is how a 49 px
offset survived four milestones on the most-used menu in the app. Screenshotted live: Arcane Signet + Mountain + Swamp in
one panel, the two basics pre-answered as "only", "1 left" until the Signet is
answered, three rings on the table, and `Tap 3` putting `{U}{R}{B}` in the pool.

## D112 — A pile of lands taps one card at a time

D111 said in as many words what it was not doing: "twelve identical Forests are
one slot, so shift-clicking a pile adds its representative — one land, not
twelve." This is that. A pile now gives up one card per click, in both gestures.

### The two halves, and only one of them was broken

**A plain click already worked** and is unchanged: it taps the representative,
grouping keys on tapped state, so the pile splits into one tapped card and the
rest — and the next click takes the next one. Twelve clicks tap twelve Forests.
The battery pins this now (`0 → 1` tapped, `2 left in the untapped pile`) because
nothing did, and it is the half a future change to `groupIdentical` could quietly
break.

**A shift-click could not get past one.** `toggleManaChoice` was keyed on the
card the slot names, and a slot names its representative, so every click on the
pile named the same card: the first added it and the second took it straight
back out. Five clicks could never mean five Forests. With the rule reverted the
battery reports `0 rows over 2 shift-clicks` and `1/3 tapped`.

### ⚠️ The slot is what gets toggled, not the card

`toggleManaChoice(members, x, y)` takes the SLOT'S CARDS and adds the first one
not already in the batch. Once the whole slot is in, the click **clears that
slot** — which for the ordinary one-card slot is exactly the toggle it always
was, and for a pile is the only reading of "I have clicked this as many times as
it has cards" that leaves the player somewhere useful. Escape still drops one at
a time, so the fine-grained undo did not have to change.

### ⚠️ The members are HANDED OVER, never re-derived

`PermanentStack` passes `packed.members` with the click. "Identical" is
`groupIdentical`'s rule — same oracle id, tapped state, counters, sickness, no
attachments — and a second copy of it in `useEngineTable` would eventually
disagree about what one slot contains, which is the second-heuristic failure
`tier3.ts` warns about. The hook then filters those members through `legal`,
never through the view: what the engine will accept is the engine's answer.

### ⚠️ One ring per SLOT, not per card

Members 2..n of a pile have no `data-band-slot` of their own — only the
representative is in the DOM — so a batch holding three Forests from one pile
draws one ring. That is correct: the ring marks the thing you pointed at. The
panel is where the count lives, listing a row per card.

### Verified

**911 Vitest** (4 new in `tableStore.test.ts`: one more per click, clearing at
the end of a pile, only-what-is-offered, and an empty slot doing nothing) **·
65/65 `battery-anim.cjs engine`** (5 new) **· 285/287 full battery · 124/124
probe · `npm run build` clean.** The two battery failures are the perf gate's
frame counts, and the reading is D106's: **p50 8.3 ms and p95 8.50 ms,
byte-identical to every passing run**, with only the tail moving — 10 long frames
in the full run and 16 running the section alone, which is itself the documented
"alone is worse" effect. `LoadPercentage` 13 with Chrome, Spotify, Steam and the
NVIDIA overlay all windowed. The gate's scene is fixture-driven: no engine, no
`onCardClick`, and none of this code mounts in it. The pile rule was checked by REVERTING it, and both of its checks fail
with nothing else moving.

⚠️ **Found by the revert, not by the feature**: making a pile answer a
shift-click by taking one MORE of itself turned the D111 batch check's
remove-then-re-add step into two adds, which emptied the panel under it and
crashed on a null `getAttribute`. The batch block now places basics with DISTINCT
names and requires `data-stack-count === 1`, because it is about batching
SEPARATE sources; the pile has its own block. A check that silently depended on
"no two of these are the same card" is exactly the kind that starts failing for
reasons unrelated to what it tests.

## D113 — Tapping a card for the sake of tapping it

Left-clicking a card did whatever the card could DO — play it, cast it, tap it
for mana, point an Equipment at a host — and there was no way to say "turn it,
and nothing else". Turning a card by hand was reachable only from the E key
(D109) and the right-click menu, so a left click on a creature did **nothing at
all** and read as broken.

Now the panel answers both questions. A source offers `Tap only` beside every
colour it can make; a card with no mana ability opens the same panel with a
single `Tap`.

### ⚠️ It is a different INTENT, so it is a different-looking button

`Tap only` sends `ManualSetTapped` — the Tier-3 tool the menu button and the E
key already send — not a `TapForMana` with an empty output. A mana ability that
produced nothing would be a lie about the rules; turning a card by hand is a
tool, and the log marks it with the wrench.

It is drawn in WORDS rather than a glyph for the same reason the restricted
options are dashed rather than coloured: every glyph in this panel means "this
much mana goes in the pool", and one that meant "no mana" would read as a sixth
pip. mana-font does have a `{T}` glyph; using it here would have been the
prettier wrong answer.

### ⚠️ The mana was the DEFAULT — and that was wrong (superseded, same day)

The first cut kept a fast path: a source with exactly one mana option tapped for
that mana on a plain click, with no panel, on the grounds that tapping a Forest
for green is the most common action in the game and must not grow a click.

**That made `Tap only` unreachable on a basic land**, which is the card it is
wanted on most — the panel is where the button lives, so a source that never
opens the panel never offers it. D117 then took away the last workaround by
making E the click too, leaving the right-click menu as the only way to turn a
Forest without making mana.

Every source asks now, one option or five. It costs one click on a basic land and
buys the thing the panel exists for: the player is never told what they meant.
The panel still commits on the PICK when it holds one card, so it is one extra
click and never two.

Where the panel does open, `Tap only` sits beside the colours and never replaces
them, and a row that has been answered "just turn it" contributes nothing to the
batch's mana total.

### ⚠️ It ASKS; it does not turn

This branch is LAST in the click chain and catches every click that reached the
end of the list, including ones aimed at nothing in particular. A stray click
that silently turned a blocker is a decision made for the player — so the panel
opens and the card turns only when the button is taken. Measured: the click
leaves the event count unmoved.

### ⚠️ Mine, on the battlefield, untapped

`canTapOnly` is the one rule, and each clause earns its place. Not an opponent's:
a left click that turned someone else's permanent would make a misclick look like
a play, and E and the card menu still reach them. Not one already turned: "Tap"
on a tapped card is not a choice, and untapping stays where it is. Not a card in
hand: tapping is battlefield-only (CR 110.5b), which the reducer already enforces
— this stops the panel offering something the engine would discard.

`onBattlefield` moved into `src/view/types.ts` because two callers now ask it
about the same card for different reasons — "may E turn this" and "may the panel
offer to turn this" — and two spellings of one question is how they come to
disagree.

### The batch generalised with it

Shift-click now takes any permanent of mine, not only a mana source: the batch is
"the cards I am tapping" and what each one GIVES is the row's answer. A pile of
three identical creatures batches exactly as a pile of lands does. The tap-only
rows are submitted as ONE `ManualSetTapped` — that intent takes a list and they
are one Tier-3 gesture, so the log reads "You tap 3 permanents." with a single
wrench rather than three identical lines.

### Verified

**916 Vitest** (5 new for `canTapOnly`: mine, already-tapped, an opponent's, one
in hand, one not in the game) **· 71/71 `battery-anim.cjs engine`** (6 new) **·
292/293 full battery · 124/124 probe · `npm run build` clean.** The one battery
failure is the perf gate's long-frame count at 7, inside the documented 3–9
range, with p50 8.3 ms / p95 8.50 ms and its "≤ 2 frames over 33 ms" sub-check
PASSING at 1.

⚠️ **The headline case was a green tick over nothing at first.** "A mana source
offers Tap only beside every colour" reported `skipped — no multi-option source
left untapped`, because every block above it had been tapping things. It places
its own source now. A skip is honest about a fixture and dishonest about a
feature.

## D114 — The library: scry, surveil, mill, exile

Clicking a library did **nothing**. It now opens a menu: `Scry…`, `Surveil…`,
`Mill…`, `Exile…` and `Look…`, each taking a number. Scry and surveil open a
panel showing the cards face up, top first, with one decision per card.

All Tier 3. The engine does not know why you are looking at three cards; it knows
one player revealed the top of their own library to themselves.

### ⚠️ The one ordered thing about a library that reaches a client

`project.ts` has said since M3 that **a library is a count, full stop —
including your own**. That is now "a library is a count, WITH ONE EXCEPTION", and
the exception is written into the file's own header because an invariant that has
quietly stopped holding is worse than one that never did.

`view.peek` gives the viewer the ORDER of the cards at the top of their OWN
library that are already `revealedTo` them. Their contents have been in
`view.cards` since M3 — a peek is a reveal — so the exception is the order alone,
and it exists because **a scry that shows you three cards in a dictionary's order
is not a scry.** Three clauses bound it: own library, revealed to this viewer,
and the run from the top (it stops at the first unrevealed card, so a tutor's
reveal never becomes a phantom "top of your library").

### ⚠️ Scry and surveil are the SAME peek

The difference is what you do next, so the mode lives in the UI store and every
decision goes out as the `ManualMoveCard` the card menu already had —
`placement: 'bottom'` for a scry, the graveyard for a surveil. Teaching the
engine to tell a scry from a surveil would be teaching it a rule it does not
enforce, which is the whole Tier-3 line.

Each decision commits the moment it is taken, and the row vanishes **because the
move clears the reveal** — the reducer has always dropped `revealedTo` on a move,
since keeping it would leak the new zone. So the panel always shows exactly what
is left to decide, and the cards still there when you press Done are the ones
staying on top, in the order they were already in. That is what makes "keep the
order they came in" free rather than a feature.

### Two new intents, and why each had to exist

**`ManualStopPeeking`** — a peek has no natural end. Only moved cards lose their
reveal, so a scry that keeps two on top would leave them revealed for the rest of
the game and the panel would never close. It is *accepted* when nothing is
revealed, because that is the natural end of a scry that moved everything.

**`ManualMoveTopOfLibrary`** — a client cannot name a library card, so "mill
three" is not three `ManualMoveCard`s. Doing it as peek-then-move would work and
would be wrong: it puts "You look at the top 3 cards" in the log before every
mill, which is a different action from the one the player took. It takes a
`target`, so milling an opponent — a real play — comes free; scry and surveil are
offered on your own library only, because you cannot look at someone else's cards
and put them back.

### ⚠️ The leak test was passing because the path was unreachable

`fuzz.node.test.ts` asserts that **no library card appears in any projection**.
That was only true because nothing in the file had ever peeked. Adding the three
intents to `manualIntentFor` would have broken it — correctly — so the assertion
now states the real boundary: a library card may reach a projection for exactly
one reason, that it is revealed to THAT viewer. It also pins the order exception
directly: `peek` must be own-library, revealed, and the top run in order.

⚠️ With a **peek canary** beside the entry and transform ones, for the same
reason they exist: an assertion about a boundary nothing crosses is the
green-over-nothing this file has now been caught by three times (D102, D108).
Measured at 500 seeds: **381 library peeks**.

### Verified

**924 Vitest** (8 new in `manual.test.ts` — top-first projection, peeker-only,
stop, the accepted no-op, bottom-keeps-the-size, mill/exile counts, milling an
opponent, and over-milling) **· 82/82 `battery-anim.cjs engine`** (11 new) **·
303/304 full battery · the 500-seed fuzz gate green at 98,660 accepted intents /
1,139,033 events / 9,148 turns / 381 peeks · 124/124 probe · `npm run build`
clean.** The one battery failure is the perf gate's long-frame count at **4 — the
lowest of the session — with 0 frames over 33 ms**, p50 8.3 / p95 8.50 ms.

⚠️ **The Scry button itself was untested at first.** Every check submitted
`ManualPeekLibrary` directly, which leaves the panel in its default `look` mode —
so scry and surveil, the two things actually asked for, were exercised by
nothing. There is a check now that clicks the real button, types into the real
number dialog, confirms, and reads `data-peek-mode` back off the panel, plus one
asserting a scry offers the bottom and nothing else: "Hand" appearing there would
be a different action wearing scry's name.

## D115 — Looking through a graveyard, and an exile pile

D114 gave the library a menu. This gives the two OPEN piles what they needed
instead, which is not a menu at all.

⚠️ **A pile renders only its TOP card.** A graveyard is public information with
thirty cards in it and one of them on screen — so every card underneath was
literally unreachable: you could not return the fifth card to your hand,
reanimate the tenth, or read what was in there. The count badge said how many;
nothing said which. Measured in the battery: **1 card drawn on the table, 8 of 8
in the browser.**

Clicking a graveyard or an exile pile now opens a browser listing the whole pile
face up, each card with its destinations — Hand, Battlefield, Library top or
bottom, Exile, Command — plus two whole-pile actions.

### ⚠️ A closed pile and an open one get different answers

That is the whole distinction between this and D114. A library **cannot** be
browsed: its order is the one thing projection strips, and the exception D114
carved is bounded to cards already revealed to the viewer. So a library gets a
menu of actions taking a number, and an open pile gets the cards themselves.
`onZoneClick` reports which pile was clicked and the hook decides; the table
components still know nothing about either.

### ⚠️ Any player's, and always to the OWNER's zone

A graveyard is public and reaching into an opponent's is a real play — their
creature onto my battlefield, their commander to the command zone. Every move
sends the card to its OWNER's zone, which is what the card menu has always done:
a stolen creature dying goes to the graveyard of whoever owns it, and putting it
in the thief's would quietly rewrite whose deck it came from.

The list is **newest first**, because a graveyard's array is oldest-first and the
card a player is looking for is almost always the one that just died.

### `ManualMoveZone`, and why it is one intent

"Shuffle the graveyard into the library" as N `ManualMoveCard`s would write N log
lines, and thirty cards leaving a graveyard is ONE thing a player did — thirty
lines buries the game in it. The battery pins that at exactly one line.

⚠️ **The shuffled `order` must cover the cards that just arrived.**
`LibraryShuffled` SETS the library to its `order` rather than permuting it, so an
order computed over the library as it stood BEFORE the moves would drop every
card the same intent was putting into it — the graveyard would empty into
nothing. The handler shuffles `[...library, ...pile]`.

⚠️ And **not `zoneWord`** in the narration: it returns "the graveyard", and these
sentences put a possessive in front of it — "you shuffle your **the** graveyard".

### Verified

**929 Vitest** (5 new in `manual.test.ts`: the shuffle covering the arrivals, a
graveyard exiled whole, exile back into a library, the empty-pile rejection, and
the one-line rule) **· 89/89 `battery-anim.cjs engine`** (7 new) **· 309/311 full
battery · the 500-seed fuzz gate green at 98,581 accepted intents / 1,142,579
events / 9,175 turns / 372 peeks · 124/124 probe · `npm run build` clean.**
`ManualMoveZone` joined `manualIntentFor` for the reason the last three did — a
path the gate cannot reach is a path that rots — and it REJECTS on an empty pile,
which is fine where returning null would end the seed (D108).

⚠️ **One battery run in the middle of this reported three extra failures** — the
hand-fan hover checks, with the "before" snapshot showing slots at 74/96/119 px
and then 457/568/679, i.e. sampled mid-reflow (trap 7). `LoadPercentage` was 63
with **Overwatch running**, which is D106's measured case almost exactly. Same
code at load 46: **the hand section passes and p50/p95 are back to 8.3/8.50 ms,
byte-identical to every clean run.** The failure to read was the load, not the
diff — and the way to tell was that p95 had DOUBLED to 16.7, which is the one
thing interference and a regression do not share.

## D116 — What a land actually offers: the partner bug, and every other land

Reported as "I tap Command Tower and it does not show me my two colours". Two
separate faults, one visible symptom.

### ⚠️ A seat sat down with ONE commander's colours

`host.ts` built the seat's identity as `seat.commanders[0]?.colorIdentity ?? []`.
A partner pair is two cards and ONE identity (CR 903.4), so an Ardenn + Rograkh
deck played as mono-white or mono-red depending on which commander happened to be
first in the list — and `expandOutputs` resolves Command Tower, Arcane Signet and
every other "any colour in your commander's identity" source against exactly that
list. The Tower offered one colour where it should offer two.

The deck VALIDATOR had always computed the union correctly, which is what makes
this the worst shape of bug: the two halves of the app disagreed, and the half
that was right is the one that runs before the game starts. `unionIdentity` is
now the single answer, in WUBRG order.

⚠️ And the symptom was quieter than the fault, because **tapping for mana writes
no log line at all** — `tapForMana` emits `PermanentsTapped` and `ManaAdded` and
no narration. With one option the land tapped silently and correctly, and
"nothing happened" is exactly what that looks like.

### ⚠️ Reflecting Pool produced NOTHING, and had since M1

Asked to make every land work rather than only the Tower, the honest move was to
measure. `oracleParse.node.test.ts` now counts multi-colour lands the way the
panel does — expand `anyColor`, flatten every ability, dedupe by cost string:

| | count |
|---|---|
| Commander-legal lands | **12,500** |
| …offering more than one answer | **4,270** |
| …one clause, several outputs (`Orzhov Guildgate`) | 2,070 |
| …several abilities (the duals, via intrinsic land types) | 1,487 |
| …any colour (`Command Tower`, `Pillar of the Paruns`) | 713 |
| …still offering fewer than two | **13 printings** |

The first measurement said **36**, and it was wrong about twenty of them: it
counted "makes two colours" rather than "offers two answers", so Dimir Aqueduct
(`{U}{B}`) and the Odyssey filter lands (`{W}{U}`) were reported as broken. They
add both, together, always — there is nothing to choose. **Those are different
questions and the first cut conflated them.**

What the corrected measurement then found was real: the pattern matched
`add … mana of any COLOR`, and Reflecting Pool says `any TYPE`. It parsed to
nothing — the most-played colour-fixing land in the format produced no mana at
all — as did Horizon of Progress. Two fixes: accept "type", and resolve the two
board-scoped phrasings.

### ⚠️ Scopes resolved against the board, and the recursion guard

`anyColor.scope` gains `landsYou` (Reflecting Pool) and `landsOpponents` (Exotic
Orchard, Fellwar Stone), resolved in `manaSourcesOf` by a first pass over the
battlefield — exactly as `identity` is resolved against the commander, and just
as un-conditional, because the engine knows both sets exactly.

The set is built from CONCRETE outputs only, and that is both the recursion guard
and the rule: **two Reflecting Pools and nothing else genuinely produce no mana**,
because neither can name a colour the other could make. Lands only, because the
card says "a land"; tapped ones still count, because it says "could produce".

⚠️ **The boundary stayed a boundary.** "a GATE you control could produce" is the
same shape over a set the parser cannot resolve, and answering it with every
colour your lands make would offer mana the card cannot produce — worse than
offering none (D90). It warns `mana:anyScopeUnread` (16 printings) and produces
nothing. The 13 uncovered printings are named in the test rather than rounded
off: Plaza of Harmony, Gond Gate, Pit of Offerings (Gate-scoped), Baldur's Gate,
Springjack Pasture (`X` mana). All five still tap for `{C}`.

### Verified

**939 Vitest** (14 new: 5 for `unionIdentity`, 3 for the board scopes including
the two-Pools case, 2 rewritten in `oracleParse.test.ts`, plus the DB-wide land
assertion) **· 87/87 `battery-anim.cjs engine` · 308/309 full battery · the
500-seed fuzz gate green at 98,581 accepted intents · 124/124 probe ·
`npm run build` clean.** Pinned coverage numbers moved and were updated
deliberately, each with its reason: `mana:noSymbols` 629 → 540 (the "any type"
cards were falling through it), a new `mana:anyScopeUnread` at 16, and
`activated.manaAbility` 11,911 → 11,938.

## D117 — E does what clicking does

D109 gave `E` to "turn the card and nothing else". Pressing it on a land turned
the land and made no mana, which is not what a player means by "tap this land" —
so `E` now routes to the same `onCardClick` a left click does. A land taps for
its mana or opens the chooser; an Equipment starts its aim; a creature is offered
`Tap`.

⚠️ **It is the click, not a second idea of what a card does.** The handler is
passed IN rather than imported, because it is a `useCallback` over live
legality, mode and view — a copy captured in the module would answer with the
board as it was when the table mounted, which is the stale-binding trap
`devHandles` warns about. `useTapKey` moved from `GameLayer` to `TableScreen`
for the same reason: that is where `onCardClick` lives.

⚠️ **Turn-it-and-nothing-else did not go away** — it is `Tap only` in the panel
(D113) and the card menu's button. ⚠️ And that is exactly why D113's one-option
fast path had to go with it: with E routed to the click, a Forest that tapped
straight for green offered no way to just turn it from either gesture. Every
source asks now.

⚠️ **Still battlefield-only.** A click means something in every zone: in the fan
it CASTS. A letter key that cast a spell because the cursor happened to be over
the hand is a misclick with a real cost, and the battery asserts E over a hand
card submits nothing at all — on the event count, since a cast would be a real
play.

Two battery checks were deleted rather than adapted, because they described the
old meaning: "E again untaps it — one key, both directions" and "the tap is
logged as a MANUAL action". A key that taps for mana is Tier 1 and earns no
wrench. What replaced them asserts the POOL moved.

## D118 — Tapping a land says so

D116 found that `tapForMana` emitted a tap and a pool change and **no narration
at all**, and named it as the reason its own bug was so hard to see: a land
tapping correctly and a click doing nothing looked identical from the table. This
is the fix. `You tap Command Tower for {U}.`

⚠️ **TIER 1 — no wrench.** The engine performed a rules action; nobody
hand-waved anything. Keeping those apart is the log's whole job, and a mana tap
wearing the manual marker would quietly reclassify the most common action in the
game as something the app was not enforcing.

⚠️ **It names the MANA, not just the land.** "You tapped a land" is not what a
player scans a log for; "where did that `{U}` come from" is — and on a source
with a choice, which colour was taken is the only part that was ever in doubt.
Written with `costStringOf`, so `{C}{C}` reads as Sol Ring prints it.

⚠️ **PAYING for a spell still writes one line, not five.** `applyPlan` emits its
own `ManaAdded`/`PermanentsTapped` and never routes through `tapForMana`, so
auto-tapping five lands to cast something logs the cast and nothing else. Only a
land the PLAYER tapped writes a line — which is what bounds the cost of this to
deliberate actions, and is why the log does not fill with a turn's worth of
ramp every time somebody casts a commander.

⚠️ A source that does not tap gets the other sentence — `adds {B} from …` —
rather than being described as tapping when it did not.

### Verified

**941 Vitest** (2 new pinning both sentences and `manual: false`) **· 308/309
full battery · the 500-seed fuzz gate green at 98,581 accepted intents and
**1,161,398 events, up from 1,142,579** — +18,819 narration lines, with the
intent count, the turn count and every replay hash unchanged, which is the shape
that says "the log grew and the game did not move" **· 124/124 probe ·
`npm run build` clean.** Read live on a three-colour seat: Command Tower offered
`{U} {B} {R}`, taking `{U}` wrote `You tap Command Tower for {U}.` with no
wrench, directly under the wrenched Tier-3 lines above it.

## D119 — Auto-pass asks "could you do anything?" FIRST, and the hotseat says when it changes seats

Reported from a real game, in these words: *"after they put a land on my main
phase as Ben, not as Ana — it changes the side and then couldn't let me play it
and then just got to combat. That was Ben's turn, but I'm not Ben right now."*

Two faults, one experience. Ben played a land, had nothing else affordable, and
the engine auto-passed him; Ana held one castable instant, so she was stopped —
and because solo play is a hotseat (D42) the table followed priority to her
seat, silently, mid-turn. Ben's turn then walked to combat with Ana's board on
screen and Ana's hand at the bottom, holding a card she could not play.

### `shouldAutoPass` asked the questions in the wrong order

"Could this player do anything at all" was the LAST clause in `legal.ts`. Every
stop above it — `alwaysStop`, `stopWhenAnyoneCasts`, `stopBeforeCombatDamage` —
therefore fired for a player with an empty hand and no untapped land. On the
default stops that is two forced clicks per opponent's turn per player, plus one
every time anybody casts anything, none of them offering a decision. At four
players that is six clicks per turn cycle spent pressing Pass at a board you
cannot affect.

It is the first question now, and every clause below it is a refinement rather
than an override. `mode: 'fullControl'` remains the one thing that stops
everywhere, which is exactly what its label has always promised.

⚠️ **`meaningfulActions` had to grow an affordable `ActivateAbility` in the same
change**, because it is now the WHOLE answer to "could you act": anything
missing from that list is a play the game will never stop to offer. A
firebreathing blocker's pump is precisely the case `stopBeforeCombatDamage`
exists for, and while abilities were absent from the list that stop could not
have fired for a player whose hand was empty. `TapForMana` stays out for the
reason it always did — there is essentially always a land untapped somewhere.

### Holding a playable card is a reason to be asked SOMEWHERE, not everywhere

`stopWhenIHaveInstantSpeedPlay` had no notion of WHICH step was worth stopping
in, and "I hold a castable instant" stays true for a whole turn cycle. Measured
in the reported game: one Mountain and one `{R}` instant stopped that player in
main 1, begin combat, end of combat, main 2 and the end step of a turn they were
not taking — five prompts, each of which moved the table to their seat.

`isStopWindow` is the missing half. Your own **main phases**, because that is
where a turn is spent; somebody else's **end step**, because "at the end of your
turn" is where held-up mana goes. Everything else that genuinely matters is
already its own clause — attackers and blockers (`alwaysStop`), a spell going on
the stack (`stopWhenAnyoneCasts`), damage about to be dealt
(`stopBeforeCombatDamage`) — and any individual step can still be pinned in the
stops panel.

⚠️ **The panel's header changed with it.** `ALWAYS STOP AT` became `ALSO STOP
AT`, because a step ticked there no longer stops a player who cannot act, and a
control that promises more than it does is worse than one that promises less
(rule 9). The footer's *"Hold Ctrl while it passes to force a stop"* went at the
same time: **nothing in the app has ever implemented it** — there is no
`ctrlKey` reader anywhere near priority, and `fullControlThisTurn` is written by
one screen's default and by nothing else.

### The hotseat now says when it changes seats

`SeatHandoff` — "Ben → Ana / You are Ana now", two lines in the middle of the
table for 2.2 s. Green, because green is PRIORITY (D99) and that is what a
hand-off is about; brass would say "whose turn", which the phase bar already
answers and which most hand-offs do not change.

⚠️ **Announced only for a switch the GAME made.** `session.onSeatHandoff` fires
inside the automatic switch alone, never from `setViewer`. Pressing a seat in the
picker is already its own answer to "why am I looking at Ben", and a banner over
a button somebody just pressed explains nothing.

⚠️ **A notification, in the same shape as `onSpellResolved`** — a thing that
happened, not a thing the game is waiting on — and it carries seat IDS. `src/ui/`
holds `seats` and is the only layer that should be composing a sentence.

⚠️ **A probe must ACT, THEN WAIT.** The switch is deferred until the
choreographer drains, and every submit CLEARS the pending timer. A check that
polls the DOM between submits starves the thing it is waiting for and the banner
never appears.

### What this broke in the tests, and why none of it was the rules

Nine existing checks failed, and every one of them was observing a moment that
no longer exists rather than a rule that changed:

- Four in `combat.test.ts` — the blocker order, the board between blocks and
  damage, a creature pulled out of combat before it fights. With nobody able to
  act, the whole of combat now happens inside the `DeclareBlockers` submit.
- `mana.test.ts` and `project.test.ts` — a Bolt nobody can answer is cast AND
  resolved in one submit, so there was no stack left to assert on.
- `diffView.test.ts` — 500 updates is a lot more game than it was; a 30-card
  library decked the whole table out at 359 of them.
- `net.test.ts` — 80 intents now play that table to turn 24 and a FINISHED game
  refuses a rewind vote, which reads as "the rewind changed nothing".
- `relay.node.test.ts` — reaching turn 6 costs 11 driver rounds where it cost 21.

⚠️ **`holdEverywhere(game)` is the answer, and it is a new harness rule:** a test
that needs to OBSERVE an intermediate state must SAY so. Auto-pass is a policy,
and a scenario that leant on the default stops to hold the engine still was
asserting the policy of the day — which is why it broke the moment the policy got
better at its job.

⚠️ The battery's `the game reaches and stops in the declare-attackers step` was
the same thing one level up, and it is now the sharper check the fix deserves:
on an empty board with a hand of lands, the engine must stop in the main phases
**and nowhere else**. It reports exactly `precombatMain, postcombatMain`.
Reaching the attackers step is still covered by the block below it, which puts a
creature on the board first so the prompt it asserts on is a real one.

### Verified

**945 Vitest** (5 new in `turn.test.ts`, 1 replaced — the case that asserted a
bystander is stopped in the active player's main phase was the reported bug
written down as a test) **· 91/91 `battery-anim.cjs engine`** (2 new for the
hand-off, one of them pinning that a MANUAL seat change stays quiet) **·
303/305 full battery · `npm run build` clean.**

**The 500-seed fuzz gate green, and its counters are the fix measured:**
**17,003 turns against 9,148**, and 2,239,781 events against 1,161,398, from
5% FEWER accepted intents (93,565 against 98,581). The same 200 intents per seed
now play nearly twice the game, which is the whole claim — a click that offered
no decision was not playing anything.

Played it live: a two-seat game passed from Ana's main phase into Ben's turn and
back, with the banner reading `Ben → Ana / You are Ana now` over the table and
the log holding six lines for three turns.

⚠️ **Two failures remain in the full battery and NEITHER is this change.** The
perf gate's long-frame count is D29/D29a with D106's signature — 4 long frames,
**p50 8.3 ms / p95 8.50 ms, byte-identical to a passing run**, and its
"≤2 frames over 33 ms" sub-check PASSING at 1. And the renderer-console check
fails with React's `Maximum update depth exceeded` through zustand's
`forceStoreRerender` in the `drag` and `motion` sections — **pre-existing, and
proven so by unmounting `SeatHandoff` and reproducing it unchanged**. `flight`,
`table`, `tap`, `hand`, `choreo`, `beats`, `hud`, `fx`, `combat`, `net` and
`engine` all pass the same check; D111 and D113 record full runs whose only
failures were the perf gate, so it arrived with the uncommitted work after them.
It has its own task.

## D120 — A resolved spell says WHOSE it was, because the assisted offer was applying to whoever was looking

Reported from a real game: *"I have played a card as Ben, and the effects got to
Anna and not Ben because of some weird switcheroo."* The log said it plainly —
`Ben casts Thrill of Possibility.` / `Thrill of Possibility resolves.` / 🔧 `You
apply the part of Thrill of Possibility the app understands.` Ana's hand went
7 → 9 and her library 91 → 88. Ben's library did not move.

### The offer never knew whose spell it was

D90's assisted tier is a CLIENT-SIDE notification, deliberately — a
partly-understood card must not stop three other people mid-turn. It is raised
from `StackResolved` in `session.ts`'s `onBatch`, which runs for the ACTIVE
SEAT'S client. In a hotseat the table follows priority (D42), so by the time a
spell resolves the table has routinely moved to whoever must respond to it. The
event carried `card` and `targets` and **no controller**, so:

- `PromptBar` raised the offer for whoever was being viewed. Its own comment said
  "if it was mine" and **nothing checked it**.
- The Apply button submitted `ManualApplyEffect` with `player: viewer`, and
  `manual.ts` builds its synthetic stack object with `controller: intent.player`
  — so `effectEvents` drew two cards for the viewer.

⚠️ **It was worse over the wire than in a hotseat.** A guest's client is always
the active seat from its own point of view, so EVERY player was offered every
assisted spell anyone cast, and each would have applied it to themselves. The
host's "you can only act for your own seat" guard does not help: each client was
naming itself, honestly, for somebody else's spell.

### The controller belongs on the event, beside `targets`

`StackResolved` already carries `targets` under the comment *"so an assisted card
can still be offered after it resolves"*. `controller` is the same fact for the
same consumer and is now required on the event, carried through `toViewEvents`
into the view cue, and through `session.onSpellResolved` to the prompt bar.

⚠️ **THE CARD CANNOT ANSWER FOR IT — this is the part that makes an event field
necessary rather than convenient.** `clearBattlefieldFields` resets a moved
card's `controller` to its OWNER, so a resolved spell sitting in a graveyard says
only whose card it is. That is right for the rules (CR 108.4: a card outside the
battlefield has an owner, not a controller) and useless for "who cast this",
which is exactly what an assisted effect needs. The stack object holds the answer
and is destroyed by the same reducer pass.

⚠️ `controller: null` on the fizzle/counter branch, and it is not a shrug: those
carry `instanceId: null` too, so nothing downstream can offer anything for them.
Naming a controller there would be inventing one.

### And the offer is filtered on `localSeats()`, not on `viewer`

In a networked game that is the one seat this app speaks for, so the offer
reaches only its caster and nobody else is asked about a spell they did not cast.
In a hotseat it is every seat, so the offer SURVIVES the table changing hands —
which it must, because the hand-off (D119) happens in the same beat the spell
resolves in. When the controller is not the seat on screen the second line says
so: *"For Ben, who cast it. The rest of the card is theirs."*

⚠️ **`ManualApplyEffect` itself was left as permissive as it was**, and that is a
decision rather than an oversight. The engine cannot re-derive the resolution's
controller after the fact, and a guard built on the card's OWNER would be a
different rule wearing the right rule's clothes — it would reject Kess casting
from a graveyard, and an opponent's card cast with a theft effect. Every Tier-3
tool in this app can already move anything anywhere; this one stays in that tier,
under the same friends-only trust model, with every use logged and wrench-marked.
What was broken was the UI naming the wrong player, and that is where it is fixed.

### Verified

**946 Vitest** (1 new in `effects.test.ts`) **· 303/305 full battery ·
`npm run build` clean · the 500-seed fuzz gate green at 93,565 accepted intents /
2,239,781 events / 17,003 turns with identical replay hashes** — unchanged from
D119's run, which is the right result for a change that adds a field nothing
reduces on.

⚠️ **The new test was checked by BREAKING the fix**, not by watching it pass:
emitting `controller: state.turn.activePlayer` instead of `obj.controller` fails
it with `expected 'p1' to be 'p2'` — the active player instead of the caster,
which is the bug's own signature, since a spell cast on somebody else's turn is
precisely when the two differ.

**Reproduced and fixed live, with the user's own two decks**, driven through the
real solo lobby: viewer pinned to **Ana**, `Thrill of Possibility` cast by
**Ben**. The offer read *"For Ben, who cast it"* with `data-effect-for="p2"`, and
pressing Apply moved **Ben's** hand 4 → 6 and **Ben's** library 92 → 90 while
Ana's 7 and 91 did not move. The log line read `Ben applies the part of Thrill of
Possibility the app understands. The rest is theirs.` — third person, from Ana's
seat, which is D101 working on top of the repair.

⚠️ Two full-battery failures remain and neither is this change: the perf gate's
long-frame count (9, inside the documented 3–9 band) with **p50 8.3 ms / p95
8.50 ms byte-identical to a passing run and 0 frames over 33 ms** — D106's
interference signature, measured twice — and the pre-existing
`Maximum update depth exceeded` in the `drag` and `motion` sections (see D119).

## D121 — A bot takes a seat, and it may only hold cards the engine runs in full

M6.1. A bot sits in a solo seat, holds a real hand, mulligans, plays lands,
casts, attacks, blocks and tries to win — and it plays a deck built only from
cards the app executes COMPLETELY, because the honesty that makes a Tier-3 card
workable for a human does not survive contact with a bot. A player reads the card
and applies it with the manual tools; a bot cannot, so a card the app half-runs
is a card the bot must never draw.

### A bot is a client, so half of the brief's toolbox is unreachable

The M6 handoff's §3 table names `legalActions`, `meaningfulActions`,
`shouldAutoPass`, `canAttack`, `canBlock`, `legalDefenders` and
`candidatesFromState` as the bot's tools. **Every one takes a `GameState`**, and
a bot is a `ClientSession` (M4 invariant 6), so a bot can never call any of them.
That table is written from the host's side.

What a bot actually gets is what a guest gets: `ClientSnapshot.legal`, computed
per connection in `host.ts` and shipped on every `Update`, plus the legal choices
carried INSIDE the prompt — `declareAttackers.attackers/defenders` and
`declareBlockers.legal`, which exist precisely because a client cannot derive
them. `src/bot/types.ts` states that boundary as a `BotPort` of seven methods,
each an existing public `ClientSession` method with the identical signature, so a
`ClientSession` satisfies it structurally with no adapter and nothing outside it
is reachable. A third `purity.node.test.ts` block enforces it mechanically: no
`src/bot/` file may make a runtime import from an engine module that takes a
`GameState`, and — unlike `src/net/`, which may back off — none may name a timer,
`Date.now` or `Math.random`. Every clock lives in `src/game/botSeat.ts`.

### `Intent | null` is not an answer, and D102 is the receipt

`simplestIntent` answers 7 of the 13 `Awaiting` kinds and falls to
`default: return null` for the other six. A driver that returns null submits
nothing ever again, and a wedged game is indistinguishable from a healthy idle
one — which is how the two-instance sign-off read 21/24 for weeks.

So `decide()` returns `act | wait | fault`. `wait` is "not mine"; `fault` is
loud, logged and surfaced. `awaiting.ts` has a case for all thirteen with a
`never` check, so a FOURTEENTH kind fails `tsc -b` rather than reaching a table.
Two of the thirteen deliberately fault, and both are engine gaps rather than bot
gaps — see the reportable list below.

⚠️ **`simplestIntent`'s mulligan case is wrong for any seat but the first.** It
reads `awaiting.players[0]` and compares it to its own seat; the mulligan prompt
lists every player, so a seat sitting second is never answered. The bot uses
`players.includes(me) && !submitted.includes(me)`.

### The stop policy, and the flag whose name lies

The brief's §5 says to give a bot `mode: 'fullControl'` "or it will be
auto-passed out of decisions it wanted to make". That is the expensive option and
it is not needed: on `auto`, D119 made "could this player do anything at all" the
FIRST question, and a land drop never auto-passes. Level 1 responds to nothing,
holds no combat trick and casts only at sorcery speed, so `fullControl`'s extra
windows are windows it would only ever pass in.

⚠️ **But `stopWhenIHaveInstantSpeedPlay` MUST stay on, and its name is why the
first cut was wrong.** It does not merely drop instant-speed windows — it gates
`isStopWindow` entirely (`if (!stops.stopWhenIHaveInstantSpeedPlay) return true`),
and `isStopWindow` is "your own main phases, or somebody else's end step". Off,
it auto-passes the bot out of its OWN MAIN PHASE. **Measured, one seed, 4 seats:
with it off the game reached turn 88 having played 73 lands and declared 88
attacks — and cast FOUR SPELLS. With it on, the same seed casts 21 and blocks 39
against 18.** Every other check was green through all of it, which is why
`bot.test.ts` now asserts the casting floor: a bot that only plays lands still
finishes a game, still never faults and still replays to the same hash.

### The pool: every line accounted for, or the card is out

`src/data/engineComplete.ts` generalises D90's "never half-execute" from spells to
permanents. A face is complete when EVERY line of its scrubbed oracle text is
accounted for by a canonical Tier-2 keyword, a mana ability `parseManaProduction`
can model, or — for an instant or sorcery — `effectMode === 'auto'`. Nothing
else, because with `EMPTY_REGISTRY` nothing else executes. It asks those parsers
and writes no rule of its own; the only thing written here is where one clause
ends and the next begins, which is typography rather than rules.

⚠️ **A payable activated ability is NOT enough.** `activatedParse`'s `payable`
means the engine can CHARGE the cost, not that it can run the effect — and
`loop.ts` resolves a non-mana ability with "with no card scripts there is nothing
to run", having already tapped the permanent. Krenko is payable, is offered by
`legalActions`, and produces no Goblins. Only `isManaAbility` counts.

⚠️ **Three bugs, each found by reading the answer rather than by a test.**

1. **`Ancient Tomb` was accepted.** `ManaProduction.line` says the line HAS a
   mana ability, never that the line IS one, and Ancient Tomb reads
   `{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.` on ONE line. It is not
   `conditional` either. The bot would have tapped it and taken no damage.
2. **`Dark Ritual` was accepted**, because `parseManaProduction` reads any face
   with "add" on it while `legalActions` offers `TapForMana` for permanents
   alone. A sorcery that resolves and does nothing at all.
3. **`Jedit Ojanen, Mercenary` was chosen as the bot's COMMANDER.** His whole
   card is a triggered ability, and it passed because the text ends "…token with
   forestwalk", `parseLandwalk` is a substring test, and the face really does
   have landwalk. This is verbatim the failure `keywords.ts`'s own header warns
   about — "a regex over oracle text finds 'flying' inside 'Whenever a creature
   with flying attacks…' and grants it to the wrong card." A printed keyword
   clause never contains a period, a semicolon or a colon, and the guard is that
   one line. It removed 48 false positives, and took enchantments from 9 to 0.

### The numbers, reproduced — and D90's do not

`src/data/botPool.node.test.ts` is the first thing in this repo that counts CARDS
rather than faces. `oracleParse.node.test.ts` counts faces across all 113,559
printings (`effect:auto = 1,614`) with no legality filter, no type filter and no
dedupe by name; D90's 274/1,300/6,975 were a one-off manual measurement, copied
into `effectParse.ts`, `oracle.ts`, the tier table and the M6 brief since.

| Claim | Measured |
|---|---|
| 6,975 Commander-legal instants + sorceries (D90) | **6,975** — reproduces exactly |
| 12,500 Commander-legal lands (D116) | **12,500 PRINTINGS.** 1,114 distinct NAMES |
| 274 `auto` (D90) | **269** front-face; **273** counting any face |
| 1,300 `assisted` (D90) | **1,359** |

⚠️ **The unit is the finding.** The brief's §2 table prints "6,975 instants and
sorceries" next to "12,500 lands" as if they were the same unit. They are not,
and anyone comparing a distinct-name report against it reads a 91% collapse in
land coverage that never happened.

⚠️ **274 does not reproduce and 1,300 is not close.** Counting a card as auto
when ANY face is gives 273, which accounts for four of the five and is most
likely what D90 did — 135 of the 6,975 have two faces. Nothing explains 59
assisted cards. The definition was what was missing: D90 says "distinct cards"
and does not say which face it counts, nor whether legality is read per card or
per printing. **This test is now the definition**: distinct NAME with at least
one Commander-legal printing, typed and moded by the FIRST face — the reading
under which 6,975 reproduces exactly.

**What the engine runs completely, of 31,692 distinct Commander-legal cards:
1,405, or 4.4%.**

| creature | instant | sorcery | land | artifact | enchantment | planeswalker | battle |
|---|---|---|---|---|---|---|---|
| 1,120 | 148 | 67 | 48 | 22 | **0** | **0** | **0** |

Three exact zeroes, and they are the point: an enchantment's whole text is a
static or triggered ability, a planeswalker's is loyalty abilities, and a battle
is a defense counter plus a trigger. **The bot cannot hold one of any of the
three** until M6.3's primitives land, and the lobby says what it is playing
instead.

### The deck is real, and that was not assumed

`buildBotDeck` picks from 45 fully-executable legendary creatures — **Jasmine
Boreal**, a vanilla 4/5 in GW, for reaching 667 in-identity cards — then fills a
stated curve and 37 lands. It is deterministic with no RNG anywhere: every
comparison ends in the card name, which is what lets a bot game replay.

⚠️ **The verdict is printed, not claimed.** The deck goes through
`validateCommanderDeck`, the same validator an imported deck goes through, and
the test asserts `ok === true` with zero errors and exactly 100 cards. Unlike the
starter deck (D43, "deliberately NOT a legal Commander deck"), this one is legal.
It is also a weak deck — no enchantments, no planeswalkers, no triggered
abilities, no tutors, no recursion — and that ceiling is the honest state of the
app rather than a property of the bot.

⚠️ **Single-face only, and that is a DECK decision rather than a rules one.** The
first generated deck held both `Command Tower` and `Command Tower // Command
Tower`, which the validator accepted (it compares the names it is given, and
Scryfall stores a double-faced card's name as "Front // Back") and which is two
Command Towers at a real table.

### The four seams

1. **`maybeSwitchSeat` never follows a bot.** It reads `whoIsNeeded()`, which
   returns whoever holds priority — routinely the bot. Guarded in BOTH places,
   because the target is re-read after the choreographer drains and a bot can
   become the needed seat between them. `whoIsNeeded` itself is untouched: it is
   the honest answer to "who is the game waiting on". A table of one human and
   three bots skips the poll entirely rather than arming it on every submit for a
   hand-off that can never happen.
2. **The bot submits its own `SetStops`**, through the ordinary intent, so its
   policy is in the append-only log and a replay reproduces it.
3. **The D120 assisted offer.** The `StackResolved` scan moved ABOVE the
   active-seat guard and narrowed to `controller === playerId`, so the offer is
   raised by the caster's OWN client rather than by whichever one the table
   happens to be looking at — a bot is never the viewer, so before this its own
   offer went nowhere while the human was shown one for a card it did not cast.
   The prompt bar filters on `humanSeats()`, not `localSeats()`, because a bot's
   seat is local too.
4. **The lobby** gains a Human/Bot control per seat, never on seat 0 — a table
   with nobody at it is a tournament run, and that belongs in a script. A bot
   seat shows its deck instead of a picker, because offering a choice it cannot
   honour is worse than not offering one.

⚠️ **`SeatSpec` did NOT gain a `kind` field.** It goes to `HostSession`, and "a
bot is a client" is the claim the whole design rests on; a `kind` on the wire
would contradict it and would be meaningless in a LAN game, where it would have
to be redacted or explained. Seat controller is a lobby concept and stays
renderer-side. `session.clientFor()` returns null when `remote` is set, which
makes "no bots over the wire" a property of the code rather than a comment.

### Verified

**1,051 Vitest** (up from 946: 55 for the predicate, 22 for the thirteen prompts,
6 for a whole bot-vs-bot game, and a new `src/bot` purity block) **· 12/12 in a
new `battery-anim.cjs bot` section · 91/91 in `engine`, unchanged · 124/124 probe
· `npm run build` clean · the 500-seed fuzz gate green at 92,778 accepted intents
/ 2,257,235 events / 17,196 turns.**

Four cards joined the fuzz `DECK` — `Dryad Arbor` (a land creature), `Darksteel
Citadel` (an artifact land), `Monstrous Growth` (a pump spell, one of the 11
effect kinds and the one the gate had never dealt) and `Akroma, Angel of Wrath`
(six enforced keywords plus protection from two colours) — because those are the
shapes the bot's deck introduced that the gate could not otherwise reach. Same
rule as D102, D107 and D108, for the fourth time.

**Played by hand**, driven through the real lobby buttons: a 4-seat game, one
human against three bots, reached turn 13 with 1,517 events. The three bots
mulliganed before the human was asked, built boards of Knight of Meadowgrain,
Brightblade Stoat and Battlefield Raptor, attacked, and took the human to 39 —
and **the table stayed on seat p1 for the whole game**. Every bot line is third
person with no wrench; every human line is second person.

### Reportable, and deliberately not fixed here

⚠️ **ALL FIVE ARE NOW CLOSED, and this list is kept as written for the record:**
1 and 2 by **D122** (the disclosure gaps), 3 and 4 by **D125** (the two prompts
nothing could answer — one deleted, one made answerable), 5 by **D123** (the
fixture rot guard). Read those entries for what actually shipped; the wording
below is what was known at M6.1.

1. **A permanent's triggered and static text is unenforced and UNSAID.**
   `tier3NotesFor` raises "Its effect" only for `manual && !isPermanent`, so a
   creature reading "Whenever this creature attacks, draw a card" produces ZERO
   Tier-3 notes and the engine does nothing. `Wall of Omens` and `Talrand, Sky
   Summoner` are both shipping in `STARTER_SPELLS`/`STARTER_COMMANDERS` today.
   This is AGENTS.md invariant 9, and it is the larger of the two.
2. **A payable non-mana activated ability charges its cost and runs no effect**,
   with no note either — `tier3.ts` skips abilities where `payable` is true.
   `Krenko, Mob Boss` is a starter commander.
3. **`assignCombatDamage` is an `Awaiting` with no answering intent.** No client,
   bot or human, can answer it; `PromptBar` describes it and renders no button.
   Unreachable only because D44 Q5 made assignment automatic and
   `options.manualCombatDamageAssignment` is an unused seam.
4. **`orderAttackers` cannot be answered from a `PlayerView` at all**, because
   `CardView.blocking` is a single `InstanceId` and a creature blocking two
   attackers cannot report both. It has no producer either. `blocking` must
   become an array before multi-block ordering can work for anybody.
5. **No rot guard on the engine fixtures**, despite `make-engine-fixtures.cjs`
   and the header it generates both claiming `battery-carddb.cjs` cross-checks
   them. `grep engineCards scripts/battery-carddb.cjs` finds nothing.

⚠️ **Items 1 and 2 are closed by D122** — as disclosures only. The engine still
does exactly what it did; the card now says so, on 20,607 of 31,692
Commander-legal cards. **Item 5 is closed by D123**, which also removes the two
comments that claimed a guard that did not exist. Items 3 and 4 are still open.

## D122 — Half the card pool said nothing, and silence means "handled"

D121's reportable list opens with two disclosure gaps, both pre-existing, both
AGENTS.md invariant 9: *a category that is unenforced must be SAID.* They are
closed here.

⚠️ **NOTHING ABOUT THE ENGINE CHANGED, deliberately.** `legal.ts` offers the same
abilities, `handlers.ts` charges the same costs, `loop.ts` still resolves an
ability by running nothing, and `engineComplete.ts` still refuses both classes for
the bot's deck. The only thing that changed is what the card SAYS the app will not
do — which is the whole of what invariant 9 asks for, and is why this is one
D-entry rather than a milestone.

### The two gaps

1. **A permanent's triggered and static text produced ZERO Tier-3 notes.**
   `parseEffects` returns `mode: 'manual'` for every non-instant/sorcery **by
   construction** — a permanent's text is a static or triggered ability needing the
   script registry and the trigger bus, not a one-shot resolution, and pretending
   otherwise would run a creature's "whenever this attacks" the moment it entered
   the battlefield — and `tier3NotesFor` raised its "Its effect" note only for
   `manual && !isPermanent`. So `Wall of Omens` ("When this creature enters, draw a
   card") and `Talrand, Sky Summoner` produced no note at all, and **no note at all
   is what a vanilla `Grizzly Bears` produces.** The hover panel's silence is
   *defined* to mean "the app handles this card completely" — that is the first and
   most important test in `tier3.test.ts` — so the gap was not an omission but an
   active false claim, on the most common card class in the game.

2. **A payable non-mana activated ability charged its cost and ran nothing, in
   silence.** `payable` means the engine can charge the COST, never that it can run
   the EFFECT. `legal.ts` offers every ability that is `payable && !isManaAbility &&
   !isLoyalty`, `handlers.ts` taps the permanent and takes the mana, `loop.ts`
   resolves it with "with no card scripts there is nothing to run" — and `tier3.ts`
   skipped exactly those abilities, `if (ability.isManaAbility || ability.payable)
   continue`. It said something about the abilities the engine will NOT let you
   activate and nothing about the ones it will charge you for. `Krenko, Mob Boss` is
   a starter commander: tap him, get no Goblins.

⚠️ **All four starter commanders were silent**, and that is how a new player meets
this app: Kess (a static ability), Krenko (a charged ability), Talrand (a trigger),
Yeva (a static ability), plus `Wall of Omens` in `STARTER_SPELLS`. The first table
anyone sees was the worst case.

### Measured over the whole database, in the same pass and unit as D121

`src/data/tier3.node.test.ts` streams `cards.ndjson` through the real parsers, one
distinct NAME per card with at least one Commander-legal printing, read from the
FIRST face — D121's definition, and `distinct` is cross-checked against that file's
31,692 rather than re-derived, because the lesson of D121 was that a number whose
unit is not written down is not a number.

| | cards | of 31,692 |
|---|---:|---:|
| first face is a permanent | 24,669 | 77.8% |
| **now say "its ability text" — unrun triggered/static text** | **17,963** | **56.7%** |
| **now say an ability is charged and not run** | **4,016** | **12.7%** |
| either | 20,607 | 65.0% |
| either, counting any face | 20,675 | 65.2% |
| **said NOTHING before and say something now** | **15,677** | **49.5%** |
| cards with no note at all, BEFORE | 17,824 | 56.2% |
| cards with no note at all, AFTER | 2,147 | 6.8% |

⚠️ **The headline is 15,677.** Just under half of every Commander-legal card said
nothing whatsoever, on an app where nothing whatsoever means "we run this for
you". The engine runs **1,405** cards completely (D121) — so of the 17,824 silent
cards, 16,419 were silent for no good reason and 1,405 were silent for the right
one.

### Where the answer comes from, and the three ways it could have lied

⚠️ **ASKED OF `engineComplete.ts`, NEVER RE-DERIVED.** `tier3.ts` records learning
this twice — a `/target/` regex beside `targetParse`, and a mana regex that flagged
`Command Tower`, a land the app taps for you — and this is the third time. The new
note reads `unaccountedLines()`, which is the line accounting `faceCompleteness`
already ran for the bot's pool, refactored out and shared rather than copied. Two
questions, one answer underneath, which is what makes the invariant at the bottom
of `engineComplete.ts` hold by construction: **a card the predicate accepts stays
silent.** Asserted over 31,692 cards here, not 82 fixtures: **0 engine-complete
cards carry a note.**

The line accounting now labels each unaccounted line, because three different
notes speak for three different shapes and reporting one line twice is as unread
as reporting it never:

- **`sentence`** — a triggered or static ability. This is the new note.
- **`activated`** — a `cost: effect` line, named WITH its cost by the ability loop,
  because the thing a player needs to know is which cost buys nothing.
- **`keyword`** — a keyword line the engine does not enforce. **D68 decided the
  tail of 885 keyword strings is named from a deliberately SHORT list**, and this
  is where that decision is protected: a bare `Exalted`, `Undying` or
  `Ward—Discard a card.` must not reappear as "unrun ability text", or the note
  lands on thousands more cards and becomes the furniture that `tier3.test.ts`'s
  first test exists to prevent.

⚠️ **Three ways the keyword/sentence split lied while it was being written, each
caught by a card:**

1. **Punctuation alone does not work.** The first cut reused `clauseAccounted`'s
   rule — "a printed keyword clause never contains a period, a semicolon or a
   colon" — at the line level. `clauseAccounted` strips a TRAILING period first, so
   applied honestly it files `Ward—Discard a card.` as a keyword (right) and `When
   this creature enters, draw a card` as one too (fatal: a comma is not a period).
   Applied without the strip it files real ward lines as ability text, reporting one
   line twice. There is no threshold that separates them.
2. **The question is Scryfall's `keywords` array**, which is the same input the
   keyword loop reads and the only thing that knows all 885 strings —
   `canonicalKeyword` knows the Tier-2 ones only, so it calls `Partner` an ability
   rather than a keyword, and `Partner` is in fact enforced, by the deck validator.
   A clause counts as a keyword clause when it OPENS with one, at a **word
   boundary**: `Equip` against `Equipped creature has haste and shroud.` is why,
   and `Enchant` against `Enchanted creature can't attack or block.` is the same
   trap on Pacifism.
3. **An ability word is in that array too.** Scryfall lists `Magecraft` in
   Sedgemoor Witch's `keywords`, so her whole triggered ability opens with a printed
   keyword. Two rules separate them, and both are printed conventions rather than
   guesses: a keyword clause is a keyword and its cost, so **every comma-separated
   part must open with one** (CR 603.1 templating puts a comma after every trigger
   condition, and the clause after it is not a keyword); and a keyword's cost
   follows an **unspaced** dash (`Ward—Discard a card.`) where an ability word
   introduces a whole ability after a **spaced** one (`Threshold — This creature
   gets +1/+1.`). The dash rule alone is worth **126 cards** — `Threshold`,
   `Fateful hour`, `Metalcraft` — that a comma test cannot reach.

### One label, not "triggered" and "static"

The note says `Its ability text` for both. The distinction was written first and
withdrawn: `splitAbilityLines` calls a line `triggered` only when it STARTS with
"When", "Whenever", "At the beginning" or "At end of", so **every ability-word
trigger comes back `static`** — and a note reading "Its static abilities — the app
does not apply this" on Sedgemoor Witch's magecraft trigger is confidently wrong
about a card, which is the failure this whole file exists to prevent. What a player
must know is identical either way: the app does not run this. A coarse note that is
true beats a precise one that is sometimes false.

### Still unsaid, and reported rather than fixed

**684 cards (2.2%)** are run incompletely by the engine and carry no note on any
face. The pass splits them, and only one half is a gap:

- **345 — an unnamed keyword line and nothing else.** `Exalted` (17), `Unleash`
  (9), `Bushido 1` (9), `Evolve`, `Fabricate 1`, `Daybound`, `Backup 1`, `Undying`.
  This is D68's decision working as designed, not an omission.
- **339 — a mana-ability line that does MORE than add mana**, which is `Ancient
  Tomb`'s shape: `{T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.` on one
  line. The engine taps it, adds the mana and skips the sentence after it; the
  ability loop passes because `isManaAbility` is true, and the new note passes
  because the line is `activated`. **A third disclosure gap, measured and left
  open**, because saying it needs its own wording — "the app taps this and adds the
  mana, and the rest of that line is yours" is a different sentence from either
  note here, and inventing a third disclosure was not what this was for.
  **→ CLOSED by D124, which found the shape was bigger than this paragraph says:
  723 cards, and the unrun half is often the COST rather than a second sentence.**

### The hover panel

`CardZoomPanel` lists EVERY note (`tier3SummaryFor` caps at three and nothing
calls it), and `tier3.ts`'s header warns that a long list pushes the card's own
text off the screen — so adding two note kinds is exactly the change that could
have broken the panel instead of the data. Measured: the longest list in the pool
is **6** — `Kenrith, the Returned King`, five abilities the engine charges and does
not run plus a free-aim target clause — and **140 cards list four or more**. The
panel's container has no height of its own (only the card inside it does), so a
long list grows it rather than clipping it. Pinned, so the next note kind added has
to look at the number.

### Verified

**1,067 Vitest passing / 4 skipped, 17 of them new** — 11 fixture-level in
`tier3.test.ts` and 6 over the real database in the new `tier3.node.test.ts` —
**`tsc -b` clean**, and `botPool.node.test.ts` reproducing every pinned number
after the refactor: **1,405** pool cards, the same by-type split, 31,692 distinct,
6,975 spells, 269/1,359/273, 12,500 printings / 1,114 land names. The engine is
untouched, so the fuzz gate cannot move.

⚠️ **Three existing tests changed, and each one was the gap rather than a
regression:**

1. `protection from a COLOUR is enforced, so it is not mentioned` expected `[]` for
   `Kor Firewalker`. Its second line is "Whenever a player casts a red spell, you
   may gain 1 life." — a real trigger nothing runs. The card is not silent; it is
   silent about the protection, and the test now says both.
2. Two synthetic cards built by the test's own `withText` helper carried Grizzly
   Bears' empty `keywords` alongside text reading `Ward—Discard a card.` or
   `Protection from creatures` — **a shape the real data never produces**, since
   Scryfall always lists the keyword. The helper now takes the keywords a real
   printing would carry, which is the D15b rule (a hand-edited fixture tests the
   edit) applied to a fixture that was only half-synthetic.

## D123 — The engine fixtures now have the guard they claimed to have

D121's reportable list, item 5. `scripts/make-engine-fixtures.cjs` said, in its own
header comment and again in the header it writes into the generated
`src/data/fixtures/engineCards.ts`:

> `scripts/battery-carddb.cjs` cross-checks these against the live database, so a
> Scryfall rewording fails there rather than rotting silently here.

**It did not.** `grep engineCards scripts/battery-carddb.cjs` finds nothing, and
never did. That battery's "Validator assumptions still hold against real cards"
section is D15b's guard for a **different** set of fixtures — the hand-written
`CardData` records in `src/data/validate.test.ts` — and its 15 checks touch
ENGINE_CARDS at four cards (`Wastes`, `Thrasios, Triton Hero`,
`Grist, the Hunger Tide`, `Shorikai, Genesis Engine`) purely because the validator
and the engine happen to care about some of the same cards, and then only in the
one field each pattern reads.

⚠️ **The exposure was larger than the file it was written on.**
`src/engine/testing/harness.ts` builds the engine's entire `OracleDb` from
ENGINE_CARDS, `src/net/testing/table.ts` builds the wire's card pool from it, and
the 500-seed fuzz gate plus `oracleParse.test.ts`, `engineComplete.test.ts`,
`tier3.test.ts`, `manual.test.ts`, `reducer.test.ts`, `net.test.ts` and
`awaiting.test.ts` all sit on top of that. D15b's failure mode — *a stale fixture
tests the fixture rather than the card, and keeps passing forever* — applies with
more force here than where it was written, because the engine keys off exact
wording in more places than the validator does: `Tundra`'s text being literally
`({T}: Add {W} or {U}.)` is what shaped `parseManaProduction`, and D116 then had
to teach that same parser "any TYPE" because `Reflecting Pool` does not say "any
colour".

### `src/data/fixtures/engineCards.node.test.ts`, and why not the battery

The guard is a `.node.test.ts` beside the fixtures rather than the promised
section in `battery-carddb.cjs`, and — exactly as in `botPool.node.test.ts` — that
is **forced rather than chosen**. ENGINE_CARDS is TypeScript; this project has no
TS runner outside Vitest (no `tsx`, no `ts-node`, and Node's type stripping cannot
resolve the repo's extensionless imports). A `.cjs` could only read the generated
file with a regex, which would be a **second reader of the generator's output
sitting beside the generator** — the "second heuristic beside the first" this repo
has now recorded learning to avoid three times (`tier3.ts` twice, D121's
`engineComplete` once).

⚠️ **THE COMPARISON IS `JSON.stringify(record, null, 2)` — the exact bytes the
generator writes — so what is asserted is that REGENERATING WOULD BE A NO-OP.**
That is deliberately stronger than "the wording still matches", and it is what
makes the guard cost nothing to maintain: one comparison catches a reworded oracle
line, a re-typed card, a legality change, a field the projection stopped emitting,
a key-order change, and a hand edit of the file that says DO NOT EDIT BY HAND.
D15b's approach — a list of pinned patterns — only ever covers what somebody
thought to pin, which is precisely how these 86 records went unguarded while 15
checks next door looked like coverage.

⚠️ **The generator's selection rule is reproduced from each FIXTURE'S OWN FIELDS,
never from a second copy of its `WANTED` list.** A copy would be one more thing to
keep in step, and a fixture added to the generator and not to the test would be
unguarded in exactly the way this decision exists to fix. The generator has two
rules and so does the test: a token is pinned by set + collector number (token
names collide wildly — there are hundreds of cards named `Soldier`), and
everything else takes the first printing of that name that is not a token. The
fixture's own `layout` says which rule it was taken under.

⚠️ **A moved field is NAMED, not diffed as a record.** A `CardData` record is
~40 lines of JSON, and "Akroma, Angel of Wrath differs" against 40 lines does not
say what happened. The walk reports leaves —
`faces[0].oracleText: "…" → "…"` — so a failure names the one thing to go and read
on Scryfall. If the NDJSON order ever changes such that a different printing sorts
first, the report is `scryfallId: … → …`, which is the honest answer rather than a
silent re-pin.

⚠️ **The count is pinned at 86 (83 by name + 3 tokens) as its own check**, because
"every fixture matches the live card" is satisfied by an EMPTY fixture list. That
is the green-over-nothing this repo has been caught by four times now — D102 (a
fixture pool with no targeted spell), D107 and D108 (a fuzz `DECK` that could not
reach the rule), D113 (a battery check reporting `skipped — no source left`) — and
a one-line pin is cheaper than being caught a fifth.

⚠️ **It skips loudly with no card database**, the same two-`describe` shape
`oracleParse.node.test.ts`, `botPool.node.test.ts` and `tier3.node.test.ts` use.
The committed fixtures are the whole reason the engine suites run on a machine
that has never synced; a guard that turned a fresh clone red would get deleted.

### Both claim sites were corrected rather than deleted

The generator's comment and the header it emits now name the real guard, and the
generator's comment says what the old claim was and that it was false — the same
reason D122 records what `tier3.ts` used to be silent about. The two were edited
together so a regeneration is a no-op on the header rather than silently reverting
it.

### Verified

**1,077 Vitest passing / 5 skipped across 45 files, 4 of them new** (plus the new
file's own loud-skip marker) **· `tsc -b` clean.** The engine, the parsers and the
fixture DATA are all untouched — the only edits to `engineCards.ts` are three lines
of header comment — so the fuzz gate cannot move; it ran at its default seed count
inside the full suite. `scripts/battery-carddb.cjs` was not touched and was not
run: the correction to the claim about it is a comment elsewhere.

⚠️ **REGENERATION IS A NO-OP, MEASURED RATHER THAN ARGUED.** The committed file was
copied aside, `node scripts/make-engine-fixtures.cjs` re-derived it from the live
database ("Wrote 86 cards"), and the result is **byte-identical — md5
`9604c178269d1c3bdd7e4aa6c7b2255b` before and after**. That is the single strongest
statement available about these fixtures: every one of the 86 records still says
exactly what the real card says today, and the new header is exactly what the
generator emits, so the next regeneration cannot silently revert it.

⚠️ **The guard was checked by BREAKING what it guards**, which is the only way to
know a green tick means anything here. `Monstrous Growth`'s fixture oracle text was
changed by one word — `until end of turn` → `until the end of turn`, the shape a
real Scryfall rewording takes — and the failure is exactly what it has to be:

```
Monstrous Growth [por 173†] — faces[0].oracleText:
  "Target creature gets +4/+4 until the end of turn." →
  "Target creature gets +4/+4 until end of turn."
```

Card, printing, field path, both values. Nothing else in the suite noticed the
edit, which is the rot this decision is about, demonstrated on one card.

⚠️ **The loud skip was checked too**, with `CRT_DATA_DIR` pointed at a directory
that does not exist: the four real checks report as skipped BY NAME, the marker
test passes, and stderr carries `No card database at … Run: node
electron/cardsvc-worker.cjs --sync`.

## D124 — The app taps a Signet and never takes the {1}

D122 left one gap open and named it after `Ancient Tomb`: a mana-ability line the
engine runs only part of. Closing it needed the line looked at properly, and the
shape is bigger and more interesting than that name suggested.

⚠️ **The engine is untouched again.** This is a third disclosure, on the same
terms as D122's two: `tapForMana` does exactly what it did.

### What the engine actually does with these lines

`tapForMana` (`handlers.ts`) finds the source in `manaSourcesOf(…,
{ includeConditional: true })`, emits `PermanentsTapped` and `ManaAdded`, and
**stops**. It takes no cost beyond the tap, checks no activation condition, tracks
no once-per-turn limit, computes no board-dependent amount and applies no second
sentence. So, measured against real cards:

| card | what the app does | what it never does |
|---|---|---|
| `Rakdos Signet` — `{1}, {T}: Add {B}{R}.` | taps it, adds `{B}{R}` | takes the `{1}` |
| `Phyrexian Tower` — `{T}, Sacrifice a creature: Add {B}{B}.` | taps it, adds `{B}{B}` | sacrifices anything |
| `Wall of Roots` — `Put a -0/-1 counter on this creature: Add {G}. Activate only once each turn.` | adds `{G}`, any number of times | the counter, the limit |
| `Temple of the False God` — `{T}: Add {C}{C}. Activate only if you control five or more lands.` | taps it, adds `{C}{C}` | counts your lands |
| `Ancient Tomb` — `{T}: Add {C}{C}. This land deals 2 damage to you.` | taps it, adds `{C}{C}` | the 2 damage |
| `Eldrazi Temple` — `… Spend this mana only to cast colorless Eldrazi spells…` | taps it, adds `{C}{C}` | enforces the restriction |
| `Alena, Kessig Trapper` — `{T}: Add an amount of {R} equal to the greatest power among…` | taps her, adds one `{R}` | the amount |

⚠️ **This is the exact mirror of D122's Krenko**, and the pair of them is the
argument for the whole invariant. Krenko: the cost is charged and the effect
skipped. A Signet: the effect happens and the cost is skipped. Neither was said,
and the second is the one a player will never notice, because it silently helps
them.

### `conditional` is one flag for four different reasons, and it says which for none

`ManaProduction.conditional` is
`extraCost || CONDITIONAL_RE.test(effect) || /\bonly\b/.test(line)`, and its own
comment states the intent exactly: *"Marked conditional, so it stays MANUALLY
tappable. This is the Tier-2/Tier-3 line, stated."* Four things land in it — an
activation cost beyond `{T}`, an activation condition, a spend restriction, and an
amount the engine cannot compute — and the flag records none of them.

That is why this is **ONE note**, `Part of its mana ability`, whose `how` names all
four: *"the app taps it and adds the mana — any other cost, condition or
restriction on that line is yours."* Splitting it into a cost note and an effect
note would have meant re-deriving the reason from the card text beside the parser
that already decided it — the mistake `tier3.ts` has now recorded learning three
times (the Command Tower regex, the `/target/` regex, and D122's punctuation rule).

⚠️ **It is the OPPOSITE statement to the existing `Its mana ability` note**, and
keeping the two apart is the point: that one means the app will not tap the source
at all, so tap it yourself; this one means it WILL tap it and add the mana and do
nothing else. Saying either in the other's place sends a player to the manual tools
for something already done, or leaves them believing a cost was taken. **One line
can never raise both** — a warning from `parseManaProduction` means it recorded no
production for that line, and this note is raised only where it did. Asserted on
`Bloom Tender` (warning, no production → `Its mana ability`) against `Ancient Tomb`
(production → `Part of its mana ability`).

### The measurement

| | cards | of 31,692 |
|---|---:|---:|
| **now say "part of its mana ability"** | **723** | **2.3%** |
| any of the three D122/D124 notes | 21,037 | 66.4% |
| said NOTHING before, say something now | 16,020 (was 15,677) | 50.5% |
| cards with no note at all, AFTER | 1,804 (was 2,147) | 5.7% |
| **run incompletely with a part-run mana line and nothing said** | **0** (was 339) | — |

⚠️ **723 rather than 339, because 384 of them already said something else** —
`Gemstone Mine` was already disclosing the counters line it enters with. The
residual figure counts cards that were *entirely* silent; this one counts cards
whose mana line was being run half-way, which is the population the note is for.

**Everything still unsaid is now a keyword line D68 chose not to name** — 345
cards, `Exalted`, `Undying`, `Bushido 1` — which the pass asserts directly:
`residual === residualKeyword`, and `residualManaLine === 0`.

### The guard that stopped this note lying to 193 cards

`parseManaProduction` tests a line for the word "add" and, with no colon on it,
takes the WHOLE LINE as the effect — so it records a "mana production" for
`Whenever this creature attacks, add {R}`. The first cut of this note labelled any
unaccounted line carrying a production as `mana`, which told **193 cards** that
"the app taps it and adds the mana" about a TRIGGER the app does not notice at all.
Measured, not reasoned: `abilityText` fell from 17,963 to 17,770, and that 193-card
drop is what exposed it.

The fix is a definition rather than a heuristic: **a mana ability is an activated
ability (CR 605.1a)**, so `kind: 'mana'` requires `splitAbilityLines` to have
called the line `activated`. Those 193 stay `sentence`, where D122's "nothing
happens by itself" is the true answer. `abilityText` is back to exactly 17,963,
which is the receipt.

### Reportable, and deliberately not fixed here

1. **`parseManaProduction` reads text the card GRANTS to something else, and
   reminder text, as its own mana ability — 310 Commander-legal cards.** It matches
   "add" on the RAW oracle text and never calls `scrub`, so `Noggle Robber`'s
   Treasure reminder (`(It's an artifact with "{T}, Sacrifice this token: Add one
   mana of any color.")`) and `Lotus Ring`'s `Equipped creature … has "{T},
   Sacrifice this creature: Add three mana of any one color."` both record a
   production **on the card itself**, with `requiresTap` read from the `{T}` inside
   the quotes. `manaSourcesOf` includes conditional productions for the manual tap
   menu, so reading that path says a 2/2 Noggle Robber is offered as a tappable
   mana source. Measured in the data and read in the code; **not verified at a
   table**, which is why it is reported rather than claimed. `scrub` exists for
   exactly this and `engineComplete.ts` already uses it on the same lines. Pinned
   as `strayMana` in `tier3.node.test.ts`.
2. **`ManaChoice.tsx`'s own disclosure is wrong for most of this population.** The
   tap menu draws a conditional option with a dashed edge and says *"Dashed mana is
   restricted — the card says what it may be spent on, and honouring that is
   yours."* That is true of a spend restriction and false of the other three
   reasons: a Signet's `{1}` is not a restriction on what the mana may be spent on,
   and neither is Temple of the False God's land count nor Alena's amount. It is the
   one place a player meets this at the moment they use it, and it needs the same
   four-way wording this note now carries. Left alone because it is UI copy on a
   different surface, outside a disclosure change to `tier3.ts`.

### Verified

**1,077 Vitest passing / 5 skipped (10 new in `tier3.test.ts`)**, `tsc -b` clean,
`npm run build` clean, and `botPool.node.test.ts` reproducing every pinned number —
the refactor added a second line-index set and left `modelled` exactly as
`manaLines` was, so completeness verdicts are unchanged: 1,405 pool cards, the same
by-type split, 31,692 distinct, 6,975 spells, 269/1,359/273, 12,500/1,114.

## D125 — Two prompts nothing could answer: one deleted, one made answerable

D121 reported five defects it deliberately did not fix. Items 3 and 4 were both
`Awaiting` variants that no client — bot or human — could answer, which is to say
two latent hangs of exactly the shape D102 records costing this project three
sign-off checks for weeks. They were invisible for the same reason as each other:
**nothing raises either of them today**, so no suite ever tried.

They needed opposite fixes, and the difference between them is the rule worth
keeping.

| | `assignCombatDamage` | `orderAttackers` |
|---|---|---|
| answering intent | **none** — no `AssignCombatDamage` in `intents.ts` | `OrderAttackers`, since M3 |
| handler | none | `handlers.ts`, validating against `state.combat` |
| UI | `PromptBar` described it and rendered **no button** | the aim veil's existing block gesture |
| what a client could say | nothing | the wrong thing: `CardView.blocking` was ONE id |
| fix | **deleted from the union** | `blocking` became an array |

### A variant needs BOTH halves, and that is now stated on the union

An `Awaiting` variant is only real if something can answer it **and** a client can
compute that answer. `assignCombatDamage` had neither; `orderAttackers` had the
first and not the second. Either shape is a hang the moment a producer appears,
and a hung game is indistinguishable from a healthy idle one from outside — the
whole of D102 in one sentence. The rule is written on the union in `state.ts`
where somebody adding a fourteenth variant will read it.

### Deleting it, rather than building it

D44 Q5 made combat damage assignment **automatic** and left
`options.manualCombatDamageAssignment` as "the seam, unused in v1". Nothing ever
used it: no screen could set it, `DEFAULT_OPTIONS` had it false, and no producer
read it. So the union carried a prompt that only an unreachable option could
raise and only an unwritten intent could answer.

⚠️ **Implementing it would have been half a feature, which is the one thing this
project does not do.** CR 510.1a–d assignment is a real decision only when an
attacker is blocked by two or more creatures — and the ORDER those blockers are
assigned in is `orderBlockers`, which has no producer either. Asking a player to
divide damage down an order they were never allowed to choose is D90's
"never half-execute" with combat maths on top. The option and the variant are
gone; `assignAttackerDamage` is unchanged and still the whole behaviour.

`GameOptions` lost a field, so `DEFAULT_OPTIONS` and the spec's §6.4 paragraph
went with it. The Tier-1 table in AGENTS.md always said combat damage was fully
automatic; now nothing in the code contradicts it.

### `CardView.blocking` is an array, and `GameState` always was

`orderAttackers` asks which attackers a given blocker is blocking, in order.
`BlockerDecl.attackerOrder` has been a `readonly InstanceId[]` since M3 —
`project.ts` was throwing all but the first away with `attackerOrder[0]`, so the
one prompt whose answer IS that list could not be answered from a `PlayerView` at
all. Not a rules gap; a lossy projection.

⚠️ **The order is load-bearing.** `assignBlockerDamage` divides the blocker's
power down this list, so re-sorting it changes who dies. The bot re-sorts its
ANSWER (weakest first, to spend power where it kills something) and never
re-derives the membership — the handler checks `sameSet(decl.attackerOrder,
intent.order)`, exactly these attackers and no others, so a short list is
rejected. Where the view and the prompt disagree the bot still **faults** rather
than guessing: a guess puts combat damage on the wrong creature.

⚠️ **Two identity traps, both D21's.** `blocking` is handed over BY REFERENCE
from the state array, so an unchanged combat re-projects to the same array; every
not-blocking card shares one frozen `NOT_BLOCKING` rather than allocating `[]`
per card per commit. And `sameCardView` compares it BY CONTENTS — a reference
compare would rebuild every blocker's `CardView` whenever anything else in combat
moved. The fixture table needed the mirror of the same rule: it hands its
instance array to the view, so `declareBlockers` builds a NEW array instead of
`push`ing, or `sameCardView` would compare an array against itself and report no
change — a blocker that never re-renders.

⚠️ **The UI needed one real fix, not just a type change.** `packRow`'s auto-stack
key was `c.blocking ?? '-'`; it is the joined list now, because two creatures
blocking different attackers must not group into one slot (D19 groups by
"identical", and what a creature is blocking is part of that).

### The producer map is asserted now, not remembered

`src/engine/awaitingProducers.node.test.ts` reads the union out of `state.ts`,
scans every non-test source file for a constructed `kind: '…'`, and pins the map:
**10 of the 12 kinds have a producer.** The two that do not are `orderBlockers`
and `orderAttackers`, named in a `NO_PRODUCER` constant with the reason — the
engine takes the declaration order and never asks — and a test asserting each
still has an intent AND a handler. **That is the test that would have caught
`assignCombatDamage`**, which sat in the same "no producer" position with neither.

Four more assertions, each closing a way the map could quietly go stale: every
kind is produced or named (a thirteenth variant fails on whichever side it falls);
every kind claimed as produced names a real `file:line`, so a broken scanner
cannot pass by matching nothing; only `src/engine/` constructs a prompt, because
`apply` is the only writer of `state.priority.awaiting` and a prompt fabricated in
the UI would be a second source of truth with no event behind it; and every kind
has a case in `src/bot/awaiting.ts`, the runtime echo of its `never` check.

⚠️ **`testing/` and `fixtures/` are excluded from the scan on purpose.** A
harness that hand-builds a prompt proves nothing about what the engine raises in
play, and counting one as a producer turns "this cannot happen" into "this happens
only in a test" — the same blindness from the other side.

⚠️ **Checked by breaking it, twice.** A thirteenth variant added to the union
fails three checks by name (`canaryThirteenth` appears in every message); a
producer removed from `loop.ts` fails two and names `orderTriggers`. Both reverted.

⚠️ **`src/bot/awaiting.test.ts` asserted eleven of thirteen ACT and now asserts
all twelve do** — there is no deliberate fault left in the bot. Its fixture board
gained a creature blocking TWO attackers, because with a single-block board the
`orderAttackers` answer is indistinguishable from the one-id field it replaced and
the case the change exists for would go untested. Its `PROMPTS[9]` / `PROMPTS[11]`
lookups became lookups BY KIND: an index into a list whose length is the thing
under test silently re-points at a neighbour the first time the list changes,
which is precisely what deleting a variant did.

### And the third answerer had the same defect

`src/engine/testing/harness.ts`'s `simplestAnswer` — the driver `answer()` and the
fuzzer's `default:` branch both run through — returned a bare `null` for
**`mulliganBottom`** and **`rewindVote`**, plus `orderBlockers` and
`orderAttackers`. `answer()` throws on a null and the fuzzer submits nothing ever
again: D102's shape exactly, in the file D102's own repair touched.

⚠️ **The first two HAVE producers.** `loop.ts` raises `mulliganBottom` whenever a
kept hand owes cards to the bottom, and `handlers.ts` raises `rewindVote` on any
`ProposeRewind`. These were live wedges, not theoretical ones.

⚠️ **What hid them is the useful part.** The 500-seed gate never hit either:
`answerFor` carries its OWN randomised `mulliganBottom` case ahead of the
fallthrough, and the fuzzer never proposes a rewind at all. So the fallback was
unreachable *from the one thing that runs it ten thousand times a night* — a
fixture that cannot reach a code path is how that path rots (D102), here in the
fallback rather than in the card pool.

Answers, and why each is the one that terminates:

- **`mulliganBottom`** — the first `count` cards in hand order. `slice` is the one
  form that cannot name a card twice; the handler checks `hand.includes` per card,
  which a duplicate would pass.
- **`rewindVote`** — **decline**, from the first living seat that has not voted
  (the proposer is auto-agreed at proposal, and a second vote from one seat is
  rejected). One decline cancels the vote outright at any table size, because
  `voteRewind` short-circuits on the first. ⚠️ **Agreeing would HALF-EXECUTE a
  rewind**: unanimity only clears the awaiting, and the actual re-fold is
  `Game.rewind`, deliberately not a reducer case, so a single-`Intent` answerer
  that agreed would leave the vote passed and the log never rewound. `CancelRewind`
  is the recovery branch — it has no preconditions at all.
- **`orderBlockers` / `orderAttackers`** — the state's own `blockerOrder` /
  `attackerOrder`, verbatim. Both handlers check `sameSet`, so the existing order
  is the answer always accepted, and re-deriving membership would be a second
  opinion about what is blocking what. Neither has a producer, which is exactly
  why they sat at `null` for three milestones.

⚠️ **`state` is REQUIRED now, not optional.** Its own comment had to warn that a
caller omitting it CANCELS every cast that asks for a target; an argument whose
absence silently degrades every answer is a trap rather than a convenience. Both
real callers passed it already, so the change costs nothing and makes the next
omission a compile error — and four of the answers above need it outright.

### And the return type is `Intent`, which is what makes it stay fixed

Three more nulls hid in `x ? … : null` ternaries — `mulligan` with an empty player
list, `declareBlockers` with everyone already submitted, `chooseLegendKeep` with no
candidates. All three are prompts their own producers make impossible
(`advanceMulligan` returns early through `mulligansComplete`; the blockers handler
emits `AwaitingSet null` on the last submit; `findLegendChoice` skips any group
under two copies) — but "impossible" is a fact about today, and a ternary that
fires once is the same wedge as a bare `null`.

Each answers now, and `simplestAnswer` returns **`Intent`, not `Intent | null`**.
That is the part worth keeping: "the driver always has an answer" is a fact about
the TYPE rather than about the current set of branches, so a case added later that
cannot think of one fails `tsc -b` instead of quietly restoring the wedge.
`answer()` lost its `no simple answer for prompt "…"` branch entirely — it is
unreachable, and it was the wrong error anyway.

⚠️ **AN ANSWER MAY STILL BE REJECTED, AND THAT IS THE ARGUMENT FOR IT.** For a
malformed prompt the driver names a seat from the prompt, else any seat, else an
id no seat has; `chooseLegendKeep` answers with `<no-such-card>`. The handler then
rejects it and `answer()` throws with the HANDLER's message — "That is not one of
the copies you control" — which points at the malformed prompt. `no simple answer
for prompt "chooseLegendKeep"` pointed at the driver, which is the one place the
fault was not.

⚠️ **Checked by restoring the three ternaries: both malformed-prompt tests fail**,
the second with `Cannot read properties of null (reading 't')` — the raw crash a
null answer produces now that nothing guards it, which is a fair picture of what
"the driver returned nothing" is worth as a diagnostic.

`src/engine/simplestAnswer.test.ts` reaches every prompt **for real** rather than
hand-building it: a genuine double mulligan for `mulliganBottom`, a genuine
`ProposeRewind` for `rewindVote`, and a genuine double block for the order prompts,
each answer SUBMITTED because only the handler can say it is legal. ⚠️ Two
mulligans for one bottomed card, not one — the free first mulligan is on by
default (D44 Q2), so a single mulligan owes nothing and the prompt never appears.
⚠️ And the bottoming is asserted on the `MulliganBottomed` EVENT, not on zone
sizes: answering the last mulligan lets `pump()` run several turns inside that one
submit, p1 draws in there, and "hand is one smaller" comes back 7 — which reads as
the bottoming having silently failed.

⚠️ **Checked by restoring the nulls: 5 of the 8 fail**, two of them with the wedge
named in the message — `no simple answer for prompt "mulliganBottom"` and
`… "rewindVote"`.

### Verified

**1,092 Vitest passing / 5 skipped across 47 files** (up from 1,077: 6 in the new
`awaitingProducers.node.test.ts`, 8 in `simplestAnswer.test.ts`, plus a
multi-block projection case and three in the bot suite) **· `tsc -b` clean ·
`npm run build` clean · 129/129 in `battery-anim.cjs table combat bot engine` ·
the 500-seed replay fuzz gate green at 92,778 accepted intents / 2,257,235 events
/ 17,196 turns.** The gate matters here because `GameOptions` is part of
`GameState` and so of the state hash.

⚠️ **Those three counters are byte-identical to D121's**, and that is the
assertion, not a coincidence: removing an option nothing read and widening a
projection field must not change a single event the engine emits. A move in any
of them would have meant this touched play, which it must not. The `simplestAnswer`
repair was predicted not to move them either, for a stated reason — the fuzzer
answers `mulliganBottom` itself and never proposes a rewind — and did not.

⚠️ **The battery sections were chosen because `src/ui/` genuinely changed** —
`beats.ts` reads `blocking` to decide who is posed in combat, and `packRow.ts`
keys auto-stacking on it. `table` and `combat` cover both; `bot` and `engine`
cover the answering side.

⚠️ **Three of D121's five reportable items are now closed** — 1 and 2 by D122,
3 and 4 by this entry, 5 by D123. None remain.

## D126 — The bot plays properly, and the 95% bar does not survive being measured

M6.2. An evaluation function, a combat solver that prices a whole attack rather
than each attacker alone, and a tournament that puts a confidence interval on
what any of it was worth. **Level 1 beats the legal-random baseline 82.8% of the
time [79.2%, 85.9%] over 500 games.** The M6 brief asks for ≥ 95%; it does not
get it, and the reason is measured rather than guessed.

### Level 0 exists now, and it is not a difficulty

The brief requires every level to be measured against legal-random, so
`src/bot/random.ts` is that player: pick uniformly from the legal actions, attack
with a random subset, never block. It is **not offered in the lobby** — an
opponent whose whole description is "deliberately bad" is not a choice anybody
wants, and shipping it would make "difficulty" mean two things.

⚠️ **It is random and perfectly deterministic.** The RNG is seeded from the
POSITION — seat, state hash, event count — rather than carried as mutable state,
so the same board always makes the same "random" choice, a bot game still replays
to the same hash, and there is nothing to thread through the log. That is also
what lets it live in `src/bot/`, which may not call `Math.random` at all.

⚠️ **It answers prompts through the shared `answerAwaiting`** except the two
where randomness is the point. Randomising `chooseTargets` or `mulliganBottom`
would not make a worse player, it would make one that wedges (D102).

### The evaluation function, and the unit that makes it arguable

`src/bot/eval.ts` — `scorePosition(view, me)` in **life-equivalent points**, so
every weight can be argued about in words: "a 2/2 is worth about four life" is a
claim somebody can disagree with, where "a 2/2 is worth 37" is not. Board,
life at 0.35, poison, mana development with diminishing returns, hand size at
1.5, and the commander clock — 21 damage is a second life total, so each point
is worth roughly two of the 40 and more as it approaches lethal.

⚠️ **Me minus the BEST opponent, never minus the sum.** Commander is a
free-for-all and you lose to whoever is ahead; a seat crushing one opponent while
a third builds a board is not winning, and summing would say it was.

⚠️ **The commander is NOT worth more than its body.** It comes back — that is
what the command zone is for — so pricing it as irreplaceable would refuse every
profitable attack the bot could make with the best creature it owns.

⚠️ **An opponent's hand is in `zones` AND in `hiddenCounts`.** `project.ts` keeps
the real ids (with `card: null`, so geometry is right) and also writes the
length. Adding them read every opponent as holding twice the cards they do — the
larger of the two, never the sum.

### The attack model: a set, not a list of attackers

⚠️ **THE BIGGEST SINGLE FINDING OF M6.2.** The first version priced each attacker
against the defender's best blocker on its own and refused the attack if that
exchange was bad. So ONE well-placed creature vetoed a swing by five, and the bot
attacked barely more than a random one — **measured at 9.8 attackers per game
against level 0's 12.3, while winning 62.5%.** A defender has a fixed number of
blockers and must SPEND them; everything past that number connects.

`attackSetValue` assigns the defender's blockers greedily onto whichever
attackers gain them most, then prices what is left. `chooseAttacks` drops the
weakest attacker until the SET is worth attacking with. The bot now swings with
14.6 a game and finishes its opponent on 0.1 life.

⚠️ **`couldBlock` is the one place in the bot that guesses at a rule**, and it has
to: the attack prompt says who may attack and nothing about who may block, so
planning an attack means predicting a declaration that has not happened. It reads
PRINTED keywords, so a granted evasion is invisible to it (layer 6, D82), and it
errs toward "yes" — a blocker wrongly assumed possible makes the bot cautious,
one wrongly assumed impossible loses creatures. It is never a legality claim;
`chooseBlocks` reads the host's real pairings.

### Three constants, swept and baked in — and the guard that made that mandatory

| knob | swept | chosen |
|---|---|---|
| `CLOCK` — damage is a clock, not a one-off | 1 / 2 / 3 → 74% / 78% / 78% | **2** |
| `SAFETY` — life left exposed to the swing back | 0.25 / 0.5 / 0.75 / 1.0 → 76% / 79% / 79% / 77% | **0.5** |
| flat value for damage prevented | 0 / 0.5 / 1.0 / 1.5 → 79% / 75% / 74% / 73% | **0** |

⚠️ **The third row is a fix that was not one.** Blocking values damage prevented
at `saved * need`, and `need` is 0 at a full life total — so an even trade (block
a 2/2 with a 2/2, both die) scores exactly 0 and is declined. That reads like a
bug. Paying a flat rate for it is WORSE: the win rate fell to 74%, attacks
dropped from 14.0 a game to 12.8, and the opponent finished on 4.4 life instead
of 1.1. **It was blocking instead of racing**, and in a game where both seats
start on 40 the race is what closes it. The original was right.

⚠️ **AND THE KNOBS COULD NOT STAY.** They were `process.env` reads during the
sweep, which `purity.node.test.ts` bans in `src/bot/` — so a tuning knob left
behind fails `tsc -b` rather than shipping as configuration nobody sets. The
guard turned "remember to bake these in" into "the build will not let you
forget". These are constants with a measurement beside them, not settings.

### Survival is a rule, not a weight

⚠️ **The tournament could not see this and the regression harness could.** Eight
life, a 4/4 and a 4/4 attacking, a 2/2 and a 2/4 to block with: every trade
scores zero or worse, so the bot declined both blocks and died. A human answers
that position instantly.

Raising the chump multiplier fixes that position and LOSES games (79% → 77% at
×2) because it also chump-blocks when merely behind. A threshold cannot be both.
So trades are priced, and **not dying is not a trade**: while the damage on the
table is lethal the bot blocks whatever it can at any price, spending its
CHEAPEST body rather than its best trade. Worth 4 points — 79% → 82.8%.

⚠️ Trample is counted properly when it does: chumping a 6/6 trampler with a 2/2
stops two damage, not six, and the bot correctly declines a block that does not
save it. Two of this harness's first three failures were the TEST being wrong
about that, not the bot.

### The measurement, and why 95% is not reachable here

`src/bot/tournament.node.test.ts`, run by **`scripts/battery-bot.cjs`** — the
name the brief asks for. A launcher rather than a battery, forced by the same
constraint as `botPool.node.test.ts`: the policies and the host are TypeScript
and there is no TS runner outside Vitest.

⚠️ **Every seed is played TWICE, once from each side.** Going first is a real
advantage, so a fixed seating measures turn order as much as policy.

⚠️ **A MIRROR MATCH on a deck that plays Magic.** Same list both sides, so a deck
edge cannot be read as a policy edge. And 40% lands rather than `fixtureDeck`'s
60% — on that deck each seat cast six spells across seventeen turns, boards never
got past three creatures, and level 1 measured 62–67% with an interval from 43%
to 79%: an instrument that could not see the thing it was pointed at.

⚠️ **Wilson, not the normal approximation.** At 40 wins from 40 the textbook
interval is [1.00, 1.00] — an impossible claim — where Wilson gives [0.91, 1.00].
A gate built on the wrong interval passes on a sample far too small to have
earned it. Pinned against published values in its own test.

**The bar is missed, and the reason is that the baseline is not weak.**
"Legal-random" with a creature deck plays a land nearly every turn, casts real
creatures and attacks with about ten a game; its only true mistakes are that it
never blocks and that its attacks are random. A heuristic player's edge over that
is a couple of creatures a game, not a landslide.

⚠️ **And the losses are NOT mana screw**, which is the first thing to suspect and
is measurable: level 1 finishes with **7.5 lands in the games it wins and 9.1 in
the games it loses** (7.4 / 8.9 on a separate 300-game run). Screw would show the
opposite. Its losses are longer games, not starved ones.

The gate therefore asserts what is true and useful: the interval excludes 50%
(the brief's own statistical requirement, met decisively), a 75% floor with room
for variance, zero faults, under 5% draws, and over 20 decisions per second.
⚠️ The floor is asserted on the POINT estimate only at ≥ 200 decided games; below
that the sample is asked the weaker true question ("can it rule 75% out?"),
because a floor that fails one run in twelve by luck teaches people to re-run
rather than to look.

### Verified

**1,127 Vitest / 5 skipped across 49 files** (30 new, up from 1,097: 19 in
`decisions.test.ts`, 7 in `tournament.node.test.ts`, and 4 the purity block picks
up for `eval.ts` and `random.ts`) **· `tsc -b` clean · `npm run build`
clean · `node scripts/battery-bot.cjs --games 40` green · `battery-anim.cjs bot`
12/12 unchanged · the 500-seed fuzz gate unmoved** — `src/bot/` is not
`src/engine/`, so a moved counter would mean something landed in the wrong place.

Measured over 500 games at the gate, and reproduced on a second 500-game run:
**414/500 = 82.8% [79.2%, 85.9%]**, 0 draws, 21.7 turns per game, 2,197 events
per game, **135 decisions per second**, 0 faults. Level 1 finishes on 28.1 life
against level 0's 0.1.

⚠️ **`scripts/battery-bot.cjs` spawns `process.execPath` on vitest's own entry,
not `npx`.** Spawning `npx.cmd` without a shell fails with `EINVAL` on Windows
under current Node, and spawning it with one means hand-quoting arguments.

## D127 — What each missing primitive is worth, measured before any of them is built

M6.3's first job, and the M6 brief is explicit that it comes before the work:
*"You cannot script twenty thousand cards until the engine can express what they
do. Before generating anything, enumerate the missing decision primitives and
build them… Measure the unlock: for every primitive, report how many
Commander-legal cards become executable because of it. **That number is how you
decide what to build next.**"*

`src/data/primitives.ts` + `src/data/primitives.node.test.ts`. **No primitive is
built yet.** This entry is the measurement and the order it decides.

### The distinction the whole report turns on

⚠️ **`scriptable` is not a primitive — it is the absence of one.** A card reading
"When this creature enters, draw a card" needs nothing new: the trigger bus has
existed since M3 (`triggers.ts`), `TriggerDef` and `StaticDef` are consumed
(`turn.test.ts` registers a trigger, `derive.test.ts` a static), and
`effectParse`'s vocabulary already contains "draw a card". What it lacks is a
per-card SCRIPT, which is M6.4. Counting it as a primitive gap would have sent
this milestone off to build something that already works.

So every unaccounted line is first asked *could a script express you today* — and
that question is put to **`parseEffects`, the same closed vocabulary the engine
runs**, never to a second list. Third time this project has had to say it (the
Command Tower lesson in `tier3.ts`, then D122's ledger).

⚠️ The one deliberate lie to a parser in the file: `isInstantOrSorcery: true`.
`parseEffects` refuses a permanent outright, which is right for the ingest and
useless here — the question is not "does this resolve by itself" but "is this
sentence inside the vocabulary a script could return events for".

### The brief's seven primitives were not the answer

⚠️ **Classifying against §6.1's list alone left 68.7% of blocked cards
`unclassified`**, and a black box cannot decide a build order. Two whole families
were missing from the brief, and both are large:

- **The effect vocabulary.** `effectParse` has ELEVEN kinds — damage, destroy,
  exile, counter, bounce, pump, tap, untap, draw, gainLife, loseLife. Creating a
  token, putting a counter, sacrificing, milling and searching are not among
  them, so a trigger bus that fires perfectly has nothing to say. **Widening the
  vocabulary is a primitive.** The events already exist: `TokenCreated` and
  `CountersChanged` have been on the log since M3 and D107 respectively, reached
  today only by the Tier-3 tools.
- **Keyword abilities the engine does not run** — Equip, Enchant, Cycling, Crew,
  Convoke. Not sentences, so every sentence-shaped rule declined them; `Equip {2}`
  alone was 448 cards across three costs.

Three sharpenings after that took the residue to **44.7%**, and what remains is a
genuine long tail — the largest single shape is 327 cards of 13,551. That tail is
per-card text, which is exactly what M6.4 exists for.

### The table

Over **31,692** distinct Commander-legal cards: **1,405 run completely today,
30,287 are blocked.**

**SOLE NEED** — blocked cards waiting on this primitive and nothing else, so
building it alone makes them scriptable. The honest column.

| | | |
|---:|---|---|
| 6,637 | 21.9% | unclassified (the long tail) |
| **2,012** | 6.6% | **optional** — "you may" |
| **1,722** | 5.7% | **layer 6** — granting an ability |
| **1,441** | 4.8% | **effect: counters** |
| **1,123** | 3.7% | **effect: token** |
| 933 | 3.1% | effect: sacrifice |
| 795 | 2.6% | scriptable *(already possible)* |
| 755 | 2.5% | choose from a zone |
| 674 | 2.2% | duration beyond end of turn |
| 418 | 1.4% | replacement |
| 345 | 1.1% | another keyword ability |
| 234 / 176 / 163 / 116 / 116 / 84 / 34 | | search · mill · cost modification · alternative cost · choice · delayed · modal |

**CUMULATIVE** — cards that become scriptable as each is built, in reach order:

```
   795  scripts alone            6,656  + effect:counter      13,490  + replacement
 2,915  + optional               8,286  + effect:token        14,525  + duration
 4,870  + layer6                10,717  + effect:sacrifice    16,736  + all nineteen
```

⚠️ **THE HEADLINE: the first four primitives take what is scriptable from 795 to
8,286 — 10.4× — and all nineteen reach 16,736, a 21× multiplication.** That is
the build order, and it is not the brief's list order: `modal` and `delayed`,
which §6.1 names, are worth 34 and 84 cards respectively.

⚠️ **`optional` is first and it is the cheapest thing on the list.**
`TriggerDef.optional` has been in the script API since M3, `collectTriggers`
copies it onto every `PendingTrigger`, `PendingTrigger.optional` is a field on
`GameState` — and **nothing anywhere branches on it.** A "may" trigger fires
unconditionally today, which is half-execution in the one direction D90 forbids:
doing something the player never chose. What is missing is a prompt and an answer.

### The scoping finding, which the plan has to absorb

⚠️ **SCRIPTABLE IS NOT EXECUTABLE, so M6.3's done-when cannot be met by M6.3.**
The brief says M6.3 is done "when the number of completely-executable
Commander-legal cards has multiplied". A primitive makes a card *possible* to
script; the card still needs its script written, and that is M6.4. `1,405` moves
only when scripts land. The two milestones have to be read as one arc — build a
primitive, write the scripts it unlocks, measure — and this is a fact about the
plan rather than about the work.

### Verified

`src/data/primitives.node.test.ts` — 4 checks over the real 113,559-card
database, with the build-order numbers and the 10.4× multiplication **pinned as
exact values**, so the order cannot silently stop being the right one: every
figure moves when a parser widens, which is precisely when it should be re-read.
A `discriminates` canary keeps the residue under half and `scriptable` non-zero —
a classifier that filed everything under one bucket would pass every other check.

⚠️ It is a MEASUREMENT and nothing in the engine or the bot reads it. It
classifies English, so it is approximate by construction — which is why
`unclassified` is reported rather than swallowed. A classifier with no residue is
lying about something.

## D128 — "You may": the first M6.3 primitive, and the flag nothing branched on

M6.3's first build, chosen by D127's measurement rather than by the brief's list:
`optional` is worth **2,012 cards by sole need** — more than any other primitive
— and it was also the cheapest thing on that list, because most of it already
existed.

`TriggerDef.optional` has been in `src/engine/scripts/api.ts` since M3.
`collectTriggers` has copied it onto every `PendingTrigger` for as long, and
`PendingTrigger.optional` has been a field on `GameState` for as long again.
**Nothing anywhere branched on it.** A "may" trigger fired unconditionally —
half-execution in the one direction D90 forbids: not failing to do something, but
doing something the player never chose.

What was missing was a prompt, an intent, and a resolution path that honours the
answer.

### Where the choice is made, and why it is not where the trigger fires

CR 603.1: a "may" trigger uses the stack like any other, and the choice is made
by its controller **on resolution**. So the prompt is raised from `resolveTop`,
not from `drainTriggers` — the ability still goes on the stack, still takes an
APNAP position, can still be responded to, and only then asks.

That placement is what made the change small. `resolveTop`'s ability branch is
the only thing that grew a decision:

```
top of stack is a triggered ability
  |- its TriggerDef says optional?
       |- no  -> resolve it (unchanged)
       \- yes -> AwaitingSet{optionalTrigger} ... the engine stops
                   AnswerOptionalTrigger -> resolveAbility(..., accept)
```

⚠️ **ONE RESOLUTION, TWO CALLERS.** `resolveAbility` is extracted, not copied:
`resolveTop` calls it for every ability and `handlers.answerOptionalTrigger`
calls it with the player's answer. A second implementation of "leaves the stack,
runs its script, narrates" would eventually disagree with the first about the
order of those three, and that difference is invisible until a card kills its own
source. The same reasoning D90 used for the assisted path running the automatic
path's `effectEvents`.

⚠️ **`AwaitingSet null` GOES FIRST in the handler's batch**, and it is not
cosmetic. The resolution runs through `applyReplacements`, which can raise a
prompt of its own — a commander heading for a graveyard — and clearing the
awaiting afterwards would wipe it.

⚠️ **The answer names the STACK OBJECT, not just the player.** An answer that
named only a seat would resolve whatever happened to be on top by the time it
arrived. Both a wrong seat and a stale `stackId` are rejected, and the prompt
SURVIVES a rejection — which is what makes it recoverable rather than a wedge.

⚠️ **A player who is out of the game is never asked.** Their answer is not in
doubt, and CR 800.4a goes further still (a departed player's objects on the stack
cease to exist, which this engine does not model), so the ability resolves having
done nothing. Checked by deleting the guard: exactly its own check fails, by
name. ⚠️ It does **not** hang the suite when deleted — `simplestAnswer` cheerfully
answers for a seat that has conceded — and that is the argument FOR the guard
rather than against it: whether a real client still speaks for a departed seat is
not a property `src/engine/` can see.

### The decision is an EVENT, because the board cannot show it

`OptionalTriggerAnswered` is a marker: `apply` returns the state unchanged,
exactly as `StateBasedActionsApplied` does, and the consequences travel as their
own events beside it. It is there because **a declined trigger and a trigger
whose effect happened to do nothing leave an identical board.** The log is the
only place that difference can live — and it is also what lets the fuzz gate
count both answers instead of assuming it reached them.

The narration says it in the reader's own person (D101): `You decline Ajani's
Mantra — gain 1 life.` / `Ana uses Ajani's Mantra — gain 1 life.` Both forms are
written at the call site; no morphology is derived.

### Thirteen kinds, and five places that failed on purpose

The `Awaiting` union went from 12 to 13, and D125 hardened five places against
exactly that. **Every one of them failed until it was updated, which is the guard
working:** `state.ts`'s union, `awaitingProducers.node.test.ts`'s pinned map (now
**11 producers of 13 kinds**), `testing/harness.ts`'s `simplestAnswer` (which
returns `Intent`, not `Intent | null`, so a case that cannot answer fails
`tsc -b`), `src/bot/awaiting.ts`'s exhaustive switch, `src/net/testing/script.ts`,
and `PromptBar`'s viewer branch.

Two of the answers deliberately differ, and the difference is the point:

- **`simplestAnswer` DECLINES.** It is the driver every rules test runs through,
  and its stated policy is "decline, keep, attack with nothing". Declining runs
  no script, so it is legal whatever the board has become — and accepting would
  make every `advanceUntil` in the suite silently execute card text the test did
  not ask for.
- **The bot ACCEPTS**, and it is a POLICY rather than a measurement, stated as
  one. A "may" prompt carries a LABEL and nothing else; the effect is a card
  script, and `src/bot/` may not import an engine module that takes a `GameState`
  (invariant 3), so no honest evaluation exists at this seam. What does exist is
  the reason the card is in the deck: an optional trigger on your own permanent
  is written to be worth taking, and a bot that declined every one would play a
  strictly worse card than the one it drew. ⚠️ **It is unreachable today** — the
  bot's deck holds only cards `engineComplete` accepts, and D121 measured zero
  enchantments and zero planeswalkers in that pool. The first scripted "may" card
  a bot can hold is when this has to become a per-card judgement, and M6.4 is
  where the information to make one arrives.

### Proved on a real card, because a fixture trigger proves nothing

`turn.test.ts`'s `upkeepTrigger` resolves to `[]` — it exists to show APNAP
ordering — so until now **no real card's real text had ever run through the
bus.** `src/engine/testing/cardScripts.ts` registers `Ajani's Mantra`: `{1}{W}`,
and its whole printed text is `At the beginning of your upkeep, you may gain 1
life.` A script for it therefore runs every word of the card (D90) rather than
most of one, which is what makes it a fair proof rather than a fixture shaped to
fit the feature.

Chosen from the 276 single-sentence "may" cards in the database for three
measured reasons: the effect is inside `effectParse`'s existing vocabulary, so no
second primitive is needed to demonstrate this one; it keys on `StepBegan` rather
than on `CardsMoved`, so the fuzz gate's bus stays cheap; and it is bounded at
once per upkeep per copy, so a 4-seat game cannot drown in prompts. It is also an
**enchantment** — the type D121 measured the engine running exactly zero of.

⚠️ **The script CHECKS the printed text at import** rather than commenting it.
D90's rule is a claim about the words; the words live in a generated fixture, and
`engineCards.node.test.ts` re-reads that fixture from the live database — so a
Scryfall rewording throws with the new text in the message instead of quietly
running a script written for a sentence that no longer exists.

⚠️ **It is NOT shipped.** `EMPTY_REGISTRY` is still what the app runs. Landing
scripts into the product is M6.4, and that carries an accounting obligation a
test registry does not: a card's `tier3.ts` note must go silent and
`engineComplete` must accept it, in the same commit.

### The fuzz gate had never run the trigger bus at all

The brief asked for a card in `DECK` that reaches the new prompt. Adding one was
not enough, and finding out why is the larger result: **`collectTriggers`
short-circuits on `scripts.size === 0`, and the gate ran `EMPTY_REGISTRY`.** In
500 seeds no `PendingTrigger` had ever existed, `orderTriggersApnap` had never
sorted anything, `drainTriggers` had never put an ability on the stack, and
`orderTriggers` — a prompt with a real producer in `loop.ts` — had never been
raised. A card in the deck with no script would have been the
D102/D107/D108/D121 failure with an extra step.

So the gate builds a registry now. Measured, 500 seeds:

| | before (D121/D125) | after |
|---|---:|---:|
| accepted intents | 92,778 | **93,267** |
| events | 2,257,235 | **2,290,878** |
| turns | 17,196 | **17,301** |
| triggered abilities on the stack | **0** | **1,198** |
| may-triggers taken / declined | 0 / 0 | **621 / 566** |

Every per-seed replay hash still matches. The three headline counters moved by
+0.5%, +1.5% and +0.6% — the right size for a change that adds one prompt and one
card, against D119's stop-policy fix which moved turns by +86%.

⚠️ **The fuzzer answers with a COIN FLIP, not through `simplestAnswer`.** That
fallthrough always declines, and declining runs no script — so the ACCEPT half of
the primitive, the half that is the entire point, would have gone untaken in all
500 seeds with the gate green. Both canaries are asserted separately.

⚠️ **And the first version of the trigger canary was green over nothing.** It
counted every `AbilityPutOnStack`, which also carries every ACTIVATED ability, so
it read **249 with an empty registry**. Filtering on `obj.kind === 'triggered'`
takes it to 0 without the script and 1,198 with it.

⚠️ Cost: **1.6%**, measured rather than assumed. The gate at 60 seeds runs 33.7 s
with the registry and 36.3 s with an empty one over the same deck — inside the
noise, in both directions. (AGENTS.md's "~9 s for 60 seeds" is stale: it predates
D119 nearly doubling the game each seed plays.)

### What this does NOT do, said plainly

⚠️ **SCRIPTABLE IS NOT EXECUTABLE, and `1,405` DID NOT MOVE.** With `optional`
built, a script can now be written for **2,915** Commander-legal cards where it
could be written for **795** — **+2,120, 3.67×**, the largest single step in
D127's cumulative table. The number of cards the engine runs completely is
**1,405**, exactly as before, because this milestone wrote no card scripts into
the product. `primitives.node.test.ts` asserts both numbers in ONE test, so the
enabling figure can never be reported as coverage.

⚠️ **Every classifier number in D127 is unchanged, and that is correct.** `reach`,
`soleNeed` and the cumulative table are properties of the card text and of the
parsers that read it; building something changes none of them. The only line that
moves is the new `BUILT` set, which is why it is a separate constant with the
reason written on it.

⚠️ **The prompt is unreachable in the shipped app, and nothing here changes
that.** `host.ts` constructs its `Game` with `EMPTY_REGISTRY`, so no game a
player can start has a `TriggerDef` to be optional. `PromptBar`'s branch and the
`optionalTrigger` case in `net/testing/script.ts` are therefore exercised by
`tsc -b` and by review rather than by play. That is acceptable only because
`Awaiting` crosses the wire WHOLE (D61) with no per-kind code on either side —
`redact.ts` and `diffView.ts` have no switch to update. **M6.4 must drive this
prompt through the real UI on the first "may" card it lands**; until then the
copy is a claim rather than a measurement.

### Verified

**1,138 Vitest passing / 6 skipped across 51 files** (up from 1,126 / 6 across
50: 8 new in `src/engine/optionalTriggers.test.ts`, the thirteenth prompt in the
bot suite, the producer map and the new primitives assertion) **· `tsc -b` clean
· `npm run build` clean · the 500-seed replay fuzz gate green at 93,267 accepted
intents / 2,290,878 events / 17,301 turns with every replay hash matching ·
`battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40` 78.8%
[68.6%, 86.3%] with 0 faults · `npx electron scripts/probe.cjs` 124/124 ·
`CRT_PRIMITIVES_REPORT=1` with every pinned figure reproducing.**

⚠️ **The battery's 102 is the SAME coverage as D125's "12/12 and 91/91", not one
check fewer.** Run together, the shared renderer-console check runs once rather
than once per section: `bot` alone is still 12/12, and 90 + 11 + 1 = 102.

⚠️ **`battery-bot`'s 78.8% is a WIDER interval, not a worse bot.** D126's 82.8%
[79.2%, 85.9%] is 1,000 games; this is 80, and the two intervals overlap almost
entirely. The bot's curated deck cannot contain a card with an unrun triggered
ability, so this change cannot reach it — which is also why the 40-game form was
run rather than the 500-game gate.

⚠️ **Checked by reverting the fix.** Disabling the `optional` branch in
`resolveTop` fails **7 of the 8** checks in `optionalTriggers.test.ts`. The
eighth — "a MANDATORY trigger is never asked about" — passes, which is exactly
right: it describes behaviour the revert does not change, and it exists so that a
future change turning EVERY trigger into a question fails somewhere.

### Reportable, found and deliberately not fixed here

⚠️ **A "dies" trigger cannot be written correctly today.** `collectTriggers`
takes `before` and `after`, and its own comment says why — "whenever a creature
dies" needs last-known information about an object that no longer exists — but
`readonlyCtx` builds the script context from `after` ALONE and the parameter ends
in `void before;`. So `matches` cannot see the board the card died on. It is why
`Oculus` ("When this creature dies, you may draw a card") was rejected as the
proof card in favour of an upkeep trigger. Every leaves-the-battlefield trigger
is blocked on it, and M6.4 will meet it immediately.

⚠️ **`collectTriggers` re-allocates the whole card list per event per trigger
def.** `allObjects(after)` is `Object.keys(state.cards)` — invariant across both
loops — and is rebuilt inside them. Measured as noise today with one registered
card; with a real library it is O(events × defs × cards) of allocation, and it
should be hoisted before M6.4 lands its first batch.

## D129 — Layer 6 existed; what it lacked was an order

M6.3's second primitive, and the first finding is that the brief and D127 were
both wrong about the starting point.

**`derive.ts` has called `applyStatics(…, 'ability')` since M3.** It also calls
it for `type`, `color`, `cda`, `ptSet`, `ptModify` and `ptSwitch`. Layer 6 was
not missing; layers 4, 5, 6, 7a, 7b, 7c and 7e all have live seams, and with
`EMPTY_REGISTRY` every one of them is a `Map.get` returning a shared empty array.
"`derive.ts` runs layers 1, 7b, 7c, 7d" described what the layers had ever been
USED for, not what the file does.

What layer 6 genuinely lacked was **CR 613.7 — the order effects apply in.**

### The battlefield array is the timestamp

`zones.ts`'s `addToZone` APPENDS and `removeFromZone` takes a card out, so
`state.zones.battlefield` is arrival order and a permanent that leaves and
re-enters goes to the back. That is exactly CR 613.7c, and it is why **no
timestamp field was added to `GameState`** — a stored timestamp would be a second
source of truth for a fact the zone array already holds, and it would be part of
the state hash for no gain.

⚠️ **That makes `zones.ts`'s order convention load-bearing for the layer system**,
which it was not before and which nothing said. It is asserted now rather than
commented: a test bounces a `Levitation` and replays it, and the answer flips.

⚠️ **NOT covered, and named rather than hoped over:** CR 613.7d (an Aura or
Equipment takes a NEW timestamp when it becomes attached to a different object)
and 613.7e (a permanent turning face down). Neither changes the battlefield
array, so a re-attached Aura keeps its old position.

### The loop was nested the wrong way round

```
before                          after
for (def of defs)               for (source of battlefield)   ← timestamp
  for (source of battlefield)     for (def of defs)           ← registration
```

With the defs outside, **every source of the first-registered script applied
before any source of the second** — so `Levitation` (grant flying) against
`Gravity Sphere` (lose flying) was decided by the order `createRegistry` happened
to see them in. Registration order is an implementation detail of the registry;
which enchantment entered the battlefield last is the rule.

Invisible for three milestones because zero scripts ship, and wrong on the very
first pair that disagreed.

### `appliesTo` now receives the candidate's characteristics

⚠️ **A layer-6 static that asks `ctx.derive(candidate)` recurses forever.** It is
running INSIDE that object's own `derive`, so deriving it again re-enters
`applyStatics`, which calls `appliesTo` again. Measured as `RangeError: Maximum
call stack size exceeded` on the first real script written against the old
three-argument signature, whose only sin was asking "is this a creature".

`StaticDef.appliesTo` takes a fourth argument now: the candidate's
`MutableCharacteristics` as the layers have built them so far. That is a better
answer as well as a terminating one — `chars.typeLine` has layer 4 applied, where
a printed type line does not, so "creatures you control" is read after
type-changing effects exactly as CR 613 orders it. `ctx.derive` on ANOTHER object
is still fine and is what "as long as you control a Forest" needs.

The trap is written on the API, because the next author of a static is a
generator (M6.4-LIBRARY-SPEC §5).

### Dependency is NOT built, and here is what that costs

⚠️ **CR 613.8 is not implemented.** Effects apply in timestamp order and nothing
asks whether one depends on another. That is right for almost every board and
silently wrong for the published hard cases — Humility + Opalescence, Blood Moon
+ Urborg, Conspiracy + Olivia. The rule that follows is the brief's own: **a card
whose correctness needs dependency is not registered.**

Today that rule costs nothing, because zero scripts ship and the two test
registrations do not depend on each other. It is also why `Humility` could not
have been the demonstration card even if the engine could express "loses all
abilities" — which it cannot: `MutableCharacteristics` models KEYWORDS, and a
card's triggered and activated abilities come from the registry keyed by
`oracleId`, not from `chars`. Removing a non-keyword ability has no
representation at all.

### Proved on the canonical pair

`Levitation` — `{2}{U}{U}`, "Creatures you control have flying." — and `Gravity
Sphere` — `{2}{R}`, "All creatures lose flying." Both single-sentence, so a
script for either runs every word of it (D90), and **neither proves anything
alone**: two grants commute, so only a grant against a removal can show an order
at all.

⚠️ **THIS IS WHAT D82 WAS WAITING FOR.** Hexproof and shroud have been enforced
only where PRINTED since the targeting work, on the stated grounds that "a
granted one needs a layer-6 script" — and no layer-6 script had ever existed, so
nothing had ever checked that a granted keyword reaches the rules that read
keywords. **`combat.ts` is unchanged by this milestone**: it reads derived
characteristics, so the grant arrives for free. Asserted on the block prompt's
own `legal` list, which is what a client actually sees: without Levitation the
attacker is blockable by a Grizzly Bears and a Giant Spider, with it by the
Spider alone.

⚠️ `Gravity Sphere` is a **WORLD** enchantment and this engine has **no world
rule** (CR 704.5m — only the newest world permanent survives). A pre-existing
Tier-1 gap, named here, inert with one world permanent on the board, and one more
reason `cardScripts.ts` is test-only.

### What layer 6 is worth, and why `BUILT` does not gain it

D127's `layer6` bucket is 1,722 cards by sole need. Measured card by card,
through the classifier's own patterns:

| | cards | |
|---|---:|---|
| **grant** — adding or removing an ability | **1,108** | CR 613.6. **Built here.** |
| anthem — "creatures you control get +1/+1" | 253 | layer 7c; `applyStatics('ptModify')` has carried it since M3 |
| **restriction** — "can't block", "can't attack" | **227** | CR 508/509. **NOT built** — `canAttack`/`canBlock` consult no static at all |
| conditional — "as long as" | 134 | works, because `appliesTo` is re-asked on every derive rather than latched |

⚠️ **A BUCKET IS NOT A PRIMITIVE, and this is the number that says so.**
`unlockedBy` requires EVERY line of a card to be covered, so adding `layer6` to
the report's `BUILT` set would claim **227 cards this engine cannot express** —
the overclaim M6.4-LIBRARY-SPEC §2 forbids. So `BUILT` stays `['optional']`, the
headline scriptable figure stays **2,915**, and the bucket has to be SPLIT before
it can be ticked. That split is a measurement, not a build, and it is M6.3c's
first job.

⚠️ **Layer 6 is therefore PARTIALLY built, which this project does not normally
allow.** The line that makes it acceptable: the half that is built is a whole CR
behaviour (613.6, adding and removing abilities, in 613.7 order), and the half
that is missing is a DIFFERENT rules subsystem (508/509 declaration
restrictions) that merely shares a regex. It is not half of one feature.

⚠️ **And the split was nearly measured with a second copy of the rule.** The
first cut pasted the four patterns into `primitives.node.test.ts`; a scripted
edit wrote every `\b` as a literal BACKSPACE, so all 1,722 cards fell into
`other` while `primitives.ts` still filed them under `layer6`. The report now
asks `layer6Kind`, exported from the classifier and composed from the same four
constants `LAYER6` is built out of — one source, one answer. Fourth time this
project has had to write that down (the Command Tower lesson, D122, D127). Every
figure D127 pinned reproduces unchanged, which is the proof that recomposing the
alternation changed nothing.

### The fuzz gate had never run `applyStatics` either

Same shape as D128, one layer along: `applyStatics` short-circuits on an empty
def list, so the gate had never run its body. `Levitation` and `Gravity Sphere`
join `DECK` and the test registry — the PAIR, because one alone cannot exercise
the ordering.

⚠️ **Layer 6 emits NO EVENT.** It is a derivation, and `derive.ts`'s header says
characteristics are never stored, so there is nothing in the log to count. The
canary counts the SOURCES arriving on a battlefield instead — the closest a log
can get to "the layer had work" — and pins it above zero.

500 seeds, green, every replay hash matching:

| | D125 | D128 | + layer 6 |
|---|---:|---:|---:|
| accepted intents | 92,778 | 93,267 | **92,986** |
| events | 2,257,235 | 2,290,878 | **2,337,352** |
| turns | 17,196 | 17,301 | **17,685** |
| triggered abilities | 0 | 1,198 | **1,329** |
| may-triggers taken / declined | 0 / 0 | 621 / 566 | **603 / 701** |
| layer-6 sources on a battlefield | 0 | 0 | **577** |

⚠️ **AND IT COSTS 64%, measured and attributed.** At 60 seeds, with the same
`DECK` and games identical to within 0.03% of events: **33.6 s with only the
trigger script registered, 55.2 s with the two statics added.** The cause is the
BATTLEFIELD WALK — `applyStatics` scans every permanent once per object, per
layer, per derive, which is O(N²) across an SBA sweep.

⚠️ **The first guess was wrong and is recorded as wrong.** `makeScriptCtx` was
being allocated eagerly per call; making it lazy is kept, is strictly less work,
and recovers about **1%**. The comment that claimed it was "most of what live
statics cost" was corrected rather than quietly deleted. The real fix is an index
of source instances per layer, cached on `DeriveCache` — not built here, because
the shipped registry is empty and the entire cost is confined to tests, and
because optimising a hot path on a guess is what D106 exists to warn about.

### Verified

**1,147 Vitest passing / 6 skipped across 52 files** (up from 1,126 / 6 across 50
at the start of M6.3: 8 new in `optionalTriggers.test.ts`, 8 in the new
`layers.test.ts`, plus the thirteenth prompt, the producer map and two new
primitives assertions) **· `tsc -b` clean · `npm run build` clean · the 500-seed
replay fuzz gate green at 92,986 accepted intents / 2,337,352 events / 17,685
turns · `battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40`
78.8% [68.6%, 86.3%], 0 faults · `npx electron scripts/probe.cjs` 124/124 ·
`CRT_PRIMITIVES_REPORT=1` with every D127 figure reproducing.**

⚠️ **Checked by reverting the loop nesting**: exactly the two ordering checks in
`layers.test.ts` fail, one of them by its own message — `Levitation last —
flying: expected false to be true` — and the other six pass, because they do not
depend on order. Reverted.

⚠️ `combat.ts`, `legal.ts`, `handlers.ts` and `loop.ts` are **untouched** by this
entry. The only engine edits are `derive.ts`'s loop and `api.ts`'s fourth
argument.

### Reportable, found and deliberately not fixed

⚠️ **No world rule (CR 704.5m).** `sba.ts` has no mention of the World supertype,
so any number of world permanents can coexist. Found by picking `Gravity Sphere`
as a demonstration card; unrelated to layers, and it means the fuzz gate can hold
four Gravity Spheres where a real table could not.

⚠️ **`applyStatics` is O(N²) per derive pass**, measured at +64% on the gate.
Index the sources per layer on `DeriveCache` before M6.4 lands statics at scale.

⚠️ **CR 613.7d and 613.7e are unimplemented** — a re-attached Aura and a permanent
turning face down both keep their old position in the ordering.

⚠️ **CR 613.8 dependency is unimplemented**, and "removing a non-keyword ability"
has no representation in `MutableCharacteristics` at all. Both are why
`Humility`-class cards stay unregistered, and both are M6.4b's problem
(M6.4-LIBRARY-SPEC §4.1).

## D130 — Counters: seven cards executed, and 981 that were never blocked

M6.3's third primitive, `effect:counter`, worth **1,441 cards by sole need** and
third on D127's list. It is the first one to move the number that matters — and
most of what it was supposed to be worth turns out not to have been missing.

### Measured first, because D129 taught that lesson

The bucket, split card by card:

| | cards | what it actually needs |
|---|---:|---|
| **spell** | **197** | the effect VOCABULARY — a spell resolves through `effectEvents` and nothing else |
| **enters with** | **263** | a replacement effect, and `ReplacementDef` is a DEAD API — see below |
| activated ability | 221 | a card script |
| triggered / static | 760 | a card script |

⚠️ **THE 981 WERE NEVER BLOCKED ON A PRIMITIVE.** `CountersChanged` has been on
the log since D107, and a `TriggerDef` returns `EventBody[]` directly — so a
permanent whose triggered or activated text puts counters has been scriptable
since M3. D127 filed them under `effect:counter` because its proxy for "could a
script express you" is `parseEffects`, and **`parseEffects` is the INGEST
vocabulary for one-shot SPELLS**. It refuses every permanent by construction. It
has no bearing whatsoever on what a card script may return.

That is not a criticism of D127 — the proxy is the best one available without
writing a script for every card — but it is a systematic over-report, and it
applies to exactly the primitives whose EVENT already exists. D127 itself noticed
the events were there and counted the vocabulary as the gap anyway.

⚠️ **Asserted, not argued.** `src/engine/testing/cardScripts.ts` registers
`Ajani's Pridemate` — `{1}{W}` 2/2, "Whenever you gain life, put a +1/+1 counter
on this creature." — and `counterEffects.test.ts` drives it with **no vocabulary
involved at all**: gain life with a Tier-3 tool, the trigger fires, the counter
lands, and `derive` reads 3/3 at layer 7d. A measurement correction that rested
on "I read the code and it looked possible" would be worth nothing.

### And 263 are blocked on an API that is never called

```ts
  const defs = scripts.replacements();
  if (defs.length === 0) return events;
  // Card scripts get their turn after the built-in…
  return events;
```

`applyReplacements` fetches the registered `ReplacementDef`s, checks whether the
list is empty, and then **returns `events` unchanged either way.** A registered
replacement has never run. That is D128's shape exactly — a seam in the API that
nothing consumes — and it is what blocks every "this creature enters with a
+1/+1 counter on it".

⚠️ **NOT FIXED HERE, deliberately.** It belongs to `replacement` (418 cards by
sole need, its own row in D127), and doing it properly needs CR 616's ordering
choice, which is a prompt. Fixing the dead call without that would be half a
feature. It is named as the reportable it is.

### What was built: two effect kinds, and a counter list closed at two

`putCounters` and `removeCounters` join `effectParse`'s closed vocabulary and
`effects.ts` turns them into the `CountersChanged` that already existed. Nothing
was added to the log, the reducer or the state hash — **the whole of this
primitive is a vocabulary that can SAY the event.**

⚠️ **`CounterKind` is `'+1/+1' | '-1/-1'` AND NOTHING ELSE**, because those are
the two `derive.ts` sums at layer 7d. Every other counter Magic prints — charge,
trample, deathtouch, stun, page — would be recorded on the card and applied by
NOTHING: the log would say the counter went on, the card would carry it, and the
rules would ignore it forever. That is half-execution wearing a number (D90).
`loyalty` and `defense` are absent too, even though `sba.ts` reads them: no
Commander-legal spell's whole text is that clause, so admitting them would widen
the vocabulary for zero cards and one more thing to be wrong about.

⚠️ **THE ANCHOR IS DOING REAL WORK, and there is a card that proves it.** `Burst
of Strength` is "Put a +1/+1 counter on target creature AND UNTAP IT." — **one
sentence**, so the `assisted` rule never sees a second clause to refuse. Only the
`$` at the end of the pattern stops the parser executing two thirds of the card
and calling it done. It comes out `manual`, and that is a pinned test rather than
a hope. This is the same failure D90 records for `Homing Lightning` and `Spell
Blast`, in a vocabulary written five milestones later.

⚠️ Lethality is still the SBA's job. `Scar` emits one `CountersChanged` on a 1/1
and nothing else; layer 7d makes it 0/0 and `checkStateBasedActions` bins it. A
second "is this lethal" in `effects.ts` would eventually disagree with combat.

### `complete` moved, for the first time in M6.3

**1,405 → 1,412.** `optional` (D128) and layer 6 (D129) each moved it by ZERO,
exactly as D127 predicted: a primitive makes a card possible to SCRIPT, and no
script ships. The counter vocabulary is the exception that proves the rule — a
SPELL resolves through `effectEvents` with no script at all, so widening the
vocabulary *is* the execution.

Seven is small enough to name: `Battlegrowth`, `Scar`, `Blight Rot`, `Common
Bond`, `Honor`, `Instill Infection`, and `Tuinvale Treefolk // Oaken Boon`.

⚠️ **THE SEVENTH IS AN ADVENTURE, and it was worth chasing rather than
shrugging at.** The bot pool's `creature` count moved by one, which made no sense
for a change to a spell vocabulary. `Oaken Boon` is the Adventure half of a
vanilla Treefolk: `engineCompleteness` sums leftovers across ALL faces and
`bucketOf` types a card by its FIRST, so a card completed by its instant half is
counted as a creature.

⚠️ And it raised the right question — does the app OFFER that half? It does not;
per-face castability is not built (M6.4-LIBRARY-SPEC §3, 878 cards). So
`tier3.ts` now says nothing about a castable half the engine will not give you.
**Measured before concluding: 27 engine-complete cards were ALREADY multi-face**
— 5 other Adventures, 9 Pathways, `Dead // Gone`, and the reversible basics — all
with zero notes. This adds one card to a pre-existing silence rather than
creating one. Reported, not fixed.

### Every pinned number that moved, and why

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,405 | **1,412** |
| spells `auto` (distinct names) | 269 | **276** |
| spells `assisted` | 1,359 | **1,403** |
| faces `effect:auto` (all printings) | 1,614 | **1,631** |
| faces `effect:partial` | 4,148 | **4,246** |
| faces `effect:none` | 18,569 | **18,454** |
| `effect:counter` sole need | 1,441 | **1,351** |
| scriptable with no primitive at all | 795 | **845** |
| cards with no Tier-3 note | 1,804 | **1,811** |

⚠️ **The ASSISTED jump is the bigger one and the more useful.** 44 more spells
now have a clause the prompt bar can offer as one logged click, where before the
whole card was the player's to apply. 115 faces left "understood nothing"
altogether.

⚠️ **The silence counters moving is correct behaviour, not a regression.** A card
the engine now runs in full must say NOTHING — that is the invariant at the
bottom of `engineComplete.ts` and the first test in `tier3.test.ts`. The seven
cards went silent because they are handled.

⚠️ **The cumulative ladder moved at BOTH ENDS, in opposite directions**, and both
are right: `[795, 2915, 4870, 6656, 8286]` became `[845, 2972, 4928, 6649,
8279]`. Up at the start because 50 more cards are blocked on a script alone; down
at the end because the seven that became COMPLETE left `blocked` altogether, and
the ladder is drawn from blocked cards. D127's **10.4× is now 9.8×**, and the
test name says so.

⚠️ **A FALLING TOTAL IS THE MEASUREMENT WORKING.** The pool of cards a primitive
could ever unlock shrinks every time one is actually executed. A headline that
could only go up would be measuring effort rather than coverage.

### The fuzz gate

`Battlegrowth`, `Scar` and `Ajani's Pridemate` join `DECK`, and the Pridemate
joins the registry — both sides of the boundary, because the spell path and the
script path reach `CountersChanged` through completely different code.

⚠️ **The canary is filtered on `cause.kind !== 'manual'`, and that filter is the
whole assertion.** The fuzzer's Tier-3 tools write a `+1/+1` counter on one
manual intent in thirteen, so an unfiltered count would have been green in every
run since M3 — the same green-over-nothing the trigger canary was caught by in
D128, avoided this time by remembering it.

500 seeds, green, every per-seed replay hash matching:

| | D125 | D128 | D129 | D130 |
|---|---:|---:|---:|---:|
| accepted intents | 92,778 | 93,267 | 92,986 | **92,630** |
| events | 2,257,235 | 2,290,878 | 2,337,352 | **2,375,679** |
| turns | 17,196 | 17,301 | 17,685 | **18,051** |
| target prompts / declared | — | 3,075 / 1,693 | 3,285 / 1,680 | **4,889 / 2,424** |
| triggered abilities | 0 | 1,198 | 1,329 | **1,258** |
| may taken / declined | 0 / 0 | 621 / 566 | 603 / 701 | **582 / 593** |
| layer-6 sources | 0 | 0 | 577 | **550** |
| +1/+1 or -1/-1 by the rules | 0 | 0 | 0 | **1,330** |

⚠️ **The TARGET prompts nearly doubled** — 3,285 to 4,889, with declarations up
from 1,680 to 2,424. Two cheap targeted spells that now resolve completely are
worth more traffic through the targeting path than any change since D102 added
Lightning Bolt to a fixture pool. That path is the one D102 records rotting for
weeks, so more of it is the right direction.

### Verified

**1,156 Vitest passing / 6 skipped across 53 files** (up from 1,147 / 6 across
52: 9 new in `counterEffects.test.ts`) **· `tsc -b` clean · `npm run build` clean
· the 500-seed replay fuzz gate green at 92,630 accepted intents / 2,375,679
events / 18,051 turns · `battery-anim.cjs bot engine` 102/102 ·
`battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults ·
`npx electron scripts/probe.cjs` 124/124 · `CRT_PRIMITIVES_REPORT=1` reading
"1412 run completely today" where it read 1405.**

⚠️ **`battery-bot` is unchanged to the decimal, and that is expected rather than
lucky.** `tournament.node.test.ts` plays a MIRROR deck of its own — its own
comment says "a fixture card, not the shipped bot deck's Jasmine Boreal", because
a deck advantage in a policy measurement would be measured as a policy
advantage. It is insensitive to `botDeck.ts` by construction.

⚠️ **THE BOT'S DECK DID CHANGE, and it had to be regenerated.** `botDeck.ts` is
generated from the pool, the pool grew by seven, and Jasmine Boreal's in-identity
count went 667 → 670 — so `Common Bond` displaced one card at mana value 3. Both
committed-deck guards still pass (every card is in the pool; the deck is a legal
Commander deck), and the `bot` battery still reads "Jasmine Boreal · 100 cards
the app runs in full".

### Reportable, found and deliberately not fixed

⚠️ **`applyReplacements` never calls a registered `ReplacementDef`** — it fetches
the list and returns unchanged either way. 263 "enters with counters" cards are
blocked on it, and so is every other replacement. D128's shape; `replacement`'s
row in D127.

⚠️ **A triggered ability cannot choose a TARGET.** `PendingTrigger` carries none
and `drainTriggers` builds its `StackObject` with `targets: []`, so `Bond Beetle`
("When this creature enters, put a +1/+1 counter on target creature") cannot be
scripted correctly. It is why the demonstration card had to be one that targets
nothing. Every targeted trigger in the format is blocked on it.

⚠️ **27 engine-complete cards are multi-face and none says anything about
per-face castability**, because that is not built. Pre-existing; this change adds
the 28th.

⚠️ **D127's proxy over-reports every primitive whose EVENT already exists.**
`effect:token` (1,123 cards) is the same shape as `effect:counter` —
`TokenCreated` has been on the log since M3 — so its 1,123 should be expected to
decompose the same way before it is built, not after.

⚠️ **`botDeck.ts` is GENERATED and has no rot guard.** Its two tests check that
every card is still in the pool and that the deck is legal — both semantic, and
both pass on a deck the generator would no longer produce. It drifted silently
the moment the pool grew, and was only caught here because the pool count was
being watched for other reasons. That is D123's finding exactly, in a second
generated file: the guard that matters is "regenerating would be a no-op".

## D131 — `effect:token` split before building it, and D130's prediction was wrong

D130 ended by predicting that `effect:token` (1,123 cards, fourth on D127's list)
was the same shape as `effect:counter`: an EVENT that has existed since M3, a
classifier proxy that cannot see what a script can return, and therefore several
hundred cards already scriptable. **Measured, that prediction does not hold, and
the reason is worth more than the number.**

### The two events are not alike

| | `CountersChanged` (D107) | `TokenCreated` (M3) |
|---|---|---|
| what it names | `kind: string` — a free string | `oracleId` **and** `printingId` |
| what a script must know | nothing; `'+1/+1'` is a literal | WHICH PRINTING, out of 3,290 |

A card script could always emit `CountersChanged`, which is why 981 of
`effect:counter`'s 1,441 were never blocked on anything. A card script **cannot**
emit `TokenCreated` without naming a token printing, and **nothing in this app
maps a printed description to one.** The only token resolution that exists is
`TOKEN_NAMES` in `src/game/buildGame.ts`: twelve names, hand-written, for the
Tier-3 manual tool.

⚠️ **So both halves of this row are blocked on the same missing piece, and it is
a resolver over card DATA rather than an engine primitive.** That is the opposite
of the counter row, where the spell path needed a vocabulary and the script path
needed nothing.

### The split

Of the 1,123 cards whose sole need is `effect:token`:

**By who asks** — `spell: 373`, `permanent: 750`.

**By what is asked for:**

| | cards | |
|---|---:|---|
| plain creature token | **421** | "a 1/1 white Soldier creature token" |
| token WITH abilities | **342** | "…with flying", or a quoted ability |
| predefined artifact token | **212** | Treasure, Food, Clue, Blood, Powerstone… |
| copy (CR 707) | **77** | not a token problem at all |
| X tokens | **71** | not known at parse time |

⚠️ `unclaimed` is **0** — every one of the 1,123 is accounted for, so these five
are the whole row rather than five buckets and a shrug.

⚠️ **The 77 copies belong to a different row.** "A token that's a copy of target
creature" needs CR 707 copiable values (M6.4-LIBRARY-SPEC §4.4, 980 cards).
Building token creation buys none of them.

### Is a resolver even buildable? Measured against the data on disk

The database carries **3,290 token printings, 848 distinct names.** Matching the
389 lines that fit a plain "create N P/T colour Subtype creature token" shape
gives **165 distinct descriptions**, resolved against token printings with no
rules text:

- **88** resolve to exactly one token name,
- **3** resolve to several,
- **74** resolve to none — **261 of the 389 cards covered.**

⚠️ **Every miss is a token that CARRIES RULES TEXT**, and the card's own sentence
says so: `Angel 4/4 W "Flying"`, `Spider 1/2 G "Reach"`, `Dragon 5/5 R "Flying"`.
Which is why the `withAbilities` bucket is 342 and not a rounding error.

⚠️ **AND THE ABILITIES ARE IDENTITY, NOT DECORATION.** The database holds both
`Angel 4/4 W "Flying"` and `Angel 4/4 W "Flying, vigilance"` — same power,
toughness, colour and subtype, distinguished by nothing but their text. A
resolver that matched on P/T and type alone would not be approximate; it would
create the wrong token, silently, on a card that reads correctly. That is D90's
failure with a body on the battlefield.

### What this means for the build order

- **373 spells** is the only part that could move `complete`, and it is **1.9×**
  the 197 the counter row was worth — so the ceiling here is higher than D130's
  seven cards, probably several times.
- **All 1,123 are gated on one piece of work**, and it is a matching problem over
  Scryfall data rather than a rules primitive: description → printing, exact on
  P/T, colour, subtypes AND abilities, with the residue reported rather than
  guessed at.
- **77 should be subtracted** and given to CR 707.

⚠️ **The general lesson, now twice over.** D129 found `layer6` was a bucket
containing a rules subsystem it had no seam for; D130 found `effect:counter` was
a bucket containing 981 cards that were never blocked; D131 finds `effect:token`
is a bucket whose two halves share one dependency nobody had named. **Split the
row before building it** — the classifier answers "what does this SENTENCE need",
and that is not the same question as "what does this ENGINE lack".

### Verified

`primitives.node.test.ts` pins both splits, asked of **`tokenKind` exported from
`primitives.ts`** rather than re-derived — D129's lesson, where copied patterns
disagreed with the classifier within the hour. **1,157 Vitest passing / 6 skipped
across 53 files · `tsc -b` clean · `npm run build` clean.** Nothing under
`src/engine/` was touched, so the fuzz gate cannot move and was not re-run.

## D132 — The token resolver: a printed description, and the printing it names

D131 found that both halves of the `effect:token` row — 373 spells and 750
permanents — are blocked on one thing, and that it is not a rules primitive:
`TokenCreated` needs an `oracleId` **and** a `printingId`, so creating a token
means naming one of 3,290 printings, and nothing mapped "a 1/1 white Soldier
creature token" to one. `src/data/tokenParse.ts` is that map.

### What it does

`parseTokenClause(sentence)` reads a printed description into a `TokenSpec`
(count, name, power, toughness, colours, card types, abilities);
`resolveToken(spec, candidates)` returns the printing it names, or null. The
token's NAME is its subtype line — `Soldier`, `Elf Warrior`, `Zombie Army` —
which is what makes the runtime lookup possible at all: resolve candidates by
name through the existing `printingsOf`, then match exactly among them.

**Measured over the whole database: 586 of 1,180 token clauses are readable, 567
of those name exactly one printing (96.8%), 0 are ambiguous, 19 name no token at
all. 526 of the 1,123 cards have EVERY token line resolved** — which is the
number that matters, because a card is only executable if all of it is.

⚠️ **EVERY FAILURE IS A REFUSAL**, and that is the property pinned rather than
the coverage. A description this module cannot read completely, or that names no
token, or that names two, produces NOTHING.

### Four things that had to be right, each found by measuring

The first cut resolved **53** clauses uniquely and called 328 ambiguous. It now
resolves 567 and calls none ambiguous. Every one of the four fixes came from
reading a failure rather than from thinking harder.

⚠️ **1. AMBIGUITY IS COUNTED BY `oracleId`, NOT BY PRINTING.** The plain 1/1
white Soldier has **66 printings and ONE oracle id**. Counting printings reported
328 "ambiguous" descriptions that were nothing of the kind — two printings of one
token are the same token. Two ORACLE IDS mean the description does not identify a
card, and that is a refusal. (Which printing is returned among reprints does not
matter to the rules; it must still be DETERMINISTIC, or two players would
disagree about a `printingId` on the wire. Lowest scryfall id wins.)

⚠️ **2. THE PRINTING STATES ITS KEYWORDS WITH REMINDER TEXT.** The card says
"with lifelink"; the token prints `Lifelink (Damage dealt by this creature also
causes you to gain that much life.)`. Without scrubbing, the two never compare
equal and the resolver misses every keyword token in the format.

⚠️ **3. A PREDEFINED TOKEN'S ABILITY IS ITS OWN, AND THE CARD NEVER STATES IT.**
"Create a Treasure token" versus a printing reading `{T}, Sacrifice this token:
Add one mana of any color.` Comparing abilities for Treasure, Food, Clue, Blood
and Map misses all of them. Their NAME is the whole identity, which is the point
of the token having one.

⚠️ **4. THE ONE THAT CANNOT BE SEEN IN THE WORDS.** Callers hand this module text
that has already been through `scrub`, which blanks quoted and parenthesised text
by replacing it with **spaces of the same length**. So `Dragon Egg` — "…create a
2/2 red Dragon creature token with flying and \"{R}: This token gets +1/+0 until
end of turn.\"" — arrives as a token with flying and a run of spaces. That is a
perfectly well-formed description of a **different, real** token, and matching it
would put the wrong permanent on the battlefield on a card that reads correctly:
D90's failure with a body on it. **The gap is only visible in the spaces the
quotes left behind**, so the guard is `/\s{2,}/` on the clause. Two more of the
same family: `with flying FOR EACH basic land type…` (the tail is the count) and
`with flying, THEN populate` (the tail is a second effect) — both parsed, neither
matched, and both pointed the blame at Scryfall until the vocabulary was closed.

### The 19 that name no token are the DATABASE, not the parser

A green Dog. A blue 2/2 Elemental with flying. A 2/3 red Minotaur **with haste**,
where only the vanilla 2/3 red Minotaur was ever printed. Old cards whose tokens
never got a physical card. Pinned below 5% of readable clauses, so a parser that
started inventing matches would show up here first.

### What this does NOT do yet, and the decision it needs

⚠️ **NOTHING CALLS IT AT RUNTIME.** This is a measured building block, not a
feature, and saying so plainly matters in a repo whose last three entries were
about seams nothing consumes. What it unblocks needs a decision that is not
mine to make quietly, because every option costs something real.

To make a token spell resolve by itself, `effectParse` must decide `auto` — and
that decision has to know the token is resolvable, which needs the token corpus.
Three places it could live:

- **(A) Thread a token index into `parseEffects` / `parseFace`.** At RUNTIME this
  is nearly free: `ingestOracle` already receives the pool with the tokens in it
  (`host.ts` builds the oracle from `this.pool`), so a two-pass ingest works.
  ⚠️ **The cost is that `effectMode` stops being a property of the CARD** and
  becomes one of (card + corpus) — and `tier3.ts`, `engineComplete.ts` and
  `botPool.node.test.ts` all call `parseFace` on a bare `CardData`. They would
  disagree with the engine about what the app runs, which is D122's exact
  failure.
- **(B) Resolve at DATABASE BUILD time** and store the printing id on `CardData`.
  Semantically the cleanest: the answer is a property of the card and of
  Scryfall, exactly like `colorIdentity`, which D12a records taking from Scryfall
  rather than recomputing. ⚠️ The cost is a card-database schema change, a
  re-sync, 93 regenerated fixtures, and `CardData` crosses the wire (D52), so the
  printing dictionary grows.
- **(C) Never `auto`; only `assisted`.** The prompt bar offers "create a 1/1
  white Soldier creature token" as one logged click, and refuses visibly when the
  token cannot be named. ⚠️ The cost is that `complete` does not move at all —
  but nothing can half-execute and no schema changes.

**Recommendation: (B) for the long run, (C) as the first shippable step.** (A)
buys the least and breaks the most: the disclosure model is the thing that makes
this app honest about its own coverage, and making a card's tier depend on who
else is at the table is a high price for skipping a re-sync.

### Verified

**1,189 Vitest passing / 7 skipped across 55 files** (up from 1,157 / 6 across
53: 28 in `tokenParse.test.ts` driven against the three REAL token fixtures, 4 in
`tokenParse.node.test.ts` over the live database) **· `tsc -b` clean ·
`npm run build` clean.** Nothing under `src/engine/` was touched — this module is
not imported by the engine, the app or the bot — so the fuzz gate cannot move and
was not re-run.

## D133 — Tokens execute: option (B), and why it is not the (B) that was offered

D132 offered three places the description→printing resolution could live and
recommended **(B) — resolve at build time**, so `effectMode` stays a property of
the CARD. That is what was built. It is not built where D132 said, and the reason
is structural rather than a change of mind.

### The literal (B) is not implementable

D132's (B) was "resolve at DATABASE BUILD time and store the printing id on
`CardData`". The card database is built by `electron/cardsvc-worker.cjs` →
`cardproject.cjs`, and **`electron/` never imports `src/` or `dist/`** — a grep
proves it, and `cardsvc-worker.cjs` is loaded directly as CommonJS rather than
bundled. So the ingest could only resolve tokens with **a second copy of
`tokenParse.ts` written in CJS**, which is the duplication this project has
written down five times (the Command Tower lesson, D122, D127, D129, D131).

So the resolution is baked into a **generated TypeScript table** — the same idiom
as `botDeck.ts` and `fixtures/engineCards.ts` — which delivers exactly the
semantics (B) was chosen for and costs none of what D132 priced it at: no card-DB
schema change, no re-sync, no regenerated fixtures for the schema's sake, and no
growth in the wire dictionary (D52).

**`src/data/tokenTable.ts` — 400 token descriptions, resolved, 64 KB.** Keyed by
`specKey` from `tokenParse.ts`, so the generator and `effectParse` cannot
disagree about what "the same description" means.

⚠️ **It carries the "regenerating is a no-op" guard**, comparing exact bytes —
the guard D123 established and D130 caught `botDeck.ts` missing. A semantic check
("every entry names a real token") passes happily on a table the generator would
no longer produce.

### The part that could have been silently wrong

⚠️ **A TOKEN WHOSE PRINTING THE POOL DOES NOT HOLD IS A BLANK.** `TokenCreated`
names a `printingId`; `derive` looks it up in the oracle DB; `host.ts` builds
that DB from the game's POOL. A printing the pool is missing derives to the inert
unknown-printing object — no name, no types, a 0/0 the state-based action bins on
the next pass. **The spell resolves perfectly and produces nothing anybody can
see**, which is D90's half-execution arriving by the back door with no error
anywhere.

Three places had to carry it, and each is a different lifecycle:

- **Solo** — `loadTokens(seats)` adds every printing the seated decks can create
  to the twelve the manual tool already loaded.
- **Multiplayer** — a guest's deck arrives asynchronously, so `host.ts` resolves
  its token printings **inside the same `.then` that seats the deck**, awaited.
  Doing it after the reply would race `start()`, and a race here is a game that
  is silently wrong rather than one that fails.
- **The fixtures** — `SOLDIER_TOKEN` was pinned to `tmd1 1`, and the table names
  `t40k 2★`. The same token at a real table; **not the same id, and the id is
  what the pool is keyed on.** The fixture is pinned to the printing the table
  names now, with the reason on it.

### What it is worth

**`complete`: 1,412 → 1,472 (+60)** — **8.6× what the counter vocabulary was
worth** (D130's seven), and the second time a primitive has moved the number that
matters.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,412 | **1,472** |
| spells `auto` | 276 | **337** |
| spells `assisted` | 1,403 | **1,532** |
| faces `effect:auto` | 1,631 | **1,871** |
| `effect:token` sole need | 1,123 | **796** |
| scriptable with no primitive at all | 845 | **1,130** |
| cards with no Tier-3 note | 1,811 | **1,870** |

⚠️ **THE RESOLVER'S OWN MEASUREMENT FELL, AND THAT IS IT WORKING.** It now reads
796 cards / 244 readable clauses / 213 fully resolved, against 1,123 / 586 / 526
before — because the cards it resolves have LEFT the blocked set for the
completed one. The same effect D130 recorded, and sharper: a measurement of what
is still missing shrinks exactly as much as the thing it measures is fixed. Every
bucket of the token split fell with it (plain 421 → 276, predefined 212 → 134,
with-abilities 342 → 241) while `copy` and `variable` barely moved — 77 → 76 and
71 → 69 — because the resolver refuses both by design.

⚠️ **D127's cumulative ladder is 7.3× where it was 10.4×**, for the same reason
in both directions: the start rose to 1,130 and the end fell to 8,220, because
every card that starts EXECUTING leaves the pool a primitive could ever unlock. A
headline that could only go up would be measuring effort.

### The fuzz gate, and a canary that had to count the right thing

⚠️ **The canary counts tokens the ORACLE CAN NAME, and asserts it equals the
number created.** Counting `TokenCreated` alone would have gone green on a game
that put nothing but blanks on the battlefield — the event fires whether or not
the printing exists. The two being equal is the property; either alone is not.

500 seeds, green, every per-seed replay hash matching:

| | D128 | D129 | D130 | D133 |
|---|---:|---:|---:|---:|
| accepted intents | 93,267 | 92,986 | 92,630 | **92,254** |
| events | 2,290,878 | 2,337,352 | 2,375,679 | **2,413,154** |
| turns | 17,301 | 17,685 | 18,051 | **18,349** |
| triggered abilities | 1,198 | 1,329 | 1,258 | **1,251** |
| may taken / declined | 621 / 566 | 603 / 701 | 582 / 593 | **569 / 602** |
| layer-6 sources | 0 | 577 | 550 | **536** |
| counters by the rules | 0 | 0 | 1,330 | **1,310** |
| tokens by the rules (nameable) | 0 | 0 | 0 | **782 (782)** |

⚠️ **782 of 782 tokens were cards the oracle could name.** That equality is the
assertion; the count alone would be green on a board full of blanks.

### The suite grew past its own timeout, and it is not a regression

⚠️ Three tests began timing out against vitest's 5 s default once the suite
reached 57 files. Measured **in isolation: 2.0 s, 2.4 s and 3.5 s** — all
comfortably inside it. Vitest runs files CONCURRENTLY, so the slowest ones get a
fraction of a core as the file count rises, and **the failing SET varied between
runs**, which is D106's tell: a real regression reproduces in isolation and this
did not. `testTimeout` is 20 s now, to catch a HANG rather than to referee CPU
contention. Anything genuinely long still says so itself — the fuzz gate passes
its own 600 s.

### Verified

**1,199 Vitest passing / 8 skipped across 57 files** (up from 1,189 / 7 across
55: 7 in `tokenEffects.test.ts` driven with real cards, 3 in
`tokenTable.node.test.ts`) **· `tsc -b` clean · `npm run build` clean · the
500-seed replay fuzz gate green at 92,254 accepted intents / 2,413,154 events /
18,349 turns · `battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs
--games 40` 78.8% [68.6%, 86.3%], 0 faults · `npx electron scripts/probe.cjs`
124/124 · `CRT_PRIMITIVES_REPORT=1` reading "1472 run completely today" where it
read 1405 at the start of M6.3.**

⚠️ **The bundle grew 813.7 kB → 876.6 kB** (+62.9 kB, +7.7%), which is the token
table. That is the price of (B) and it is worth naming: the alternative was
resolving at runtime, which would have cost nothing in bundle and made a card's
tier depend on who else was at the table.

### Reportable, found and not fixed

⚠️ **`effect:token`'s remaining 796 are the shapes the resolver refuses** — 276
plain descriptions naming a token that was never printed in that exact form, 241
with abilities, 134 predefined, 76 copies (CR 707, a different row) and 69 `X`
tokens. The copies and the `X` tokens are correctly out of scope here; the other
651 are the long tail of a data problem rather than an engine one.

⚠️ **A triggered ability still cannot create a token from its own text**, for
D130's reason: `TriggerDef.resolve` returns events and could emit `TokenCreated`
today, but there is no card SCRIPT to do it. That is M6.4, and the table is now
sitting there for it.

⚠️ **`tokenPrintingsNeeded` walks every card's oracle text at game start.** It is
milliseconds on 400 cards and it is O(cards × lines) with a regex per line; if a
game ever starts slowly, look here before the engine.

## D134 — "Enters tapped", and the replacement API that had never run

`replacement`, 418 cards by sole need, fifth on D127's list. Split before
building it, for the fourth time — and for the fourth time the row was not a
primitive.

### The split

| | cards | what it needs |
|---|---:|---|
| **enters tapped** | **173** | CR 614.1c. A self-replacement with no choice, no ordering, no interaction |
| other "instead" | 133 | the general CR 614 machinery |
| "if … would … instead" | 108 | the same, plus CR 616's ordering |
| "as … enters" | 4 | a replacement with a PROMPT inside it |

⚠️ **661 blocked cards carry an "enters tapped" line, 517 of them LANDS**, and
the bot pool's rejection tally had `This land enters tapped.` as its fifth most
common reason at 411. It is a property of the card, readable from its text — so
it is a built-in rule beside D107's entry counters, not a card script.

### The anchor is the whole safety property

⚠️ The strict clause accepts **538 lines** and **finishes 104 cards outright**,
against the loose classifier's 173. The difference is every card that CONTAINS
the clause without being it:

```
This land enters tapped UNLESS you control two or more other lands.   (31 cards)
This land enters tapped UNLESS you have two or more opponents.        (10)
This land enters tapped UNLESS a player has 13 or less life.          (10)
Grimgrin enters tapped AND DOESN'T UNTAP during your untap step.       (3)
```

A prefix match would tap those and silently drop the condition — strictly worse
than doing nothing, because the player never sees the choice they were owed
(D90). `replacementParse.ts` is anchored at both ends and `engineComplete` asks
IT rather than re-reading the text, which is the fourth time that rule has had to
be written down in this file.

⚠️ Face-down entries are excluded, the same guard the entry counters use: CR
708.2 makes a face-down permanent a 2/2 with no abilities, so it has no "enters
tapped" however its face reads underneath.

⚠️ An EVENT, never a reducer branch, for D107's exact reason: `apply` is pure in
`(state, event)` alone and cannot look a printing up, and `tapped` is part of the
state hash. It lives in `applyReplacements` because TEN places move a card onto
the battlefield and the tap has to happen at all of them — asserted by a test
that plays the land properly rather than moving it with a Tier-3 tool.

### And the replacement API had never run

```ts
const defs = scripts.replacements();
if (defs.length === 0) return events;
// Card scripts get their turn after the built-in…
return events;                              // ← either way
```

⚠️ **A registered `ReplacementDef` had never fired, in any game, since M3.** It
fetched the list, checked whether it was empty, and returned unchanged whichever
answer it got. D130 and D131 both named it while measuring something else. It is
`TriggerDef.optional`'s shape exactly (D128): a seam nothing consumed, invisible
because nothing raised it. It runs now.

⚠️ **`used` IS THE TERMINATION ARGUMENT AND ALSO THE RULE.** CR 614.5 — an effect
applies at most once to a given event. Without it `Hardened Scales` ("if one or
more +1/+1 counters would be put on a creature you control, that many plus one
are put on it instead") replaces its own output forever: its result matches its
own condition exactly. `api.ts` asked for this guard in a comment and could not
enforce it. It does not return a wrong number without the guard; it does not
return.

⚠️ **CR 616's CHOICE IS NOT BUILT, AND THAT IS SAID.** When several replacements
apply to one event the affected object's controller chooses the order, and that
is a prompt. Two counters with `Hardened Scales` and `Branching Evolution` on the
board is **six** one way round and **five** the other — the order is not a
detail. This applies them in BATTLEFIELD order, the timestamp order D129
established for layers: deterministic and replayable, and not the rule. A card
whose correctness depends on choosing stays unregistered, which costs nothing
while `EMPTY_REGISTRY` ships.

⚠️ And registration order must not decide it — the defect D129 found in layer 6,
where the defs loop sat outside the battlefield loop. Asserted with the same two
scripts registered in both orders.

### What it is worth

**`complete`: 1,472 → 1,577 (+105)** — the largest single step of M6.3, and
**lands went 48 → 128**. Across the milestone, `complete` has gone **1,405 →
1,577**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,472 | **1,577** |
| …of which LANDS | 48 | **128** |
| scriptable with no primitive at all | 1,130 | **1,192** |
| cards with no Tier-3 note | 1,870 | **1,983** |

⚠️ **Four other rows went UP**, and it is not a regression: `optional` 2,012 →
2,033, `layer6` 1,722 → 1,734, `effect:counter` 1,351 → 1,364, `effect:token` 796
→ 804. A card that was blocked by replacement AND one other thing is now blocked
by the other thing ALONE, so it moves INTO that row's sole-need count. The rows
are a partition of what is left, and finishing one feeds the others.

⚠️ **`tier3`'s residue moved 345 → 351** and `residual === residualKeyword` still
holds — the six are cards whose only remaining unnamed line is a keyword D68
chose not to name. The invariant is what matters, not the number.

### The fuzz gate

`Orzhov Guildgate` and `Haunted Ridge` both join `DECK`, and the pair is the
point: a rule that fires on everything and a rule that fires on the right things
look identical with only the positive case dealt.

⚠️ The canary counts a `PermanentsTapped` that FOLLOWS a `CardsMoved`. Counting
every tap would also count the untap step's mirror, every Tier-3 wrench and every
land tapped for mana — none of which is this rule.

500 seeds, green, every per-seed replay hash matching:

| | D130 | D133 | D134 |
|---|---:|---:|---:|
| accepted intents | 92,630 | 92,254 | **92,113** |
| events | 2,375,679 | 2,413,154 | **2,424,881** |
| turns | 18,051 | 18,349 | **18,374** |
| tokens by the rules (nameable) | 0 | 782 (782) | **826 (826)** |
| permanents entered tapped | 0 | 0 | **1,034** |

### Verified

**1,215 Vitest passing / 8 skipped across 59 files** (up from 1,199 / 8 across
57: 7 in `entersTapped.test.ts`, 8 in `replacements.test.ts`, both driven with
real cards) **· `tsc -b` clean · `npm run build` clean · the 500-seed replay fuzz
gate green at 92,113 accepted intents / 2,424,881 events / 18,374 turns ·
`battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40` 78.8%
[68.6%, 86.3%], 0 faults · `npx electron scripts/probe.cjs` 124/124.**

⚠️ The gate ran before the replacement-API change landed, and did not need
re-running for it: `applyReplacements` returns early on an empty def list, and
the fuzz registry holds triggers and statics but no replacements, so that path is
byte-identical. The enters-tapped rule WAS in the run — 1,034 of them.

### Reportable, found and not fixed

⚠️ **The other 245 sole-need `replacement` cards need CR 616's prompt**, which is
the one thing between the API being live and it being usable at scale. It is a
real decision that changes outcomes and it belongs with the other prompts, not
with a default.

⚠️ **"Enters tapped UNLESS …" is 60+ cards on four wordings**, all correctly
refused. Each is a condition the engine could evaluate — "you control two or
more other lands" is a board query — so this is the cheapest remaining slice of
the row, and it needs a conditional-replacement shape rather than a boolean on
the face.

⚠️ **`Grimgrin enters tapped and doesn't untap during your untap step`** is the
one shape where the clause is joined to a second rule by "and" rather than
separated by a full stop. Three cards; refused, and worth a second look when
untap restrictions arrive.

## D135 — "Enters tapped UNLESS": seven board queries, and the one that is a prompt

D134 built the unconditional clause and named the rest as the cheapest remaining
slice: "enters tapped unless …", 60+ cards on four wordings. Measured properly it
is **112 cards on 40 distinct wordings**, and the measurement is what shaped the
vocabulary rather than the other way round.

### The wordings, and what they collapse to

| query | wordings | cards |
|---|---|---:|
| `otherLands` | "you control two or more / two or fewer other lands", and the INVERTED "if you control two or more other lands, this land enters tapped" | 26 |
| `controlPermanent` | "a Forest" · "a Forest or a Plains" · "a basic land" · "a Mount or Vehicle" · "a legendary creature" · "a legendary green creature" | ~48 |
| `basicLands` | "two or more basic lands" | 10 |
| `opponents` | "you have two or more opponents" | 10 |
| `anyPlayerLifeAtMost` | "a player has 13 or less life" | 10 |
| `opponentsLands` | "your opponents control eight or more lands" | 5 |
| `otherLandsOfType` | "three or more other Islands / Forests / Mountains / Swamps / Plains" | 5 |

Seven queries, 104 of the 112. Every one is a question about the board that the
engine can answer with no input from anybody, which is exactly what makes them
buildable — and nothing is modelled speculatively, because a shape the pool does
not print is a shape no real card can test.

### The one that is not a board query

⚠️ **`As this land enters, you may pay 2 life. If you don't, it enters tapped.`**
— 20 cards on that exact wording, 37 across the shape, and it is **a PROMPT**.
Reading it as a query means the engine decides not to pay, every time, silently:
the player is never offered the choice the card gives them. That is D90's rule
with a decision instead of an effect, and `Godless Shrine` is a fixture so the
refusal is a test rather than an intention.

### Two things that were nearly wrong

⚠️ **THE ENTERING LAND IS NOT ON THE BATTLEFIELD YET, and every "other lands"
count depends on it.** `applyReplacements` runs on the state BEFORE its own event
is applied — the property `withTransformCounters` already relies on to see the
old face — so counting the battlefield as it stands is exactly the "other" the
cards mean. Nothing has to exclude the card itself, and a version that did would
be wrong by one on every dual land in the format.

⚠️ **`selfRef` MATCHES `This land` AND NOT `this land`**, because every clause it
was written for starts a sentence. The inverted wording says it mid-sentence:
"If you control two or more other lands, **this land** enters tapped." The clause
parsed as nothing, so `Lair of the Hydra` came in UNTAPPED on every board — the
failure mode that looks exactly like the feature working, because an untapped
land is what you get when a rule does not fire. Caught by the test that was
written for the inverted wording specifically, and fixed with a case-insensitive
pass in `replacementParse` rather than by changing `selfRef`, which
`effectParse`'s whole vocabulary depends on.

⚠️ **The inverted wording is normalised at PARSE time**, so there is one
evaluator. "enters tapped IF you control ≥2 other lands" is exactly "enters
tapped UNLESS you control ≤1 other lands"; doing that flip in the engine would
have meant a second place that knows what these clauses mean. Only `otherLands`
prints this way (5 cards), and inverting anything else would be a guess — so
anything else is refused.

### One field, not a boolean and a condition beside it

`OracleFace.entersTapped` is `EntersTapped | null` now: `null` does not enter
tapped, `{ unless: null }` always does, a condition means it does unless that
query holds. ⚠️ **Two fields would have been a trap**: "enters tapped unless you
control a Forest" is not `entersTapped: false`, and a caller that checked only
the boolean would let it in untapped every time.

### What it is worth

**`complete`: 1,577 → 1,642 (+65), and every one of them is a LAND** — 128 → 193,
which is **17.3% of all 1,114 Commander-legal land names**. Across M6.3,
`complete` has gone **1,405 → 1,642**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,577 | **1,642** |
| …of which LANDS | 128 | **193** |
| cards with no Tier-3 note | 1,983 | **2,048** |
| scriptable with no primitive at all | 1,192 | **1,199** |

⚠️ Four other rows rose again — `optional` 2,033 → 2,037, `layer6` 1,734 → 1,736,
`counter` 1,364 → 1,365, `token` 804 → 812 — for D134's reason: a card blocked by
this AND one other thing is now blocked by the other thing alone.

### The fuzz gate

`Sunpetal Grove` joins `DECK` beside `Haunted Ridge`, so both answers get
exercised as a real game's board fills up — which no single-state test can do —
and `Godless Shrine` joins as the one the parser must refuse.

500 seeds, green, every per-seed replay hash matching:

| | D133 | D134 | D135 |
|---|---:|---:|---:|
| accepted intents | 92,254 | 92,113 | **91,657** |
| events | 2,413,154 | 2,424,881 | **2,412,366** |
| turns | 18,349 | 18,374 | **18,238** |
| permanents entered tapped | 0 | 1,034 | **1,450** |
| tokens by the rules (nameable) | 782 (782) | 826 (826) | **820 (820)** |

⚠️ **Entering tapped is up 40% at 1,450**, which is the conditional lands
answering both ways across a game rather than a fixed shape firing more often.

### Verified

**1,222 Vitest passing / 8 skipped across 59 files** (up from 1,215 / 8: 7 new in
`entersTapped.test.ts`) **· `tsc -b` clean · `npm run build` clean · the 500-seed
replay fuzz gate green at 91,657 accepted intents / 2,412,366 events / 18,238
turns · `battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40`
78.8% [68.6%, 86.3%], 0 faults · `npx electron scripts/probe.cjs` 124/124 ·
`CRT_PRIMITIVES_REPORT=1` reading "1642 run completely today".**

### Reportable

⚠️ **The 37 "you may pay N life" lands need an `asEnters` PROMPT**, which is also
what the 4 "as this land enters, choose a colour" cards need and what CR 616's
ordering needs. Three separate rows now converge on one missing piece: **a
replacement effect that asks a question**. That is the next thing worth building
by weight of cards rather than by row.

⚠️ **`Grimgrin enters tapped and doesn't untap during your untap step`** is still
refused — three cards, the one shape where the clause is joined by "and" rather
than split by a full stop, and it needs untap restrictions rather than a wider
parser.

⚠️ **"Enters tapped with two charge counters"** (10 cards) is the enters-tapped
clause and the entry-counter clause in one sentence. Both rules exist; nothing
reads them together.

## D136 — A replacement effect that asks: three prompts, not one, and D135 was wrong about that

D135 closed with "three separate rows now converge on one missing piece: **a
replacement effect that asks a question**". Measured, that is **wrong**, and the
correction is the useful part of this entry. The three do not converge — they are
three different prompts with three different answer types and wildly different
payoffs, and building them as one would have meant designing for a shape no card
has.

### The measurement D135 should have made

"As ~ enters, …" is **267 cards on 115 distinct wordings**. Split by what the
sentence asks for, against `engineComplete`'s own leftover lines:

| family | cards reached | COMPLETE if built | what the answer IS |
|---|---:|---:|---|
| `choose` | 162 | **6** | a value that must be STORED and read later |
| `other` | 47 | 12 | a grab bag — copy, mill, become-a-creature |
| `pay` | 32 | **16** | yes/no, and a life payment |
| `reveal` | 19 | 15 | yes/no, and WHICH CARD |

⚠️ **THE BIGGEST FAMILY IS WORTH SIX CARDS.** `choose` is "as this enters, choose
a creature type" (55) · "choose a color" (33) · "choose an opponent" (10) — and
**172 of the other unaccounted lines on those cards read "the chosen"**. The
choice only matters because a static or triggered ability later says "creatures
of the chosen type get +1/+1". Build the question without the reader and the
engine asks a player for an answer that does nothing: a prompt as theatre, which
is worse than the silence it replaced. It needs a `chosen` field on card state
AND the abilities that consume it, and that is a primitive of its own.

⚠️ **D135's own "4 cards" for this family was ALSO wrong** — that was `asEnters`
counted over LANDS only, carried forward into a sentence about the whole
database. Two wrong numbers in one reportable, both from measuring a subset and
reporting a total.

### What got built, and what did not

**`pay`.** "As this land enters, you may pay 2 life. If you don't, it enters
tapped." — the shock lands. A yes/no question, a cost the engine already has an
event for, and a declined branch that is exactly D135's enters-tapped.

**`reveal` is REFUSED, and the reason is a different prompt.** "You may reveal a
Plains or Island card from your hand" needs the player to name WHICH card — that
is `chooseFromZone`, D127's 1,625-card primitive, and answering it needs a client
that can draw a list of cards and take a pick. 19 cards, 15 of them completable,
sitting behind an answer type this prompt does not have. Worth saying because the
ratio is the best on the board and it will be cheap once `chooseFromZone` lands.

### One field, one vocabulary, one evaluator

`payLife` is an **`EntersTappedCondition`**, beside the seven board queries D135
built — not a second field and not a second parser. "You may pay 2 life, and if
you don't it enters tapped" IS "it enters tapped unless you pay 2 life", so it
normalises at parse time exactly as D135's inverted wording does.

⚠️ **It is the one member that is a QUESTION rather than a QUERY**, and every
wrong way to handle that is silent. So `conditionHolds` does not take it: its
parameter is `Exclude<EntersTappedCondition, {kind:'payLife'}>`, and a caller
that forgets `isAskedCondition` fails `tsc -b` rather than tapping a land and
never asking. Same instrument D125 used to stop `simplestAnswer` returning null —
a `false` branch here would be D135's refusal reintroduced as a bug, and a `true`
branch would let the land in untapped for free.

### The permanent has already entered, and it is untapped

⚠️ **THIS IS THE ARCHITECTURAL DECISION.** `applyReplacements` is a pure
`(state, events) → events`; it cannot stop and wait. Suspending the fold would
mean a CONTINUATION living in `GameState` — hashable, replayable, and enormous.
So the entry happens, the question is asked, and the answer appends either the
life payment or the tap.

Nobody can act in the gap, because an `Awaiting` blocks every other intent. The
only observer of it is a card that triggers on "enters tapped", and that is the
same one-event-later shape `withEntersTapped` has had since D134 rather than a
new divergence. **A test that reads `tapped` before answering gets `false` every
time**, which is worth knowing before writing one.

⚠️ **THE LIFE IS RE-CHECKED IN THE HANDLER, not trusted from the prompt.** The
prompt was written when the permanent entered; the answer arrives later, and
between them an SBA can have taken the player below the price. And a player who
CANNOT pay is never asked at all (CR 119.4) — asking would offer a choice whose
"yes" the handler must refuse, and a prompt whose obvious answer is rejected is
how a table wedges. At exactly the price the payment is legal, so the guard is
`<` and not `<=`: paying to 0 loses the game, and that is the player's call.

### The queue, and the honest thing about it

A queue like `commanderZoneChoice`'s, because one `CardsMoved` can carry several
of these and asking about one while silently tapping the rest is half-execution.

⚠️ **NO INTENT PRODUCES A TWO-CARD BATTLEFIELD MOVE TODAY, and that is said
rather than papered over.** `ManualMoveCard` moves one, `ManualMoveZone` goes
only graveyard/exile → library/exile, resolution puts down the one permanent that
resolved. So the queue is reachable only from a card script that puts two lands
out at once — and `EMPTY_REGISTRY` ships. It is built because the alternative
when it DOES become reachable is a silently tapped land, and because a funnel is
exactly where that kind of gap hides: this milestone has now found two of them
(D128's dead `optional` flag, D134's dead `ReplacementDef`). Its two tests drive
`applyReplacements` and `handle` at the seams it is reachable at, and the test
says it is not end-to-end.

### The first prompt of M6.3 the BOT can actually price

`optionalTrigger` (D128) carries a label and nothing else, so the bot's accept is
a stated policy it cannot justify. This one carries a NUMBER against a life total
the bot reads off its own `PlayerView`, and `eval.ts` is denominated in
life-equivalent points precisely so a cost like this has something to compare
with. It pays down to a FLOOR of 12 life — ⚠️ **a floor and not a ratio, because 2
of 40 and 2 of 6 cost the same and are completely different decisions.**

⚠️ And it is REACHABLE, unlike D128's: the pool grew, so `botDeck.ts` regenerated
with **`Temple Garden`** in it. A generated file with a byte-exact no-op guard,
caught by that guard — which is the thing D130 found `botDeck.ts` missing.

### What it is worth

**`complete`: 1,642 → 1,658 (+16)** — 15 lands and one instant. Across M6.3,
**1,405 → 1,658**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,642 | **1,658** |
| …of which LANDS | 193 | **208** |
| cards with no Tier-3 note | 2,048 | **2,063** |
| `optional` sole-need | 2,037 | **2,022** |

⚠️ **`optional` FELL by 15 of the 16, and that is this build showing up in
another row.** "You may pay 2 life" is a "you may", so the classifier had those
cards under `optional`; they are complete now, so they leave it. The inverse of
D134's four rows rising, and the same fact: the rows partition what is left. The
sixteenth was blocked on something else and is the one instant.

⚠️ **16 is small, and smaller than D135 implied** — it named "37 cards" for this
shape, which was cards CARRYING the line rather than cards it would finish. The
other 15 are Zendikar-style MDFCs whose front face is a spell the engine cannot
run, plus `The Black Gate`'s second ability. Reporting reach as though it were
unlock is the exact error `primitives.node.test.ts` was built with two columns to
prevent, made in prose instead of in the report.

### The fuzz gate

`Godless Shrine` changes sides here too — it was in `DECK` as the card the parser
must REFUSE and is now the only route this gate has to the new prompt.
`The Black Gate` joins it, so a cost hardcoded to 2 cannot pass.

⚠️ **The answer is a COIN FLIP, guarded on affordability.** `simplestAnswer`
always declines — right for a driver that must never run card text a test did not
ask for — so 500 seeds of it would leave the PAYING half unexercised while the
tap counter rose anyway. And paying can be REJECTED, so the flip checks the life
total first: a rejected intent is not a wedge here, but it is a seed that quietly
stopped testing the thing it was reached for.

⚠️ **The canary is TWO numbers**, for the may-trigger canary's reason: paying is a
`LifeChanged` like any other and declining is a `PermanentsTapped` like a land
tapped for mana, so only the marker event can tell this path from either.

500 seeds, green, every per-seed replay hash matching:

| | D134 | D135 | D136 |
|---|---:|---:|---:|
| accepted intents | 92,113 | 91,657 | **88,305** |
| events | 2,424,881 | 2,412,366 | **2,301,233** |
| turns | 18,374 | 18,238 | **17,345** |
| permanents entered tapped | 1,034 | 1,450 | **1,412** |
| paid life to enter untapped | — | — | **491** |
| declined | — | — | **476** |

⚠️ Intents, events and turns are all down ~4%, and the cause is this prompt: an
`entersChoice` consumes one of the seed's 200 intents every time a shock land is
played, and blocks every other intent until answered. Fewer intents left for
playing the game. Not a regression — a prompt that costs a turn of fuzzing is a
prompt the gate is actually reaching.

### Verified

**1,233 Vitest passing / 8 skipped across 59 files** (up from 1,222 / 8: 11 new in
`entersTapped.test.ts`) **· `tsc -b` clean · `npm run build` clean · the 500-seed
replay fuzz gate green at 88,305 accepted intents / 2,301,233 events / 17,345
turns · `battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40`
78.8% [68.6%, 86.3%], 0 faults · `npx electron scripts/probe.cjs` 124/124 ·
`CRT_PRIMITIVES_REPORT=1` reading "1658 run completely today".**

⚠️ **PLAYED BY HAND THROUGH THE REAL UI, which D128 explicitly could not do** —
its prompt was unreachable in the shipped app because `host.ts` builds with
`EMPTY_REGISTRY`, and D128 left "M6.4 must drive this prompt through the real UI"
as a debt. This one needs no registry at all: a real deck, a real `PlayLand`, and
the bar reads **"Godless Shrine enters tapped unless you pay 2 life."** with
**Pay 2 life** and **Enter tapped**. Clicking Pay took 40 → 38 with the land
upright and logged "Ana pays 2 life for Godless Shrine."; clicking Enter tapped
left 40 and logged "Godless Shrine enters tapped."

⚠️ **`battery-anim.cjs` caught a test helper named after the browser dialog it
bans.** It greps `src/` for a call to `promp`+`t` because that throws in Electron,
and a local helper by that name tripped it on a plain-text match. Renamed the
helper — weakening a security-shaped check to keep a nicer identifier is how a
real hit gets missed later.

### Reportable

⚠️ **`faceOf(printing, 0)` MEANS MDFC BACKS ARE NEVER READ.** Every Zendikar
Rising modal land — "As this land enters, you may pay 3 life" on face 1 — is
invisible to `withEntersTapped`, and to D134's and D135's rules before it. That is
16 printings of the 3-life wording alone. Pre-existing and unrelated to the
prompt; it needs the engine to know which face a permanent entered as.

⚠️ **`chooseFromZone` now has TWO families waiting on it that are already parsed
elsewhere** — the 19 reveal lands here, and D127's own 1,625. Its answer type (a
card picked from a listed set) is also what CR 616's ordering prompt needs, one
level up. It is the best-value prompt left.

⚠️ **The `choose` family (162 cards) needs a `chosen` field on card state, and it
does not exist.** Nothing in `GameState` can hold "this permanent's chosen
creature type", so nothing can read it back. That is the primitive, not the
question — and the question without it is a prompt whose answer is discarded.

## D137 — Discarding, the first prompt over a HIDDEN zone, and two bugs that were not bugs

`chooseFromZone` is D127's biggest unbuilt row after the ones already done — 1,625
cards by reach, 769 by sole need. Split for the seventh time running, it is not a
primitive.

### The split, and one alternative that matches nothing

The row is ONE regex with five alternatives, and they are five different rules:

| alternative | cards | COMPLETE-if-built |
|---|---:|---:|
| `discard N` | 801 | 404 |
| `from your graveyard/hand to …` | 675 | 273 |
| `look at the top N` | 154 | 86 |
| `return a card from a graveyard` | 9 | 3 |
| `search library or graveyard` | **0** | 0 |

⚠️ **THE FIFTH MATCHES ZERO CARDS, and has since D127.** `effect:search` is
checked first in the same ordered list and its pattern is strictly broader —
`(your|target player's|their|a)` against `(your|target player's|a)`. Every line
the `chooseFromZone` alternative could match, `effect:search` claimed one rule
earlier. Dead alternation in the classifier that decides the build order.

### And DISCARD split again

801 cards, by what the clause actually IS:

| shape | cards | COMPLETE-if-built |
|---|---:|---:|
| an ACTIVATED payload | 265 | 150 |
| a TRIGGER payload | 239 | 111 |
| a plain one-shot EFFECT | 221 | **135** |
| a MODE of a modal spell | 44 | 0 |
| an additional COST | 25 | 1 |
| a keyword COST (ward) | 18 | 4 |

Only the plain effect is a spell that can resolve by itself. And WHO PICKS, over
825 lines: **717 the discarding player** · 54 at random · 53 the caster · 1 an
already-named card.

### What got built

`discard` joins the closed effect vocabulary, and `Awaiting.chooseFromZone` is
the 15th prompt kind.

⚠️ **IT IS THE FIRST PROMPT OVER A HIDDEN ZONE, AND IT CARRIES NO CARD IDS.**
Every other variant in the union names battlefield permanents or stack objects,
and each says so, because `Awaiting` crosses the wire WHOLE (D61). A hand is
hidden: listing the candidates would post one player's hand to every client the
moment they were asked to discard. So the prompt says only WHO, WHICH ZONE and
HOW MANY, and the client computes the candidates from its own `PlayerView` —
D125's rule that a variant needs a client able to COMPUTE the answer, satisfied
by construction rather than by shipping the answer. A test asserts the prompt's
keys are exactly `count, kind, label, player, zone`.

⚠️ **The price is paid in the handler**, which is the whole legality check
because the prompt vouches for nothing: exact count, no DUPLICATE ids (`[c1, c1]`
has length 2 and is one card), every id in that player's own hand. Four
rejections, each with its own message.

⚠️ **NO PROMPT WHEN THERE IS NO CHOICE** (CR 701.8a). An empty hand discards
nothing; a hand no bigger than the count goes to the graveyard whole. A question
with one legal answer is a click that teaches the player nothing.

### What is refused, and why each is a different prompt

⚠️ **`at random` (54 lines) — REFUSED, and it cannot be approximated.**
`effectEvents` has no RNG, and randomness in this engine comes only from the
seeded generator threaded through the log. Running it as a chosen discard hands
the player a decision the card does not give them, which is D90 pointing the
other way. `Hymn to Tourach` is a fixture so the refusal is a test.

⚠️ **`Target opponent reveals their hand. You choose a nonland card from it.`
(53 lines) — REFUSED.** The CASTER picks, from a hand that has been made public
first. A different chooser, a different prompt. `Duress` is the fixture.

⚠️ **`each opponent discards a card` is not built.** This vocabulary addresses a
player through `targetIndex`; "each opponent" is a SCOPE the spec cannot say, and
inventing one for a handful of cards is a field every other rule has to ignore.

### What it is worth, and the gap that matters

**`complete`: 1,658 → 1,665 (+7).** Across M6.3, **1,405 → 1,665**.

⚠️ **THE ROW SAID 801, THE SOLE-NEED SAID 404, THE PLAIN-EFFECT SUBSET SAID 135,
AND THE ANSWER IS 7.** Each of those numbers is honest about a different
question, and only the last is cards the engine now runs. The anchoring is why:
`^target (?:player|opponent) discards (N) cards?\.$` is a whole sentence, and
most of those 221 cards have more text than that. This is D130's shape exactly —
a 1,441-card row that paid 7 — and it is the third time a "COMPLETE-if-built"
estimate has overshot by two orders of magnitude. **Measure the SENTENCE, not
the row.**

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,658 | **1,665** |
| spells that resolve alone (`auto`) | 337 | **344** |
| spells with an offerable clause (`assisted`) | 1,532 | **1,564** |
| cards with no Tier-3 note | 2,063 | **2,070** |
| `scriptableToday` | 1,199 | **1,206** |

⚠️ **The ASSISTED jump (+32) is bigger than the auto one (+7)**, and it is the
better result: 32 more spells whose discard clause the prompt bar can offer as
one logged click, where before the whole card was the player's.

### The fuzz gate

`Mind Rot` is the only route to the new prompt and needs no registry — a real
cast at a real player, which the fuzzer does constantly. `Hymn to Tourach` joins
as the card that must NOT resolve by itself.

⚠️ **The fuzzer picks its cards RANDOMLY, not the first `count`.**
`simplestAnswer` takes the first, deterministically, because its job is an answer
that always exists; a gate that only ever discarded the same corner of the hand
would never exercise a replay whose order depended on the pick.

⚠️ **The canary is TWO numbers** — prompts ANSWERED and cards that actually
moved. `CardsMoved` hand→graveyard also happens at cleanup for a hand over seven,
so the move count alone would have been green since M3; the narration counter is
the one only this path writes.

500 seeds, green: **85,421 accepted intents · 2,328,874 events · 17,721 turns ·
240 discards chosen, 339 hand→graveyard moves.**

### Verified

**1,244 Vitest passing / 8 skipped across 60 files** (up from 1,233 / 8: 11 new in
`discard.test.ts`) **· `tsc -b` clean · build clean · the 500-seed gate green ·
`battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40` 78.8%
[68.6%, 86.3%], 0 faults · probe 124/124.** Fixtures 107 → 111.

**Played by hand through the real UI**: `Mind Rot` cast at Ben, the bar reading
**"Ben is discarding 2."** to Ana and **"Mind Rot: click 2 cards in your hand to
discard."** to Ben, one ring after the first click, and the second click sending
it — hand 7 → 5, graveyard 2, log **"Ben discards 2 cards."**

### ⚠️ TWO BUGS REPORTED THIS SESSION THAT DID NOT EXIST

Both cost real time and both would cost it again, so they are recorded as traps
rather than as history.

⚠️ **1. "`botPool` measurements are order-dependent."** They are not. `auto`
(face 0) and `autoAnyFace` (any face) moved by DIFFERENT amounts this session —
337→344 and 344→350 — which puts the OLD value of one on the NEW value of the
other. Re-pinning the wrong line then produces `auto` > `autoAnyFace`, a state no
card pool can be in, which read as corruption. Verified identical across isolated
and full-suite runs once the pins were right. **`expect` throws on the first
failure**, so the "evidence" that the second assertion disagreed was an assertion
that had never run.

⚠️ **2. "Mind Rot resolves in the app and discards nothing."** It does not. The
prompt is raised for the TARGET, and the hand-off that shows it to them is the
hotseat auto-switch — which the investigation had turned off with
`setAutoSwitch(false)` two steps earlier. Then, viewing the right seat, clicking
`[data-hand-instance]` did nothing because **that is the SLOT WRAPPER; the click
handler is on `[data-instance-id]` inside it.** A click on a parent does not fire
a child's handler.

⚠️ **AND THE THIRD, WHICH IS THE REUSABLE ONE: `window.__crt.engine.view()` LAGS
THE ENGINE BY ONE ANIMATION GROUP.** The choreographer commits a group's view
when that group's animation starts, so the view can report "p1 has priority in
main1" while the engine rejects a sorcery-speed cast as out of phase, and can
report a hand size that a resolution has already changed. **Drive CDP
verification off `submit()` results, never off the view.** This is not a bug; it
is the design in the architecture note, read from the wrong side.

### Reportable

⚠️ **The other three alternatives in this row are still unbuilt, and the biggest
is `return a card from your graveyard` (675 cards, 273 sole-need)** — the same
prompt shape over a PUBLIC zone, so it needs no hidden-information design at all
and can list its candidates. It is the cheapest remaining slice.

⚠️ **`look at the top N` (154 cards) already has half its machinery**: D114 built
`view.peek`, `ManualStopPeeking` and `ManualMoveTopOfLibrary` for scry and
surveil. What is missing is an EFFECT that raises it rather than a Tier-3 tool.

### The one change that came out of the false alarm

⚠️ **A CLAUSE WHOSE TARGET HAS GONE NOW SAYS SO.** It was a bare
`if (!effect.self && !aim) continue;`. CR 608.2b is right that the spell still
resolves — only an ALL-illegal spell is countered on resolution — but the log
read "Mind Rot resolves." and nothing else, which is exactly what a broken effect
looks like. That ambiguity is the whole reason the non-bug above took four hours:
the investigation had no way to tell "your target left" from "this effect does
not work", so it went looking inside the engine. The line now reads
`Mind Rot — no legal target left for “Target player discards two cards”`.

⚠️ **NOT REACHABLE BY FIZZLING A SINGLE-TARGET SPELL** — that path is
countered on resolution and never enters `effectEvents` at all. It takes a cast
that NAMES no target, which a client can submit, and that is what the test does.
Checked by DELETING the narration: exactly its own check fails and nothing else
moves.

⚠️ **AND IT FIRED ZERO TIMES IN 500 SEEDS.** The gate came back
byte-identical to the run before it — 85,421 accepted intents / 2,328,874 events
/ 17,721 turns — so no seed reaches this branch: the fuzzer's spells either keep
their targets or lose all of them and fizzle. The branch is real, rare, and
exercised only by the unit test. Recorded because a canary would have been green
over nothing here (D128's lesson), and because "the gate did not move" is the
correct result for a change that only adds a line to a path nothing takes.

## D138 — The graveyard return, and the target restriction that was never checked

D137 named this as the cheapest remaining slice: the same prompt shape over a
PUBLIC zone, so no hidden-information design needed. That was right, and it was
not the interesting part. **Building it found that `targetAllowed` had never
checked the zone or the card type**, so `Raise Dead` — "Return target creature
card from your graveyard to your hand" — could take a **land** out of an
**opponent's exile**.

### The split, for the eighth time running

686 blocked cards carry a graveyard-return clause.

| by destination | cards |   | by what the clause IS | cards | sole-need |
|---|---:|---|---|---:|---:|
| a HAND | 376 |   | plain one-shot EFFECT | 275 | **150** |
| the BATTLEFIELD | 312 |   | TRIGGER payload | 205 | 85 |
| | |   | ACTIVATED payload | 137 | 49 |
| | |   | modal MODE | 70 | 0 |

Only the plain effect is a spell that resolves by itself. Measured by the
SENTENCE rather than the row — D137's lesson, applied before building instead of
after — the five whole-card forms are worth **36 cards**:

| form | lines | WHOLE cards |
|---|---:|---:|
| `creature card` → hand | 16 | 12 |
| `creature card` → battlefield | 12 | 11 |
| typed (`instant or sorcery`) → hand | 8 | 6 |
| `card` (no type) → hand | 8 | 5 |
| mana-value-limited → battlefield | 4 | 2 |

### ⚠️ THE FIND: a restriction recorded and checked by nothing

`Raise Dead` parsed to `kinds:['card'], zones:[], unenforced:['creature card']`,
and `targetAllowed` — the ONE predicate both host and client use — checked
neither. Three separate holes in one card:

- **The ZONE.** `TargetSpec.zones` has existed since the targeting work and was
  read by NOTHING. `TargetKind`'s own comment says a card is "narrowed by
  `TargetSpec.zones`" about a narrowing that never happened. Everything in a
  graveyard OR exile answers to kind `card`, so an exiled card was a legal target.
- **The CONTROLLER.** "from YOUR graveyard" was not read at all, so any player's
  graveyard qualified.
- **The CARD TYPE.** "creature card" went into `unenforced` — the field
  `tier3.ts` prints as "the app will not check this" — so a land qualified.

⚠️ **`kinds` COULD NOT HAVE SAID IT.** In a graveyard every object gets exactly
one kind, `card`, whatever it is. That is right for "target card in a graveyard"
and useless for the 200+ cards that name a type, so "target creature card" and
"target card" produced the IDENTICAL spec. The fix is a new field on both sides —
`TargetSpec.cardTypes` and `TargetCandidate.types` — because the existing one was
structurally incapable of carrying the answer.

⚠️ **THE TYPE ERROR FOUND BOTH ADAPTERS, which is the file's whole design.**
Adding a required `types` to `TargetCandidate` failed `tsc -b` in four places:
the host's card/stack/player builders and the client's. That is D53's shape
holding — two producers, one predicate — and it is why this could be fixed
without hunting for the second copy.

⚠️ **AND THE ZONE PHRASE CARRIES A CONTROLLER**, so it is read in
`readController` rather than in the noun table: "from your graveyard" says both
WHICH zone and WHOSE. Checked BEFORE "you control", because a graveyard clause
never says "control" — the plain reader would return null, consume nothing, and
leave the phrase to be swallowed into the next clause's printed text. "a
graveyard" (Naya Charm) stays `controller: null`, because narrowing it to the
caster would BLOCK a legal choice — the one direction `targetParse` is never
allowed to be wrong in.

**547 fewer target specs carry an unenforced restriction: 1,987 → 1,440.** That
is this change's real size, and it is 15× the 36 cards the effect unlocked.

### Two effect kinds, not one with a flag

`returnFromGraveyard` (to a hand) and `reanimate` (to the battlefield) are
separate because **the reanimated card becomes a PERMANENT**: it enters the
battlefield, so it runs the whole entry funnel — loyalty counters (D107), "enters
tapped" (D134/D135), the pay-to-enter-untapped prompt (D136) — and none of that
applies to a card going to a hand.

⚠️ **THE CARD GOES TO ITS OWNER, THE PERMANENT TO THE CASTER.** A graveyard is
public and shared, so "your graveyard" is a TARGETING restriction; by resolution
the target is just a card id, and re-deciding the destination from the caster
would send a stolen card to the wrong hand. Reanimation is the opposite (CR
400.7a, "under your control") — and that also matters mechanically, because
`withEntersTapped` reads `move.to.player` to decide whose board a permanent is
arriving on, so naming the owner there would ask "do YOU control two other lands"
of the wrong seat (D135).

### Three things that were nearly wrong

⚠️ **A `.+` IN THE EFFECT PATTERN, CAUGHT BY ITS OWN TEST.** The first cut read
`^return target .+ from your graveyard to the battlefield\.$`, which happily
swallowed "creature card **with mana value 3 or less**" — a restriction
`TargetSpec` has no field for and `targetAllowed` therefore cannot check. The
spell would have run, reanimating anything at all, on a card that reads
correctly. `GY_NOUN` is closed to the three nouns the targeting layer can fully
decide: no type, `Creature`, and the `Instant`/`Sorcery` disjunction. ⚠️
`permanent card` is deliberately absent — its noun entry still marks itself
`unenforced`.

⚠️ **`moveTo` HARDCODES `from: battlefield`**, which is right for its four
existing callers (destroy, exile, bounce) and wrong for a card in a graveyard.
Using it left the card in BOTH zones, and `assertInvariants` caught it by name:
`c10 is in both hand:p1 and graveyard:p1`. The invariant did in one run what
reading the helper would not have.

⚠️ **A TEST WHOSE PREMISE THE ENGINE CANNOT REACH.** A draft asserted "a card
returns to its OWNER's hand, whoever cast the spell" by manually moving p2's card
into p1's graveyard — but a card always goes to its owner's graveyard (CR 404.3),
so the move simply put it where it already belonged and the test failed on a
state that cannot exist. Replaced with one that asserts the destination is read
from the owner, and a comment saying why that is worth pinning while the two are
always the same seat.

### What it is worth

**`complete`: 1,665 → 1,684 (+19)** — 17 sorceries and 2 instants. Across M6.3,
**1,405 → 1,684**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,665 | **1,684** |
| **target specs with an unenforced restriction** | **1,987** | **1,440** |
| spells that resolve alone (`auto`) | 344 | **364** |
| spells with an offerable clause (`assisted`) | 1,564 | **1,610** |
| faces parsed `effect:auto`, all printings | 1,915 | **2,067** |
| cards with no Tier-3 note | 2,070 | **2,090** |
| `scriptableToday` | 1,206 | **1,228** |

⚠️ **The Tier-3 notes SHRANK, and that is the disclosure telling the truth.**
Enforcing "creature card" removes its "the app will not check this" note from
every card carrying one — 20 more cards now say nothing at all, and the
longest-note list lost 6 members. A note about something the app DOES check is
the disclosure lying in the safe direction, which is still lying (D122's rule,
pointed the other way for the first time).

### The fuzz gate, and a slowdown that was not one

⚠️ **NO CARD IN `DECK` REACHES THIS EFFECT**, so the gate came back
byte-identical to D137's — 85,421 accepted intents / 2,328,874 events / 17,721
turns / 240 discards. That is the right result for a change that adds two effect
kinds no seed can cast, and it is said rather than left as a silent pass. The
targeting enforcement DOES run on every seed, and moved nothing: no seed was
relying on aiming at a card the clause did not allow.

⚠️ **AND THE GATE TOOK 860s AGAINST ITS OWN 600s TIMEOUT, WHICH WAS NOT THIS
CHANGE.** The obvious reading — identical games, 50% slower, therefore the new
per-candidate checks — is wrong, and D106's protocol is what settled it. Timed
back to back at 60 seeds on the same machine:

| | duration |
|---|---:|
| enforcement REVERTED | 73.65 s |
| enforcement RESTORED | **69.83 s** |

Statistically identical, and the restored run was the FASTER of the two. The 860s
run had Overwatch resident (14,701 s of CPU) plus my own Electron batteries
running concurrently — `battery-bot` reported **32 decisions/s against its usual
130**, which is the load showing up in a second instrument. D106 records this
exact case, Overwatch included. Two adjacent full-suite failures
(`diffView` at a 60 s timeout, the MCMF bench at 1.34 ms against a 1 ms bar) are
the same thing and pass in isolation.

### Verified

**1,256 Vitest passing / 8 skipped across 61 files** (up from 1,245 / 8: 11 new in
`graveyardReturn.test.ts`) **· `tsc -b` clean · build clean · the 500-seed replay
fuzz gate green and byte-identical at 510.75 s · `battery-anim.cjs bot engine` 102/102 ·
`battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults · probe 124/124.**
Fixtures 111 → 115.

⚠️ The three-hole fix is checked by its own test ONE HOLE AT A TIME — wrong
type, wrong controller, wrong zone — because a single combined case would still
pass if any one of them were re-broken.

### Reportable

⚠️ **`permanent card` is still `unenforced`**, and it is now the only common
graveyard noun that is. Giving it `cardTypes: ['Artifact','Creature','Enchantment','Land','Planeswalker','Battle']`
would widen `GY_NOUN` by one and is the cheapest follow-on here.

⚠️ **`TargetSpec` HAS NO NUMERIC RESTRICTION**, so "with mana value 3 or less"
(4 lines here, and far more across the format — `with power 3 or less`, `with
toughness 2 or greater`) cannot be enforced and every such card is refused. It is
one field plus one comparison, and it would unlock the mana-value reanimators
that this slice had to turn away.

⚠️ **The other two alternatives in D137's row are untouched**: `look at the top
N` (154 cards, half-built already by D114's scry/surveil machinery) and the
activated/trigger payload halves of this one (342 cards between them), which need
card scripts rather than a primitive.

## D139 — The numeric restriction, and a cast the host took on trust

D138 named this as one field plus one comparison. It is, and the field was worth
more than the arithmetic: **`complete` 1,684 → 1,711 (+27)**, and it turned up a
second hole on the way that has nothing to do with numbers.

### D138's own reportable had the mechanism wrong

D138 said "with mana value 3 or less" was a restriction `TargetSpec` had no field
for. True. What it implied — that the phrase sat in `unenforced` like "creature
card" did — is **wrong, and the truth is worse**. Measured:

**Target specs whose `unenforced` names a numeric attribute: ZERO.**

`Smite the Monstrous` ("Destroy target creature with power 4 or greater") parsed
to `kinds:['creature'], controller:'any', confident:true, unenforced:[]`. The
qualifier matched no noun entry, so it was **never recorded anywhere at all** —
not enforced, not disclaimed, not visible. The app would destroy a 1/1 with it,
`tier3.ts` said nothing because there was nothing to say, and `text` read "target
creature", so the prompt bar quoted the player a rule the card does not have.

That is a step below the holes D138 closed: those at least left a trace.

**What the database prints**, which is what shaped the closed vocabulary:

| attribute | lines | cards |   | comparator | lines |
|---|---:|---:|---|---|---:|
| mana value | 504 | 490 |   | `or less` | 587 |
| power | 385 | 370 |   | `or greater` | 335 |
| toughness | 33 | 33 |   | | |

Three attributes, two comparators. "converted mana cost" is the same attribute
under its pre-2021 name and normalises to `manaValue`.

### The order of the fix IS the fix

⚠️ **D138 REFUSED TO WIDEN THE EFFECT VOCABULARY FOR THIS WORDING, and was right
to.** `GY_NOUN` was closed to three nouns precisely because accepting "creature
card with mana value 3 or less" would have let a reanimation spell take
ANYTHING — the sentence would have been understood while the restriction inside
it was not. So: **enforce first, admit the wording second.** Doing it the other
way round is how a card that reads correctly runs incorrectly, and this milestone
now has that written down twice.

Once `targetAllowed` checks the restriction, one shared `QUALIFIER` fragment
widens both `TARGET` and `GY_NOUN` safely, and 103 more faces parse `auto`.

### Three values, and where each comes from

`TargetCandidate` gains `manaValue`, `power`, `toughness`.

⚠️ **DERIVED, NOT PRINTED.** CR 613 settles characteristics before targeting
legality is checked, so a pumped 2/2 really is a legal target for "power 4 or
greater". Reading the printed value would REFUSE a legal choice — the one
direction `targets.ts` may never be wrong in. The client reads `CardView.power`,
documented as "CURRENT power/toughness after counters and effects", because the
two adapters must agree or the veil lights up what the host will reject.

⚠️ **A SPELL ON THE STACK HAS A MANA VALUE**, and 504 lines restrict on it —
`Disdainful Stroke` is "Counter target spell with mana value 4 or greater".
Setting it to null alongside the stack candidate's (genuinely absent) power and
toughness would make every such counterspell refuse everything. An ABILITY on the
stack has no card and genuinely has none.

⚠️ **AND A MISSING NUMBER REFUSES.** A land has no power, so it cannot satisfy a
clause about power. This is the ONE place in `targets.ts` where absence narrows
rather than widens, and it is right because the SPEC is known: the parser read
the restriction, so the asymmetry that protects UNREAD clauses does not apply.

⚠️ The qualifier is read in `readController`, which **recurses**: "target creature
with power 4 or greater YOU CONTROL" puts the number between the noun and the
controller phrase, so a reader that looked for "you control" immediately after
the noun would find nothing and drop BOTH. Each qualifier consumes its own words
and hands the rest on. That also repairs `text`, which now reads the whole
printed clause.

### ⚠️ The second hole: `CastSpell` was taken at its word

Found while writing the test that a 2/2 cannot be Smited — the cast was
**accepted**.

`prepareCast` takes a `targets` list and uses it for exactly one thing: the ward
surcharge. **It never calls `validateTargets`.** The two-stage path validates in
`chooseTargets`; a `CastSpell` that NAMED its own targets had no equivalent and
was believed.

⚠️ **Not reachable from this app's UI**, which always lets the targets stage raise
its prompt — but "the host decides legality" is the property the entire net layer
rests on (D53, D61, invariant 4), and a rule enforced only when the client asks
nicely is not enforced. It is also exactly the seam a test driver uses, which is
how a suite can go green on casts no player could make: D137's
"skipped OUT LOUD" test cast Mind Rot with an empty target list, and the host
allowed it.

Closed here, and D137's test retargeted at `effectEvents` with a note saying the
way in is now shut.

### What it is worth

**`complete`: 1,684 → 1,711 (+27).** Across M6.3, **1,405 → 1,711**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,684 | **1,711** |
| spells that resolve alone (`auto`) | 364 | **394** |
| spells with an offerable clause (`assisted`) | 1,610 | **1,636** |
| faces parsed `effect:auto`, all printings | 2,067 | **2,170** |
| cards with no Tier-3 note | 2,090 | **2,117** |
| `scriptableToday` | 1,228 | **1,245** |

⚠️ `counter` sole-need fell 1,365 → 1,364: a card blocked by this AND the counter
vocabulary is now blocked by the counter vocabulary alone.

### The fuzz gate

⚠️ **BYTE-IDENTICAL AGAIN** — 85,421 accepted intents / 2,328,874 events / 17,721
turns, the same as D137 and D138. No card in `DECK` carries a numeric clause, so
no seed exercises the new restriction, and the two changes that DO run on every
seed (the qualifier in `readController`, the host-side cast validation) moved
nothing: no seed was relying on aiming at something a clause forbade, and no seed
casts with inline targets — the fuzzer answers the targets prompt like a client.
That is the right result, and it is stated rather than left as a silent pass.

⚠️ **457.48 s**, against 510.75 s for the identical games last time and 860 s for
the run that triggered D138's phantom-slowdown investigation. Same machine, same
work, three different wall-clocks — which is the measurement D106 exists to warn
about, now with a third data point.

### Verified

**1,268 Vitest passing / 8 skipped across 62 files** (up from 1,256 / 8: 11 new in
`numericTarget.test.ts`, 2 in `discard.test.ts`) **· `tsc -b` clean · build
clean · the 500-seed fuzz gate green and byte-identical at 457.48 s ·
`battery-anim.cjs bot engine` 102/102 · `battery-bot.cjs --games 40` 78.8%
[68.6%, 86.3%], 0 faults at 135 decisions/s · probe 124/124.** Fixtures 115 → 119.

⚠️ The enforcement is tested on the PAIR that differs by exactly the named number
— `Grizzly Bears` (2/2) against `Colossal Dreadmaw` (6/6) — because a predicate
that ignored the clause would light up both, which is precisely what happened
before this.

### Reportable

⚠️ **THE RESTRICTION IS READ EVEN WHERE THE EFFECT IS NOT, and that is worth
more than the 27 cards.** `Eternal Isolation` ("Put target creature with power 4
or greater on the bottom of its owner's library") stays Tier 3 — no word for that
destination — but its aim veil is now honest: the arrow lights only the creatures
the card may legally be pointed at, and the player applies the effect by hand.
That is true for all ~890 cards carrying one of these phrases, not just the 27
that became executable.

⚠️ **`x` IS REFUSED**: "with mana value X or less" is not a number known at parse
time, exactly as `num()` refuses X everywhere else in `effectParse`.

⚠️ **"with power N or less" ON A CLAUSE THAT ALSO NAMES A ZONE is still unread.**
`readController` matches the graveyard phrase only when it directly follows the
noun, so "target creature card with mana value 3 or less FROM YOUR GRAVEYARD"
gets the numeric restriction and loses the zone. The recursion added here is the
mechanism that would fix it — the graveyard branch needs to recurse the same way
the numeric one does.

## D140 — The qualifier readers now behave the same, and D139's reportable was wrong

D139 closed with: "with power N or less on a clause that ALSO names a zone is
still unread — the graveyard branch needs to recurse the way the numeric one
does." **Half of that was wrong**, and measuring before building is what caught
it. Again.

### What was already fixed, and by what

The numeric branch D139 added recurses, and it is checked FIRST. So the common
ordering was never broken:

```
Return target creature card with mana value 3 or less from your graveyard to your hand.
  → zones:['graveyard'] · controller:'you' · numeric:{manaValue, atMost, 3}
```

Both qualifiers, and `text` covering the whole printed clause. D139's reportable
described a gap its own change had already closed — written from reading the
code rather than from running it, which is the fourth claim this session to fail
that way.

### What was genuinely broken: the other order

```
Return target creature card in your graveyard with mana value 4 or less …
  → zones:['graveyard'] · numeric:NULL · text:"target creature card in your graveyard"
```

The graveyard branch RETURNED where the numeric one RECURSED, so it read the
zone and threw the number away — and truncated `text` to match, so the prompt bar
would quote a shorter rule than the card has. That is exactly the silent widening
D139 closed for the other ordering, surviving in the branch that was written
first, because the fix was applied to the new code and not to its neighbour.

### ⚠️ ONE CARD NEEDS IT, and the asymmetry is the reason to fix it

Measured over the Commander-legal pool: **one printed card** puts the zone before
the number — `Too Evil to Stay Dead`, "Choose target creature card in your
graveyard with mana value 4 or less."

⚠️ **AND IT MOVED NO COVERAGE NUMBER AT ALL.** That card is a Sorcery with
Teamwork, a conditional second target and "Return the chosen card" — far outside
the effect vocabulary, so it stays Tier 3 and `complete` is unchanged at 1,711.
What changed is its AIM VEIL: the arrow now lights only the creature cards the
spell may legally be pointed at, on a card the player still resolves by hand.

So the justification is not the card. It is that **two readers of the same kind
of qualifier behaved differently**, which is a bug waiting for the third
qualifier to be added — and the next one to be added would have inherited
whichever branch it was written next to.

### Verified

**1,269 Vitest passing / 8 skipped across 62 files** (up from 1,268: one new case
asserting BOTH orders) **· `tsc -b` clean · build clean.** The 500-seed fuzz
gate is green and **byte-identical for the fourth run running** — 85,421 accepted
intents / 2,328,874 events / 17,721 turns — at 487.28 s.

⚠️ Checked by REVERTING the recursion: exactly its own check fails
(`a zone and a number are both read, in either order`) and nothing else moves.

⚠️ No pinned measurement moved, which is the correct result and is stated rather
than left as a silent pass: this changes what one card's target clause ADMITS,
not what any card's text the engine can RUN.

## D141 — Look at the top N, and the sentence boundary that hid it

D137 named this as "half-built already by D114's scry/surveil". That was right
about the machinery and wrong about the hard part, which turned out to be a
splitter running before the parser.

### The tenth split

**350 blocked cards** carry the clause.

| by what the clause IS | cards | whole-card |   | where the rest go | cards |
|---|---:|---:|---|---|---:|
| TRIGGER payload | 149 | 92 |   | the BOTTOM | 186 |
| plain one-shot EFFECT | 138 | **97** |   | bottom, IN ANY ORDER | 75 |
| ACTIVATED payload | 64 | 20 |   | the GRAVEYARD | 54 |
| | | |   | back, in any order | 21 |

Only the plain effect resolves by itself — **and only the destinations that carry
no ORDER decision can be executed.** Measured by exact sentence:

| form | lines |
|---|---:|
| `…and the rest into your graveyard.` | 7 |
| `…and the rest on the bottom of your library IN ANY ORDER.` | 6 |
| `…and the other on the bottom of your library.` | 3 |
| `…on the bottom of your library IN A RANDOM order.` | 2 |

### Two refusals, for two different reasons

⚠️ **"IN ANY ORDER" IS A SECOND DECISION THE CARD GIVES THE PLAYER** and this
offers only the first. Executing it means picking an order on their behalf — D90
with a smaller stake and the same shape. It costs the biggest bottom-wording (6
lines, `Dig Through Time`), which is the price of the rule rather than an
oversight.

⚠️ **"IN A RANDOM ORDER" NEEDS THE SEEDED GENERATOR**, which `effectEvents` does
not have. Exactly D137's refusal of "discards at random", one card type along.

⚠️ **"THE OTHER" IS ADMITTED BECAUSE IT IS SINGULAR.** With one card left there
is no order to choose, so the qualifier the other bottom-wordings carry is
missing for a real reason. The build checks the arithmetic (`n - take === 1`) and
refuses the sentence when it disagrees, rather than being right by luck on the
printings that happen to exist.

⚠️ **A GRAVEYARD NEEDS NO QUALIFIER AT ALL** — it is ordered, but nobody chooses
that order, so the question never arises. That is why the graveyard form is the
largest one this can take.

### ⚠️ The splitter runs before the parser, and the first cut parsed NOTHING

`parseEffects` splits on `(?<=\.)\s+` and matches one rule per sentence. The card
prints **two** sentences that are one effect:

```
Look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library.
```

So a rule spanning the full stop could never match, however it was written — and
the first cut was written that way and returned `{effects: [], mode: 'manual'}`
on a card whose pattern read correctly. `sentences()` now JOINS a
`Look at the top N cards of your library.` head to the sentence after it.

⚠️ **THE JOIN CHANGES THE CLAUSE COUNT, which is what decides `auto` versus
`assisted`** (`understood < lines.length`). It is load-bearing in both
directions: without it `Sleight of Hand` is two clauses of which zero are
understood; with a LOOSER head it would glue an unrelated following sentence on
and quietly turn an `assisted` card into a `manual` one. The head is anchored at
both ends for exactly that reason.

### The prompt is the discard prompt over a second zone

`Awaiting.chooseFromZone.zone` becomes `'hand' | 'library'`, and it still ships
**no card ids**. A hand is hidden and the client sees its own; a library is
hidden and the client sees exactly the cards the rules just revealed to it,
through `view.peek` — D114's one exception to "a library is a count, full stop".
Same prompt, same guarantee, one more zone.

⚠️ **`CardsRevealed` IS WHAT MAKES IT ANSWERABLE**, and it is emitted by the
EFFECT rather than by a Tier-3 tool for the first time. `redactEvent` strips the
ids for everyone else, so the reveal is per-player by construction.

⚠️ **THE HANDLER DERIVES "THE REST" FROM THE REVEAL** — the leftovers are the
revealed library cards the player did not pick — so the prompt needs only a count
and a destination. Carrying the pool on the prompt would put a library's top on
the wire (D61). The reveal is CLEARED on the answer, or the player keeps seeing
the bottomed cards for the rest of the game.

⚠️ **AND ONE REAL BUG, CAUGHT BY ITS OWN TEST: the bottom is index 0.**
`addToZone` appends and `drawFromTop` takes from the END, so a move without
`placement: 'bottom'` put the declined card straight back under the next draw —
the exact opposite of what the card says, and invisible to any test that only
checked it had left the revealed set.

⚠️ **The field list on the discard prompt is PINNED, and D137's test failed the
moment `rest` was added.** That is the check working: every new field on a prompt
over a hidden zone gets looked at before it ships. `rest` is an enum naming a
destination, so it cannot leak; a field carrying ids would have failed the
no-ids loop beside it instead.

### What it is worth

**`complete`: 1,711 → 1,718 (+7)** — 6 sorceries and 1 instant. Across M6.3,
**1,405 → 1,718**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,711 | **1,718** |
| spells that resolve alone (`auto`) | 394 | **401** |
| spells with an offerable clause (`assisted`) | 1,636 | **1,641** |
| faces parsed `effect:auto`, all printings | 2,170 | **2,207** |
| cards with no Tier-3 note | 2,117 | **2,124** |
| `scriptableToday` | 1,245 | **1,249** |

⚠️ **7 cards from a 350-card row**, which is the fourth time an estimate has
overshot by two orders of magnitude — and the reason is the same every time: the
row counts cards CARRYING a clause, the sentence rules count cards whose WHOLE
text is understood. The `assisted` move (+5) and the 37 more faces reading
`effect:auto` are the wider effect.

### The fuzz gate

⚠️ **BYTE-IDENTICAL FOR THE FIFTH RUN RUNNING** — 85,421 accepted intents /
2,328,874 events / 17,721 turns — at 477.17 s. No card in `DECK` carries this
clause, so no seed reaches the new effect. What DOES run on every seed is the
`sentences()` JOIN, which touches how every card in the game is parsed, and it
moved nothing: no card in the fuzz deck has a `Look at the top N` head, so no
clause count changed. That is the result to want from a change to a shared
splitter, and it is stated rather than left as a silent pass.

### Verified

**1,280 Vitest passing / 8 skipped across 63 files** (up from 1,268 / 8: 11 new
in `lookAtTop.test.ts`) **· `tsc -b` clean · build clean · the 500-seed fuzz
gate green and byte-identical at 477.17 s · `battery-anim.cjs bot engine`
102/102 · `battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults at 124
decisions/s · probe 124/124.** Fixtures 119 → 123.

⚠️ Both refusals are FIXTURES, not assertions about text: `Dig Through Time`
(in any order) and `Drawn from Dreams` (in a random order) are in the pinned set,
so each refusal is a real printing the parser has to keep turning away.

### Reportable

⚠️ **"IN ANY ORDER" IS NOW THE BIGGEST SINGLE THING BLOCKED HERE — 96 cards**
across the two destinations. It needs an ORDERING prompt: pick the sequence for a
handful of known cards. That is a shape nothing in the engine has (`orderTriggers`
orders a list the player can already see, which is close), and it would also
serve CR 616's replacement ordering, still unbuilt since D134.

⚠️ **The trigger and activated halves are 213 cards between them** and need card
scripts rather than a primitive — the same M6.4 boundary every one of these
splits has run into.

⚠️ **`sentences()` NOW HAS A JOIN LIST OF ONE**, and the next multi-sentence
effect will want a second entry. If it grows past two or three, the honest move
is a two-pass parser rather than a widening list of heads.

## D142 — The ordering prompt, and a "96 cards" that was four

D141 closed by naming this the biggest thing left in its row: **96 cards** on "in
any order". Measured by SENTENCE before building — the eleventh split — it is
**four**.

### The measurement, and the fifth overshoot

| shape | lines | WHOLE cards |
|---|---:|---:|
| take M, order the REST to the bottom | 7 | **3** (`Impulse`, `Stock Up`, `Anticipate`) |
| take none, order all N back on TOP | 1 | **1** (`Index`) |

The other 92 are trigger payloads needing card scripts (`Sage Owl`'s "When ~
enters…" is 8 lines / 6 whole on its own), or want the optional type-filtered
reveal vocabulary — `You may reveal a creature card from among them` — which is a
different primitive entirely.

⚠️ **THIS IS THE FIFTH TIME A ROW-LEVEL ESTIMATE HAS OVERSHOT BY TWO ORDERS OF
MAGNITUDE** (D130, D137, D138, D141, and now this), and the cause is identical
every time: a row counts cards CARRYING a clause, and the sentence rules complete
cards whose WHOLE text is understood. The habit that fixes it is already in
place — measure the sentence before building — and this entry is the first where
the corrected number was known BEFORE a line was written rather than after.

Built anyway, and the reason is not the four cards: **this is the prompt CR 616
needs**, unbuilt since D134, and the shape every future "in any order" will use.

### One prompt, two callers, no ids

`Awaiting.orderCards` is the 16th kind and the **third in a row that ships no card
ids** (D137's hand, D141's library, this). The cards are the ones the rules just
revealed to this player; the client lists them from `view.peek`. Putting them on
the prompt would post a library top to every client (D61).

⚠️ **DELIBERATELY NOT `orderTriggers`**, which DOES carry its list — triggers on
the stack are public. Same verb, opposite disclosure, and folding them together
would mean one prompt with two visibility rules.

⚠️ **`Impulse` CHAINS TWO PROMPTS**: pick which card to keep, THEN order the
leftovers. They are separate decisions, so they get separate questions and the
kept card moves as soon as it is chosen. `Index` skips the first entirely —
`take: 0` is a real form, not a degenerate case, because "then put them back" has
no "put N into your hand" clause at all.

⚠️ **AND NEITHER PROMPT IS RAISED WHEN THERE IS NOTHING TO DECIDE.** One card has
one sequence. That is the same rule the discard and look prompts already follow,
now stated in a third place.

### ⚠️ The bug: both ends reverse, and only one of them looked like it

The player's FIRST card must end up nearest the destination. The first cut
reversed the sequence for the TOP only, reasoning about appending — and
`Impulse` bottomed its three cards in exactly the wrong order.

Both ends need it, and the symmetry is not a coincidence: **each placement puts
the card it applies at the named end** — appending for the top, unshifting for
the bottom — so whichever end it is, the LAST card applied lands nearest it, and
the sequence has to go on backwards. Its own test caught it; nothing else would
have, because the cards all arrive either way.

### What it is worth

**`complete`: 1,718 → 1,723 (+5).** Across M6.3, **1,405 → 1,723**.

| | before | after |
|---|---:|---:|
| cards the engine runs COMPLETELY | 1,718 | **1,723** |
| spells that resolve alone (`auto`) | 401 | **406** |
| spells with an offerable clause (`assisted`) | 1,641 | **1,647** |
| faces parsed `effect:auto`, all printings | 2,207 | **2,240** |
| cards with no Tier-3 note | 2,124 | **2,129** |
| `scriptableToday` | 1,249 | **1,258** |

⚠️ **`Dig Through Time` CHANGED SIDES.** D141 pinned it as a fixture that must be
REFUSED because there was nowhere to ask for the sequence; it is read now. Its
test changed with it, and says so — what must never come back is the middle
outcome, reading the clause and choosing the order for the player.

⚠️ **`Drawn from Dreams` is STILL REFUSED**, and a prompt does not help: "in a
RANDOM order" needs the seeded generator that `effectEvents` does not have. D137's
refusal of "discards at random" is untouched by any of this.

### The fuzz gate

⚠️ **BYTE-IDENTICAL FOR THE SIXTH RUN RUNNING** — 85,421 accepted intents /
2,328,874 events / 17,721 turns — at 486.51 s. No card in `DECK` carries the
clause, so no seed reaches the prompt, and the one shared thing this touched
(`chooseFromZone.rest` gaining two values) moved nothing because no seed
produces the discard case with a destination at all.

⚠️ Six identical runs is itself worth reading: every slice since D137 has been
additive to the vocabulary and inert to the games these 500 seeds play. The gate
is proving replay-equivalence, not coverage, and it has nothing to say about a
card no seed can draw. That is the argument for the per-primitive canaries, not
against the gate.

### Verified

**1,285 Vitest passing / 8 skipped across 63 files** (up from 1,280 / 8: 5 new in
`lookAtTop.test.ts`) **· `tsc -b` clean · build clean · the 500-seed fuzz gate
green and byte-identical at 486.51 s · `battery-anim.cjs bot engine` 102/102 ·
`battery-bot.cjs --games 40` 78.8% [68.6%, 86.3%], 0 faults at 134 decisions/s ·
probe 124/124.** Fixtures 123 → 125.

⚠️ The producer map is **14 of 16 kinds produced**, two named dormant — the
assertion D125 built so a new variant cannot be added without being accounted
for, and it failed by name until `orderCards` was listed.

### Reportable

⚠️ **CR 616's ORDERING NOW HAS ITS PROMPT** and is still not built. D134 applies
overlapping replacements in battlefield order and says plainly that it is not the
player's choice; `Awaiting.orderCards` is the shape that choice needs, minus a
`zone` other than `library`. That is the piece it was missing.

⚠️ **THE UI IS PROMPT-BAR TEXT ONLY.** The bar says "click your N cards in the
order you want them, top first", and the peek panel D114 built lists them — but
nothing yet records the click ORDER, so the prompt is answerable by the bot, the
fuzzer and the net driver and NOT by a human at the table. Said plainly rather
than left to be discovered: this is the first prompt in M6.3 shipped without a
working human control, and it is the next thing to finish.

⚠️ **`Sage Owl`'s 8 lines / 6 whole cards are one card script away.** They are
"When ~ enters, look at the top N cards of your library, then put them back in any
order" — the effect is now built; only the trigger needs M6.4.

## D143 — The ordering control, and a second prompt that had no control either

D142 shipped `Awaiting.orderCards` answerable by the bot, the fuzzer and the net
driver but **not by a person at the table**, and said so. This is that, and
finishing it found the same gap one prompt earlier.

### ⚠️ D141's library prompt had no control either

`chooseFromZone` over a LIBRARY (D141) was in the same state and had not been
noticed: `useEngineTable`'s click branch checks `hand.includes(id)`, so clicking
a peeked card did nothing at all. Worse, the peek panel's own buttons — built for
D114's Tier-3 tools — send `ManualMoveCard`, which under a live prompt is wrong
twice over: it BYPASSES the question the engine is waiting on, and it writes a
Tier-3 wrench on the log for something the rules are doing.

So two prompts had been shipped without a human control, one of them silently.
The lesson is narrow and worth keeping: **a prompt's answerers and its CONTROL
are separate work, and "the driver can answer it" reads exactly like "it is
finished".**

### One control, both prompts

The peek panel is TAKEN OVER when a prompt about those cards is up: the per-card
Tier-3 buttons disappear, the card itself becomes clickable, and clicking adds it
to the answer.

⚠️ **APPEND, NEVER TOGGLE-INTO-A-SET.** For a pick the sequence is incidental;
for an ordering it IS the answer. One handler serves both only because it
preserves order — and clicking a chosen card takes it back out, which renumbers
everything after it for free because the store field is an array. `discardPick`
is renamed `pickOrder` for exactly that reason: the name said "discard" while
serving three prompts, and said "a set" while holding a sequence.

⚠️ **THE BADGE IS THE POSITION, NOT A TICK.** For an ordering the number is the
whole answer; a tick would show that a card was chosen while hiding the only
thing that matters about it.

⚠️ **NO "DONE" BUTTON WHILE A PROMPT IS UP.** `ManualStopPeeking` clears the
reveal without answering, leaving the engine waiting on a question about cards
the player can no longer see — a wedge with a button on it.

⚠️ **AND THE PROMPT BAR SAYS THE RIGHT PLACE.** D141's text read "click N cards
in your HAND to discard" for a library peek, where the cards are in a panel and
the ones NOT chosen are what leave. A bar that names the wrong place sends the
player looking for a control that is not there — which, this time, was true.

### Verified

**1,285 Vitest / 8 skipped across 63 files · `tsc -b` clean · build clean ·
`battery-anim.cjs bot engine` 102/102 · probe 124/124.**

⚠️ **DRIVEN THROUGH THE REAL UI, and the ordering is checked by DRAWING.**
`Index` revealed five, the panel counted "2/5 chosen" mid-pick, the fifth click
submitted, the panel closed, and the log read "You put 5 cards on the top of your
library." Then five draws came back **in exactly the clicked order** —
`[c87, c52, c81, c76, c44]`, first-clicked drawn first. That is the assertion
that matters: everything else about this feature is true whichever way round the
sequence goes.

⚠️ `Impulse` drove BOTH stages: "Impulse: click 1 card to keep" over four cards,
then "click your 3 cards in the order you want them, **bottom** first" over the
three left — with the destination word changing between the two spells, which is
the one piece of copy a player has to trust.

### Reportable

⚠️ **NO AUTOMATED CHECK COVERS THIS PANEL.** `battery-anim.cjs` has an `engine`
section that drives real clicks, and nothing in it opens a peek. The three
prompts built in D137/D141/D142 are covered by unit tests at the engine seam and
by hand at the UI — which is how D142 shipped a prompt with no control and D141's
went unnoticed for a slice. A battery check that casts one of these and clicks
the panel is the thing that would have caught both.

⚠️ **`peekMode` IS NOW HALF-DEAD.** It still decides the Tier-3 copy and buttons,
but a prompt overrides both. If the rules end up raising every peek, the mode
becomes a Tier-3-only concept and should say so rather than looking like the
panel's main axis.

## D144 — The check that would have caught two shipped gaps

D143's own reportable: nothing automated covers the peek panel, which is how D142
shipped a prompt with no human control and D141's went unnoticed for a whole
slice. Six checks in `battery-anim.cjs engine`, and the section is 91 → 97.

### Why a battery and not a Vitest

The engine seam was never the problem. `chooseFromZone` and `orderCards` both had
unit tests, both had answers from the bot, the fuzzer and the net driver, and both
were **unanswerable by a person**. From a suite that never clicks, that state is
indistinguishable from finished.

⚠️ So the check drives REAL CLICKS on the rendered panel, in a real Electron,
against a real card. That is what `battery-anim.cjs` is for, and it is the only
instrument in this project that can tell "the engine accepts this answer" from
"a player can give it".

### It saves its own deck

`Index` is in no starter deck, so the block saves one, starts a two-seat solo game
with it, and **deletes the deck in a `finally`** — pass or fail. D110's mana check
set the precedent of a block starting its own game; this adds the cleanup rule,
because a battery that leaves rubbish in `~/.commanders-roundtable` is a battery
people stop running.

### What each check is for

| check | the failure it names |
|---|---|
| the panel opens for a rules prompt | the effect never revealed, or the panel does not react to a prompt |
| the panel counts the picks | clicking does nothing — **the D142 state exactly** |
| no Done button while a prompt is up | `ManualStopPeeking` offered, which clears the reveal without answering |
| the bar names the ordering | D141's "in your HAND to discard" copy on a library peek |
| the last click submits and the panel closes | the answer is built but never sent |
| **the cards come back in the clicked order** | the sequence is reversed, or ignored |

⚠️ **THE LAST ONE IS THE ASSERTION THAT MATTERS.** Everything above it is true
whichever way round the sequence goes; only drawing the cards back proves the
player's first click ended up on top. It is also the check that would have caught
D142's real bug (both ends reverse), which its unit test caught first only because
that test happened to exist.

### ⚠️ Verified by BREAKING it, and it fails the right way

The card's `onClick` was removed — putting the panel back in exactly the state
D142 shipped — and **three checks failed**, including the important one:

```
FAIL  the panel counts the picks as they are made   "…0/5 chosen."
FAIL  the last click submits, and the panel closes  5 cards left
FAIL  the cards come back in EXACTLY the clicked order
        clicked c92,c85,c100,c88,c50 · drew c85,c88,c92,c50,c100
```

The draw line is the useful one: the cards came back in LIBRARY order, which is
what "the player's clicks did nothing" looks like from the other end.

### Verified

**`battery-anim.cjs engine` 91 → 97 checks · `bot engine` 108/108 · 1,285 Vitest
/ 8 skipped across 63 files · `tsc -b` clean · build clean · probe 124/124.**

⚠️ The block reports an honest SKIP for a shuffle that never deals an `Index` —
but NOT for "panel never opened", which is the failure it exists to catch. A skip
that swallowed its own subject would be the green-over-nothing D128 records.

### Reportable

⚠️ **THE OTHER TWO PROMPTS OF THIS FAMILY ARE STILL UNCOVERED HERE.** D137's hand
discard and D136's pay-to-enter are clicked in the hand fan and the prompt bar
respectively, and neither has a battery check. They were both driven by hand at
the time, which is exactly what was true of the two this entry is about.

⚠️ **`peekMode` remains half-dead** (D143): it decides the Tier-3 copy and buttons
while a prompt overrides both. Now that a check pins the prompt path, collapsing
it to a Tier-3-only concept is safe to do.

## D145 — The last two prompts get clicked, and two traps get encoded

D144's reportable: D136's pay-to-enter and D137's hand discard were driven by hand
when they shipped and covered by nothing since — which is exactly the state the
two prompts D144 wrote checks for had been in. Seven more checks; the `engine`
section is 97 → 104, `bot engine` 108 → 115.

### Both branches, in two games

⚠️ **THE SHOCK LAND IS PLAYED TWICE — paid for once and declined once, in
separate games.** A check that only paid would pass with the decline button wired
to the same handler, which is the single most likely way this UI breaks. Proved
by doing exactly that: rewiring `decline` to send `pay: true` fails
`declining costs nothing and taps it` with `{"life":2,"tapped":false}` and
nothing else moves.

### ⚠️ Two traps that had each already cost hours, now encoded

**1. THE PROMPT GOES TO THE TARGET, NOT THE CASTER.** `Mind Rot` asks the
opponent, so the caster's screen shows nothing to do — which is what sent D137's
investigation into the engine for four hours on a working feature. The check
drives BOTH sides: the caster's bar must read "Ben is discarding 2", and the
answer is given after `setViewer('p2')`.

**2. THE CLICK TARGET IS THE CARD, NOT THE SLOT.** `[data-hand-instance]` is the
slot WRAPPER; the handler is on `[data-instance-id]` inside it, and a click on
the parent fires nothing at all. That was the second half of the same four hours.

### And a third, found while writing it

⚠️ **`startSolo` LEAVES THE VIEWER WHEREVER THE TURN ORDER STARTS, so p1's own
hand comes back with `card: null`.** Searching it by NAME through another seat's
view finds nothing and reads as "the deck has no such card" — the check reported
`no Godless Shrine reached hand` for a deck that was 20% Godless Shrine.
Projection was working perfectly; the search was asking the wrong seat. `keep()`
now sets the viewer, with the reason written beside it.

⚠️ **AND THE SHOCK LAND IS MOVED, NOT PLAYED.** A land drop needs it to be p1's
turn, which `startSolo` does not guarantee — the first attempt failed
`no pay button` for that reason alone. Moving it is also the better test: the
prompt lives in `applyReplacements`, which D134 put there precisely because TEN
paths put a permanent onto the battlefield, so this proves the funnel catches one
that is not the land drop.

### Verified

**`battery-anim.cjs engine` 97 → 104 · `bot engine` 115/115 · 1,285 Vitest / 8
skipped across 63 files · `tsc -b` clean · build clean · probe 124/124.**

Both new blocks save their own decks and delete them in a `finally`, pass or
fail — D144's rule, now followed twice.

### Reportable

⚠️ **EVERY PROMPT BUILT IN M6.3 IS NOW CLICKED BY A MACHINE** except
`optionalTrigger` (D128), which is unreachable in the shipped app at all:
`host.ts` builds with `EMPTY_REGISTRY`, so no card can raise it. D128 said
"M6.4 must drive this prompt through the real UI on the first 'may' card it
lands" — that debt is now the only one of its kind left, and the pattern to
discharge it with is these three blocks.

⚠️ **THE ENGINE SECTION IS DOING TWO JOBS.** It was M3's rules coverage and is
now also the prompt-UI suite, at 104 checks and rising by seven per slice. Worth
splitting into its own section before the next one, so a prompt failure is not
buried among land drops and mana pools.

## D146 — The prompts get their own section, and the last unclickable one gets clicked

Both of D145's reportables, closed in one pass. The `engine` section is **104 → 91**
and a new `prompts` section holds **18**; then `optionalTrigger` — the one prompt
built in M6.3 that no machine had ever clicked — gets five checks of its own.
`bot engine prompts` is **115 → 120**.

### The split

`sectionEngine` was doing two jobs: M3's rules coverage, and the prompt-UI suite
that had been growing by six or seven a slice since D144. A prompt failure buried
among land drops and mana pools is a prompt failure people scroll past.

⚠️ The new section repeats `sectionEngine`'s preamble deliberately rather than
sharing it: the table screen is always mounted but `display: none` when another
screen is active, and a `display: none` element measures 0×0 — so every panel this
section clicks would be found and be unclickable. Trap 7, and the reason a
section that opens the table cannot start with its first assertion.

### `optionalTrigger` was UNREACHABLE, not merely uncovered

D128 shipped the prompt and said its buttons were covered by `tsc -b` and review
because `host.ts` builds its `Game` with `EMPTY_REGISTRY`. That is stronger than
"nothing tested it": `optionalTrigger` is raised only by a registered
`TriggerDef`, so **no deck, no board and no sequence of clicks could produce it**.
D128 left the debt as "M6.4 must drive this prompt through the real UI on the
first 'may' card it lands".

⚠️ **`HostOptions.scripts` is a SEAM, not a step towards shipping scripts.** It is
optional, defaults to `EMPTY_REGISTRY`, and no screen passes it — the same shape
as `extraPool`. Landing scripts into the product is still M6.4 and still carries
the accounting obligation this does not discharge: the moment a card's script
runs, its `tier3.ts` note must go silent and `engineComplete` must accept it, in
the same commit (M6.4-LIBRARY-SPEC §6.5, and D122's failure in the other
direction).

⚠️ **Deliberately not `options`.** `GameOptions` is part of `GameState` and so of
the state hash; a registry is a DEPENDENCY. Putting it there would have made the
test registry a fact about the game rather than about the process running it.

The battery passes `createRegistry([AJANIS_MANTRA])` through it and clicks the
prompt. `Ajani's Mantra`'s whole printed text is the optional trigger (D128), so
the card runs every word of itself.

### ⚠️⚠️ The trap, again, and this time it cost the first two runs

**`window.__crt.engine.view()` LAGS THE ENGINE BY ONE ANIMATION GROUP** — D137
recorded it and this is the second time it has bitten. The drive loop polled
`view().awaiting` for `optionalTrigger` and reported **"the may-trigger prompt
never came up"**, twice, including once after restarting vite on the theory it was
a stale module graph (trap 1). Driven by hand over CDP, the same state read:

```
awaiting : undefined          ← view()
bar      : "Ajani's Mantra — gain 1 life — this one is optional.Do itDecline"
stack    : ["Ajani's Mantra — gain 1 life"]
```

The prompt was up, both buttons were on screen, and the field the loop was
watching was `undefined` — because the group that STOPS the game is the last one,
so nothing arrives afterwards to flush the view. **A lagging view catches up only
while the game is flowing; at the moment it stops, it stays wrong.**

Detection is the DOM now, and so is "is it still asking" after the answer. That
is the better assertion in any case: the buttons being gone is what the player
sees, where an awaiting field is what the engine holds.

### Both branches, in ONE game

The trigger fires every upkeep, so taking it and declining it are two turns rather
than D145's two games — and **asking again next upkeep is itself an assertion**: a
prompt answered once must not be spent.

⚠️ **Nobody attacks.** The drive loop answers `declareAttackers` with an empty
list for whoever is asked. Otherwise p2's starter deck swings, p1's life moves for
reasons that have nothing to do with the trigger, and the two life assertions
measure combat instead.

⚠️ The enchantment is MOVED, not cast — casting at sorcery speed needs p1's own
main phase, which `startSolo` does not guarantee (D145's shock land, same reason).
The trigger's `activeZones` is the battlefield and does not care how it got there.

⚠️ **Split across several `js()` calls on purpose.** Every CDP send has a hard 30 s
timeout and reaching the next upkeep is two turn cycles of real priority passing;
one long expression reports a CDP timeout, which reads exactly like a wedged
engine. `window.__may` holds the helpers between calls and `drive()` takes a
budget. The deck is deleted in a `finally` on the DRIVER side, because the work no
longer fits in one page-side `try`.

### Verified

**`battery-anim.cjs bot engine prompts` 120/120 · 1,285 Vitest / 8 skipped across
63 files · `tsc -b` clean · build clean · probe 124/124.**

⚠️ **Checked by breaking it.** The decline button was rewired to send
`accept: true` — the state D128 describes, where nothing branches on `optional` —
and exactly one check failed, reading `life +1, still asking: false`. Nothing else
moved.

### Reportable

⚠️ **EVERY PROMPT BUILT IN M6.3 IS NOW CLICKED BY A MACHINE.** Sixteen `Awaiting`
kinds, and the four M6.3 added — `optionalTrigger`, `entersChoice`,
`chooseFromZone`, `orderCards` — are each driven through real clicks in a real
Electron. The debt D128 opened is closed on the covering side; what M6.4 still
owes is the card script itself and its disclosure.

⚠️ **`peekMode` is still half-dead** (D143, D144), now safe to collapse to a
Tier-3-only concept. It is the last piece of this arc left untidied.

## D147 — The pre-M6.4 list, worked

Thirteen of the eighteen items on the "before M6.4" list, built and verified in
one pass. The three engine PRIMITIVES are the substance; the rest are
correctness debts that had each been measured and left.

### 1 — A triggered ability can target (3,218 cards)

⚠️ **THE LARGEST FAMILY MEASURED IN THIS ARC.** `PendingTrigger` carried no
targets, `TriggerDef` had no way to declare any, and `drainTriggers` built every
stack object with `targets: []` — so every card whose triggered ability names a
target was unscriptable however simple the rest of it was. Measured over the real
database: **3,218 of 31,692** distinct Commander-legal cards, and the clauses are
the same grammar `targetParse` already reads for spells (`target creature` 926 ·
`target creature an opponent controls` 199 · `target opponent` 189 · …).

⚠️ **CR 603.3d — CHOSEN AS THE ABILITY GOES ON THE STACK.** The object goes on
and the question is asked in the same uninterruptible pass, so `stackId` names a
real object and `resolve` — which already receives the `StackObject` — needed no
change at all. `chooseTargets` gains a third `forKind`, because it already had
two; `StackTargetsSet` is a new event, deliberately not `TargetsChosen`, which
writes to a `pendingCast` a trigger never has.

⚠️ **CR 603.3d ALSO SAYS A TRIGGER WITH NO LEGAL TARGET IS REMOVED FROM THE
STACK, and that is what stops the prompt being a wedge.** A trigger has no
`pendingCast` to cancel, so a driver handed an unanswerable targets prompt would
have no legal reply and the game would stop forever — D102's exact shape,
prevented rather than recovered from.

⚠️ `minimumLegalTargets` moved into `targets.ts` so the ENGINE's "may this go on
the stack" and the DRIVER's "what do I answer" are one greedy fill. They were
about to be two that could disagree — D53's split, and D102's.

⚠️ **CR 608.2b at resolution**, with the specs taken from the `TriggerDef`
rather than the source's face: a permanent's printed `targets` are its own spell
clauses, which is an empty list, so without that override every restriction went
unchecked at the one moment the board can have moved.

Proved on `Yotian Dissident` — one sentence, effect already on the log since
D107, and its target is RESTRICTED ("you control"). The commonest wording is
plain "target creature", which would pass with `targetAllowed` never consulted.

### 2 — A "dies" trigger can be written at all (CR 603.10a)

⚠️ `collectTriggers` took `before` as a parameter and **threw it away with
`void before`**, building every script context from `after`. A trigger that fires
on its own source's death was rejected twice over: the zone check found the card
in a graveyard, and `matches` was handed a board it had already left.
`TriggerDef.looksBack` asks both questions of the old state.

⚠️ **The flag has a break test IN THE SUITE**, because D128's whole lesson is
that a flag nothing reads looks exactly like a flag that works: the same
`Onulet` script with `looksBack: false` gains nobody anything, on any board, and
that is asserted.

### 3 — Continuous combat restrictions (CR 508.1c / 509.1b)

⚠️ D129 filed **227 cards** under the `layer6` bucket because "this creature
can't block" reads as a static ability, and then found that `canAttack` and
`canBlock` consult no static at all. `CombatDef` is that seam — and it is
deliberately NOT a `StaticDef` layer: CR 613 layers settle CHARACTERISTICS, and
"can't block" is a rule about an ACTION.

⚠️ **RESTRICTIONS ONLY, and the split is measured**: "can't be blocked" 1,138
lines · "can't attack" 393 · "can't block" 320, against "attacks each combat if
able" 123 · "must be blocked if able" 39. Restrictions outnumber requirements
**11:1**, and a requirement (CR 508.1d) is a property of the whole DECLARATION —
"the maximum possible number of requirements is obeyed" cannot be checked one
creature at a time. Building it here would be half-executing it (D90).

⚠️ Asked LAST in both functions, so a script may only ever NARROW: a def
returning `true` cannot make a tapped creature attack.

⚠️ Proved on `Spineless Thug`, chosen over a "can't attack" card **because
`canAttack` already refuses a creature for six built-in reasons** — a
can't-attack test could pass with the new seam never consulted.

### 4 — `applyStatics` was O(N²), and it is indexed now

D129 measured layer 6 at **+64%** with two statics registered and named the fix
in its own comment: an index of source instances per layer, on the `DeriveCache`.
Built. Same games, same deck, 60 seeds: **66 s and 59 s before, 42 s and 49 s
after.**

⚠️ The index preserves BATTLEFIELD ORDER, which is CR 613.7c's timestamp and the
whole of D129's ordering fix; grouping by def instead would have reintroduced it.

### 5 — Reminder text and granted abilities are not this card's mana (310 cards)

⚠️ `parseManaProduction` never called `scrub`, so a Treasure's reminder text
("{T}, Sacrifice this token: Add one mana of any color.") and any ability a card
GRANTS in quotes were read as the card's own. D124 measured **310 cards** and
left it; `strayMana` is **310 → 0**.

⚠️⚠️ **AND THE SCRUB EXPOSED A DEEPER FAULT.** `Braid of Fire` reads "Cumulative
upkeep—Add {R}." and its reminder says "unless you pay its upkeep cost" — that
"unless" was what had been marking the card conditional, for a reason that had
nothing to do with the card. The moment reminder text stopped being read, a
cumulative upkeep the engine does not implement started looking like a plain,
fully-run mana ability and **the disclosure went silent on it** (D122's failure,
exactly). The real rule was missing: **a mana ability is an ACTIVATED ability
(CR 605.1a)**, and this loop accepted a colon-less line with `cost = ''`. D124
stated that rule for the tier-3 NOTE; the production had never checked it.

**Four real lands were offering mana they cannot make**, and all four leave the
"every multi-colour land" list as a result: `Crumbling Vestige` and `Branch of
Vitu-Ghazi` have their any-colour on a TRIGGER, `The World Tree` and `Riftstone
Portal` GRANT it to other lands in quoted text. Tapping any of the four gives
{C} or {G}.

⚠️ `complete` **1,723 → 1,722**, and the card that left is `Glittermonger` —
"{T}: Create a Treasure token." whose reminder text describes the TREASURE's
mana ability. It was in the pool for a line it does not have.

### 6 — The world rule (CR 704.5m)

D129 found it while choosing a layer-6 card: `sba.ts` never mentioned the
supertype, so any number of world permanents could coexist. ⚠️ **NOT A CHOICE**,
unlike the legend rule beside it — the newest survives, so it moves cards with no
prompt; and ⚠️ **GLOBAL, not per-controller**, so two players cannot keep one
each. The battlefield array is the timestamp (D129 again).

### 7 — Nine smaller debts, each measured and closed

- **`permanent card` was `unenforced`** — the last common graveyard noun, so
  reanimation would accept an instant. Given its six permanent types; **1,440 →
  1,379** specs carry an unenforced restriction.
- **`collectTriggers` rebuilt `Object.keys(state.cards)` inside both loops** —
  O(events × defs × cards). Hoisted.
- **`botDeck.ts` had no regenerate-is-a-no-op guard** (D123's finding in a second
  generated file, D130's catch). Built — **and it failed on its first run**: the
  committed deck had drifted, its header reading "reaching 722 cards" against a
  live 742. Its two existing guards are semantic and a stale deck satisfies both.
- **A shipped script's accounting is now enforced, not commented.**
  `SHIPPED_SCRIPTS` is a named list and `shippedScripts.node.test.ts` asserts that
  every script in it names a card `engineComplete` accepts and `tier3.ts` is
  silent about. ⚠️ The list is empty, so that test is vacuous — the same file
  therefore proves the check has TEETH by running it over the TEST registry,
  whose scripts deliberately violate it (D128's green-over-nothing, avoided).
- **`ManaChoice`'s "dashed mana is restricted" was wrong for three of its four
  cases** — `conditional` ORs together a cost beyond {T}, a condition, a spend
  restriction and an uncomputable amount, and the copy named only the third.
- **`peekMode` is documented as the Tier-3-only concept it is**, and
  `data-peek-mode` reports `prompt` when the rules own the panel rather than a
  stale mode a probe would read as truth.
- **The entry rules read the card's own face**, not face 0. ⚠️ It changes nothing
  today and the reason is bigger than D136's reportable: `castSpell` opens with
  `const faceIndex = 0` and `playLand` reads `faceOf(oracleCard, 0)`, so **an
  MDFC back face cannot reach the battlefield at all.** The constraint that puts
  on the future path is written down: `applyReplacements` runs on the state
  BEFORE its own event, so a cast choosing a back face must set the face index
  before the move is offered.

### Verified

**65 test files, 1,307 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 351.9 s with SIX scripts registered
(four before) · `battery-anim.cjs bot engine prompts` 120/120 ·
`battery-bot.cjs --games 40` 7/7 · probe 124/124.** Fixtures 125 → 128.

⚠️ The fuzz gate gains two canaries, both chosen because they cannot go green on
somebody else's work: `StackTargetsSet` is written by the targeted-trigger path
and nothing else, and the dies-trigger is counted by its ABILITY reaching the
stack — a dies trigger that never fires leaves NO trace, so every other counter
in that gate is unmoved by it being broken.

⚠️ **The `prompt(` grep caught a test helper named `prompt`, for the second
time** (D144 records the first). Renamed the helper rather than weakening the
check, again.

 anchor on the chosen-discard
rule is what keeps them apart.

**`complete` 1,722 → 1,725**; spells `auto` **406 → 409**, `assisted` 1,647 →
**1,650**, `effect:auto` faces 2,240 → **2,263**.

### Verified, after the randomness work

**65 test files, 1,310 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 320.4 s ·
`battery-anim.cjs bot engine prompts` 120/120 · `battery-bot.cjs --games 40` 7/7
· probe 124/124.**

⚠️ The fuzz gate is the check that matters for this one: `Hymn to Tourach` is in
`DECK`, so 500 seeds now cast a spell that consumes randomness, and every seed
still replays to an identical hash. A dropped advance would have shown up there
and nowhere else.

**M6.3 IN TOTAL: `complete` 1,405 → 1,725.**

### 9 — The chosen colour (CR 614.12), and why only the colour

The fifteenth item. D136 measured the "As this ~ enters, choose …" family at 162
cards and said the FIELD is the primitive rather than the question — "building
the question alone asks the player something that does nothing: a prompt as
theatre, worse than the silence it replaced". That was right, and it is exactly
why only one of the three shapes is built.

**The split, measured over the Commander-legal pool:** colour **52** · creature
type **58** · opponent **12** · player 5 · other 64.

⚠️ **AND ALMOST NONE OF THEM IS THE WHOLE CARD** — the choice is always consumed
by a later line, which is what D136 found and this confirms from the other side:
of the three main shapes, **exactly ONE card** in the format is just the choice.
So the question is worth nothing without its consumer, and the consumers are
different for each shape.

⚠️ **THE COLOUR HAS ONE ALREADY.** `{T}: Add one mana of the chosen color` is 17
cards, 9 of which also print the choice — and `parseManaProduction` has modelled
"one mana of X, where X is a set the engine can resolve" since M1, as
`anyColor.scope`. So `chosen` is a fourth scope beside `identity`, `landsYou` and
`landsOpponents`: a set of one that lives on the permanent instead of the board.
**`Sol Grail` is the whole card in two lines, with no card script anywhere.**

⚠️ **Creature type and opponent are REFUSED**, and that is the D136 rule applied
rather than quoted: their consumers are card text that needs a script (M6.4), so
asking those questions today would store an answer nothing reads.

⚠️ **`chosenColor`, NOT a general `chosen`.** A field with two members nothing
populates is the same theatre with a wider type. When those consumers land they
bring their own field.

⚠️ **THE ANSWER IS A FACT, NOT AN ACTION** — the only prompt in M6.3 of which
that is true. Every other one resolves and is gone; this is remembered on the
object for every later ability to read, which is why it is on `CardInstance` and
so in the state hash, and why `ColorChosen` is on the log rather than recomputed.

⚠️ **BEFORE IT IS ANSWERED THE SOURCE OFFERS NOTHING** — not "any colour", not
colourless. The card says the chosen colour, and until one is chosen there is no
such colour; five options would be the engine making the player's choice. It is
asserted in both directions, because the empty case is the one that would
plausibly have been written as a fallback.

⚠️ Cleared by `clearBattlefieldFields`, so a permanent that leaves and re-enters
is asked again (CR 400.7) — asserted, because a remembered answer would be a
NEW object carrying the old one's memory.

**`complete` 1,725 → 1,730**, and `Coldsteel Heart` joined the BOT's deck — a
card the bot can now be dealt because the engine runs every word of it.

### Verified, after the chosen-colour work

**65 test files, 1,317 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 323.8 s ·
`battery-anim.cjs bot engine prompts` 120/120 · `battery-bot.cjs --games 40` 7/7
· probe 124/124.** Fixtures 128 → 129.

⚠️ D125's producer map caught the new kind on the first `tsc -b`, by name, in
three files at once — the union, the bot's exhaustive switch and the driver.
That is the guard doing exactly what it was built for.

**M6.3 IN TOTAL: `complete` 1,405 → 1,730.**

### Reportable — the three items NOT built, and why

⚠️ **CR 616's replacement ordering needs a RESUMABLE FOLD, which is sharper than
"not built".** `applyReplacements` is pure `(state, events) => events` and cannot
stop to ask. D136 solved the pay-to-enter prompt by letting the event happen and
asking afterwards — but for CR 616 the ORDER changes the outcome, so
apply-then-ask is not available. Suspending the fold means a CONTINUATION in
`GameState`. That is an architectural change, not a slice.

⚠️ **CR 613.8 dependency and 613.7d/e** remain unbuilt, and removing a
NON-KEYWORD ability still has no representation at all — `MutableCharacteristics`
models keywords, so `Humility` is unrepresentable rather than merely unwritten.

⚠️ **The two-pass parser is NOT built ON PURPOSE.** D141 said `sentences()`'s
join list should become one "past two or three entries". It still has ONE.
Building it now would be the speculative refactor that rule exists to defer.

## D148 — CR 616, with the continuation

The last of the three architectural items D147 named, and the only one whose
reason was "this needs a continuation in `GameState`". It has one now.

⚠️ **IT WAS NEVER ON D127's LIST.** M6.3's build order measured seven primitives
by cards-waiting; CR 616 came out of D134's bucket split as a *reportable* and was
re-named as unbuilt by D142 and D147. It is M6.3 work because M6.3 is "the
primitives" and this is one — not because the original ordering asked for it.

### Why the trick that worked twice before does not work here

D136 and D147 both raise a prompt from inside the replacement funnel by letting
the event happen and asking afterwards: the permanent enters untapped and is then
tapped, the permanent enters and is then given a colour. **That is unavailable
here, because the ORDER changes the outcome.** `Hardened Scales` before
`Branching Evolution` turns two counters into six; the other way gives five. You
cannot apply either and then ask which should have been first.

So the event is **HELD, unapplied**, and `applyReplacements`'s purity is bought
back by moving the state into `GameState`.

### The shape of the continuation

⚠️ **THREE QUEUES, BECAUSE THE PIPELINE HAS THREE STAGES**, and collapsing any
two is wrong in a way that stays invisible until it bites:

- `siblings` — the rest of this event's fan-out. **Shares `used`**, because
  CR 614.5 is per-EVENT and every level of one event's fan-out is still that
  event. That is also why no stack of frames is needed: a replacement that turns
  one event into three splices them into one queue.
- `rest` — the rest of what the BUILT-INS produced for this body. Fresh `used`
  each, built-ins already run.
- `queued` — the rest of the batch. Raw bodies; the built-ins have not seen them.

⚠️ **The built-ins are NOT idempotent**, which is what forces `rest` and `queued`
apart: re-running `withEntryCounters` over a `CardsMoved` it has already seen adds
a planeswalker's loyalty a second time.

⚠️ **`applyReplacements` is now the BUILT-INS AND NOTHING ELSE.** Card-script
replacements moved to `runReplacementFunnel`, because a function returning
`EventBody[]` has nowhere to put a question.

⚠️ **`Accept.funnelled`** — the one flag, on the one path that needs it.
`AnswerChooseReplacement` returns the REST of a batch that has already been
funnelled, and without this `applyBatch` runs it through again: the built-ins
double-apply and the card scripts get a second turn in violation of CR 614.5.
Found by the first run of the new tests, which reported `the ordering prompt
never cleared` — the resumed events were being re-replaced forever.

⚠️ **ONE AT A TIME, not "order them all"** — CR 616.1 exactly. It is also the only
version that stays right when applying one effect changes which of the others
still apply, and `resumeReplacementFunnel` may stop again immediately.

⚠️ **Who chooses** is a closed list of event kinds with a stated fallback to the
active player, rather than a guess per kind.

### Two tests changed sides, and one moved house

⚠️ `replacements.test.ts`'s two ORDER tests asserted BATTLEFIELD ORDER — the
deterministic fallback D134 shipped while saying plainly it was not the rule.
They now assert that the PLAYER's answer decides it and that **both outcomes are
reachable from one board**, which is the whole reason CR 616 is a rule and not a
tie-break. Same shape as `Dig Through Time` in D142 and `Hymn to Tourach` in D147.

⚠️ **The first cut of that test silently fell back to battlefield order**, because
it looked up the option by CARD NAME and `Hardened Scales` does not contain its
own name in its own text. It asserted 6 and got 5 — and would have "passed" a
version that ignored the answer entirely. The label is the ability's PRINTED TEXT,
and both the test and the battery match on `plus one` / `twice`.

`HARDENED_SCALES_SCRIPT` and `BRANCHING_EVOLUTION_SCRIPT` moved from the test file
to `testing/cardScripts.ts`, which is where real card scripts live and the only
place two other files can import them from.

### ⚠️ The fuzz gate's reach — **this section's first number was WRONG; see D149**

**500 seeds, ZERO suspensions** — and that measurement was taken on a deck that
did not contain `Hardened Scales` or `Branching Evolution`, because the patch
that was meant to add them aborted without writing while a separate edit did
register both scripts. **The real figure, with both cards dealt, is 5 across 500
seeds**, and the canary asserts it at the gate size. D149 has the correction and
the reason. Everything below about WHY it is hard to reach still holds. The funnel stops only when two replacements apply
to one event, which needs both one-of enchantments cast onto the same battlefield
AND a +1/+1 counter afterwards — three specific cards inside 200 random intents.
Asserting a positive there would be a flaky gate; the counter is kept at `>= 0`
with the number written down, which is D137's precedent for the "no legal target"
narration that also fired zero times.

**The coverage is `battery-anim.cjs prompts`, and it is stronger**: real clicks in
a real Electron, both orders, in two games — 6 one way and 5 the other. It runs at
all because of the `HostOptions.scripts` seam D146 built for `optionalTrigger`.
`prompts` is 19 → 22; `bot engine prompts` **120 → 123**.

⚠️ **AND THE BATTERY'S FIRST RUN READ 0, WHICH WAS THE CHECK AND NOT THE ENGINE.**
`put()` submitted the move and slept, so the counter was set while the Grizzly
Bears was still in HAND — the prompt still appeared, because both replacements
match on the CONTROLLER and not on the zone, the answer was taken, and
`clearBattlefieldFields` wiped the counters the instant the card entered. It now
waits for the card to appear in `bf:p1`. The diagnostic that found it printed
`present=true, zone=undefined, all={}`, which is what an entering card looks like.

### Verified

**65 test files, 1,318 Vitest passing / 9 skipped · `tsc -b` clean · build clean ·
the 500-seed replay fuzz gate green at 324.6 s · `battery-anim.cjs bot engine
prompts` 123/123 · `battery-bot.cjs --games 40` 7/7 · probe 124/124.**

⚠️ The fuzz gate matters here beyond the canary: `pendingReplacement` is part of
`GameState` and so of the state hash, and `ReplacementPending` is on the log — so
a held event that replayed differently would show up as a hash mismatch across
500 seeds. It does not.

⚠️ D125's producer map caught the new kind on the first `tsc -b`, by name, in
three files at once. Eighteen `Awaiting` kinds, sixteen with producers.

### Reportable

⚠️ **`complete` DID NOT MOVE, and that is correct.** This is a rules primitive
with no parser change behind it: it makes a class of card SCRIPTABLE that could
not be written before — one whose correctness depends on the player choosing —
and D128's rule applies unchanged. Scripts are M6.4.

⚠️ **The remaining two items on the pre-M6.4 list are unchanged**: CR 613.8
dependency (and removing a non-keyword ability, which `MutableCharacteristics`
cannot represent), and the two-pass parser, which is deferred by its own stated
criterion — `sentences()`'s join list still has ONE entry.

## D149 — CR 613.8, and a correction to D148's measurement

### ⚠️ FIRST, THE CORRECTION: D148's "500 seeds, ZERO suspensions" WAS WRONG

It measured a deck that **did not contain the cards**. The patch script that was
meant to add `Hardened Scales` and `Branching Evolution` to the fuzz `DECK`
aborted on an unrelated MISS and wrote nothing, while a separate edit did add
both SCRIPTS to the registry — so the gate ran with two replacement effects
registered and no way to draw either. Zero was the right answer to the wrong
question.

**With both cards in the deck: 5 suspensions across 500 seeds.** The path is
reachable; the rate is about one seed in a hundred, which is what two one-of
enchantments plus a counter costs.

⚠️ **THE CANARY IS ASSERTED AT THE GATE SIZE ONLY**, and the rate is written
beside it. `> 0` at the 60-seed default is a coin flip and failed the first full
run after it was turned on — which is the honest reason to gate it rather than a
reason to delete it. `battery-anim.cjs prompts` still covers both branches with
real clicks either way, and that coverage does not depend on luck.

⚠️ **The lesson is the patch script, not the measurement.** A script that reports
`MISSES` and exits without writing leaves the tree in a state where a LATER
successful edit makes it look like everything landed. Two of the three edits in
that batch were re-applied by hand afterwards; the third was not noticed because
the thing it enabled was being measured as absent.

### The rule

CR 613.8: within a layer, an effect that DEPENDS on another waits until after it,
and dependency outranks the timestamp order D129 built. 613.8a defines dependency
as "applying the other would change the text or the existence of the first
effect, what it applies to, or what it does to any of the things it applies to".

⚠️ **THE REAL PAIR, and neither card shows the rule alone:** `Knighthood`
("Creatures you control have first strike") and `Kwende, Pride of Femeref`
("Creatures you control with first strike have double strike"), both layer 6,
both single-sentence. **Kwende reads a keyword that Knighthood grants**, so which
applies first decides whether Kwende applies AT ALL. In plain timestamp order
with Kwende first, a vanilla creature ends with first strike and NO double strike
— the card doing nothing, silently, on a board where it plainly should.

Found by measuring what the format actually prints: **20 lines scope a static on
`with flying`, 1 each on vigilance, first strike, menace, defender and trample.**
The first-strike one is the only pair whose partner ("Creatures you control have
first strike", `Knighthood`) is also a whole card in one line.

### What is built, and what is not

⚠️ **613.8a clause (b)'s FIRST HALF: "what it applies to", evaluated for the
object being derived.** That is a question this engine can answer exactly and
cheaply — `appliesTo` is a predicate over `chars`, so "would B change A's answer"
is one clone and one call.

⚠️ **NOT built: "the text or the EXISTENCE of the first effect".** That needs an
effect that can remove another script's static, and `MutableCharacteristics`
models KEYWORDS — so `Humility` is unrepresentable rather than merely unwritten.
D129 said this, D147 repeated it, and it is still true.

⚠️ **613.8a clause (c) is satisfied BY CONSTRUCTION.** "Neither effect is from a
characteristic-defining ability or both are" — this runs within ONE layer and
`'cda'` is its own layer, so the two are always both or neither.

⚠️ **613.8b's dependency LOOP is handled**: when every remaining effect depends on
another, the rule stops applying and timestamp order resumes. Taking the first
remaining is also what makes the loop terminate.

⚠️ Timestamp order is the SCAN order, so it stays the tie-break between two
effects that depend on nothing — D129's fix, kept intact.

⚠️ O(k²) in the number of effects in one layer with a live source, which is 0 on
every board the shipped app has and a handful on any real one. The common case
exits on the first line.

### ⚠️ The `printed()` guard earned its keep

`Kwende` HAS double strike himself, so his printed text is TWO lines and the first
is a keyword the engine already enforces. The script was written for the second
sentence alone and `printed()` threw on the first run with the real text in the
message. Without it the script would have run happily against a sentence the card
does not have. The static claims the second line; the first is covered by
`keywords`, so the whole card is accounted for between the two.

### Verified

**65 test files, 1,322 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 384.6 s · `battery-anim.cjs bot engine
prompts` 123/123 · probe 124/124.** Fixtures 129 → 131.

⚠️ **Checked by breaking it**, and the break test is IN the suite: with
`dependencyOrder` disabled exactly one check fails, naming the order —
`double strike with Kwende, Pride of Femeref then Knighthood: expected false to
be true`. The suite also asserts the wrong answer explicitly (Kwende alone grants
nothing), because a test of only the happy order would pass with the dependency
code deleted: `[Knighthood, Kwende]` is already right by timestamp alone.

⚠️ **A 729 s run of the same gate FAILED on its own 600 s timeout** and was not a
regression: the only difference from the 394 s passing run before it was a
`writeFileSync`. D106's signature, and the third time this session. The clean
re-run is 384.6 s.

### Reportable

⚠️ **ONE ITEM LEFT on the pre-M6.4 list, and it is deferred by its own
criterion**: the two-pass parser. D141 said `sentences()`'s join list should
become one "past two or three entries"; it still has ONE.

⚠️ **`complete` did not move**, and that is correct for the same reason as D148:
this is a rules primitive with no parser behind it. It makes a class of card
scriptable — one whose correctness depends on another effect applying first —
and the scripts are M6.4.

## D150 — The two-pass effect parser, and the pre-M6.4 list is closed

The last item. ⚠️ **BUILT AT ONE ENTRY, ON REQUEST, AGAINST ITS OWN CRITERION** —
D141 said `sentences()`'s join list should become a two-pass parser "past two or
three entries" and it never got a second one; D147 and D149 both deferred it for
that reason. Asked for directly, it is built, and the bar is set accordingly.

### The bar, and it is met

⚠️ **EVERY PINNED COVERAGE NUMBER OVER THE 31,692-CARD DATABASE IS
BYTE-IDENTICAL.** `auto` 409 · `assisted` 1,650 · `effect:auto` faces 2,263 ·
`effect:partial` 4,967 · `effect:none` 17,101 · `complete` 1,730 · every one of
`tier3.node.test.ts`'s fifteen figures · the bot pool by type · the primitives
ladder. A refactor with no card-count payoff has exactly one honest success
criterion, and this is it — D123's "regenerating would be a no-op", applied to a
parser instead of a generated file.

### What changed

**Before:** `sentences()` split on the full stop AND carried a JOIN LIST — one
hardcoded head pattern (`LOOK_HEAD`) for the single card shape that prints two
sentences the parser reads as one. Every rule then matched one line.

**Now:** two passes with nothing shared between them.
- **Pass one** splits, and knows nothing about any rule.
- **Pass two** walks the sentences with a SLIDING WINDOW, longest first: at each
  position it tries the join of the next `k` sentences for `k = MAX_SPAN…1` and
  takes the first that matches a rule, then advances past what matched.

⚠️ **THE PROPERTY THAT MAKES IT SAFE WAS ALREADY THERE, AND IT IS NOT AN
ACCIDENT: every rule is ANCHORED AT BOTH ENDS.** D90 anchored the vocabulary so a
prefix match could never "understand" `Homing Lightning` or `Spell Blast` by
their opening words — and that same property means a one-sentence rule CANNOT
match a two-sentence window. So wider windows can be tried first at no risk, and
a rule that wants two sentences simply writes a pattern spanning the full stop.
**No head list, no per-rule declaration, no registry of what may be joined.**
D141's constraint ("the splitter runs first, so a rule spanning the full stop
could never match no matter how it was written") is what has gone away.

⚠️ **THE CLAUSE COUNT STILL COMES FROM THE SAME PLACE AS THE NUMERATOR.**
`understood < clauses.length` decides `auto` versus `assisted`, and a joined pair
counts as ONE clause — the arithmetic the join list produced, reproduced exactly.
That is why pass two returns the GROUPS rather than a flat sentence list.

⚠️ **`MAX_SPAN` IS A BOUND ON THE WINDOW, NOT A LIST OF WHAT MAY BE JOINED.** Two
today, because that is the widest any rule is written for; raising it needs no
other change anywhere, which is the whole point.

⚠️ **ONE REAL BEHAVIOURAL IMPROVEMENT, and it is small and correct:** a window
that matches nothing at any width leaves its FIRST sentence unmatched and
advances by ONE, so the sentence after it still gets its own chance. The join
list consumed the pair unconditionally, so a head followed by a tail it could not
read took the tail down with it. Asserted directly.

### Verified

**66 test files, 1,329 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 366.5 s · `battery-anim.cjs bot engine
prompts` 123/123 · `battery-bot.cjs --games 40` 7/7 · probe 124/124.**

⚠️ **Checked by breaking it:** with the window pinned to one sentence, exactly
one check fails — `a rule written across a full stop still matches: expected
'manual' to be 'auto'`. Nothing else moves, which is also the proof that the
window is the only thing the rewrite added.

The seven new checks in `twoPassEffects.test.ts` assert the mechanism rather than
the outcome: the join with no join list, **two independent sentences NOT glued**
(D141's own warning about a looser head, now a test), understood-plus-unread
staying `assisted`, an unmatched leader not swallowing its neighbour, and the two
refusals D141/D142 pinned surviving unchanged.

### The pre-M6.4 list is closed

All eighteen items are built or deliberately unbuilt with a stated reason:
fifteen in D147, then CR 616 (D148), CR 613.8 (D149) and this. What remains
unrepresentable is named and unchanged — removing a NON-KEYWORD ability, because
`MutableCharacteristics` models keywords, so `Humility` cannot be written rather
than merely not having been.

⚠️ `complete` did not move, and for a parser refactor that is the point rather
than a disappointment.

## D151 — Losing a NON-KEYWORD ability, and `Humility` becomes writable

The thing five entries in a row named as unrepresentable. D129 found it, and
D147, D148, D149 and D150 each closed by repeating it: `MutableCharacteristics`
models KEYWORDS, so an effect that removes a non-keyword ability could not be
written at all — not "had not been written", *could not be*.

### Why it was unrepresentable

Every ability in this engine lives in one of two places. Keywords are a `Set` on
the derived characteristics. **Everything else — triggered, static, replacement,
combat and activated abilities — lives in the SCRIPT REGISTRY, keyed by
`oracleId`**, where no characteristic can reach it. So `chars.keywords.clear()`
silences a creature's flying and leaves its ETB trigger, its mana ability and its
"can't block" restriction running.

### The representation

⚠️ **A FLAG, NOT A LIST: `chars.hasAbilities`.** That is what the rule actually
says — not "remove these abilities" but "have none". A list would have to
enumerate things the characteristics cannot name.

⚠️ **`finish()` IS THE ONE PLACE THAT TURNS IT INTO CONSEQUENCES**, so a script
never has to remember them. Five fields go, and each is separately load-bearing:
`keywords`, `protection` and `landwalk` (read by `canBlock`), `toxicAmount` (read
by combat damage) and `producesMana` (read by the payment solver). Clearing only
the keyword set would leave a Humility'd Akroma still unblockable by red and a
Humility'd Llanowar Elves still tapping for green — the silent half-failure D90
is about.

⚠️ **AND FOUR CONSULT SITES, because a source with no abilities is not a
source**: the trigger bus, the static index, the replacement funnel and the
combat seam each skip a silenced permanent, and `legalActions` stops offering its
activated abilities. That last one matters most and is the least obvious: the
activated list comes off the ORACLE face, not off the derived object, so without
it a silenced permanent still offers every ability it prints.

⚠️ **TYPESCRIPT NAMED EVERY CONSTRUCTION SITE.** Adding a required field to
`MutableCharacteristics` failed `tsc -b` at all four places one is built,
including the face-down 2/2 (CR 708.2) and the unknown-printing blank. That is
the argument for a required field over an optional one: the four defaults were
decided deliberately rather than inherited from `undefined`.

### ⚠️ The recursion guard, and what it cannot answer

Asking "has this source lost its abilities" means deriving it — and deriving it
runs `applyStatics`, which is the pass that would ask. **An ability-removal
source is therefore exempt from ability removal**, which breaks the loop by
construction.

That is right for every printed card: `Humility` is an enchantment, so it never
silences itself, and two of them do not silence each other — both asserted. The
case it cannot answer needs a layer-4 type change to make the remover a creature
(`Opalescence`), which this engine models only through the Tier-3 override. Said
plainly rather than left to be found.

⚠️ Every caller is in the safe position: they ask about a SOURCE on the
battlefield while deriving a different CANDIDATE, never about the object being
derived.

### Proved on the card itself

`Humility` — `{2}{W}{W}`, "All creatures lose all abilities and have base power
and toughness 1/1." One line, so a script runs every word (D90).

⚠️ **TWO STATICS, BECAUSE IT IS TWO LAYERS**: "lose all abilities" is layer 6 and
"base power and toughness 1/1" is layer 7b, and CR applies them in that order
however the sentence reads. One def doing both would be a layer violation dressed
as convenience, and would break the moment anything else touched either layer.

### Verified

**66 test files, 1,336 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 432.8 s · `battery-anim.cjs bot engine
prompts` 123/123 · `battery-bot.cjs --games 40` 7/7 · probe 124/124.** Fixtures
131 → 132.

⚠️ **Checked by breaking it, and FOUR checks fail — one per consequence**: with
`finish()`'s gating disabled, `expected 5 to be +0` (keywords),
`expected [ 'B', 'R' ] to deeply equal []` (protection), the mana list, and the
registry ability. A single check would have passed with three of the five fields
still leaking.

⚠️ **A battery run showed three failures and they did not reproduce** — the
re-run is 123/123. All three were rendered-slot and settle-state checks, the
class D110 and D115 record as load-sensitive, on a machine that had just finished
a 432 s fuzz gate. D106's signature, and the fourth time this session.

### Reportable

⚠️ **`complete` did not move**, and for a rules primitive with no parser behind
it that is the expected result — the same as D148 and D149.

⚠️ **THE LAST NAMED IMPOSSIBILITY IS GONE.** Nothing in the layer system is now
described as unrepresentable. What remains unbuilt is ordinary work with a
stated shape: CR 613.8's "what it DOES to the things it applies to" (the second
half of clause (b)), 613.7d/e's re-timestamping, and the dependency case that
needs layer-4 type changing.

## D152 — CR 613.8a clause (b), second half: "what it does"

D149 built the first half ("what it applies to") and named the second as
unbuilt. This is it — and the useful half of the entry is that **the obvious
implementation is wrong, and it was measured wrong rather than reasoned wrong.**

### ⚠️⚠️ The naive reading BREAKS a correct behaviour

The obvious operationalisation is "A depends on B if applying B changes A's
OUTPUT". Implemented exactly that way — clone the characteristics, apply B, apply
A to both, compare the deltas — the layer test failed **two checks by name**:

```
Levitation last — flying: expected false to be true
```

`Gravity Sphere` ("all creatures lose flying") came out DEPENDING on `Levitation`
("creatures you control have flying"), because without Levitation there is no
flying to remove and with it there is. Dependency outranks timestamp, so
Levitation applied first every time and the creature **never flew — even when
Levitation entered last.** That is the wrong MTG answer, and it broke D129's
timestamp pair, which is correct.

⚠️ **ACTING ON A DIFFERENT STARTING STATE IS ORDERING, NOT DEPENDENCY.** Clause
(b) is about the effect's own SPECIFICATION changing — "gains all abilities of
that creature" genuinely does something different when that creature's abilities
change. "Loses flying" always does the same thing; only the board it lands on
differs. **Nothing but the def itself can tell those two apart**, because the
difference is in what the sentence MEANS, not in what the function computes.

### So the def declares it

`StaticDef.effectReads?: readonly ('keywords' | 'pt' | 'types' | 'colors')[]`.
An effect that reads a characteristic to decide WHAT IT DOES says so, and only
then is clause (b)'s second half evaluated for it: did the other effect change
one of those?

⚠️ **Omit it — as every script in this project does — and nothing changes.** The
declaration is opt-in, so the rule cannot fire where it would be wrong, and the
Levitation/Gravity Sphere pair keeps the timestamp answer it should have.

⚠️ Compared BY VALUE, not by reference: `cloneChars` copies the mutable members,
so a probe that changed nothing must compare equal or every declared reader would
depend on everything.

### ⚠️ No real card in this vocabulary needs it, and that is stated

The engine's static vocabulary is add/remove keywords, set P/T, set types and
colours — and an effect whose OUTPUT depends on the input characteristics is
genuinely rare in it. **Every script in `cardScripts.ts` is a constant delta:**
Levitation adds flying, Gravity Sphere removes it, Knighthood adds first strike,
Kwende adds double strike, Humility sets a flag. The real shape that needs this
is "gains all abilities of target creature", which is copy machinery (CR 707) and
belongs to M6.4.

So the mechanism is proved with a DECLARED reader built from the real
`Knighthood` grant, and the negative — an undeclared reader — is asserted beside
it. Both directions in two checks, because the declaration is the whole rule.

### Verified

**66 test files, 1,338 Vitest passing / 9 skipped · `tsc -b` clean · build clean
· the 500-seed replay fuzz gate green at 453.0 s · `battery-anim.cjs bot engine
prompts` 123/123 · probe 124/124.**

⚠️ The reader is registered FIRST and its source enters the battlefield FIRST, so
both registration order and timestamp order would run it before the granter —
which is exactly the ordering the dependency has to overturn. A test where the
declared reader happened to be last would pass with the whole mechanism deleted.

### Reportable

⚠️ **What is left of CR 613 is now three named, ordinary items** — no
impossibilities: 613.7d/e's re-timestamping (a re-attached Aura and a face-down
permanent keep their old position), the dependency case that needs layer-4 type
changing (`Opalescence` making an enchantment a creature so `Humility` can reach
it), and the copy machinery that would give `effectReads` its first real card.

⚠️ **`complete` did not move**, expected for a rules primitive with no parser
behind it — the fourth in a row (D148, D149, D151, this).

## D153 — The BUILT set, re-measured: a pre-filter that had been inflating the report since D128

Asked whether M6.3 was finished, and the honest answer needed the primitives
report to be true. It was not. **`BUILT` had read `['optional']` since D128 —
and the set was right while the ROW was wrong**, which is a harder failure than
a stale line and the reason this entry is long.

### ⚠️⚠️ `optional` was tested BEFORE `expressible`, so it swallowed everything

`primitiveFor` asked "does this line contain *you may*" ahead of the
vocabulary check and ahead of every rule below it. The reasoning was that a
"may" can wrap an effect that is otherwise perfectly expressible. True of some
lines. **Measured over the database, true of 169 of 4,549 — 3.7%.**

The other 4,380 were lines like *"you may search your library for a basic land
card"*, which came back `optional` with its library search counted **nowhere at
all**. Where they actually belong:

`unclassified` 1,898 · `chooseFromZone` 626 · `effect:counter` 390 ·
`duration` 295 · `effect:sacrifice` 257 · `effect:search` 231 ·
`effect:token` 199 · `replacement` 104 · `effect:mill` 96 · `layer6` 92 ·
`costMod` 60 · `delayed` 58 · `modal` 54 · `choice` 20.

### ⚠️ A pre-filter defeats `unlockedBy`, which is the file's one safety property

`unlockedBy` requires EVERY line of a card to be covered by the built set —
D90's rule applied to a roadmap. `optional` is IN that set, so all 4,380 of
those lines were being counted as already handled. **The report claimed 3,463
scriptable cards where the honest figure is 1,362: an inflation of 2,101,
live from D128 to today.**

⚠️ **And it moved the BUILD ORDER this file exists to decide.** `optional` led
D127's table at 2,012 cards by sole need — the headline that made it M6.3's
first primitive. Measured properly it is **96, the second SMALLEST row.**
Building it first did no harm, and that is luck rather than judgement: the flag
had existed in the script API since M3 and the work was one prompt. The number
that justified going first was an artefact of four lines' ordering.

**The rows as they actually stand, by sole need:** `unclassified` 7,779 ·
`layer6` 1,791 · `effect:counter` 1,575 · `scriptable` 1,263 ·
`effect:sacrifice` 1,093 · `chooseFromZone` 1,005 · `effect:token` 915 ·
`duration` 804 · `effect:search` 376 · `keyword:other` 350 · `replacement` 304 ·
`effect:mill` 217 · `costMod` 168 · `keyword:altCost` 152 · `choice` 136 ·
`delayed` 116 · **`optional` 96** · `modal` 42.

### ⚠️ The headline ladder: 10.4× → 9.8× → 5.1×

D127 measured the first four primitives at 795 → 8,286. It is **1,263 → 6,386**,
and the fall has two causes worth telling apart: executing a primitive shrinks
the pool (every card D130, D133, D134/D135, D137, D138, D141, D142 and D147 made
COMPLETE left `blocked`), **and the rest of it was never there** — the first rung
was 3,463 only because of the pre-filter.

⚠️ A falling total is the measurement working, in BOTH directions. It has to be
able to fall because a primitive was executed, and it has to be able to fall
because the measurement was wrong.

### ⚠️⚠️ Most rows can NEVER be ticked, and that is structural

The useful general finding, and it is now written where `BUILT` is defined.
`primitiveFor` asks `expressible` — that is, `parseEffects` — **before** it
reaches any rule. So a line that lands in a row is BY DEFINITION a line the
vocabulary could not read, and widening the vocabulary **drains** the row rather
than qualifying it for a tick. Already pinned twice, in the shape of a fall:
`effect:counter` 1,441 → 1,364 when D130 built it, `effect:token` 1,123 → 812
when D133 did. Listing either in `BUILT` would claim the exact opposite of what
the classifier had just measured.

**So the only rows that can ever be ticked are the ones `parseEffects` is
structurally incapable of draining** — those whose lines are not one-shot spell
effects at all: `layer6`, `optional`, `keyword:*`, `costMod`, `replacement`.
Each still needs its own evidence, per line, that the machinery exists.

### ⚠️ `layer6` stays out, and D129's reason for that is now the wrong one

D129 excluded it because **227 of the bucket's cards are combat RESTRICTIONS
with no seam in `canAttack`/`canBlock`** — and **D147 built that seam**
(`CombatDef`). Of the row's 689 restriction lines only **2** are still beyond the
engine. That reason has been closed for six decisions.

The live reason is one the four-way split never looked for: **1,855 of the row's
4,676 lines are grants that END** — "until end of turn", "until your next turn",
"until end of combat" (1,605 grants, 248 anthems, 2 restrictions). And
**`GameState.untilEndOfTurn` carries POWER AND TOUGHNESS AND NOTHING ELSE**:
there is no temporary keyword grant in this engine at all, so *"target creature
gains flying until end of turn"* has nowhere to be written. **958 of the 1,791
cards whose sole need is `layer6` — 53% — carry one**, and ticking the row would
claim every one of them.

⚠️ **Asserted, not commented.** `expect(temporary).toBe(958)` sits in the layer6
split test, because D129's reason lived in a comment and stayed there for
twenty-four decisions after it stopped being true.

⚠️ The 2 temporary RESTRICTIONS are the shape of the answer if this is ever
built: a duration is not a property of a grant, it is a fifth thing the state has
to remember, and it would serve all four kinds at once.

### So `BUILT` is unchanged, and that is the finding

`['optional']` — the same one line as before, now meaning what it says.

### Verified

**66 test files, 1,341 Vitest passing / 9 skipped** (up 3, all of them the new
DB-free break test) **· `tsc -b` clean · `npm run build` clean.**

⚠️ **CHECKED BY BREAKING IT, and the break is unusually good evidence**: with the
pre-filter put back, seven checks fail and **every one of them reproduces its
OLD pinned number byte-for-byte** — `[1263, 3463, 5509, 7302, 8432]`,
`grant: 1119`, `spell: 313`, `[1263, 3463]`. That is the proof this is a pure
reclassification and not a re-count: one branch decides all of it.
⚠️ The positive case (*"When this creature dies, you may draw a card"* →
`optional`) passes under the break as well, which is right — it is the one case
that was never wrong, and a break test where everything fails is not
discriminating.

⚠️ **THE ENGINE GATES WERE NOT RE-RUN, AND HERE IS WHY THAT IS SAFE.**
`src/data/primitives.ts` is imported by **two test files and nothing else** — not
by `src/engine/`, `src/bot/`, `src/ui/`, `electron/` or any script, and it is not
in the bundle. Nothing it measures can reach a game. D131's precedent, and the
D106 rule against reading a wall-clock from a loaded machine is a second reason
not to run a 450 s gate that cannot move.

⚠️ **`tokenParse.node.test.ts` moved and it is the same correction seen from the
other side.** It measures cards whose sole need is `effect:token`, and 199 token
lines had been held out of that population: cards 812 → 915, lines 840 → 948,
fully resolved 213 → 244. **The resolver did not change, and the hit rate proves
it — 258/280 against 225/244, 92.1% against 92.2%.** A bigger sample behaving
identically.

### ⚠️⚠️ And the integrity check found the same corruption twice more, one of it load-bearing

The routine control-character scan this session runs over any file a script has
edited flagged `primitives.node.test.ts`. Widening it to the whole repository
found **two files carrying literal BACKSPACE characters (0x08) where `\b` was
meant** — D129's patch-script bug, which that entry fixed in the lines it had
noticed and never swept for.

**1. `primitives.node.test.ts` — `isLand: /<BS>Land<BS>/`.** A regex that matches
no string that has ever existed, so `isLand` was **false for every card** and the
replacement split's "tapped LANDS" figure had been printing 0. Now `/\bLand\b/`,
and **asserted at 16** — because it was PRINTED and never asserted, which is the
same failure as `BUILT` itself, one file over.

**2. `src/engine/purity.node.test.ts` — THREE of them, and this one is
architectural.** `new WebSocket`, `document.` and `window.` — the entire
socket-and-DOM half of invariant 7, which is what keeps `src/net/` runnable on
both sides of the wire and in a DOM-less Vitest process. **Three guards passing
over nothing.**

⚠️ **INVISIBLE BY CONSTRUCTION.** A backspace renders as nothing, so the source
reads correctly every single time anyone looks at it — including in the tool
output that this session read the file with. Only a scan for the character code
finds it. **The detector is four lines and it belongs on any file a script has
edited**: flag any character below 32 that is not tab, newline or carriage
return. The only other hit in the whole repository is a form feed inside
Chromium's vendored `LICENSES.chromium.html`.

⚠️ **Repairing the regexes caught a failure immediately, and it was in the CHECK
rather than in the code**: it read the RAW file, so `protocol.ts` explaining a
"5-minute grace window." in prose registered as touching `window`.
`stripComments` sits three screens above it in the same file, under a comment
saying it is "what keeps the test about code rather than prose" — written for the
engine's checks and never applied to the net layer's. Both halves had to be
wrong for the guard to be silent, and both were.

⚠️ **THE GOOD NEWS IS MEASURED: repaired and comment-stripped, all 103 purity
checks pass.** Nothing had crept past them while they were blind — the line held
by discipline for as long as it was not being enforced. And the repaired guard
discriminates: a `const __break = window.location` appended to `protocol.ts`
fails by name (`protocol.ts touches window`), and the file was put back by string
surgery rather than `git restore`, which this tree forbids.

### Verified, after the repair

**66 test files, 1,341 Vitest passing / 9 skipped · `tsc -b` clean ·
`npm run build` clean · `purity.node.test.ts` 103/103.**

### Reportable, revised

⚠️ **The residue is at 49.5% against a 0.5 bar** (45.1% before), because 1,898 of
the misfiled lines are recognised by nothing here. A classifier that got honester
and looks worse is the expected direction, but there is half a point of room left
under the assertion.

⚠️ **`unclassified` at 7,779 by sole need is the largest row in the report by a
factor of four**, and it is the honest next measurement — the same "split the row
before building it" that D129, D130, D131 and D134 each earned.

⚠️ **A CONTROL-CHARACTER SCAN SHOULD BE PART OF THE GATES**, not something a
session remembers to run. Three corrupted regexes across two files survived
twenty-four decisions, and one of them was an architectural invariant. It is a
four-line check over the source tree and it would have caught all three the day
they landed.

⚠️ **`complete` did not move**, which for a change that builds nothing is the
whole point rather than a disappointment — the fifth in a row, and this one is a
measurement rather than a primitive.

## D154 — The control-character scan, in the gates

D153's closing reportable, built. `src/sourceIntegrity.node.test.ts` reads every
text file in the repository and fails on any control character that is not tab,
newline or carriage return.

### ⚠️ Why a machine has to do it

Three regexes in this repo were written with their `\b` as a literal BACKSPACE
(0x08) by a patch script, so they matched no string that has ever existed:
`primitives.node.test.ts`'s `isLand`, and `purity.node.test.ts`'s `new
WebSocket`, `document.` and `window.` — **the entire socket-and-DOM half of
invariant 7, unenforced for twenty-four decisions.** D129 found this class of bug,
fixed the lines it had noticed, and never swept.

⚠️ **INVISIBLE BY CONSTRUCTION, WHICH IS THE ENTIRE ARGUMENT.** A backspace
renders as nothing. The source read correctly in an editor, in a diff, in review,
and in every tool that printed those files during the sessions that introduced
the bug AND the sessions that later fixed neighbouring lines. **A person being
careful is not a control here** — only a scan for the character code can see it.

### ⚠️ It scans TEST files, deliberately

The opposite of what `purity.node.test.ts` does two directories over, and the
reason is measured rather than stylistic: **all three instances found so far were
in tests.** That stands to reason. A corrupted regex in product code fails loudly
the first time it runs; a corrupted regex in an ASSERTION just quietly stops
asserting, and a green tick is indistinguishable from a green tick.

### What it covers

Every `.ts .tsx .cjs .mjs .js .jsx .json .md .css .html .yml .yaml` from the
repository root, minus `node_modules`, `.git`, `dist`, `release`, `coverage`,
`.vite` and `.electron-dist`. Allowed: **tab, LF, CR**. Rejected: everything else
below 32, plus DEL.

⚠️ `.electron-dist/` is excluded because it is a vendored Chromium tree whose
`LICENSES.chromium.html` legitimately carries a form feed — **the only other hit
in the entire repository**, so the exclusion is one directory rather than a
growing allowlist of files.

⚠️ **The failure says what to TYPE, not just what is wrong**: `file:line`, the hex
code, and the escape it was meant to be, with `\b` called out by name as "a REGEX
WORD BOUNDARY, and the one that has bitten this repo three times". The
accompanying message names the cause — a patch script building a replacement
string through a shell heredoc — and the fix this session learnt: write the
script to a FILE and run it with `node <file>`, so the shell never sees the
backslash.

⚠️ **The file that scans for control characters must not contain one, and it runs
over itself.** `MEANT` is built with `String.fromCharCode(92)` rather than a
literal, which is why.

### Verified

**67 test files, 1,344 Vitest passing / 9 skipped** (up from 66 / 1,341), so it is
in `npm run test` and therefore in every gate run rather than in a session's
memory · **`tsc -b` clean.**

⚠️ **A CANARY AND TEETH, because this is exactly the kind of check that passes
over nothing.** The canary is a file count above 100 — `purity.node.test.ts`'s own
rule, since a scan that silently finds nothing passes forever. The teeth assert
`offendingCodes` in BOTH directions: it flags backspace, null, vertical tab, form
feed and DEL, and it leaves tab, CR and LF alone. A predicate that flagged
everything would pass the positive half by accident.

⚠️ **Checked end to end by planting a real one.** `src/zz_break.ts` containing
`/‹BS›Land‹BS›/` — the exact corruption from `primitives.node.test.ts` — fails
with `src\zz_break.ts:1 — 0x08 (meant: \b — a REGEX WORD BOUNDARY…)`, naming the
file, the line and the character. Removed with `unlink`, never `git restore`,
which this tree forbids.

⚠️ Cost: it reads every text file in the repo once. The full suite ran **76.6 s
against 73–83 s across this session's other runs** — inside the noise, and not a
number worth reading off a loaded machine anyway (D106).

### Reportable

⚠️ **The same shape of check would catch a BOM**, which this project does care
about — `electron/jsonstore.cjs` exists to do "atomic, BOM-free JSON read/write".
It is deliberately NOT built here: one rule, one job, and nothing has been
measured to need it. If a BOM ever causes a bug, this is the file it belongs in.

## D155 — The modal DFC back face, and the 355 cards with a half nobody could play

Item 12 of the pre-M6.4 list, and the only Tier-1 correctness bug on it. D147
found it while doing something else and called it "a bigger finding than D136's
reportable"; it has been open since.

### ⚠️⚠️ The offer was right and the handler ignored it

`legalActions` has offered every castable face since M3 — `castableFaces` returns
all of them for `split`, `modal_dfc` and `adventure`, and the `PlayLand` and
`CastSpell` legal actions have both carried a `faceIndex` all along. Then:

- `castSpell` opened with `const faceIndex = 0`;
- `playLand` read `faceOf(oracleCard, 0)`;
- and neither `CastSpell` nor `PlayLand` had a field to carry a face at all.

So the back face of a modal DFC was **listed, clickable and played as the front
face**. `Malakir Mire` came down as `Malakir Rebirth` and was refused as
`notALand`.

⚠️ **AND IT SILENTLY DISABLED THREE RULES THAT WERE BUILT, TESTED AND SHIPPED.**
D134's "enters tapped", D135's conditions and D136's pay-to-enter prompt all read
the entering card's face, and no back face could reach any of them. D136's own
reportable described this as the entry rules failing to SEE a back face — that
was the symptom. Nothing saw one because nothing could produce one.

### ⚠️ The UI half is bigger than the engine half: 355 cards

The click path did `legal.find((a) => a.card === id)` — the FIRST match — so this
was never only modal DFCs. **98 modal DFCs + 123 split cards + 134 adventures**
all had a second half the engine offered and no person could reach.

### The face rides on the MOVE, and that is forced

`clearBattlefieldFields` resets `CardInstance.faceIndex` to 0 on every zone
change — right for CR 400.7, and right for a TRANSFORM permanent that dies as its
front face. A modal DFC's face is a property of the SPELL and has to survive
hand → stack → battlefield, so it needed somewhere else to live.

⚠️ **A SEPARATE `FaceIndexSet` EVENT CANNOT WORK, AND THE FUNNEL IS WHY.**
`runReplacementFunnel` reads the state BEFORE the batch is applied, so an earlier
`FaceIndexSet` in the same batch is invisible to it — "enters tapped" and "pay 3
life" would still be decided from the front face — and a later one is too late to
matter. So the face goes on `CardMove`, exactly as `faceDown` already does, and
both the funnel and the reducer read it from there. `triggers.ts`'s own comment
had stated this constraint in advance, for a path it said did not exist.

⚠️ Three places put it on: `playLand`'s hand → battlefield, the two cast-start
hand → stack moves, and `resolveTop`'s stack → battlefield. The first cast move
matters as much as the last: `resolveTop` decides whether a spell is a PERMANENT
by reading the card's face, so without it `Sword of the Realms` resolves into the
graveyard.

⚠️ **THE TYPE CHECKER NAMED ALL TEN CONSTRUCTION SITES** — `StackObject` and
`PendingCast` gained a required `faceIndex`, and `tsc -b` listed every place that
builds one, including three that are chits rather than cards and correctly take
0. D138's pattern: a required field is how you find the sites you would have
missed.

### The face chooser, because the engine taking a face is not the feature

⚠️ **WITHOUT IT THIS IS EXACTLY THE STATE D142 SHIPPED IN AND D143 CALLED OUT**:
answerable by the bot, the fuzzer and the net driver, and by nobody at the table.
`faceOptionsFor` + `FaceChoicePanel`, in D110's shape deliberately — **one option
acts, more than one asks**, options recomputed from `legal` every render, commits
on the pick so choosing a half is one extra click and never two. An unaffordable
half is shown disabled rather than hidden, for D110's reason about conditional
mana.

### Verified

**68 test files, 1,353 Vitest passing / 9 skipped · `tsc -b` clean · build clean ·
the 500-seed fuzz gate green at 456.9 s · `battery-anim.cjs prompts` 26/26.**

⚠️ **THE FIXTURE POOL HAD NO `modal_dfc` AT ALL** — 121 normal, 2 split, 4 token,
5 transform — which is the whole reason a hardcoded 0 survived every suite. Fifth
time in this repo that a fixture unable to reach a path is how the path rotted
(D102, D107, D108, D121, this). Three real cards added, one per shape the back
face can take: `Malakir Mire` (a land that enters tapped), `Agadeem, the
Undercrypt` (a land that ASKS for 3 life) and `Sword of the Realms` (a permanent
SPELL, so it goes through the stack). Fixtures 132 → 135.

⚠️ **Checked by breaking it**: with the reducer ignoring `move.faceIndex`, three
checks fail with `expected +0 to be 1` — the permanent forgetting its face. The
two ENTRY-rule checks still pass, which is right and worth stating: the funnel
reads the face off the move and the reducer persists it, so they are independent
mechanisms and the break test shows which one it broke.

⚠️ **THE 60-SEED DEFAULT LOST TWO CANARIES AND THE GATE KEPT THEM.** Adding one
card to `DECK` does not merely dilute it — **it RE-ROLLS every seed's game**,
because the deck list feeds the shuffle. `transformedIntoPlaneswalker` and
`diesTriggers` both went to 0 at 60 seeds while the 500-seed gate stayed green on
the same commit, so both moved to `SEEDS >= 500` with the reason written down.
D149's precedent, now applied twice more.

⚠️ Four traps cost a run each while writing the battery block, and three were
already recorded in this repo: backticks inside a template literal (the file says
so eight lines above where I put them), the viewer moving when priority passes
through a hotseat (D119/D145), and `[data-instance-id]` versus the slot wrapper
(D145). The fourth is new and now encoded: **the step is `precombatMain`, not
`main`**, so a `indexOf('main') === 0` wait passed priority for thirty turns and
reported the wrong seat.

### Reportable

⚠️ **TARGETING STILL AIMS WITH THE FRONT FACE'S SPECS.** `beginAim` asks
`session.targetSpecsFor(card)` with no face, so a back face that targets offers
the wrong candidates. It fails SAFE — the host validates against the real face
(D139) and rejects — but a back-face spell with targets cannot be cast through
the UI. It affects the subset of the 38 spell-back-face MDFCs that target, and it
is one parameter.

⚠️ `complete` did not move, and for once that is not a primitive's excuse: these
cards were already counted by `engineComplete`, which reads the CARD's faces and
never knew the engine could not reach one of them.

## D156 — `EMPTY_REGISTRY` was a trap with a fuse on it, and the fuzz pool got its guard

Items 1 and 2 of the pre-M6.4 list. Both are things that get harder or turn
silent the moment M6.4 lands its first script, which is why they are before it
rather than during.

### ⚠️⚠️ The constant named "empty" was built from `SHIPPED_SCRIPTS`

`export const EMPTY_REGISTRY = new IndexedRegistry(SHIPPED_SCRIPTS)`. So the name
stops being true the moment a script lands — and it was used for **two different
things across 45 references in 20 files**:

- product code meant **"what the app ships"**;
- **eight test files meant "a registry with no scripts at all"** — and those would
  have silently started running card scripts, changing what they assert without
  changing a line of their own source.

Split into `SHIPPED_REGISTRY` (from `SHIPPED_SCRIPTS`, what `host.ts` defaults
to) and `NO_SCRIPTS` (from a literal `[]`, for tests, and empty forever).

⚠️ Every one of the 45 was classified by what it MEANT rather than rewritten
mechanically. `derive.test.ts` asserting `size === 0` is the one that would have
failed loudly; the other seven would not have.

⚠️ **AND THE HOST DEFAULT IS `SHIPPED_REGISTRY`, NOT `NO_SCRIPTS`.** Omitting
`HostOptions.scripts` has to mean "whatever the app ships"; if it meant "nothing",
landing a script would change the library and not the game.

### ⚠️ A real bug fell out: the board queries derived with no scripts

`conditionHolds` — D135's seven "enters tapped unless you control…" queries —
called `derive(state, oracle, EMPTY_REGISTRY, …)`. Those are questions about
DERIVED characteristics ("do you control a Forest", "a basic land", "two other
lands"), so deriving them without card scripts ignores every static that changes
a type. Harmless while nothing ships and **wrong the moment M6.4 lands its first
Blood Moon**. The registry is threaded through `applyReplacements` →
`withEntersTapped` → `conditionHolds` now — and that parameter's own comment used
to say it was kept *only* to hold the funnel's signature steady, which is no
longer true and says so.

### ⚠️ The fuzz-pool rule finally has a guard

M6.4-LIBRARY-SPEC §6 gate 3 requires every landed card seeded into the fuzz pool,
and records that **this repo has broken that rule four times** (D102, D107, D108,
D121). Nothing connected `SHIPPED_SCRIPTS` to the gate's hand-written `SCRIPTS`
and `DECK`. Now two checks, in `fuzz.node.test.ts` where the pool lives:

- every shipped script is REGISTERED there (or the trigger bus never sees it),
- and its card is DEALT in `DECK` (or nothing ever puts it on a battlefield).

⚠️ Either alone is satisfiable while the path stays dead, which is why it is two.

⚠️ **Written while `SHIPPED_SCRIPTS` is empty and both checks are vacuous**, for
`shippedScripts.node.test.ts`'s own reason: a rule that lives in comments is the
one that gets broken, and M6.4 lands scripts in batches where a batch that forgot
this is indistinguishable from one that did it right. **The teeth point at
`Humility`** — registered nowhere and dealt nowhere, exactly the state a forgotten
batch leaves a script in. ⚠️ The first card I reached for, `Kwende`, turned out to
BE dealt: the gate is already correct about every script it registers, which is
the point of the two checks and the reason the teeth needed a genuine miss.

### ⚠️ And a guard in the other direction, which would have been the silent one

`shippedScripts.node.test.ts` now scans every product file for `NO_SCRIPTS`. A
product file reaching for the empty registry would make the app ignore every
script it ships, and **nothing would fail** — the split fixed the tests, and this
stops it being undone from the side that has no symptom. With teeth: the scan is
asserted to be able to SEE a file that names it.

### Verified

**68 test files, 1,358 Vitest passing / 9 skipped** (up from 1,353) **· `tsc -b`
clean · build clean.**

⚠️ The 500-seed gate was not re-run for D156 itself: `conditionHolds`' registry
threading is the only behavioural change and it is a no-op while
`SHIPPED_SCRIPTS` is empty — the same registry either way. It ran green at
456.9 s earlier in this arc for D155, whose changes it genuinely does exercise.

## D157 — The M6.4 scaffolding, the residue split, and M6.3 closed on a restated bar

The rest of the pre-M6.4 list: the pipeline, the conformance corpus, the biggest
unmeasured row, CI, and the milestone itself.

### The pipeline — and why there is no `draft.cjs`

`scripts/cardgen/` holds `select.cjs`, `verify.cjs` and `land.cjs`, plus a README
that IS the drafting step.

⚠️ **THE SPEC NAMES A `draft.cjs` AND IT IS DELIBERATELY NOT A SCRIPT.** The
running game never touches a network and never calls a model; a `draft.cjs` that
called an API would put a network dependency in this repository even though
nothing shipped it, and the first person to run it inside `electron:build` would
find out offline. Drafting is what it actually is — a developer, with a model,
writing ordinary reviewed TypeScript from `batch.json`. Automating it is how a
script nobody read gets landed.

⚠️ **`select.cjs` IS A WRAPPER AND THE LOGIC IS TYPESCRIPT, WHICH IS FORCED.**
Selection asks `engineCompleteness` and `primitivesFor` which cards are blocked on
a script alone; `scripts/` is CommonJS and cannot import them. The alternative is
a second copy of those predicates in CJS — the one thing five entries of this file
say not to do. So the work lives in `cardgenSelect.node.test.ts` and the script
runs it, exactly as D133 resolved the same wall for the token table.

⚠️ **IT EMITS ONLY CARDS WHOSE SOLE NEED IS `scriptable`.** A card that also waits
on a primitive is not draftable however easy its text looks, and handing one to a
drafter produces something that cannot pass verification. **Measured on the first
real run: 1,263 cards, 10 of them in the user's own decks.**

⚠️ **`land.cjs` REGISTERS AND THEN REFUSES TO CLAIM SUCCESS.** It prints the three
things the card still owes and the next command. A tool that both writes and
lands a script is a tool that can land one nobody read.

⚠️ **`spawnSync` CANNOT LAUNCH A `.cmd` SHIM ON WINDOWS WITHOUT `shell: true`,
and the failure is SILENT** — status 1, no output at all, which reads as "vitest
failed" rather than "vitest never started". Cost one debugging round.

### The conformance corpus

`src/engine/conformance.test.ts` — five known-hard interactions with published
answers: CR 613.7c timestamp, CR 613.8a dependency, CR 616 replacement ordering,
CR 613.6 ability removal, and a granted keyword reaching CR 509.1b.

⚠️ **EVERY CASE ASSERTS BOTH DIRECTIONS.** An ordering rule tested one way passes
with the ordering code deleted, which is how each of these was verified when it
was built and is the property worth keeping.

⚠️ **THE FIRST DRAFT OF CASE 5 WAS A GREEN TICK OVER NOTHING** — a bare `canBlock`
outside combat answers `notAttacking` whether or not the grant landed. It asserts
on the block prompt's own `legal` list now, which is what a client actually sees.
The corpus's own purpose caught it.

⚠️ ONE registry holding every script, in a fixed order: a case registering only
the two scripts it cares about could get the right answer from registration order
rather than from the rule — D129's exact failure.

### ⚠️⚠️ The residue split: the biggest row was a black box

`unclassified` is **7,779 cards by sole need, the largest row by a factor of
four**, and nothing had ever looked inside it. Split by `residueKind` over its
**18,208 lines**:

`activatedCost` 3,170 · `triggeredShell` 2,509 · `damage` 1,328 · `exile` 1,263 ·
`staticShell` 1,017 · `attackBlock` 999 · `lifeGainLoss` 939 · `drawDiscard` 577 ·
`tokensAndCounters` 507 · `copySpell` 224 · `cantBeCountered` 109 ·
`gainControl` 95 · `wardHexproofGrant` 49 · **`other` 5,422**.

**The two largest named families are both already-named M6.4 work**:
`activatedCost` (1,718 cards) is an ability whose cost the engine cannot CHARGE —
a decision rather than a price, D68 and D122's distinction — and `triggeredShell`
(1,333) is a trigger whose condition reads fine and whose payload does not, which
wants the effect vocabulary rather than a trigger primitive.

⚠️ **NAMING A LINE DOES NOT MAKE IT EXPRESSIBLE.** `residueKind` is a secondary
classification and never a `RULES` row. Moving these into `RULES` would shrink the
residue by RELABELLING it — the one way this report could lie about its own
coverage.

⚠️ **AND IT REPLACED THE BAR THAT WAS ABOUT TO BREAK.** The residue check was
"unclassified share of blocked cards < 0.5" sitting at **49.5%**, which would have
failed on the next parser widening for a reason unrelated to anything going wrong.
The question worth bounding is how much of the report is genuinely UNNAMED —
`other` as a share of the residue, **5,422 of 18,208, 29.8%** — pinned as a ratio,
because both numbers move together when a parser widens and only the ratio says
whether the black box is growing.

### ⚠️ CI cannot hold all five gates, and the criterion is amended rather than fudged

**Nine test files need the 86 MB Scryfall database**, are written with
`describe.skipIf`, and therefore **skip on a machine without it, leaving the run
green** — D128's green-over-nothing at the scale of a pipeline. It would report
success while the coverage accounting, the tier-3 ledger and the bot pool were
checked by nothing.

`.github/workflows/ci.yml` holds types, build, source integrity, the conformance
corpus, the unit suite and the 500-seed fuzz gate in its own job — and **prints
the files it could not check**. Gates 1 and 5 run locally through
`verify.cjs --full`. M6.4-LIBRARY-SPEC §8's done-when is amended in place with the
reason, and `sourceIntegrity.node.test.ts` **pins the count at nine** so a tenth
cannot quietly join the set CI does not cover.

### M6.3, closed on a restated bar

The brief's done-when — *"the number of completely-executable cards has
MULTIPLIED"* — is **×1.23** (1,405 → 1,730) and **never could have been met**:
D127 measured on day one that a primitive makes a card possible to script and the
script is M6.4. The bar was written for an arc; M6.3 is its first half. The entry
says so and lists what it IS closed against, rather than being ticked on wording
it did not satisfy.

⚠️ The 27 sub-entries are now in alphabetical order. Verified as a pure
permutation: **same byte length, same multiset of lines**, which is the only check
that distinguishes a reorder from an edit.

### Verified

**70 test files, 1,370 Vitest passing / 10 skipped · `tsc -b` clean · build
clean · `scripts/cardgen/select.cjs` produced a real batch.**

### Reportable

⚠️ **`verify.cjs` HAS NEVER BEEN RUN END TO END**, because there is no batch to
verify — `SHIPPED_SCRIPTS` is empty and every gate it wraps passes on its own. Its
spawn mechanism is proved by `select.cjs`, which uses the same one; the
orchestration is not. The first M6.4a batch is what exercises it.

⚠️ **TARGETING STILL AIMS WITH THE FRONT FACE'S SPECS** (D155's reportable, still
open): a back-face spell that targets cannot be cast through the UI. It fails safe
— the host validates against the real face and rejects — and it is one parameter.

### ⚠️⚠️ Correction: "same multiset of lines" does NOT prove a reorder was safe

The 27 M6.3 entries were sorted by a script that defined each entry's block as
*"from this bullet to the next `- [` bullet"*. Verified afterwards with what
looked like the strongest possible check — **same byte length, same multiset of
lines** — and it passed.

**It was still wrong.** Entry `m` was LAST in the file, so its block ran to the
end and swallowed everything after it: the invariants section AND the
`## Agent tooling map`. Sorting moved `m` into position 13, and both of those
sections went with it — landing in the middle of the milestone list. A pure
permutation of lines, and a broken document.

⚠️ **The lesson is about the CHECK, not the sort.** A multiset check proves
nothing was lost or duplicated; it says nothing about whether the pieces are
still in meaningful places, because every wrong arrangement is also a
permutation. What was needed was a check on the STRUCTURE — that the sections
after the milestone list are still after it — and the thing that actually found
it was reading the grep output and noticing `M6.3aa` at line 3728 with the
invariants at 2863.

Fixed by cutting the three trailing sections back to the end, with a multiset
check *plus* an assertion that the span contains all three of them by name.
Final order: the 27 entries alphabetical, then `### Before M6.4`, then the
invariants, then the tooling map.

## D158 — M6.4a: the first shipped batch, and the seam it was first to reach

**1,738 of 31,692 Commander-legal cards now execute completely, up from 1,730.**
Eight scripts landed — the first entries `SHIPPED_SCRIPTS` has ever held: `Soul
Warden`, `Essence Warden`, `Radiant Fountain`, `Adventurer's Inn`, `Wall of
Blossoms`, `Wall of Omens`, `Baleful Strix`, `Onulet`. Every oracle text was
read from the local database before a line was written (D15b) — and it caught
the plan being wrong in the good direction: `Adventurer's Inn` was assumed
activated and is `Radiant Fountain`'s trigger twin to the word.

⚠️⚠️ **FOUR OF THE BATCH'S TWELVE ARE STRUCTURALLY UNLANDABLE, AND THE REASON IS
A DEAD SEAM.** `Arcane Encyclopedia`, `Deserted Temple`, `Hedron Archive` and
`War Room` are pure activated abilities, and **nothing in the engine consults an
`ActivatedDef`**: `IndexedRegistry` never indexes `script.activated` (the
`ScriptRegistry` interface has no accessor for it), and `resolveAbility`'s only
script lookup is `triggerDefFor` — triggers alone. `tier3.ts`'s activated loop
is an independent second lock: it reads `parseActivatedAbilities` directly, so
the "charges the cost and runs nothing" note survives any script. D128's
`optional` and D134's `ReplacementDef` had the same disease; this is the third
dead seam in the script API and the first the selection pipeline walked into.
`select.cjs` does not filter by seam — it emits every sole-need-`scriptable`
card — so **a batch must be classified by hand against what the engine consults
until the seam is built.** ⚠️ A related hazard, now a review rule: a
`TriggerDef.abilityId` matching `/^a\d+$/` collides with the parsed-activated
`abilityRef` namespace (`${oracleId}#a${index}`), and `triggerDefFor` would run
that trigger's `resolve` when the activated ability resolves.

⚠️⚠️ **THE SILENCE MECHANISM DID NOT EXIST, AND GATE 5 IS UNPASSABLE WITHOUT
IT.** `engineCompleteness()` and `tier3NotesFor()` were pure text parsers with
no knowledge of `SHIPPED_SCRIPTS` — the M6.4 handoff's "what already exists for
you" list did not cover it, and landing any script failed the coverage
accounting with "a script ships for it, but engineComplete still refuses it".
Built in `engineComplete.ts` as `lineClaims`: a map of `scrub(def.text).trim()`
per oracle id, consulted LAST in `linesUnaccounted`'s ladder (after every
built-in account, so no two consumers claim one line), passed at the single
chokepoint both callers share — so `engineComplete`, `tier3`, `primitives`,
`botPool` and `cardgenSelect` moved together by construction, with no second
copy anywhere.

- ⚠️ **PER LINE, NEVER PER CARD** (D90): a def claims exactly one printed line,
  matched byte-for-byte after the one transform (`scrub` + trim) that stands
  between printed text and a leftover. A def whose text spans lines can never
  match, and the gate refuses the card — failing safe. Both sides descend from
  the same database bytes: the def's `text` is `printed()`-guarded against the
  fixture, the fixture byte-guarded against the live DB.
- ⚠️ **`activated` DEFS MAY NOT CLAIM, STRUCTURALLY** — excluded from the map
  AND the skip is gated `!isActivated`, so even a def that erroneously carried
  an activated line's text cannot silence what the engine charges for and never
  runs (D122's bug, kept out by two independent walls).
- ⚠️ **KEYED ON `SHIPPED_SCRIPTS`, THE NAMED LIST** — never a registry
  parameter, so the TEST registry's scripts stay refused and the teeth check in
  `shippedScripts.node.test.ts` keeps meaning something.

⚠️⚠️ **THE FIRST TWO SIMULTANEOUS SAME-CONTROLLER SCRIPT TRIGGERS THIS ENGINE
EVER PRODUCED LIVELOCKED IT.** Two Soldier tokens created under a Soul Warden —
two `TokenCreated` events, two pending triggers, one controller — hit `pump`'s
10,000-iteration throw on an endless `AwaitingSet` stream. **`orderTriggers` had
never been reached through the live loop by anything**: `simplestAnswer.test.ts`
hand-builds the awaiting, `awaitingProducers.node.test.ts` asserts the producer
EXISTS, and the fuzz gate's ten scripts never made two simultaneous triggers for
one controller in 500 seeds. Both halves of the seam were broken:

- the RAISE looped — `drainTriggers` runs BEFORE `advance()`'s awaiting check
  (step 2 before step 3), the owing controller's triggers stay pending while
  the question is up, so every iteration re-entered the drain and re-emitted
  the same `AwaitingSet`. `advanceMulligan` has carried the re-raise guard for
  this exact shape since M3; the drain never got one.
- and the ANSWER re-asked forever — the `OrderTriggers` handler only REORDERED
  `pendingTriggers`, so the next drain saw the same ≥2 group and asked again.
  An infinite ask-answer loop for a human; termination for nobody.

Fixed by extracting the drain's stacking body into `stackPendingTriggers` —
ONE implementation, two callers (D148's rule) — with the drain stacking every
controller's group UP TO the first one that owes a choice, then asking (never
emitting over any live prompt, its own included), and the answer handler
stacking the chosen order directly. ⚠️ **The prefix rule also fixed a latent
APNAP wrongness**: the old drain stacked nothing until every group was a
singleton, so a single-trigger ACTIVE player behind a prompted non-active one
would have gone on the stack after the answer — above it, resolving first —
CR 603.3b reversed. Pinned by `soulWarden.test.ts`'s three-warden case: the
active player's trigger stacks first, the opponent is asked, +1/+2 land where
they should.

⚠️ **TOKENS ARE NOT MOVES, SO ONE PRINTED LINE IS TWO DEFS.** `reducer.ts`
builds a token directly on the battlefield from `TokenCreated` — no `CardsMoved`
is ever emitted for a token entering — and the trigger bus dispatches on exact
event kind. A Soul Warden watching `CardsMoved` alone misses every token, which
is half the creatures that enter a real Commander game; the break test ships in
the suite (the one-def variant must miss the token the real script catches).
⚠️ Granularity, measured before shipping: every battlefield entry today arrives
in its own event (`ManualMoveZone.to` is `'library' | 'exile'`, effect moves
are singular, mass token creation is one event per token), so one firing per
event IS one firing per creature. A future event batching several entries into
one `CardsMoved` would under-fire these triggers; the bus needs per-move firing
before such an event may be added.

⚠️ **THE SHIPPED ONULET REPLACED THE TESTING COPY AND FIXED IT ON THE WAY.**
`testing/cardScripts.ts`'s resolve read the dead card's OWNER under a comment
arguing for the trigger-time controller; the shipped module reads
`obj.controller` — captured as the trigger fired (CR 603.3d), which differs
exactly when the creature was stolen. Pinned: a stolen Onulet pays the thief.
One card, one script — `fuzz.node.test.ts` and `targetedTrigger.test.ts` import
the shipped module now.

⚠️ **`drawEvents` IS EXPORTED, AND THAT IS THE WHOLE DRAW DESIGN.** The walls
and the Strix route through the ONE draw rule in `effects.ts`, so the
empty-library flag (CR 704.5b) cannot be re-derived in `scripts/cards/` and
drift. Pinned: a Wall of Omens entering on an empty library sets up the same
loss the draw step would.

⚠️ **A TEST TRAP WORTH KEEPING: `put()` + an auto-resolving trigger races the
measurement.** `put` takes the card from the HAND when the shuffle dealt it
there, and a mandatory trigger can resolve inside `put`'s own pump — so "hand
+1 after the entry" measured −1 + 1 = 0 and the first cut read as "the draw
never happened" on a working script (the probe showed the draw event sitting in
the log). Draw tests stage the card through the GRAVEYARD and measure before
the entry.

**The first end-to-end `verify.cjs --full`** (D157's reportable — it had never
run): the orchestrator itself worked unmodified — five gates spawned, failures
aggregated, exit honest. Gates 1–3 (types, conformance, coverage accounting)
green on the first run. Gate 4 reported the six data-suite pins that the batch
moved (re-measured and re-pinned, below) plus two wall-clock timeouts, and gate
5 overran its 600 s timeout at 1,014 s — ⚠️ **measured with a AAA game
(`Spider-Man2`) resident at LoadPercentage 100**, D106's case for the fifth
recorded time. The fuzzer itself completed all 500 seeds with every replay hash
equal; only the clock was tainted. **The official run on the idle machine
passed ALL FIVE GATES**: `tsc -b` clean · conformance green · coverage
accounting green over the real database · the whole unit suite **78 files,
1,422 passed / 10 skipped** (70 / 1,371 before the batch) · the 500-seed gate
green at **447.2 s** inside the full run and **426.0 s alone — faster than
D157's 456.9 s baseline** despite the games carrying 5.3× the triggered
abilities. Then, beyond the gates: `npm run build` clean · `npx electron
scripts/probe.cjs` **124/124** against the M6.4a build · `battery-anim.cjs bot
engine prompts` **127/127** — the drain rewrite under real clicks in a real
Electron, with the bot playing the regenerated deck to turn 16. The batch is
landed on that green.

**Re-measured, every delta exactly the eight shipped cards:** `complete` 1,730
→ **1,738** · `blocked` 29,962 → 29,954 · `scriptableToday` 1,263 → 1,255 (and
`select.cjs` re-emitted `batch.json` at total 1,255, the four activated cards
now rung 1's remainder) · the primitives ladder [1263, 1362, 3315, 5199, 6386]
→ [1255, 1354, 3307, 5191, 6378] · botPool `POOL` creature 1,143 → 1,149, land
209 → 211 · tier3 `abilityText` 17,506 → 17,498, `silentAfter` 2,141 → 2,149,
`wasSilent` 15,851 → 15,843 (`silentBefore` unmoved — the pre-D122 rules never
saw a permanent's ability text, so a script silencing one changes nothing under
them) · `botDeck.ts` regenerated (the pool grew; `Adventurer's Inn` displaced a
basic — 26 nonbasic + 11 basic; commander line now "reaching 754 cards") ·
fixtures 135 → 140 · `SHIPPED_SCRIPTS` pinned 0 → 8.

**The gate's games with the batch dealt:** 500 seeds · 83,977 accepted intents
· 2,592,922 events · 19,517 turns · **7,067 triggered abilities (1,329 in
D129)** · 13,261 target prompts · 640 tokens created, all nameable · 1,749
permanents entered tapped · every replay hash equal. The wardens in `DECK` are
what finally raise `orderTriggers` in real games.

**Checked by BREAKING it:** the silence hook disabled at one call site fails
the coverage gate naming ALL EIGHT cards by their exact unaccounted line, and
nothing else moves; the one-def Soul Warden variant misses the token the real
script catches (a permanent break test in the suite); the livelock is not a
retro-break — it was OBSERVED live, twice, before the fix existed (the two
count-2 token tests were born failing with the 10,000-iteration throw and are
the regression tests).

⚠️ **Reportables, measured and NOT fixed here:**
- **`ActivatedDef` is a dead seam** (above) — the registry accessor, the
  `resolveAbility` branch and the tier3 accounting rule are the next engine
  work M6.4 needs; 4 of the user's own 10 deck cards wait on it.
- **`ctx.random` is a stub at all three `ScriptCtx` construction sites**
  (`below: () => 0`, `shuffled: (xs) => xs` — `derive.ts`, `loop.ts`,
  `triggers.ts`) while `api.ts`'s header promises a seeded scratch RNG threaded
  through the log. No script needing randomness may ship until it is wired;
  none of this batch does.
- **`collectTriggers` scans every card id per (event × def)** — D128 named the
  shape, D147 hoisted the key lists, and 18 registered defs × 2.59M events make
  it the prime suspect if the gate's idle wall-clock has genuinely grown. A
  per-oracle-id source index (one O(cards) pass per call) preserves iteration
  order bit-for-bit; build it measured, on an idle machine.
- **`docs/DECISIONS.md` carried a truncated duplicate of D1–D147** as an
  8,827-line garbage prefix — the real header was FUSED mid-sentence onto the
  truncated copy's last line ("…and the `# Decisions") — D157's sort-script
  fallout, sitting in the file that wins every disagreement. Repaired by byte
  surgery against the fused-line marker (never `git restore`): 326 headings →
  168, each now unique, prefix verified a strict truncated subset, tail
  byte-identical, original backed up outside the repo.

## D159 — M6.4b: the ActivatedDef seam, two cost machines, and the four cards they unblock

**1,742 of 31,692 Commander-legal cards now execute completely, up from 1,738 —
and rung 1 is EMPTY: every card in the user's own saved decks runs.** Four
scripts landed: `Arcane Encyclopedia`, `Deserted Temple`, `Hedron Archive`,
`War Room` — the four D158 named structurally unlandable.

⚠️⚠️ **THE SEAM: `ActivatedDef` WAS A DEAD FIELD AND IS NOW THE THIRD CONSULTED
DEF KIND.** `resolveAbility` gains `activatedDefFor` beside `triggerDefFor` —
the join is `def.ref === obj.abilityRef`, the exact `${oracleId}#a${index}`
string `handlers.activateAbility` has written since M3 — and the engine's own
machinery still owns everything up to resolution: parse, offer, charge, stack.
The `ScriptCtx` construction was EXTRACTED to one site (`scriptCtxFor`) so a
field added for one def kind cannot silently stay a stub for another — which is
exactly how `ctx.random` rotted (still a stub, still said).
⚠️ **THE INTERFACE SHRANK TO ITS CONSULT SITES.** The first cut of
`ActivatedDef` carried `abilityId`, `activeZones`, `isManaAbility` and
`canActivate`, and NOTHING consulted them for three milestones — D158's
dead-seam disease in the seam's own type. It is `{ ref, text, resolve }` now;
fields return WITH their consult sites. `ids.ts`'s `AbilityRef` doc was also
wrong about its own format (`#${abilityIndex}` where both producers write
otherwise) and now states both suffixes and the /^a\d+$/ collision rule.

⚠️⚠️ **TWO COSTS BECAME CHARGEABLE, AND ONE OF THEM IS GATED ON THE DEF.**
- **`Sacrifice this <type>`** (`sacrificesSelf`) — a SELF-sacrifice is
  deterministic, no chooser, so it is a price (D68's ward distinction, applied
  to activation costs). Charged in `finishAbility` in the cost batch, before
  the ability is on the stack (CR 602.2b), through an ordinary `CardsMoved` —
  so dies-triggers and the funnel see it like any death, and a def's `resolve`
  runs with its source in the graveyard. ⚠️ **CHARGEABLE IS NOT OFFERABLE**:
  `legal.ts` offers and `activateAbility` accepts a self-sacrifice ONLY when
  the game's registry carries the def (`activatedDefRegistered`) — charging
  mana for nothing is D122's disclosed status quo; eating a permanent for
  nothing is not. Asked of the GAME'S registry, so a test registry with the
  def is offered it. `tier3.ts` words the undef'd note from the same rule (the
  manual route, never "the app charges that cost").
  **Blast radius, measured over the whole database and then re-measured after
  landing: `payable` grew 4,016 → 4,828 CARDS (28,133 ability lines over all
  printings, from 24,729) — every one still never offered without a def, and
  `silentAfter` moved by exactly the four landed cards, which is the proof no
  disclosure was lost.** ~812 sacrifice-self cards are now each ONE DEF away
  from executing — the widest single unlock M6.4 has.
- **`Pay life equal to the number of colors in your commanders' color
  identity`** (`lifeCostCommanderColors`) — War Room's exact phrase and only
  that phrase (D90). The parse records the RULE; the offer and the activation
  compute the NUMBER off `players[p].identity` (D116's union), so the payment
  problem, the review and the wire carry the real price. Kess pays 3, Krenko
  pays 1, from one script — pinned.

⚠️⚠️ **THE CLASSIFIER WAS BLIND TO LONG COSTS, AND WAR ROOM IS 82 CHARACTERS.**
`splitAbilityLines` filed a `cost: effect` line as a SENTENCE when its colon
sat past `MAX_COST_LEN` (60) — the cap exists for prose colons, and prose never
opens with a brace, so `costLike` now admits any length when the line STARTS
with a mana/tap symbol. Measured over every printing: `lines` 42,945 → 43,140
(+195 real ability lines the targeting and disclosure machinery had never
seen), `activated:nonManaCost` warnings 13,581 → 10,372, `abilityText` notes
17,453 (45 cards' "static text" notes replaced by truer per-cost notes),
`target:unparsedCount` 549 → 551 (two newly visible lines carry a count clause
the parser declines to guess — honest growth).

⚠️ **TWO TEST TRAPS WORTH KEEPING** (both cost a red run): a mana pool filled
BEFORE `advanceUntil` is a pool that is gone — CR 500.4 empties between steps —
so fund a seat only once it holds priority; and an activated ability with
default stops can resolve inside its own submit (D119's auto-pass), so a test
that responds to the stack must `holdEverywhere` first — the same race D158
found on `put`, one intent later.

**Checked by BREAKING it:** the tier3 activated silence disabled fails the
coverage gate naming ALL FOUR cards by their exact printed costs; Hedron's
def-gate break test ships IN the suite (registry without the def → the ability
is refused and the permanent untouched); the claims kind-separation is a unit
test (an activated def's text cannot silence a sentence, nor a trigger's an
activated line). The fuzz gate gains the ACTIVATED-SEAM CANARY — stacked
abilities whose ref a shipped def resolves, gate-size only like the
dies-trigger canary.

**Re-measured, every coverage delta exactly the four cards:** `complete` 1,738
→ **1,742** · `blocked` 29,950 · `scriptableToday` 1,255 → 1,251 · ladder
[1251, 1350, 3303, 5187, 6374] · botPool artifact 31 → 33, land 211 → 213 ·
tier3 `silentAfter` 2,149 → 2,153 · `botDeck.ts` regenerated (Arcane
Encyclopedia joined; "reaching 758 cards"; 28 nonbasic + 9 basic) · fixtures
140 → 144 · `SHIPPED_SCRIPTS` pinned 8 → 12 · `batch.json` re-emitted at total
1,251 with **rung 1 (your decks): 0**.

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation on the idle machine: `tsc -b` clean · conformance green ·
coverage accounting green over the real database · 82 test files, 1,450 Vitest
passed / 10 skipped (78 / 1,422 before this batch) · the 500-seed replay fuzz
gate green at 382.8 s — the fastest run of the day, with 12 scripts registered
and every landed card dealt · the activated-seam canary held at gate size ·
`npm run build` clean · probe 124/124 · `battery-anim.cjs bot engine prompts`
127/127.** The gate also recorded D106's sixth case on the way: the identical
games ran 411.3 s idle and 760 s (a timeout) under a resident Overwatch — the
same instrument, three wall-clocks, one machine.

⚠️ **Reportables:**
- **A general sacrifice cost is a CHOOSER** — "Sacrifice a creature" needs a
  prompt the activation stage does not have; only self-sacrifice is a price.
- **Computed life costs beyond the one phrase stay unpaid** — each new phrase
  is its own D90-anchored recognition with its own computation.
- **`ctx.random` is still a stub** at the (now single) `ScriptCtx` site.
- **The ~812 def-gated sacrifice-self cards are the next batches' widest
  seam**: each is one `ActivatedDef` away, and the machinery is proven.
- The `payable`/`wasSilent`/`silentBefore` tier3 baselines are PARSE-RELATIVE
  and moved with the classifier — the headline numbers D122 quotes are of
  their parse generation, not constants.

## D160 — M6.4c: the first batch at scale, and the day the zero pins flipped

**1,761 of 31,692 Commander-legal cards now execute completely, up from 1,742.**
Nineteen scripts landed from `select.cjs`'s own 25 — the first batch taken at
the pipeline's word rather than hand-curated — and the six it refused are
NAMED, each with the machinery it waits on: `Agent of Shauku`, `Ahriman` and
`Akki Scrapchomper` (a general "Sacrifice a —" is a CHOOSER the activation
stage does not have; only self-sacrifice is a price, D159), `Akki Ember-Keeper`
(the "modified" predicate — Equipment, YOUR Auras, counters — deserves its own
decision), `Abyssal Horror` (a script raising the discard prompt from a
trigger's resolve is untested ground), and ⚠️⚠️ **`Aliban's Tower` — an
INSTANT, which exposed a selection finding: `select.cjs` hands out SPELLS, and
`CardScript` has no spell seam at all.** A spell executes through the effect
vocabulary or not at all; the classifier's `scriptable` includes
vocabulary-refused spells, so the pipeline can select what the pipeline cannot
land. Either the selection filters spells to the vocabulary's queue, or the
vocabulary work claims them — a decision the next batch should make first.

**Landed, with five firsts in one batch:**
- **The first CAST-watching trigger** — `Talrand, Sky Summoner` fires on
  `SpellCast`, typed off the face actually cast (D155's `obj.faceIndex`), and
  a starter commander the app has shipped since M3 finally does what it says.
- **The first SCRIPT-created tokens** — Talrand's Drake, `Agents of HYDRA`'s
  Villain (a dies-trigger token), `Ambassador Oak`'s Elf Warrior. Each script
  asks `TOKEN_TABLE` — the ONE resolver (D132) — with an import-time guard,
  and each printing is pinned in `WANTED_TOKENS` so the pool holds it and the
  token is REAL rather than D133's blank. Fixtures 144 → 164 (17 cards + 3
  tokens).
- **The first script BOUNCE and activated GRAVEYARD RETURN** — `Aether Adept`
  (to the OWNER's hand, wherever it was controlled) and `Adun Oakenshield`
  (D138's zone + card-type restrictions on an activated target).
- **The first script UNTIL-END-OF-TURN pumps** — `Affa Guard Hound` +0/+3 and
  `Ambush Gigapede` -2/-2 through `PtModifiedUntilEndOfTurn`: layer 7c sums
  them, cleanup ends them, and the state-based action does the killing, none
  of it the def's job.
- **The first script DAMAGE and player-targeted activated** — `Aladdin's Ring`
  builds a `ResolvedDamage` the way `damageTo` does (keywords off the DERIVED
  source, `applyAs` from infect/wither and the target's kind), and `Acolyte of
  Xathrid` is loss of life, deliberately NOT damage (CR 119.3). Plus
  `Alchemist's Apprentice` — a cost that is ONLY the self-sacrifice, no mana,
  no tap.

⚠️⚠️ **TWO ZERO PINS FLIPPED, AND BOTH WERE DESIGNED TO.** `botPool` pinned
"no enchantment, planeswalker or battle is executable at all" as exact zeroes
"because the day one becomes non-zero is a day worth noticing" — **`Ajani's
Welcome` is the first enchantment the engine runs completely**, and the pin now
reads ONE with the other two still zero. And `tier3.test.ts` pinned all four
starter commanders as noted since D122 — **Talrand's note is silent now**,
invariant 9's other direction doing its job.

⚠️ **THE BOT CHANGED ITS OWN COMMANDER.** Regenerating `botDeck.ts` from the
widened pool, the builder dropped `Jasmine Boreal` (GW, reaching 758 cards) for
**`Adun Oakenshield` (BGR, 48 fully-executable legendaries, reaching 976)** —
the machine choosing the commander whose ability it can actually use, with a
37-nonbasic mana base drawn from the landed refuges and karoo-style lands.
Nothing in the builder changed; the pool did.

⚠️ `Yotian Dissident` — the first targeted trigger, proved in testing since
D147 — ships for real, and shipping it forced the TEETH SWAP: it was half of
`shippedScripts.node.test.ts`'s must-fail pair, and a shipped card cannot be
the example of an unshipped one. `Humility` holds the post now — also the card
the fuzz DECK pins as never-dealt, so both teeth point at one name.

**Re-measured, every coverage delta exactly the nineteen:** `complete` 1,742 →
**1,761** · `blocked` 29,931 · `scriptableToday` 1,251 → 1,232 · ladder
[1232, 1331, 3284, 5168, 6355] · botPool creature 1,162 / artifact 35 / land
216 / **enchantment 1** · tier3 `abilityText` 17,442, `payable` 4,820,
`silentAfter` 2,172 · `SHIPPED_SCRIPTS` pinned 12 → 31 · `batch.json`
re-emitted at total 1,232.

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation on the idle machine: `tsc -b` clean · conformance green ·
coverage accounting green over the real database with 31 shipped scripts ·
101 test files, 1,542 Vitest passed / 10 skipped (82 / 1,450 before this
batch) · the 500-seed replay fuzz gate green at 375.1 s — the fastest gate of
the arc, with 41 scripts registered, every landed card dealt, and the
activated-seam canary holding · `npm run build` clean · probe 124/124 ·
`battery-anim.cjs bot engine prompts` **127/127, with the bot playing its NEW
Adun Oakenshield deck** — after the battery's own commander check was fixed to
read the GENERATED deck rather than pin a name: it failed on a deck that was
exactly right, the stale-expectation shape D157's sort post-mortem warns
about, caught by the batch that moved the name.**

⚠️ **Reportables:**
- **The spell-selection gap** (above) — `select.cjs` should stop emitting
  spells, or the vocabulary should claim them; today they are dead weight in
  every batch.
- **A script cannot raise a prompt from `resolve`** — the discard prompt
  (`Abyssal Horror`), and any card whose effect asks a question, needs a
  decision about `AwaitingSet` inside a resolution batch before it is
  attempted.
- The "modified" predicate (one card here, more behind it) is buildable from
  state the engine already carries — attachments with aura-controller checks
  plus counters — and deserves its own entry when built.
- The general-sacrifice CHOOSER remains the largest cost gap (D159).

## D161 — M6.4d: thirteen landed, a validation hole closed, and the selection taught to refuse

**1,774 of 31,692 Commander-legal cards now execute completely, up from
1,761.** Thirteen scripts landed from `select.cjs`'s 25 — and the batch's most
valuable products were the two cards PULLED and what pulling them found.

⚠️⚠️ **A HOST-SIDE VALIDATION HOLE, FOUND BY A NEGATIVE TEST AND CLOSED —
D139's, ONE INTENT OVER.** `Angelic Page`'s test aimed "target attacking or
blocking creature" at a bystander and expected refusal; the engine ACCEPTED.
`ActivateAbility` with INLINE targets skipped target validation entirely — the
prompt-stage path has validated since the targeting work, the inline path went
straight to payment, exactly the shape D139 closed on `CastSpell`. Not
reachable from this app's UI (the aim flow answers the prompt stage), and "the
host decides legality" is what the net layer rests on. Closed with the same
predicate and message the prompt stage uses.

⚠️⚠️ **AND THE FIXED VALIDATION SAID THE BYSTANDER WAS LEGAL — because
"attacking"/"blocking" ARE NOT ENFORCED.** `targetParse` rows file the combat
qualifiers under `unenforced`, which `faceCompleteness` refuses — so `Angelic
Page` and `Anointer of Champions` could never pass the coverage gate however
their scripts read, and the SELECTION had offered them anyway: `primitivesFor`'s
needs column cannot see target-spec refusals, the second selection/gate
mismatch after D160's spells. Both cards were pulled, and **`cardgenSelect`
gained the two filters the drafts paid for**: a non-permanent face outside the
effect vocabulary is not offered (no spell seam), and a card with an unread or
unenforced target clause is not offered (the gate would refuse it). The
OFFERABLE pool is 1,135 where the parsers' `scriptableToday` is 1,219 — the
84-card gap is exactly the dead weight every previous batch re-shuffled.

**Landed, four firsts:**
- **Script DESTROY** (`Angel of Despair`) — and destroy answers to
  indestructible, asked of the DERIVED target exactly as `effects.ts` does;
  the break test is a real card, `Darksteel Myr` surviving the trigger that
  kills a Lion. **Script EXILE** (`Archon of Justice`) — the first trigger
  that both LOOKS BACK and TARGETS (D147 built the halves; this ships the
  combination), and exile ignores indestructible because CR 701.7 is about
  destruction.
- **The opponent-cast trigger** (`Arasta of the Endless Web`) — Talrand's
  mirror, the token to the ability's controller, never the caster.
- **The repeatable token ability** (`Ant Queen`) — no tap in the cost, two
  activations, two real Insects.
- Plus `Anaba Shaman` (creature ping), `Archivist` (`{T}: Draw`), the
  Archaeomancer/Ardent Elementalist graveyard-return twins, `Aquus Steed`
  (-2/-0), three ETB-gain angels and a dies-gain construct.

⚠️ **The ten refusals, named:** D160's six again (the selection gap, now
CLOSED against recurrence) · `Amok` (a random-discard COST — randomness and a
chooser in one part) · `Ancestor's Prophet` and `Aphetto Grifter` (tap-N-
untapped-creatures costs — a chooser) · `Arc-Slogger` (an exile-from-library
cost, a new class for the ledger).

**Re-measured, every coverage delta exactly the thirteen:** `complete` 1,761 →
**1,774** · `blocked` 29,918 · `scriptableToday` 1,219 (with the offerable
pool at 1,135 — two numbers now, and the comment says which is which) · ladder
[1219, 1318, 3271, 5155, 6342] · botPool creature 1,175 · tier3 `abilityText`
17,433, `payable` 4,816, `silentAfter` 2,185 · `botDeck.ts` regenerated (Adun
Oakenshield now reaches 982 cards from 49 executable legendaries) ·
`SHIPPED_SCRIPTS` pinned 31 → 44 · fixtures 181 (the two pulled cards stay
fixtures — real cards, waiting on the combat-qualifier work).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation: `tsc -b` clean · conformance green · coverage accounting
green over the real database with 44 shipped scripts · 114 test files, 1,598
Vitest passed / 10 skipped (101 / 1,542 before this batch) · the 500-seed
replay fuzz gate green at 599.5 s against its 600 s timeout — a pass by half
a second, said plainly: the games grow richer every batch (57 registered
scripts, 13 more DECK cards, and the machine was not fully idle at launch),
and ⚠️ the `collectTriggers` per-oracle source index — a named reportable
since D158 — is now DUE before the next batch lands, built with an idle
60-seed A/B per D106 · `npm run build` clean · probe 124/124 ·
`battery-anim.cjs bot engine prompts` 127/127.**

⚠️ **Reportables:**
- **The `collectTriggers` per-oracle index is DUE** — the gate's own wall
  clock said so at 599.5 of 600 s.
- **Combat-qualifier targeting is the next targeting-layer widening**:
  "attacking"/"blocking" are public combat state, `targetParse` already
  isolates the wordings, and enforcing them (spec field + candidate fields on
  BOTH adapters + `targetAllowed`) returns Angelic Page and Anointer the day
  it lands — plus honest aim veils for every combat-restricted card.
- **The cost-class ledger grows**: tap-N-untapped-creatures and
  exile-from-library join the general-sacrifice chooser (D159) and
  random-discard as named, unbuilt cost machinery.
- D160's spell-seam and script-raised-prompt reportables stand.

## D162 — M6.4e: the collectTriggers index, and thirteen more (2026-08-05)

**What was decided:** land the per-oracle index D158 named and D161 declared
due, prove it byte-identical before trusting it, and then land batch 5 —
thirteen of `select.cjs`'s 25, with the twelve refusals all falling into cost
or prompt classes the ledger already names. **1,787 of 31,692 Commander-legal
cards now execute completely, up from 1,774.**

**The index, and the measured wrong turn.** `collectTriggers` had scanned every
card id per (event × def) since M3 — noise at one script, and D161's 599.5 s
gate pass (against a 600 s timeout) made it due. The A/B protocol was three
legs at 60 seeds on the idle machine, counters compared byte-for-byte:

- **Baseline (the old scan): 71.4 s** — 8,744 accepted intents · 305,864
  events · 2,368 turns · 625 triggered abilities · 248 activated resolved by
  script.
- **The first cut was a REGRESSION: 84.8 s, byte-identical counters.** It
  built `oracleId → InstanceId[]` maps for the after-state AND the before-state
  unconditionally on every call — but most event batches match no def at all,
  so the maps were built and thrown away thousands of times per game. An index
  that is not lazier than the scan it replaces is just a second scan.
- **The lazy fix: 61.5 s, byte-identical counters — 14% under the baseline.**
  Two memos (`??=`), each built the FIRST time a def actually needs that
  side's index; a batch that matches nothing builds nothing. The def loop asks
  `byOracle(look).get(script.oracleId)` and walks only its own card's
  instances; the oracleId equality check fell away because the index implies
  it. Object key order is preserved, so `PendingTrigger` sequences — and every
  replay hash — are bit-identical by construction, and the zero-valley case
  (no registered scripts) still short-circuits before any index exists.

The 500-seed proof is this batch's own gate: **394.4 s with 57 scripts
registered, against 599.5 s with 44** — thirteen more scripts, 205 seconds
faster, where the previous batch passed its 600 s timeout by half a second.

**Batch 5 — thirteen landed, and four firsts:**

- **The first def on a COMBAT event.** `Armasaur Guide` watches
  `AttackersDeclared` and counts the declaration's attackers its controller
  owns (≥3), then targets "creature you control" through D147's trigger
  machinery and writes the counter Yotian's way. The negative is pinned: two
  attackers ask for nothing.
- **The first script to TAP.** `Auriok Transfixer` ("{W}, {T}: Tap target
  artifact") emits `PermanentsTapped` with the mirror of Deserted Temple's
  guard — a target already turned gets no event, asserted on the event both
  ways.
- **The first TARGETED self-sacrifice.** `Ark of Blight` combines D159's
  chargeable "Sacrifice this artifact" with Deserted Temple's targeted
  resolve; the indestructible check is carried by a real card — Darksteel
  Citadel survives, and the Ark stays spent, because a cost is paid whether or
  not the effect lands (CR 601.2, the no-refund rule).
- **The first enters-OR-dies double def.** `Ashen Rider` is one printed line
  and two TriggerDefs — Soul Warden's two-defs-one-line rule pointed at a
  second event kind — the dies half looking back (CR 603.10a) and both halves
  targeting.

The rest of the thirteen ride shipped shapes: `Argothian Enchantress` is
Talrand's cast-watcher asking for enchantment spells (its shroud is a printed
Tier-2 keyword the targeting layer enforces already, D82); `Ashiok's Reaper`
watches OTHER cards' deaths by derived type and controller, looking back so a
wipe that takes the Reaper too still pays out; `Armada Wurm`, `Aspiring
Aeronaut` and `Attended Knight` are Ambassador Oak's ETB token (two new pinned
token fixtures — the trample Wurm `trtr 11`, the colorless Thopter `tafc 12` —
and the Soldier reuses the `t40k 2★` printing the table already names);
`Asgardian Citadel` is Radiant Fountain's gain beside D134's enters-tapped
built-in, and its test asserts BOTH (the land enters tapped AND gains — a card
is complete only if all of it runs); `Aven Battle Priest` gains 3; `Aven
Cloudchaser` destroys a targeted enchantment (indestructible checked — an
enchantment can carry the keyword); `Aven Fogbringer` bounces a targeted land
to its OWNER's hand.

**The twelve refusals, all named classes:** six general-sacrifice costs (Agent
of Shauku, Ahriman, Akki Scrapchomper, Arms Dealer, Army Ants, Aura Fracture —
the chooser D159 named is now SIX cards deep in a single batch of 25, the
widest cost gap by far); Abyssal Horror (a script cannot raise the target
player's discard prompt, D160); Akki Ember-Keeper (the "modified" predicate);
Amok (random-discard cost); Ancestor's Prophet and Aphetto Grifter
(tap-N-untapped-creatures costs); Arc-Slogger (exile-from-library cost). No
NEW refusal class appeared — the ledger absorbed all twelve, which is what
the ledger is for.

**Re-measured, every delta exactly the thirteen cards:** `complete` 1,774 →
1,787 · `blocked` 29,918 → 29,905 · `scriptableToday` 1,219 → 1,206 · ladder
[1206, 1305, 3258, 5142, 6329] · botPool creature 1,175 → 1,186, artifact
35 → 36, land 216 → 217 · tier3 `abilityText` 17,433 → 17,422, `payable`
4,816 → 4,814 (the two ActivatedDefs' charged-note going silent), `silentAfter`
2,185 → 2,198 · `SHIPPED_SCRIPTS` 44 → 57 · fixtures 181 → 196 (11 tokens) ·
`batch.json` re-emitted at 1,122 · `botDeck.ts` regenerated — **Ark of Blight
joined the bot's deck, displacing Dreadbore** (Adun Oakenshield reaches 985
from 982).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation on the idle machine:** `tsc -b` clean · conformance green ·
coverage accounting green over the real database · 127 test files, 1,671
Vitest passed / 10 skipped (114 / 1,598 before) · the 500-seed replay fuzz
gate green at 394.4 s · `npm run build` clean · probe 124/124 ·
`battery-anim.cjs bot engine prompts` 127/127.

**Checked by breaking it, in the suite:** the eager-index regression is
recorded above rather than repeated; Armasaur's two-attacker negative,
Auriok's already-tapped no-event, Darksteel Citadel's survival with the Ark
still spent, the Reaper's three negatives (opponent's enchantment, own
creature, each its own test) and Enchantress's creature-spell negative are all
permanent tests. All 34 new per-card tests passed on their first run.

**Reportables (D162):**

- **The general-sacrifice cost chooser is now the single largest unlock in
  sight** — six refusals in THIS batch alone, ~an eighth of every batch since
  D159 named it. It is a prompt (choose which land/Goblin/artifact to feed),
  which means an `Awaiting` raised from cost payment — D137's hidden-zone
  rules do not apply (the battlefield is public), so it is cheaper than it
  looks.
- The rest of the cost-class ledger stands: random-discard (Amok — also
  blocked on `ctx.random`, still a stub), tap-N-untapped-creatures
  (Ancestor's Prophet, Aphetto Grifter), exile-from-library (Arc-Slogger).
- D160's spell-seam and script-raised-prompt items stand (Abyssal Horror
  waits on the second).
- The "modified" predicate (Akki Ember-Keeper) — needs equipment/aura/counter
  state the engine HAS, composed into one derived question.

## D163 — M6.4f: the REFUSED ledger, and nine more (2026-08-05)

**What was decided:** stop paying the re-classification tax the selection had
been charging every batch, then land batch 6 — nine of `select.cjs`'s 25.
**1,796 of 31,692 Commander-legal cards now execute completely, up from
1,787.**

**TWELVE OF THE 25 SLOTS WERE D162's REFUSALS RE-OFFERED, VERBATIM.** The
selection's two D161 filters are PARSE questions (spells; unenforced target
clauses); a cost-class refusal is a DRAFTER's verdict — "the machinery to
charge this cost does not exist" — and no parser row records it, so every
refused card rotated straight back into the next batch. Half a batch of
re-reading per batch, growing as the ledger grows.

**The fix is the third selection filter, and unlike the two parse filters it
is a NAMED LEDGER**: `REFUSED` in `cardgenSelect.node.test.ts`, name → class,
one entry per card a drafter held and refused. Sixteen entries as of this
batch: six `sacrifice-cost chooser`, three `tap-creatures cost`, and one each
of `script-raised prompt`, `modified predicate`, `random-discard cost`,
`exile-from-library cost`, `once-per-turn trigger memory`, `per-damage-entry
trigger granularity`, `discard-cost chooser`.

⚠️ **SELF-CORRECTING BY CONSTRUCTION, because a name-list beside a live
codebase rots.** `select()` checks every REFUSED card's `engineCompleteness`
during its scan and records any that now run completely; a test fails naming
them. So the day a class is BUILT and its cards land, the stale entries
cannot survive the suite — the ledger can only ever under-offer cards that
are genuinely still blocked, never hide ones that stopped being. The class
strings exist so that day is findable with grep. Offerable pool 1,122 →
**1,097** — 9 landed, 16 refused, exact.

**Batch 6 — nine landed, four firsts:**

- **The first HYBRID activation cost a shipped def charges.** `Azorius
  Locket` ("{W/U}{W/U}{W/U}{W/U}, {T}, Sacrifice this artifact: Draw two
  cards") — the cost rides the same payment problem a hybrid CASTING cost
  has ridden since M3, the parse is pinned payable + sacrificesSelf, and the
  test pays all four pips in white alone, which is the hybrid's whole point.
- **D139's numeric restriction exercised on the ACTIVATED path.** `Aysen
  Bureaucrats` ("{T}: Tap target creature with power 2 or less") taps a 2/2
  and is REFUSED at activation against a 5/5 — the derived-power check
  running through `ActivateAbility`'s inline validation (the hole D161
  closed), asserted from both sides.
- **The first repeatable no-tap draw on a creature.** `Azure Mage`
  ("{3}{U}: Draw a card") goes twice in one turn — no {T} in the cost means
  no summoning-sickness gate and no once-per-turn anything, which the test
  proves by doing it.
- **The -1/-1 twin of the ETB counter.** `Baleful Ammit` writes the OTHER
  counter kind `derive` sums at layer 7d, with "creature you control"
  enforced — the test pins an opponent's creature being refused at
  `ChooseTargets`.

The rest are twins of batch-5 shapes: `Aven of Enduring Hope` (Battle
Priest's gain), `Avengers Hangar` (Asgardian Citadel's gain-beside-D134's-tap,
both halves asserted again), `Aviation Pioneer` (Aspiring Aeronaut's
colorless Thopter — the SAME table entry and fixture, so this batch pinned
ZERO new tokens), `Azorius Cluestone` (Hedron's sacrifice-draw), `Backup
Agent` (the +1/+1 ETB, unrestricted).

⚠️ **One test bug caught by its own first run:** the Locket's draw counter
counted EVENTS, and "draw two" arrives as ONE `CardsMoved` of two moves — it
read 1 where two cards had genuinely arrived. It counts MOVES now. The same
helper in the single-draw tests is correct either way, which is exactly how a
counting bug survives until a two-of-something card meets it.

**The four fresh refusals — two of them NEW classes:**

- **`Axgard Artisan` — once-per-turn trigger memory.** "Whenever one or more
  +1/+1 counters are put on this creature FOR THE FIRST TIME EACH TURN" needs
  per-turn per-card trigger state the engine does not hold anywhere; a def
  cannot remember it fired.
- **`Aya of Alexandria` — per-damage-entry trigger granularity.**
  `CombatDamageDealt` batches EVERY creature's damage into one event
  (`damages: ResolvedDamage[]`), and the trigger bus fires once per EVENT —
  so "whenever a historic creature you control deals combat damage to a
  player" would under-fire whenever two historic attackers connect in the
  same substep: one token where the card makes two. This is Soul Warden's
  granularity warning ("a future event that batched several entries would
  under-fire this trigger") met in the wild — combat damage has been batched
  since M3, and the bus needs per-entry firing before any per-creature damage
  trigger can ship.
- `Ayula's Influence` — a discard-a-card-AS-COST chooser, the hand-side
  sibling of the sacrifice chooser (a cost prompt over a HIDDEN zone, so
  D137's no-card-ids rule applies where the sacrifice chooser's public-zone
  prompt does not).
- `Azami, Lady of Scrolls` — tap-an-untapped-Wizard cost, the existing
  tap-creatures class at N=1.

**Re-measured, every delta exactly the nine cards:** `complete` 1,787 →
1,796 · `blocked` 29,905 → 29,896 · `scriptableToday` 1,206 → 1,197 · ladder
[1197, 1296, 3249, 5133, 6320] · botPool creature 1,186 → 1,192, artifact
36 → 38, land 217 → 218 · tier3 `abilityText` 17,422 → 17,417, `payable`
4,814 → 4,810, `silentAfter` 2,198 → 2,207 · `SHIPPED_SCRIPTS` 57 → 66 ·
fixtures 196 → 205 (tokens still 11) · `botDeck.ts` regenerated (Adun
reaches 986).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation on the idle machine:** `tsc -b` clean · conformance green ·
coverage accounting green over the real database · 136 test files, 1,720
Vitest passed / 10 skipped (127 / 1,671 before) · the 500-seed replay fuzz
gate green at 404.5 s (66 scripts registered — ten seconds over D162's 394.4
with nine more scripts, exactly the index scaling as designed) ·
`npm run build` clean · probe 124/124 · `battery-anim.cjs bot engine
prompts` 127/127.

**Checked by breaking it, in the suite:** the Bureaucrats' 5/5 refusal and
the Ammit's wrong-controller refusal are permanent negative tests; the
Locket's parse pin holds the hybrid question; the REFUSED guard's teeth are
structural (a stale entry fails by name — the mechanism was exercised by
design review rather than by a plant, since no class has been built since the
ledger was written this session).

**Reportables (D163):**

- **The general-sacrifice chooser now holds SIX ledger entries** and remains
  the largest unlock in sight (D162). The ledger makes its value precise:
  build it, and six cards land plus the ledger's guard forces their entries
  out.
- **The REFUSED ledger is a NAMED list, and additions are manual** — a
  drafter who refuses a card must enter it, or the next batch re-offers that
  card once more. The guard prevents staleness in one direction only
  (entries outliving their gap); nothing detects a refusal that was never
  entered except the batch that re-reads it.
- Once-per-turn trigger memory and per-damage-entry bus granularity join the
  engine-work list; the discard-cost chooser joins the cost ledger beside
  random-discard, tap-creatures and exile-from-library.
- D160's spell seam and script-raised prompts stand.

## D164 — M6.4g: nineteen landed, and the allocator that handed out one id (2026-08-05)

**What was decided:** land batch 7 — nineteen of `select.cjs`'s 25, the
biggest batch of the arc — and fix the script-API defect it flushed out.
**1,815 of 31,692 Commander-legal cards now execute completely, up from
1,796.**

⚠️⚠️ **`ctx.ids.nextInstance` WAS A PURE READ, AND TWO TOKENS IN ONE RESOLVE
GOT ONE ID.** All three `ScriptCtx` construction sites defined it as
`` () => `c${state.counters.instance + 1}` `` — a read of the UNAPPLIED
state, so every call in a single `resolve` returned the same id. The second
`TokenCreated` then OVERWROTE the first card in the reducer while
`addToZone` appended the id a second time — one real token, and a duplicated
zone entry, in the same state.

⚠️ **THE TWO TESTS READ THE SAME CORRUPTION DIFFERENTLY, AND ONE OF THEM
PASSED.** `Beetleback Chief`'s count-only assertion saw the duplicated
battlefield entry as "2 Goblins" and went green over a board with one
overwritten token on it twice; `Blaze Commando`'s read 1 Soldier and failed,
which is the only reason anything was found. Instrumenting the log settled
it in one run: `tokenEvents: ['c63', 'c63']`. A counting assertion cannot
tell two things from one thing twice — **both tests now assert the DISTINCT
id set** (`new Set(ids).size`), which is the regression's permanent teeth.

⚠️ **THE VOCABULARY PATH ALWAYS KNEW.** `effects.ts`'s `createToken` has
kept its own advancing counter since D133, under a comment reading "one
allocator for every instance this resolution creates" — the effect engine
allocates correctly and the script API beside it never got the same care,
because no script before this batch ever created two instances in one
resolve. The fix is that same allocator, moved into the ctx: per-ctx
advancing closures at all three sites (`loop.ts`'s resolution ctx,
`triggers.ts`'s matches ctx, `derive.ts`'s static ctx). **The first call is
byte-identical to the old read**, so every shipped single-allocation script
replays unchanged — the 500-seed gate's equal hashes are the proof at scale.

**Batch 7 — nineteen landed, five firsts:**

- **The first def watching from the HAND.** `Bartered Cow` ("when this
  creature dies AND when you discard this card") is one printed line and two
  zone-changes: Beskir's dies half, plus `activeZones: ['hand']` with
  `looksBack` — CR 603.10a's mechanism one zone over, since a discarded card
  has already left the hand when the bus runs. The fuzz gate's cleanup
  discards exercise it for free.
- **The first combat-damage trigger — safe where Aya of Alexandria is
  not.** `Belligerent Guest` watches only ITSELF: one creature attacks one
  defender, so its player-damage is at most one entry per
  `CombatDamageDealt`, and per-event firing IS per-instance firing. D163's
  granularity refusal stands for per-creature watchers; the self-only shape
  ships.
- **The first spell-damage watcher.** `Blaze Commando` matches `DamageDealt`
  entries whose source is its controller's instant or sorcery — and that
  event fires once per resolving object however many targets it burned,
  which is exactly the card's own "once per spell".
- **The first PHYREXIAN activation cost.** `Blinding Souleater`'s {W/P}
  rides the payment problem that has modelled phyrexian halves since M3; the
  parse is pinned payable and the test pays it in white.
- **The first multi-token resolves** — `Beetleback Chief` and `Blaze
  Commando`, the pair that found the allocator.

The rest ride shipped shapes: `Barbarian Riftcutter` (Ark of Blight's
targeted self-sacrifice, Darksteel Citadel break test included), `Bile
Urchin` (a MANA-FREE self-sacrifice draining a targeted player — no {T}, so
no sickness gate), `Beast Whisperer` (the cast-watcher asking for
creatures), `Bear's Companion` / `Beskir Shieldmate` / `Beamsaw Prospector`
(ETB/dies tokens — a 4/4 Bear, a Human Warrior, a Lander), `Benalish
Heralds` (tap-draw), `Benalish Trapper` and `Blinding Mage` (the SAME
printed tap-a-creature text on two oracle ids, each proven on its own),
`Bigfin Bouncer` (the bounce with "an opponent controls" enforced — your own
creature refused at ChooseTargets, pinned), `Birnin Zana Plaza` (the third
enters-tapped gain land), `Birthing Boughs` (an activated token maker on an
artifact — no sickness wait), `Blighted Cataract` / `Azorius`-style
sacrifice-draw on a land, and `Blister Beetle` (a targeted ETB writing the
layer-7c until-end-of-turn debuff, cleanup taking it back — asserted).

**The six refusals, all IN THE LEDGER now:** `Barrage of Expendables`,
`Barrage Ogre`, `Barrin, Master Wizard`, `Blazing Hellhound` (four more
sacrifice-cost choosers — the class holds TEN entries), `Bearscape`
(exile-from-graveyard cost — a NEW class: a chooser over a public zone,
sibling to the sacrifice chooser), `Black Cat` (a random EFFECT — target
opponent discards at random — while `ctx.random` is a stub, D158's
reportable now BLOCKING a named card).

⚠️ One test trimmed honestly: Bartered Cow's library-staging negative was
dropped because the harness's `put()` stages hand/battlefield/graveyard/
exile/command and not the library — the two watched zones are positively
proven and the zone gate is `collectTriggers`' own machinery.

**Re-measured, every delta exactly the nineteen cards:** `complete` 1,796 →
1,815 · `blocked` 29,896 → 29,877 · `scriptableToday` 1,197 → 1,178 · ladder
[1178, 1277, 3230, 5114, 6301] · botPool creature 1,192 → 1,208, artifact
38 → 39, land 218 → 220 · tier3 `abilityText` 17,417 → 17,406, `payable`
4,802, `silentAfter` 2,207 → 2,226 · `SHIPPED_SCRIPTS` 66 → 85 · fixtures
205 → 232 (19 tokens — EIGHT new printings pinned: the 4/4 Bear `ttla 12`,
Blood `tbig 2`, Food `tunf 10`, Goblin `l12 1`, Human Warrior `tkhm 3`,
Lander `teoe 6`, the colorless Shapeshifter `tmh1 1`, the RW haste Soldier
`tonc 17`) · `batch.json` at 1,072 (19 landed + 6 refused off 1,097, exact)
· `botDeck.ts` regenerated — **Birthing Boughs joined, Darksteel Ingot
out** (Adun reaches 994).

⚠️⚠️ **THE FIRST FULL-GATE RUN FAILED, AND THE FAILURE WAS A RATE CANARY
ROTTING ON SCHEDULE.** Every replay hash was equal and five of the six fuzz
tests were green; what failed was D149's CR 616 canary —
`replacementChoices > 0` at 500 seeds — at ZERO. That suspension needs
`Hardened Scales` and `Branching Evolution` on one battlefield plus a
counter event, measured at 5-per-500 when the fuzz DECK held ~60 names and
the pair sat in every 60-card library; four batches of growth diluted the
pair out of the libraries, and the canary's own comment had said the
counter "will start moving the day this deck changes". **Re-weighted to
FIVE copies of each** — presence and draw odds both restored, the expected
rate an order of magnitude above the assertion's floor instead of a Poisson
coin flip at it. The run also recorded how much the batch changed the
GAMES: target prompts went ~3,000 → 39,866 (nineteen targeted defs the
fuzzer now answers constantly) and accepted intents fell ~30% to 58,626,
because prompts consume them — no gate asserts either number, but the next
rate canary should be read against this shape, not D149's.

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation on the idle machine:** `tsc -b` clean · conformance green ·
coverage accounting green over the real database · 155 test files, 1,818
Vitest passed / 10 skipped (136 / 1,720 before) · the 500-seed replay fuzz
gate green at 510.6 s (85 scripts registered; the wall grew with the 13×
target-prompt load, still 90 s inside the timeout) — **and the equal replay
hashes are the allocator fix's at-scale proof** · `npm run build` clean ·
probe 124/124 · `battery-anim.cjs bot engine prompts` 127/127.

**Checked by breaking it, in the suite:** the distinct-id set assertions in
both multi-token tests fail against the old allocator by construction (they
were born failing against it); Riftcutter's Darksteel Citadel survival,
Bigfin's own-creature refusal, Bartered Cow's two zone paths, Blister
Beetle's cleanup-removes-it and Beast Whisperer's enchantment negative are
permanent tests.

**Reportables (D164):**

- **The sacrifice-cost chooser now holds TEN ledger entries** — four more in
  one batch. Every batch since D159 has paid it; it is overdue.
- **`ctx.random` is no longer an abstract stub — it BLOCKS a ledger entry**
  (Black Cat). Wiring it to the seeded generator through the recorded
  `rngAfter` (D147's `effectResult` precedent) is bounded work with a named
  payoff.
- Exile-from-graveyard joins the cost ledger beside discard-cost, tap-N,
  random-discard and exile-from-library.
- Once-per-turn trigger memory and per-damage-entry bus granularity stand
  (D163).

## D165 — M6.4h: twenty-two landed, the cleanest batch yet (2026-08-05)

**What was decided:** land batch 8 — twenty-two of `select.cjs`'s 25, the
largest and cleanest batch of the arc. **1,837 of 31,692 Commander-legal
cards now execute completely, up from 1,815**, and `SHIPPED_SCRIPTS` passed
one hundred (85 → 107).

**Only THREE refusals, and the ratio is the ledger working.** The D161 parse
filters and the D163 REFUSED ledger have drained the un-landable shapes out
of the offer stream batch by batch; what reaches a batch now is
overwhelmingly machinery the arc has already built. The three: `Blood Rites`
and `Bog Naughty` (sacrifice-cost choosers — **the class holds TWELVE
entries**), and `Bolrac-Clan Crusher` (a NEW class: remove-a-+1/+1-counter
as a COST, a chooser over counter state nothing charges).

**Batch 8 — twenty-two landed, five firsts:**

- **The first ATTACHMENT trigger.** `Bramble Elemental` watches
  `AttachmentChanged` — an event only the Tier-3 attach tool raises today
  (D96) — for an Aura landing on ITSELF, and makes two DISTINCT Saprolings
  through D164's advancing allocator. The negative is pinned: an Aura
  attached to a bystander makes nothing. The fuzzer's `ManualAttach`
  intents exercise the def at scale.
- **The first FIXED life activation cost.** `Book of Rass` ("{2}, Pay 2
  life: Draw a card") — `parseWardLife` set the payable-life precedent in
  M5 and the payment problem has carried a life component since; the test
  pays it TWICE in one turn (no {T}) and watches the life fall 40 → 38 → 36.
- **The first enters-OR-LEAVES double def.** `Brandywine Farmer` pays on
  ANY departure — the test bounces it to HAND, proving the leaves half is
  broader than a dies trigger — with the leave half looking back (CR
  603.10a).
- **The first SELF-INCLUSIVE controlled-creature watcher.** `Bogwater
  Lumaret` ("this creature or another creature you control") deliberately
  omits the `m.card !== self` exclusion every Soul-Warden-shaped def
  carries: its own entry gains the first life. Its opponent-entry negative
  is pinned beside it, as is `Boltwing Marauder`'s — the same shape WITH
  the exclusion and a pump target.
- **The first SUBTYPE-filtered cast-watcher.** `Briarknit Kami` asks the
  cast face's subtypes (Spirit or Arcane) where Talrand and the
  enchantress/whisperer pair ask card types; `Bile Urchin` doubles as the
  fixture pool's cheapest Spirit spell.

One integration proof worth naming: `Bloodtallow Candle`'s -5/-5 kills a
2/2 THROUGH THE STATE-BASED ACTION — the def writes only the layer-7c
modifier and the SBA does the binning, which is exactly the division of
labour D160's pumps promised. The rest ride shipped shapes: two more
Cluestone/Locket pairs (`Boros`), two three-line sacrifice-draw LANDS
(`Boiling Rock Prison`, `Botanical Plaza` — enters-tapped and the mana line
are the engine's, the def owes line three as ability 1), `Blossom Dryad`
(Deserted Temple's untap on a creature), `Bottle Gnomes` and `Brass
Secretary` (self-sacrifice gain/draw), `Braidwood Cup` ({T}: gain 1),
`Bogardan Rager` / `Bone Pit Brute` (targeted ETB +4/+0 pumps), `Bond
Beetle` (Backup Agent's twin), `Blood Servitor` / `Brazen Freebooter`
(Blood and Treasure ETB tokens on already-pinned printings), and two more
enters-tapped gain lands.

**Re-measured, every delta exactly the twenty-two cards:** `complete`
1,815 → 1,837 · `blocked` 29,877 → 29,855 · `scriptableToday` 1,178 → 1,156
· ladder [1156, 1255, 3208, 5092, 6279] · botPool creature 1,208 → 1,221,
artifact 39 → 44, land 220 → 224 · tier3 `abilityText` 17,406 → 17,394,
`payable` 4,792, `silentAfter` 2,226 → 2,248 · `SHIPPED_SCRIPTS` 85 → 107 ·
fixtures 232 → 255 (20 tokens — ONE new pin, the Saproling `tddj 1`) ·
`batch.json` at 1,047 (22 landed + 3 refused off 1,072, exact) ·
`botDeck.ts` regenerated — **five batch-8 cards joined** (Bloodfell Caves,
Bloodtallow Candle, Boiling Rock Prison, Book of Rass, Braidwood Cup; Adun
reaches 1,012).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES
PASSED in one invocation on the idle machine** (Overwatch was resident at
load 85 when the gates were staged — D106's named interferer — and the run
waited for the user to close it): `tsc -b` clean · conformance green ·
coverage accounting green over the real database · 177 test files, 1,932
Vitest passed / 10 skipped (155 / 1,818 before) · the 500-seed replay fuzz
gate green at 471.5 s (107 scripts registered) · `npm run build` clean ·
probe 124/124 · `battery-anim.cjs bot engine prompts` 127/127.

**Checked by breaking it, in the suite:** Bramble's attached-elsewhere
negative and distinct-id set; Lumaret's opponent negative beside Boltwing's
(the shape with and without self, each pinned from both sides); Briarknit's
non-Spirit negative; the Candle's SBA kill; the Farmer's bounce-not-dies
leave; Book of Rass's double activation with the life genuinely falling.
All 48 new per-card tests passed on their first run.

**Reportables (D165):**

- **The sacrifice-cost chooser holds TWELVE of the ledger's 26 entries.**
  Every batch since D159 has added to it; it remains the single largest
  unlock and the arc's most overdue engine work.
- Remove-counter cost joins the cost ledger (Bolrac-Clan Crusher).
- D164's items stand: `ctx.random` wiring (blocks Black Cat),
  exile-from-graveyard, once-per-turn memory, per-damage-entry granularity.

## D166 — M6.4i: twenty-one landed, and two lessons the tests taught (2026-08-05)

**What was decided:** land batch 9 — twenty-one of `select.cjs`'s 25.
**1,858 of 31,692 Commander-legal cards now execute completely, up from
1,837.** `SHIPPED_SCRIPTS` 107 → 128.

**Four refusals, ONE new class:** `Brittle Effigy` ("Exile this artifact" as
a cost) is an **exile-SELF cost** — named CHEAP in the ledger, because it is
D159's `sacrificesSelf` machinery one event over: the same recognition, the
same offer gate, a `CardsMoved` to exile instead of a graveyard. The other
three are ledger regulars: `Cabal Surgeon` (exile-from-graveyard), `Carnage
Altar` (the sacrifice-cost chooser's THIRTEENTH entry), `Catapult Master`
(tap-creatures).

**Batch 9 — twenty-one landed, three firsts:**

- **The first SELF-attack triggers.** `Burrenton Shield-Bearers` ("whenever
  this creature attacks, target creature gets +0/+3") and `Cat-Owl`
  ("…untap target artifact or creature") watch `AttackersDeclared` with an
  is-it-me filter — Armasaur's event scoped to one attacker, which is the
  granularity-safe shape (one self, one entry). Cat-Owl's test is the
  pretty one: it attacks, targets ITSELF, and straightens mid-combat — the
  attack's own tap undone by the trigger it caused.
- **D135's conditional entry proven BOTH ways by a shipped script's test.**
  `Castle Ardenvale` enters TAPPED with no Plains and UNTAPPED with one —
  the first script whose card carries an "enters tapped unless" line, so
  the first per-card test that pins the condition's two answers. Its
  activated line is also **the first token maker on a LAND** (a1 after the
  mana line, a 1/1 Human).
- **The pool's SECOND enchantment.** `Captive Flame` (a repeatable
  activated pump) joins `Ajani's Welcome` — the D160 zero-pin that became
  one now reads TWO, with its comment carrying both names.

The other eighteen ride shipped shapes: three self-sacrifice destroys
(`Capashen Unicorn`, `Cathar Commando`, `Caustic Caterpillar` — the
"artifact or enchantment" two-kind target, an indestructible negative on
the Unicorn), two flash ETB debuffs against opponent creatures
(`Brinebarrow Intruder`, `Burrog Befuddler`), two ETB pumps (`Briarpack
Alpha`, `Bone Pit Brute`), dies-tokens (`Brindle Shoat`'s Boar, `Brood
Weaver`'s Spider), ETB tokens (`Broodmate Dragon`'s 4/4, `Cartographer's
Companion`'s Map), a dies-draw (`Buzz Bots`), an ETB draw (`Carven
Caryatid` — Wall of Omens's shape from the arc's first batch), ETB gains
(`Bulwark Giant`'s 5, `Cathedral Sanctifier`'s 3), a mana-free self-sac
gain (`Brindle Boar`) and drain (`Bile Urchin`'s twin `Cackling Imp`, on a
tap), a self-sac targeted debuff (`Cabal Trainee`), and a creature-body
untap (`Blossom Dryad`).

⚠️⚠️ **TWO LESSONS THE TESTS TAUGHT, one of them a genuine footgun:**

- **`g.state.cards[enterCastle(g)]` reads the state BEFORE the call.**
  JavaScript evaluates the member chain ahead of the bracketed expression,
  and this engine's state is IMMUTABLE — so the index went into the
  PRE-entry cards map, where nothing is tapped, and D135's rule looked
  broken while working perfectly. A probe with the same steps in separate
  statements proved the engine right in one run. The fix is a hoisted
  variable and a comment; the lesson is that an immutable-state engine
  turns this classic evaluation-order trap into a silent time-travel read.
- **An unattached Aura is not offered as a generic enchantment target.**
  `Pacifism` placed on the battlefield by a Tier-3 move was REFUSED as a
  target for "target artifact or enchantment" (illegalTarget) while a plain
  enchantment passes — recorded as a reportable below, because an Aura on
  the battlefield IS an enchantment and a generic enchantment target
  should reach it.

**Re-measured, every delta exactly the twenty-one cards:** `complete`
1,837 → 1,858 · `blocked` 29,855 → 29,834 · `scriptableToday` 1,156 → 1,135
· ladder [1135, 1234, 3187, 5071, 6258] · botPool creature 1,221 → 1,240,
enchantment 1 → 2, land 224 → 225 · tier3 `abilityText` 17,394 → 17,381,
`payable` 4,784, `silentAfter` 2,248 → 2,269 · fixtures 255 → 280 (24
tokens — FOUR new pins: the 3/3 Boar `tpca 14`, the 4/4 Dragon `tmm3 7`,
the 1/1 Human `tfdn 3`, the Map `tbig 7`) · `batch.json` at 1,022 (21
landed + 4 refused off 1,047, exact) · `botDeck.ts` regenerated (Captive
Flame joins; Adun reaches 1,023).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES
PASSED in one invocation on the idle machine:** `tsc -b` clean ·
conformance green · coverage accounting green over the real database ·
198 test files, 2,039 Vitest passed / 10 skipped (177 / 1,932 before) · the
500-seed replay fuzz gate green at 568.2 s (128 scripts registered — ⚠️ 32 s
of margin left on the 600 s timeout; the wall grows with the script count,
and a second index-scale optimization is approaching DUE the way D161 made
the first one due) · `npm run build` clean · probe 124/124 ·
`battery-anim.cjs bot engine prompts` 127/127.

**Checked by breaking it, in the suite:** Castle's condition pinned from
BOTH sides in one test; the Unicorn's indestructible survival with the
cost staying paid; Brinebarrow's own-creature refusal; Boltwing's
opponent-entry negative beside Lumaret's (D165's pair, one batch on);
Briarknit-style negatives on the debuff twins.

**Reportables (D166):**

- **The exile-self cost is the cheapest ledger entry ever named** —
  `sacrificesSelf` one event over. Building it clears Brittle Effigy and
  its class in an afternoon.
- **The unattached-Aura targeting question:** the candidates layer refuses
  an Aura for a generic "target enchantment" clause. If that is a kind-
  classification quirk rather than a rule, ~every Aura is invisible to
  enchantment removal the engine runs — worth one look in the next
  targeting pass.
- The sacrifice-cost chooser holds THIRTEEN of the ledger's 30 entries.
- D164/D165's items stand (`ctx.random`, exile-from-graveyard,
  once-per-turn memory, per-damage-entry granularity, remove-counter).

## D167 — M6.4j: twenty landed, and the first upkeep trigger ships (2026-08-06)

**What was decided:** land batch 10 — twenty of `select.cjs`'s 25, the first
batch under the STANDING continuation ("keep batches coming until I say
stop"). **1,878 of 31,692 Commander-legal cards now execute completely, up
from 1,858.** `SHIPPED_SCRIPTS` 128 → 148, and the offerable pool broke
under a thousand (997).

**Five refusals, all named:** two sacrifice-cost choosers (`Cephalid
Scout`, `Claws of Gix` — the class holds FIFTEEN entries), a discard-cost
chooser (`Charging Strifeknight`), a once-per-turn memory (`Clarion
Spirit` — "your second spell each turn" is Axgard's gap one count over),
and `Clock of Omens` (tap-two-untapped-ARTIFACTS — entered as a
tap-permanents cost, the tap-creatures chooser's artifact sibling).

**Batch 10 — twenty landed, two firsts and a third enchantment:**

- **The first SHIPPED upkeep trigger.** `Celestial Force` ("at the
  beginning of EACH upkeep, you gain 3 life") rides `StepBegan`/'upkeep'
  with NO active-player filter — the test registry's Ajani's Mantra has
  carried the "your upkeep" variant since D128, and this is the shape's
  first appearance in `SHIPPED_SCRIPTS`. The test walks two full turns and
  watches the life climb on the OPPONENT's upkeep too.
- **The first targeted ETB TAP.** `Chrome Prowler` aims the Transfixer's
  tap through the trigger machinery at an opponent's creature, with the
  own-creature refusal pinned.
- **The pool's THIRD enchantment.** `Centaur Glade` (a repeatable activated
  token maker) joins `Ajani's Welcome` and `Captive Flame`; the D160
  zero-pin now reads three, all names in its comment.

The other seventeen ride shipped shapes: a FREE self-sacrifice draw
(`Commander's Sphere` — no mana, no tap, the identity-scoped mana line
being the engine's since D110), a leaves-only Food (`City Pigeon` —
Brandywine's broader half alone), a dies multi-token with the distinct-id
teeth (`Conclave Cavalier`'s two Elf Knights), a tap-ping through
Aladdin's Ring's damage shape (`Chandra's Magmutt`), a self-sacrifice
token (`Centaur's Herald`) and pump (`Child of Thorns`), three tap-target
activateds (`Checkpoint Officer`, `Clockwork Drawbridge`, and the Prowler
above), ETB tokens (`Chimney Rabble`'s Phyrexian Goblin, `Clarion
Cathars`' Human, `Common Crook`'s dies-Treasure, `Conscripted Infantry`'s
artifact Soldier — FOUR new printings pinned: Centaur `trvr 10`, Elf
Knight `trvr 15`, Phyrexian Goblin `tfdn 31`, artifact Soldier `totc 26`),
ETB gains (`Centaur Healer`, `Centaur Nurturer` beside its engine-run
any-color line), an ETB draw (`Cloudkin Seer`), an ETB enchantment destroy
(`Cloudchaser Eagle` — Aven Cloudchaser's twin, name and all), and a flash
ETB debuff (`Cogwork Wrestler`).

**Re-measured, every delta exactly the twenty cards:** `complete` 1,858 →
1,878 · `blocked` 29,834 → 29,814 · `scriptableToday` 1,135 → 1,115 ·
ladder [1115, 1214, 3167, 5051, 6238] · botPool creature 1,240 → 1,258,
artifact 44 → 45, enchantment 2 → 3 · tier3 `abilityText` 17,381 → 17,368,
`payable` 4,777, `silentAfter` 2,269 → 2,289 · fixtures 280 → 304 (28
tokens) · `batch.json` at 997 (20 landed + 5 refused off 1,022, exact) ·
`botDeck.ts` regenerated (Centaur Glade joins; Adun reaches 1,032).

⚠️⚠️ **THE FIRST GATE RUN HIT D166's PREDICTED WALL — the fuzz TIMED OUT at
its 600 s ceiling** (unit suite, conformance and accounting all green; the
machine idle at load 26). The second bus pass went in on the spot — the
eager per-call constructions (`Object.keys`, both ctxs, both derive caches)
made lazy, D162's regression lesson one object over, plus a per-kind
present-def memo that skips defs whose card is in nobody's deck — **and it
measured ~2% (73.5 → 72.2 s at 60 seeds), which is the honest finding: the
bus is no longer the wall. The cost is the GAMES** — richer boards firing
more triggers is the arc succeeding, at roughly +40–60 s per 20 scripts.
The gate's timeout is therefore raised ONCE to 900 s with the history in
its comment (a hang catcher, not a perf referee — D133's rule), and
self-only def dispatch is the named next lever if the wall approaches the
new ceiling.

**Verified on the re-run: `node scripts/cardgen/verify.cjs --full` — ALL
FIVE GATES PASSED in one invocation on the idle machine:** `tsc -b` clean ·
conformance green · coverage accounting green over the real database · 218
test files, 2,139 Vitest passed / 10 skipped (198 / 2,039 before) · the
500-seed replay fuzz gate green at 589.6 s (148 scripts registered, 310 s
inside the new ceiling) · `npm run build` clean · probe 124/124 ·
`battery-anim.cjs bot engine prompts` 127/127.

**Reportables (D167):**

- The sacrifice-cost chooser holds FIFTEEN of the ledger's 35 entries —
  COMMISSIONED: D168 builds it before batch 11.
- The fuzz wall history now lives in the gate's own timeout comment;
  self-only def dispatch is the named next lever if it approaches 900 s.
- Prior items stand (exile-self cost, `ctx.random`, the unattached-Aura
  targeting question, once-per-turn memory, per-damage-entry granularity).

## D168 — M6.4k: the sacrifice-cost chooser, and the panel that made every ability clickable

**1,881 of 31,692 Commander-legal cards now execute completely, up from 1,878.**
The commissioned engine work between batches 10 and 11: "Sacrifice a
<predicate>" as an activation cost is now a CHOICE the activation carries —
`ActivateAbility.sacrifice` names the permanent — and the REFUSED ledger's
largest class (FIFTEEN entries at its peak) is deleted, its cards back in the
offer stream. Three of them are the proof: `Carnage Altar` ("{3}, Sacrifice a
creature: Draw a card."), `Claws of Gix` ("{1}, Sacrifice a permanent: You
gain 1 life.") and `Ahriman` ("{3}, Sacrifice another creature or artifact:
Draw a card.").

**The pipeline, end to end, one grammar:**
- **Parse** (`activatedParse.ts`): `Sacrifice (a|an|another) <rest>`, anchored
  both ends. "a permanent" is the empty predicate — every `.every` over empty
  arrays holds, which is exactly what the word means. Anything else goes
  through `predicatesOf` — `replacementParse`'s OWN splitter, exported rather
  than re-implemented (the Command Tower rule, again): "creature or artifact"
  is one predicate per OR arm, and a phrase it cannot read stays in
  `unpaidCosts`, so "Sacrifice a creature with power 4" is REFUSED rather than
  widened. `ActivatedAbility.sacrificeCost = { another, any } | null`.
- **Offer** (`legal.ts`): the def gate first — eating a permanent for nothing
  is not D122's disclosed status quo — then `sacrificeCandidatesFor`: the
  activator's battlefield, DERIVED characteristics (an animated land really
  can feed "Sacrifice a creature"), `another` dropping the source, predicate
  match in `conditionHolds`'s exact shape so the two graders cannot drift.
  **No candidate, no offer** — a cost you cannot pay is not offered — and the
  candidates ride the legal action (`sacrificeCandidates`), so no client
  re-derives them.
- **Validate** (`handlers.activateAbility`): missing pick →
  `'needsSacrifice'`; a pick outside `sacrificeCandidatesFor`'s own answer →
  `'illegalSacrifice'` (the host re-runs the SAME function — a client's word
  is not a rule, D139's shape a third intent over). Both are refusals that eat
  nothing, pinned by tests that assert the log did not move.
- **Charge** (`finishAbility`): the chosen permanent rides `PendingCast.
  sacrifice` (optional field — pre-D168 replays untouched) and is paid in the
  COST batch beside D159's self-sacrifice, through the ordinary `CardsMoved`,
  so dies-triggers and the funnel see it like any other death — with a
  narration NAMING WHAT DIED ("You sacrifice Grizzly Bears."), because a
  permanent must never leave the battlefield without the log saying so (D100).

⚠️⚠️ **BUILDING THE UI HALF FOUND THAT THERE WAS NO UI AT ALL — for ANY
activated ability.** No renderer path consumed an `ActivateAbility` legal
action: `aimCommit.commitTargets` could submit one, but the only thing that
ever entered that mode was the dev handles. Every def landed since D159 —
Arcane Encyclopedia's draw, War Room, the Locket cycle, Ant Queen, ~40
abilities — was exercised by the bot, the fuzzer and the batteries and
reachable by NOBODY at the table. D143 named this exact failure ("a prompt's
answerers and its control are separate work, and 'the driver can answer it'
reads exactly like 'it is finished'") and it happened anyway, for ten batches,
because every gate is an answerer. **The control is now the card's own click
panel** (`ManaChoice`, D110's panel): under the mana rows, one row per
offered ability — the printed cost drawn as glyphs, the whole line as text,
unaffordable rows marked and disabled — and `startActivation` in
`aimCommit.ts` is the ONE place deciding what a row click means: a sacrifice
cost enters the veil pick; a targeted ability enters targeting (`next:
'submit'`, the mode that existed and nothing entered); anything else submits.
The click chain opens the panel for a card with abilities even when it has no
mana and no tap-only row (a tapped Book of Rass still has its ability).

**The veil pick is the attach mode's shape with Tier-1 teeth:** mode
`sacrifice` carries card + abilityIndex + name and NO candidate list —
`GameLayer` re-reads the candidates off the CURRENT legal action on every
commit (the veil's own re-legalisation rule), so a candidate that dies
mid-pick stops being clickable and an ability that left `legal` offers
nothing. Escape backs out with the aim reset (the arrow's tail is pinned to
the source). The prompt bar reads "Choose what Carnage Altar sacrifices."

**Proof cards, each a different clause of the grammar:**
- `Carnage Altar` — the typed predicate. No creature, no offer; the offer
  appears the moment a candidate does; the Altar itself (an artifact) is
  `'illegalSacrifice'`; a missing pick is `'needsSacrifice'` with the log
  unmoved; the Bears is in the graveyard BEFORE settling (CR 602.2b) with the
  Altar untouched.
- `Claws of Gix` — the empty predicate, and the self-INCLUSION proof: a LAND
  pays "a permanent", and the Claws pay their OWN cost — the source is gone
  the moment the cost is paid and the ability on the stack still gains the
  life (CR 113.7a).
- `Ahriman` — the OR-predicate and the "another" exclusion: candidates are
  the other creature and the artifact, never Ahriman, never a land; the
  ARTIFACT arm pays and the draw arrives; `sacrifice: eye` is refused even
  though Ahriman is a creature.

⚠️ **The fuzz builder names a candidate off the offer** (`p.below` over
`sacrificeCandidates`), so the gate exercises the pick, the charge and all
three predicate shapes at scale — **and its FIRST full run found a real
engine hole (seed 305): `attacker c877 does not exist`.** Sacrificing an
ATTACKING TOKEN at instant speed deletes the instance (`TokensCeased`, CR
704.5d's two-step) while `state.combat` still names it. The hole predates
D168 — `TokensCeased` has never pruned combat — and stayed invisible for
seven batches of attacking tokens because an ordinary combat death's
priority windows AUTO-PASS straight through end of combat, where
`RemovedFromCombat` cleans the lists before any invariant check settles on
the state; a chooser cost paid while an AWAITING holds the pump mid-combat
is what froze the stale reference somewhere the fuzzer's per-intent
`checkInvariants` could see it. **The fix is the reducer's `TokensCeased`
pruning combat in `RemovedFromCombat`'s exact shape** (attackers, blockers,
both nested orders) — the minimal repair, because the engine's convention is
"combat may name DEPARTED cards, filtered at use" and a deleted instance is
the one departure that convention cannot absorb: every other dead combatant
still exists in a graveyard, which is all `checkInvariants` requires.
Pinned by a regression test that stages the exact scenario (token attacker,
`holdEverywhere`, chooser sacrifice mid-declare-attackers); with the prune
disabled it fails with the gate's own message, and nothing else moves.

⚠️ **`payable` grew by 489 cards and none of them is offered** — D159's shape
again, measured: tier3 `payable` 4,777 → 5,266, either 21,068 → 21,379,
wasSilent 16,343 → 16,762 — the whole database's "Sacrifice a <predicate>"
costs became chargeable-in-principle, while the def gate keeps every undef'd
one unoffered and their tier3 note keeps the manual-route wording
(`abilityText` unmoved at 17,368; the note's LABEL and TEXT are identical for
a sacrifice-cost ability with and without D168, which is why no disclosure
churned). `silentAfter` 2,289 → 2,292 — exactly the three landed cards. At
the printings level the reclassification is a PERFECT MIRROR:
`activated:nonManaCost` 10,372 → 8,572 and `payable` 28,133 → 29,933 — the
same 1,800 lines seen from both sides, with nothing leaking anywhere else.

⚠️ **A card with BOTH a sacrifice cost and a target clause is unoffered today**
(no def ships one), and `startActivation`'s branches are exclusive — when one
ships, the pick must CHAIN into targeting. Submitting with either half
missing is refused by the host, so the gap fails safe with a message. The
freed ledger cards include that shape (`Barrage of Expendables`), so the
batch that lands one builds the chain.

**Re-measured, every coverage delta exactly the three cards:** `complete`
1,878 → **1,881** · `blocked` 29,811 · `scriptableToday` 1,115 → 1,112 ·
ladder [1112, 1211, 3164, 5048, 6235] · botPool creature 1,259 / artifact 47
· fixtures 304 → 307 · `SHIPPED_SCRIPTS` 148 → 151 · `batch.json` re-emitted
at **1,009** — 997 minus the three landed PLUS the twelve ledger-freed cards
back in the stream · `botDeck.ts` regenerated (Adun reaches 1,035).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation: `tsc -b` clean · conformance green · coverage accounting
green over the real database · 221 test files, 2,162 Vitest passed / 10
skipped (218 / 2,139 before) · the 500-seed replay fuzz gate green at
**569.6 s idle** with 151 scripts registered (330 s inside the 900 s
ceiling) · `npm run build` clean · probe 124/124 · `battery-anim.cjs bot
engine prompts` 127/127.** ⚠️ D106 gained an unusual data point on the way:
the SAME gate ran green at 598.9 s **under a playing Disney+ stream** (load
41%, the fuzz worker visibly starved) — the first loaded run of the arc to
finish inside its ceiling rather than tripping it, which is the ceiling
working as a hang-catcher and not a perf referee. The idle number is the one
recorded as capacity.

⚠️ **Checked by BREAKING it:** the wrong-kind, missing-pick and
"another"-self rejects are permanent break tests IN the suites; the
no-candidate-no-offer rule is asserted from the offer side (Carnage Altar
with an empty board); and the combat prune was reverted on purpose —
exactly the seed-305 regression test fails, with `attacker c63 does not
exist`, and the other 76 engine/combat/SBA checks around it do not move.

⚠️ **Reportables:**
- **The sacrifice+targets chain** (above) — unoffered today, named for the
  batch that lands one.
- **The remaining cost-chooser classes are now ONE pattern away each**: the
  discard-cost chooser (hand, hidden — D137's prompt shapes), tap-creatures /
  tap-permanents, exile-from-graveyard, remove-counter — each is this
  decision's `sacrificeCost` with a different verb and zone. The chooser's
  candidates-on-the-offer + re-validate-in-the-handler shape is the
  template.
- **The ability rows are click-covered by nothing** — the panel ships with
  unit-tested pure options (`abilityOptionsFor`) and the veil pick reuses
  attach-mode machinery the battery drives, but no battery check clicks an
  ability row end to end yet. D144's lesson says write it before the panel
  rots; the next battery pass should add it.
- D160's spell seam, script-raised prompts, once-per-turn memory,
  per-damage-entry granularity and `ctx.random` stand.

## D169 — M6.4l: twenty-three landed on the staged chain, and the prompt that armed the arrow

**1,904 of 31,692 Commander-legal cards now execute completely, up from
1,881** — the largest batch of the arc (23 of 25, past D165's 22), and the
first one whose selection was mostly the REFUSED ledger giving cards BACK:
twelve freed sacrifice-chooser cards led the offer, and ten of them needed
D168's named follow-on, built here.

⚠️⚠️ **THE `chooseTargets` PROMPT HAD NO HUMAN CONTROL, AND THAT IS BIGGER
THAN THIS BATCH.** The prompt-bar text has said "Choose targets: drag the
arrow onto each one" since the targeting work — and NOTHING ever armed the
arrow: no renderer code entered targeting mode off the awaiting, so a human
whose OWN trigger asked for a target was WEDGED (the awaiting blocks every
intent, and the only control was text about a control that did not exist).
Every targeted trigger shipped since batch 5 — Chrome Prowler, Armasaur
Guide, and now every ETB in this batch — was answerable by the bot, the
fuzzer and the net driver and by nobody at the table. D143's
answerers-vs-control lesson, THIRD instance (D142's ordering prompt, D168's
activation panel), and the third time every gate being an answerer is
exactly what hid it. **The fix:** targeting mode gains `next: 'answer'`
(submits a `ChooseTargets` for the live awaiting), `TargetSource` gains
`stack`, and an effect in `useEngineTable` arms the arrow whenever the
awaiting is mine — specs off the AWAITING, the host's own statement, never
re-parsed. Escape drops the mode and the effect re-arms it: the game
genuinely cannot proceed unanswered, so un-escapable is honest.

**The staged chain, proven end to end** (`Agent of Shauku`'s suite): the
activation names its sacrifice, the engine stages the target prompt, and
the COST IS CHARGED ON THE ANSWER — CR 601.2's order (targets at 601.2c,
payment at 601.2g) made visible: the land is still on the battlefield while
the prompt is up, and in the graveyard the moment the answer lands. This is
why the ten sacrifice+target cards needed ZERO further engine work: D168's
pick plus the existing staging compose.

**Landed, 23 of 25:**
- **The ten sacrifice+target defs** — every predicate shape from D168 paired
  with an effect family: pumps (`Agent of Shauku` +2/+0, `Bog Naughty`'s
  Food-fed -3/-3), destroys with the indestructible discipline (`Army Ants`
  land-for-land, `Aura Fracture`'s NO-mana cost — the sacrifice IS the
  price), pings off enchantment sources (`Barrage of Expendables`,
  `Blood Rites`) and creatures (`Barrage Ogre`'s tap+artifact,
  `Blazing Hellhound`'s "another"), a bounce off the empty predicate
  (`Barrin, Master Wizard`), and the first SUBTYPE predicates (`Arms
  Dealer`'s Goblin, `Bog Naughty`'s Food). ⚠️ The Arms Dealer negative
  taught the predicate's own lesson: the Dealer is a Goblin Rogue, so
  "Sacrifice a Goblin" legally eats ITSELF — the wrong-kind test must use a
  genuinely Goblin-less creature.
- **The freed chooser pair** landing on D168 unchanged (`Akki Scrapchomper`'s
  artifact-or-land OR, `Cephalid Scout`).
- **Eleven fresh shapes**: `Contemplation` (the any-spell cast-watcher — the
  enchantment pool the D160 zero-pin watches reads SEVEN now),
  `Coral Barrier` (the islandwalk Squid — the printing distinct from
  nothing but its ability, D131), `Crested Herdcaller` (the TRAMPLE
  Dinosaur, one table row from the vanilla one), `Crimson Caravaneer` (a
  DOUBLE STRIKER's combat-damage trigger genuinely fires twice, one Junk
  per sub-step, distinct ids — D164's allocator teeth), `Crustacean
  Commando` (Mutagen), `Court Street Denizen` (the colour-filtered
  two-def enters-trigger with a target — a white TOKEN counts),
  `Crocodile of the Crossing` (targeted ETB counter on your OWN board),
  `Crenellated Wall` ({T} pump behind a Defender line), `Courier's Capsule`
  (self-sac draw-two, counted in MOVES — D163), `Council of Advisors` and
  `Courier Griffin` (ETB draw/gain twins).
- **Two refusals, both existing classes:** `Coral Helm` (random-discard
  cost) and `Corrupt Court Official` (a trigger's resolve raising ANOTHER
  player's discard prompt — D160's script-raised prompt class).

⚠️ **One test lesson worth keeping** (`Council of Advisors`): `put` may
fetch the card from the opening HAND, so a hand-size delta reads 0 while
the ETB draw genuinely happened — count LOG MOVES, never hand size.

**Re-measured, every coverage delta exactly the 23 cards:** `complete`
1,881 → **1,904** · `blocked` 29,788 · `scriptableToday` 1,089 · ladder
[1089, 1188, 3141, 5025, 6212] · tier3 `silentAfter` 2,292 → 2,315 (+23
exactly) · botPool creature 1,277 / artifact 48 / **enchantment 7** ·
fixtures 307 → 334 (32 tokens — Squid `tblc 17`, trample Dinosaur `txln 5`,
Junk `tpip 15`, Mutagen `ttmt 9` pinned) · `SHIPPED_SCRIPTS` 151 → 174 ·
`batch.json` at **984** (1,009 − 23 landed − 2 refused, exact) ·
`botDeck.ts` regenerated (Barrage of Expendables and Blood Rites joined;
Bull Rush and Demon's Grasp displaced).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation: `tsc -b` clean · conformance green · coverage accounting
green over the real database · 244 test files, 2,264 Vitest passed / 10
skipped (221 / 2,162 before) · the 500-seed replay fuzz gate green at
**622.7 s** with 174 scripts registered (277 s inside the 900 s ceiling —
the wall grew ~53 s for 23 scripts, 569.6 s → 622.7 s, and D167's named
lever, self-only def dispatch, is the plan for when the trend closes the
gap) · `npm run build` clean · probe 124/124 · `battery-anim.cjs bot engine
prompts` 127/127.**

⚠️ **Reportables:**
- **The answer-mode arrow is battery-covered by nothing yet** — same status
  as D168's ability rows; one prompts-section block should drive a real
  staged activation click-through (D144's lesson, now owed by two features).
- The remaining cost-chooser classes stand (discard, tap-creatures/
  permanents, exile-from-graveyard, remove-counter, exile-self), plus
  `ctx.random`, once-per-turn memory, per-damage-entry granularity, and
  D160's spell seam.

## D170 — M6.4n: twenty-three again — the transform-watcher, the counterspell, and the tap-watcher

**1,927 of 31,692 Commander-legal cards now execute completely, up from
1,904** — batch 12 matches batch 11's 23 of 25, with three event kinds
consumed by a def for the first time.

**The three firsts:**
- **The transform-watcher** (`Cult of the Waxing Moon`) — the bus dispatches
  on `FaceIndexSet`, the event D108's Transform button has emitted since it
  existed, and the filter asks the DERIVED post-flip characteristics — so
  "transforms into a non-Human creature" reads the destination face through
  the layers, flipping BACK to a Human front face pays nothing, and both
  branches are proven on one werewolf (`Duskwatch Recruiter`, a fixture
  added for exactly this board).
- **The script counterspell** (`Daring Apprentice`) — aimed by the staged
  prompt at a REAL held cast, self-sacrifice paid on the answer, and the
  spell leaves the stack without resolving. ⚠️ **Its own first test run
  caught an under-emit**: `SpellCountered` alone pops the stack OBJECT while
  the CARD stays stranded in the stack zone forever — the effect
  vocabulary's counter emits a PAIR, and the def now routes the card's move
  through a newly exported `moveFromStack` (the `drawEvents` precedent: one
  rule, never a copy).
- **The tap-watcher** (`Deeproot Pilgrimage`) — a def on `PermanentsTapped`,
  and the batched event is EXACTLY the card's own granularity: "one or more
  … become tapped" fires once per event however many turned together, so
  per-event dispatch is the printed rule here where D163 refused it for Aya.
  The nontoken filter is proven from both sides: the Merfolk turning pays a
  token, the TOKEN it made turning pays nothing.

**Also landed:** the first HISTORIC cast filter (`D'Avenant Trapper` —
artifact/legendary/Saga off the face actually cast, D155's rule); three more
subtype chooser costs (`Dark Heart of the Wood`'s Forest — a LAND subtype —
`Deadapult`'s Zombie, both proven with wrong-kind rejects); an attack-untap
(`Dauntless Aven`, Auriok's guard mirrored); the enchantment- and
Merfolk-cast watchers (`Dawnhart Geist`, `Deeproot Waters`); ETB
counters/pumps/gains/tokens and pings on shipped shapes; a dies-draw, a
dies-token on D165's Saproling pin, and a self-sac gain. **The enchantment
pool reads ELEVEN** (Dark Heart, Deadapult and both Deeproots joined — the
D160 zero-pin's comment now lists four generations).

⚠️ **Two refusals, both existing classes:** `Curious Altisaur` ("a Dinosaur
you control deals combat damage" — NOT self-only, so `CombatDamageDealt`'s
per-event batching under-fires it: Aya's class) and `Deadbridge Shaman` (a
dies-trigger raising the TARGET OPPONENT's discard prompt — D160's
script-raised prompt class).

⚠️ **One test lesson pinned on the way:** the engine's phase names are
`precombatMain`/`postcombatMain` — an advance predicate written as
`'main1'` matches NOTHING and the game quietly runs to its deck-out end,
which reads as "gameOver rejected my intent" three turns later. And the
scratchpad's query script was lost to temp-dir GC and rebuilt against
`cardindex`'s own API — batch scripts now assume nothing survives between
sessions.

**Re-measured, every coverage delta exactly the 23 cards:** `complete`
1,904 → **1,927** · `blocked` 29,765 · `scriptableToday` 1,066 · ladder
[1066, 1165, 3118, 5002, 6189] · tier3 `silentAfter` 2,315 → 2,338 (+23
exactly) · botPool creature 1,296 / **enchantment 11** · fixtures 334 → 363
(35 tokens — Human Soldier `tthb 2`, hexproof Merfolk `txln 3`, Wolf
`tlrw 10` pinned; the werewolf, a Forest-check body, a Zombie and a vanilla
Merfolk join as unscripted test boards) · `SHIPPED_SCRIPTS` 174 → 197 ·
`batch.json` at **959** (984 − 23 − 2, exact) · `botDeck.ts` regenerated
(Dark Heart of the Wood joins; Defeat displaced).

**Verified: `node scripts/cardgen/verify.cjs --full` — ALL FIVE GATES PASSED
in one invocation: `tsc -b` clean · conformance green · coverage accounting
green over the real database · 267 test files, 2,360 Vitest passed / 10
skipped (244 / 2,264 before) · the 500-seed replay fuzz gate green at
**1,148.7 s** with 197 scripts registered (651 s inside the raised 1,800 s
ceiling) · `npm run build` clean · probe 124/124 · `battery-anim.cjs
bot engine prompts` 127/127 — the battery and probe run in an IDLE WINDOW
under the new standing rule (gates wait for quiet; light work never does).**

⚠️⚠️ **THE FUZZ WALL ARRIVED AGAIN, AND THE VERDICT IS THE SAME AS D167's,
PROVEN HARDER.** The first full-gate run at 197 scripts failed ONLY its
900 s ceiling — having COMPLETED all 500 seeds with every replay hash equal
and every canary green (3,714 triggers, 695 script-resolved abilities, 517
nameable tokens, 2,179 enters-tapped) at 1,162 s under desktop load. The
D162 protocol re-measured: ~145 s per 60 seeds projects ~900–1,200 s even
idle, on 2.84 M events / 24 K turns — the games are genuinely richer
because more of every deck is scripted, which is the arc's whole point. The
bus was measured at ~2% in D167 and nothing here changed that. **The
ceiling is raised a second time (900 s → 1,800 s), with the full trend
table in the gate's own comment, and the rule made explicit: it is raised
only ever after a completed-and-equal run proves the wall is growth rather
than a hang.** Self-only def dispatch stays the named lever if WALL TIME
itself becomes the problem for CI rather than the ceiling.

⚠️ **Reportables:**
- The answer-mode arrow and the ability rows still owe a battery
  click-check (D169's item, now three features deep — due before it becomes
  D143's fourth instance).
- The remaining cost-chooser classes, `ctx.random`, once-per-turn memory,
  per-damage-entry granularity and the spell seam stand.

## D171 — M6.4o: twenty landed — the graveyard-exit watcher, the self-cast trigger, the chosenColor consumer, and the first script reanimation (2026-08-06)

**What was decided:** batch 13 of the M6.4 loop lands twenty of its 25 —
**1,947 of 31,692 Commander-legal cards now execute completely, up from
1,927** — with five refusals, all existing ledger classes. `SHIPPED_SCRIPTS`
197 → 217.

**Five firsts, four of them event- or state-consumers no def had touched:**

- **The graveyard-exit watcher** (`Desecrated Tomb`): `CardsMoved` with
  `m.from.kind === 'graveyard'` on the CONTROLLER's side, the mover's
  card-type read off the ORACLE face — a graveyard card has no battlefield
  derivation to ask — and the per-event batching is EXACTLY the card's own
  "one or more creature cards leave" wording, so the granularity question
  D158 first raised answers itself here: the event IS the batch the card
  describes.
- **The cast-of-ITSELF trigger** (`Desolation Twin`): `activeZones:
  ['stack']` — the one zone the card occupies at the moment "when you cast
  this spell" can fire. The 10/10 Eldrazi arrives while the Twin is still on
  the stack, which is the printed timing; the test's negative pins that a
  Twin PUT onto the battlefield (not cast) brings nothing.
- **The chosenColor consumer** (`Diamond Mare`): the first trigger to READ
  D147's `chosenColor`. Line 0 ("As this creature enters, choose a color")
  is the ENGINE's built-in recognition — the same one that completed Sol
  Grail with no script — so the def claims line 1 alone, and its filter
  compares the cast face's colours to the answer remembered on its own
  instance. Before the answer the filter matches nothing, which is the mana
  scope's own "no answer, no offer" rule one event kind over.
- **The becomes-blocked watcher** (`Deepwood Tantiv`):
  `AttackerBecameBlocked`, self-filtered — per-event firing is per-instance,
  the granularity-safe shape — and CR 509.1g's "fires once however many
  blockers pile on" falls straight out of the event being emitted once per
  declaration.
- **The first script REANIMATION** (`Doomed Necromancer`): the graveyard
  target is aimed by D138's zone machinery, re-checked at resolution (CR
  608.2b), and the return is an ordinary `CardsMoved` graveyard →
  battlefield — so the entry funnel (loyalty counters, enters-tapped, the
  pay-to-enter prompt) runs on the reanimated permanent for free. The
  permanent enters under the ACTIVATOR; the card stays owned by its owner —
  D138's split, one zone over. The test also pins CR 601.2's order end to
  end: the prompt up with the Necromancer still on the battlefield, an
  opponent's graveyard card REJECTED, and the sacrifice charged only on the
  accepted answer.

**The fifteen twins:** the staged chooser+target chain on a Human predicate
(`Deranged Outcast`, +2 +1/+1 counters), two OR-predicate sacrifice-draws
(`Destructive Digger` artifact-or-land, `Dockside Chef`
artifact-or-creature), a mana-only targeted pump (`Devotee of Strength`),
an ETB gain (`Devout Monk`), two Asgardian-shape gain lands — one of them
(`Dimension X`) carrying ASGARDIAN CITADEL'S EXACT PRINTED TEXT on a second
oracle id, Benalish Trapper's precedent — (`Dismal Backwater` the other),
the Dimir Cluestone/Locket pair, three dies-tokens on two new pins and one
old (`Dire Fleet Hoarder` Treasure, `Discordant Piper` Goat, `Doomed
Dissenter` Zombie), a dies-trigger with a target whose −2/−2 kills a 2/2
through the SBA (`Disease Carriers`), a self-sacrifice destroy with the
indestructible negative (`Dispeller's Capsule`, the Capsule spent either
way), and Barrin's empty-predicate bounce on an enchantment (`Dispersing
Orb`).

**Five refusals, all existing classes, all in the ledger:** `Deepwood
Drummer` and `Devout Witness` (discard-cost chooser), `Dementia Bat`
(script-raised prompt — its resolve must raise the TARGET's discard),
`Devout Chaplain` and `Diversionary Tactics` (tap-creatures cost).

**The numbers, every delta exactly the twenty cards:** primitives
`complete` 1,927 → 1,947 · `blocked` 29,765 → 29,745 · `scriptableToday`
1,066 → 1,046 · ladder [1046, 1145, 3098, 4982, 6169] · botPool creature
1,296 → 1,309, artifact 48 → 52, land 225 → 227, and **the TWELFTH
enchantment** (`Dispersing Orb`) · tier3 `either` −20 exactly,
`silentAfter` 2,338 → 2,358 (+20 exactly — the proof no disclosure was
lost) · fixtures 363 → 387 (39 tokens: Bat `tlci 6`, Eldrazi `tcmm 1`,
Goat `tncc 6`, Zombie `tc14 16` joined) · `batch.json` at **934** (959 −
20 landed − 5 ledger-freed, exact) · botDeck regenerated (Adun reaches
1,071 from 1,058).

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 287 test files, 2,450 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,258.6 s (217 scripts registered,
541 s inside the 1,800 s ceiling; wall grew ~110 s for 20 scripts,
on-trend) · build clean · probe 124/124 · battery `bot engine prompts`
127/127 — gates run in an idle window per the standing rule (Overwatch
was resident when the batch was ready; light work continued and the
gates waited, and batch 14 was classified in the hold).

**Reportables:** the answer-mode arrow and D168's ability rows still owe a
battery click-check (four features deep now — D144's lesson compounding);
the cost-chooser classes (discard, tap-creatures/permanents,
exile-from-graveyard, remove-counter), `ctx.random`, once-per-turn memory,
per-damage-entry granularity and the spell seam all stand.

## D172 — M6.4p: eighteen landed — the life-gain watcher, the cast-targets reader, and the enters-untapped filter (2026-08-06)

**What was decided:** batch 14 of the M6.4 loop lands eighteen of its 25 —
**1,965 of 31,692 Commander-legal cards now execute completely, up from
1,947** — with seven refusals, one of them a NEW ledger class.
`SHIPPED_SCRIPTS` 217 → 235.

**Three firsts:**

- **The life-gain watcher** (`Drogskol Reaver`): the first def on
  `LifeChanged`. The filter is the delta's SIGN plus the controller, the
  bus fires per gain EVENT — the granularity the card means — and the loop
  closes itself because drawing does not gain life. Its own lifelink is the
  intended engine: connect, gain, draw, all three tested from both sides
  (a loss draws nothing, an opponent's gain draws nothing).
- **The cast-watcher that reads the SPELL'S CHOSEN TARGETS** (`Druid of
  Horns`): "an Aura spell that targets this creature" is a filter over
  `SpellCast` — the event carries the stack object, the stack object
  carries the aims the caster declared, so no new seam. The negatives pin
  both edges: an Aura aimed at another creature pays nothing, and an Aura
  merely ATTACHED with the Tier-3 tool (no cast) pays nothing.
- **The enters-UNTAPPED filter** (`Dwarven Mine`): line 1 is D135's
  `otherLandsOfType` board query, and the def's trigger reads its own
  condition off the AFTER state — by the time triggers collect, the entry
  has already applied (or not applied) D134's tap, so `tapped` IS the
  answer. Both halves proven from both sides: alone it enters tapped and
  stays silent; behind three other Mountains it enters untapped and pays
  the Dwarf.

**The fifteen twins:** a dies-Spirit (`Doomed Traveler`), the
self-sacrifice Dragon (`Draconic Disciple`, mana line the engine's), a
repeatable targeted counter (`Dragon Blood`), a mana-only Dragon faucet
with two DISTINCT ids in one turn (`Dragon Roost` — **the pool's
THIRTEENTH enchantment**, D164's allocator teeth), an ETB Dragon
(`Dragon Trainer`), Arasta's opponent-cast Insect on a bigger body
(`Dragonlair Spider`), an ETB and a dies Hero on one new pin (`Dragoon's
Wyvern`, `Dwarven Castle Guard`), Hedron Archive's bigger sibling with the
three-card draw counted as MOVES (`Dreamstone Hedron`), Belligerent
Guest's hit-a-player shape twice (`Drider`'s menace-reach Spider — a
printing distinct from the 1/2 by nothing but its abilities, D131;
`Eager Trufflesnout`'s Food), **a dies-trigger REANIMATION with D139's
numeric restriction on the aim** (`Driver of the Dead` — mv 2 comes back,
mv 4 is refused at the answer), a self-sacrifice enchantment kill
(`Druid Lyrist`), a LAND's dies-token with the bounce negative
(`Dunes of the Dead`), and the Goblin chooser paying for a land destroy
(`Earthblighter`).

**Seven refusals, ONE new class:** `Dragon Broodmother` — **token entry
choice (devour)**: the token it creates carries an as-enters sacrifice
choice on the CREATED permanent, a prompt nothing can raise, so creating
it would half-execute the token's own text. The rest are existing
classes: `Dragonborn Champion` AND `Dromad Purebred` (per-damage-entry
granularity — Dromad is the RECEIVER side: two simultaneous sources are
two damage instances batched into one event, where Belligerent Guest's
DEALER side is one instance and safe), `Draugr Recruiter` (once-per-turn
memory — Boast), `Dread Rider` (exile-from-graveyard cost), `Dune
Diviner` (tap-permanents cost), `Dwarven Bloodboiler` (tap-creatures
cost).

**The numbers, every delta exactly the eighteen cards:** primitives
`complete` 1,947 → 1,965 · `blocked` 29,727 · `scriptableToday` 1,028 ·
ladder [1028, 1127, 3080, 4964, 6151] · botPool creature 1,322, artifact
54, land 229, enchantment 13 · tier3 `either` −18 exactly, `silentAfter`
2,358 → 2,376 (+18 exactly) · fixtures 387 → 410 (44 tokens: Spirit
`tmm2 5`, Dragon `tkhm 11`, Hero `tfin 26`, Spider `tafr 7`, Dwarf
`plst TELD-7` joined; the 4/4 Dragon and the Beast were already pinned) ·
`batch.json` at **909** (934 − 18 landed − 7 ledger-freed, exact) ·
botDeck regenerated — **Dunes of the Dead and Dwarven Mine JOIN the
bot's deck** (Adun reaches 1,085 from 1,071).

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 305 test files, 2,530 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,320.8 s (235 scripts registered,
479 s inside the 1,800 s ceiling; +62 s for 18 scripts, on-trend) ·
build clean · probe 124/124 · battery `bot engine prompts` 127/127.

**Reportables:** the answer-mode arrow and D168's ability rows still owe
a battery click-check; the cost-chooser classes (discard,
tap-creatures/permanents, exile-from-graveyard, remove-counter),
`ctx.random`, once-per-turn memory, per-damage-entry granularity (now
FOUR ledger entries across both sides), the token-entry-choice class and
the spell seam stand.

## D173 — M6.4q: the first zero-refusal sweep — all twenty-five landed (2026-08-06)

**What was decided:** batch 15 of the M6.4 loop lands **ALL 25 of its
cards — the arc's first zero-refusal batch** — and **1,990 of 31,692
Commander-legal cards now execute completely, up from 1,965.**
`SHIPPED_SCRIPTS` 235 → 260.

**Why a sweep happened, said honestly:** the D161 parse filters and the
36-entry REFUSED ledger have been draining un-landable shapes out of the
offer stream for eleven batches, and the E-alphabet run happened to hold
none of the surviving cost-chooser classes. Four cards carried
engine-fact RISK at classification and all four facts held when checked
before a line was written — the checks are the point, not the luck.

**Five firsts:**

- **The adventure-layout cast filter** (`Edgewall Innkeeper`): "a creature
  spell that has an Adventure" is a fact about the PRINTING, so the filter
  asks the oracle for `layout === 'adventure'` and the cast face for
  Creature. The test casts a real adventure creature (`Tuinvale Treefolk`,
  a fixture since this batch) and pins that a plain creature pays nothing.
- **The beginning-of-combat targeted trigger** (`Eidolon of
  Inspiration`): Celestial Force's `StepBegan` one step later
  (`beginCombat`), the "on your turn" filter on the ACTIVE player, and
  D147's targeted-trigger machinery asking for the aim — the Eidolon
  itself is always a legal "creature you control", so CR 603.3d never
  removes it.
- **The power-threshold entry watcher** (`Elemental Bond`): "power 3 or
  greater" asked of the DERIVED entrant (CR 613 settles first), and one
  printed line is TWO TriggerDefs because tokens enter via `TokenCreated`
  (Soul Warden's rule) — the token half proven with a 5/5 Dragon made by
  the Tier-3 tool.
- **The becomes-tapped SELF watcher** (`Emmara, Soul of the Accord`):
  `PermanentsTapped` is emitted by every tap path — attack declarations,
  {T} costs, mana abilities, tap effects, the wrench — so
  `ev.cards.includes(self)` is the whole printed condition. Tapping
  someone else pays nothing; untapping her pays nothing.
- **The mana-value cast filter** (`Emrakul's Influence`): subtype + type +
  the printing's `manaValue` — the number `targets.ts` has read for stack
  objects since D139 — drawing two off a cast `Desolation Twin`.

**The twenty twins:** four cast-watchers (artifact → Thopter, enchantment
→ draw on `Enchantress's Presence` — Argothian's filter on an enchantment
BODY), five sacrifice-self destroys across every printed cost shape
({G}, {1}{G} no-tap, {G/W} hybrid, and `Elvish Lyrist` carrying Druid
Lyrist's EXACT text on a second oracle id), the hybrid-cost
another-or-artifact chooser ping (`Elite Headhunter` — its own
"another" negative pins that it can never eat itself), two
numeric-restriction taps (power ≤3, TOUGHNESS ≤2 — D139's other
attribute), a mana-and-tap tap, four ETB tokens on three new pins plus a
dies-Spirit and a dies-gain, an ETB draw, a sacrifice-self pump, a
sacrifice-self draw-three, and a repeatable Gnome faucet with D164's
distinct-id teeth.

**The numbers, every delta exactly the twenty-five cards:** primitives
`complete` 1,965 → 1,990 · `blocked` 29,702 · `scriptableToday` 1,003 ·
ladder [1003, 1102, 3055, 4939, 6126] · botPool creature 1,342, artifact
55, and **FOUR enchantments in one batch — the pool reads SEVENTEEN**
(Efficient Construction, Elemental Bond, Emrakul's Influence,
Enchantress's Presence) · **Emmara is the 51st fully-executable
legendary** and `Emrakul's Influence` joined the bot's deck · tier3
`either` −25 exactly, `silentAfter` 2,376 → 2,401 (+25 exactly) ·
fixtures 410 → 440 (48 tokens: Goblin `tecl 6`, lifelink Soldier
`tmom 2`, Eldrazi Horror `temn 1`, Gnome `tlci 16` joined, plus Tuinvale
Treefolk for the adventure cast) · `batch.json` at **884** (909 − 25 −
0, exact).

⚠️ **THE FIRST FULL-GATE RUN FAILED ON A RATE CANARY ROTTING ON
SCHEDULE — the third instance of the class its own comments predict.**
The layer-6 canary (`totals.layer6Sources > 0`, D129's proof that
`applyStatics` has live work) read ZERO at the 60-seed leg inside the
unit suite: `Levitation` and `Gravity Sphere` were dealt at ONE copy
each, and four batches of DECK growth (+88 names since D164's
re-weighting pass) diluted the pair below one appearance in 60 seeds.
Same fix as D149's CR 616 pair: FIVE copies of each, the rot's cause
written at the deal site. The 60-seed leg passed on the re-run and the
full gate was relaunched from the top — a batch lands only on all five
gates green in ONE invocation.

**Verified (the relaunched run): `verify.cjs --full` — ALL FIVE GATES
PASSED in one invocation** — 330 test files, 2,638 Vitest passed / 10
skipped · the 500-seed replay fuzz gate green at 1,396.4 s (260 scripts
registered, 404 s inside the 1,800 s ceiling) · build clean · probe
124/124 · battery `bot engine prompts` 127/127.

**Reportables:** the fuzz ceiling's headroom is shrinking on schedule —
self-only def dispatch (named since D169) is due before the trend closes
the remaining 404 s (~75 s of wall per 25-script batch says four to five
batches); the answer-mode arrow and ability rows
still owe a battery click-check; the cost-chooser classes, `ctx.random`,
once-per-turn memory, per-damage-entry granularity, token entry choice
and the spell seam stand.

## D174 — M6.4r: twenty-three landed, and the 2,000 line is crossed (2026-08-06)

**What was decided:** batch 16 of the M6.4 loop lands twenty-three of its
25 — **2,013 of 31,692 Commander-legal cards now execute completely, up
from 1,990, CROSSING TWO THOUSAND** — with two refusals, both existing
ledger classes. `SHIPPED_SCRIPTS` 260 → 283. The arc began at 1,730
(D158); sixteen batches later the engine runs 283 more cards' full text
than the parsers alone ever could.

**The headliner:** `Ertai, the Corrupted` — "{U}, {T}, Sacrifice a
creature or enchantment: Counter target spell" — composes D168's
OR-predicate chooser with D170's counterspell pair (SpellCountered + the
card's stack exit through `moveFromStack`) and D169's staged chain, with
ZERO new engine work. The test holds a real cast on the stack, pays with
a creature, pins that a LAND is neither arm, and watches the held spell
die. `Ertai, Wizard Adept` counters standing up; both are LEGENDS, so
**the fully-executable legendary pool reads 53**.

**One genuine fix found by a test:** the first cut of `Fallen
Ferromancer`'s ping hardcoded infect as `applyAs: 'wither'` — combat.ts's
own rule says infect versus a PLAYER is **'poison'** (CR 702.90b/c), and
the poison test read 0 counters. The def now branches per target kind,
and both halves are pinned: a creature takes the ping as a -1/-1 counter,
a player takes it as poison with life unmoved.

**The rest:** the mv-4 any-spell Thopter spinner (`Etherium Spinner` —
Emrakul's filter with no type gate), a targeted ETB bounce with the
opponent restriction (`Exclusion Mage`), two-token ETBs on Thopters and
Blood (`Experimental Aviator`, `Falkenrath Celebrants` — distinct-id
teeth both), the DECAYED-Zombie ETB (`Falcon Abomination` — the token's
own decayed text is tier3-disclosed on the token, the Blood-token
precedent, so creating it is not half-execution), a self-inclusive
targeted entry watcher in TWO defs (`Fallaji Vanguard`), the artifact
chooser paying with ITSELF (`Etherium Astrolabe`, CR 113.7a), a NO-mana
sacrifice cost (`Felidar Cub`), the any-enchantment-dies watcher
(`Femeref Enchantress` — looksBack so the dying enchantment still has a
derivation), Boast-free tap actives, ETB and dies debuffs at three
strengths, dies draws, an ETB Wolf, and a repeatable -1/-1 counter
(`Fevered Convulsions` — two activations kill a 2/2 through the SBA).

**Two refusals, both existing classes:** `Ezio, Blade of Vengeance`
(per-damage-entry granularity — a CLASS of creatures dealing combat
damage widens Aya's dealer side: two simultaneous Assassins are two
instances in one event) and `Fearless Liberator` (once-per-turn memory —
Boast).

**The numbers, every delta exactly the twenty-three cards:** primitives
`complete` 1,990 → 2,013 · `blocked` 29,679 · `scriptableToday` 980 ·
ladder [980, 1079, 3032, 4916, 6103] · botPool creature 1,363, artifact
56, enchantment 18 · tier3 `either` −23 exactly, `silentAfter` 2,401 →
2,424 (+23 exactly) · fixtures 440 → 465 (50 tokens: Faerie `tmoc 11`,
decayed Zombie `tdrc 7` joined) · `batch.json` at **859** (884 − 23 − 2,
exact) · botDeck regenerated.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 353 test files, 2,736 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,338.4 s (283 scripts registered,
462 s inside the 1,800 s ceiling — and FASTER than batch 15's 1,396.4 s
despite 23 more scripts, which is run-to-run variance worth recording
against the trend) · build clean · probe 124/124 · battery `bot engine
prompts` 127/127.

**Reportables:** the fuzz headroom keeps shrinking — self-only def
dispatch (D169) is the named lever and its due date is measured in
batches; the answer-mode arrow and ability rows still owe a battery
click-check; the cost-chooser classes, `ctx.random`, once-per-turn
memory, per-damage-entry granularity (now FIVE ledger entries), token
entry choice and the spell seam stand.

## D175 — M6.4s: the first DiceRolled consumer, the nontoken dies watcher, and both twins in one batch (2026-08-08)

**What was decided:** batch 17 of the M6.4 loop lands twenty-one of its
25 — **2,034 of 31,692 Commander-legal cards now execute completely, up
from 2,013** — with four refusals, ONE of them a NEW cost class.
`SHIPPED_SCRIPTS` 283 → 304, past three hundred.

**The headliner:** `Feywild Trickster` — "Whenever you roll one or more
dice, create a 1/1 blue Faerie Dragon creature token with flying" — is
**the first def on `DiceRolled`**, an event that has been on the log
since M3 as the Tier-3 dice tool's output and has never had a consumer.
The filter is one clause (`ev.player` is the roller, matched against the
Trickster's controller), and the per-event batching IS the card's "one
or more" wording — the Tier-3 tool rolls one die per intent, so one
event per roll is exactly CR 706's fire-once shape, the same argument
Deeproot Pilgrimage made for `PermanentsTapped` (D170). ⚠️ The trigger
rides the MANUAL tool's own event: a player rolling a die for any other
card's sake pays the Trickster, which is the printed rule. The fuzz
gate's manual-intent case 4 already submits `RollDice`, so the gate
exercises the def with no new machinery — the token count moved the
moment the card joined `DECK`.

**The second first:** `Field of Souls` — "Whenever a nontoken creature
is put into your graveyard from the battlefield, create a 1/1 white
Spirit creature token with flying" — is **the first dies filter on
`CardInstance.isToken`**. The dies shape is Soul Warden's mirror
(from battlefield + to graveyard + `looksBack`), and the nontoken
restriction is proven from BOTH sides: a real creature dying pays a
Spirit, a token dying pays nothing. It is also an ENCHANTMENT, and the
two sacrifice-draw Fonts land beside it — **the enchantment pool reads
TWENTY-ONE.**

**And the twins:** `Fisk Tower` and `Foot Headquarters` carry the SAME
exact printed text on two new oracle ids — Asgardian Citadel's shape,
landed on the Dimension X / Benalish Trapper precedent — and this is
the first time BOTH twins of one text arrive in a single batch, each
proven on its own oracle id.

**The rest:** the first targeted script UNTAP (`Filigree Sages`,
{2}{U} repeatable — the tap def's mirror, with the `!card.tapped` guard
proven: an upright target gets no event); a {7}{R} player-or-planeswalker
burn (`Flamewave Invoker`); the D168 chooser + D169 staged chain on a
{4},{T} 4-damage cannon (`Fodder Cannon`); a {3}{R} any-target ping with
the full per-kind `applyAs` branch written at first cut (`Flamekin
Spitfire` — D174's Fallen Ferromancer lesson applied before the test
could catch it); a repeatable {R}{R} +1/-1 (`Flowstone Overseer`); three
sacrifice-self draw/gain actives (`Foggy Bottom Swamp` — a THREE-line
land whose mana line is a0 and whose sac-draw is #a1, entering tapped
per D134 so its test untaps first; `Font of Fortunes`; `Font of
Vigor`); `Foundry of the Consuls`' sac-self TWO Thopters with D164's
distinct-id teeth; ETB Food/Treasure/Clue makers (`Fierce Witchstalker`,
`Flamekin Gildweaver`, `Forecasting Fortune-Teller`); a dies Thopter
(`Filigree Crawler`); a dies land-destroy with the targeted trigger
arrow (`Fire Snake`); a {2},{T} gain (`Fountain of Youth`); a targeted
ETB +2/+4 (`Friendly Ghost`); and a {2}{W},{T} tap (`Frostbridge
Guard`). All 47 new per-card tests passed on their first run.

**Four refusals, ONE new class:** `Floodbringer` and `Flooded
Shoreline` both cost **"Return a land you control to its owner's
hand"** — a RETURN-PERMANENT cost, a chooser class no ledger entry had
ever named (the bounce-side sibling of the sacrifice chooser: same
recognition, same gate, a zone move that is not a death). Plus `Firja,
Judge of Valor` (once-per-turn memory — "second spell each turn") and
`Fodder Tosser` (discard-cost chooser). The ledger holds 42 entries.

**The numbers, every delta exactly the twenty-one cards:** primitives
`complete` 2,013 → 2,034 · `blocked` 29,658 · `scriptableToday` 959 ·
ladder [959, 1058, 3011, 4895, 6082] · botPool creature 1,375, artifact
58, **enchantment 21**, land 233 · tier3 `abilityText` 17,281,
`silentAfter` 2,424 → 2,445 (+21 exactly) · fixtures 465 → 488 (52
tokens: Faerie Dragon `tclb 6`, Clue `twho 21` joined) · `batch.json`
at **834** (859 − 21 − 4, exact) · botDeck regenerated — **Foggy Bottom
Swamp and Foundry of the Consuls joined the bot's deck** (Adun reaches
1,118, displacing Luxury Suite and Overgrown Tomb).

⚠️ **The first full-gate run failed on the DIES canary rotting on
schedule** — `Onulet` at ONE copy since D147 is the only card the
canary counts, and seventeen batches of DECK growth meeting
prompt-saturated games (48,953 target prompts against 48,906 accepted
intents) starved the compound event it needs — dealt AND resolved to a
battlefield AND dying — to ZERO across all 500 seeds, with every
replay hash equal at 1,548.0 s. Re-weighted to FIVE copies at the deal
site (D149's fix — the FOURTH instance of the class, after CR 616's
pair in D164 and layer 6's in D173) and the gate relaunched from the
top.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 374 test files, 2,825 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,489.3 s (304 scripts registered,
311 s inside the 1,800 s ceiling) · build clean · probe 124/124 ·
battery `bot engine prompts` 127/127.

**Reportables:** self-only def dispatch (D169) stays the named fuzz
lever and its due date is measured in batches; the answer-mode arrow
and ability rows still owe a battery click-check; the cost-chooser
classes (discard, tap-creatures/permanents, exile-from-graveyard,
remove-counter, and now RETURN-PERMANENT), `ctx.random`, once-per-turn
memory, per-damage-entry granularity, token entry choice and the spell
seam stand.

## D176 — M6.4t: Glittermonger comes back, and three texts land as twins (2026-08-09)

**What was decided:** batch 18 of the M6.4 loop lands twenty-two of its
25 — **2,056 of 31,692 Commander-legal cards now execute completely, up
from 2,034** — with three refusals, ALL existing ledger classes.
`SHIPPED_SCRIPTS` 304 → 326.

**The headliner is an arc closing:** `Glittermonger` — "{T}: Create a
Treasure token" — is the card D147 PULLED from the pool when its line
was exposed as a mana-ability misparse (`parseManaProduction` reading
"Create a Treasure" as production; `complete` went DOWN by one that
day). It returns as a real def: Ant Queen's no-mana repeatable through
the ActivatedDef seam and `TOKEN_TABLE`, proven by its own test. What
the parser was wrong to claim, a script now genuinely does.

**Three texts land as TWINS in one batch** (the Benalish rule — each
proven on its own oracle id): `Gallant Citizen` and `Generous Stray`
carry ONE exact ETB-draw text and BOTH arrive here; `Ghitu War Cry` is
Captive Flame's exact "{R}: Target creature gets +1/+0" on a second id;
`Gideon's Lawkeeper` is the THIRD id on Benalish Trapper and Blinding
Mage's "{W}, {T}: Tap target creature."

**The filters proven by dropping them:** `Fugitive Druid` is Druid of
Horns' cast-targets reader (D172) with the CASTER filter removed — the
test casts an Aura at the Druid from the OPPONENT's seat and the
Druid's controller draws; `Garrison Excavator` is Desecrated Tomb's
graveyard-exit watcher (D171) with the mover's TYPE filter removed — a
LAND leaving pays the Spirit, the exact case Tomb's own negative
refuses.

**The rest:** `Genghis Frog` — the first SUBTYPE-filtered
self-inclusive entering watcher (Court Street Denizen's two defs +
Bogwater Lumaret's self-inclusion + a Mutant filter asked of the
derived entrant; its own Mutagen is an Artifact, so the trigger cannot
feed itself — asserted; Crustacean Commando pays the Mutant arm) — and
**the 54th fully-executable legendary**; `Gingerbread Cabin` — Dwarven
Mine's enters-untapped filter on a FOREST count, the second consumer of
D135's `otherLandsOfType`, both halves proven from both sides;
`Galactic Wayfarer`'s Lander (the token's search text tier3-disclosed
on the token, the Blood precedent); ETB Knight/Thopter tokens and two
ETB draws; a dies Human Soldier and a dies Treasure; tap actives at
{2} and {W}; the untap actives one type over (`Fyndhorn Brownie` on
creatures, `Galvanic Key` on artifacts behind Flash); `Fume Spitter`'s
mana-free self-sacrifice −1/−1; tap-cost pumps and a −1/−0 debuff
(`Ghost Warden`, `Ghosts of the Damned`); `Gargoyle Castle`'s
sacrifice-self 3/4 Gargoyle; and `Ghirapur Gearcrafter`. **The
enchantment pool reads TWENTY-TWO.** All 22 suites passed on their
FIRST run — after one fixture-regen parse error: the new Lander pin
duplicated the Tier-3 token tool's existing `LANDER_TOKEN` const, the
generator emitted both, and every suite failed at transform until the
duplicate was removed and the batch comment taught to say the Lander
is REUSED. A fixture pin is not free just because the token is.

**Three refusals, all existing classes:** `Ghirapur Aether Grid`
(tap-permanents cost), `Glare of Subdual` (tap-creatures cost),
`Gilt-Leaf Seer` (script-raised prompt — its look-and-order runs ON
RESOLUTION, which a def's `resolve` cannot raise). The ledger holds 45.

**The numbers, every delta exactly the twenty-two cards:** primitives
`complete` 2,034 → 2,056 · `blocked` 29,636 · `scriptableToday` 937 ·
ladder [937, 1036, 2989, 4873, 6060] · botPool creature 1,393, artifact
59, **enchantment 22**, land 235 · tier3 `abilityText` 17,269, `either`
−22 exactly, `silentAfter` 2,445 → 2,467 (+22 exactly) · fixtures 488 →
513 (55 tokens: Knight `tm21 4`, Gargoyle `tm10 8`, R/W Spirit
`tsos 10` joined; the Lander `teoe 6` reused) · `batch.json` at **809**
(834 − 22 − 3, exact) · botDeck regenerated — **Adun reaches 1,133
cards choosing from 54 legendaries** (Genghis Frog joined the pool).

⚠️ **The first TWO full-gate runs each failed on a starved canary at
the 60-SEED leg — the fifth and sixth rate-canary rots, and the first
at the default size while the gate size stayed healthy both times.**
Run one read `enteredWithCounters` 0 at 60 (a 30-per-500 rate); run two
read `discardsChosen` 0 at 60 (a 10-per-500 rate, expectation ~1.2 —
a 30% coin flip every run) — while BOTH runs' 500-seed gates passed all
six checks (1,404.7 s, 1,425.4 s) with the same canaries alive. One
cause: batch 18's DECK growth re-rolled every seed and took the two
lowest-rate counters under Poisson reliability at 60. Both gate-sized
per the file's own precedent (D155's transform canary), the remaining
60-seed canaries AUDITED against the measured 500-rates — everything
left has expectation ≥8 — and the full gate relaunched from the top.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 396 test files, 2,924 Vitest passed /
10 skipped · the 500-seed replay fuzz gate green at 1,423.1 s (326
scripts registered, 377 s inside the 1,800 s ceiling) ·
build clean · probe 124/124 · battery `bot engine prompts` 127/127.

**Reportables:** self-only def dispatch (D169) stays the named fuzz
lever; the answer-mode arrow and ability rows still owe a battery
click-check; the cost-chooser classes (discard, tap-creatures,
tap-permanents, exile-from-graveyard, remove-counter, return-permanent),
`ctx.random`, once-per-turn memory, per-damage-entry granularity, token
entry choice and the spell seam stand.

## D177 — M6.4u: the two-sentence resolve, and two new classes named by one Goblin page (2026-08-14)

**What was decided:** batch 19 of the M6.4 loop lands twenty-one of its
25 — **2,077 of 31,692 Commander-legal cards now execute completely, up
from 2,056** — with four refusals, TWO of them NEW classes.
`SHIPPED_SCRIPTS` 326 → 347.

**The headliner:** `Gnottvold Slumbermound` is the first TWO-SENTENCE
activated resolve — "Destroy target land. Create a 4/4 green Troll
Warrior creature token with trample" — and the test pins the rule that
makes two sentences two EFFECTS: against `Darksteel Citadel` the
destruction stops at indestructible (CR 701.7b) **and the Troll still
arrives**, because the second sentence never depended on the first. Ark
of Blight's own pattern returns empty on an indestructible target and
is right to — its whole text IS the destroy; the Slumbermound may not.

**The rest of the sweep:** the D168 chooser in three more predicate
shapes — `Goblin Bombardment`'s mana-free creature chooser on an
enchantment ping, `Goblin Sledder`'s GOBLIN subtype paying with ITSELF
(CR 113.7a), `Goblin Trenches`' LAND predicate paying for two DISTINCT
Goblin Soldiers — plus `Golgari Rotwurm`'s {B} drain; targeted
dies/ETB destroys through the trigger arrow (`Goblin Gardener`,
`Goblin Settler`) and a targeted dies counter with a controller-
restricted spec (`Goblin Assault Team`); `Gnarlback Rhino` — the
cast-targets reader with the CASTER filter KEPT, proven from the
opponent's seat the way Fugitive Druid proved it dropped; `Gods' Eye,
Gate to the Reikai` — the dies-token on a LAND and a LEGEND;
`Goldmeadow Harrier`, the FOURTH oracle id on the Benalish Trapper
text; the Golgari Cluestone/Locket pair; `Golgari Germination` —
Field of Souls' nontoken watcher with the CONTROLLER filter, its
isToken negative proven by killing its own Saproling; two Goblin ETB
token makers on the token tool's own pin; and `Grandmother Sengir`,
the 55th fully-executable legendary. **The enchantment pool reads
TWENTY-FIVE.** All 21 suites — 50 tests — passed on their FIRST run,
the batch-18 fixture lesson holding (the three new token pins were
mapped from `TOKEN_TABLE`'s own printingIds before a line was written,
and the Goblin and Saproling pins were REUSED after checking they
match).

**Four refusals, TWO NEW CLASSES, both named by one page of Goblins:**
`Goblin Warrens` costs "Sacrifice two Goblins" — a MULTI-SACRIFICE
cost, and D168's `ActivateAbility.sacrifice` names ONE permanent, so
the cost has no carrier; `Graf Mole` watches "whenever you sacrifice a
Clue" — a SACRIFICE-EVENT DISCRIMINATOR, and it was CHECKED before
classifying: `EventCause` has no sacrifice kind AND a `TriggerDef`'s
`matches` receives the event BODY rather than the `GameEvent` wrapper,
so a def cannot read `cause` at all — the watcher would over-fire on
every Clue death. Plus `Goblin Picker` (discard-cost chooser) and
`Goldmaw Champion` (Boast — once-per-turn memory). The ledger holds 49.

**The numbers, every delta exactly the twenty-one cards:** primitives
`complete` 2,056 → 2,077 · `blocked` 29,615 · `scriptableToday` 916 ·
ladder [916, 1015, 2968, 4852, 6039] · botPool creature 1,405, artifact
63, **enchantment 25**, land 237 · tier3 `abilityText` 17,261, `either`
−21 exactly, `silentAfter` 2,467 → 2,488 (+21 exactly) · fixtures 513 →
537 (58 tokens: colorless Spirit `tema 1`, Goblin Soldier `tema 15`,
Troll Warrior `tkhm 16` joined; Goblin `l12 1` and Saproling `tddj 1`
reused) · `batch.json` at **784** (809 − 21 − 4, exact) · botDeck
regenerated — **Adun reaches 1,152 cards choosing from 55 legendaries**
(Gnottvold Slumbermound and Gods' Eye joined the deck, displacing the
Haunted pair).

⚠️ **The first full-gate run failed on the TRANSFORM canary at GATE
SIZE — the seventh rate-canary rot, on the rarest event in the block.**
`transformedIntoPlaneswalker` was 2 per 500 at batch 17 (drawing Jace,
affording him, resolving him, AND rolling the one manual tool in nine
that flips); batch 19's DECK growth took it to ZERO across all 500
seeds with every replay hash equal at 1,404.5 s — the D175 dies-canary
profile exactly, and the same fix: FIVE copies of Jace at the deal
site, the fifth re-weight of D149's class. The gate relaunched from
the top.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 417 test files, 3,012 Vitest passed /
10 skipped · the 500-seed replay fuzz gate green at 1,357.0 s (347
scripts registered, 443 s inside the 1,800 s ceiling) ·
build clean · probe 124/124 · battery `bot engine prompts` 127/127.

**Reportables:** the multi-sacrifice cost and the sacrifice-event
discriminator join the engine-work list (the discriminator is the
richer one — a `Sacrificed` marker on the move or a cause on the BODY
would also serve Graf Mole's whole family); self-only def dispatch
(D169) stays the named fuzz lever; the answer-mode arrow and ability
rows still owe a battery click-check; the cost-chooser classes,
`ctx.random`, once-per-turn memory, per-damage-entry granularity,
token entry choice and the spell seam stand.

## D178 — M6.4v: Grave Titan, and three new classes in one letter (2026-08-14)

**What was decided:** batch 20 of the M6.4 loop lands eighteen of its
25 — **2,095 of 31,692 Commander-legal cards now execute completely, up
from 2,077** — with seven refusals, THREE of them NEW classes.
`SHIPPED_SCRIPTS` 347 → 365.

**The headliner:** `Grave Titan` — the first ENTERS-OR-ATTACKS pair:
one printed line, two defs (Ashen Rider's rule on the attack side), the
entry via `CardsMoved` and the attack via `AttackersDeclared`, each
paying two DISTINCT Zombies through D164's allocator — and one test
proves both arms in one game: two Zombies on entry, four after a real
declared attack. `Haazda Vigilante` lands the same pair with D139's
numeric restriction in the trigger's own spec (+1/+1 on a creature with
power 2 or less), and `Haazda Marshal` is Armasaur Guide's
attacker-count filter with the self-among-them condition — three
attackers with the Marshal pay the lifelink Soldier, two pay nothing,
both pinned.

**The rest:** `Greed`'s {B}-and-2-life draw (Book of Rass's cost shape,
the life charge asserted at 40 → 38); three sacrifice choosers
(`Grim Backwoods` on a land, `Gutless Ghoul` paying with ITSELF,
CR 113.7a); the Gruul Cluestone/Locket pair — the FOURTH colour pair;
dies-gains at 2 and 3 (`Grasping Longneck`, `Guardian Automaton`);
dies-debuff with the opponent-restricted spec (`Grim Physician`);
targeted ETB pumps plain and controller-restricted (`Guardian of
Pilgrims`, `Haazda Officer`); the dies counter (`Guul Draz Mucklord`);
`Graypelt Refuge`'s enters-tapped ETB gain; ETB draws and the two-Knight
`Guarded Heir` on a NEW 3/3 pin. **The enchantment pool reads
TWENTY-SIX.** All 18 suites — 41 tests — passed on their FIRST run: the
THIRD consecutive first-run-clean batch, the token pin mapped from
`TOKEN_TABLE`'s printingId before a line was written.

**Seven refusals, THREE NEW classes:** `Granite Shard` costs
"{3}, {T} or {R}, {T}" — an ALTERNATIVE ACTIVATION COST with no
carrier, where a def would charge one reading of an ambiguous price;
`Half-Elf Monk` prints "Stunning Strike — {1}{W}, {T}:" — an
ABILITY-WORD ACTIVATED COST, the em-dash label sitting inside the cost
string (named as a parse-widening candidate: scrubbing ability words is
likely a small fix); `Halo Scarab` activates "{2}, Exile this card from
your graveyard:" — a GRAVEYARD-ACTIVATED ABILITY, and the ability
itself lives in a zone `legal.ts` never offers from. Plus
exile-from-graveyard twice (`Great Arashin City`, `Grim Lavamancer`),
Boast (`Hagi Mob`), and `Halimar Depths`' ETB look-and-order
(script-raised prompt). The ledger holds 56.

**The numbers, every delta exactly the eighteen cards:** primitives
`complete` 2,077 → 2,095 · `blocked` 29,597 · `scriptableToday` 898 ·
ladder [898, 997, 2950, 4834, 6021] · botPool creature 1,418, artifact
65, **enchantment 26**, land 239 · tier3 `abilityText` 17,249, `either`
−18 exactly, `silentAfter` 2,488 → 2,506 (+18 exactly) · fixtures 537 →
556 (59 tokens: the 3/3 Knight `tfdn 4` joined; Zombie `tc14 16` and the
lifelink Soldier `tmom 2` reused) · `batch.json` at **759** (784 − 18 −
7, exact) · botDeck regenerated — **Adun reaches 1,163 cards from 55
legendaries**.

**The first full-gate run failed on the MAY-TRIGGER canary rotting on
schedule** — `Ajani's Mantra` at ONE copy is the only source
`optionalTaken`/`optionalDeclined` read, and batch 20's DECK growth
diluted the compound event (dealt AND cast AND surviving to an upkeep,
then a coin flip each way) to ZERO at the 60-seed leg with every replay
hash equal — the 500-seed gate leg itself was green at 1,437.7 s. Five
copies now (D149's fix, EIGHTH instance of the class, Onulet's profile
one prompt over); the gate relaunched from the top.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 435 test files, 3,085 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,394.8 s (365 scripts registered,
405 s inside the 1,800 s ceiling) · build clean · probe 124/124 ·
battery `bot engine prompts` 127/127.

**Reportables:** the ability-word activated cost is the cheapest new
class ever named (a scrub, not a seam) and Granite Shard's alternative
cost the most structural; the multi-sacrifice and sacrifice-event
discriminator classes stand from D177; self-only def dispatch (D169)
stays the named fuzz lever; the answer-mode arrow and ability rows owe
a battery click-check; `ctx.random`, once-per-turn memory,
per-damage-entry granularity, token entry choice and the spell seam
stand.

## D179 — M6.4w: the multicolored filter, and a draw nothing can watch (2026-08-14)

**What was decided:** batch 21 of the M6.4 loop lands twenty-one of its
25 — **2,116 of 31,692 Commander-legal cards now execute completely, up
from 2,095** — with four refusals, THREE of them NEW classes for the
second batch running. `SHIPPED_SCRIPTS` 365 → 386.

**The headliners:** `Hero of Precinct One` is the first MULTICOLORED
cast filter — D'Avenant Trapper's access to the face actually cast with
the colour COUNT as the question (colour identity would be wrong: a
mono-colour card with a hybrid identity is not a multicolored SPELL),
proven from both sides with Baleful Strix paying a Human and Grizzly
Bears paying nothing. `Harrier Griffin` is the first UPKEEP trigger
that TARGETS — Celestial Force's `StepBegan` with Eidolon of
Inspiration's active-player filter and the tap resolve on the answer,
its test pinning that the prompt arrives on the CONTROLLER's turn.
`Hatching Plans` is the enchantment that wants to die — the dies filter
under its long-form "is put into a graveyard from the battlefield"
wording, drawing three.

**The rest:** `Heartwood Giant` composes the FOREST predicate with the
staged target chain (a Forest and the tap deal 2 to a chosen player; a
non-Forest land is `illegalSacrifice`); `Herald of the Fair` lands
Haazda Officer's EXACT text on its own oracle id (the Benalish
precedent); the controlled-entry watcher lands as TWINS in one batch
(`Healer of the Pride` at 2, `Hinterland Sanctifier` at 1 — both
proven three ways: self entry pays nothing, mine pays, an opponent's
pays nothing); `Headless Rider`'s self-OR-other nontoken Zombie dies
watcher is proven by killing its OWN token for nothing; `Hoard Robber`
is Belligerent Guest's combat-damage watcher paying Treasure;
`Hobbling Zombie` leaves the decayed 2/2 behind; `Hell's Kitchen` is
Fisk Tower's exact three-line shape in Rakdos colours; `Heart Warden`
and `High Market` carry `#a1` sacrifice payoffs (the Warden paying with
ITSELF); `Heavy Infantry` re-proves Chrome Prowler's opponent
restriction; four ETB gains at 3/3/4 and a dies-gain pair round it
out. **The enchantment pool reads TWENTY-SEVEN.** All 21 suites — 51
tests — passed on their FIRST run: the FOURTH consecutive
first-run-clean batch.

**Four refusals, THREE NEW classes:** `Hardened Tactician` pays with
"a token" — `predicatesOf` models card TYPES and SUBTYPES, and
token-ness is neither (isToken lives on the INSTANCE), so the D168
carrier cannot read the predicate (TOKEN-PREDICATE SACRIFICE COST — a
cheap-ish widening: a token flag on the predicate plus isToken in
`sacrificeCandidatesFor`). `Hatchet Bully` PUTS a -1/-1 counter on a
chosen creature as a cost (PUT-COUNTER COST — the other direction from
Bolrac-Clan's remove-counter). `Horizon Chimera` watches "whenever you
draw" and there is NO DRAW TO WATCH: `drawFromTop` emits a bare
`CardsMoved` library→hand, indistinguishable from an Impulse-take or a
manual wrench move, and `matches` receives the event BODY — the
sacrifice-event discriminator (Graf Mole, D177) one event over
(DRAW-EVENT DISCRIMINATOR; a `DrewCards` marker or an is-draw flag on
the move is the missing piece, and the family behind it is large).
Plus `Hand of Justice` (tap-creatures cost, existing). The ledger
holds 60.

**The numbers, every delta exactly the twenty-one cards:** primitives
`complete` 2,095 → 2,116 · `blocked` 29,576 · `scriptableToday` 877 ·
ladder [877, 976, 2929, 4813, 6000] · botPool creature 1,436, artifact
65, **enchantment 27**, land 241 · tier3 `abilityText` 17,231,
`payable` 5,168 (−3, the def-gated activated costs), `either` −21
exactly, `silentAfter` 2,506 → 2,527 (+21 exactly) · fixtures 556 →
578 (60 tokens: the 1/1 white Rabbit `tclb 4` joined; Zombie
`tc14 16`, decayed Zombie `tdrc 7`, Human `tfdn 3` and Treasure
`trna 12` REUSED, all four checked against TOKEN_TABLE's printingIds
before a line was written) · `batch.json` at **734** (759 − 21 − 4,
exact) · botDeck regenerated — **Adun reaches 1,174 cards from 55
legendaries**.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 456 test files, 3,178 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,553.4 s (386 scripts registered,
247 s inside the 1,800 s ceiling — the headroom is thinning on
schedule; self-only def dispatch, named since D169, is approaching
due) · build clean · probe 124/124 · battery `bot engine prompts`
127/127.

**Reportables:** the draw-event discriminator is the richest new class
(a `DrewCards` marker unlocks the whole "whenever you draw" family)
and the token-predicate the cheapest; the put-counter cost joins the
cost-chooser ledger; D178's classes (alternative activation cost,
ability-word activated cost, graveyard-activated ability) stand;
self-only def dispatch (D169) stays the named fuzz lever; the
answer-mode arrow and ability rows owe a battery click-check;
`ctx.random`, once-per-turn memory, per-damage-entry granularity,
token entry choice and the spell seam stand.

## D180 — M6.4x: attacks alone, four Hornets, and the Plains that is its own plural (2026-08-14)

**What was decided:** batch 22 of the M6.4 loop lands twenty of its 25 —
**2,136 of 31,692 Commander-legal cards now execute completely, up from
2,116** — with five refusals, TWO of them NEW classes. `SHIPPED_SCRIPTS`
386 → 406, past four hundred.

**The headliner is a parser bug the batch's own test forced out:**
`Idyllic Grange` counts "three or more other Plains", and D135's
`otherLandsOfType` pattern strips a trailing `s` — so the capture read
**"Plain", a subtype no land has, and the count read zero forever.**
PLAINS IS ITS OWN PLURAL, the only basic whose printed plural equals its
subtype; every earlier consumer counted Forests or Mountains (whose
plurals ARE subtype+s) and was correct, so the bug sat latent since D135
in exactly the shape D135 itself warned about — the failure that looks
like the feature working, because a land entering tapped is what you get
when a condition never holds. Fixed in `replacementParse` with the
special case named; the Grange's suite proves both halves both ways
(untapped-and-asks behind three Plains, tapped-and-silent alone).

**The firsts:** `Imperial Subduer` is the first ATTACKS-ALONE filter —
exactly ONE declared attacker, and that one a controlled
Samurai-or-Warrior, with the two-attacker negative pinned. `Hornet
Queen` makes FOUR deathtouch-flying Insects with distinct ids — the
largest single token drop a script has made (NEW pin `tc21 17`, whose
keywords are its identity, D131). `Ichor Wellspring` is the
enters-OR-dies pair on an ARTIFACT (Ashen Rider's rule, both arms drawn
in one game).

**The rest:** `Hurler Cyclops` rides the chooser+target chain with the
"another" predicate (it can never eat itself, `illegalSacrifice`
pinned); `Insight` pays only on an OPPONENT'S green cast (Arasta's
filter with Hero of Precinct One's colour access, both sides proven);
`Iceridge Serpent` bounces to the OWNER's hand; `Indrik Stomphowler`
destroys through the indestructible check (Darksteel Myr survives);
`Hyrax Tower Scout` untaps on entry (the upright-target guard);
`Icatian Priest` is the activated targeted pump; `Impassioned Orator`
lands the Sanctifier text's THIRD id; `Hobbling`-style dies-tokens on
the lifelink Soldier and a NEW BG flying Insect (`tdsk 13`);
`Illegitimate Business` is Fisk Tower's three-line shape a third time;
`Humbling Elder` and `Hornet Harasser` debuff from entry and death.
**The enchantment pool reads TWENTY-EIGHT.** 19 of 20 suites were green
on their FIRST run; the twentieth (Idyllic Grange) failed on the
Plains-plural bug above, which is the test doing its job.

**Five refusals, TWO NEW classes:** `Icebind Pillar` pays {S} — the
engine has NO snow-source concept anywhere in payment or mana, so
charging the {T} without the {S} would be half-execution (SNOW
ACTIVATION COST). `Illuminated Folio` pays by revealing two cards from
hand that share a colour — the discard-cost chooser's shape over a
hidden zone plus a constraint the prompt must validate (REVEAL-COST
CHOOSER). Plus a discard-cost chooser (Icatian Crier), a script-raised
prompt (Inkfathom Divers), and `Infernal Tribute` — Hardened
Tactician's NONTOKEN mirror, the token-predicate class from D179
holding both directions. The ledger holds 65.

**The numbers, every delta exactly the twenty cards:** primitives
`complete` 2,116 → 2,136 · `blocked` 29,556 · `scriptableToday` 857 ·
ladder [857, 956, 2909, 4793, 5980] · botPool creature 1,451, artifact
67, **enchantment 28**, land 243 · tier3 `abilityText` 17,214,
`payable` 5,165 (−3, the def-gated costs), `either` −20 exactly,
`silentAfter` 2,527 → 2,547 (+20 exactly) · fixtures 578 → 600 (62
tokens: the deathtouch-flying Insect `tc21 17` and the BG flying
Insect `tdsk 13` joined; Food `tunf 10`, Wolf `tlrw 10` and the
lifelink Soldier `tmom 2` REUSED, all checked against TOKEN_TABLE's
printingIds first) · `batch.json` at **709** (734 − 20 − 5, exact) ·
botDeck regenerated — **Adun reaches 1,185 cards from 55 legendaries**.

**The first full-gate run failed on the CR 616 PAIR canary rotting on
schedule** — `replacementChoices` read ZERO at gate size with every
replay hash equal. A PAIR canary rots QUADRATICALLY: both cards must
share one battlefield, so DECK density decay hits the compound rate
twice — five copies each (D164's fix) survived a ~250-name list, and at
~500 names the true rate had fallen to ~1–3 per 500. Both cards are
FIFTEEN copies now (~9× the compound rate), the NINTH instance of the
class and the second re-weight of this canary; its comment now says the
third rot earns a canary-staples mechanism in the deck builder, not a
fourth multiplication. The gate relaunched from the top.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 476 test files, 3,266 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,774.5 s (406 scripts registered
plus the pair re-weight's thirty extra names, **26 s inside the
1,800 s ceiling — THE WALL D169 NAMED HAS ARRIVED**: self-only def
dispatch is DUE as the next commissioned engine work, the D162
precedent, before batch 23 can gate) · build clean · probe 124/124 ·
battery `bot engine prompts` 127/127.

**Reportables:** the snow cost is a bounded engine gap (a snow flag on
mana sources plus a payment branch); the reveal-cost chooser joins the
cost-chooser ledger beside discard; D179's draw-event discriminator
stands as the richest class; self-only def dispatch (D169) stays the
named fuzz lever with the headroom thinning; the answer-mode arrow and
ability rows owe a battery click-check; `ctx.random`, once-per-turn
memory, per-damage-entry granularity, token entry choice and the spell
seam stand.

## D181 — The lever that measured flat, and the third ceiling (2026-08-14)

**What was decided:** the fuzz gate's ceiling rises 1,800 s → 3,600 s —
the THIRD raise, on the criterion the last two wrote down: a
completed-and-equal run proving growth rather than a hang (D180's round
31 finished all 500 seeds with every replay hash equal at 1,774.5 s,
26 s under the old ceiling). And the lever that was supposed to prevent
this raise is RETIRED, because it was finally tried and measured FLAT.

**The lever's story, told honestly:** "self-only def dispatch" has been
the named next fuzz lever since D169, re-named in D173, D174, D175,
D176, D177, D179 and D180 — eight decisions of deferred confidence.
Implemented, it is a two-line reorder: the candidate loop ran
`hasAbilities` (a DERIVE — the D129 cost center) before `matches` (a
cheap `ev.moves.some` for almost every candidate an event does not
involve), and both are pure filters joined by AND, so asking the cheap
question first is structurally identical by conjunction-commutes and
confines the derive to firing candidates. **Measured at 60 seeds on the
idle machine: 221.6 s before, 222.3 s after.** Zero. The derive-first
order was never the wall, because `hasAbilities` and `matches` both sit
behind D162's per-oracle index and D168's present-def memo — the bus
work per event was already near the floor. The reorder was REVERTED the
hour it was measured (D162's rule: a lever that does not move the
number does not ship), and D167's verdict is re-confirmed at 406
scripts: **the cost is the GAMES, not the bus.**

**Why the ceiling and not something else:** the wall time is the arc's
own point — more scripts mean richer games mean more events (the trend
table in the gate's comment now runs 394 s @ 57 scripts to 1,774.5 s @
406, near-linear in registered scripts). The gate is a HANG CATCHER,
not a perf referee (D133); a ceiling that the healthy wall brushes
stops distinguishing growth from hangs, which is the one job it has.
3,600 s restores ~2× headroom at the current trend — roughly forty
more batches — and the raise criterion stays: a third raise happens
only after another completed-and-equal run proves the next brush is
still growth.

**This commit lands NO cards** — a test-config constant, a reverted
experiment, and these documents. D170's precedent: the ceiling raise
rides its own commit and the NEXT batch's full gate exercises it.
`npm run build` clean; the 60-seed leg green at 222.3 s (both orders).

**Reportables:** "self-only def dispatch" is STRUCK from the standing
reportables — tried, measured, retired. If wall TIME itself ever
becomes the problem (not the ceiling), the levers are game-shaped:
fewer intents per seed, a seed-count profile, or parallel shards —
each a gate-strength tradeoff to be priced, not assumed. The
answer-mode arrow and ability rows still owe a battery click-check;
`ctx.random`, once-per-turn memory, per-damage-entry granularity,
token entry choice, the spell seam, and the cost-chooser classes
(discard, reveal, tap-creatures/permanents, exile-from-graveyard,
remove-counter, put-counter, token-predicate, multi-sacrifice,
return-permanent, snow) all stand, with the draw-event discriminator
(D179) still the richest.

## D182 — M6.4z: attacks or blocks, and a four-id text family (2026-08-14)

**What was decided:** batch 23 of the M6.4 loop lands twenty-two of its
25 — **2,158 of 31,692 Commander-legal cards now execute completely, up
from 2,136** — with three refusals, ONE of them a NEW class.
`SHIPPED_SCRIPTS` 406 → 428.

**The headliner:** `Jedit Ojanen of Efrava` is the first
ATTACKS-OR-BLOCKS pair — one printed line, two defs, and the blocks arm
is **the first `BlockersDeclared` consumer this engine has**: the event
has carried `blocks: {blocker, attacker}[]` since M3 with nothing
watching it. Both arms make the forestwalk Cat Warrior (NEW pin
`tc18 15`), and the blocks test drives a REAL scripted attack from the
opponent's seat (`fullControl(p2)` holds the declaration open — the
harness idiom for making the scriptless seat act).

**The families:** the +1/+1-counter targeted entry lands as a FOUR-ID
text family — `Ironpaw Aspirant`, `Ironshell Beetle` and `Jeong Jeong's
Deserters` carry the identical line and `Iron Bully` the same line
behind a Menace header — the largest single-text family yet, each
proven on its own registration. `Jayemdae Tome` carries `Arcane
Encyclopedia`'s exact "{4}, {T}: Draw a card." back to D159's very
first activated def. The Izzet Cluestone/Locket pair joins as the
fifth colour pair, with `Jeskai Banner` extending the shape to three
colours.

**The rest:** `Intrepid Hero`'s tap-destroy behind D139's numeric spec
(a power-6 Grave Titan dies, a power-2 Bears is refused);
`Ivy Lane Denizen`'s controlled-entry watcher with a COLOUR filter on
the derived entrant, its payoff a targeted counter (a white creature
entering pays nothing); `Izzet Chronarch` returning a chosen instant
from the graveyard through D138's spec; `Inspired Insurgent`'s
self-sacrifice destroy; `Jade Mage` making two Saprolings in one turn;
`Jarvis, Earth's Mightiest Butler`'s Hero-subtype cast-watcher —
proven positive with `Spider-Ham, Peter Porker`, **the first
Hero-subtype fixture** (no fixture carried the subtype, so the batch
queried the database for the cheapest one rather than testing only the
negative); `Jeska, Warrior Adept`'s tap-ping; `Jandor's Saddlebags`'
targeted untap; two ETB gain-4s; a dies-draw. **Three more
fully-executable legendaries — the pool reads 58.** All 22 suites — 48
tests — passed on their FIRST run.

**Three refusals, ONE NEW class:** `Jandor's Ring` pays by discarding
"the last card you drew this turn" — the engine tracks NO per-turn
draw identity (LAST-DRAWN-CARD MEMORY COST, the draw-event
discriminator's sibling: there is not even a draw event, let alone a
memory of which card came last). Plus a discard-cost chooser
(`Insolent Neonate`) and a remove-counter cost (`Ion Storm`). The
ledger holds 68.

**The numbers, every delta exactly the twenty-two cards:** primitives
`complete` 2,136 → 2,158 · `blocked` 29,534 · `scriptableToday` 835 ·
ladder [835, 934, 2887, 4771, 5958] · botPool creature 1,468,
**artifact 72** (+5: the Izzet pair, the Banner, the Saddlebags, the
Tome), enchantment 28, land 243 · tier3 `abilityText` 17,201,
`payable` 5,156 (−9, the def-gated costs), `either` −22 exactly,
`silentAfter` 2,547 → 2,569 (+22 exactly) · fixtures 600 → 625 (64
tokens: the Ally `ttla 8` and the forestwalk Cat Warrior `tc18 15`
joined; the Saproling `tddj 1` REUSED; plus the Spider-Ham helper) ·
`batch.json` at **684** (709 − 22 − 3, exact) · botDeck regenerated —
**Adun reaches 1,194 cards from 58 legendaries**.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 498 test files, 3,358 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,982.2 s (428 scripts registered,
1,618 s inside the 3,600 s ceiling — the FIRST run under D181's raise,
and it would have BREACHED the old 1,800 s: the raise landed exactly
on time) · build clean · probe 124/124 · battery `bot engine prompts`
127/127.

**Reportables:** the last-drawn-card memory cost stacks on D179's
draw-event discriminator — a `DrewCards` event with the card id would
unlock BOTH classes at once, which strengthens that reportable's case;
the cost-chooser classes, `ctx.random`, once-per-turn memory,
per-damage-entry granularity, token entry choice, the spell seam, and
the battery click-check debt stand.

## D183 — M6.4aa: the historic watcher, and a gift nothing can give (2026-08-14)

**What was decided:** batch 24 of the M6.4 loop lands twenty-one of its
25 — **2,179 of 31,692 Commander-legal cards now execute completely, up
from 2,158** — with four refusals, ONE of them a NEW class.
`SHIPPED_SCRIPTS` 428 → 449.

**The headliners:** `Jhoira, Weatherlight Captain` pays on HISTORIC
casts — D'Avenant Trapper's filter (Artifact type, Legendary supertype,
or Saga subtype, off the face actually cast) finally paying its
controller in cards, proven from both sides with an artifact cast
drawing and a plain creature paying nothing. `Keeper of Fables` reads
the DERIVED dealer on `CombatDamageDealt` — mine, a Creature, and NOT a
Human — with the per-event batch as the card's own "one or more"
wording (D170's argument), the Human negative driven through a real
declared attack. `Junktown` pays {4}{R}, the tap and itself for THREE
Junk with distinct ids.

**The rest:** the Treasure twins (`Jewel Thief` entering, `Jewel-Eyed
Cobra` dying); THREE more Fisk-shape refuges (`Jungle Hollow` carrying
Illegitimate Business's EXACT text, `Jwar Isle Refuge`, `Kazandu
Refuge`) plus `Kabira Crossroads` on a mono-coloured mana line paying
2; the `Kami of Ancient Law` / `Keening Apparition` EXACT-text pair
(no-mana self-sacrifice enchantment destroy, both proven on their own
ids); `Kami of Twisted Reflection` bouncing my own creature home;
`Kapsho Kitefins` — the self-INCLUSIVE controlled-entry watcher whose
printed line spells the self arm out, asking to tap an opponent's
creature on every entry; `Kabuto Moth`'s asymmetric +1/+2 tap-pump;
`Kamahl, Pit Fighter`'s tap-ping at 3; `Juniper Order Druid` untapping
a LAND; three ETB draws and an entry debuff. **Two more legendaries —
the pool reads 60.** All 21 suites — 45 tests — passed on their FIRST
run.

**Four refusals, ONE NEW class:** `Jolly Gerbils` triggers "whenever
you GIVE A GIFT" — the engine has no gift concept anywhere (a
cast-time promise on gift-carrying spells; nothing raises, records or
fulfils one): the GIFT MECHANIC class. Plus once-per-turn memory
(`Jori En`'s second-spell wording, Clarion Spirit's exact ledger
entry), a tap-creatures cost (`Keeper of the Nine Gales`), and a
multi-sacrifice cost (`Keldon Arsonist`). The ledger holds 72.

**The numbers, every delta exactly the twenty-one cards:** primitives
`complete` 2,158 → 2,179 · `blocked` 29,513 · `scriptableToday` 814 ·
ladder [814, 913, 2866, 4750, 5937] · botPool creature 1,484, land 248
(+5: the refuges, the Crossroads, Junktown) · tier3 `abilityText`
17,187, `payable` 5,149 (−7, the def-gated costs), `either` −21
exactly, `silentAfter` 2,569 → 2,590 (+21 exactly) · fixtures 625 →
646 (64 tokens — NO new pins: Treasure `trna 12`, the hexproof Merfolk
`txln 3` and the Junk `tpip 15` all REUSED, checked against
TOKEN_TABLE's printingIds first) · `batch.json` at **659** (684 − 21 −
4, exact) · botDeck regenerated — **Adun reaches 1,206 cards from 60
legendaries**.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 519 test files, 3,445 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,931.0 s (449 scripts registered,
1,669 s inside the 3,600 s ceiling — 51 s FASTER than round 32 despite
21 more scripts, which is seed-mix variance and the reason wall-clocks
are read against the trend, never a single run) · build clean · probe
124/124 · battery `bot engine prompts` 127/127.

**Reportables:** the gift mechanic joins the named-classes list at the
structural end (a cast-time promise needs its own state); the
`DrewCards` event stays the highest-value single unlock (both draw
classes at once); the cost-chooser classes, `ctx.random`,
once-per-turn memory, per-damage-entry granularity, token entry
choice, the spell seam, and the battery click-check debt stand.

## D184 — M6.4ab: zero new classes, and the substring that refused a fresh card (2026-08-14)

**What was decided:** batch 25 of the M6.4 loop lands twenty of its 25 —
**2,199 of 31,692 Commander-legal cards now execute completely, up from
2,179** — with five refusals and, for the first time since D175, **ZERO
new refusal classes**: every refusal is an existing named gap, which is
the ledger's drainage doing its job. `SHIPPED_SCRIPTS` 449 → 469.

**The pipeline bug the batch's own landing exposed:** `land.cjs`'s
already-landed check was a plain `includes()` substring test, and
`KINGFISHER_SCRIPT` is a substring of batch 24's
`ITHILIEN_KINGFISHER_SCRIPT` — so the tool refused a FRESH card the day
the shorter name followed the longer one in. Fixed with a word-boundary
match (`_` is a word character, so `\bKINGFISHER_SCRIPT\b` correctly
rejects the embedded hit while catching genuine duplicates); the check
runs before any write, so nothing had landed and the tree was clean.

**The firsts and families:** `Kor Line-Slinger` taps behind D139's
numeric CEILING ("power 3 or less" — the floors' mirror, a power-6
Grave Titan refused), with `Law-Rune Enforcer` beside it on the
mana-value floor; `Khalni Garden` is the entry-tapped land paying a
TOKEN (the Plant), Fisk's shape with a body instead of life;
`Keldon Necropolis` puts the chooser+target chain on a legendary LAND;
`Knight of Doves` watches my ENCHANTMENTS dying (Golgari's watcher one
type over, the creature negative pinned); `Knightfisher`'s
nontoken-Bird watcher is deliberately ONE def — a token Bird is
excluded by the printed word, so a `TokenCreated` arm would be dead
code wearing coverage, and the Fish it makes proves the filter by its
own entry; `Kor Celebrant` is the self-inclusive gain (Kapsho's
qualifies paying life); `Ley Druid` carries `Juniper Order Druid`'s
EXACT text one batch later, and `Kingfisher` hands `Ithilien
Kingfisher` back its original. Plus the OR-predicate draw
(`Kingpin's Enforcers`), the Selesnya Foggy Bottom (`Kyoshi Village` —
whose test taught that an enters-tapped land must be straightened
before its {T} cost can pay), two Ally makers, the UW vigilance
Knight, dies/ETB counters with the own-side spec, and three gains. All
20 suites — 45 tests — green (19 first-run; Kyoshi Village's failure
was the TEST paying {T} from a tapped land, not the engine).

**Five refusals, all existing classes:** exile-from-graveyard (Kessig
Wolfrider), remove-counter (Korozda Gorgon), multi-sacrifice
(Krark-Clan Engineers), discard-cost (Kris Mage), tap-creatures (Kyren
Negotiations). The ledger holds 77.

**The numbers, every delta exactly the twenty cards:** primitives
`complete` 2,179 → 2,199 · `blocked` 29,493 · `scriptableToday` 794 ·
ladder [794, 893, 2846, 4730, 5917] · botPool **creature 1,500 — the
pool crosses fifteen hundred**, artifact 73, land 251 · tier3
`abilityText` 17,174, `payable` 5,142 (−7, def-gated), `either` −20
exactly, `silentAfter` 2,590 → 2,610 (+20 exactly) · fixtures 646 →
670 (68 tokens: the Plant `tnec 9`, the flying Bird `trtr 1`, the UW
vigilance Knight `wmom 3` and the Fish `twho 10` joined; the Ally
`ttla 8` REUSED) · `batch.json` at **634** (659 − 20 − 5, exact) ·
botDeck regenerated — **Adun reaches 1,213 cards from 60
legendaries**.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 539 test files, 3,530 Vitest passed / 10 skipped · the
500-seed replay fuzz gate green at 1,940.6 s (469 scripts registered,
1,659 s inside the 3,600 s ceiling) · build clean · probe 124/124 ·
battery `bot engine prompts` 127/127.

**Reportables:** the zero-new-classes batch is the measurement the
ledger exists for — the refusal stream is converging on the named
engine work; the `DrewCards` event stays the highest-value single
unlock; the cost-chooser classes, `ctx.random`, once-per-turn memory,
per-damage-entry granularity, token entry choice, the spell seam, and
the battery click-check debt stand.

## D185 — M6.4ac: the classification that corrected itself (2026-08-14)

**What was decided:** batch 26 of the M6.4 loop lands fifteen of its
25 — **2,214 of 31,692 Commander-legal cards now execute completely, up
from 2,199** — the LEANEST batch of the arc, and the reason is the
useful part. `SHIPPED_SCRIPTS` 469 → 484.

**The classification corrected itself mid-write.** `Lifeblood`,
`Lifetap` and `Linden, the Steadfast Queen` were classified landable —
and writing Lifeblood's resolve exposed the fact that kills all three:
**a `resolve` receives the STACK OBJECT, not the event**, so a def
cannot count how many of an event's items matched. Per-item wording
("whenever a Mountain an opponent controls becomes tapped", "whenever
a white creature you control attacks") against a BATCHED event (a
wrench tapping two Mountains at once; two white attackers in one
declaration) under-fires — pays one where the rules pay two — which is
half-execution, and EXACTLY the granularity rule D163 refused Aya of
Alexandria under, one event kind over. The half-written module was
DELETED, the three cards joined the ledger as PER-TAP-ENTRY TRIGGER
GRANULARITY, and the batch is honest at fifteen. (The shipped
watchers this does NOT touch: self-only filters are singular by
construction; entries are one event per creature, measured in D158;
Deeproot/Keeper carry printed "one or more" wording that MATCHES the
batch.)

**What landed:** `Luke Cage, Hero for Hire` and `Luminarch Aspirant`
put Eidolon's begin-combat filter on a Treasure and a targeted counter
— the Aspirant asks for an aim EVERY combat of yours; `Madame Hydra`'s
Villain cast-watcher pays in its own kind on D160's own token pin;
`Long Feng, Grand Secretariat` watches TWO type arms die ("another"
binding only to the creature arm — a land needs no exclusion, and both
arms are proven); `Living Lightning` and `Malevolent Awakening` carry
D138's graveyard returns on a dies trigger and a chooser enchantment;
`Makeshift Munitions` is Goblin Bombardment's ping with the
OR-predicate; `Maalfeld Twins` pays two distinct Zombies from the
grave; `Lifecreed Duo` lands the Sanctifier text's FOURTH id;
`Llanowar Visionary` puts the ETB-draw ABOVE a mana line (TEXT
split[0] — the first time the trigger line comes first); a refuge text
twin, an attack-draw, a coloured-pip tap, three gains and a dies-draw
round it out. **The enchantment pool reads THIRTY; the legendary pool
63.** All 15 suites — 34 tests — passed on their FIRST run.

**Ten refusals, FOUR NEW classes:** per-tap-entry trigger granularity
(the three above); KICKER MEMORY (`Lullmage's Familiar` — a cast-time
additional-cost choice nothing records); EXPLORE MECHANIC (`Lurking
Chupacabra`); NEGATED-TYPE SACRIFICE PREDICATE (`Magmaw`'s "nonland
permanent" — `predicatesOf` has no type negation, the
token-predicate's sibling). Plus draw-event discriminator twice
(`Lyla`, `Mad Ratter`), discard-cost (`Mad Prophet`), and
random-discard (`Mage il-Vec`). The ledger holds 87.

**The numbers, every delta exactly the fifteen cards:** primitives
`complete` 2,199 → 2,214 · `blocked` 29,478 · `scriptableToday` 779 ·
ladder [779, 878, 2831, 4715, 5902] · botPool creature 1,512,
**enchantment 30**, land 252 · tier3 `abilityText` 17,162, `payable`
5,139 (−3, def-gated), `either` −15 exactly, `silentAfter` 2,610 →
2,625 (+15 exactly) · fixtures 670 → 685 (68 tokens — no new pins:
Zombie `tc14 16`, Treasure `trna 12` and the Villain `tmsh 9` — D160's
own pin — all REUSED) · `batch.json` at **609** (634 − 15 − 10,
exact) · botDeck regenerated — **Adun reaches 1,222 cards from 63
legendaries** (Long Feng, Luke Cage and Madame Hydra joined).

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 554 test files, 3,594 Vitest passed /
10 skipped · the 500-seed replay fuzz gate green at 1,974.2 s (484
scripts registered, 1,626 s inside the 3,600 s ceiling) ·
build clean · probe 124/124 · battery `bot engine prompts` 127/127.

**Reportables:** the granularity family now spans damage (Aya), taps
and attack declarations — a per-item event fan-out (the bus firing a
trigger PER MATCHING ITEM of a batch, with the item on the
PendingTrigger) would unlock all three at once and joins `DrewCards`
at the top of the engine-work list; kicker and explore are structural
mechanics for the named-classes long tail; the cost-chooser classes,
`ctx.random`, once-per-turn memory, token entry choice, the spell
seam, and the battery click-check debt stand.

## D186 — M6.4ad: the attack declaration learns who it hit (2026-08-14)

**What was decided:** batch 27 of the M6.4 loop lands twenty of its 25 —
**2,234 of 31,692 Commander-legal cards now execute completely, up from
2,214** — and `SHIPPED_SCRIPTS` crosses FIVE HUNDRED (469 → 484 was last
batch; **484 → 504** here).

**The headliner is the first `DefenderRef` read in a def.**
`Meriadoc Brandybuck`'s "Whenever one or more Halflings you control
attack A PLAYER" filters the declaration on `a.defender.kind ===
'player'` — the field `AttackersDeclared` has carried since M3 with no
script consumer — and the negative is proven by aiming the same Halfling
at a planeswalker (`Grist`), which pays nothing. `Mavren Fein, Dusk
Apostle` lands the NONTOKEN-VAMPIRE attack filter beside it, and its
negative is proven with the script's OWN PRODUCT: the Vampire token the
first attack created attacks alone two turns later and pays nothing.
Both wordings print "one or more", which IS the per-declaration batch
(Deeproot's argument, D170).

**Two more firsts:** `Meltstrider Eulogist` is the first
COUNTER-CONDITIONED dies watcher — the mover's `+1/+1` counters are read
off the BEFORE state exactly the way Field of Souls reads `isToken`
(`looksBack` hands `matches` the board the creature died on, counters
still on it); a counterless creature dying draws nothing, proven from
both sides. `Merfolk Skyscout` is the first ATTACKS-OR-BLOCKS pair that
TARGETS: Jedit's two arms (D182), each carrying the trigger prompt
(D169's arrow machinery), resolving as Filigree Sages's untap — both
arms driven, the blocks arm through a real scripted attack from the
opponent's seat.

**The families:** all four MEMORIALS land in one batch beside
`Meditation Pools` — five three-line lands (enters tapped + mana +
sacrifice payoff), carrying a draw, a draw-two, two DISTINCT Soldiers, a
targeted graveyard return (D138's aim; a land card in the graveyard is
REFUSED by `cardTypes`) and a targeted land destroy whose indestructible
check earns its keep because **Darksteel Citadel is a land** — it
survives and the Memorial STAYS SPENT. `Master Decoy` is the FIFTH
oracle id on the Benalish Trapper text; `Mardu Banner` joins Jeskai as
the second Banner. `Man-o'-War`, `Manic Vandal` and `Chrome Prowler`'s
shape round out the targeted ETBs; `Mawcor` puts the tap-ping behind a
keyword line (Cackling Imp's `#a0`); dies-tokens pay a lifelink Vampire
and two DISTINCT Spirits. **The land pool reads 257 (+5), the legendary
pool 65** (Mavren, Meriadoc). All 20 suites — 44 tests — green on their
FIRST run: the FIFTH consecutive first-run-clean batch.

⚠️ **One tooling note, not a bug:** `land.cjs` derives the export from
the module filename with a lowercase→uppercase split, so `manOWar.ts`
must export `MAN_OWAR_SCRIPT` (the O→W boundary does not split). The
check refused the mismatch BEFORE writing anything — the export was
renamed to comply.

**Five refusals, TWO new classes:** the SCRY/SURVEIL EVENT
DISCRIMINATOR (`Matoya, Archon Elder` — no event marks a scry: the peek
is a Tier-3 reveal and scry/surveil are UI MODES on it, D114, so
"whenever you scry or surveil" has nothing to watch; the draw-event
discriminator's exact sibling) and the {Q} UNTAP-SYMBOL ACTIVATION COST
(`Merrow Grimeblotter` — the source must be TAPPED and untaps as the
price; no parse reads it, no charge path pays it). Plus two
discard-cost choosers (Masked Meower, Mental Discipline) and the
return-permanent cost's third entry (`Meloku the Clouded Mirror`). The
ledger holds 92.

**The numbers, every delta exactly the twenty cards:** primitives
`complete` 2,214 → 2,234 · `blocked` 29,458 · `scriptableToday` 759 ·
ladder [759, 858, 2811, 4695, 5882] · botPool creature 1,525, artifact
75, **land 257**, enchantment 30 · tier3 `abilityText` 17,151, `payable`
5,130 (−9, def-gated), `either` −20 exactly, `silentAfter` 2,625 → 2,645
(+20 exactly) · fixtures 685 → 707 (70 tokens — TWO new pins, Vampire
`tmom 3` and Robot `ttmt 10`; Spirit `tmm2 5`, Food `tunf 10` and
Soldier `t40k 2★` REUSED after checking TOKEN_TABLE's printingIds) ·
`batch.json` at **584** (609 − 20 − 5, exact) · botDeck regenerated —
**Adun reaches 1,227 cards from 65 legendaries**.

**Verified: `verify.cjs --full` — ALL FIVE GATES PASSED in one
invocation** — 574 test files, 3,678 Vitest passed /
10 skipped · the 500-seed replay fuzz gate green at 2,101.9 s (504
scripts registered, 1,498 s inside the 3,600 s ceiling) ·
build clean · probe 124/124 · battery `bot engine prompts` 127/127.

**Reportables:** the EVENT-MARKER family now has two members — a
`DrewCards` marker (both draw classes, D182) and a scry/surveil marker
(Matoya's class) — one design serving both; the untap-symbol cost joins
the cost-chooser ledger; the cost-chooser classes, `ctx.random`,
once-per-turn memory, per-damage-entry granularity, token entry choice,
the spell seam and the battery click-check debt stand.

## D187 — M6.4ae: the spell seam (2026-08-19)

**What was decided:** `CardScript` gains `spell?: SpellDef` — whole-spell
resolution for instants and sorceries — closing D160's standing headline
reportable: 6,975 spells were unreachable by scripts BY CONSTRUCTION while
`effectParse`'s closed vocabulary auto-resolved ~409. The first two spell
defs ship as proof cards: **`Char`** (targeted, two damage clauses — the
vocabulary reads it only in part) and **`Fruition`** (untargeted,
board-computed "for each Forest" — outside the vocabulary entirely).
**2,237 of 31,692 Commander-legal cards now execute completely,
up from 2,234.** `SHIPPED_SCRIPTS` 504 → 507.

**The seam point is `resolveTop`, and it inherits everything.** The def is
consulted where the vocabulary ran (loop.ts): fizzle is already decided
(CR 608.2b `targetsStillLegal` — a scripted spell whose targets all died is
countered on resolution and the def never runs), and the spell is still ON
the stack while resolving (CR 608.2 — Char has a live source for its
damage). **The def OUTRANKS the vocabulary and exactly ONE of the two
runs** — a def claims the whole card, so running `effectResult` after it
would double every clause the parser also understood.

**The double-execution hazard, found at design time:** `effectMode` is a
PARSE-time property, so a scripted spell whose text parses `assisted` would
run its script AND raise the D90 assisted offer — the parsed half executing
TWICE. Closed in `client.assistedEffectsFor`: the SHIPPED registry ships in
the bundle, so the client asks `SHIPPED_REGISTRY.spell(oracleId)` directly,
no wire change. Char's own test pins both halves of the predicate (the
vocabulary must NOT fully read it; the registry must carry the def).

**The accounting moved as one chokepoint (D158's design paying off):**
`lineClaims` gains the spell kind — a `SpellDef.text` is the face's FULL
printed text, split per line into sentence-kind claims, so a def that
stopped short leaves a leftover line and the coverage gate refuses the card
(D90). And the disclosure needed its own key: the teeth caught both proof
cards engine-complete while still carrying tier3's "Its effect" note —
`SHIPPED_SPELL_ORACLES` (built beside the claims, D159's
`SHIPPED_ACTIVATED_REFS` idiom) silences the "Its effect" / "Part of its
effect" notes exactly for scripted spells.

**Also: the registry refuses duplicates now.** `IndexedRegistry` silently
OVERWROTE `byOracle` on a duplicate oracleId while APPENDING its trigger
defs — a twice-registered card double-fires with `get()` reporting one
script. Latent since M3 with hand-curated lists; near-certain under
generated family tables. A constructor throw, with its own break test.

**Selection:** the D161 "no spells" filter flips to DEF-GATED — spells are
offerable because the seam exists; each still lands as an ordinary reviewed
def. Offerable pool 584 → 583 - and the flip alone moved NOTHING, measured: the primitives classifier files an unreadable spell line under its effect-vocabulary rows (damage, lifeGainLoss), so a spell face never reaches sole-need-scriptable and the needs column CANNOT SEE the seam. The reclassification - a non-permanent face is scriptable BY THE SEAM - is its own careful decision (D191, next), with the ladder consequences it deserves (D153-grade care).

**Verified:** 579 test files, 3,701 Vitest passed / 10 skipped; the 500-seed fuzz green at 2,100.3s (507 scripts on the derived pool, 1,500s inside the 3,600s ceiling); all worktree proof suites (9 tests) green
on their first run; the 519-file engine sweep green with the seam in place;
`tsc -b` clean at every step.

**Reportables:** SpellDef v1 lands only spells whose target clauses the
parser reads (or that target nothing) — `SpellDef.targets` declared like
`TriggerDef.targets` (D147's shape) is the widening for
unread-target spells; multi-FACE spells (split/adventure) stay refused
until a face-keyed def ref; `ctx.random` still gates random spells; the
assisted-offer suppression is pinned at the predicate level — a battery
click-check joins the standing UI-coverage debt.

## D188 — M6.4ae: the fuzz gate derives its pool (2026-08-19)

**What was decided:** the fuzz gate's `SCRIPTS` and `DECK` are DERIVED from
`SHIPPED_SCRIPTS` — the ~500 hand imports and the ~630-name hand list are
GONE (≈1,200 lines), replaced by a spread and a sorted name derivation.
Every hand list is a rot site: all five broken-guard incidents in this repo
were hand-list drift (D102, D107, D108, D121, D156), and the per-batch fuzz
registration step — 20 imports + 20 SCRIPTS entries + 20 DECK names every
batch — is deleted from the loop entirely.

**What a derivation cannot know stays hand-curated in `CORE`:** the
mechanism cards, the canary staples with their DELIBERATE copy weights
(Jace ×5, Mantra ×5, Onulet ×5, the CR 616 pair ×15 — the rot-history
comments preserved verbatim), and the SUPPORT BODIES for shipped watchers
(the werewolf for Cult of the Waxing Moon, a Zombie and a vanilla Merfolk
for choosers and the tap-watcher, Tuinvale for Edgewall's adventure filter
— engine-complete through the VOCABULARY, so no derivation would deal it).

**Proven three ways in the worktree before port:** the 60-seed gate green
over the derived pool (296 s under heavy load, every replay hash equal,
all guard tests green); a one-off SUPERSET check — every one of the old
list's 601 names still dealt (the only "misses" were quoted phrases the
extractor caught inside comments); `tsc -b` clean.

**`ACTIVATED_REFS` derives too** — the canary's hand list of FOUR scripts
was the rot shape one counter over: every batch landing new ActivatedDefs
widened the real population while the counter watched the original four
forever. It now counts every shipped activated ref.

**Reportables:** CORE's staples are the raw material for the canary-staples
TABLE (counterKey → staple with a meta-guard) — next; pool rotation
(`poolFor`) and seed sharding follow it with a 60-seed measurement leg
before any ceiling move.

## D189 — M6.4ae: `DrewCards`, the real-draw marker (2026-08-19)

**What was decided:** a REAL draw (CR 121) now emits a `DrewCards` marker —
`{player, cards}` in draw order — beside the `CardsMoved` that did it. A
marker, `OptionalTriggerAnswered`'s reason turned inside out: a draw's
library→hand move is byte-identical to an Impulse-style take, a tutor, or
the manual tool, so "whenever you draw" could not be WATCHED at all —
D179's draw-event discriminator (named "the richest class") and D182's
last-drawn-card memory, both closed by one event.

**Emitted at exactly TWO sites** — the turn's draw step and `drawEvents`,
THE one draw rule (D158) — via `drewCardsMarker`, which derives the ids
from the moves the draw just produced (never recomputed, so order cannot
drift). Deliberately NOT for opening hands (no ability can watch before
the game; `drawFromTop` itself stays unmarked because the openers share
it) and NOT for takes. Reducer no-op, state unchanged, no wire change.

**Verified:** 4/4 new tests — the draw step marks, the opening hand does
not, a scripted draw (Wall of Blossoms) marks exactly its own card, a
manual library→hand move stays silent, replay hash equal with markers in
the log.

## D190 — M6.4ae: per-item fan-out (2026-08-19)

**What was decided:** `TriggerDef.perItem` — after `matches` accepts a
batched event, the bus creates ONE `PendingTrigger` PER item the def
enumerates, each carrying its item onto `StackObject.item` for `resolve`.
This closes the GRANULARITY class at the bus: per-item wording against a
batched event under-fired and was refused outright — Aya's D163 class, met
again on the receiver side (D172), on taps and attacks (D185) and on draws
(D186). `CombatDamageDealt`, `PermanentsTapped`, `AttackersDeclared` and
`DrewCards` all batch; a per-item def now pays N where the rules pay N.

**Omit it where the batch already matches:** self-only filters,
per-creature entries and printed "one or more" wordings (D185's list) —
fanning those out would OVER-fire instead. The item ids arrive in the
event's own order, so the firing sequence is deterministic and replays;
`PendingTrigger.item`/`StackObject.item` are optional, so every pre-D190
pending and its replay is untouched.

**Proof card: `Horizon Chimera`** — the card D179 named when it named the
class — "Whenever you draw a card, you gain 1 life" composed over BOTH new
seams: an Azorius Locket draw-two fires the trigger TWICE (one per drawn
card, +2 life), a manual library→hand take pays NOTHING, an opponent's
draw pays nothing, replay hash equal. The ledger's Horizon Chimera entry
self-drains at port (the stale-refusal guard).

**Reportables:** the granularity family's remaining ledger entries
(per-damage both sides, per-tap-entry ×3, per-attacker wordings) are now
each ONE def away — a wave drains them; amount-reading damage triggers
("gain that much") need the item to carry the AMOUNT too (v2: a typed
item union, sized when a wave needs it); Jandor's Ring's last-drawn memory
reads the latest `DrewCards` tail at activation — buildable now.

## D191 — M6.4af: the spell reclassification — the seam's pool-opener (2026-08-19)

**What was decided:** `primitiveFor` takes a third parameter, `spellFace`,
and for a NON-PERMANENT face's line everything past the RULES scan files
`scriptable` unless `SPELL_STRUCTURAL` matches. `primitivesFor` derives
`spellFace` per face from `parseTypeLine(...).types` — Instant or Sorcery.
The branch sits AFTER the RULES rows, so a spell line a RULES row caught
keeps its row: ONLY the residue spills.

**Why:** D187 built the seam and measured the selection flip moving NOTHING
(offerable 584 → 583) — the classifier filed unreadable spell lines under
effect rows and the residue, so no spell ever reached sole-need-`scriptable`
and the needs column could not SEE the seam. A `SpellDef` resolves the
WHOLE spell text, so for a spell the effect vocabulary is not the blocker —
only what a `resolve` cannot express is.

**`SPELL_STRUCTURAL` names what a resolve cannot express:** modal choices,
"at random" and coin/roll until `ctx.random` is wired, votes, copies,
exchanges, extra turns, outside-the-game, `unless` payments,
divided/distributed damage and "any number of", searches and shuffles
(choice prompts over hidden zones), player choices, and the D132
double-space scrub gap. **Plus four CAST-TIME PROPERTY rows the first
measurement caught overclaimed:** the first cut moved `cantBeCountered`
109 → 69 — but "can't be countered" is a property of the spell ON THE
STACK (spec §4.8), an additional cost is charged at CR 601.2, and a
cast-only / spend-only restriction gates casting legality; a `resolve` runs
at RESOLUTION and can express none of them. They are one-line spells, so
they would have surfaced at the FRONT of a lines-count-ordered wave as
guaranteed refusals. With the four rows added, scriptableToday came back
2,497 → 2,453 and `cantBeCountered` restored to EXACTLY 109 — the regex
hit precisely its class.

⚠️ **AN EXCLUSION LIST BOUNDS THE OVERCLAIM, IT DOES NOT PERFECT IT.** A
structural shape the list misses files scriptable and surfaces at DRAFT
time as a refusal — the D163 REFUSED ledger is the backstop, and a refusal
class named there twice earns its row HERE. The list errs narrow on
purpose: a row too wide silently re-blocks real wave material, which is
the failure this decision exists to end.

**Measured:** scriptableToday **758 → 2,453**; the ladder [758, 857, 2810,
4694, 5881] → **[2453, 2552, 4526, 6434, 7641]**; the four-primitive
multiplier 5.1× → 3.1× — the report's own headline note coming true:
"if that number is large, the library is the bottleneck", and now it is.
The secondary rows drained in mirror — damage 1,327 → 839 · exile
1,263 → 942 · lifeGainLoss 938 → 696 · drawDiscard 577 → 369 ·
staticShell 1,017 → 765 · tokensAndCounters 507 → 376 · other
5,422 → 3,818 · attackBlock 999 → 994 · triggeredShell 2,509 → 2,500 ·
wardHexproofGrant 49 → 48 · gainControl 95 → 66. **The OFFERABLE pool
TRIPLES: 583 → 2,020** (rung 1 = 32 — the user's own decks' spells are
back in reach; rung 2 = 3; rung 3 = 1,985). `complete` is UNCHANGED at
2,237 — a reclassification, not a card — and the engine is untouched.

**Break-evidence (D153's pattern):** with the branch disabled the OLD pins
reproduce byte-for-byte — 758, the old ladder, damage 1,327, lifeGainLoss
938 — and the new unit block fails on its own subject. A pure
reclassification, decided by one branch. The unit block asserts the rule
without the database: Fruition's own line (the shipped SpellDef proof)
scriptable as a spell face and `unclassified` as a permanent,
modal/coin/`unless` never scriptable, a RULES row (`effect:search`)
keeping its claim on a spell face, the double-space guard refusing.

**Reportables:** wave 1 on the widened pool is family-heavy — the
parametric damage/pump/draw twins surface first under lines-count
ordering; the STRUCTURAL rows shrink as engine wiring lands
(`ctx.random` un-guards "at random" and coin/roll; script-raised prompts
un-guard searches); multi-face spell faces stay refused at selection
(SpellDef v1 is single-faced); the gate-rework steps (canary-staples
table, pool rotation, seed sharding) are due before waves scale to
50–100.


## D192 — M6.4ag: wave 1 — the first SpellDef batch at scale (2026-08-19)

**What was decided:** sixteen SpellDefs landed from the D191-widened pool's
first selection — all rung 1, the user's own decks — through the D187 seam:
the rituals (`Dark Ritual`, `Pyretic Ritual`, `Seething Song`, and
`Mana Geyser` counting opponents' tapped lands at resolution — the FIRST
mana-adding resolves, through the same `ManaAdded` a land writes), the
wraths (`Damnation`, `Fumigate` counting only what it actually destroyed,
`Slash the Ranks` reading every player's `commanderIds` for the exemption,
`Solar Blaze`, and `Fell the Mighty` reading the target's DERIVED power as
its bar — all batched into ONE CardsMoved so the deaths are simultaneous,
all skipping indestructible), the fights (`Prey Upon` both ways with each
side's riders, `Rabid Bite` one-way — the deathtouch Strix proves the
difference from both sides), `Chandra's Ignition` (one chosen source, its
riders on every entry, poison vs wither split per target kind — D174's
combat rule), `Squall Line` (the first X SpellDef, X off `obj.xValue`),
`Night's Whisper` (the first draw resolve through `drawEvents` — the D189
marker fires for exactly its two cards), `Infernal Grasp`, and
`Reckless Rage` (two clauses, two targets, its own parse-premise test).

⚠️ **`Damnation`'s "They can't be regenerated." is executed as NOTHING and
that is pinned as a TRIPWIRE, not asserted in prose**: the engine has no
regeneration — no shield, no effect that creates one, no SBA that consults
one — so the clause forbids a mechanism that cannot occur.
`damnation.node.test.ts` scans every engine source for `regenerat` and
fails BY FILE NAME the day that stops being true, at which point Damnation
and every wipe shipped on the same argument must join the wave that models
the interaction.

⚠️⚠️ **TWO DRAFT-TIME PULLS, BOTH BY THEIR OWN FAILING TESTS — the D187
`SpellDef.targets` reportable now has two NAMED cards.** `Bedevil`:
`targetParse` reads "A or B" but NOT the Oxford list — "target artifact,
creature, or planeswalker" parsed to `target artifact` alone, a SILENT
NARROWING (the host refused the creature by the parser's own claim).
`Fall of the Hammer`: the repeated-verb second clause parses (Reckless
Rage's premise test passes) but a mid-sentence "to another target creature"
does not — "takes at most one target". Both modules were DELETED, both
cards led into the REFUSED ledger under `spell target parse`; widening the
parser is commissioned work, never a workaround (D90).

⚠️ **THE ENGINE CORRECTED THE TESTS TWICE, and both corrections are the
system working**: `Akroma, Angel of Wrath` (the drafts' big body) has
protection from black and from red, so Bedevil ({B}{B}{R}), Fall of the
Hammer ({1}{R}) and Chandra's Ignition ({3}{R}{R}) were all REFUSED her as
a target by the targeting layer — the tests swapped to `Colossal
Dreadmaw`; and `ManualSetTapped` takes `cards` (the D113 batch), which
tsc caught before any test ran.

**The other seven refusals, classified before a line was drafted:**
`Brainstorm`, `Read the Bones`, `Introduction to Prophecy`,
`Electrodominance`, `Stinging Study` — all script-raised prompts (hand
choice + ordering, scry decisions, a free cast, the which-commander pick
under partners — **the class now holds FIVE wave-1 entries and is due**);
`Chaos Warp` (ctx.random — the shuffle permutation); `Day of Black Sun`
(temporary ability loss — `untilEndOfTurn` carries P/T only, D153, and
destroying WITHOUT the loss wrongly spares ability-indestructible
creatures). The ledger holds **100**.

**Numbers:** `complete` 2,237 → **2,253**; `SHIPPED_SCRIPTS` 507 → 523;
fixtures 710 → 727 (+17 by name, ZERO new tokens); botPool instant
202 → 208, sorcery 147 → 157; ladder [2437, 2536, 4510, 6418, 7625];
tier3 silentAfter 2,664; `batch.json` at **1,995** (2,020 − 16 landed − 9
refused, exact); rung 1 down to 7 — the user's own decks' spells are
nearly exhausted. ⚠️ **`Damnation` and `Chandra's Ignition` JOINED THE
BOT'S DECK** (Adun reaches 1,241) — the bot holds board wipes for the
first time.

**Reportables:** the script-raised-prompt seam is the arc's most-due engine
work (five entries in one wave); the spell target-parse widening has two
named cards; `ctx.random` blocks Chaos Warp by name; the family-landscape
measurement (spell-family-landscape.md, stashed) puts TEMPORARY KEYWORD
GRANTS directly after the gate rework — the "+N/+N and gains K" families
are the biggest blocked spell twins and the permanent side is D153's
958-card class; the gate-rework steps (canary staples, pool rotation, seed
sharding — implementation drafted) precede wave scaling to 50–100.


## D193 — M6.4ah: the gate rework — canary staples + rotating pools (2026-08-19)

**What was decided:** the fuzz gate's one DECK — every shipped name dealt to
every seat, ~600-card libraries — became `poolFor(seed, seat)`: a fixed
unweighted CORE, the full CANARY_STAPLES deal, and a 40-slot round-robin
window over the sorted scripted names. Per-seed libraries fell ~600 → ~150.
**Measured on the same tree, same 60 seeds: 308.4 s → 83.8 s — 3.7×** —
the invariant-walk cut the design predicted (`checkInvariants` walks
4×|library| instances per accepted intent; D167/D181 proved the bus was
already at the floor). The full gate drops from ~2,253 s to 714.1 s.

**Why now:** round 39's fuzz hit the 3,600 s ceiling under desktop load one
wave after D180's comment predicted the fix — "if it rots a third time, the
honest fix is a canary-staples mechanism in the deck builder, not a fourth
multiplication." Wave 1's wraths also reshaped the games; the honest lever
was never a fourth ceiling raise.

⚠️⚠️ **THE CANARY-STAPLES TABLE is the structural end of the rate-canary
rot class** — NINE incidents (D149 · D164 · D173 · D175 · D176 · D177 ·
D178 · D180 ×2): a canary's fuel is now DECLARED beside the counter it
feeds (`counterKeys: (keyof Run)[]` — a renamed counter fails tsc at the
table) and dealt into EVERY seat of EVERY seed, so pool growth can never
dilute it again. The copy weights and rot histories moved out of inline
comments into the table rows. Thirteen staples cover every floor the gate
asserts.

⚠️ **The pool-membership invariant became three checked layers:** L1 — a
COMPUTED set-math theorem (union of a run's windows ⊇ every scripted name
with multiplicity ≥ 2, staples at exactly their declared weight × seats ×
seeds — asserted at BOTH sizes, because the modulo arithmetic is exactly
where an off-by-one hides); L2 — the aggregate counters the gate already
asserts; L3 — the staples, in every pool by construction. The Humility
teeth are unchanged (registered nowhere, dealt nowhere; an injected fake IS
assigned) — they guard the derivation, which rotation does not touch.

⚠️ **`poolFor` is PURE in (seed, seat, canonical sorted list)** —
registration order must never decide a shuffle (D129 one seam over), and
the same seed must deal the same pool forever or replay breaks. Rotating
coverage at 60 seeds: 9,600 slots over ~500 scripted names ≈ 19 deals
each; at 500 seeds ≈ 155 each — far above the old probabilistic reach.

**Verified:** the 60-seed leg green at 83.8 s (7 tests — the L1 theorem
and the staples-soundness check joined the file) · `verify.cjs --full`
ALL FIVE GATES: 596 files, 3,794 passed / 10 skipped ·
the 500-seed gate green at 714.1 s · build clean · probe 124/124 ·
battery 127/127.

**Reportables:** seed sharding (`verify.cjs --fuzz-shards`, step 4 of the
draft) is now OPTIONAL rather than urgent — the wall moved from ~2,250 s
to 714.1 s with 5× ceiling headroom; take it when script count
approaches ~2,000. The counter RATES changed with the pool shape (scripted
density per seed fell; staple density rose) — the next batch must read
rate movements against D193, not against pre-rework rounds. Temp keyword
grants are next (spell-family-landscape.md), then the script-raised prompt
seam (script-prompt-seam-design.md).


## D194 — M6.4ai: temporary keyword grants — the biggest unlock of the arc (2026-08-19)

**What was decided:** `GameState.untilEndOfTurn` — which held power and
toughness AND NOTHING ELSE since M3 (D153 measured 958 sole-need cards
against that gap) — now carries optional Tier-2 `keywords`. One carrier:
the P/T halves and the keywords ride the same entry, end at the same
`UntilEndOfTurnEnded` cleanup, and replay identically (the field is
optional, so every pre-D194 event and entry hashes byte-for-byte).

**The chain:** `PtModifiedUntilEndOfTurn` gains optional `keywords` → the
reducer appends them spread-conditionally → `derive.ts` reads them at
LAYER 6, after `applyStatics('ability')` → combat, targeting and the SBA
see them for free because they read derived characteristics (D129's
proof, re-used).

⚠️ **THE ORDERING ARGUMENT, stated as a scope decision:** CR 613.7c gives
a one-shot effect its own timestamp, and this engine's layer-6 timestamp
is the battlefield array (D129) — not comparable. What ships is
additions-after-statics, which is EXACTLY right while every layer-6 static
in play is itself an addition (additions commute) — and every SHIPPED
static is: the only ability-REMOVING statics in the repo are testing
scripts (Gravity Sphere, Humility). The day a removal ships, the real
timestamp merge is due — a named reportable, not a surprise.

⚠️ **THE VOCABULARY IS THE UNLOCK — +97 cards with ZERO card scripts, the
largest single-landing coverage move of the entire arc** (the previous
record was 23): `GRANTABLE` — a CLOSED printed-name → Tier-2-member map
(21 entries; `flash` out as cast-time, `toxic` out as numbered) — feeds
two new anchored pump rules: `gets +N/+N and gains K( and K)?` and the
pure `gains K( and K)?`. A keyword outside the map leaves the WHOLE
sentence unread — D90 for grants: an unenforced keyword granted
"successfully" is a card half-working while looking whole.

**Measured:** `complete` 2,253 → **2,350**; auto 409 → **509** (+100
spells resolving entirely by themselves — auto had not moved since
D150!); assisted 1,650 → 1,724; botPool instant 208 → 292, sorcery
157 → 168, creature +2; scriptableToday 2,437 → 2,542; the layer6 grant
split drained 1,166 → 1,000 and D153's temp-grant count 958 → 792;
offerable 1,995 → 2,089. ⚠️ **The bot's deck gained 72 cards in one
landing** (Adun reaches 1,313) — combat tricks: Bladebrand, Ancestors'
Aid, Battle-Rage Blessing… The proof fixtures are `Jump` (the pure grant)
and `Rush of Adrenaline` (the rider); fixtures 727 → 729.

⚠️⚠️ **A TOOLING DISASTER FOUND AND FULLY REPAIRED ON THE WAY:** PS5.1's
`Get-Content -Raw` reads BOM-less UTF-8 as cp1252 and `Set-Content
-Encoding utf8` writes a BOM — so every file edited through that pipeline
(nine, including four committed in wave 1) had its non-ASCII characters
double-encoded and a BOM prepended. Found when the fixture generator
crashed on BOM+shebang; the ★ in a token pin was mangled too. A
deterministic reverser (UTF-8 → cp1252 bytes → UTF-8, refusing any file
that does not decode cleanly) repaired all nine; the four committed ones
ride this landing. **The rule now: repo files are edited by the Edit tool
or a `node` patch script ONLY — never PowerShell string pipelines** —
invariant 14's cousin, and the third bite of the same tooth in one night.

**Verified:** 7 new tests in `tempGrants.test.ts` (the closed-map negative,
the two-keyword mapping, derived flying granted and CLEANED UP, the
one-entry rider, replay hash) · `verify.cjs --full` ALL FIVE GATES:
597 files, 3,801 passed / 10 skipped · the 500-seed
gate green at 705.5 s · build clean · probe 124/124 · battery
127/127.

**Reportables:** the LOSE direction ("loses all abilities until end of
turn", Day of Black Sun's class) needs the timestamp merge plus a
lose-carrier — unbuilt, and its ledger entries stand; "gains protection
from [quality]" is parameterised and outside the closed map; activated/
triggered pump-with-rider lines are now EXPRESSIBLE for scripts too (the
event carries keywords wherever a def emits it); the script-raised prompt
seam is next (script-prompt-seam-design.md).


## D195 — M6.4aj: scry and surveil — the effects that stop and ask (2026-08-20)

**What was decided:** `scry` and `surveil` joined the effect vocabulary as
the SECOND AND THIRD effect kinds whose resolution can stop and ask
(discard was the first, D137). The resolution reveals the top N to the
caster (D114's peek machinery — `view.peek` lists the cards, the prompt
ships NO ids, the fourth hidden-zone prompt built on D137's rule) and
raises `Awaiting.scryChoice`; the answer — `AnswerScry {toTop, toBottom}`
— must be an EXACT partition of the revealed run, validated entirely in
the handler.

⚠️⚠️ **THE `thenDraw` RIDER RIDES THE SPEC AND IS EMITTED AGAINST A
SCRATCH STATE.** "Scry 2, then draw a card" must draw the card the player
just KEPT — `drawEvents` built against the pre-answer state would take
the top of the unplaced run. The answer handler folds the scry's own
events through the pure reducer first and computes the draw from what the
library then is; both groups go out in one accept, in that order, so the
reducer applies them exactly as the scratch predicted — and every draw
rule (the D189 marker, the empty-library loss) stays in THE one place
(D158). The test proves it from BOTH answers: bottom it and the draw
takes the card underneath; keep it and the draw takes exactly it.

⚠️⚠️ **AND THE GUARD THE SHAPE FORCED, RETROACTIVE OVER DISCARD TOO: AN
EFFECT THAT ASKS MUST BE LAST, OR THE CARD NEVER RUNS BY ITSELF.**
`effectEvents` stops emitting at an `AwaitingSet`, so anything after an
asking effect in one resolution is silently DROPPED — "Scry 1. Destroy
target artifact." would scry and never destroy: half-execution in D90's
exact sense while every sentence reads as understood. `parseEffects` now
lands any such card `assisted`. This is why `Read the Bones` ("Scry 2,
then draw two cards. You lose 2 life.") STAYS in the REFUSED ledger while
`Introduction to Prophecy` drained out of it by name through the
stale-refusal guard — the designed flow, working.

**The forms:** bare (`Scry N.` / `Surveil N.`), the comma-form
(`Scry 2, then draw a card.` — Preordain, ONE printed sentence), and the
WINDOW-form — Opt prints `Scry 1.` and `Draw a card.` as two lines, and
D150's two-pass window hands the joined pair to one anchored rule. The
window earned its keep here: D141's join list never grew past one entry,
and the refactor built "for two or three entries from now" paid off at
entry two.

**Measured:** `complete` 2,350 → **2,407** (+57 more with zero scripts —
two vocabulary landings in one night total +154); auto 509 → 570;
botPool instant 292 → 335, sorcery 168 → 181; offerable 2,089 → 2,191;
triggeredShell drained 2,497 → 2,322 (scry trigger-payloads became
readable). ⚠️ **The bot's deck gained 25 more** (Adun reaches 1,338 —
Eat to Extinction, Bolt of Keranos, Artisan's Sorrow: the scry riders).
Fixtures 729 → 732 (Opt, Preordain, Consider).

**The fan-out** (all named by tsc or the D125 map, as designed): the bot
keeps everything in revealed order (a policy, said to be one — its
`CardView.cmc` ceiling cannot price a scry); `simplestAnswer` and the net
driver answer the same no-op scry; PromptBar names the destination
because scry and surveil differ only there; the peek panel gained the
scry mode — clicks build the KEEP list top-first and a commit button
submits, because keep-zero and keep-all are both real answers so no click
can be "the last one" (D113's commits-on-the-pick rule does not apply).
`Preordain` joined CANARY_STAPLES feeding a new `scryChoices` counter —
one table row, which is D193 paying for itself on the first landing after
it. The battery gained three real-click checks in the same landing
(D144's rule): the panel takeover, the counting submit button, and the
rider drawing THE KEPT CARD.

**Reportables:** "look at the top N" wordings that ARE scries in
disguise stay on their D141 machinery; scry-as-trigger-PAYLOAD
("whenever you scry") still wants D186's marker — the new resolution is
where that marker should be emitted when it lands; Brainstorm,
Electrodominance and Stinging Study stay ledgered (hand-side choose,
free-cast, chooseOption — different prompts); the scry family's
remaining tail is spells with riders the vocabulary does not read yet.


## D196 — M6.4ak: seventeen landed — the night's seams become card vocabulary (2026-08-20)

**What was decided:** the first batch AFTER the night's three engine
landings, and it is the proof they compose. Seventeen of 25 landed; all 48
tests green on the first run — the SIXTH consecutive first-run-clean batch.

**The firsts:** `Temple of Malice` and `Zhalfirin Void` are the first SCRY
TRIGGERS — a TriggerDef's resolve emits the same reveal-then-ask pair the
D195 effect emits, and the handler cares only about `revealedTo`, so
nothing new was built; `A.I.M. Synthoids` is the ETB SURVEIL on a
creature; `Doom Whisperer` composes D165's life cost with the surveil ask
(a repeatable engine-charged graveyard-filler); `Advance Scout` and
`Spearbreaker Behemoth` are the first ACTIVATED consumers of D194's
keyword rider — and Spearbreaker's test is the composition proof of the
whole night: **a GRANTED indestructible survives a scripted Wrath of God**,
because the wipes ask the derived keyword set. `Accumulated Knowledge` is
the first NAME predicate (counting its own kin across ALL graveyards
through `ctx.oracle`); `Gitaxian Probe` the first hand REVEAL (the whole
target hand `revealedTo` the caster, nobody else — looking is not
choosing, which is why the Duress class stays refused); `Wheel of Fortune`
the first wheel (whole hands are choiceless discards, CR 701.8a; every
seven comes through THE draw rule); `Accelerated Mutation` the first
board-computed X pump; `Acid Rain` the first SUBTYPE wipe (Dryad Arbor
dies as a Forest — derived); `Acidic Soil` per-player land-count burn.
Plus `Terminate`, `Wrath of God`, `Wave of Reckoning`, `Swords to
Plowshares` (the exile pays the CONTROLLER its derived power) and
`Eternal Isolation` (D139's floor at the aim, the bottom placement).

⚠️ **THREE PINNED NEGATIVES BECAME POSITIVES**: Swords to Plowshares
('the exile is understood; the life gain is not') and Wrath of God
('destroy ALL, which the vocabulary does not read') joined Dark Ritual in
the fixture COMPLETE list — statements still true of the vocabulary,
obsolete about the ENGINE.

**Eight refusals, THREE new classes:** `About Face` (an until-end-of-turn
power/toughness SWITCH — the carrier holds deltas and keywords, a switch
is neither), `Abnormal Endurance` (granting a QUOTED TRIGGERED ABILITY
for the turn — the temporary-grant class beyond keywords entirely),
`The Grey Havens` (CONDITIONAL MANA PRODUCTION — a mana ability cannot be
an ActivatedDef, CR 605: it does not use the stack, so the parse gap is
the real blocker). Plus cast-time alternative cost (Deadly Rollick),
rule-changing mana persistence (The Last Agni Kai), play-from-exile
(Act on Impulse), ctx.random (Animist's Awakening), ability-word cost
(Towering Viewpoint — D178's class). The ledger holds **107**.

**Numbers:** `complete` 2,424 (2,407 + 17); `SHIPPED_SCRIPTS` 540;
fixtures 745; botPool creature 1,533 / instant 339 / sorcery 188 / land
259; ladder [2627, 2726, 4519, 6433, 7645]; `batch.json` at **2,166**
(2,191 − 17 − 8, exact); tier3 silentAfter 2,836. ⚠️ **Acidic Soil,
Doom Whisperer and Accelerated Mutation joined the bot's deck** (Adun
reaches 1,347).

**Reportables:** the UEOT-switch carrier and the quoted-ability grant
join the temp-grant family's named tail; conditional mana production is
now a class with a name (the D124 mana-note family's engine half); the
scry-trigger shape is a FAMILY-TABLE candidate (dozens of scry lands
print the same two lines); prior items stand.


## D197 — M6.4al: seventeen landed, and a targeting hole the batch's own test forced out (2026-08-20)

**What was decided:** seventeen of 25 landed. **The headline is the pull:**
`Aerial Predation`'s negative test proved that **"with flying" is SILENTLY
UNENFORCED at the aim** — D139's exact shape for KEYWORD qualifiers: the
qualifier matches no noun entry, so it is recorded nowhere (not enforced,
not disclaimed, not visible), and the host accepted a grounded Grizzly
Bears as a target for a flyer-only removal spell. The tsc-green module was
DELETED on its own failing negative and the card ledgered under a NEW
class, `keyword target qualifier unenforced` — the keyword-qualifier
widening (TargetSpec.keywords + a derived check in targetAllowed, D139's
playbook verbatim) is the named engine work.

**The firsts:** `Aetherize` is the first COMBAT-STATE wipe (the set is
`state.combat.attackers` at instant speed — the whole attack vanishes into
its owner's hand mid-combat, driven through a real scripted declaration);
`Anarchy` the first COLOR wipe (derived colors — the White Knight dies,
the colorless Myr stands); `Anchor to the Aether` the first spell
composing a MOVE with the D195 ask — the target tops ITS OWNER's library
while the caster scries THEIR OWN, and the reveal is computed against a
scratch fold because the revealed card may BE the creature just placed
(two libraries, one resolve); `Amnesia` the first PUBLIC hand reveal with
a computed forced discard (all nonlands, typed off the oracle — no choice
anywhere); `Alpha Brawl` the melee (two DamageDealt waves in printed
order — correct because damage MARKS and nothing dies until the sweep);
`Ambuscade` reads the power AFTER its own +1/+0 (the bite logs 3 from a
2/2); `Akki Drillmaster` the first {T}-cost grant. Plus the Night's
Whisper text twins (`Ambition's Cost`/`Ancient Craving` — one text, two
ids), `Agonizing Syphon`, `Alabaster Mage` (lifelink rider),
`Airborne Aid`, `Aether Tradewinds` (its two-clause parse premise probed
BEFORE drafting), `Aggressive Instinct`, `Angelheart Protector` (targeted
ETB grant), `An-Havva Inn`, `Allied Strategies` (Domain, distinct basics).

**Eight refusals, THREE new classes:** the keyword-qualifier hole above;
`up-to-N targeting` (Allied Assault — the prompt machinery has no
under-answer); `cast-time computed target count` (Aether Burst — "as you
cast" is before any resolve exists). Plus opponent-chooses (Allure),
per-owner prompts (Aetherspouts), the Oxford noun list (Aftershock —
Bedevil's class), play-from-exile (Aminatou's Augury), a hand choice
(Amass the Components). The ledger holds **115**.

**Numbers:** `complete` 2,441 (2,424 + 17); `SHIPPED_SCRIPTS` 557;
fixtures 764; botPool creature 1,536 / instant 342 / sorcery 199; ladder
[2610, 2709, 4502, 6416, 7628]; `batch.json` at **2,141** (exact); tier3
silentAfter 2,853. ⚠️ **EIGHT of the seventeen joined the bot's deck**
(Agonizing Syphon, Aggressive Instinct, Ambuscade, Ambition's Cost,
Ancient Craving, An-Havva Inn, Anarchy, Alpha Brawl — Adun reaches 1,356).

**Reportables:** the keyword target-qualifier widening is the cheapest
named engine slice (D139's playbook, one field + one check + the parse);
up-to-N targeting joins the machinery list; the noun-list widening now has
TWO ledgered cards (Bedevil, Aftershock); prior items stand.

## D198 — M6.4am: fifteen landed, the typed-spell aim, and the Aura cast path that killed its own spell (2026-08-20)

**Coverage: 2,441 → 2,467 of 31,692 (+26 — 15 scripts + 11 vocabulary cards).**
`SHIPPED_SCRIPTS` 557 → 572; the REFUSED ledger 115 → 123; the offerable
pool 2,141 → 2,125.

**The typed-spell target widening.** The batch's premise probe measured
"Counter target artifact or enchantment spell." parsing CONFIDENT to
battlefield kinds `['artifact','enchantment']` — the trailing word "spell"
silently DROPPED by the permanent-noun compounds, so Annul's aim veil
offered PERMANENTS for a counterspell. The fix is D139's order, enforce
first then admit the wording:
- `targetParse` gains typed-spell nouns ABOVE the permanent compounds
  (`artifact or enchantment spell` / `artifact spell` / `enchantment
  spell`), each `kinds:['spell']` with ENFORCED `cardTypes` — and the
  existing `creature spell` / `instant or sorcery spell` entries upgrade
  from unenforced to enforced `cardTypes` (D140's symmetry rule: two
  readers of one qualifier shape may not behave differently).
  `noncreature spell` stays unenforced — a negated type has no field.
- BOTH candidate adapters now carry a stack spell's card types, read off
  the FACE ACTUALLY CAST (D155's rule) — `targets.ts` from the oracle by
  `obj.faceIndex`, `client.ts` through `faceFor`. An ability on the stack
  carries none, so a typed-spell clause refuses it — also the CR answer.
- `effectParse`'s noun list admits the three wordings ONLY behind that
  enforcement. `Annul` and `Artifact Blast` land as VOCABULARY cards (no
  script anywhere), and the widening finished 9 more cards DB-wide.
Measured: targeting `withUnenforced` 1,379 → 1,300; `effect:auto` faces
2,751 → 2,764. `typedSpellTargets.test.ts` proves the whole chain: Annul
counters a held Sol Ring; a held CREATURE spell is REFUSED at the aim.

**⚠️⚠️ THE AURA CAST PATH WAS DEAD, and the batch's own test found it.**
Aura Barbs needed an attached Aura, and the probe measured the shipped
flow: "Ana casts Pacifism. Pacifism resolves. **Pacifism dies.**" Nothing
implements CR 303.4g — an Aura SPELL enters attached to what it targeted —
so every cast Aura resolved unattached and SBA 704.5m binned it on the next
sweep, the cast path charging mana for a dead enchantment, live since the
sweep learned an unattached Aura is illegal. Invisible because NO TEST EVER
CAST AN AURA AND THEN LOOKED AT THE AURA: Bramble Elemental's and Druid of
Horns' tests assert only their own triggers, which fire either way — green
over a dead aura, D128's green-over-nothing in test form. Fixed in
`resolveTop` AFTER the entry move (the entry's `clearBattlefieldFields`
resets `attachedTo`, so attach-then-move would be wiped); a single-target
Aura whose target died never reaches it (fizzle, CR 608.2b); a
player-enchanting Curse has no InstanceId to attach to and keeps today's
outcome — a named limit, not a gap. `auraAttach.test.ts` pins the attach,
the host-dies-drop, and the replay hash. Aura Barbs' test then drives the
REAL flow: a cast Pacifism, and the Bears die of their own Aura.

**The fifteen scripts.** The D195/D196 scry-surveil ask composed onto four
more watcher shapes — ETB scry ×3 (`Augury Owl` at THREE, `Archive
Dragon` behind two tier-2 keyword lines, `Automatic Librarian` with the
short-library floor pinned), the HISTORIC cast filter paying a scry
(`Artificer's Assistant`, Jhoira's filter verbatim), becomes-tapped
(`Attentive Sunscribe`, Emmara's filter), and attacks-surveil
(`Appendage Amalgam`, `toGraveyard: true` proven by the graveyard).
Plus: `Armageddon` (the land wipe — Darksteel Citadel survives),
`Apocalypse` (exile ALL — the indestructible one does NOT survive, exile
is not destruction — then the caster's whole hand), `Aura Barbs` (two
damage waves, controllers then hosts, per-source riders), `Aspect of
Hydra` (devotion to green off the parsed ManaCost — `colored.G` plus
G-hybrids, the UP face so a transformed back face contributes nothing),
`Army of Allah` (per-attacker +2/+0 mid-combat), `Auspicious Arrival`
(pump + Investigate on the reused Clue pin), `Ashen Powder` (reanimation
out of an OPPONENT's graveyard under MY control — the own-graveyard
negative pinned), `Arborea Pegasus` (targeted ETB pump + flying rider),
`Arms of Hadar` (-2/-2 across one player's whole board).

**Eight refusals, FOUR new classes:** `Animate Land` (UEOT type change
with P/T set — no carrier), `Approach of the Second Sun` (game-history
memory), `Archaic's Agony` + `Arcane Omens` (converge — cast-time
mana-color memory), `Artificial Evolution` (text-changing effect, CR
612). Plus `Atraxa's Fall` (the noun-list class's THIRD card),
`Assert Perfection` (up-to-N), `Ashnod's Intervention` (quoted-ability
temporary grant).

**Measured after landing:** primitives blocked 29,225 · scriptableToday
2,586 · ladder [2586, 2685, 4478, 6392, 7604] · tier3 abilityText 17,139 /
silentAfter 2,879 (+26 = exactly the landed cards) · botPool auto 573 /
assisted 1,721 / autoAnyFace 581 / creature 1,543 / instant 357 / sorcery
203 · fixtures 764 → 781 (70 tokens, none new — the Clue reused) ·
batch.json 2,125 (rungs 1–2 at ZERO: the user's decks and the fuzz pool
are fully drained at current capability). ⚠️ **FIVE joined the bot's
deck** (Artifact Blast, Aspect of Hydra, Aura Barbs, Arms of Hadar, Ashen
Powder — Adun reaches 1,364).

**Reportables:** the keyword target-qualifier widening stands as the
cheapest named slice (D139's playbook — this batch widened the TYPE
qualifier; the KEYWORD one is the same move one field over); the noun-list
class holds three cards; converge and the text-changer join the structural
tail; prior items stand.

## D199 — M6.4an: seventeen landed, the noun-list widening, and the ledger gives Bedevil back (2026-08-20)

**Coverage: 2,467 → 2,486 of 31,692 (+19 — 17 scripts + 2 vocabulary).**
`SHIPPED_SCRIPTS` 572 → 589; the ledger 123 → 130 (one drained, eight in);
the offerable pool 2,125 → 2,100 with rungs 1–2 still at ZERO.

**The noun-list widening, Icy Manipulator's own idiom.** Two comma-or
compounds join BOTH parsers' noun tables — `artifact, creature, or
planeswalker` and `artifact, creature, or enchantment` — all three kinds
ENFORCED, zero new machinery. **`Bedevil` — the class's founding card,
REFUSED since D192 — drained through the stale-refusal guard the moment
the parse read it**: its whole text is one admitted destroy, a vocabulary
card with no script anywhere, proven end to end (a real cast kills a Sol
Ring) in `nounListTargets.test.ts`. `Banishment Decree` lands on the
other compound with Anchor's top-of-library move. Aftershock and Atraxa's
Fall STAY ledgered — their lists were never the (only) blocker.

**The seventeen.** The scry-surveil family gains the ETB surveil behind a
Defender header (`Barrier of Bones`); `Battlesong Berserker` is the first
"whenever YOU attack" targeted trigger (every attacker in one declaration
belongs to the declaring player, so any-of-mine IS the filter); the
{T}-haste grant lands as a TWO-ID text family (`Axgard Cavalry`,
`Battle Rampart`) beside `Beacon Behemoth`'s D139-floored vigilance
(the 2/2 refused at the aim, pinned); `Battleflight Eagle` is Arborea
Pegasus's exact shape at +2. The computed resolves: `Barrin's Unmaking`
(the color-MODE set over every battlefield permanent, ties included — a
share bounces, a miss is a real outcome, both from one board),
`Baki's Curse` (2 per attached Aura per creature — its test CASTS a real
Pacifism through D198's attach fix: the composition paying immediately),
`Balance of Power` (the hand-difference draw, both branches),
`Baleful Stare` (public reveal + count once per Mountain-OR-red card),
`Battle Hymn` (Geyser's ritual on my creatures), `Beast Hunt` (the
choiceless reveal-sort: creatures to hand, rest to graveyard),
`Bile Blight` (the NAME predicate on a debuff — both same-name Bears die
of one cast), `Bewildering Blizzard`, `Beyond the Quiet` (exile all
creatures AND Spacecraft — `Uthros Research Craft` is the support body
proving the subtype arm), `Back to Nature`, `Apocalypse`'s smaller
cousins all on shipped shapes.

**⚠️ The D169 counting trap charged its second customer:** Baleful
Stare's first test measured p1's hand around a `put` that FETCHED A COPY
THE OPENING HAND ALREADY HELD — "expected 8 to be 9" with the engine
perfect (the snapshot probe showed both draws landing and the spell
having been in the opening seven all along). The rule restated: measure
AFTER the put, minus the spell — or count LOG MOVES. And Beast Hunt
pinned the reveal rule from the other side: per-card `revealedTo` CLEARS
on the zone move (D114), so a reveal is asserted ON THE LOG.

**Eight refusals, THREE new classes:** `Bar the Gate` (dungeon/venture —
no dungeon concept exists anywhere in the engine), `Befoul` (a NEGATED
COLOR in the compound — `nonblack creature` has no TargetSpec field, and
enforcing the kinds while dropping the color would destroy a black
creature the card cannot touch), `Betrayal at the Vault` ("each of two
other target creatures" parses to max 1 — a COUNTED list, probed before a
line was written). Plus `Biomantic Mastery` (Fall of the Hammer's
second-clause shape one kind over), discard-cost, up-to-N,
opponent-chooses, script-raised prompt.

**Measured after landing:** primitives blocked 29,206 · scriptableToday
2,567 · ladder [2567, 2666, 4459, 6373, 7585] · tier3 abilityText 17,136 /
silentAfter 2,897 (+18 = the 17 scripts + Bedevil, exact) · botPool auto
574 / assisted 1,723 / autoAnyFace 582 / creature 1,549 / instant 365 /
sorcery 208 · effect:auto faces 2,778 · fixtures 799 (70 tokens — none
new) · **FIVE joined the bot's deck** (Bedevil, Back to Nature, Battle
Hymn, Bile Blight, Beast Hunt — Adun reaches 1,374).

**Reportables:** the keyword target-qualifier widening (D197) and the
counted-list/second-clause parse family are now the targeting layer's two
named slices; the dungeon subsystem joins the structural tail; prior items
stand.

## D200 — M6.4ao: eighteen landed, the pool crosses 2,500, and the harness trap that made a green vacuity (2026-08-20)

**Coverage: 2,486 → 2,504 of 31,692 (+18)** — past two and a half thousand.
`SHIPPED_SCRIPTS` 589 → 607; the ledger 130 → 137; the pool 2,100 → 2,075.

**The firsts.** `Biorhythm` and `Blessed Wind` are the first life SETS —
`LifeChanged` carries delta AND total, so a set is a computed delta and a
player already at the number gets no event. `Blaze` and `Bloodcurdling
Scream` put `obj.xValue` on damage and on a pump (Squall Line's read).
`Blinding Light` is the first script that TAPS A FILTERED BOARD (every
untapped DERIVED nonwhite creature in one `PermanentsTapped`).
`Blood Mist` is the first ENCHANTMENT with a begin-combat targeted
trigger (Eidolon's filter + the D194 rider — the bot pool's 31st
enchantment). `Blood Lust` executes BOTH printed branches off the derived
toughness (a 6/6 to 10/2; a 2/2 to 6/1 — never killing its own target).
`Blessed Reversal` reads the combat DEFENDER (a creature attacking my
planeswalker is not attacking ME). `Bite Down` is the one-way bite with
the compound creature-or-planeswalker + "you don't control" spec — MY
creature refused as the second target, pinned. `Blastfire Bolt` destroys
the target's ATTACHED Equipment only (the worn Greaves die, the spare pair
stands). `Boil` + `Boiling Seas` land ONE text as twins; the {T}-haste
grant reaches its THIRD id (`Bloodlust Inciter`) plus the D139-floored
variant (`Bloodthorn Taunter`). `Blood Tithe`, `Blood Pact`,
`Blazing Volley`, `Blossoming Wreath` on shipped shapes.

**⚠️⚠️ THE HARNESS TRAP: `put()` BY NAME RETURNS THE SAME INSTANCE when
the deck holds one copy** — startedGame PADS short deck lists with basics
rather than repeating names, so a name listed once yields ONE card, and
the second `put` falls through to the battlefield search and hands back
the FIRST card's id. Found because Blastfire Bolt's "spare" Greaves died
(it WAS the worn pair); and the same shape had already made Bile Blight's
same-name test a GREEN VACUITY — "both Bears die" passing over one Bear.
The rule: a test that needs TWO copies lists the name TWICE in the deck
and asserts the ids DIFFER. D169's counting trap, third and fourth
customers, now from the identity side.

**Seven refusals, THREE new classes:** `Birthday Escape` (the Ring — no
tempted-by-the-Ring concept anywhere), `Bleeding Edge` (AMASS — counter +
type change + conditional token in one word), `Blazing Hope` (a COMPUTED
target threshold — "power greater than or equal to your life total"
probed to a confident spec with the qualifier silently DROPPED; landing it
would exile a 1/1 at 40 life — D139's shape with a computed bound). Plus
`Blood Feud` ("fights another target creature" — the second-clause parse
family's third card), up-to-N, computed target count, opponent-chooses.

**Measured after landing:** primitives blocked 29,188 · scriptableToday
2,549 · ladder [2549, 2648, 4441, 6355, 7567] · tier3 abilityText 17,135 /
silentAfter 2,915 (+18 exact) · botPool creature 1,551 / enchantment 31 /
instant 372 / sorcery 216 · fixtures 817 (70 tokens — none new) ·
batch.json 2,075 · **FOUR joined the bot's deck** (Bite Down, Blood Mist,
Blood Tithe, Blastfire Bolt).

**Reportables:** the second-clause/counted-list parse family holds FOUR
cards (Fall of the Hammer, Biomantic Mastery, Betrayal at the Vault,
Blood Feud) — the widening is due by weight; the computed-threshold class
joins D197's keyword qualifier in the targeting queue; the Ring and amass
join the structural tail; prior items stand.

## D201 — M6.4ap: thirteen landed, first-run clean, and the refusal-heavy tail of the B's (2026-08-20)

**Coverage: 2,504 → 2,517 of 31,692 (+13).** `SHIPPED_SCRIPTS` 607 → 620;
the ledger 137 → 149 (+12 — the arc's most refusal-heavy batch, and the
signal is honest: the pool's alphabetical march hit a seam of piles,
prompts and mechanics). All 39 new tests green on the FIRST run.

**What landed.** The each-opponent burns as twins-in-shape (`Boltwave` 3,
`Breath of Malfegor` 5); `Borrowing the East Wind` — Squall Line's X
sweep one keyword over (horsemanship; the fixture pool has none, so the
players alone take it — the filter's negative half); `Braingeyser` (the
TARGET draws X); `Boon of Boseiju` (the computed pump — greatest mana
value among MY permanents — composed with Filigree's untap);
`Break the Spell` (the conditional draw read BEFORE the move: mine-or-
token destroyed draws, theirs does not, both proven — and its test casts
a REAL Pacifism through D198's attach fix); `Breathe Your Last` (the
kill pays per the victim's DERIVED colors); `Brightflame` (the radiance
set: X to the target and every color-sharing creature, the gain = X per
creature actually hit); `Breath Weapon` (a NEGATED subtype is fine on a
computed wipe — nothing is targeted); `Brightstone Ritual` (the ritual
counting EVERYONE's Goblins); `Boulderborn Dragon` (attacks-surveil
behind a two-keyword line); `Bountiful Harvest`; `Borrowing 100,000
Arrows` (draw per TAPPED creature of the target).

**Twelve refusals, TWO new class names:** `Boon of Erebos` is the first
card refused for REGENERATION by name (the engine has none — the
Damnation tripwire's subject becomes a ledger class), and `Bontu's Last
Reckoning` for the UNTAP RESTRICTION (no skip-untap carrier). Plus two
opponent-chooses piles (Boneyard Parley, Brilliant Ultimatum), three
script-raised prompts (Bounty of Skemfar, Brainsurge — Brainstorm's
hand-to-library-top shape — and Breaking Point's any-player offer), the
Ring (Breaking of the Fellowship), a quoted-ability grant (Brawl), a
subtype compound (Bounce Off — Vehicle is not a card type, so the spec
cannot enforce it), a counted list (Broken Dam, "one or two target
creatures"), and the keyword qualifier (Broken Wings).

**Measured after landing:** primitives blocked 29,175 · scriptableToday
2,536 · ladder [2536, 2635, 4428, 6342, 7554] · tier3 abilityText 17,134 /
silentAfter 2,928 (+13 exact) · botPool creature 1,552 / instant 378 /
sorcery 222 · fixtures 830 (70 tokens — none new) · batch.json 2,050 ·
**TWO joined the bot's deck** (Bountiful Harvest, Breath of Malfegor).

**Reportables:** script-raised prompts hold ELEVEN ledger entries and
stay the most-due engine seam; the second-clause/counted-list widening by
weight; regeneration and the untap restriction join the structural tail
with honest names; prior items stand.

## D202 — M6.4aq: sixteen landed — the first activated scry, the computed surveil rider, and poison from a script (2026-08-20)

**Coverage: 2,517 → 2,533 of 31,692 (+16).** `SHIPPED_SCRIPTS` 620 → 636;
the ledger 149 → 158; the pool 2,050 → 2,025. All 48 new tests green on
the FIRST run — the second consecutive first-run-clean batch.

**The firsts.** `Castle Vantress` is the FIRST ACTIVATED SCRY: an
ActivatedDef resolve emits the same reveal-then-ask pair a trigger does,
through D159's seam, behind D135's enters-tapped condition and an
engine-parsed mana line — three printed lines, one def claim, all three
accounted. `Cerebral Download` is the first COMPUTED surveil riding
`thenDraw` — surveil X (X = my artifacts) then draw three, the answer
handler drawing past what the player just binned on the scratch fold, and
the ZERO-artifact cast skipping the ask while still drawing (both
branches pinned). `Caress of Phyrexia` is the first script writing
POISON directly (`PoisonChanged`). `Case the Joint` reveals each
player's library TOP to the caster only — the projection boundary
(`revealedTo`) carrying cross-library information with no new machinery,
computed on the post-draw scratch. `Calming Verse` is the two-wave wipe
whose second wave is gated on a board query at resolution (both branches
from one board shape). `Burn the Impure`'s infect rider reads the
DERIVED keyword; `Bronze Walrus` pairs an ETB scry def with an
engine-run mana line; `Calamitous Cave-In` counts battlefield Caves by
derive and graveyard Cave CARDS by oracle face (the zero case stated
honestly — no Cave fixture exists); plus the compound player-or-
planeswalker burn, the pump-then-burn, the bounce-that-pays-its-
controller, the mana-plus-tap grant, the targeted ETB first-strike rider,
the kill-with-drain, and the count-is-the-batch board sweep
(`Chain Reaction`).

**Nine refusals, ONE new class:** `Cerebral Eruption` RETURNS ITSELF to
hand mid-resolution when a land is revealed — `resolveTop` moves a
resolved spell to the graveyard unconditionally AFTER the def, so a def
cannot redirect the card's own exit ("spell relocates itself on
resolution"). Plus two any-player/pile prompts, two computed target
counts (X target artifacts), converge, up-to-N, a modal, and a floating
tap-trigger grant.

**Measured after landing:** primitives blocked 29,159 · scriptableToday
2,520 · ladder [2520, 2619, 4412, 6326, 7538] · tier3 abilityText 17,132 /
silentAfter 2,944 (+16 exact) · botPool creature 1,555 / instant 383 /
land 260 (Castle Vantress) / sorcery 229 · fixtures 846 (70 tokens — none
new) · batch.json 2,025.

**Reportables:** the self-relocating resolution joins the structural
tail; the activated-scry shape is a family-table candidate beside D196's
scry-trigger lands (the Castle cycle prints five); prior items stand.

## D203 — M6.4ar: seventeen landed — the first dies-ask, and the offerable pool at an even two thousand (2026-08-20)

**Coverage: 2,533 → 2,550 of 31,692 (+17).** `SHIPPED_SCRIPTS` 636 → 653;
the ledger 158 → 166; the pool 2,025 → 2,000 exactly.

**The firsts.** `Citywatch Sphinx` is the first DIES-ask: the standard
looks-back dies filter raising the D195 surveil — death now asks a
question. `Chandra's Fury` reads the compound player-or-planeswalker
target and fans 1 damage across THAT controller's creatures (the rider's
owner is the player half or the planeswalker's controller).
`Cloudkill` reads MY commander's mana value ACROSS ZONES — battlefield
or command zone — through `commanderIds` (Slash the Ranks' read,
D192). `Clear the Land` is the choiceless reveal-sort where the SPELL
taps what it puts down (move + one PermanentsTapped batch) — and its
test learned the D200 padding fact from the other side: the padded
libraries are mostly BASICS, so the honest assertion is
lands-plus-exiles-equals-ten, not "most are exiled". `Churning Eddy`'s
"target creature and target land" probed to TWO clean specs — the
mid-sentence 'and target' IS parsed when both phrases are full target
clauses (what Fall of the Hammer's 'another target' is not).
`Chilling Trap`'s Wizard-gated draw, `Cinder Cloud`'s white-victim
burn (color and power read BEFORE the move), `Chaotic Backlash`'s
white-or-blue count, `Chasm Drake`'s attack-grant, the radiance set at
a flat 2, the numeric wipe (`Citywide Bust`), the Ambuscade twin
(`Clear Shot`), WUBRG in one event (`Channel the Suns`), two more
ETB scries and a Back to Nature twin.

**Eight refusals, TWO new classes:** `Chaoslace` (a COLOR SET for the
turn — no UEOT color carrier) and `Chronostutter` (library position
placement — the move event knows top and bottom, not "second from the
top"). Plus the untap restriction, two up-to-N, the Ring, the
second-clause parse (Clash of Titans — the family's FIFTH card), and the
keyword qualifier (Clear a Path, 'with defender').

**Measured after landing:** primitives blocked 29,142 · scriptableToday
2,503 · ladder [2503, 2602, 4395, 6309, 7521] · tier3 abilityText 17,128 /
silentAfter 2,961 (+17 exact) · botPool creature 1,559 / instant 390 /
sorcery 235 · fixtures 863 (70 tokens — none new).

**Reportables:** the second-clause family at FIVE cards is the targeting
queue's heaviest slice; the dies-ask completes the scry/surveil trigger
matrix (ETB, cast, tapped, attacks, activated, DIES) — the family table
is overdue by shape count; prior items stand.

## D204 — M6.4as: thirteen landed — the first flicker, and both arms of an artifact-entry ask (2026-08-20)

**Coverage: 2,550 → 2,563 of 31,692 (+13).** `SHIPPED_SCRIPTS` 653 → 666;
the ledger 166 → 178 (+12); the pool 2,000 → 1,975. All 39 new tests green
on the FIRST run.

**The firsts.** `Cloudshift` is the first FLICKER: two moves in one
resolve — battlefield to exile, exile straight back under my control —
with the whole entry funnel running on the return. `Contraband Kingpin`
watches "an artifact you control enters" with TWO defs (a card enters via
CardsMoved, a token via TokenCreated — Soul Warden's rule), both raising
the D195 scry; the token arm is proven with the Tier-3 token tool, whose
TokenCreated is the arm's own event. `Consuming Ashes` is the first
CONDITIONED ask — "if it HAD mana value 3 or less" read off the victim
BEFORE the exile, the surveil raised only then (both branches pinned).
`Commercial District` stacks D134's enters-tapped built-in under an ETB
surveil def; `Compleat Devotion` reads DERIVED toxic for its draw
(Bloated Contaminator proves the positive); `Confront the Unknown`
counts the Clue it is ABOUT to make (+1 over the board count);
`Consume the Meek` is the mana-value wipe (tokens are MV 0 and die; the
vacuous regeneration clause joins the tripwire's client list);
`Combat Professor` lands Blood Mist's begin-combat shape on a creature;
plus the flying X-sweep with a Phyrexian cost left to the solver
(`Corrosive Gale`), the Swamps-powered drain, the everyone-counts
lifegain, the destroy-plus-burn, and the creatures-you-control draw.

**Twelve refusals, THREE new classes:** `Coalition Victory` (a
WIN-the-game effect — no win event exists, and a win is not "every
opponent loses" until the loss reasons say so), `Contaminated Drink`
(RAD counters — no rad concept anywhere), `Contest of Claws` (DISCOVER —
library iteration plus a cast-or-hand choice). Plus `Consume Strength` —
probed: a SENTENCE-INITIAL "Another target creature" is still not a
second spec (the family's SIXTH card) — two play-from-exile permissions,
ctx.random, a counted list, game-history memory, a quoted-ability grant,
a script prompt, and an up-to-N.

**Measured after landing:** primitives blocked 29,129 · scriptableToday
2,490 · ladder [2490, 2589, 4382, 6296, 7508] · tier3 abilityText 17,125 /
silentAfter 2,974 (+13 exact) · botPool creature 1,561 / instant 397 /
land 261 / sorcery 238 · fixtures 876 (70 tokens — none new).

**Reportables:** the second-clause family at SIX cards is the heaviest
named parse slice; the flicker opens the blink family (its ETB re-trigger
compositions are now testable); prior items stand.

## D205 — M6.4at: sixteen landed — the conditional counterspell, and the unregistered-batch failure shape (2026-08-20)

**Coverage: 2,563 → 2,579 of 31,692 (+16).** `SHIPPED_SCRIPTS` 666 → 682;
the ledger 178 → 187 (+9); the pool 1,975 → 1,950.

**The firsts.** `Corrupted Resolve` is the first CONDITIONAL
counterspell — "if its controller is poisoned" read at RESOLUTION off
`players[p].poison`, and the no-poison branch is a genuine no-op: the
spell resolves doing nothing, its victim stays on the stack (both
branches pinned). `Crystal Ball` is the activated scry on an ARTIFACT —
Castle Vantress's D202 shape minus the condition, and the {1},{T} line
indexes #a0 because keyword lines never count (Advance Scout's rule).
`Cruel Truths` pins the ASK-LAST ordering from the emitter's side: the
flat life loss precedes the surveil ask in one resolve — commuting
riders may run first, the ask must be the LAST event or the tail would
be silently dropped (D195's rule, met by construction). `Cut a Deal`
is the first each-opponent-draws-then-you-draw-per-drawer resolve.
`Cruel Witness` watches noncreature casts and raises the D195 ask from
a trigger; `Corrupt` drains for the Swamp count; `Crypt Incursion`
exiles a graveyard's creature cards for 3 life each; `Culling Sun` is
the MV≤3 wipe; `Cower in Fear` the opponents-only board debuff;
`Cruel Bargain` pays ceil(life/2); plus the artifact wipe, the
artifact/enchantment/land destroy, the haste grant, the sorcery draw,
and `Crumble` — whose "can't be regenerated" clause joins the
Damnation tripwire's client list.

⚠️ **THE FAILURE SHAPE WORTH A NAME: a suppression test failing
`expected undefined to be defined` means the module is NOT REGISTERED,
not that the parse moved.** `land.cjs` validates every named module
BEFORE writing and exits on the first failure having written NOTHING —
this batch's first land call died on an export-name check, the retry
registered only the one corrected module, and the other fifteen sat
in-tree unregistered: ten spell suites then failed the registry half of
the suppression predicate at once. A mass suppression failure's first
question is "did land.cjs actually write?", answered by a probe of
`parseEffects` modes (all ten were manual/assisted — the vocabulary had
not moved at all).

**Nine refusals, ONE new class:** `Cracked Earth Technique` (LAND
ANIMATION — a type-changing continuous effect with counters and a
delayed return, nothing the state can carry). Plus `Cosmic Hunger` —
the second-clause family's SEVENTH card — a counted list
(`Counterintelligence`), two play-from-exile permissions
(`Counterlash`, `Counterpoint`), the keyword-LOSS direction
(`Crash Landing` — flying's loss is D194's carrier in the direction it
does not hold), a script-raised prompt (`Culling Ritual`), an
opponent-chooses (`Curfew`), and a computed threshold whose bound the
parse silently DROPS (`Cut Down` — landing it would destroy a 10/10).

**Measured after landing:** primitives complete 2,579 · blocked 29,113 ·
scriptableToday 2,474 · ladder [2474, 2573, 4366, 6280, 7492] · tier3
abilityText 17,124 / silentAfter 2,990 (+16 exact) · botPool creature
1,563 / instant 403 / sorcery 245 / artifact 76 / land 261 · fixtures
892 (70 tokens — none new) · batch.json 1,950 · botDeck: Adun reaches
1,436.

**Reportables:** the second-clause family at SEVEN cards is the
heaviest named parse slice and its widening is due; the scry/surveil
trigger matrix now spans every shape (ETB, cast, tapped, attacks,
activated, dies) — the family table is overdue by count; prior items
stand.

## D206 — M6.4au: fifteen landed — the wheels, the snow sweep, and the shadow grants (2026-08-20)

**Coverage: 2,579 → 2,594 of 31,692 (+15).** `SHIPPED_SCRIPTS` 682 → 697;
the ledger 187 → 197 (+10); the pool 1,950 → 1,925. All 43 new tests green
on the FIRST run — drafted OUT-OF-TREE against the dumped oracle texts
while gate 53 ran, ported and landed in one pass (the only correction the
port needed was a fixture-const name: the generator writes an apostrophe
as an underscore, so the card is `DEATH_S_CARESS` while land.cjs's
file-name derivation keeps the script `DEATHS_CARESS_SCRIPT`).

**The batch.** The WHEELS land: `Dark Deal` (each hand discarded whole —
CR 701.8a, no ask — with "that many minus one" counted per player BEFORE
the moves) and `Dangerous Wager` (the caster's own hand for two).
`Dead of Winter` is the SNOW sweep — X counts the caster's snow
permanents off the DERIVED type line's supertypes, nonsnow creatures
anywhere take -X/-X, snow creatures are exempt, and the test pins X
exactly by reading the surviving 6/6's derived power (3). The wipe
riders: `Deadly Tempest` splits Fumigate's destroyed-this-way count PER
PLAYER; `Death Begets Life` wipes two types and draws the total.
`Death's Caress` takes the CERTAIN DEATH precedent: its rider is NOT
"destroyed this way" — the Human check and the toughness are read off
the derived pre-move state, so an indestructible Human would still pay
(said in the module's comment; the three common branches pinned).
`Dauthi Embrace` and `Dauthi Trapper` are the first SHADOW grants a def
ships (the combat layer has enforced printed shadow since M1), and the
Embrace is the pool's THIRTY-SECOND enchantment. `Darksteel Pendant` is
Crystal Ball one card shallower; `Deathless Angel` hands Spearbreaker's
indestructible grant to a {W}{W} cost; `Damnable Pact` is Braingeyser
plus the mirrored life loss; `Dakmor Plague` burns every creature and
every player in one DamageDealt; `Day of Judgment` is Wrath's twin;
`Death Grasp` and `Death Wind` the X burn and the X debuff.

⚠️ **The Damnation tripwire eats COMMENTS:** gate 53's only failure was
the word "regeneration" in `cullingSun.ts`'s PROSE ("without the
regeneration clause"). The fix is rewording the comment — the exclude
list is for modules whose PRINTED TEXT carries the clause, never for
prose.

**Ten refusals, THREE new classes:** `Cyber Conversion` (FACE-DOWN — the
morph family's hidden-identity machinery, spec §4.7), `Dawnglow
Infusion` (MANA-SPENT memory — which mana paid the cast is recorded
nowhere), `Day's Undoing` (END THE TURN — CR 727, the structural tail
beside extra turns). Plus `Deadshot` — the second-clause family's
EIGHTH card — a noun-list Vehicle compound, an up-to-N, a script-raised
prompt, an opponent-chooses, a regeneration, and `Deathlace` (color
change (indefinite) — Chaoslace's family without the UEOT bound, plus a
SPELL-color aim).

**Measured after landing:** primitives complete 2,594 · blocked 29,098 ·
scriptableToday 2,459 · ladder [2459, 2558, 4351, 6265, 7477] · tier3
silentAfter 3,005 (+15 exact) / payable 5,112 · botPool creature 1,565 /
instant 405 / sorcery 254 / artifact 77 / enchantment 32 · fixtures 909
(70 tokens — none new; Snow-Covered Swamp and Ohran Viper join as
SUPPORT bodies) · batch.json 1,925 · botDeck: Adun reaches 1,447.

**Reportables:** the second-clause family at EIGHT cards is past due —
the widening is the next engine work by weight; the scry/surveil family
table stays overdue by shape count; prior items stand.

## D207 — M6.4av: seventeen landed — the four-target destroy, and the compound the parser was silently halving (2026-08-20)

**Coverage: 2,594 → 2,611 of 31,692 (+17)** — an ALL-SPELL batch (6
instants, 11 sorceries). `SHIPPED_SCRIPTS` 697 → 714; the ledger
197 → 205 (+8); the pool 1,925 → 1,900.

⚠️⚠️ **THE PARSER HOLE THE BATCH'S OWN TEST FORCED OUT:** `Demolish`'s
"Destroy target artifact or land." parsed to a CONFIDENT spec of kinds
`['artifact']` — the bare `artifact` noun matched the prefix and the
" or land" fell off a spec still claiming confidence, so the aim veil
refused a LAND for a spell whose whole point is hitting lands
(`Desecration Plague`'s "enchantment or land" compound existed; this
one was simply missing). The probe pinned it, the compound joined its
family in `targetParse`'s NOUNS, and the test that found it now proves
a Mountain dies to it. The D192 Bedevil class, met in the wild through
a green suite rather than a draft-time pull.

**The firsts.** `Decimate` — probed BEFORE writing (the D206 idiom) —
parses to FOUR confident enforced specs and lands as the first
four-target destroy: one simultaneous CardsMoved, CR 608.2b re-checks
per target, Darksteel Citadel survives while the other three die.
`Declaration in Stone` exiles the same-name family (oracle-name match
over the victim's controller's board) and pays THAT PLAYER one Clue per
NONTOKEN exiled. `Deconstruct`'s ritual pays through an indestructible
miss (CR 608.2c — the destroy stops, the {G}{G}{G} does not).
`Demon's Due` is Cruel Truths one ask over (the loss commutes and lands
before the scry ask; the draws ride `thenDraw`). `Depressurize` reads
the post-debuff power as plain arithmetic (Ambuscade's idiom from the
other side): a 2/2 at -3/-0 is destroyed, a 6/6 stands at 3.
`Depopulate` draws for every multicolored-creature controller off the
DERIVED colors, then wipes. `Deluge of Doom` counts DISTINCT card types
across the caster's graveyard off the ORACLE faces. `Deluge` taps all
grounded creatures (a sweep filter, not a target qualifier). `Deduce`
and `Declaration` bring Investigate to SpellDefs; `Defile` and
`Desert's Due` count Swamps and Deserts; `Delete` X-burns everything
nonartifact plus every player; `Debt to the Deathless` doubles X out of
each opponent and gains the sum actually lost.

**Eight refusals, ONE new class:** `Deny the Witch` (ABILITY
COUNTERING — countering an activated or triggered ability on the stack
is a target kind and an un-cast the engine has no seam for). Plus the
computed threshold twice (`Detonate`, `Disembowel` — "mana value X" is
a cast-variable bound), two up-to-Ns, a regeneration, a script-raised
prompt (`Defensive Maneuvers` — a creature type of the caster's
choice), and two quoted-ability grants.

**Measured after landing:** primitives complete 2,611 · blocked 29,081 ·
scriptableToday 2,442 · ladder [2442, 2541, 4334, 6248, 7460] · tier3
silentAfter 3,022 (+17 exact) · botPool instant 411 / sorcery 265 ·
fixtures 927 (70 tokens — none new; Sunscorched Desert joins as a
SUPPORT body) · batch.json 1,900 · botDeck: Adun reaches 1,458.

**Reportables:** the second-clause family at EIGHT cards stays the
heaviest parse slice; ability countering joins the structural tail; the
noun-list family is one entry richer and its remaining members surface
one test at a time — prior items stand.

## D208 — M6.4aw: sixteen landed — the historic bounce, the board-computed counter, and the unattach (2026-08-20)

**Coverage: 2,611 → 2,627 of 31,692 (+16).** `SHIPPED_SCRIPTS` 714 → 730;
the ledger 205 → 214 (+9); the pool 1,900 → 1,875. All 51 new tests green
on the FIRST run — the batch drafted out-of-tree while gate 55 ran.

**The firsts.** `Desynchronization` is the first HISTORIC filter on a
sweep — CR 700.10 asked of the DERIVED type line (legendary supertype,
Artifact type, Saga subtype), so the plain creatures bounce while the
artifact creature stands. `Dispersal Shield` is the first BOARD-COMPUTED
conditional counter: Corrupted Resolve's shape with the bound read off
the caster's own permanents' greatest mana value, and the countered
spell's MV counts a chosen X through the parsed cost's `xCount`
(CR 202.3b). `Disarm` is the first UNATTACH — one
AttachmentChanged-to-null per attached EQUIPMENT by derived subtype, the
Aura on the same creature proven to stay. `Destroy the Evidence` is the
first reveal-until-a-land mill: the run is walked off ORACLE faces, shown
to every living player, and milled whole (the test ENGINEERS the top with
placement moves so the run length is exact). `Devour in Shadow` and
`Dire Tactics` read toughness pre-move — the first tied to the creature
(the indestructible survivor still costs the caster 1, the Certain Death
precedent), the second gated on a board query (no Human, no cost).
`Dinotomaton` grants MENACE from a targeted ETB; `Dimir Informant` and
`Diresight` are the ETB surveil and the Cruel Truths text twin;
`Despoil`, `Destructive Revelry`, `Devastate` and `Devastation` are the
land destroys with riders and the two-type wipe; `Disorder` burns the
white half of every board; `Displacement Wave` bounces everything at MV
≤ X; `Disempower` puts the artifact on top of its owner's library.

⚠️ `Devour in Shadow`'s printed text carries the regeneration clause, so
its module joins the damnation tripwire's client list (the sixth).

**Nine refusals, THREE new classes:** `Devout Decree` (COLOR TARGET
QUALIFIER unenforced — "that's black or red" is the POSITIVE direction of
Befoul's negated class, and it drops silently today), `Diminish`
(UNTIL-END-OF-TURN BASE P/T SET — `untilEndOfTurn` carries deltas and
keywords, never a base; About Face's switch is the other non-delta),
`Disrupt Decorum` (GOAD — no goad concept exists anywhere in the
engine). Plus `Disallow` — ABILITY COUNTERING's second entry in two
batches — the computed threshold twice (`Detonate`, `Disembowel` —
"mana value X" is a cast-variable bound), two opponent-chooses
(`Diminishing Returns`' draw-up-to, `Divine Gambit`'s may-put), and an
up-to-N (`Displace`).

**Measured after landing:** primitives complete 2,627 · blocked 29,065 ·
scriptableToday 2,426 · ladder [2426, 2525, 4318, 6232, 7444] · tier3
silentAfter 3,038 (+16 exact) · botPool creature 1,567 / instant 418 /
sorcery 272 · fixtures 943 (70 tokens — none new, no new supports) ·
batch.json 1,875 · botDeck: Adun reaches 1,467.

**Reportables:** ability countering at TWO entries in two batches is
climbing the ledger; the color-qualifier pair (positive + negated) and
the keyword qualifier converge on ONE targeting-layer widening —
qualifier enforcement over derived characteristics (D139's playbook, D197
named it); the second-clause family stands at eight; prior items stand.

## D209 — M6.4ax: twelve landed — the control gift, the counted exile, and the even split (2026-08-20)

**Coverage: 2,627 → 2,639 of 31,692 (+12)** — a second consecutive
all-spell batch (7 instants, 5 sorceries). `SHIPPED_SCRIPTS` 730 → 742;
the ledger 214 → 227 (+13); the pool 1,875 → 1,850. All 38 new tests
green on the FIRST run.

**Two probes widened the batch from ten to twelve.** `Donate` probes to
TWO confident specs — any player, plus a permanent whose controller is
YOU — and lands as the first SpellDef producer of `ControlChanged` (the
event has carried control since M3; the Ring stays on the battlefield
with a new controller and its old owner). `Dust to Dust` probes to ONE
spec of min 2 / max 2, so the intent carries both picks — the first
COUNTED target list to land, and exile takes the indestructible Myr
because exile is not destroy.

**The rest.** `Dwarven Catapult` is the divided-damage family's one
DETERMINISTIC member — "divided evenly, rounded down" is floor(X/count)
to each, no one chooses (X=5 over two is 2 each; X=3 is 1 each, pinned
from both sides). `Dogpile` counts my declared attackers mid-combat, cast
in the attacker's own post-declaration window and read before combat
damage lands. `Double Trouble` doubles power as a computed per-creature
DELTA off the derived value. `Drag Down` and `Drag to the Bottom` bring
Domain to the debuff side (Allied Strategies' count; the sweep pins X
exactly through a survivor's derived power). `Drown in Sorrow` composes
the board debuff with the D195 scry ask — the debuff commutes, the ask is
LAST. `Dramatic Reversal` untaps my nonland board; `Divine Offering`
pays the artifact's MV whether or not it dies (the Certain Death
precedent); `Douse in Gloom` and `Dry Spell` are the burn twins.

**Thirteen refusals, ZERO new classes — and the up-to-N family absorbs
FIVE in one batch, its heaviest showing** (Donatello's Science Lesson,
Double Negative, Downpour, Dragonclaw Strike, Dual Shot). Plus three
opponent-chooses (Do or Die's piles, Drain Power's forced activations,
and — of note — nothing else), Dominate's computed threshold, the Ring
(Dreadful as the Storm), Brainstorm's prompt (Dream Cache),
play-from-exile (Dream Harvest), mana-spent memory's SECOND card
(Dryad's Caress), and a UEOT color change (Dwarven Song).

**Measured after landing:** primitives complete 2,639 · blocked 29,053 ·
scriptableToday 2,414 · ladder [2414, 2513, 4306, 6220, 7432] · tier3
silentAfter 3,050 (+12 exact) · botPool instant 425 / sorcery 277 ·
fixtures 955 (70 tokens — none new) · batch.json 1,850 · botDeck: Adun
reaches 1,475.

**Reportables:** up-to-N targeting is now the heaviest refusal class in
the ledger and has a bounded shape (a min/max the CHOOSER may stop
short of — the counted-list machinery from Dust to Dust's spec is the
enforcement half already); the second-clause family stands at eight;
prior items stand.

## D210 — M6.4ay: fifteen landed — the Echoing name family, the surveil land, and the attached-permanents wipe (2026-08-20)

**Coverage: 2,639 → 2,654 of 31,692 (+15).** `SHIPPED_SCRIPTS` 742 → 757;
the ledger 227 → 237 (+10); the pool 1,850 → 1,825. All 43 new tests green
on the FIRST run — the TENTH consecutive first-run-clean batch.

**The name family lands whole.** `Echoing Calm`, `Echoing Courage`,
`Echoing Decay` and `Echoing Ruin` are Declaration in Stone's oracle-name
match in four directions — destroy-enchantment, pump, debuff,
destroy-artifact — each sweeping BOTH boards for the shared name while the
differently named permanent stands (Courage and Decay prove it from the
pump and the SBA side at once).

**The rest.** `Elegant Parlor` is Commercial District's shape on the
Mountain-Plains surveil land — three printed lines, the def claiming only
the trigger (mana reminder parsed, enters-tapped built-in), and its test
asserts BOTH halves in one entry. `End Hostilities` wipes creatures AND
everything attached to them off a pre-wipe attachment scan: the worn
Greaves die with their bear, the spare stands. `Engulf the Shore` bounces
toughness ≤ my Island count on every board; `Earthquake` is the X sweep
with the flying exemption; `Eldritch Pact` reads X off the TARGET's
graveyard; `Empty the Catacombs` returns every player's dead creatures
choicelessly (typed off ORACLE faces); `Early Harvest` untaps the
target's basics and nothing else; `Earth Tremor` burns for my land
count; `End the Festivities` pings the opponents' whole halves;
`Elvish Herder` grants trample; `Enrage` is the X pump.

**Ten refusals, TWO new classes:** `Eliminate the Impossible` (SUSPECT —
no suspected concept exists anywhere) and `Empty City Ruse` (PHASE
SKIPPING — no skip-phase concept either). Plus Earth Rumble's land
animation, Eaten by Spiders' keyword qualifier, two script prompts
(Elven Farsight's may-reveal rides AFTER the scry ask — Read the Bones'
shape; Enshrined Memories bottoms cards in a caster-picked order), two
opponent-chooses (End of the Hunt's greatest-MV tie, Endless Detour),
and two up-to-Ns.

**Measured after landing:** primitives complete 2,654 · blocked 29,038 ·
scriptableToday 2,399 · ladder [2399, 2498, 4291, 6205, 7417] · tier3
silentAfter 3,065 (+15 exact) · botPool creature 1,568 / instant 432 /
sorcery 283 / land 262 · fixtures 970 (70 tokens — none new) · batch.json
1,825 · botDeck: Adun reaches 1,486.

**Reportables:** the name-family idiom now has FIVE shipped consumers and
reads as a family-table candidate; the scry/surveil land cycle (Elegant
Parlor's shape) prints ten twins — the same table; prior items stand.

## D211 — M6.4az: thirteen landed — the counter with recoil, the pump-then-fight, and the exponential delta (2026-08-20)

**Coverage: 2,654 → 2,667 of 31,692 (+13)** — a THIRD consecutive
all-spell batch (3 instants, 10 sorceries). `SHIPPED_SCRIPTS` 757 → 770;
the ledger 237 → 249 (+12, ZERO new classes); the pool 1,825 → 1,800.

**The firsts.** `Essence Backlash` counters a CREATURE spell and burns
its controller for the spell's PRINTED power — the cast face's
`basePower`, read off the stack object where no derivation exists (a
one-word port fix: `OracleFace` carries `basePower`, not `power`).
`Epic Confrontation` composes the pump with the two-way fight: the
+1/+2 lands first and MY side's damage is the derived power plus a KNOWN
1 (Ambuscade's arithmetic on Prey Upon's fight — the pumped 3/4 kills
the 3/2 and survives the swing back). `Exponential Growth` carries
"double power X times" as ONE computed delta — power × (2^X − 1) — the
2/2 reading 8 at X=2 and back to 2 at cleanup. `Eternal Flame` deals
its Mountain count forward and ceil(X/2) recoil at the caster in one
DamageDealt. `Essence Harvest` drains for my greatest derived power;
`Exotic Disease` is the Domain drain; `Exsanguinate` is Debt to the
Deathless at 1×; `Evacuation`, `Evaporate` (the W-or-U color filter),
`Excommunicate` (the top-of-library creature twin), `Essence Drain`,
`Essence Extraction`, and `Extinguish All Hope` (the nonenchantment
wipe) round out the batch.

**Twelve refusals, ZERO new classes.** Of note: `Essence Filter`'s
"destroy all enchantments OR all nonwhite enchantments" is a resolution
choice the modal regex missed (script-raised prompt); `Exorcise`'s
power qualifier binds to the CREATURE arm only — a per-arm qualifier no
spec can carry (the noun-list class); `Ethereal Ambush` manifests
(the morph family); `Ertai's Trickery` reads whether the spell WAS
KICKED (kicker memory); `Eureka` and `Exhume` are opponent-chooses;
`Exert Influence` is converge.

**Measured after landing:** primitives complete 2,667 · blocked 29,025 ·
scriptableToday 2,386 · ladder [2386, 2485, 4278, 6192, 7404] · tier3
silentAfter 3,078 (+13 exact) · botPool instant 435 / sorcery 293 ·
fixtures 983 (70 tokens — none new) · batch.json 1,800 · botDeck: Adun
reaches 1,496.

**Reportables:** three all-spell batches in a row say the D191 spell
pool is still the loop's densest vein; the qualifier-widening
convergence (keyword, color, per-arm) stands as the top targeting-layer
item; prior items stand.

## D212 — M6.4ba: fourteen landed — the conditional riders, and the range the parser silently halves (2026-08-20)

**Coverage: 2,667 → 2,681 of 31,692 (+14).** `SHIPPED_SCRIPTS` 770 → 784;
the ledger 249 → 260 (+11); the pool 1,800 → 1,775. All 43 new tests
green on the FIRST run.

⚠️ **THE PROBE'S FINDING: "one or two target creatures" parses CONFIDENT
to exactly-two.** `Fancy Footwork` was probed before writing and its
min/max came back 2/2 — the "one or" silently dropped, so the aim veil
would DEMAND a second target where the card permits stopping at one.
That is the up-to family's parse hazard met in the wild (a range
narrowed while claiming confidence), and the card is ledgered under
up-to-N with the hazard named — the eventual up-to-N enforcement work
owns both the parse and the chooser.

**The batch.** The conditional riders: `Extinguish the Light` reads the
victim's MV pre-move (MV ≤ 3 pays 3 life, the MV-6 victim pays
nothing); `Eye Gouge` reads the DERIVED subtype (a Cyclops is destroyed
outright, a Bears lives at 1/1 — `Cyclops of One-Eyed Pass` joins the
fixtures as the vanilla support body); `Fading Hope` bounces and asks
the scry only under MV ≤ 3, the ask LAST both ways. The on-your-turn
pair: `Fated Conflagration` and `Fated Retribution` gate their scry 2
on the active player at resolution (neither prints reminder text — the
first drafts guessed one and the printed() guard would have thrown).
`Fateful Showdown` serves three clauses from ONE hand count — the burn,
the whole-hand discard, and the equal redraw. `Fateful Absence` pays
the victim's controller a Clue (Declaration in Stone's idiom);
`Faerie Seer` is the ETB scry 2; `Fear of Surveillance` the
attacks-surveil on an enchantment creature; `Eyeblight Massacre` the
negated-subtype debuff (the Elf lives); `Famine` and `Fault Line` the
sweep twins; `Fallow Earth` and `False Mourning` the top-of-library
moves.

**Eleven refusals, TWO new classes:** `False Cure` (TEMPORARY GAME-WIDE
TRIGGER — a floating until-EOT triggered ability on the game, not a
grant to a permanent) and `Fate Transfer` (ARBITRARY COUNTER KINDS —
`CounterKind` is +1/+1 and -1/-1, the whole vocabulary; moving "all
counters" would silently drop the rest). Plus Eye Spy's cross-library
may-choice, Faerie Fencing's as-you-cast board snapshot, Fake Your Own
Death's quoted grant, two phase skips, two opponent-chooses, and Fathom
Trawl's ordered bottoming.

**Measured after landing:** primitives complete 2,681 · blocked 29,011 ·
scriptableToday 2,372 · ladder [2372, 2471, 4264, 6178, 7390] · tier3
silentAfter 3,092 (+14 exact) · botPool creature 1,570 / instant 443 /
sorcery 297 · fixtures 998 (70 tokens — none new) · batch.json 1,775 ·
botDeck: Adun reaches 1,505.

**Reportables:** the up-to-N parse hazard (a range confident at its
maximum) joins the class's dossier — enforcement must fix the PARSE and
the chooser together; the fixture file crosses one thousand next batch;
prior items stand.

## D213 — M6.4bb: TWENTY landed — the name census, the combat wipe, and the compound hole's creature twin (2026-08-20)

**Coverage: 2,681 → 2,701 of 31,692 (+20)** — the largest batch since the
spell seam opened, crossing 2,700. `SHIPPED_SCRIPTS` 784 → 804 — past
eight hundred; the ledger 260 → 265 (+5); the pool 1,775 → 1,750; the
fixture file crosses ONE THOUSAND (1,018).

⚠️ **D207's compound hole has a CREATURE twin, and the batch's test found
it the same way:** "Destroy target creature or land." parsed CONFIDENT to
`['creature']` — the Mountain was refused as "that choice doesn't fit"
by `Fissure`'s own suite. The compound joined its family beside D207's
`artifact or land`. Two members of one family found by two batches'
tests; any remaining `<noun> or land` prints will surface the same way.

**The firsts.** `Feast of Flesh` and `Flame Burst` are the NAME CENSUS —
X counts copies of the card's own name across EVERY graveyard by oracle
name (the resolving copy is on the stack and does not count itself).
`Fight to the Death` is the first COMBAT-STATE wipe: blocking creatures
are `combat.blockers[].card` and blocked attackers the union of every
blocker's `attackerOrder`, proven through a REAL DeclareBlockers — the
blocker and its blocked attacker die, the unblocked attacker fights on.
`Fields of Strife` is the first ACTIVATED surveil on a LAND behind
D134's tapped built-in — three printed lines, the def claiming #a1
(the enters-tapped line never counts in the ability index).
`Final Judgment` is the exile-wipe — no indestructible gate, the Myr
goes too. `Flame Wave` fans 4 at a player and their whole board
(Chandra's Fury's shape at a flat amount); `Flame Sweep`'s exemption is
BOTH conditions at once (mine AND flying — my Strix lives, theirs dies);
`Filigree Fracture` draws only off a blue/black victim (the colorless
Ring pays nothing, the Strix pays one); `First Volley` pings the
creature and its controller in one event; `Feed the Swarm` and
`Feast of Flesh` read MV and census pre-move; `Feeding Frenzy`,
`Festive Funeral`, `Festergloom`, `Eyeblight`-style sweeps and the
burn family (Famine's 3, Fire Tempest's 6, Flame Rift's 4-to-everyone,
Fiery Cannonade's non-Pirate 2) round out the twenty. `Fissure` joins
the damnation tripwire's client list (the SEVENTH).

**Five refusals, TWO new classes:** `Feast of Succession` (MONARCH — no
monarch concept anywhere) and `Finishing Move` (STICKERS — {TK} tickets
have no home either). Plus Feign Death's quoted grant, Fire Prophecy's
Brainstorm prompt, and Firespout's mana-spent memory.

**Measured after landing:** primitives complete 2,701 · blocked 28,991 ·
scriptableToday 2,352 · ladder [2352, 2451, 4244, 6158, 7370] · tier3
silentAfter 3,112 (+20 exact) · botPool instant 454 / sorcery 305 / land
263 · fixtures 1,018 (70 tokens — none new) · batch.json 1,750 · botDeck:
Adun reaches 1,520.

**Reportables:** the `<noun> or land` compound family should be SWEPT
rather than found one test at a time — a five-minute probe over the
remaining pairs closes it; the name-census idiom joins the name family's
table candidacy; prior items stand.

## D214 — M6.4bc: seventeen landed — the counter census, the conditional fan, and the fourth Icy compound (2026-08-20)

**Coverage: 2,701 → 2,718 of 31,692 (+17).** `SHIPPED_SCRIPTS` 804 → 821;
the ledger 265 → 273 (+8, no new classes); the pool 1,750 → 1,725;
fixtures 1,035.

⚠️ **The fourth Icy compound was missing and the probe found it BEFORE a
test had to:** `Fracture`'s "artifact, enchantment, or planeswalker"
halved to a confident `['artifact']` — the same silent narrowing as the
pair compounds, caught at classification this time (the D206 idiom
finally ahead of the failure). The compound joined D199's two and
Fracture landed with the batch.

**The firsts.** `Flay Essence` is the COUNTER CENSUS — the gain reads
EVERY counter kind on the exiled permanent (reading arbitrary kinds is
fine; only writing outside the +1/+1 vocabulary is barred).
`Flames of the Raze-Boar` is the conditional fan: 4 at the target, then
2 at each OTHER creature that player controls only if I control a
power-4 creature — both arms pinned. `Frantic Firebolt`'s census walks
my graveyard for instants, sorceries, and Adventure printings
(`oc.layout`, Edgewall's idiom — a card matching twice counts once).
`Flunk` reads 7-minus-their-hand (the empty hand fells a 6/6, the full
hand blunts it to nothing). `Flowstone Slide` is the +X/-X board slide;
`Flicker of Fate` the flicker compound; `Foul-Tongue Shriek` the
combat-count drain cast in the attacker's own window; `Foul Play` the
D139-ceilinged destroy paying the CASTER a Clue; `Fracturing Gust` the
two-type wipe at 2 life apiece; `Forum of Amity` the surveil-land twin;
`Flying Carpet` the flying grant on an artifact; plus Flashfires'
Plains wipe, Forced March's X-bounded wipe, Forced Retreat's exact-text
twin of Excommunicate, Flow of Ideas, Flesh to Dust (the EIGHTH
damnation-tripwire client), and Flay Essence's exile.

**Eight refusals, NO new classes:** Flashback's graveyard-cast
permission, two base-P/T sets (Flatline, Fractalize), Flowstone
Channeler's discard cost, two opponent-chooses, Foray of Orcs' amass,
and Forced Landing's silent 'with flying' qualifier.

**Measured after landing:** primitives complete 2,718 · blocked 28,974 ·
scriptableToday 2,335 · ladder [2335, 2434, 4227, 6141, 7353] · tier3
silentAfter 3,129 (+17 exact) · botPool instant 462 / sorcery 312 /
artifact 78 / land 264 · fixtures 1,035 (70 tokens — none new) ·
batch.json 1,725 · botDeck: Adun reaches 1,531.

**Reportables:** the compound families (pairs and Icy triples) have now
produced FOUR holes — the sweep-probe over every printed combination is
overdue and cheap; prior items stand.

## D215 — M6.4bd: sixteen landed — the self-name censuses, the Gate sweep, and the upkeep scry (2026-08-20)

**Coverage: 2,718 → 2,734 of 31,692 (+16).** `SHIPPED_SCRIPTS` 821 → 837;
the ledger 273 → 282 (+9, ONE new class); the pool 1,725 → 1,700;
fixtures 1,035 → 1,052 (+17: the sixteen plus `Azorius Guildgate` as the
Gate-census support body — no new tokens).

**The firsts.** `Frantic Inventory` and `Galvanic Bombardment` are the
SELF-NAME censuses — the card counts its own name in its caster's
graveyard (draws 1+n; damage 2+n) — and `Growth Cycle`'s shape next
batch inherits them. `Gates Ablaze` is the first GATE-subtype census (X
Gates → X to each creature; the zero-Gate cast is a true no-op, and the
support Guildgate joined WANTED for it). `Geist of the Archives` is the
first YOUR-upkeep scry — the activePlayer filter proven by the calendar:
the first ask lands on TURN 3, the opponent's turn-2 upkeep passing
silently. `Gaea's Might` is the first Domain consumer in a SpellDef
(BASICS land-type count). `Fyndhorn Bow` grants first strike from an
artifact's activated; `Gale Force` is the flying-ONLY sweep (Earthquake
inverted); `Gaze of Granite` the X-bounded nonland wipe; `Gaze of
Adamaro` the hand-size player burn; `Gerrard's Command` untap+pump in
one resolve; `Gerrard's Wisdom` the hand-count gain (the cast spell
never counts); `Ghoul's Feast` the graveyard creature-census pump;
`Giant's Ire` the Giant-conditioned draw rider (Bulwark Giant already a
fixture); `Galadhrim Guide` (scry 2, NO reminder) and `Glider Kids`
(scry 1, 'put it' reminder) the ETB scry pair; `Gale Swooper` the
targeted ETB flying grant.

⚠️ **Ghostly Flicker probed to a DOUBLE silent narrowing** — 'two target
artifacts, creatures, and/or lands you control' parses confident to
min2/max2 kinds ['artifact'] controller 'any': the counted-list hazard
AND the compound hole in one clause. Refused by probe, never drafted.

⚠️ **Two drafted mana costs were wrong and the first test run caught
both** — Giant's Ire is {3}{R} (drafted as {2}{R}), Ghoul's Feast {1}{B}
(drafted as {B}). The lesson is mechanical: read `manaCost` off the
dump/fixture at draft time the way oracle text already is; the D216
port notes carry every cost pre-verified.

**Nine refusals, ONE new class:** `Full Flowering` names 'copy effect
(populate)' — the first CR 707 entry in the ledger. Plus Frost Breath
(up-to-N), Fumble and Galuf's Final Act, Geosurge (spend-restricted
mana — The Grey Havens' gap), Gift of Tusks (base P/T set), Glimpse of
Nature (temporary game-wide trigger), Glimpse the Sun God (cast-time
computed count), and Ghostly Flicker.

**Measured after landing:** primitives complete 2,734 · blocked 28,958 ·
scriptableToday 2,319 · ladder [2319, 2418, 4211, 6125, 7337] · tier3
silentAfter 3,145 (+16 exact) · botPool creature 1,574 / instant 468 /
sorcery 317 / artifact 79 / land 264 · batch.json 1,700 · botDeck: Adun
reaches 1,541.

**Reportables:** the second-clause family (eight) and the counted-list
widening top the targeting queue; the compound sweep-probe stays
overdue and cheap; prior items stand.

## D216 — M6.4be: nineteen landed — the control-state sweep, the distinct-powers draw, and the subtype compound that narrows (2026-08-20)

**Coverage: 2,734 → 2,753 of 31,692 (+19).** `SHIPPED_SCRIPTS` 837 → 856;
the ledger 282 → 288 (+6, TWO new classes); the pool 1,700 → 1,675;
fixtures 1,052 → 1,071 (+19, no new tokens). All 19 suites — 55 tests —
green on their FIRST run: the pre-verified mana costs (D215's lesson,
applied) paid for themselves immediately.

**The firsts.** `Guan Yu's 1,000-Li March` is the first TAPPED-state
sweep — the filter is the INSTANCE fact, so a tapped indestructible Myr
proves the two checks are independent. `Golden Ratio` is the first
DISTINCT-values census (a SET of derived powers — two Bears share one).
`Hallowed Burial` is the first bottom-of-library board wipe: NOT
destruction, so the indestructible Myr goes under with everything else
(asserted). `Hail Storm` is cast as the DEFENDER mid-combat and pays
three ways at once — attackers 2, me 1, my creatures 1 — with my own
attacker due BOTH entries by construction. `Glissa's Scorn` extends the
Death's Caress rider precedent to an artifact LAND: Darksteel Citadel
survives the destroy and its controller still pays the life.
`Glistening Deluge` sums its color-conditional extra into one entry per
creature. `Guardian of Solitude` is Briarknit Kami's Spirit-or-Arcane
matcher with the flying grant as payload; `Grey Havens Navigator` the
ETB scry behind Flash; `Goblin Motivator` carries its printed reminder
(NOT Akki Drillmaster's text twin — checked); `Hard-Hitting Question`
IS Bite Down's exact text on its own id; `Harmattan Efreet` the paid
flying grant behind a keyword header; plus the Gate-free censuses
(Goblin War Strike, Ground Assault, Gruesome Fate, Grim Flowering,
Growth Cycle's self-name pump), Griptide's top-of-library move,
Granulate's nonland-artifact wipe, and Great Defender's
mana-value-of-the-target pump.

⚠️ **The Gravkill probe found the SUBTYPE-member narrowing:** 'Exile
target creature or Spacecraft.' parses CONFIDENT to kinds ['creature'] —
the Spacecraft half silently dropped, D207's compound hole with a
member no compound row can fix (TargetSpec has no subtype field).
Refused into the noun-list class; the sweep-probe reportable now spans
kind compounds AND subtype members.

**Six refusals, TWO new classes:** `Glistening Dawn` names the INCUBATE
mechanic (an Incubator DFC token carrying counters) and `Goblin Game`
names PHYSICAL ITEM CHOICE (players hide real objects — the structural
end of the list). Plus the Ring (Glorious Gale), mana-spent memory
(Graven Lore), Gravkill, and a script-raised prompt (Grisly Salvage).

**Measured after landing:** primitives complete 2,753 · blocked 28,939 ·
scriptableToday 2,300 · ladder [2300, 2399, 4192, 6106, 7318] · tier3
silentAfter 3,164 (+19 exact) · botPool creature 1,578 / instant 473 /
sorcery 327 · batch.json 1,675 · botDeck: Adun reaches 1,552.

**Reportables:** the qualifier/compound widening family (second-clause
at eight, counted-list, subtype members) tops the targeting queue;
prior items stand.

## D217 — M6.4bf: sixteen landed — the opponent-gift, the six-target destroy, and the exactly-10 conditional (2026-08-20)

**Coverage: 2,753 → 2,769 of 31,692 (+16).** `SHIPPED_SCRIPTS` 856 → 872;
the ledger 288 → 297 (+9, ONE new class); the pool 1,675 → 1,650;
fixtures 1,071 → 1,087 (+16, no new tokens). All 48 tests green on the
FIRST run — the second consecutive first-run-clean batch.

⚠️ **Both probes came back GREEN, so nothing was pulled:** 'Target
opponent gains control of target permanent you control.' parses to TWO
confident specs with the opponent restriction ENFORCED (`controller:
'opponent'` on a player kind — Donate's parse holds one word over), and
'Destroy six target creatures.' reads a confident min6/max6 counted
spec — the counted machinery proven at its largest printed count.

**The firsts.** `Harmless Offering` is the control gift's OPPONENT twin
(Donate's ControlChanged with the belt kept in resolve). `Hex` takes
SIX targets in one submit — five Bears die and the sixth pick, the
indestructible Myr, survives its own destruction per-target.
`Hidetsugu's Second Rite` is the exactly-10 conditional — both branches
from real casts, and its replay test deliberately uses the 40-life arm
because the 10-life cast ENDS a two-player game on the spot. `Hellfire`
counts its OWN kills for the X+3 recoil (Fumigate's census feeding
damage to the CASTER). `Heartwarming Redemption` is the wheel where
every count is knowable up front (discard n, draw n+1, gain n+1, all
off the pre-state). `Hint of Insanity` reveals the hand to every seat
and discards the nonland name-pairs — the Bears pair goes, the Swamp
pair STAYS. `Hold the Line` pumps the BLOCKERS mid-combat (+7/+7
through a real DeclareBlockers; the 1/1 blocker eats the 2/2 attacker).
`Hedge Maze` is Elegant Parlor's surveil-land shape on the
Forest-Island twin; `Harmonic Convergence` tops every owner's library
with their own enchantments; `Hurkyl's-shape` bounces by computed
census; `Harrowing Journey` draws for the TARGET; plus Heat Ray's
plain X burn, Hell Swarm's -1/-0 board, Heroes' Reunion, Harsh
Sustenance's census damage+gain, Hibernation's green bounce-wipe, and
Hobbit's Sting-style census counting both halves.

**Nine refusals, ONE new class:** `Hoarder's Greed` names the CLASH
mechanic (reveal + each player's top/bottom choice + compare + a
repeat loop). Plus regeneration, up-to-N ('one or two' still parses
confident exactly-2 — the D212 hazard), Granite Shard's
alternative-cost cycle-mate, two script-raised prompts, Chaoslace's
color change, two temporary game-wide triggers, and play-from-exile.

**Measured after landing:** primitives complete 2,769 · blocked 28,923 ·
scriptableToday 2,284 · ladder [2284, 2383, 4176, 6090, 7302] · tier3
silentAfter 3,180 (+16 exact) · botPool instant 483 / sorcery 332 /
land 265 · batch.json 1,650 · botDeck: Adun reaches 1,561.

**Reportables:** the counted-spec machinery is now proven at 2 and 6 —
the up-to-N class (the ledger's heaviest) still waits on the CHOOSER
half; prior items stand.

## D218 — M6.4bg: Homing Lightning executes, and the gate catches a flickered commander (2026-08-20)

**Coverage: 2,769 → 2,785 of 31,692 (+16).** `SHIPPED_SCRIPTS` 872 → 888;
the ledger 297 → 306 (+9, no new classes); the pool 1,650 → 1,625;
fixtures 1,087 → 1,104 (+17: the sixteen plus `Oketra the True` as the
mono-faced God body — the only in-tree God was a modal DFC).

⚠️⚠️ **THE GATE'S FIRST RUN FAILED ON A REAL ENGINE HOLE — fuzz seed 69:
a commander in two zones at once.** `Flicker of Fate` exiled Krenko
(raising the commander-zone choice), returned him to the battlefield in
the SAME resolve, and the owner's later "command zone" answer moved him
from the STALE recorded zone — leaving c158 in both the battlefield and
command arrays. Pre-existing since the choice shipped; it needed a
flicker aimed at a commander plus a yes, which the D193 pool rotation
finally dealt together. **Fixed in `commanderZoneChoice`:** the answer
re-checks that the card still sits where the queue recorded it — a
moved-on commander makes the question moot and the yes a no-op (CR
903.9a applies to the zone change that raised it).
`commanderZoneStale.test.ts` stages the exact scenario; with the check
deleted the suite fails, and the 70-seed leg reproduces seed 69 green.

**The headliner:** `Homing Lightning` — THE D90 CARD. The loose-prefix
parser would have "understood" it and silently dropped the name fan;
closing the vocabulary refused it and named the never-half-execute
rule. A script now runs every word: 4 to the target and each OTHER
same-name creature, controller-agnostic (the test kills my own Bears
with it).

**Also:** `Hour of Glory`'s God-conditional census exile (the God takes
its hand-twins with it, the hand revealed to every seat; a non-God
keeps the hand private — Oketra proves both arms); `Hubris` bounces the
creature AND its riding Auras by OWNER (the worn Pacifism comes back to
MY hand; the one on my own creature stays) — ⚠️ its first test put() the
Aura and the aura-falls SBA binned it before the Tier-3 attach could
land: **test Auras are CAST through D198's attach path, never put()**;
`Hurkyl's Recall` scans by OWNER; `Honor the Fallen` exiles creature
cards from EVERY graveyard and counts the gain; `Hoodwink`'s
'artifact, enchantment, or land' triple probed as ALREADY parsed (three
kinds enforced — the compound family holds); `Hope and Glory` proves
the counted pair untap+pump; `Horrific Assault` gates its gain on an
Eldrazi (Desolation Twin); `Huatli's Final Strike` reads power AFTER
its own +1; `Hungry Flames` splits two damage clauses from one
sentence (probed to two confident specs); `Hymn of Rebirth` reanimates
from ANY graveyard under MY control; plus Holy Light, Horizon
Scholar's ETB scry 2, Howl from Beyond's +X/+0, Hunger of the Nim,
Hurricane (Squall Line's shape), and Hysterical-style board math.

**Nine refusals, no new classes:** bolster's tie choice and
Hypothesizzle's may-discard join the script-prompt seam (13th/14th);
Hour of Devastation is the LOSE direction of the temp-grant carrier
(Day of Black Sun's class); plus the Ring, two base-P/T sets, discover,
play-from-exile, and land animation.

**Measured after landing:** primitives complete 2,785 · blocked 28,907 ·
scriptableToday 2,268 · ladder [2268, 2367, 4160, 6074, 7286] · tier3
silentAfter 3,196 (+16 exact) · botPool creature 1,579 / instant 494 /
sorcery 336 · batch.json 1,625 · botDeck: Adun reaches 1,569.

**Reportables:** the flicker-vs-pending-choice composition is worth a
sweep — any script that moves a card while a zone question is up shares
the shape (the fix is general, but other queued prompts recording zones
deserve the same staleness audit); prior items stand.

## D219 — M6.4bh: twenty landed — the poison riders, the per-player fan, and the counter that pays its victim (2026-08-20)

**Coverage: 2,785 → 2,805 of 31,692 (+20).** `SHIPPED_SCRIPTS` 888 → 908
— past nine hundred; the ledger 306 → 311 (+5, ONE new class); the pool
1,625 → 1,600; fixtures 1,104 → 1,124 (+20, no new tokens). All 20
suites — 59 tests — green on their FIRST run: the third first-run-clean
batch in four.

⚠️ **A dump oddity, resolved before it cost anything:** the batch dump
printed Inferno as '[Card] (Theme color: {R})' — `dump-d199-batch.cjs`
resolves by NAME and hit a Jumpstart theme-card printing. The batch's
oracleId is the REAL Inferno ('deals 6 damage to each creature and each
player'), checked in cards.ndjson, and it LANDS. The rule: when a dump
line looks impossible, the batch entry's oracleId is authoritative.

**The firsts.** `Illumination` is the counter that PAYS its victim —
Corrupted Resolve's stack shape plus Dispersal Shield's mana-value read
(manaValue + xCount·xValue), the gain routed to the COUNTERED spell's
controller. `Ionize` is its burn twin (2 at the caster). `Jaded
Response` reads the cast face's colors against my derived board — the
no-share cast resolves untouched, both branches from real casts.
`Incite Rebellion` is the first PER-PLAYER census fan: each player's
own creature count, dealt to them and to each of their creatures, my
side included. `Infectious Bite` and `Infectious Inquiry` write poison
through `PoisonChanged` beside their bites and draws. `Invincible
Hymn`-style... — `Icequake` reads the SNOW supertype pre-move (the
Snow-Covered Swamp burns its controller, the plain Swamp does not).
`Identity Crisis` empties hand AND graveyard into exile in one move
batch. `Il Mheg Pixie` is the attacks-surveil on a one-drop flyer;
`Imperious Inkmage` the ETB surveil 2; `Hour-of-Glory`-style reveals
continue in `Inquisition` (the hand goes public, only the WHITE cards
burn). `Immolating Gyre` counts my dead instants and sorceries and
spares everything I control. `In Garruk's Wake` wipes only what I
don't control. `Incandescent Aria` exempts TOKENS (the Tier-3 tool's
own Soldier proves it). `Infernal Contract` is Cruel Bargain's exact
text on its own id; `Inner Struggle` makes the target bite ITSELF
(its own riders apply); `Inner Fire` is the computed ritual ({R} per
hand card); plus Hysterical Blindness, Icatian Scout's {1},{T} grant,
Infest, and Inner Calm's hand-count pump.

**Five refusals, ONE new class:** `Illicit Auction` names the BIDDING
mechanic — a life-bid loop for control, a genuinely multi-player
prompt cycle. Plus three script-raised prompts and a quoted-ability
grant.

**Measured after landing:** primitives complete 2,805 · blocked 28,887 ·
scriptableToday 2,248 · ladder [2248, 2347, 4140, 6054, 7266] · tier3
silentAfter 3,216 (+20 exact) · botPool creature 1,582 / instant 500 /
sorcery 347 · batch.json 1,600 · botDeck: Adun reaches 1,582.

**Reportables:** the counterspell-with-rider family now has four
members (Essence Backlash, Illumination, Ionize, Jaded Response) — a
family-table candidate; prior items stand.

## D220 — M6.4bi: sixteen landed — the control theft, and the numeric qualifier's EXACT hole (2026-08-20)

**Coverage: 2,805 → 2,821 of 31,692 (+16).** `SHIPPED_SCRIPTS` 908 → 924;
the ledger 311 → 319 (+8, THREE new classes); the pool 1,600 → 1,575;
fixtures 1,124 → 1,141 (+17: the sixteen plus `Atogatog` as the
five-color body). All 47 tests green on the FIRST run — the fourth
first-run-clean batch in five.

⚠️ **The Isolate probe found the numeric family's fourth hole:** 'Exile
target permanent with mana value 1.' parses CONFIDENT to a plain
'target permanent' with the EXACT-value qualifier silently dropped —
D139 built 'or less' and 'or greater' and nothing reads equality. The
aim would offer ANY permanent for a mv-1-only exile. Pulled on the
probe; 'spell target parse (numeric exact)' is a NEW class. The other
three probes were green: the comma-joined two-spec Ultimatum sentence,
the 'artifact or creature' pair, and 'each of two target creatures'
(min2/max2) all parse enforced.

**The firsts.** `Invoke the Winds` is the control gift pointed at
MYSELF — Donate's ControlChanged with the caster as the receiver, plus
the untap, and the control holds into the next turn (asserted).
`Invincible Hymn` sets my life TO my library count (the computed-delta
set at its largest swing). `Ionize` is the counter-with-burn twin of
D219's Illumination; `Jaded Response`'s color-share sibling landed a
batch earlier — the family grows. `Iridian Maelstrom` exempts ALL-five-
colors (Atogatog rides it out). `Hurricane`-after-`Squall Line`
continues in `Jagged Lightning`'s counted pair (3 to each of two).
`Into the Core` is Dust to Dust's exact text; `Iron Lance` Fyndhorn
Bow's; `Justice-Strike`-era self-bites continue next batch. `Ixalli's
Keeper` pays {7}{G}, the tap, and ITSELF for a +5/+5 trample grant.
Plus Inspiration, Inspired Ultimatum's three riders, Inspirit's
untap+pump, Inundate's nonblue bounce-wipe, Invigorating Falls'
cross-graveyard gain, Ire of Kaminari's Arcane census, and Irradiate's
artifact-count debuff.

**Eight refusals, THREE new classes:** `Ironhoof Boar` names the
HAND-ACTIVATED ability (channel — an activated cost paid from a zone
legal.ts never offers from, Halo Scarab's gap one zone over);
`Isildur's Fateful Strike` names the CAST-PERMISSION condition (a
legendary instant castable only behind a legendary body — a permission
nothing checks); `Joint Assault` names SOULBOND pairing (no paired
state exists anywhere). Plus Isolate's numeric-exact, two up-to-Ns,
amass, a script prompt, and library position placement.

**Measured after landing:** primitives complete 2,821 · blocked 28,871 ·
scriptableToday 2,232 · ladder [2232, 2331, 4124, 6038, 7250] · tier3
silentAfter 3,232 (+16 exact) · botPool creature 1,583 / instant 507 /
sorcery 354 / artifact 80 · batch.json 1,575 · botDeck: Adun reaches
1,589.

**Reportables:** the numeric-exact widening is D139's playbook one
comparison over (eq beside or-less/or-greater) and would drain its
class; prior items stand.

## D221 — M6.4bj: eighteen landed — the three-type wipe, and the first SpellDef discard ask (2026-08-20)

**Coverage: 2,821 → 2,839 of 31,692 (+18).** `SHIPPED_SCRIPTS` 924 → 942;
the ledger 319 → 326 (+7, no new classes); the pool 1,575 → 1,550;
fixtures 1,141 → 1,159 (+18, no new tokens). One probe (Kiss of Death's
'target opponent or planeswalker') came back GREEN — the compound
parses with the opponent restriction ENFORCED on the player half.

⚠️⚠️ **THE HEADLINER: `Laquatus's Creativity` is the first SpellDef to
raise the DISCARD prompt.** The target draws their hand's worth, then
the resolve emits the same `chooseFromZone` awaiting the effect
vocabulary's discard has used since D137 — the ask lands on the TARGET,
for n of the doubled hand, and the ask-last rule (D195) holds by
construction. ⚠️ Its test taught a trap worth keeping: **`settle()`
no-ops while a standing ask is up** (the stack is already empty), so a
test that needs the driver's answer must `advanceUntil(awaiting ===
null)` — the harness answers on the way.

**Also:** `Jokulhaups` — the three-type wipe (artifacts, creatures,
lands; the enchantment and the indestructible Myr stand) — joins the
damnation tripwire as its NINTH client, its printed no-regeneration
clause vacuous while the engine has none. `Justice Strike` and
`Kiku's Shadow` land Inner Struggle's exact text on two more oracle
ids — a three-id self-bite family in two batches. `Kaya's Wrath`
counts only MY kills for its gain (Fumigate's rule on the Orzhov twin).
`Kishla Village` puts the paid surveil at #a1 behind D135's
conditional tapped entry (the mana line counts in the index — Fields
of Strife's rule). `Looming-Spires`-style targeted land triggers
continue next batch. `Kami of the Waning Moon` grants FEAR off the
Spirit-or-Arcane cast watcher. `Kaervek's Hex` sums its two color
arms per creature (green 2, white 1, black 0). `Judgment Bolt` reads
my Equipment census at the victim's controller. `Keep Watch` draws
per declared attacker from the defender's seat. `Kindle` and `Life
Burst`-style cross-graveyard name censuses; `Liturgy of Blood` pays
{B}{B}{B} through an indestructible miss; `Lavalanche`-style X fans
arrive next batch; plus Jovial Evil's doubled census, Joyous Respite,
Landbind Ritual, Languish, Kiss of Death, and Kiss of the Amesha.

**Seven refusals, no new classes:** two computed thresholds (the
numeric bound tied to the cast X), the modified predicate, an untap
restriction, two script prompts (Lair Delve's bottom-in-any-order rest
is D141's ordering choice), and a tap-creatures cost.

**Measured after landing:** primitives complete 2,839 · blocked 28,853 ·
scriptableToday 2,214 · ladder [2214, 2313, 4106, 6020, 7232] · tier3
silentAfter 3,250 (+18 exact) · botPool creature 1,585 / instant 511 /
sorcery 365 / land 266 · batch.json 1,550 · botDeck: Adun reaches
1,600.

**Reportables:** the SpellDef discard ask opens the Mind-Rot-shaped
family to scripts (any draw-then-discard or punish-discard wording
with the ask last); prior items stand.

## D222 — M6.4bk: fifteen landed — Legion's End composes three precedents in one resolve (2026-08-20)

**Coverage: 2,839 → 2,854 of 31,692 (+15).** `SHIPPED_SCRIPTS` 942 → 957;
the ledger 326 → 336 (+10, no new classes); the pool 1,550 → 1,525;
fixtures 1,159 → 1,174 (+15, no new tokens). All 43 tests green on the
FIRST run — the fifth first-run-clean batch in six.

**The headliner:** `Legion's End` runs Declaration in Stone's name
match, Echoing Decay's battlefield fan, and Hour of Glory's
hand-reveal-and-exile in ONE resolve — the target, its battlefield
twin, its hand twin, and its graveyard twin all leave for exile with
the hand shown to every seat, and the bystander card stays. Three
landed precedents, zero new machinery.

**Also:** `Lightning Helix` (the classic, trivially). `Liturgy of
Blood` pays {B}{B}{B} through an indestructible miss (CR 608.2c — the
Myr survives and the mana still arrives). `Looming Spires` is the
targeted ETB trigger on a LAND (tapped entry, then the ask, then the
+1/+1-and-first-strike answer). `Lavalanche` fans X off the TARGET's
controller. `Lay Bare` counters and looks — the hand revealed to the
CASTER alone (Gitaxian Probe's looking-is-not-choosing). `Leeches`
drains the poison and returns it as damage. `Leave No Trace` is
Radiance on a destroy (the red target and its red kin die, the blue
enchantment is spared). `Lava Flow`'s creature-or-land compound holds
both arms. `Last Breath`'s exile pays its victim's controller 4
(unconditional rider). Plus Last Kiss, Life Burst's cross-graveyard
namesake gain, Lush-Portico-family surveil/scry lands (Lorehold
Campus at #a1, Lost Legion's ETB scry 2, Lothlórien Lookout's
attacks-scry), and Marsh-Gas-era board math next batch.

⚠️ **A diacritic quirk pinned:** 'Lothlórien Lookout' — constName
strips the ó, so the fixture const is `LOTHL_RIEN_LOOKOUT` while the
module keeps its ASCII filename and export. The port notes carry the
rule for the next accented name.

**Ten refusals, no new classes:** clash, the un-templated
attacking-or-blocking modal, a computed threshold, two up-to-Ns, the
keyword qualifier, the D204-probed second-clause negative (Leeching
Bite's mid-sentence 'Another target'), the modified predicate, the
indefinite color change, and the owner's top-or-bottom pick.

**Measured after landing:** primitives complete 2,854 · blocked 28,838 ·
scriptableToday 2,199 · ladder [2199, 2298, 4091, 6005, 7217] · tier3
silentAfter 3,265 (+15 exact) · botPool creature 1,587 / instant 517 /
sorcery 370 / land 268 · batch.json 1,525 · botDeck: Adun reaches
1,608.

**Reportables:** the composition ceiling keeps rising with zero new
machinery — Legion's End is three precedents deep; prior items stand.

## D223 — M6.4bl: fifteen landed — the pool drain, and two new classes the aim layer owes (2026-08-20)

**Coverage: 2,854 → 2,869 of 31,692 (+15).** `SHIPPED_SCRIPTS` 957 → 972;
the ledger 336 → 346 (+10, TWO new classes); the pool 1,525 → 1,500;
fixtures 1,174 → 1,189 (+15, no new tokens). All 42 tests green on the
FIRST run — the sixth first-run-clean batch in seven.

**The headliner:** `Mana Short` is the first POOL DRAIN — every land the
target player controls tapped in one batch AND their mana pool emptied
(`ManaPoolEmptied`, the reducer's own EMPTY_POOL reset, an event no
script had ever emitted). The test funds p2's pool mid-p1-main and
watches both halves land.

**Also:** `Martyr's Cry` exiles every white creature and pays EACH
controller a draw per own loss (a counts Map, then per-seat drawEvents —
the per-controller fan). `Lys Alana Informant` is the enters-OR-dies
surveil (one shared surveilOne resolve, the dies arm looking back).
`Marrow Shards` sweeps 1 at every ATTACKING creature off a {W/P}
one-pip. `Magmaquake` fans X at every nonflyer AND every planeswalker.
`Lucid Dreams` counts distinct card TYPES in the graveyard;
`Lunar Insight` counts distinct mana VALUES (Golden Ratio's set idiom
on draws). `Lunge` splits 2-and-2 across two targets. `Mana Geode`'s
ETB scry and `Lush Portico`'s tapped-entry surveil extend both land
families. Plus Magnify's board pump, Make Obsolete's board debuff,
Marsh Gas's, Mass Appeal's Human census draw, and Mass Calcify's
one-sided wipe.

⚠️ **Two NEW classes, both aimed at the targeting layer:**
`Lyev Decree` DETAINS (an until-your-next-turn restriction bundle —
'detain mechanic'), and `Malamet Brawler`'s 'target attacking creature'
finally ledgers D161's Angelic Page pull as its own class ('combat
target qualifier unenforced' — the aim accepts a non-attacker today).
`Make Your Move`'s trailing 'power 4 or greater' binds to the CREATURE
arm only — a per-arm qualifier no TargetSpec can carry (Exorcise's
shape), filed under the noun-list parse family.

**Ten refusals in all:** the two new classes plus up-to-N, ctx.random,
bidding, text-changing (CR 612), the noun-list per-arm qualifier,
cast-time computed count, untap restriction, and a script-raised prompt.

**Measured after landing:** primitives complete 2,869 · blocked 28,823 ·
scriptableToday 2,184 · ladder [2184, 2283, 4076, 5990, 7202] · tier3
silentAfter 3,280 (+15 exact) · botPool creature 1,588 / instant 524 /
sorcery 375 / artifact 81 / land 269 · batch.json 1,500 · botDeck: Adun
reaches 1,615.

**Reportables:** the combat-qualifier class joins the keyword/color
qualifier convergence at the aim layer (D139's playbook, one field
over); detain joins the structural tail; prior items stand.

## D224 — M6.4bm: sixteen landed — the per-attacker combat pump reads each defender's board (2026-08-20)

**Coverage: 2,869 → 2,885 of 31,692 (+16).** `SHIPPED_SCRIPTS` 972 → 988;
the ledger 346 → 355 (+9, ZERO new classes); the pool 1,500 → 1,475;
fixtures 1,189 → 1,205 (+16, no new tokens).

**The headliner:** `Mercadia's Downfall` — the first PER-ATTACKER
computed combat pump: each attacking creature's bonus is censused off
its OWN defending player's nonbasic lands (Meriadoc's `DefenderRef`
walked per attacker, a planeswalker defender resolving to its
controller), so two attackers at two defenders can get two different
numbers. The test gives the defender one nonbasic (Darksteel Citadel)
and one basic Mountain — the hit is 2+1, the basic uncounted.

**Also:** `Mathemagics` (2-to-the-X target draws — Exponential
Growth's arithmetic on Braingeyser's shape, reminder text and all);
`Master's Rebuke` and `Might of Alara` land Bite Down's and Gaea's
Might's EXACT texts on second ids, each with a twin assert;
`Master the Way` draws FIRST and burns for the hand INCLUDING the
drawn card; `Massive Raid` / `Might of the Masses` are the creature
census as burn and as pump; `Meltdown` bounds the artifact sweep by X;
`Melt Terrain`'s recoil is its own sentence (an indestructible land
still costs its controller 2); `Metal Fatigue` taps every artifact;
`Meticulous Archive` extends the surveil lands; `Metropolis Angel`
draws off any COUNTERED attacker (the instance fact, via
ManualSetCounter in the test); `Might of the Ancestors` carries Blood
Mist's targeted begin-combat trigger with +2/+0 AND the D194 vigilance
rider in one entry; plus the Mesa Cavalier / Messenger Drake /
Messenger Falcons ETB-and-dies twins.

⚠️ **Two draft-time catches, both by the machinery:** the
DeclareAttackers intent REFUSED bare instance ids at `tsc` (the typed
{card, defender} pair named both test sites before a suite ran), and
Metropolis Angel's hand-delta was measured BEFORE the walk to combat —
the turn's own draw step inflated both variants by one, so the capture
moved to after the advance, beside a comment naming the trap.

**Nine refusals, ZERO new classes:** Meditate's whole-turn skip files
under phase skipping; Mental Misstep is D220's numeric-EXACT hole
verbatim ('mana value 1'); Meteor Storm's random-discard cost sits
under ctx.random; plus the X-count control theft, cast-from-graveyard,
regenerate, incubate, kicker memory, and a script-raised prompt.

**Measured after landing:** primitives complete 2,885 · blocked 28,807 ·
scriptableToday 2,168 · ladder [2168, 2267, 4060, 5974, 7186] · tier3
silentAfter 3,296 (+16 exact) · botPool creature 1,592 / instant 530 /
sorcery 379 / artifact 81 / enchantment 33 / land 270 · batch.json
1,475 · botDeck: Adun reaches 1,622.

**Reportables:** the numeric-exact widening (two ledger cards now);
prior items stand.

## D225 — M6.4bn: fourteen landed — the shipped list passes one thousand, and the discard ask learns arithmetic (2026-08-20)

**Coverage: 2,885 → 2,899 of 31,692 (+14).** `SHIPPED_SCRIPTS` 988 →
**1,002 — PAST ONE THOUSAND**; the ledger 355 → 366 (+11, ZERO new
classes); the pool 1,475 → 1,450; fixtures 1,205 → 1,220 (+15 — the
fourteen plus Swiftfoot Boots, the Equipment Misthios's Fury's
conditional reads).

**The headliner:** `Mind Burst` — the computed-count discard ask, and
the first resolve to carry D137's no-choice rule ITSELF: the count is
one plus a Frantic-Inventory name census over EVERY graveyard, a hand
no bigger than the count goes whole and CHOICELESSLY (CR 701.8a), and
only a real choice raises Laquatus's chooseFromZone prompt. Its own
test proves the choiceless branch with seven graveyard namesakes
against a seven-card hand.

**Also:** `Mind Funeral` reveals until FOUR land cards and mills the
run (Destroy the Evidence's walk, typed off the oracle face — and its
test re-met the Beast Hunt lesson: the reveal is asserted on the LOG,
because the zone move cleared revealedTo). `Mm'menon, Uthros Exile`
is Ivy Lane Denizen's targeted two-def pair filtered on ARTIFACT
entrants — the token arm proven with the Tier-3 Treasure — and joins
as the 66th fully-executable legendary. `Minister of Impediments` is
the SIXTH oracle id on the Trapper tap (the hybrid-cost reminder line
scrubs away, so the tap is #a0). `Mind Stone` and `Misty Palms
Oasis` land sacrifice-draws at #a1 behind engine mana lines.
`Minions' Murmurs` and `Monumental Corruption`-to-come bracket the
census wheel; `Misfortune's Gain` pays the victim's OWNER read
before the move (an indestructible miss still pays); `Mist Raven`
is the targeted ETB bounce; `Misthios's Fury` conditions its recoil
on a derived-SUBTYPE census (an Equipment anywhere on my board);
`Mintstrosity` bakes a Food on dying; `Mind Spring` draws X;
`Might of the Nephilim` doubles the target's own color count;
`Military Intelligence` draws behind a two-attacker threshold.

**Eleven refusals, ZERO new classes:** Minamo's Meddling reads SPLICE
memory (the kicker family); Mind Grind's printed 'X can't be 0' is a
cast-time restriction the engine cannot enforce — claiming the line
unenforced would be the D122 silent-coverage lie; Minds Aglow's Join
forces is a multiplayer payment chain; plus text-changing, two
up-to-Ns, three script prompts, exile-from-graveyard,
once-per-turn memory, and the untap restriction.

**Measured after landing:** primitives complete 2,899 · blocked 28,793 ·
scriptableToday 2,154 · ladder [2154, 2253, 4046, 5960, 7172] · tier3
silentAfter 3,310 / payable 5,096 · botPool creature 1,596 / instant
532 / sorcery 384 / artifact 82 / enchantment 34 / land 271 ·
batch.json 1,450 · botDeck: Adun reaches 1,628 from 66 legendaries.

**Reportables:** the discard-ask family now spans fixed, drawn and
computed counts; prior items stand.

## D226 — M6.4bo: eighteen landed — the untap sweep, and every graveyard empties at once (2026-08-20)

**Coverage: 2,899 → 2,917 of 31,692 (+18).** `SHIPPED_SCRIPTS` 1,002 →
1,020; the ledger 366 → 373 (+7, ZERO new classes — three of the seven
are named FAMILIES' next cards); the pool 1,450 → 1,425; fixtures
1,220 → 1,238.

**The firsts:** `Mobilize` is the first UNTAP SWEEP — one
`PermanentsUntapped` batch over my tapped derived creatures, Metal
Fatigue's mirror. `Morningtide` empties EVERY graveyard into exile in
one simultaneous move (its own resolved spell lands in the caster's
graveyard AFTERWARD, which the test deliberately does not assert away).
`Mulch` is the choiceless reveal-sort counted off the LOG's own
CardsRevealed. `Moonfolk Puzzlemaker` raises the scry ask from a
BECOMES-TAPPED watcher (toGraveyard FALSE — a scry bottoms, never
buries). `Mosstodon` lands the floored activated trample grant — and
its test swapped Colossal Dreadmaw OUT for Grave Titan, because a
target with PRINTED trample makes the grant assert vacuous.

**Also:** `Mogg Raider` carries Goblin Sledder's exact text (twin
assert, pays with ITSELF); `Molten Rain`'s recoil is CONDITIONED on
the victim's derived supertype read pre-move (a basic dies free; a
nonbasic indestructible survives and still costs 2); `Multani's
Decree` counts its own kills at 2 apiece; `Monumental Corruption`
wheels the TARGET off my artifact census; `Metropolis-style` triggers
land as Moonlit Wake (ANY creature dies, artifact deaths pay nothing)
and Moonrise Cleric; `Monk Realist`'s targeted ETB destroy; `Mob
Justice`'s player-or-planeswalker census burn; `Mudhole`'s computed
graveyard-subset exile; `Morale`'s combat-wide pump (the test's own
arithmetic was corrected by the engine: Aysen Bureaucrats is a 1/1,
so the pumped pair connects for 3+2); `Mothrider Patrol`'s priced
tap; `Mossbeard Ancient`'s entry gain.

⚠️ **A tooling slip caught and reversed:** one draft test was touched
by a PowerShell string pipeline and its em-dashes double-encoded —
the D194 rule held (the file was REWRITTEN with the Write tool, never
patched), and the port notes now carry a mangled-byte grep.

**Seven refusals, ZERO new classes:** Mnemonic Nexus shuffles from a
resolve (the RNG stub); Molder is the numeric-EXACT family's third
card; Most Valuable Slayer's 'target attacking creature' is the
combat-qualifier class's second; plus a discard-cost chooser, the
indefinite color change, exile-from-graveyard, and the
graveyard-activated ability.

**Measured after landing:** primitives complete 2,917 · blocked 28,775 ·
scriptableToday 2,136 · ladder [2136, 2235, 4028, 5942, 7154] · tier3
silentAfter 3,328 / payable 5,093 · botPool creature 1,604 / instant
534 / sorcery 391 / artifact 82 / enchantment 35 / land 271 ·
batch.json 1,425 · botDeck: Adun reaches 1,639.

**Reportables:** the numeric-exact and combat-qualifier widenings each
hold multiple ledger cards; prior items stand.

## D227 — M6.4bp: twenty landed — the countered spell learns to pay, and the Snake counters from the battlefield (2026-08-20)

**Coverage: 2,917 → 2,937 of 31,692 (+20) — the biggest batch of the
arc.** `SHIPPED_SCRIPTS` 1,020 → 1,040; the ledger 373 → 378 (+5, both
parse refusals PROBED before a line was drafted); the pool 1,425 →
1,400; fixtures 1,238 → 1,260 (+20 cards, +2 token pins: Murmuring
Mystic's Bird Illusion tgrn 3 and Myr Sire's Phyrexian Myr tcmm 44,
mapped from TOKEN_TABLE's own printingIds).

**The firsts:** `Multani's Presence` is the FIRST `SpellCountered`
consumer — the countered spell leaves in the same batch, so the def
looks BACK and reads its controller off the before-state's stack (its
test drives a REAL Counterspell from the opponent's seat at p1's held
Bears cast). `Mystic Snake` is the first ETB trigger AIMED AT THE
STACK: the trigger's spec is the counterspell's, the answer arrow's
stack TargetSource (D169) carries it, and the resolve is Daring
Apprentice's two-event pair — a creature that counters on entry, mid
someone else's cast. `Mystic Repeal` and `Natural Obsolescence` land
the BOTTOM-of-library placement as targeted removal (not destruction:
indestructible is no shield).

**Also:** `Murmuring Mystic` is Talrand's filter paying a Bird
Illusion; `Nebelgast Beguiler` carries Master Decoy's exact text (the
SEVENTH Trapper-tap id) and `Mogg-Raider`-era Sledder logic reaches
`Mogg Raider`'s twin; `Muscle Burst` and `Mind-Burst`-style
censuses meet as a pump; `Mutilate` scales Nausea's board debuff by
the Swamp census; `Mulch`-era reveal machinery serves
`Nature's Resurgence`'s per-seat graveyard-census draws;
`Nature's Claim` pays the controller through an indestructible miss;
`Naga Oracle` surveils 3 on entry; `Nantuko Disciple`,
`Mystic Archaeologist`, `Myr Scrapling`, `Myr Sire`,
`Mutant Town`, `Muse Drake`, `Natural Spring`, `Nature's Ruin`
and `Nausea` round out the twins — Nausea's own test corrected by
the engine (a 2/2 at -1/-1 is a LIVING 1/1; the victim became the
Bureaucrats).

⚠️ **Both parse refusals were PROBED, not guessed** (probe JSON kept in
the drafts): `Mystic Denial`'s 'creature or sorcery spell' parses
CONFIDENT to a battlefield CREATURE — the typed-spell compound hole,
the aim offering permanents for a counterspell — and `Mutiny`'s
'another target creature that player controls' is silently DROPPED
(the second-clause family, with a cross-target binding no spec can
carry).

**Five refusals:** the two probed parse holes, Muse Vortex
(play-from-exile + a random-order bottom), Nahiri's Stoneblades
(up-to-N), Natural Affinity (land animation).

**Measured after landing:** primitives complete 2,937 · blocked 28,755 ·
scriptableToday 2,116 · ladder [2116, 2215, 4008, 5922, 7134] · tier3
silentAfter 3,348 / payable 5,089 · botPool creature 1,613 / instant
538 / sorcery 396 / artifact 82 / enchantment 36 / land 272 ·
batch.json 1,400 · botDeck: Adun reaches 1,652.

**Reportables:** the typed-spell compound widening joins the aim-layer
queue beside the numeric-exact and combat-qualifier families; prior
items stand.

## D228 — M6.4bq: nineteen landed — the departure watcher, and three entry pairs (2026-08-20)

**Coverage: 2,937 → 2,956 of 31,692 (+19).** `SHIPPED_SCRIPTS` 1,040 →
1,059; the ledger 378 → 384 (+6, ZERO new classes); the pool 1,400 →
1,375; fixtures 1,260 → 1,281 (+19 cards, +2 token pins: News
Helicopter's Human Citizen tspm 4 and the Schematic's Construct tclb
16; Nimble Thopterist REUSES the pinned tafc-12 Thopter). All 41 tests
green on the FIRST run — the seventh first-run-clean batch.

**The firsts:** `Nefarious Imp` is the first LEAVES-the-battlefield
watcher — the mover's controller is a fact about the board it left, so
the def looks back, and the Imp's OWN exit counts (Brandywine's rule,
deliberately no self-exclusion). `Nimblewright Schematic` is the
artifact enters-OR-dies token pair on one printed line. `Nimraiser
Paladin` returns a D139-floored creature card from the graveyard to
HAND on an ETB trigger (the mv-6 Titan asserted refused at the
answer). Three SELF-OR-SUBTYPE entry pairs land at once — `Nebelgast
Herald` (Spirits, tapping an opponent's creature through the aim),
`Nighthawk, Dark Defender` (Heroes, the 67th fully-executable
legendary) and `Neighborhood Guardian` (power ≤2, Elemental Bond's
threshold turned around) — each two defs with resolves inline twice
(D178's tsc rule).

**Also:** `Neutralize the Guards` debuffs one player's board with the
surveil ask LAST; `New Benalia` and `Nightveil Sprite` extend the
scry/surveil lands and attack-surveils; `Needle Storm` sweeps 4 over
flyers only (batch-mate Muse Drake is the positive); `Neurok Replica`
and `Nim Replica` pay mana AND themselves; `Need for Speed`
sacrifices a LAND for the haste rider; `Network Disruptor` taps any
permanent on entry; `Nine-Tail White Fox` draws on connecting;
`News Helicopter`, `Nimble Innovator`, `Nimble Thopterist`,
`Nightmarish End` round out the twins.

**Six refusals, ZERO new classes:** Necromantic Selection exiles
ITSELF mid-resolution (Cerebral Eruption's class); Nissa's Revelation
puts a computed effect AFTER the scry ask (D195's Read-the-Bones
rule); Nivix Barrier's 'target attacking creature' is the
combat-qualifier class's THIRD card; plus exile-from-graveyard, the
UEOT color change, and mana-spent memory.

**Measured after landing:** primitives complete 2,956 · blocked 28,736 ·
scriptableToday 2,097 · ladder [2097, 2196, 3989, 5903, 7115] · tier3
silentAfter 3,367 / payable 5,086 · botPool creature 1,626 / instant
540 / sorcery 397 / artifact 83 / enchantment 37 / land 273 ·
batch.json 1,375 · botDeck: Adun reaches 1,661 from 67 legendaries.

**Reportables:** the combat-qualifier class at three cards is due
beside the numeric-exact and typed-spell-compound widenings; prior
items stand.

## D229 — M6.4br: sixteen landed — two blockers, two firings (2026-08-20)

**Coverage: 2,956 → 2,972 of 31,692 (+16).** `SHIPPED_SCRIPTS` 1,059 →
1,075; the ledger 384 → 393 (+9, ZERO new classes); the pool 1,375 →
1,350; fixtures 1,297 (no new token pins — the Clue, Treasure and
Vampire all reuse).

**The headliner:** `Noble Stand` is the SECOND perItem consumer —
D190's fan-out on `BlockersDeclared` items: "whenever a creature you
control blocks" fires once PER BLOCKING CREATURE, and the test declares
TWO blockers in ONE declaration and gains exactly 4.

**Also:** `No Witnesses` runs the most-creatures census (ties
included) and pays the Clues BEFORE its own wipe empties the count.
`Nurgle's Conscription` reanimates from an opponent's graveyard
TAPPED under my control and exiles the REST of that graveyard after
the move. `Notion Rain` emits its recoil FIRST and the surveil ask
LAST with thenDraw 2 (Cruel Truths' ordering) — and its empty-library
branch draws through `drawEvents` so "then draw two" is never
dropped. `Noxious Revival`'s SpellDef claims the FULL printed text,
Phyrexian reminder line included (the Marrow Shards precedent), and
puts any graveyard card on TOP of its owner's library. `Odric's
Outrider` is the self-inclusive dies watcher with a targeted counter;
`Oggyar Battle-Seer` is the first activated scry on a CREATURE;
`Nyx-Fleece Ram` gains on MY upkeep only; `Mutilate`-style censuses
land as `Olivia's Wrath` (non-Vampire -X/-X); plus Noble Steeds,
Nocturnal Raid, Noggle Robber's enters-or-dies Treasures, North Pole
Gates, Oasis Gardener, Octoprophet, Ogre Arsonist and Opportunity-era
twins.

**Nine refusals, ZERO new classes:** Nullify is Mystic Denial's PROBED
typed-spell compound hole verbatim; Ogre Shaman's cost discards at
random (the RNG stub); Noxious Grasp's "that's green or white" is
Devout Decree's class; plus the quoted-ability grant, rad counters,
tap-creatures, remove-counter, return-permanent and the untap
restriction.

**Measured after landing:** primitives complete 2,972 · blocked 28,720 ·
scriptableToday 2,081 · ladder [2081, 2180, 3973, 5887, 7099] · tier3
silentAfter 3,383 / payable 5,083 · botPool creature 1,633 / instant
543 / sorcery 400 / artifact 83 / enchantment 39 / land 274 ·
batch.json 1,350 · botDeck: Adun reaches 1,668.

**Reportables:** the perItem fan-out has now paid on draws and blocks —
the remaining granularity ledger entries are each one def away; prior
items stand.

## D230 — M6.4bs: nineteen landed — the land that surveils and survives (2026-08-20)

**Coverage: 2,972 → 2,991 of 31,692 (+19).** `SHIPPED_SCRIPTS` 1,075 →
1,094; the ledger 393 → 399 (+6, ONE new class); the pool 1,350 →
1,325; fixtures 1,316 (no new token pins — the Gnome and the 2/2
Zombie were both VERIFIED as the pinned printings before a line was
written). All 45 tests green on the FIRST run — the eighth
first-run-clean batch.

**The firsts:** `Ominous Asylum` is the ACTIVATED surveil land — {4}
and the tap, NO sacrifice, and its test asserts the land SURVIVES its
own ability tapped (the sac-draw lands' opposite). `One with
Nothing` is the choiceless whole-hand discard as a SpellDef. `One
with the Machine` draws the GREATEST mana value among my artifacts
(the Gaze idiom on a draw). `Orcish Mechanics` and `Orcish Vandal`
land ONE ability text on two oracle ids IN THE SAME BATCH (the Fisk
precedent), each proven on its own id.

**Also:** `Omenspeaker` carries Octoprophet's exact text (twin
assert); `Onslaught` taps off my creature casts; `Open the Graves`
pays a 2/2 Zombie per nontoken death and its own token's death pays
nothing; `Orc Sureshot`'s entry pair debuffs the opponent;
`Orcish Bloodpainter`'s creature chooser pings; `Ornamental
Courage` untaps and pumps in one resolve; `Ornery Kudu` is the
targeted -1/-1 counter; `Oltec Cloud Guard` (Gnome), `Onyx
Goblet`, `Onyx Mage`, `Opportunity`, `Oracle's Restoration`
(three riders), `Omashu City` and `Orzhov Cluestone` round out the
twins.

**Six refusals, ONE new class:** `Ominous Sphinx` names the
DISCARD-EVENT DISCRIMINATOR — a discard is a bare hand-to-graveyard
CardsMoved indistinguishable from a Tier-3 move (Graf Mole's sacrifice
shape and Horizon Chimera's old draw shape, one verb over; the cycling
half has nothing to watch at all). Open the Vaults returns AURAS,
whose enchant-target choice is a prompt; plus tap-creatures, the
untap-symbol cost, a discard-cost chooser and exile-from-graveyard.

**Measured after landing:** primitives complete 2,991 · blocked 28,701 ·
scriptableToday 2,062 · ladder [2062, 2161, 3954, 5868, 7080] · tier3
silentAfter 3,402 / payable 5,075 · botPool creature 1,641 / instant
546 / sorcery 402 / artifact 85 / enchantment 41 / land 276 ·
batch.json 1,325 · botDeck: Adun reaches 1,682.

**Reportables:** the discriminator family holds FOUR members (sacrifice,
draw — closed by D189 — scry/surveil, discard): a typed-cause or marker
design would sweep the remaining three; prior items stand.

## D231 — M6.4bt: twenty landed — three thousand crossed (2026-08-21)

**3,011 of 31,692 Commander-legal cards now execute completely, up from
2,991** — the coverage count crosses three thousand, on a twenty-card
batch that ties the arc record. `SHIPPED_SCRIPTS` 1,094 → 1,114; the
REFUSED ledger holds 404. All 51 tests green on the FIRST run — the
ninth first-run-clean batch.

**The headliners:** `Overwhelming Intellect` counters a CREATURE spell
and draws its mana value — the typed-spell noun PROBED before drafting:
'creature spell' parses with cardTypes ENFORCED, so the aim layer
refuses a Lightning Bolt and the draw reads the countered card's parsed
cost. `Parallectric Feedback` is the stack-aimed burn at the CASTER —
the spell it aims at still RESOLVES (probed: 'target spell's
controller' aims at the stack, hurts a player, counters nothing).

**Also:** `Ostiary Thrull` is the EIGHTH id on the Trapper tap text;
`Outlaw Medic` and `Palace Familiar` share one dies-draw line behind
different keyword headers, each proven on its own id; `Oyobi, Who
Split the Heavens` pays a 3/3 Spirit (tvoc 3, a NEW pin) per
Spirit-or-Arcane cast — her test casts batch-mate `Nebelgast Herald`;
`Overwhelming Forces` is the one-player wipe that draws per kill;
`Oxidize` joins the damnation tripwire as its TENTH client; the
Peer-family twins and the Papyrus/Oasis land shapes round out the
twenty.

**Five refusals, ZERO new classes:** Oust (library position placement),
Over the Top (script-raised prompt — the mass put includes Auras),
Ovinize (until-end-of-turn base P/T set), Pain's Reward (bidding),
Painful Truths (converge — cast-time mana-color memory).

**Measured after landing:** primitives complete 3,011 · blocked 28,681 ·
scriptableToday 2,042 · ladder [2042, 2141, 3934, 5848, 7060] · botPool
creature 1,648 / instant 550 / sorcery 406 / artifact 87 / enchantment
43 / land 277 · fixtures 1,337 (75 tokens) · batch.json 1,300 ·
botDeck: Adun reaches 1,690 from 68 legendaries.

**Reportables:** the typed-spell counter shape is now proven with BOTH
riders (draw here, burn/gain in D219's family); the discriminator and
qualifier families stand; prior items stand.

## D232 — M6.4bu: twenty-one landed — a new record, and four test traps in one batch (2026-08-21)

**3,032 of 31,692 Commander-legal cards now execute completely, up from
3,011** — twenty-one scripts, the largest batch of the arc (the record
was 20, held three times). `SHIPPED_SCRIPTS` 1,114 → 1,135; the REFUSED
ledger holds 408 (+4, zero new classes).

**The headliners:** `Peer into the Abyss` (the target draws
ceil(library/2) and loses ceil(life/2), both computed in one resolve);
`Phyresis Outbreak` (each opponent's poison lands FIRST, so the
per-controller debuff counts the new counter — the resolve computes the
after-map before emitting); the `Penumbra` trio (dies-shadow tokens on
THREE new pins — Cat tdmr 3, Spider tmma 7, Wurm tuma 7); `Pestered
Wellguard` (becomes-tapped pays a Faerie on the fourth new pin,
tecl 5); `Peer Past the Veil` (the wheel whose type census reads
graveyard-UNION-hand while the resolving sorcery is still on the stack
and correctly absent).

**Also:** the exact-text twins `Path of Peace` = Misfortune's Gain and
`Patron of the Arts` = Noggle Robber; `Phyrexia's Core` (the artifact
chooser paying a gain on a LAND); `Phyrexian Debaser` (the tapped
self-sacrifice debuff); `Parcel Myr` (the self-sacrifice draw);
`Perish` (the color wipe, the damnation tripwire's ELEVENTH client);
`Peppersmoke` (debuff + Faerie-gated draw, proven both ways).

⚠️⚠️ **NOT first-run clean — nine failures across four files, and every
one was the TEST, with four traps worth keeping:**
1. **`put()` FETCHES from the player's own listed deck** — it does not
   materialize from the oracle, so every support name must be LISTED in
   that player's deck (N times for N puts). Fourteen deck lists patched.
2. **`CardInstance` carries no `name`** — name reads go through
   `nameOf(g, id)` (the oracle), and the spell is fetched to hand with
   `put(g, p, name, 'hand')`, never found by scanning a shuffled
   opening hand.
3. **A spell can resolve INSIDE its own CastSpell submit** under default
   stops — capture baselines BEFORE the cast (the D232 probe showed the
   whole resolution inside the submit's event batch; two tests measured
   deltas of zero around an already-resolved spell).
4. **The opening hand is 7 of a shuffled 30** (decks pad with basics) —
   a wheel's "empty hand" variant actually discards six basic Lands
   (one type, one draw), and listed nonbasics must be fetched OUT
   (exile) when a census must not see them.

**Four refusals, ZERO new classes:** Part Water (cast-time computed
target count), Patrol Signaler (untap-symbol activation cost), Peace of
Mind and Pegasus Refuge (discard-cost chooser).

**Measured after landing:** primitives complete 3,032 · blocked 28,660 ·
scriptableToday 2,021 · ladder [2021, 2120, 3913, 5827, 7039] · botPool
creature 1,656 / instant 556 / sorcery 412 / artifact 87 / enchantment
43 / land 278 · fixtures 1,362 (79 tokens) · batch.json 1,275 ·
botDeck: Adun reaches 1,704 from 68 legendaries.

**Reportables:** the discard-cost chooser keeps absorbing refusals; the
aim-layer qualifier convergence stands; prior items stand.

## D233 — M6.4bv: eighteen landed — the prevention tripwire, and the widening the refusals demand (2026-08-21)

**3,050 of 31,692 Commander-legal cards now execute completely, up from
3,032.** `SHIPPED_SCRIPTS` 1,135 → 1,153; the REFUSED ledger holds 415.
All 43 tests green on the FIRST run — the tenth first-run-clean batch,
and the first drafted entirely under D232's four pinned traps.

**The headliners:** `Planar Birth` (the mass tapped reanimation —
every basic land card in EVERY graveyard stands up tapped for its
owner, Nurgle's Conscription's idiom at format width, the nonbasic
negative pinned); `Pinpoint Avalanche` ships behind a NEW TRIPWIRE —
**`prevention.node.test.ts`**: script damage never routes through
combat.ts's `preventedAmount` (the engine's ONE prevention site, CR
702.16c), so "The damage can't be prevented" executes as nothing
TODAY, and the scan fails the day effects.ts or reducer.ts gains the
concept (the damnation pattern, one clause over — and the test pins
combat.ts still HOLDS the site, so the argument cannot silently move).

**Also:** `Phyrexian Vivisector` (the dies-scry — its OWN death asks
too); `Phyrexian Reclamation` (the life-priced activated graveyard
return, the land-card refusal pinned); `Piety` (the +0/+3 blocker
sweep through a real DeclareBlockers); `Pierce Strider` (the targeted-
opponent ETB — self-targeting REFUSED, D217's enforcement met from the
trigger side); `Pillage` and `Plague Wind` (damnation tripwire
clients #12 and #13); `Plagued Rusalka` (the chooser paying with
ITSELF, CR 113.7a); the `Phyrexian Defiler`/`Denouncer` pair
(Debaser's line at -3/-3 and -1/-1); `Piranha Marsh` and `Pith
Driller` (targeted ETB triggers answered through the arrow).

**Seven refusals, ONE new class — and a widening now overdue by
weight:** Pierce the Sky, Pinion Feast and Pistus Strike are ALL
'keyword target qualifier unenforced' — THREE in one batch, taking
D197's class to a size that makes TargetSpec.keywords (D139's playbook
one field over) the heaviest named aim-layer debt. Plus Piracy
('tap-permission grant', NEW), Pit Fight ('spell target parse (second
clause)' — PROBED before drafting: the mid-sentence "another target
creature" IS silently dropped, the family's NINTH card), Pieces of the
Puzzle (script-raised prompt), Plague Witch (discard-cost chooser).

**Measured after landing:** primitives complete 3,050 · blocked 28,642 ·
scriptableToday 2,003 · ladder [2003, 2102, 3895, 5809, 7021] · botPool
creature 1,666 / instant 558 / sorcery 415 / artifact 88 / enchantment
44 / land 279 · fixtures 1,380 (79 tokens — none new) · batch.json
1,250 · botDeck: Adun reaches 1,719 from 68 legendaries.

**Reportables:** the keyword-qualifier widening (four ledger cards and
counting); the prevention tripwire joins the damnation tripwire as the
second vacuity contract; prior items stand.

## D234 — M6.4bw: sixteen landed — the hexproof carrier ride, and the block that cannot be asked for (2026-08-21)

**3,066 of 31,692 Commander-legal cards now execute completely, up from
3,050.** `SHIPPED_SCRIPTS` 1,153 → 1,169; the REFUSED ledger holds 424
(+9, TWO new classes).

**The headliners:** `Plumecreed Escort` is the first targeted-grant
ride for HEXPROOF on D194's carrier — the aim layer consults the
granted keyword derived (D129's promise met from the grant side, the
opponent-creature refusal pinned); `Play with Fire` branches its
scry rider on the TARGET KIND (a player raises the ask, a creature
does not — both pinned); `Plow Under` puts two lands on their OWN
owners' library tops; `Planar Cleansing` is the nonland wipe;
`Pounce` lands Prey Upon's exact text at instant speed; `Preening
Champion` mints the blue-and-red Elemental on a pin matched to
TOKEN_TABLE's OWN pick (tsoc 21 — never pin a token to a printing the
table does not name); `Precinct Captain` pays a Soldier on
connecting; `Prescient Chimera` scries on my instant and sorcery
casts; `Price of Progress` taxes each player twice per nonbasic.

⚠️ **One test-side failure, and the FIFTH pinned loop trap:** a
defender with NO creatures is never asked to block — an
`advanceUntil(declareBlockers)` against that board never matches and
runs the game to its deck-out end, surfacing as a gameOver rejection
two submits later. The blocks walk is now conditional on a blocker
existing, and own-attack tests advance to turnNumber === 3 (summoning
sickness). One draft tsc fix: a StackObject carries no printingId —
the cast face reads via `ev.obj.card` → the instance.

**Nine refusals, TWO new classes:** `Portcullis Vine` names the
KEYWORD-PREDICATE SACRIFICE COST (predicateOf refuses lowercase
'with' — a keyword predicate has no field), and `Powerleech` names
the ACTIVATION-EVENT DISCRIMINATOR (the tapped arm is watchable; 'an
opponent activates an artifact ability without {T}' has no event
carrying the cost's shape). Plus Plummet — the keyword-qualifier
class's FOURTH card — Plunge into Winter (up-to-N), Polymorph
(ctx.random — the mid-resolve shuffle), Polymorphist's Jest (UEOT base
P/T set), Portent of Calamity and Press the Enemy (script-raised
prompt), Presumed Dead (temporary non-keyword ability grant).

**Measured after landing:** primitives complete 3,066 · blocked 28,626 ·
scriptableToday 1,987 · ladder [1987, 2086, 3879, 5793, 7005] · botPool
creature 1,674 / instant 561 / sorcery 420 · fixtures 1,397 (80
tokens — the Elemental new) · batch.json 1,225 · botDeck: Adun reaches
1,727 from 68 legendaries.

**Reportables:** the keyword-qualifier widening (four cards) stays the
heaviest aim-layer debt; the two new cost/discriminator classes join
their families; prior items stand.

## D235 — M6.4bx: twenty landed — the third perItem consumer, and the choice a hand cannot make (2026-08-21)

**3,086 of 31,692 Commander-legal cards now execute completely, up from
3,066.** `SHIPPED_SCRIPTS` 1,169 → 1,189; the REFUSED ledger holds 429
(+5, zero new classes). All 43 tests green on the FIRST run — the
eleventh first-run-clean batch.

**The headliners:** `Profane Memento` is the THIRD perItem consumer
(D190) — a wipe filling an opponent's graveyard with three creature
cards pays three, one firing per card, with the predicate written
inline twice (D178) and the mover typed off the ORACLE face; `Prism
Ring` lands Diamond Mare's two lines with "artifact" for "creature"
(the built-in As-enters colour choice feeding the chosen-colour cast
watcher — AnswerChooseColor in the test, on- and off-colour both
pinned); the `Prodigal Pyromancer`/`Prodigal Sorcerer` pair puts ONE
printed tap-ping text on two ids in a single batch (the Fisk
precedent); `Prosperity` hands every player X cards off the stack
object's xValue; `Prismari Campus` is the paid activated scry land;
`Pride Guardian` gains on its own block through a real
DeclareBlockers.

**Also:** `Planar Despair`'s Domain sweep (domain 2 kills the 2/2 and
leaves the 6/6 at 4/4); `Prized Statue`'s enters-or-dies Treasure
pair; `Prosperous Pirates`' two DISTINCT Treasures; `Priest of
Iroas` trading itself for an enchantment; `Provoke the Trolls`'
creature-branch anger (+5/+0 to its own victim); `Prophet of the
Peak`'s scry 2; `Pseudodragon Familiar`'s tapless flying grant;
`Psionic Blast`'s printed recoil; `Protector of Gondor` and
`Prideful Parent` on the Human Soldier and NEW Cat pins.

**Five refusals, ZERO new classes — one PROBED:** `Prying Questions`
is refused because the hand-zone chooseFromZone answer only DISCARDS —
the awaiting has no destination for the CHOSEN card, so "puts a card
from their hand on top of their library" cannot be asked (probe in the
wanted-block). Plus Primal Might (up-to-N), Primal Surge and Prying
Questions (script-raised prompt), Prince Imrahil the Fair
(once-per-turn trigger memory), Prismatic Lace (color change).

**Measured after landing:** primitives complete 3,086 · blocked 28,606 ·
scriptableToday 1,967 · ladder [1967, 2066, 3859, 5773, 6985] · botPool
creature 1,684 / instant 564 / sorcery 423 / artifact 91 / land 280 ·
fixtures 1,418 (81 tokens — the Cat tfdn 1 new) · batch.json 1,200 ·
botDeck: Adun reaches 1,737 from 68 legendaries.

**Reportables:** the hand-ask destination (library-top) is a cheap
widening of the D137 prompt when its family grows; prior items stand.

## D236 — M6.4by: eighteen landed — counters with riders, and the compound the probe halved twice (2026-08-21)

**3,104 of 31,692 Commander-legal cards now execute completely, up from
3,086 — past thirty-one hundred.** `SHIPPED_SCRIPTS` 1,189 → 1,207;
the REFUSED ledger holds 436 (+7, zero new classes). All 39 tests green
on the FIRST run — the twelfth first-run-clean batch.

**The headliners:** `Psychic Barrier` and `Punish Ignorance` land
the counter-with-riders family's typed and four-colour ends (the
countered spell's CONTROLLER is read before the SpellCountered — one
loses 1, the other drains 3 and gains 3; both tests cast the victim
from the OPPONENT'S seat on their turn and aim at the stack top);
`Public Execution` rides the PROBED-ENFORCED 'an opponent controls'
spec (my own creature is not a legal victim) and exempts the victim
from its own -2/-0 aftermath; `Puncture Blast` is the spell that
ITSELF has wither — creatures wear its 3 as -1/-1 counters while a
player just loses life (the applyAs branch on target kind, the whole
text incl. the reminder claimed per Marrow Shards); `Rabid Gnaw`
reads the biter's power AFTER its own +1/+0.

**Also:** `Rage-Scarred Berserker`'s pump-and-indestructible rider on
D194's carrier; `Putrefy` (damnation tripwire client #14);
`Quandrix Campus` beside Prismari's paid scry; `Racers' Ring`'s
three-line self-sac draw; `Radiating Lightning`'s player-and-board
fan (the mixed-target hit() helper — never a cast); `Purify`'s
two-type wipe; `Pyroclasm`; `Pym Technologies`; the
`Rakdos`-family stones next batch.

**Seven refusals, ZERO new classes — two PROBED:** Purge's 'artifact
creature or black creature' and Radiant Strike's 'artifact or tapped
creature' BOTH parse confident to bare 'artifact' — modifier arms are
silently dropped, the noun-list family's exact hole, two more cards for
the compound sweep-probe. Plus Psychic Trance (temporary non-keyword
ability grant), both Pulses (spell relocates itself), Purelace (color
change), Radiant Flames (converge).

**Measured after landing:** primitives complete 3,104 · blocked 28,588 ·
scriptableToday 1,949 · ladder [1949, 2048, 3841, 5755, 6967] · botPool
creature 1,688 / instant 573 / sorcery 425 / land 283 · fixtures 1,436
(81 tokens — none new) · batch.json 1,175 · botDeck: Adun reaches 1,749
from 68 legendaries.

**Reportables:** the noun-list/compound sweep-probe keeps gaining
weight; prior items stand.

## D237 — M6.4bz: TWENTY-THREE landed — the record falls, and the ask reaches the target twice (2026-08-21)

**3,127 of 31,692 Commander-legal cards now execute completely, up from
3,104 — twenty-three scripts, THE NEW ARC RECORD** (the old record, 21,
was D232's). `SHIPPED_SCRIPTS` 1,207 → 1,230; the REFUSED ledger holds
438 — **+2, the smallest refusal count of any batch**, because the
R-page is twin country. All 47 tests green on the FIRST run — the
thirteenth first-run-clean batch.

**The headliners:** `Rakdos's Return` composes the X burn with D137's
computed discard ask at the TARGET — X damage lands first, then the
target's discard-X ask, with BOTH CR 701.8a branches pinned (a hand of
X or fewer goes whole and choicelessly; a bigger hand raises the
prompt); `Ravenous Rats` raises the same ask from a targeted TRIGGER;
`Rally the Righteous` spends Brightflame's radiance set on untaps and
a pump (the off-colour bystander untouched); `Rakka Mar` is the
repeatable token legend — the 69th fully-executable legendary — minting
distinct hasty Elementals across turns; `Ravnica at War` exiles the
multicoloured (DERIVED colors at two or more; exile ignores
indestructible); `Rain of Blades` sweeps the declared attackers;
`Rain of Daggers` bills its caster 2 per creature actually destroyed
(the indestructible survivor costs nothing).

**Also:** the `Rakdos` Cluestone/Locket pair (the sixth colour pair);
`Ravenous Chupacabra` on the probed-enforced opponent spec;
`Rakeclaw Gargantuan` behind D139's power-5 floor; `Rathi Trapper`
(its OWN {B}, {T} text, not the eight-id Trapper line); `Raucous
Theater` (the surveil land whose parenthesized mana line comes FIRST —
TEXT is split[2]); `Ravages of War` (Armageddon's four words);
`Rally of Wings`' untap-plus-flyer-pump; `Rapacious Dragon` and
`Redcap Thief`... next batch; `Ravenous Baloth` eating ITSELF for 4
(CR 113.7a) while a Bears is refused as not a Beast.

⚠️ **One combat-math lesson pinned at draft time:** a 2/2 blocker at
+1/+1 still DIES to a 2/2 attacker — Rally's test uses a 1/1 attacker
so the survival claim is real.

**Two refusals, ZERO new classes:** Ranger's Firebrand (the Ring
mechanic), Rats' Feast (cast-time computed target count).

**Measured after landing:** primitives complete 3,127 · blocked 28,565 ·
scriptableToday 1,926 · ladder [1926, 2025, 3818, 5732, 6944] · botPool
creature 1,697 / instant 577 / sorcery 431 / artifact 93 / land 285 ·
fixtures 1,460 (82 tokens — the hasty Elemental tcmm 25 new) ·
batch.json 1,150 · botDeck: Adun reaches 1,765 from 69 legendaries.

**Reportables:** the computed ask (damage-then-discard) is now a proven
compose; prior items stand.

## D238 — M6.4ca: twelve landed — the theft reanimation, and the letter that refuses (2026-08-21)

**3,139 of 31,692 Commander-legal cards now execute completely, up from
3,127.** `SHIPPED_SCRIPTS` 1,230 → 1,242; the REFUSED ledger holds 451
(+13 — the refusal-heaviest batch since D201, because the Re- page is
mechanic country: clash twice, regeneration twice, phasing, manifest,
amass, the Ring's cousins). All 26 tests green on the FIRST run — the
fourteenth first-run-clean batch. ONE new class: **'phasing'** (Reality
Ripple — no phased-out state exists anywhere in the engine).

**The headliners:** `Reanimate` is the THEFT reanimation — the
battlefield move's `to.player` IS the controller (Nurgle's idiom made
canonical: the 6-drop rises under MY control, owner still the opponent,
and the bill is the printed mana value read before the move); `Reki,
the History of Kamigawa` filters casts on the face's SUPERTYPE (a
legendary cast draws, a plain Bears does not — the 70th
fully-executable legendary watching for its own kind); `Razorfin
Hunter` puts the Prodigal tap-ping text on its THIRD id; `Reclaiming
Vines` rides the probed triple ('artifact, enchantment, or land' —
ALL THREE arms enforced, each proven).

**Also:** `Razorkin Hordecaller`'s you-attack Gremlin (attacking at
turn 3 — the summoning-sickness idiom); `Rebuking Ceremony` (two
artifacts to their OWN owners' library tops); `Reckless Assault`
(the life-priced repeatable ping, twice in a turn for 4 life);
`Reduce to Dreams` (the two-type bounce-wipe); `Refuse to Yield`
(+2/+7 and stand up); `Reclaim` (graveyard card to library top);
`Reckless Reveler` and `Redcap Thief` on committed lines.

**Thirteen refusals — two PROBED:** Ray of Ruin's
'creature, Vehicle, or nonbasic land' halves to bare 'target creature'
(the subtype and negated-supertype arms both drop — the D216 Gravkill
hole met again), and Reach of Shadows' "that's one or more colors" is
silently dropped. Plus phasing (NEW), manifest (face-down family),
play-from-exile, clash ×2, regeneration ×2, script-raised prompt ×2,
up-to-N, amass.

**Measured after landing:** primitives complete 3,139 · blocked 28,553 ·
scriptableToday 1,914 · ladder [1914, 2013, 3806, 5720, 6932] · botPool
creature 1,702 / instant 579 / sorcery 435 / enchantment 45 · fixtures
1,473 (83 tokens — the Gremlin tmh3 23 new) · batch.json 1,125 ·
botDeck: Adun reaches 1,774 from 70 legendaries.

**Reportables:** the mechanic-heavy letters will keep refusal counts
high until the structural classes are built; prior items stand.

## D239 — M6.4cb: sixteen landed — the six-clause Aura partition, and the graveyard noun that widened silently (2026-08-21)

**3,155 of 31,692 Commander-legal cards execute completely, up from 3,139.**
SHIPPED_SCRIPTS 1,242 → 1,258; the REFUSED ledger 451 → 460 (+9, TWO new
classes). All 35 new tests green on the FIRST run — the fifteenth such batch.

**The headliner: Remove Enchantments** — the most intricate deterministic
partition a SpellDef has shipped: six printed clauses sorting every enchantment
on the board into RETURNED (your own, not attached to an opponent's attacker)
vs DESTROYED (everyone else's, plus your own Auras on attacking creatures you
don't control), decided per object from `card.attachedTo` + the live combat
attacker set. Zero new machinery — the composition ceiling again.

**Also:** `Repay in Kind` (lowest life total found by folding LifeChanged
deltas, everyone SET to it); `Repentance` (Inner Struggle's text — the
self-bite family's FOURTH id); `Requiem Angel` (the first NEGATED-subtype
dies watcher: every non-Spirit death pays a Spirit — its own token's death
pays, a Spirit's does not); `Research Thief` (the artifact-CREATURE connect
draw — the dealer's derived types must include both); `Reputable Merchant`
(enters-or-dies targeted counter, resolve inline twice per D178);
`Renowned Weaver` (a G Spider with reach from a creature-ENCHANTMENT body);
`Rending Flame` (the compound player-or-planeswalker burn with a
Spirit-conditional recoil read pre-move); `Reprisal` (the D139 power floor —
damnation tripwire client FIFTEEN); `Resolute Watchdog` (self-sac
indestructible grant on D194's carrier); `Relic Barrier` / `Retract` /
`Repel` / `Renewing Dawn` (Mountain census) / `Reliquary Monk` /
`Resolute Reinforcements`.

⚠️ **The probe catches, two of them NEW classes:** `Restore` — "return
target land card from a graveyard to the battlefield" parses with GY_NOUN
blind to "land card", so the spec silently aims at BATTLEFIELD lands ('spell
target parse (graveyard noun)'); `Repel Calamity` — "with mana value 4 or
greater" beside a disjunction drops the numeric bound ('spell target parse
(numeric disjunction)'). Plus script-raised prompts ×3, up-to-N, ctx.random,
clash, and the until-end-of-turn base P/T set.

Fixtures 1,473 → 1,490 (84 tokens — Spider tjou 5 new; the Spirit tmm2 5
REUSED). botPool creature 1,709 / instant 584 / sorcery 438 / artifact 94 ·
ladder [1898, 1997, 3790, 5704, 6916] · batch.json 1,100 · botDeck: Adun
reaches 1,778 from 70 legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,338 files,
7,315 passed / 10 skipped · 500-seed gate 754.9 s · build clean ·
probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D239): the graveyard-noun and numeric-disjunction parse
holes join the aim-layer queue beside the keyword qualifier; prior items stand.

## D240 — M6.4cc: sixteen landed — the mass theft reanimation, and the fourth perItem consumer (2026-08-21)

**3,171 of 31,692 Commander-legal cards execute completely, up from 3,155.**
SHIPPED_SCRIPTS 1,258 → 1,274; the REFUSED ledger 460 → 469 (+9, ONE new
class). A ZERO-new-token, zero-new-support-body batch — every fixture the
tests lean on was already in WANTED.

**The headliners:** `Rise of the Dark Realms` — the MASS theft reanimation:
every creature card from every graveyard in one simultaneous CardsMoved with
`to.player` = the caster (Planar Birth's sweep composed with Reanimate's
theft; owners stay printed, the entry funnel runs on each). `Righteous
Cause` — the FOURTH perItem consumer: one firing per ATTACKING creature,
any controller's, through D190's fan-out over AttackersDeclared. `Rite of
Flame` — the ritual with the self-name census (the resolving copy is ON THE
STACK and correctly absent from its own count). `Righteous Fury` — Guan
Yu's tapped sweep paying Multani's per-kill bounty, where the tapped
INDESTRUCTIBLE survivor pays NOTHING. `Rishadan Port` / `Rishadan
Dockhand` — the tap-target-LAND actives, and a ref-numbering pair worth
pinning: the Port's tap is #a1 behind its mana line (mana lines COUNT), the
Dockhand's is #a0 behind Islandwalk (keyword lines never do). `Rimefur
Reindeer` — the enchantment-entry watcher pair whose target clause's "an
opponent controls" is ENFORCED (probed before drafting). `Risky Research` —
Notion Rain's recoil-first surveil twin, LifeChanged for DamageDealt.

**Also:** `Retribution of the Meek` (the power-4-or-greater sweep — the
damnation tripwire's SIXTEENTH client); `Rewards of Diversity` (the
opponent-multicolored cast watcher — Hero of Precinct One's colour count
behind Insight's filter); `Ribbons of the Reikai` (Spirit census draw);
`Ripchain Razorkin` (the land-predicate chooser draw); `Riptide` (tap all
blue); `Riptide Crab` / `Rhox Oracle` / `Risky Shortcut` twins.

⚠️ **One test-side failure, and it was a PINNED trap met again:** Rhox
Oracle's first run measured the hand around a put() that had fetched the
Oracle from the opening seven — hand→battlefield then draw nets zero. The
fix is Gallant Citizen's staging idiom verbatim (through the graveyard, the
baseline after). The engine was never wrong; the first-run-clean streak
stays at fifteen.

⚠️ **The probe catches:** Return to the Earth's triple compound parses
CONFIDENT to `['artifact']` alone with the flying qualifier dropped (the
noun-list family); Rewind's "Untap up to four lands" and Return to Dust's
"up to one other target" file under up-to-N. ONE new class: 'indefinite
continuous effect' (Riding the Dilu Horse's horsemanship "lasts
indefinitely", Rise from the Grave's "black Zombie in addition") — a
permanent-attached continuous effect with no duration has no carrier.

Fixtures 1,490 → 1,506 (84 tokens — ZERO new). botPool creature 1,714 /
instant 585 / sorcery 445 / enchantment 47 / land 286 · ladder [1882, 1981,
3774, 5688, 6900] · batch.json 1,075 · botDeck: Adun reaches 1,785 from 70
legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,354 files,
7,381 passed / 10 skipped · 500-seed gate 773.6 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D240): the indefinite continuous effect is the
structural tail's newest named class (two cards, one carrier design); the
up-to-N chooser keeps absorbing; prior items stand.

## D241 — M6.4cd: NINETEEN landed — the perItem death fan, and the two-target sentence that parses (2026-08-21)

**3,190 of 31,692 Commander-legal cards execute completely, up from 3,171** —
the second-largest batch of the arc (the record is D237's 23).
SHIPPED_SCRIPTS 1,274 → 1,293; the REFUSED ledger 469 → 475 (+6, ONE new
class).

**The headliners:** `Rotlung Reanimator` — the FIFTH perItem consumer and
the FIRST on DEATHS: one firing per dying Cleric, itself included, any
controller's — and its test COMPOSES batch-mate `Ritual of Soot`: one sweep
kills both Clerics and pays exactly TWO Zombies, arriving after the wipe.
`Rocky Rebuke` — the first plain two-target sentence through the parser:
"Target creature you control … target creature an opponent controls" probes
to TWO CONFIDENT specs with BOTH controllers enforced, where a mid-sentence
"another target" still fails (the second-clause family's boundary, measured
from the passing side). `Roar of Reclamation` — the per-OWNER mass artifact
reanimation (each player's Sol Ring rises under its own owner).
`River's Rebuke` — the one-player nonland board bounce. `Roiling
Terrain` — Melt Terrain's recoil where the census counts its own kill (+1
exactly when the destroyed land's owner IS its controller). `Roku's
Mastery` — the X-conditioned scry ask (X≥4 asks, X=2 does not, the ask
LAST). `Rooftop Bypass` — the nontoken-connect batch paying one Assassin.
`Rolling Earthquake` — the horsemanship-exempt X fan plus every player.

**Also:** Rite of the Dragoncaller (Murmuring Mystic's filter paying Dragon
Roost's 5/5); Ritual of Soot (Culling Sun's bar, the other wording); Roc Egg
(the dies-hatch behind Defender); Rockslide Ambush (Mountain census burn);
Rod of Ruin / Rootwater Hunter (the tap-ping on an artifact, and the
Prodigal text's FOURTH id); Ronom Unicorn (Felidar Cub's exact text);
Rollick of Abandon (the +2/-2 board slide); Rottenheart Ghoul (the dies
targeted discard ask); Roving Harper (Rhox Oracle's text twin).

⚠️ **One test-side failure — a CLASSIFICATION assumption, not a trap:**
News Helicopter was assumed a Vehicle for Road Rage's census and is an
Artifact Creature Construct; the pool held NO Vehicle at all.
`Consulate Dreadnought` joins WANTED as the support body, and the census
positive is proven 2 → 3 through it. ⚠️ And a SECOND D194 violation caught
in the same repair: a PS5.1 string pipeline mojibaked the test's em-dash —
the file was REWRITTEN via the Write tool, both copies verified clean.
Repo files are edited by the Edit tool or node patch scripts ONLY.

TWO new token pins, both verified against TOKEN_TABLE's own printingIds
(Assassin-menace tacr 4, Bird 3/3 tc19 2); the Dragon 5/5 (tkhm 11) and
Zombie 2/2 (tc14 16) are REUSES of committed pins. ONE new ledger class:
'expend mechanic' (Roughshod Duo — mana-spent-per-turn memory).

Fixtures 1,506 → 1,528 (86 tokens). botPool creature 1,720 / instant 588 /
sorcery 452 / artifact 95 / enchantment 49 · ladder [1863, 1962, 3755,
5669, 6881] · batch.json 1,050 · botDeck: Adun reaches 1,797 from 70
legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,373 files,
7,460 passed / 10 skipped · 500-seed gate 832.8 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D241): the two-target-sentence boundary is now measured
from both sides — the widening should target the "another"/"Another"
segmentation specifically; the expend mechanic joins the structural tail;
prior items stand.

## D242 — M6.4ce: TWENTY-TWO landed — Sage Owl closes D142's loop, three ids at once (2026-08-21)

**3,212 of 31,692 Commander-legal cards execute completely, up from 3,190** —
one short of the arc record, and the SIXTEENTH first-run-clean batch (all 44
tests green untouched). SHIPPED_SCRIPTS 1,293 → 1,315; the REFUSED ledger
475 → 478 (+3, ZERO new classes) — zero new tokens, zero new support bodies:
the drained-refusal signal at full strength.

**The headliner is an arc closing at triple width:** `Sage Owl` — THE card
D142 named the day the ordering prompt shipped ("one card script away, the
effect being built already") — lands as the FIRST trigger-raised
`orderCards` ask (D196's scry-trigger argument one prompt over: the
resolve emits CardsRevealed-to-self plus the ask, destination 'top'), and
its exact text lands on THREE ids in ONE batch: `Sage Aven` and `Sage of
Epityr` beside it — the Fisk same-batch-twin precedent tripled. The test
pins the answer's semantics: the first card of the answer ends ON TOP.

**Also:** `Ruinous Ultimatum` (the opponents-only nonland wipe — the
marquee wrath, their land and my board standing); `Ruination` (the
nonbasic land sweep, where Darksteel Citadel survives as an indestructible
NONBASIC — both filters proven independent); `Ruthless Predation` (Epic
Confrontation's EXACT text — the pump-then-fight, second id);
`Rummaging Wizard` / `Rune-Sealed Wall` (the paid and the tapped
activated surveils — the Wall behind Defender at #a0); `Run Aground` (the
PROBED artifact-or-creature compound — both kinds parse — with the
placement-top move); `Rush of Knowledge` (the greatest-MV census across
ALL my permanents); `Rush of Blood` (the single-target power doubling);
`Sacred Prey` (becomes-blocked, through a real DeclareBlockers from the
defender's seat); `Rugged Highlands` (the refuge — Jungle Hollow's exact
lines, both halves proven); `Ruinous Gremlin` (self-sac artifact removal);
`Rumbling Rockslide` / `Rockslide-family` census burns at 2-vs-3 lands;
`S.H.I.E.L.D. Deployment Drone` (the ETB Soldier — and the constName trap
pinned: runs of punctuation collapse to SINGLE underscores);
`Sage of Lat-Nam` (the artifact-sacrifice draw); ETB scry twins
(`Rumbling Sentry` 1, `Sage's Row Savant` 2); `Runewing` (dies-draw);
`Rubblebelt Boar` / `Sacred Armory` (targeted pumps, triggered and
activated).

⚠️ **Three refusals, all existing classes:** Royal Herbalist
(exile-from-library cost), Rummaging Goblin (discard-cost chooser),
Sagittars' Volley (the keyword target qualifier — 'with flying' silently
widens).

Fixtures 1,528 → 1,550 (86 tokens — ZERO new). botPool creature 1,733 /
instant 590 / sorcery 457 / artifact 96 / land 287 · ladder [1841, 1940,
3733, 5647, 6859] · batch.json 1,025 · botDeck: Adun reaches 1,806 from 70
legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,395 files,
7,548 passed / 10 skipped · 500-seed gate 836.2 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D242): the trigger-raised orderCards ask opens the
whole look-and-reorder trigger family; the keyword-qualifier widening keeps
absorbing (Sagittars'); prior items stand.

## D243 — M6.4cf: twenty-one landed — the vigilance-granting land, and devotion pays a bill (2026-08-21)

**3,233 of 31,692 Commander-legal cards execute completely, up from 3,212.**
SHIPPED_SCRIPTS 1,315 → 1,336; the REFUSED ledger 478 → 482 (+4, ZERO new
classes) — the second consecutive zero-new-anything batch (no new tokens, no
new support bodies, no new classes). The offerable pool reads an even
**1,000**.

**The headliners:** `Sandstone Bridge` — the targeted-trigger LAND whose
grant RIDES: +1/+1 and vigilance on D194's carrier, the keyword derived
until cleanup and gone after. `Sanguimancy` — the devotion census (Aspect
of Hydra's parsed-ManaCost idiom: colored pips + hybrid halves) paying both
a draw and a bill in one resolve. `Savage Swipe` — the EXACT power===2
condition, told apart by two games: the Bears pump to 4, the Dreadmaw gets
nothing and kills the victim anyway. `Salvager of Secrets` — the ETB
graveyard return whose cardTypes REFUSE a creature card at the aim (the
res.ok===false negative in the test). `Sandstorm` — the attacker sweep
cast MID-COMBAT at instant speed through Aetherize's priority-window
predicate. `Savage Mansion` — the three-line surveil land (TEXT =
split[2] behind tapped + mana). `Scepter of Dominance` — tap-target-
PERMANENT: the probed permanent kind turns a LAND. `Savage Gorilla` — the
off-color {U}{B} self-sac with the two-sentence resolve (the debuff can
miss; the draw still arrives). `Salvage` — the bare-card graveyard noun
with zone AND controller enforced, placement top.

**Also:** Sailor of Means (ETB Treasure); Saltfield Recluse (the
tap-debuff); Sanitation Automaton (ETB surveil); Sarkhan's Rage (the
no-Dragons recoil on the hit() helper — Boulderborn Dragon silences it);
Satyr Enchanter (enchantment-cast draw); Satyr Grovedancer (ETB targeted
counter); Savage Smash + Ruthless-family (Epic Confrontation's fight at
+2/+2); Savage Surge (pump-and-untap); Savage Twister (the plain X sweep);
Savannah Sage (ETB gain); Scalding Devil (the no-tap ping); Scavenger Folk
(self-sac artifact removal with the tap).

⚠️ **One test-side failure — the D215 mana-cost trap on a SUPPORT body:**
Captive Flame is {2}{R}, not the {1}{R} the test funded. Read support
bodies' costs off the fixtures too, not only the batch's own.

⚠️ **Four refusals, all existing classes:** Sandsower (tap-creatures cost),
Sanguine Sacrament (spell relocates itself on resolution — Cerebral
Eruption's class), Sanity Gnawers (ctx.random), Scarblade Elite
(exile-from-graveyard cost).

Fixtures 1,550 → 1,571 (86 tokens). botPool creature 1,743 / instant 593 /
sorcery 462 / artifact 97 / land 289 · ladder [1820, 1919, 3712, 5626,
6838] · batch.json 1,000 · botDeck: Adun reaches 1,819 from 70 legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,416 files,
7,634 passed / 10 skipped · 500-seed gate 786.7 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D243): support-body costs join the read-at-
classification rule; the ledger's cost-chooser classes keep absorbing;
prior items stand.

## D244 — M6.4cg: nineteen landed — the trigger-raised library take, the four Seals, and two more perItem consumers (2026-08-21)

**3,252 of 31,692 Commander-legal cards execute completely, up from 3,233** —
and the SEVENTEENTH first-run-clean batch (all 40 tests green untouched).
SHIPPED_SCRIPTS 1,336 → 1,355; the REFUSED ledger 482 → 488 (+6, ONE new
class). Zero new tokens, zero new support bodies.

**The headliners:** `Sea Gate Oracle` — the FIRST trigger-raised library
TAKE: D141's `chooseFromZone` ask ({zone:'library', rest:'bottom',
count:1}) emitted from a resolve, the Sage Owl argument one prompt over; the
pick goes to hand and the other to the BOTTOM, both pinned, and a
single-card library takes choicelessly (CR 701.8a's shape). **The FOUR-Seal
cycle in one batch** — Seal of Cleansing + Seal of Primordium as EXACT-text
twins, Seal of Removal's bounce, Seal of Strength's pump: the whole
crack-for-effect enchantment family at once. **TWO more perItem
consumers:** `Scrapheap` (#6) — one gain per artifact-or-enchantment
reaching MY graveyard from the battlefield, and its test composes shipped
`Ruinous Ultimatum` for the one-batch wipe where the Scrapheap COUNTS ITS
OWN CORPSE (three firings, +3); `Seafloor Oracle` (#7) — one draw per
connecting Merfolk, proven with two of D243's own Rootwater Hunters.

**Also:** Scream Puff (the connect Food behind Deathtouch) and Scroll Thief
(the classic connect draw); Scribe of the Mindful (the self-sac graveyard
return); Scorched Rusalka (Plagued Rusalka's chooser with the ping);
Scorch the Fields (land destroy + the Human sweep that kills MY OWN Monk);
Scouring Sands (the opponent-board sweep, ask LAST); Scrapyard Salvo (the
artifact-graveyard census burn); Search Warrant (the public reveal + count
gain); Searchlight Companion (the colorless Spirit on the committed tema-1
pin); Searing Flesh (target OPPONENT enforced — the self-aim refused
in-test); Scepter of Insight (the paid tap-draw); Scoured Barrens (the
refuge).

⚠️ **Six refusals, ONE new class:** `Searing Blood` names the DELAYED
TRIGGER — "when that creature dies this turn" sets up a watcher for a
future event scoped to a turn, and no machinery carries it (CR 603.7).
Plus the second-clause family (Schismotivate), a script-raised prompt
(Scout the Borders), up-to-N ×2 (both Sea Gods), and the UEOT color change
(Sea Kings' Blessing).

Fixtures 1,571 → 1,590 (86 tokens). botPool creature 1,750 / instant 593 /
sorcery 467 / artifact 99 / enchantment 53 / land 290 · ladder [1801,
1900, 3693, 5607, 6819] · batch.json 975 · botDeck: Adun reaches 1,829
from 70 legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,435 files,
7,712 passed / 10 skipped · 500-seed gate 762.3 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D244): the delayed trigger joins the engine-work list
(CR 603.7 machinery); the perItem family now spans draws, blocks, deaths,
attacks, graveyard intake and combat connects; prior items stand.

## D245 — M6.4ch: nineteen landed — Sek'Kuar takes a seat, and the wipe that pays its victims (2026-08-21)

**3,271 of 31,692 Commander-legal cards execute completely, up from 3,252** —
the EIGHTEENTH first-run-clean batch (all 38 tests green untouched), the
second in a row. SHIPPED_SCRIPTS 1,355 → 1,374; the REFUSED ledger 482 →
494 counting D244's +6 and this batch's +6 (ONE new class here). **The
fully-executable legendary pool reads 71: Sek'Kuar, Deathkeeper joins.**

**The headliners:** `Sek'Kuar, Deathkeeper` — the nontoken-controlled
dies watcher paying the NEW Graveborn pin (tcmm 38), a LEGENDARY commander;
its own token's death pays nothing, both sides pinned. `Seeds of
Innocence` — the damnation tripwire's SEVENTEENTH client: the artifact
wipe that PAYS each victim's controller its own mana values (Sol Ring's 1
to me, Hedron Archive's 4 to them), with the indestructible artifact LAND
surviving and paying nothing. `Seismic Wave` — TWO probed confident specs
in one sentence (the any-target burn + the target-opponent nonartifact
fan, on the hit() helper). `Seer of Stolen Sight` — my
artifacts-or-creatures dying ask the surveil, the per-event batch as the
printed "one or more". `Sentinel of the Nameless City` — the
enters-or-attacks pair paying Maps. `Seaside Haven` — the Bird-predicate
chooser paying a draw (Sage Owl pays the price).

**Also:** the Selesnya Cluestone/Locket pair (the SIXTH colour pair);
Secret Rendezvous (both sides draw three); Seeker of Skybreak (the {T}
untap); Seer's Lantern (the paid scry at #a1); the Seismic family —
Rupture and Shudder (nonflying sweeps at 2 and 1), Spike (land destroy +
{R}{R} ritual), Strike (the Mountain census at 2-vs-3); Sejiri Refuge;
Seller of Songbirds (the trtr-1 Bird); Senate Griffin (ETB scry); Serene
Heart (the Aura sweep — the CAST Pacifism dies, the global enchantment and
the host stand).

⚠️ **Six refusals, ONE new class:** `Secrets of the Dead` names the
CAST-ZONE DISCRIMINATOR — the SpellCast event does not record which zone
the spell was cast from, so "cast a spell from your graveyard" cannot be
watched (the discriminator family's fifth member). Plus discard-cost ×3
(Seismic Assault, Seismic Mage, Selhoff Entomber), the cast-time computed
target count (Selective Snare), and tap-creatures (Selesnya Evangel).

Fixtures 1,590 → 1,610 (87 tokens — Graveborn tcmm 38 NEW). botPool
creature 1,756 / instant 597 / sorcery 471 / artifact 102 / land 292 ·
ladder [1782, 1881, 3674, 5588, 6800] · batch.json 950 · botDeck: Adun
reaches 1,841 from 71 legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,454 files,
7,788 passed / 10 skipped · 500-seed gate 764.2 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D245): the discriminator family (draw, scry, discard,
activation, cast-zone) is five members wide — the typed-cause design is
overdue by weight; prior items stand.

## D246 — M6.4ci: eighteen landed — the ledger crosses five hundred (2026-08-21)

**3,289 of 31,692 Commander-legal cards execute completely, up from 3,271.**
SHIPPED_SCRIPTS 1,374 → 1,392; **the REFUSED ledger crosses FIVE HUNDRED:
494 → 501** (+7, ZERO new classes). Zero new tokens, zero new support
bodies.

**The headliners:** `Servo Schematic` — the artifact enters-or-dies token
pair (one Servo on entry, a second on death, one game). `Shadewing
Laureate` — the dies watcher with a DERIVED keyword filter: a matcher
reads `d.keywords.has('flying')` directly, where the AIM layer's parse
cannot (D197's distinction made explicit — the grounded death asks
nothing, the flyer's pays). `Shadow Alley Denizen` — the color-filtered
entry pair granting intimidate on the D194 carrier, derived until cleanup.
`Shadows' Verdict` — the two-zone MV-3 exile sweep (battlefield AND every
graveyard behind one bar). `Shatter the Sky` — the conditional per-player
draws read BEFORE the wipe (only the power-4 controller draws).
`Shadowstorm` — the shadow-keyword sweep, and ⚠️ its first test taught a
CLASSIFICATION fact: **Dauthi Trapper GRANTS shadow but does not have
it** — no fixture prints the keyword at all, so the positive is proven by
COMPOSING the shipped Dauthi Embrace grant (the granted Bears die, the
plain Bears stand: the derived filter meeting the derived grant).
`Shatterstorm` — the damnation tripwire's EIGHTEENTH client.
`Shadowy Backstreet` — the reminder-FIRST surveil land (TEXT = split[2]).

**Also:** Serene Offering (the MV-paid enchantment kill); Serpent's Pass
(the three-line self-sac draw land); Shadowfeed (graveyard exile + 3);
Shaman of Spring (the ETB-draw text's next id); Shambling Goblin (the
dies-debuff with the opponent restriction enforced); Shattered Acolyte /
Shield Mate / Shore Keeper (the self-sac utility row); Shivan Hellkite
(the no-tap ping behind the reminder line); Shopkeeper's Bane (the
self-attack gain).

⚠️ **Seven refusals, ZERO new classes:** the UEOT base P/T set (Serpentine
Ambush), the temporary non-keyword ability grant (Shade's Breath), the
noun-list triple + flying hole ×2 (Shattered Wings, Shoot Down — Return to
the Earth's exact probed shape), and the Shinen channel trio
(hand-activated ability ×3).

Fixtures 1,610 → 1,628 (87 tokens). botPool creature 1,765 / instant 599 /
sorcery 475 / artifact 103 / land 294 · ladder [1764, 1863, 3656, 5570,
6782] · batch.json 925 · botDeck: Adun reaches 1,851 from 71 legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,472 files,
7,860 passed / 10 skipped · 500-seed gate 756.6 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D246): no fixture prints the shadow keyword — a
printed-shadow body joins the support wishlist for future shadow
consumers; the noun-list widening keeps absorbing; prior items stand.

## D247 — M6.4cj: eighteen landed — the Angel pin and the two-spec sentence (2026-08-21)

**3,307 of 31,692 Commander-legal cards execute completely, up from 3,289.**
SHIPPED_SCRIPTS 1,392 → 1,410; ledger 501 → 508 (+7, ONE new class). ONE new
token pin — **Angel 4/4 W flying, sld 1340** (tokens 87 → 88). The NINETEENTH
first-run-clean batch: all 36 tests green untouched.

**The headliners:** `Sigil of the Empty Throne` — the enchantment-cast
watcher paying the NEW Angel pin (its test casts a real enchantment through
the D198 Aura path's neighbourhood). `Shower of Sparks` — the plain
two-target sentence PROBED to TWO confident specs (creature + player-or-
planeswalker in one sentence — D241's boundary holding one page over).
`Sick and Tired` — the counted pair each-debuffed, min2/max2 PROBED
(Dust to Dust's machinery at a pair). `Sign in Blood` — the targeted
draw-two-and-bill. `Silverchase Fox` — the self-sac EXILE: **exile is not
destruction**, so there is deliberately NO indestructible check. The
Simic `Cluestone`/`Locket` pair — the SEVENTH colour pair. `Simoon` —
the target-OPPONENT board fan, the opponent restriction ENFORCED (probed).
And a five-wide scry/surveil sweep: Shore Lurker (ETB surveil), Sigiled
Skink (attacks-scry), Sigiled Starfish ({T} scry), Silver Raven (ETB
scry), Silverquill Campus (the paid #a1 land).

**Also:** Shrivel (the board -1/-1); the Shu Grain Caravan / Shu
Soldier-Farmers ETB-gain pair; Silverback Shaman (dies-draw); Silent
Attendant ({T}: gain 1).

⚠️ **Seven refusals, ONE new class: the becomes-targeted trigger**
(`Silverfur Partisan` — no def has ever consumed a TargetsChosen event;
its bus semantics are unproven, so the refusal is conservative). Plus the
temporary non-keyword grant (Shoving Match), the script-raised prompt
(Show and Tell), the noun list (Shower of Arrows), the keyword qualifier
(Shredding Winds), the untap-symbol cost (Silkbind Faerie), and the UEOT
color change (Singe).

Fixtures 1,628 → 1,647 (88 tokens). botPool creature 1,774 / instant 602 /
sorcery 477 / artifact 105 / enchantment 54 / land 295 · ladder [1746,
1845, 3638, 5552, 6764] · batch.json 900 · botDeck: Adun reaches 1,858
from 71 legendaries.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,490 files,
7,932 passed / 10 skipped · 500-seed gate 769.9 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D247): the becomes-targeted trigger joins the
event-consumer wishlist; the keyword-qualifier widening keeps absorbing;
prior items stand.

## D248 — M6.4ck: twenty landed — the FIRST MDFC script (2026-08-21)

**3,327 of 31,692 Commander-legal cards execute completely, up from 3,307.**
SHIPPED_SCRIPTS 1,410 → 1,430; ledger 508 → 513 (+5, ONE new class). ZERO
new tokens (the Food pin reused); ONE support body (Daring Buccaneer). The
TWENTIETH first-run-clean batch: all 50 tests green untouched.

**The headliner: `Skyclave Cleric // Skyclave Basilica` — THE FIRST MDFC
SCRIPT.** The probe showed face 1 (the Basilica) carries ZERO unaccounted
lines — the tapped entry is the D134 built-in and the mana line parses — so
the whole card was ONE TriggerDef away. The ETB matcher reads the entering
face OFF THE MOVE (`CardMove.faceIndex`, the field D155 put there because
the funnel forced it), and the negative PLAYS the land back face through a
real `PlayLand { faceIndex: 1 }`: it enters a TAPPED land (the built-in
reading the entering face, exactly as D155 promised) and gains nobody
anything. The selection's own multi-face filter had offered the card
deliberately — it refuses only spell faces.

⚠️ **The probe PULLED a card before a line was written — and named a NEW
class:** `Slimy Dualleech`'s "target creature you control with power 2 or
less" parses CONFIDENT with the numeric bound SILENTLY DROPPED — the spec
text truncates to "target creature you control". D139 built
numeric-then-controller; D140 fixed the graveyard branch; this is the THIRD
order — controller-then-numeric — and it loses the qualifier. 'spell target
parse (numeric after controller)' joins the aim-layer's qualifier family.

**Also:** `Skulduggery` — the probed TWO-spec sentence with BOTH
controllers enforced ("Until end of turn," in front does not break D241's
boundary), one carrier entry each way. `Skirsdag Flayer` — the
Human-predicate chooser paying with ITSELF (CR 113.7a). `Siren's Ruse` —
the flicker with a conditional subtype rider read PRE-exile (Daring
Buccaneer the Pirate; a Bears pays nothing). `Skred` — Dead of Winter's
snow census pointed at one creature. `Skyreaping` — devotion fanned over
the flying set. `Sip of Hemlock` — the destroy billing its controller
through an indestructible miss (the Myr survives, the 2 still lands).
`Skybeast Tracker` — the MV≥5 cast filter proven with two batch-mates
(Sizzle pays nothing, Sip pays a Food). `Skarrg` / `Slayers' Stronghold` —
activated grant lands at one and two keywords. Plus the surveil pair
(Sinister Hideout #a1, Sinister Starfish #a0), Skinrender's three -1/-1
counters, the Skirsdag Cultist / Skull Catapult chooser pings, Skybridge
Towers' self-sac draw, Skyscanner's ETB draw, Slagdrill Scrapper's
OR-predicate "another", and Slash of Light's creatures+Equipment census.

⚠️ **Five refusals, ONE new class** (above). The rest: Sinister Concoction
(discard-cost chooser — its cost also carries a MILL component nothing has
ever charged), Skaab Wrangler (tap-creatures), Sleep (untap restriction),
Sleight of Mind (text-changing, CR 612).

Fixtures 1,647 → 1,668 (88 tokens). botPool creature 1,782 / instant 606 /
sorcery 480 / artifact 106 / enchantment 54 / land 299 · ladder [1726,
1825, 3618, 5532, 6744] · batch.json 875 · botDeck: Adun reaches 1,872.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,510 files,
8,018 passed / 10 skipped · 500-seed gate 701.4 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D248): the MDFC door is OPEN — permanent-permanent
modal DFCs are now ordinary batch work (the spell-faced ones still wait on
the face-keyed SpellDef ref, D187); the numeric-after-controller widening
joins the qualifier family; prior items stand.

## D249 — M6.4cl: seventeen landed — the bot crowns the Sliver Queen (2026-08-21)

**3,344 of 31,692 Commander-legal cards execute completely, up from 3,327.**
SHIPPED_SCRIPTS 1,430 → 1,447; ledger 513 → 521 (+8, ONE new class). ONE new
token pin — **Sliver 1/1 colorless, tcmm 57** (tokens 88 → 89). The
TWENTY-FIRST first-run-clean batch (40 tests untouched), third in a row.

⚠️⚠️ **THE BOT CHANGED ITS OWN COMMANDER — the second time in the arc.**
D160's regeneration swapped Jasmine Boreal for Adun Oakenshield; this one
swaps Adun for **Sliver Queen (WUBRG), reaching 3,295 cards from 75
fully-executable legendaries** — a five-colour identity excludes almost
nothing, so the moment a five-colour commander became executable the deck
builder took it. Nothing in the builder changed; the pool did.

**The headliners:** `Sliver Queen` — the repeatable {2} Sliver on the NEW
pin, two activations two DISTINCT tokens — and the crown (above).
`Snarling Gorehound` — Neighborhood Guardian's derived power≤2 filter
MEETS the surveil ask: two defs, and the TOKEN arm is proven by
batch-mate Sliver Queen's OWN product (the 7/7 Queen's entry asks
nothing; her 1/1 Sliver asks). `Sol'kanar the Swamp King` — the
any-player BLACK-cast gain, the colour filter proven with two
batch-mates (Smother pays the 1, Soothing Balm pays nothing). `Smother`
— the D139 mv≤3 floor REFUSING a Grave Titan at the aim, and the
damnation tripwire's NINETEENTH client ("It can't be regenerated." is
vacuous and guarded). `Slobad, Goblin Tinkerer` — the mana-free chooser
feeding a keyword-only indestructible grant on the carrier. `Sokka,
Lateral Strategist` — Haazda Marshal's self-among-attackers at two.
`Songs of the Damned` — the census RITUAL (graveyard creature cards
typed off the ORACLE face, the dead Swamp counting nothing). `Soaring
Seacliff` — the targeted-trigger land granting flying, its tapped entry
asserted in the same game.

**Also:** Slinking Skirge (the no-tap self-sac draw); Slithering Cryptid
(the ETB Mutagen); Smash to Smithereens (Melt Terrain's rider order on an
artifact); Smokespew Invoker ({7}{B} debuff); Soldier of the Grey Host
(the ETB pump behind TWO keyword lines); Soothing Balm; Sorin's Thirst;
Sorin's Vengeance (the ten-point compound); Soul Feast.

⚠️ **Eight refusals, ONE new class: the cycling mechanic** (`Snare
Tactician` — cycling is a hand-activated keyword action no engine concept
models, so a cycling WATCHER has nothing to watch; D230's Ominous Sphinx
comment named this half). Plus the Ring (Slip On the Ring), up-to-N
(Snap), return-permanent ×2 (both Soratami), remove-counter (Soul
Diviner), the temporary keyword/ability grant's LOSE direction (Soul
Sear), exile-from-graveyard (Soul Shepherd).

Fixtures 1,668 → 1,686 (89 tokens). botPool creature 1,791 / instant 611 /
sorcery 482 / artifact 106 / enchantment 54 / land 300 · ladder [1709,
1808, 3601, 5515, 6727] · batch.json 850 · botDeck: **Sliver Queen
reaches 3,295 from 75 legendaries.**

**Verified: verify.cjs --full — ALL FIVE GATES: 1,527 files,
8,087 passed / 10 skipped · 500-seed gate 759.5 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D249): the bot's five-colour deck is the widest it can
ever get by identity — future growth is pool-only; the cycling mechanic
joins the structural tail; prior items stand.

## D250 — M6.4cm: seventeen landed — the self-sac counter, and the possessive that parses (2026-08-21)

**3,361 of 31,692 Commander-legal cards execute completely, up from 3,344.**
SHIPPED_SCRIPTS 1,447 → 1,464; ledger 521 → 529 (+8, TWO new classes). ZERO
new tokens or support bodies.

**The headliners:** `Soulsworn Jury` — the SELF-SAC COUNTER: Daring
Apprentice's two-event pair (SpellCountered + moveFromStack) behind a
sacrifice cost, the PROBED typed-spell aim ('creature spell' cardTypes
enforced), driven against a REAL held creature cast — the Jury pays itself
on the answer and the Bears dies uncast. `Soul's Fire` — the bite pointed
ANYWHERE: TWO probed specs (my creature + any target), the Titan's 6 to
the face with the biter's own derived riders. `Soul's Grace` /
`Soul's Majesty` — the POSSESSIVE and mid-sentence power reads both
probed confident ("target creature's power"; "the power of target
creature you control" with the controller enforced). `Soulquake` — the
TWO-ZONE mass bounce in ONE CardsMoved batch: battlefield creatures
DERIVED, graveyard creature cards typed off the ORACLE face, everything
to its owner's hand. `Soulscour` — destroy all NONARTIFACT permanents:
lands die, the Sol Ring stands. `Sphinx's Revelation` — X gain + X draw
off obj.xValue. `Sparring Construct` — the targeted DIES-trigger with
the controller spec refused from the wrong side.

**Also:** Soulknife Spy (Scroll Thief's connect draw — ⚠️ its test assumed
a 1-power body and the ENGINE corrected it: the Spy connects for 3);
Soulmender ({T}: gain 1); Soulreaper of Mogis (the chooser draw on an
ENCHANTMENT CREATURE); Sovereign's Bite (the drain at three); Sparring
Mummy (the ETB untap); Spectacle Summit (the paid surveil land WITHOUT a
sacrifice — it survives tapped); Spectral Sailor (the no-tap draw twice
in one turn behind two keyword lines); Spellkeeper Weird (the self-sac
graveyard return, both cardTypes enforced); Spiderwig Boggart (the fear
grant).

⚠️ **Eight refusals, TWO new classes:** the CAST RESTRICTION EFFECT
(`Sphinx's Decree` — a temporary prohibition on what opponents may cast;
no continuous cast-gate exists and legal.ts consults no such state) and
the FATESEAL MECHANIC (`Spin into Myth` — scry at an OPPONENT'S library;
scryChoice is own-library by construction). Plus face-down (Soul
Summons), ability-word cost (Spawnbinder Mage), numeric exact ×2 (Spell
Blast, Spell Snare), script-raised prompt (Spellshift), discard-cost
(Sphinx of the Chimes).

Fixtures 1,686 → 1,703 (89 tokens). botPool creature 1,800 / instant 614 /
sorcery 486 / artifact 106 / enchantment 54 / land 301 · ladder [1692,
1791, 3584, 5498, 6710] · batch.json 825 · botDeck: Sliver Queen reaches
3,312.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,544 files,
8,155 passed / 10 skipped · 500-seed gate 734.2 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D250): the numeric-exact class holds FOUR cards (two
joined this batch) — the equality comparison is D139's playbook one
operator over; prior items stand.

## D251 — M6.4cn: nineteen landed — the leanest classification of the arc (2026-08-21)

**3,380 of 31,692 Commander-legal cards execute completely, up from 3,361.**
SHIPPED_SCRIPTS 1,464 → 1,483; ledger 529 → 535 (+6, **ZERO new classes,
zero new tokens, zero new support bodies** — the leanest classification the
arc has produced).

**The headliners:** `Spire Owl` — the Sage Owl text's FOURTH id (the
trigger-raised orderCards ask; the answer's first card ends on top).
`Spiteful Blow` — the PROBED two-spec destroy: "target creature and
target land" parses TWO confident specs with DIFFERENT nouns, both dying
in one batch. `Spoils of Evil` — the census RITUAL over a target
OPPONENT'S graveyard (the restriction probed and enforced): {C} and a
life per artifact-or-creature card, typed off the ORACLE face, the dead
Swamp counting nothing. `Spite of Mogis` — census damage FIRST, the scry
ask LAST. `Splash Portal` — the flicker with a FOUR-subtype rider — ⚠️
its first test taught a CLASSIFICATION fact: **Muse Drake is a DRAKE, not
a Bird** — the fixture became batch-mate Spire Owl (a real Bird,
unregistered in that suite so its own trigger stays silent). `Sprouting
Thrinax` — three DISTINCT Saprolings on death. `Spinning Wheel` — the
#a1 tap-target behind an any-color mana line.

**Also:** Spinal Centipede (Sparring Construct's exact dies-counter text);
Spined Megalodon (attacks-scry behind hexproof); the census burns
(Spiraling Embers by hand size, Spire Barrage at the face, Spitting Earth
at a creature — Mountains counted DERIVED); Spirited Companion (the ETB
draw on an enchantment creature); Spiritual Guardian / Springmane Cervin
(ETB gains); Splatter Goblin (the dies-debuff, opponent enforced); Spore
Crawler (dies-draw); Spreading Rot (the land destroy billing its
controller); Spyglass Siren (the ETB Map).

⚠️ **Six refusals, ZERO new classes:** Spin Out PROBED — 'creature or
Vehicle' HALVES confident to bare creature (the D216 subtype-member hole,
Gravkill's noun-list class); Spinning Wheel Kick (computed target count);
Spirit en-Dal (ability-word cost); Spoils of the Hunt (mana-spent
memory); Spring Cleaning (clash); Spurred Wolverine (tap-creatures).

Fixtures 1,703 → 1,722 (89 tokens). botPool creature 1,810 / instant 615 /
sorcery 493 / artifact 107 / enchantment 54 / land 301 · ladder [1673,
1772, 3565, 5479, 6691] · batch.json 800 · botDeck: Sliver Queen reaches
3,331.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,563 files,
8,232 passed / 10 skipped · 500-seed gate 765.6 s · build
clean · probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D251): subtype identity is a classification read —
Drake ≠ Bird joins the read-off-the-dump rule (mana costs D215, P/T D250,
type lines D241, subtypes now); prior items stand.

## D252 — M6.4co: TWENTY-THREE landed — the five-Staff family, and 3,400 crossed (2026-08-21)

**3,403 of 31,692 Commander-legal cards execute completely, up from 3,380 —
the count CROSSES THREE THOUSAND FOUR HUNDRED**, on a batch that TIES THE ARC
RECORD (D237's 23). SHIPPED_SCRIPTS 1,483 → **1,506 — past FIFTEEN HUNDRED**;
ledger 535 → 537 (+2, ZERO new classes, zero new tokens, zero new support
bodies).

**The headliner: the FIVE-STAFF TEXT FAMILY, landed whole in one batch.**
`Staff of the Death / Flame / Mind / Sun / Wild Magus` print one line each —
"Whenever you cast a «colour» spell or a «land type» you control enters, you
gain 1 life" — and each needs **THREE defs**: the colour cast-watcher, the
land-type CARD entry, and the land-type TOKEN entry (nothing in the printed
line exempts a token land). The Death Magus carries the four-way matrix in
one game — a black cast pays, a red cast does not, a Swamp entry pays, a
Mountain entry does not — and the other four assert their own land arm; the
four variants were GENERATED from the Death base by a node script, so the
five are provably the same shape.

**Also:** `Stargaze` — the SpellDef-raised library TAKE with
`rest: 'graveyard'`: look at 2X, X to hand, the remainder binned, the life
loss emitted BEFORE the ask (Demon's Due's order). `Star of Extinction` —
destroy the land, then 20 damage to EVERY creature and planeswalker.
`Starfall` — the controller bill conditioned on the victim being an
ENCHANTMENT, read on the derived types before the damage lands (Spirited
Companion the fixture, a plain Bears the negative). `Stand United` — the
Ally-branched scry rider (Sokka the Ally; a Bears gets only the pump).
`Stabbing Pain` — two sentences, ONE target: the anaphora resolves in a
single pass, and the Bears ends a tapped 1/1. `Starfighter Pilot` — the
becomes-tapped surveil. `Steadfast Sentry` is the dies-counter family's
THIRD id and `Stealer of Secrets` the connect-draw family's THIRD; `Staunch
Defenders` carries Spiritual Guardian's exact text; `Squall Drifter` puts
the Trapper tap line on a SNOW creature. Plus Squall, Staff of Zegon,
Stark Industries (the refuge), Stark Industries Executive (the priced
Treasure), Starlight, Starlight Invoker, Starved Rusalka, Steam Blast.

⚠️ **A draft-time TypeScript lesson worth keeping:** the Staff matrix test
guards life inline four times, and an inline `!== 41` NARROWS the literal
type — TypeScript then rejects the later `!== 42` as impossible ("types '41'
and '42' have no overlap"). Reading through a `life(g)` function re-widens
it. Nothing about the engine; entirely about how the assertion is written.

⚠️ **Two refusals, ZERO new classes:** Square Up (until-end-of-turn base P/T
set) and Steal Strength (the second-clause parse — a sentence-initial
"Another target creature", Consume Strength's probed shape, and the family's
TENTH card).

Fixtures 1,722 → 1,745 (89 tokens). botPool creature 1,818 / instant 618 /
sorcery 498 / artifact 113 / enchantment 54 / land 302 · ladder [1650, 1749,
3542, 5456, 6668] · batch.json 775 · botDeck: Sliver Queen reaches 3,354.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,586 files,
8,326 passed / 10 skipped · 500-seed gate 722.4 s · build clean
· probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D252): the second-clause parse family is at TEN cards and
is now the heaviest un-built targeting slice; prior items stand.

## D253 — M6.4cp: sixteen landed — the seven-card census, and the first ordering to the BOTTOM (2026-08-22)

**3,419 of 31,692 Commander-legal cards execute completely, up from 3,403.**
SHIPPED_SCRIPTS 1,506 → 1,522; ledger 537 → 546 (+9, TWO new classes). Zero
new tokens, zero new support bodies. The TWENTY-SECOND first-run-clean batch:
all 37 tests green untouched.

**The headliner:** `Stomping Slabs` — the self-name census over a SEVEN-card
reveal, billing 7 to any target, and **the first shipped def to order cards
to `destination: 'bottom'`** (D142 built both ends of that ask; only the top
had ever been used). Its test proves the census BOTH ways, and the positive
is deterministic rather than lucky: a second copy is moved onto the library
**top** with the Tier-3 `ManualMoveCard` — the library APPENDS and
`drawFromTop` takes from the END, so an appended card IS the top (D142's
"the bottom is index 0", read from the other side).

**Also:** `Stonebound Mentor` — the GRAVEYARD-EXIT watcher meeting the scry
ask (Desecrated Tomb's filter, D171, one effect over): a card leaving MY
graveyard asks, a card leaving an opponent's asks nothing, both proven in one
game. `Stern Dismissal` and `Stern Proctor` — the two PROBED compounds:
"creature or enchantment an opponent controls" carries BOTH kinds with the
restriction enforced, and "artifact or enchantment" both kinds on an ETB.
`Stomp and Howl` — the probed two-spec destroy (an artifact AND an
enchantment, one batch). `Stench of Decay` — the negated-type board debuff,
the artifact creature exempt. `Storm's Wrath` — 4 to every creature and
planeswalker. `Storm Seeker` — the damage is the TARGET's hand, not the
caster's (Spiraling Embers one pronoun over). `Stensia Bloodhall` — the
priced ping land at #a1. Plus Sterling Hound (ETB surveil 2), Stinging
Barrier, Stolen Grain, Stone Haven Medic, Stonefury, Storm Spirit,
Stormcaller of Keranos.

⚠️ **Nine refusals, TWO new classes:** the ATTRACTION MECHANIC (`Step Right
Up` — an Attraction DECK is a zone this engine has no concept of) and the
EXERT COST (`Steward of Solidarity` — an activation cost carrying a delayed
untap restriction, and neither half exists). `Stern Scolding` was PROBED and
refused: "creature spell with power or toughness 2 or less" parses CONFIDENT
with `numeric` NULL — the bound is silently dropped, Repel Calamity's exact
hole. Plus discard-cost, ability countering, play-from-exile,
exile-from-graveyard, random-discard, and the becomes-targeted trigger.

Fixtures 1,745 → 1,761 (89 tokens). botPool creature 1,825 / instant 622 /
sorcery 502 / artifact 113 / enchantment 54 / land 303 · ladder [1634, 1733,
3526, 5440, 6652] · batch.json 750 · botDeck: Sliver Queen reaches 3,370.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,602 files,
8,391 passed / 10 skipped · 500-seed gate 736.2 s · build clean
· probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D253): the numeric-disjunction hole now holds TWO cards
(Repel Calamity, Stern Scolding) and reads the same way both times — the
bound after a disjunction is dropped without a trace; prior items stand.

## D254 — M6.4cq: seventeen landed — the three-part cost, and an Adventure nobody can watch (2026-08-22)

**3,436 of 31,692 Commander-legal cards execute completely, up from 3,419.**
SHIPPED_SCRIPTS 1,522 → 1,539; ledger 546 → 554 (+8, ONE new class). Zero new
tokens, zero new support bodies.

**The headliner: `Strands of Night` — the deepest activation cost the engine
has ever charged.** `{B}{B}, Pay 2 life, Sacrifice a Swamp:` is THREE cost
components in one line, and the classification probe showed `activatedParse`
reads the whole thing as a single activated ability. Its test proves every
part is actually taken: the Swamp reaches the graveyard, life falls 40 → 38,
and only then does the creature come back. The mana half (M3), the fixed-life
half (D165) and the sacrifice chooser (D168) were each built years of
decisions apart; this is the first card to spend all three at once.

⚠️⚠️ **AND ONE CARD WAS DRAFTED, TESTED AND PULLED — the pull is the finding.**
`Storyteller Pixie` watches "whenever you cast an Adventure spell". Its
oracle is exactly right: layout `adventure`, face 0 `Creature`, face 1
`Sorcery`. The cast of the Adventure half is ACCEPTED by the engine
(`CastSpell` with `faceIndex: 1` returns ok). **But no `SpellCast` event is
ever logged for it** — two separate diagnostics confirmed an empty cast log
after the stack had settled — so a watcher has nothing to match on. The
module and its test were deleted, the card unregistered, and the ledger entry
NAMES WHAT WAS MEASURED rather than guessing at a cause:
`'adventure-half cast unobserved'`. Edgewall Innkeeper (D173) is unaffected —
it watches the CREATURE half, which casts normally.

**Also:** `Subjugate the Hobbits` — mass theft with the COMMANDER exclusion
read off `commanderIds` and a mana-value bound (the cheap creature changes
hands, the six-drop stays). `Strip Bare` — the attachment walk pointed at ONE
host: the worn Equipment dies, a loose spare on the same battlefield stands.
`Structural Distortion` — the probed 'artifact or land' compound EXILED with
the controller read before the move (exile is not destruction, so there is no
indestructible check). `Stronghold Discipline` — each player pays their OWN
creature count, all counted before any of the losses land. `Sudden Insight` —
the DISTINCT-mana-value census. `Sudden Impact` — Storm Seeker's exact text
on a second id, landed one batch after the first. `Student of Ojutai` — the
NONCREATURE cast watcher, proven with two batch-mates. Plus Stream of Life,
Stream of Unconsciousness (the Wizard-conditioned draw), Strength of Cedars,
Strip Mine, Striped Bears, Stroke of Genius, Subterranean Cavern, Suburban
Sanctuary, Succumb to Temptation.

⚠️ **Eight refusals, ONE new class** (above). `Stream of Acid` was PROBED:
"target land or nonblack creature" HALVES to a confident bare 'target land',
dropping the negated-colour arm without a trace. Plus opponent-chooses ×3
(Strategic Betrayal, Struggle for Sanity, Sudden Setback), up-to-N ×2 (Stream
of Consciousness, Sudden Storm), and a discard-cost chooser.

Fixtures 1,761 → 1,778 (89 tokens). botPool creature 1,827 / instant 629 /
sorcery 506 / artifact 113 / enchantment 55 / land 306 · ladder [1617, 1716,
3509, 5423, 6635] · batch.json 725 · botDeck: Sliver Queen reaches 3,387.

**Verified: verify.cjs --full — ALL FIVE GATES: 1,619 files,
8,461 passed / 10 skipped · 500-seed gate 751.1 s · build clean
· probe 124/124 · battery 130/130.**

⚠️ **Reportables** (D254): the Adventure-half cast emitting no observable
`SpellCast` is an ENGINE gap, not a parse one — it blocks every "whenever you
cast an Adventure spell" card and is worth settling before that family comes
round again; prior items stand.
