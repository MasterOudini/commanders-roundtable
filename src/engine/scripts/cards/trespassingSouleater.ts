// `Trespassing Souleater` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRESPASSING_SOULEATER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRESPASSING_SOULEATER, "{U/P}: This creature can't be blocked this turn. ({U/P} can be paid with either {U} or 2 life.)");

const VOCAB_A0 = vocabularyEffects("~ can't be blocked this turn.", TRESPASSING_SOULEATER.name);
const VOCAB_T_A0 = vocabularyTargets("~ can't be blocked this turn.");

export const TRESPASSING_SOULEATER_SCRIPT: CardScript = {
  oracleId: TRESPASSING_SOULEATER.oracleId,
  name: TRESPASSING_SOULEATER.name,
  activated: [
    {
      ref: `${TRESPASSING_SOULEATER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
