// `Hellhole Flailer` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HELLHOLE_FLAILER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HELLHOLE_FLAILER, "Unleash (You may have this creature enter with a +1/+1 counter on it. It can't block as long as it has a +1/+1 counter on it.)\n{2}{B}{R}, Sacrifice this creature: It deals damage equal to its power to target player or planeswalker.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals damage equal to its power to target player or planeswalker.", HELLHOLE_FLAILER.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals damage equal to its power to target player or planeswalker.");

export const HELLHOLE_FLAILER_SCRIPT: CardScript = {
  oracleId: HELLHOLE_FLAILER.oracleId,
  name: HELLHOLE_FLAILER.name,
  activated: [
    {
      ref: `${HELLHOLE_FLAILER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
