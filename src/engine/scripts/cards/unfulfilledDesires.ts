// `Unfulfilled Desires` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNFULFILLED_DESIRES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNFULFILLED_DESIRES, "{1}, Pay 1 life: Draw a card, then discard a card.");

export const UNFULFILLED_DESIRES_SCRIPT: CardScript = {
  oracleId: UNFULFILLED_DESIRES.oracleId,
  name: UNFULFILLED_DESIRES.name,
  activated: [
    {
      ref: `${UNFULFILLED_DESIRES.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Unfulfilled Desires - discard a card" } },
        ];
      },
    },
  ],
};
