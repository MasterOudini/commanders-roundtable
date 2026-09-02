// `Fountain of Renewal` — "At the beginning of your upkeep, you gain 1
// life.\n{3}, Sacrifice this artifact: Draw a card." Nyx-Fleece Ram's upkeep
// gain (StepBegan, the controller's own upkeep) on an artifact, with the
// Cluestone sacrifice-draw (D163) as its way out. D275.

import { FOUNTAIN_OF_RENEWAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  FOUNTAIN_OF_RENEWAL,
  'At the beginning of your upkeep, you gain 1 life.\n{3}, Sacrifice this artifact: Draw a card.',
);
const UPKEEP = PRINTED.split('\n')[0] as string;
const DRAW = PRINTED.split('\n')[1] as string;

export const FOUNTAIN_OF_RENEWAL_SCRIPT: CardScript = {
  oracleId: FOUNTAIN_OF_RENEWAL.oracleId,
  name: FOUNTAIN_OF_RENEWAL.name,
  triggers: [
    {
      abilityId: 'upkeep-gain',
      text: UPKEEP,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Fountain of Renewal — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
  activated: [
    {
      ref: `${FOUNTAIN_OF_RENEWAL.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
