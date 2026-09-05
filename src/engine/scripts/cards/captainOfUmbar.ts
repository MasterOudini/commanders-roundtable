// `Captain of Umbar` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTAIN_OF_UMBAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTAIN_OF_UMBAR, "{1}, {T}: Draw a card, then discard a card.");

export const CAPTAIN_OF_UMBAR_SCRIPT: CardScript = {
  oracleId: CAPTAIN_OF_UMBAR.oracleId,
  name: CAPTAIN_OF_UMBAR.name,
  activated: [
    {
      ref: `${CAPTAIN_OF_UMBAR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Captain of Umbar - discard a card" } },
        ];
      },
    },
  ],
};
