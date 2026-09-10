// `Militant Monk` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MILITANT_MONK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MILITANT_MONK, "Vigilance\n{T}: Prevent the next 1 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", MILITANT_MONK.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

export const MILITANT_MONK_SCRIPT: CardScript = {
  oracleId: MILITANT_MONK.oracleId,
  name: MILITANT_MONK.name,
  activated: [
    {
      ref: `${MILITANT_MONK.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
