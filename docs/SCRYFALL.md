# Scryfall, Wizards of the Coast, and what this app owes them

⚠️ This file was referenced by `AGENTS.md` and by the M2–M4 handoffs from M1
onwards, and did not exist until M5 wrote it. It is the authority for the About
screen (`src/ui/screens/AboutScreen.tsx`), for `docs/INSTALL-AND-PLAY.md`, and
for the request headers in `electron/scryfall.cjs`. Those three must agree; if
you change one, change all of them.

---

## 1. What we take, and from where

| What | Endpoint | When | Where it lands |
|---|---|---|---|
| Bulk card data | `api.scryfall.com/bulk-data` → `jsonl_download_uri` | Once, on the user's explicit "download card database"; again only when they ask | `<dataRoot>/downloads/`, transformed to `<dataRoot>/cards/` |
| Card images | `cards.scryfall.io/<tier>/<face>/<a>/<b>/<id>.<ext>` | Per imported deck, and on a `cardimg://` cache miss | `<dataRoot>/images/`, sharded by id prefix |

Nothing else. `electron/scryfall.cjs` holds an **exact-host allowlist** — those
two hosts and no others, no subdomains, no redirects off them — and it is the
only module in the app that opens an outbound connection to Scryfall.

## 2. The API obligations we are technically bound by

Scryfall's published API guidelines ask every client for three things. All three
are implemented in `electron/scryfall.cjs`; a change there that drops one is a
breach, not a style choice.

1. **A descriptive `User-Agent`** that identifies the application, so Scryfall
   can contact whoever is generating traffic. Ours names the app and its version.
2. **An explicit `Accept` header** rather than relying on a default.
3. **No more than ~10 requests per second.** We are far under it: the rate
   limiter enforces a **100 ms minimum gap at the wire**, serialized across
   concurrent callers.
   ⚠️ D14b — the naive `lastRequestAt` gate is correct for one caller and
   silently wrong for six. Measured 103 ms minimum gap with 5 requests
   concurrent, by hooking `https.get`, because timestamping `download()` reports
   ~1 ms gaps even when the pacing is correct.

Bulk data is additionally meant to be downloaded **at most once a day** per
client. We download it once ever, plus whenever the user presses the button; the
card-database screen shows the age of the held data so nobody has a reason to
press it idly.

## 3. Copyright — the part that constrains packaging

**Card images are Wizards of the Coast's copyright.** Scryfall hosts and serves
them; it does not own them and cannot sublicense them to us.

Three consequences, all of them load-bearing:

- ⚠️ **Card art is never bundled into the installer.** `release/` must contain
  no card image of any kind. `scripts/audit-bundle.cjs` asserts this, and the
  assertion is not decoration — shipping a `.exe` containing Wizards' art is
  redistribution, and it is the single thing in this project that could turn a
  personal tool into a legal problem.
- ⚠️ **Card art is never relayed between players.** Each player's app fetches
  its own copy from Scryfall. The wire protocol carries a printing **id**
  (D52) — never image bytes. A guest with a cold cache sees a full-text
  `SyntheticFace` until its next online moment; that is the correct trade, and
  it is stated in `docs/INSTALL-AND-PLAY.md` rather than hidden.
- **Card names, mana costs, type lines and oracle text** are also Wizards'
  intellectual property. They are reproduced here for play, the way a physical
  card is, under the Fan Content Policy below.

Scryfall's own contributions — the database structure, their identifiers, their
rulings compilation — are made freely available for non-commercial use, and this
is a personal, non-commercial, friends-only application. We do not resell the
data, we do not present it as our own, and we do not imply Scryfall endorses us.

## 4. The two attribution strings the app must display

These are the exact strings. The About screen renders both verbatim; the probe
asserts the first one is present in the rendered text, so a refactor that drops
it fails a check rather than quietly shipping.

**Scryfall:**

> Card data and card images are provided by Scryfall (scryfall.com). This
> application is not produced by, endorsed by, supported by, or affiliated with
> Scryfall.

**Wizards of the Coast — the Fan Content Policy boilerplate:**

> Commander's Roundtable is unofficial Fan Content permitted under the Fan
> Content Policy. Not approved/endorsed by Wizards. Portions of the materials
> used are property of Wizards of the Coast. ©Wizards of the Coast LLC.

⚠️ The Fan Content Policy requires that fan content be **free** and not be
presented as official. This app is free, personal, and distributed to a handful
of friends as an `.exe`. Selling it, putting ads in it, or taking donations for
it would void that permission — which is why `docs/DECISIONS.md` records the
project as non-commercial from D1 onwards and why there is no telemetry, no
account system and no payment path anywhere in the codebase.

## 5. Where each obligation is discharged

| Obligation | Discharged in |
|---|---|
| Descriptive `User-Agent` | `electron/scryfall.cjs` |
| Explicit `Accept` | `electron/scryfall.cjs` |
| ≤10 req/s | `electron/scryfall.cjs` (`rateLimit()`, serialized — D14b) |
| Bulk data at most daily | user-initiated only; age shown on the card-database screen |
| Scryfall attribution | `src/ui/screens/AboutScreen.tsx`; asserted by `scripts/probe.cjs` |
| Wizards Fan Content notice | `src/ui/screens/AboutScreen.tsx`; asserted by `scripts/probe.cjs` |
| No art in the installer | `scripts/audit-bundle.cjs` |
| No art on the wire | `src/net/wire.ts` (ids only — D52) |
| No telemetry | there is no analytics code; `connect-src` is per-origin (D48) |

## 6. What we deliberately do NOT do

- We do not use Scryfall's search API at runtime. Every query is answered from
  the local index, which is why the app plays fully offline.
- We do not hotlink images into the renderer. Art is fetched in **main**,
  cached to disk, and served to the renderer over the privileged `cardimg://`
  scheme — so the renderer's `connect-src` never needs to name Scryfall at all.
- We do not scrape, mirror, or redistribute the bulk file. Each install
  downloads its own copy from Scryfall directly.
