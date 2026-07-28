// The wire form of a view: a `PlayerView` with each card's ~2 KB of oracle data
// replaced by its printing id, plus the dictionary that lets a client put it
// back.
//
// ⚠️ WHY A DICTIONARY AND NOT JUST THE CARD. `PlayerView` inlines `CardData`
// because M2's table renders straight from it, and that shape must not change
// (see `src/view/types.ts`). But a `CardData` is a name, a type line, full
// oracle text, artist, legalities and every face — around 2 KB. Sending it on
// every tap would turn a 120-byte update into 2 KB and a snapshot into ~500 KB,
// for information the receiving app already has on disk and will be sent again
// on the next event anyway. Each printing crosses the wire exactly ONCE per
// client; after that the client rehydrates locally.
//
// ⚠️ THIS IS ALSO WHY `oracleVersion` IS A HARD REJECT. The dictionary is the
// only channel by which a client learns a card it does not have, so both ends
// must agree about what a printing id MEANS. Two players on different Scryfall
// snapshots would otherwise disagree about oracle text mid-game, which produces
// an unfalsifiable dispute rather than an error (spec Q13).

import { createOracleDb } from '../engine/oracle';
import type { ViewPatch } from '../engine/diffView';
import type { PrintingId } from '../engine/types/ids';
import type { OracleDb } from '../engine/types/oracle';
import type { CardData } from '../data/cardTypes';
import type { CardView, PlayerView } from '../view/types';
import type { PrintingDict, WireCardView, WireView } from './protocol';

export function toWireCard(card: CardView): WireCardView {
  return { ...card, card: card.card?.scryfallId ?? null };
}

/**
 * Rehydrate one card.
 *
 * A printing the dictionary does not carry becomes `card: null` — the same
 * shape a legitimately hidden card has, so the table renders a face-down back
 * rather than throwing. That is the right failure: a missing dictionary entry
 * is a bug in the sender, and the receiver's job is to stay playable and let the
 * `viewHash` mismatch report it.
 */
export function fromWireCard(card: WireCardView, dict: ReadonlyMap<PrintingId, CardData>): CardView {
  return { ...card, card: card.card === null ? null : (dict.get(card.card) ?? null) };
}

export function toWireView(view: PlayerView): WireView {
  const cards: Record<string, WireCardView> = {};
  for (const [id, card] of Object.entries(view.cards)) cards[id] = toWireCard(card);
  return { ...view, cards };
}

export function fromWireView(view: WireView, dict: ReadonlyMap<PrintingId, CardData>): PlayerView {
  const cards: Record<string, CardView> = {};
  for (const [id, card] of Object.entries(view.cards)) cards[id] = fromWireCard(card, dict);
  return { ...view, cards };
}

/** Every printing a view mentions, so the sender knows what to ship. */
export function printingsIn(view: PlayerView): Set<PrintingId> {
  const out = new Set<PrintingId>();
  for (const card of Object.values(view.cards)) {
    if (card.card) out.add(card.card.scryfallId);
  }
  return out;
}

export function toWirePatch(patch: ViewPatch): ViewPatch {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch.set)) {
    set[key] = key.startsWith('cards.') ? toWireCard(value as CardView) : value;
  }
  return { ...patch, set };
}

export function fromWirePatch(patch: ViewPatch, dict: ReadonlyMap<PrintingId, CardData>): ViewPatch {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch.set)) {
    set[key] = key.startsWith('cards.') ? fromWireCard(value as WireCardView, dict) : value;
  }
  return { ...patch, set };
}

/**
 * Tracks which printings a given client already has.
 *
 * Per CONNECTION, not per player: a reconnecting client is a new socket with an
 * empty cache, and re-sending its dictionary is cheaper and far more obviously
 * correct than trying to remember what the previous socket got through.
 */
export class PrintingLedger {
  private readonly sent = new Set<PrintingId>();

  /** The entries `ids` needs and this client has not been sent. Marks them sent. */
  take(ids: Iterable<PrintingId>, pool: (id: PrintingId) => CardData | undefined): PrintingDict {
    const out: Record<PrintingId, CardData> = {};
    for (const id of ids) {
      if (this.sent.has(id)) continue;
      const card = pool(id);
      if (!card) continue;
      out[id] = card;
      this.sent.add(id);
    }
    return out;
  }

  reset(): void {
    this.sent.clear();
  }
}

/**
 * The client's growing card pool, plus the `OracleDb` its payment solver needs.
 *
 * ⚠️ The database is rebuilt only when the dictionary GROWS, which in a real
 * game means a handful of times during the opening and never again. Rebuilding
 * per update would re-parse every oracle face on every event — the ingest is
 * ~12 µs per card (D32), which is nothing once and 5 ms per frame if you get
 * this wrong.
 */
export class CardPool {
  private readonly cards = new Map<PrintingId, CardData>();
  private db: OracleDb | null = null;

  get size(): number {
    return this.cards.size;
  }

  add(dict: PrintingDict): void {
    let grew = false;
    for (const [id, card] of Object.entries(dict)) {
      if (this.cards.has(id)) continue;
      this.cards.set(id, card);
      grew = true;
    }
    if (grew) this.db = null;
  }

  get(id: PrintingId): CardData | undefined {
    return this.cards.get(id);
  }

  map(): ReadonlyMap<PrintingId, CardData> {
    return this.cards;
  }

  oracle(): OracleDb {
    this.db ??= createOracleDb([...this.cards.values()]);
    return this.db;
  }
}
