// `Watchful Naga` - a exertAttack trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WATCHFUL_NAGA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WATCHFUL_NAGA, "You may exert this creature as it attacks. When you do, draw a card. (An exerted creature won't untap during your next untap step.)");

export const WATCHFUL_NAGA_SCRIPT: CardScript = {
  oracleId: WATCHFUL_NAGA.oracleId,
  name: WATCHFUL_NAGA.name,
  triggers: [
    {
      abilityId: 'exertAttack-0',
      text: PRINTED,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Watchful Naga - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
