# Commander's Roundtable — install and play

A desktop app for playing **Magic: The Gathering — Commander** with 2–4 friends,
using decks you built yourself. The app does the bookkeeping: shuffling,
mulligans, life, turns, mana, the stack, combat, commander damage.

This page is for the people being sent the installer. You do not need to know
anything about how it was built.

---

## 1. Install it

You will be sent one file: **`Commander's Roundtable Setup 0.1.1.exe`**
(about 100 MB). Double-click it.

### Windows will warn you. This is expected.

The app is not code-signed — a signing certificate costs several hundred pounds
a year, and this is a free app made for a handful of friends. So Windows
SmartScreen shows a blue box saying **"Windows protected your PC"**.

To get past it:

1. Click **More info** (the small link — it is easy to miss).
2. Click **Run anyway**.

If your browser blocked the download instead, choose **Keep** → **Keep anyway**.

> Only do this for the file you were sent directly by the person running the
> game. That advice is not a formality: "click through the warning" is exactly
> what a real piece of malware wants you to do, so the thing that makes it safe
> here is that you know who sent it and why.

The installer asks where to put the app, then adds a **Commander's Roundtable**
shortcut to your desktop. It installs for your user account only and needs no
administrator password.

**Your files** live in `C:\Users\<you>\.commanders-roundtable` — decks, settings,
the card database and downloaded card pictures. Uninstalling the app does not
delete them.

---

## 2. First run: download the card database

The app needs Magic's card data before it can do anything. This happens **once**.

1. Open the app and go to **Card database**.
2. Press **Download card database**.
3. It downloads about **77 MB** and then spends a minute or two building an
   index. It tells you what it is doing the whole time.

When it finishes you will have all **113,559** English card printings on your
computer. After this, **the app never needs the internet to play** — see §9.

If the download is interrupted, press the button again: it resumes from where it
stopped rather than starting over.

---

## 3. Import your deck

1. Go to **Decks** → **Import a deck**.
2. Either paste a **deck link** and press **Fetch decklist**, or paste the
   decklist itself.

Links work for **Moxfield**, **Archidekt** and **TappedOut**. Open your deck
there, copy the address out of your browser, and paste it in:

| Site | A deck link looks like |
|---|---|
| Moxfield | `https://www.moxfield.com/decks/your-deck-id` |
| Archidekt | `https://archidekt.com/decks/1234567/your-deck-name` |
| TappedOut | `https://tappedout.net/mtg-decks/your-deck-name/` |

The list is downloaded and dropped into the box below, so you can see and edit
exactly what you are about to import before anything is saved. Your commander
comes across as your commander — no need to mark it. Anything hanging off the
link (a primer, a sort order, `/edit/`) is ignored; it just fetches the deck.

Private and unlisted decks cannot be downloaded — the app is not signed in as
you. Open one in your browser and paste the list instead. Deck links from other
sites are not downloaded either; copy the list and paste it.

Pasting understands the formats Moxfield, Archidekt and MTGO export, including
set codes and collector numbers (`1 Sol Ring (LTC) 264`), section headers,
category tags and `//` comments. Anything it could not read is **reported, never
silently dropped** — you will see exactly which line and why.

**If a pasted list does not mark its commander**, the app works it out from the
cards — and if that commander has **Partner**, **Friends forever**, **Partner
with** or **Choose a Background**, it looks for the second commander too and
takes both. It tells you which cards it picked and why, so you can put a
`Commander` heading above a different card if it guessed wrong.

It then checks the deck: exactly 100 cards **including every commander** (so a
Partner pair is 98 + 2), singleton, colour identity, the ban list, and whether
your commander can legally be one. Warnings do not stop you playing — the pod
decides.

**Card pictures** download in the background after import: roughly 90 MB for a
100-card deck, a few minutes. You can start playing immediately; cards you do not
have pictures for yet show their full text on a plain coloured card, which is
completely playable.

You do not need a deck at all to try the app — every seat without one gets a
generated starter deck. It is not a legal Commander deck and the app says so.

---

## 4. Play by yourself

**Play solo** sets up a table you play both sides of. Choose how many are sitting
down (2, 3 or 4), give each seat a deck — any deck you have imported, or a starter
deck — and press **Start the game**.

There is no computer opponent. You take every seat in turn, the way you would play
a game out on your own kitchen table: the app shuffles, deals, enforces the rules
and passes the turn around, and you decide what each player does when it is their
go. It is the quickest way to learn the app, and to see how a new deck actually
plays before you bring it to a real table.

Your choices are remembered while the app is open, so a rematch is one click.

---

## 5. Play together

**One person hosts. Everyone else joins.** The host's app runs the rules for the
whole table, so **the host has to leave their app open until the game ends.** If
the host closes it, the game stops for everyone.

### Everyone on the same Wi-Fi (the easy way)

**Host:**

1. Go to **Play with friends**, pick your deck, press **Host on this network**.
2. Your screen now shows three things. Read out the first two, and send the third:
   - a **room code** — six characters, like `K7M2QX`
   - an **address** — like `ws://192.168.1.42:5282`
   - a **join key** — a long line of letters and numbers

**Everyone else:**

1. Go to **Play with friends**.
2. Type the **address**, the **room code**, and paste the **join key**.
3. Press **Join game**.

> ⚠️ **The join key is not optional, and it is the thing people get stuck on.**
> On a shared network — a flat, a hall of residence, a café — anyone else on the
> same Wi-Fi could otherwise walk into your game. The key is what stops them.
> Copy it with the button next to it and paste it into a message; it is too long
> to read aloud. (A relay game, below, does not use one.)

Then everyone presses **I am ready**, and the host presses **Start the game**.
The Start button stays greyed out until everyone is ready, and the screen tells
the host who it is still waiting for.

### Not on the same Wi-Fi

Two options, in order of how much work they are:

**A VPN like Tailscale (free, no server).** Everyone installs it and joins the
same private network; then follow the steps above using the address Tailscale
gives the host. As far as the app is concerned you are all on one Wi-Fi.

**A relay (needs a small server you run).** If someone in the group has set one
up, put its address in **Settings → Relay address**, reload the app when it asks,
and then **Host over a relay**. Guests only need the six-character room code —
no address, no join key.

### The Windows Firewall prompt

The **first time you host**, Windows asks whether to let the app accept
connections.

> ⚠️ Tick **Private networks** only. Leave **Public networks** unticked.

Private means your home or office network. Public means coffee shops and
airports, where you do not want to be accepting connections from strangers. If
you tick the wrong one or dismiss the prompt, your friends will not be able to
join — undo it in *Windows Security → Firewall & network protection → Allow an
app through firewall*.

Only the **host** sees this prompt. People joining do not.

---

## 6. Putting cards down

Two ways, and they do exactly the same thing — use whichever feels right.

- **Drag it.** Pick a card up out of your hand and drop it on your own side of
  the table. Your side lights up while you are holding a card over it, and the
  card tells you what the drop will do ("Play Mountain", "Cast Grave Titan").
- **Click it.** A land goes straight down. A spell shows you which lands will be
  tapped to pay for it, and you confirm.

Either way a spell shows you the payment before it is cast, so you never get
charged for something you did not see. If a card cannot be played right now, the
table says why rather than just refusing — your side of the table goes dashed
instead of lighting up, and the card carries the reason.

**Your commander works the same way.** Drag it straight out of the **CMD** pile
onto the table, or click it. The commander tax is already in the price you are
shown, so the second and third casts simply cost more.

**Equipment and Auras**: drag one onto a creature to attach it, and drag it off
onto a different creature to move it. Only what it can legally go on stays lit
while you are dragging. ⚠️ This MOVES the attachment and nothing else — paying
the equip cost, and only equipping at sorcery speed, are still yours to do, the
same as every other Tier-3 card. The app says so while you are dragging.

**To see what a creature is carrying**, click the small tab on its left edge —
it shows a count, and opens a list of everything attached with **Move**, **Take
off** and **More…** for each. It is there on every seat's creatures, so you can
read what an opponent has enchanted too.

Keyboard: **1–9** picks a card in your hand.

---

## 7. What the app does for you, and what it does not

This matters more than anything else on this page. The app is **not** a full
rules engine for every Magic card — that is a multi-year project — and it is very
deliberate about which is which.

**Always automatic.** Shuffling, the London mulligan, 40 life, every phase and
step, untapping, drawing, priority, paying costs, commander tax, the stack
resolving in order, combat damage, lethal damage, 0 life, 21 commander damage,
10 poison, the legend rule, drawing from an empty library, and who can see what.

**Automatic keyword abilities.** Flying, reach, trample, vigilance, haste,
lifelink, deathtouch, first and double strike, menace, defender, indestructible,
flash, hexproof, shroud, fear, intimidate, skulk, shadow, horsemanship,
landwalk, infect, wither, toxic, protection from a colour, and ward.

**Not automatic — you do it.** Everything a card does that is unique to that
card. The app does not read your Aura and attach it, or crew your Vehicle, or
work out your Cascade.

That is not a gap you have to remember: **hover any card and it tells you what it
will not do for you, and what to do instead.** A card with nothing listed is one
the app handles completely.

For everything else there are tools, in the drawer at the bottom of the table:
move any card between any zones, make tokens, add or remove counters, change life
and mana, tap or untap anything, reveal cards, roll dice, flip coins. And if the
table gets into a state nobody wanted, **everyone can vote to rewind** — the game
rewinds to any earlier point exactly.

---

## 8. When something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| "A room code is six characters" | Your code has the wrong number of characters | Ask the host to read it again. A code **never** contains `I`, `O`, `0` or `1` — they are left out precisely because they are misheard — so if you wrote one of those down, it was something else. Upper and lower case both work |
| "That address is now allowed. Reload the app once, then join again." | Normal, once per new address | Press **Reload now**, then Join again |
| "A game address must start with wss:// or ws://" | The address is missing its start | Copy it from the host's screen with the button rather than typing it |
| "ws:// is unencrypted, so it is only allowed on your own network" | You are using a plain address for someone not on your network | Use a VPN, or a relay with a `wss://` address |
| Your friends cannot join, and nothing appears on the host's screen | Almost always the firewall | Check *Private networks* is ticked for the app (§5) |
| A player shows as **(disconnected)** | Their app closed or their Wi-Fi dropped | Nothing. They rejoin with the same code and land back in their own seat, with their hand intact. The game waits |
| The host's app closed | The game has stopped for everyone | The host reopens the app and hosts again |
| Cards show as plain coloured rectangles with text | Their pictures have not downloaded yet | Play on. They fill in as they download. Everything works |
| "The card database has not been built yet" | §2 has not been done on this computer | Card database → Download card database |

**Nobody can see your hand.** Not even the host — their app holds your cards but
their screen is built from the same filtered view a guest gets, and it is
structural rather than a promise: the code that draws the table is never given
anyone else's hidden information.

---

## 9. What this app does on the internet

Everything about playing works offline. These five are the only connections it
ever makes. There is no analytics, tracking or telemetry of any kind — not
switched off, not present.

| For | Where | When |
|---|---|---|
| Card database | `api.scryfall.com` | Once, when you press the button. Never during a game |
| Card pictures | `cards.scryfall.io` | When you import a deck, or the first time you see a card. Cached forever |
| Importing a deck by link | `moxfield.com`, `archidekt.com`, `tappedout.net` | Only when you paste a deck link and press **Fetch decklist** |
| Playing with friends | Your own network, or a relay you configured | Only while you are hosting or joined |
| App updates | `github.com` | At launch, to see whether a newer version exists |

This is tested rather than claimed: the app has been played — a four-player solo
game to turn 37, and a two-player LAN game with a dropped and restored
connection — with all name lookups switched off. Nothing failed but downloading
pictures it had not already cached.

---

## 10. Credits

Card data and card images are provided by Scryfall (scryfall.com). This
application is not produced by, endorsed by, supported by, or affiliated with
Scryfall.

Commander's Roundtable is unofficial Fan Content permitted under the Fan Content
Policy. Not approved/endorsed by Wizards. Portions of the materials used are
property of Wizards of the Coast. ©Wizards of the Coast LLC.

Card pictures belong to Wizards of the Coast. They are **not** included in the
installer and are never passed between players — every copy of the app downloads
its own from Scryfall. That is why a friend who has just installed it sees plain
cards for a while.

This is a free, personal, non-commercial project. It is not sold and takes no
payment of any kind.
