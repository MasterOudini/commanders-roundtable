// `Charging Strifeknight` — Haste is the engine's; the tap and a discarded
// card of my choice (D286) buy a card.

import { CHARGING_STRIFEKNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHARGING_STRIFEKNIGHT, 'Haste\n{T}, Discard a card: Draw a card.');
const DRAW = PRINTED.split('\n')[1] as string;

export const CHARGING_STRIFEKNIGHT_SCRIPT: CardScript = {
  oracleId: CHARGING_STRIFEKNIGHT.oracleId,
  name: CHARGING_STRIFEKNIGHT.name,
  activated: [
    {
      ref: `${CHARGING_STRIFEKNIGHT.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
