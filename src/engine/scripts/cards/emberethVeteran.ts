// `Embereth Veteran` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBERETH_VETERAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMBERETH_VETERAN, "{1}, Sacrifice this creature: Create a Young Hero Role token attached to another target creature. (If you control another Role on it, put that one into the graveyard. Enchanted creature has \"Whenever this creature attacks, if its toughness is 3 or less, put a +1/+1 counter on it.\")");

const VOCAB_A0 = vocabularyEffects("Create a Young Hero Role token attached to another target creature.", EMBERETH_VETERAN.name);
const VOCAB_T_A0 = vocabularyTargets("Create a Young Hero Role token attached to another target creature.");

export const EMBERETH_VETERAN_SCRIPT: CardScript = {
  oracleId: EMBERETH_VETERAN.oracleId,
  name: EMBERETH_VETERAN.name,
  activated: [
    {
      ref: `${EMBERETH_VETERAN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
