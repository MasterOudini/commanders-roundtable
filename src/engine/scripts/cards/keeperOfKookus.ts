// `Keeper of Kookus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KEEPER_OF_KOOKUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KEEPER_OF_KOOKUS, "{R}: This creature gains protection from red until end of turn.");

const VOCAB_A0 = vocabularyEffects("~ gains protection from red until end of turn.", KEEPER_OF_KOOKUS.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains protection from red until end of turn.");

export const KEEPER_OF_KOOKUS_SCRIPT: CardScript = {
  oracleId: KEEPER_OF_KOOKUS.oracleId,
  name: KEEPER_OF_KOOKUS.name,
  activated: [
    {
      ref: `${KEEPER_OF_KOOKUS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
