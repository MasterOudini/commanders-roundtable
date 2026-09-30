// `Arnim Zola, Bio-Fanatic` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARNIM_ZOLA_BIO_FANATIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARNIM_ZOLA_BIO_FANATIC, "{3}, {T}: Create a tapped 2/1 black Villain creature token with menace. Activate only if there are two or more creature cards in your graveyard. (It can't be blocked except by two or more creatures.)");

const VOCAB_A0 = vocabularyEffects("Create a tapped 2/1 black Villain creature token with menace.", ARNIM_ZOLA_BIO_FANATIC.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 2/1 black Villain creature token with menace.");

export const ARNIM_ZOLA_BIO_FANATIC_SCRIPT: CardScript = {
  oracleId: ARNIM_ZOLA_BIO_FANATIC.oracleId,
  name: ARNIM_ZOLA_BIO_FANATIC.name,
  activated: [
    {
      ref: `${ARNIM_ZOLA_BIO_FANATIC.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
