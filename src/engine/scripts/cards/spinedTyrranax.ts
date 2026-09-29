// `Spined Tyrranax` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPINED_TYRRANAX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPINED_TYRRANAX, "At the beginning of combat on your turn, you may pay {2}{G}. When you do, put a +1/+1 counter on target creature. That creature gains trample until end of turn. (It can deal excess combat damage to the player or planeswalker it's attacking.)");

const VOCAB_L0 = vocabularyEffects("You may pay {2}{G}. When you do, put a +1/+1 counter on target creature. That creature gains trample until end of turn.", SPINED_TYRRANAX.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}{G}. When you do, put a +1/+1 counter on target creature. That creature gains trample until end of turn.");

export const SPINED_TYRRANAX_SCRIPT: CardScript = {
  oracleId: SPINED_TYRRANAX.oracleId,
  name: SPINED_TYRRANAX.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Spined Tyrranax - You may pay {2}{G}. When you do, put a +1/+1 counter on target creature. That creature gains trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
