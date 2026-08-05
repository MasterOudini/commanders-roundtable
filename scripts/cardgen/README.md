# `scripts/cardgen/` — the card-script pipeline

M6.4-LIBRARY-SPEC §5. See **D157**.

```
select.cjs   pick the next batch                 → batch.json
  (draft)    a model drafts a CardScript          DEV ONLY — see below
verify.cjs   the five gates of §6
land.cjs     register the accepted scripts        → SHIPPED_SCRIPTS
```

## Why there is no `draft.cjs`

The spec's pipeline names one, and **it is deliberately not a script in this
repo.**

⚠️ **The running game never touches a network and never calls a model.** The
offline-first policy is absolute, and determinism, replay, rewind and the fuzz
gate all depend on it. A `draft.cjs` that called an API would put a network
dependency in the repository even if nothing shipped it — and the first person to
run it inside `electron:build` would not find out until it failed offline.

So drafting is what it actually is: **a developer, with a model, writing ordinary
reviewed TypeScript**, using `batch.json` as the work list. The output is a file
in `src/engine/scripts/cards/` and a test beside it. Nothing about it needs
automating, and automating it is how a script nobody read gets landed.

## The loop

```bash
node scripts/cardgen/select.cjs 200
```

Then, for each card in `batch.json`:

1. Read the card's **real oracle text** from the local database —
   `node electron/cardsvc-worker.cjs --query "<name>"`. Never a paraphrase, never
   from memory (D15b).
2. Write `src/engine/scripts/cards/<moduleName>.ts` exporting one
   `<MODULE_NAME>_SCRIPT`.
3. Write its test beside it, asserting on **EVENTS** rather than final state
   where possible.
4. Add the card to `fuzz.node.test.ts`'s `SCRIPTS` **and** its `DECK`.

```bash
node scripts/cardgen/land.cjs <moduleName> …
node scripts/cardgen/verify.cjs --full
```

## What the gates actually catch

`verify.cjs` prints this for each gate as it runs, because a gate whose purpose
nobody remembers is a gate somebody deletes when it goes red at an awkward
moment. In short:

| Gate | Catches |
|---|---|
| `tsc -b` | a script that does not fit the `CardScript` surface |
| conformance corpus | a script individually right and **wrong in combination** |
| coverage accounting | a card the engine now runs while `tier3` still disclaims it |
| the unit suite | everything else, including the per-card tests |
| the 500-seed fuzz gate | events that do not replay, and a card missing from the pool |

## Report coverage honestly

⚠️ Every batch reports **"X of 31,692 Commander-legal cards now execute
completely, up from Y"** — measured through `engineComplete`, never as a count of
scripts written. Coverage is asymptotic and the last few hundred cards will cost
more than the first ten thousand; say the number even when it moves less than
hoped.
