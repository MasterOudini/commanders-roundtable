// `Peer Past the Veil` — "Discard your hand. Then draw X cards, where X is
// the number of card types among cards in your graveyard." The wheel with
// the census computed over graveyard-UNION-hand — the discarded cards are
// already in the graveyard when X is read, so counting both zones up
// front is exact without a scratch fold. D232.

import { PEER_PAST_THE_VEIL } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const TEXT = printed(
  PEER_PAST_THE_VEIL,
  'Discard your hand. Then draw X cards, where X is the number of card types among cards in your graveyard.',
);

export const PEER_PAST_THE_VEIL_SCRIPT: CardScript = {
  oracleId: PEER_PAST_THE_VEIL.oracleId,
  name: PEER_PAST_THE_VEIL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      const hand = ctx.state.zones.hand[obj.controller] ?? [];
      const grave = ctx.state.zones.graveyard[obj.controller] ?? [];
      const types = new Set<string>();
      for (const id of [...grave, ...hand]) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        for (const t of faceOf(oc, card.faceIndex ?? 0).typeLine.types) types.add(t);
      }
      const events: EventBody[] = [];
      if (hand.length > 0) {
        events.push({
          t: 'CardsMoved',
          moves: hand.map((id) => ({
            card: id,
            from: { kind: 'hand' as const, player: obj.controller },
            to: {
              kind: 'graveyard' as const,
              player: ctx.state.cards[id]?.owner ?? obj.controller,
            },
          })),
        });
      }
      if (types.size > 0) events.push(...drawEvents(ctx.state, obj.controller, types.size));
      return events;
    },
  },
};
