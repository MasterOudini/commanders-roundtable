// `Simic Keyrune` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIMIC_KEYRUNE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIMIC_KEYRUNE, "{T}: Add {G} or {U}.\n{G}{U}: This artifact becomes a 2/3 green and blue Crab artifact creature with hexproof until end of turn. (It can't be the target of spells or abilities your opponents control.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 2/3 green and blue Crab artifact creature with hexproof until end of turn.", SIMIC_KEYRUNE.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 2/3 green and blue Crab artifact creature with hexproof until end of turn.");

export const SIMIC_KEYRUNE_SCRIPT: CardScript = {
  oracleId: SIMIC_KEYRUNE.oracleId,
  name: SIMIC_KEYRUNE.name,
  activated: [
    {
      ref: `${SIMIC_KEYRUNE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
