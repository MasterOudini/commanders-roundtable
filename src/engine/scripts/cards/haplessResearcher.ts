// `Hapless Researcher` - an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAPLESS_RESEARCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAPLESS_RESEARCHER, "Sacrifice this creature: Draw a card, then discard a card.");

export const HAPLESS_RESEARCHER_SCRIPT: CardScript = {
  oracleId: HAPLESS_RESEARCHER.oracleId,
  name: HAPLESS_RESEARCHER.name,
  activated: [
    {
      ref: `${HAPLESS_RESEARCHER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Hapless Researcher - discard a card" } },
        ];
      },
    },
  ],
};
