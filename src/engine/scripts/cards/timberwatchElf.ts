// `Timberwatch Elf` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TIMBERWATCH_ELF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TIMBERWATCH_ELF, "{T}: Target creature gets +X/+X until end of turn, where X is the number of Elves on the battlefield.");

const VOCAB_A0 = vocabularyEffects("Target creature gets +X/+X until end of turn, where X is the number of Elves on the battlefield.", TIMBERWATCH_ELF.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gets +X/+X until end of turn, where X is the number of Elves on the battlefield.");

export const TIMBERWATCH_ELF_SCRIPT: CardScript = {
  oracleId: TIMBERWATCH_ELF.oracleId,
  name: TIMBERWATCH_ELF.name,
  activated: [
    {
      ref: `${TIMBERWATCH_ELF.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
