// `Grabby Giant // That's Mine` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRABBY_GIANT_THAT_S_MINE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(GRABBY_GIANT_THAT_S_MINE, "Reach\n{2}{R}, Sacrifice an artifact or land: Draw a card.\nCreate a Treasure token. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const GRABBY_GIANT_THATS_MINE_SCRIPT: CardScript = {
  oracleId: GRABBY_GIANT_THAT_S_MINE.oracleId,
  name: GRABBY_GIANT_THAT_S_MINE.name,
  activated: [
    {
      ref: `${GRABBY_GIANT_THAT_S_MINE.oracleId}#a0`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
