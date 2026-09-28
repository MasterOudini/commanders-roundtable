// `Chosen of Markov // Markov's Servant` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHOSEN_OF_MARKOV_MARKOV_S_SERVANT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CHOSEN_OF_MARKOV_MARKOV_S_SERVANT, "{T}, Tap an untapped Vampire you control: Transform this creature.\n");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", CHOSEN_OF_MARKOV_MARKOV_S_SERVANT.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const CHOSEN_OF_MARKOV_MARKOVS_SERVANT_SCRIPT: CardScript = {
  oracleId: CHOSEN_OF_MARKOV_MARKOV_S_SERVANT.oracleId,
  name: CHOSEN_OF_MARKOV_MARKOV_S_SERVANT.name,
  activated: [
    {
      ref: `${CHOSEN_OF_MARKOV_MARKOV_S_SERVANT.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
