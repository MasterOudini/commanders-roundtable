// `Infernal Idol` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INFERNAL_IDOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INFERNAL_IDOL, "{T}: Add {B}.\n{1}{B}{B}, {T}, Sacrifice this artifact: You draw two cards and you lose 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("You draw two cards and you lose 2 life.", INFERNAL_IDOL.name);
const VOCAB_T_A1 = vocabularyTargets("You draw two cards and you lose 2 life.");

export const INFERNAL_IDOL_SCRIPT: CardScript = {
  oracleId: INFERNAL_IDOL.oracleId,
  name: INFERNAL_IDOL.name,
  activated: [
    {
      ref: `${INFERNAL_IDOL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
