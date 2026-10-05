// `Knight of Dawn` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_DAWN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_DAWN, "First strike\n{W}{W}: This creature gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gains protection from the color of your choice until end of turn.", KNIGHT_OF_DAWN.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains protection from the color of your choice until end of turn.");

export const KNIGHT_OF_DAWN_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_DAWN.oracleId,
  name: KNIGHT_OF_DAWN.name,
  activated: [
    {
      ref: `${KNIGHT_OF_DAWN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
