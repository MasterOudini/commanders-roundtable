// `Vanguard of the Rose` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VANGUARD_OF_THE_ROSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VANGUARD_OF_THE_ROSE, "{1}, Sacrifice another creature or artifact: This creature gains indestructible until end of turn. Tap it.");

const VOCAB_A0 = vocabularyEffects("~ gains indestructible until end of turn. Tap it.", VANGUARD_OF_THE_ROSE.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains indestructible until end of turn. Tap it.");

export const VANGUARD_OF_THE_ROSE_SCRIPT: CardScript = {
  oracleId: VANGUARD_OF_THE_ROSE.oracleId,
  name: VANGUARD_OF_THE_ROSE.name,
  activated: [
    {
      ref: `${VANGUARD_OF_THE_ROSE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
