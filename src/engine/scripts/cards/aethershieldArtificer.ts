// `Aethershield Artificer` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AETHERSHIELD_ARTIFICER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AETHERSHIELD_ARTIFICER, "At the beginning of combat on your turn, target artifact creature you control gets +2/+2 and gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");

const VOCAB_L0 = vocabularyEffects("Target artifact creature you control gets +2/+2 and gains indestructible until end of turn.", AETHERSHIELD_ARTIFICER.name);
const VOCAB_T_L0 = vocabularyTargets("Target artifact creature you control gets +2/+2 and gains indestructible until end of turn.");

export const AETHERSHIELD_ARTIFICER_SCRIPT: CardScript = {
  oracleId: AETHERSHIELD_ARTIFICER.oracleId,
  name: AETHERSHIELD_ARTIFICER.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Aethershield Artificer - Target artifact creature you control gets +2/+2 and gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
