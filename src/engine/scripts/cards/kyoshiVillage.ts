// `Kyoshi Village` — Land, "This land enters tapped.\n{T}: Add {G} or
// {W}.\n{4}, {T}, Sacrifice this land: Draw a card." Foggy Bottom Swamp's
// exact shape in Selesnya colours. M6.4ab, D184.

import { KYOSHI_VILLAGE } from '../../../data/fixtures/engineCards';
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
  KYOSHI_VILLAGE,
  'This land enters tapped.\n{T}: Add {G} or {W}.\n{4}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const KYOSHI_VILLAGE_SCRIPT: CardScript = {
  oracleId: KYOSHI_VILLAGE.oracleId,
  name: KYOSHI_VILLAGE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${KYOSHI_VILLAGE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
