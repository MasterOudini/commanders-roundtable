// `Sea Gate Wreckage` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEA_GATE_WRECKAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEA_GATE_WRECKAGE, "{T}: Add {C}. ({C} represents colorless mana.)\n{2}{C}, {T}: Draw a card. Activate only if you have no cards in hand.");
const LINES = PRINTED.split('\n');

export const SEA_GATE_WRECKAGE_SCRIPT: CardScript = {
  oracleId: SEA_GATE_WRECKAGE.oracleId,
  name: SEA_GATE_WRECKAGE.name,
  activated: [
    {
      ref: `${SEA_GATE_WRECKAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
