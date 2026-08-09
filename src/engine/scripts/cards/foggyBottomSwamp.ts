// `Foggy Bottom Swamp` — Land, "This land enters tapped.\n{T}: Add {B} or
// {G}.\n{4}, {T}, Sacrifice this land: Draw a card." The Cluestone's
// sacrifice-draw on a LAND — enters-tapped is D134's rule, the mana line the
// engine's, and the def owes line 2. M6.4s, D175.

import { FOGGY_BOTTOM_SWAMP } from '../../../data/fixtures/engineCards';
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
  FOGGY_BOTTOM_SWAMP,
  'This land enters tapped.\n{T}: Add {B} or {G}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const FOGGY_BOTTOM_SWAMP_SCRIPT: CardScript = {
  oracleId: FOGGY_BOTTOM_SWAMP.oracleId,
  name: FOGGY_BOTTOM_SWAMP.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${FOGGY_BOTTOM_SWAMP.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
