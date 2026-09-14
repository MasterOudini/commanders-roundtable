// `Malevolent Chandelier` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MALEVOLENT_CHANDELIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MALEVOLENT_CHANDELIER, "Flying\n{2}: Put target card from a graveyard on the bottom of its owner's library. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put target card from a graveyard on the bottom of its owner's library.", MALEVOLENT_CHANDELIER.name);
const VOCAB_T_A0 = vocabularyTargets("Put target card from a graveyard on the bottom of its owner's library.");

export const MALEVOLENT_CHANDELIER_SCRIPT: CardScript = {
  oracleId: MALEVOLENT_CHANDELIER.oracleId,
  name: MALEVOLENT_CHANDELIER.name,
  activated: [
    {
      ref: `${MALEVOLENT_CHANDELIER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
