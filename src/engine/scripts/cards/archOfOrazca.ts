// `Arch of Orazca` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCH_OF_ORAZCA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCH_OF_ORAZCA, "Ascend (If you control ten or more permanents, you get the city's blessing for the rest of the game.)\n{T}: Add {C}.\n{5}, {T}: Draw a card. Activate only if you have the city's blessing.");
const LINES = PRINTED.split('\n');

export const ARCH_OF_ORAZCA_SCRIPT: CardScript = {
  oracleId: ARCH_OF_ORAZCA.oracleId,
  name: ARCH_OF_ORAZCA.name,
  activated: [
    {
      ref: `${ARCH_OF_ORAZCA.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
