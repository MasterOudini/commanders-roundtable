// `Soratami Cloudskater` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SORATAMI_CLOUDSKATER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SORATAMI_CLOUDSKATER, "Flying\n{2}, Return a land you control to its owner's hand: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const SORATAMI_CLOUDSKATER_SCRIPT: CardScript = {
  oracleId: SORATAMI_CLOUDSKATER.oracleId,
  name: SORATAMI_CLOUDSKATER.name,
  activated: [
    {
      ref: `${SORATAMI_CLOUDSKATER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Soratami Cloudskater - discard a card" } },
        ];
      },
    },
  ],
};
