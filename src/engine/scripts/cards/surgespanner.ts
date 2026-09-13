// `Surgespanner` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SURGESPANNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SURGESPANNER, "Whenever this creature becomes tapped, you may pay {1}{U}. If you do, return target permanent to its owner's hand.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}{U}. If you do, return target permanent to its owner's hand.", SURGESPANNER.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}{U}. If you do, return target permanent to its owner's hand.");

export const SURGESPANNER_SCRIPT: CardScript = {
  oracleId: SURGESPANNER.oracleId,
  name: SURGESPANNER.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Surgespanner - You may pay {1}{U}. If you do, return target permanent to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
