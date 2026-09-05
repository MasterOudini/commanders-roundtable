// `Soothsayer Adept` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOOTHSAYER_ADEPT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOOTHSAYER_ADEPT, "{1}{U}, {T}: Draw a card, then discard a card.");

export const SOOTHSAYER_ADEPT_SCRIPT: CardScript = {
  oracleId: SOOTHSAYER_ADEPT.oracleId,
  name: SOOTHSAYER_ADEPT.name,
  activated: [
    {
      ref: `${SOOTHSAYER_ADEPT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Soothsayer Adept - discard a card" } },
        ];
      },
    },
  ],
};
