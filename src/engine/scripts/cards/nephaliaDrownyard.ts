// `Nephalia Drownyard` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEPHALIA_DROWNYARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEPHALIA_DROWNYARD, "{T}: Add {C}.\n{1}{U}{B}, {T}: Target player mills three cards.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target player mills three cards.", NEPHALIA_DROWNYARD.name);
const VOCAB_T_A1 = vocabularyTargets("Target player mills three cards.");

export const NEPHALIA_DROWNYARD_SCRIPT: CardScript = {
  oracleId: NEPHALIA_DROWNYARD.oracleId,
  name: NEPHALIA_DROWNYARD.name,
  activated: [
    {
      ref: `${NEPHALIA_DROWNYARD.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
