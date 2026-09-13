// `Elvish Eulogist` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELVISH_EULOGIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELVISH_EULOGIST, "Sacrifice this creature: You gain 1 life for each Elf card in your graveyard.");

const VOCAB_A0 = vocabularyEffects("You gain 1 life for each Elf card in your graveyard.", ELVISH_EULOGIST.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 1 life for each Elf card in your graveyard.");

export const ELVISH_EULOGIST_SCRIPT: CardScript = {
  oracleId: ELVISH_EULOGIST.oracleId,
  name: ELVISH_EULOGIST.name,
  activated: [
    {
      ref: `${ELVISH_EULOGIST.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
