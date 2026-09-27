// `Solarion` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOLARION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOLARION, "Sunburst (This creature enters with a +1/+1 counter on it for each color of mana spent to cast it.)\n{T}: Double the number of +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Double the number of +1/+1 counters on ~.", SOLARION.name);
const VOCAB_T_A0 = vocabularyTargets("Double the number of +1/+1 counters on ~.");

export const SOLARION_SCRIPT: CardScript = {
  oracleId: SOLARION.oracleId,
  name: SOLARION.name,
  activated: [
    {
      ref: `${SOLARION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
