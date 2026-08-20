// `Baleful Stare` — "Target opponent reveals their hand. You draw a card for
// each Mountain and red card in it." A PUBLIC reveal (the card says
// "reveals", so everyone sees — Amnesia's idiom), then a computed draw: a
// card counts ONCE if it is a Mountain OR red, read off the oracle face
// (a hidden-zone card derives nothing). D199.

import { BALEFUL_STARE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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
  BALEFUL_STARE,
  'Target opponent reveals their hand. You draw a card for each Mountain and red card in it.',
);

export const BALEFUL_STARE_SCRIPT: CardScript = {
  oracleId: BALEFUL_STARE.oracleId,
  name: BALEFUL_STARE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const hand = ctx.state.zones.hand[target.id] ?? [];
      if (hand.length === 0) return [];
      const events: EventBody[] = [
        { t: 'CardsRevealed', cards: [...hand], to: [...ctx.state.seating] },
      ];
      let n = 0;
      for (const id of hand) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        if (!oc) continue;
        const face = faceOf(oc, card?.faceIndex ?? 0);
        if (face.typeLine.subtypes.includes('Mountain') || face.colors.includes('R')) n++;
      }
      if (n > 0) events.push(...drawEvents(ctx.state, obj.controller, n));
      return events;
    },
  },
};
