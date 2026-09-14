// `Ghoulcaller's Bell` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOULCALLER_S_BELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOULCALLER_S_BELL, "{T}: Each player mills a card.");

const VOCAB_A0 = vocabularyEffects("Each player mills a card.", GHOULCALLER_S_BELL.name);
const VOCAB_T_A0 = vocabularyTargets("Each player mills a card.");

export const GHOULCALLERS_BELL_SCRIPT: CardScript = {
  oracleId: GHOULCALLER_S_BELL.oracleId,
  name: GHOULCALLER_S_BELL.name,
  activated: [
    {
      ref: `${GHOULCALLER_S_BELL.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
