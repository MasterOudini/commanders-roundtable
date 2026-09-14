// `Drowner of Secrets` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DROWNER_OF_SECRETS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DROWNER_OF_SECRETS, "Tap an untapped Merfolk you control: Target player mills a card.");

const VOCAB_A0 = vocabularyEffects("Target player mills a card.", DROWNER_OF_SECRETS.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills a card.");

export const DROWNER_OF_SECRETS_SCRIPT: CardScript = {
  oracleId: DROWNER_OF_SECRETS.oracleId,
  name: DROWNER_OF_SECRETS.name,
  activated: [
    {
      ref: `${DROWNER_OF_SECRETS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
