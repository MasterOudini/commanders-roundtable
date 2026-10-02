// `Heliophial` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HELIOPHIAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HELIOPHIAL, "Sunburst (This artifact enters with a charge counter on it for each color of mana spent to cast it.)\n{2}, Sacrifice this artifact: It deals damage equal to the number of charge counters on it to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to the number of charge counters on it to any target.", HELIOPHIAL.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to the number of charge counters on it to any target.");

export const HELIOPHIAL_SCRIPT: CardScript = {
  oracleId: HELIOPHIAL.oracleId,
  name: HELIOPHIAL.name,
  activated: [
    {
      ref: `${HELIOPHIAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
