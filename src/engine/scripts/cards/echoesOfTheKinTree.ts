// `Echoes of the Kin Tree` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ECHOES_OF_THE_KIN_TREE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ECHOES_OF_THE_KIN_TREE, "{2}{W}: Bolster 1. (Choose a creature with the least toughness among creatures you control and put a +1/+1 counter on it.)");

const VOCAB_A0 = vocabularyEffects("Bolster 1.", ECHOES_OF_THE_KIN_TREE.name);
const VOCAB_T_A0 = vocabularyTargets("Bolster 1.");

export const ECHOES_OF_THE_KIN_TREE_SCRIPT: CardScript = {
  oracleId: ECHOES_OF_THE_KIN_TREE.oracleId,
  name: ECHOES_OF_THE_KIN_TREE.name,
  activated: [
    {
      ref: `${ECHOES_OF_THE_KIN_TREE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
