// `Botanical Plaza` — Land, "This land enters tapped.\n{T}: Add {G} or
// {W}.\n{2}{G}{W}, {T}, Sacrifice this land: Draw a card." Boiling Rock
// Prison's shape. M6.4h, D165.

import { BOTANICAL_PLAZA } from '../../../data/fixtures/engineCards';
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
  BOTANICAL_PLAZA,
  'This land enters tapped.\n{T}: Add {G} or {W}.\n{2}{G}{W}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const BOTANICAL_PLAZA_SCRIPT: CardScript = {
  oracleId: BOTANICAL_PLAZA.oracleId,
  name: BOTANICAL_PLAZA.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${BOTANICAL_PLAZA.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
