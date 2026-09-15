// `Pitiless Horde` - a upkeep trigger loseLifeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PITILESS_HORDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PITILESS_HORDE, "At the beginning of your upkeep, you lose 2 life.\nDash {2}{B}{B} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)");
const LINES = PRINTED.split('\n');

export const PITILESS_HORDE_SCRIPT: CardScript = {
  oracleId: PITILESS_HORDE.oracleId,
  name: PITILESS_HORDE.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Pitiless Horde - loseLifeSelf",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 }];
      },
    },
  ],
};
