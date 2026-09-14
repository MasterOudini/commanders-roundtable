// `Soratami Mindsweeper` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SORATAMI_MINDSWEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SORATAMI_MINDSWEEPER, "Flying\n{2}, Return a land you control to its owner's hand: Target player mills two cards.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player mills two cards.", SORATAMI_MINDSWEEPER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player mills two cards.");

export const SORATAMI_MINDSWEEPER_SCRIPT: CardScript = {
  oracleId: SORATAMI_MINDSWEEPER.oracleId,
  name: SORATAMI_MINDSWEEPER.name,
  activated: [
    {
      ref: `${SORATAMI_MINDSWEEPER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
