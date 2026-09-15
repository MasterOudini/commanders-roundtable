// `Combat Courier` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COMBAT_COURIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COMBAT_COURIER, "{2}, Sacrifice this creature: Draw a card.\nUnearth {U} ({U}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const COMBAT_COURIER_SCRIPT: CardScript = {
  oracleId: COMBAT_COURIER.oracleId,
  name: COMBAT_COURIER.name,
  activated: [
    {
      ref: `${COMBAT_COURIER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
