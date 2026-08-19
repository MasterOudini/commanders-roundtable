// `Mardu Banner` — "{T}: Add {R}, {W}, or {B}.\n{R}{W}{B}, {T}, Sacrifice
// this artifact: Draw a card." Jeskai Banner's three-colour sacrifice-draw in
// Mardu; the mana line is the engine's, the def owes line 2. M6.4ad, D186.

import { MARDU_BANNER } from '../../../data/fixtures/engineCards';
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
  MARDU_BANNER,
  '{T}: Add {R}, {W}, or {B}.\n{R}{W}{B}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MARDU_BANNER_SCRIPT: CardScript = {
  oracleId: MARDU_BANNER.oracleId,
  name: MARDU_BANNER.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${MARDU_BANNER.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
