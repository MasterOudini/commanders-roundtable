// `Hammerfist Giant` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAMMERFIST_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAMMERFIST_GIANT, "{T}: This creature deals 4 damage to each creature without flying and each player.");

const VOCAB_A0 = vocabularyEffects("~ deals 4 damage to each creature without flying and each player.", HAMMERFIST_GIANT.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 4 damage to each creature without flying and each player.");

export const HAMMERFIST_GIANT_SCRIPT: CardScript = {
  oracleId: HAMMERFIST_GIANT.oracleId,
  name: HAMMERFIST_GIANT.name,
  activated: [
    {
      ref: `${HAMMERFIST_GIANT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
