// `Cephalid Coliseum` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CEPHALID_COLISEUM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CEPHALID_COLISEUM, "{T}: Add {U}. This land deals 1 damage to you.\nThreshold — {U}, {T}, Sacrifice this land: Target player draws three cards, then discards three cards. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target player draws three cards, then discards three cards.", CEPHALID_COLISEUM.name);
const VOCAB_T_A1 = vocabularyTargets("Target player draws three cards, then discards three cards.");

export const CEPHALID_COLISEUM_SCRIPT: CardScript = {
  oracleId: CEPHALID_COLISEUM.oracleId,
  name: CEPHALID_COLISEUM.name,
  activated: [
    {
      ref: `${CEPHALID_COLISEUM.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
