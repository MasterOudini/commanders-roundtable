// `Benalish Heralds` — "{3}{U}, {T}: Draw a card." One tap-cost ActivatedDef;
// the engine charges, the def draws. M6.4g, D164.

import { BENALISH_HERALDS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BENALISH_HERALDS, '{3}{U}, {T}: Draw a card.');

export const BENALISH_HERALDS_SCRIPT: CardScript = {
  oracleId: BENALISH_HERALDS.oracleId,
  name: BENALISH_HERALDS.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BENALISH_HERALDS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
