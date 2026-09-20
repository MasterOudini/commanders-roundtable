// `Walking Atlas` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WALKING_ATLAS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WALKING_ATLAS, "{T}: You may put a land card from your hand onto the battlefield.");

const VOCAB_A0 = vocabularyEffects("You may put a land card from your hand onto the battlefield.", WALKING_ATLAS.name);
const VOCAB_T_A0 = vocabularyTargets("You may put a land card from your hand onto the battlefield.");

export const WALKING_ATLAS_SCRIPT: CardScript = {
  oracleId: WALKING_ATLAS.oracleId,
  name: WALKING_ATLAS.name,
  activated: [
    {
      ref: `${WALKING_ATLAS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
