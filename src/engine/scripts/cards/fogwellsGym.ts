// `Fogwell's Gym` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOGWELL_S_GYM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOGWELL_S_GYM, "{T}: Add {R}. This land deals 1 damage to you.\n{2}{R}, {T}, Discard a card: Draw a card.");
const LINES = PRINTED.split('\n');

export const FOGWELLS_GYM_SCRIPT: CardScript = {
  oracleId: FOGWELL_S_GYM.oracleId,
  name: FOGWELL_S_GYM.name,
  activated: [
    {
      ref: `${FOGWELL_S_GYM.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
