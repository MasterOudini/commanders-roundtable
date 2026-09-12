// `Temur Sabertooth` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEMUR_SABERTOOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEMUR_SABERTOOTH, "{1}{G}: You may return another creature you control to its owner's hand. If you do, this creature gains indestructible until end of turn.");

const VOCAB_A0 = vocabularyEffects("You may return another creature you control to its owner's hand. If you do, this creature gains indestructible until end of turn.", TEMUR_SABERTOOTH.name);
const VOCAB_T_A0 = vocabularyTargets("You may return another creature you control to its owner's hand. If you do, this creature gains indestructible until end of turn.");

export const TEMUR_SABERTOOTH_SCRIPT: CardScript = {
  oracleId: TEMUR_SABERTOOTH.oracleId,
  name: TEMUR_SABERTOOTH.name,
  activated: [
    {
      ref: `${TEMUR_SABERTOOTH.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
