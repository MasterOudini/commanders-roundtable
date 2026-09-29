// `Empress Galina` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMPRESS_GALINA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMPRESS_GALINA, "{U}{U}, {T}: Gain control of target legendary permanent. (This effect lasts indefinitely.)");

const VOCAB_A0 = vocabularyEffects("Gain control of target legendary permanent.", EMPRESS_GALINA.name);
const VOCAB_T_A0 = vocabularyTargets("Gain control of target legendary permanent.");

export const EMPRESS_GALINA_SCRIPT: CardScript = {
  oracleId: EMPRESS_GALINA.oracleId,
  name: EMPRESS_GALINA.name,
  activated: [
    {
      ref: `${EMPRESS_GALINA.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
