// `Seeker of Insight` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEEKER_OF_INSIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEEKER_OF_INSIGHT, "{T}: Draw a card, then discard a card. Activate only if you've cast a noncreature spell this turn.");

export const SEEKER_OF_INSIGHT_SCRIPT: CardScript = {
  oracleId: SEEKER_OF_INSIGHT.oracleId,
  name: SEEKER_OF_INSIGHT.name,
  activated: [
    {
      ref: `${SEEKER_OF_INSIGHT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Seeker of Insight - discard a card" } },
        ];
      },
    },
  ],
};
