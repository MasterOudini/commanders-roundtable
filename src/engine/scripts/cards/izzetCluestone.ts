// `Izzet Cluestone` — "{T}: Add {U} or {R}.\n{U}{R}, {T}, Sacrifice this
// artifact: Draw a card." The FIFTH Cluestone: the mana line is the
// engine's, the def owes line 1. M6.4z, D182.

import { IZZET_CLUESTONE } from '../../../data/fixtures/engineCards';
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
  IZZET_CLUESTONE,
  '{T}: Add {U} or {R}.\n{U}{R}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const IZZET_CLUESTONE_SCRIPT: CardScript = {
  oracleId: IZZET_CLUESTONE.oracleId,
  name: IZZET_CLUESTONE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${IZZET_CLUESTONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
