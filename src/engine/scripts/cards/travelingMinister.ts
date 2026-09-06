// `Traveling Minister` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRAVELING_MINISTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRAVELING_MINISTER, "{T}: Target creature gets +1/+0 until end of turn. You gain 1 life. Activate only as a sorcery.");

const VOCAB_A0 = vocabularyEffects("Target creature gets +1/+0 until end of turn. You gain 1 life.", TRAVELING_MINISTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature gets +1/+0 until end of turn. You gain 1 life.");

export const TRAVELING_MINISTER_SCRIPT: CardScript = {
  oracleId: TRAVELING_MINISTER.oracleId,
  name: TRAVELING_MINISTER.name,
  activated: [
    {
      ref: `${TRAVELING_MINISTER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
