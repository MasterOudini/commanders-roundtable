// `Spiketail Drake` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIKETAIL_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIKETAIL_DRAKE, "Flying\nSacrifice this creature: Counter target spell unless its controller pays {3}.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Counter target spell unless its controller pays {3}.", SPIKETAIL_DRAKE.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target spell unless its controller pays {3}.");

export const SPIKETAIL_DRAKE_SCRIPT: CardScript = {
  oracleId: SPIKETAIL_DRAKE.oracleId,
  name: SPIKETAIL_DRAKE.name,
  activated: [
    {
      ref: `${SPIKETAIL_DRAKE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
