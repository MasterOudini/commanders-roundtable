// `Heir of Falkenrath // Heir to the Night` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT, "Discard a card: Transform this creature. Activate only once each turn.\nFlying");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");

export const HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT_SCRIPT: CardScript = {
  oracleId: HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT.oracleId,
  name: HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT.name,
  activated: [
    {
      ref: `${HEIR_OF_FALKENRATH_HEIR_TO_THE_NIGHT.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
