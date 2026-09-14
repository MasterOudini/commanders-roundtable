// `Tower of Murmurs` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOWER_OF_MURMURS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOWER_OF_MURMURS, "{8}, {T}: Target player mills eight cards.");

const VOCAB_A0 = vocabularyEffects("Target player mills eight cards.", TOWER_OF_MURMURS.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills eight cards.");

export const TOWER_OF_MURMURS_SCRIPT: CardScript = {
  oracleId: TOWER_OF_MURMURS.oracleId,
  name: TOWER_OF_MURMURS.name,
  activated: [
    {
      ref: `${TOWER_OF_MURMURS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
