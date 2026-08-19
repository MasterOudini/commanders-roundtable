// `Meditation Pools` — Land, "This land enters tapped.\n{T}: Add {G} or
// {U}.\n{4}, {T}, Sacrifice this land: Draw a card." Foggy Bottom Swamp's
// three lines in Simic: enters-tapped is D134's rule, the mana line the
// engine's, and the def owes line 2. M6.4ad, D186.

import { MEDITATION_POOLS } from '../../../data/fixtures/engineCards';
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
  MEDITATION_POOLS,
  'This land enters tapped.\n{T}: Add {G} or {U}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const MEDITATION_POOLS_SCRIPT: CardScript = {
  oracleId: MEDITATION_POOLS.oracleId,
  name: MEDITATION_POOLS.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${MEDITATION_POOLS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
