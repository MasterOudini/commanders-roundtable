// `Rending Vines` — "Destroy target artifact or enchantment if its mana
// value is less than or equal to the number of cards in your hand.\nDraw a
// card." The condition is asked at resolution — the spell is on the stack,
// not in my hand, so the count is the cards still held — against the
// target's printed mana value (the oracle record's cmc). The draw comes
// either way. D279.

import { RENDING_VINES } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  RENDING_VINES,
  'Destroy target artifact or enchantment if its mana value is less than or equal to the number of cards in your hand.\nDraw a card.',
);

export const RENDING_VINES_SCRIPT: CardScript = {
  oracleId: RENDING_VINES.oracleId,
  name: RENDING_VINES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [];
      const oc = ctx.oracle.byPrinting(card.printingId);
      const manaValue = oc?.data.cmc ?? 0;
      const inHand = (ctx.state.zones.hand[obj.controller] ?? []).length;
      if (manaValue <= inHand && !ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
