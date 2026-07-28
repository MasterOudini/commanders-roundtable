// Starting a solo game: four seats, the user's decks where they have them and a
// starter deck where they do not.
//
// ⚠️ Card data comes from the MAIN process every time. If the card database is
// not synced, this reports that plainly instead of quietly starting a game with
// no cards — a table full of blanks is far worse than a message saying why.

import { seatFromDeck, seatName, starterSeat, startSpec, TOKEN_NAMES, type CardResolver } from './buildGame';
import * as session from './session';
import type { CardData } from '../data/cardTypes';
import type { SeatSpec } from './session';
import type { PlayerView } from '../view/types';

export interface SoloResult {
  readonly ok: boolean;
  readonly message: string;
  readonly view: PlayerView | null;
  readonly tokens: readonly CardData[];
  readonly missing: readonly string[];
}

function bridgeResolver(): CardResolver | null {
  const bridge = window.crt;
  if (!bridge) return null;
  return {
    async byName(name, set, collectorNumber) {
      return bridge.cardDb.byName({
        name,
        ...(set !== undefined ? { set } : {}),
        ...(collectorNumber !== undefined ? { collectorNumber } : {}),
      });
    },
    async many(entries) {
      const results = await bridge.cardDb.resolveNames(
        entries.map((e) => ({
          name: e.name,
          ...(e.set !== undefined ? { set: e.set } : {}),
          ...(e.collectorNumber !== undefined ? { collectorNumber: e.collectorNumber } : {}),
        })),
      );
      return results.map((r) => r.card);
    },
  };
}

/** Token printings for the manual tool, resolved by name and layout. */
async function loadTokens(): Promise<CardData[]> {
  const bridge = window.crt;
  if (!bridge) return [];
  const out: CardData[] = [];
  for (const name of TOKEN_NAMES) {
    try {
      const printings = await bridge.cardDb.printingsOf(name);
      const token = printings.find((c) => c.layout === 'token');
      if (token) out.push(token);
    } catch {
      // A missing token is not worth failing a game start over.
    }
  }
  return out;
}

/**
 * What "the same card database" means on the wire.
 *
 * ⚠️ Compared at `Welcome` and a HARD reject on mismatch (spec Q13). Two players
 * on different Scryfall snapshots can disagree about oracle text, and the
 * disagreement surfaces mid-game as an argument neither of them can settle. The
 * record count plus the source timestamp is enough to tell two snapshots apart
 * without hashing 77 MB on every launch.
 */
export async function oracleVersion(): Promise<string> {
  const bridge = window.crt;
  if (!bridge) return 'no-bridge';
  const status = await bridge.cardDb.status().catch(() => null);
  if (!status) return 'unknown';
  // Scryfall's own release timestamp plus the record count: two apps holding
  // the same bulk file agree on both, and two holding different ones do not.
  return `${status.updatedAt ?? 'none'}#${status.cardCount ?? 0}`;
}

export interface SoloOptions {
  readonly seats?: number;
  /** Deck ids per seat; `null` means "use a starter deck". */
  readonly deckIds?: readonly (string | null)[];
  readonly seed?: string;
}

export async function startSolo(opts: SoloOptions = {}): Promise<SoloResult> {
  const resolver = bridgeResolver();
  if (!resolver) {
    return {
      ok: false,
      message: 'The card database is only reachable inside the app. Run `npm run desktop`.',
      view: null,
      tokens: [],
      missing: [],
    };
  }
  const bridge = window.crt;
  if (!bridge) {
    return { ok: false, message: 'No app bridge.', view: null, tokens: [], missing: [] };
  }

  const status = await bridge.cardDb.status().catch(() => null);
  if (!status || status.state === 'absent') {
    return {
      ok: false,
      message:
        'No card database yet. Open the Card database screen and download it (about 77 MB, once).',
      view: null,
      tokens: [],
      missing: [],
    };
  }

  const count = Math.min(4, Math.max(2, opts.seats ?? 4));
  const seats: SeatSpec[] = [];
  const missing: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `p${i + 1}`;
    const deckId = opts.deckIds?.[i] ?? null;
    if (deckId) {
      const deck = await bridge.decks.get(deckId);
      if (deck) {
        const built = await seatFromDeck(id, seatName(i), deck, resolver);
        seats.push(built.seat);
        missing.push(...built.missing);
        continue;
      }
    }
    seats.push(await starterSeat(id, seatName(i), i, resolver));
  }

  const empty = seats.find((s) => s.library.length < 10);
  if (empty) {
    return {
      ok: false,
      message: `${empty.name} has only ${empty.library.length} resolvable cards — the card database may still be building.`,
      view: null,
      tokens: [],
      missing,
    };
  }

  const tokens = await loadTokens();
  const seed = opts.seed ?? `solo-${seats.length}-${seats.map((s) => s.library.length).join('-')}`;
  const info = await bridge.app.info().catch(() => null);
  // ⚠️ A solo game is a real host with a real client per seat, over loopback
  // pairs (see `session.ts`). It is not a different code path from a networked
  // game — it is the same one with the sockets removed.
  const view = session.startLocal({
    spec: startSpec(seats, tokens, seed),
    oracleVersion: await oracleVersion(),
    appVersion: info?.version ?? '0.0.0',
  });

  // Art for everything in play, so the table is not a wall of synthetic faces.
  const ids = [...new Set(seats.flatMap((s) => [...s.commanders, ...s.library]).map((c) => c.scryfallId))];
  void bridge.images.prefetch(ids).catch(() => undefined);

  return {
    ok: true,
    message:
      missing.length > 0
        ? `Started. ${missing.length} card${missing.length === 1 ? '' : 's'} could not be resolved and were left out.`
        : 'Started.',
    view,
    tokens,
    missing,
  };
}
