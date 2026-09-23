// `Scroll of Fate` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCROLL_OF_FATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCROLL_OF_FATE, "{T}: Manifest a card from your hand. (Put that card onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it's a creature card.)");

const VOCAB_A0 = vocabularyEffects("Manifest a card from your hand.", SCROLL_OF_FATE.name);
const VOCAB_T_A0 = vocabularyTargets("Manifest a card from your hand.");

export const SCROLL_OF_FATE_SCRIPT: CardScript = {
  oracleId: SCROLL_OF_FATE.oracleId,
  name: SCROLL_OF_FATE.name,
  activated: [
    {
      ref: `${SCROLL_OF_FATE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
