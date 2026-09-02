// `Cremate` — "Exile target card from a graveyard.\nDraw a card." Noxious
// Revival's any-graveyard aim (D229) with an exile move instead of a
// placement, then the draw. The graveyard's owner is read off the card's
// zone, the exile goes to the card's owner. D274.

import { CREMATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CREMATE, 'Exile target card from a graveyard.\nDraw a card.');

export const CREMATE_SCRIPT: CardScript = {
  oracleId: CREMATE.oracleId,
  name: CREMATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      return [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: card.zone.player },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
        ...drawEvents(ctx.state, obj.controller, 1),
      ];
    },
  },
};
