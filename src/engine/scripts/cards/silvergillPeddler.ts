// `Silvergill Peddler` - a becomesTapped trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILVERGILL_PEDDLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILVERGILL_PEDDLER, "Whenever this creature becomes tapped, draw a card, then discard a card.");

export const SILVERGILL_PEDDLER_SCRIPT: CardScript = {
  oracleId: SILVERGILL_PEDDLER.oracleId,
  name: SILVERGILL_PEDDLER.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Silvergill Peddler - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Silvergill Peddler - discard a card" } },
        ];
      },
    },
  ],
};
