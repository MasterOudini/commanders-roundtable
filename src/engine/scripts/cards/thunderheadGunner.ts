// `Thunderhead Gunner` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THUNDERHEAD_GUNNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THUNDERHEAD_GUNNER, "Reach\nDiscard a card: Draw a card. Activate only as a sorcery and only once each turn.");
const LINES = PRINTED.split('\n');

export const THUNDERHEAD_GUNNER_SCRIPT: CardScript = {
  oracleId: THUNDERHEAD_GUNNER.oracleId,
  name: THUNDERHEAD_GUNNER.name,
  activated: [
    {
      ref: `${THUNDERHEAD_GUNNER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
