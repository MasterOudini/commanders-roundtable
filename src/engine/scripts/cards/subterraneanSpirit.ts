// `Subterranean Spirit` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUBTERRANEAN_SPIRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUBTERRANEAN_SPIRIT, "Protection from red\n{T}: This creature deals 1 damage to each creature without flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature without flying.", SUBTERRANEAN_SPIRIT.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature without flying.");

export const SUBTERRANEAN_SPIRIT_SCRIPT: CardScript = {
  oracleId: SUBTERRANEAN_SPIRIT.oracleId,
  name: SUBTERRANEAN_SPIRIT.name,
  activated: [
    {
      ref: `${SUBTERRANEAN_SPIRIT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
