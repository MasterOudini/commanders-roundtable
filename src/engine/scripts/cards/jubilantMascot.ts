// `Jubilant Mascot` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JUBILANT_MASCOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JUBILANT_MASCOT, "At the beginning of combat on your turn, you may pay {3}{W}. If you do, support 2. (Put a +1/+1 counter on each of up to two other target creatures.)");

const VOCAB_L0 = vocabularyEffects("You may pay {3}{W}. If you do, support 2.", JUBILANT_MASCOT.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {3}{W}. If you do, support 2.");

export const JUBILANT_MASCOT_SCRIPT: CardScript = {
  oracleId: JUBILANT_MASCOT.oracleId,
  name: JUBILANT_MASCOT.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Jubilant Mascot - You may pay {3}{W}. If you do, support 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
