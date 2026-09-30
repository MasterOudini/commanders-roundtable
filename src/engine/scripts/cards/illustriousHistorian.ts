// `Illustrious Historian` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ILLUSTRIOUS_HISTORIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ILLUSTRIOUS_HISTORIAN, "{5}, Exile this card from your graveyard: Create a tapped 3/2 red and white Spirit creature token.");

const VOCAB_A0 = vocabularyEffects("Create a tapped 3/2 red and white Spirit creature token.", ILLUSTRIOUS_HISTORIAN.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 3/2 red and white Spirit creature token.");

export const ILLUSTRIOUS_HISTORIAN_SCRIPT: CardScript = {
  oracleId: ILLUSTRIOUS_HISTORIAN.oracleId,
  name: ILLUSTRIOUS_HISTORIAN.name,
  activated: [
    {
      ref: `${ILLUSTRIOUS_HISTORIAN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
