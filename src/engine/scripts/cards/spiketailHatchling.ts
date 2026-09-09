// `Spiketail Hatchling` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIKETAIL_HATCHLING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIKETAIL_HATCHLING, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nSacrifice this creature: Counter target spell unless its controller pays {1}.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Counter target spell unless its controller pays {1}.", SPIKETAIL_HATCHLING.name);
const VOCAB_T_A0 = vocabularyTargets("Counter target spell unless its controller pays {1}.");

export const SPIKETAIL_HATCHLING_SCRIPT: CardScript = {
  oracleId: SPIKETAIL_HATCHLING.oracleId,
  name: SPIKETAIL_HATCHLING.name,
  activated: [
    {
      ref: `${SPIKETAIL_HATCHLING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
