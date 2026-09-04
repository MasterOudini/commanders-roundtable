// `Saprazzan Heir` - a becomesBlocked trigger drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAPRAZZAN_HEIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAPRAZZAN_HEIR, "Whenever this creature becomes blocked, you may draw three cards.");

export const SAPRAZZAN_HEIR_SCRIPT: CardScript = {
  oracleId: SAPRAZZAN_HEIR.oracleId,
  name: SAPRAZZAN_HEIR.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self),
      label: () => "Saprazzan Heir - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 3);
      },
    },
  ],
};
