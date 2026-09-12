// `Loxodon Battle Priest` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOXODON_BATTLE_PRIEST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOXODON_BATTLE_PRIEST, "At the beginning of combat on your turn, put a +1/+1 counter on another target creature you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on another target creature you control.", LOXODON_BATTLE_PRIEST.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on another target creature you control.");

export const LOXODON_BATTLE_PRIEST_SCRIPT: CardScript = {
  oracleId: LOXODON_BATTLE_PRIEST.oracleId,
  name: LOXODON_BATTLE_PRIEST.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Loxodon Battle Priest - Put a +1/+1 counter on another target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
