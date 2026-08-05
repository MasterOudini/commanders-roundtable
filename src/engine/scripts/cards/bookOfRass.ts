// `Book of Rass` — "{2}, Pay 2 life: Draw a card." The first FIXED life
// activation cost a shipped def charges: `parseWardLife` set the payable-life
// precedent in M5 and the payment problem carries a life component, so the
// engine charges {2} and the 2 life; the def owes the draw. No {T}, so it is
// repeatable within a turn. M6.4h, D165.

import { BOOK_OF_RASS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BOOK_OF_RASS, '{2}, Pay 2 life: Draw a card.');

export const BOOK_OF_RASS_SCRIPT: CardScript = {
  oracleId: BOOK_OF_RASS.oracleId,
  name: BOOK_OF_RASS.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BOOK_OF_RASS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
