// `Vessel of Paramnesia` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VESSEL_OF_PARAMNESIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VESSEL_OF_PARAMNESIA, "{U}, Sacrifice this enchantment: Target player mills three cards. Draw a card.");

const VOCAB_A0 = vocabularyEffects("Target player mills three cards. Draw a card.", VESSEL_OF_PARAMNESIA.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills three cards. Draw a card.");

export const VESSEL_OF_PARAMNESIA_SCRIPT: CardScript = {
  oracleId: VESSEL_OF_PARAMNESIA.oracleId,
  name: VESSEL_OF_PARAMNESIA.name,
  activated: [
    {
      ref: `${VESSEL_OF_PARAMNESIA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
