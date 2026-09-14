// `Mind's Eye` - a opponentDrawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIND_S_EYE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIND_S_EYE, "Whenever an opponent draws a card, you may pay {1}. If you do, draw a card.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, draw a card.", MIND_S_EYE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, draw a card.");

export const MINDS_EYE_SCRIPT: CardScript = {
  oracleId: MIND_S_EYE.oracleId,
  name: MIND_S_EYE.name,
  triggers: [
    {
      abilityId: 'opponentDrawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player !== ctx.query.controllerOf(self),
      label: () => "Mind's Eye - You may pay {1}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
