// `Viashino Shanktail` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIASHINO_SHANKTAIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIASHINO_SHANKTAIL, "First strike\nBloodrush — {2}{R}, Discard this card: Target attacking creature gets +3/+1 and gains first strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target attacking creature gets +3/+1 and gains first strike until end of turn.", VIASHINO_SHANKTAIL.name);
const VOCAB_T_A0 = vocabularyTargets("Target attacking creature gets +3/+1 and gains first strike until end of turn.");

export const VIASHINO_SHANKTAIL_SCRIPT: CardScript = {
  oracleId: VIASHINO_SHANKTAIL.oracleId,
  name: VIASHINO_SHANKTAIL.name,
  activated: [
    {
      ref: `${VIASHINO_SHANKTAIL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
