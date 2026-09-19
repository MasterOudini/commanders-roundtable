// `Valor Singer` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VALOR_SINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VALOR_SINGER, "Combat Inspiration — At the beginning of combat on your turn, target creature you control gets +1/+0 until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature you control gets +1/+0 until end of turn.", VALOR_SINGER.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control gets +1/+0 until end of turn.");

export const VALOR_SINGER_SCRIPT: CardScript = {
  oracleId: VALOR_SINGER.oracleId,
  name: VALOR_SINGER.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Valor Singer - Target creature you control gets +1/+0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
