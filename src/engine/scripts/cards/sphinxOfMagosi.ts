// `Sphinx of Magosi` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPHINX_OF_MAGOSI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPHINX_OF_MAGOSI, "Flying\n{2}{U}: Draw a card, then put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Draw a card, then put a +1/+1 counter on ~.", SPHINX_OF_MAGOSI.name);
const VOCAB_T_A0 = vocabularyTargets("Draw a card, then put a +1/+1 counter on ~.");

export const SPHINX_OF_MAGOSI_SCRIPT: CardScript = {
  oracleId: SPHINX_OF_MAGOSI.oracleId,
  name: SPHINX_OF_MAGOSI.name,
  activated: [
    {
      ref: `${SPHINX_OF_MAGOSI.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
