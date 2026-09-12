// `Count on Luck` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COUNT_ON_LUCK } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(COUNT_ON_LUCK, "At the beginning of your upkeep, exile the top card of your library. You may play that card this turn.");

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", COUNT_ON_LUCK.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

export const COUNT_ON_LUCK_SCRIPT: CardScript = {
  oracleId: COUNT_ON_LUCK.oracleId,
  name: COUNT_ON_LUCK.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Count on Luck - Exile the top card of your library. You may play that card this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
