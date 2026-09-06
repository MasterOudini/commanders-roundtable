// `Red Herring` - a static mustAttack, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RED_HERRING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RED_HERRING, "Haste\nThis creature attacks each combat if able.\n{2}, Sacrifice this creature: Draw a card.");
const LINES = PRINTED.split('\n');

export const RED_HERRING_SCRIPT: CardScript = {
  oracleId: RED_HERRING.oracleId,
  name: RED_HERRING.name,
  activated: [
    {
      ref: `${RED_HERRING.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  combat: [
    {
      abilityId: 'mustAttack-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      mustAttack: (_ctx, self, candidate) => candidate === self,
    },
  ],
};
