// `Aegis Automaton` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AEGIS_AUTOMATON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AEGIS_AUTOMATON, "{4}{W}: Return another target creature you control to its owner's hand.");

const VOCAB_A0 = vocabularyEffects("Return another target creature you control to its owner's hand.", AEGIS_AUTOMATON.name);
const VOCAB_T_A0 = vocabularyTargets("Return another target creature you control to its owner's hand.");

export const AEGIS_AUTOMATON_SCRIPT: CardScript = {
  oracleId: AEGIS_AUTOMATON.oracleId,
  name: AEGIS_AUTOMATON.name,
  activated: [
    {
      ref: `${AEGIS_AUTOMATON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
