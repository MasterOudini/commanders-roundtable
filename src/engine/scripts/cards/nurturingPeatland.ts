// `Nurturing Peatland` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NURTURING_PEATLAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NURTURING_PEATLAND, "{T}, Pay 1 life: Add {B} or {G}.\n{1}, {T}, Sacrifice this land: Draw a card.");
const LINES = PRINTED.split('\n');

export const NURTURING_PEATLAND_SCRIPT: CardScript = {
  oracleId: NURTURING_PEATLAND.oracleId,
  name: NURTURING_PEATLAND.name,
  activated: [
    {
      ref: `${NURTURING_PEATLAND.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
