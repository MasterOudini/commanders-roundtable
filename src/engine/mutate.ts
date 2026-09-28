// D581 - MUTATE (CR 702.140) and THE MERGED PERMANENT (CR 730).
//
// A mutating creature spell whose target is still legal as it resolves does not enter the battlefield: it MERGES with
// the target - over or under, its controller's choice (the `mutateOrder` prompt) - and the two are one object. That
// object is the TARGET's (CR 730.2: the same permanent - its counters, damage, attachments, combat and summoning
// sickness kept), represented by more than one card: `CardInstance.merged` lists them top to bottom, the host's own id
// among them, and every other card sits in the `merged` zone with `mergedInto` naming its host (in no zone array - the
// invariant checks the host holds it).
//
// Its characteristics are the TOP card's: a card merged over takes the host's identity fields, D486's clone mechanism
// (`original` keeps the host's own card, restored by the move that takes it off the battlefield). It has EVERY card's
// abilities (702.140e): the collectors that ask a permanent's own script walk `mergedScripts`, and layer 1 adds the under
// cards' printed abilities (`mergedUnder`). Leaving the battlefield, every card goes (730.3 - the reducer moves the rest
// with the host, each to its owner's zone of the same kind).
//
// ⚠️ An under card's ACTIVATED abilities are not offered: the activation indices are the top face's. Said plainly here
// rather than left to be found; the row maker refuses a mutate row that prints one.
import type { CardScript } from './scripts/api';
import type { InstanceId, OracleId, PrintingId } from './types/ids';
import type { CardInstance, GameState } from './types/state';

/** One card of a merged permanent: its own printing and face. */
export interface MergedPart {
  readonly oracleId: OracleId;
  readonly printingId: PrintingId;
  readonly faceIndex: number;
}

/** The cards a permanent is represented by, top to bottom - its own id alone when it is not merged. */
export function mergedCards(card: CardInstance): readonly InstanceId[] {
  return card.merged ?? [card.id];
}

/** One card of a merged permanent - the host's own card is its `original` once another card sits on top of it. */
function partOf(state: Pick<GameState, 'cards'>, host: CardInstance, id: InstanceId): MergedPart | null {
  if (id === host.id) {
    const covered = host.merged !== undefined && host.merged[0] !== host.id && host.original !== undefined;
    return covered && host.original !== undefined
      ? { oracleId: host.original.oracleId, printingId: host.original.printingId, faceIndex: 0 }
      : { oracleId: host.oracleId, printingId: host.printingId, faceIndex: host.faceIndex };
  }
  const c = state.cards[id];
  return c ? { oracleId: c.oracleId, printingId: c.printingId, faceIndex: c.faceIndex } : null;
}

/**
 * The cards merged UNDER the top one, each with its printing and face - empty for a permanent that is not merged. The
 * top card's printing is the host's identity, which every reader already asks.
 */
export function mergedUnder(state: Pick<GameState, 'cards'>, host: CardInstance): readonly MergedPart[] {
  if (host.merged === undefined) return [];
  const out: MergedPart[] = [];
  for (const id of host.merged.slice(1)) {
    const p = partOf(state, host, id);
    if (p) out.push(p);
  }
  return out;
}

/**
 * The scripts a permanent carries, each with the face its defs are asked on: its own (the top card's), then every card
 * merged under it (CR 702.140e). A permanent that is not merged carries its own alone - the walk the collectors always
 * ran, in the same order. `own` tells a collector which one keys its uses by the bare ability id.
 */
export function mergedScripts(
  scripts: { get(oracleId: OracleId): CardScript | undefined },
  state: Pick<GameState, 'cards'>,
  card: CardInstance,
): readonly { readonly script: CardScript; readonly faceIndex: number; readonly own: boolean }[] {
  const own = scripts.get(card.oracleId);
  const out: { script: CardScript; faceIndex: number; own: boolean }[] = own ? [{ script: own, faceIndex: card.faceIndex, own: true }] : [];
  if (card.merged === undefined) return out;
  for (const p of mergedUnder(state, card)) {
    const s = scripts.get(p.oracleId);
    if (s) out.push({ script: s, faceIndex: p.faceIndex, own: false });
  }
  return out;
}
