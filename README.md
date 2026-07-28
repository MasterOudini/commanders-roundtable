# Commander's Roundtable

Play Magic: The Gathering — Commander (EDH) with 2–4 friends over the internet,
using decks you built yourself, with **the app doing the rules bookkeeping** the
way MTG Arena does: shuffling, mulligans, turn structure, mana, casting, the
stack, combat, state-based actions, commander damage.

An offline-first Electron desktop app. It is deliberately **not** a manual
sandbox where players drag cards and track life by hand — and equally
deliberately **not** a full rules engine for every Magic card, which is a
multi-year project on its own.

## What is and is not automated

The honesty about that boundary is the point, and the app says it on the card.

| Tier | What it means |
|---|---|
| **1 — fully automatic** | Shuffle, London mulligan, every phase and step, untap, draw, priority, mana pools, cost payment, commander tax, the stack resolving LIFO, combat damage, lethal damage, 0 life, 21 commander damage, the legend rule, drawing from an empty library, zone visibility, target declaration and legality |
| **2 — keyword automation** | Parsed from Scryfall and enforced where it affects combat or casting: flying, reach, trample, vigilance, haste, lifelink, deathtouch, first/double strike, menace, defender, indestructible, flash, hexproof, shroud, landwalk, infect, wither, toxic, protection from a colour, ward |
| **2.5 — parsed effects** | A spell whose text the ingest understands **completely** resolves by itself. Measured: **274 of 6,975** Commander-legal instants and sorceries |
| **2.5a — assisted** | A spell understood only in part never runs by itself. The prompt bar offers the understood half as one logged, manual click and says the rest is yours. **1,300** spells |
| **3 — manual with helpers** | Everything else, **and the card says so**. Move any card between any zones, create tokens, add/remove counters, adjust life and mana, tap/untap, reveal, roll dice, flip coins — every one of them a logged, replayable event |

## Getting started

Players: see [docs/INSTALL-AND-PLAY.md](docs/INSTALL-AND-PLAY.md) — install, first-run
card sync, deck import, hosting a game, and what to do when it goes wrong.

Developers:

```bash
npm install
npm run desktop        # what the desktop shortcut runs
npm run electron:dev   # Vite + Electron, from a terminal
npm run test           # vitest (engine + net)
npm run build          # tsc -b && vite build
```

Architecture, conventions, the verification tooling and the traps that have
already cost real debugging time are in [AGENTS.md](AGENTS.md). Non-obvious
decisions and the reasons behind them are in [docs/DECISIONS.md](docs/DECISIONS.md)
— **read it before "fixing" anything that looks odd.**

## Offline-first

Gameplay works with no internet at all. The only network access, all of it
documented and host-pinned in the main process:

1. **Scryfall bulk card data** — one download, plus a manual "update card database".
2. **Scryfall card images** — per imported deck, cached to disk permanently.
3. **Relay WebSocket / LAN hosting** — only while you have started a game.
4. **electron-updater** — a GitHub Releases check on launch.
5. **Deck import by link** — one request per press of "Fetch decklist".

No telemetry, ever.

## Card data and images

Card data comes from [Scryfall](https://scryfall.com). Card images are fetched
per-deck by each player's own app and cached locally; **card art is never
bundled into the installer and never relayed between players**, because it is
Wizards of the Coast's copyright. A packaging audit asserts no card art under
`release/`. See [docs/SCRYFALL.md](docs/SCRYFALL.md) for the attribution the
About screen displays verbatim.

Commander's Roundtable is unofficial Fan Content permitted under the Fan Content
Policy. Not approved or endorsed by Wizards of the Coast. Portions of the
materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
