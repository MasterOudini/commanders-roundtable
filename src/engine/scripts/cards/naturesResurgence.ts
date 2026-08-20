// `Nature's Resurgence` — "Each player draws a card for each creature card
// in their graveyard." Martyr's Cry's per-seat fan over a graveyard type
// census: every count read from the CURRENT state first, then each seat's
// draws through THE one draw rule. D227.

import { NATURE_S_RESURGENCE } from '../../../data/fixtures/engineCards';
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
  NATURE_S_RESURGENCE,
  'Each player draws a card for each creature card in their graveyard.',
);

export const NATURES_RESURGENCE_SCRIPT: CardScript = {
  oracleId: NATURE_S_RESURGENCE.oracleId,
  name: NATURE_S_RESURGENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const counts = new Map<string, number>();
      for (const seat of ctx.state.seating) {
        const p = ctx.state.players[seat];
        if (!p || p.hasLost) continue;
        let n = 0;
        for (const id of ctx.state.zones.graveyard[seat] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card && ctx.oracle.byPrinting(card.printingId);
          if (oc && faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) n++;
        }
        if (n > 0) counts.set(seat, n);
      }
      const events: EventBody[] = [];
      for (const [seat, n] of counts) {
        events.push(...drawEvents(ctx.state, seat, n));
      }
      return events;
    },
  },
};
