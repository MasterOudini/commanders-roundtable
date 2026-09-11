// `Karn's Bastion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KARN_S_BASTION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KARN_S_BASTION, "{T}: Add {C}.\n{4}, {T}: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Proliferate.", KARN_S_BASTION.name);
const VOCAB_T_A1 = vocabularyTargets("Proliferate.");

export const KARNS_BASTION_SCRIPT: CardScript = {
  oracleId: KARN_S_BASTION.oracleId,
  name: KARN_S_BASTION.name,
  activated: [
    {
      ref: `${KARN_S_BASTION.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
