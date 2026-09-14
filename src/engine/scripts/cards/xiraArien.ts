// `Xira Arien` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { XIRA_ARIEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(XIRA_ARIEN, "Flying\n{B}{R}{G}, {T}: Target player draws a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player draws a card.", XIRA_ARIEN.name);
const VOCAB_T_A0 = vocabularyTargets("Target player draws a card.");

export const XIRA_ARIEN_SCRIPT: CardScript = {
  oracleId: XIRA_ARIEN.oracleId,
  name: XIRA_ARIEN.name,
  activated: [
    {
      ref: `${XIRA_ARIEN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
