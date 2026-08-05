# `src/engine/scripts/cards/` — the landed card scripts

**Empty today. `scripts/cardgen/land.cjs` writes here, and M6.4 fills it.**

One file per card, named after the card with the punctuation stripped
(`ajanisPridemate.ts`). Each exports a single `CardScript` and is imported by
`SHIPPED_SCRIPTS` in `../registry.ts`.

## What a file here owes

Every one of these is enforced by a test; none of it is convention.

1. **The card must stop being disclaimed, in the same commit.** Its `tier3.ts`
   note goes silent and `engineComplete` accepts it —
   `src/data/shippedScripts.node.test.ts`. Otherwise the app runs a card while
   telling the player it will not, which is D122's failure in the other
   direction.
2. **The card must be in the fuzz pool.** Registered in `fuzz.node.test.ts`'s
   `SCRIPTS` *and* dealt in its `DECK` — asserted there. A card missing from the
   pool is a code path the 500-seed gate cannot reach, and the gate stays green
   the whole time it rots (broken four times: D102, D107, D108, D121).
3. **Tests written against the REAL Scryfall oracle text** from the local
   database, never a paraphrase (D15b).
4. **Scripts return EVENTS.** They are never handed a mutation API, and
   `ctx.random` is a seeded scratch RNG so a coin-flip card replays bit-exactly.
5. **A script that cannot be verified is not landed.** No "mostly works" tier.

## What must NOT happen here

⚠️ **The generator may never touch `src/engine/`** outside this directory and the
one `SHIPPED_SCRIPTS` line that imports from it. Primitives are hand-written,
reviewed work — that is where correctness for *every* card is decided, and a
generated change to a primitive is a change to every card at once.

⚠️ **Nothing in this directory may be written by hand and left unregistered.** A
file here that `SHIPPED_SCRIPTS` does not import is a script that looks landed
and runs never.
