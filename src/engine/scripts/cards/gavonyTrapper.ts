// `Gavony Trapper` — "{2}, {T}: Tap target creature." The Benalish Trapper
// shape on a generic cost, with Auriok's guard: a turned target gets no
// event. M6.4t, D176.

import { GAVONY_TRAPPER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GAVONY_TRAPPER, '{2}, {T}: Tap target creature.');

export const GAVONY_TRAPPER_SCRIPT: CardScript = {
  oracleId: GAVONY_TRAPPER.oracleId,
  name: GAVONY_TRAPPER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GAVONY_TRAPPER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
