// `Vorel of the Hull Clade` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOREL_OF_THE_HULL_CLADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOREL_OF_THE_HULL_CLADE, "{G}{U}, {T}: Double the number of each kind of counter on target artifact, creature, or land.");

const VOCAB_A0 = vocabularyEffects("Double the number of each kind of counter on target artifact, creature, or land.", VOREL_OF_THE_HULL_CLADE.name);
const VOCAB_T_A0 = vocabularyTargets("Double the number of each kind of counter on target artifact, creature, or land.");

export const VOREL_OF_THE_HULL_CLADE_SCRIPT: CardScript = {
  oracleId: VOREL_OF_THE_HULL_CLADE.oracleId,
  name: VOREL_OF_THE_HULL_CLADE.name,
  activated: [
    {
      ref: `${VOREL_OF_THE_HULL_CLADE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
