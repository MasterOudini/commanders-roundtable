// `Suspicious Bookcase` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUSPICIOUS_BOOKCASE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUSPICIOUS_BOOKCASE, "Defender\n{3}, {T}: Target creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", SUSPICIOUS_BOOKCASE.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const SUSPICIOUS_BOOKCASE_SCRIPT: CardScript = {
  oracleId: SUSPICIOUS_BOOKCASE.oracleId,
  name: SUSPICIOUS_BOOKCASE.name,
  activated: [
    {
      ref: `${SUSPICIOUS_BOOKCASE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
