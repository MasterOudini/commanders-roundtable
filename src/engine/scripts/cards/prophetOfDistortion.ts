// `Prophet of Distortion` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROPHET_OF_DISTORTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROPHET_OF_DISTORTION, "Devoid (This card has no color.)\n{3}{C}: Draw a card. ({C} represents colorless mana.)");
const LINES = PRINTED.split('\n');

export const PROPHET_OF_DISTORTION_SCRIPT: CardScript = {
  oracleId: PROPHET_OF_DISTORTION.oracleId,
  name: PROPHET_OF_DISTORTION.name,
  activated: [
    {
      ref: `${PROPHET_OF_DISTORTION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
