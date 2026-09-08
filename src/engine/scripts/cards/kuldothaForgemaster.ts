// `Kuldotha Forgemaster` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KULDOTHA_FORGEMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KULDOTHA_FORGEMASTER, "{T}, Sacrifice three artifacts: Search your library for an artifact card, put it onto the battlefield, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for an artifact card, put it onto the battlefield, then shuffle.", KULDOTHA_FORGEMASTER.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for an artifact card, put it onto the battlefield, then shuffle.");

export const KULDOTHA_FORGEMASTER_SCRIPT: CardScript = {
  oracleId: KULDOTHA_FORGEMASTER.oracleId,
  name: KULDOTHA_FORGEMASTER.name,
  activated: [
    {
      ref: `${KULDOTHA_FORGEMASTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
