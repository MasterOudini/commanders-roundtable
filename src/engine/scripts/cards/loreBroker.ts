// `Lore Broker` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LORE_BROKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LORE_BROKER, "{T}: Each player draws a card, then discards a card.");

const VOCAB_A0 = vocabularyEffects("Each player draws a card, then discards a card.", LORE_BROKER.name);
const VOCAB_T_A0 = vocabularyTargets("Each player draws a card, then discards a card.");

export const LORE_BROKER_SCRIPT: CardScript = {
  oracleId: LORE_BROKER.oracleId,
  name: LORE_BROKER.name,
  activated: [
    {
      ref: `${LORE_BROKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
