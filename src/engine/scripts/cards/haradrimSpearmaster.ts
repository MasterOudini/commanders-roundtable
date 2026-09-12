// `Haradrim Spearmaster` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARADRIM_SPEARMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARADRIM_SPEARMASTER, "Reach\nAt the beginning of combat on your turn, another target creature you control gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target creature you control gets +1/+0 until end of turn.", HARADRIM_SPEARMASTER.name);
const VOCAB_T_L1 = vocabularyTargets("Another target creature you control gets +1/+0 until end of turn.");

export const HARADRIM_SPEARMASTER_SCRIPT: CardScript = {
  oracleId: HARADRIM_SPEARMASTER.oracleId,
  name: HARADRIM_SPEARMASTER.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Haradrim Spearmaster - Another target creature you control gets +1/+0 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
