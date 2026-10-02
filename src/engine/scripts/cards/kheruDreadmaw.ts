// `Kheru Dreadmaw` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KHERU_DREADMAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KHERU_DREADMAW, "Defender\n{1}{G}, Sacrifice another creature: You gain life equal to the sacrificed creature's toughness.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You gain life equal to the sacrificed creature's toughness.", KHERU_DREADMAW.name);
const VOCAB_T_A0 = vocabularyTargets("You gain life equal to the sacrificed creature's toughness.");

export const KHERU_DREADMAW_SCRIPT: CardScript = {
  oracleId: KHERU_DREADMAW.oracleId,
  name: KHERU_DREADMAW.name,
  activated: [
    {
      ref: `${KHERU_DREADMAW.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
