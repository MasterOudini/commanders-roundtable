// `Loyal Retainers` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOYAL_RETAINERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOYAL_RETAINERS, "Sacrifice this creature: Return target legendary creature card from your graveyard to the battlefield. Activate only during your turn, before attackers are declared.");

const VOCAB_A0 = vocabularyEffects("Return target legendary creature card from your graveyard to the battlefield.", LOYAL_RETAINERS.name);
const VOCAB_T_A0 = vocabularyTargets("Return target legendary creature card from your graveyard to the battlefield.");

export const LOYAL_RETAINERS_SCRIPT: CardScript = {
  oracleId: LOYAL_RETAINERS.oracleId,
  name: LOYAL_RETAINERS.name,
  activated: [
    {
      ref: `${LOYAL_RETAINERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
