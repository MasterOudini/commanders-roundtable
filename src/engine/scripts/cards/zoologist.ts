// `Zoologist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZOOLOGIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZOOLOGIST, "{3}{G}, {T}: Reveal the top card of your library. If it's a creature card, put it onto the battlefield. Otherwise, put it into your graveyard.");

const VOCAB_A0 = vocabularyEffects("Reveal the top card of your library. If it's a creature card, put it onto the battlefield. Otherwise, put it into your graveyard.", ZOOLOGIST.name);
const VOCAB_T_A0 = vocabularyTargets("Reveal the top card of your library. If it's a creature card, put it onto the battlefield. Otherwise, put it into your graveyard.");

export const ZOOLOGIST_SCRIPT: CardScript = {
  oracleId: ZOOLOGIST.oracleId,
  name: ZOOLOGIST.name,
  activated: [
    {
      ref: `${ZOOLOGIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
