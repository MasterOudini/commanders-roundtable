// `Benevolent Ancestor` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BENEVOLENT_ANCESTOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BENEVOLENT_ANCESTOR, "Defender (This creature can't attack.)\n{T}: Prevent the next 1 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", BENEVOLENT_ANCESTOR.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

export const BENEVOLENT_ANCESTOR_SCRIPT: CardScript = {
  oracleId: BENEVOLENT_ANCESTOR.oracleId,
  name: BENEVOLENT_ANCESTOR.name,
  activated: [
    {
      ref: `${BENEVOLENT_ANCESTOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
