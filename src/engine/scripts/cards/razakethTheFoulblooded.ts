// `Razaketh, the Foulblooded` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAZAKETH_THE_FOULBLOODED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAZAKETH_THE_FOULBLOODED, "Flying, trample\nPay 2 life, Sacrifice another creature: Search your library for a card, put that card into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a card, put that card into your hand, then shuffle.", RAZAKETH_THE_FOULBLOODED.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card, put that card into your hand, then shuffle.");

export const RAZAKETH_THE_FOULBLOODED_SCRIPT: CardScript = {
  oracleId: RAZAKETH_THE_FOULBLOODED.oracleId,
  name: RAZAKETH_THE_FOULBLOODED.name,
  activated: [
    {
      ref: `${RAZAKETH_THE_FOULBLOODED.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
