// `Emmessi Tome` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMMESSI_TOME } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMMESSI_TOME, "{5}, {T}: Draw two cards, then discard a card.");

const VOCAB_A0 = vocabularyEffects("Draw two cards, then discard a card.", EMMESSI_TOME.name);
const VOCAB_T_A0 = vocabularyTargets("Draw two cards, then discard a card.");

export const EMMESSI_TOME_SCRIPT: CardScript = {
  oracleId: EMMESSI_TOME.oracleId,
  name: EMMESSI_TOME.name,
  activated: [
    {
      ref: `${EMMESSI_TOME.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
