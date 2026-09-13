// `Bringer of the White Dawn` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRINGER_OF_THE_WHITE_DAWN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRINGER_OF_THE_WHITE_DAWN, "You may pay {W}{U}{B}{R}{G} rather than pay this spell's mana cost.\nTrample\nAt the beginning of your upkeep, you may return target artifact card from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return target artifact card from your graveyard to the battlefield.", BRINGER_OF_THE_WHITE_DAWN.name);
const VOCAB_T_L2 = vocabularyTargets("Return target artifact card from your graveyard to the battlefield.");

export const BRINGER_OF_THE_WHITE_DAWN_SCRIPT: CardScript = {
  oracleId: BRINGER_OF_THE_WHITE_DAWN.oracleId,
  name: BRINGER_OF_THE_WHITE_DAWN.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Bringer of the White Dawn - Return target artifact card from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
