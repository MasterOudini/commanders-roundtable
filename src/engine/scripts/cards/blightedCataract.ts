// `Blighted Cataract` — "{T}: Add {C}.\n{5}{U}, {T}, Sacrifice this land:
// Draw two cards." Hedron Archive's shape on a land. M6.4g, D164.

import { BLIGHTED_CATARACT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  BLIGHTED_CATARACT,
  '{T}: Add {C}.\n{5}{U}, {T}, Sacrifice this land: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BLIGHTED_CATARACT_SCRIPT: CardScript = {
  oracleId: BLIGHTED_CATARACT.oracleId,
  name: BLIGHTED_CATARACT.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${BLIGHTED_CATARACT.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
