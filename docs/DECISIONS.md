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
| Q5 | Combat damage assignment | **Automatic**; `options.manualCombatDamageAssignment` is the seam, unused in v1 |
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
used to.

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
