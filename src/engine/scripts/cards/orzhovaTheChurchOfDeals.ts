// `Orzhova, the Church of Deals` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORZHOVA_THE_CHURCH_OF_DEALS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ORZHOVA_THE_CHURCH_OF_DEALS, "{T}: Add {C}.\n{3}{W}{B}, {T}: Target player loses 1 life and you gain 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target player loses 1 life and you gain 1 life.", ORZHOVA_THE_CHURCH_OF_DEALS.name);
const VOCAB_T_A1 = vocabularyTargets("Target player loses 1 life and you gain 1 life.");

export const ORZHOVA_THE_CHURCH_OF_DEALS_SCRIPT: CardScript = {
  oracleId: ORZHOVA_THE_CHURCH_OF_DEALS.oracleId,
  name: ORZHOVA_THE_CHURCH_OF_DEALS.name,
  activated: [
    {
      ref: `${ORZHOVA_THE_CHURCH_OF_DEALS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
