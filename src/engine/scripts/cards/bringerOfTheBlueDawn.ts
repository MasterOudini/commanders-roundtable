// `Bringer of the Blue Dawn` - a upkeep trigger drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRINGER_OF_THE_BLUE_DAWN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRINGER_OF_THE_BLUE_DAWN, "You may pay {W}{U}{B}{R}{G} rather than pay this spell's mana cost.\nTrample\nAt the beginning of your upkeep, you may draw two cards.");
const LINES = PRINTED.split('\n');

export const BRINGER_OF_THE_BLUE_DAWN_SCRIPT: CardScript = {
  oracleId: BRINGER_OF_THE_BLUE_DAWN.oracleId,
  name: BRINGER_OF_THE_BLUE_DAWN.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Bringer of the Blue Dawn - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
  ],
};
