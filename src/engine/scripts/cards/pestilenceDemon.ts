// `Pestilence Demon` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PESTILENCE_DEMON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PESTILENCE_DEMON, "Flying\n{B}: This creature deals 1 damage to each creature and each player.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to each creature and each player.", PESTILENCE_DEMON.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to each creature and each player.");

export const PESTILENCE_DEMON_SCRIPT: CardScript = {
  oracleId: PESTILENCE_DEMON.oracleId,
  name: PESTILENCE_DEMON.name,
  activated: [
    {
      ref: `${PESTILENCE_DEMON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
