// `Tapestry of the Ages` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TAPESTRY_OF_THE_AGES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TAPESTRY_OF_THE_AGES, "{2}, {T}: Draw a card. Activate only if you've cast a noncreature spell this turn.");

export const TAPESTRY_OF_THE_AGES_SCRIPT: CardScript = {
  oracleId: TAPESTRY_OF_THE_AGES.oracleId,
  name: TAPESTRY_OF_THE_AGES.name,
  activated: [
    {
      ref: `${TAPESTRY_OF_THE_AGES.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
