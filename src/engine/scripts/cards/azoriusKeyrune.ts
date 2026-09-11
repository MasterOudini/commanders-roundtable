// `Azorius Keyrune` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AZORIUS_KEYRUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AZORIUS_KEYRUNE, "{T}: Add {W} or {U}.\n{W}{U}: This artifact becomes a 2/2 white and blue Bird artifact creature with flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/2 white and blue Bird artifact creature with flying until end of turn.", AZORIUS_KEYRUNE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/2 white and blue Bird artifact creature with flying until end of turn.");

export const AZORIUS_KEYRUNE_SCRIPT: CardScript = {
  oracleId: AZORIUS_KEYRUNE.oracleId,
  name: AZORIUS_KEYRUNE.name,
  activated: [
    {
      ref: `${AZORIUS_KEYRUNE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
