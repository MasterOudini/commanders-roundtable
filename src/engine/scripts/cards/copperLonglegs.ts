// `Copper Longlegs` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COPPER_LONGLEGS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COPPER_LONGLEGS, "Reach\n{1}{G}, Sacrifice this creature: Proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Proliferate.", COPPER_LONGLEGS.name);
const VOCAB_T_A0 = vocabularyTargets("Proliferate.");

export const COPPER_LONGLEGS_SCRIPT: CardScript = {
  oracleId: COPPER_LONGLEGS.oracleId,
  name: COPPER_LONGLEGS.name,
  activated: [
    {
      ref: `${COPPER_LONGLEGS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
