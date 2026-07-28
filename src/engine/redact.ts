// `redactEvent` — the last gate before an event becomes an animation cue.
//
// ⚠️ THE SECOND HALF OF THE HIDDEN-INFORMATION BOUNDARY. `project.ts` decides
// what a player may SEE; this file decides what a player may be TOLD HAPPENED.
// They are genuinely different questions: a projection describes the board now,
// while an event describes a transition, and a transition can name a card that
// is invisible at both ends of it. "Ada shuffled: c14, c9, c71, …" leaks a whole
// library through a stream the projection never touches.
//
// ⚠️ THIS RUNS FOR EVERY VIEWER, INCLUDING THE OWNER OF THE HIDDEN ZONE. A
// library is a count, full stop — for its owner too (see `project.ts`). The host
// process holds the shuffled order in memory and must not hand it to the host's
// own UI either, because the host's UI is just another client (spec §7.6).
//
// ⚠️ ADVISORY, NEVER AUTHORITATIVE (D-NET-1). A redacted event has had fields
// blanked, so it is NOT replayable — folding one back through `apply()` would
// produce a different state. Nothing does: the wire carries `EngineEvent` (the
// 21 animation cues from `src/view/types.ts`), never `EventBody`, so there is no
// path from a socket to the reducer at all. That is exactly why a bug here
// degrades an animation instead of desyncing a game.

import type { EventBody } from './types/events';
import type { PlayerId, ZoneRef } from './types/ids';

/**
 * A library is hidden from EVERYONE, including its owner.
 *
 * Every other zone is either public or already handled by `project()`: an
 * opponent's hand keeps its real instance ids on purpose (that is what lets the
 * table animate *that specific* card back leaving the hand), and a face-down
 * permanent is a public object with a private identity.
 */
function isHiddenZone(zone: ZoneRef): boolean {
  return zone.kind === 'library';
}

/**
 * Strip everything `viewer` may not know from one event.
 *
 * Returns `null` for an event the viewer should not know happened at all.
 * Nothing currently returns null — every transition in this game is at least
 * *visible* even when its contents are not — but the signature keeps the option
 * open without a caller change, and the batch helper already tolerates it.
 *
 * ⚠️ NEVER drop a `Narrated`. `toViewEvents` locates each rendered log line by
 * counting the `Narrated` events in the batch it was handed and indexing back
 * from the end of `state.narration`; dropping one silently shifts every line in
 * that group onto the wrong text.
 *
 * ⚠️ NO `GameState` PARAMETER, unlike spec §7.3. Every rule below is decidable
 * from the event and the viewer alone, and a parameter nobody reads is an
 * invitation for a caller to pass the state from the wrong side of the batch —
 * which is a bug that would look like a redaction failure. Add it back the day
 * a rule genuinely needs the resulting board, and not before.
 */
export function redactEvent(body: EventBody, viewer: PlayerId): EventBody | null {
  switch (body.t) {
    // ⚠️ The seed reconstructs every shuffle this game will ever perform. Given
    // the seed and a decklist, a client could compute the order of its
    // opponents' libraries — the most valuable secret in the game, and one no
    // amount of care in `project()` would protect. The seed lives in the log
    // for replay, which is a host-side concern.
    case 'GameCreated':
      return body.seed === '' ? body : { ...body, seed: '' };

    // ⚠️ For EVERYONE, including `body.player`. See the file header.
    case 'LibraryShuffled':
      return body.order.length === 0 ? body : { ...body, order: [] };

    // The client already owns its own deck file; it does not need instance ids
    // for a zone it cannot see. Commanders survive: they start face up in the
    // command zone, which is public.
    case 'DeckLoaded':
      return body.cards.length === 0 ? body : { ...body, cards: [] };

    // A card revealed to someone else. The viewer learns a reveal happened —
    // the narration says so in words — but not which cards.
    case 'CardsRevealed':
      return body.to.includes(viewer) ? body : { ...body, cards: [] };

    // ⚠️ A move whose BOTH endpoints are hidden names an instance id inside a
    // zone the viewer cannot see into: the card-by-card moves a shuffle
    // performs, bottoming after a mulligan, a Tier-3 "put on the bottom". A
    // library→hand move is fine — the id becomes legitimately visible in the
    // destination hand, which is how the table animates that card.
    case 'CardsMoved': {
      const kept = body.moves.filter((m) => !(isHiddenZone(m.from) && isHiddenZone(m.to)));
      return kept.length === body.moves.length ? body : { ...body, moves: kept };
    }

    default:
      return body;
  }
}

/**
 * Redact a whole batch for one viewer, keeping `seq`/`stepId`/`cause` intact.
 *
 * Returns the SAME object for an event that needed no redaction, so the common
 * case allocates nothing — this runs once per viewer per batch, four times over
 * on a full table.
 */
export function redactBatch<T extends { readonly body: EventBody }>(
  events: readonly T[],
  viewer: PlayerId,
): T[] {
  const out: T[] = [];
  for (const event of events) {
    const body = redactEvent(event.body, viewer);
    if (body === null) continue;
    out.push(body === event.body ? event : { ...event, body });
  }
  return out;
}
