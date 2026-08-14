// `Golgari Cluestone` — "{B}{G}, {T}, Sacrifice this artifact: Draw a card."
// The Cluestone pair's third colour pair; the mana line is ability 0.
// M6.4u, D177.

import { GOLGARI_CLUESTONE } from '../../../data/fixtures/engineCards';
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
  GOLGARI_CLUESTONE,
  '{T}: Add {B} or {G}.\n{B}{G}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GOLGARI_CLUESTONE_SCRIPT: CardScript = {
  oracleId: GOLGARI_CLUESTONE.oracleId,
  name: GOLGARI_CLUESTONE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the sacrifice-draw as 1.
      ref: `${GOLGARI_CLUESTONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
