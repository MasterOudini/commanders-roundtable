// `Slimy Dualleech` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLIMY_DUALLEECH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLIMY_DUALLEECH, "At the beginning of combat on your turn, target creature you control with power 2 or less gets +1/+0 and gains deathtouch until end of turn.");

const VOCAB_L0 = vocabularyEffects("Target creature you control with power 2 or less gets +1/+0 and gains deathtouch until end of turn.", SLIMY_DUALLEECH.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control with power 2 or less gets +1/+0 and gains deathtouch until end of turn.");

export const SLIMY_DUALLEECH_SCRIPT: CardScript = {
  oracleId: SLIMY_DUALLEECH.oracleId,
  name: SLIMY_DUALLEECH.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Slimy Dualleech - Target creature you control with power 2 or less gets +1/+0 and gains deathtouch until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
