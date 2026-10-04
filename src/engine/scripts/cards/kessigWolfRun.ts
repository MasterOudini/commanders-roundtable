// `Kessig Wolf Run` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KESSIG_WOLF_RUN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KESSIG_WOLF_RUN, "{T}: Add {C}.\n{X}{R}{G}, {T}: Target creature gets +X/+0 and gains trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature gets +X/+0 and gains trample until end of turn.", KESSIG_WOLF_RUN.name, { xCost: true });
const VOCAB_T_A1 = vocabularyTargets("Target creature gets +X/+0 and gains trample until end of turn.");

export const KESSIG_WOLF_RUN_SCRIPT: CardScript = {
  oracleId: KESSIG_WOLF_RUN.oracleId,
  name: KESSIG_WOLF_RUN.name,
  activated: [
    {
      ref: `${KESSIG_WOLF_RUN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
